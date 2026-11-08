import { describe, expect, it } from 'vitest';
import { act, advance, applyMilestones, buildCost, capacity, decodeSave, encodeSave, freshGame, isUnlocked, level, reserved, totalStock, type GameState } from '../src/game';

const NOW = 1_800_000_000_000;
function withSawmill() { const s = freshGame(NOW); s.buildings.sawmill = 1; return s; }
function unlocked() {
  const s = freshGame(NOW); s.credits = 500; s.xp = 300;
  return applyMilestones(s, { height: '1000', round: '10', work: '10000', safeBlock: '12087077', checkedAt: NOW });
}

describe('starter economy and gathering', () => {
  it('starts with finite resources, starter buildings and three useful contracts', () => {
    const s = freshGame(NOW);
    expect(s.credits).toBe(120); expect(s.inventory).toEqual({ wood: 12, stone: 8, metal: 4, planks: 0, tools: 0 });
    expect(s.buildings).toEqual({ warehouse: 1, sawmill: 0, quarry: 0, metalworks: 0, workshop: 0, depot: 1 });
    expect(s.contracts.length).toBe(3); expect(capacity(s)).toBe(120);
  });
  it('gathers only after the timer; the field crew cannot be double-booked', () => {
    const s = act(freshGame(NOW), { type: 'gather', resource: 'wood' }, NOW);
    expect(s.inventory.wood).toBe(12); expect(reserved(s)).toBe(4); expect(s.credits).toBe(120);
    expect(() => act(s, { type: 'gather', resource: 'metal' }, NOW)).toThrow(/crew is busy/);
    expect(advance(s, NOW + 4999).inventory.wood).toBe(12);
    const finished = advance(s, NOW + 5000);
    expect(finished.inventory.wood).toBe(16); expect(finished.gathered).toBe(4); expect(finished.jobs).toHaveLength(0);
    expect(advance(finished, NOW + 9000)).toBe(finished);
  });
  it('rejects storage overflow, counting reserved output', () => {
    const s = freshGame(NOW); s.inventory.wood = 106;
    expect(totalStock(s.inventory)).toBe(118);
    expect(() => act(s, { type: 'gather', resource: 'wood' }, NOW)).toThrow(/Storage is full/);
    const a = act(s, { type: 'gather', resource: 'metal' }, NOW);
    expect(totalStock(a.inventory) + reserved(a)).toBe(120);
  });
  it('cannot spend more credits or materials than owned; failed actions do not mutate state', () => {
    const s = freshGame(NOW); s.credits = 0;
    const before = encodeSave(s, NOW);
    expect(() => act(s, { type: 'build', building: 'sawmill' }, NOW)).toThrow(/Not enough/);
    expect(encodeSave(s, NOW)).toBe(before);
  });
  it('can clear full storage and recover credits by trading surplus without a softlock', () => {
    const s = freshGame(NOW); s.credits = 0; s.inventory = { wood: 120, stone: 0, metal: 0, planks: 0, tools: 0 };
    const sold = act(s, { type: 'sell', resource: 'wood', quantity: 4 }, NOW);
    expect(sold.credits).toBe(4); expect(sold.inventory.wood).toBe(116);
    expect(() => act(sold, { type: 'gather', resource: 'stone' }, NOW)).not.toThrow();
    expect(() => act(sold, { type: 'sell', resource: 'wood', quantity: -1 }, NOW)).toThrow(/positive/);
    expect(() => act(sold, { type: 'sell', resource: 'metal', quantity: 1 }, NOW)).toThrow(/positive/);
  });
});

