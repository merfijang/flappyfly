import { parseMeta, type NeuronMeta } from '../core/connectome';
import { pickDisplayNeurons } from '../shared/display';
import { decodeBits, type AttemptRecord, type ServerMessage, type Stats } from '../shared/protocol';
import { Arena } from './arena';
import { LearningChart } from './chart';
import { brainMetaUrl, connect, serverUrl } from './net';
import { REGION_COLORS, ROLE_COLORS, Specimen } from './specimen';

const TOKEN_CA = (import.meta.env.VITE_TOKEN_CA as string | undefined) || null;
const TOKEN_TICKER = (import.meta.env.VITE_TOKEN_TICKER as string | undefined) || null;

const sol = (lamports: number, digits = 4) => (lamports / 1e9).toFixed(digits).replace(/\.?0+$/, '') || '0';
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const pipes = (n: number) => `${n} pipe${n === 1 ? '' : 's'}`;

async function loadMeta() {
  const res = await fetch(brainMetaUrl());
  if (!res.ok || !res.body) throw new Error(`meta.bin: HTTP ${res.status}`);
  let buf = await res.arrayBuffer();
  const b = new Uint8Array(buf, 0, 2);
  if (b[0] === 0x1f && b[1] === 0x8b) buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return parseMeta(buf);
}

export class SiteApp {
  private readonly $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  private specimen!: Specimen;
  private arena!: Arena;
  private chart!: LearningChart;
  private bits = new Uint8Array(0);
  private meta: NeuronMeta | null = null;
  private readoutGroups: string[] = [];
  private stats: Stats | null = null;
  private lastEnd: AttemptRecord | null = null;
  private flying = false;

  constructor(root: HTMLElement) {
    root.innerHTML = TEMPLATE;
    this.specimen = new Specimen(this.$<HTMLCanvasElement>('specimen'));
    this.arena = new Arena(this.$<HTMLCanvasElement>('arena'));
    this.chart = new LearningChart(this.$<HTMLCanvasElement>('chart'));
    this.token();
    void loadMeta().then((meta) => { this.meta = meta; this.buildNeurons(); })
      .catch(() => { this.$('specimenNote').textContent = 'The neuron map could not be loaded. Reload the page to try again.'; });
    connect(serverUrl(), {
      message: (m) => this.onMessage(m),
      // a length mismatch means server and site disagree on the neuron map: show nothing rather than wrong neurons
      activity: (bytes) => { if (this.bits.length && bytes.length === Math.ceil(this.bits.length / 8)) this.specimen.activity(decodeBits(bytes, this.bits.length, this.bits)); },
      status: (live) => {
        this.$('pip').classList.toggle('on', live);
        this.$('liveText').textContent = live ? 'Live' : 'Reconnecting to the fly';
      }
    });
  }

  private onMessage(m: ServerMessage) {
    switch (m.type) {
      case 'hello':
        this.readoutGroups = m.readoutGroups; this.buildNeurons();
        this.chart.set(m.history);
        this.flying = !!m.current;
        this.lastEnd = m.history.at(-1) ?? null;
        this.setStats(m.stats);
        if (m.current) this.attemptLine(m.current.n, m.current.generation, m.current.sample, m.current.pop);
        break;
      case 'frame':
        this.arena.show(m);
        if (m.flap) this.specimen.flap();
        break;
      case 'attempt_start':
        this.flying = true;
        this.attemptLine(m.n, m.generation, m.sample, m.pop);
        this.overlay();
        break;
      case 'attempt_end':
        this.flying = false; this.lastEnd = m.record;
        this.chart.add(m.record);
        this.feed(`Attempt ${m.record.n}: ${pipes(m.record.score)} in ${m.record.seconds.toFixed(1)} s. ${sentence(m.record.cause)}`);
        this.overlay();
        break;
      case 'fee':
        this.feed(`+${sol(m.lamports)} SOL in fees${m.attemptsAdded ? `, paid for ${m.attemptsAdded} attempt${m.attemptsAdded > 1 ? 's' : ''}` : ''}`, 'fee');
        break;
      case 'stats': {
        const prevGen = this.stats?.generation;
        this.setStats(m.stats);
        if (prevGen !== undefined && m.stats.generation > prevGen) this.feed(`Generation ${prevGen} finished. The fly keeps what worked and tries again.`, 'gen');
        break;
      }
    }
  }

