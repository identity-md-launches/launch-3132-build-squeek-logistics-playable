export const RESOURCES = ['wood', 'stone', 'metal', 'planks', 'tools'] as const;
export type Resource = typeof RESOURCES[number];
export type Stock = Record<Resource, number>;
export type Cost = Partial<Stock> & { credits?: number };
export const BUILDINGS = ['warehouse', 'sawmill', 'quarry', 'metalworks', 'workshop', 'depot'] as const;
export type Building = typeof BUILDINGS[number];
export type BuildingDef = { name: string; description: string; cost: Cost; milestone: number; level: number };
export const BUILDING: Record<Building, BuildingDef> = {
  warehouse: { name: 'Warehouse', description: 'A little more room for a bigger operation. Each upgrade adds 80 storage.', cost: { credits: 100, wood: 12, stone: 8 }, milestone: 0, level: 1 },
  sawmill: { name: 'Sawmill', description: 'Turn rough timber into planks, or send a crew into the grove.', cost: { credits: 60, wood: 8, stone: 4 }, milestone: 0, level: 1 },
  quarry: { name: 'Quarry', description: 'Produce stone in bulk. A reliable foundation for expansion.', cost: { credits: 75, wood: 10, metal: 2 }, milestone: 0, level: 1 },
  metalworks: { name: 'Metalworks', description: 'Refine stone into metal for the next generation of machines.', cost: { credits: 120, stone: 12, planks: 6 }, milestone: 100, level: 2 },
  workshop: { name: 'Workshop', description: 'Craft valuable tools from planks and metal. Tiny paws, fine work.', cost: { credits: 150, planks: 10, metal: 6 }, milestone: 250, level: 3 },
  depot: { name: 'Cargo depot', description: 'Each level adds a vehicle slot and opens a larger vehicle.', cost: { credits: 120, planks: 8, metal: 4 }, milestone: 0, level: 1 },
};
export type Recipe = { id: string; name: string; building: Building; cost: Cost; output: Partial<Stock>; seconds: number };
export const RECIPES: Recipe[] = [
  { id: 'timber', name: 'Harvest timber', building: 'sawmill', cost: { credits: 2 }, output: { wood: 8 }, seconds: 15 },
  { id: 'planks', name: 'Saw planks', building: 'sawmill', cost: { credits: 2, wood: 4 }, output: { planks: 3 }, seconds: 12 },
  { id: 'stone', name: 'Cut stone', building: 'quarry', cost: { credits: 3 }, output: { stone: 8 }, seconds: 18 },
  { id: 'metal', name: 'Refine metal', building: 'metalworks', cost: { credits: 4, stone: 3 }, output: { metal: 6 }, seconds: 24 },
  { id: 'tools', name: 'Craft tools', building: 'workshop', cost: { credits: 4, planks: 3, metal: 2 }, output: { tools: 2 }, seconds: 24 },
];
export const ROUTES = [
  { id: 'meadow', name: 'Meadow lane', region: 'Clover Commons', seconds: 18, multiplier: 1, toll: 0, milestone: 0, description: 'Short, sweet and toll-free.' },
  { id: 'canal', name: 'Canal crossing', region: 'Willow Bend', seconds: 32, multiplier: 1.25, toll: 3, milestone: 100, description: 'A waterside detour with a better payday.' },
  { id: 'ridge', name: 'Copper ridge', region: 'Copper Highlands', seconds: 46, multiplier: 1.6, toll: 5, milestone: 250, description: 'Steep roads. Generous neighbors.' },
  { id: 'coast', name: 'Sunflower coast', region: 'Sunflower Harbor', seconds: 65, multiplier: 2, toll: 8, milestone: 500, description: 'A longer run to the busy harbor.' },
  { id: 'rail', name: 'Genesis express', region: 'Genesis Junction', seconds: 80, multiplier: 2.5, toll: 12, milestone: 1000, description: 'The whole region is within your reach.' },
] as const;
export const VEHICLES = [
  { id: 'cart', name: 'Handcart', capacity: 12, speed: 1, fee: 0, depot: 1, milestone: 0 },
  { id: 'van', name: 'Acorn van', capacity: 24, speed: .65, fee: 8, depot: 2, milestone: 0 },
  { id: 'hauler', name: 'Seed hauler', capacity: 48, speed: 1.3, fee: 12, depot: 3, milestone: 500 },
] as const;
export type RouteId = typeof ROUTES[number]['id'];
export type VehicleId = typeof VEHICLES[number]['id'];
export const MILESTONES = [
  { blocks: 100, name: 'Across the water', description: 'Unlock Willow Bend, Canal crossing and the Metalworks.' },
  { blocks: 250, name: 'Made by tiny paws', description: 'Unlock Copper Highlands, Copper ridge and the Workshop.' },
  { blocks: 500, name: 'Coast to coast', description: 'Unlock Sunflower Harbor, the coastal route and Seed hauler.' },
  { blocks: 1000, name: 'A connected world', description: 'Unlock Genesis Junction and the Genesis express route.' },
] as const;
export type Contract = { id: string; title: string; client: string; resource: Resource; quantity: number; credits: number; xp: number; reputation: number };
const ORDERS = [
  { title: 'A neighbor in need', client: 'Mabel’s homestead', resource: 'wood', quantity: 8, credits: 48, xp: 25, reputation: 2 },
  { title: 'A solid foundation', client: 'Clover community garden', resource: 'stone', quantity: 6, credits: 50, xp: 30, reputation: 3 },
  { title: 'Keep the wheels turning', client: 'Pip’s repair shop', resource: 'metal', quantity: 4, credits: 64, xp: 35, reputation: 3 },
  { title: 'Room for one more', client: 'The burrow builders', resource: 'planks', quantity: 6, credits: 100, xp: 50, reputation: 4 },
  { title: 'Tools of the trade', client: 'Hazel’s makers guild', resource: 'tools', quantity: 3, credits: 160, xp: 75, reputation: 6 },
] satisfies Omit<Contract, 'id'>[];
export type Job = { id: number; kind: 'gather' | 'produce' | 'build'; lane: string; title: string; start: number; end: number; cost: Cost; output: Partial<Stock>; building?: Building; level?: number };
export type Shipment = { id: number; contract: Contract; route: RouteId; vehicle: VehicleId; start: number; end: number; reward: number; fee: number };
export type MilestoneProof = { blocks: number; height: string; round: string; work: string; safeBlock: string; checkedAt: number };
export type GameState = {
  version: 1; credits: number; xp: number; reputation: number; inventory: Stock;
  buildings: Record<Building, number>; jobs: Job[]; shipments: Shipment[]; contracts: Contract[];
  unlocked: MilestoneProof[]; nextId: number; deliveries: number; gathered: number; crafted: number;
  tutorialDismissed: boolean; tradeMix: Resource[]; log: { id: number; text: string; at: number }[]; savedAt: number;
};
export const SAVE_KEY = 'squeek-logistics:v1';
export const SURPLUS_VALUE: Stock = { wood: 1, stone: 1, metal: 2, planks: 3, tools: 6 };
export const stock = (): Stock => ({ wood: 0, stone: 0, metal: 0, planks: 0, tools: 0 });
export function freshGame(now = Date.now()): GameState {
  return { version: 1, credits: 120, xp: 0, reputation: 0, inventory: { wood: 12, stone: 8, metal: 4, planks: 0, tools: 0 },
    buildings: { warehouse: 1, sawmill: 0, quarry: 0, metalworks: 0, workshop: 0, depot: 1 }, jobs: [], shipments: [],
    contracts: ORDERS.slice(0, 3).map((c, i) => ({ ...c, id: `order-${i + 1}` })),
    unlocked: [], nextId: 10, deliveries: 0, gathered: 0, crafted: 0, tutorialDismissed: false, tradeMix: [],
    log: [{ id: 1, text: 'Welcome to Clover Commons. Your first little empire starts here.', at: now }], savedAt: now };
}
export const totalStock = (inventory: Partial<Stock>) => RESOURCES.reduce((n, r) => n + (inventory[r] || 0), 0);
export const capacity = (s: GameState) => 120 + (s.buildings.warehouse - 1) * 80;
export const reserved = (s: GameState) => s.jobs.reduce((n, j) => n + totalStock(j.output), 0);
export const level = (s: GameState) => Math.min(10, 1 + Math.floor(s.xp / 100));
export const isUnlocked = (s: GameState, blocks: number) => blocks === 0 || s.unlocked.some(p => p.blocks === blocks);
export function canAfford(s: GameState, cost: Cost) {
  return s.credits >= (cost.credits || 0) && RESOURCES.every(r => s.inventory[r] >= (cost[r] || 0));
}
function pay(s: GameState, cost: Cost) {
  s.credits -= cost.credits || 0;
  for (const r of RESOURCES) s.inventory[r] -= cost[r] || 0;
}
function note(s: GameState, text: string, now: number) {
  s.log = [{ id: s.nextId++, text, at: now }, ...s.log].slice(0, 24);
}
export class GameError extends Error {}
function requireGame(condition: unknown, message: string): asserts condition { if (!condition) throw new GameError(message); }
export function advance(state: GameState, now = Date.now()): GameState {
  if (!state.jobs.some(j => j.end <= now)) return state;
  const s = structuredClone(state);
  const completed = s.jobs.filter(j => j.end <= now).sort((a, b) => a.end - b.end);
  s.jobs = s.jobs.filter(j => j.end > now);
  for (const j of completed) {
    for (const r of RESOURCES) s.inventory[r] += j.output[r] || 0;
    if (j.kind === 'build' && j.building) s.buildings[j.building] = j.level!;
    if (j.kind === 'gather') s.gathered += totalStock(j.output);
    if (j.kind === 'produce') s.crafted += totalStock(j.output);
    note(s, `${j.title} completed${j.kind === 'build' ? '.' : ': cargo is in storage.'}`, now);
  }
  return s;
}
export type GameAction =
  | { type: 'gather'; resource: 'wood' | 'stone' | 'metal' }
  | { type: 'build'; building: Building }
  | { type: 'produce'; recipe: string }
  | { type: 'cancel'; id: number }
  | { type: 'dispatch'; contract: string; route: RouteId; vehicle: VehicleId }
  | { type: 'collect'; id: number }
  | { type: 'sell'; resource: Resource; quantity: number }
  | { type: 'dismiss-tutorial' };
