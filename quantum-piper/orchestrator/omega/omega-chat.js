const OMEGA_PROTOCOL = "omega.chat.v1";

class OmegaSocket {
  constructor(endpoint, handlers = {}) {
    this.endpoint = endpoint;
    this.handlers = handlers;
    this.ws = null;
    this.attempt = 0;
    this.closedByUser = false;
    this.heartbeat = null;
    this.outbox = [];
  }

  connect() {
    this.closedByUser = false;
    this.handlers.state?.("connecting");
    try {
      this.ws = new WebSocket(this.endpoint, OMEGA_PROTOCOL);
    } catch (error) {
      this.handlers.error?.(error);
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener("open", () => {
      this.attempt = 0;
      this.handlers.state?.("open");
      this.flush();
      this.startHeartbeat();
      this.send({ type: "hello", protocol: OMEGA_PROTOCOL, client: "omega-infinity-chat" });
    });

    this.ws.addEventListener("message", event => {
      let data;
      try { data = JSON.parse(event.data); }
      catch { data = { type: "text", content: String(event.data) }; }
      if (data.type === "pong") return;
      this.handlers.message?.(data);
    });

    this.ws.addEventListener("error", event => {
      this.handlers.error?.(new Error("WebSocket transport error"));
    });

    this.ws.addEventListener("close", () => {
      this.stopHeartbeat();
      this.handlers.state?.("closed");
      if (!this.closedByUser) this.scheduleReconnect();
    });
  }

  scheduleReconnect() {
    const delay = Math.min(30000, 600 * 2 ** this.attempt) + Math.random() * 450;
    this.attempt += 1;
    setTimeout(() => this.connect(), delay);
  }

  send(payload) {
    const frame = JSON.stringify(payload);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(frame);
    else this.outbox.push(frame);
  }

  flush() {
    while (this.outbox.length && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(this.outbox.shift());
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => this.send({ type: "ping", t: Date.now() }), 15000);
  }

  stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  close() {
    this.closedByUser = true;
    this.stopHeartbeat();
    this.ws?.close(1000, "client shutdown");
  }
}

class OmegaInfinityChat extends HTMLElement {
  connectedCallback() {
    this.endpoint = this.getAttribute("endpoint") || "ws://127.0.0.1:8787/ws";
    this.model = this.getAttribute("model") || "granite-local";
    this.title = this.getAttribute("title") || "Ω INFINITY CHAT";
    this.models = [
      { id: "granite-local", label: "GRANITE // LOCAL" },
      { id: "vllm-code", label: "vLLM // CODE" },
      { id: "vllm-reason", label: "vLLM // REASON" },
      { id: "snapkitty-router", label: "SOVEREIGN ROUTER" }
    ];
    this.turns = new Map();
    this.render();
    this.bind();
    this.socket = new OmegaSocket(this.endpoint, {
      state: state => this.setState(state),
      message: data => this.onFrame(data),
      error: error => this.system(error.message, true)
    });
    this.socket.connect();
  }

  disconnectedCallback() { this.socket?.close(); }

  render() {
    this.innerHTML = `
      <section class="omega-chat" aria-label="Omega autonomous AI chat">
        <div class="omega-layout">
          <aside class="omega-rail">
            <div class="omega-mark">Ω SNAPKITTY</div>
            <div class="omega-submark">PARALLEL INFERENCE PLANE</div>
            <div class="omega-status">
              <span class="omega-dot" data-state="closed"></span>
              <span class="omega-state">offline</span>
            </div>
            <div class="omega-section-title">model lattice</div>
            <div class="omega-models">
              ${this.models.map(m => `
                <button class="omega-model"
                        data-model="${m.id}"
                        aria-pressed="${m.id === this.model}">
                  ${m.label}
                </button>`).join("")}
            </div>
            <div class="omega-meter">
              <div class="omega-meter-row"><span>CONTEXT FIELD</span><span class="omega-context-label">0%</span></div>
              <div class="omega-meter-bar"><div class="omega-meter-fill"></div></div>
            </div>
          </aside>

          <div class="omega-main">
            <header class="omega-topbar">
              <div class="omega-title"><strong>${escapeHtml(this.title)}</strong> // autonomous websocket console</div>
              <div class="omega-pills">
                <span class="omega-pill hot">NO REACT</span>
                <span class="omega-pill">WS RESILIENT</span>
                <span class="omega-pill">NASM AWARE</span>
                <span class="omega-pill">vLLM READY</span>
              </div>
            </header>

            <div class="omega-log" role="log" aria-live="polite"></div>

            <form class="omega-compose">
              <div class="omega-input-shell">
                <span class="omega-sigil">Ω›</span>
                <textarea class="omega-input" rows="1"
                  placeholder="Message the civilization…  /route  /model  /clear"></textarea>
                <button class="omega-send" type="submit">TRANSMIT</button>
              </div>
              <div class="omega-foot">
                <span>ENTER transmit · SHIFT+ENTER newline</span>
                <span>host tools emit: omega-tool-request</span>
              </div>
            </form>
          </div>
        </div>
      </section>`;
    this.log = this.querySelector(".omega-log");
    this.input = this.querySelector(".omega-input");
    this.sendButton = this.querySelector(".omega-send");
  }

