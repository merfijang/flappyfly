export class FlyDecoder {
  private spikes: number[] = [];
  private lastFlap = -Infinity;
  constructor(private threshold = 2, private cooldown = 120) {}
  decide(now: number, spike: boolean) {
    if (spike) this.spikes.push(now);
    this.spikes = this.spikes.filter((t) => now - t <= 100);
    if (this.spikes.length >= this.threshold && now - this.lastFlap >= this.cooldown) {
      this.lastFlap = now; this.spikes = []; return 'FLAP' as const;
    }
    return 'WAIT' as const;
  }
  reset() { this.spikes = []; this.lastFlap = -Infinity; }
}
