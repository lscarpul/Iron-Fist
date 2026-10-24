'use strict';

// Interfaccia comune di aviazione e marina: finestra del designer, selezione di regioni sulla mappa,
// sovrapposizione grafica sulla mappa (regioni, superiorità, flotte, missioni).
// Usa UI.registerPanel della nuova interfaccia se c'è; altrimenti aggiunge le schede alla vecchia.

const ANUI = {
  pick: null,      // { kind, ..., valid(rid|tile) → bool, done(rid|tile) }
  hoverTile: -1,
  panels: {},
};

// ---------- compatibilità con l'interfaccia base ----------
if (typeof UI.registerPanel !== 'function') {
  UI.registerPanel = function (def) {
    ANUI.panels[def.id] = def;
    const tabs = document.getElementById('tabs');
    if (tabs && !tabs.querySelector(`[data-tab="${def.id}"]`)) {
      const b = document.createElement('button');
      b.dataset.tab = def.id;
      b.textContent = def.title;
      tabs.appendChild(b);
      tabs.style.gridTemplateColumns = `repeat(${Math.ceil(tabs.children.length / 2)}, 1fr)`;
    }
    UI['panel_' + def.id] = () => def.render(C(S.player));
  };
  const _act = UI.act;
  UI.act = function (name, arg) {
    const def = ANUI.panels[this.tab];
    if (def && def.actions && def.actions[name]) {
      def.actions[name](arg);
      this.dirty = true; this.lastPanel = '';
      return;
    }
    return _act.call(this, name, arg);
  };
}

const anTag = (txt, cls = '') => `<span class="an-tag ${cls}">${txt}</span>`;
const anBar = (f, cls) => (typeof bar === 'function' ? bar(f, cls) : '');

// ---------- finestra modale propria (mette in pausa il gioco) ----------
function anModal(title, html, bind) {
  let bg = document.getElementById('an-modal-bg');
  if (!bg) {
    bg = document.createElement('div');
    bg.id = 'an-modal-bg';
    bg.innerHTML = '<div id="an-modal"></div>';
    document.body.appendChild(bg);
    bg.addEventListener('mousedown', e => { if (e.target === bg) anCloseModal(); });
  }
  const m = document.getElementById('an-modal');
  m.innerHTML = `<div class="an-mhead"><h2>${esc(title)}</h2><button class="an-x" data-close>✕</button></div><div class="an-mbody">${html}</div>`;
  m.querySelector('[data-close]').onclick = anCloseModal;
  bg.classList.remove('hidden');
  ANUI.wasModal = UI.modalOpen;
  UI.modalOpen = true;
  if (bind) bind(m);
}
function anCloseModal() {
  const bg = document.getElementById('an-modal-bg');
  if (bg) bg.classList.add('hidden');
  UI.modalOpen = !!ANUI.wasModal && !document.getElementById('modal-bg')?.classList.contains('hidden');
  UI.dirty = true; UI.lastPanel = '';
}
// lista di scelte: [{label, sub, fn, disabled}]
function anChoose(title, items, intro = '') {
  const html = (intro ? `<p class="an-hint">${intro}</p>` : '') + items.map((it, i) =>
    `<button class="an-choice" data-i="${i}" ${it.disabled ? 'disabled' : ''}><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`).join('');
  anModal(title, html, m => {
    m.querySelectorAll('.an-choice').forEach(b => b.onclick = () => { const it = items[+b.dataset.i]; anCloseModal(); it.fn(); });
  });
}

// ---------- selezione sulla mappa ----------
function anStartPick(p) {
  ANUI.pick = p;
  UI.dirty = true; UI.lastPanel = '';
}
function anCancelPick() { ANUI.pick = null; UI.dirty = true; UI.lastPanel = ''; }

