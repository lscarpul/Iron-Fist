'use strict';

// Nucleo comune di aviazione e marina: regioni strategiche, progetti (designer), produzione,
// e l'aggancio al ciclo di gioco. Lo stato vive in S.an; i campi per paese sono su C(code).
//
// Per non toccare game.js il modulo avvolge newGame(), tick() ed economy() al caricamento.
// Altri sistemi possono leggere:
//   anAirShare(regionId, owner)   quota di superiorità aerea (0..1) del lato di `owner`
//   anNavalShare(regionId, owner) quota di supremazia navale (0..1)
//   anIndustryMult(c)             moltiplicatore della produzione (bombardamenti, convogli)
//   anTechYear(c, 'air'|'naval')  anno tecnologico disponibile; la ricerca può impostare c.anTech = { air, naval }

const AN = {
  air: null, naval: null, ai: null, // riempiti da air.js / naval.js
};

// ---------- regioni strategiche ----------
const REGION_BW = 11, REGION_BH = 9, REGION_MIN = 10;

function buildRegions() {
  const T = S.tiles, N = T.length;
  const block = t => Math.floor(t.x / REGION_BW) + Math.floor(t.y / REGION_BH) * 100;
  const rof = new Int32Array(N).fill(-1);
  const regs = [];
  // terra: tutte le caselle di terra dello stesso blocco
  const landByBlock = new Map();
  for (const t of T) {
    if (!t.land) continue;
    const b = block(t);
    let r = landByBlock.get(b);
    if (!r) { r = { id: regs.length, sea: false, tiles: [] }; regs.push(r); landByBlock.set(b, r); }
    r.tiles.push(t.i); rof[t.i] = r.id;
  }
  // mare: componenti connesse dentro ogni blocco
  for (const t of T) {
    if (t.land || rof[t.i] >= 0) continue;
    const r = { id: regs.length, sea: true, tiles: [] };
    regs.push(r);
    const b = block(t), st = [t.i];
    rof[t.i] = r.id;
    while (st.length) {
      const u = st.pop();
      r.tiles.push(u);
      for (const v of T[u].nb) if (!T[v].land && rof[v] < 0 && block(T[v]) === b) { rof[v] = r.id; st.push(v); }
    }
  }
  // fondi le regioni troppo piccole nella vicina dello stesso tipo con il confine più lungo
  for (let pass = 0; pass < 3; pass++) {
    for (const r of regs) {
      if (r.dead || r.tiles.length >= REGION_MIN) continue;
      const shared = new Map();
      for (const u of r.tiles) for (const v of T[u].nb) {
        const o = rof[v];
        if (o !== r.id && o >= 0 && regs[o].sea === r.sea && !regs[o].dead) shared.set(o, (shared.get(o) || 0) + 1);
      }
      const best = [...shared].sort((a, b) => b[1] - a[1])[0];
      if (!best) continue;
      const into = regs[best[0]];
      for (const u of r.tiles) { into.tiles.push(u); rof[u] = into.id; }
      r.tiles = []; r.dead = true;
    }
  }
  // rinumera
  const alive = regs.filter(r => !r.dead);
  const remap = new Map(alive.map((r, i) => [r.id, i]));
  for (let i = 0; i < N; i++) rof[i] = remap.get(rof[i]);
  alive.forEach((r, i) => { r.id = i; });
  for (const r of alive) {
    let x = 0, y = 0;
    for (const u of r.tiles) { x += T[u].cx; y += T[u].cy; }
    x /= r.tiles.length; y /= r.tiles.length;
    // centro = la casella della regione più vicina al baricentro
    let best = r.tiles[0], bd = Infinity;
    for (const u of r.tiles) { const d = (T[u].cx - x) ** 2 + (T[u].cy - y) ** 2; if (d < bd) { bd = d; best = u; } }
    r.center = best; r.cx = T[best].cx; r.cy = T[best].cy;
    const nb = new Set();
    for (const u of r.tiles) for (const v of T[u].nb) if (rof[v] !== r.id) nb.add(rof[v]);
    r.nb = [...nb];
  }
  S.an.regions = alive;
  S.an.regionOf = rof;
  nameRegions();
}

