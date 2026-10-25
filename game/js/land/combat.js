'use strict';
// Combattimento terrestre in stile HOI4: larghezza di fronte, attacco molle/duro contro difesa/sfondamento,
// tiri di dado ora per ora, corazza contro perforazione, pianificazione, trinceramento e logorio.

const HOURS_PER_DAY = 24;
const ORG_DMG_K = 0.053, STR_DMG_K = 0.06; // moltiplicatori di danno per colpo (come HOI4)
const KMH_TO_TILES = 0.075;                // 4 km/h di fanteria ≈ 0,3 esagoni al giorno

// ---------- divisioni ----------
function initDivLand(d, tplKeyOrId) {
  const c = C(d.owner);
  const tpl = resolveTpl(c, tplKeyOrId ?? d.type) || c.templates[0];
  d.tpl = tpl.id;
  d.type = tpl.stats.kind;
  d.org = divMaxOrg(d);
  d.exp = 0.3; d.ent = 0; d.plan = 0; d.supply = 1; d.supTarget = 1; d.army = null;
}

function landMods(d) {
  // modificatori di stato ricalcolati una volta al giorno
  if (d._day === S.day && d._lm) return d._lm;
  const c = C(d.owner), st = tplStats(d), kind = st.kind;
  const um = k => (typeof unitMod === 'function' ? unitMod(c, kind, k) || 0 : 0);
  const qm = typeof Econ !== 'undefined' && Econ.qualityMod ? Econ.qualityMod(d.owner, kind) : 1;
  const cm = commandMods(d);
  const exp = 0.85 + 0.35 * (d.exp || 0);
  const sup = d.supply == null ? 1 : d.supply;
  const supMul = 0.2 + 0.8 * Math.min(1, sup / 0.9); // senza rifornimenti fino a -80% ai danni
  const over = st.special && specialOver(c);
  d._lm = {
    st, cm, kind,
    atk: (1 + (c.atkBonus || 0) + um('attack') + cm.atk) * qm * exp * supMul * (over ? 0.9 : 1),
    def: (1 + (c.defBonus || 0) + um('defense') + cm.def) * qm * exp * supMul * (over ? 0.9 : 1),
    brk: (1 + um('breakthrough') + cm.brk) * qm * exp * supMul,
    width: st.w * (1 + um('width')),
    special: over ? 0 : 1 + cm.special,
  };
  d._day = S.day;
  return d._lm;
}
function invalidateLand(d) { d._day = -1; }

function speedOf(d, ti) {
  const c = C(d.owner), st = tplStats(d);
  const lm = landMods(d);
  let v = st.spd * KMH_TO_TILES * (1 + (c.speedBonus || 0) + (typeof unitMod === 'function' ? unitMod(c, st.kind, 'speed') || 0 : 0) + lm.cm.speed);
  if (typeof Econ !== 'undefined' && Econ.fuelMod) v *= Econ.fuelMod(d.owner, st.kind);
  const at = ti != null ? ti : d.tile;
  if (S.tiles[at].land) v *= weatherMul(at, 'spd', lm.cm.winter);
  v *= 0.5 + 0.5 * Math.min(1, (d.supply ?? 1) / 0.6);
  return v;
}

// stime di forza usate dall'IA (stessa scala del vecchio sistema)
function atkValue(d, ti) {
  const lm = landMods(d), st = lm.st;
  let v = (st.sa * 0.85 + st.ha * 0.15 + st.brk * 0.1) * lm.atk * d.str * (0.4 + 0.6 * d.org / divMaxOrg(d)) / 3.8;
  if (ti != null) {
    const ter = terrainOf(ti);
    v *= 1 + ter.atk;
    if (st.kind === 'arm') v *= 0.5 + 0.5 * ter.tank;
  }
  if (!S.tiles[d.tile].land) v *= 0.5;
  return v;
}
function defValueOf(d) {
  const lm = landMods(d);
  return lm.st.def * lm.def * d.str * (0.4 + 0.6 * d.org / divMaxOrg(d)) / 8;
}
function defValue(ti, vsOwner) {
  const a = S.byTile.get(ti);
  if (!a) return 0;
  let D = 0;
  for (const d of a) if (!d.dead && atWar(d.owner, vsOwner)) D += defValueOf(d);
  return D / Math.max(0.3, 1 + terrainOf(ti).atk);
}
function terrainOf(ti) {
  const t = S.tiles[ti];
  if (t.vp >= 5 && typeof MAP === 'undefined') return LAND_TERRAIN.urban; // mappa esagonale: le città contano come urbano
  return LAND_TERRAIN[t.terrain] || DEFAULT_TERRAIN;
}