describe('construction, upgrades and production', () => {
  it('pays for construction once, enables only when complete, scales upgrade costs and capacity', () => {
    let s = act(freshGame(NOW), { type: 'build', building: 'sawmill' }, NOW);
    expect(s.credits).toBe(60); expect(s.inventory.wood).toBe(4); expect(s.inventory.stone).toBe(4);
    expect(s.buildings.sawmill).toBe(0);
    expect(() => act(s, { type: 'build', building: 'sawmill' }, NOW)).toThrow(/underway/);
    expect(() => act(s, { type: 'produce', recipe: 'planks' }, NOW)).toThrow(/Build/);
    s = advance(s, NOW + 8000); expect(s.buildings.sawmill).toBe(1);
    const rich = unlocked(); rich.inventory.wood = 30; rich.inventory.stone = 20;
    const upgrading = act(rich, { type: 'build', building: 'warehouse' }, NOW);
    expect(capacity(upgrading)).toBe(120);
    const done = advance(upgrading, NOW + 16000); expect(capacity(done)).toBe(200);
    expect(buildCost(done, 'warehouse').credits).toBe(200);
  });
  it('limits a site to three serial batches and consumes inputs at enqueue', () => {
    let s = withSawmill(); s.inventory.wood = 40;
    for (let i = 0; i < 3; i++) s = act(s, { type: 'produce', recipe: 'planks' }, NOW);
    expect(s.jobs.map(j => j.end - NOW)).toEqual([12000, 24000, 36000]);
    expect(s.inventory.wood).toBe(28); expect(s.credits).toBe(114);
    expect(() => act(s, { type: 'produce', recipe: 'timber' }, NOW)).toThrow(/queue is full/);
    expect(advance(s, NOW + 12000).inventory.planks).toBe(3);
    expect(advance(s, NOW + 36000).inventory.planks).toBe(9);
  });
  it('has independent building lanes and upgrades speed up future batches', () => {
    let s = unlocked(); s.buildings.sawmill = 2; s.buildings.quarry = 1;
    s = act(s, { type: 'produce', recipe: 'planks' }, NOW);
    s = act(s, { type: 'produce', recipe: 'stone' }, NOW);
    expect(s.jobs[0].end - NOW).toBe(9600); expect(s.jobs[1].start).toBe(NOW);
  });
  it('refunds all inputs on cancellation and advances queued work without overlap', () => {
    let s = withSawmill(); const before = structuredClone(s);
    s = act(s, { type: 'produce', recipe: 'planks' }, NOW);
    const id = s.jobs[0].id;
    s = act(s, { type: 'produce', recipe: 'planks' }, NOW);
    s = act(s, { type: 'cancel', id }, NOW + 1000);
    expect(s.inventory.wood).toBe(before.inventory.wood - 4);
    expect(s.credits).toBe(before.credits - 2);
    expect(s.jobs[0].start).toBe(NOW + 1000); expect(s.jobs[0].end).toBe(NOW + 13000);
  });
  it('does not allow refunds to overflow storage', () => {
    let s = withSawmill(); s.inventory.wood = 108;
    s = act(s, { type: 'produce', recipe: 'planks' }, NOW);
    s.inventory.stone += 1;
    expect(totalStock(s.inventory) + reserved(s)).toBe(120);
    expect(() => act(s, { type: 'cancel', id: s.jobs[0].id }, NOW)).toThrow(/Make storage space/);
  });
  it('enforces player level and verified milestone gates', () => {
    const s = freshGame(NOW);
    expect(() => act(s, { type: 'build', building: 'metalworks' }, NOW)).toThrow(/100-block/);
    const u = unlocked(); u.xp = 0;
    expect(() => act(u, { type: 'build', building: 'metalworks' }, NOW)).toThrow(/level 2/);
  });
});