export function buildCost(s: GameState, building: Building): Cost {
  const multiplier = Math.max(1, s.buildings[building]);
  return Object.fromEntries(Object.entries(BUILDING[building].cost).map(([k, v]) => [k, v * multiplier]));
}
export function act(state: GameState, action: GameAction, now = Date.now()): GameState {
  const s = structuredClone(advance(state, now));
  if (action.type === 'gather') {
    requireGame(!s.jobs.some(j => j.lane === 'field'), 'Your gathering crew is busy. Let them finish their run.');
    const amount = { wood: 4, stone: 3, metal: 2 }[action.resource];
    requireGame(totalStock(s.inventory) + reserved(s) + amount <= capacity(s), 'Storage is full. Ship cargo, trade surplus or upgrade the warehouse.');
    s.jobs.push({ id: s.nextId++, kind: 'gather', lane: 'field', title: `Gather ${action.resource}`, start: now, end: now + { wood: 5000, stone: 6500, metal: 8000 }[action.resource], cost: {}, output: { [action.resource]: amount } });
  } else if (action.type === 'build') {
    const b = action.building, def = BUILDING[b];
    requireGame(s.buildings[b] < 3, 'This building is already at its maximum level.');
    requireGame(!s.jobs.some(j => j.building === b && j.kind === 'build'), 'Construction is already underway here.');
    requireGame(isUnlocked(s, def.milestone), `This building needs the ${def.milestone}-block global milestone.`);
    requireGame(level(s) >= def.level, `Reach logistics level ${def.level} to build here.`);
    const cost = buildCost(s, b);
    requireGame(canAfford(s, cost), 'Not enough materials or credits. Gather resources and fulfill a contract.');
    pay(s, cost);
    const target = s.buildings[b] + 1;
    s.jobs.push({ id: s.nextId++, kind: 'build', lane: `construction-${b}`, building: b, level: target, title: `${def.name} level ${target}`, start: now, end: now + 8000 * target, cost, output: {} });
  } else if (action.type === 'produce') {
    const recipe = RECIPES.find(r => r.id === action.recipe);
    requireGame(recipe, 'Unknown production recipe.');
    requireGame(s.buildings[recipe.building] > 0, `Build the ${BUILDING[recipe.building].name} first.`);
    const lane = s.jobs.filter(j => j.lane === recipe.building);
    requireGame(lane.length < 3, 'This production queue is full (3 batches).');
    requireGame(canAfford(s, recipe.cost), 'Not enough inputs for this batch. Gather resources or complete a contract.');
    requireGame(totalStock(s.inventory) - totalStock(recipe.cost) + reserved(s) + totalStock(recipe.output) <= capacity(s), 'Not enough storage for the finished batch. Ship cargo or upgrade storage.');
    pay(s, recipe.cost);
    const start = Math.max(now, ...lane.map(j => j.end));
    const duration = Math.round(recipe.seconds * 1000 * Math.pow(.8, s.buildings[recipe.building] - 1));
    s.jobs.push({ id: s.nextId++, kind: 'produce', lane: recipe.building, title: recipe.name, start, end: start + duration, cost: recipe.cost, output: recipe.output });
  } else if (action.type === 'cancel') {
    const j = s.jobs.find(j => j.id === action.id);
    requireGame(j, 'This job has already finished.');
    requireGame(totalStock(s.inventory) + reserved(s) - totalStock(j.output) + totalStock(j.cost) <= capacity(s), 'Make storage space before cancelling this job. Its inputs will be refunded.');
    s.jobs = s.jobs.filter(q => q.id !== j.id);
    s.credits += j.cost.credits || 0;
    for (const r of RESOURCES) s.inventory[r] += j.cost[r] || 0;
    // Keep serial queues contiguous after removing a batch, preserving each batch’s duration.
    let end = now;
    for (const q of s.jobs.filter(q => q.lane === j.lane).sort((a, b) => a.start - b.start)) {
      if (q.start > now) { const duration = q.end - q.start; q.start = Math.max(end, now); q.end = q.start + duration; }
      end = q.end;
    }
    note(s, `${j.title} cancelled. All inputs refunded.`, now);
  } else if (action.type === 'dispatch') {
    const contract = s.contracts.find(c => c.id === action.contract);
    const route = ROUTES.find(r => r.id === action.route), vehicle = VEHICLES.find(v => v.id === action.vehicle);
    requireGame(contract && route && vehicle, 'Choose an available contract, route and vehicle.');
    requireGame(isUnlocked(s, route.milestone) && isUnlocked(s, vehicle.milestone), 'That route or vehicle needs a global milestone.');
    requireGame(s.buildings.depot >= vehicle.depot, `Upgrade the cargo depot to level ${vehicle.depot} for this vehicle.`);
    requireGame(s.shipments.length < s.buildings.depot, 'All vehicle slots are occupied. Collect a delivery or upgrade the cargo depot.');
    requireGame(contract.quantity <= vehicle.capacity, `This order exceeds the ${vehicle.capacity}-unit vehicle capacity.`);
    requireGame(s.inventory[contract.resource] >= contract.quantity, `Gather or produce ${contract.quantity} ${contract.resource} before dispatching.`);
    requireGame(s.credits >= route.toll + vehicle.fee, 'Not enough credits to cover the route toll and vehicle fee.');
    s.inventory[contract.resource] -= contract.quantity;
    s.credits -= route.toll + vehicle.fee;
    s.shipments.push({ id: s.nextId++, contract, route: route.id, vehicle: vehicle.id, start: now, end: now + Math.round(route.seconds * vehicle.speed * 1000), reward: Math.round(contract.credits * route.multiplier), fee: route.toll + vehicle.fee });
    s.contracts = s.contracts.filter(c => c.id !== contract.id);
    note(s, `${contract.quantity} ${contract.resource} dispatched via ${route.name}.`, now);
  } else if (action.type === 'collect') {
    const shipment = s.shipments.find(sh => sh.id === action.id);
    requireGame(shipment, 'This delivery has already been collected.');
    requireGame(shipment.end <= now, 'This shipment is still on its way.');
    s.credits += shipment.reward;
    s.xp += shipment.contract.xp;
    s.reputation += shipment.contract.reputation;
    s.deliveries++;
    s.shipments = s.shipments.filter(sh => sh.id !== shipment.id);
    note(s, `Delivered to ${shipment.contract.client}: +${shipment.reward} credits, +${shipment.contract.xp} XP.`, now);
    if (!s.tradeMix.includes(shipment.contract.resource)) s.tradeMix.push(shipment.contract.resource);
    if (s.tradeMix.length === 3) {
      s.credits += 20; s.xp += 10; s.reputation += 1; s.tradeMix = [];
      note(s, 'Neighborly trade bonus! Three different cargo types delivered: +20 credits, +10 XP, +1 reputation.', now);
    }
  } else if (action.type === 'sell') {
    requireGame(Number.isSafeInteger(action.quantity) && action.quantity > 0 && action.quantity <= s.inventory[action.resource], 'Choose a positive quantity that is in storage.');
    s.inventory[action.resource] -= action.quantity;
    const credits = SURPLUS_VALUE[action.resource] * action.quantity;
    s.credits += credits;
    note(s, `Traded ${action.quantity} surplus ${action.resource} for ${credits} in-game credits.`, now);
  } else if (action.type === 'dismiss-tutorial') s.tutorialDismissed = true;
  fillBoard(s);
  return s;
}
function fillBoard(s: GameState) {
  const available = ORDERS.filter(c => c.resource !== 'planks' && c.resource !== 'tools' || c.resource === 'planks' && s.buildings.sawmill > 0 || c.resource === 'tools' && s.buildings.workshop > 0);
  while (s.contracts.length < 3) {
    // Always retain a small raw-material order that a free handcart can fulfill.
    const recoveryOrder = !s.contracts.some(c => ['wood', 'stone', 'metal'].includes(c.resource) && c.quantity <= 12);
    const template = recoveryOrder ? ORDERS[(s.nextId + s.deliveries) % 3] : available[(s.nextId + s.deliveries) % available.length];
    // A repeatable local order board; no purported real customers or global players.
    const largestVehicle = s.buildings.depot >= 3 && isUnlocked(s, 500) ? 48 : s.buildings.depot >= 2 ? 24 : 12;
    const desiredScale = s.buildings.depot >= 3 ? 3 + s.nextId % 3 : s.buildings.depot >= 2 ? 2 + s.nextId % 2 : 1;
    const scale = recoveryOrder ? 1 : Math.min(desiredScale, Math.floor(largestVehicle / template.quantity));
    s.contracts.push({ ...template, quantity: template.quantity * scale, credits: Math.round(template.credits * scale * (1 + .05 * (scale - 1))), xp: template.xp * scale, reputation: template.reputation + scale - 1, id: `order-${s.nextId++}` });
  }
}
export function applyMilestones(state: GameState, proof: Omit<MilestoneProof, 'blocks'>): GameState {
  // Call only with a fresh, identity-checked settled snapshot (never projection data).
  if (!/^\d+$/.test(proof.height) || !/^\d+$/.test(proof.round) || !/^\d+$/.test(proof.work)) return state;
  if (BigInt(proof.round) === 0n || BigInt(proof.work) === 0n) return state;
  const newly = MILESTONES.filter(m => BigInt(proof.height) >= BigInt(m.blocks) && !isUnlocked(state, m.blocks));
  if (!newly.length) return state;
  const s = structuredClone(state);
  for (const m of newly) { s.unlocked.push({ ...proof, blocks: m.blocks }); note(s, `Global milestone: ${m.name}. ${m.description}`, proof.checkedAt); }
  return s;
}
export function encodeSave(state: GameState, now = Date.now()) { return JSON.stringify({ ...state, savedAt: now }, null, 2); }
const finiteInt = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function validCost(v: unknown, credits = true): v is Cost {
  return record(v) && Object.entries(v).every(([k, n]) => (RESOURCES.includes(k as Resource) || credits && k === 'credits') && finiteInt(n));
}
function validContract(v: unknown): v is Contract {
  return record(v) && typeof v.id === 'string' && v.id.length < 80 && typeof v.title === 'string' && v.title.length < 100 && typeof v.client === 'string' && v.client.length < 100 && RESOURCES.includes(v.resource as Resource) && finiteInt(v.quantity, 1, 48) && finiteInt(v.credits) && finiteInt(v.xp) && finiteInt(v.reputation);
}
export function decodeSave(text: string, now = Date.now()): GameState {
  requireGame(text.length < 200_000, 'This save is too large. Choose a Squeek Logistics JSON export.');
  let v: unknown;
  try { v = JSON.parse(text); } catch { throw new GameError('This file is not valid JSON. Choose an exported game save.'); }
  requireGame(record(v) && v.version === 1, 'Unsupported save version. This game reads version 1 saves.');
  requireGame(['credits', 'xp', 'reputation', 'nextId', 'deliveries', 'gathered', 'crafted', 'savedAt'].every(k => finiteInt(v[k], 0, Number.MAX_SAFE_INTEGER)), 'Save contains invalid counters.');
  requireGame(record(v.inventory) && RESOURCES.every(r => finiteInt((v.inventory as Stock)[r])) && validCost(v.inventory, false), 'Save contains invalid inventory.');
  requireGame(record(v.buildings) && BUILDINGS.every(b => finiteInt((v.buildings as Record<Building, number>)[b], b === 'warehouse' || b === 'depot' ? 1 : 0, 3)), 'Save contains invalid buildings.');
  requireGame(Array.isArray(v.jobs) && v.jobs.length <= 25 && v.jobs.every(j => record(j) && finiteInt(j.id) && ['gather', 'produce', 'build'].includes(j.kind as string) && typeof j.lane === 'string' && typeof j.title === 'string' && j.title.length < 100 && finiteInt(j.start) && finiteInt(j.end) && j.end >= j.start && validCost(j.cost) && validCost(j.output, false) && (j.kind !== 'build' || BUILDINGS.includes(j.building as Building) && finiteInt(j.level, 1, 3))), 'Save contains an invalid production queue.');
  requireGame(Array.isArray(v.contracts) && v.contracts.length === 3 && v.contracts.every(validContract), 'Save contains invalid contracts.');
  requireGame(Array.isArray(v.shipments) && v.shipments.length <= 3 && v.shipments.every(sh => record(sh) && finiteInt(sh.id) && validContract(sh.contract) && ROUTES.some(r => r.id === sh.route) && VEHICLES.some(ve => ve.id === sh.vehicle) && finiteInt(sh.start) && finiteInt(sh.end) && sh.end >= sh.start && finiteInt(sh.reward) && finiteInt(sh.fee)), 'Save contains invalid shipments.');
  requireGame(Array.isArray(v.unlocked) && v.unlocked.length <= 4 && v.unlocked.every(p => record(p) && MILESTONES.some(m => m.blocks === p.blocks) && ['height', 'round', 'work', 'safeBlock'].every(k => typeof p[k] === 'string' && /^\d{1,78}$/.test(p[k] as string)) && BigInt(p.height as string) >= BigInt(p.blocks as number) && BigInt(p.round as string) > 0n && BigInt(p.work as string) > 0n && finiteInt(p.checkedAt)), 'Save contains invalid milestone records.');
  requireGame(typeof v.tutorialDismissed === 'boolean' && Array.isArray(v.log) && v.log.length <= 24 && v.log.every(e => record(e) && finiteInt(e.id) && typeof e.text === 'string' && e.text.length < 400 && finiteInt(e.at)), 'Save contains invalid journal entries.');
  requireGame(Array.isArray(v.tradeMix) && v.tradeMix.length <= 2 && new Set(v.tradeMix).size === v.tradeMix.length && v.tradeMix.every(r => RESOURCES.includes(r)), 'Save contains invalid neighborly trade progress.');
  const s = v as GameState;
  const timestamps = [s.savedAt, ...s.jobs.flatMap(j => [j.start, j.end]), ...s.shipments.flatMap(sh => [sh.start, sh.end]), ...s.log.map(e => e.at), ...s.unlocked.map(p => p.checkedAt)];
  requireGame(timestamps.every(t => t <= 8_640_000_000_000_000), 'Save contains a date outside the supported range.');
  const ids = [...s.jobs, ...s.shipments, ...s.log].map(x => x.id);
  requireGame(new Set(ids).size === ids.length && ids.every(id => id < s.nextId), 'Save contains duplicate or invalid identifiers.');
  requireGame(totalStock(s.inventory) + reserved(s) <= capacity(s), 'Save exceeds warehouse capacity.');
  return advance(s, now);
}
export function tutorial(s: GameState): { step: number; title: string; text: string; done: boolean } {
  if (!s.gathered) return { step: 1, title: 'Every empire starts small.', text: 'Send your gathering crew for wood. One crew, no cost, five seconds.', done: false };
  if (!s.deliveries && !s.shipments.length) return { step: 2, title: 'Your first delivery awaits.', text: 'Choose an order on the contract board, then dispatch your handcart.', done: false };
  if (!s.deliveries) return { step: 3, title: 'Good things take a little time.', text: 'Follow your handcart in Shipments. Collect its reward when it arrives.', done: false };
  if (!s.buildings.sawmill) return { step: 4, title: 'Put those credits to work.', text: 'Build a sawmill in Buildings. Produce planks to take on better contracts.', done: false };
  if (!s.crafted) return { step: 5, title: 'From timber to trade.', text: 'Select the sawmill and queue your first batch of planks.', done: false };
  return { step: 5, title: 'You’re a logistics natural.', text: 'Expand storage, upgrade your depot and deliver your way to level 5.', done: true };
}
