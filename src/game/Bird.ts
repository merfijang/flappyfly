export class Bird {
  readonly x = 112; readonly radius = 15; y = 320; velocityY = 0;
  reset() { this.y = 320; this.velocityY = 0; }
  update(dt: number) { this.velocityY += 1120 * dt; this.y += this.velocityY * dt; }
  flap() { this.velocityY = -355; }
}
