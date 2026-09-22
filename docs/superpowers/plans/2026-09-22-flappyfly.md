# FlappyFly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 24/7 server where one connectome fly learns Flappy Bird, one attempt per X SOL of token fees, streamed live to a spectator site.

**Architecture:** Pure TS core (connectome sim, sensing, policy) shared by a Node server (fees → queue → ES trainer → 50 Hz runner → WebSocket) and a Vite spectator site (game + point-cloud neuron specimen + learning curve).

**Tech Stack:** TypeScript, Node 24 (tsx), ws, Vite 7, Vitest 3. No Solana SDK (JSON-RPC over fetch).

**Spec:** `docs/superpowers/specs/2026-09-22-flappyfly-design.md`

## Global Constraints

- Connectome weights are never modified; only the readout θ (12 DN feature weights + bias) learns.
- The flap decision may only depend on neural activity (via readout) and the existing `FlyDecoder` gate — never on game state directly.
- Every X SOL (`SOL_PER_ATTEMPT`, default 0.05) of fee inflow = exactly one attempt; fees are never double counted.
- Attempt cap 120 s; brain and game step at fixed 50 Hz (dt 0.02).
- Site loads only `meta.bin` (never the 57 MB weights).
- Attribution: MaleCNS v1.0 / FlyEM, CC BY 4.0, visible on the site.

## Spike result (2026-09-22, drives Task 3)

- Node step: 7.7 ms per 50 Hz tick (real time OK, ~40% of one core).
- (1+1)-ES with 1/5 rule: σ collapses under noisy fitness → stalls. **Rejected.**
- OpenAI-ES, antithetic pairs on a shared seed, population 10, σ 0.5, lr 0.5, centered-rank shaping: mean fitness 1.0 → 2–3 over 400 attempts, best 4 pipes. Bias-only control (no neural input): flat 0.74, 0 pipes. **Adopted.**
- The spec's "(1+1)-ES" is replaced by this; "champion" = the current mean θ.

---

### Task 1: Fee accounting ✅
Files: `server/fees/accumulator.ts`, `server/fees/solanaWatcher.ts`, `server/fees/mockSource.ts` (+ tests)
- `FeeAccumulator(lamportsPerAttempt, remainder=0).add(lamports) → attempts`, `.pending`
- `SolanaFeeWatcher(rpc, wallet, cursor|null, onFee, pageSize=100)`: `.poll()`, `.start(ms)`, `.cursor: {initialized, lastSignature}`; first run records newest signature without counting; pages with `before`/`until`; skips failed; stops at not-yet-served tx; cursor updated before `onFee`.
- `inflowFromTx(tx, wallet)` includes address-lookup-table accounts.
- `mockFees(everyMs, onFee) → stop` emits 0.005–0.03 SOL with `mock-N` signatures.

### Task 2: State store ✅
`server/stateStore.ts`: `loadState(path, fresh)` (missing → fresh; corrupt/other version → `.bak` + fresh), `saveState(path, s)` (tmp + rename).

### Task 3: Core policy + trainer ✅
Files: `src/core/connectome.ts` ✅, `src/core/sensing.ts` ✅, `src/core/policy.ts`, `src/core/calibrate.ts`, `server/trainer.ts` (+ tests with a synthetic tiny connectome)
- `NeuralPolicy(brain, groups, norm)`: `.begin(theta, seed)`, `.tick(state, nowMs) → { flap, p }`, `.idle()`; `p = sigmoid(θ_b + Σ θ_k (trace_k − mean_k)/std_k)`, request if p ≥ 0.5, `FlyDecoder(2, 260)` gate. Test: bias +20 flaps regardless of state, bias −20 never flaps; `tick` result identical for two different game states when neural input is identical (policy does not read game state).
- `calibrate(brain, groups, steps) → { mean, std }` deterministic (seeded), std floor 0.02.
- `Trainer(state, rand)`: `.next() → { theta, seed, index }` (antithetic: odd index = −ε of previous, same seed), `.report(index, fitness)`; after `POP` reports update θ with centered ranks; `state.generation++`. Tests: pair shares seed and opposite noise; update moves θ toward the better sample; generation counter; state serializable & resumable mid-generation.
- `fitness(score, seconds) = score + seconds / 2.1`.

### Task 4: Protocol + display neurons ✅
Files: `src/shared/protocol.ts`, `src/shared/display.ts` (+ tests)
- Message types `hello | frame | attempt_start | attempt_end | fee | stats`; binary message = activity bitset over display neurons.
- `pickDisplayNeurons(meta) → { ids: Int32Array, region: Uint8Array }` deterministic stratified sample (~16k) by superclass → region (eyeL, eyeR, head, neck, thorax, abdomen, legs).
- `encodeBits(hits) / decodeBits(bytes, count)` round-trip.

### Task 5: Server runtime ✅
Files: `server/flyServer.ts`, `server/broadcast.ts`, `server/main.ts`, `server/config.ts` (+ integration test)
- `FlyServer` owns brain, policy, trainer, game, accumulator, state; `.addFee(e)`, `.tick()` (50 Hz): idle brain step or attempt step; death/cap → fitness → trainer.report → history (cap 2000) → save → `attempt_end`; 1.5 s pause between attempts.
- Broadcast: `frame` every tick, activity bitset every 5 ticks (OR of fired over those ticks), events.
- HTTP: `GET /health`, `GET /stats`; WS on `/ws`, `hello` on connect.
- Config from env (spec list); `FEE_SOURCE=mock` default.
- Integration test: start with mock fees + tiny brain → WS client gets `hello`, `attempt_start`, `frame`, binary activity, `attempt_end`.

### Task 6: Spectator site ✅
Files: `index.html`, `src/main.ts`, `src/site/*` (App, net client with reconnect, SpecimenRenderer, GameRenderer adapter, LearningChart, styles); remove the old button UI + worker from the bundle.
- Look: flybrain.online-like instrument panel (dark ground, cyan/amber, serif/sans/mono trio), own code.
- Specimen: each dot = a display neuron placed by region, flashes on activity bits; wings flutter on flap.
- Game canvas renders `frame` messages (interpolated), fly drawn as a small dot fly.
- Readouts: attempt #, generation, best, fees total, SOL to next attempt, queue; learning curve; event feed; footer attribution + honest note + CA placeholder.
- `VITE_SERVER_URL` (default `ws://localhost:8787/ws`).

### Task 7: Verify end to end ✅ (deploy is a separate step)
- `npm test`, `npm run build`, typecheck server.
- Run server (mock fees) + site; screenshot; watch several attempts; restart server → learning resumes.
- README section: run, env, deploy notes.
