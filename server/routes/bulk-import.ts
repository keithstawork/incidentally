import type { Express, RequestHandler } from "express";
import { storage } from "../storage";
import {
  normalizeRow,
  parseDate,
  VALID_WORKER_TYPES,
  VALID_STATUSES,
  VALID_STAGES,
  VALID_CLAIM_TYPES,
} from "../lib/bulk-import-utils";

const SYNCABLE_FIELDS = [
  "firstName", "lastName", "proId", "dateOfInjury", "dateSubmitted", "dateClosed", "dateEmployerNotified",
  "workerType", "claimType", "claimStatus", "injuryType", "stateOfInjury", "shiftType", "partnerName",
  "partnerState", "shiftLocation", "payRate", "shiftLengthHours", "insuredName", "carrier", "policyYear", "policyNumber",
  "tnsSpecialist", "adjuster", "applicantAttorney", "defenseAttorney", "stage",
  "tldr", "nextSteps", "severityAndPrognosis", "futureMedicalExpense", "pathway", "pathwaySteps", "pathwayWhenToUse",
  "totalPayments", "totalOutstanding", "incentiveAmount", "medicalTotal", "temporaryDisability", "lossesPaid",
  "permanentTotalDisability", "lossAdjustingExpenses", "mmi", "impairmentRating",
  "settlementRecommendation", "settlementAuthority", "actualSettlementAmount",
  "medicalPanelSent", "mpnDwc7Sent", "billOfRightsSent", "paidFullShift", "payIssuedViaIncentiveAdp",
  "fnolFiled", "froiFiled", "wageStatementSent", "earningsStatementSent", "gaWc1FormSent",
  "noShowCleared", "lateCancellationCleared", "shiftsExcused", "reportNumber", "notes",
  "litigationNotes", "legalRequest", "ratingComplaint", "intercomLink", "shiftLink", "irLink", "medicalDocsLink",
  "tpaClaimId", "litigated",
] as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BULK_ROWS = 2000;

