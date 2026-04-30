const SESSION_KEY = "prince-session-id";
const MAX_IMAGES = 6;

/** Vacío en meta api-base → rutas relativas (solo válido si sirves esta web desde Express). */
function apiUrl(path) {
  const meta = document.querySelector('meta[name="api-base"]');
  let base = meta?.getAttribute("content")?.trim() ?? "";
  base = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

const PW_STORAGE = "prince-chat-pw";

function getStoredPassword() {
  try {
    return sessionStorage.getItem(PW_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function setStoredPassword(pw) {
  try {
    sessionStorage.setItem(PW_STORAGE, pw);
  } catch {
    /* ignore */
  }
}

function clearStoredPassword() {
  try {
    sessionStorage.removeItem(PW_STORAGE);
  } catch {
    /* ignore */
  }
}

/** Igual valor que CHAT_PASSWORD en el servidor (header en cada petición protegida). */
function fetchWithAuth(urlPath, options = {}) {
  const headers = new Headers(options.headers ?? undefined);
  const pw = getStoredPassword();
  if (pw) headers.set("X-Chat-Password", pw);
  return fetch(apiUrl(urlPath), { ...options, headers });
}

const EMOJIS = [
  "😀",
  "😂",
  "🥰",
  "😊",
  "😉",
  "🤗",
  "🥺",
  "😳",
  "🤭",
  "💕",
  "✨",
  "🌸",
  "🌙",
  "🔥",
  "💬",
  "🙏",
  "👍",
  "👎",
  "🫶",
  "💅",
  "🎀",
  "🐾",
  "🍓",
  "☕",
  "🍰",
  "💖",
  "💜",
  "🖤",
  "⚡",
  "🌈",
  "⭐️",
  "☁️",
  "🎧",
  "📸",
  "✍️",
  "💭",
  "😭",
  "😤",
  "🫠",
  "🤝",
  "🫡",
  "🙌",
  "💪",
  "🫂",
  "😴",
  "🤔",
  "😎",
  "🥳",
];

const personalityNames = {
  femboy: "Femboy",
  tsundere: "Tsundere",
  loveTsundere: "Tsundere (love)",
  default: "Default",
};

function getSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `sess_${Math.random().toString(36).slice(2)}`;
  }
}

const els = {
  loginGate: document.getElementById("login-gate"),
  loginChecking: document.getElementById("login-checking"),
  loginPanel: document.getElementById("login-panel"),
  loginForm: document.getElementById("login-form"),
  loginPassword: document.getElementById("login-password"),
  loginError: document.getElementById("login-error"),
  messages: document.getElementById("messages"),
  form: document.getElementById("chat-form"),
  input: document.getElementById("message-input"),
  fileInput: document.getElementById("file-input"),
  attachmentStrip: document.getElementById("attachment-strip"),
  btnAttach: document.getElementById("btn-attach"),
  btnEmoji: document.getElementById("btn-emoji"),
  btnSend: document.getElementById("btn-send"),
  btnClear: document.getElementById("btn-clear"),
  btnLogout: document.getElementById("btn-logout"),
  emojiPanel: document.getElementById("emoji-panel"),
  emojiGrid: document.getElementById("emoji-grid"),
  emojiClose: document.getElementById("emoji-close"),
  personalityLabel: document.getElementById("personality-label"),
  modelLabel: document.getElementById("model-label"),
};

function hideLoginGate() {
  els.loginGate?.classList.add("hidden");
}

function showLoginGate(showFormOnly = false) {
  els.loginGate?.classList.remove("hidden");
  if (showFormOnly) {
    els.loginChecking?.classList.add("hidden");
    els.loginPanel?.classList.remove("hidden");
    els.loginPassword?.focus();
  }
}

async function bootstrap() {
  try {
    const res = await fetch(apiUrl("/api/ping"));
    if (!res.ok) {
      els.loginChecking?.classList.add("hidden");
      els.loginPanel?.classList.remove("hidden");
      if (els.loginError) {
        els.loginError.classList.remove("hidden");
        els.loginError.textContent =
          res.status === 404
            ? '404 en /api/ping: puerto equivocado u otro programa en ese puerto. Mira la terminal: "Prince chat — http://localhost:XXXX" y abre exactamente ese puerto. Si definiste PORT en la shell, puede pisar el .env.'
            : `Error del servidor (${res.status}).`;
      }
      els.loginPassword?.focus();
      return;
    }

    const data = await res.json();

    if (!data.authRequired) {
      els.btnLogout?.classList.add("hidden");
      hideLoginGate();
      finishBoot();
      return;
    }

    els.btnLogout?.classList.remove("hidden");

    if (getStoredPassword()) {
      const meta = await fetchWithAuth("/api/meta");
      if (meta.ok) {
        hideLoginGate();
        finishBoot();
        return;
      }
      clearStoredPassword();
    }

    els.loginChecking?.classList.add("hidden");
    els.loginPanel?.classList.remove("hidden");
    els.loginPassword?.focus();
  } catch {
    els.loginChecking?.classList.add("hidden");
    els.loginPanel?.classList.remove("hidden");
    if (els.loginError) {
      els.loginError.classList.remove("hidden");
      els.loginError.textContent = "No se pudo contactar al servidor.";
    }
    els.loginPassword?.focus();
  }
}

function finishBoot() {
  void loadMeta();
  autosizeTextarea();
  els.input.focus();
}

/** @type {{ file: File, url: string }[]} */
let pendingImages = [];

function scrollToBottom() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

function autosizeTextarea() {
  const ta = els.input;
  ta.style.height = "auto";
  ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
}

function renderAttachments() {
  els.attachmentStrip.innerHTML = "";
  if (pendingImages.length === 0) {
    els.attachmentStrip.classList.add("hidden");
    return;
  }
  els.attachmentStrip.classList.remove("hidden");
  pendingImages.forEach((item, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "chip";
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = "";
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "remove";
    rm.textContent = "✕";
    rm.addEventListener("click", () => {
      URL.revokeObjectURL(item.url);
      pendingImages.splice(idx, 1);
      renderAttachments();
    });
    wrap.appendChild(img);
    wrap.appendChild(rm);
    els.attachmentStrip.appendChild(wrap);
  });
}

function appendBubble(role, text, opts = {}) {
  const row = document.createElement("div");
  row.className = `row ${role}`;
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  if (opts.streaming) bubble.classList.add("streaming");
  bubble.textContent = text ?? "";
  row.appendChild(bubble);
  els.messages.appendChild(row);
  scrollToBottom();
  return { row, bubble };
}

function appendUserBubble(text) {
  const row = document.createElement("div");
  row.className = "row user";
  const bubble = document.createElement("div");
  bubble.className = "bubble user";

  if (pendingImages.length > 0) {
    const thumbs = document.createElement("div");
    thumbs.className = "thumbs";
    pendingImages.forEach(({ url }) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      thumbs.appendChild(img);
    });
    bubble.appendChild(thumbs);
  }

  const body = document.createElement("div");
  body.textContent = text || (pendingImages.length ? "(imagen)" : "");
  bubble.appendChild(body);

  row.appendChild(bubble);
  els.messages.appendChild(row);
  scrollToBottom();
}

function showError(message) {
  const el = document.createElement("div");
  el.className = "toast-error";
  el.textContent = message;
  els.messages.appendChild(el);
  scrollToBottom();
}

async function parseSSE(reader, onDelta, onDone, onErr) {
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;
  let sawError = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const block of parts) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const json = line.slice(5).trim();
        try {
          const evt = JSON.parse(json);
          if (evt.type === "delta" && evt.text) onDelta(evt.text);
          else if (evt.type === "done") {
            sawDone = true;
            onDone();
          } else if (evt.type === "error") {
            sawError = true;
            onErr(evt.message || "Error");
          }
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
  }

  if (!sawDone && !sawError) {
    onDone();
  }
}