function nameRegions() {
  const R = S.an.regions, T = S.tiles;
  // terra: paese prevalente + punto cardinale rispetto al baricentro del paese
  const cen = {};
  for (const t of T) if (t.land) {
    const a = cen[t.owner] || (cen[t.owner] = { x: 0, y: 0, n: 0 });
    a.x += t.cx; a.y += t.cy; a.n++;
  }
  const used = {};
  for (const r of R) {
    if (r.sea) continue;
    const cnt = {};
    for (const u of r.tiles) cnt[T[u].owner] = (cnt[T[u].owner] || 0) + 1;
    const own = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
    r.mainOwner = own;
    const c = cen[own], dx = r.cx - c.x / c.n, dy = r.cy - c.y / c.n;
    let dir = '';
    if (Math.hypot(dx, dy) > 40) {
      const a = Math.atan2(dy, dx) * 180 / Math.PI;
      dir = a > -45 && a <= 45 ? 'Est' : a > 45 && a <= 135 ? 'Sud' : a > -135 && a <= -45 ? 'Nord' : 'Ovest';
    }
    r.baseName = C(own).name + (dir ? ' ' + dir : '');
  }
  // mare: nome della zona nota più vicina
  for (const r of R) {
    if (!r.sea) continue;
    let best = null, bd = Infinity;
    for (const [name, ax, ay] of SEA_NAMES) {
      const [x, y] = hexCenter(ax * MAP_SCALE + 0.5, ay * MAP_SCALE + 0.5);
      const d = (x - r.cx) ** 2 + (y - r.cy) ** 2;
      if (d < bd) { bd = d; best = name; }
    }
    r.baseName = best;
  }
  for (const r of R) used[r.baseName] = (used[r.baseName] || 0) + 1;
  const seen = {};
  for (const r of R) {
    seen[r.baseName] = (seen[r.baseName] || 0) + 1;
    r.name = used[r.baseName] > 1 ? `${r.baseName} ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][seen[r.baseName]] || seen[r.baseName]}` : r.baseName;
  }
}

const regionOfTile = ti => S.an.regionOf[ti];
const regionById = id => S.an.regions[id];
// preposizioni articolate per i nomi delle zone di mare ("nel Mar Baltico", "nell'Atlantico")
function seaIn(rid, prep = 'nel') {
  const n = regionById(rid).name;
  const p = prep === 'nel' ? ['nell\'', 'nello ', 'nel '] : ['dell\'', 'dello ', 'del '];
  return (/^[AEIOU]/.test(n) ? p[0] : /^S[kc]/.test(n) ? p[1] : p[2]) + n;
}
function tileDistKm(a, b) {
  const ta = S.tiles[a], tb = S.tiles[b];
  return Math.hypot(ta.cx - tb.cx, ta.cy - tb.cy) / (HEX * SQ3) * KM_PER_HEX;
}
function regionDistKm(fromTile, rid) { return tileDistKm(fromTile, regionById(rid).center); }

// ---------- tecnologia e progetti ----------
function anTechYear(c, kind) {
  if (c.anTech && c.anTech[kind]) return c.anTech[kind];
  return dayDate(S.day).getUTCFullYear();
}
function genAvailable(c, kind, gen) { return TECH_YEARS[gen] <= anTechYear(c, kind); }
function moduleAvailable(c, kind, mod) { return !mod.year || mod.year <= anTechYear(c, kind); }

function applyMods(st, mod) {
  if (mod.add) for (const k in mod.add) st[k] = (st[k] || 0) + mod.add[k];
  if (mod.mult) for (const k in mod.mult) st[k] = (st[k] || 0) * mod.mult[k];
  st.cost += mod.cost || 0;
}
function airStats(role, gen, modules) {
  const st = { ...AIRFRAMES[role][gen] };
  for (const s of AIR_SLOTS[role]) applyMods(st, AIR_MODULES[modules[s.k] || 'none']);
  for (const k in st) st[k] = Math.max(0, Math.round(st[k] * 10) / 10);
  st.speed = Math.round(st.speed); st.range = Math.round(st.range);
  return st;
}
function shipStats(hull, gen, modules) {
  const st = { lAtk: 0, lPrc: 0, hAtk: 0, hPrc: 0, torp: 0, aa: 0, subAtk: 0, subDet: 0, vis: 0, subVis: 0, deck: 0, ...HULLS[hull].gens[gen] };
  for (const s of SHIP_SLOTS[hull]) applyMods(st, SHIP_MODULES[modules[s.k] || 'none']);
  for (const k in st) st[k] = Math.max(0, Math.round(st[k] * 10) / 10);
  st.cost = Math.round(st.cost);
  return st;
}

