'use strict';

let S = null; // stato della partita
const DAY_MS = 86400000;
const START_TS = Date.UTC(1936, 0, 1);
const END_TS = Date.UTC(1946, 0, 1);
const SEA_COST = 2.2;
const SEA_SPEED = 0.5;
for (const ev of EVENTS) ev.day = Math.round((Date.parse(ev.date) - START_TS) / DAY_MS);

// ---------- utilità di stato ----------
const C = code => S.countries[code];
const dayDate = d => new Date(START_TS + d * DAY_MS);
function dateLabel(d) {
  const dt = dayDate(d);
  return `${dt.getUTCDate()} ${MONTHS_IT[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}
function allied(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const fa = C(a).faction;
  return !!fa && fa === C(b).faction;
}
const warKey = (a, b) => a < b ? a + b : b + a;
function atWar(a, b) { return !!a && !!b && a !== b && S.wars.has(warKey(a, b)); }
function enemiesOf(code) {
  const r = [];
  for (const k in S.countries) if (k !== code && S.countries[k].alive && atWar(code, k)) r.push(k);
  return r;
}
function membersOf(code) {
  const c = C(code);
  return c.faction ? S.factions[c.faction].members.slice() : [code];
}
function log(msg, cls = '') {
  S.log.unshift({ day: S.day, msg, cls });
  if (S.log.length > 120) S.log.pop();
  UI.dirty = true;
}
const involvesPlayer = (...codes) => codes.some(c => c === S.player || allied(c, S.player));

// ---------- divisioni ----------
function addDivToTile(d) {
  let a = S.byTile.get(d.tile);
  if (!a) { a = []; S.byTile.set(d.tile, a); }
  a.push(d);
}
function remDivFromTile(d) {
  const a = S.byTile.get(d.tile);
  if (!a) return;
  const i = a.indexOf(d);
  if (i >= 0) a.splice(i, 1);
  if (!a.length) S.byTile.delete(d.tile);
}
function moveDiv(d, to) { remDivFromTile(d); d.tile = to; addDivToTile(d); }
function createDiv(owner, type, tile, tpl) {
  const c = C(owner);
  const d = { id: S.nextId++, num: ++c.divCounter, owner, type, tile, str: 1, org: 0, path: [], prog: 0, combat: false, dead: false };
  initDivLand(d, tpl ?? type);
  S.divs.push(d);
  addDivToTile(d);
  return d;
}
function destroyDiv(d) {
  if (d.dead) return;
  remDivFromTile(d);
  d.dead = true;
  d.path = [];
}
function divName(d) { return `${d.num}ª ${tplOf(d).name}`; }
function hasHostile(ti, owner) {
  const a = S.byTile.get(ti);
  if (!a) return false;
  for (const d of a) if (!d.dead && atWar(d.owner, owner)) return true;
  return false;
}
// speedOf, atkValue, defValueOf, defValue: vedi land/combat.js

// ---------- percorsi ----------
function passable(owner, t, friendlyOnly) {
  if (!t.land) return true;
  if (allied(t.ctrl, owner)) return true;
  return !friendlyOnly && atWar(t.ctrl, owner);
}
const stepCost = t => t.land ? TERRAIN[t.terrain].cost : SEA_COST;

function dijkstra(owner, src, target = -1, friendlyOnly = false, maxCost = Infinity) {
  const N = S.tiles.length;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const h = new MinHeap();
  dist[src] = 0; h.push(src, 0);
  while (h.size) {
    const u = h.pop();
    const du = h.lastK;
    if (du > dist[u]) continue;
    if (u === target || du > maxCost) break;
    for (const v of S.tiles[u].nb) {
      const tv = S.tiles[v];
      if (!passable(owner, tv, friendlyOnly && v !== target)) continue;
      const nd = du + stepCost(tv);
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; h.push(v, nd); }
    }
  }
  return { dist, prev };
}
function buildPath(prev, src, dst) {
  const p = [];
  let u = dst;
  while (u !== src) {
    if (u < 0) return null;
    p.push(u); u = prev[u];
  }
  return p.reverse();
}
function findPath(owner, src, dst) {
  if (src === dst) return [];
  const { dist, prev } = dijkstra(owner, src, dst);
  if (!isFinite(dist[dst])) return null;
  return buildPath(prev, src, dst);
}

// ---------- nuova partita ----------
function newGame(player) {
  const map = buildMap(1936);
  S = {
    day: 0, speed: 2, paused: true, over: false,
    tiles: map.tiles, W: map.W, H: map.H,
    countries: {}, factions: {}, wars: new Set(), guarantees: [],
    divs: [], byTile: new Map(), nextId: 1, player, fired: new Set(), log: [],
    battles: [], mapDirty: true,
  };
  for (const id in FACTION_DEFS) S.factions[id] = { id, name: FACTION_DEFS[id].name, leader: FACTION_DEFS[id].leader, members: [] };
  let slot = 0;
  for (const code in COUNTRY_DEFS) {
    const def = COUNTRY_DEFS[code];
    const c = {
      code, name: def.name, color: def.color, major: !!def.major, aggro: def.aggro,
      civ: def.civ, mil: def.mil, manpower: 0, equipment: def.mil * 300 + 2000, pp: 50, ppGain: 1.5,
      eqBonus: 0, atkBonus: 0, defBonus: 0, speedBonus: 0, mpBonus: 0, recBonus: 0,
      armorTech: !!def.armor, focus: null, focusDays: 0, done: new Set(),
      construction: [], training: [], faction: null, alive: true,
      capital: map.capitals[code], tiles: 0, slot: slot++ % 3, divCounter: 0,
    };
    S.countries[code] = c;
    if (def.faction) { c.faction = def.faction; S.factions[def.faction].members.push(code); }
  }
  countTiles();
  for (const code in S.countries) { initLandCountry(S.countries[code]); initCommand(S.countries[code]); }
  landInitMap();
  for (const code in S.countries) {
    const c = S.countries[code], def = COUNTRY_DEFS[code];
    c.manpower = c.tiles * 1000 + c.civ * 3000;
    // divisioni iniziali sparse sul territorio, ordinate per distanza dalla capitale
    const { dist } = dijkstra(code, c.capital, -1, true);
    const own = S.tiles.filter(t => t.owner === code).sort((a, b) => dist[a.i] - dist[b.i]);
    const total = def.inf + def.arm;
    for (let k = 0; k < total; k++) {
      const t = own[Math.floor(k * own.length / total)];
      createDiv(code, k < def.arm ? 'arm' : 'inf', t.i);
    }
    c.trucks = c.major ? 600 + def.mil * 60 : 80 + def.mil * 20;
    c.motorHubs = [];
    c.autoMotor = code !== player;
    autoArmies(c);
  }
  logisticsStep();
  log(`Inizia la partita: guidi ${C(player).name}. Il mondo è in pace... per ora.`, 'good');
  return S;
}

function countTiles() {
  for (const k in S.countries) S.countries[k].tiles = 0;
  for (const t of S.tiles) if (t.land) S.countries[t.owner].tiles++;
}

// ---------- ciclo giornaliero ----------
function tick() {
  if (S.over) return;
  S.day++;
  if (START_TS + S.day * DAY_MS >= END_TS) { endGame('time'); return; }
  processEvents();
  countTiles();
  for (const k in S.countries) if (S.countries[k].alive) economy(S.countries[k]);
  logisticsStep();
  for (const k in S.countries) if (S.countries[k].alive) commandStep(S.countries[k]);
  militaryStep();
  for (const k in S.countries) {
    const c = S.countries[k];
    if (c.alive && k !== S.player && (S.day + c.slot) % 3 === 0) aiThink(c);
  }
  checkCapitulations();
  S.divs = S.divs.filter(d => !d.dead);
  UI.dirty = true;
}

function factoryCap(c) { return Math.floor(c.tiles * 0.45) + 12; }

function economy(c) {
  c.pp = Math.min(999, c.pp + c.ppGain);
  c.manpower += c.tiles * 12 * (1 + c.mpBonus);
  c.equipment += c.mil * 3 * (1 + c.eqBonus);
  const isP = c.code === S.player;
  if (c.construction.length) {
    const j = c.construction[0];
    j.prog += Math.max(1, c.civ) * 0.15;
    if (j.prog >= j.cost) {
      c.construction.shift();
      if (!landBuildDone(c, j)) {
        c[j.type]++;
        if (isP) log(`Completata una nuova fabbrica ${j.type === 'civ' ? 'civile' : 'militare'}.`, 'good');
      }
    }
  }
  for (let i = c.training.length - 1; i >= 0; i--) {
    const tr = c.training[i];
    if (--tr.days > 0) continue;
    c.training.splice(i, 1);
    const tile = spawnTile(c);
    if (tile >= 0) {
      const d = createDiv(c.code, tr.type, tile, tr.tpl);
      autoArmies(c);
      if (isP) log(`${divName(d)} è pronta per il combattimento.`, 'good');
    }
  }
  if (c.focus) {
    if (--c.focusDays <= 0) {
      const f = FOCUS_BY_ID[c.focus];
      f.apply(c);
      c.done.add(f.id);
      c.focus = null;
      if (isP) log(`Focus nazionale completato: ${f.name}.`, 'good');
    }
  }
}

function spawnTile(c) {
  if (S.tiles[c.capital].ctrl === c.code) return c.capital;
  const t = S.tiles.find(t => t.owner === c.code && t.ctrl === c.code);
  return t ? t.i : -1;
}

// ---------- azioni economiche (giocatore e IA) ----------
function canBuild(c) { return c.civ + c.mil + c.construction.length < factoryCap(c); }
function queueBuild(c, type) {
  if (!canBuild(c) || c.construction.length >= 5) return false;
  c.construction.push({ type, prog: 0, cost: BUILD_COST[type] });
  return true;
}
function focusAvailable(c, f) {
  if (c.done.has(f.id) || c.focus === f.id) return false;
  if (f.req && !f.req.every(r => c.done.has(r) || (r === 'tank' && c.armorTech))) return false;
  return f.avail ? f.avail(c) : true;
}
function startFocus(c, id) {
  const f = FOCUS_BY_ID[id];
  if (c.focus || !focusAvailable(c, f)) return false;
  c.focus = id; c.focusDays = f.days;
  return true;
}

// ---------- movimento e combattimento: militaryStep e resolveCombat in land/combat.js ----------
function occupy(t, owner) {
  if (t.ctrl === owner || !atWar(t.ctrl, owner)) return;
  // liberazione di un territorio alleato
  t.ctrl = (allied(t.owner, owner) && C(t.owner).alive) ? t.owner : owner;
  S.mapDirty = true;
}

function retreat(d) {
  const t = S.tiles[d.tile];
  let best = -1, bs = -Infinity;
  for (const n of t.nb) {
    const tn = S.tiles[n];
    if (!tn.land || !allied(tn.ctrl, d.owner) || hasHostile(n, d.owner)) continue;
    let s = Math.random();
    for (const m of tn.nb) if (S.tiles[m].land && atWar(S.tiles[m].ctrl, d.owner)) s -= 1;
    if (s > bs) { bs = s; best = n; }
  }
  if (best < 0) {
    destroyDiv(d);
    if (d.owner === S.player) log(`${divName(d)} è stata accerchiata e distrutta!`, 'bad');
    return;
  }
  moveDiv(d, best);
  d.path = []; d.prog = 0; d.org = 0;
}

function returnToLand(d) {
  const { dist, prev } = dijkstra(d.owner, d.tile, -1, true, 40);
  let best = -1, bd = Infinity;
  for (let i = 0; i < dist.length; i++) {
    const t = S.tiles[i];
    if (t.land && dist[i] < bd && allied(t.ctrl, d.owner)) { bd = dist[i]; best = i; }
  }
  if (best >= 0) d.path = buildPath(prev, d.tile, best) || [];
  else destroyDiv(d);
}

// ---------- diplomazia ----------
function declareWar(a, b) {
  if (atWar(a, b) || allied(a, b)) return;
  const defenders = new Set(membersOf(b));
  for (const g of S.guarantees) if (g.to === b && C(g.by).alive) membersOf(g.by).forEach(x => defenders.add(x));
  S.guarantees = S.guarantees.filter(g => !(g.by === a && g.to === b));
  for (const y of defenders) {
    if (y === a || allied(a, y) || !C(y).alive) continue;
    S.wars.add(warKey(a, y));
  }
  const cls = involvesPlayer(a, ...defenders) ? 'bad' : '';
  log(`${C(a).name} dichiara guerra a ${C(b).name}!`, cls);
  const joined = [...defenders].filter(y => y !== b && atWar(a, y));
  if (joined.length) log(`${joined.map(y => C(y).name).join(', ')} entra${joined.length > 1 ? 'no' : ''} in guerra in difesa di ${C(b).name}.`, cls);
  S.mapDirty = true;
}

function joinFaction(code, fid) {
  const c = C(code);
  if (c.faction) leaveFaction(code);
  c.faction = fid;
  S.factions[fid].members.push(code);
  log(`${c.name} entra nella fazione ${S.factions[fid].name}.`, involvesPlayer(code) ? 'good' : '');
  S.mapDirty = true;
}
function leaveFaction(code) {
  const c = C(code);
  const f = S.factions[c.faction];
  if (!f) return;
  f.members = f.members.filter(m => m !== code);
  if (f.leader === code) f.leader = f.members[0] || null;
  if (!f.members.length) delete S.factions[f.id];
  c.faction = null;
}
function createFaction(code) {
  const id = 'f_' + code;
  S.factions[id] = { id, name: `Patto di ${C(code).name}`, leader: code, members: [] };
  joinFaction(code, id);
}
function guarantee(by, to) {
  if (S.guarantees.some(g => g.by === by && g.to === to)) return;
  S.guarantees.push({ by, to });
  log(`${C(by).name} garantisce l'indipendenza di ${C(to).name}.`, involvesPlayer(by, to) ? 'good' : '');
}

