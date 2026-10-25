'use strict';
// Ordini all'esercito in stile HOI4: piani di battaglia (linea del fronte, linea d'offensiva, Esegui piano),
// bonus di pianificazione legato al piano, abilità del potere di comando (Attacco forzato, Ultima resistenza)
// e trasferimento strategico in treno.

const CP_ABILITY = {
  force: { name: 'Attacco forzato', icon: '⚔', cost: 25, days: 7, desc: 'Per 7 giorni le divisioni dell\'armata continuano ad attaccare anche senza organizzazione, ma subiscono perdite doppie.' },
  last: { name: 'Ultima resistenza', icon: '⛨', cost: 15, days: 7, desc: 'Per 7 giorni le divisioni dell\'armata non si ritirano: tengono la posizione fino alla distruzione.' },
};
const PLAN_CORRIDOR_KM = 220;  // larghezza (per lato) del corridoio di una linea d'offensiva
const PLAN_ATTACK_ORG = 0.6;   // il piano attacca solo con almeno il 60% di organizzazione
const PLAN_PATHS_PER_DAY = 40; // percorsi calcolati al giorno per paese (prestazioni)
const PLAN_ODDS = 1.3;         // rapporto di forza minimo per un attacco del piano

// ---------- abilità del potere di comando ----------
function divAbility(d) {
  if (d.army == null) return null;
  const a = armyById(C(d.owner), d.army);
  return a && a.ability && a.ability.until > S.day ? a.ability.kind : null;
}
function useAbility(c, aid, kind) {
  const a = armyById(c, aid), ab = CP_ABILITY[kind];
  if (!a || !ab) return { ok: false, msg: 'Armata o abilità sconosciuta.' };
  if (a.ability && a.ability.until > S.day) {
    if (a.ability.kind === kind) { a.ability = null; return { ok: true, msg: `${a.name}: ${ab.name} annullato.` }; }
    return { ok: false, msg: `${a.name} sta già usando ${CP_ABILITY[a.ability.kind].name}.` };
  }
  if (c.cp < ab.cost) return { ok: false, msg: `Servono ${ab.cost} punti di potere di comando.` };
  c.cp -= ab.cost;
  a.ability = { kind, until: S.day + ab.days };
  for (const d of armyDivs(c, a)) invalidateLand(d);
  return { ok: true, msg: `${a.name}: ${ab.name} per ${ab.days} giorni.` };
}
function abilityStep(c) {
  for (const a of c.armies) {
    if (!a.ability || a.ability.until > S.day) continue;
    if (c.code === S.player) log(`${a.name}: ${CP_ABILITY[a.ability.kind].name} terminato.`);
    a.ability = null;
  }
}

// ---------- trasferimento strategico ----------
// avanzamento giornaliero (in caselle) di un treno: veloce sulle ferrovie, lento senza
function stratSpeed(a, b) { return S.rail && S.rail[a] && S.rail[b] ? 3 : 0.8; }

// ---------- piani di battaglia ----------
const hostileTile = (ti, code) => { const t = S.tiles[ti]; return t.land && atWar(t.ctrl, code); };
const isFrontTile = (ti, code) => {
  const t = S.tiles[ti];
  return t.land && allied(t.ctrl, code) && t.nb.some(n => hostileTile(n, code));
};
function armyPlan(d) {
  if (d.army == null) return null;
  const a = armyById(C(d.owner), d.army);
  return a && a.plan ? a.plan : null;
}
// la divisione è ferma sulla linea del fronte del suo piano: accumula il bonus di pianificazione
function onBattlePlan(d) { return d.planTile != null && d.planTile === d.tile && !!armyPlan(d); }

