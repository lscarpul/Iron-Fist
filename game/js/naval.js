'use strict';

// Guerra navale: flotte in zone di mare, avvistamento, battaglie con linee (schermo, navi capitali,
// portaerei, sottomarini), corazza contro perforazione, guerra ai convogli e supremazia navale.

const shipStat = s => designOf(s.design).stats;
const shipLine = s => HULLS[designOf(s.design).type].line;
const isSub = s => shipLine(s) === 'sub';
const pierceFactor = (prc, armor) => prc >= armor ? 1 : 0.1 + 0.9 * (prc / armor) ** 3;

function fleetHpFrac(f) {
  let h = 0, m = 0;
  for (const s of f.ships) { h += s.hp; m += shipStat(s).hp; }
  return m ? h / m : 0;
}
function fleetSpeed(f) {
  let v = Infinity;
  for (const s of f.ships) v = Math.min(v, shipStat(s).speed);
  return isFinite(v) ? v : 20;
}
function fleetCounts(f) {
  const n = {};
  for (const s of f.ships) { const t = designOf(s.design).type; n[t] = (n[t] || 0) + 1; }
  return n;
}
function fleetSummary(f) {
  const n = fleetCounts(f);
  return HULL_ORDER.filter(t => n[t]).map(t => `${n[t]} ${HULLS[t].short}`).join(' · ') || 'vuota';
}
function shipPower(s) {
  const st = shipStat(s);
  return (s.hp / st.hp) * (st.lAtk + st.hAtk * 2 + st.torp * 0.5 + st.deck * 0.3 + 5);
}

// percorso tra zone di mare (BFS)
function seaPath(from, to) {
  if (from === to) return [];
  const prev = new Map([[from, -1]]), q = [from];
  while (q.length) {
    const u = q.shift();
    for (const v of regionById(u).nb) {
      if (prev.has(v) || !regionById(v).sea) continue;
      prev.set(v, u);
      if (v === to) {
        const p = [];
        for (let x = to; x !== from; x = prev.get(x)) p.push(x);
        return p.reverse();
      }
      q.push(v);
    }
  }
  return null;
}

// quota di supremazia navale del lato di `owner` in una zona di mare
function anNavalShare(rid, owner) {
  const P = S.an && S.an.navPow[rid];
  if (!P) return 0.5;
  let mine = 0, foe = 0;
  for (const o in P) {
    if (allied(o, owner) && !atWar(o, owner)) mine += P[o];
    else if (atWar(o, owner)) foe += P[o];
  }
  if (mine + foe < 1) return 0.5;
  return mine / (mine + foe);
}

function fleetVisible(f) {
  return allied(f.owner, S.player) || f.battle != null || (f.spotted != null && S.day - f.spotted <= 3);
}

const MISSION_PRESENCE = { strike: 1, patrol: 0.8, escort: 0.6, raid: 0.3, idle: 0.2 };
const DET_MULT = { patrol: 2.5, strike: 1, escort: 1, raid: 0.4, idle: 0.6 };

