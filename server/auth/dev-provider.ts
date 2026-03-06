import session from "express-session";
import type { Express, RequestHandler, Request } from "express";
import type { AuthProvider, AuthUser } from "./types";
import { authStorage } from "./storage";

const DEV_USER = {
  id: "local-dev-user",
  email: "dev@localhost",
  firstName: "Dev",
  lastName: "User",
  profileImageUrl: null,
};

export class DevAuthProvider implements AuthProvider {
  async initialize(app: Express): Promise<void> {
    app.set("trust proxy", 1);
    app.use(
      session({
        secret: process.env.SESSION_SECRET || "local-dev-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: false,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        },
      }),
    );

    await authStorage.upsertUser(DEV_USER);

    app.get("/api/login", (req, res) => {
      req.session.userId = DEV_USER.id;
      res.redirect("/");
    });

    app.get("/api/callback", (_req, res) => res.redirect("/"));

    app.get("/api/logout", (req, res) => {
      req.session.destroy(() => res.redirect("/"));
    });
  }

  isAuthenticated: RequestHandler = (req, res, next) => {
    if (req.session?.userId) {
      req.user = {
        id: DEV_USER.id,
        role: "admin",
        claims: { sub: DEV_USER.id },
      };
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  getUser(req: Request): AuthUser | null {
    return req.user ?? null;
  }
}
