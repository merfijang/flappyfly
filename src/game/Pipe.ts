export class Pipe {
  readonly width = 72; scored = false;
  constructor(public x: number, public gapTop: number, public gapHeight = 190) {}
  get gapBottom() { return this.gapTop + this.gapHeight; }
  update(dt: number, speed: number) { this.x -= speed * dt; }
}
