'use strict';
// Barra delle armate in basso (come in HOI4): ritratti dei generali raggruppati per feldmaresciallo,
// assegnazione con «+» o trascinando le divisioni, piani di battaglia (linea del fronte, linea d'offensiva,
// Esegui piano), Attacco forzato e Ultima resistenza. Disegna anche i piani sulla mappa.
// Aggiunge la sezione Ammiragli alla scheda Marina.

const ARMY_COLORS = ['#e8c547', '#5fb4ff', '#ff8a4c', '#b48cff', '#5fe0a0', '#ff6fa8', '#c8d65a', '#4fd6d6'];
const armyColor = a => ARMY_COLORS[(a.id - 1) % ARMY_COLORS.length];
const initials = name => name.replace(/^(Generale|Ammiraglio)\s+/, '').split(/\s+/).filter(w => /^[A-ZÀ-Ý]/.test(w)).slice(-2).map(w => w[0]).join('');

const ArmyBar = {
  last: '', draft: null, // draft: { kind: 'front'|'off', aid, tiles: [] } mentre si disegna

  el() {
    let el = document.getElementById('armybar');
    if (!el) {
      el = document.createElement('section');
      el.id = 'armybar';
      $('game').appendChild(el);
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-ab]');
        if (!b || b.disabled) return;
        e.stopPropagation();
        this.act(b.dataset.ab, b.dataset.arg, e);
      });
      el.addEventListener('dblclick', e => {
        const b = e.target.closest('.ab-card[data-arg]');
        if (!b) return;
        const p = C(S.player), a = armyById(p, +b.dataset.arg), ds = a ? armyDivs(p, a) : [];
        if (ds.length) Render.centerOn(groupCenterTile(ds));
      });
      el.addEventListener('dragover', e => { const c = e.target.closest('.ab-card'); if (c) { e.preventDefault(); c.classList.add('drop'); } });
      el.addEventListener('dragleave', e => { const c = e.target.closest('.ab-card'); if (c) c.classList.remove('drop'); });
      el.addEventListener('drop', e => {
        const c = e.target.closest('.ab-card');
        if (!c) return;
        e.preventDefault();
        c.classList.remove('drop');
        const ids = (e.dataTransfer.getData('text/x-divs') || '').split(',').filter(Boolean).map(Number);
        if (ids.length) UI.sel = new Set(ids);
        this.act(c.dataset.arg ? 'assign' : 'newArmy', c.dataset.arg);
      });
      const hint = document.createElement('div');
      hint.id = 'maptool-hint'; hint.className = 'hidden';
      $('game').appendChild(hint);
    }
    return el;
  },

  card(p, a) {
    const divs = armyDivs(p, a), g = a.general != null ? genById(p, a.general) : null;
    const n = divs.length, pl = a.plan, sel = n && divs.every(d => UI.sel.has(d.id));
    const pmax = (p.planMax ?? 0.3) || 0.3;
    const plan = n ? divs.reduce((s, d) => s + (d.plan || 0), 0) / n / pmax : 0;
    const org = n ? divs.reduce((s, d) => s + Math.min(1, d.org / divMaxOrg(d)), 0) / n : 0;
    const ab = a.ability && a.ability.until > S.day ? a.ability : null;
    const tool = this.draft && this.draft.aid === a.id ? this.draft.kind : null;
    const tip = `${a.name}${g ? ` · ${g.name} (Att ${g.atk} · Dif ${g.def} · Pian ${g.plan} · Log ${g.log})` : ' · nessun generale'}`;
    return `<div class="ab-card ${sel ? 'sel' : ''} ${pl && pl.exec ? 'exec' : ''}" data-ab="selArmy" data-arg="${a.id}" title="${esc(tip)}" style="--ac:${armyColor(a)}">
      <div class="ab-tools">
        <button data-ab="front" data-arg="${a.id}" class="${tool === 'front' ? 'on' : ''} ${pl && pl.zone.length ? 'set' : ''}" title="Disegna linea del fronte">⚑</button>
        <button data-ab="off" data-arg="${a.id}" class="${tool === 'off' ? 'on' : ''} ${pl && pl.off.length ? 'set' : ''}" title="Disegna linea d'offensiva">➶</button>
        <button data-ab="exec" data-arg="${a.id}" class="${pl && pl.exec ? 'on' : ''}" ${pl ? '' : 'disabled'} title="${pl && pl.exec ? 'Ferma il piano' : 'Esegui piano'}">${pl && pl.exec ? '❚❚' : '▶'}</button>
        <button data-ab="clear" data-arg="${a.id}" ${pl ? '' : 'disabled'} title="Cancella il piano">✕</button>
      </div>
      <div class="ab-por">${g ? esc(initials(g.name)) : '?'}${g && g.level ? `<i>${g.level}</i>` : ''}</div>
      <div class="ab-name">${esc(a.name)}</div>
      <div class="ab-n ${n > ARMY_MAX_DIVS ? 'bad' : ''}">${n}/${ARMY_MAX_DIVS}</div>
      <div class="ab-bars"><span class="ab-org" style="width:${Math.round(org * 100)}%"></span></div>
      <div class="ab-bars plan" title="Bonus di pianificazione"><span style="width:${Math.round(Math.min(1, plan) * 100)}%"></span></div>
      <div class="ab-abil">
        <button data-ab="force" data-arg="${a.id}" class="${ab && ab.kind === 'force' ? 'on' : ''}" title="${esc(CP_ABILITY.force.name + ` (${CP_ABILITY.force.cost} potere di comando): ` + CP_ABILITY.force.desc)}" ${ab && ab.kind === 'force' || (!ab && p.cp >= CP_ABILITY.force.cost) ? '' : 'disabled'}>${CP_ABILITY.force.icon}</button>
        <button data-ab="last" data-arg="${a.id}" class="${ab && ab.kind === 'last' ? 'on' : ''}" title="${esc(CP_ABILITY.last.name + ` (${CP_ABILITY.last.cost} potere di comando): ` + CP_ABILITY.last.desc)}" ${ab && ab.kind === 'last' || (!ab && p.cp >= CP_ABILITY.last.cost) ? '' : 'disabled'}>${CP_ABILITY.last.icon}</button>
        <button data-ab="assign" data-arg="${a.id}" title="Assegna le divisioni selezionate" ${UI.sel.size ? '' : 'disabled'}>+</button>
      </div>
    </div>`;
  },

  render() {
    if (!S || S.over) return;
    const p = C(S.player), el = this.el();
    const groups = new Map();
    for (const a of p.armies) {
      const k = a.fm != null && genById(p, a.fm) ? a.fm : 0;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(a);
    }
    let h = `<div class="ab-cp" title="Potere di comando: serve per Attacco forzato, Ultima resistenza, nuovi generali e ammiragli">${icon('army', 14)}<b>${Math.floor(p.cp)}</b>/${cpMax(p)}</div>`;
    for (const [fmId, list] of groups) {
      const fm = fmId ? genById(p, fmId) : null;
      const anyPlan = list.some(a => a.plan), allExec = anyPlan && list.filter(a => a.plan).every(a => a.plan.exec);
      h += `<div class="ab-grp">${fm ? `<div class="ab-fm ${list.length > FM_MAX_ARMIES ? 'bad' : ''}" title="${esc(`Feldmaresciallo ${fm.name}: 50% dei suoi bonus a tutte le armate (max ${FM_MAX_ARMIES} armate)`)}">★ ${esc(fm.name)} <small>${list.length}/${FM_MAX_ARMIES}</small>
        <button data-ab="execFM" data-arg="${fmId}" ${anyPlan ? '' : 'disabled'} title="${allExec ? 'Ferma i piani del gruppo d\'armate' : 'Esegui i piani del gruppo d\'armate'}">${allExec ? '❚❚' : '▶'}</button></div>` : `<div class="ab-fm muted">Senza feldmaresciallo</div>`}
        <div class="ab-cards">${list.map(a => this.card(p, a)).join('')}</div></div>`;
    }
    h += `<div class="ab-card ab-new" data-ab="newArmy" title="Nuova armata con le divisioni selezionate (trascinale qui)"><div class="ab-por">+</div><div class="ab-name">Nuova armata</div></div>`;
    $('game').classList.add('has-armybar');
    const hint = document.getElementById('maptool-hint');
    if (hint) {
      const t = UI.mapTool && UI.mapTool.hint;
      hint.classList.toggle('hidden', !t);
      if (t) hint.innerHTML = `${esc(t)} <small>(Esc o clic destro per annullare)</small>`;
    }
    if (h === this.last) return;
    this.last = h;
    el.innerHTML = h;
    $('game').style.setProperty('--armybar-h', el.offsetHeight + 'px'); // la barra delle divisioni selezionate sta sopra
  },

  act(name, arg, e) {
    const p = C(S.player), aid = +arg;
    const say = r => { if (r) log(r.msg, r.ok ? 'good' : 'warn'); };
    switch (name) {
      case 'selArmy': {
        const ds = armyDivs(p, armyById(p, aid)).map(d => d.id);
        if (e && (e.shiftKey || e.ctrlKey)) for (const id of ds) UI.sel.add(id);
        else UI.sel = new Set(ds);
        break;
      }
      case 'assign': {
        const divs = S.divs.filter(d => UI.sel.has(d.id) && d.owner === p.code && !d.dead);
        assignDivsToArmy(p, divs, aid);
        for (const d of divs) d.planTile = null;
        if (divs.length) log(`${divs.length} divisioni assegnate a ${armyById(p, aid).name}.`);
        break;
      }
      case 'newArmy': {
        const gen = p.generals.find(g => g.rank === 'gen' && !p.armies.some(a => a.general === g.id));
        const a = createArmy(p, null, gen ? gen.id : null);
        const fm = p.armies.find(x => x !== a && x.fm != null)?.fm;
        if (fm != null && fmArmyCount(p, fm) < FM_MAX_ARMIES) a.fm = fm;
        const divs = S.divs.filter(d => UI.sel.has(d.id) && d.owner === p.code && !d.dead);
        assignDivsToArmy(p, divs, a.id);
        log(`Creata ${a.name}${gen ? ` (${gen.name})` : ''}${divs.length ? ` con ${divs.length} divisioni` : ''}.`);
        break;
      }
      case 'front': this.startTool('front', aid); break;
      case 'off': this.startTool('off', aid); break;
      case 'exec': { const a = armyById(p, aid); say(setPlanExec(p, aid, !(a.plan && a.plan.exec))); break; }
      case 'execFM': {
        const list = p.armies.filter(a => a.fm === aid && a.plan), on = !list.every(a => a.plan.exec);
        for (const a of list) a.plan.exec = on;
        log(on ? 'Piani del gruppo d\'armate in esecuzione.' : 'Piani del gruppo d\'armate fermati.');
        break;
      }
      case 'clear': clearPlan(p, aid); log(`${armyById(p, aid).name}: piano cancellato.`); break;
      case 'force': case 'last': say(useAbility(p, aid, name)); break;
    }
    UI.dirty = true;
    this.last = '';
  },

  // ----- disegno dei piani sulla mappa -----
  startTool(kind, aid) {
    if (this.draft && this.draft.kind === kind && this.draft.aid === aid) { UI.setMapTool(null); return; }
    const p = C(S.player), a = armyById(p, aid);
    UI.sel = new Set(armyDivs(p, a).map(d => d.id));
    const bar = this;
    bar.draft = { kind, aid, tiles: [] };
    const add = ti => { if (ti >= 0 && S.tiles[ti].land && bar.draft && bar.draft.tiles[bar.draft.tiles.length - 1] !== ti) bar.draft.tiles.push(ti); };
    UI.setMapTool({
      hint: kind === 'front'
        ? `${a.name}: trascina lungo il confine per la linea del fronte, o clicca un paese nemico per tutto il confine`
        : `${a.name}: trascina una freccia dal fronte fin dentro il territorio nemico (linea d'offensiva)`,
      down: add, move: add,
      up(ti) {
        add(ti);
        const t = bar.draft.tiles;
        let r;
        if (kind === 'front') {
          const one = t.length === 1 ? S.tiles[t[0]] : null;
          r = one && atWar(one.ctrl, p.code) ? setFrontVs(p, aid, one.ctrl) : setFrontline(p, aid, t);
        } else r = setOffensive(p, aid, samplePath(t));
        log(r.msg, r.ok ? 'good' : 'warn');
        UI.setMapTool(null);
      },
      cancel() { bar.draft = null; },
    });
  },
};

