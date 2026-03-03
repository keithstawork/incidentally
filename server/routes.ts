import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { proStorage } from "./pro-storage";
import { getRiskAnalytics } from "./risk-analytics";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./auth";
import { insertClaimSchema, insertClaimNoteSchema, insertCompanySchema, insertPolicySchema } from "@shared/schema";
import { z } from "zod";
import type { Request, Response } from "express";

function parseId(req: Request, res: Response): number | null {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ message: "Invalid ID" });
    return null;
  }
  return id;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/claims", isAuthenticated, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.stage) filters.stage = req.query.stage;
      if (req.query.claimStatus) filters.claimStatus = req.query.claimStatus;
      if (req.query.workerType) filters.workerType = req.query.workerType;
      if (req.query.stateOfInjury) filters.stateOfInjury = req.query.stateOfInjury;
      if (req.query.partnerName) filters.partnerName = req.query.partnerName;
      if (req.query.carrier) filters.carrier = req.query.carrier;
      if (req.query.litigated !== undefined) filters.litigated = req.query.litigated === "true";
      if (req.query.tnsSpecialist) filters.tnsSpecialist = req.query.tnsSpecialist;
      if (req.query.search) filters.search = req.query.search;
      if (req.query.limit) {
        const lim = parseInt(req.query.limit as string);
        if (!isNaN(lim) && lim > 0) filters.limit = Math.min(lim, 5000);
      }
      if (req.query.offset) {
        const off = parseInt(req.query.offset as string);
        if (!isNaN(off) && off >= 0) filters.offset = off;
      }

      const claims = await storage.getClaims(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(claims);
    } catch (error) {
      console.error("Error fetching claims:", error);
      res.status(500).json({ message: "Failed to fetch claims" });
    }
  });

  app.get("/api/claims/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      const claim = await storage.getClaim(id);
      if (!claim) return res.status(404).json({ message: "Claim not found" });
      res.json(claim);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch claim" });
    }
  });

  app.post("/api/claims", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertClaimSchema.parse(req.body);
      const claim = await storage.createClaim(parsed);
      res.status(201).json(claim);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating claim:", error);
      res.status(500).json({ message: "Failed to create claim" });
    }
  });

  app.patch("/api/claims/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      const existing = await storage.getClaim(id);
      if (!existing) return res.status(404).json({ message: "Claim not found" });

      const oldStatus = existing.claimStatus;
      const oldStage = existing.stage;

      const fieldChanges: { field: string; from: any; to: any }[] = [];
      const skipFields = new Set(["statusChangeReason", "id", "createdAt", "updatedAt"]);
      for (const [key, newVal] of Object.entries(req.body)) {
        if (skipFields.has(key)) continue;
        const oldVal = (existing as any)[key];
        const norm = (v: any) => (v === null || v === undefined || v === "" ? null : String(v));
        if (norm(oldVal) !== norm(newVal)) {
          fieldChanges.push({ field: key, from: oldVal ?? null, to: newVal ?? null });
        }
      }

      const updated = await storage.updateClaim(id, req.body);

      if (updated && fieldChanges.length > 0) {
        const user = req.user as any;
        await storage.createClaimStatusHistory({
          claimId: id,
          fromStatus: oldStatus,
          toStatus: req.body.claimStatus || oldStatus,
          fromStage: oldStage,
          toStage: req.body.stage || oldStage,
          changedBy: user?.claims?.sub || "system",
          reason: req.body.statusChangeReason || null,
          changes: JSON.stringify(fieldChanges),
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating claim:", error);
      res.status(500).json({ message: "Failed to update claim" });
    }
  });

  app.delete("/api/claims/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      const { reason } = req.body || {};
      const user = (req as any).user;
      const deletedBy = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Unknown";

      const existing = await storage.getClaim(id);
      if (!existing) return res.status(404).json({ message: "Claim not found" });

      const deleted = await storage.softDeleteClaim(id, deletedBy, reason || "No reason provided");
      if (!deleted) return res.status(404).json({ message: "Claim not found" });

      await storage.createClaimStatusHistory({
        claimId: id,
        fromStatus: existing.claimStatus,
        toStatus: "Deleted",
        fromStage: existing.stage,
        toStage: existing.stage,
        changedBy: deletedBy,
        changes: JSON.stringify({ action: "Claim deleted", reason: reason || "No reason provided" }),
      });

      res.json({ message: "Claim deleted", id });
    } catch (error) {
      console.error("Error deleting claim:", error);
      res.status(500).json({ message: "Failed to delete claim" });
    }
  });

  app.post("/api/claims/merge", isAuthenticated, async (req, res) => {
    try {
      const { primaryId, secondaryId, resolvedFields } = req.body;
      if (!primaryId || !secondaryId || primaryId === secondaryId) {
        return res.status(400).json({ message: "Two different claim IDs required" });
      }
      const user = (req as any).user;
      const mergedBy = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Unknown";
      const result = await storage.mergeClaims(primaryId, secondaryId, resolvedFields || {}, mergedBy);
      if (!result) return res.status(404).json({ message: "One or both claims not found" });
      res.json(result);
    } catch (error) {
      console.error("Error merging claims:", error);
      res.status(500).json({ message: "Failed to merge claims" });
    }
  });

  app.get("/api/claims/:id/notes", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      const notes = await storage.getClaimNotes(id);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/claims/:id/notes", isAuthenticated, async (req, res) => {
    try {
      const claimId = parseId(req, res);
      if (claimId === null) return;
      const parsed = insertClaimNoteSchema.parse({
        ...req.body,
        claimId,
      });
      const note = await storage.createClaimNote(parsed);
      res.status(201).json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", isAuthenticated, async (req, res) => {
    try {
      const noteId = parseId(req, res);
      if (noteId === null) return;
      const updated = await storage.updateClaimNote(noteId, req.body);
      if (!updated) return res.status(404).json({ message: "Note not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  app.get("/api/claims/:id/history", isAuthenticated, async (req, res) => {
    try {
      const hid = parseId(req, res);
      if (hid === null) return;
      const history = await storage.getClaimStatusHistory(hid);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  app.get("/api/dashboard/stats", isAuthenticated, async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/financials", isAuthenticated, async (_req, res) => {
    try {
      const data = await storage.getFinancials();
      res.json(data);
    } catch (error) {
      console.error("Error fetching financials:", error);
      res.status(500).json({ message: "Failed to fetch financials" });
    }
  });

  app.get("/api/risk-analytics", isAuthenticated, async (_req, res) => {
    try {
      const data = await getRiskAnalytics();
      res.json(data);
    } catch (error) {
      console.error("Error fetching risk analytics:", error);
      res.status(500).json({ message: "Failed to fetch risk analytics" });
    }
  });

  app.post("/api/claims/bulk-import", isAuthenticated, async (req, res) => {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No rows provided" });
      }

      const results = { imported: 0, skipped: 0, errors: [] as string[] };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          if (row.proName && (!row.firstName || !row.lastName)) {
            let fullName = row.proName.trim().replace(/\n/g, " ");
            fullName = fullName.replace(/\s*\(DOI\s+[\d/]+\)\s*$/i, "");
            fullName = fullName.replace(/[\s_]+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/, "");
            fullName = fullName.trim();
            const parts = fullName.split(/\s+/);
            if (parts.length === 1) {
              row.firstName = parts[0];
              row.lastName = "";
            } else if (parts.length === 2) {
              row.firstName = parts[0];
              row.lastName = parts[1];
            } else {
              row.firstName = parts[0];
              row.lastName = parts.slice(1).join(" ");
            }
            delete row.proName;
          }

          if (!row.firstName || !row.lastName || !row.dateOfInjury || !row.workerType || !row.partnerName) {
            results.errors.push(`Row ${i + 1}: Missing required fields (firstName/proName, lastName, dateOfInjury, workerType, partnerName)`);
            results.skipped++;
            continue;
          }

          const parseDate = (val: string): string | null => {
            if (!val) return null;
            val = val.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
            const mdyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
            if (mdyMatch) {
              let year = mdyMatch[3];
              if (year.length === 2) year = (parseInt(year) > 50 ? "19" : "20") + year;
              return `${year}-${mdyMatch[1].padStart(2, "0")}-${mdyMatch[2].padStart(2, "0")}`;
            }
            return val;
          };

          const dateFields = ["dateOfInjury", "dateSubmitted", "dateClosed", "dateEmployerNotified"];
          for (const field of dateFields) {
            if (row[field]) {
              row[field] = parseDate(row[field]);
            }
          }

          const workerTypeNormalize: Record<string, string> = {
            w2: "W2",
            "1099": "1099",
            cl: "CL",
            "workers compensation": "W2",
            "workers comp": "W2",
            "worker's comp": "W2",
            "worker's compensation": "W2",
            wc: "W2",
            "occupational accident": "1099",
            oa: "1099",
            "contingent liability": "CL",
            contingent: "CL",
          };
          const wtLower = String(row.workerType).toLowerCase().trim();
          row.workerType = workerTypeNormalize[wtLower] || row.workerType;

          const validWorkerTypes = ["W2", "1099", "CL"];
          if (!validWorkerTypes.includes(row.workerType)) {
            row.workerType = "W2";
          }

          if (row.claimStatus === "Not reported/Incident only 1099") {
            row.claimStatus = "Incident Report";
          }
          const validStatuses = ["Open", "Closed", "Denied", "Incident Only", "Incident Report"];
          if (row.claimStatus && !validStatuses.includes(row.claimStatus)) {
            row.claimStatus = "Open";
          }

          const validStages = ["intake", "active_claim", "litigation", "settled", "closed"];
          if (row.stage && !validStages.includes(row.stage)) {
            row.stage = "intake";
          }

          const claimTypeNormalize: Record<string, string> = {
            "other than medical only": "Other Than Medical Only",
            "otherthanmedicalonly": "Other Than Medical Only",
            "accidental medical expense": "Accidental Medical Expense",
            "indemnity & medical": "Indemnity & Medical",
            "indemnity": "Indemnity",
          };
          if (row.claimType) {
            const ctLower = row.claimType.toLowerCase().trim();
            row.claimType = claimTypeNormalize[ctLower] || row.claimType;
          }
          const validClaimTypes = ["Medical Only", "Other Than Medical Only", "Incident Only", "Incident Only W2", "Incident Only 1099", "Accidental Medical Expense", "Indemnity", "Indemnity & Medical", "Pending"];
          if (row.claimType && !validClaimTypes.includes(row.claimType)) {
            row.claimType = "Pending";
          }

          const booleanFields = [
            "litigated", "temporaryDisability", "permanentTotalDisability", "mmi",
            "medicalPanelSent", "mpnDwc7Sent", "billOfRightsSent", "paidFullShift",
            "payIssuedViaIncentiveAdp", "fnolFiled", "froiFiled", "wageStatementSent",
            "earningsStatementSent", "gaWc1FormSent", "noShowCleared",
            "lateCancellationCleared", "shiftsExcused", "ratingComplaint",
          ];
          for (const field of booleanFields) {
            if (row[field] !== undefined) {
              const val = String(row[field]).toLowerCase().trim();
              row[field] = val === "true" || val === "yes" || val === "1" || val === "x";
            }
          }

          const decimalFields = [
            "totalPayments", "totalOutstanding", "incentiveAmount", "medicalTotal",
            "lossesPaid", "lossAdjustingExpenses", "settlementRecommendation",
            "settlementAuthority", "actualSettlementAmount",
          ];
          for (const field of decimalFields) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== "") {
              const cleaned = String(row[field]).replace(/[$,\s]/g, "");
              row[field] = isNaN(parseFloat(cleaned)) ? null : cleaned;
            } else {
              row[field] = null;
            }
          }

          if (row.stateOfInjury) {
            row.stateOfInjury = row.stateOfInjury.trim().toUpperCase().substring(0, 2);
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

  app.post("/api/claims/bulk-sync", isAuthenticated, async (req, res) => {
    try {
      const { rows, addNew } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No rows provided" });
      }
      const createIfNoMatch = addNew === true || addNew === "true";

      const results = { synced: 0, created: 0, noMatch: 0, errors: [] as string[] };
      const parseDate = (val: string): string | null => {
        if (!val) return null;
        val = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        const mdyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (mdyMatch) {
          let year = mdyMatch[3];
          if (year.length === 2) year = (parseInt(year) > 50 ? "19" : "20") + year;
          return `${year}-${mdyMatch[1].padStart(2, "0")}-${mdyMatch[2].padStart(2, "0")}`;
        }
        return val;
      };

      const syncableFields = [
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

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          if (row.proName && (!row.firstName || !row.lastName)) {
            let fullName = String(row.proName).trim().replace(/\n/g, " ");
            fullName = fullName.replace(/\s*\(DOI\s+[\d/]+\)\s*$/i, "").replace(/[\s_]+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/, "").trim();
            const parts = fullName.split(/\s+/);
            if (parts.length === 1) {
              row.firstName = parts[0];
              row.lastName = "";
            } else if (parts.length >= 2) {
              row.firstName = parts[0];
              row.lastName = parts.slice(1).join(" ");
            }
            delete row.proName;
          }

          const dateFields = ["dateOfInjury", "dateSubmitted", "dateClosed", "dateEmployerNotified"];
          for (const field of dateFields) {
            if (row[field]) row[field] = parseDate(row[field]);
          }

          const workerTypeMap: Record<string, string> = {
            w2: "W2", "1099": "1099", cl: "CL", "workers compensation": "W2", "workers comp": "W2",
            "worker's comp": "W2", "worker's compensation": "W2", wc: "W2", "occupational accident": "1099",
            oa: "1099", "contingent liability": "CL", contingent: "CL",
          };
          if (row.workerType) {
            const wt = workerTypeMap[String(row.workerType).toLowerCase().trim()] || row.workerType;
            row.workerType = ["W2", "1099", "CL"].includes(wt) ? wt : "W2";
          }

          if (row.claimStatus === "Not reported/Incident only 1099") row.claimStatus = "Incident Report";
          if (row.claimStatus && !["Open", "Closed", "Denied", "Incident Only", "Incident Report"].includes(row.claimStatus)) row.claimStatus = "Open";
          if (row.stage && !["intake", "active_claim", "litigation", "settled", "closed"].includes(row.stage)) row.stage = "intake";
          const claimTypeMap: Record<string, string> = {
            "other than medical only": "Other Than Medical Only", "otherthanmedicalonly": "Other Than Medical Only",
            "accidental medical expense": "Accidental Medical Expense", "indemnity & medical": "Indemnity & Medical", "indemnity": "Indemnity",
          };
          if (row.claimType) {
            row.claimType = claimTypeMap[row.claimType.toLowerCase().trim()] || row.claimType;
          }
          if (row.claimType && !["Medical Only", "Other Than Medical Only", "Incident Only", "Incident Only W2", "Incident Only 1099", "Accidental Medical Expense", "Indemnity", "Indemnity & Medical", "Pending"].includes(row.claimType)) {
            row.claimType = "Pending";
          }

          const booleanFields = [
            "litigated", "temporaryDisability", "permanentTotalDisability", "mmi",
            "medicalPanelSent", "mpnDwc7Sent", "billOfRightsSent", "paidFullShift", "payIssuedViaIncentiveAdp",
            "fnolFiled", "froiFiled", "wageStatementSent", "earningsStatementSent", "gaWc1FormSent",
            "noShowCleared", "lateCancellationCleared", "shiftsExcused", "ratingComplaint",
          ];
          for (const field of booleanFields) {
            if (row[field] !== undefined) {
              const v = String(row[field]).toLowerCase().trim();
              row[field] = v === "true" || v === "yes" || v === "1" || v === "x";
            }
          }

          const decimalFields = ["totalPayments", "totalOutstanding", "incentiveAmount", "medicalTotal", "lossesPaid", "lossAdjustingExpenses", "settlementRecommendation", "settlementAuthority", "actualSettlementAmount"];
          for (const field of decimalFields) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== "") {
              const cleaned = String(row[field]).replace(/[$,\s]/g, "");
              row[field] = isNaN(parseFloat(cleaned)) ? null : cleaned;
            } else {
              row[field] = null;
            }
          }

          if (row.stateOfInjury) {
            row.stateOfInjury = String(row.stateOfInjury).trim().toUpperCase().substring(0, 2);
          }

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

          const VALID_WORKER_TYPES = ["W2", "1099", "CL"];
          const VALID_CLAIM_STATUSES = ["Open", "Closed", "Denied", "Incident Only", "Incident Report", "Not reported/Incident only 1099"];
          const VALID_STAGES = ["intake", "active_claim", "litigation", "settled", "closed"];
          const VALID_CLAIM_TYPES = ["Medical Only", "Other Than Medical Only", "Incident Only", "Incident Only W2", "Incident Only 1099", "Accidental Medical Expense", "Indemnity", "Indemnity & Medical", "Pending"];
          const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

          const updates: Record<string, any> = {};
          for (const key of syncableFields) {
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
              updates[key] = VALID_CLAIM_STATUSES.includes(val) ? val : null;
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

  app.get("/api/search", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) return res.json([]);
      const results = await storage.searchClaims(query);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to search claims" });
    }
  });

  app.get("/api/pros/search", isAuthenticated, async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (!query || query.length < 2) return res.json([]);
      const results = await proStorage.searchPros(query);
      res.json(results);
    } catch (error) {
      console.error("Error searching pros:", error);
      res.status(500).json({ message: "Failed to search pros" });
    }
  });

  app.get("/api/pros/stats", isAuthenticated, async (_req, res) => {
    try {
      const stats = await proStorage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pro stats" });
    }
  });

  app.get("/api/pros/:id/open-claims", isAuthenticated, async (req, res) => {
    try {
      const proId = parseInt(req.params.id);
      if (isNaN(proId)) return res.status(400).json({ message: "Invalid Pro ID" });
      res.json(await proStorage.getOpenClaims(proId));
    } catch (error) {
      console.error("Error fetching open claims:", error);
      res.status(500).json({ message: "Failed to fetch open claims" });
    }
  });

  app.get("/api/pros/:id/shift-stats", isAuthenticated, async (req, res) => {
    try {
      const proId = parseInt(req.params.id);
      if (isNaN(proId)) return res.status(400).json({ message: "Invalid Pro ID" });
      res.json(await proStorage.getShiftStats(proId));
    } catch (error) {
      console.error("Error fetching shift stats:", error);
      res.status(500).json({ message: "Failed to fetch shift stats" });
    }
  });

  app.get("/api/pros/:id/shifts", isAuthenticated, async (req, res) => {
    try {
      const proId = parseInt(req.params.id);
      if (isNaN(proId)) return res.status(400).json({ message: "Invalid Pro ID" });
      const month = req.query.month as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const shifts = month
        ? await proStorage.getProShiftsByMonth(proId, month)
        : await proStorage.getProShifts(proId, limit || 10);
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching pro shifts:", error);
      res.status(500).json({ message: "Failed to fetch shifts" });
    }
  });

  app.get("/api/pros/:id", isAuthenticated, async (req, res) => {
    try {
      const proId = parseInt(req.params.id);
      if (isNaN(proId)) return res.status(400).json({ message: "Invalid Pro ID" });
      const pro = await proStorage.getPro(proId);
      if (!pro) return res.status(404).json({ message: "Pro not found" });
      res.json(pro);
    } catch (error) {
      console.error("Error fetching pro:", error);
      res.status(500).json({ message: "Failed to fetch pro" });
    }
  });

  // --- Companies ---

  app.get("/api/companies", isAuthenticated, async (_req, res) => {
    try { res.json(await storage.getCompanies()); }
    catch { res.status(500).json({ message: "Failed to fetch companies" }); }
  });

  app.post("/api/companies", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(parsed);
      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.patch("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const cid = parseId(req, res);
      if (cid === null) return;
      const updated = await storage.updateCompany(cid, req.body);
      if (!updated) return res.status(404).json({ message: "Company not found" });
      res.json(updated);
    } catch { res.status(500).json({ message: "Failed to update company" }); }
  });

  app.delete("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const dcid = parseId(req, res);
      if (dcid === null) return;
      await storage.deleteCompany(dcid);
      res.status(204).send();
    } catch { res.status(500).json({ message: "Failed to delete company" }); }
  });

  // --- Insurance Policies ---

  app.get("/api/policies/applicable", isAuthenticated, async (req, res) => {
    try {
      const { workerType, dateOfInjury, litigated } = req.query;
      if (!workerType || !dateOfInjury) {
        return res.status(400).json({ message: "workerType and dateOfInjury are required" });
      }
      const result = await storage.getApplicablePolicy(
        workerType as string,
        dateOfInjury as string,
        litigated === "true",
      );
      res.json(result);
    } catch { res.status(500).json({ message: "Failed to determine applicable policy" }); }
  });

  app.get("/api/policies", isAuthenticated, async (_req, res) => {
    try { res.json(await storage.getPolicies()); }
    catch { res.status(500).json({ message: "Failed to fetch policies" }); }
  });

  app.post("/api/policies", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertPolicySchema.parse(req.body);
      const policy = await storage.createPolicy(parsed);
      res.status(201).json(policy);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      res.status(500).json({ message: "Failed to create policy" });
    }
  });

  app.patch("/api/policies/:id", isAuthenticated, async (req, res) => {
    try {
      const pid = parseId(req, res);
      if (pid === null) return;
      const updated = await storage.updatePolicy(pid, req.body);
      if (!updated) return res.status(404).json({ message: "Policy not found" });
      res.json(updated);
    } catch { res.status(500).json({ message: "Failed to update policy" }); }
  });

  app.delete("/api/policies/:id", isAuthenticated, async (req, res) => {
    try {
      const dpid = parseId(req, res);
      if (dpid === null) return;
      await storage.deletePolicy(dpid);
      res.status(204).send();
    } catch { res.status(500).json({ message: "Failed to delete policy" }); }
  });

  return httpServer;
}