describe('shipments and contracts', () => {
  it('loads cargo, fills the board, blocks duplicate dispatch, pays exactly once after arrival', () => {
    let s = freshGame(NOW); const id = s.contracts[0].id;
    s = act(s, { type: 'dispatch', contract: id, route: 'meadow', vehicle: 'cart' }, NOW);
    expect(s.inventory.wood).toBe(4); expect(s.credits).toBe(120); expect(s.contracts).toHaveLength(3);
    expect(() => act(s, { type: 'dispatch', contract: id, route: 'meadow', vehicle: 'cart' }, NOW)).toThrow(/available contract/);
    const sh = s.shipments[0];
    expect(() => act(s, { type: 'collect', id: sh.id }, NOW + 17999)).toThrow(/still on/);
    s = act(s, { type: 'collect', id: sh.id }, NOW + 18000);
    expect(s.credits).toBe(168); expect(s.xp).toBe(25); expect(s.reputation).toBe(2); expect(s.deliveries).toBe(1);
    expect(() => act(s, { type: 'collect', id: sh.id }, NOW + 19000)).toThrow(/already been/);
  });
  it('requires inventory, a vehicle slot and sufficient capacity', () => {
    const s = freshGame(NOW); s.inventory.wood = 0;
    expect(() => act(s, { type: 'dispatch', contract: s.contracts[0].id, route: 'meadow', vehicle: 'cart' }, NOW)).toThrow(/8 wood/);
    s.inventory.wood = 24; s.contracts[0].quantity = 13;
    expect(() => act(s, { type: 'dispatch', contract: s.contracts[0].id, route: 'meadow', vehicle: 'cart' }, NOW)).toThrow(/capacity/);
    s.contracts[0].quantity = 8;
    const sent = act(s, { type: 'dispatch', contract: s.contracts[0].id, route: 'meadow', vehicle: 'cart' }, NOW);
    expect(() => act(sent, { type: 'dispatch', contract: sent.contracts[0].id, route: 'meadow', vehicle: 'cart' }, NOW)).toThrow(/vehicle slots/);
  });
  it('applies real route multipliers, vehicle times and departure fees', () => {
    let s = unlocked(); s.buildings.depot = 2;
    s = act(s, { type: 'dispatch', contract: s.contracts[0].id, route: 'canal', vehicle: 'van' }, NOW);
    expect(s.credits).toBe(489); expect(s.shipments[0].reward).toBe(60);
    expect(s.shipments[0].end - NOW).toBe(20800);
    s = act(s, { type: 'collect', id: s.shipments[0].id }, NOW + 21000);
    expect(s.credits).toBe(549);
  });
  it('cannot use global routes or higher depot vehicles without unlocking', () => {
    const s = freshGame(NOW);
    expect(() => act(s, { type: 'dispatch', contract: s.contracts[0].id, route: 'ridge', vehicle: 'cart' }, NOW)).toThrow(/milestone/);
    expect(() => act(s, { type: 'dispatch', contract: s.contracts[0].id, route: 'meadow', vehicle: 'van' }, NOW)).toThrow(/depot/);
  });
  it('rewards varied cargo once per three-type neighborhood mix', () => {
    let s = freshGame(NOW), time = NOW;
    for (const type of ['wood', 'stone', 'metal'] as const) {
      const c = s.contracts.find(c => c.resource === type)!;
      s = act(s, { type: 'dispatch', contract: c.id, route: 'meadow', vehicle: 'cart' }, time);
      time += 18000;
      s = act(s, { type: 'collect', id: s.shipments[0].id }, time);
    }
    expect(s.credits).toBe(120 + 48 + 50 + 64 + 20);
    expect(s.xp).toBe(25 + 30 + 35 + 10); expect(s.reputation).toBe(2 + 3 + 3 + 1);
    expect(s.tradeMix).toEqual([]); expect(s.log[0].text).toMatch(/Neighborly trade bonus/);
  });
  it('scales future contracts to upgraded vehicle capacity without trapping a starter fleet', () => {
    let s = unlocked(); s.buildings.depot = 3;
    const c = s.contracts[0];
    s = act(s, { type: 'dispatch', contract: c.id, route: 'meadow', vehicle: 'cart' }, NOW);
    const generated = s.contracts.find(c => Number(c.id.slice(6)) >= 10)!;
    expect(generated.quantity).toBeLessThanOrEqual(48); expect(generated.quantity).toBeGreaterThanOrEqual(12);
    expect(generated.credits).toBeGreaterThan(64);
  });
});

describe('milestone threshold boundaries', () => {
  it.each([0, 99, 100, 249, 250, 499, 500, 999, 1000, 1001])('only unlocks thresholds at or below settled height %i', height => {
    const s = applyMilestones(freshGame(NOW), { height: String(height), round: '600', work: '19507', safeBlock: '12087077', checkedAt: NOW });
    expect(s.unlocked.map(p => p.blocks)).toEqual([100, 250, 500, 1000].filter(x => x <= height));
  });
  it('uses work and settlement round, retains earned content, and is idempotent', () => {
    const proof = { height: '1000', round: '600', work: '19507', safeBlock: '12087077', checkedAt: NOW };
    expect(applyMilestones(freshGame(NOW), { ...proof, work: '0' }).unlocked).toHaveLength(0);
    expect(applyMilestones(freshGame(NOW), { ...proof, round: '0' }).unlocked).toHaveLength(0);
    const s = applyMilestones(freshGame(NOW), proof);
    expect(applyMilestones(s, proof)).toBe(s);
    expect(isUnlocked(applyMilestones(s, { ...proof, height: '1' }), 1000)).toBe(true);
  });
});

