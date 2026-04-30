import { baseConfig } from "../config/baseconfig";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Plain text turns; compatible with Claude `messages` when using string content. */
export type ModelMessageTurn = { role: "user" | "assistant"; content: string };

export class ContextService {
  private contextMap: Map<string, ChatTurn[]> = new Map();

  private cap(): number {
    return Math.max(1, baseConfig.maxMemoryMessages);
  }

  addTurn(sessionId: string, role: "user" | "assistant", content: string): void {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (!this.contextMap.has(sessionId)) {
      this.contextMap.set(sessionId, []);
    }

    const messages = this.contextMap.get(sessionId)!;
    messages.push({ role, content: trimmed });

    const max = this.cap();
    while (messages.length > max) {
      messages.shift();
    }
  }

  getModelMessages(sessionId: string): ModelMessageTurn[] {
    const turns = this.contextMap.get(sessionId) ?? [];
    return turns.map((t) => ({
      role: t.role,
      content: t.content,
    }));
  }

  clearContext(sessionId: string): void {
    this.contextMap.delete(sessionId);
  }
}
