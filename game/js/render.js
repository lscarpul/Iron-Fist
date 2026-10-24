'use strict';

const HEX_CORNERS = [0, 1, 2, 3, 4, 5].map(k => {
  const a = Math.PI / 180 * (60 * k - 30);
  return [Math.cos(a), Math.sin(a)];
});
function hexPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const x = cx + HEX_CORNERS[k][0] * r, y = cy + HEX_CORNERS[k][1] * r;
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}
function sharedEdge(t, n) {
  const mx = (t.cx + n.cx) / 2, my = (t.cy + n.cy) / 2;
  const pts = HEX_CORNERS.map(([cx, cy]) => [t.cx + cx * HEX, t.cy + cy * HEX])
    .sort((a, b) => ((a[0] - mx) ** 2 + (a[1] - my) ** 2) - ((b[0] - mx) ** 2 + (b[1] - my) ** 2));
  return [pts[0], pts[1]];
}

const Render = {
  BS: 2, view: { s: 1, tx: 0, ty: 0 }, hover: -1, box: null,
  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.ww = MAP_PAD * 2 + HEX * SQ3 * (S.W + 0.5) + HEX;
    this.wh = MAP_PAD * 2 + HEX * 2 + HEX * 1.5 * (S.H - 1);
    this.base = document.createElement('canvas');
    this.base.width = Math.ceil(this.ww * this.BS);
    this.base.height = Math.ceil(this.wh * this.BS);
    this.bctx = this.base.getContext('2d');
    this.patterns = {};
    this.resize();
    this.fit();
  },
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.cw = r.width; this.ch = r.height;
    this.cv.width = Math.round(r.width * this.dpr);
    this.cv.height = Math.round(r.height * this.dpr);
    this.cv.style.width = r.width + 'px';
    this.cv.style.height = r.height + 'px';
  },
  fit() {
    const s = Math.min(this.cw / this.ww, this.ch / this.wh) * 1.02;
    this.view.s = s;
    this.view.tx = (this.cw - this.ww * s) / 2;
    this.view.ty = (this.ch - this.wh * s) / 2;
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
    this.view.s = Math.max(0.4, Math.min(8, this.view.s * f));
    this.view.tx = sx - wx * this.view.s;
    this.view.ty = sy - wy * this.view.s;
  },
  tileAt(sx, sy) {
    const [wx, wy] = this.toWorld(sx, sy);
    const ry = Math.round((wy - MAP_PAD - HEX) / (HEX * 1.5));
    let best = -1, bd = Infinity;
    for (let y = ry - 1; y <= ry + 1; y++) {
      if (y < 0 || y >= S.H) continue;
      const rx = Math.round((wx - MAP_PAD - HEX * SQ3 / 2) / (HEX * SQ3) - 0.5 * (y & 1));
      for (let x = rx - 1; x <= rx + 1; x++) {
        if (x < 0 || x >= S.W) continue;
        const t = S.tiles[y * S.W + x];
        const d = (t.cx - wx) ** 2 + (t.cy - wy) ** 2;
        if (d < bd) { bd = d; best = t.i; }
      }
    }
    return bd < HEX * HEX * 1.3 ? best : -1;
  },
  stripe(color) {
    if (this.patterns[color]) return this.patterns[color];
    const p = document.createElement('canvas');
    p.width = p.height = 6;
    const g = p.getContext('2d');
    g.strokeStyle = color; g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(-1, 7); g.lineTo(7, -1);
    g.moveTo(-1, 1); g.lineTo(1, -1);
    g.moveTo(5, 7); g.lineTo(7, 5);
    g.stroke();
    return (this.patterns[color] = this.bctx.createPattern(p, 'repeat'));
  },

  rebuildBase() {
    S.mapDirty = false;
    const b = this.bctx, T = S.tiles;
    b.setTransform(this.BS, 0, 0, this.BS, 0, 0);
    b.fillStyle = '#122a3f';
    b.fillRect(0, 0, this.ww, this.wh);
    for (const t of T) {
      if (t.land) continue;
      hexPath(b, t.cx, t.cy, HEX + 0.6);
      b.fillStyle = t.nearLand ? '#1a3a57' : '#14304a';
      b.fill();
    }
    for (const t of T) {
      if (!t.land) continue;
      const own = C(t.owner);
      hexPath(b, t.cx, t.cy, HEX + 0.6);
      b.fillStyle = shade(own.color, TERRAIN[t.terrain].shade);
      b.fill();
      if (t.ctrl !== t.owner) { b.fillStyle = this.stripe(C(t.ctrl).color); b.fill(); }
    }
    // simboli del terreno
    b.lineWidth = 0.7;
    for (const t of T) {
      if (!t.land || t.vp) continue;
      if (t.terrain === 'mountain') {
        b.strokeStyle = 'rgba(0,0,0,0.28)';
        b.beginPath(); b.moveTo(t.cx - 3.5, t.cy + 2); b.lineTo(t.cx - 0.5, t.cy - 2.5); b.lineTo(t.cx + 2.5, t.cy + 2);
        b.moveTo(t.cx + 0.8, t.cy - 0.5); b.lineTo(t.cx + 2.2, t.cy - 2); b.lineTo(t.cx + 4, t.cy + 2); b.stroke();
      } else if (t.terrain === 'forest') {
        b.fillStyle = 'rgba(0,30,0,0.22)';
        for (const [ox, oy] of [[-2.5, 1], [1.5, -1.5], [2, 2]]) { b.beginPath(); b.arc(t.cx + ox, t.cy + oy, 1.3, 0, 7); b.fill(); }
      } else if (t.terrain === 'hills') {
        b.strokeStyle = 'rgba(0,0,0,0.2)';
        b.beginPath(); b.arc(t.cx, t.cy + 2.5, 3, Math.PI * 1.15, Math.PI * 1.85); b.stroke();
      }
    }
    b.lineWidth = 0.35;
    b.strokeStyle = 'rgba(0,0,0,0.13)';
    for (const t of T) if (t.land) { hexPath(b, t.cx, t.cy, HEX); b.stroke(); }
    // confini, coste e linee del fronte
    const coast = [], border = [], frontL = [];
    for (const t of T) {
      if (!t.land) continue;
      for (const n of t.nb) {
        const tn = T[n];
        if (!tn.land) coast.push(sharedEdge(t, tn));
        else if (n > t.i) {
          if (atWar(t.ctrl, tn.ctrl)) frontL.push(sharedEdge(t, tn));
          else if (tn.owner !== t.owner) border.push(sharedEdge(t, tn));
        }
      }
    }
    const strokeEdges = (edges, color, w) => {
      b.strokeStyle = color; b.lineWidth = w; b.lineCap = 'round';
      b.beginPath();
      for (const [p, q] of edges) { b.moveTo(p[0], p[1]); b.lineTo(q[0], q[1]); }
      b.stroke();
    };
    strokeEdges(coast, '#0a1826', 1.2);
    strokeEdges(border, 'rgba(12,12,16,0.85)', 1.3);
    strokeEdges(frontL, '#ff3b30', 1.8);
    // punti vittoria
    for (const t of T) {
      if (!t.vp) continue;
      if (t.vp >= 20) {
        b.fillStyle = '#ffd34d'; b.strokeStyle = '#2a1f00'; b.lineWidth = 0.7;
        b.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 2.2 : 5, a = -Math.PI / 2 + k * Math.PI / 5;
          const x = t.cx + Math.cos(a) * r, y = t.cy + Math.sin(a) * r;
          k ? b.lineTo(x, y) : b.moveTo(x, y);
        }
        b.closePath(); b.fill(); b.stroke();
      } else {
        b.fillStyle = '#f2f2f2'; b.strokeStyle = '#111'; b.lineWidth = 0.7;
        b.fillRect(t.cx - 1.8, t.cy - 1.8, 3.6, 3.6); b.strokeRect(t.cx - 1.8, t.cy - 1.8, 3.6, 3.6);
      }
    }
    // nomi dei paesi
    const acc = {};
    for (const t of T) {
      if (!t.land) continue;
      const a = acc[t.owner] || (acc[t.owner] = { x: 0, y: 0, n: 0 });
      a.x += t.cx; a.y += t.cy; a.n++;
    }
    b.textAlign = 'center'; b.textBaseline = 'middle';
    for (const code in acc) {
      const a = acc[code];
      const size = Math.max(6, Math.min(30, Math.sqrt(a.n) * 1.45));
      b.font = `600 ${size}px Oswald, "Arial Narrow", sans-serif`;
      const name = C(code).name.toUpperCase().split('').join(String.fromCharCode(8202));
      b.lineWidth = size / 6; b.strokeStyle = 'rgba(0,0,0,0.45)';
      b.strokeText(name, a.x / a.n, a.y / a.n);
      b.fillStyle = 'rgba(255,255,255,0.82)';
      b.fillText(name, a.x / a.n, a.y / a.n);
    }
  },

  draw(sel) {
    if (S.mapDirty) this.rebuildBase();
    const ctx = this.ctx, v = this.view, dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d2033';
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(v.s * dpr, 0, 0, v.s * dpr, v.tx * dpr, v.ty * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0, this.base.width / this.BS, this.base.height / this.BS);
    const T = S.tiles;
    const lw = 1 / v.s;

    if (this.hover >= 0) {
      const t = T[this.hover];
      hexPath(ctx, t.cx, t.cy, HEX);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5 * lw; ctx.stroke();
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
      ctx.beginPath(); ctx.arc(t.cx, t.cy, HEX * (0.9 + 0.25 * pulse), 0, 7);
      ctx.strokeStyle = `rgba(255,80,40,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 2 * lw; ctx.stroke();
    }

    // percorsi delle divisioni selezionate
    ctx.lineWidth = 1.6 * lw;
    ctx.setLineDash([3 * lw, 2 * lw]);
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
        ctx.beginPath(); ctx.arc(e.cx, e.cy, 2.5, 0, 7);
        ctx.fillStyle = 'rgba(120,255,140,0.95)'; ctx.fill();
      }
    }
    ctx.setLineDash([]);

    // segnalini delle divisioni
    const cw = 13, chh = 8.5;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 6.4px Inter, Arial, sans-serif`;
    for (const [ti, arr] of S.byTile) {
      const t = T[ti];
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
        const x = t.cx - cw / 2 + (k - (n - 1) / 2) * 5, y = t.cy - chh / 2 - 1 + (k - (n - 1) / 2) * 3;
        k++;
        const c = C(owner);
        const anySel = g.some(d => sel.has(d.id));
        const isMine = owner === S.player;
        const enemy = atWar(owner, S.player);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x + 0.8, y + 0.8, cw, chh);
        ctx.fillStyle = shade(c.color, 0.8);
        ctx.fillRect(x, y, cw, chh);
        ctx.lineWidth = anySel ? 1.4 : 0.7;
        ctx.strokeStyle = anySel ? '#ffe14d' : enemy ? '#ff5040' : isMine ? '#e8f0ff' : '#111';
        ctx.strokeRect(x, y, cw, chh);
        if (g.some(d => d.type === 'arm')) {
          ctx.fillStyle = '#ffe9a8';
          ctx.beginPath(); ctx.moveTo(x + 2.2, y + 2); ctx.lineTo(x + 4, y + chh / 2); ctx.lineTo(x + 2.2, y + chh - 2); ctx.lineTo(x + 0.6, y + chh / 2); ctx.fill();
        }
        ctx.fillStyle = '#fff';
        ctx.fillText(String(g.length), x + cw / 2 + 1, y + chh / 2 + 0.3);
        // barra organizzazione
        let org = 0;
        for (const d of g) org += d.org / UNIT_TYPES[d.type].org;
        org /= g.length;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x, y + chh, cw, 1.6);
        ctx.fillStyle = org > 0.6 ? '#5fd35f' : org > 0.3 ? '#e2c044' : '#e0503c';
        ctx.fillRect(x, y + chh, cw * org, 1.6);
        if (g.some(d => d.combat)) {
          ctx.fillStyle = '#ff4030';
          ctx.beginPath(); ctx.arc(x + cw, y, 1.8, 0, 7); ctx.fill();
        }
      }
    }

    // riquadro di selezione
    if (this.box) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { x0, y0, x1, y1 } = this.box;
      ctx.fillStyle = 'rgba(255,225,77,0.1)'; ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 1;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
  },
};