// punti della freccia: il primo, l'ultimo e uno ogni ~150 km
function samplePath(tiles) {
  if (tiles.length <= 2) return tiles.slice();
  const out = [tiles[0]];
  for (const ti of tiles.slice(1, -1)) if (landDistKm(out[out.length - 1], ti) >= 150) out.push(ti);
  out.push(tiles[tiles.length - 1]);
  return out;
}

// ----- disegno sulla mappa: linee del fronte sui confini veri, frecce d'offensiva -----
const PlanRender = {
  arcIdx: null,
  arcsOf(a, b) {
    if (!this.arcIdx) {
      this.arcIdx = new Map();
      const sides = MAP.arcSides;
      for (let k = 0; k < MAP.arcs.length; k++) {
        const x = sides[2 * k], y = sides[2 * k + 1];
        if (x < 0 || y < 0) continue;
        const key = edgeKey(x, y);
        if (!this.arcIdx.has(key)) this.arcIdx.set(key, []);
        this.arcIdx.get(key).push(k);
      }
    }
    return this.arcIdx.get(edgeKey(a, b)) || [];
  },
  strokeArc(ctx, k) {
    const A = MAP.arcs[k];
    ctx.moveTo(A[0], A[1]);
    for (let j = 2; j < A.length; j += 2) ctx.lineTo(A[j], A[j + 1]);
  },
  // polilinea per i centri delle province, srotolata sulla mappa che si richiude
  centers(tiles) {
    const W = Render.ww, pts = [];
    let px = null;
    for (const ti of tiles) {
      let x = S.tiles[ti].cx;
      const y = S.tiles[ti].cy;
      if (px != null && MAP_DATA.wrapX) { while (x - px > W / 2) x -= W; while (px - x > W / 2) x += W; }
      pts.push([x, y]); px = x;
    }
    return pts;
  },
  arrow(ctx, pts, col, lw, alpha) {
    if (pts.length < 2) return;
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, c] of [[9, 'rgba(0,0,0,0.55)'], [5.5, col]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w * lw;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      const e = pts[pts.length - 1];
      ctx.lineTo(e[0], e[1]); ctx.stroke();
    }
    const e = pts[pts.length - 1], b = pts[pts.length - 2];
    const ang = Math.atan2(e[1] - b[1], e[0] - b[0]), s = 16 * lw;
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.5 * lw;
    ctx.beginPath();
    ctx.moveTo(e[0] + Math.cos(ang) * s, e[1] + Math.sin(ang) * s);
    ctx.lineTo(e[0] + Math.cos(ang + 2.4) * s, e[1] + Math.sin(ang + 2.4) * s);
    ctx.lineTo(e[0] + Math.cos(ang - 2.4) * s, e[1] + Math.sin(ang - 2.4) * s);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
  },
  draw(ctx, view) {
    if (!S || !S.player || typeof MAP === 'undefined' || !MAP.arcs) return;
    const p = C(S.player), lw = view.lw;
    for (const a of p.armies) {
      const pl = a.plan;
      if (!pl) continue;
      const ds = armyDivs(p, a), on = ds.length && ds.some(d => UI.sel.has(d.id));
      const col = armyColor(a), alpha = on ? 1 : 0.55;
      // linea del fronte: i confini tra le province del fronte e quelle nemiche
      ctx.globalAlpha = alpha;
      ctx.lineCap = 'round';
      for (const [w, c] of [[6.5, 'rgba(0,0,0,0.6)'], [3.5, col]]) {
        ctx.strokeStyle = c; ctx.lineWidth = w * lw;
        ctx.beginPath();
        for (const f of pl.front) for (const n of S.tiles[f].nb) if (hostileTile(n, p.code)) for (const k of this.arcsOf(f, n)) this.strokeArc(ctx, k);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (pl.line && pl.line.length > 1 && pl.off.length) this.arrow(ctx, this.centers(pl.line), pl.exec ? '#ff5a3c' : col, lw, alpha);
      // a zoom alto: numero di divisioni assegnate a ogni provincia del fronte
      if (on && view.s * MAP_DATA.kmPerUnit > 2.5) {
        const cnt = new Map();
        for (const d of ds) if (d.planTile != null) cnt.set(d.planTile, (cnt.get(d.planTile) || 0) + 1);
        ctx.font = `700 ${10 * lw}px Inter, Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const [ti, n] of cnt) {
          const t = S.tiles[ti];
          ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.beginPath(); ctx.arc(t.cx, t.cy - 14 * lw, 6 * lw, 0, 7); ctx.fill();
          ctx.fillStyle = col; ctx.fillText(String(n), t.cx, t.cy - 14 * lw);
        }
      }
    }
    // anteprima mentre si disegna
    const dr = ArmyBar.draft;
    if (dr && dr.tiles.length) {
      if (dr.kind === 'front') {
        ctx.fillStyle = 'rgba(255,225,77,0.28)';
        for (const ti of dr.tiles) if (Render.paths && Render.paths[ti]) ctx.fill(Render.paths[ti], 'evenodd');
      } else this.arrow(ctx, this.centers(dr.tiles), '#ffe14d', lw, 0.9);
    }
  },
};

// ----- Ammiragli: sezione della scheda Marina -----
UI.registerSection('marina', {
  id: 'ammiragli', order: 60,
  render(p) {
    if (!p.admirals) return '';
    const fleets = S.an.fleets.filter(f => f.owner === p.code && !f.dead && f.ships.length);
    let h = `<div class="sec"><h3>Ammiragli</h3>
      <p class="sub">Attacco e Coordinamento aumentano i danni inflitti, Difesa e Manovra riducono quelli subiti. Nessun limite rigido di navi, ma oltre la capacità di comando il posizionamento in battaglia peggiora.</p>`;
    for (const f of fleets) {
      const a = fleetAdmiral(f), cap = a ? admCapacity(a) : 0, m = fleetCommand(f);
      h += `<div class="row"><span>${esc(f.name)} · ${f.ships.length} navi</span><span>${a ? `${esc(a.name)} <small class="${f.ships.length > cap ? 'bad' : ''}">${f.ships.length}/${cap}${m.pos < 1 ? ` · posizionamento ${Math.round(m.pos * 100)}%` : ''}</small>` : '<span class="warn">senza ammiraglio</span>'}
        <button data-act="ammiragli:cycle" data-arg="${f.id}">Cambia</button></span></div>`;
    }
    for (const a of p.admirals) {
      const f = fleets.find(x => x.admiral === a.id);
      h += `<div class="card"><div class="row"><b>⚓ ${esc(a.name)}</b><small>liv. ${a.level}${f ? ` · ${esc(f.name)}` : ''}</small></div>
        <p>Attacco ${a.atk} · Difesa ${a.def} · Manovra ${a.man} · Coordinamento ${a.coord} · Capacità ${admCapacity(a)} navi</p>
        ${bar(a.xp / (60 * a.level))}
        <p>${a.traits.length ? a.traits.map(t => `<span title="${esc(ADMIRAL_TRAITS[t].desc)}">◆ ${esc(ADMIRAL_TRAITS[t].name)}</span>`).join(' ') : 'Nessun tratto'}</p></div>`;
    }
    h += `<button data-act="ammiragli:recruit" ${p.cp >= ADMIRAL_COST ? '' : 'disabled'}>Nomina un ammiraglio (${ADMIRAL_COST} potere di comando)</button></div>`;
    return h;
  },
  actions: {
    cycle(arg) {
      const p = C(S.player), f = S.an.fleets.find(x => x.id === +arg);
      if (!f) return;
      const list = p.admirals, i = list.findIndex(a => a.id === f.admiral);
      const next = list[(i + 1) % (list.length + 1)];
      if (next) assignAdmiral(p, f.id, next.id); else f.admiral = null;
      p.admAuto = false; // il giocatore sceglie: niente assegnazioni automatiche
    },
    recruit() { if (recruitAdmiral(C(S.player))) log('Nuovo ammiraglio nominato.', 'good'); },
  },
});

(function hookArmyBar() {
  Render.overlays.push((ctx, view) => PlanRender.draw(ctx, view));
  const update = UI.update;
  UI.update = function () {
    const d = this.dirty;
    update.apply(this, arguments);
    if (d) ArmyBar.render();
  };
})();
