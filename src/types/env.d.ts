declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CLAUDE_API_KEY?: string;
      ANTHROPIC_API_KEY?: string;
      CLAUDE_MODEL?: string;
      MAX_MEMORY_MESSAGES?: string;
      PERSONALITY?: string;
      PORT?: string;
      CHAT_PASSWORD?: string;
      NODE_ENV?: string;
    }
  }
}

export {};
