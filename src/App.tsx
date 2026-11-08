import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Clock3, Factory, Flag, Globe2, Hammer, Leaf, Map, Package, Pause, Play, Plus, RotateCcw, Save, Settings2, ShieldCheck, Truck, Upload, Volume2, VolumeX, Warehouse, X } from 'lucide-react';
import { act, advance, applyMilestones, BUILDING, BUILDINGS, buildCost, canAfford, capacity, decodeSave, encodeSave, freshGame, isUnlocked, level, MILESTONES, RECIPES, reserved, RESOURCES, ROUTES, SAVE_KEY, SURPLUS_VALUE, totalStock, tutorial, VEHICLES, type Building, type Contract, type Cost, type GameAction, type GameState, type Resource, type RouteId, type VehicleId } from './game';
import { CORE_URL, CoreClient, DEPLOYMENT_URL, EXPECTED_CORE, initialSync, isFresh, type SyncState } from './integration/core';
import { PixelIcon } from './PixelIcon';
import { World } from './World';

type View = 'outpost' | 'buildings' | 'contracts' | 'shipments' | 'genesis';
const viewItems = [{ id: 'outpost', name: 'Outpost', icon: Map }, { id: 'buildings', name: 'Buildings', icon: Factory }, { id: 'contracts', name: 'Contracts', icon: Package }, { id: 'shipments', name: 'Shipments', icon: Truck }, { id: 'genesis', name: 'Genesis', icon: Globe2 }] as const;
const format = (n: number | string) => typeof n === 'number' ? n.toLocaleString('en-US') : BigInt(n).toLocaleString('en-US');
const remaining = (end: number, now: number) => { const seconds = Math.max(0, Math.ceil((end - now) / 1000)); return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`; };
const humanTime = (n: number) => new Date(n).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function loadInitial() {
  try { const raw = localStorage.getItem(SAVE_KEY); return { game: raw ? decodeSave(raw) : freshGame(), error: '' }; }
  catch { return { game: freshGame(), error: 'Local save could not be read. This session is in memory. Open Save & load to import or start a new save.' }; }
}
function CostLine({ cost, game }: { cost: Cost; game?: GameState }) {
  return <span className="cost-line">{Object.entries(cost).map(([name, amount]) => <span className={game && (name === 'credits' ? game.credits : game.inventory[name as Resource]) < amount ? 'cost-short' : ''} key={name}><PixelIcon name={name as Resource | 'credits'} size={18} /><span>{amount}<span className="sr-only"> {name}</span></span></span>)}</span>;
}
function Progress({ value, label, color = '' }: { value: number; label: string; color?: string }) {
  return <div className={`progress ${color}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(100, value)))}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
function Modal({ title, close, children, wide = false }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { ref.current?.close(); trigger?.focus(); };
  }, []);
  return <dialog className={wide ? 'modal wide' : 'modal'} ref={ref} aria-labelledby="dialog-title" onCancel={close} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(); } }}>
    <div className="modal-head"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20} /></button></div>{children}
  </dialog>;
}

