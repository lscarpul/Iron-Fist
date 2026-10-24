'use strict';

// Mappa a province reali (Europa e Mediterraneo, 1936), come in Hearts of Iron IV.
// I dati vengono da js/map-data.js (MAP_DATA), generato da tools/mapgen/build_map.py.
// Il modello dati (province, stati, regioni strategiche, adiacenze, ferrovie...) è
// documentato in docs/MAPPA.md.
//
// Ogni provincia diventa una "tile" del gioco (S.tiles[i], con i = id della provincia),
// quindi tutto il codice che lavora sulle tile (movimento, combattimento, IA) funziona
// sulle province senza cambiamenti.

const MAP = {
  data: null,
  states: [],     // MAP_DATA.states (statici: nome, proprietario 1936, province, risorse...)
  regions: [],    // regioni strategiche (terrestri e marittime)
  edges: new Map(), // chiave edgeKey(a, b) -> { len (km), river, strait, rail (0-5) }
  arcs: null,     // archi dei confini decodificati: Float32Array [x0, y0, x1, y1, ...]
  arcSides: null, // per ogni arco le due province ai lati (-1 = nessuna: lago o bordo mappa)
};

const edgeKey = (a, b) => a < b ? a * 65536 + b : b * 65536 + a;
function mapEdge(a, b) { return MAP.edges.get(edgeKey(a, b)) || null; }
// distanza in km tra i centri di due province
function provDistKm(a, b) {
  const p = MAP.data.provinces[a], q = MAP.data.provinces[b];
  const r = Math.PI / 180, dLat = (q.lat - p.lat) * r, dLon = (q.lon - p.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * r) * Math.cos(q.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h)); // distanza sul globo
}

function decodeArcs(D) {
  const q = D.quant;
  return D.arcs.map(a => {
    const n = a.length / 2, out = new Float32Array(a.length);
    let x = a[0], y = a[1];
    out[0] = x * q; out[1] = y * q;
    for (let k = 1; k < n; k++) {
      x += a[2 * k]; y += a[2 * k + 1];
      out[2 * k] = x * q; out[2 * k + 1] = y * q;
    }
    return out;
  });
}

function buildMap() {
  const D = MAP_DATA;
  if (!MAP.data) {
    MAP.data = D;
    MAP.states = D.states;
    MAP.regions = D.regions;
    MAP.arcs = decodeArcs(D);
    MAP.arcSides = D.arcSides;
    for (const [a, b, len, flag] of D.adjacency) {
      MAP.edges.set(edgeKey(a, b), { len, river: flag === 1, strait: flag === 2, rail: 0 });
    }
    for (const [a, b, lvl] of D.railways) {
      const e = mapEdge(a, b);
      if (e) e.rail = lvl;
    }
  }

  const tiles = D.provinces.map(p => {
    const land = p.type === 'land';
    const st = land ? D.states[p.state] : null;
    let owner = st ? st.owner : null;
    if (owner && !COUNTRY_DEFS[owner]) owner = null; // paese non giocabile: non dovrebbe succedere
    return {
      i: p.id, land: land && !!owner, owner, ctrl: owner,
      terrain: land ? p.terrain : 'plains', vp: p.vp || 0, nb: [],
      coastal: !!p.coastal, nearLand: false,
      cx: p.x, cy: p.y, x: p.x, y: p.y,
      state: land ? p.state : -1, region: p.region, area: p.area,
      city: p.city || null, port: p.port || 0, rail: p.rail || 0, hub: !!p.hub,
      infra: st ? st.infra : 0, elev: p.elev || 0, lon: p.lon, lat: p.lat,
    };
  });
  for (const [a, b] of D.adjacency) {
    tiles[a].nb.push(b);
    tiles[b].nb.push(a);
  }
  for (const t of tiles) if (!t.land) t.nearLand = t.nb.some(n => tiles[n].land);

  const capitals = {};
  for (const code in D.countries) if (COUNTRY_DEFS[code]) capitals[code] = D.countries[code].capital;
  return { tiles, W: D.width, H: D.height, capitals };
}
