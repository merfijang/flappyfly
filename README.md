# FlappyFly

One shared digital fruit fly (the full FlyEM MaleCNS v1.0 connectome, 166,700 neurons) plays Flappy Bird on a server, 24/7. It only gets to try when the token's trading fees pay for it: every `SOL_PER_ATTEMPT` SOL of fees = one attempt. Each attempt is one sample of an evolution strategy over the descending-neuron readout, so the fly really learns from the attempts traders pay for. Everyone watches the same fly live at flappyfly.site.

Built on [ns2250225/fly-flappy](https://github.com/ns2250225/fly-flappy) (browser connectome + Flappy Bird).

## What is real

- Connectome weights are frozen. Only 13 numbers learn: 12 descending-neuron readout weights + a bias.
- The flap decision sees the game only through the neurons (visual input → LIF network → DN readout → flap gate). The original repo's hand-written flight rules are not used.
- Experiments behind this design are in `scripts/spike-*.ts` (ES vs. a bias-only control).

## Layout

```
brain/            connectome export (server only; 57 MB)
public/brain/     meta.bin only (the site draws neurons from it)
src/core/         connectome sim, sensing, policy, calibration (shared, pure TS)
src/shared/       wire protocol, which neurons the site displays
src/site/         spectator site (Vite)
src/game/         Flappy Bird
server/           fee watcher, trainer, 50 Hz runner, WebSocket
```

## Run locally

```bash
npm install
npm run server      # fly server on :8787, fake fees (FEE_SOURCE=mock)
npm run dev         # site on :5173, connects to ws://localhost:8787/ws
```

First server start calibrates the readout (~30 s) and writes `data/state.json`. Restarts resume learning; an attempt interrupted by a crash is flown again.

## Server env

| Var | Default | Meaning |
|---|---|---|
| `FEE_SOURCE` | `mock` | `mock` or `solana` |
| `FEE_WALLET` | — | Address that receives the fees (pump.fun creator vault). Required for `solana` |
| `SOLANA_RPC_URL` | public mainnet | Use a paid RPC (e.g. Helius) in production |
| `SOL_PER_ATTEMPT` | `0.05` | Price of one attempt |
| `FEE_MODE` | `balance` | `balance`: one `getBalance` per poll, any increase = fees (a claim resets the baseline). `transactions`: per-trade exact via `getTransaction`, needs a paid RPC when trading is busy |
| `POLL_MS` | `5000` / `10000` | Poll interval (balance / transactions) |
| `MOCK_FEE_EVERY_MS` | `4000` | Fake fee interval in mock mode |
| `MOCK_TOTAL_SOL` | unlimited | Stop fake fees after this much (dry runs) |
| `STATE_FILE` | `data/state.json` | Put this on a persistent volume |
| `PORT` | `8787` | HTTP + WebSocket (`/ws`, `/health`, `/stats`) |
| `HOST` | `0.0.0.0` | Bind address (`127.0.0.1` behind a reverse proxy) |
| `GAME_SPEED` | `0.5` | Game pace relative to real time (the fly needs ~200 ms to react) |
| `COURSE_GAP` / `COURSE_SPAWN` / `COURSE_PIPE_SPEED` | `210` / `2.1` / `132` | Gap height, seconds between pipes, pipe speed |
| `READOUT_SIZE` | `64` | How many neuron groups the flap is read from |

The watcher counts only SOL flowing into `FEE_WALLET` (claims/withdrawals are ignored), dedupes by signature and persists its cursor. On the very first start it records the current tip and counts only fees after that.

## Site env

`VITE_SERVER_URL` (default: same host at `/ws`; `ws://<host>:8787/ws` when served by Vite on :5173), `VITE_TOKEN_CA` (shows the copy button once set).

## Deploy

One VPS runs both: Caddy serves `dist/` and HTTPS, and proxies `/ws`, `/stats`, `/health` to the node process (`deploy/`).

- `deploy/flappyfly.service` — systemd unit (user `flappyfly`, state in `/var/lib/flappyfly`, env in `/etc/flappyfly.env`, template `deploy/flappyfly.env.example`).
- `deploy/Caddyfile` — site + proxy for flappyfly.site / www, plus plain-IP access.
- flappyfly.site is served by Vercel (the MCP token cannot edit DNS): Vercel hosts only `index.html`; JS/CSS come from the VPS. Rebuild them on the VPS with
  `VITE_SERVER_URL=wss://144-31-153-206.sslip.io/ws npx vite build --base=https://144-31-153-206.sslip.io/remote/ --outDir dist-remote --emptyOutDir false` (keeps the previous assets so the live page never 404s mid-deploy)
  and redeploy that `dist-remote/index.html` to the Vercel project `flappyfly`.
- `144-31-153-206.sslip.io` gives the VPS a TLS hostname without DNS setup. With `A @`/`www` records pointing to the VPS instead, the plain `dist/` build on the VPS serves everything.
- Load: ≈40% of one core, ≈200 MB RAM; each viewer ≈25 KB/s of WebSocket.

## Tests

```bash
npm test            # vitest
npm run typecheck   # site + server
```

## Credits

Connectome: FlyEM MaleCNS v1.0 (HHMI Janelia, Cambridge Connectomics Group, Google Research), CC BY 4.0. Browser export by fly.ai. Base game and simulation: ns2250225/fly-flappy.
