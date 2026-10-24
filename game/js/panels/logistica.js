'use strict';
// Scheda Logistica: rifornimenti, hub, camion, ferrovie, meteo e modalità mappa.

function landPanelLogistica(p) {
  const info = p.landSup || computeSupply(p.code);
  const mine = S.divs.filter(d => d.owner === p.code && !d.dead);
  const noSup = mine.filter(d => (d.supply ?? 1) < 0.3).length, low = mine.filter(d => (d.supply ?? 1) < 0.7).length;
  const ratio = info.demand > 0 ? Math.min(1, info.delivered / info.demand) : 1;
  let h = `<h3>Logistica</h3>
    <div class="stats"><div><b>${n1(info.demand)}</b><small>fabbisogno/g</small></div><div><b class="${ratio < 0.7 ? 'bad' : ''}">${pct(ratio)}</b><small>consegnato</small></div><div><b class="${noSup ? 'bad' : ''}">${noSup}</b><small>senza rifornim.</small></div></div>
    ${low ? `<p class="warn">${low} divisioni con rifornimenti sotto il 70%.</p>` : ''}
    <div class="lchips"><button data-act="mapMode" data-arg="supply" class="${LandUI.mapMode === 'supply' ? 'on' : ''}">🗺️ Mappa rifornimenti</button>
      <button data-act="mapMode" data-arg="weather" class="${LandUI.mapMode === 'weather' ? 'on' : ''}">☁️ Mappa meteo</button>
      <button data-act="mapMode" data-arg="" class="${!LandUI.mapMode ? 'on' : ''}">Politica</button></div>
    <p class="hint">I rifornimenti nascono nella capitale, viaggiano in treno fino agli hub e da lì a cavallo (2-3 esagoni) o in camion (4-5). Fango, neve e infrastrutture scarse accorciano il raggio.</p>`;
  // camion
  const tr = Math.floor(trucksOf(p));
  h += `<h4>Camion</h4><div class="row"><span>Disponibili <b>${fmt(tr)}</b></span><span>In uso ${fmt(info.trucksUsed)} / richiesti ${fmt(info.trucksNeed)}</span></div>
    ${info.trucksNeed > info.trucksUsed ? `<p class="warn">Mancano camion: alcuni hub restano a cavallo.</p>` : ''}
    <div class="row2"><button data-act="autoMotor" class="${p.autoMotor ? 'on primary' : ''}">${p.autoMotor ? '✓ Motorizza in automatico' : 'Motorizza in automatico'}</button>
    ${typeof Econ === 'undefined' || !(p.stock && p.stock.camion != null) ? `<button data-act="buyTrucks" ${p.equipment >= 150 ? '' : 'disabled'}>+100 camion (🔫 150)</button>` : '<span></span>'}</div>`;
  // casella selezionata
  const ti = LandUI.selTile;
  if (ti >= 0) {
    const t = S.tiles[ti], hb = hubAt(ti), w = weatherOf(ti);
    h += `<h4>Esagono selezionato</h4><div class="card cur">
      <p>${t.land ? `${flag(C(t.owner))} ${esc(C(t.owner).name)} · ${TERRAIN[t.terrain]?.name || t.terrain}` : 'Mare'} · ${w.icon} ${w.name}</p>
      <p>Ferrovia liv. <b>${S.rail[ti]}</b> (${RAIL_CAP[S.rail[ti]]}/g) · Infrastrutture <b>${S.infra[ti]}</b>/5 ${hb ? '· <b>Hub</b>' : ''}</p>
      <p>Flusso di rifornimenti: ${pct(S.supplyFlow[ti] || 0)}</p>
      ${['rail', 'hub', 'infra'].map(k => {
        const err = landBuildCheck(p, k, ti);
        const name = { rail: S.rail[ti] ? 'Potenzia ferrovia' : 'Costruisci ferrovia', hub: 'Costruisci hub', infra: 'Migliora infrastrutture' }[k];
        return `<button data-act="landBuild" data-arg="${k}" ${err ? `disabled title="${esc(err)}"` : ''}>${name}</button>`;
      }).join(' ')}
      </div>`;
  } else h += `<p class="hint">Clicca un esagono sulla mappa (con questa scheda aperta) per vedere ferrovie e infrastrutture e costruire.</p>`;
  const jobs = p.construction.filter(j => j.tile != null);
  if (jobs.length) {
    h += `<h4>Cantieri logistici</h4>`;
    for (const j of jobs) h += `<div class="qrow"><span>${{ rail: '🛤️ Ferrovia', hub: '📦 Hub', infra: '🛣️ Infrastr.' }[j.type]}</span>${bar(j.prog / j.cost)}<button class="x" data-act="centerTile" data-arg="${j.tile}">◎</button></div>`;
  }
  // hub
  const hubs = info.hubs.filter(H => H.cap > 0 && (H.demand > 0.01 || (p.motorHubs || []).includes(H.hub.id)))
    .sort((a, b) => a.ratio - b.ratio);
  h += `<h4>Hub attivi (${hubs.length})</h4>`;
  if (!hubs.length) h += `<p class="hint">Nessun hub sta rifornendo truppe.</p>`;
  for (const H of hubs) {
    const t = S.tiles[H.hub.tile], motorized = (p.motorHubs || []).includes(H.hub.id);
    h += `<div class="card"><div class="row"><b>${H.via === 'capitale' ? '★ Capitale' : 'Hub'} ${esc(C(t.owner).name)}</b><small>${H.via}${H.railFactor < 0.99 ? ` · linea satura ${pct(H.railFactor)}` : ''}</small></div>
      <div class="row3"><small>Consegna</small>${bar(H.ratio, H.ratio < 0.6 ? 'bad' : '')}<small>${n1(H.demand)}/${n1(H.cap * (H.railFactor ?? 1))}</small><span></span></div>
      <div class="row2"><button data-act="motor" data-arg="${H.hub.id}" class="${motorized ? 'on' : ''}">${H.motor > 0 ? `🚚 Motorizzato ${pct(H.motor)}` : '🐎 A cavallo'}</button><button data-act="centerTile" data-arg="${H.hub.tile}">Mostra</button></div></div>`;
  }
  h += `<h4>Meteo</h4><p class="hint">${WEATHER.map(w => `${w.icon} ${w.name}: velocità ${pct(w.spd)}, raggio rifornimenti ÷${w.supply}${w.atk ? `, attacco ${Math.round(w.atk * 100)}%` : ''}`).join('<br>')}</p>`;
  return h;
}