function annex(actor, target) {
  const a = C(actor), b = C(target);
  for (const t of S.tiles) {
    if (t.owner === target) { t.owner = actor; if (t.ctrl === target) t.ctrl = actor; }
    else if (t.ctrl === target) t.ctrl = t.owner;
  }
  a.civ += b.civ; a.mil += b.mil;
  a.equipment += b.equipment * 0.5; a.manpower += b.manpower * 0.5;
  for (const d of S.divs) if (d.owner === target && !d.dead) { d.owner = actor; d.num = ++a.divCounter; d.path = []; d.tpl = (resolveTpl(a, d.type) || a.templates[0]).id; d.army = null; invalidateLand(d); }
  autoArmies(a);
  killCountry(target);
  log(`${a.name} ha annesso ${b.name}.`, involvesPlayer(actor, target) ? 'bad' : '');
  if (target === S.player) endGame('annexed');
}

function killCountry(code) {
  const c = C(code);
  c.alive = false;
  c.construction = []; c.training = []; c.focus = null;
  if (c.faction) leaveFaction(code);
  for (const k of [...S.wars]) if (k.includes(code)) S.wars.delete(k);
  S.guarantees = S.guarantees.filter(g => g.by !== code && g.to !== code);
  S.mapDirty = true;
}

function checkCapitulations() {
  const tot = {}, held = {};
  for (const t of S.tiles) {
    if (!t.land) continue;
    const w = 1 + t.vp;
    tot[t.owner] = (tot[t.owner] || 0) + w;
    if (allied(t.ctrl, t.owner)) held[t.owner] = (held[t.owner] || 0) + w;
  }
  for (const code in S.countries) {
    const c = S.countries[code];
    if (!c.alive || !tot[code] || !enemiesOf(code).length) continue;
    const ratio = (held[code] || 0) / tot[code];
    const capLost = !allied(S.tiles[c.capital].ctrl, code);
    if (ratio < 0.33 || (capLost && ratio < 0.55)) capitulate(code);
  }
}