// zona del piano: province disegnate + due anelli di vicine + corridoio dell'offensiva
function planZone(pl) {
  if (pl._zone && pl._zoneV === pl.v) return pl._zone;
  const z = new Set();
  for (const ti of pl.zone) z.add(ti);
  for (let r = 0; r < 2; r++) for (const ti of [...z]) for (const n of S.tiles[ti].nb) if (S.tiles[n].land) z.add(n);
  for (const ti of pl.corr || []) z.add(ti);
  Object.defineProperty(pl, '_zone', { value: z, writable: true, configurable: true, enumerable: false });
  pl._zoneV = pl.v;
  return z;
}
function corrSet(pl) {
  if (!pl._corr || pl._corrV !== pl.v) {
    Object.defineProperty(pl, '_corr', { value: new Set(pl.corr || []), writable: true, configurable: true, enumerable: false });
    pl._corrV = pl.v;
  }
  return pl._corr;
}
function newPlan(a) { return a.plan || (a.plan = { zone: [], off: [], corr: [], exec: false, front: [], wp: 0, v: 0 }); }

// Linea del fronte disegnata: le province toccate (amiche o nemiche) definiscono il tratto di confine
function setFrontline(c, aid, tiles) {
  const a = armyById(c, aid);
  if (!a) return { ok: false, msg: 'Armata sconosciuta.' };
  const land = [...new Set(tiles)].filter(ti => S.tiles[ti] && S.tiles[ti].land);
  if (!land.length) return { ok: false, msg: 'Disegna la linea del fronte sulla terraferma.' };
  const pl = newPlan(a);
  pl.zone = land; pl.v++;
  pl.front = [...planZone(pl)].filter(ti => isFrontTile(ti, c.code)); // subito visibile, anche in pausa
  const n = pl.front.length;
  return { ok: true, msg: n ? `${a.name}: linea del fronte di ${n} province.` : `${a.name}: linea del fronte disegnata (nessun nemico in guerra lungo il tratto, per ora).` };
}
// Clic su un paese nemico: tutto il confine con le province che controlla
function setFrontVs(c, aid, enemy) {
  const tiles = [];
  for (const t of S.tiles) if (t.land && allied(t.ctrl, c.code) && t.nb.some(n => S.tiles[n].land && S.tiles[n].ctrl === enemy)) tiles.push(t.i);
  if (!tiles.length) return { ok: false, msg: `Nessun confine con ${C(enemy).name}.` };
  return setFrontline(c, aid, tiles);
}

// percorso via terra (qualsiasi proprietario) tra due province, per la linea d'offensiva
function landLine(a, b) {
  if (a === b) return [a];
  const N = S.tiles.length, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), h = new MinHeap();
  dist[a] = 0; h.push(a, 0);
  while (h.size) {
    const u = h.pop(), du = h.lastK;
    if (du > dist[u]) continue;
    if (u === b) break;
    for (const v of S.tiles[u].nb) {
      if (!S.tiles[v].land) continue;
      const nd = du + landDistKm(u, v);
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; h.push(v, nd); }
    }
  }
  if (!isFinite(dist[b])) return [a, b];
  const p = [];
  for (let u = b; u !== a && u >= 0; u = prev[u]) p.push(u);
  p.push(a);
  return p.reverse();
}
// province entro `km` da un insieme di partenza (camminando sulla terraferma)
function landWithin(src, km) {
  const dist = new Map(), h = new MinHeap();
  for (const s of src) { dist.set(s, 0); h.push(s, 0); }
  while (h.size) {
    const u = h.pop(), du = h.lastK;
    if (du > (dist.get(u) ?? Infinity)) continue;
    for (const v of S.tiles[u].nb) {
      if (!S.tiles[v].land) continue;
      const nd = du + landDistKm(u, v);
      if (nd <= km && nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); h.push(v, nd); }
    }
  }
  return [...dist.keys()];
}
// Linea d'offensiva: punti (province) dal fronte verso l'obiettivo finale
function setOffensive(c, aid, pts) {
  const a = armyById(c, aid);
  if (!a) return { ok: false, msg: 'Armata sconosciuta.' };
  const wp = pts.filter(ti => S.tiles[ti] && S.tiles[ti].land);
  if (wp.length < 2) return { ok: false, msg: 'Trascina la freccia dal fronte dentro il territorio nemico.' };
  const pl = newPlan(a);
  if (!pl.zone.length) {
    // senza linea del fronte: si usa il confine vicino all'inizio della freccia
    const near = landWithin([wp[0]], 250).filter(ti => isFrontTile(ti, c.code));
    pl.zone = near.length ? near : [wp[0]];
  }
  let line = [];
  for (let i = 1; i < wp.length; i++) line = line.concat(landLine(wp[i - 1], wp[i]).slice(i > 1 ? 1 : 0));
  pl.off = wp.filter(ti => !allied(S.tiles[ti].ctrl, c.code));
  if (!pl.off.length) pl.off = [wp[wp.length - 1]];
  pl.corr = landWithin(line, PLAN_CORRIDOR_KM);
  pl.line = line;
  pl.wp = 0; pl.v++;
  pl.front = [...planZone(pl)].filter(ti => isFrontTile(ti, c.code));
  return { ok: true, msg: `${a.name}: linea d'offensiva verso ${S.tiles[wp[wp.length - 1]].city || MAP.states[S.tiles[wp[wp.length - 1]].state]?.name || 'l\'obiettivo'}.` };
}
function clearPlan(c, aid) {
  const a = armyById(c, aid);
  if (!a) return;
  a.plan = null;
  for (const d of armyDivs(c, a)) d.planTile = null;
}
function clearOffensive(c, aid) {
  const a = armyById(c, aid);
  if (!a || !a.plan) return;
  Object.assign(a.plan, { off: [], corr: [], line: [], exec: false, wp: 0 });
  a.plan.v++;
}
function setPlanExec(c, aid, on) {
  const a = armyById(c, aid);
  if (!a || !a.plan) return { ok: false, msg: 'Prima disegna una linea del fronte.' };
  a.plan.exec = on;
  return { ok: true, msg: `${a.name}: ${on ? 'piano in esecuzione' : 'piano in attesa (le divisioni tengono il fronte)'}.` };
}

