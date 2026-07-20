# Ω WebSocket Protocol

Subprotocol: `omega.chat.v1`

## Browser → host

```json
{
  "type": "chat.request",
  "id": "uuid",
  "model": "granite-local",
  "stream": true,
  "autonomy": {
    "enabled": true,
    "max_turns": 8,
    "tool_policy": "host-approval"
  },
  "messages": [
    {"role": "user", "content": "Inspect this NASM routine"}
  ]
}
```

Heartbeat:

```json
{"type":"ping","t":1750000000000}
```

## Host → browser

```json
{"type":"chat.start","id":"uuid","model":"granite-local"}
{"type":"chat.thinking.delta","id":"uuid","delta":"Inspecting register lifetime…"}
{"type":"chat.delta","id":"uuid","delta":"The first issue is "}
{"type":"chat.code","id":"uuid","language":"nasm","content":"mov rax, 60"}
{"type":"chat.done","id":"uuid","usage":{"total_tokens":2048}}
```

Tool requests never execute directly in the browser:

```json
{
  "type": "tool.request",
  "id": "uuid",
  "tool": "ide.readFile",
  "arguments": {"path":"src/kernel.asm"},
  "approval": "required"
}
```

The component emits a DOM event named `omega-tool-request`. The IDE host must validate and approve it.
