import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  MessageParam,
} from "@anthropic-ai/sdk/resources/messages/messages.js";
import { baseConfig } from "../../config/baseconfig";
import type { ModelMessageTurn } from "../ContextService";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export type ImagePart = {
  buffer: Buffer;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

export class ClaudeService {
  private client: Anthropic;

  constructor() {
    const key = baseConfig.claudeApiKey;
    console.log("key", key);
    if (!key) {
      console.warn(
        "CLAUDE_API_KEY or ANTHROPIC_API_KEY is not set; chat requests will fail."
      );
    }
    this.client = new Anthropic({ apiKey: key });
  }

  buildUserContent(text: string, images: ImagePart[]): ContentBlockParam[] {
    const blocks: ContentBlockParam[] = [];

    for (const img of images) {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mediaType,
          data: img.buffer.toString("base64"),
        },
      });
    }

    const trimmed = text.trim();
    const fallback =
      images.length > 0 ? "(La imagen va adjunta; responde según lo que veas.)" : "";
    const body = trimmed || fallback;
    blocks.push({ type: "text", text: body });

    return blocks;
  }

  normalizeMime(mimetype: string): ImagePart["mediaType"] | null {
    const lower = mimetype.toLowerCase().split(";")[0]?.trim() ?? "";
    if (!ALLOWED_IMAGE_TYPES.has(lower)) return null;
    return lower as ImagePart["mediaType"];
  }

  streamReply(params: {
    systemPrompt: string;
    history: ModelMessageTurn[];
    userContent: ContentBlockParam[];
    onTextDelta: (delta: string) => void;
  }): Promise<string> {
    const messages: MessageParam[] = [
      ...params.history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: params.userContent },
    ];

    const stream = this.client.messages.stream({
      model: baseConfig.claudeModel,
      max_tokens: 8192,
      system: params.systemPrompt,
      messages,
    });

    console.log("stream", stream);

    stream.on("text", (delta) => {
      params.onTextDelta(delta);
    });

    return stream.finalMessage().then((msg) => {
      console.log("msg", msg);
      const parts: string[] = [];
      for (const block of msg.content) {
        if (block.type === "text" && "text" in block) {
          parts.push(block.text);
        }
      }
      return parts.join("") || "";
    });
  }
}
