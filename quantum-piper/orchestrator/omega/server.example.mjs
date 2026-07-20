import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";

/*
  Example adapter only.
  Install the single server-side dependency with: npm i ws
  The browser component itself has zero dependencies.
*/

const PORT = Number(process.env.PORT || 8787);
const VLLM_URL = process.env.VLLM_URL || "http://127.0.0.1:8000/v1/chat/completions";
const VLLM_MODEL = process.env.VLLM_MODEL || "granite-local";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "omega-vllm-ws" }));
});

const wss = new WebSocketServer({
  server,
  path: "/ws",
  handleProtocols(protocols) {
    return protocols.has("omega.chat.v1") ? "omega.chat.v1" : false;
  }
});

wss.on("connection", socket => {
  socket.on("message", async raw => {
    let frame;
    try { frame = JSON.parse(raw.toString()); }
    catch {
      socket.send(JSON.stringify({ type: "error", message: "invalid JSON frame" }));
      return;
    }

    if (frame.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", t: frame.t }));
      return;
    }

    if (frame.type !== "chat.request") return;

    const id = frame.id || crypto.randomUUID();
    socket.send(JSON.stringify({ type: "chat.start", id, model: frame.model || VLLM_MODEL }));

    try {
      const response = await fetch(VLLM_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: frame.model || VLLM_MODEL,
          messages: frame.messages || [],
          stream: true,
          temperature: 0.2
        })
      });

      if (!response.ok || !response.body) {
        throw new Error(`vLLM HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let split;
        while ((split = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);

          for (const line of event.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            let chunk;
            try { chunk = JSON.parse(payload); }
            catch { continue; }

            const delta = chunk.choices?.[0]?.delta?.content || "";
            if (delta) socket.send(JSON.stringify({ type: "chat.delta", id, delta }));
          }
        }
      }

      socket.send(JSON.stringify({ type: "chat.done", id }));
    } catch (error) {
      socket.send(JSON.stringify({ type: "error", id, message: error.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Omega WebSocket adapter listening on ws://127.0.0.1:${PORT}/ws`);
});