async function sendChat() {
  const text = els.input.value;
  if (!text.trim() && pendingImages.length === 0) return;

  const sessionId = getSessionId();
  const formData = new FormData();
  formData.append("sessionId", sessionId);
  formData.append("message", text);

  pendingImages.forEach(({ file }) => {
    formData.append("images", file);
  });

  appendUserBubble(text);

  els.input.value = "";
  autosizeTextarea();
  els.btnSend.disabled = true;

  const { row: assistantRow, bubble: assistantBubble } = appendBubble(
    "assistant",
    "",
    { streaming: true }
  );

  pendingImages.forEach(({ url }) => URL.revokeObjectURL(url));
  pendingImages = [];
  renderAttachments();

  let full = "";

  try {
    const headers = new Headers();
    const pw = getStoredPassword();
    if (pw) headers.set("X-Chat-Password", pw);

    const res = await fetch(apiUrl("/api/chat/stream"), {
      method: "POST",
      body: formData,
      headers,
    });

    const ctype = res.headers.get("content-type") || "";

    if (res.status === 401) {
      showLoginGate(true);
      els.loginError?.classList.remove("hidden");
      if (els.loginError)
        els.loginError.textContent =
          "Contraseña incorrecta o no guardada. Vuelve a entrar.";
      throw new Error("No autorizado");
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        typeof errBody.error === "string" ? errBody.error : `HTTP ${res.status}`
      );
    }

    if (!ctype.includes("text/event-stream") || !res.body) {
      throw new Error("Respuesta inválida del servidor.");
    }

    await parseSSE(
      res.body.getReader(),
      (delta) => {
        full += delta;
        assistantBubble.textContent = full;
        scrollToBottom();
      },
      () => {
        assistantBubble.classList.remove("streaming");
      },
      (msg) => {
        assistantBubble.classList.remove("streaming");
        assistantRow.remove();
        showError(msg);
      }
    );

    assistantBubble.classList.remove("streaming");
    if (!full.trim() && assistantRow.isConnected) {
      assistantBubble.textContent = "…";
    }
  } catch (e) {
    assistantBubble.classList.remove("streaming");
    assistantRow.remove();
    showError(e instanceof Error ? e.message : "No se pudo conectar.");
  } finally {
    els.btnSend.disabled = false;
    els.input.focus();
  }
}

