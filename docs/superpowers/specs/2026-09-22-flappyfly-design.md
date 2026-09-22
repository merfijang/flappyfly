# FlappyFly — design

Date: 2026-09-22 · Domain: flappyfly.site · Chain: Solana (token not launched yet)

## Idea

One shared digital fruit fly (full MaleCNS v1.0 connectome, 166,700 neurons) plays Flappy Bird 24/7 on a server. It only gets to try when the token's trading fees pay for it: every X SOL of fees = one attempt. Each attempt is one step of real learning, so traders literally train the fly. Everyone watches the same fly live on the site.

## Decisions (made with the user)

| Topic | Decision |
|---|---|
| Where the fly lives | One Node server, 24/7, streams to all viewers |
| Attempt trigger | Every `SOL_PER_ATTEMPT` SOL of fee inflow = 1 attempt |
| Learning | Real: (1+1) evolution strategy on the readout weights; fitness = how far the fly got |
| Token | Not launched → mock fee source now, Solana watcher ready for a wallet address later |
| Visual style | flybrain.online-like: dark instrument panel, point-cloud fly where dots are real neurons |

## Architecture

```
Solana RPC ──► FeeWatcher ──► FeeAccumulator ──► attempt queue
                                                     │
                            Trainer (1+1)-ES ◄───────┘
                                 │ candidate readout θ
                                 ▼
             Runner: FlappyGame + ConnectomeSim, fixed 50 Hz
                                 │
                        Broadcaster (WebSocket) ──► Spectator site (Vite, Vercel)
                                 │
                            StateStore (state.json)
```

### Units

- **`src/core/connectome.ts`** — pure simulation extracted from `flyBrain.worker.ts`: parse `meta.bin`/`weights.*.bin`, LIF step, neuron group lookup, stimulus injection, feature rates. No DOM / Worker / fetch. Takes byte buffers, owns its seeded RNG. Used by the server (and by the spike script).
- **`src/core/policy.ts`** — `NeuralPolicy`: encode game state → stimulate → step → DN feature traces → `p = sigmoid(w·x + b)` → `FlyDecoder` (existing cooldown/burst gate) → FLAP/WAIT. **No access to game state in the decision** — the repo's hand-written `trainedFlapRequest` rules (flap if below gap, don't flap when climbing) are not used. Only the sensory encoding (`FlyEncoder`) sees the game, exactly as in the repo.
- **`src/game/*`** — unchanged Flappy game.
- **`server/fees/accumulator.ts`** — lamports in → whole attempts out, remainder kept. Pure.
- **`server/fees/solanaWatcher.ts`** — polls `getSignaturesForAddress(FEE_WALLET)` + `getTransaction`, counts the wallet's positive balance delta per tx (fees in), ignores negative (claims/withdrawals), dedupes by signature, persists the last seen signature. Plain JSON-RPC over `fetch`, no Solana SDK. For pump.fun `FEE_WALLET` = the creator vault (or the creator wallet if fees are auto-claimed there).
- **`server/fees/mockSource.ts`** — emits fake fee inflows on an interval (dev + demo).
- **`server/trainer.ts`** — (1+1)-ES over θ = 12 weights + bias. Mutant = champion + σ·N(0,1). Accept if mutant fitness > champion's fitness estimate. σ adapts by the 1/5 success rule, clamped. Every 5th attempt re-flies the champion and updates its estimate (EMA) so a lucky run can't stay champion forever. Fitness = `score + elapsedSeconds / 2.1` (pipes + fraction of the gap to the next pipe; pipes spawn every 2.1 s).
- **`server/runner.ts`** — runs one attempt at real time (50 Hz fixed step), cap 120 s. Idle when queue empty: the brain keeps running with no game input (spontaneous activity), game frozen.
- **`server/broadcast.ts`** — WebSocket server. Messages:
  - `hello` — config, stats, last 300 attempt results, champion θ
  - `frame` (50 Hz, JSON) — bird y/vy, pipes, score, p, flap
  - `activity` (10 Hz, binary) — bitset of which *displayed* neurons fired in the last 100 ms
  - `attempt_start`, `attempt_end`, `fee`, `stats` (JSON events)
- **`server/state.ts`** — `state.json`: champion θ + fitness estimate, σ, counters, total fees, pending lamports, queue length, attempt history, watcher cursor. Atomic write (tmp + rename) after every attempt and fee.
- **Spectator site (`src/`)** — replaces the button UI. Game canvas (fly drawn as a small dot fly), specimen plate (point-cloud fly, ~16k dots, each = one real neuron sampled deterministically from `meta.bin`, placed by superclass: optic lobe/visual → eyes by side, central brain → head, descending/ascending → neck, VNC → thorax, motor → wing/leg roots; lit by the `activity` bitset), readouts (attempt #, champion generation, record, fees, SOL to next attempt, queue), learning curve (score per attempt + champion fitness), event feed, footer with CC BY 4.0 attribution and an honest "what this is" note. Loads only `meta.bin` (0.3 MB), not the 57 MB weights.

## Config (env)

Server: `PORT`, `FEE_SOURCE=mock|solana`, `SOLANA_RPC_URL`, `FEE_WALLET`, `SOL_PER_ATTEMPT` (default 0.05), `MOCK_FEE_EVERY_MS`, `STATE_FILE`, `BRAIN_DIR`.
Site: `VITE_SERVER_URL` (e.g. `wss://api.flappyfly.site`).

## Error handling

- RPC errors → retry with backoff, log, never crash the runner; fees are never double counted (signature dedupe + persisted cursor).
- Server restart → state reloaded, queue and learning continue.
- Viewer disconnect → client reconnects with backoff and gets a fresh `hello`.
- Corrupt/missing state file → start fresh, keep the bad file as `.bak`.

## Testing

- Unit (vitest): accumulator, watcher tx parsing (fixture RPC responses: inflow, claim, duplicate), trainer accept/reject + σ rule + champion re-eval, state round-trip, bitset encode/decode, anatomy layout determinism, policy has no game-state access (decision only changes through neural input).
- Integration: server with mock fees and small config → WS client receives `hello`, `attempt_start`, `frame`s, `attempt_end`.
- Feasibility spike first: headless, faster than real time, ~300 attempts. Pass = champion fitness clearly rises above the no-learning baseline. If it doesn't, stop and report before changing the learning design (e.g. more DN features).

## Out of scope (next steps)

Deploying (Vercel for the site, Railway/VPS for the server, DNS for flappyfly.site), token launch, per-trader attribution, speeding up a long queue.

## Open risk

The repo's license: no LICENSE file → all rights reserved by the author by default. Ask ns2250225 before a commercial launch. Connectome data is CC BY 4.0 → attribution on the site.
