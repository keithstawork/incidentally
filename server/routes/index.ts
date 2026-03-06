import type { Express } from "express";
import type { Server } from "http";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "../auth";
import { registerClaimRoutes, registerPublicRoutes } from "./claims";
import { registerProRoutes } from "./pros";
import { registerCompanyRoutes } from "./companies";
import { registerBulkImportRoutes } from "./bulk-import";
import { registerDocumentRoutes } from "./documents";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  const auth = isAuthenticated;

  registerPublicRoutes(app);
  registerClaimRoutes(app, auth);
  registerBulkImportRoutes(app, auth);
  registerProRoutes(app, auth);
  registerCompanyRoutes(app, auth);
  registerDocumentRoutes(app, auth);

  return httpServer;
}