async function clearMemory() {
  if (
    !confirm(
      "¿Borrar la memoria de esta conversación en el servidor? Los mensajes en pantalla no se borran."
    )
  ) {
    return;
  }
  const sessionId = getSessionId();
  const res = await fetchWithAuth("/api/clear-context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (res.status === 401) {
    showLoginGate(true);
    showError("Vuelve a poner la contraseña.");
    return;
  }
  if (!res.ok) {
    showError("No se pudo borrar la memoria.");
    return;
  }
  const ok = document.createElement("div");
  ok.className = "toast-error";
  ok.style.borderColor = "rgba(74, 222, 128, 0.35)";
  ok.style.background = "rgba(34, 197, 94, 0.12)";
  ok.style.color = "#bbf7d0";
  ok.textContent = "Memoria del servidor borrada.";
  els.messages.appendChild(ok);
  scrollToBottom();
}

function initEmojiPanel() {
  EMOJIS.forEach((emo) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = emo;
    b.addEventListener("click", () => {
      const ta = els.input;
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? ta.value.length;
      const v = ta.value;
      ta.value = v.slice(0, start) + emo + v.slice(end);
      ta.focus();
      const pos = start + emo.length;
      ta.setSelectionRange(pos, pos);
      autosizeTextarea();
    });
    els.emojiGrid.appendChild(b);
  });
}

function toggleEmojiPanel() {
  const open = els.emojiPanel.classList.toggle("hidden");
  els.emojiPanel.setAttribute("aria-hidden", open ? "true" : "false");
}

async function loadMeta() {
  try {
    const res = await fetchWithAuth("/api/meta");
    if (res.status === 401) {
      showLoginGate(true);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    const p = data.personality ?? "default";
    els.personalityLabel.textContent =
      personalityNames[p] ?? p ?? "—";
    els.modelLabel.textContent = data.model ?? "Claude";
  } catch {
    els.personalityLabel.textContent = "—";
    els.modelLabel.textContent = "—";
  }
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  void sendChat();
});

els.input.addEventListener("input", autosizeTextarea);

els.btnAttach.addEventListener("click", () => els.fileInput.click());

els.fileInput.addEventListener("change", () => {
  const files = Array.from(els.fileInput.files ?? []);
  els.fileInput.value = "";
  const room = MAX_IMAGES - pendingImages.length;
  files.slice(0, room).forEach((file) => {
    if (!file.type.startsWith("image/")) return;
    pendingImages.push({ file, url: URL.createObjectURL(file) });
  });
  renderAttachments();
});

els.btnEmoji.addEventListener("click", toggleEmojiPanel);
els.emojiClose.addEventListener("click", toggleEmojiPanel);

els.btnClear.addEventListener("click", () => {
  void clearMemory();
});

els.loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.loginError?.classList.add("hidden");
  const password = els.loginPassword?.value ?? "";
  try {
    setStoredPassword(password);
    const res = await fetchWithAuth("/api/meta");
    if (!res.ok) {
      clearStoredPassword();
      els.loginError?.classList.remove("hidden");
      if (els.loginError)
        els.loginError.textContent =
          res.status === 401 ? "Contraseña incorrecta." : "No se pudo entrar.";
      return;
    }
    hideLoginGate();
    els.loginPassword.value = "";
    finishBoot();
  } catch {
    clearStoredPassword();
    els.loginError?.classList.remove("hidden");
    if (els.loginError)
      els.loginError.textContent = "Error de red.";
  }
});

els.btnLogout?.addEventListener("click", () => {
  clearStoredPassword();
  window.location.reload();
});

initEmojiPanel();
void bootstrap();
