'use strict';

// Disegno della mappa a province vettoriali (stile HOI4).
// Estensioni per gli altri sistemi:
//  - Render.mapMode: 'political' | 'terrain' | 'state' | 'region' | 'infra' | 'railway' | 'resources'
//    (Render.MAP_MODES elenca le modalità con il nome italiano; Render.setMapMode(m) le cambia)
//  - Render.overlays: array di funzioni (ctx, view) chiamate dopo la mappa e prima dei segnalini,
//    con ctx già trasformato in coordinate del mondo (1 unità = MAP_DATA.kmPerUnit km).
//    view = { s, tx, ty, lw } dove lw = spessore di 1 pixel schermo in unità del mondo.
//  - Render.modeColors[m] = (t) => colore: colora le province per una modalità nuova.

// linee divise in blocchi spaziali: a zoom alto si disegnano solo i blocchi visibili
class ChunkedPath {
  constructor(size = 500) { this.size = size; this.chunks = new Map(); }
  line(pts) {
    const k = (Math.floor(pts[0] / this.size) + 64) * 4096 + Math.floor(pts[1] / this.size) + 64;
    let c = this.chunks.get(k);
    if (!c) this.chunks.set(k, c = { p: new Path2D(), b: [Infinity, Infinity, -Infinity, -Infinity] });
    const b = c.b;
    for (let j = 0; j < pts.length; j += 2) {
      const x = pts[j], y = pts[j + 1];
      j ? c.p.lineTo(x, y) : c.p.moveTo(x, y);
      if (x < b[0]) b[0] = x; if (x > b[2]) b[2] = x; if (y < b[1]) b[1] = y; if (y > b[3]) b[3] = y;
    }
  }
  stroke(ctx, vb) {
    for (const c of this.chunks.values())
      if (c.b[2] >= vb[0] && c.b[0] <= vb[2] && c.b[3] >= vb[1] && c.b[1] <= vb[3]) ctx.stroke(c.p);
  }
}

const TERRAIN_COLORS = {
  plains: '#a9b46a', forest: '#4f7a3a', hills: '#a58a5a', mountain: '#8a7a6e',
  desert: '#d9c27e', marsh: '#5f8a76', urban: '#9a8f8a',
};
const RESOURCE_COLORS = { oil: '#222', steel: '#7a8a99', aluminium: '#c9d4dc', tungsten: '#6f5a8a', chromium: '#4f9a8a', rubber: '#6a8a3a' };