function anInitMapInput() {
  const cv = document.getElementById('map');
  if (!cv || cv.dataset.an) return;
  cv.dataset.an = '1';
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('mousedown', e => {
    if (!ANUI.pick) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.button === 2) { anCancelPick(); return; }
    if (e.button !== 0) return;
    const ti = Render.tileAt(...pos(e));
    if (ti < 0) return;
    const p = ANUI.pick;
    const key = p.tiles ? ti : regionOfTile(ti);
    if (!p.valid(key)) { log(p.invalidMsg || 'Destinazione non valida.', 'warn'); return; }
    ANUI.pick = null;
    p.done(key);
    UI.dirty = true; UI.lastPanel = '';
  }, true);
  cv.addEventListener('mousemove', e => { ANUI.hoverTile = Render.tileAt(...pos(e)); }, true);
  cv.addEventListener('mouseleave', () => { ANUI.hoverTile = -1; });
  window.addEventListener('keydown', e => { if (e.code === 'Escape' && ANUI.pick) anCancelPick(); });
}

// ---------- designer ----------
function anOpenDesigner(kind, base) {
  const p = C(S.player);
  const types = kind === 'air' ? Object.keys(AIR_ROLES) : HULL_ORDER;
  const st = {
    type: base ? base.type : types[0],
    gen: base ? base.gen : bestGen(p, kind),
    modules: base ? { ...base.modules } : null,
    name: base ? base.name + ' (mod.)' : '',
  };
  const SLOTS = kind === 'air' ? AIR_SLOTS : SHIP_SLOTS;
  const MODS = kind === 'air' ? AIR_MODULES : SHIP_MODULES;
  const NAMES = kind === 'air' ? AIR_STAT_NAMES : SHIP_STAT_NAMES;
  const typeName = t => kind === 'air' ? AIR_ROLES[t].name : HULLS[t].name;
  if (!st.modules) st.modules = defaultModules(p, kind, st.type);

  const render = m => {
    const stats = kind === 'air' ? airStats(st.type, st.gen, st.modules) : shipStats(st.type, st.gen, st.modules);
    const ref = ensureDefaultDesign(p, kind, st.type).stats;
    const rows = Object.keys(NAMES).filter(k => stats[k] || ref[k]).map(k => {
      const d = Math.round((stats[k] - ref[k]) * 10) / 10;
      const better = k === 'cost' || k === 'vis' || k === 'subVis' ? d < 0 : d > 0;
      return `<tr><td>${NAMES[k]}</td><td><b>${stats[k]}</b></td><td class="${d ? (better ? 'good' : 'bad') : ''}">${d ? (d > 0 ? '+' : '') + d : ''}</td></tr>`;
    }).join('');
    const days = kind === 'air'
      ? `≈ ${(FACTORY_OUTPUT * 0.5 * 10 / stats.cost).toFixed(1)} aerei al giorno con 10 fabbriche al 50%`
      : `≈ ${Math.ceil(stats.cost / (DOCKYARD_OUTPUT * MAX_DOCKS_PER_LINE))} giorni con ${MAX_DOCKS_PER_LINE} cantieri`;
    m.querySelector('.an-mbody').innerHTML = `
      <div class="an-designer">
        <div>
          <label>Tipo<select data-f="type">${types.map(t => `<option value="${t}" ${t === st.type ? 'selected' : ''}>${typeName(t)}</option>`).join('')}</select></label>
          <label>${kind === 'air' ? 'Telaio' : 'Scafo'}<select data-f="gen">${TECH_YEARS.map((y, g) => `<option value="${g}" ${g === st.gen ? 'selected' : ''} ${genAvailable(p, kind, g) ? '' : 'disabled'}>${y}${genAvailable(p, kind, g) ? '' : ' (non ancora disponibile)'}</option>`).join('')}</select></label>
          ${SLOTS[st.type].map(s => `<label>${s.name}<select data-slot="${s.k}">${s.opts.map(o => {
            const ok = moduleAvailable(p, kind, MODS[o]);
            return `<option value="${o}" ${st.modules[s.k] === o ? 'selected' : ''} ${ok ? '' : 'disabled'}>${MODS[o].name}${ok ? '' : ` (dal ${MODS[o].year})`}</option>`;
          }).join('')}</select></label>`).join('')}
          <label>Nome<input id="an-dname" maxlength="40" value="${esc(st.name || `${typeName(st.type)} ${TECH_YEARS[st.gen]}`)}"></label>
        </div>
        <div>
          <table class="an-tbl"><tr><th>Statistica</th><th></th><th>vs standard</th></tr>${rows}</table>
          <p class="an-hint">${days}</p>
        </div>
      </div>
      <div class="an-mbtns"><button data-close2>Annulla</button><button class="primary" data-save>Salva progetto</button></div>`;
    m.querySelector('[data-f="type"]').onchange = e => { st.type = e.target.value; st.modules = defaultModules(p, kind, st.type); st.name = ''; render(m); };
    m.querySelector('[data-f="gen"]').onchange = e => { st.gen = +e.target.value; render(m); };
    m.querySelectorAll('[data-slot]').forEach(s => s.onchange = e => { st.modules[s.dataset.slot] = e.target.value; render(m); });
    m.querySelector('#an-dname').oninput = e => { st.name = e.target.value; };
    m.querySelector('[data-close2]').onclick = anCloseModal;
    m.querySelector('[data-save]').onclick = () => {
      const name = (m.querySelector('#an-dname').value || '').trim() || `${typeName(st.type)} ${TECH_YEARS[st.gen]}`;
      const d = newDesign(S.player, kind, st.type, st.gen, st.modules, name);
      log(`Nuovo progetto: ${d.name}.`, 'good');
      anCloseModal();
    };
  };
  anModal(kind === 'air' ? 'Progettazione aerei' : 'Progettazione navi', '', render);
}

