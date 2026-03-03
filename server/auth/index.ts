import session from "express-session";
import type { Express, RequestHandler } from "express";
import { authStorage } from "./storage";

export { authStorage, type IAuthStorage } from "./storage";

const DEV_USER = {
  id: "local-dev-user",
  email: "dev@localhost",
  firstName: "Dev",
  lastName: "User",
  profileImageUrl: null,
};

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "local-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  await authStorage.upsertUser(DEV_USER);

  app.get("/api/login", (req: any, res) => {
    req.session.userId = DEV_USER.id;
    res.redirect("/");
  });

  app.get("/api/callback", (_req, res) => res.redirect("/"));

  app.get("/api/logout", (req: any, res) => {
    req.session.destroy(() => res.redirect("/"));
  });
}

export const isAuthenticated: RequestHandler = (req: any, res, next) => {
  if (req.session?.userId) {
    req.user = { claims: { sub: DEV_USER.id } };
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