// ---------- dadi ----------
function rollDice(n, sides) {
  let k = Math.floor(n);
  if (Math.random() < n - k) k++;
  if (k <= 0) return 0;
  if (k <= 24) {
    let s = 0;
    for (let i = 0; i < k; i++) s += 1 + Math.floor(Math.random() * sides);
    return s;
  }
  const mean = k * (sides + 1) / 2, sd = Math.sqrt(k * (sides * sides - 1) / 12);
  const g = Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());
  return Math.max(k, mean + g * sd);
}

// ---------- battaglia ----------
// attacco effettivo di una divisione contro un bersaglio (per ora di combattimento)
function battleAttack(d, tgt, ti, attacking, info) {
  const lm = landMods(d), st = lm.st, tl = landMods(tgt), ts = tl.st;
  const hardT = ts.hard;
  let a = (st.sa * (1 - hardT) + st.ha * hardT) * d.str * lm.atk;
  const ter = terrainOf(ti), tt = S.tiles[ti];
  if (attacking) {
    let pen = Math.min(0, ter.atk - (st.mods.terrainPen || 0) + lm.cm.terrainPen);
    a *= 1 + pen;
    if (st.kind === 'arm') a *= 0.5 + 0.5 * ter.tank;
    a *= 1 + (d.plan || 0);
    if (!S.tiles[d.tile].land) a *= 0.5 + 0.5 * (st.terrainShare.marines || 0) * lm.special; // sbarco
    a *= 1 + weatherMul(ti, 'atk', lm.cm.winter);
    a *= 1 - info.atkOver;
  } else {
    a *= 1 - info.defOver;
    a *= 1 + weatherMul(ti, 'atk', lm.cm.winter) * 0.5;
  }
  // forze speciali in montagna/colline
  const sm = SPECIAL_TERRAIN.montagna[tt.terrain];
  if (sm && st.terrainShare.montagna) a *= 1 + sm * st.terrainShare.montagna * lm.special;
  if (lm.cm.terrain) a *= 1 + lm.cm.terrain;
  if (typeof airGroundMod === 'function') a *= 1 + (airGroundMod(d.owner, ti) || 0);
  a *= attacking ? info.aMul ?? 1 : info.dMul ?? 1;
  return a;
}
// difesa (se il bersaglio difende) o sfondamento (se il bersaglio sta attaccando)
function battleDefense(tgt, defending, ti) {
  const lm = landMods(tgt), st = lm.st, c = C(tgt.owner);
  if (!defending) return st.brk * lm.brk * tgt.str * (1 + (tgt.plan || 0));
  const entMax = (c.entMax ?? 0.10) + 0.05 * (st.mods.entrench || 0) + 0.05 * lm.cm.entrench;
  let v = st.def * lm.def * tgt.str * (1 + entMax * Math.min(10, tgt.ent || 0) / 10) * (1 + (tgt.plan || 0) * 0.5);
  const sm = SPECIAL_TERRAIN.montagna[S.tiles[ti].terrain];
  if (sm && st.terrainShare.montagna) v *= 1 + sm * st.terrainShare.montagna * lm.special;
  return v;
}

function pickFront(divs, width) {
  const sorted = divs.slice().sort((a, b) => b.org / divMaxOrg(b) - a.org / divMaxOrg(a));
  const front = [];
  let used = 0;
  for (const d of sorted) {
    if (used >= width) break;
    front.push(d); used += landMods(d).width;
  }
  return { front, used, reserve: sorted.length - front.length };
}

