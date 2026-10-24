'use strict';
// Logistica stile HOI4: capitale → ferrovie → hub di rifornimento → ultimo miglio (cavalli o camion).
// Meteo (pioggia, fango, neve) e infrastrutture modificano movimento, rifornimenti e logorio.

// ---------- generazione di ferrovie, infrastrutture e hub ----------
function landPathCost(t) {
  return { plains: 1, forest: 1.6, hills: 2.2, mountain: 4.5 }[t.terrain] || 1.5;
}
// Dijkstra generico su esagoni di terra che soddisfano ok(t); ritorna prev
function landDijkstra(src, ok, costFn) {
  const N = S.tiles.length;
  const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const h = new MinHeap();
  dist[src] = 0; h.push(src, 0);
  while (h.size) {
    const u = h.pop(), du = h.lastK;
    if (du > dist[u]) continue;
    for (const v of S.tiles[u].nb) {
      const tv = S.tiles[v];
      if (!tv.land || !ok(tv)) continue;
      const nd = du + costFn(tv);
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; h.push(v, nd); }
    }
  }
  return { dist, prev };
}
function hopsFrom(srcs, ok, maxHops = 99) {
  const N = S.tiles.length, d = new Int16Array(N).fill(-1), q = [];
  for (const s of srcs) { d[s] = 0; q.push(s); }
  for (let i = 0; i < q.length; i++) {
    const u = q[i];
    if (d[u] >= maxHops) continue;
    for (const v of S.tiles[u].nb) if (d[v] < 0 && S.tiles[v].land && ok(S.tiles[v])) { d[v] = d[u] + 1; q.push(v); }
  }
  return d;
}

function landInitMap() {
  const T = S.tiles, N = T.length;
  S.rail = new Array(N).fill(0);
  S.infra = new Array(N).fill(0);
  S.weather = new Array(N).fill(0);
  S.hubs = [];
  S.supplyFlow = new Array(N).fill(0); // flusso di rifornimento verso il giocatore (overlay)
  const fromMap = T.some(t => t.rail != null || t.hub);
  for (const t of T) {
    if (!t.land) continue;
    const dev = LAND_DEV[t.owner] || [1, 2];
    let inf = t.infra != null ? t.infra : dev[1] + (t.vp >= 20 ? 2 : t.vp ? 1 : 0) - (t.terrain === 'mountain' ? 1 : 0);
    S.infra[t.i] = Math.max(1, Math.min(5, inf));
    if (fromMap) S.rail[t.i] = t.rail || 0;
  }
  if (fromMap) {
    for (const t of T) if (t.hub) addHub(t.i);
    for (const code in S.countries) if (S.countries[code].capital != null && !hubAt(S.countries[code].capital)) addHub(S.countries[code].capital);
    return;
  }
  // hub: capitale, città, poi copertura del territorio (nessun esagono a più di 3 passi da un hub)
  for (const code in S.countries) {
    const c = S.countries[code];
    if (c.capital == null) continue;
    const own = t => t.owner === code;
    const hubs = [c.capital];
    for (const t of T) if (t.land && own(t) && t.vp && t.i !== c.capital) hubs.push(t.i);
    for (let it = 0; it < 40; it++) {
      const d = hopsFrom(hubs, own);
      let far = -1, fd = 3;
      for (const t of T) if (own(t) && d[t.i] > fd && t.terrain !== 'mountain') { fd = d[t.i]; far = t.i; }
      if (far < 0) break;
      hubs.push(far);
    }
    for (const h of hubs) addHub(h);
    // ferrovie: dalla capitale verso ogni hub; le linee principali (città) hanno un livello in più
    const dev = LAND_DEV[code] || [1, 2];
    const { prev } = landDijkstra(c.capital, own, t => landPathCost(t) * (S.rail[t.i] ? 0.5 : 1));
    for (const h of hubs) {
      const lvl = Math.min(5, dev[0] + (T[h].vp ? 1 : 0));
      for (let u = h; u >= 0; u = prev[u]) {
        S.rail[u] = Math.max(S.rail[u], lvl);
        if (u === c.capital) break;
      }
    }
  }
  // linee internazionali tra capitali di paesi confinanti
  const borders = new Set();
  for (const t of T) {
    if (!t.land) continue;
    for (const n of t.nb) {
      const o = T[n].owner;
      if (T[n].land && o !== t.owner) borders.add(t.owner < o ? t.owner + o : o + t.owner);
    }
  }
  for (const k of borders) {
    const a = S.countries[k[0]], b = S.countries[k[1]];
    if (!a || !b || a.capital == null || b.capital == null) continue;
    const ok = t => t.owner === a.code || t.owner === b.code;
    const { dist, prev } = landDijkstra(a.capital, ok, t => landPathCost(t) * (S.rail[t.i] ? 0.4 : 1));
    if (!isFinite(dist[b.capital])) continue;
    const lvl = Math.min((LAND_DEV[a.code] || [1])[0], (LAND_DEV[b.code] || [1])[0]);
    for (let u = b.capital; u >= 0 && u !== a.capital; u = prev[u]) S.rail[u] = Math.max(S.rail[u], lvl);
  }
}
function addHub(ti) {
  if (hubAt(ti)) return null;
  const h = { id: S.hubs.length + 1, tile: ti };
  S.hubs.push(h);
  return h;
}
function hubAt(ti) { return S.hubs.find(h => h.tile === ti) || null; }

