import type { Express, RequestHandler } from "express";
import { storage } from "../storage";
import { insertCompanySchema, insertPolicySchema } from "@shared/schema";
import { z } from "zod";
import { parseId } from "../lib/route-helpers";

export function registerCompanyRoutes(app: Express, auth: RequestHandler): void {
  // Companies
  app.get("/api/companies", auth, async (_req, res) => {
    try {
      res.json(await storage.getCompanies());
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.post("/api/companies", auth, async (req, res) => {
    try {
      const parsed = insertCompanySchema.parse(req.body);
      res.status(201).json(await storage.createCompany(parsed));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.patch("/api/companies/:id", auth, async (req, res) => {
    try {
      const cid = parseId(req, res);
      if (cid === null) return;
      const updated = await storage.updateCompany(cid, req.body);
      if (!updated) return res.status(404).json({ message: "Company not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", auth, async (req, res) => {
    try {
      const dcid = parseId(req, res);
      if (dcid === null) return;
      await storage.deleteCompany(dcid);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Insurance Policies
  app.get("/api/policies/applicable", auth, async (req, res) => {
    try {
      const { workerType, dateOfInjury, litigated } = req.query;
      if (!workerType || !dateOfInjury) {
        return res.status(400).json({ message: "workerType and dateOfInjury are required" });
      }
      res.json(
        await storage.getApplicablePolicy(
          workerType as string,
          dateOfInjury as string,
          litigated === "true",
        ),
      );
    } catch (error) {
      console.error("Error fetching applicable policy:", error);
      res.status(500).json({ message: "Failed to determine applicable policy" });
    }
  });

  app.get("/api/policies", auth, async (_req, res) => {
    try {
      res.json(await storage.getPolicies());
    } catch (error) {
      console.error("Error fetching policies:", error);
      res.status(500).json({ message: "Failed to fetch policies" });
    }
  });

  app.post("/api/policies", auth, async (req, res) => {
    try {
      const parsed = insertPolicySchema.parse(req.body);
      res.status(201).json(await storage.createPolicy(parsed));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating policy:", error);
      res.status(500).json({ message: "Failed to create policy" });
    }
  });

  app.patch("/api/policies/:id", auth, async (req, res) => {
    try {
      const pid = parseId(req, res);
      if (pid === null) return;
      const updated = await storage.updatePolicy(pid, req.body);
      if (!updated) return res.status(404).json({ message: "Policy not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating policy:", error);
      res.status(500).json({ message: "Failed to update policy" });
    }
  });

  app.delete("/api/policies/:id", auth, async (req, res) => {
    try {
      const dpid = parseId(req, res);
      if (dpid === null) return;
      await storage.deletePolicy(dpid);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting policy:", error);
      res.status(500).json({ message: "Failed to delete policy" });
    }
  });
}
