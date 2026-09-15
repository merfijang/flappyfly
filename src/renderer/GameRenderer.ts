import { FlappyGame } from '../game/FlappyGame';
export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  constructor(canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; canvas.width = 480; canvas.height = 640; }
  render(game: FlappyGame, looming: number) {
    const c = this.ctx; const g = c.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#102f35'); g.addColorStop(1, '#173f3b'); c.fillStyle = g; c.fillRect(0, 0, 480, 640);
    c.fillStyle = 'rgba(123,255,202,.035)'; for (let y=20;y<590;y+=32) for(let x=10;x<480;x+=38) c.fillRect(x,y,2,2);
    for (const p of game.pipes) { this.pipe(p.x, 0, p.width, p.gapTop, true); this.pipe(p.x, p.gapBottom, p.width, 594-p.gapBottom, false); }
    c.fillStyle='#101c18'; c.fillRect(0,594,480,46); c.fillStyle='#75d186'; c.fillRect(0,594,480,5);
    this.fly(game.bird.x, game.bird.y, game.bird.velocityY);
    const p=game.targetPipe; c.strokeStyle='rgba(255,211,91,.65)'; c.setLineDash([5,5]); c.beginPath(); c.moveTo(game.bird.x+24, game.bird.y); c.lineTo(Math.max(game.bird.x+30,p.x),game.bird.y); c.stroke(); c.setLineDash([]);
    c.font='700 12px ui-monospace'; c.fillStyle='#ffd35b'; c.fillText(`LOOMING ${Math.round(looming*100)}%`, 18,24); c.textAlign='right'; c.fillText(`SCORE ${game.score}`,462,24); c.textAlign='left';
  }
  private pipe(x:number,y:number,w:number,h:number,top:boolean){const c=this.ctx;c.fillStyle='#3d8a50';c.fillRect(x,y,w,h);c.fillStyle='#71c56e';c.fillRect(x+5,y,w-12,h);c.fillStyle='#9be081';c.fillRect(x+9,y,6,h);const capY=top?Math.max(0,y+h-22):y;c.fillStyle='#2d6d40';c.fillRect(x-5,capY,w+10,22);c.strokeStyle='#132d22';c.lineWidth=3;c.strokeRect(x-5,capY,w+10,22)}
  private fly(x:number,y:number,v:number){const c=this.ctx;c.save();c.translate(x,y);c.rotate(Math.max(-.35,Math.min(.45,v/700)));c.fillStyle='rgba(206,255,244,.6)';c.beginPath();c.ellipse(-7,-10,13,7,-.5,0,7);c.ellipse(-7,10,13,7,.5,0,7);c.fill();c.fillStyle='#e9be45';c.beginPath();c.ellipse(0,0,15,10,0,0,7);c.fill();c.fillStyle='#202526';c.fillRect(-8,-8,5,16);c.fillRect(2,-9,4,18);c.fillStyle='#fa625b';c.beginPath();c.arc(12,-4,3,0,7);c.fill();c.restore()}
}
