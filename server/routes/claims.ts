import type { Express, RequestHandler } from "express";
import { storage } from "../storage";
import { proStorage } from "../pro-storage";
import { getRiskAnalytics, invalidateRiskAnalyticsCache } from "../risk-analytics";
import { insertClaimSchema, insertClaimNoteSchema } from "@shared/schema";
import { z } from "zod";
import { parseId } from "../lib/route-helpers";

export function registerPublicRoutes(app: Express): void {
  app.get("/api/public/stats", async (_req, res) => {
    try {
      const stats = await storage.getSplashStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching public stats:", error);
      res.json({ openIncidents: 0, inLitigation: 0, totalIncurred: 0, newThisMonth: 0 });
    }
  });
}

export function registerClaimRoutes(app: Express, auth: RequestHandler): void {
  // Composite detail endpoint: returns claim + notes + history + pro + applicable policy in one request
  app.get("/api/claims/:id/detail", auth, async (req, res) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;

      const claim = await storage.getClaim(id);
      if (!claim) return res.status(404).json({ message: "Claim not found" });

      const [notes, history, pro, applicablePolicy] = await Promise.all([
        storage.getClaimNotes(id),
        storage.getClaimStatusHistory(id),
        claim.proId ? proStorage.getPro(parseInt(claim.proId)).catch(() => null) : Promise.resolve(null),
        claim.workerType && claim.dateOfInjury
          ? storage.getApplicablePolicy(claim.workerType, claim.dateOfInjury, claim.litigated ?? false).catch(() => null)
          : Promise.resolve(null),
      ]);

      res.json({ claim, notes, history, pro, applicablePolicy });
    } catch (error) {
      console.error("Error fetching claim detail:", error);
      res.status(500).json({ message: "Failed to fetch claim detail" });
    }
  });

  app.get("/api/claims", auth, async (req, res) => {
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

  app.get("/api/claims/:id", auth, async (req, res) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      const claim = await storage.getClaim(id);
      if (!claim) return res.status(404).json({ message: "Claim not found" });
      res.json(claim);
    } catch (error) {
      console.error("Error fetching claim:", error);
      res.status(500).json({ message: "Failed to fetch claim" });
    }
  });

  app.post("/api/claims", auth, async (req, res) => {
    try {
      const parsed = insertClaimSchema.parse(req.body);
      const claim = await storage.createClaim(parsed);
      invalidateRiskAnalyticsCache();
      res.status(201).json(claim);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating claim:", error);
      res.status(500).json({ message: "Failed to create claim" });
    }
  });

  app.patch("/api/claims/:id", auth, async (req, res) => {
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
        const user = (req as any).user;
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

      invalidateRiskAnalyticsCache();
      res.json(updated);
    } catch (error) {
      console.error("Error updating claim:", error);
      res.status(500).json({ message: "Failed to update claim" });
    }
  });

  app.delete("/api/claims/:id", auth, async (req, res) => {
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

      invalidateRiskAnalyticsCache();
      res.json({ message: "Claim deleted", id });
    } catch (error) {
      console.error("Error deleting claim:", error);
      res.status(500).json({ message: "Failed to delete claim" });
    }
  });

  app.post("/api/claims/merge", auth, async (req, res) => {
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

  // Notes
  app.get("/api/claims/:id/notes", auth, async (req, res) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      res.json(await storage.getClaimNotes(id));
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/claims/:id/notes", auth, async (req, res) => {
    try {
      const claimId = parseId(req, res);
      if (claimId === null) return;
      const parsed = insertClaimNoteSchema.parse({ ...req.body, claimId });
      res.status(201).json(await storage.createClaimNote(parsed));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", auth, async (req, res) => {
    try {
      const noteId = parseId(req, res);
      if (noteId === null) return;
      const updated = await storage.updateClaimNote(noteId, req.body);
      if (!updated) return res.status(404).json({ message: "Note not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  // History
  app.get("/api/claims/:id/history", auth, async (req, res) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      res.json(await storage.getClaimStatusHistory(id));
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // Search
  app.get("/api/search", auth, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) return res.json([]);
      res.json(await storage.searchClaims(query));
    } catch (error) {
      console.error("Error searching claims:", error);
      res.status(500).json({ message: "Failed to search claims" });
    }
  });

  // Dashboard / analytics
  app.get("/api/dashboard/stats", auth, async (_req, res) => {
    try {
      res.json(await storage.getDashboardStats());
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/financials", auth, async (_req, res) => {
    try {
      res.json(await storage.getFinancials());
    } catch (error) {
      console.error("Error fetching financials:", error);
      res.status(500).json({ message: "Failed to fetch financials" });
    }
  });

  app.get("/api/risk-analytics", auth, async (_req, res) => {
    try {
      res.json(await getRiskAnalytics());
    } catch (error) {
      console.error("Error fetching risk analytics:", error);
      res.status(500).json({ message: "Failed to fetch risk analytics" });
    }
  });
}
