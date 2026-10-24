'use strict';
// Modelli di divisione (Division Designer), progettista carri e calcolo delle statistiche.

const LAND_HANDLES_PLANNING = true; // research.js non aggiorna d.ent / d.plan: lo fa il combattimento terrestre

// ---------- esperienza dell'esercito ----------
function armyXP(c) { c.xp = c.xp || { army: 0, air: 0, navy: 0 }; return c.xp.army; }
function addArmyXP(c, v) { c.xp = c.xp || { army: 0, air: 0, navy: 0 }; c.xp.army = Math.max(0, Math.min(500, c.xp.army + v)); }

// ---------- disponibilità tecnologica ----------
function curYear() { return dayDate(S.day).getUTCFullYear(); }
function techOk(c, item) {
  if (item.tech && typeof hasTech === 'function') return hasTech(c, item.tech) || (item.year != null && curYear() >= item.year + 2);
  return item.year == null || curYear() >= item.year;
}

// ---------- progettista carri ----------
function tankStats(ds) {
  const ch = TANK_CHASSIS[ds.chassis], g = TANK_GUNS[ds.gun], am = TANK_ARMOR[ds.armor], en = TANK_ENGINE[ds.engine];
  const role = TANK_ROLES[ds.role] || TANK_ROLES.carro;
  let sa = g.sa, ha = g.ha, ap = g.ap, brk = ch.brk + g.brk, def = ch.def;
  let arm = ch.arm * am.armMul * (1 + 0.08 * ds.armUp);
  let spd = ch.spd + en.spd + (g.spd || 0) - 0.4 * ds.armUp + 0.6 * ds.engUp;
  let rel = ch.rel + am.rel + en.rel + (g.rel || 0) - 0.015 * (ds.armUp + ds.engUp);
  let cost = (ch.cost + g.cost) * am.costMul * (1 + 0.05 * ds.armUp + 0.04 * ds.engUp);
  let sup = ch.sup + en.sup;
  for (const x of ds.extras || []) {
    const e = TANK_EXTRAS[x];
    if (!e || (e.noTD && ds.role === 'cacciacarri')) continue;
    if (e.brk) brk += e.brk;
    if (e.atkMul) { sa *= 1 + e.atkMul; ha *= 1 + e.atkMul; }
    if (e.armMul) arm *= 1 + e.armMul;
    if (e.spd) spd += e.spd;
    rel += e.rel || 0;
    cost += e.cost || 0;
  }
  sa *= role.sa; ha *= role.ha; ap *= role.ap; arm *= role.arm; brk *= role.brk; cost *= role.cost;
  return {
    sa: +sa.toFixed(1), ha: +ha.toFixed(1), ap: Math.round(ap), arm: Math.round(arm), brk: +brk.toFixed(1), def,
    spd: +Math.max(3, spd).toFixed(1), rel: Math.max(0.3, Math.min(0.98, rel)), cost: Math.round(cost), sup: +sup.toFixed(2),
  };
}
function newTankDesign(c, name, chassis, gun, opts = {}) {
  const ds = {
    id: c.nextTankId++, name, chassis, gun, armor: opts.armor || 'rivettata', engine: opts.engine || 'benzina',
    armUp: opts.armUp || 0, engUp: opts.engUp || 0, extras: opts.extras || [], role: opts.role || 'carro',
  };
  ds.stats = tankStats(ds);
  c.tankDesigns.push(ds);
  return ds;
}
function tankDesignValid(c, ds) {
  const ch = TANK_CHASSIS[ds.chassis];
  if (!ch || !TANK_GUNS[ds.gun] || !ch.guns.includes(ds.gun)) return 'Cannone non montabile su questo telaio';
  for (const it of [ch, TANK_GUNS[ds.gun], TANK_ARMOR[ds.armor], TANK_ENGINE[ds.engine], ...(ds.extras || []).map(x => TANK_EXTRAS[x])])
    if (!it || !techOk(c, it)) return `Non ancora disponibile: ${it ? it.name : '?'}`;
  return null;
}

// ---------- modelli di divisione ----------
// tpl.lines = matrice [colonna][riga] di chiavi di BATTALIONS (o null), tpl.support = array di chiavi di SUPPORT
function tplBattalions(tpl) {
  const r = [];
  for (const col of tpl.lines) for (const b of col) if (b) r.push(b);
  return r;
}
function tplKind(tpl) { return tplBattalions(tpl).some(b => BATTALIONS[b].tank || b === 'meccanizzata') ? 'arm' : 'inf'; }