function newDesign(owner, kind, type, gen, modules, name) {
  const id = 'd' + (S.an.nextId++);
  const d = { id, owner, kind, type, gen, modules: { ...modules }, name, obsolete: false };
  d.stats = kind === 'air' ? airStats(type, gen, modules) : shipStats(type, gen, modules);
  S.an.designs[id] = d;
  return d;
}
const designOf = id => S.an.designs[id];

// progetto predefinito: per ogni slot il default dichiarato o il modulo più moderno disponibile
function defaultModules(c, kind, type) {
  const slots = kind === 'air' ? AIR_SLOTS[type] : SHIP_SLOTS[type];
  const MOD = kind === 'air' ? AIR_MODULES : SHIP_MODULES;
  const m = {};
  for (const s of slots) {
    if (s.def && moduleAvailable(c, kind, MOD[s.def])) { m[s.k] = s.def; continue; }
    const av = s.opts.filter(o => moduleAvailable(c, kind, MOD[o]));
    m[s.k] = av[av.length - 1];
  }
  return m;
}
function bestGen(c, kind) {
  let g = 0;
  for (let i = 0; i < TECH_YEARS.length; i++) if (genAvailable(c, kind, i)) g = i;
  return g;
}
function ensureDefaultDesign(c, kind, type) {
  const gen = bestGen(c, kind);
  const ex = Object.values(S.an.designs).find(d => d.owner === c.code && d.kind === kind && d.type === type && d.gen === gen && d.auto);
  if (ex) return ex;
  const base = kind === 'air' ? AIR_ROLES[type].short : HULLS[type].name;
  const d = newDesign(c.code, kind, type, gen, defaultModules(c, kind, type), `${base} mod. ${TECH_YEARS[gen]}`);
  d.auto = true;
  return d;
}
function designsOf(code, kind, type) {
  return Object.values(S.an.designs).filter(d => d.owner === code && d.kind === kind && (!type || d.type === type));
}

// ---------- industria ----------
function anIndustryMult(c) {
  let m = 1 - (c.indDamage || 0);
  if (c.convoyNeed > 0 && c.convoys < c.convoyNeed) m *= 1 - 0.25 * (1 - c.convoys / c.convoyNeed);
  return m;
}
function airFactoriesUsed(c) {
  let n = 0;
  for (const l of c.airLines || []) n += l.factories;
  return n;
}
function docksUsed(c) {
  let n = 0;
  for (const l of c.navLines || []) n += l.docks;
  return n;
}

// ---------- inizializzazione ----------
function initAirNaval() {
  S.an = { regions: [], regionOf: null, designs: {}, nextId: 1, wings: [], fleets: [], battles: [], airPow: [], navPow: [], weekly: {}, recentAir: [] };
  buildRegions();
  for (const code in S.countries) {
    const c = S.countries[code];
    const nv = START_NAVY[code] || {};
    c.dock = nv.docks || 0;
    c.convoys = nv.convoys || 0;
    c.convoyNeed = 0; c.convoysLost = 0; c.indDamage = 0;
    c.airLines = []; c.navLines = []; c.airStock = {};
    c.ports = portsOf(code);
  }
  AN.air.init();
  AN.naval.init();
}

function portsOf(code) {
  return S.tiles.filter(t => t.land && t.coastal && t.ctrl === code && t.nb.some(n => !S.tiles[n].land)).map(t => t.i);
}
// regione di mare adiacente a un porto (quella con più caselle confinanti)
function portSeaRegion(ti) {
  const cnt = new Map();
  for (const n of S.tiles[ti].nb) if (!S.tiles[n].land) { const r = regionOfTile(n); cnt.set(r, (cnt.get(r) || 0) + 1); }
  const b = [...cnt].sort((a, b) => b[1] - a[1])[0];
  return b ? b[0] : -1;
}