function capitulate(code) {
  const c = C(code);
  const enemies = new Set(enemiesOf(code));
  const occ = {};
  for (const t of S.tiles) if (t.owner === code && enemies.has(t.ctrl)) occ[t.ctrl] = (occ[t.ctrl] || 0) + 1;
  const main = Object.entries(occ).sort((a, b) => b[1] - a[1])[0]?.[0] || [...enemies][0];
  if (!main) return;
  for (const t of S.tiles) {
    if (t.owner === code) {
      if (enemies.has(t.ctrl)) t.owner = t.ctrl;
      else t.owner = t.ctrl = main;
    } else if (t.ctrl === code) {
      t.ctrl = C(t.owner).alive ? t.owner : main;
    }
  }
  const m = C(main);
  m.civ += Math.round(c.civ * 0.4); m.mil += Math.round(c.mil * 0.4);
  for (const d of S.divs) if (d.owner === code) destroyDiv(d);
  killCountry(code);
  log(`${c.name} ha capitolato! ${m.name} ne prende il controllo.`, involvesPlayer(code, main) ? (allied(main, S.player) ? 'good' : 'bad') : 'big');
  // le divisioni rimaste in territorio ora neutrale tornano a casa
  for (const d of S.divs) {
    if (d.dead) continue;
    const t = S.tiles[d.tile];
    if (t.land && !allied(t.ctrl, d.owner) && !atWar(t.ctrl, d.owner)) {
      const home = spawnTile(C(d.owner));
      if (home >= 0) { moveDiv(d, home); d.path = []; } else destroyDiv(d);
    }
  }
  if (code === S.player) endGame('capitulated');
}

