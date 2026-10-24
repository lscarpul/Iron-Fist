'use strict';
// Overlay della mappa per la guerra terrestre: ferrovie, hub, flusso di rifornimenti, meteo,
// e il teschio sulle divisioni senza rifornimenti.
// Con la mappa a province (Render.overlays / Render.modeColors) si aggancia a quelle API;
// con la vecchia mappa esagonale disegna sopra Render.draw.

function supplyColor(t) {
  if (!t.land) return null;
  if (!allied(t.ctrl, S.player)) return 'rgba(40,40,40,0.55)';
  const f = S.supplyFlow[t.i] || 0;
  return f <= 0 ? 'rgb(170,50,40)' : `rgb(${Math.round(200 - f * 170)},${Math.round(70 + f * 140)},60)`;
}
function weatherColor(t) {
  if (!t.land) return null;
  return ['#8aa05a', '#5f86b8', '#7a5530', '#d9e4ef', '#ffffff'][S.weather[t.i]];
}

const LandRender = {
  cv: null, key: '',
  provinceMap: () => typeof Render.overlays !== 'undefined',

  // tratte ferroviarie e hub (coordinate mappa); lw = un pixel dello schermo
  drawRails(g, lw) {
    const T = S.tiles;
    g.lineCap = 'round';
    for (const k in S.railE) {
      const lv = S.railE[k], a = T[Math.floor(k / 65536)], b = T[k % 65536];
      g.strokeStyle = 'rgba(20,20,20,0.85)'; g.lineWidth = (0.8 + lv * 0.45) * lw * 1.4;
      g.beginPath(); g.moveTo(a.cx, a.cy); g.lineTo(b.cx, b.cy); g.stroke();
      g.strokeStyle = lv >= 4 ? '#f2e3b0' : lv >= 2 ? '#c9b98a' : '#9d917a'; g.lineWidth = (0.35 + lv * 0.18) * lw * 1.4;
      g.setLineDash([1.6 * lw, 1.2 * lw]);
      g.beginPath(); g.moveTo(a.cx, a.cy); g.lineTo(b.cx, b.cy); g.stroke();
      g.setLineDash([]);
    }
    const info = C(S.player).landSup;
    const byHub = new Map((info?.hubs || []).map(H => [H.hub.id, H]));
    const s = 4 * lw;
    for (const hb of S.hubs) {
      const t = T[hb.tile], H = byHub.get(hb.id);
      const col = !H ? '#777' : H.cap <= 0 || H.ratio < 0.6 ? '#e0503c' : H.ratio < 0.95 ? '#e2c044' : '#6fcf6f';
      g.fillStyle = '#111'; g.fillRect(t.cx - s, t.cy - s, 2 * s, 2 * s);
      g.fillStyle = col; g.fillRect(t.cx - s * 0.75, t.cy - s * 0.75, 1.5 * s, 1.5 * s);
      if (H && H.motor > 0) {
        g.fillStyle = '#111'; g.font = `600 ${s * 1.2}px Inter, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('M', t.cx, t.cy + s * 0.05);
      }
    }
  },
  drawSkulls(g, lw, off) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const r = 4.5 * lw;
    g.font = `${r * 1.9}px sans-serif`;
    for (const [ti, arr] of S.byTile) {
      let bad = false;
      for (const d of arr) if (!d.dead && d.owner === S.player && (d.supply ?? 1) < 0.3) { bad = true; break; }
      if (!bad) continue;
      const t = S.tiles[ti], x = t.cx - off * lw, y = t.cy - off * lw;
      g.fillStyle = 'rgba(0,0,0,0.75)';
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = '#ff5a48';
      g.fillText('☠', x, y + r * 0.08);
    }
  },
  drawSelTile(g, lw) {
    if (LandUI.selTile < 0 || UI.tab !== 'logistica') return;
    const t = S.tiles[LandUI.selTile];
    g.strokeStyle = '#ffe14d'; g.lineWidth = 2 * lw;
    if (Render.paths && Render.paths[t.i]) g.stroke(Render.paths[t.i]);
    else { hexPath(g, t.cx, t.cy, HEX); g.stroke(); }
  },

  // ----- mappa esagonale -----
  rebuildHex(R) {
    if (!this.cv) this.cv = document.createElement('canvas');
    const BS = 1.5;
    this.cv.width = Math.ceil(R.ww * BS); this.cv.height = Math.ceil(R.wh * BS);
    const g = this.cv.getContext('2d');
    g.setTransform(BS, 0, 0, BS, 0, 0);
    g.clearRect(0, 0, R.ww, R.wh);
    const mode = LandUI.mapMode, colorOf = mode === 'supply' ? supplyColor : weatherColor;
    g.globalAlpha = mode === 'supply' ? 0.4 : 0.45;
    for (const t of S.tiles) {
      const col = colorOf(t);
      if (!col || (mode === 'weather' && !S.weather[t.i])) continue;
      hexPath(g, t.cx, t.cy, HEX + 0.5); g.fillStyle = col; g.fill();
    }
    g.globalAlpha = 1;
    if (mode === 'supply') this.drawRails(g, 0.25);
  },
  drawHex(R) {
    const ctx = R.ctx, v = R.view, dpr = R.dpr, lw = 1 / v.s;
    ctx.save();
    ctx.setTransform(v.s * dpr, 0, 0, v.s * dpr, v.tx * dpr, v.ty * dpr);
    if (LandUI.mapMode) {
      const key = LandUI.mapMode + ':' + S.day + ':' + S.hubs.length + ':' + (S.landDirty ? 1 : 0);
      if (key !== this.key || S.landOverlayDirty) { this.rebuildHex(R); this.key = key; S.landOverlayDirty = false; S.landDirty = false; }
      ctx.drawImage(this.cv, 0, 0, R.ww, R.wh);
    }
    this.drawSelTile(ctx, lw);
    this.drawSkulls(ctx, Math.min(lw, 0.6), 13);
    ctx.restore();
  },
};

// modalità mappa: con la mappa a province usa Render.setMapMode, altrimenti l'overlay esagonale
function setLandMapMode(mode) {
  LandUI.mapMode = mode || null;
  if (LandRender.provinceMap() && Render.setMapMode) Render.setMapMode(mode || 'political');
  S.landOverlayDirty = true; S.mapDirty = true;
}

(function () {
  if (LandRender.provinceMap()) {
    Render.modeColors = Render.modeColors || {};
    Render.modeColors.supply = supplyColor;
    Render.modeColors.weather = weatherColor;
    if (Render.MAP_MODES && !Render.MAP_MODES.some(m => m[0] === 'supply')) Render.MAP_MODES.push(['supply', 'Rifornimenti'], ['weather', 'Meteo']);
    Render.overlays.push((ctx, view) => {
      if (!S || !S.railE) return;
      const mode = Render.mapMode || LandUI.mapMode;
      if (mode === 'supply') LandRender.drawRails(ctx, view.lw);
      LandRender.drawSelTile(ctx, view.lw);
      LandRender.drawSkulls(ctx, view.lw, 12);
    });
  } else {
    const draw = Render.draw;
    Render.draw = function (sel) {
      draw.call(this, sel);
      if (S && S.railE) LandRender.drawHex(this);
    };
  }
})();