  /** The dot cloud needs both the neuron map and the list of neurons the flap is read from. */
  private buildNeurons() {
    if (!this.meta) return;
    const { region, role } = pickDisplayNeurons(this.meta, this.readoutGroups);
    this.specimen.setNeurons(region, role);
    this.bits = new Uint8Array(region.length);
  }

  private setStats(s: Stats) {
    this.stats = s;
    // fees paid in but not flown yet: the queued attempts plus the part-paid next one
    const left = s.queue * s.lamportsPerAttempt + s.pendingLamports;
    this.$('bar').style.width = `${Math.min(100, (left / s.lamportsPerAttempt) * 100)}%`;
    this.$('meterText').textContent = `${sol(left)} SOL of fees left to fly, ${sol(s.lamportsPerAttempt)} SOL per attempt`;
    this.$('fAttempts').textContent = s.attempts.toLocaleString();
    this.$('fQueue').textContent = s.queue.toLocaleString();
    this.$('fGen').textContent = s.generation.toLocaleString();
    this.$('fBest').textContent = pipes(s.bestScore);
    this.$('fFees').textContent = `${sol(s.totalFeeLamports, 3)} SOL`;
    this.$('price').textContent = sol(s.lamportsPerAttempt);
    const src = this.$('source');
    if (s.feeSource === 'mock') src.textContent = 'Demo mode: fees are simulated until the token launches.';
    else {
      src.textContent = 'Fees are read live from the creator fee vaults on Solana: ';
      s.feeWallets.forEach((w, i) => {
        const a = document.createElement('a');
        a.href = `https://solscan.io/account/${w}`; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = `${w.slice(0, 4)}…${w.slice(-4)}`;
        src.append(...(i ? [', ', a] : [a]));
      });
      src.append('.');
    }
    this.overlay();
  }

  private attemptLine(n: number, gen: number, sample: number, pop: number) {
    this.$('attemptLine').textContent = `Attempt ${n.toLocaleString()}, try ${sample + 1} of ${pop} in generation ${gen}`;
  }

  private overlay() {
    const el = this.$('overlay'), s = this.stats;
    if (this.flying || !s) { el.hidden = true; return; }
    el.hidden = false;
    const last = this.lastEnd ? `<p class="last">Last attempt: ${pipes(this.lastEnd.score)}, ${this.lastEnd.seconds.toFixed(1)} s. ${sentence(this.lastEnd.cause)}</p>` : '';
    el.innerHTML = s.queue > 0
      ? `${last}<p>Next attempt is paid for and about to start.</p>`
      : `${last}<p>Waiting for fees. The next attempt starts when ${sol(s.lamportsPerAttempt)} SOL has been collected.</p>`;
  }

  private feed(text: string, kind = '') {
    const li = document.createElement('li');
    li.textContent = text; if (kind) li.className = kind;
    const list = this.$('feed');
    list.prepend(li);
    while (list.children.length > 9) list.lastElementChild!.remove();
  }

  /** Contract address strip: "soon" and a disabled button until VITE_TOKEN_CA is set. */
  private token() {
    if (TOKEN_TICKER) this.$('caLabel').textContent = `Contract address · ${TOKEN_TICKER}`;
    const btn = this.$<HTMLButtonElement>('copy'), label = this.$('copyLabel');
    if (!TOKEN_CA) { btn.disabled = true; btn.title = 'The contract address is published at launch'; return; }
    this.$('caValue').textContent = TOKEN_CA;
    let timer = 0;
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(TOKEN_CA); label.textContent = 'Copied'; }
      catch { label.textContent = 'Press Ctrl+C'; getSelection()?.selectAllChildren(this.$('caValue')); }
      clearTimeout(timer); timer = window.setTimeout(() => { label.textContent = 'Copy'; }, 2000);
    });
  }
}

const LEGEND = [
  [REGION_COLORS[0], 'Optic lobes'], [REGION_COLORS[2], 'Central brain'], [REGION_COLORS[3], 'Neck connective'],
  [REGION_COLORS[4], 'Nerve cord'], [REGION_COLORS[6], 'Motor neurons'], [REGION_COLORS[10], 'Sensory neurons in eyes, body and wings'],
  [ROLE_COLORS.input, 'Cells that see the game'], [ROLE_COLORS.readout, 'Cells the flap is read from']
].map(([color, label]) => `<li><i style="background:${color}"></i>${label}</li>`).join('');

