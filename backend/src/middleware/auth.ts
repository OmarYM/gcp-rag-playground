import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import { AppConfig } from "../config.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        email?: string;
      };
    }
  }
}

export function createAuthMiddleware(cfg: AppConfig) {
  const client = new OAuth2Client({
    clientId: cfg.auth.googleClientId,
    ...(cfg.auth.googleRedirectUri
      ? { redirect_uris: [cfg.auth.googleRedirectUri] }
      : {}),
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    if (cfg.auth.devAuthBypass) {
      const devUser = req.header("x-dev-user-id")?.trim() || "dev-user-1";
      req.user = {
        sub: devUser,
        email: `${devUser}@local.dev`,
      };
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!cfg.auth.googleClientId) {
      res.status(500).json({ error: "Server authentication is not configured" });
      return;
    }

    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: cfg.auth.googleClientId,
      });
      const payload = ticket.getPayload();

      if (!payload || !payload.sub) {
        res.status(401).json({ error: "Invalid token payload" });
        return;
      }

      req.user = {
        sub: payload.sub,
        email: payload.email,
      };
      next();
    } catch (error) {
      console.error("Auth Error:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  };
}
