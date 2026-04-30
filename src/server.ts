import "./loadEnv";
import path from "path";
import express from "express";
import cors from "cors";
import multer from "multer";
import { baseConfig } from "./config/baseconfig";
import { requireChatPassword } from "./auth/chatGate";
import { ContextService } from "./services/ContextService";
import { ClaudeService } from "./services/llms/ClaudeService";
import { getPrompt } from "./prompts";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
});

const contextService = new ContextService();
const claudeService = new ClaudeService();

const publicDir = path.join(process.cwd(), "public");

app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "X-Chat-Password"],
  })
);
app.use(express.json({ limit: "1mb" }));

/* API antes que express.static */
app.get("/api/ping", (_req, res) => {
  res.json({ authRequired: Boolean(baseConfig.chatPassword) });
});

app.get("/api/meta", requireChatPassword, (_req, res) => {
  res.json({
    personality: baseConfig.personality,
    model: baseConfig.claudeModel,
    memorySlots: baseConfig.maxMemoryMessages,
  });
});

app.post("/api/clear-context", requireChatPassword, (req, res) => {
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  if (!sessionId) {
    res.status(400).json({ error: "sessionId requerido" });
    return;
  }
  contextService.clearContext(sessionId);
  res.json({ ok: true });
});

app.post(
  "/api/chat/stream",
  requireChatPassword,
  upload.array("images", 6),
  async (req, res) => {
    const sessionId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    const message =
      typeof req.body?.message === "string" ? req.body.message : "";

    if (!sessionId) {
      res.status(400).json({ error: "sessionId requerido" });
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;
    const images =
      files?.flatMap((f) => {
        const mediaType = claudeService.normalizeMime(f.mimetype);
        if (!mediaType) return [];
        return [{ buffer: f.buffer, mediaType }];
      }) ?? [];

    if (!message.trim() && images.length === 0) {
      res.status(400).json({ error: "Escribe un mensaje o adjunta una imagen." });
      return;
    }

    if (!baseConfig.claudeApiKey) {
      res
        .status(500)
        .json({ error: "Falta CLAUDE_API_KEY o ANTHROPIC_API_KEY en el servidor." });
      return;
    }

    const systemPrompt = getPrompt(baseConfig.personality);
    const history = contextService.getModelMessages(sessionId);
    const userContent = claudeService.buildUserContent(message, images);

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (obj: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

    try {
      const assistantText = await claudeService.streamReply({
        systemPrompt,
        history,
        userContent,
        onTextDelta: (delta) => send({ type: "delta", text: delta }),
      });

      const userSummary =
        message.trim() ||
        (images.length ? `[${images.length} imagen(es)]` : "");

      contextService.addTurn(sessionId, "user", userSummary);
      contextService.addTurn(sessionId, "assistant", assistantText);

      send({ type: "done" });
      res.end();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error(err);
      send({ type: "error", message: msg });
      res.end();
    }
  }
);

app.use(express.static(publicDir));

export default app;

// Local/dev: arrancar servidor. En Vercel (serverless) se importa `app` y NO se escucha puerto.
if (require.main === module) {
  app.listen(baseConfig.port, () => {
    console.log(`Prince server listening on port ${baseConfig.port}`);
  });
}