const Render = {
  view: { s: 1, tx: 0, ty: 0 }, hover: -1, box: null,
  mapMode: 'political',
  MAP_MODES: [
    ['political', 'Politica'], ['terrain', 'Terreno'], ['state', 'Stati'], ['region', 'Regioni strategiche'],
    ['infra', 'Infrastrutture'], ['railway', 'Ferrovie'], ['resources', 'Risorse'],
  ],
  overlays: [],
  modeColors: {},

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.ww = S.W; this.wh = S.H;
    if (!this.paths) this.buildGeometry();
    this.layer = document.createElement('canvas');
    this.lctx = this.layer.getContext('2d');
    this.layerKey = '';
    this.patterns = {};
    this.relief = new Image();
    this.relief.onload = () => this.invalidate();
    this.relief.src = 'img/relief.png';
    S.mapDirty = true;
    this.resize();
    this.fit();
  },

  // Path2D di ogni provincia e indice spaziale per trovare la provincia sotto il mouse
  buildGeometry() {
    const D = MAP_DATA, arcs = MAP.arcs;
    this.paths = [];
    this.bbox = [];
    const G = this.gridSize = 40;
    this.gw = Math.ceil(D.width / G); this.gh = Math.ceil(D.height / G);
    this.grid = Array.from({ length: this.gw * this.gh }, () => []);
    for (const p of D.provinces) {
      const path = new Path2D();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const ring of p.rings) {
        let first = true;
        for (const ref of ring) {
          const a = arcs[ref >= 0 ? ref : ~ref], n = a.length / 2;
          for (let k = 0; k < n; k++) {
            const j = ref >= 0 ? k : n - 1 - k;
            if (!first && k === 0) continue;
            const x = a[2 * j], y = a[2 * j + 1];
            if (first) { path.moveTo(x, y); first = false; } else path.lineTo(x, y);
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
        path.closePath();
      }
      this.paths.push(path);
      this.bbox.push([x0, y0, x1, y1]);
      for (let gy = Math.max(0, Math.floor(y0 / G)); gy <= Math.min(this.gh - 1, Math.floor(y1 / G)); gy++)
        for (let gx = Math.max(0, Math.floor(x0 / G)); gx <= Math.min(this.gw - 1, Math.floor(x1 / G)); gx++)
          this.grid[gy * this.gw + gx].push(p.id);
    }
    this.hitCtx = document.createElement('canvas').getContext('2d');
    // fiumi
    this.rivers = [1, 2, 3].map(w => {
      const path = new ChunkedPath();
      for (const r of D.rivers) if (r.w === w) path.line(r.pts);
      return path;
    });
    // ferrovie per livello
    this.rails = [1, 2, 3, 4, 5].map(l => {
      const path = new ChunkedPath();
      for (const [a, b, lvl] of D.railways) {
        if (lvl !== l) continue;
        const p = D.provinces[a], q = D.provinces[b];
        path.line([p.x, p.y, q.x, q.y]);
      }
      return path;
    });
  },

  resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.cw = r.width; this.ch = r.height;
    this.cv.width = Math.round(r.width * this.dpr);
    this.cv.height = Math.round(r.height * this.dpr);
    this.cv.style.width = r.width + 'px';
    this.cv.style.height = r.height + 'px';
    if (this.layer) { this.layer.width = this.cv.width; this.layer.height = this.cv.height; this.layerKey = ''; }
  },
  fit() {
    const s = this.minZoom();
    this.view.s = s;
    this.view.tx = (this.cw - this.ww * s) / 2;
    this.view.ty = (this.ch - this.wh * s) / 2;
  },
  // la mappa del mondo si richiude in orizzontale: lo zoom minimo la fa stare in altezza
  minZoom() { return MAP_DATA.wrapX ? this.ch / this.wh : Math.min(this.cw / this.ww, this.ch / this.wh) * 0.8; },
  clampView() {
    const v = this.view;
    v.s = Math.max(this.minZoom(), v.s);
    if (MAP_DATA.wrapX) {
      const W = this.ww * v.s, c = (this.cw / 2 - v.tx) / W;
      v.tx += Math.floor(c) * W;  // il centro dello schermo resta nella copia principale
    }
    const H = this.wh * v.s;
    v.ty = H <= this.ch ? (this.ch - H) / 2 : Math.min(0, Math.max(this.ch - H, v.ty));
  },
  // spostamenti (in unità mappa) delle copie della mappa visibili sullo schermo
  copies(v, wpx) {
    if (!MAP_DATA.wrapX) return [0];
    const W = this.ww * v.s, out = [];
    for (let k = -2; k <= 2; k++) if (v.tx + k * W < wpx && v.tx + (k + 1) * W > 0) out.push(k * this.ww);
    return out;
  },
  centerOn(ti, zoom) {
    const t = S.tiles[ti];
    if (zoom) this.view.s = Math.max(this.view.s, zoom);
    this.view.tx = this.cw / 2 - t.cx * this.view.s;
    this.view.ty = this.ch / 2 - t.cy * this.view.s;
  },
  toWorld(sx, sy) { return [(sx - this.view.tx) / this.view.s, (sy - this.view.ty) / this.view.s]; },
  zoomAt(sx, sy, f) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.view.s = Math.max(this.minZoom(), Math.min(14, this.view.s * f));
    this.view.tx = sx - wx * this.view.s;
    this.view.ty = sy - wy * this.view.s;
  },
  tileAt(sx, sy) {
    let [wx, wy] = this.toWorld(sx, sy);
    if (MAP_DATA.wrapX) wx = ((wx % this.ww) + this.ww) % this.ww;
    const gx = Math.floor(wx / this.gridSize), gy = Math.floor(wy / this.gridSize);
    if (gx < 0 || gy < 0 || gx >= this.gw || gy >= this.gh) return -1;
    for (const i of this.grid[gy * this.gw + gx]) {
      const b = this.bbox[i];
      if (wx < b[0] || wx > b[2] || wy < b[1] || wy > b[3]) continue;
      if (this.hitCtx.isPointInPath(this.paths[i], wx, wy, 'evenodd')) return i;
    }
    return -1;
  },
  setMapMode(m) { this.mapMode = m; S.mapDirty = true; },
  invalidate() { this.layerKey = ''; this.worldKey = ''; },

  stripe(color) {
    if (this.patterns[color]) return this.patterns[color];
    const p = document.createElement('canvas');
    p.width = p.height = 8;
    const g = p.getContext('2d');
    g.strokeStyle = color; g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(-1, 9); g.lineTo(9, -1);
    g.moveTo(-1, 1); g.lineTo(1, -1);
    g.moveTo(7, 9); g.lineTo(9, 7);
    g.stroke();
    return (this.patterns[color] = this.lctx.createPattern(p, 'repeat'));
  },

  // colore di riempimento di una provincia terrestre nella modalità corrente
  fillOf(t) {
    const m = this.mapMode;
    if (this.modeColors[m]) return this.modeColors[m](t);
    switch (m) {
      case 'terrain': return TERRAIN_COLORS[t.terrain] || '#999';
      case 'state': return this.hashColor(t.state * 7919 + 13);
      case 'region': return this.hashColor(t.region * 104729 + 7);
      case 'infra': { const v = t.infra / 5; return `hsl(${20 + v * 100},55%,${30 + v * 25}%)`; }
      case 'railway': return shade(C(t.owner).color, 0.55);
      case 'resources': {
        const st = MAP.states[t.state];
        const r = st && Object.entries(st.resources).sort((a, b) => b[1] - a[1])[0];
        return r ? RESOURCE_COLORS[r[0]] : shade(C(t.owner).color, 0.45);
      }
      default: return C(t.owner).color;
    }
  },
  hashColor(n) {
    const h = (n * 2654435761 >>> 0) % 360;
    return `hsl(${h},42%,${42 + (n % 3) * 7}%)`;
  },

  // stili dei confini: ricalcolati quando cambia il controllo delle province
  rebuildStyles() {
    S.mapDirty = false;
    this.invalidate();
    const T = S.tiles, A = MAP.arcs, sides = MAP.arcSides;
    const mk = () => new ChunkedPath();
    const P = { prov: mk(), state: mk(), border: mk(), coast: mk(), front: mk() };
    for (let k = 0; k < A.length; k++) {
      const a = sides[2 * k], b = sides[2 * k + 1];
      const ta = a >= 0 ? T[a] : null, tb = b >= 0 ? T[b] : null;
      let cat;
      if (ta && tb) {
        if (ta.land && tb.land) {
          if (atWar(ta.ctrl, tb.ctrl)) cat = 'front';
          else if (ta.owner !== tb.owner || ta.ctrl !== tb.ctrl) cat = 'border';
          else if (ta.state !== tb.state) cat = 'state';
          else cat = 'prov';
        } else if (ta.land || tb.land) cat = 'coast';
        else cat = null; // mare-mare: disegnato a parte, molto tenue
      } else if ((ta && ta.land) || (tb && tb.land)) cat = 'coast';
      if (!cat) continue;
      P[cat].line(A[k]);
    }
    if (!this.seaLines) {
      this.seaLines = mk();
      for (let k = 0; k < A.length; k++) {
        const a = sides[2 * k], b = sides[2 * k + 1];
        if (a < 0 || b < 0 || T[a].land || T[b].land) continue;
        this.seaLines.line(A[k]);
      }
    }
    this.borders = P;
    this.fills = T.map(t => t.land ? this.fillOf(t) : null);
    this.computeLabels();
  },

  // posizione e dimensione dei nomi dei paesi (sulla massa di territorio più grande)
  computeLabels() {
    // nome sulla massa che contiene la capitale (la madrepatria, non le colonie) e,
    // più piccolo, sulle altre masse molto estese (imperi coloniali, come in HOI4)
    const T = S.tiles, seen = new Uint8Array(T.length), comps = {};
    for (const t of T) {
      if (!t.land || seen[t.i]) continue;
      const comp = [], stack = [t.i];
      seen[t.i] = 1;
      let area = 0, hasCap = false;
      const cap = S.countries[t.ctrl] ? S.countries[t.ctrl].capital : -1;
      while (stack.length) {
        const u = stack.pop();
        comp.push(u);
        area += T[u].area;
        if (u === cap) hasCap = true;
        for (const v of T[u].nb) if (!seen[v] && T[v].land && T[v].ctrl === t.ctrl) { seen[v] = 1; stack.push(v); }
      }
      (comps[t.ctrl] = comps[t.ctrl] || []).push({ comp, area, hasCap });
    }
    this.labels = [];
    for (const code in comps) {
      const list = comps[code];
      const main = list.find(c => c.hasCap) || list.reduce((a, b) => a.area >= b.area ? a : b);
      for (const c of list) if (c === main || c.area >= Math.max(400000, main.area)) this.labels.push(this.labelFor(code, c));
    }
  },
  labelFor(code, { comp, area }) {
    const T = S.tiles;
    let x = 0, y = 0;
    for (const u of comp) { x += T[u].cx * T[u].area; y += T[u].cy * T[u].area; }
    x /= area; y /= area;
    // aggancia al centro della provincia più vicina della massa (per forme a C)
    let bu = comp[0], bd = Infinity;
    for (const u of comp) { const d = (T[u].cx - x) ** 2 + (T[u].cy - y) ** 2; if (d < bd) { bd = d; bu = u; } }
    if (bd > 400) { x = T[bu].cx; y = T[bu].cy; }
    const size = Math.max(7, Math.min(160, Math.sqrt(area / MAP_DATA.kmPerUnit ** 2) * 0.13));
    return { code, x, y, size };
  },

  // livello mappa (terre, mari, confini, fiumi): ridisegnato solo se cambia vista o controllo
  drawLayer() {
    const ctx = this.lctx, v = this.view, dpr = this.dpr;
    // da lontano si usa un'immagine dell'intera mappa (molto più veloce durante lo scorrimento)
    const WS = this.WORLD_SCALE;
    const offs = this.copies(v, this.cw);
    if (v.s * dpr <= WS * 1.05) {
      if (!this.world) {
        this.world = document.createElement('canvas');
        this.world.width = Math.ceil(this.ww * WS); this.world.height = Math.ceil(this.wh * WS);
        this.worldKey = '';
      }
      if (this.worldKey !== this.mapMode) {
        this.drawMap(this.world.getContext('2d'), { s: WS, tx: 0, ty: 0 }, 1, this.world.width, this.world.height);
        this.worldKey = this.mapMode;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0b1622';
      ctx.fillRect(0, 0, this.layer.width, this.layer.height);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      for (const off of offs) {
        ctx.setTransform(v.s * dpr, 0, 0, v.s * dpr, (v.tx + off * v.s) * dpr, v.ty * dpr);
        ctx.drawImage(this.world, 0, 0, this.ww, this.wh);
      }
      return;
    }
    offs.forEach((off, k) => this.drawMap(ctx, { s: v.s, tx: v.tx + off * v.s, ty: v.ty }, dpr,
      this.layer.width, this.layer.height, k > 0));
  },
  WORLD_SCALE: 0.5,

  drawMap(ctx, v, dpr, wpx, hpx, keep) {
    const T = S.tiles;
    const lw = 1 / v.s, zs = v.s * MAP_DATA.kmPerUnit / 2; // zs: zoom in "pixel da 2 km"

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!keep) { ctx.fillStyle = '#0b1622'; ctx.fillRect(0, 0, wpx, hpx); }
    ctx.setTransform(v.s * dpr, 0, 0, v.s * dpr, v.tx * dpr, v.ty * dpr);
    // area della mappa (i "buchi" sono i laghi)
    ctx.fillStyle = '#3f6f8f';
    ctx.fillRect(0, 0, this.ww, this.wh);
    const vx0 = -v.tx / v.s, vy0 = -v.ty / v.s, vx1 = vx0 + wpx / dpr / v.s, vy1 = vy0 + hpx / dpr / v.s;
    const vb = [vx0, vy0, vx1, vy1];
    const vis = i => { const b = this.bbox[i]; return b[2] >= vx0 && b[0] <= vx1 && b[3] >= vy0 && b[1] <= vy1; };
    // mare
    ctx.fillStyle = '#1d3d5c';
    for (const t of T) if (!t.land && vis(t.i)) ctx.fill(this.paths[t.i], 'evenodd');
    ctx.strokeStyle = 'rgba(160,200,235,0.10)'; ctx.lineWidth = lw;
    if (zs > 0.9) this.seaLines.stroke(ctx, vb);
    // terre
    for (const t of T) {
      if (!t.land || !vis(t.i)) continue;
      ctx.fillStyle = this.fills[t.i];
      ctx.fill(this.paths[t.i], 'evenodd');
    }
    // rilievo
    if (this.relief.complete && this.relief.naturalWidth) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = this.mapMode === 'terrain' ? 0.95 : 0.75;
      ctx.drawImage(this.relief, 0, 0, this.ww, this.wh);
      ctx.restore();
    }
    // occupazioni (strisce del controllore)
    if (this.mapMode === 'political') {
      for (const t of T) {
        if (!t.land || t.ctrl === t.owner || !vis(t.i)) continue;
        // motivo a strisce di dimensione costante sullo schermo
        const pat = this.stripe(C(t.ctrl).color);
        pat.setTransform(new DOMMatrix().scaleSelf(1 / v.s));
        ctx.fillStyle = pat;
        ctx.fill(this.paths[t.i], 'evenodd');
      }
    }
    // fiumi
    if (zs > 0.45) {
      ctx.strokeStyle = 'rgba(70,130,185,0.85)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let w = 0; w < 3; w++) {
        ctx.lineWidth = (0.6 + w * 0.5) * lw * Math.min(2, Math.max(1, zs / 1.5));
        this.rivers[w].stroke(ctx, vb);
      }
    }
    // confini
    const B = this.borders;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (zs > 1.1) { ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 0.7 * lw; B.prov.stroke(ctx, vb); }
    if (zs > 0.55) { ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 1 * lw; B.state.stroke(ctx, vb); }
    ctx.strokeStyle = 'rgba(10,20,30,0.75)'; ctx.lineWidth = 1 * lw; B.coast.stroke(ctx, vb);
    ctx.strokeStyle = 'rgba(12,12,16,0.9)'; ctx.lineWidth = 1.6 * lw; B.border.stroke(ctx, vb);
    ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2.4 * lw; B.front.stroke(ctx, vb);
    // ferrovie
    if (this.mapMode === 'railway' || this.mapMode === 'infra' || zs > 3) {
      const strong = this.mapMode === 'railway' || this.mapMode === 'infra';
      for (let l = 0; l < 5; l++) {
        ctx.strokeStyle = strong ? `hsl(${50 - l * 12},90%,${55 + l * 5}%)` : 'rgba(40,30,20,0.55)';
        ctx.lineWidth = (strong ? 1 + l * 0.6 : 0.6 + l * 0.25) * lw;
        this.rails[l].stroke(ctx, vb);
      }
    }
    // nomi dei paesi
    if (this.mapMode === 'political' || this.mapMode === 'railway') {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const L of this.labels) {
        const px = L.size * v.s;
        if (px < 9 || px > 80) continue;
        ctx.font = `600 ${L.size}px Oswald, "Arial Narrow", sans-serif`;
        const name = C(L.code).name.toUpperCase().split('').join(String.fromCharCode(8202));
        ctx.lineWidth = L.size / 7; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.strokeText(name, L.x, L.y);
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.fillText(name, L.x, L.y);
      }
    }
  },

  draw(sel) {
    if (S.mapDirty) this.rebuildStyles();
    this.clampView();
    const v = this.view, dpr = this.dpr, ctx = this.ctx;
    const key = `${v.s},${v.tx},${v.ty},${this.cv.width},${this.cv.height},${this.mapMode}`;
    if (key !== this.layerKey) { this.drawLayer(); this.layerKey = key; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.layer, 0, 0);
    for (const off of this.copies(v, this.cw)) this.drawDynamic(sel, { s: v.s, tx: v.tx + off * v.s, ty: v.ty });
    // riquadro di selezione
    if (this.box) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { x0, y0, x1, y1 } = this.box;
      ctx.fillStyle = 'rgba(255,225,77,0.1)'; ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 1;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
  },

  // tutto ciò che cambia a ogni fotogramma, per una copia della mappa (v = vista spostata)
  drawDynamic(sel, v) {
    const dpr = this.dpr, ctx = this.ctx, T = S.tiles;
    ctx.setTransform(v.s * dpr, 0, 0, v.s * dpr, v.tx * dpr, v.ty * dpr);
    const lw = 1 / v.s, zs = v.s * MAP_DATA.kmPerUnit / 2;
    const vx0 = (-40 - v.tx) / v.s, vy0 = (-40 - v.ty) / v.s;
    const vx1 = (this.cw + 40 - v.tx) / v.s, vy1 = (this.ch + 40 - v.ty) / v.s;
    const inView = t => t.cx >= vx0 && t.cx <= vx1 && t.cy >= vy0 && t.cy <= vy1;

    if (this.hover >= 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.8 * lw;
      ctx.stroke(this.paths[this.hover]);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(this.paths[this.hover], 'evenodd');
    }

    // punti vittoria, porti e nomi delle città
    const caps = new Set(Object.values(S.countries).filter(c => c.alive).map(c => c.capital));
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const t of T) {
      if (!t.land || !inView(t)) continue;
      const big = caps.has(t.i);
      if (!t.vp || (!big && t.vp < (zs > 2 ? 1 : zs > 1 ? 5 : 10))) continue;
      const r = (big ? 5 : t.vp >= 10 ? 3 : 2.2) * lw * Math.min(1.6, Math.max(0.8, zs / 2));
      if (big) {
        ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#2a1f00'; ctx.lineWidth = 0.8 * lw;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const rr = k % 2 ? r * 0.44 : r, a = -Math.PI / 2 + k * Math.PI / 5;
          k ? ctx.lineTo(t.cx + Math.cos(a) * rr, t.cy + Math.sin(a) * rr) : ctx.moveTo(t.cx + Math.cos(a) * rr, t.cy + Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#111'; ctx.lineWidth = 0.8 * lw;
        ctx.fillRect(t.cx - r, t.cy - r, 2 * r, 2 * r); ctx.strokeRect(t.cx - r, t.cy - r, 2 * r, 2 * r);
      }
      if (t.city && (zs > 2.2 || (big && zs > 1.2) || (t.vp >= 10 && zs > 1.6))) {
        const fs = 10.5 * lw;
        ctx.font = `600 ${fs}px Inter, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 2.6 * lw; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeText(t.city, t.cx, t.cy - r - 7 * lw);
        ctx.fillStyle = '#fff'; ctx.fillText(t.city, t.cx, t.cy - r - 7 * lw);
      }
    }
    if (zs > 1.6) {
      ctx.fillStyle = '#9fd0ff'; ctx.strokeStyle = '#0b2033'; ctx.lineWidth = 0.8 * lw;
      for (const t of T) {
        if (!t.port || t.port < 3 || !inView(t)) continue;
        const r = 2.4 * lw;
        ctx.beginPath(); ctx.arc(t.cx - 6 * lw, t.cy + 5 * lw, r, 0, 7); ctx.fill(); ctx.stroke();
      }
    }

    for (const f of this.overlays) {
      ctx.save();
      try { f(ctx, { s: v.s, tx: v.tx, ty: v.ty, lw }); } catch (e) { console.error(e); }
      ctx.restore();
    }

    // battaglie
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
    for (const bt of S.battles) {
      const t = T[bt.to];
      ctx.strokeStyle = 'rgba(255,60,40,0.9)'; ctx.lineWidth = 2.2 * lw;
      for (const f of bt.from) {
        const a = T[f];
        ctx.beginPath(); ctx.moveTo(a.cx, a.cy); ctx.lineTo(t.cx, t.cy); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(t.cx, t.cy, (9 + 3 * pulse) * lw, 0, 7);
      ctx.strokeStyle = `rgba(255,80,40,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 2 * lw; ctx.stroke();
    }

    // percorsi delle divisioni del giocatore
    ctx.lineWidth = 1.8 * lw;
    ctx.setLineDash([4 * lw, 3 * lw]);
    for (const d of S.divs) {
      if (!d.path.length || d.owner !== S.player) continue;
      const isSel = sel.has(d.id);
      ctx.strokeStyle = isSel ? 'rgba(120,255,140,0.95)' : 'rgba(120,255,140,0.35)';
      ctx.beginPath();
      ctx.moveTo(T[d.tile].cx, T[d.tile].cy);
      for (const p of d.path) ctx.lineTo(T[p].cx, T[p].cy);
      ctx.stroke();
      if (isSel) {
        const e = T[d.path[d.path.length - 1]];
        ctx.beginPath(); ctx.arc(e.cx, e.cy, 3 * lw, 0, 7);
        ctx.fillStyle = 'rgba(120,255,140,0.95)'; ctx.fill();
      }
    }
    ctx.setLineDash([]);

    this.drawCounters(ctx, sel, inView, lw, v);
  },

  // segnalini delle divisioni: dimensione fissa sullo schermo (come in HOI4)
  drawCounters(ctx, sel, inView, lw, v = this.view) {
    const T = S.tiles;
    const k0 = Math.max(0.55, Math.min(1.15, v.s * MAP_DATA.kmPerUnit / 2 / 1.6));
    const cw = 26 * k0 * lw, chh = 17 * k0 * lw;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${12 * k0 * lw}px Inter, Arial, sans-serif`;
    for (const [ti, arr] of S.byTile) {
      const t = T[ti];
      if (!inView(t)) continue;
      const groups = new Map();
      for (const d of arr) {
        if (d.dead) continue;
        let g = groups.get(d.owner);
        if (!g) { g = []; groups.set(d.owner, g); }
        g.push(d);
      }
      let k = 0;
      const n = groups.size;
      for (const [owner, g] of groups) {
        const x = t.cx - cw / 2 + (k - (n - 1) / 2) * cw * 0.45, y = t.cy + 5 * lw + (k - (n - 1) / 2) * chh * 0.4;
        k++;
        const c = C(owner);
        const anySel = g.some(d => sel.has(d.id));
        const isMine = owner === S.player;
        const enemy = atWar(owner, S.player);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x + 1.5 * lw, y + 1.5 * lw, cw, chh);
        ctx.fillStyle = shade(c.color, 0.8);
        ctx.fillRect(x, y, cw, chh);
        ctx.lineWidth = (anySel ? 2.2 : 1) * lw;
        ctx.strokeStyle = anySel ? '#ffe14d' : enemy ? '#ff5040' : isMine ? '#e8f0ff' : '#111';
        ctx.strokeRect(x, y, cw, chh);
        if (g.some(d => d.type === 'arm')) {
          ctx.fillStyle = '#ffe9a8';
          const a = chh * 0.22;
          ctx.beginPath(); ctx.moveTo(x + a * 1.6, y + a); ctx.lineTo(x + a * 2.6, y + chh / 2); ctx.lineTo(x + a * 1.6, y + chh - a); ctx.lineTo(x + a * 0.6, y + chh / 2); ctx.fill();
        }
        ctx.fillStyle = '#fff';
        ctx.fillText(String(g.length), x + cw / 2 + 2 * lw, y + chh / 2 + 0.5 * lw);
        let org = 0;
        for (const d of g) org += Math.min(1, d.org / divMaxOrg(d));
        org /= g.length;
        const bh = 3 * k0 * lw;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x, y + chh, cw, bh);
        ctx.fillStyle = org > 0.6 ? '#5fd35f' : org > 0.3 ? '#e2c044' : '#e0503c';
        ctx.fillRect(x, y + chh, cw * Math.max(0, Math.min(1, org)), bh);
        if (g.some(d => d.combat)) {
          ctx.fillStyle = '#ff4030';
          ctx.beginPath(); ctx.arc(x + cw, y, 3.2 * k0 * lw, 0, 7); ctx.fill();
        }
      }
    }
  },
};
