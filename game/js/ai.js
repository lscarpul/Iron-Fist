'use strict';

function aiThink(c) {
  // focus nazionale
  if (!c.focus) {
    const order = c.major ? AI_FOCUS_MAJOR : AI_FOCUS_MINOR;
    const id = order.find(id => focusAvailable(c, FOCUS_BY_ID[id]));
    if (id) startFocus(c, id);
  }
  // economia: leggi, linee di produzione, commercio, cantieri (economy.js)
  Econ.aiThink(c);
  // reclutamento
  const myDivs = S.divs.filter(d => d.owner === c.code && !d.dead);
  const cap = Math.floor(c.mil * 1.2 + c.civ * 0.4) + 4;
  for (let k = 0; k < 2; k++) {
    if (myDivs.length + c.training.length >= cap) break;
    const type = c.armorTech && Math.random() < 0.22 ? 'arm' : 'inf';
    if (!Econ.canPay(c, type, 1, 1.3) || !recruit(c, type)) break;
  }
  aiMilitary(c, myDivs);
}

function plannedTarget(code) {
  for (const ev of EVENTS) {
    if (ev.type !== 'war' || ev.actor !== code) continue;
    if (ev.day > S.day && ev.day - S.day <= 50 && C(ev.target).alive && ev.target !== S.player) return ev.target;
  }
  return null;
}

function aiMilitary(c, my) {
  const code = c.code;
  let enemies = enemiesOf(code), mode = 'war';
  if (!enemies.length) {
    const t = plannedTarget(code);
    if (!t) return;
    enemies = [t]; mode = 'prep';
  }
  const enemySet = new Set(enemies);
  const tiles = S.tiles;
  const isEnemyTile = t => t.land && enemySet.has(t.ctrl);

  // fronte: territori amici confinanti con il nemico
  const front = [], frontSet = new Set(), reachedEnemies = new Set();
  for (const t of tiles) {
    if (!t.land || !allied(t.ctrl, code)) continue;
    if (mode === 'prep' && t.ctrl !== code) continue;
    if (hasHostile(t.i, code)) continue;
    let isFront = false;
    for (const n of t.nb) if (isEnemyTile(tiles[n])) { isFront = true; reachedEnemies.add(tiles[n].ctrl); }
    if (isFront) { front.push(t.i); frontSet.add(t.i); }
  }

  const cnt = new Map();
  for (const d of my) {
    const dest = d.path.length ? d.path[d.path.length - 1] : d.tile;
    if (frontSet.has(dest)) cnt.set(dest, (cnt.get(dest) || 0) + 1);
  }
  // minaccia: divisioni nemiche adiacenti a ogni casella di fronte
  const threat = new Map();
  for (const f of front) {
    let n = 0;
    for (const m of tiles[f].nb) {
      const a = S.byTile.get(m);
      if (a) for (const d of a) if (enemySet.has(d.owner)) n++;
    }
    threat.set(f, n);
  }

  // postura: i paesi prudenti attaccano solo se più forti o per liberare il proprio territorio
  let myPow = 0, enPow = 0;
  for (const d of S.divs) {
    if (d.dead) continue;
    if (allied(d.owner, code)) myPow += d.str;
    else if (enemySet.has(d.owner)) enPow += d.str;
  }
  const aggressive = c.aggro >= 0.5 || myPow > enPow * 1.4;
  const mayAttack = t => aggressive || allied(t.owner, code);

  // attacchi dalle caselle di fronte
  if (mode === 'war') {
    const threshold = 2.0 - c.aggro;
    const groups = new Map();
    for (const d of my) {
      if (d.path.length || !frontSet.has(d.tile) || d.org < UNIT_TYPES[d.type].org * 0.7) continue;
      let g = groups.get(d.tile);
      if (!g) { g = []; groups.set(d.tile, g); }
      g.push(d);
    }
    for (const [ti, g] of groups) {
      const t = tiles[ti];
      g.sort((a, b) => speedOf(b) - speedOf(a));
      // prima occupa le caselle nemiche vuote
      const targets = [];
      for (const n of t.nb) if (isEnemyTile(tiles[n]) && mayAttack(tiles[n])) targets.push(n);
      const empty = targets.filter(n => !hasHostile(n, code));
      for (const n of empty) {
        if (g.length <= 1 && targets.length > empty.length) break;
        const d = g.shift();
        if (!d) break;
        d.path = [n];
      }
      if (!g.length) continue;
      let A = 0;
      for (const d of g) A += atkValue(d);
      let best = -1, bs = 0;
      for (const n of targets) {
        if (!hasHostile(n, code)) continue;
        const s = A / Math.max(1, defValue(n, code));
        if (s > bs) { bs = s; best = n; }
      }
      if (best >= 0 && bs >= threshold) for (const d of g) d.path = [best];
    }
  }

  // invasioni navali verso nemici non raggiungibili via terra
  const unreachable = enemies.filter(e => !reachedEnemies.has(e));
  if (mode === 'war' && unreachable.length && (S.day + c.slot * 7) % 30 === 0) {
    aiNaval(c, my, new Set(unreachable), front.length ? 4 : 8);
  }
  if (!front.length) return;

  // rinforza il fronte: Dijkstra multi-sorgente dal fronte, pesato dalle truppe già assegnate,
  // ricalcolato a lotti così le divisioni si distribuiscono lungo tutto il fronte
  const idle = my.filter(d => !d.path.length && !frontSet.has(d.tile) && d.org >= UNIT_TYPES[d.type].org * 0.3);
  if (!idle.length) return;
  const batch = Math.max(4, Math.ceil(idle.length / 10));
  for (let i = 0; i < idle.length; i += batch) {
    const { dist, prev } = dijkstraFromFront(code, front, cnt, threat);
    for (const d of idle.slice(i, i + batch)) {
      if (!isFinite(dist[d.tile])) continue;
      const p = [];
      let u = d.tile;
      while (!frontSet.has(u)) { u = prev[u]; if (u < 0) break; p.push(u); }
      if (u < 0 || !p.length) continue;
      d.path = p;
      cnt.set(u, (cnt.get(u) || 0) + 1);
    }
  }
}