function computeTemplate(c, tpl) {
  const bats = tplBattalions(tpl);
  const s = { w: 0, hp: 0, org: 0, sa: 0, ha: 0, def: 0, brk: 0, apMax: 0, apSum: 0, armMax: 0, armSum: 0, hard: 0, spd: 99, sup: 0, mp: 0, rel: 0, relN: 0, days: 60, need: {}, special: 0, cost: 0, mods: {}, terrain: {} };
  const add = (need, k = 1) => { for (const f in need) s.need[f] = (s.need[f] || 0) + need[f] * k; };
  const design = tpl.tank != null ? c.tankDesigns.find(d => d.id === tpl.tank) : null;
  for (const key of bats) {
    let b = BATTALIONS[key];
    if (b.tank) {
      const t = design ? design.stats : tankStats({ chassis: 'L1', gun: 'mg', armor: 'rivettata', engine: 'benzina', armUp: 0, engUp: 0, extras: [], role: 'carro' });
      b = { ...b, sa: t.sa, ha: t.ha, def: t.def, brk: t.brk, ap: t.ap, arm: t.arm, spd: t.spd, sup: t.sup, rel: t.rel, cost: t.cost };
      s.rel += t.rel; s.relN++;
    }
    s.w += b.w; s.hp += b.hp; s.org += b.org;
    s.sa += b.sa; s.ha += b.ha; s.def += b.def; s.brk += b.brk;
    s.apMax = Math.max(s.apMax, b.ap); s.apSum += b.ap;
    s.armMax = Math.max(s.armMax, b.arm); s.armSum += b.arm;
    s.hard += b.hard; s.spd = Math.min(s.spd, b.spd); s.sup += b.sup; s.mp += b.mp;
    s.days = Math.max(s.days, 60 + b.days);
    if (b.special) { s.special++; s.terrain[b.special] = (s.terrain[b.special] || 0) + 1; }
    add(b.need);
    s.cost += b.cost ? b.cost / 4 : 0;
  }
  const n = Math.max(1, bats.length);
  s.org /= n; s.hard /= n;
  s.ap = s.apMax * 0.4 + (s.apSum / n) * 0.6;
  s.arm = s.armMax * 0.3 + (s.armSum / n) * 0.7;
  if (s.spd === 99) s.spd = 4;
  for (const key of tpl.support) {
    const sp = SUPPORT[key];
    if (!sp) continue;
    s.hp += sp.hp; s.sa += sp.sa; s.ha += sp.ha; s.def += sp.def; s.brk += sp.brk; s.sup += sp.sup; s.mp += sp.mp;
    if (sp.ap) s.ap = Math.max(s.ap, sp.ap * 0.4 + s.ap * 0.6);
    add(sp.need);
    for (const m in sp.mod) s.mods[m] = (s.mods[m] || 0) + sp.mod[m];
  }
  // le compagnie di supporto alzano leggermente l'organizzazione media come in HOI4
  if (tpl.support.length) s.org = s.org * 0.9 + 6 * Math.min(1, tpl.support.length / 3);
  s.sup *= 1 + (s.mods.supplyUse || 0);
  s.rel = s.relN ? Math.min(0.99, s.rel / s.relN + (s.mods.reliability || 0)) : 1;
  s.special = s.special; s.terrainShare = {};
  for (const k in s.terrain) s.terrainShare[k] = s.terrain[k] / n;
  s.kind = tplKind(tpl);
  s.nBat = bats.length;
  s.eqPoints = eqPoints(s.need, design);
  return s;
}

// valore in "punti equipaggiamento" quando economy.js non c'è
const EQ_POINT = { fanteria: 0.5, supporto: 1, artiglieria: 4, carri: 4, camion: 1 };
function eqPoints(need, design) {
  let p = 0;
  for (const f in need) p += need[f] * (f === 'carri' && design ? design.stats.cost / 40 : (EQ_POINT[f] || 1));
  return Math.round(p);
}

function refreshTemplate(c, tpl) {
  tpl.stats = computeTemplate(c, tpl);
  if (typeof Econ !== 'undefined' && Econ.registerNeeds) Econ.registerNeeds(tplKey(c, tpl), tpl.stats.need);
}
const tplKey = (c, tpl) => `tpl:${c.code}:${tpl.id}`;

function newTemplate(c, name, cols, support = [], tank = null) {
  const lines = [];
  for (let i = 0; i < TPL_COLS; i++) {
    const col = (cols[i] || []).slice(0, TPL_ROWS);
    while (col.length < TPL_ROWS) col.push(null);
    lines.push(col);
  }
  const tpl = { id: c.nextTplId++, name, lines, support: support.slice(0, TPL_SUPPORT), tank, locked: false };
  refreshTemplate(c, tpl);
  c.templates.push(tpl);
  return tpl;
}
const rep = (b, n) => Array(n).fill(b);