function resolveCombat(ti, atkAll) {
  const t = S.tiles[ti];
  const a0 = atkAll[0].owner;
  const atk = atkAll.filter(d => !d.dead && atWar(d.owner, (S.byTile.get(ti) || []).find(x => !x.dead && atWar(x.owner, a0))?.owner));
  const defs = (S.byTile.get(ti) || []).filter(d => !d.dead && atWar(d.owner, a0));
  if (!defs.length || !atk.length) return;
  const ter = terrainOf(ti);
  const dirs = new Set(atk.map(d => d.tile)).size;
  const width = ter.width + ter.extra * (dirs - 1);
  const A = pickFront(atk, width), D = pickFront(defs, width);
  const over = u => Math.min(0.5, Math.max(0, (u - width) / width) * 2); // sovraffollamento
  const info = { to: ti, from: [...new Set(atk.map(d => d.tile))], width, aW: A.used, dW: D.used, atkOver: over(A.used), defOver: over(D.used),
    aRes: A.reserve, dRes: D.reserve, dirs, att: a0, def: defs[0].owner, aOrg0: 0, dOrg0: 0, hits: [0, 0], pierced: [false, false] };
  // intelligence: decrittazione e reti nel paese nemico
  info.aMul = typeof Intel !== 'undefined' ? Intel.combatMod(a0, info.def) : 1;
  info.dMul = typeof Intel !== 'undefined' ? Intel.combatMod(info.def, a0) : 1;
  // attacco da più direzioni (multi-prong): oltre alla larghezza in più, +5% per direzione (max +15%)
  info.prong = 1 + 0.05 * Math.min(3, dirs - 1);
  info.aMul *= info.prong;
  for (const d of A.front) info.aOrg0 += d.org;
  for (const d of D.front) info.dOrg0 += d.org;
  const hp = d => Math.max(1, landMods(d).st.hp);
  // Attacco forzato e Ultima resistenza: si combatte anche senza organizzazione
  const aliveA = d => !d.dead && d.str > 0.05 && (d.org > 0 || divAbility(d) === 'force');
  const aliveD = d => !d.dead && d.str > 0.05 && (d.org > 0 || divAbility(d) === 'last');

  for (let h = 0; h < HOURS_PER_DAY; h++) {
    const af = A.front.filter(aliveA), df = D.front.filter(aliveD);
    if (!af.length || !df.length) break;
    // attaccanti → difensori
    hourAttacks(af, df, ti, true, info, hp);
    // difensori → attaccanti (contro lo sfondamento)
    hourAttacks(df, af, ti, false, info, hp);
    for (const d of af) d.plan = Math.max(0, (d.plan || 0) - 0.01);
    for (const d of df) d.ent = Math.max(0, (d.ent || 0) - 0.02);
  }
  for (const d of [...atk, ...defs]) { d.combat = true; invalidateLand(d); }
  info.aOrg1 = A.front.reduce((s, d) => s + Math.max(0, d.org), 0);
  info.dOrg1 = D.front.reduce((s, d) => s + Math.max(0, d.org), 0);
  S.battles.push(info);
  // partecipazione alla guerra per la conferenza di pace (diplomacy.js)
  if (typeof Diplo !== 'undefined') Diplo.onCombat(A.front, D.front, info.hits[0] / HOURS_PER_DAY, info.hits[1] / HOURS_PER_DAY);

  // esperienza
  const ca = C(a0), cd = C(info.def);
  addArmyXP(ca, 0.05 * A.front.length); addArmyXP(cd, 0.05 * D.front.length);
  for (const d of [...A.front, ...D.front]) d.exp = Math.min(1, (d.exp || 0) + 0.004);
  const ga = new Set(A.front.map(divGeneral).filter(Boolean)), gd = new Set(D.front.map(divGeneral).filter(Boolean));
  for (const g of ga) generalGainXP(ca, g, 3);
  for (const g of gd) generalGainXP(cd, g, 3);

  for (const d of [...defs, ...atk]) {
    if (d.str < 0.05) {
      destroyDiv(d);
      if (d.owner === S.player) log(`${divName(d)} è stata annientata.`, 'bad');
    }
  }
  // i difensori senza organizzazione si ritirano uno per uno
  for (const d of defs) if (!d.dead && d.org <= 0.5 && divAbility(d) !== 'last') retreat(d);
  // gli attaccanti esausti interrompono l'attacco
  for (const d of atk) {
    if (!d.dead && d.org < divMaxOrg(d) * 0.1 && divAbility(d) !== 'force') {
      d.path = []; d.prog = 0;
      if (d.owner === S.player) log(`${divName(d)} ha interrotto l'attacco: organizzazione esaurita.`, 'warn');
    }
  }
}