const TEMPLATE = `
<header class="top">
  <a class="mark" href="/">FlappyFly</a>
  <p class="live"><span id="pip" class="pip"></span><span id="liveText">Connecting to the fly</span></p>
</header>
<main>
  <section class="hero">
    <div class="intro">
      <h1>Every trade teaches the fly</h1>
      <p>A real fruit-fly brain plays Flappy Bird. It only gets to try when the token’s trading fees pay for an attempt, and every attempt nudges it toward flying a little further.</p>
    </div>
    <div class="stage">
      <figure class="specimen">
        <canvas id="specimen" aria-label="The fly's neurons, lit as they fire"></canvas>
        <figcaption id="specimenNote">Each coloured dot is one real neuron, about one in eleven of the brain’s 166,700, drawn where its part of the nervous system sits. A region glows when it fires more than it usually does, and the wings light up with every flap.</figcaption>
        <ul class="legend">${LEGEND}</ul>
      </figure>
      <figure class="arena">
        <div class="screen"><canvas id="arena" aria-label="The game the fly is playing"></canvas><div id="overlay" class="overlay" hidden></div></div>
        <figcaption id="attemptLine">Waiting for the first attempt</figcaption>
      </figure>
    </div>
  </section>

  <section class="meter" aria-label="Fees and progress">
    <div class="bar" role="presentation"><i id="bar"></i></div>
    <p id="meterText" class="meter-text">Connecting…</p>
    <dl class="figures">
      <div><dt>Attempts flown</dt><dd id="fAttempts">0</dd></div>
      <div><dt>Paid and waiting</dt><dd id="fQueue">0</dd></div>
      <div><dt>Generation</dt><dd id="fGen">0</dd></div>
      <div><dt>Best run</dt><dd id="fBest">0 pipes</dd></div>
      <div><dt>Fees collected</dt><dd id="fFees">0 SOL</dd></div>
    </dl>
    <p id="source" class="source"></p>
  </section>

  <section class="ca-strip" aria-label="Contract address">
    <div>
      <p class="ca-label" id="caLabel">Contract address</p>
      <p class="ca-value" id="caValue">soon</p>
    </div>
    <button type="button" id="copy" class="copy"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5"/></svg><span id="copyLabel">Copy</span></button>
  </section>

  <section class="learning">
    <div class="curve">
      <h2>How far it gets</h2>
      <p>Each dot is one attempt, measured in pipes. The line is the average of each generation of ten attempts.</p>
      <canvas id="chart" aria-label="Distance per attempt over time"></canvas>
    </div>
    <div class="latest">
      <h2>Latest</h2>
      <ol id="feed" class="feed"></ol>
    </div>
  </section>

  <section class="how">
    <h2>What’s actually happening</h2>
    <div class="cols">
      <div>
        <h3>The brain is real</h3>
        <p>The wiring is the <a href="https://www.janelia.org/project-team/flyem" target="_blank" rel="noopener">FlyEM male CNS connectome</a> (CC BY 4.0): 166,700 neurons and 25 million connections traced from electron-microscope images of one fruit fly. It runs as leaky integrate-and-fire neurons, 50 steps a second, on our server. No connection is ever changed.</p>
      </div>
      <div>
        <h3>How it sees and flaps</h3>
        <p>The game reaches the fly as three separate signals on three of its visual populations: how far below or above the gap it is (LC10a, its small-target cells), how fast it is falling or rising (LPLC2), and how close the pipe is (LC4, its looming cells). The flap is read from 64 populations further inside the brain, the ones whose firing was measured to follow the gap.</p>
      </div>
      <div>
        <h3>How trading teaches it</h3>
        <p>Every <span id="price">0.05</span> SOL of fees buys one attempt. Each attempt flies with a slightly changed readout of those populations. After ten attempts the fly keeps what went further. Sixty-five numbers learn; nothing about the flight is scripted.</p>
      </div>
    </div>
    <p class="honest">This is an experiment, not a claim that a fly understands Flappy Bird. The way the game reaches the eyes and the way a flap is read out are designed interfaces. When it flies badly, you are watching it fly badly.</p>
  </section>
</main>`;
