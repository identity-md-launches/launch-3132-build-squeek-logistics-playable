import { useEffect, useRef } from 'react';
import type { Building, GameState } from './game';
import { BUILDING } from './game';

export const PLOTS: { building: Building; x: number; y: number; labelX: number; labelY: number }[] = [
  { building: 'warehouse', x: 3, y: 3, labelX: 50, labelY: 27 },
  { building: 'sawmill', x: 1, y: 6, labelX: 28, labelY: 38 },
  { building: 'quarry', x: 8, y: 1, labelX: 79, labelY: 36 },
  { building: 'metalworks', x: 8, y: 5, labelX: 66, labelY: 58 },
  { building: 'workshop', x: 3, y: 8, labelX: 28, labelY: 65 },
  { building: 'depot', x: 7, y: 8, labelX: 47, labelY: 76 },
];

function paint(canvas: HTMLCanvasElement, game: GameState, time: number, animate: boolean) {
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const P = (points: number[][], c: string) => { ctx.fillStyle = c; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y))); ctx.closePath(); ctx.fill(); };
  const iso = (i: number, j: number) => [250 + (i - j) * 20, 42 + (i + j) * 10];
  const tile = (i: number, j: number, c: string) => { const [x, y] = iso(i, j); P([[x, y], [x + 20, y + 10], [x, y + 20], [x - 20, y + 10]], c); };
  const rand = (seed: number) => { const a = Math.sin(seed * 78.233 + 12.9898) * 43758.5453; return a - Math.floor(a); };
  const box = (x: number, y: number, w: number, d: number, h: number, front: string, side: string, top: string) => {
    P([[x, y], [x + w, y + w / 2], [x + w - d, y + (w + d) / 2], [x - d, y + d / 2]], top);
    P([[x - d, y + d / 2], [x + w - d, y + (w + d) / 2], [x + w - d, y + (w + d) / 2 + h], [x - d, y + d / 2 + h]], front);
    P([[x + w, y + w / 2], [x + w - d, y + (w + d) / 2], [x + w - d, y + (w + d) / 2 + h], [x + w, y + w / 2 + h]], side);
  };
  const tree = (x: number, y: number, scale = 1) => {
    const s = scale;
    P([[x - 10 * s, y + 2], [x + 5 * s, y - 3], [x + 16 * s, y + 3], [x + 1 * s, y + 8]], '#7d9b6a');
    R(x - 2, y - 15 * s, 4, 19 * s, '#75553c');
    P([[x, y - 37 * s], [x - 8 * s, y - 25 * s], [x - 5 * s, y - 24 * s], [x - 13 * s, y - 12 * s], [x - 9 * s, y - 10 * s], [x - 16 * s, y - 1 * s], [x, y + 4 * s], [x + 14 * s, y - 3 * s], [x + 8 * s, y - 11 * s], [x + 12 * s, y - 14 * s], [x + 5 * s, y - 25 * s], [x + 7 * s, y - 26 * s]], '#305a44');
    P([[x - 1, y - 34 * s], [x - 8 * s, y - 24 * s], [x - 4 * s, y - 23 * s], [x - 11 * s, y - 12 * s], [x - 6 * s, y - 12 * s], [x - 12 * s, y - 3 * s], [x - 1, y]], '#4f7950');
    R(x - 4 * s, y - 21 * s, 4 * s, 3 * s, '#719553'); R(x - 8 * s, y - 9 * s, 4 * s, 3 * s, '#719553');
  };
  const crate = (x: number, y: number) => { box(x, y - 7, 7, 7, 7, '#b37d49', '#815b38', '#dfae67'); R(x - 5, y - 1, 1, 5, '#e9c083'); R(x - 2, y, 1, 5, '#e9c083'); };
  const hamster = (x: number, y: number, hat = false) => {
    R(x - 4, y - 9, 8, 8, '#c28b5c'); R(x - 4, y - 11, 3, 3, '#c28b5c'); R(x + 2, y - 11, 3, 3, '#c28b5c');
    R(x - 3, y - 6, 6, 5, '#f8dfb1'); R(x - 2, y - 7, 1, 2, '#2d4235'); R(x + 2, y - 7, 1, 2, '#2d4235'); R(x, y - 4, 2, 1, '#664a35');
    R(x - 4, y - 1, 3, 2, '#71533b'); R(x + 2, y - 1, 3, 2, '#71533b');
    if (hat) { R(x - 5, y - 11, 11, 2, '#e2a147'); R(x - 3, y - 14, 7, 4, '#efb963'); }
  };
  const roof = (x: number, y: number, w: number, d: number, height: number, color: string, light: string) => {
    P([[x - d, y + d / 2], [x + w / 2 - d, y + d / 2 + w / 4 - height], [x + w / 2, y + w / 4 - height], [x + w, y + w / 2], [x + w - d, y + (w + d) / 2]], color);
    P([[x - d, y + d / 2], [x + w / 2 - d, y + d / 2 + w / 4 - height], [x + w / 2, y + w / 4 - height], [x, y]], light);
    for (let k = 3; k < d; k += 5) { P([[x - k, y + k / 2], [x + w / 2 - k, y + w / 4 + k / 2 - height], [x + w / 2 - k - 1, y + w / 4 + k / 2 - height], [x - k - 1, y + k / 2]], '#ffffff25'); }
  };
  const house = (i: number, j: number, type: Building, built: boolean, lvl = 1) => {
    const [x, yy] = iso(i, j); const y = yy + 7;
    if (!built) {
      P([[x - 25, y - 6], [x + 24, y + 18], [x, y + 32], [x - 48, y + 8]], '#7f946e');
      P([[x - 23, y - 6], [x + 23, y + 17], [x, y + 29], [x - 46, y + 6]], '#bdc69a');
      for (let n = 0; n < 4; n++) { R(x - 43 + n * 14, y + 5 + n * 7, 2, 6, '#d9bd80'); }
      box(x - 17, y - 1, 20, 13, 4, '#a8aa83', '#8d9373', '#d3cba2');
      R(x - 7, y - 12, 2, 19, '#8b6745'); R(x - 13, y - 12, 15, 7, '#ece0b7');
      R(x - 7, y - 11, 2, 5, '#8c704e'); R(x - 9, y - 9, 6, 1, '#8c704e');
      return;
    }
    const w = type === 'warehouse' ? 44 : 32, d = type === 'depot' ? 34 : 26;
    const body = type === 'warehouse' ? '#e7cb96' : type === 'metalworks' ? '#a7b1a5' : '#d8cbb0';
    box(x, y - 24, w, d, 24, body, '#ad9c7c', '#e6d4aa');
    // Plank joints and sturdy stone foundations.
    for (let k = 1; k < 5; k++) P([[x - d, y - 24 + d / 2 + k * 4], [x + w - d, y - 24 + (w + d) / 2 + k * 4], [x + w - d, y - 23 + (w + d) / 2 + k * 4], [x - d, y - 23 + d / 2 + k * 4]], '#8c815a25');
    box(x - 2, y - 1, w + 4, d + 2, 4, '#8b8e75', '#6f7965', '#c4c7a7');
    const color = type === 'warehouse' || type === 'workshop' ? '#ad6442' : type === 'depot' ? '#477b77' : '#7b8a68';
    roof(x, y - 25, w, d, 14, color, type === 'warehouse' || type === 'workshop' ? '#d48b5a' : type === 'depot' ? '#6a9990' : '#a4ac7b');
    // Door on the sunlit wall and blue glass windows.
    P([[x - d + 10, y - 11 + d / 2], [x - d + 20, y - 6 + d / 2], [x - d + 20, y + 9 + d / 2], [x - d + 10, y + 4 + d / 2]], '#655544');
    R(x - d + 16, y + d / 2, 1, 2, '#ead09b');
    P([[x - d + 26, y - 8 + d / 2], [x - d + 35, y - 4 + d / 2], [x - d + 35, y + 3 + d / 2], [x - d + 26, y - 1 + d / 2]], '#456e70');
    R(x - d + 29, y - 6 + d / 2, 2, 5, '#d8e4cc');
    if (type === 'warehouse') {
      P([[x - 29, y + 2], [x - 6, y + 14], [x - 12, y + 19], [x - 36, y + 7]], '#e8b558');
      for (let k = 0; k < 3; k++) P([[x - 30 + k * 8, y + 2 + k * 4], [x - 26 + k * 8, y + 4 + k * 4], [x - 32 + k * 8, y + 9 + k * 4], [x - 36 + k * 8, y + 7 + k * 4]], '#f6d88e');
      R(x - 35, y + 7, 2, 11, '#75583b'); R(x - 12, y + 19, 2, 10, '#75583b');
      crate(x + 27, y + 23); crate(x + 35, y + 27); crate(x + 31, y + 18);
    }
    if (type === 'metalworks') {
      box(x + 13, y - 47, 9, 9, 27, '#9b8e78', '#746e61', '#bab098');
      if (animate) for (let n = 0; n < 3; n++) { const sy = (time / 300 + n * 8) % 24; R(x + 12 + n * 3, y - 48 - sy, 6 + n * 2, 5, '#d3d2b2a0'); }
    }
    if (type === 'depot') { crate(x - 34, y + 31); crate(x - 25, y + 36); R(x + 18, y + 25, 19, 8, '#315b58'); R(x + 17, y + 32, 5, 5, '#384b3c'); R(x + 30, y + 32, 5, 5, '#384b3c'); R(x + 19, y + 21, 8, 5, '#e7be71'); }
    if (type === 'sawmill') { for (let k = 0; k < 3; k++) { box(x + 26 + k * 2, y + 15 - k * 6, 16, 5, 4, '#a87840', '#815c36', '#d8aa67'); } }
    if (type === 'quarry') { for (let k = 0; k < 4; k++) { const rx = x - 38 + k * 8; P([[rx, y + 18], [rx + 5, y + 10], [rx + 11, y + 13], [rx + 14, y + 22], [rx + 7, y + 26]], '#8b9892'); R(rx + 5, y + 15, 4, 3, '#bcc4b0'); } }
    if (lvl > 1) { R(x + w - d + 5, y + 5, 2, 15, '#796347'); R(x + w - d + 7, y + 5, 10, 6, '#e7ad52'); }
  };
  R(0, 0, 500, 310, '#dce4d4');
  // Distant foliage and tiny drifting clouds, all drawn in the same pixel grid.
  for (let n = 0; n < 38; n++) { const x = rand(n + 80) * 500, y = rand(n + 91) * 300; R(x, y, 3, 1, '#c8d5c1'); }
  P([[25, 160], [252, 47], [479, 160], [252, 287]], '#c4d0b9');
  // The island's cut earth has visible strata.
  P([[30, 162], [250, 272], [250, 285], [30, 175]], '#8b8860');
  P([[250, 272], [470, 162], [470, 175], [250, 285]], '#727e56');
  for (let n = 0; n < 20; n++) R(39 + n * 10, 174 + n * 5, 4, 2, '#b6aa75');
  for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) {
    const river = i >= 9 && j < 8;
    const path = i === 5 || j === 6 || j === 9 && i > 5;
    tile(i, j, river ? ['#80b8b5', '#83bcb8', '#8ac2bd'][(i + j) % 3] : path ? '#d6c99e' : ['#a2b281', '#a9b987', '#9eaf7d', '#a8b686'][Math.floor(rand(i * 13 + j) * 4)]);
    const [x, y] = iso(i, j);
    if (river) { R(x - 4, y + 9, 10, 1, '#aed7cb'); if (j % 2 === 0) R(x - 11, y + 14, 6, 1, '#baddce'); }
    else if (!path && rand(i * 12 + j) > .35) { R(x - 8, y + 9, 2, 2, '#849e6d'); R(x + 4, y + 7, 3, 1, '#c5cc91'); }
    if (path) { R(x + 1, y + 9, 4, 1, '#c0b38b'); R(x - 6, y + 12, 2, 1, '#e6dcb6'); }
  }
  // Wooden bridge over the creek.
  for (let i = 9; i < 11; i++) { tile(i, 6, '#b38c59'); const [x, y] = iso(i, 6); for (let k = -15; k < 20; k += 5) R(x + k, y + 8 + k / 2, 1, 9, '#876c4c'); }
  const [bx, by] = iso(9, 6); R(bx - 18, by + 4, 2, 12, '#766448'); R(bx + 19, by + 20, 2, 12, '#766448');
  // The back treeline, vegetable patches and fences make this a lived-in place.
  [[0,0],[1,0],[2,0],[3,0],[0,1],[0,2],[0,3],[1,2],[6,0],[7,0],[0,7],[0,8],[0,9],[1,9],[1,10],[2,10],[3,10],[4,10],[7,10],[8,10],[9,10]].forEach(([i,j], n) => { const [x,y]=iso(i,j); tree(x, y+13, .7+rand(n+160)*.35); });
  for (let k = 0; k < 4; k++) { const [x,y] = iso(2 + k * .3, 1.6); P([[x-12,y+4],[x+8,y+14],[x+4,y+17],[x-16,y+7]], '#927a4e'); for(let n=0;n<4;n++){R(x-10+n*5,y+5+n*2.5,3,3,'#668448');R(x-9+n*5,y+7+n*2.5,1,2,'#d8924c');} }
  for (let k = 0; k < 6; k++) { const [x,y] = iso(1 + k*.5, 4.7); R(x,y,2,9,'#8d7753'); if(k<5)P([[x,y+2],[x+10,y+7],[x+10,y+9],[x,y+4]],'#d8c28a'); }
  // A community water tower is scenery, not a player-owned production building.
  const [tx,ty] = iso(7,3); R(tx-7,ty-20,2,29,'#796b4b');R(tx+7,ty-15,2,27,'#796b4b');R(tx+17,ty-20,2,29,'#796b4b');
  box(tx+2,ty-35,17,17,15,'#729f9a','#4d7e7a','#b8c9a6');R(tx-8,ty-24,1,21,'#d7cb9e');
  PLOTS.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(p=>house(p.x,p.y,p.building,game.buildings[p.building]>0,game.buildings[p.building]));
  // A rail line skirts the front of the outpost.
  for(let k=0;k<20;k++){const x=120+k*9,y=212+k*4.5; P([[x,y],[x+12,y-6],[x+14,y-4],[x+2,y+2]],'#8b7958');}
  P([[122,209],[301,298],[302,300],[121,211]],'#6b7c69');P([[132,204],[311,293],[312,295],[131,206]],'#6b7c69');
  hamster(239,149,true);hamster(204,177);hamster(315,212,true);
  for(let n=0;n<5;n++){const [x,y]=iso(6+n*.6,6);crate(x+3,y+13);}
  // Actual shipments move on the local road; no simulated chain activity is drawn.
  for(const [n,ship] of game.shipments.entries()) {
    const t = Math.min(1,Math.max(0,(time-ship.start)/(ship.end-ship.start)));
    const x = 210 + t*140, y = 201 - t*70 + n*5;
    R(x-7,y-6,15,8,'#a87842');R(x-5,y-8,11,4,'#e3bb76');R(x-7,y+1,4,4,'#3d5040');R(x+5,y+1,4,4,'#3d5040');hamster(x-13,y+3);
  }
  // Flowers and tufts at the front edge.
  for(let n=0;n<18;n++){const [x,y]=iso(2+rand(n+300)*7,8+rand(n+400)*2);if(n%3===0){R(x,y,1,4,'#76915b');R(x-1,y-1,3,2,'#ead191');}}
}