// ---------- produzione aerea e navale ----------
function anProduction(c) {
  const mult = anIndustryMult(c);
  // linee aeree: efficienza che cresce in fretta all'inizio e rallenta verso il tetto
  const cap = c.effCap != null ? c.effCap : AIR_EFF_CAP;
  for (const l of c.airLines) {
    const d = designOf(l.design);
    if (!d || !l.factories) continue;
    l.eff = Math.min(cap, l.eff + 0.001 / Math.max(0.05, l.eff));
    l.prog += l.factories * FACTORY_OUTPUT * l.eff * mult * (1 + (c.eqBonus || 0) * 0.5);
    const n = Math.floor(l.prog / d.stats.cost);
    if (n > 0) { l.prog -= n * d.stats.cost; c.airStock[d.id] = (c.airStock[d.id] || 0) + n; l.built = (l.built || 0) + n; }
  }
  // linee navali: niente efficienza (come in HOI4), un'unità alla volta per linea
  for (let i = c.navLines.length - 1; i >= 0; i--) {
    const l = c.navLines[i];
    if (!l.docks) continue;
    const cost = l.design === 'convoy' ? CONVOY_COST : designOf(l.design).stats.cost;
    l.prog += l.docks * DOCKYARD_OUTPUT * mult;
    while (l.prog >= cost && l.left > 0) {
      l.prog -= cost; l.left--;
      if (l.design === 'convoy') c.convoys++;
      else AN.naval.launchShip(c, designOf(l.design));
    }
    if (l.left <= 0) c.navLines.splice(i, 1);
  }
  // riparazione dei danni da bombardamento
  if (c.indDamage > 0) c.indDamage = Math.max(0, c.indDamage - 0.005);
}

function setAirLineDesign(c, line, designId) {
  if (line.design === designId) return;
  const ret = c.effRetention != null ? c.effRetention : AIR_EFF_RETAIN;
  const od = designOf(line.design), nd = designOf(designId);
  // stesso ruolo: si conserva parte dell'efficienza; ruolo diverso: si riparte da zero
  line.eff = od && nd && od.type === nd.type ? Math.max(AIR_EFF_START, line.eff * ret) : AIR_EFF_START;
  line.design = designId; line.prog = 0;
}
function addAirLine(c, designId, factories) {
  const free = c.mil - airFactoriesUsed(c);
  const f = Math.max(0, Math.min(free, factories));
  const l = { id: S.an.nextId++, design: designId, factories: f, eff: AIR_EFF_START, prog: 0 };
  c.airLines.push(l);
  return l;
}
function addNavLine(c, designId, docks, count) {
  const free = c.dock - docksUsed(c);
  const l = { id: S.an.nextId++, design: designId, docks: Math.max(0, Math.min(free, docks, MAX_DOCKS_PER_LINE)), prog: 0, left: count };
  c.navLines.push(l);
  return l;
}

// ---------- aggancio al ciclo di gioco ----------
function anDailyStep() {
  if (!S.an) return;
  for (const code in S.countries) {
    const c = S.countries[code];
    if (!c.alive) continue;
    c.ports = (S.day % 5 === 0) ? portsOf(code) : c.ports;
    // le fabbriche assegnate possono superare quelle disponibili (bombardamenti, annessioni al contrario)
    let over = airFactoriesUsed(c) - c.mil;
    for (let i = c.airLines.length - 1; i >= 0 && over > 0; i--) { const t = Math.min(over, c.airLines[i].factories); c.airLines[i].factories -= t; over -= t; }
    over = docksUsed(c) - c.dock;
    for (let i = c.navLines.length - 1; i >= 0 && over > 0; i--) { const t = Math.min(over, c.navLines[i].docks); c.navLines[i].docks -= t; over -= t; }
    anProduction(c);
  }
  AN.air.step();
  AN.naval.step();
  for (const code in S.countries) {
    const c = S.countries[code];
    if (c.alive && code !== S.player && (S.day + c.slot) % 5 === 0) { AN.air.ai(c); AN.naval.ai(c); }
  }
}

(function hookGame() {
  const _newGame = newGame;
  newGame = function (player) { const r = _newGame(player); initAirNaval(); return r; };
  const _tick = tick;
  tick = function () {
    const d0 = S.day;
    _tick();
    if (S.day !== d0 && !S.over) anDailyStep();
  };
  // le fabbriche militari dedicate agli aerei non producono equipaggiamento terrestre,
  // e bombardamenti e carenza di convogli riducono equipaggiamento e cantieri
  const _economy = economy;
  economy = function (c) {
    const eq0 = c.equipment, cons = c.construction[0], p0 = cons ? cons.prog : 0;
    _economy(c);
    if (!S.an || typeof Econ !== 'undefined') return;
    const made = c.equipment - eq0;
    if (made > 0 && c.mil > 0) c.equipment = eq0 + made * Math.max(0, c.mil - airFactoriesUsed(c)) / c.mil * anIndustryMult(c);
    if (cons && c.construction[0] === cons) cons.prog = p0 + (cons.prog - p0) * anIndustryMult(c);
  };
})();
