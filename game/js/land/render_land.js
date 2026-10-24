'use strict';
// Overlay della mappa per la guerra terrestre: ferrovie, hub, flusso di rifornimenti, meteo,
// e il teschio sulle divisioni senza rifornimenti.

const LandRender = {
  cv: null, key: '',
  rebuild(R) {
    if (!this.cv) { this.cv = document.createElement('canvas'); }
    const BS = 1.5;
    this.cv.width = Math.ceil(R.ww * BS); this.cv.height = Math.ceil(R.wh * BS);
    const g = this.cv.getContext('2d');
    g.setTransform(BS, 0, 0, BS, 0, 0);
    g.clearRect(0, 0, R.ww, R.wh);
    const T = S.tiles, mode = LandUI.mapMode;
    if (mode === 'weather') {
      for (const t of T) {
        if (!t.land) continue;
        const w = WEATHER[S.weather[t.i]];
        if (!w.color) continue;
        hexPath(g, t.cx, t.cy, HEX + 0.5); g.fillStyle = w.color; g.fill();
      }
    }
    if (mode === 'supply') {
      for (const t of T) {
        if (!t.land) continue;
        hexPath(g, t.cx, t.cy, HEX + 0.5);
        if (allied(t.ctrl, S.player)) {
          const f = S.supplyFlow[t.i] || 0;
          g.fillStyle = f <= 0 ? 'rgba(200,40,30,0.45)' : `rgba(${Math.round(220 - f * 200)},${Math.round(80 + f * 150)},60,0.4)`;
        } else g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fill();
      }
    }
    // ferrovie (sempre nelle modalità logistiche)
    if (mode === 'supply') {
      g.lineCap = 'round';
      for (const t of T) {
        const r = S.rail[t.i];
        if (!r) continue;
        for (const n of t.nb) {
          if (n < t.i || !S.rail[n]) continue;
          const tn = T[n], lv = Math.min(r, S.rail[n]);
          g.strokeStyle = 'rgba(20,20,20,0.85)'; g.lineWidth = 0.8 + lv * 0.45;
          g.beginPath(); g.moveTo(t.cx, t.cy); g.lineTo(tn.cx, tn.cy); g.stroke();
          g.strokeStyle = lv >= 4 ? '#f2e3b0' : lv >= 2 ? '#c9b98a' : '#9d917a'; g.lineWidth = 0.35 + lv * 0.18;
          g.setLineDash([1.2, 1]);
          g.beginPath(); g.moveTo(t.cx, t.cy); g.lineTo(tn.cx, tn.cy); g.stroke();
          g.setLineDash([]);
        }
      }
      const info = C(S.player).landSup;
      const byHub = new Map((info?.hubs || []).map(H => [H.hub.id, H]));
      for (const hb of S.hubs) {
        const t = T[hb.tile], H = byHub.get(hb.id);
        const col = !H ? '#777' : H.cap <= 0 ? '#e0503c' : H.ratio < 0.6 ? '#e0503c' : H.ratio < 0.95 ? '#e2c044' : '#6fcf6f';
        g.fillStyle = '#111'; g.fillRect(t.cx - 3.2, t.cy - 3.2, 6.4, 6.4);
        g.fillStyle = col; g.fillRect(t.cx - 2.4, t.cy - 2.4, 4.8, 4.8);
        if (H && H.motor > 0) { g.fillStyle = '#111'; g.font = '600 3.6px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('M', t.cx, t.cy + 0.2); }
      }
    }
  },
  draw(R) {
    const mode = LandUI.mapMode;
    const ctx = R.ctx, v = R.view, dpr = R.dpr;
    ctx.save();
    ctx.setTransform(v.s * dpr, 0, 0, v.s * dpr, v.tx * dpr, v.ty * dpr);
    if (mode) {
      const key = mode + ':' + S.day + ':' + S.hubs.length + ':' + (S.landDirty ? 1 : 0);
      if (key !== this.key || S.landOverlayDirty) { this.rebuild(R); this.key = key; S.landOverlayDirty = false; S.landDirty = false; }
      ctx.drawImage(this.cv, 0, 0, R.ww, R.wh);
    }
    // esagono selezionato nella scheda logistica
    if (LandUI.selTile >= 0 && UI.tab === 'logistica') {
      const t = S.tiles[LandUI.selTile];
      hexPath(ctx, t.cx, t.cy, HEX);
      ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2 / v.s; ctx.stroke();
    }
    // divisioni senza rifornimenti: teschio sopra il segnalino
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '7px sans-serif';
    for (const [ti, arr] of S.byTile) {
      let bad = false;
      for (const d of arr) if (!d.dead && d.owner === S.player && (d.supply ?? 1) < 0.3) { bad = true; break; }
      if (!bad) continue;
      const t = S.tiles[ti];
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath(); ctx.arc(t.cx - 8, t.cy - 7, 3.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff5a48';
      ctx.fillText('☠', t.cx - 8, t.cy - 6.7);
    }
    ctx.restore();
  },
};

(function () {
  const draw = Render.draw;
  Render.draw = function (sel) {
    draw.call(this, sel);
    if (S && S.rail) LandRender.draw(this);
  };
})();
