import type { Express, RequestHandler } from "express";
import { proStorage } from "../pro-storage";
import { parseId } from "../lib/route-helpers";

export function registerProRoutes(app: Express, auth: RequestHandler): void {
  app.get("/api/pros/search", auth, async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (!query || query.length < 2) return res.json([]);
      res.json(await proStorage.searchPros(query));
    } catch (error) {
      console.error("Error searching pros:", error);
      res.status(500).json({ message: "Failed to search pros" });
    }
  });

  app.get("/api/pros/stats", auth, async (_req, res) => {
    try {
      res.json(await proStorage.getStats());
    } catch (error) {
      console.error("Error fetching pro stats:", error);
      res.status(500).json({ message: "Failed to fetch pro stats" });
    }
  });

  app.get("/api/pros/:id/open-claims", auth, async (req, res) => {
    try {
      const proId = parseId(req, res);
      if (proId === null) return;
      res.json(await proStorage.getOpenClaims(proId));
    } catch (error) {
      console.error("Error fetching open claims:", error);
      res.status(500).json({ message: "Failed to fetch open claims" });
    }
  });

  app.get("/api/pros/:id/shift-stats", auth, async (req, res) => {
    try {
      const proId = parseId(req, res);
      if (proId === null) return;
      res.json(await proStorage.getShiftStats(proId));
    } catch (error) {
      console.error("Error fetching shift stats:", error);
      res.status(500).json({ message: "Failed to fetch shift stats" });
    }
  });

  app.get("/api/pros/:id/shifts", auth, async (req, res) => {
    try {
      const proId = parseId(req, res);
      if (proId === null) return;
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

  app.get("/api/pros/:id", auth, async (req, res) => {
    try {
      const proId = parseId(req, res);
      if (proId === null) return;
      const pro = await proStorage.getPro(proId);
      if (!pro) return res.status(404).json({ message: "Pro not found" });
      res.json(pro);
    } catch (error) {
      console.error("Error fetching pro:", error);
      res.status(500).json({ message: "Failed to fetch pro" });
    }
  });
}