function anDesignLine(d) {
  const s = d.stats;
  if (d.kind === 'air') {
    const main = d.type === 'fighter' ? `Att.aereo ${s.airAtk} · Agilità ${s.agility}` : d.type === 'cas' ? `Att.suolo ${s.ground} · Agilità ${s.agility}`
      : d.type === 'strat' ? `Strategico ${s.strat} · Dif ${s.airDef}` : `Navale ${s.naval} · Agilità ${s.agility}`;
    return `${main} · ${s.range} km · costo ${s.cost}`;
  }
  const parts = [];
  if (s.hAtk) parts.push(`Pes ${s.hAtk}/${s.hPrc}`);
  if (s.lAtk) parts.push(`Legg ${s.lAtk}/${s.lPrc}`);
  if (s.torp) parts.push(`Siluri ${s.torp}`);
  if (s.deck) parts.push(`Aerei ${s.deck}`);
  if (s.subAtk) parts.push(`ASW ${s.subAtk}`);
  parts.push(`Cor ${s.armor}`, `${s.speed} nd`, `costo ${s.cost}`);
  return parts.join(' · ');
}

// ---------- sovrapposizione sulla mappa ----------
const ANMap = {
  cv: null, edges: null,
  init() {
    const wrap = document.getElementById('mapwrap');
    if (!wrap || this.cv) return;
    this.cv = document.createElement('canvas');
    this.cv.id = 'an-overlay';
    wrap.appendChild(this.cv);
    this.hint = document.createElement('div');
    this.hint.id = 'an-pickhint';
    this.hint.className = 'hidden';
    wrap.appendChild(this.hint);
    this.ctx = this.cv.getContext('2d');
    const loop = () => { try { this.draw(); } catch (e) { console.error(e); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  buildEdges() {
    const T = S.tiles, rof = S.an.regionOf;
    this.edges = [];
    for (const t of T) for (const n of t.nb) {
      if (n <= t.i || rof[n] === rof[t.i]) continue;
      if (t.land !== T[n].land) continue; // la costa è già disegnata
      this.edges.push(sharedEdge(t, T[n]));
    }
    this.edgesFor = S.an.regions;
  },
  draw() {
    const cv = this.cv, R = Render;
    if (!S || !S.an || !R.view) return;
    const tab = UI.tab;
    const wrap = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(wrap.width * dpr) || cv.height !== Math.round(wrap.height * dpr)) {
      cv.width = Math.round(wrap.width * dpr); cv.height = Math.round(wrap.height * dpr);
      cv.style.width = wrap.width + 'px'; cv.style.height = wrap.height + 'px';
    }
    if (this.edgesFor !== S.an.regions) this.buildEdges();
    const ctx = this.ctx, v = R.view, lw = 1 / v.s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(v.s * dpr, 0, 0, v.s * dpr, v.tx * dpr, v.ty * dpr);
    const showAir = tab === 'aviazione' || (ANUI.pick && ANUI.pick.layer === 'air');
    const showSea = tab === 'marina' || (ANUI.pick && ANUI.pick.layer === 'sea');
    const T = S.tiles;

    // tinta di superiorità / supremazia
    if (showAir || showSea) {
      for (const r of S.an.regions) {
        if (showSea && !showAir && !r.sea) continue;
        const has = showAir ? S.an.airPow[r.id] : S.an.navPow[r.id];
        if (!has) continue;
        const sh = showAir ? anAirShare(r.id, S.player) : anNavalShare(r.id, S.player);
        if (Math.abs(sh - 0.5) < 0.02) continue;
        ctx.fillStyle = sh > 0.5 ? `rgba(80,220,110,${(sh - 0.5) * 0.7})` : `rgba(240,70,50,${(0.5 - sh) * 0.7})`;
        ctx.beginPath();
        for (const u of r.tiles) { const t = T[u]; ctx.moveTo(t.cx + HEX, t.cy); for (let k = 1; k < 6; k++) ctx.lineTo(t.cx + HEX_CORNERS[k][0] * HEX, t.cy + HEX_CORNERS[k][1] * HEX); }
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,240,200,0.45)'; ctx.lineWidth = 1.2 * lw; ctx.setLineDash([4 * lw, 3 * lw]);
      ctx.beginPath();
      for (const [p, q] of this.edges) { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    // regione sotto il cursore durante la selezione
    const P = ANUI.pick;
    if (P && ANUI.hoverTile >= 0) {
      const key = P.tiles ? ANUI.hoverTile : regionOfTile(ANUI.hoverTile);
      const ok = P.valid(key);
      ctx.fillStyle = ok ? 'rgba(255,225,77,0.35)' : 'rgba(255,60,40,0.25)';
      ctx.beginPath();
      const list = P.tiles ? [ANUI.hoverTile] : regionById(key).tiles;
      for (const u of list) { const t = T[u]; hexPath(ctx, t.cx, t.cy, HEX + 0.4); ctx.fill(); }
      if (P.from != null) {
        const a = T[P.from], b = P.tiles ? T[ANUI.hoverTile] : T[regionById(key).center];
        ctx.strokeStyle = ok ? '#ffe14d' : '#ff5040'; ctx.lineWidth = 1.5 * lw; ctx.setLineDash([3 * lw, 2 * lw]);
        ctx.beginPath(); ctx.moveTo(a.cx, a.cy); ctx.lineTo(b.cx, b.cy); ctx.stroke(); ctx.setLineDash([]);
        if (P.range) { ctx.beginPath(); ctx.arc(a.cx, a.cy, P.range / KM_PER_HEX * HEX * SQ3, 0, 7); ctx.strokeStyle = 'rgba(255,225,77,0.5)'; ctx.stroke(); }
      }
    }
    this.hint.classList.toggle('hidden', !P);
    if (P) this.hint.textContent = P.hint + '  ·  Esc o clic destro per annullare';

    // nomi delle regioni
    if (showAir || showSea) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.max(5, 9 * lw * 1.2)}px Inter, Arial, sans-serif`;
      for (const r of S.an.regions) {
        if (showSea && !showAir && !r.sea) continue;
        if (showAir && !showSea && r.sea && !S.an.airPow[r.id]) continue;
        ctx.lineWidth = 3 * lw; ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.strokeText(r.name, r.cx, r.cy - HEX * 1.2);
        ctx.fillStyle = r.sea ? 'rgba(170,215,255,0.9)' : 'rgba(255,240,210,0.85)';
        ctx.fillText(r.name, r.cx, r.cy - HEX * 1.2);
      }
    }
    // stormi del giocatore: basi e linee di missione
    if (showAir) {
      const byBase = new Map();
      for (const w of S.an.wings) if (w.owner === S.player) byBase.set(w.base, (byBase.get(w.base) || 0) + 1);
      ctx.strokeStyle = 'rgba(150,200,255,0.7)'; ctx.lineWidth = 1.2 * lw; ctx.setLineDash([2 * lw, 2 * lw]);
      ctx.beginPath();
      for (const w of S.an.wings) {
        if (w.owner !== S.player || w.region == null) continue;
        const a = T[w.base], b = T[regionById(w.region).center];
        ctx.moveTo(a.cx, a.cy); ctx.lineTo(b.cx, b.cy);
      }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.font = `700 6px Inter, Arial, sans-serif`;
      for (const [b, n] of byBase) {
        const t = T[b];
        ctx.fillStyle = 'rgba(20,40,70,0.9)'; ctx.fillRect(t.cx + 3, t.cy - 10, 14, 8);
        ctx.strokeStyle = '#9cc8ff'; ctx.lineWidth = 0.7; ctx.strokeRect(t.cx + 3, t.cy - 10, 14, 8);
        ctx.fillStyle = '#fff'; ctx.fillText('✈' + n, t.cx + 10, t.cy - 5.8);
      }
    }
    // flotte (sempre visibili: le proprie e quelle avvistate)
    const slots = new Map();
    ctx.font = `700 5.5px Inter, Arial, sans-serif`;
    for (const f of S.an.fleets) {
      if (!fleetVisible(f)) continue;
      let x, y;
      if (f.inPort) { if (!allied(f.owner, S.player)) continue; const t = T[f.home]; x = t.cx - 9; y = t.cy + 3; }
      else {
        const r = regionById(f.region);
        x = r.cx; y = r.cy;
        if (f.path.length) {
          const n = regionById(f.path[0]);
          const hop = Math.hypot(n.cx - r.cx, n.cy - r.cy) / (HEX * SQ3) * KM_PER_HEX;
          const k = Math.min(1, f.moveKm / Math.max(1, hop));
          x += (n.cx - r.cx) * k; y += (n.cy - r.cy) * k;
        }
      }
      const key = Math.round(x) + ':' + Math.round(y), k = slots.get(key) || 0;
      slots.set(key, k + 1);
      y += k * 8;
      const c = C(f.owner), mine = f.owner === S.player, foe = atWar(f.owner, S.player);
      ctx.fillStyle = shade(c.color, 0.75);
      ctx.beginPath(); ctx.moveTo(x - 9, y - 3); ctx.lineTo(x + 7, y - 3); ctx.lineTo(x + 10, y); ctx.lineTo(x + 7, y + 3); ctx.lineTo(x - 9, y + 3); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = foe ? '#ff5040' : mine ? '#e8f0ff' : '#111'; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText((f.ships.every(isSub) ? '▾' : '⚓') + f.ships.length, x, y + 0.3);
      if (f.battle != null) { ctx.fillStyle = '#ff4030'; ctx.beginPath(); ctx.arc(x + 9, y - 3, 1.8, 0, 7); ctx.fill(); }
    }
    // battaglie navali
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    for (const b of S.an.battles) {
      const r = regionById(b.region);
      ctx.beginPath(); ctx.arc(r.cx, r.cy, HEX * (1.6 + 0.4 * pulse), 0, 7);
      ctx.strokeStyle = `rgba(255,120,40,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 2 * lw; ctx.stroke();
    }
  },
};

// avvio: UI.init viene chiamata da startGame quando la mappa è pronta
(function hookStart() {
  const _init = UI.init;
  UI.init = function (...a) {
    const r = _init.apply(this, a);
    anInitMapInput();
    ANMap.init();
    return r;
  };
})();