function initLandCountry(c) {
  const def = COUNTRY_DEFS[c.code];
  c.templates = []; c.tankDesigns = []; c.nextTplId = 1; c.nextTankId = 1;
  c.xp = c.xp || { army: 0, air: 0, navy: 0 };
  c.xp.army = c.major ? 40 : 15;
  const sup = c.major ? ['genio', 'ricognizione'] : ['genio'];
  newTemplate(c, 'Divisione di fanteria', [rep('fanteria', 3), rep('fanteria', 3), ['fanteria'], rep('artiglieria', 2)], sup);
  if (def.armor) {
    const medium = ['G', 'F', 'S'].includes(c.code);
    const ds = medium ? newTankDesign(c, c.code === 'G' ? 'Panzer III' : c.code === 'S' ? 'T-28' : 'Somua S35', 'M1', 'lgun', { armor: c.code === 'G' ? 'saldata' : 'rivettata' })
      : newTankDesign(c, c.code === 'U' ? 'Vickers Mk VI' : c.code === 'I' ? 'L3/35' : 'Carro leggero', 'L1', 'mg');
    newTemplate(c, 'Divisione corazzata', [['carri', 'carri'], ['carri', 'carri'], ['motorizzata', 'motorizzata'], ['motorizzata'], ['art_motorizzata']], c.major ? ['genio', 'ricognizione', 'manutenzione'] : ['genio'], ds.id);
  }
  if (c.code === 'S') newTemplate(c, 'Divisione di cavalleria', [rep('cavalleria', 3), rep('cavalleria', 3)], ['ricognizione']);
  if (c.code === 'G' || c.code === 'I') newTemplate(c, c.code === 'G' ? 'Gebirgsjäger' : 'Divisione alpina', [rep('montagna', 3), rep('montagna', 2), ['artiglieria']], ['genio']);
  if (c.code === 'U') newTemplate(c, 'Royal Marines', [rep('marines', 3), rep('marines', 2)], ['genio']);
}

// riallinea le statistiche di tutti i modelli (es. dopo una nuova tecnologia o un cambio di progetto carro)
function refreshAllTemplates(c) { for (const t of c.templates) refreshTemplate(c, t); }

const tplOf = d => {
  const c = C(d.owner);
  return c.templates.find(t => t.id === d.tpl) || c.templates[0];
};
const tplStats = d => tplOf(d).stats;

function divMaxOrg(d) {
  const st = tplStats(d), c = C(d.owner);
  let o = st.org + (c.orgBonus || 0);
  if (typeof unitMod === 'function') o *= 1 + (unitMod(c, st.kind, 'org') || 0);
  return Math.max(5, o);
}

// ---------- forze speciali ----------
function specialCap(c) {
  let tot = 0;
  for (const d of S.divs) if (d.owner === c.code && !d.dead) tot += tplStats(d).nBat;
  const commando = (c.generals || []).some(g => g.traits.includes('commando')) ? 12 : 0;
  return Math.max(24, Math.round(tot * 0.05)) + commando;
}
function specialUsed(c, extraTpl) {
  let n = 0;
  for (const d of S.divs) if (d.owner === c.code && !d.dead) n += tplStats(d).special;
  for (const tr of c.training) if (tr.tpl != null) n += (c.templates.find(t => t.id === tr.tpl)?.stats.special || 0);
  if (extraTpl) n += extraTpl.stats.special;
  return n;
}
function specialOver(c) { return specialUsed(c) > specialCap(c); }

// ---------- pagamento equipaggiamento ----------
function landCanPay(c, tpl, frac) {
  if (typeof Econ !== 'undefined' && Econ.canPay) return Econ.canPay(c, tplKey(c, tpl), frac);
  return c.equipment >= tpl.stats.eqPoints * frac;
}
function landPay(c, tpl, frac) {
  if (typeof Econ !== 'undefined' && Econ.pay) return Econ.pay(c, tplKey(c, tpl), frac);
  if (c.equipment < tpl.stats.eqPoints * frac) return false;
  c.equipment -= tpl.stats.eqPoints * frac;
  return true;
}
function landRefund(c, tpl, frac) {
  if (typeof Econ !== 'undefined' && Econ.refund) return Econ.refund(c, tplKey(c, tpl), frac);
  if (typeof Econ === 'undefined') c.equipment += tpl.stats.eqPoints * frac;
}

