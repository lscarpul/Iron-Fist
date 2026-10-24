'use strict';

// Guerra aerea: stormi su basi aeree, missioni per regione strategica, superiorità aerea,
// appoggio ravvicinato (CAS), bombardamento strategico e attacco navale.

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function airBases(code) {
  return S.tiles.filter(t => t.land && t.vp > 0 && t.ctrl === code).map(t => t.i);
}
function wingStats(w) { return designOf(w.design).stats; }
function wingRole(w) { return designOf(w.design).type; }
function wingInRange(w, rid) { return regionDistKm(w.base, rid) <= wingStats(w).range; }
function wingActive(w) { return w.mission && w.region != null && w.planes >= 5 && wingInRange(w, w.region); }
function wingName(w) { return `${w.num}° Stormo ${AIR_ROLES[wingRole(w)].short}`; }

function createWing(code, designId, base, planes) {
  const c = C(code);
  c.wingCounter = (c.wingCounter || 0) + 1;
  const w = { id: S.an.nextId++, num: c.wingCounter, owner: code, design: designId, planes, base, mission: null, region: null };
  S.an.wings.push(w);
  return w;
}

// quota di superiorità aerea del lato di `owner` in una regione (0.5 se nessuno vola)
function anAirShare(rid, owner) {
  const P = S.an && S.an.airPow[rid];
  if (!P) return 0.5;
  let mine = 0, foe = 0;
  for (const o in P) {
    if (allied(o, owner) && !atWar(o, owner)) mine += P[o];
    else if (atWar(o, owner)) foe += P[o];
  }
  if (mine + foe < 1) return 0.5;
  return mine / (mine + foe);
}

function nearestBase(code, fromTile) {
  let best = -1, bd = Infinity;
  for (const b of airBases(code)) { const d = tileDistKm(b, fromTile); if (d < bd) { bd = d; best = b; } }
  return best;
}

