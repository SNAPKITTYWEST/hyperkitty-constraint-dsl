@echo off
REM Zulip Quantum Agent Bridge — PM2 launcher
REM ANU QRNG → quantum routing → Zulip stream

set ZULIP_SITE=https://leanprover.zulipchat.com
set ZULIP_EMAIL=jessicalw34@gmail.com
set ZULIP_KEY=ASkmJcjL72I9LgxmbcL3xEFfm5nbxsgm
set ZULIP_STREAM=general
set ZULIP_TOPIC=quantum-agents
set ZULIP_PREFIX=!q

cd /d "%~dp0\.."

pm2 start bridges/zulip-quantum-bridge.mjs ^
  --name zulip-quantum-bridge ^
  --interpreter node ^
  --watch false ^
  -- --stream general --topic quantum-agents

pm2 logs zulip-quantum-bridge --lines 20