function dijkstraFromFront(owner, front, cnt, threat) {
  const N = S.tiles.length;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const h = new MinHeap();
  for (const f of front) {
    const k = (cnt.get(f) || 0) * 8 / (1 + 0.5 * (threat.get(f) || 0));
    dist[f] = k; h.push(f, k);
  }
  while (h.size) {
    const u = h.pop();
    const du = h.lastK;
    if (du > dist[u]) continue;
    const cu = stepCost(S.tiles[u]); // costo per entrare in u venendo dal vicino
    for (const v of S.tiles[u].nb) {
      if (!passable(owner, S.tiles[v], true)) continue;
      const nd = du + cu;
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; h.push(v, nd); }
    }
  }
  return { dist, prev };
}

function aiNaval(c, my, targets, maxDivs) {
  const ready = my.filter(d => !d.path.length && S.tiles[d.tile].land && d.org >= UNIT_TYPES[d.type].org * 0.9 && d.str > 0.8);
  if (ready.length < maxDivs + 2) return;
  const origin = ready[0].tile;
  const { dist, prev } = dijkstra(c.code, origin, -1, false, 80);
  let best = -1, bs = Infinity;
  for (const t of S.tiles) {
    if (!t.land || !targets.has(t.ctrl) || !isFinite(dist[t.i])) continue;
    const p = prev[t.i];
    if (p < 0 || S.tiles[p].land) continue; // deve essere uno sbarco dal mare
    const s = dist[t.i] + defValue(t.i, c.code) * 0.5 - t.vp * 0.5;
    if (s < bs) { bs = s; best = t.i; }
  }
  if (best < 0) return;
  let sent = 0;
  for (const d of ready) {
    if (sent >= maxDivs) break;
    const p = findPath(c.code, d.tile, best);
    if (p && p.length) { d.path = p; d.prog = 0; sent++; }
  }
}
