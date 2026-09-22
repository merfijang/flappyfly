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
| `POLL_MS` | `10000` | Fee wallet poll interval |
| `MOCK_FEE_EVERY_MS` | `4000` | Fake fee interval in mock mode |
| `STATE_FILE` | `data/state.json` | Put this on a persistent volume |
| `PORT` | `8787` | HTTP + WebSocket (`/ws`, `/health`, `/stats`) |

The watcher counts only SOL flowing into `FEE_WALLET` (claims/withdrawals are ignored), dedupes by signature and persists its cursor. On the very first start it records the current tip and counts only fees after that.

## Site env

`VITE_SERVER_URL` (default `wss://api.flappyfly.site/ws`, or `ws://localhost:8787/ws` on localhost), `VITE_TOKEN_CA` (shows the copy button once set).

## Deploy

- Site: Vercel, domain `flappyfly.site`, build `npm run build`, output `dist`.
- Server: any always-on box, 1 vCPU / 512 MB is enough (≈40% of one core, ≈200 MB RAM). Persistent volume for `STATE_FILE`. Point `api.flappyfly.site` at it with TLS (WebSocket needs `wss://`).

## Tests

```bash
npm test            # vitest
npm run typecheck   # site + server
```

## Credits

Connectome: FlyEM MaleCNS v1.0 (HHMI Janelia, Cambridge Connectomics Group, Google Research), CC BY 4.0. Browser export by fly.ai. Base game and simulation: ns2250225/fly-flappy.
