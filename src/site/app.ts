import { parseMeta } from '../core/connectome';
import { pickDisplayNeurons } from '../shared/display';
import { decodeBits, type AttemptRecord, type ServerMessage, type Stats } from '../shared/protocol';
import { Arena } from './arena';
import { LearningChart } from './chart';
import { brainMetaUrl, connect, serverUrl } from './net';
import { Specimen } from './specimen';

const TOKEN_CA = (import.meta.env.VITE_TOKEN_CA as string | undefined) || null;

const sol = (lamports: number, digits = 4) => (lamports / 1e9).toFixed(digits).replace(/\.?0+$/, '') || '0';
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const pipes = (n: number) => `${n} pipe${n === 1 ? '' : 's'}`;

async function loadDisplayRegions() {
  const res = await fetch(brainMetaUrl());
  if (!res.ok || !res.body) throw new Error(`meta.bin: HTTP ${res.status}`);
  let buf = await res.arrayBuffer();
  const b = new Uint8Array(buf, 0, 2);
  if (b[0] === 0x1f && b[1] === 0x8b) buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return pickDisplayNeurons(parseMeta(buf)).region;
}

export class SiteApp {
  private readonly $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  private specimen!: Specimen;
  private arena!: Arena;
  private chart!: LearningChart;
  private bits = new Uint8Array(0);
  private stats: Stats | null = null;
  private lastEnd: AttemptRecord | null = null;
  private flying = false;

  constructor(root: HTMLElement) {
    root.innerHTML = TEMPLATE;
    this.specimen = new Specimen(this.$<HTMLCanvasElement>('specimen'));
    this.arena = new Arena(this.$<HTMLCanvasElement>('arena'));
    this.chart = new LearningChart(this.$<HTMLCanvasElement>('chart'));
    this.token();
    void loadDisplayRegions().then((region) => { this.specimen.setNeurons(region); this.bits = new Uint8Array(region.length); })
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

  private setStats(s: Stats) {
    this.stats = s;
    const pct = Math.min(100, (s.pendingLamports / s.lamportsPerAttempt) * 100);
    this.$('bar').style.width = `${pct}%`;
    this.$('meterText').textContent = `${sol(s.pendingLamports)} of ${sol(s.lamportsPerAttempt)} SOL collected toward the next attempt`;
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

  private token() {
    const el = this.$('ca');
    if (!TOKEN_CA) return;
    el.innerHTML = `<button type="button" id="copy" title="Copy the contract address"><span class="addr">${TOKEN_CA.slice(0, 4)}…${TOKEN_CA.slice(-4)}</span> <span id="copyLabel">Copy address</span></button>`;
    this.$('copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(TOKEN_CA); this.$('copyLabel').textContent = 'Copied'; }
      catch { this.$('copyLabel').textContent = 'Select and copy manually'; }
    });
  }
}

const TEMPLATE = `
<header class="top">
  <a class="mark" href="/">FlappyFly</a>
  <p class="live"><span id="pip" class="pip"></span><span id="liveText">Connecting to the fly</span></p>
  <p class="ca" id="ca"></p>
</header>
<main>
  <section class="hero">
    <div class="intro">
      <h1>Every trade teaches the fly.</h1>
      <p>A real fruit-fly brain plays Flappy Bird. It only gets to try when the token’s trading fees pay for an attempt, and every attempt nudges it toward flying a little further.</p>
    </div>
    <div class="stage">
      <figure class="specimen">
        <canvas id="specimen" aria-label="The fly's neurons, lit as they fire"></canvas>
        <figcaption id="specimenNote">Each dot is one real neuron, about one in eleven of the brain’s 166,700, placed by region. It lights up when that neuron fires.</figcaption>
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
        <p>The game is turned into input for visual neurons that detect looming objects and small targets (LC4, LPLC2, LC10a). Whether to flap is read from 12 groups of descending neurons, the cells that carry commands from the brain to the body.</p>
      </div>
      <div>
        <h3>How trading teaches it</h3>
        <p>Every <span id="price">0.05</span> SOL of fees buys one attempt. Each attempt flies with a slightly changed readout of those descending neurons. After ten attempts the fly keeps what went further. Thirteen numbers learn; nothing about the flight is scripted.</p>
      </div>
    </div>
    <p class="honest">This is an experiment, not a claim that a fly understands Flappy Bird. The way the game reaches the eyes and the way a flap is read out are designed interfaces. When it flies badly, you are watching it fly badly.</p>
  </section>
</main>`;