function hourAttacks(src, tgts, ti, attacking, info, hp) {
  // ogni divisione sceglie un bersaglio a caso (la ricognizione sceglie quello più debole)
  const pool = new Map();
  for (const t of tgts) pool.set(t, battleDefense(t, attacking, ti));
  for (const d of src) {
    const lm = landMods(d);
    let tgt = tgts[Math.floor(Math.random() * tgts.length)];
    if (lm.st.mods.recon && Math.random() < 0.3) tgt = tgts.reduce((m, x) => (x.org < m.org ? x : m), tgts[0]);
    const a = battleAttack(d, tgt, ti, attacking, info); // HOI4: ogni punto di attacco è un attacco per ora
    const pl = pool.get(tgt);
    const defended = Math.min(a, pl);
    pool.set(tgt, pl - defended);
    const hits = defended * 0.1 + (a - defended) * 0.4;
    const ts = landMods(tgt).st;
    // corazza contro perforazione
    const myArmor = lm.st.arm, myPierce = lm.st.ap;
    const tgtArmored = ts.arm > myPierce;        // il bersaglio non viene perforato: danni dimezzati
    const iAmUnpierced = myArmor > ts.ap && myArmor > 0; // i miei mezzi non vengono perforati: dado d'organizzazione più grande
    const orgDie = iAmUnpierced ? 6 : 4;
    let org = rollDice(hits, orgDie) * ORG_DMG_K, str = rollDice(hits, 2) * STR_DMG_K;
    if (tgtArmored) { org *= 0.5; str *= 0.5; }
    if (ts.mods.casualties) str *= 1 + ts.mods.casualties * 0.5;
    if (tgt.org <= 0) str *= 2; // chi combatte senza organizzazione (Attacco forzato, Ultima resistenza) paga in uomini e mezzi
    tgt.org = Math.max(0, tgt.org - org);
    tgt.str = Math.max(0, tgt.str - str / hp(tgt));
    info.hits[attacking ? 0 : 1] += hits;
    if (iAmUnpierced) info.pierced[attacking ? 0 : 1] = true;
  }
}

// ---------- movimento ----------
function militaryStep() {
  S.battles = [];
  const combats = new Map();
  S.armyCount = new Map();
  for (const d of S.divs) {
    d.combat = false;
    if (!d.dead && d.army != null) { const k = d.owner + ':' + d.army; S.armyCount.set(k, (S.armyCount.get(k) || 0) + 1); }
  }
  for (const d of S.divs) {
    if (d.dead) continue;
    if (!d.path.length) {
      if (!S.tiles[d.tile].land) returnToLand(d);
      continue;
    }
    const nx = d.path[0], t = S.tiles[nx];
    if (!passable(d.owner, t)) { d.path = []; d.prog = 0; continue; }
    d.ent = 0;
    if (d.strat && (!t.land || !allied(t.ctrl, d.owner) || hasHostile(nx, d.owner))) d.strat = false;
    if (t.land && hasHostile(nx, d.owner)) {
      if (d.org < divMaxOrg(d) * 0.15 && divAbility(d) !== 'force') {
        d.path = []; d.prog = 0;
        if (d.owner === S.player) log(`${divName(d)} ha interrotto l'attacco: organizzazione esaurita.`, 'warn');
        continue;
      }
      let a = combats.get(nx);
      if (!a) { a = []; combats.set(nx, a); }
      a.push(d); d.combat = true;
      continue;
    }
    d.plan = Math.max(0, (d.plan || 0) - 0.05);
    if (d.strat) {
      // in treno si percorrono più province al giorno, solo in territorio amico
      d.prog += stratSpeed(d.tile, nx);
      while (d.prog >= 1 && d.path.length) {
        const to = d.path[0], tt = S.tiles[to];
        if (!tt.land || !allied(tt.ctrl, d.owner) || hasHostile(to, d.owner)) { d.strat = false; d.prog = 0; break; }
        d.prog -= 1; d.path.shift(); moveDiv(d, to);
      }
      if (!d.path.length) { d.strat = false; d.prog = 0; }
      continue;
    }
    d.prog += t.land ? speedOf(d, nx) / TERRAIN[t.terrain]?.cost || speedOf(d, nx) : SEA_SPEED;
    if (d.prog >= 1) {
      d.prog = 0;
      d.path.shift();
      moveDiv(d, nx);
      if (t.land) occupy(t, d.owner);
      if (tplStats(d).relN) tankBreakdown(d);
    }
  }
  for (const [ti, atk] of combats) resolveCombat(ti, atk);
  for (const d of S.divs) if (!d.dead) recover(d);
}

