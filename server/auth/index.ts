import type { Express } from "express";
import { DevAuthProvider } from "./dev-provider";
import type { AuthProvider } from "./types";

export type { AuthProvider, AuthUser } from "./types";
export { authStorage, type IAuthStorage } from "./storage";

let provider: AuthProvider;

function getProvider(): AuthProvider {
  if (!provider) {
    provider = new DevAuthProvider();
  }
  return provider;
}

export async function setupAuth(app: Express) {
  const p = getProvider();
  await p.initialize(app);
}

export const isAuthenticated = (...args: Parameters<AuthProvider["isAuthenticated"]>) =>
  getProvider().isAuthenticated(...args);

export function registerAuthRoutes(app: Express): void {
  const auth = getProvider().isAuthenticated;

  app.get("/api/auth/user", auth, async (req, res) => {
    try {
      const { authStorage } = await import("./storage");
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
