import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertClaimSchema, insertClaimNoteSchema } from "@shared/schema";
import { z } from "zod";

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

      const claims = await storage.getClaims(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(claims);
    } catch (error) {
      console.error("Error fetching claims:", error);
      res.status(500).json({ message: "Failed to fetch claims" });
    }
  });

  app.get("/api/claims/:id", isAuthenticated, async (req, res) => {
    try {
      const claim = await storage.getClaim(parseInt(req.params.id));
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
      const id = parseInt(req.params.id);
      const existing = await storage.getClaim(id);
      if (!existing) return res.status(404).json({ message: "Claim not found" });

      const oldStatus = existing.claimStatus;
      const oldStage = existing.stage;
      const updated = await storage.updateClaim(id, req.body);

      if (updated && (req.body.claimStatus !== oldStatus || req.body.stage !== oldStage)) {
        const user = req.user as any;
        await storage.createClaimStatusHistory({
          claimId: id,
          fromStatus: oldStatus,
          toStatus: req.body.claimStatus || oldStatus,
          fromStage: oldStage,
          toStage: req.body.stage || oldStage,
          changedBy: user?.claims?.sub || "system",
          reason: req.body.statusChangeReason || null,
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
      await storage.deleteClaim(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete claim" });
    }
  });

  app.get("/api/claims/:id/notes", isAuthenticated, async (req, res) => {
    try {
      const notes = await storage.getClaimNotes(parseInt(req.params.id));
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/claims/:id/notes", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertClaimNoteSchema.parse({
        ...req.body,
        claimId: parseInt(req.params.id),
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
      const updated = await storage.updateClaimNote(parseInt(req.params.id), req.body);
      if (!updated) return res.status(404).json({ message: "Note not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  app.get("/api/claims/:id/history", isAuthenticated, async (req, res) => {
    try {
      const history = await storage.getClaimStatusHistory(parseInt(req.params.id));
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

          const validStatuses = ["Open", "Closed", "Denied", "Incident Only", "Not reported/Incident only 1099"];
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

  return httpServer;
}