describe('versioned local save round trips', () => {
  it('round trips progress including work and shipment timers, finishing offline work once', () => {
    let s = withSawmill(); s = act(s, { type: 'produce', recipe: 'planks' }, NOW);
    s = act(s, { type: 'dispatch', contract: s.contracts[1].id, route: 'meadow', vehicle: 'cart' }, NOW);
    const text = encodeSave(s, NOW);
    const loaded = decodeSave(text, NOW + 60_000);
    expect(loaded.inventory.planks).toBe(3); expect(loaded.jobs).toHaveLength(0); expect(loaded.shipments).toHaveLength(1);
    const claimed = act(loaded, { type: 'collect', id: loaded.shipments[0].id }, NOW + 60_000);
    const reloaded = decodeSave(encodeSave(claimed, NOW + 60_000), NOW + 70_000);
    expect(reloaded.credits).toBe(claimed.credits); expect(reloaded.deliveries).toBe(1);
  });
  it('rejects malformed, incompatible, overflowing and duplicate saves', () => {
    expect(() => decodeSave('oops')).toThrow(/valid JSON/);
    expect(() => decodeSave('{"version":2}')).toThrow(/version/);
    const s = freshGame(NOW); s.inventory.wood = -1;
    expect(() => decodeSave(encodeSave(s))).toThrow(/inventory/);
    s.inventory.wood = 500;
    expect(() => decodeSave(encodeSave(s))).toThrow(/capacity/);
    const d = act(freshGame(NOW), { type: 'gather', resource: 'wood' }, NOW);
    d.jobs.push(d.jobs[0]);
    expect(() => decodeSave(encodeSave(d), NOW)).toThrow(/duplicate/);
    const invalidDate = freshGame(NOW); invalidDate.log[0].at = Number.MAX_SAFE_INTEGER;
    expect(() => decodeSave(encodeSave(invalidDate), NOW)).toThrow(/date outside/);
  });
});

describe('longer play balance and invariant checks', () => {
  it('can reach level 3 and expand without API access or a credit softlock', () => {
    let s = freshGame(NOW), time = NOW;
    s = act(s, { type: 'build', building: 'sawmill' }, time);
    time += 8000; s = advance(s, time);
    for (let n = 0; n < 15; n++) {
      const contract = s.contracts.find(c => c.resource !== 'tools')!;
      while (s.inventory[contract.resource] < contract.quantity) {
        if (contract.resource === 'planks') {
          while (s.inventory.wood < 4) { s = act(s, { type: 'gather', resource: 'wood' }, time); time += 5000; s = advance(s, time); }
          s = act(s, { type: 'produce', recipe: 'planks' }, time); time += 12000; s = advance(s, time);
        } else { s = act(s, { type: 'gather', resource: contract.resource as 'wood' | 'stone' | 'metal' }, time); time += 8000; s = advance(s, time); }
      }
      s = act(s, { type: 'dispatch', contract: contract.id, route: 'meadow', vehicle: 'cart' }, time);
      time += 18000; s = act(s, { type: 'collect', id: s.shipments[0].id }, time);
      assertEconomy(s);
    }
    expect(s.deliveries).toBe(15); expect(level(s)).toBeGreaterThanOrEqual(3); expect(s.credits).toBeGreaterThan(500);
    expect(s.unlocked).toHaveLength(0);
  });
  it('preserves nonnegative inventory, credits, reserved capacity and save validity over 500 seeded actions', () => {
    let s = unlocked(), time = NOW, seed = 4657;
    s.buildings.sawmill = 1; s.buildings.quarry = 1; s.buildings.depot = 3;
    for (let n = 0; n < 500; n++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const action = seed % 7;
      try {
        if (action < 3) s = act(s, { type: 'gather', resource: ['wood', 'stone', 'metal'][action] as 'wood' | 'stone' | 'metal' }, time);
        else if (action === 3) s = act(s, { type: 'produce', recipe: seed % 2 ? 'timber' : 'planks' }, time);
        else if (action === 4) s = act(s, { type: 'dispatch', contract: s.contracts[seed % 3].id, route: 'meadow', vehicle: 'cart' }, time);
        else if (action === 5 && s.shipments.length) s = act(s, { type: 'collect', id: s.shipments[0].id }, time);
        else if (s.jobs.length) s = act(s, { type: 'cancel', id: s.jobs[0].id }, time);
      } catch { /* Expected rejected choices must leave the valid state unchanged. */ }
      time += seed % 20000; s = advance(s, time); assertEconomy(s);
      expect(decodeSave(encodeSave(s, time), time).inventory).toEqual(s.inventory);
    }
  });
});
function assertEconomy(s: GameState) { expect(s.credits).toBeGreaterThanOrEqual(0); for (const amount of Object.values(s.inventory)) expect(amount).toBeGreaterThanOrEqual(0); expect(totalStock(s.inventory) + reserved(s)).toBeLessThanOrEqual(capacity(s)); }