// minaccia su una provincia del fronte: divisioni nemiche nelle vicine
function frontThreat(ti, code) {
  let v = S.tiles[ti].vp / 5;
  for (const n of S.tiles[ti].nb) {
    if (!hostileTile(n, code)) continue;
    v += 0.5;
    for (const d of S.byTile.get(n) || []) if (!d.dead && atWar(d.owner, code)) v += 1;
  }
  return v;
}

// componenti di territorio amico collegate via terra: il piano non manda divisioni per mare
function friendlyLandComp(code) {
  const T = S.tiles, comp = new Int32Array(T.length).fill(-1);
  let k = 0;
  for (const t of T) {
    if (comp[t.i] >= 0 || !t.land || !allied(t.ctrl, code)) continue;
    const st = [t.i];
    comp[t.i] = k;
    while (st.length) {
      const u = st.pop();
      for (const v of T[u].nb) if (comp[v] < 0 && T[v].land && allied(T[v].ctrl, code)) { comp[v] = k; st.push(v); }
    }
    k++;
  }
  return comp;
}

function battlePlanStep(c) {
  if (!c.armies.some(a => a.plan)) return;
  let budget = PLAN_PATHS_PER_DAY;
  const comp = friendlyLandComp(c.code);
  for (const a of c.armies) {
    const pl = a.plan;
    if (!pl) continue;
    const zone = planZone(pl);
    const F = [...zone].filter(ti => isFrontTile(ti, c.code));
    pl.front = F;
    const divs = armyDivs(c, a).filter(d => S.tiles[d.tile].land);
    if (!F.length || !divs.length) { for (const d of divs) d.planTile = null; continue; }
    // quote: divisioni distribuite su tutto il fronte, di più dove la minaccia è maggiore
    const thr = new Map(F.map(ti => [ti, frontThreat(ti, c.code)]));
    const order = F.slice().sort((x, y) => thr.get(y) - thr.get(x));
    const base = Math.floor(divs.length / F.length), extra = divs.length % F.length;
    const quota = new Map(order.map((ti, i) => [ti, base + (i < extra ? 1 : 0)]));
    const used = new Map();
    const free = [];
    for (const d of divs) {
      const q = quota.get(d.planTile);
      if (q && comp[d.planTile] === comp[d.tile] && (used.get(d.planTile) || 0) < q) used.set(d.planTile, (used.get(d.planTile) || 0) + 1);
      else free.push(d);
    }
    for (const d of free) {
      let best = -1, bd = Infinity;
      for (const ti of order) {
        if ((used.get(ti) || 0) >= quota.get(ti) || comp[ti] !== comp[d.tile]) continue;
        const k = landDistKm(d.tile, ti);
        if (k < bd) { bd = k; best = ti; }
      }
      d.planTile = best >= 0 ? best : null;
      if (best >= 0) used.set(best, (used.get(best) || 0) + 1);
    }
    // schieramento: chi non è al suo posto ci va (solo in territorio amico)
    for (const d of divs) {
      if (d.combat || d.path.length || d.planTile == null || d.tile === d.planTile || budget <= 0) continue;
      budget--;
      const p = buildPath(dijkstra(c.code, d.tile, d.planTile, true).prev, d.tile, d.planTile);
      if (p && p.length && p.every(ti => S.tiles[ti].land)) { d.path = p; d.prog = 0; d.strat = false; }
      else d.planTile = null;
    }
    if (!pl.exec) continue;
    // esecuzione: si avanza lungo la freccia (o, senza freccia, contro i punti più deboli del fronte)
    while (pl.off.length && pl.wp < pl.off.length && allied(S.tiles[pl.off[pl.wp]].ctrl, c.code)) pl.wp++;
    if (pl.off.length && pl.wp >= pl.off.length) {
      pl.exec = false;
      if (c.code === S.player) log(`${a.name}: obiettivo dell'offensiva raggiunto.`, 'good');
      continue;
    }
    const tgt = pl.off.length ? pl.off[pl.wp] : -1, corr = pl.off.length ? corrSet(pl) : null;
    // bersagli possibili per ogni divisione pronta (niente attacchi all'indietro)
    const opts = new Map(); // provincia nemica -> divisioni che possono attaccarla
    for (const d of divs) {
      if (d.combat || d.path.length || d.tile !== d.planTile || d.strat) continue;
      if (d.org < divMaxOrg(d) * PLAN_ATTACK_ORG || d.str < 0.3) continue;
      const here = tgt >= 0 ? landDistKm(d.tile, tgt) : 0;
      for (const n of S.tiles[d.tile].nb) {
        if (!hostileTile(n, c.code) || !passable(c.code, S.tiles[n])) continue;
        if (tgt >= 0) {
          const k = landDistKm(n, tgt);
          // nel corridoio della freccia si attacca tutto ciò che non porta indietro; fuori, solo verso l'obiettivo
          if (corr.has(n) ? k > here + 60 : k > here - 20) continue;
        }
        let l = opts.get(n);
        if (!l) opts.set(n, l = []);
        l.push(d);
      }
    }
    const busy = new Set();
    const score = n => (tgt >= 0 ? landDistKm(n, tgt) : 0);
    // prima le province nemiche sguarnite: basta una divisione
    for (const n of [...opts.keys()].filter(n => !hasHostile(n, c.code)).sort((x, y) => score(x) - score(y))) {
      const d = opts.get(n).find(x => !busy.has(x));
      if (d) { d.path = [n]; d.prog = 0; busy.add(d); }
    }
    // poi gli attacchi veri: tutte le divisioni adiacenti insieme (da più direzioni), solo se conviene
    for (const n of [...opts.keys()].filter(n => hasHostile(n, c.code)).sort((x, y) => score(x) - score(y))) {
      const g = opts.get(n).filter(x => !busy.has(x));
      if (!g.length) continue;
      let A = 0;
      for (const d of g) A += atkValue(d, n) * (1 + (d.plan || 0));
      A *= 1 + 0.05 * Math.min(3, new Set(g.map(d => d.tile)).size - 1);
      if (A < PLAN_ODDS * Math.max(0.5, defValue(n, c.code))) continue;
      for (const d of g) { d.path = [n]; d.prog = 0; busy.add(d); }
    }
  }
}

// provincia "centrale" di un gruppo di divisioni (per centrare la camera): quella più vicina alle altre
function groupCenterTile(divs) {
  let best = divs[0].tile, bs = Infinity;
  const pts = divs.slice(0, 80).map(d => S.tiles[d.tile]);
  for (const a of pts) {
    let s = 0;
    for (const b of pts) s += Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
    if (s < bs) { bs = s; best = a.i; }
  }
  return best;
}
