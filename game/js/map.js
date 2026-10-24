'use strict';

// Griglia esagonale "pointy-top" con righe dispari sfalsate (odd-r).
const HEX = 8, SQ3 = Math.sqrt(3), MAP_PAD = 14, MAP_SCALE = 2;

function hexCenter(x, y) {
  return [MAP_PAD + HEX * SQ3 * (x + 0.5 * (y & 1)) + HEX * SQ3 / 2, MAP_PAD + HEX + HEX * 1.5 * y];
}

function hexNeighbors(x, y, W, H) {
  const d = (y & 1)
    ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]
    : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
  const r = [];
  for (const [dx, dy] of d) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < W && ny < H) r.push(ny * W + nx);
  }
  return r;
}

function buildMap(seed) {
  const rng = mulberry32(seed);
  const W0 = Math.max(...MAP_ASCII.map(r => r.length)), H0 = MAP_ASCII.length;
  const rows = MAP_ASCII.map(r => r.padEnd(W0, '.'));
  const W = W0 * MAP_SCALE, H = H0 * MAP_SCALE;
  const at = (ax, ay) => (ax < 0 || ay < 0 || ax >= W0 || ay >= H0) ? '.' : rows[ay][ax];

  // terreno deciso per regione ASCII, poi ereditato (con un po' di rumore) dagli esagoni
  const coarseTerrain = [];
  for (let ay = 0; ay < H0; ay++) {
    coarseTerrain.push([]);
    for (let ax = 0; ax < W0; ax++) {
      const ch = at(ax, ay);
      let ter = 'plains';
      let mp = 0;
      for (const [x0, y0, x1, y1, p] of MOUNTAIN_ZONES)
        if (ax >= x0 && ax <= x1 && ay >= y0 && ay <= y1) mp = Math.max(mp, p);
      const r = rng();
      if (r < mp) ter = 'mountain';
      else if (r < mp + (FOREST_RICH.has(ch) ? 0.32 : 0.15)) ter = 'forest';
      else if (r < mp + 0.45) ter = rng() < 0.4 ? 'hills' : 'plains';
      coarseTerrain[ay].push(ter);
    }
  }

  const tiles = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ax = Math.floor(x / MAP_SCALE), ay = Math.floor(y / MAP_SCALE);
      let ch = at(ax, ay);
      if (rng() < 0.25) { // bordi irregolari
        const dx = (x % MAP_SCALE === 0) ? -1 : 1, dy = (y % MAP_SCALE === 0) ? -1 : 1;
        const r = rng();
        ch = r < 0.4 ? at(ax + dx, ay) : r < 0.8 ? at(ax, ay + dy) : at(ax + dx, ay + dy);
      }
      let terrain = coarseTerrain[ay][ax];
      if (rng() < 0.2) terrain = ['plains', 'forest', 'hills'][Math.floor(rng() * 3)];
      const [cx, cy] = hexCenter(x, y);
      tiles.push({
        i: tiles.length, x, y, cx, cy,
        land: ch !== '.', owner: ch === '.' ? null : ch, ctrl: ch === '.' ? null : ch,
        terrain, vp: 0, nb: hexNeighbors(x, y, W, H), coastal: false, nearLand: false,
      });
    }
  }

  // pulizia: esagoni isolati e laghetti di un solo esagono
  for (let pass = 0; pass < 2; pass++) {
    for (const t of tiles) {
      const counts = {};
      let same = 0, landN = 0;
      for (const n of t.nb) {
        const o = tiles[n].owner;
        if (o === t.owner) same++;
        if (o) { landN++; counts[o] = (counts[o] || 0) + 1; }
      }
      const major = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (t.land && same === 0 && major) { t.owner = t.ctrl = major[0]; }
      else if (!t.land && landN === t.nb.length && major) { t.land = true; t.owner = t.ctrl = major[0]; }
      else if (t.land && landN === 0) { t.land = false; t.owner = t.ctrl = null; }
    }
  }

  for (const t of tiles) {
    for (const n of t.nb) {
      if (t.land && !tiles[n].land) t.coastal = true;
      if (!t.land && tiles[n].land) t.nearLand = true;
    }
    if (!t.land) t.terrain = 'plains';
  }

  // capitali e città (punti vittoria)
  const capitals = {};
  for (const code in COUNTRY_DEFS) {
    const def = COUNTRY_DEFS[code];
    const fx = def.cap[0] * MAP_SCALE + 0.5, fy = def.cap[1] * MAP_SCALE + 0.5;
    let best = -1, bd = Infinity;
    const own = [];
    for (const t of tiles) {
      if (t.owner !== code) continue;
      own.push(t);
      const d = (t.x - fx) ** 2 + (t.y - fy) ** 2;
      if (d < bd) { bd = d; best = t.i; }
    }
    if (best < 0) continue;
    tiles[best].vp = 20;
    tiles[best].terrain = 'plains';
    capitals[code] = best;
    const nCities = Math.min(4, Math.floor(own.length / 60));
    const placed = [tiles[best]];
    for (let k = 0, tries = 0; k < nCities && tries < 200; tries++) {
      const t = own[Math.floor(rng() * own.length)];
      if (placed.every(p => Math.abs(p.x - t.x) + Math.abs(p.y - t.y) > 7)) {
        t.vp = 5; placed.push(t); k++;
      }
    }
  }
  return { tiles, W, H, capitals };
}