  bind() {
    this.querySelector(".omega-compose").addEventListener("submit", e => {
      e.preventDefault();
      this.submit();
    });

    this.input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.submit();
      }
    });

    this.input.addEventListener("input", () => {
      this.input.style.height = "auto";
      this.input.style.height = `${Math.min(this.input.scrollHeight, 150)}px`;
    });

    this.querySelectorAll(".omega-model").forEach(button => {
      button.addEventListener("click", () => {
        this.model = button.dataset.model;
        this.querySelectorAll(".omega-model").forEach(b =>
          b.setAttribute("aria-pressed", String(b === button)));
        this.system(`ROUTE LOCKED → ${this.model}`);
      });
    });

    this.system("Ω console initialized. Waiting for websocket handshake.");
  }

  setState(state) {
    const dot = this.querySelector(".omega-dot");
    dot.dataset.state = state;
    this.querySelector(".omega-state").textContent =
      state === "open" ? "resonance online" :
      state === "connecting" ? "binding socket" : "offline / retrying";
  }

  submit() {
    const content = this.input.value.trim();
    if (!content) return;

    if (content === "/clear") {
      this.log.innerHTML = "";
      this.input.value = "";
      return;
    }
    if (content.startsWith("/model ")) {
      const next = content.slice(7).trim();
      const button = this.querySelector(`[data-model="${CSS.escape(next)}"]`);
      if (button) button.click();
      else this.system(`UNKNOWN MODEL: ${next}`, true);
      this.input.value = "";
      return;
    }

    const id = crypto.randomUUID();
    this.addMessage("user", content, { id, model: this.model });
    this.turns.set(id, { text: "", thinking: "", node: null });

    this.socket.send({
      type: "chat.request",
      id,
      model: this.model,
      stream: true,
      autonomy: {
        enabled: true,
        max_turns: 8,
        tool_policy: "host-approval"
      },
      messages: [{ role: "user", content }]
    });

    this.input.value = "";
    this.input.style.height = "auto";
    this.updateMeter();
  }

  onFrame(frame) {
    switch (frame.type) {
      case "chat.start":
        this.ensureAssistant(frame.id, frame.model);
        break;
      case "chat.thinking.delta":
        this.appendThinking(frame.id, frame.delta || "");
        break;
      case "chat.delta":
        this.appendDelta(frame.id, frame.delta || "");
        break;
      case "chat.code":
        this.appendCode(frame.id, frame.language || "text", frame.content || "");
        break;
      case "chat.done":
        this.finish(frame.id, frame.usage);
        break;
      case "tool.request":
        this.dispatchEvent(new CustomEvent("omega-tool-request", {
          detail: frame,
          bubbles: true,
          composed: true
        }));
        this.system(`TOOL REQUEST → ${frame.tool || "unknown"} // awaiting host approval`);
        break;
      case "error":
        this.system(frame.message || "Remote inference error", true);
        break;
      case "models":
        this.system(`REMOTE MODELS → ${(frame.models || []).join(", ")}`);
        break;
      default:
        if (frame.content) this.system(frame.content);
    }
  }

  ensureAssistant(id, model = this.model) {
    let turn = this.turns.get(id);
    if (!turn) {
      turn = { text: "", thinking: "", node: null };
      this.turns.set(id, turn);
    }
    if (!turn.node) {
      turn.node = this.addMessage("assistant", "", { id, model, streaming: true });
    }
    return turn;
  }

  appendDelta(id, delta) {
    const turn = this.ensureAssistant(id);
    turn.text += delta;
    const body = turn.node.querySelector(".omega-message-body");
    body.innerHTML = renderRichText(turn.text);
    this.scrollBottom();
  }

  appendThinking(id, delta) {
    const turn = this.ensureAssistant(id);
    turn.thinking += delta;
    let details = turn.node.querySelector(".omega-thinking");
    if (!details) {
      details = document.createElement("details");
      details.className = "omega-thinking";
      details.innerHTML = `<summary>IBM-style thinking trace</summary><div></div>`;
      turn.node.querySelector(".omega-message-body").before(details);
    }
    details.querySelector("div").textContent = turn.thinking;
    this.scrollBottom();
  }

  appendCode(id, language, content) {
    const turn = this.ensureAssistant(id);
    const pre = document.createElement("pre");
    pre.className = "omega-code";
    pre.dataset.language = language;
    pre.innerHTML = language.toLowerCase().includes("asm") || language.toLowerCase().includes("nasm")
      ? highlightNasm(content)
      : escapeHtml(content);
    turn.node.querySelector(".omega-message-body").append(pre);
    this.scrollBottom();
  }

  finish(id, usage = {}) {
    const turn = this.turns.get(id);
    if (!turn?.node) return;
    turn.node.dataset.streaming = "false";
    const head = turn.node.querySelector(".omega-message-head");
    head.textContent += ` // sealed ${new Date().toLocaleTimeString()}`;
    if (usage.total_tokens) this.updateMeter(usage.total_tokens);
  }

  addMessage(role, content, meta = {}) {
    const article = document.createElement("article");
    article.className = `omega-message ${role}`;
    article.dataset.messageId = meta.id || "";
    article.dataset.streaming = String(Boolean(meta.streaming));
    article.innerHTML = `
      <div class="omega-message-head">
        ${role === "user" ? "ARCHITECT" : role === "assistant" ? "Ω AGENT" : "SYSTEM"}
        ${meta.model ? ` // ${escapeHtml(meta.model)}` : ""}
      </div>
      <div class="omega-message-body">${renderRichText(content)}</div>`;
    this.log.append(article);
    this.scrollBottom();
    return article;
  }

  system(content, isError = false) {
    const node = this.addMessage("system", content);
    if (isError) node.classList.add("error");
  }

  updateMeter(tokens = null) {
    const value = tokens == null ? Math.min(96, this.log.children.length * 4) : Math.min(100, tokens / 128);
    this.querySelector(".omega-meter-fill").style.width = `${value}%`;
    this.querySelector(".omega-context-label").textContent = `${Math.round(value)}%`;
  }

  scrollBottom() {
    requestAnimationFrame(() => { this.log.scrollTop = this.log.scrollHeight; });
  }
}

function renderRichText(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/&lt;thinking&gt;([\s\S]*?)&lt;\/thinking&gt;/gi,
      '<details class="omega-thinking" open><summary>thinking trace</summary><div>$1</div></details>')
    .replace(/```(?:nasm|asm)([\s\S]*?)```/gi,
      (_, code) => `<pre class="omega-code" data-language="nasm">${highlightNasm(code.trim())}</pre>`)
    .replace(/```([\s\S]*?)```/g,
      (_, code) => `<pre class="omega-code">${code.trim()}</pre>`);
}

function highlightNasm(code) {
  const escaped = escapeHtml(code);
  return escaped.split("\n").map(line => {
    const commentIndex = line.indexOf(";");
    let codePart = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
    const comment = commentIndex >= 0 ? line.slice(commentIndex) : "";
    codePart = codePart
      .replace(/\b(section|global|extern|bits|default|mov|push|pop|call|ret|jmp|je|jne|cmp|test|xor|and|or|add|sub|mul|div|syscall|int|lea|db|dw|dd|dq)\b/gi, '<span class="kw">$1</span>')
      .replace(/\b(rax|rbx|rcx|rdx|rsi|rdi|rsp|rbp|rip|eax|ebx|ecx|edx|ax|bx|cx|dx|al|bl|cl|dl|xmm\d+|ymm\d+)\b/gi, '<span class="reg">$1</span>')
      .replace(/\b(0x[0-9a-f]+|\d+)\b/gi, '<span class="num">$1</span>');
    return codePart + (comment ? `<span class="comment">${comment}</span>` : "");
  }).join("\n");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

customElements.define("omega-infinity-chat", OmegaInfinityChat);
export { OmegaInfinityChat, OmegaSocket };
