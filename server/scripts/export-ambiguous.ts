import { db } from "../db";
import { claims } from "@shared/schema";
import { executeRedshiftQuery } from "../redshift";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import pLimit from "p-limit";
import { normalize, nameSimilarity, teardown } from "./lib/shared";

interface ClaimRow {
  id: number;
  matterNumber: string | null;
  firstName: string;
  lastName: string;
  dateOfInjury: string;
  stateOfInjury: string | null;
  partnerName: string | null;
}

interface ReviewRow {
  incident: string;
  claimant: string;
  doi: string;
  state: string;
  category: string;
  candidateCount: number;
  proId: string;
  proStatus: string;
  proEmail: string;
  proPhone: string;
  proCity: string;
  proState: string;
  /** When one worker on shift matches claimant name (definitive from shift). */
  suggestedFromShift: string;
  suggestedFromShiftEmail: string;
  /** When no definitive match but one worker on shift is a near name match (flag for review). */
  nearMatchFromShift: string;
  nearMatchFromShiftEmail: string;
  nearMatchFromShiftScore: string;
}

async function searchRedshift(firstName: string, lastName: string) {
  const fn = firstName.replace(/'/g, "''").trim();
  const ln = lastName.replace(/'/g, "''").trim();
  const query = `
    SELECT id AS pro_id, name, email, phonenum AS phone, locality, state, worker_status
    FROM iw_backend_db.backend_userprofile
    WHERE LOWER(TRIM(given_name)) = LOWER('${fn}')
      AND LOWER(TRIM(family_name)) = LOWER('${ln}')
    ORDER BY worker_status, id
  `;
  try {
    const { columns, rows } = await executeRedshiftQuery(query);
    const ci = Object.fromEntries(columns.map((c, i) => [c, i]));
    return rows.map((r) => ({
      proId: r[ci.pro_id],
      name: r[ci.name],
      email: r[ci.email],
      phone: r[ci.phone],
      locality: r[ci.locality],
      state: r[ci.state],
      status: r[ci.worker_status],
    }));
  } catch {
    return null;
  }
}

/** Workers who worked a shift on the given date at the given partner (from Redshift gigs_view). */
async function getWorkersOnShift(doi: string, partnerName: string | null): Promise<{ workerId: number; email: string | null; name: string | null; givenName: string | null; familyName: string | null }[]> {
  if (!doi) return [];
  const safeDate = doi.replace(/'/g, "''").trim();
  const nextDay = new Date(doi);
  nextDay.setDate(nextDay.getDate() + 1);
  const safeNextDay = nextDay.toISOString().split("T")[0];
  let partnerClause = "";
  if (partnerName && partnerName.trim()) {
    const safe = partnerName.replace(/'/g, "''").trim().substring(0, 50);
    partnerClause = `AND LOWER(TRIM(g.business_name)) LIKE LOWER('%${safe}%')`;
  }
  const query = `
    SELECT DISTINCT g.worker_id, u.email, u.name, u.given_name, u.family_name
    FROM iw_backend_db.gigs_view g
    JOIN iw_backend_db.backend_userprofile u ON g.worker_id = u.id
    WHERE g.starts_at >= '${safeDate}'
      AND g.starts_at < '${safeNextDay}'
      AND g.is_cancelled = 0
      ${partnerClause}
    LIMIT 100
  `;
  try {
    const { columns, rows } = await executeRedshiftQuery(query);
    const ci = Object.fromEntries(columns.map((c, i) => [c, i]));
    return rows.map((r) => ({
      workerId: r[ci.worker_id] as number,
      email: (r[ci.email] as string) ?? null,
      name: (r[ci.name] as string) ?? null,
      givenName: (r[ci.given_name] as string) ?? null,
      familyName: (r[ci.family_name] as string) ?? null,
    }));
  } catch {
    return [];
  }
}


/** Score shift workers by name match; return definitive match and/or best near match. */
function matchAndNearFromShift(
  shiftWorkers: { workerId: number; email: string | null; givenName: string | null; familyName: string | null }[],
  claimantFirstName: string,
  claimantLastName: string
): { match: { workerId: number; email: string | null } | null; nearMatch: { workerId: number; email: string | null; score: number } | null } {
  if (shiftWorkers.length === 0) return { match: null, nearMatch: null };
  const scored = shiftWorkers.map((w) => {
    const fnScore = Math.max(
      nameSimilarity(claimantFirstName, w.givenName || ""),
      nameSimilarity(claimantFirstName, (w.givenName || "").split(" ")[0] || "")
    );
    const lnScore = Math.max(
      nameSimilarity(claimantLastName, w.familyName || ""),
      nameSimilarity(claimantLastName, w.familyName || "")
    );
    return { worker: w, fnScore, lnScore, score: (fnScore + lnScore) / 2 };
  });
  const strong = scored.filter((s) => s.fnScore >= 0.9 && s.lnScore >= 0.9);
  if (strong.length === 1) return { match: { workerId: strong[0].worker.workerId, email: strong[0].worker.email }, nearMatch: null };
  const loose = scored.filter((s) => s.fnScore >= 0.8 && s.lnScore >= 0.9);
  if (loose.length === 1) return { match: { workerId: loose[0].worker.workerId, email: loose[0].worker.email }, nearMatch: null };
  // No definitive match; flag best "near" (fn>=0.6, ln>=0.6, score < 0.8) for review
  const near = scored
    .filter((s) => s.fnScore >= 0.6 && s.lnScore >= 0.6 && s.score < 0.8)
    .sort((a, b) => b.score - a.score);
  if (near.length >= 1) {
    const best = near[0];
    return { match: null, nearMatch: { workerId: best.worker.workerId, email: best.worker.email, score: best.score } };
  }
  return { match: null, nearMatch: null };
}

async function run() {
  const missing = await db.select({
    id: claims.id,
    matterNumber: claims.matterNumber,
    firstName: claims.firstName,
    lastName: claims.lastName,
    dateOfInjury: claims.dateOfInjury,
    stateOfInjury: claims.stateOfInjury,
    partnerName: claims.partnerName,
  }).from(claims)
    .where(sql`(pro_id IS NULL OR pro_id = '') AND deleted_at IS NULL`)
    .orderBy(claims.lastName, claims.firstName);

  console.log(`Still missing Pro ID: ${missing.length}\n`);

  const nameMap = new Map<string, ClaimRow[]>();
  for (const c of missing) {
    const key = `${c.firstName.trim().toLowerCase()}|${c.lastName.trim().toLowerCase()}`;
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key)!.push(c);
  }

  const csvLines: string[] = [
    "Incident No.,Claimant,DOI,State,Category,# Candidates,Pro ID,Pro Status,Pro Email,Pro Phone,Pro City,Pro State,From Shift (Pro ID),From Shift (Email)"
  ];
  const rows: ReviewRow[] = [];

  let searchCount = 0;
  const limit = pLimit(5);
  const nameEntries = Array.from(nameMap.entries());
  const groupTasks = nameEntries.map(([nameKey, claimGroup]) => limit(async () => {
    const [fn, ln] = nameKey.split("|");
    searchCount++;
    if (searchCount % 25 === 0) console.log(`  ... ${searchCount}/${nameMap.size}`);

    const results = await searchRedshift(fn, ln);
    const category = !results ? "error" : results.length === 0 ? "no_match" : "ambiguous";

    for (const claim of claimGroup) {
      const incident = claim.matterNumber || `#${claim.id}`;
      const name = `${claim.lastName}, ${claim.firstName}`;
      const state = claim.stateOfInjury || "";
      const doi = claim.dateOfInjury;

      // Shift-based lookup: workers on this claim's DOI+partner. Match = one name match; nearMatch = flag for review.
      let suggestedFromShift = "";
      let suggestedFromShiftEmail = "";
      let nearMatchFromShift = "";
      let nearMatchFromShiftEmail = "";
      let nearMatchFromShiftScore = "";
      try {
        const shiftWorkers = await getWorkersOnShift(doi, claim.partnerName);
        const { match, nearMatch } = matchAndNearFromShift(shiftWorkers, claim.firstName, claim.lastName);
        if (match) {
          suggestedFromShift = String(match.workerId);
          suggestedFromShiftEmail = match.email || "";
        }
        if (nearMatch) {
          nearMatchFromShift = String(nearMatch.workerId);
          nearMatchFromShiftEmail = nearMatch.email || "";
          nearMatchFromShiftScore = nearMatch.score.toFixed(2);
        }
      } catch {
        // ignore
      }

      const suggest = (proId: string, proStatus: string, proEmail: string, proPhone: string, proCity: string, proState: string) => {
        rows.push({
          incident,
          claimant: name,
          doi,
          state,
          category,
          candidateCount: results?.length ?? 0,
          proId,
          proStatus,
          proEmail,
          proPhone,
          proCity,
          proState,
          suggestedFromShift,
          suggestedFromShiftEmail,
          nearMatchFromShift,
          nearMatchFromShiftEmail,
          nearMatchFromShiftScore,
        });
      };

      if (!results || results.length === 0) {
        csvLines.push(
          `"${incident}","${name}","${doi}","${state}","${category}",0,,,,,,,"${suggestedFromShift}","${suggestedFromShiftEmail}","${nearMatchFromShift}","${nearMatchFromShiftEmail}","${nearMatchFromShiftScore}"`
        );
        suggest("", "", "", "", "", "");
      } else {
        for (const pro of results) {
          csvLines.push(
            `"${incident}","${name}","${doi}","${state}","${category}",${results.length},${pro.proId},"${pro.status}","${pro.email || ""}","${pro.phone || ""}","${pro.locality || ""}","${pro.state || ""}","${suggestedFromShift}","${suggestedFromShiftEmail}","${nearMatchFromShift}","${nearMatchFromShiftEmail}","${nearMatchFromShiftScore}"`
          );
          suggest(
            String(pro.proId ?? ""),
            String(pro.status ?? ""),
            String(pro.email ?? ""),
            String(pro.phone ?? ""),
            String(pro.locality ?? ""),
            String(pro.state ?? "")
          );
        }
      }
    }
  }));
  await Promise.all(groupTasks);

  const outPath = path.join(process.cwd(), "pro-id-manual-review.csv");
  fs.writeFileSync(outPath, csvLines.join("\n"));
  console.log(`\nWrote ${csvLines.length - 1} rows to ${outPath}`);

  const html = buildReviewHtml(rows);
  const htmlPath = path.join(process.cwd(), "pro-id-manual-review.html");
  fs.writeFileSync(htmlPath, html);
  console.log(`Wrote HTML to ${htmlPath}`);
}

function buildReviewHtml(rows: ReviewRow[]): string {
  const dataJson = JSON.stringify(rows).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pro ID Manual Review</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem; background: #fafaf9; color: #1c1917; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-bottom: 1rem; }
    .toolbar input, .toolbar select { padding: 0.35rem 0.5rem; border: 1px solid #d6d3d1; border-radius: 6px; }
    .toolbar input { min-width: 180px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid #e7e5e4; }
    th { background: #3B5747; color: #fff; font-weight: 600; font-size: 0.75rem; white-space: nowrap; cursor: pointer; user-select: none; }
    th:hover { background: #2d4335; }
    td { font-size: 0.8125rem; }
    tr:hover { background: #f5f5f4; }
    .cat-no_match { color: #B45309; }
    .cat-ambiguous { color: #2E5A88; }
    .cat-error { color: #B91C1C; }
    .state-match { background: #dcfce7; }
    .from-shift { background: #dcfce7; font-weight: 500; }
    .from-shift-cell { color: #166534; }
    .near-match-cell { color: #B45309; font-weight: 500; }
    footer { margin-top: 1rem; font-size: 0.75rem; color: #78716c; }
  </style>
</head>
<body>
  <h1>Pro ID Manual Review</h1>
  <p>Claims missing Pro ID. Name lookup + <strong>shift lookup</strong> (DOI + partner): when one worker on that shift matches the claimant&apos;s name, that Pro is shown under &quot;From shift&quot; and is the correct match.</p>
  <div class="toolbar">
    <input type="text" id="search" placeholder="Search incident, claimant, Pro ID..." />
    <select id="filterCat">
      <option value="">All categories</option>
      <option value="no_match">No match</option>
      <option value="ambiguous">Ambiguous</option>
      <option value="error">Error</option>
    </select>
    <select id="filterState">
      <option value="">All states</option>
    </select>
    <select id="filterShift">
      <option value="">All</option>
      <option value="yes">Has &quot;From shift&quot; suggestion</option>
      <option value="near">Has near match from shift</option>
    </select>
    <span id="count"></span>
  </div>
  <div style="overflow-x: auto;">
    <table id="table">
      <thead>
        <tr>
          <th data-col="incident">Incident No.</th>
          <th data-col="claimant">Claimant</th>
          <th data-col="doi">DOI</th>
          <th data-col="state">State</th>
          <th data-col="category">Category</th>
          <th data-col="candidateCount"># Candidates</th>
          <th data-col="proId">Pro ID</th>
          <th data-col="proStatus">Pro Status</th>
          <th data-col="proEmail">Pro Email</th>
          <th data-col="proPhone">Pro Phone</th>
          <th data-col="proCity">Pro City</th>
          <th data-col="proState">Pro State</th>
          <th>From shift (Pro ID)</th>
          <th>From shift (Email)</th>
          <th>Near match (Pro ID)</th>
          <th>Near match (Email)</th>
          <th>Near match (score)</th>
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
  <footer id="footer"></footer>
  <script type="application/json" id="review-data">${dataJson}</script>
  <script>
    const rows = JSON.parse(document.getElementById('review-data').textContent);
    const tbody = document.getElementById('tbody');
    const searchEl = document.getElementById('search');
    const filterCat = document.getElementById('filterCat');
    const filterState = document.getElementById('filterState');
    const filterShift = document.getElementById('filterShift');
    const countEl = document.getElementById('count');
    const footerEl = document.getElementById('footer');

    const states = [...new Set(rows.map(r => r.state).filter(Boolean))].sort();
    states.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      filterState.appendChild(opt);
    });

    let sortCol = 'incident';
    let sortDir = 1;
    document.querySelectorAll('#table th[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-col');
        if (sortCol === col) sortDir = -sortDir; else { sortCol = col; sortDir = 1; }
        render();
      });
    });

    function escapeHtml(s) {
      if (s == null) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function render() {
      const q = (searchEl.value || '').toLowerCase();
      const cat = filterCat.value;
      const state = filterState.value;
      const shiftOnly = filterShift.value === 'yes';
      const filtered = rows.filter(r => {
        if (cat && r.category !== cat) return false;
        if (state && r.state !== state) return false;
        if (shiftOnly === 'yes' && !r.suggestedFromShift) return false;
        if (shiftOnly === 'near' && !r.nearMatchFromShift) return false;
        if (q) {
          const str = [r.incident, r.claimant, r.doi, r.state, r.proId, r.proEmail, r.suggestedFromShift, r.suggestedFromShiftEmail, r.nearMatchFromShift, r.nearMatchFromShiftEmail].join(' ').toLowerCase();
          if (!str.includes(q)) return false;
        }
        return true;
      });
      filtered.sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (sortCol === 'candidateCount') { va = Number(va) || 0; vb = Number(vb) || 0; }
        if (va < vb) return -sortDir;
        if (va > vb) return sortDir;
        return 0;
      });
      tbody.innerHTML = filtered.map(r => {
        const stateMatch = r.state && r.proState && r.state.toUpperCase() === r.proState.toUpperCase() ? ' state-match' : '';
        const isShiftMatch = r.suggestedFromShift && r.proId === r.suggestedFromShift;
        const rowClass = isShiftMatch ? ' from-shift' : '';
        const nearClass = r.nearMatchFromShift ? ' near-match-cell' : '';
        return '<tr class="' + rowClass + '"><td>' + escapeHtml(r.incident) + '</td><td>' + escapeHtml(r.claimant) + '</td><td>' + escapeHtml(r.doi) + '</td><td>' + escapeHtml(r.state) + '</td><td class="cat-' + r.category + stateMatch + '">' + escapeHtml(r.category) + '</td><td>' + r.candidateCount + '</td><td>' + escapeHtml(r.proId) + '</td><td>' + escapeHtml(r.proStatus) + '</td><td>' + escapeHtml(r.proEmail) + '</td><td>' + escapeHtml(r.proPhone) + '</td><td>' + escapeHtml(r.proCity) + '</td><td>' + escapeHtml(r.proState) + '</td><td class="' + (r.suggestedFromShift ? 'from-shift-cell' : '') + '">' + escapeHtml(r.suggestedFromShift) + '</td><td class="' + (r.suggestedFromShift ? 'from-shift-cell' : '') + '">' + escapeHtml(r.suggestedFromShiftEmail) + '</td><td class="' + nearClass + '">' + escapeHtml(r.nearMatchFromShift) + '</td><td class="' + nearClass + '">' + escapeHtml(r.nearMatchFromShiftEmail) + '</td><td class="' + nearClass + '">' + escapeHtml(r.nearMatchFromShiftScore) + '</td></tr>';
      }).join('');
      countEl.textContent = filtered.length + ' of ' + rows.length + ' rows';
      footerEl.textContent = 'Generated from IncidentAlly. "From shift" = one worker on shift matches name. "Near match" = close name match on shift (flag for review).';
    }
    searchEl.addEventListener('input', render);
    filterCat.addEventListener('change', render);
    filterState.addEventListener('change', render);
    filterShift.addEventListener('change', render);
    render();
  </script>
</body>
</html>`;
}

run()
  .then(() => teardown(0))
  .catch((err) => { console.error(err); teardown(1); });