// ---------- eventi ----------
function processEvents() {
  EVENTS.forEach((ev, i) => {
    if (ev.day !== S.day || S.fired.has(i)) return;
    S.fired.add(i);
    runEvent(ev);
  });
}

function runEvent(ev) {
  const a = C(ev.actor);
  if (!a.alive) return;
  const tg = ev.target ? C(ev.target) : null;
  if (tg && !tg.alive) return;
  const isActor = ev.actor === S.player, isTarget = ev.target === S.player;
  switch (ev.type) {
    case 'annex':
      if (atWar(ev.actor, ev.target) || enemiesOf(ev.target).length) return;
      if (isActor) UI.ask(ev.title, `${ev.text} Vuoi procedere con l'annessione di ${tg.name}?`,
        [{ label: 'Annetti', fn: () => annex(ev.actor, ev.target) }, { label: 'Rinuncia' }]);
      else if (isTarget) UI.ask(ev.title, `${a.name} pretende l'annessione del tuo paese. Se rifiuti sarà la guerra.`,
        [{ label: 'Rifiuta: guerra!', fn: () => declareWar(ev.actor, ev.target) }, { label: 'Accetta (fine partita)', fn: () => annex(ev.actor, ev.target) }]);
      else annex(ev.actor, ev.target);
      break;
    case 'war':
      if (atWar(ev.actor, ev.target) || allied(ev.actor, ev.target)) return;
      if (isActor) UI.ask(ev.title, `È il momento previsto dalla storia: dichiarare guerra a ${tg.name}?`,
        [{ label: 'Dichiara guerra', fn: () => declareWar(ev.actor, ev.target) }, { label: 'Non ora' }]);
      else declareWar(ev.actor, ev.target);
      break;
    case 'join':
      if (a.faction || !S.factions[ev.faction]) return;
      if (S.factions[ev.faction].members.some(m => atWar(m, ev.actor))) return;
      if (isActor) UI.ask(ev.title, `${S.factions[ev.faction].name} ti invita a entrare nella fazione. Accetti?`,
        [{ label: 'Entra', fn: () => joinFaction(ev.actor, ev.faction) }, { label: 'Rifiuta' }]);
      else joinFaction(ev.actor, ev.faction);
      break;
    case 'guarantee':
      if (isActor) UI.ask(ev.title, `Vuoi garantire l'indipendenza di ${tg.name}? Se verrà attaccata entrerai in guerra.`,
        [{ label: 'Garantisci', fn: () => guarantee(ev.actor, ev.target) }, { label: 'No' }]);
      else guarantee(ev.actor, ev.target);
      break;
  }
}