export function registerBulkImportRoutes(app: Express, auth: RequestHandler): void {
  app.post("/api/claims/bulk-import", auth, async (req, res) => {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No rows provided" });
      }
      if (rows.length > MAX_BULK_ROWS) {
        return res.status(400).json({ message: `Too many rows (max ${MAX_BULK_ROWS}). Split into smaller batches.` });
      }

      const results = { imported: 0, skipped: 0, errors: [] as string[] };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          normalizeRow(row);

          if (!row.firstName || !row.lastName || !row.dateOfInjury || !row.workerType || !row.partnerName) {
            results.errors.push(`Row ${i + 1}: Missing required fields (firstName/proName, lastName, dateOfInjury, workerType, partnerName)`);
            results.skipped++;
            continue;
          }

          await storage.createClaim({
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            dateOfInjury: row.dateOfInjury,
            workerType: row.workerType,
            partnerName: row.partnerName.trim(),
            tpaClaimId: row.tpaClaimId || null,
            proId: row.proId || null,
            dateSubmitted: row.dateSubmitted || null,
            dateEmployerNotified: row.dateEmployerNotified || null,
            dateClosed: row.dateClosed || null,
            claimType: row.claimType || "Pending",
            claimStatus: row.claimStatus || "Open",
            injuryType: row.injuryType || null,
            stateOfInjury: row.stateOfInjury || null,
            shiftType: row.shiftType || null,
            litigated: row.litigated || false,
            insuredName: row.insuredName || null,
            carrier: row.carrier || null,
            policyYear: row.policyYear || null,
            policyNumber: row.policyNumber || null,
            tnsSpecialist: row.tnsSpecialist || null,
            adjuster: row.adjuster || null,
            applicantAttorney: row.applicantAttorney || null,
            defenseAttorney: row.defenseAttorney || null,
            stage: row.stage || "intake",
            tldr: row.tldr || null,
            nextSteps: row.nextSteps || null,
            severityAndPrognosis: row.severityAndPrognosis || null,
            futureMedicalExpense: row.futureMedicalExpense || null,
            pathway: row.pathway || null,
            pathwaySteps: row.pathwaySteps || null,
            pathwayWhenToUse: row.pathwayWhenToUse || null,
            totalPayments: row.totalPayments || "0",
            totalOutstanding: row.totalOutstanding || "0",
            incentiveAmount: row.incentiveAmount || null,
            medicalTotal: row.medicalTotal || null,
            temporaryDisability: row.temporaryDisability || false,
            lossesPaid: row.lossesPaid || null,
            permanentTotalDisability: row.permanentTotalDisability || false,
            lossAdjustingExpenses: row.lossAdjustingExpenses || null,
            mmi: row.mmi || false,
            impairmentRating: row.impairmentRating || null,
            settlementRecommendation: row.settlementRecommendation || null,
            settlementAuthority: row.settlementAuthority || null,
            actualSettlementAmount: row.actualSettlementAmount || null,
            medicalPanelSent: row.medicalPanelSent || false,
            mpnDwc7Sent: row.mpnDwc7Sent || false,
            billOfRightsSent: row.billOfRightsSent || false,
            paidFullShift: row.paidFullShift || false,
            payIssuedViaIncentiveAdp: row.payIssuedViaIncentiveAdp || false,
            fnolFiled: row.fnolFiled || false,
            froiFiled: row.froiFiled || false,
            wageStatementSent: row.wageStatementSent || false,
            earningsStatementSent: row.earningsStatementSent || false,
            gaWc1FormSent: row.gaWc1FormSent || false,
            noShowCleared: row.noShowCleared || false,
            lateCancellationCleared: row.lateCancellationCleared || false,
            shiftsExcused: row.shiftsExcused || false,
            reportNumber: row.reportNumber || null,
            notes: row.notes || null,
            litigationNotes: row.litigationNotes || null,
            legalRequest: row.legalRequest || null,
            ratingComplaint: row.ratingComplaint || false,
            intercomLink: row.intercomLink || null,
            shiftLink: row.shiftLink || null,
            irLink: row.irLink || null,
            medicalDocsLink: row.medicalDocsLink || null,
            createdBy: row.createdBy || "csv-import",
            sourceEmailId: row.sourceEmailId || null,
          });
          results.imported++;
        } catch (rowError: any) {
          results.errors.push(`Row ${i + 1}: ${rowError.message}`);
          results.skipped++;
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error importing claims:", error);
      res.status(500).json({ message: "Failed to import claims", error: error.message });
    }
  });

  app.post("/api/claims/bulk-sync", auth, async (req, res) => {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No rows provided" });
      }
      if (rows.length > MAX_BULK_ROWS) {
        return res.status(400).json({ message: `Too many rows (max ${MAX_BULK_ROWS}). Split into smaller batches.` });
      }

      const results = { synced: 0, noMatch: 0, errors: [] as string[] };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          normalizeRow(row);

          const matterNumber = row.matterNumber ? String(row.matterNumber).trim() : undefined;
          const tpaClaimId = row.tpaClaimId ? String(row.tpaClaimId).trim() : undefined;
          const proId = row.proId ? String(row.proId).trim() : undefined;
          const rawDoi = row.dateOfInjury;
          const dateOfInjury = (rawDoi && parseDate(String(rawDoi).trim())) || undefined;
          const firstName = row.firstName ? String(row.firstName).trim() : undefined;
          const lastName = row.lastName ? String(row.lastName).trim() : undefined;

          const existing = await storage.findClaimForSync({
            matterNumber: matterNumber || undefined,
            tpaClaimId: tpaClaimId || undefined,
            proId: proId || undefined,
            dateOfInjury,
            firstName,
            lastName,
          });

          if (!existing) {
            results.noMatch++;
            results.errors.push(`Row ${i + 1}: No matching incident (use Incident No., Claim Number, or Pro ID + Date of Injury, or First + Last + Date of Injury)`);
            continue;
          }

          const updates: Record<string, any> = {};
          for (const key of SYNCABLE_FIELDS) {
            let val = row[key];
            if (val === undefined) continue;
            if (val === null || val === "") {
              updates[key] = null;
              continue;
            }
            val = typeof val === "string" ? val.trim() : val;
            if (key === "workerType") {
              updates[key] = VALID_WORKER_TYPES.includes(val) ? val : null;
            } else if (key === "claimStatus") {
              updates[key] = [...VALID_STATUSES, "Not reported/Incident only 1099"].includes(val) ? val : null;
            } else if (key === "stage") {
              updates[key] = VALID_STAGES.includes(val) ? val : null;
            } else if (key === "claimType") {
              updates[key] = VALID_CLAIM_TYPES.includes(val) ? val : null;
            } else if (["dateOfInjury", "dateSubmitted", "dateClosed", "dateEmployerNotified"].includes(key)) {
              updates[key] = DATE_ONLY.test(String(val)) ? val : null;
            } else if (key === "stateOfInjury") {
              updates[key] = typeof val === "string" && val.length >= 2 ? val.substring(0, 2).toUpperCase() : null;
            } else if (key === "firstName" || key === "lastName") {
              updates[key] = String(val).trim();
            } else {
              updates[key] = val;
            }
          }

          await storage.updateClaim(existing.id, updates);
          results.synced++;
        } catch (rowError: any) {
          results.errors.push(`Row ${i + 1}: ${rowError.message}`);
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error syncing claims:", error);
      res.status(500).json({ message: "Failed to sync claims", error: error.message });
    }
  });
}