// ---------- reclutamento ----------
function resolveTpl(c, key) {
  if (key === 'inf') return c.templates.find(t => t.stats.kind === 'inf') || c.templates[0];
  if (key === 'arm') return c.templates.find(t => t.stats.kind === 'arm') || null;
  return c.templates.find(t => t.id === +key) || null;
}
function tplAvailable(c, tpl) {
  for (const b of tplBattalions(tpl)) if (!techOk(c, BATTALIONS[b])) return `${BATTALIONS[b].name} non ancora disponibile`;
  if (tpl.stats.kind === 'arm' && tplBattalions(tpl).includes('carri') && !c.armorTech) return 'Serve la tecnologia dei carri armati';
  if (tpl.stats.special && specialUsed(c, tpl) > specialCap(c)) return `Limite forze speciali raggiunto (${specialCap(c)} battaglioni)`;
  return null;
}
function canRecruit(c, key) {
  const tpl = resolveTpl(c, key);
  if (!tpl || tplAvailable(c, tpl)) return false;
  return c.manpower >= tpl.stats.mp && landCanPay(c, tpl, 1);
}
function recruit(c, key) {
  const tpl = resolveTpl(c, key);
  if (!tpl || !canRecruit(c, tpl.id)) return false;
  if (!landPay(c, tpl, 1)) return false;
  c.manpower -= tpl.stats.mp;
  c.training.push({ type: tpl.stats.kind, tpl: tpl.id, days: tpl.stats.days, total: tpl.stats.days });
  return true;
}

// ---------- modifiche al modello (costano esperienza) ----------
function tplDiffCost(a, b) {
  let n = 0;
  for (let i = 0; i < TPL_COLS; i++) for (let j = 0; j < TPL_ROWS; j++) if ((a.lines[i][j] || null) !== (b.lines[i][j] || null)) n += DESIGNER_XP.battalion;
  const sa = new Set(a.support), sb = new Set(b.support);
  for (const x of sb) if (!sa.has(x)) n += DESIGNER_XP.support;
  for (const x of sa) if (!sb.has(x)) n += DESIGNER_XP.support / 2;
  if ((a.tank ?? null) !== (b.tank ?? null)) n += DESIGNER_XP.battalion;
  return n;
}
// applica un modello modificato: le divisioni esistenti si riorganizzano (pagano la differenza di equipaggiamento)
function applyTemplateEdit(c, tplId, edited) {
  const tpl = c.templates.find(t => t.id === tplId);
  if (!tpl) return 'Modello inesistente';
  const cost = tplDiffCost(tpl, edited);
  if (armyXP(c) < cost) return `Servono ${cost} punti esperienza esercito`;
  if (!tplBattalions(edited).length) return 'La divisione deve avere almeno un battaglione';
  const old = tpl.stats;
  tpl.lines = edited.lines.map(col => col.slice());
  tpl.support = edited.support.slice();
  tpl.tank = edited.tank;
  if (edited.name) tpl.name = edited.name;
  refreshTemplate(c, tpl);
  addArmyXP(c, -cost);
  // riorganizzazione: le divisioni perdono organizzazione e, se manca equipaggiamento, forza
  const divs = S.divs.filter(d => d.owner === c.code && d.tpl === tpl.id && !d.dead);
  const extra = Math.max(0, tpl.stats.eqPoints - old.eqPoints) / Math.max(1, tpl.stats.eqPoints);
  for (const d of divs) {
    d.org = Math.min(d.org, divMaxOrg(d) * 0.5);
    if (extra > 0 && !landPay(c, tpl, extra * d.str)) d.str = Math.max(0.2, d.str * (1 - extra));
  }
  return null;
}
function copyTemplate(c, tplId) {
  const t = c.templates.find(x => x.id === tplId);
  if (!t || armyXP(c) < DESIGNER_XP.newTemplate) return null;
  addArmyXP(c, -DESIGNER_XP.newTemplate);
  return newTemplate(c, t.name + ' (copia)', t.lines.map(col => col.slice()), t.support.slice(), t.tank);
}
function deleteTemplate(c, tplId) {
  if (c.templates.length <= 1) return false;
  if (S.divs.some(d => d.owner === c.code && d.tpl === tplId && !d.dead) || c.training.some(t => t.tpl === tplId)) return false;
  c.templates = c.templates.filter(t => t.id !== tplId);
  return true;
}
function saveTankDesign(c, ds, asNewId) {
  const err = tankDesignValid(c, ds);
  if (err) return err;
  const cost = DESIGNER_XP.tankModule * 2;
  if (armyXP(c) < cost) return `Servono ${cost} punti esperienza esercito`;
  addArmyXP(c, -cost);
  if (asNewId) newTankDesign(c, ds.name || 'Nuovo carro', ds.chassis, ds.gun, ds);
  else {
    const cur = c.tankDesigns.find(x => x.id === ds.id);
    Object.assign(cur, ds, { stats: tankStats(ds) });
    refreshAllTemplates(c);
  }
  return null;
}
