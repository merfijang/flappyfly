import { Bird } from './Bird'; import { Pipe } from './Pipe';
export const collided = (bird: Bird, pipe: Pipe, height: number) => {
  if (bird.y - bird.radius <= 0 || bird.y + bird.radius >= height - 46) return true;
  const overlapsX = bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + pipe.width;
  return overlapsX && (bird.y - bird.radius < pipe.gapTop || bird.y + bird.radius > pipe.gapBottom);
};