const LOGISTICA_ACTIONS = {
  mapMode(arg) { LandUI.mapMode = arg || null; S.landOverlayDirty = true; },
  autoMotor() { const p = C(S.player); p.autoMotor = !p.autoMotor; computeSupply(p.code); },
  buyTrucks() { const p = C(S.player); if (p.equipment >= 150) { p.equipment -= 150; addTrucks(p, 100); } },
  motor(arg) {
    const p = C(S.player), id = +arg;
    p.motorHubs = p.motorHubs || [];
    const i = p.motorHubs.indexOf(id);
    if (i >= 0) p.motorHubs.splice(i, 1); else p.motorHubs.push(id);
    computeSupply(p.code);
  },
  landBuild(arg) { const err = queueLandBuild(C(S.player), arg, LandUI.selTile); if (err) log(err, 'warn'); },
  centerTile(arg) { LandUI.selTile = +arg; Render.centerOn(+arg, 2.5); },
};

UI.registerPanel({
  id: 'logistica', title: 'Logistica', icon: 'supply', group: 'state', order: 60, width: 460,
  render: landPanelLogistica,
  badge(p) { const n = S.divs.filter(d => d.owner === p.code && !d.dead && (d.supply ?? 1) < 0.3).length; return n || null; },
  actions: LOGISTICA_ACTIONS,
});

// ---------- agganci all'input della mappa e ai tooltip ----------
(function () {
  const click = UI.clickTile;
  if (click) UI.clickTile = function (ti, add) {
    if (ti >= 0 && LandUI.paradrop) { doParadrop(ti); this.dirty = true; return; }
    if (ti >= 0 && this.tab === 'logistica') { LandUI.selTile = ti; this.dirty = true; this.lastPanel = ''; return; }
    return click.call(this, ti, add);
  };
  const tip = UI.tileTip;
  if (tip) UI.tileTip = function (ti) { return tip.call(this, ti) + landTileTip(ti); };
})();

function landTileTip(ti) {
  const t = S.tiles[ti];
  if (!t.land) return '';
  const w = weatherOf(ti);
  let h = `<br>${w.icon} ${w.name} · Ferrovia ${S.rail[ti]} · Infrastrutture ${S.infra[ti]}${hubAt(ti) ? ' · Hub' : ''}`;
  const ter = terrainOf(ti);
  h += `<br>Larghezza di combattimento ${ter.width} (+${ter.extra} per direzione)${ter.atk ? ` · attacco ${Math.round(ter.atk * 100)}%` : ''}`;
  if (LandUI.mapMode === 'supply' && allied(t.ctrl, S.player)) h += `<br>Flusso rifornimenti ${pct(S.supplyFlow[ti] || 0)}`;
  const b = S.battles.find(x => x.to === ti);
  if (b) {
    h += `<br><b class="bad">Battaglia</b>: ${esc(C(b.att).name)} contro ${esc(C(b.def).name)}`;
    h += `<br>Fronte ${b.width}: attaccanti ${Math.round(b.aW)}${b.aRes ? ` (+${b.aRes} in riserva)` : ''}, difensori ${Math.round(b.dW)} · direzioni ${b.dirs}`;
    if (b.atkOver > 0) h += `<br><span class="warn">Sovraffollamento attaccante: -${Math.round(b.atkOver * 100)}%</span>`;
    if (b.pierced[0]) h += `<br>La corazza attaccante non viene perforata`;
    if (b.pierced[1]) h += `<br>La corazza difensiva non viene perforata`;
    const aO = b.aOrg0 ? b.aOrg1 / b.aOrg0 : 0, dO = b.dOrg0 ? b.dOrg1 / b.dOrg0 : 0;
    h += `<br>Organizzazione: attaccanti ${pct(aO)}, difensori ${pct(dO)}`;
  }
  return h;
}
