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