AN.naval = {
  init() {
    for (const code in S.countries) {
      const c = C(code), nv = START_NAVY[code];
      for (const h in HULLS) ensureDefaultDesign(c, 'naval', h);
      if (!nv || !c.ports.length) continue;
      const home = this.bestPort(code);
      const surf = HULL_ORDER.filter(h => h !== 'ss' && nv[h]);
      if (surf.length) {
        const f = this.newFleet(code, home, 'Flotta');
        for (const h of surf) for (let i = 0; i < nv[h]; i++) this.addShip(f, ensureDefaultDesign(c, 'naval', h));
      }
      if (nv.ss) {
        const f = this.newFleet(code, home, 'Flottiglia sommergibili');
        for (let i = 0; i < nv.ss; i++) this.addShip(f, ensureDefaultDesign(c, 'naval', 'ss'));
      }
    }
    this.updateTraffic();
  },

  bestPort(code, near) {
    const c = C(code);
    const ref = near != null ? near : c.capital;
    let best = -1, bd = Infinity;
    for (const p of c.ports) {
      const d = tileDistKm(p, ref) - S.tiles[p].vp * 20;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  },

  newFleet(code, home, kind) {
    const c = C(code);
    c.fleetCounter = (c.fleetCounter || 0) + 1;
    const f = {
      id: S.an.nextId++, owner: code, name: `${c.fleetCounter}ª ${kind}`, ships: [], home,
      region: portSeaRegion(home), inPort: true, path: [], moveKm: 0, goal: null, mission: 'idle',
      repairing: false, battle: null, spotted: null,
    };
    S.an.fleets.push(f);
    return f;
  },
  addShip(f, d) {
    const c = C(f.owner);
    d.built = (d.built || 0) + 1;
    f.ships.push({ id: S.an.nextId++, design: d.id, hp: d.stats.hp, name: `${d.name} n° ${d.built}` });
  },
  launchShip(c, d) {
    const home = this.bestPort(c.code);
    if (home < 0) return;
    const sub = d.type === 'ss';
    let f = S.an.fleets.find(f => f.owner === c.code && f.inPort && f.home === home && f.mission === 'idle' && f.ships.length && f.ships.every(s => isSub(s) === sub) && f.reserve);
    if (!f) { f = this.newFleet(c.code, home, sub ? 'Flottiglia sommergibili' : 'Flotta'); f.reserve = true; }
    this.addShip(f, d);
    if (c.code === S.player) log(`Varata la nave ${f.ships[f.ships.length - 1].name} (${HULLS[d.type].name}).`, 'good');
  },

  // quota del traffico mercantile di ogni paese che passa per ogni zona di mare
  updateTraffic() {
    for (const code in S.countries) {
      const c = C(code);
      const cnt = {};
      let tot = 0;
      for (const p of c.ports) for (const n of S.tiles[p].nb) if (!S.tiles[n].land) { const r = regionOfTile(n); cnt[r] = (cnt[r] || 0) + 1; tot++; }
      c.traffic = {};
      for (const r in cnt) c.traffic[r] = cnt[r] / tot;
    }
  },

  step() {
    const A = S.an;
    if (S.day % 10 === 0) this.updateTraffic();
    // fabbisogno di convogli: commercio + divisioni in mare
    const atSea = {};
    for (const d of S.divs) if (!d.dead && !S.tiles[d.tile].land) atSea[d.owner] = (atSea[d.owner] || 0) + 1;
    for (const code in S.countries) {
      const c = C(code);
      if (!c.alive) continue;
      c.convoyNeed = c.ports.length ? Math.round((c.civ + c.mil) * (TRADE_DEP[code] != null ? TRADE_DEP[code] : 0.6)) + (atSea[code] || 0) * 2 : 0;
    }
    for (const f of A.fleets) this.fleetDaily(f);
    A.fleets = A.fleets.filter(f => !f.dead && f.ships.length);

    // presenza navale per zona
    A.navPow = [];
    for (const f of A.fleets) {
      if (f.inPort) continue;
      const P = A.navPow[f.region] || (A.navPow[f.region] = {});
      let p = 0;
      for (const s of f.ships) p += shipPower(s);
      P[f.owner] = (P[f.owner] || 0) + p * MISSION_PRESENCE[f.mission];
    }
    for (const w of A.wings) {
      if (!wingActive(w) || (w.mission !== 'naval' && w.mission !== 'patrol')) continue;
      const P = A.navPow[w.region] || (A.navPow[w.region] = {});
      P[w.owner] = (P[w.owner] || 0) + w.planes * wingStats(w).naval * 0.05;
    }

    this.spotting();
    for (const b of A.battles) this.battleDay(b);
    A.battles = A.battles.filter(b => !b.over);
    this.convoyWar();
    this.seaTransport();
    this.shoreSupport();
    A.fleets = A.fleets.filter(f => !f.dead && f.ships.length);
  },

  fleetDaily(f) {
    const c = C(f.owner);
    if (!c.alive) { f.dead = true; return; }
    if (S.tiles[f.home].ctrl !== f.owner) {
      const np = this.bestPort(f.owner, f.home);
      if (np < 0) { f.dead = true; if (f.owner === S.player) log(`${f.name} non ha più porti: la flotta si autoaffonda.`, 'bad'); return; }
      f.home = np;
      if (f.inPort) f.region = portSeaRegion(np);
    }
    if (f.battle != null) return;
    const hp = fleetHpFrac(f);
    if (!f.repairing && hp < 0.5 && f.mission !== 'idle') {
      f.repairing = true;
      if (f.owner === S.player) log(`${f.name} rientra in porto per riparazioni.`, 'warn');
    }
    if (f.repairing && hp >= 0.95) f.repairing = false;
    if (f.inPort) {
      // riparazioni in porto, più rapide con molti cantieri
      for (const s of f.ships) s.hp = Math.min(shipStat(s).hp, s.hp + shipStat(s).hp * (0.025 + Math.min(0.03, c.dock * 0.002)));
    }
    const wantPort = f.mission === 'idle' || f.repairing || f.goal == null;
    const dest = wantPort ? portSeaRegion(f.home) : f.goal;
    if (f.inPort) {
      if (wantPort) return;
      f.inPort = false; f.region = portSeaRegion(f.home); f.path = seaPath(f.region, dest) || []; f.moveKm = 0;
    }
    if (f.region !== dest && (!f.path.length || f.path[f.path.length - 1] !== dest)) { f.path = seaPath(f.region, dest) || []; f.moveKm = 0; }
    if (f.path.length) {
      f.moveKm += fleetSpeed(f) * 1.852 * 24 * 0.45;
      const next = f.path[0];
      const hop = Math.hypot(regionById(next).cx - regionById(f.region).cx, regionById(next).cy - regionById(f.region).cy) / (HEX * SQ3) * KM_PER_HEX;
      if (f.moveKm >= hop) { f.moveKm -= hop; f.region = next; f.path.shift(); }
    } else if (f.region === dest && wantPort) {
      f.inPort = true; f.moveKm = 0;
    }
    // le flotte in mare consumano carburante, se il sistema economico lo gestisce
    if (!f.inPort && typeof c.fuel === 'number') c.fuel = Math.max(0, c.fuel - f.ships.length * 0.2);
  },

  // ---------- avvistamento e inizio delle battaglie ----------
  spotting() {
    const A = S.an;
    const byR = new Map();
    for (const f of A.fleets) {
      if (f.inPort) continue;
      let a = byR.get(f.region);
      if (!a) { a = []; byR.set(f.region, a); }
      a.push(f);
    }
    const airDet = new Map();
    for (const w of A.wings) {
      if (!wingActive(w) || (w.mission !== 'naval' && w.mission !== 'patrol')) continue;
      const key = w.region + ':' + w.owner;
      airDet.set(key, (airDet.get(key) || 0) + w.planes * (w.mission === 'patrol' ? 0.02 : 0.008));
    }
    for (const [rid, fs] of byR) {
      for (const f of fs) {
        if (f.battle != null) continue;
        const enemies = fs.filter(g => atWar(g.owner, f.owner));
        let surfDet = 0, subDet = 0;
        for (const g of enemies) for (const s of g.ships) {
          const st = shipStat(s), m = DET_MULT[g.mission];
          surfDet += st.surfDet * m * 0.01; subDet += st.subDet * m * 0.01;
        }
        const owners = new Set(Object.keys(S.countries).filter(o => atWar(o, f.owner)));
        for (const o of owners) surfDet += airDet.get(rid + ':' + o) || 0;
        if (surfDet + subDet <= 0) continue;
        const surf = f.ships.filter(s => !isSub(s)), subs = f.ships.filter(isSub);
        let p;
        if (surf.length) p = 1 - Math.exp(-12 * surfDet / Math.max(...surf.map(s => shipStat(s).vis)));
        else p = 1 - Math.exp(-12 * subDet / Math.max(1, Math.min(...subs.map(s => shipStat(s).subVis))));
        if (Math.random() >= p) continue;
        f.spotted = S.day;
        // le flotte nemiche in grado di combattere ingaggiano
        const hunters = enemies.filter(g => g.battle == null && (g.mission === 'strike' || g.mission === 'patrol' || g.mission === 'escort' || (g.mission === 'raid' && g.ships.some(s => !isSub(s)))));
        if (hunters.length) this.startBattle(rid, hunters[0].owner, fs);
      }
    }
  },

  startBattle(rid, x, fs) {
    const a = fs.filter(g => g.battle == null && allied(g.owner, x) && !atWar(g.owner, x));
    const b = fs.filter(g => g.battle == null && atWar(g.owner, x));
    if (!a.length || !b.length) return;
    const bt = { id: S.an.nextId++, region: rid, a: a.map(f => f.id), b: b.map(f => f.id), day: 0, sunk: { a: 0, b: 0 }, over: false };
    for (const f of [...a, ...b]) f.battle = bt.id;
    bt.hp0 = { a: this.sideHp(bt, 'a'), b: this.sideHp(bt, 'b') };
    bt.n0 = { a: this.sideShips(bt, 'a').length, b: this.sideShips(bt, 'b').length };
    S.an.battles.push(bt);
    const me = [...a, ...b].some(f => allied(f.owner, S.player));
    if (me) log(`Battaglia navale ${seaIn(rid)}!`, 'big');
  },
  sideFleets(bt, side) { return bt[side].map(id => S.an.fleets.find(f => f.id === id)).filter(f => f && !f.dead && f.battle === bt.id); },
  sideShips(bt, side) { return this.sideFleets(bt, side).flatMap(f => f.ships); },
  sideHp(bt, side) { let h = 0; for (const s of this.sideShips(bt, side)) h += s.hp; return h; },

  // ---------- battaglia: 4 scontri al giorno ----------
  battleDay(bt) {
    bt.day++;
    for (let round = 1; round <= 4; round++) {
      const A = this.sideShips(bt, 'a'), B = this.sideShips(bt, 'b');
      if (!A.length || !B.length) break;
      const detA = this.detectSubs(A, B), detB = this.detectSubs(B, A);
      const dmgB = this.fire(A, B, detB, round), dmgA = this.fire(B, A, detA, round);
      this.applyDamage(bt, 'b', dmgB);
      this.applyDamage(bt, 'a', dmgA);
    }
    // ritirata: chi ha perso troppo, o dopo 3 giorni chi sta peggio
    const ra = this.sideHp(bt, 'a') / Math.max(1, bt.hp0.a), rb = this.sideHp(bt, 'b') / Math.max(1, bt.hp0.b);
    let loser = null;
    if (!this.sideShips(bt, 'a').length) loser = 'a';
    else if (!this.sideShips(bt, 'b').length) loser = 'b';
    else if (ra < 0.6 || rb < 0.6) loser = ra < rb ? 'a' : 'b';
    else if (bt.day >= 3) loser = ra < rb ? 'a' : 'b';
    if (!loser) return;
    for (const side of ['a', 'b']) for (const f of this.sideFleets(bt, side)) {
      f.battle = null;
      if (side === loser) { f.repairing = true; f.path = []; }
    }
    bt.over = true;
    const all = [...bt.a, ...bt.b].map(id => S.an.fleets.find(f => f.id === id)).filter(Boolean);
    const mySide = all.some(f => bt.a.includes(f.id) && allied(f.owner, S.player)) ? 'a' : all.some(f => bt.b.includes(f.id) && allied(f.owner, S.player)) ? 'b' : null;
    if (mySide) {
      const foe = mySide === 'a' ? 'b' : 'a';
      const won = loser === foe;
      log(`Battaglia ${seaIn(bt.region, 'del')} ${won ? 'vinta' : 'persa'}: affondate ${bt.sunk[foe]} navi nemiche, perse ${bt.sunk[mySide]}.`, won ? 'good' : 'bad');
    }
  },

  detectSubs(hunters, prey) {
    let det = 0;
    for (const s of hunters) det += shipStat(s).subDet * 0.01;
    const out = new Set();
    for (const s of prey) {
      if (!isSub(s)) continue;
      const p = 1 - Math.exp(-12 * det / Math.max(1, shipStat(s).subVis));
      if (Math.random() < p) out.add(s);
    }
    return out;
  },

  // `detected`: sottomarini di `foes` visibili a chi spara
  fire(shooters, foes, detected, round) {
    const dmg = new Map();
    const add = (t, d) => dmg.set(t, (dmg.get(t) || 0) + d);
    const screens = foes.filter(s => shipLine(s) === 'screen');
    const caps = foes.filter(s => shipLine(s) === 'capital' || shipLine(s) === 'carrier');
    const subsVis = foes.filter(s => isSub(s) && detected.has(s));
    // efficienza dello schermo: servono 3 navi di scorta per ogni nave capitale o portaerei
    const screening = caps.length ? Math.min(1, screens.length / (3 * caps.length)) : 1;
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const surfaceTarget = (capWeight) => {
      if (!screens.length) return caps.length ? pick(caps) : null;
      if (!caps.length) return pick(screens);
      return Math.random() < capWeight ? pick(caps) : pick(screens);
    };
    // contraerea della flotta bersaglio (riduce gli attacchi delle portaerei)
    let aa = 0;
    for (const s of foes) aa += shipStat(s).aa;
    const aaRed = Math.min(0.6, aa / (aa + 150));
    for (const s of shooters) {
      const st = shipStat(s);
      if (isSub(s)) {
        // i sottomarini colpiscono le navi capitali se lo schermo è insufficiente
        const t = surfaceTarget(1 - screening);
        if (t && st.torp && Math.random() < (round === 1 ? 0.25 : 0.15)) add(t, st.torp * pierceFactor(150, shipStat(t).armor));
        continue;
      }
      if (st.deck && round === 1) {
        for (let k = 0; k < 3; k++) { const t = surfaceTarget(0.6); if (t) add(t, st.deck * 0.15 * (1 - aaRed) * pierceFactor(120, shipStat(t).armor)); }
      }
      if (st.hAtk) {
        const t = surfaceTarget(0.65);
        if (t && Math.random() < 0.14) add(t, st.hAtk * pierceFactor(st.hPrc, shipStat(t).armor));
      }
      if (st.lAtk) {
        const t = surfaceTarget((1 - screening) * 0.5);
        if (t && Math.random() < 0.2) add(t, st.lAtk * pierceFactor(st.lPrc, shipStat(t).armor));
      }
      if (st.torp && round <= 2) {
        const t = surfaceTarget((1 - screening) * 0.8);
        if (t && Math.random() < 0.1) add(t, st.torp * pierceFactor(150, shipStat(t).armor));
      }
      if (st.subAtk && subsVis.length && Math.random() < 0.25) add(pick(subsVis), st.subAtk * 1.5);
    }
    return dmg;
  },

  applyDamage(bt, side, dmg) {
    for (const [s, d] of dmg) s.hp -= d * (0.8 + Math.random() * 0.4);
    for (const f of this.sideFleets(bt, side)) {
      const before = f.ships.length;
      const sunk = f.ships.filter(s => s.hp <= 0);
      f.ships = f.ships.filter(s => s.hp > 0);
      bt.sunk[side] += before - f.ships.length;
      if (f.owner === S.player) for (const s of sunk) if (shipLine(s) !== 'screen' && shipLine(s) !== 'sub') log(`Affondata la nave ${s.name} (${HULLS[designOf(s.design).type].name})!`, 'bad');
      if (!f.ships.length) f.dead = true;
    }
  },

  // ---------- attacco aereo contro le navi ----------
  airStrike(w, rid, power) {
    const targets = S.an.fleets.filter(f => !f.inPort && f.region === rid && atWar(f.owner, w.owner) && f.ships.some(s => !isSub(s)));
    // i bombardieri navali cercano da soli: se la flotta non è avvistata hanno una possibilità su due
    const seen = targets.filter(f => (f.spotted != null && S.day - f.spotted <= 1) || Math.random() < 0.5);
    if (!seen.length) {
      // nessuna flotta: si colpiscono i convogli che passano
      for (const code in S.countries) {
        const c = C(code);
        if (!atWar(code, w.owner) || !c.traffic || !c.traffic[rid] || c.convoys <= 0) continue;
        const k = Math.min(c.convoys, power * 0.0004 * c.traffic[rid] * Math.random() * 2);
        c.convoys -= k; c.convoysLost += k;
      }
      return;
    }
    const f = seen[Math.floor(Math.random() * seen.length)];
    f.spotted = S.day;
    let aa = 0;
    for (const s of f.ships) aa += shipStat(s).aa;
    const aaRed = Math.min(0.6, aa / (aa + 150));
    const surf = f.ships.filter(s => !isSub(s));
    const hits = 3 + Math.floor(w.planes / 15);
    for (let k = 0; k < hits; k++) {
      const s = surf[Math.floor(Math.random() * surf.length)];
      s.hp -= power * 0.012 / hits * (1 - aaRed) * pierceFactor(110, shipStat(s).armor) * (0.6 + Math.random() * 0.8);
    }
    const sunk = f.ships.filter(s => s.hp <= 0);
    f.ships = f.ships.filter(s => s.hp > 0);
    if (!f.ships.length) f.dead = true;
    if (sunk.length && (f.owner === S.player || w.owner === S.player)) {
      log(`Attacco aereo ${seaIn(rid)}: ${sunk.length} navi di ${C(f.owner).name} affondate.`, f.owner === S.player ? 'bad' : 'good');
    }
    AN.air.loseToAA(w, Math.min(0.08, aa * 0.0003));
  },

  // ---------- guerra ai convogli ----------
  convoyWar() {
    for (const g of S.an.fleets) {
      if (g.inPort || g.mission !== 'raid' || g.battle != null || g.region !== g.goal) continue;
      const rid = g.region;
      let raid = 0;
      for (const s of g.ships) { const st = shipStat(s); raid += isSub(s) ? st.torp : st.lAtk * 0.5; }
      for (const code in S.countries) {
        const X = C(code);
        if (!X.alive || !atWar(code, g.owner) || !X.traffic || !X.traffic[rid] || X.convoys <= 0) continue;
        // scorte del lato di X nella zona
        let esc = 0;
        for (const e of S.an.fleets) {
          if (e.inPort || e.region !== rid || e.mission !== 'escort' || !allied(e.owner, code) || atWar(e.owner, code)) continue;
          for (const s of e.ships) { const st = shipStat(s); esc += st.subDet + st.subAtk + st.lAtk * 0.2; }
        }
        for (const w of S.an.wings) if (wingActive(w) && w.region === rid && w.mission === 'patrol' && allied(w.owner, code) && !atWar(w.owner, code)) esc += w.planes * 0.05;
        const escEff = esc / (esc + 60);
        const sunk = Math.min(X.convoys, raid * 0.004 * X.traffic[rid] * (1 - escEff * 0.8) * (0.5 + Math.random()));
        X.convoys -= sunk; X.convoysLost += sunk;
        if (code === S.player && sunk >= 1 && Math.random() < 0.15) log(`I sottomarini nemici affondano i nostri convogli ${seaIn(rid)}.`, 'warn');
        // le scorte contrattaccano
        if (esc > 0) {
          g.spotted = S.day;
          const dmg = esc * 0.03 * Math.random();
          const s = g.ships[Math.floor(Math.random() * g.ships.length)];
          s.hp -= dmg;
          if (s.hp <= 0) {
            g.ships = g.ships.filter(x => x !== s);
            if (g.owner === S.player) log(`${s.name} affondato dalle scorte nemiche.`, 'bad');
            if (!g.ships.length) { g.dead = true; break; }
          }
        }
      }
    }
  },

  // le divisioni in mare rischiano di essere affondate se il nemico domina la zona
  seaTransport() {
    for (const d of S.divs) {
      if (d.dead || S.tiles[d.tile].land) continue;
      const rid = regionOfTile(d.tile);
      const P = S.an.navPow[rid];
      if (!P) continue;
      let foePow = 0;
      for (const o in P) if (atWar(o, d.owner)) foePow += P[o];
      const foe = 1 - anNavalShare(rid, d.owner);
      if (foe <= 0.5 || foePow < 20) continue;
      if (Math.random() < (foe - 0.5) * 0.12) {
        destroyDiv(d);
        if (involvesPlayer(d.owner) || atWar(d.owner, S.player)) log(`${divName(d)} di ${C(d.owner).name} affondata durante la traversata ${seaIn(rid)}.`, d.owner === S.player ? 'bad' : allied(d.owner, S.player) ? 'warn' : 'good');
      }
    }
  },

  // bombardamento costiero: chi domina il mare vicino logora le divisioni nemiche sulla costa
  shoreSupport() {
    for (const bt of S.battles) {
      const t = S.tiles[bt.to];
      if (!t.coastal) continue;
      const seaR = portSeaRegion(bt.to);
      if (seaR < 0 || !S.an.navPow[seaR]) continue;
      for (const d of S.byTile.get(bt.to) || []) {
        if (d.dead) continue;
        const foe = 1 - anNavalShare(seaR, d.owner);
        if (foe > 0.6) d.org = Math.max(0, d.org - UNIT_TYPES[d.type].org * 0.025 * (foe - 0.6) / 0.4);
      }
    }
  },

  // ---------- azioni (giocatore e IA) ----------
  setMission(f, mission, rid) {
    if (mission === 'idle') { f.mission = 'idle'; f.goal = null; return true; }
    if (rid == null || !regionById(rid).sea) return false;
    const from = f.inPort ? portSeaRegion(f.home) : f.region;
    if (seaPath(from, rid) === null) return false;
    f.mission = mission; f.goal = rid; f.reserve = false;
    return true;
  },
  split(f, how) {
    let take;
    if (how === 'subs') take = f.ships.filter(isSub);
    else if (how === 'screens') take = f.ships.filter(s => shipLine(s) === 'screen');
    else take = f.ships.filter((s, i) => i % 2 === 1);
    if (!take.length || take.length === f.ships.length) return null;
    const g = this.newFleet(f.owner, f.home, take.every(isSub) ? 'Flottiglia sommergibili' : 'Flotta');
    Object.assign(g, { region: f.region, inPort: f.inPort, mission: f.mission, goal: f.goal, path: [...f.path], moveKm: f.moveKm });
    g.ships = take;
    f.ships = f.ships.filter(s => !take.includes(s));
    return g;
  },
  mergeHere(f) {
    const others = S.an.fleets.filter(g => g !== f && g.owner === f.owner && g.battle == null && f.battle == null &&
      (f.inPort ? g.inPort && g.home === f.home : !g.inPort && g.region === f.region));
    for (const g of others) { f.ships.push(...g.ships); g.ships = []; g.dead = true; }
    S.an.fleets = S.an.fleets.filter(g => !g.dead);
    return others.length;
  },

  // ---------- intelligenza artificiale ----------
  ai(c) {
    const code = c.code;
    if (!c.ports.length) return;
    // produzione navale
    if (c.dock > 0) {
      const free = () => c.dock - docksUsed(c);
      if (c.convoys < c.convoyNeed * 1.2 && !c.navLines.some(l => l.design === 'convoy') && free() > 0) addNavLine(c, 'convoy', Math.min(3, free()), 10);
      if (free() > 0) {
        const mix = c.major ? AI_NAVY_MIX : { dd: 0.6, ss: 0.4 };
        const have = {};
        let tot = 0;
        for (const f of S.an.fleets) if (f.owner === code) for (const s of f.ships) { const t = designOf(s.design).type; have[t] = (have[t] || 0) + 1; tot++; }
        for (const l of c.navLines) if (l.design !== 'convoy') { const t = designOf(l.design).type; have[t] = (have[t] || 0) + l.left; tot += l.left; }
        let best = null, bd = -Infinity;
        for (const t in mix) {
          if (c.navLines.some(l => l.design !== 'convoy' && designOf(l.design).type === t)) continue;
          const def = mix[t] - (have[t] || 0) / Math.max(1, tot);
          if (def > bd) { bd = def; best = t; }
        }
        if (best) addNavLine(c, ensureDefaultDesign(c, 'naval', best).id, Math.min(MAX_DOCKS_PER_LINE, free()), best === 'dd' || best === 'ss' ? 3 : 1);
      }
    }
    // missioni delle flotte
    const fleets = S.an.fleets.filter(f => f.owner === code);
    const enemies = enemiesOf(code);
    if (!enemies.length) { for (const f of fleets) this.setMission(f, 'idle'); return; }
    // unisci le riserve in porto alla flotta principale
    for (const f of fleets) if (f.reserve && f.inPort) {
      const main = fleets.find(g => g !== f && !g.dead && g.inPort && g.home === f.home && g.ships.length && g.ships.every(s => isSub(s)) === f.ships.every(s => isSub(s)));
      if (main) { main.ships.push(...f.ships); f.ships = []; f.dead = true; }
    }
    S.an.fleets = S.an.fleets.filter(f => !f.dead);
    const home = portSeaRegion(this.bestPort(code));
    const scoreStrike = new Map(), scoreRaid = new Map();
    for (const r of S.an.regions) {
      if (!r.sea || seaPath(home, r.id) === null) continue;
      const dist = seaPath(home, r.id).length;
      let s = 0, raid = 0;
      for (const e of enemies) {
        const E = C(e);
        if (E.traffic && E.traffic[r.id]) { s += E.traffic[r.id] * 2; raid += E.traffic[r.id] * Math.max(1, E.convoys); }
      }
      if (c.traffic && c.traffic[r.id]) s += c.traffic[r.id] * 3;
      for (const f of S.an.fleets) if (enemies.includes(f.owner) && !f.inPort && f.region === r.id && fleetVisible(f)) s += 2;
      scoreStrike.set(r.id, s / (1 + dist * 0.4));
      scoreRaid.set(r.id, raid / (1 + dist * 0.3));
    }
    const best = m => [...m].sort((a, b) => b[1] - a[1]).filter(x => x[1] > 0).map(x => x[0]);
    const strikeList = best(scoreStrike), raidList = best(scoreRaid);
    const myTraffic = Object.entries(c.traffic || {}).sort((a, b) => b[1] - a[1]).map(x => +x[0]);
    let ri = 0;
    for (const f of S.an.fleets) {
      if (f.owner !== code || f.battle != null || f.repairing) continue;
      if (f.ships.every(isSub)) {
        if (raidList.length) this.setMission(f, 'raid', raidList[ri++ % Math.min(3, raidList.length)]);
      } else if (f.ships.length <= 6 && f.ships.every(s => shipLine(s) === 'screen') && myTraffic.length) {
        this.setMission(f, 'escort', myTraffic[0]);
      } else if (strikeList.length) {
        this.setMission(f, 'strike', strikeList[0]);
      }
    }
  },
};
