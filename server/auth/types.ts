import type { Express, RequestHandler, Request } from "express";

export interface AuthUser {
  id: string;
  role: string;
  claims: { sub: string };
}

export interface AuthProvider {
  initialize(app: Express): Promise<void>;
  isAuthenticated: RequestHandler;
  getUser(req: Request): AuthUser | null;
}

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

declare module "express" {
  interface Request {
    user?: AuthUser;
  }
}