// guasti dei carri durante gli spostamenti: dipende dall'affidabilità del progetto
function tankBreakdown(d) {
  const st = tplStats(d);
  const tankShare = tplBattalions(tplOf(d)).filter(b => BATTALIONS[b].tank).length / Math.max(1, st.nBat);
  const p = (1 - st.rel) * 0.06 * tankShare * weatherOf(d.tile).supply;
  if (p > 0) d.str = Math.max(0.05, d.str - p * Math.random() * 2);
}

// ---------- recupero, trinceramento, pianificazione, logorio ----------
function recover(d) {
  const c = C(d.owner), t = S.tiles[d.tile];
  if (!t.land) return;
  const lm = landMods(d), st = lm.st, maxOrg = divMaxOrg(d);
  const sup = d.supply ?? 1;
  // logorio: senza rifornimenti, meteo invernale, mezzi poco affidabili
  let attr = 0;
  if (sup < 0.5) attr += (0.5 - sup) * 0.03;
  const wa = weatherMul(d.tile, 'attr', lm.cm.winter);
  if (wa > 0) attr += wa * (1.2 - 0.6 * sup);
  if (st.relN) attr *= 1 + (1 - st.rel);
  d.attrition = attr;
  if (attr > 0) {
    // il logorio consuma uomini ed equipaggiamento in proporzione alla forza rimasta (non annienta da solo)
    d.str = Math.max(Math.min(d.str, 0.1), d.str - attr * (0.3 + 0.7 * d.str));
    if (sup < 0.3) d.org = Math.max(0, d.org - (0.3 - sup) * 8);
  }
  if (d.combat) return;
  const moving = d.path.length > 0;
  // l'organizzazione si recupera solo se arrivano rifornimenti
  const supF = sup < 0.3 ? 0 : Math.min(1, (sup - 0.3) / 0.6);
  const rb = 1 + (c.recBonus || 0);
  if (d.strat) { d.org = 0; return; } // in trasferimento strategico (treno): niente organizzazione
  d.org = Math.min(maxOrg, d.org + (moving ? 2 : 6) * rb * supF);
  if (!moving) {
    d.ent = Math.min(10, (d.ent || 0) + 1 + (st.mods.entrench || 0) * 0.5 + lm.cm.entrench);
    const g = divGeneral(d);
    // il giocatore accumula pianificazione solo sulla linea del fronte di un piano di battaglia (come in HOI4)
    const pmax = d.owner === S.player && !onBattlePlan(d) ? 0 : (c.planMax ?? 0.30) + lm.cm.plan;
    const speed = 0.03 * (g ? 1 + lm.cm.planSpeed : 0.5) * (1 + (st.mods.planning || 0));
    d.plan = Math.min(pmax, (d.plan || 0) + speed);
  }
  // rinforzi
  if (d.str < 1 && allied(t.ctrl, d.owner) && sup > 0.3) {
    const tpl = tplOf(d);
    const need = Math.min(0.02 * rb * (1 + (st.mods.reinforce || 0)) * sup, 1 - d.str);
    const mp = need * st.mp * (1 + (st.mods.casualties || 0));
    if (c.manpower >= mp && landCanPay(c, tpl, need) && landPay(c, tpl, need)) { c.manpower -= mp; d.str += need; }
  }
}