// ---------- azioni del giocatore ----------
const PP_COST = { war: 100, guarantee: 25, faction: 50, create: 80 };
function playerSpend(cost) {
  const p = C(S.player);
  if (p.pp < cost) { log(`Potere politico insufficiente (servono ${cost}).`, 'warn'); return false; }
  p.pp -= cost;
  return true;
}
function playerDeclareWar(target) {
  if (!playerSpend(PP_COST.war)) return;
  declareWar(S.player, target);
}
function playerGuarantee(target) {
  if (!playerSpend(PP_COST.guarantee)) return;
  guarantee(S.player, target);
}
function playerCreateFaction() {
  if (C(S.player).faction || !playerSpend(PP_COST.create)) return;
  createFaction(S.player);
}
function playerInvite(target) {
  const p = C(S.player), t = C(target);
  if (!p.faction || t.faction || atWar(S.player, target) || !playerSpend(PP_COST.faction)) return;
  const sharedEnemy = enemiesOf(target).some(e => atWar(e, S.player));
  if (sharedEnemy || Math.random() < (t.major ? 0.15 : 0.4)) joinFaction(target, p.faction);
  else log(`${t.name} ha rifiutato l'invito nella fazione.`, 'warn');
}
function playerAskJoin(target) {
  const p = C(S.player), f = S.factions[C(target).faction];
  if (p.faction || !f || f.members.some(m => atWar(m, S.player)) || !playerSpend(PP_COST.faction)) return;
  if (Math.random() < (p.major ? 0.4 : 0.7)) joinFaction(S.player, f.id);
  else log(`${f.name} ha respinto la tua richiesta di adesione.`, 'warn');
}

function orderMove(divs, dest) {
  const t = S.tiles[dest];
  if (!t.land) return;
  let ok = 0, fail = 0;
  for (const d of divs) {
    if (d.dead) continue;
    const p = findPath(d.owner, d.tile, dest);
    if (p === null) { fail++; continue; }
    // mantieni l'avanzamento se il primo passo è lo stesso
    if (!(d.path.length && p.length && d.path[0] === p[0])) d.prog = 0;
    d.path = p; ok++;
  }
  if (fail) log(`${fail} divisione/i non possono raggiungere quella destinazione (territorio neutrale?).`, 'warn');
  return ok;
}

function endGame(reason) {
  if (S.over) return;
  S.over = true;
  S.paused = true;
  UI.gameOver(reason);
}
