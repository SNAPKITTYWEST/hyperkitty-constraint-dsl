# Ω Infinity Chat

A dependency-free autonomous chat panel for SnapKitty IDE.

## Included

- Vanilla Web Component: `<omega-infinity-chat>`
- No React, no browser-side framework, no build step
- Streaming WebSocket protocol
- Exponential reconnect with jitter
- Heartbeats and queued outbound frames
- vLLM/OpenAI-compatible streaming adapter example
- IBM-inspired `<thinking>` trace presentation
- Multi-model routing controls
- NASM syntax-aware code blocks
- Host-approved tool request events
- Responsive glowing bottom-panel UI

## Run the browser component

Serve the folder with any static server:

```sh
python -m http.server 8080
```

The component itself does not require Python; that command is only a convenient static server example.

Open:

```text
http://127.0.0.1:8080
```

## Integrate into an IDE

Copy these files into the IDE webview:

```text
omega-chat.css
omega-chat.js
```

Then add:

```html
<link rel="stylesheet" href="./omega-chat.css">

<omega-infinity-chat
  endpoint="ws://127.0.0.1:8787/ws"
  model="granite-local"
  title="Ω INFINITY CHAT">
</omega-infinity-chat>

<script type="module" src="./omega-chat.js"></script>
```

## Host tool bridge

```js
document.addEventListener("omega-tool-request", async event => {
  const request = event.detail;

  // Validate tool name, arguments, workspace boundaries, and user approval.
  // Never execute arbitrary commands directly from a model response.

  console.log("Tool request awaiting IDE approval", request);
});
```

## vLLM adapter

`server.example.mjs` converts the browser WebSocket protocol into an OpenAI-compatible streaming request.

The adapter uses the small `ws` package server-side:

```sh
npm install ws
VLLM_URL=http://127.0.0.1:8000/v1/chat/completions \
VLLM_MODEL=granite-local \
node server.example.mjs
```

The browser UI remains dependency-free.

## Thinking tags

The renderer recognizes:

```text
<thinking>internal trace text</thinking>
```

It also accepts streamed `chat.thinking.delta` frames. Keep sensitive chain-of-thought private; use the panel for concise model summaries, validation traces, and tool plans rather than hidden reasoning.

## NASM blocks

Use fenced blocks labeled `nasm` or send a `chat.code` frame:

```json
{
  "type": "chat.code",
  "id": "request-id",
  "language": "nasm",
  "content": "section .text\nmov rax, 60\nsyscall"
}
```

## Security boundary

The component never evaluates JavaScript from the model and never executes shell or assembly. It emits explicit tool-request events to the IDE host, where permissions and user approval must be enforced.
