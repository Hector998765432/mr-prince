import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { baseConfig } from "../config/baseconfig";

/** Header que envía el cliente con el mismo valor que `CHAT_PASSWORD` en `.env`. */
export const PASSWORD_HEADER = "x-chat-password";

export function passwordsMatch(input: string, expected: string): boolean {
  const a = crypto.createHash("sha256").update(input, "utf8").digest();
  const b = crypto.createHash("sha256").update(expected, "utf8").digest();
  return crypto.timingSafeEqual(a, b);
}

function headerPassword(req: Request): string {
  const raw = req.headers[PASSWORD_HEADER];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0] ?? "";
  return "";
}

/** Si hay contraseña en env, exige que el header coincida (comparación en tiempo constante). */
export function requireChatPassword(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!baseConfig.chatPassword) {
    next();
    return;
  }
  if (passwordsMatch(headerPassword(req), baseConfig.chatPassword)) {
    next();
    return;
  }
  res.status(401).json({ error: "Contraseña incorrecta", authRequired: true });
}