// ---------- meteo ----------
function hash3(a, b, c) {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function updateWeather() {
  const dt = dayDate(S.day), m = dt.getUTCMonth();
  const winter = [1, 0.9, 0.4, 0, 0, 0, 0, 0, 0, 0.1, 0.45, 0.75][m];
  const mud = [0, 0, 0.5, 0.6, 0.15, 0, 0, 0, 0.1, 0.55, 0.7, 0.2][m];
  const rain = [0.2, 0.2, 0.3, 0.35, 0.3, 0.15, 0.1, 0.1, 0.25, 0.35, 0.4, 0.25][m];
  const period = Math.floor(S.day / 6);
  const W = S.W, H = S.H;
  for (const t of S.tiles) {
    if (!t.land) { S.weather[t.i] = W_CLEAR; continue; }
    const lat = 1 - t.y / H, east = t.x / W;
    const n = hash3(t.x >> 2, t.y >> 2, period) - 0.5, n2 = hash3(t.y >> 2, t.x >> 2, period + 7);
    const cold = lat * 0.9 + east * 0.6 - 0.55 + (t.terrain === 'mountain' ? 0.25 : 0);
    const snow = cold * winter + n * 0.3;
    let w = W_CLEAR;
    if (snow > 0.55) w = W_DEEP;
    else if (snow > 0.28) w = W_SNOW;
    else {
      const mudScore = mud * (east * 1.3 + lat * 0.3 - 0.35) + n * 0.25;
      if (mudScore > 0.3) w = W_MUD;
      else if (n2 < rain * 0.6) w = W_RAIN;
    }
    S.weather[t.i] = w;
  }
}
const weatherOf = ti => WEATHER[S.weather ? S.weather[ti] : 0];
// penalità meteo attenuata da infrastrutture e tratti
function weatherMul(ti, key, winterTrait) {
  const w = weatherOf(ti), base = w[key];
  if (base === 1 || base === 0) return base;
  let mit = 1 - 0.1 * (S.infra[ti] - 1); // infrastrutture 5 → penalità ridotta del 40%
  if (winterTrait) mit *= 0.5;
  if (key === 'atk' || key === 'attr') return base * mit;
  return base > 1 ? 1 + (base - 1) * mit : 1 - (1 - base) * mit;
}

// ---------- camion ----------
function trucksOf(c) { return c.stock && c.stock.camion != null ? c.stock.camion : (c.trucks || 0); }
function useTrucks(c, n) {
  if (c.stock && c.stock.camion != null) c.stock.camion = Math.max(0, c.stock.camion - n);
  else c.trucks = Math.max(0, (c.trucks || 0) - n);
}
function addTrucks(c, n) {
  if (c.stock && c.stock.camion != null) c.stock.camion += n;
  else c.trucks = (c.trucks || 0) + n;
}

// ---------- calcolo dei rifornimenti ----------
function supplySource(code) {
  const c = C(code);
  if (S.tiles[c.capital] && allied(S.tiles[c.capital].ctrl, code)) return c.capital;
  let best = -1, bv = -1;
  for (const h of S.hubs) {
    const t = S.tiles[h.tile];
    if (t.owner === code && t.ctrl === code && t.vp > bv) { bv = t.vp; best = h.tile; }
  }
  return best;
}
// capacità di un tratto: vicino alla sorgente le linee si moltiplicano (nodi e scali), quindi portano di più
function railCap(u, src) {
  const d = hexDist(u, src);
  return RAIL_CAP[S.rail[u]] * (d <= 3 ? 3 : d <= 6 ? 1.8 : 1);
}
function divSupplyUse(d) {
  const st = tplStats(d);
  let u = st.sup;
  const g = divGeneral(d);
  if (g && g.traits.includes('logistica')) u *= 0.85;
  if (typeof unitMod === 'function') u *= 1 + (unitMod(C(d.owner), st.kind, 'supply') || 0);
  return u;
}

function computeSupply(code) {
  const c = C(code), T = S.tiles;
  const ok = t => t.land && allied(t.ctrl, code);
  const src = supplySource(code);
  const info = { hubs: [], src, demand: 0, delivered: 0, trucksNeed: 0, trucksUsed: 0, flow: null };
  c.landSup = info;
  const mine = S.divs.filter(d => d.owner === code && !d.dead);
  if (src < 0) { for (const d of mine) d.supTarget = T[d.tile].land ? 0 : 1; return info; }

  // 1) ferrovie: percorso a collo di bottiglia massimo dalla sorgente (widest path)
  const N = T.length;
  const best = new Float64Array(N).fill(0), prev = new Int32Array(N).fill(-1);
  best[src] = 99;
  const h = new MinHeap();
  h.push(src, -99);
  while (h.size) {
    const u = h.pop(), bu = -h.lastK;
    if (bu < best[u]) continue;
    for (const v of T[u].nb) {
      const tv = T[v];
      if (!S.rail[v] || !ok(tv)) continue;
      const bv = Math.min(bu, S.rail[v]);
      if (bv > best[v]) { best[v] = bv; prev[v] = u; h.push(v, -bv); }
    }
  }
  const coastalSrc = T[src].coastal || S.hubs.some(x => best[x.tile] > 0 && T[x.tile].coastal);
  const navalMul = typeof navalSupplyMod === 'function' ? navalSupplyMod(code) : 1;

  // 2) hub utilizzabili e loro capacità
  const motorSet = new Set(c.motorHubs || []);
  let trucks = trucksOf(c);
  for (const hb of S.hubs) {
    const t = T[hb.tile];
    if (!ok(t)) continue;
    let cap = 0, via = 'ferrovia';
    if (hb.tile === src) { cap = CAPITAL_SUPPLY; via = 'capitale'; }
    else if (best[hb.tile] > 0) cap = Math.min(HUB_MAX, RAIL_CAP[Math.min(5, best[hb.tile])]);
    else if (t.coastal && coastalSrc) { cap = HUB_MAX * 0.5 * navalMul; via = 'mare'; }
    if (cap <= 0) { info.hubs.push({ hub: hb, cap: 0, via: 'isolato', demand: 0, ratio: 0, motor: 0 }); continue; }
    // motorizzazione: camion necessari in base alla domanda del giorno precedente
    let motor = 0;
    if (motorSet.has(hb.id) || (c.autoMotor && (hb.lastDemand || 0) > 0)) {
      const need = Math.ceil(TRUCKS_PER_SUPPLY * Math.max(1, Math.min(cap, hb.lastDemand || cap * 0.3)));
      info.trucksNeed += need;
      const got = Math.min(need, trucks);
      trucks -= got; info.trucksUsed += got;
      motor = need ? got / need : 0;
    }
    info.hubs.push({ hub: hb, cap, via, demand: 0, ratio: 1, motor });
  }

  // 3) ultimo miglio: flusso decrescente dagli hub
  const reach = new Map(); // tile -> [[idx hub, flusso]]
  const winterG = new Set();
  info.hubs.forEach((H, idx) => {
    if (H.cap <= 0) return;
    const loss = FLOW_LOSS.cavalli - (FLOW_LOSS.cavalli - FLOW_LOSS.camion) * H.motor;
    const flow = new Map([[H.hub.tile, 1]]);
    const q = [H.hub.tile];
    for (let i = 0; i < q.length; i++) {
      const u = q[i], fu = flow.get(u);
      for (const v of T[u].nb) {
        const tv = T[v];
        if (!ok(tv)) continue;
        const ter = LAND_TERRAIN[tv.terrain] || DEFAULT_TERRAIN;
        const step = loss * ter.supply * weatherMul(v, 'supply') * (1.2 - 0.1 * S.infra[v]);
        const fv = fu - step;
        if (fv < FLOW_MIN || (flow.get(v) || 0) >= fv) continue;
        flow.set(v, fv); q.push(v);
      }
    }
    for (const [ti, f] of flow) {
      let a = reach.get(ti);
      if (!a) { a = []; reach.set(ti, a); }
      a.push([idx, f]);
    }
  });
  if (code === S.player) {
    S.supplyFlow.fill(0);
    for (const [ti, a] of reach) S.supplyFlow[ti] = Math.max(...a.map(x => x[1]));
  }
  void winterG;

  // 4) domanda delle divisioni per casella
  const byTile = new Map();
  for (const d of mine) {
    const t = T[d.tile];
    if (!t.land) { d.supTarget = 1; continue; }
    let e = byTile.get(d.tile);
    if (!e) { e = { divs: [], dem: 0 }; byTile.set(d.tile, e); }
    const u = divSupplyUse(d);
    e.divs.push(d); e.dem += u; info.demand += u;
  }
  // ogni casella attinge da tutti gli hub che la raggiungono, in proporzione a flusso e capacità libera;
  // la consegna si riduce con la distanza dall'hub (flusso < 0,6)
  const tilesL = [...byTile.entries()].map(([ti, e]) => ({ ti, e, cand: reach.get(ti) || [], got: 0 }));
  const allocate = caps => {
    const left = caps.slice();
    for (const x of tilesL) x.got = 0;
    for (const H of info.hubs) H.demand = 0;
    for (let it = 0; it < 4; it++) {
      const req = new Array(left.length).fill(0), parts = [];
      for (const x of tilesL) {
        const rem = x.e.dem - x.got;
        if (rem <= 1e-6 || !x.cand.length) continue;
        let sw = 0;
        for (const [h, f] of x.cand) sw += f * Math.max(0, left[h]);
        if (sw <= 0) continue;
        for (const [h, f] of x.cand) {
          const share = rem * f * Math.max(0, left[h]) / sw;
          if (share <= 0) continue;
          req[h] += share; parts.push([x, h, f, share]);
          if (it === 0) info.hubs[h].demand += share;
        }
      }
      if (!parts.length) break;
      const g = req.map((r, h) => r > 0 ? Math.min(1, left[h] / r) : 0);
      for (const [x, h, f, share] of parts) {
        const take = share * g[h];
        left[h] -= take;
        x.got += take * Math.min(1, f / 0.6);
      }
    }
    return left;
  };
  let caps = info.hubs.map(H => H.cap);
  let left = allocate(caps);
  // 5) carico sulle ferrovie condivise: le linee sature riducono la consegna a tutti gli hub a valle
  const load = new Map();
  info.hubs.forEach((H, h) => {
    if (H.via !== 'ferrovia') return;
    const draw = caps[h] - left[h];
    for (let u = H.hub.tile; u >= 0 && u !== src; u = prev[u]) load.set(u, (load.get(u) || 0) + draw);
  });
  let saturated = false;
  info.hubs.forEach(H => {
    let f = 1;
    if (H.via === 'ferrovia') for (let u = H.hub.tile; u >= 0 && u !== src; u = prev[u]) f = Math.min(f, railCap(u, src) / Math.max(1e-6, load.get(u) || 0));
    H.railFactor = Math.min(1, f);
    if (f < 1) saturated = true;
  });
  if (saturated) { caps = info.hubs.map(H => H.cap * H.railFactor); left = allocate(caps); }
  info.hubs.forEach((H, h) => {
    H.used = caps[h] - left[h];
    H.ratio = H.demand > 0 ? Math.min(1, H.used / H.demand) : 1;
    H.hub.lastDemand = H.demand;
    info.delivered += H.used;
  });
  // 6) rifornimento di ogni divisione
  for (const x of tilesL) {
    const t = T[x.ti];
    let s = x.e.dem > 0 ? x.got / x.e.dem : 1;
    if (t.owner === code && t.ctrl === code) s = Math.max(s, 0.35 + 0.05 * S.infra[x.ti]); // rifornimento locale nel proprio territorio
    const best = x.cand.length ? x.cand.reduce((m, c2) => (c2[1] > m[1] ? c2 : m)) : null;
    for (const d of x.e.divs) { d.supTarget = Math.min(1, s); d.hubTile = best ? info.hubs[best[0]].hub.tile : -1; }
  }
  // usura dei camion impiegati (più forte con fango e neve)
  if (info.trucksUsed > 0) {
    let wear = 0.001;
    for (const H of info.hubs) if (H.motor > 0 && weatherOf(H.hub.tile).supply > 1.3) wear = 0.003;
    const lost = info.trucksUsed * wear;
    c.truckWear = (c.truckWear || 0) + lost;
    if (c.truckWear >= 1) { useTrucks(c, Math.floor(c.truckWear)); c.truckWear -= Math.floor(c.truckWear); }
  }
  return info;
}

function logisticsStep() {
  if (S.day % 3 === 0 || !S.weatherInit) { updateWeather(); S.weatherInit = true; }
  for (const code in S.countries) {
    const c = S.countries[code];
    if (!c.alive) continue;
    computeSupply(code);
  }
  // i depositi delle divisioni si svuotano o si riempiono gradualmente
  for (const d of S.divs) {
    if (d.dead) continue;
    const tg = d.supTarget == null ? 1 : d.supTarget;
    if (d.supply == null) d.supply = tg;
    d.supply += Math.max(-0.2, Math.min(0.25, tg - d.supply));
  }
}

// ---------- costruzione di ferrovie, hub e infrastrutture ----------
function landBuildCheck(c, type, ti) {
  const t = S.tiles[ti];
  if (!t || !t.land) return 'Seleziona un esagono di terra';
  if (t.owner !== c.code || t.ctrl !== c.code) return 'Puoi costruire solo nel tuo territorio controllato';
  if (c.construction.some(j => j.tile === ti && j.type === type)) return 'Già in costruzione';
  if (type === 'rail') {
    if (S.rail[ti] >= 5) return 'Ferrovia già al livello massimo';
    if (!S.rail[ti] && !t.nb.some(n => S.rail[n] > 0)) return 'La nuova ferrovia deve collegarsi a una linea esistente';
  } else if (type === 'hub') {
    if (hubAt(ti)) return 'C\'è già un hub';
    if (!S.rail[ti]) return 'Un hub va costruito su una ferrovia';
    if (S.hubs.some(h => hexDist(h.tile, ti) <= 2)) return 'Troppo vicino a un altro hub';
  } else if (type === 'infra') {
    if (S.infra[ti] >= 5) return 'Infrastrutture già al massimo';
  }
  return null;
}
function hexDist(a, b) {
  const A = S.tiles[a], B = S.tiles[b];
  const ax = A.x - (A.y - (A.y & 1)) / 2, az = A.y, bx = B.x - (B.y - (B.y & 1)) / 2, bz = B.y;
  const ay = -ax - az, by = -bx - bz;
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}
function queueLandBuild(c, type, ti) {
  const err = landBuildCheck(c, type, ti);
  if (err) return err;
  if (c.construction.length >= 8) return 'Coda di costruzione piena';
  const cost = (typeof Econ !== 'undefined' ? BUILD_LAND_HOI4 : BUILD_LAND)[type];
  c.construction.push({ type, tile: ti, prog: 0, cost });
  return null;
}
// chiamata da economy() al completamento di un lavoro: true se è un lavoro della logistica
function landBuildDone(c, j) {
  if (j.type !== 'rail' && j.type !== 'hub' && j.type !== 'infra') return false;
  const isP = c.code === S.player;
  if (j.type === 'rail') S.rail[j.tile] = Math.min(5, S.rail[j.tile] + 1);
  else if (j.type === 'infra') S.infra[j.tile] = Math.min(5, S.infra[j.tile] + 1);
  else addHub(j.tile);
  if (isP) log(j.type === 'rail' ? `Ferrovia potenziata al livello ${S.rail[j.tile]}.` : j.type === 'hub' ? 'Nuovo hub di rifornimento operativo.' : `Infrastrutture portate al livello ${S.infra[j.tile]}.`, 'good');
  S.landDirty = true;
  return true;
}

// IA: potenzia le ferrovie sature e costruisce hub dove le divisioni restano senza rifornimenti
function aiLogistics(c) {
  const info = c.landSup;
  if (!info || c.construction.length >= 3) return;
  const T = S.tiles;
  for (const H of info.hubs) {
    if (H.via !== 'ferrovia' || (H.railFactor ?? 1) >= 0.95 || H.ratio > 0.8) continue;
    // anello più debole di proprietà del paese lungo la linea
    let worst = -1;
    for (const t of T) if (t.owner === c.code && t.ctrl === c.code && S.rail[t.i] && S.rail[t.i] < 5 && hexDist(t.i, H.hub.tile) <= 12) {
      if (worst < 0 || S.rail[t.i] < S.rail[worst]) worst = t.i;
    }
    if (worst >= 0 && !queueLandBuild(c, 'rail', worst)) return;
  }
}