export default function App() {
  const [initial] = useState(loadInitial);
  const [game, setGame] = useState(initial.game);
  const [saveIssue, setSaveIssue] = useState(initial.error);
  const [allowSave, setAllowSave] = useState(!initial.error);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<View>('outpost');
  const [selected, setSelected] = useState<Building>('warehouse');
  const [dialog, setDialog] = useState<'guide' | 'save' | 'dispatch' | null>(null);
  const [pendingContract, setPendingContract] = useState<Contract | null>(null);
  const [routeId, setRouteId] = useState<RouteId>('meadow');
  const [vehicleId, setVehicleId] = useState<VehicleId>('cart');
  const [feedback, setFeedback] = useState({ text: 'A fresh start. A warehouse. A world of possibilities.', error: false });
  const [sound, setSound] = useState(false);
  const [motion, setMotion] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [sync, setSync] = useState<SyncState>(initialSync);
  const [attemptAt, setAttemptAt] = useState<number | null>(null);
  const [lastGoodAt, setLastGoodAt] = useState<number | null>(null);
  const [pendingImport, setPendingImport] = useState<GameState | null>(null);
  const [importError, setImportError] = useState('');
  const [resetText, setResetText] = useState('');
  const client = useRef(new CoreClient());
  const busySync = useRef(false);
  const nextSync = useRef(0);
  const gameRef = useRef(game);
  gameRef.current = game;
  const fresh = isFresh(sync, now);
  const notice = useCallback((text: string, error = false) => setFeedback({ text, error }), []);
  const audio = useRef<AudioContext | null>(null);
  function chime() {
    if (!sound) return;
    try { const a = audio.current ||= new AudioContext(); void a.resume(); const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(520, a.currentTime); o.frequency.setValueAtTime(780, a.currentTime + .09); g.gain.setValueAtTime(.035, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .22); o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + .23); } catch { /* Audio is optional; the visual response remains available. */ }
  }
  function run(action: GameAction, message: string) {
    try {
      const result = act(gameRef.current, action, Date.now());
      gameRef.current = result;
      setGame(result);
      notice(message);
      chime();
      return true;
    } catch (e) { notice(e instanceof Error ? e.message : 'This action could not be completed.', true); return false; }
  }
  const syncCore = useCallback(async () => {
    if (busySync.current || Date.now() < nextSync.current) return;
    busySync.current = true;
    const time = Date.now(); setAttemptAt(time);
    const result = await client.current.sync(time);
    nextSync.current = result.nextAt;
    setSync(result);
    if (isFresh(result) && result.data) {
      setLastGoodAt(result.checkedAt);
      const d = result.data;
      setGame(s => applyMilestones(s, { height: d.core.blockHeight, round: d.core.settledThroughRound, work: d.core.cumulativeWork, safeBlock: d.chain.safeThroughBlock, checkedAt: result.checkedAt! }));
    }
    busySync.current = false;
  }, []);
  useEffect(() => {
    void syncCore();
    const interval = setInterval(() => {
      const time = Date.now();
      setNow(time);
      setGame(s => advance(s, time));
      if (time >= nextSync.current) void syncCore();
    }, 1000);
    const resume = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); setGame(s => advance(s)); if (Date.now() >= nextSync.current) void syncCore(); } };
    document.addEventListener('visibilitychange', resume);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', resume); };
  }, [syncCore]);
  useEffect(() => {
    if (!allowSave) return;
    try { const time = Date.now(); localStorage.setItem(SAVE_KEY, encodeSave(game, time)); setSavedAt(time); setSaveIssue(''); }
    catch { setSaveIssue('Local saving is unavailable. Keep this tab open and export your save before leaving.'); setAllowSave(false); }
  }, [game, allowSave]);

  const guide = tutorial(game);
  const fieldJob = game.jobs.find(j => j.lane === 'field');
  const used = totalStock(game.inventory);
  const goals = [{ title: 'Deliver your first order', current: game.deliveries, target: 1 }, { title: 'Build a sawmill', current: game.buildings.sawmill, target: 1 }, { title: 'Produce 10 resources', current: game.crafted, target: 10 }, { title: 'Earn 30 reputation', current: game.reputation, target: 30 }, { title: 'Reach logistics level 5', current: level(game), target: 5 }];
  const completedGoals = goals.filter(g => g.current >= g.target).length;
  function selectBuilding(building: Building) { setSelected(building); setView('outpost'); }
  function prepare(c: Contract) { setPendingContract(c); setRouteId('meadow'); setVehicleId('cart'); setDialog('dispatch'); }
  function download() {
    const blob = new Blob([encodeSave(game)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `squeek-logistics-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notice('Save exported. Keep it somewhere safe.');
  }
  async function importSave(file?: File) {
    if (!file) return;
    setImportError('');
    if (file.size > 200_000) { setImportError('Choose a game save smaller than 200 KB.'); return; }
    try { setPendingImport(decodeSave(await file.text())); }
    catch (e) { setImportError(e instanceof Error ? e.message : 'This save could not be read.'); }
  }
  function reset() { const state = freshGame(); setGame(state); gameRef.current = state; setAllowSave(true); setSaveIssue(''); setResetText(''); setView('outpost'); setDialog(null); notice('New outpost started. Welcome back to Clover Commons.'); nextSync.current = 0; void syncCore(); }

  function buildingPanel(b: Building, compact = false) {
    const def = BUILDING[b], current = game.buildings[b], cost = buildCost(game, b);
    const construction = game.jobs.find(j => j.building === b && j.kind === 'build');
    const locked = !isUnlocked(game, def.milestone);
    const levelLocked = level(game) < def.level;
    return <section className={`building-panel ${compact ? 'compact' : ''}`} key={b} aria-label={def.name}>
      <div className="section-top"><div className="building-title"><span className={`building-glyph ${b}`}><BuildingIcon building={b} /></span><div><h2>{def.name}</h2><span className="subtle">{current ? `Level ${current} of 3` : 'Ready for a fresh foundation'}</span></div></div>{current > 0 && <span className="badge neutral">{b === 'warehouse' ? `${capacity(game)} storage` : b === 'depot' ? `${current} vehicle ${current === 1 ? 'slot' : 'slots'}` : 'Production'}</span>}</div>
      <p>{def.description}</p>
      {locked ? <div className="lock-message"><Flag size={16} /> Requires {def.milestone} settled blocks. {fresh ? 'Check Genesis for global progress.' : 'Global state is UNKNOWN.'}</div> : levelLocked ? <div className="lock-message"><Flag size={16} /> Reach logistics level {def.level} to build here.</div> : construction ? <div className="construction"><div><Hammer size={16} /> Construction underway <strong>{remaining(construction.end, now)}</strong></div><Progress value={(now - construction.start) / (construction.end - construction.start) * 100} label={`${def.name} construction`} /></div> : current < 3 ? <div className="build-action"><div><span className="subtle">{current ? 'Upgrade cost' : 'Build cost'}</span><CostLine cost={cost} game={game} /></div><button className={current === 0 && b === 'sawmill' ? 'button primary' : 'button secondary'} disabled={!canAfford(game, cost)} onClick={() => run({ type: 'build', building: b }, `${def.name} construction started. Inputs paid; ready in ${8 * (current + 1)}s.`)}><Plus size={16} />{current ? 'Upgrade' : 'Build'}</button></div> : <div className="success-line"><Check size={16} /> Fully upgraded. Tiny but mighty.</div>}
      {!locked && !levelLocked && current < 3 && !construction && !canAfford(game, cost) && <p className="hint">Gather the highlighted materials or deliver an order for more credits.</p>}
      {current > 0 && b !== 'warehouse' && b !== 'depot' && <div className="recipes">{RECIPES.filter(r => r.building === b).map(r => {
        const queueFull = game.jobs.filter(j => j.lane === b).length >= 3;
        const room = used - totalStock(r.cost) + reserved(game) + totalStock(r.output) <= capacity(game);
        return <div className="recipe" key={r.id}><div className="recipe-heading"><h3>{r.name}</h3><span className="subtle"><Clock3 size={13} /> {Math.round(r.seconds * .8 ** (current - 1))}s</span></div><div className="recipe-trade"><CostLine cost={r.cost} game={game} /><ArrowRight size={14} /><CostLine cost={r.output} /></div><button className="button secondary small" disabled={!canAfford(game, r.cost) || queueFull || !room} onClick={() => run({ type: 'produce', recipe: r.id }, `${r.name} added to the queue. Inputs reserved.`)}><Plus size={15} />{queueFull ? 'Queue full' : !room ? 'Storage full' : 'Queue batch'}</button></div>;
      })}</div>}
      {current > 0 && b === 'warehouse' && <div className="storage-detail"><div><span>Warehouse space</span><strong>{used + reserved(game)} / {capacity(game)}</strong></div><Progress value={(used + reserved(game)) / capacity(game) * 100} label="Warehouse used and reserved capacity" /><span className="subtle">{reserved(game)} spaces reserved for work in progress</span><details className="inventory-trade"><summary>Manage inventory &amp; surplus</summary><p>Trade spare cargo for a small credit return. Contracts pay more.</p>{RESOURCES.map(r => { const quantity = Math.min(4, game.inventory[r]); return <div className="inventory-row" key={r}><PixelIcon name={r} size={22} /><span>{r}<strong>{game.inventory[r]}</strong></span><button className="button secondary small" disabled={!quantity} onClick={() => run({ type: 'sell', resource: r, quantity }, `Traded ${quantity} ${r} for ${quantity * SURPLUS_VALUE[r]} in-game credits.`)}>Sell {quantity || 4}<span className="sr-only"> {r}</span> · +{(quantity || 4) * SURPLUS_VALUE[r]}</button></div>; })}</details></div>}
      {current > 0 && b === 'depot' && <div className="depot-fleet">{VEHICLES.map(v => <div key={v.id}><Truck size={17} /><span>{v.name}<small>{v.capacity} units · {v.fee ? `${v.fee} credit fee` : 'No vehicle fee'}</small></span><span className="subtle">{current >= v.depot && isUnlocked(game, v.milestone) ? 'Available' : `Level ${v.depot}${v.milestone ? ` + ${v.milestone} blocks` : ''}`}</span></div>)}</div>}
    </section>;
  }

  function productionQueue() {
    return <section className="production-panel"><div className="section-top"><h2>Work in progress <span className="count">{game.jobs.length}</span></h2><Clock3 size={17} className="subtle" /></div>
      {!game.jobs.length ? <div className="empty compact-empty"><span className="empty-icon"><Package size={24} /></span><h3>A quiet moment in the yard.</h3><p>Gather a resource or queue a batch to get the wheels turning.</p></div> : <ul className="job-list">{game.jobs.map(j => <li key={j.id}><div className="job-heading"><span>{j.kind === 'build' ? <Hammer size={16} /> : <Package size={16} />}<strong>{j.title}</strong></span><span className="subtle">{j.start > now ? 'Queued' : remaining(j.end, now)}</span><button className="icon-button small-icon" aria-label={`Cancel ${j.title} and refund inputs`} onClick={() => run({ type: 'cancel', id: j.id }, 'Job cancelled. Inputs refunded.')}><X size={15} /></button></div><Progress value={(now - j.start) / (j.end - j.start) * 100} label={j.title} /><div className="job-meta"><span>{j.start > now ? `Starts in ${remaining(j.start, now)}` : 'In progress'}</span>{totalStock(j.output) > 0 && <CostLine cost={j.output} />}</div></li>)}</ul>}
    </section>;
  }

  function tradeBonus() {
    return <section className="trade-bonus"><div className="section-top"><h2>Neighborly trade</h2><span className="subtle">{game.tradeMix.length} / 3 cargo types</span></div><div className="trade-mix">{RESOURCES.map(r => <span className={game.tradeMix.includes(r) ? 'checked' : ''} key={r}><PixelIcon name={r} size={22} /><span>{r}</span>{game.tradeMix.includes(r) && <Check size={12} />}</span>)}</div><p>Deliver three different cargo types for +20 credits, +10 XP and +1 reputation. Then the mix starts again.</p></section>;
  }

  function shipmentsPanel() {
    return <section className="shipments-panel"><div className="section-top"><h2>On the road</h2><span className="badge neutral">{game.shipments.length} / {game.buildings.depot} slots</span></div><p className="subtle">Cargo leaves storage at dispatch. Collect a delivery to receive its reward and free the vehicle slot.</p>
      {!game.shipments.length ? <div className="empty"><span className="empty-icon"><Truck size={36} /></span><h3>The road is calling.</h3><p>Prepare an order on the contract board. Choose a route and load your first handcart.</p><button className="button primary" onClick={() => prepare(game.contracts[0])}>Prepare a shipment <ArrowRight size={16} /></button></div> : <div className="shipment-list">{game.shipments.map(sh => { const ready = sh.end <= now, route = ROUTES.find(r => r.id === sh.route)!, vehicle = VEHICLES.find(v => v.id === sh.vehicle)!; return <article className="shipment" key={sh.id}><div className="shipment-heading"><span className="truck-stamp"><Truck size={24} /></span><div><h3>{sh.contract.client}</h3><span className="subtle">{sh.contract.quantity} {sh.contract.resource} · {vehicle.name}</span></div><span className={`badge ${ready ? 'success' : 'neutral'}`}>{ready ? 'Arrived' : remaining(sh.end, now)}</span></div><div className="route-line"><span>Clover Commons</span><span className="route-dots" /><Flag size={15} /><span>{route.region}</span></div><Progress value={(now - sh.start) / (sh.end - sh.start) * 100} label={`${sh.contract.title} delivery`} /><div className="shipment-bottom"><span><PixelIcon name="credits" size={20} /><strong>+{sh.reward}</strong><span className="subtle"> · {sh.contract.xp} XP</span></span><button className={`button ${ready ? 'primary' : 'secondary'}`} disabled={!ready} onClick={() => run({ type: 'collect', id: sh.id }, `Delivery complete! +${sh.reward} credits, +${sh.contract.xp} XP, +${sh.contract.reputation} reputation.`)}>{ready ? 'Collect reward' : 'In transit'}{ready && <Check size={16} />}</button></div></article>; })}</div>}
    </section>;
  }

  function genesisPanel() {
    return <div className="genesis-content"><section className="chain-panel"><div className="section-top"><h2>A world built together</h2><span className={`badge ${fresh ? 'success' : 'neutral'}`}>{fresh ? 'Verified API state' : sync.status === 'loading' ? 'Checking…' : 'UNKNOWN'}</span></div><p>Settled hamster work on Squeekchain opens new places to trade. These thresholds are game rules, not official protocol milestones.</p>
      {fresh && sync.data ? <div className="core-stats"><div><span>Settled Squeek blocks</span><strong>{format(sync.data.core.blockHeight)}</strong></div><div><span>Settled through round</span><strong>{format(sync.data.core.settledThroughRound)}</strong></div><div><span>Cumulative settled work</span><strong>{format(sync.data.core.cumulativeWork)}</strong></div></div> : <div className="unknown-state"><ShieldCheck size={26} /><div><h3>{sync.status === 'loading' ? 'Checking the settled frontier…' : 'Global state: UNKNOWN'}</h3><p>{sync.reason || 'A fresh verified snapshot is unavailable.'} Starter content and previously earned unlocks remain playable.</p></div></div>}
      <div className="chain-details"><div><span>Network</span><strong>Ethereum Sepolia · 11155111</strong></div><div><span>Current source</span><a href={CORE_URL} target="_blank" rel="noreferrer">Squeekchain public Core API ↗</a></div><div><span>Last successful sync this session</span><strong>{lastGoodAt ? `${new Date(lastGoodAt).toLocaleString()}${fresh ? '' : ' (historical)'}` : 'None yet'}</strong></div><div><span>Last attempt</span><span>{attemptAt ? new Date(attemptAt).toLocaleString() : 'Not yet attempted'}</span></div>{fresh && sync.data && <div><span>Safe Ethereum block</span><strong>{format(sync.data.chain.safeThroughBlock)} · 12 confirmations</strong></div>}<div><span>Live / projected work</span><span>Not fetched. Never used for unlocks.</span></div></div>
      <details className="verification-details"><summary>How this state is verified</summary><p>The response is validated against the official Core JSON Schema (version 1). Its chain, Core proxy, implementation, runtime hash, storage layout, admin and governance identities must match the bundled official deployment record, revision 7.</p><p>This is verification of API-reported identities against a public record, not an independent Ethereum RPC proof. Current data expires after two minutes without a successful check; a safe block stalled for five minutes becomes unknown.</p><p className="address">SqueekCore: {EXPECTED_CORE}</p><div className="source-links"><a href={DEPLOYMENT_URL} target="_blank" rel="noreferrer">Official deployment record ↗</a><a href="https://docs.squeekchain.com/developers/api/" target="_blank" rel="noreferrer">API documentation ↗</a></div></details>
      <button className="button secondary" disabled={now < sync.nextAt || busySync.current} onClick={() => void syncCore()}><RotateCcw size={16} />{now < sync.nextAt ? `Sync in ${remaining(sync.nextAt, now)}` : 'Retry sync'}</button>
    </section><section className="milestones"><div className="section-top"><h2>Global milestones</h2><span className="subtle">{game.unlocked.length} / 4 earned locally</span></div>{MILESTONES.map(m => { const earned = game.unlocked.find(p => p.blocks === m.blocks); return <article className={`milestone ${earned ? 'earned' : ''}`} key={m.blocks}><span className="milestone-icon">{earned ? <Check size={20} /> : <Flag size={20} />}</span><div><h3>{m.name} <span>{format(m.blocks)} blocks</span></h3><p>{m.description}</p>{earned ? <details><summary>Unlocked from a settled snapshot</summary><p>Height {format(earned.height)}, round {format(earned.round)}, work {format(earned.work)}. Observed {new Date(earned.checkedAt).toLocaleString()}. This is saved unlock history, not current chain data.</p></details> : <span className="subtle">{fresh && sync.data ? `${format(sync.data.core.blockHeight)} / ${format(m.blocks)} settled` : 'Awaiting a fresh verified snapshot'}</span>}</div></article>; })}</section></div>;
  }

  const route = ROUTES.find(r => r.id === routeId)!, vehicle = VEHICLES.find(v => v.id === vehicleId)!;
  const dispatchError = pendingContract ? game.inventory[pendingContract.resource] < pendingContract.quantity ? `Need ${pendingContract.quantity - game.inventory[pendingContract.resource]} more ${pendingContract.resource}. Gather or produce them in your outpost.` : pendingContract.quantity > vehicle.capacity ? `This vehicle holds ${vehicle.capacity} units. Choose a larger vehicle.` : game.shipments.length >= game.buildings.depot ? 'All vehicle slots are occupied. Collect a delivery or upgrade the depot.' : game.credits < route.toll + vehicle.fee ? 'Not enough credits to cover the trip fees.' : '' : '';

  return <div className={`app-shell view-${view}`}>
    <a className="skip-link" href="#main">Skip to game</a>
    <header className="header"><a className="brand" href="#" onClick={() => setView('outpost')} aria-label="Squeek Logistics, return to outpost"><span className="brand-mark"><PixelIcon name="hamster" size={38} /></span><span className="brand-name">SQUEEK<span>LOGISTICS</span></span><span className="genesis-label">Genesis edition</span></a><div className="header-tools"><span className="save-status"><span className={`status-dot ${savedAt && !saveIssue ? '' : 'warning'}`} />{savedAt && !saveIssue ? 'Saved on this device' : 'Local save'}</span><button className="icon-button" onClick={() => setDialog('guide')} aria-label="Open field guide"><CircleHelp size={20} /></button><button className="icon-button" onClick={() => setSound(!sound)} aria-label={sound ? 'Mute game sounds' : 'Enable game sounds'} aria-pressed={sound}>{sound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button><button className="icon-button motion-control" onClick={() => setMotion(!motion)} aria-label={motion ? 'Pause world motion' : 'Resume world motion'} aria-pressed={motion}>{motion ? <Pause size={18} /> : <Play size={18} />}</button><button className="button secondary save-button" aria-label="Save & load" onClick={() => setDialog('save')}><Save size={16} /><span>Save & load</span></button></div></header>

    <div className="resource-bar" aria-label="Resources"><div className="resource credit-resource"><PixelIcon name="credits" size={30} /><span><small>Credits</small><strong>{format(game.credits)}</strong></span></div>{RESOURCES.map(r => <div className="resource" key={r}><PixelIcon name={r} size={28} /><span><small>{r.charAt(0).toUpperCase() + r.slice(1)}</small><strong>{format(game.inventory[r])}</strong></span></div>)}<div className="capacity-meter"><Warehouse size={17} /><span>{used} / {capacity(game)}</span><span className="subtle">Storage</span></div></div>
    {saveIssue && <div className="save-warning" role="alert">{saveIssue}<button className="text-button" onClick={() => setDialog('save')}>Open Save & load <ArrowRight size={14} /></button></div>}

    <div className="game-layout"><aside className="sidebar"><div className="outpost-level"><span className="level-medal">{level(game)}</span><div><strong>Logistics level {level(game)}</strong><span className="subtle">{level(game) === 10 ? 'Maximum level' : `${game.xp % 100} / 100 XP`}</span></div></div><Progress value={level(game) === 10 ? 100 : game.xp % 100} label={level(game) === 10 ? "Maximum logistics level reached" : "Progress to next logistics level"} />
      <nav aria-label="Game views" className="game-nav">{viewItems.map(item => <button key={item.id} className={view === item.id ? 'active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}><item.icon size={19} /><span>{item.name}</span>{item.id === 'shipments' && game.shipments.length > 0 && <span className="nav-count">{game.shipments.length}</span>}{item.id === 'genesis' && <span className={`status-dot ${fresh ? '' : 'warning'}`} />}</button>)}</nav>
      <div className="sidebar-regions"><h2>Your trading world</h2>{ROUTES.map((r, i) => <div key={r.id} className={isUnlocked(game, r.milestone) ? 'region open' : 'region'}><span className="region-number">0{i + 1}</span><div><strong>{r.region}</strong><small>{r.milestone ? isUnlocked(game, r.milestone) ? 'Route unlocked' : `${r.milestone} settled blocks` : 'Home region'}</small></div>{isUnlocked(game, r.milestone) && <Check size={14} />}</div>)}</div>
      <button className="chain-mini" onClick={() => setView('genesis')}><Globe2 size={20} /><span><strong>Squeekchain Genesis</strong><small>{fresh ? 'Sepolia · Core verified' : sync.status === 'loading' ? 'Checking Sepolia…' : 'Sepolia · UNKNOWN'}</small></span><ChevronRight size={15} /></button><div className="sidebar-note"><Leaf size={16} /><p>Little wheels.<br />Big deliveries.</p></div>
    </aside>

    <main id="main" className="main-game"><div className="page-heading"><div><h1>{view === 'outpost' ? 'Your little logistics empire.' : view === 'buildings' ? 'Room to grow.' : view === 'contracts' ? 'Good neighbors. Better business.' : view === 'shipments' ? 'Keep the wheels turning.' : 'One wheel. A wider world.'}</h1><p>{view === 'outpost' ? 'Gather. Make. Deliver. Do a little more.' : view === 'buildings' ? 'Build your outpost, one tiny industry at a time.' : view === 'contracts' ? 'Load a handcart. Make someone’s day.' : view === 'shipments' ? 'Good cargo. Smart routes. Happy neighbors.' : 'Real settled work. New places to go.'}</p></div><span className="reputation"><Flag size={16} /><strong>{game.reputation}</strong><span>Reputation</span></span></div>
      {view === 'outpost' && <>
        {!game.tutorialDismissed && <div className="tutorial-banner"><span className="tutorial-portrait"><PixelIcon name="hamster" size={32} /></span><div><strong>{guide.title}</strong><p>{guide.text}</p></div><span className="tutorial-step">{guide.done ? <Check size={16} /> : `${guide.step}/5`}</span><button className="icon-button small-icon" aria-label="Dismiss tutorial" onClick={() => run({ type: 'dismiss-tutorial' }, 'Tutorial hidden. The field guide is always available in the header.')}><X size={15} /></button></div>}
        <div className="gather-toolbar"><div className="crew-label"><span className={`status-dot ${fieldJob ? 'warning' : ''}`} /><span>{fieldJob ? `Crew returns in ${remaining(fieldJob.end, now)}` : 'Gathering crew ready'}</span></div><div className="gather-actions">{(['wood', 'stone', 'metal'] as const).map(r => <button key={r} className={`gather-button ${r === 'wood' && !game.gathered ? 'primary' : ''}`} disabled={!!fieldJob || used + reserved(game) + { wood: 4, stone: 3, metal: 2 }[r] > capacity(game)} onClick={() => run({ type: 'gather', resource: r }, `Crew sent to gather ${r}. No credit cost.`)}><PixelIcon name={r} size={22} /><span>Gather {r}<small>+{{ wood: 4, stone: 3, metal: 2 }[r]} · {{ wood: 5, stone: 6.5, metal: 8 }[r]}s</small></span><Plus size={14} /></button>)}</div>{used + reserved(game) + 2 > capacity(game) && <p className="hint">Not enough gathering space. Trade surplus, dispatch an order or upgrade the warehouse.</p>}</div>
        <World game={game} selected={selected} onSelect={selectBuilding} motion={motion} now={now} />
        <div className="workbench">{buildingPanel(selected)}{productionQueue()}</div>
      </>}
      {view === 'buildings' && <><div className="building-grid">{BUILDINGS.map(b => buildingPanel(b, true))}</div>{productionQueue()}</>}
      {view === 'shipments' && <>{shipmentsPanel()}{tradeBonus()}<section className="route-guide"><div className="section-top"><h2>Choose your road</h2><span className="subtle">Rewards before trip fees</span></div>{ROUTES.map(r => <div className={`route-option ${isUnlocked(game, r.milestone) ? '' : 'locked'}`} key={r.id}><span className="route-symbol"><Map size={19} /></span><div><h3>{r.name}</h3><p>{r.description}</p></div><span>{r.seconds}s<strong>×{r.multiplier} reward</strong></span><span className="subtle">{isUnlocked(game, r.milestone) ? r.toll ? `${r.toll} credit toll` : 'No toll' : `${r.milestone} blocks`}</span></div>)}</section></>}
      {view === 'genesis' && genesisPanel()}
      <div className={`feedback ${feedback.error ? 'error' : ''}`} role="status"><span>{feedback.error ? <CircleHelp size={16} /> : <Check size={16} />}{feedback.text}</span>{feedback.error && <button className="icon-button small-icon" aria-label="Dismiss message" onClick={() => notice('Ready when you are.')}><X size={15} /></button>}</div>
      <section className="activity"><div className="section-top"><h2>Yard notes</h2><span className="subtle">{game.deliveries} deliveries completed</span></div><ul>{game.log.slice(0, 3).map(entry => <li key={entry.id}><span className="activity-dot" /><span>{entry.text}</span><time dateTime={new Date(entry.at).toISOString()}>{humanTime(entry.at)}</time></li>)}</ul></section>
    </main>

    <aside className="right-sidebar"><section className="contract-board"><div className="section-top"><h2>Contract board</h2><span className="count">{game.contracts.length}</span></div><p className="subtle board-intro">The neighbors could use a hand.</p>{game.contracts.map((c, i) => <article className="contract" key={c.id}><div className="contract-meta"><span>Order {String(game.deliveries + i + 1).padStart(3, '0')}</span><span className={game.inventory[c.resource] >= c.quantity ? 'ready-text' : 'subtle'}>{game.inventory[c.resource] >= c.quantity ? 'Ready to load' : 'Needs cargo'}</span></div><h3>{c.title}</h3><p className="client">{c.client}</p><div className="contract-cargo"><span><PixelIcon name={c.resource} size={28} /><strong>{c.quantity} {c.resource}</strong></span><span className="subtle">{Math.min(game.inventory[c.resource], c.quantity)} / {c.quantity}</span></div><Progress value={game.inventory[c.resource] / c.quantity * 100} label={`${c.title} cargo ready`} /><div className="contract-reward"><span><PixelIcon name="credits" size={18} /><strong>+{c.credits}</strong></span><span>+{c.xp} XP</span><span>+{c.reputation} rep</span></div><button className={`button contract-button ${game.inventory[c.resource] >= c.quantity ? 'secondary' : 'quiet'}`} onClick={() => prepare(c)}>Prepare shipment <ArrowRight size={15} /></button></article>)}<div className="board-note"><RotateCcw size={13} /><span>New local orders appear after dispatch.</span></div></section>
      {game.shipments.length > 0 && <button className="shipment-shortcut" onClick={() => setView('shipments')}><Truck size={20} /><span><strong>{game.shipments.length} {game.shipments.length === 1 ? 'shipment' : 'shipments'}</strong><small>{game.shipments.some(sh => sh.end <= now) ? 'Delivery ready to collect' : 'On the road'}</small></span><ArrowRight size={16} /></button>}
      <section className="goals"><div className="section-top"><h2>Small steps, big plans</h2><span className="subtle">{completedGoals}/5</span></div><ul>{goals.map(g => <li className={g.current >= g.target ? 'complete' : ''} key={g.title}><span className="goal-check">{g.current >= g.target && <Check size={12} />}</span><span>{g.title}</span>{g.target > 1 && <span className="subtle">{Math.min(g.current, g.target)}/{g.target}</span>}</li>)}</ul></section>
      {tradeBonus()}
    </aside></div>
    <footer className="footer"><span>Squeek Logistics <span className="footer-version">v1.0</span></span><span>Single-player · Local saves · Sepolia testnet</span><p>In-game credits are off-chain points with no monetary value. No tokens, wallets or transactions.</p></footer>

    {dialog === 'guide' && <Modal title="The field guide" close={() => setDialog(null)} wide><div className="guide-intro"><PixelIcon name="hamster" size={48} /><div><h3>Welcome, outpost keeper.</h3><p>You have 120 credits, a warehouse and a handcart. Let’s turn that into a little logistics empire.</p></div></div><ol className="guide-steps"><li><strong>Gather your first cargo.</strong><p>Use the gathering buttons in Outpost. One free crew gathers 4 wood in 5s, 3 stone in 6.5s or 2 metal in 8s. Pending outputs reserve warehouse space. In the Warehouse, Manage inventory & surplus lets you sell spare cargo for a small credit return.</p></li><li><strong>Make your first delivery.</strong><p>Prepare a contract. Meadow lane is always open and has no fees. Choose a route and a vehicle, check the quote, then dispatch. Cargo is paid up front.</p></li><li><strong>Collect, reinvest, repeat.</strong><p>Collect arriving shipments in Shipments for credits, XP and reputation. Every 100 XP earns a logistics level. Deliver three different cargo types for a neighborly trade bonus: 20 credits, 10 XP and 1 reputation. Vehicles stay occupied until you collect.</p></li><li><strong>Build an industry.</strong><p>A sawmill costs 60 credits, 8 wood and 4 stone. Each production building queues up to three serial batches. Upgrades cut batch times by 20% per level. You can cancel queued work for a full refund if storage has room.</p></li><li><strong>Open a wider world.</strong><p>Verified settled SqueekCore blocks unlock routes and buildings at 100, 250, 500 and 1,000 blocks. Metalworks needs logistics level 2; Workshop needs level 3. Unknown or projected state earns no unlocks.</p></li></ol><div className="guide-note"><Save size={20} /><p>Saves live in this browser only. Timers continue while you are away, but no new work queues itself. Export a backup in Save & load. Credits have no monetary value.</p></div><button className="button primary" onClick={() => { setDialog(null); setView('outpost'); }}>Back to the outpost <ArrowRight size={16} /></button></Modal>}

    {dialog === 'save' && <Modal title="Save & load" close={() => { setDialog(null); setPendingImport(null); setImportError(''); }}><p>Your outpost saves automatically on this device. There is no account or cloud save. Export a backup to move between browsers.</p><div className="save-summary"><Save size={24} /><div><strong>{savedAt && !saveIssue ? 'Saved on this device' : 'Playing in memory'}</strong><span>{savedAt ? `Last saved ${humanTime(savedAt)}` : 'No successful save this session'}</span></div><span className="badge neutral">Save v1</span></div>{saveIssue && <p className="inline-error">{saveIssue}</p>}<div className="save-actions"><button className="button primary" onClick={download}><ArrowDownToLine size={17} />Export save</button><label className="button secondary file-control"><Upload size={17} />Import save<input aria-label="Import a Squeek Logistics JSON save" type="file" accept=".json,application/json" onChange={e => { void importSave(e.target.files?.[0]); e.target.value = ''; }} /></label></div>{importError && <p className="inline-error" role="alert">{importError}</p>}{pendingImport && <div className="import-confirm"><h3>Replace this outpost?</h3><p>The selected save has {pendingImport.credits} credits and {pendingImport.deliveries} completed deliveries. Importing replaces the current game.</p><div className="button-row"><button className="button primary" onClick={() => { setGame(pendingImport); gameRef.current = pendingImport; setPendingImport(null); setAllowSave(true); setSaveIssue(''); setDialog(null); notice('Save imported. Welcome back to the yard.'); }}>Replace with imported save</button><button className="button secondary" onClick={() => setPendingImport(null)}>Cancel</button></div></div>}<div className="reset-section"><h3>Start a new outpost</h3><p>This replaces all local progress. Export a backup first if you want to keep it.</p><label htmlFor="reset-confirm">Type RESET to confirm</label><input id="reset-confirm" value={resetText} onChange={e => setResetText(e.target.value)} autoComplete="off" placeholder="RESET" /><button className="button danger" disabled={resetText !== 'RESET'} onClick={reset}><RotateCcw size={16} />Reset this outpost</button></div></Modal>}

    {dialog === 'dispatch' && pendingContract && <Modal title="Prepare a shipment" close={() => setDialog(null)}><div className="dispatch-order"><span className="dispatch-crate"><PixelIcon name={pendingContract.resource} size={42} /></span><div><h3>{pendingContract.title}</h3><p>{pendingContract.quantity} {pendingContract.resource} for {pendingContract.client}</p></div></div><div className="form-field"><label htmlFor="route">Choose a route</label><select id="route" value={routeId} onChange={e => setRouteId(e.target.value as RouteId)}>{ROUTES.map(r => <option key={r.id} value={r.id} disabled={!isUnlocked(game, r.milestone)}>{r.name} · ×{r.multiplier} reward{isUnlocked(game, r.milestone) ? '' : ` · ${r.milestone} blocks required`}</option>)}</select><span className="hint">{route.description}</span></div><div className="form-field"><label htmlFor="vehicle">Choose a vehicle</label><select id="vehicle" value={vehicleId} onChange={e => setVehicleId(e.target.value as VehicleId)}>{VEHICLES.map(v => <option key={v.id} value={v.id} disabled={game.buildings.depot < v.depot || !isUnlocked(game, v.milestone)}>{v.name} · {v.capacity} units{game.buildings.depot < v.depot ? ` · depot level ${v.depot} required` : !isUnlocked(game, v.milestone) ? ` · ${v.milestone} blocks required` : ''}</option>)}</select></div><div className="dispatch-quote"><div><span>Cargo</span><strong>{pendingContract.quantity} / {vehicle.capacity} units</strong></div><div><span>Delivery time</span><strong>{Math.round(route.seconds * vehicle.speed)}s</strong></div><div><span>Trip fee · paid now</span><strong>{route.toll + vehicle.fee} credits</strong></div><div><span>Delivery reward</span><strong>{Math.round(pendingContract.credits * route.multiplier)} credits</strong></div><div className="quote-total"><span>Net credits</span><strong>+{Math.round(pendingContract.credits * route.multiplier) - route.toll - vehicle.fee}</strong></div></div><p className="hint">Cargo and trip fees leave at dispatch. Collect the reward after arrival. There is no loss risk or contract deadline.</p>{dispatchError && <p className="inline-error" role="status">{dispatchError}</p>}<button className="button primary full-width" disabled={!!dispatchError} onClick={() => { if (run({ type: 'dispatch', contract: pendingContract.id, route: routeId, vehicle: vehicleId }, `${vehicle.name} loaded. Delivery arrives in ${Math.round(route.seconds * vehicle.speed)} seconds.`)) { setDialog(null); setView('shipments'); } }}><Truck size={18} />Dispatch shipment <ArrowRight size={17} /></button><button className="text-button back-button" onClick={() => { setDialog(null); setView('outpost'); }}><ArrowLeft size={15} />Back to gathering</button></Modal>}
  </div>;
}
function BuildingIcon({ building }: { building: Building }) { const C = { warehouse: Warehouse, sawmill: Leaf, quarry: Package, metalworks: Factory, workshop: Hammer, depot: Truck }[building]; return <C size={23} />; }