export function World({ game, selected, onSelect, motion, now }: { game: GameState; selected: Building; onSelect: (b: Building) => void; motion: boolean; now: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) paint(ref.current, game, now, motion); }, [game, now, motion]);
  return <div className="world">
    <canvas ref={ref} width="500" height="310" role="img" aria-label="Isometric pixel-art hamster outpost: a warehouse, cargo depot, creek, pine trees and six interactive building plots." />
    <div className="world-location"><span className="status-dot" /> Clover Commons <span className="map-coordinate">01 / Home region</span></div>
    {PLOTS.map(p => <button key={p.building} className={`plot-button ${selected === p.building ? 'selected' : ''} ${game.buildings[p.building] ? 'built' : 'vacant'}`} style={{ left: `${p.labelX}%`, top: `${p.labelY}%` }} onClick={() => onSelect(p.building)} aria-label={`Select ${BUILDING[p.building].name}${game.buildings[p.building] ? `, level ${game.buildings[p.building]}` : ', unbuilt plot'}`} aria-pressed={selected === p.building}>
      <span>{game.buildings[p.building] ? game.buildings[p.building] : '+'}</span><span className="plot-name">{BUILDING[p.building].name}</span>
    </button>)}
    <div className="world-footer"><span><span className="pixel-square" /> Your outpost</span><span>Select a building to manage it</span></div>
  </div>;
}
