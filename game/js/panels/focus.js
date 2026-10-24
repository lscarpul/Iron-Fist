'use strict';

// Albero dei focus a schermo intero (stile HoI4) + riepilogo nel pannello laterale.
// Funziona sia con la shell a pannelli (UI.registerPanel) sia con la vecchia UI a schede.

const FocusUI = {
  GX: 150, GY: 104, NW: 132, NH: 70, PAD: 30,
  open: false, el: null, sig: '', hover: null, timer: 0,

  init() {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'css/focus.css';
    document.head.appendChild(css);
    const el = document.createElement('div');
    el.id = 'ftree'; el.className = 'hidden';
    el.innerHTML = `<header class="ft-head"></header><div class="ft-body"><div class="ft-canvas"></div></div><div class="ft-tip hidden"></div>`;
    document.body.appendChild(el);
    this.el = el;
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-fact]');
      if (b) { this.act(b.dataset.fact, b.dataset.arg); return; }
      const n = e.target.closest('.fnode');
      if (n) this.clickNode(n.dataset.id);
    });
    el.addEventListener('mouseover', e => {
      const n = e.target.closest('.fnode');
      if (n && n.dataset.id !== this.hover) { this.hover = n.dataset.id; this.showTip(n); }
    });
    el.addEventListener('mouseout', e => {
      const n = e.target.closest('.fnode');
      if (n && !n.contains(e.relatedTarget)) { this.hover = null; el.querySelector('.ft-tip').classList.add('hidden'); }
    });
    // trascina per scorrere l'albero
    const body = el.querySelector('.ft-body');
    let drag = null;
    body.addEventListener('mousedown', e => { if (e.button === 0 && !e.target.closest('.fnode')) drag = { x: e.clientX, y: e.clientY, sl: body.scrollLeft, st: body.scrollTop }; });
    window.addEventListener('mousemove', e => { if (drag) { body.scrollLeft = drag.sl - (e.clientX - drag.x); body.scrollTop = drag.st - (e.clientY - drag.y); } });
    window.addEventListener('mouseup', () => { drag = null; });
    window.addEventListener('keydown', e => {
      if (!S || (UI.modalOpen && !this.open) || e.target.matches?.('input, textarea')) return;
      if (e.code === 'Escape' && this.open) { e.stopImmediatePropagation(); this.close(); }
      else if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey) this.open ? this.close() : this.show();
    }, true);
  },

  show() {
    if (!S) return;
    this.open = true;
    this.el.classList.remove('hidden');
    this.build();
    // centra sul focus in corso o sul primo disponibile
    const p = C(S.player), t = focusTree(p);
    const f = (p.focus && t.byId[p.focus]) || t.focuses.find(f => focusState(p, f) === 'available') || t.focuses[0];
    const body = this.el.querySelector('.ft-body');
    body.scrollLeft = f.x * this.GX + this.PAD - body.clientWidth / 2 + this.NW / 2;
    body.scrollTop = Math.max(0, f.y * this.GY - 120);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.refresh(), 250);
  },
  close() {
    this.open = false;
    this.el.classList.add('hidden');
    clearInterval(this.timer);
  },

  act(name, arg) {
    const p = C(S.player);
    if (name === 'close') this.close();
    else if (name === 'cancel') UI.ask('Annullare il focus?', `I progressi su “${focusById(p, p.focus).name}” andranno persi.`,
      [{ label: 'Annulla il focus', fn: () => { cancelFocus(p); this.refresh(true); } }, { label: 'Continua' }]);
    else if (name === 'openTree') this.show();
    else if (name === 'start') this.clickNode(arg);
    else return false;
    UI.dirty = true;
    return true;
  },

  clickNode(id) {
    const p = C(S.player), f = focusById(p, id);
    if (!f) return;
    if (focusState(p, f) !== 'available') return;
    if (p.focus) {
      UI.ask('Cambiare focus?', `Stai già lavorando a “${focusById(p, p.focus).name}”. Abbandonarlo per “${f.name}”? I progressi andranno persi.`,
        [{ label: 'Cambia focus', fn: () => { cancelFocus(p); startFocus(p, id); this.refresh(true); } }, { label: 'Annulla' }]);
      return;
    }
    if (startFocus(p, id)) log(`Nuovo focus nazionale: ${f.name}.`);
    this.refresh(true);
    UI.dirty = true;
  },

  // ---------- disegno ----------
  build() {
    const p = C(S.player), t = focusTree(p);
    const { GX, GY, NW, NH, PAD } = this;
    const maxX = Math.max(...t.focuses.map(f => f.x)), maxY = Math.max(...t.focuses.map(f => f.y));
    const W = maxX * GX + NW + PAD * 2, H = maxY * GY + NH + PAD * 2;
    const nx = f => f.x * GX + PAD, ny = f => f.y * GY + PAD;
    let lines = '';
    for (const f of t.focuses) {
      for (const g of f.pre) for (const pid of g) {
        const q = t.byId[pid];
        const x1 = nx(q) + NW / 2, y1 = ny(q) + NH, x2 = nx(f) + NW / 2, y2 = ny(f);
        const my = y2 - 16;
        lines += `<path class="fl ${g.length > 1 ? 'or' : ''}" data-from="${pid}" data-to="${f.id}" d="M${x1},${y1} V${my} H${x2} V${y2}"/>`;
      }
      for (const e of f.ex) {
        const q = t.byId[e];
        if (q.y !== f.y || q.x <= f.x) continue; // una sola linea per coppia, solo sulla stessa riga
        const y = ny(f) + NH / 2, x1 = nx(f) + NW, x2 = nx(q);
        if (x2 - x1 > GX * 2.2) continue;
        lines += `<path class="fx" d="M${x1 + 2},${y} H${x2 - 2}"/><text class="fxt" x="${(x1 + x2) / 2}" y="${y + 5}">⛔</text>`;
      }
    }
    let nodes = '';
    for (const f of t.focuses) {
      nodes += `<div class="fnode" data-id="${f.id}" style="left:${nx(f)}px;top:${ny(f)}px">
        <span class="fic">${f.ic}</span><span class="fname">${esc(f.name)}</span><span class="fdays">${f.days} g</span><i class="fprog"></i></div>`;
    }
    this.el.querySelector('.ft-canvas').style.cssText = `width:${W}px;height:${H}px`;
    this.el.querySelector('.ft-canvas').innerHTML = `<svg width="${W}" height="${H}">${lines}</svg>${nodes}`;
    this.sig = '';
    this.refresh(true);
  },

  stateSig(p) {
    const t = focusTree(p);
    return t.focuses.map(f => focusState(p, f)[0]).join('') + '|' + p.focus + '|' + p.ideology + '|' + Math.floor(p.pp);
  },

  refresh(force) {
    if (!this.open || !S) return;
    const p = C(S.player), t = focusTree(p);
    const sig = this.stateSig(p);
    if (force || sig !== this.sig) {
      this.sig = sig;
      for (const n of this.el.querySelectorAll('.fnode')) n.className = 'fnode ' + focusState(p, t.byId[n.dataset.id]);
      for (const l of this.el.querySelectorAll('.fl')) l.classList.toggle('lit', p.done.has(l.dataset.from));
      if (this.hover) { const n = this.el.querySelector(`.fnode[data-id="${this.hover}"]`); if (n) this.showTip(n); }
    }
    this.el.querySelector('.ft-head').innerHTML = this.headHtml(p, t);
    if (p.focus) {
      const n = this.el.querySelector(`.fnode[data-id="${p.focus}"] .fprog`);
      if (n) n.style.width = (100 * (1 - p.focusDays / (p.focusTotal || 70))).toFixed(1) + '%';
    }
  },

  headHtml(p, t) {
    const ideo = IDEOLOGIES[p.ideology] || IDEOLOGIES.neutral;
    const f = p.focus && t.byId[p.focus];
    const cur = f
      ? `<div class="ft-cur"><span>${f.ic} <b>${esc(f.name)}</b> · ${p.focusDays} giorni</span>${bar(1 - p.focusDays / (p.focusTotal || f.days))}</div>
         <button data-fact="cancel">Annulla focus</button>`
      : `<div class="ft-cur none">Nessun focus in corso: scegline uno dall'albero</div>`;
    return `<div class="ft-title">${flag(p)}<div><b>${esc(t.title)}</b><small><span class="ideo" style="background:${ideo.color}">${ideo.ic} ${ideo.short}</span> ${esc(p.leader || '')} · ${dateLabel(S.day)}</small></div></div>
      ${cur}
      <div class="ft-legend"><span class="lg available">Disponibile</span><span class="lg current">In corso</span><span class="lg done">Completato</span><span class="lg blocked">Condizioni mancanti</span><span class="lg excluded">Escluso</span></div>
      <button class="ft-x" data-fact="close" title="Chiudi (Esc)">✕</button>`;
  },

  focusInfo(p, f) {
    const t = focusTree(p), st = focusState(p, f);
    const stTxt = { done: 'Completato', current: 'In corso', available: 'Disponibile', locked: 'Prerequisiti mancanti', blocked: 'Condizioni non soddisfatte', excluded: 'Escluso da una scelta precedente' }[st];
    let h = `<div class="tt-h">${f.ic} <b>${esc(f.name)}</b><small>${f.days} giorni · <span class="st-${st}">${stTxt}</span></small></div>`;
    if (f.d) h += `<p class="tt-d">${esc(f.d)}</p>`;
    if (f.pre.length) {
      h += `<h5>Richiede</h5><ul>`;
      for (const g of f.pre) {
        const ok = g.some(id => p.done.has(id));
        h += `<li class="${ok ? 'ok' : 'no'}">${g.map(id => esc(t.byId[id].name)).join(' <i>oppure</i> ')}</li>`;
      }
      h += `</ul>`;
    }
    const conds = condText(f.cond);
    if (conds.length) h += `<h5>Condizioni</h5><ul>${conds.map(c => `<li class="${condMet(p, f.cond) ? 'ok' : 'cond'}">${esc(c)}</li>`).join('')}</ul>`;
    h += `<h5>Effetti</h5><ul class="eff">${effectText(f.eff).map(x => `<li>${esc(x)}</li>`).join('') || '<li>Nessun effetto diretto</li>'}</ul>`;
    if (f.ex.length) h += `<h5>Esclusivo con</h5><p class="tt-ex">${f.ex.map(id => esc(t.byId[id].name)).join(', ')}</p>`;
    if (st === 'available') h += `<p class="tt-hint">${p.focus ? 'Clic per sostituire il focus in corso' : 'Clic per avviare'}</p>`;
    return h;
  },

  showTip(n) {
    const p = C(S.player), f = focusById(p, n.dataset.id);
    const tip = this.el.querySelector('.ft-tip');
    tip.innerHTML = this.focusInfo(p, f);
    tip.classList.remove('hidden');
    const r = n.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.right + 10;
    if (x + tw > window.innerWidth - 8) x = r.left - tw - 10;
    const y = Math.max(8, Math.min(r.top, window.innerHeight - th - 8));
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = y + 'px';
  },

  // ---------- pannello laterale ----------
  summary(p) {
    const t = focusTree(p);
    const ideo = IDEOLOGIES[p.ideology] || IDEOLOGIES.neutral;
    let h = `<h3>Governo</h3><div class="card"><div class="row"><b>${esc(p.leader || p.name)}</b><span class="ideo" style="background:${ideo.color}">${ideo.ic} ${ideo.short}</span></div>
      <p>${esc(t.title)}${p.faction && S.factions[p.faction] ? ` · ${esc(S.factions[p.faction].name)}` : ''}</p></div>`;
    h += `<h3>Focus nazionale</h3>`;
    const f = p.focus && t.byId[p.focus];
    if (f) h += `<div class="card cur"><div class="row"><b>${f.ic} ${esc(f.name)}</b><small>${p.focusDays} g</small></div>${bar(1 - p.focusDays / (p.focusTotal || f.days))}
      <p>${effectText(f.eff).map(esc).join(' · ')}</p></div>`;
    else h += `<p class="hint warn">Nessun focus in corso: stai sprecando tempo!</p>`;
    h += `<button class="primary" data-act="openTree" data-fact="openTree">🌳 Apri l'albero dei focus (F)</button>`;
    const avail = t.focuses.filter(x => focusState(p, x) === 'available');
    if (!p.focus && avail.length) {
      h += `<h4>Disponibili ora</h4>`;
      for (const x of avail.slice(0, 6)) h += `<div class="card"><div class="row"><b>${x.ic} ${esc(x.name)}</b><small>${x.days} g</small></div>
        <p>${effectText(x.eff).map(esc).join(' · ')}</p><button data-act="focusStart" data-arg="${x.id}">Avvia</button></div>`;
    }
    const mods = Object.entries(p.mods || {}).filter(([, v]) => v);
    if (mods.length) h += `<h4>Modificatori nazionali</h4><p class="done">${mods.map(([k, v]) => `${pct(v)} ${esc(MOD_LABELS[k] || k)}`).join('<br>')}</p>`;
    const rb = (p.researchBonuses || []).filter(b => (b.uses ?? 1) > 0);
    if (rb.length) h += `<h4>Bonus di ricerca</h4><p class="done">${rb.map(b => `${esc(RESEARCH_CATS[b.cat] || b.cat)} ${Math.round(b.bonus * 100)}%${b.aot ? ' ⏩' : ''}`).join('<br>')}</p>`;
    h += `<p class="hint">Completati ${p.done.size} di ${t.focuses.length} focus.</p>`;
    return h;
  },
};

FocusUI.init();

if (typeof UI.registerPanel === 'function') {
  UI.registerPanel({
    id: 'focus', title: 'Focus nazionale', icon: '🌳', group: 'state', order: 15,
    render: p => FocusUI.summary(p),
    actions: {
      openTree: () => FocusUI.show(),
      focusStart: arg => FocusUI.clickNode(arg),
    },
    badge: p => (p.focus ? null : '!'),
  });
} else {
  // vecchia interfaccia a schede: il riepilogo sostituisce la scheda Politica
  UI.panel_politica = function () { return FocusUI.summary(C(S.player)); };
  const baseAct = UI.act;
  UI.act = function (name, arg) {
    if (name === 'openTree') { FocusUI.show(); return; }
    if (name === 'focusStart') { FocusUI.clickNode(arg); this.dirty = true; this.lastPanel = ''; return; }
    return baseAct.call(this, name, arg);
  };
}