AN.air = {
  init() {
    for (const code in S.countries) {
      const c = C(code);
      for (const role in AIR_ROLES) ensureDefaultDesign(c, 'air', role);
      const sa = START_AIR[code];
      if (!sa) continue;
      const bases = airBases(code);
      if (!bases.length) continue;
      let k = 0;
      for (const role in sa) {
        const d = ensureDefaultDesign(c, 'air', role);
        for (let left = sa[role]; left > 0; left -= WING_SIZE) {
          createWing(code, d.id, bases[k++ % bases.length], Math.min(WING_SIZE, left));
        }
      }
    }
  },

  step() {
    const A = S.an;
    // pulizia, cambio di base forzato, rinforzi dal magazzino
    for (const w of A.wings) {
      const c = C(w.owner);
      if (!c.alive) { w.dead = true; continue; }
      if (S.tiles[w.base].ctrl !== w.owner) {
        const nb = nearestBase(w.owner, w.base);
        if (nb < 0) { w.dead = true; if (w.owner === S.player) log(`${wingName(w)} ha perso la sua base ed è stato sciolto.`, 'bad'); continue; }
        w.base = nb;
        if (w.owner === S.player) log(`${wingName(w)} ripiega su un'altra base aerea.`, 'warn');
      }
      if (w.planes < WING_SIZE) {
        const have = c.airStock[w.design] || 0;
        const take = Math.min(have, WING_SIZE - w.planes);
        if (take > 0) { c.airStock[w.design] -= take; w.planes += take; }
      }
    }
    A.wings = A.wings.filter(w => !w.dead);

    // potenza di superiorità per regione
    A.airPow = [];
    const byRegion = new Map();
    for (const w of A.wings) {
      if (!wingActive(w)) continue;
      let a = byRegion.get(w.region);
      if (!a) { a = []; byRegion.set(w.region, a); }
      a.push(w);
      const st = wingStats(w);
      const f = w.mission === 'superiority' ? 1 : w.mission === 'intercept' ? 0.6 : 0.08;
      const P = A.airPow[w.region] || (A.airPow[w.region] = {});
      P[w.owner] = (P[w.owner] || 0) + w.planes * (st.airAtk + st.agility * 0.3) * f;
    }
    for (const [rid, ws] of byRegion) this.combat(rid, ws);
    for (const [rid, ws] of byRegion) this.missions(rid, ws);
    this.superiorityEffects();
    A.wings = A.wings.filter(w => !w.dead);
    // resoconto settimanale per il giocatore
    if (S.day % 7 === 0) {
      const wk = A.weekly[S.player];
      if (wk && (wk.lost || wk.killed)) log(`Guerra aerea (ultima settimana): abbattuti ${Math.round(wk.killed)} aerei nemici, perduti ${Math.round(wk.lost)}.`, wk.lost > wk.killed ? 'warn' : 'good');
      A.weekly = {};
    }
  },

  // combattimento aereo in una regione
  combat(rid, ws) {
    const hostile = ws.some(a => ws.some(b => atWar(a.owner, b.owner)));
    if (!hostile) return;
    const loss = new Map();
    const hit = (w, n) => loss.set(w, (loss.get(w) || 0) + n);
    const stat = w => wingStats(w);
    for (const w of ws) {
      const role = wingRole(w);
      const shooter = role === 'fighter' && (w.mission === 'superiority' || w.mission === 'intercept');
      const foes = ws.filter(o => atWar(o.owner, w.owner) && o.planes > 0);
      if (!foes.length) continue;
      if (!shooter) continue;
      // bersaglio: i caccia in superiorità attirano gli attacchi (scorta), l'intercettazione cerca i bombardieri
      let tot = 0;
      const weights = foes.map(o => {
        const fr = wingRole(o) === 'fighter';
        let k = o.planes * (fr ? (o.mission === 'superiority' ? 2 : 1) : 1);
        if (w.mission === 'intercept' && !fr) k *= 3;
        tot += k; return k;
      });
      let r = Math.random() * tot, t = foes[0];
      for (let i = 0; i < foes.length; i++) { r -= weights[i]; if (r <= 0) { t = foes[i]; break; } }
      const a = stat(w), b = stat(t);
      const agi = Math.max(0.4, Math.min(1.8, 1 + (a.agility - b.agility) / 60));
      let mult = 1;
      if (w.mission === 'intercept') mult = wingRole(t) === 'fighter' ? 0.6 : 1.5;
      const kills = w.planes * a.airAtk * 0.0007 * agi * mult * (20 / (20 + b.airDef)) * (0.7 + Math.random() * 0.6);
      hit(t, kills);
      // fuoco di risposta (torrette dei bombardieri, caccia nemici)
      const back = t.planes * b.airAtk * 0.0003 * (b.airDef / 20) * (wingRole(t) === 'fighter' ? 1 / agi : 0.6);
      hit(w, back);
    }
    for (const [w, n] of loss) {
      const lost = Math.min(w.planes, n);
      w.planes -= lost;
      const wk = S.an.weekly;
      (wk[w.owner] || (wk[w.owner] = { lost: 0, killed: 0 })).lost += lost;
      // attribuisci gli abbattimenti ai nemici presenti
      const foes = [...new Set(ws.filter(o => atWar(o.owner, w.owner)).map(o => o.owner))];
      for (const f of foes) (wk[f] || (wk[f] = { lost: 0, killed: 0 })).killed += lost / foes.length;
    }
  },

  missions(rid, ws) {
    const reg = regionById(rid);
    for (const w of ws) {
      if (w.planes < 5) continue;
      const st = wingStats(w), share = anAirShare(rid, w.owner);
      const cover = 0.4 + 0.6 * share; // senza superiorità i bombardieri rendono meno
      if (w.mission === 'cas' && !reg.sea) this.cas(w, rid, st, cover, share);
      else if (w.mission === 'strategic' && !reg.sea) this.strategic(w, reg, st, cover, share);
      else if (w.mission === 'naval' && reg.sea) AN.naval.airStrike(w, rid, st.naval * w.planes * cover);
    }
  },

  // divisioni in battaglia nella regione, separate per lato rispetto a `owner`
  battlesIn(rid, owner) {
    const foes = [];
    for (const bt of S.battles) {
      if (regionOfTile(bt.to) !== rid) continue;
      for (const ti of [bt.to, ...bt.from]) {
        for (const d of S.byTile.get(ti) || []) if (!d.dead && d.combat && atWar(d.owner, owner)) foes.push(d);
      }
    }
    return [...new Set(foes)];
  },

  cas(w, rid, st, cover, share) {
    const foes = this.battlesIn(rid, w.owner);
    if (!foes.length) return;
    const dmg = w.planes * st.ground * cover * 0.05;
    for (const d of foes) {
      const ut = UNIT_TYPES[d.type];
      d.org = Math.max(0, d.org - dmg / foes.length);
      d.str -= dmg / foes.length * (d.type === 'arm' ? 0.0012 : 0.002);
      if (d.str < 0.05) { destroyDiv(d); if (d.owner === S.player) log(`${divName(d)} è stata distrutta dagli attacchi aerei.`, 'bad'); }
      if (ut && d.org > ut.org) d.org = ut.org;
    }
    // contraerea delle divisioni colpite
    this.loseToAA(w, 0.006 * (1 - share * 0.5));
  },

  strategic(w, reg, st, cover, share) {
    // bersaglio: il paese nemico che controlla più caselle (e città) nella regione
    const val = {};
    for (const u of reg.tiles) {
      const t = S.tiles[u];
      if (atWar(t.ctrl, w.owner)) val[t.ctrl] = (val[t.ctrl] || 0) + 1 + t.vp;
    }
    const tgt = Object.entries(val).sort((a, b) => b[1] - a[1])[0];
    if (!tgt) return;
    const c = C(tgt[0]);
    let totV = 0;
    for (const t of S.tiles) if (t.land && t.ctrl === c.code) totV += 1 + t.vp;
    const weight = Math.min(1, tgt[1] / Math.max(1, totV) * 3);
    const before = c.indDamage;
    c.indDamage = Math.min(0.4, c.indDamage + w.planes * st.strat * cover * weight * 0.000004);
    if (c.code === S.player && before < 0.15 && c.indDamage >= 0.15 && !(S.day - (c.bombWarn || -99) < 60) && (c.bombWarn = S.day)) log(`I bombardamenti nemici hanno danneggiato il ${Math.round(c.indDamage * 100)}% della nostra industria!`, 'bad');
    this.loseToAA(w, 0.005 * (1 - share * 0.5));
  },

  loseToAA(w, frac) {
    const lost = Math.min(w.planes, w.planes * frac * (0.5 + Math.random()));
    w.planes -= lost;
    const wk = S.an.weekly;
    (wk[w.owner] || (wk[w.owner] = { lost: 0, killed: 0 })).lost += lost;
  },

  // superiorità aerea sul campo di battaglia: chi non ce l'ha perde organizzazione ogni giorno (fino a -35% di efficacia)
  superiorityEffects() {
    for (const bt of S.battles) {
      const rid = regionOfTile(bt.to);
      if (!S.an.airPow[rid]) continue;
      const divs = [];
      for (const ti of [bt.to, ...bt.from]) for (const d of S.byTile.get(ti) || []) if (!d.dead && d.combat) divs.push(d);
      for (const d of new Set(divs)) {
        const foeShare = 1 - anAirShare(rid, d.owner);
        const pen = Math.max(0, foeShare - 0.5) * 2;
        if (pen > 0) d.org = Math.max(0, d.org - UNIT_TYPES[d.type].org * 0.035 * pen);
      }
    }
  },

  // ---------- azioni (giocatore e IA) ----------
  setMission(w, mission, rid) {
    if (!mission) { w.mission = null; w.region = null; return true; }
    const role = wingRole(w), reg = regionById(rid), M = AIR_MISSIONS[mission];
    if (!AIR_ROLES[role].missions.includes(mission)) return false;
    if (M.where === 'land' && reg.sea) return false;
    if (M.where === 'sea' && !reg.sea) return false;
    if (!wingInRange(w, rid)) return false;
    w.mission = mission; w.region = rid;
    return true;
  },
  rebase(w, tile) {
    if (!(S.tiles[tile].vp > 0 && S.tiles[tile].ctrl === w.owner)) return false;
    w.base = tile;
    if (w.region != null && !wingInRange(w, w.region)) { w.mission = null; w.region = null; }
    return true;
  },
  disband(w) {
    const c = C(w.owner);
    c.airStock[w.design] = (c.airStock[w.design] || 0) + Math.floor(w.planes);
    w.dead = true;
    S.an.wings = S.an.wings.filter(x => x !== w);
  },

  // ---------- intelligenza artificiale ----------
  ai(c) {
    const code = c.code;
    // produzione: quota fissa delle fabbriche militari, divisa per ruolo
    const share = c.major ? AI_AIR_SHARE.major : AI_AIR_SHARE.minor;
    const want = Math.floor(c.mil * share);
    const mix = c.major ? AI_AIR_MIX : { fighter: 0.7, cas: 0.3 };
    for (const role in mix) {
      const d = ensureDefaultDesign(c, 'air', role);
      let line = c.airLines.find(l => designOf(l.design).type === role);
      const target = Math.round(want * mix[role]);
      if (!line && target > 0) line = addAirLine(c, d.id, 0);
      if (!line) continue;
      if (line.design !== d.id) setAirLineDesign(c, line, d.id); // passa al modello più moderno
      const free = c.mil - airFactoriesUsed(c) + line.factories;
      line.factories = Math.max(0, Math.min(free, target));
    }
    // nuovi stormi dal magazzino
    const bases = airBases(code);
    if (!bases.length) return;
    for (const id in c.airStock) {
      while (c.airStock[id] >= WING_SIZE / 2) {
        const n = Math.min(WING_SIZE, c.airStock[id]);
        c.airStock[id] -= n;
        createWing(code, id, bases[0], n);
      }
    }
    // accorpa gli stormi decimati dello stesso modello
    for (const w of S.an.wings) {
      if (w.owner !== code || w.dead || w.planes >= 10) continue;
      const into = S.an.wings.find(x => x !== w && !x.dead && x.owner === code && x.design === w.design && x.planes + w.planes <= WING_SIZE);
      if (into) { into.planes += w.planes; w.dead = true; }
    }
    S.an.wings = S.an.wings.filter(w => !w.dead);
    // missioni
    const mine = S.an.wings.filter(w => w.owner === code);
    const enemies = enemiesOf(code);
    const homeR = regionOfTile(c.capital);
    if (!enemies.length) {
      for (const w of mine) {
        if (wingRole(w) === 'fighter' && wingInRange(w, homeR)) this.setMission(w, 'superiority', homeR);
        else this.setMission(w, null);
      }
      return;
    }
    // regioni calde: dove si combatte con il nostro lato coinvolto
    const hot = new Map();
    for (const bt of S.battles) {
      let ours = false;
      for (const ti of [bt.to, ...bt.from]) for (const d of S.byTile.get(ti) || []) if (allied(d.owner, code)) ours = true;
      if (ours) { const r = regionOfTile(bt.to); hot.set(r, (hot.get(r) || 0) + 1); }
    }
    // in mancanza di battaglie: le regioni del fronte
    if (!hot.size) {
      for (const t of S.tiles) {
        if (!t.land || !allied(t.ctrl, code)) continue;
        if (t.nb.some(n => S.tiles[n].land && enemies.includes(S.tiles[n].ctrl))) { const r = regionOfTile(t.i); hot.set(r, (hot.get(r) || 0) + 0.2); }
      }
    }
    const hotList = [...hot].sort((a, b) => b[1] - a[1]).map(x => x[0]);
    // bersagli strategici e navali
    const stratVal = new Map(), navVal = new Map();
    for (const t of S.tiles) {
      if (t.land && enemies.includes(t.ctrl)) { const r = regionOfTile(t.i); stratVal.set(r, (stratVal.get(r) || 0) + 1 + t.vp * 2); }
    }
    for (const f of S.an.fleets) {
      if (!enemies.includes(f.owner) || f.state === 'port') continue;
      navVal.set(f.region, (navVal.get(f.region) || 0) + f.ships.length);
    }
    for (const r of S.an.regions) {
      if (!r.sea) continue;
      for (const n of r.nb) {
        const rn = regionById(n);
        if (!rn.sea && enemies.includes(rn.mainOwner)) navVal.set(r.id, (navVal.get(r.id) || 0) + 0.5);
      }
    }
    const pick = (w, list, mission) => {
      for (const rid of list) {
        if (wingInRange(w, rid)) return this.setMission(w, mission, rid);
        const nb = this.bestBaseFor(code, rid, wingStats(w).range);
        if (nb >= 0) { w.base = nb; return this.setMission(w, mission, rid); }
      }
      return false;
    };
    const stratList = [...stratVal].sort((a, b) => b[1] - a[1]).map(x => x[0]);
    const navList = [...navVal].sort((a, b) => b[1] - a[1]).map(x => x[0]);
    let fi = 0;
    for (const w of mine) {
      const role = wingRole(w);
      let ok = false;
      if (role === 'fighter') {
        ok = fi++ % 4 === 3 ? pick(w, [homeR, ...hotList], 'intercept') : pick(w, hotList, 'superiority');
        if (!ok) ok = pick(w, [homeR], 'intercept');
      } else if (role === 'cas') ok = pick(w, hotList, 'cas');
      else if (role === 'strat') ok = pick(w, stratList, 'strategic');
      else if (role === 'naval') ok = pick(w, navList, Math.random() < 0.7 ? 'naval' : 'patrol');
      if (!ok) this.setMission(w, null);
    }
  },

  bestBaseFor(code, rid, range) {
    let best = -1, bd = Infinity;
    for (const b of airBases(code)) {
      const d = regionDistKm(b, rid);
      if (d <= range && d < bd) { bd = d; best = b; }
    }
    return best;
  },
};
