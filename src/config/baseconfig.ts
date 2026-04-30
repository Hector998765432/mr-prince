import type { PromptType } from "../prompts";

function parsePersonality(value: string | undefined): PromptType {
  const v = (value ?? "femboy").toLowerCase().trim();
  const allowed: PromptType[] = ["tsundere", "loveTsundere", "femboy", "default"];
  if (allowed.includes(v as PromptType)) return v as PromptType;
  return "femboy";
}

export const baseConfig = {
  claudeApiKey: (
    process.env.CLAUDE_API_KEY ??
    process.env.ANTHROPIC_API_KEY ??
    ""
  ).trim(),
  /** Alias `claude-haiku-4-5` tracks latest Haiku 4.5 snapshot */
  claudeModel: process.env.CLAUDE_MODEL ?? "claude-haiku-4-5",
  maxMemoryMessages: parseInt(process.env.MAX_MEMORY_MESSAGES ?? "15", 10) || 15,
  personality: parsePersonality(process.env.PERSONALITY),
  /** `dotenv` no pisa PORT ya definido en la terminal; aquí se normaliza espacios en `.env`. */
  port: (() => {
    const raw = String(process.env.PORT ?? "3000").trim();
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 3000;
  })(),
  /** Si tiene valor, la UI y las rutas /api (salvo login/session/logout) exigen cookie de sesión. */
  chatPassword: (process.env.CHAT_PASSWORD ?? "").trim(),
};
