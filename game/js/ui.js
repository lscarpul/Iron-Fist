'use strict';

// Shell dell'interfaccia in stile HOI4: barra superiore, schede, pannello laterale, registro, finestre evento.
// I sistemi di gioco aggiungono la propria UI con UI.registerPanel / registerSection / registerTopStat
// (vedi UI-API.md) in un file loro dentro js/panels/, senza modificare questo file.

const $ = id => document.getElementById(id);
const clamp01 = f => Math.max(0, Math.min(1, f || 0));
const bar = (f, cls = '') => `<div class="bar ${cls}"><i style="width:${(clamp01(f) * 100).toFixed(1)}%"></i></div>`;
const flag = c => `<span class="flag" style="background-color:${c.color}"></span>`;
const flagBig = c => `<span class="flag big" style="background-color:${c.color}"></span>`;
const pct = f => Math.round((f || 0) * 100) + '%';

// Indicatore semicircolare (stabilità, supporto alla guerra...)
function meter(f, label, color = 'var(--brass)') {
  f = clamp01(f);
  const a = Math.PI * (1 - f), x = 56 + 44 * Math.cos(a), y = 52 - 44 * Math.sin(a);
  return `<div class="meter"><svg width="112" height="60" viewBox="0 0 112 60">
    <path d="M12 52 A44 44 0 0 1 100 52" fill="none" stroke="#070807" stroke-width="10" stroke-linecap="round"/>
    ${f > 0.005 ? `<path d="M12 52 A44 44 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>` : ''}
  </svg><b>${pct(f)}</b><small>${label}</small></div>`;
}

const IDEOLOGY = {
  democratic: { name: 'Democrazia', color: '#5b8fd6' },
  fascist: { name: 'Fascismo', color: '#8a6b4a' },
  communist: { name: 'Comunismo', color: '#c4382b' },
  neutral: { name: 'Non allineato', color: '#8a8a7a' },
};
function ideologyOf(c) {
  if (c.ideology && IDEOLOGY[c.ideology]) return c.ideology;
  return { allies: 'democratic', axis: 'fascist', comintern: 'communist' }[c.faction] || 'neutral';
}

const UI = {
  tab: null, selCountry: null, sel: new Set(), dirty: true, modalQueue: [], modalOpen: false,
  lastPanel: '', lastLog: '', lastUnits: '', lastAlerts: '', lastTop: '',
  panels: {}, sections: {}, topStats: [], alerts: [],

  // ---------- API per i sistemi ----------
  registerPanel(def) {
    const old = this.panels[def.id] || {};
    this.panels[def.id] = { group: 'state', order: 100, width: 440, icon: 'info', ...old, ...def };
    if (this.ready) this.buildTabs();
  },
  registerSection(panelId, def) {
    const list = this.sections[panelId] || (this.sections[panelId] = []);
    const i = list.findIndex(s => s.id === def.id);
    if (i >= 0) list.splice(i, 1);
    list.push({ order: 50, ...def });
    list.sort((a, b) => a.order - b.order);
    this.dirty = true; this.lastPanel = '';
  },
  registerTopStat(def) {
    this.topStats = this.topStats.filter(s => s.id !== def.id);
    this.topStats.push({ order: 100, ...def });
    this.topStats.sort((a, b) => a.order - b.order);
    this.lastTop = '';
  },
  notify(text, opt = {}) {
    this.alerts.push({ text, icon: opt.icon || 'alert', tab: opt.tab || null, kind: opt.kind || 'info', day: S ? S.day : 0 });
    if (this.alerts.length > 8) this.alerts.shift();
    this.dirty = true;
  },
  open(tab) { this.setTab(tab); },
  close() { this.setTab(null); },

  // ---------- avvio ----------
  init() {
    this.ready = true;
    this.buildTabs();
    $('tb-country').addEventListener('click', () => this.toggle('politica'));
    $('btn-help').innerHTML = icon('help', 20);
    $('btn-help').addEventListener('click', () => this.help());
    $('tb-speed').innerHTML = `<button class="pause" data-speed="0" title="Pausa / riprendi (Spazio)"></button>` +
      [1, 2, 3, 4, 5].map(i => `<button data-speed="${i}" title="Velocità ${i} (tasto ${i})"><span class="pip" style="height:${4 + i * 2}px"></span></button>`).join('');
    $('tb-speed').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const sp = +b.dataset.speed;
      this.setSpeed(sp === 0 ? (S.paused ? S.speed : 0) : sp);
    });
    $('log-toggle').innerHTML = `${icon('log')}<span>Registro</span><span class="last"></span>`;
    $('log-toggle').addEventListener('click', () => $('logbox').classList.toggle('collapsed'));
    // azioni nei pannelli: data-act="nome" data-arg="..."  (oppure "idSezione:nome")
    $('panel-body').addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      e.preventDefault();
      this.act(b.dataset.act, b.dataset.arg, b);
    });
    $('panel-head').addEventListener('click', e => { if (e.target.closest('[data-close]')) this.close(); });
    $('unitbar').addEventListener('click', e => {
      const b = e.target.closest('[data-div]');
      if (!b) return;
      // Shift/Ctrl+clic toglie (o rimette) una singola divisione dalla selezione
      if (e.shiftKey || e.ctrlKey) { const id = +b.dataset.div; this.sel.has(id) ? this.sel.delete(id) : this.sel.add(id); this.dirty = true; }
      else this.act('selDiv', b.dataset.div);
    });
    // trascina le divisioni selezionate (dalla barra in basso) su un'armata
    $('unitbar').addEventListener('dragstart', e => {
      if (!this.sel.size) return e.preventDefault();
      e.dataTransfer.setData('text/x-divs', [...this.sel].join(','));
      e.dataTransfer.effectAllowed = 'move';
    });
    $('alerts').addEventListener('click', e => {
      const b = e.target.closest('[data-alert]'); if (!b) return;
      const a = this.alerts.splice(+b.dataset.alert, 1)[0];
      if (a && a.tab) this.setTab(a.tab);
      this.dirty = true;
    });
    window.addEventListener('keydown', e => this.onKey(e));
    this.initMapModes();
    this.initMapInput();
    this.dirty = true;
  },

  // barra delle modalità mappa (se il renderer le espone: Render.MAP_MODES = [[id, nome]], Render.setMapMode)
  initMapModes() {
    const modes = Render.MAP_MODES;
    if (!modes || !Render.setMapMode) return;
    const ICO = { political: 'map', terrain: 'fort', state: 'target', region: 'diplomacy', infra: 'infra', railway: 'rail', resources: 'steel', supply: 'supply' };
    const nav = $('mapmodes');
    nav.innerHTML = modes.map(([id, name]) => `<button data-mode="${id}" title="${esc(name)}">${icon(ICO[id] || 'map', 18)}</button>`).join('');
    const sync = () => nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.mode === (Render.mapMode || modes[0][0])));
    nav.addEventListener('click', e => {
      const b = e.target.closest('[data-mode]'); if (!b) return;
      Render.setMapMode(b.dataset.mode); sync();
    });
    nav.classList.remove('hidden');
    sync();
  },

  buildTabs() {
    const list = Object.values(this.panels).filter(p => !p.hidden);
    const grp = g => list.filter(p => p.group === g).sort((a, b) => a.order - b.order);
    const btn = p => `<button class="tab" data-tab="${p.id}" title="${esc(p.title)}${p.key ? ` (${p.key})` : ''}">${icon(p.icon, 22)}<span class="badge hidden"></span></button>`;
    $('tabs').innerHTML = grp('state').map(btn).join('') + '<span class="sep"></span>' + grp('military').map(btn).join('');
    $('tabs').querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => this.toggle(b.dataset.tab)));
    this.lastPanel = ''; this.dirty = true;
  },

  onKey(e) {
    if (!S || this.modalOpen) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (typing) { if (e.code === 'Escape') document.activeElement.blur(); return; }
    if (e.code === 'Space') { e.preventDefault(); this.setSpeed(S.paused ? S.speed : 0); }
    // velocità: + e - (i numeri sono i gruppi di controllo, come in HOI4)
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') this.setSpeed(Math.min(5, (S.paused ? 0 : S.speed) + 1));
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.setSpeed(S.paused || S.speed <= 1 ? 0 : S.speed - 1);
    else if (/^(Digit|Numpad)[0-9]$/.test(e.code)) { e.preventDefault(); this.ctrlGroup(+e.code.slice(-1), e.ctrlKey || e.metaKey); }
    else if (/^Arrow/.test(e.code)) {
      e.preventDefault();
      const k = 120, v = Render.view;
      if (e.code === 'ArrowLeft') v.tx += k; else if (e.code === 'ArrowRight') v.tx -= k;
      else if (e.code === 'ArrowUp') v.ty += k; else v.ty -= k;
    }
    else if (e.code === 'Escape') {
      if (this.mapTool) this.setMapTool(null);
      else if (this.sel.size) this.sel.clear(); else this.close();
      this.dirty = true;
    }
    else if (e.code === 'KeyA' && e.ctrlKey) { e.preventDefault(); this.act('selAll'); }
    else if (!e.ctrlKey && !e.altKey) {
      const p = Object.values(this.panels).find(p => p.key && 'Key' + p.key === e.code);
      if (p) this.toggle(p.id);
    }
  },

  initMapInput() {
    const cv = $('map'), tip = $('tooltip');
    let drag = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const [x, y] = pos(e);
      Render.zoomAt(x, y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    // sinistro: clic seleziona, trascina = riquadro di selezione (come in HOI4); destro o centrale trascinati spostano la mappa;
    // clic destro = muovi/attacca (Ctrl+clic destro = trasferimento in treno). Con UI.mapTool attivo il sinistro va allo strumento.
    cv.addEventListener('mousedown', e => {
      const [x, y] = pos(e);
      if (e.button === 0 && this.mapTool) {
        drag = { tool: true, x0: x, y0: y, moved: false };
        this.mapTool.down && this.mapTool.down(Render.tileAt(x, y), e);
        return;
      }
      if (e.button > 2) return;
      if (e.button === 1) e.preventDefault(); // niente scorrimento automatico del browser
      drag = { button: e.button, x0: x, y0: y, tx: Render.view.tx, ty: Render.view.ty, moved: false, box: e.button === 0 };
    });
    window.addEventListener('mousemove', e => {
      if (!S) return;
      const [x, y] = pos(e);
      if (drag) {
        if (Math.abs(x - drag.x0) + Math.abs(y - drag.y0) > 4) drag.moved = true;
        if (drag.tool) { if (drag.moved && this.mapTool && this.mapTool.move) this.mapTool.move(Render.tileAt(x, y), e); }
        else if (drag.moved) {
          if (drag.box) Render.box = { x0: drag.x0, y0: drag.y0, x1: x, y1: y };
          else { Render.view.tx = drag.tx + x - drag.x0; Render.view.ty = drag.ty + y - drag.y0; }
        }
      }
      if (e.target !== cv) { Render.hover = -1; tip.classList.add('hidden'); return; }
      const ti = Render.tileAt(x, y);
      Render.hover = ti;
      if (ti >= 0 && !drag?.moved) {
        tip.innerHTML = this.tileTip(ti);
        tip.classList.remove('hidden');
        const r = cv.getBoundingClientRect();
        tip.style.left = Math.min(x + 16, r.width - tip.offsetWidth - 4) + 'px';
        tip.style.top = Math.min(y + 16, r.height - tip.offsetHeight - 4) + 'px';
      } else tip.classList.add('hidden');
    });
    window.addEventListener('mouseup', e => {
      if (!drag) return;
      const [x, y] = pos(e);
      if (drag.tool) {
        if (e.button !== 0) return;
        const tool = this.mapTool;
        drag = null;
        if (tool && tool.up) tool.up(Render.tileAt(x, y), e);
        this.dirty = true;
        return;
      }
      if (e.button !== drag.button) return;
      if (drag.button !== 0) {
        // clic destro senza trascinare: ordine di movimento o attacco
        if (!drag.moved && drag.button === 2 && e.target === cv) {
          const ti = Render.tileAt(x, y);
          if (this.mapTool) this.setMapTool(null);
          else if (ti >= 0 && this.sel.size) {
            const n = orderMove(S.divs.filter(d => this.sel.has(d.id) && !d.dead), ti, { rail: e.ctrlKey });
            if (e.ctrlKey && n) log(`${n} divisioni in trasferimento strategico (treno): organizzazione a zero fino all'arrivo.`);
          }
        }
        drag = null;
        this.dirty = true;
        return;
      }
      if (drag.box && drag.moved) {
        const [ax, ay] = Render.toWorld(Math.min(drag.x0, x), Math.min(drag.y0, y));
        const [bx, by] = Render.toWorld(Math.max(drag.x0, x), Math.max(drag.y0, y));
        if (!e.ctrlKey && !e.shiftKey) this.sel.clear();
        // con la mappa che si richiude (wrapX) il riquadro può cadere su una copia della mappa
        const offs = MAP_DATA.wrapX ? [-Render.ww, 0, Render.ww] : [0];
        for (const d of S.divs) {
          const t = S.tiles[d.tile];
          if (d.owner === S.player && !d.dead && t.cy >= ay && t.cy <= by && offs.some(o => t.cx + o >= ax && t.cx + o <= bx)) this.sel.add(d.id);
        }
      } else if (!drag.moved) {
        this.clickTile(Render.tileAt(x, y), e.ctrlKey || e.shiftKey);
      }
      Render.box = null;
      drag = null;
      this.dirty = true;
    });
    window.addEventListener('resize', () => { if (S) Render.resize(); });
  },

  // gruppi di controllo: Ctrl+numero salva la selezione, numero la richiama, due volte centra la camera
  ctrlGroup(n, save) {
    const G = S.ctrlGroups || (S.ctrlGroups = {});
    if (save) {
      G[n] = [...this.sel];
      log(this.sel.size ? `Gruppo ${n}: ${this.sel.size} divisioni.` : `Gruppo ${n} svuotato.`);
      this.dirty = true;
      return;
    }
    const divs = (G[n] || []).map(id => S.divs.find(d => d.id === id)).filter(d => d && !d.dead);
    G[n] = divs.map(d => d.id);
    if (!divs.length) return;
    const now = performance.now(), again = this.lastGroup && this.lastGroup.n === n && now - this.lastGroup.t < 450;
    this.lastGroup = { n, t: now };
    this.sel = new Set(G[n]);
    if (again) Render.centerOn(groupCenterTile(divs));
    this.dirty = true;
  },
  // strumento di disegno sulla mappa (piani di battaglia ecc.): { hint, down(ti,e), move(ti,e), up(ti,e), cancel() }
  setMapTool(tool) {
    if (this.mapTool && this.mapTool !== tool && this.mapTool.cancel) this.mapTool.cancel();
    this.mapTool = tool || null;
    $('map').classList.toggle('drawing', !!tool);
    this.dirty = true;
  },

  clickTile(ti, add) {
    if (ti < 0) return;
    const t = S.tiles[ti];
    const mine = (S.byTile.get(ti) || []).filter(d => d.owner === S.player && !d.dead);
    if (mine.length) {
      if (!add) this.sel.clear();
      const allIn = mine.every(d => this.sel.has(d.id));
      for (const d of mine) allIn && add ? this.sel.delete(d.id) : this.sel.add(d.id);
    } else {
      if (!add) this.sel.clear();
      if (t.land) { this.selCountry = t.owner; this.setTab('diplomazia'); }
    }
    this.dirty = true;
  },

  tileTip(ti) {
    const t = S.tiles[ti];
    if (!t.land) {
      const n = (S.byTile.get(ti) || []).length;
      return `<b>${esc(MAP.regions[t.region].name)}</b>${n ? `<br>${n} divisioni in trasporto` : ''}`;
    }
    const o = C(t.owner), c = C(t.ctrl);
    const st = MAP.states[t.state];
    let h = `<b>${t.city ? esc(t.city) + ', ' : ''}${esc(st.name)}</b><br>${flag(o)} ${esc(o.name)}`;
    if (t.ctrl !== t.owner) h += `<br><span class="warn">Occupato da ${esc(c.name)}</span>`;
    h += `<br><span class="muted">${TERRAIN[t.terrain].name}${o.capital === t.i ? ' · Capitale' : ''}${t.vp ? ` · ${t.vp} punti vittoria` : ''}`;
    h += `<br>Infrastrutture ${t.infra}/5${t.rail ? ` · ferrovia liv. ${t.rail}` : ''}${t.port ? ` · porto ${t.port}` : ''}`;
    h += ` · difesa ×${TERRAIN[t.terrain].def}</span>`;
    const divs = (S.byTile.get(ti) || []).filter(d => !d.dead);
    const by = {};
    for (const d of divs) by[d.owner] = (by[d.owner] || 0) + 1;
    for (const k in by) h += `<br>${flag(C(k))} ${by[k]} divisioni ${esc(C(k).name)}`;
    return h;
  },

  toggle(tab) { this.setTab(this.tab === tab ? null : tab); },
  setTab(tab) {
    if (tab && !this.panels[tab]) tab = null;
    this.tab = tab;
    $('tabs').querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const pn = $('panel');
    pn.classList.toggle('hidden', !tab);
    if (tab) {
      const p = this.panels[tab];
      pn.classList.toggle('full', p.width === 'full');
      pn.style.width = p.width === 'full' ? '' : p.width + 'px';
      $('panel-head').innerHTML = `${icon(p.icon, 22)}<h2>${esc(p.title)}</h2><button class="ghost" data-close title="Chiudi (Esc)">${icon('close', 18)}</button>`;
      $('panel-body').scrollTop = 0;
      pn.style.animation = 'none'; void pn.offsetWidth; pn.style.animation = '';
    }
    this.dirty = true;
    this.lastPanel = '';
  },
  setSpeed(sp) {
    if (!S || S.over) return;
    if (sp === 0) S.paused = true;
    else { S.speed = sp; S.paused = false; }
    this.dirty = true;
  },

  // ---------- ridisegno ----------
  update() {
    if (!S || !this.dirty) return;
    this.dirty = false;
    for (const id of [...this.sel]) if (!S.divs.some(d => d.id === id)) this.sel.delete(id);
    this.renderTop();
    this.renderPanel();
    this.renderLog();
    this.renderUnits();
    this.renderAlerts();
  },

  renderTop() {
    const p = C(S.player), ideo = IDEOLOGY[ideologyOf(p)];
    const top = `${flagBig(p)}<span class="cn"><b>${esc(p.name)}</b><small>${p.leader ? esc(p.leader) + ' · ' : ''}${ideo.name}</small></span>`;
    let res = '';
    for (const s of this.topStats) {
      if (s.show && !s.show(p)) continue;
      const tip = s.tip ? s.tip(p) : s.title || '';
      res += `<span class="res" title="${esc(String(tip).replace(/<[^>]+>/g, ''))}">${icon(s.icon, 18)}${s.value(p)}</span>`;
    }
    const enemies = enemiesOf(S.player);
    const war = enemies.length
      ? `<span class="warpill war" title="In guerra con: ${esc(enemies.map(e => C(e).name).join(', '))}">${icon('war')} In guerra · ${enemies.length}</span>`
      : `<span class="warpill peace">${icon('peace')} In pace</span>`;
    const key = top + res + war;
    if (key !== this.lastTop) {
      this.lastTop = key;
      $('tb-country').innerHTML = top;
      $('tb-res').innerHTML = res;
      $('tb-war').innerHTML = war;
    }
    $('tb-date').textContent = dateLabel(S.day);
    $('tb-date').classList.toggle('paused', S.paused);
    $('tb-speed').querySelectorAll('button').forEach(b => {
      const sp = +b.dataset.speed;
      if (sp === 0) { b.innerHTML = icon(S.paused ? 'play' : 'pause', 12); b.classList.toggle('on', S.paused); }
      else b.firstChild.classList.toggle('on', sp <= S.speed && !S.paused);
      if (sp) b.classList.toggle('on', !S.paused && S.speed === sp);
    });
    $('tabs').querySelectorAll('.tab').forEach(b => {
      const p = this.panels[b.dataset.tab], v = p && p.badge ? p.badge(C(S.player)) : null;
      const el = b.querySelector('.badge');
      el.classList.toggle('hidden', v == null || v === 0 || v === '');
      if (v != null) el.textContent = v;
    });
  },

  renderPanel() {
    if (!this.tab) return;
    const pd = this.panels[this.tab], p = C(S.player);
    const legacy = this['panel_' + this.tab]; // compatibilità con i vecchi UI.panel_xxx
    let html = typeof legacy === 'function' ? legacy.call(this, p) : pd.render ? pd.render(p) : '';
    for (const s of this.sections[this.tab] || []) {
      const h = s.render(p);
      if (h) html = s.order < 50 ? h + html : html + h;
    }
    if (html === this.lastPanel) return;
    this.lastPanel = html;
    const body = $('panel-body');
    // conserva testo, focus e cursore dei campi con id (es. chat diplomatica)
    const keep = {};
    body.querySelectorAll('input[id],textarea[id],select[id]').forEach(el => { keep[el.id] = el.value; });
    const act = document.activeElement, actId = act && body.contains(act) ? act.id : null;
    const selS = actId && act.selectionStart, selE = actId && act.selectionEnd;
    const scroll = body.scrollTop;
    body.innerHTML = html;
    for (const id in keep) { const el = document.getElementById(id); if (el && body.contains(el)) el.value = keep[id]; }
    if (actId) {
      const el = document.getElementById(actId);
      if (el) { el.focus(); try { el.setSelectionRange(selS, selE); } catch (e) { /* non testuale */ } }
    }
    body.scrollTop = scroll;
  },

  renderLog() {
    const lg = S.log.slice(0, 50).map(l => `<div class="${l.cls}"><time>${dateLabel(l.day)}</time>${esc(l.msg)}</div>`).join('');
    if (lg === this.lastLog) return;
    this.lastLog = lg;
    $('log').innerHTML = lg;
    $('log-toggle').querySelector('.last').textContent = S.log[0] ? S.log[0].msg : '';
  },

  renderUnits() {
    const divs = S.divs.filter(d => this.sel.has(d.id) && !d.dead);
    let h = '';
    if (divs.length) {
      h = `<span class="ucount" draggable="true" title="Trascina su un'armata per assegnare">${divs.length} ${divs.length === 1 ? 'divisione' : 'divisioni'}</span>` + divs.slice(0, 40).map(d => {
        const ut = UNIT_TYPES[d.type];
        return `<button class="ucard ${d.combat ? 'fight' : ''}" draggable="true" data-div="${d.id}" title="${esc(divName(d))}">
          <span class="uh">${icon(d.type === 'arm' ? 'tank' : 'division', 13)}${esc(divName(d))}</span>
          ${bar(d.org / (typeof divMaxOrg === 'function' ? divMaxOrg(d) : ut.org), 'org')}${bar(d.str, 'str')}</button>`;
      }).join('');
    }
    if (h === this.lastUnits) return;
    this.lastUnits = h;
    $('unitbar').innerHTML = h;
    $('unitbar').classList.toggle('hidden', !divs.length);
  },

  renderAlerts() {
    // allerte automatiche (come in HOI4) + quelle inviate dai sistemi con UI.notify
    const p = C(S.player), auto = [];
    if (!p.focus && this.panels.focus) auto.push({ text: 'Nessun focus nazionale in corso', icon: 'focus', tab: 'focus', kind: 'warn' });
    if (p.pp >= 150) auto.push({ text: `Potere politico inutilizzato: ${Math.floor(p.pp)}`, icon: 'pp', tab: 'politica', kind: 'info' });
    if (!p.construction.length && canBuild(p)) auto.push({ text: 'Cantieri inattivi', icon: 'construction', tab: 'costruzione', kind: 'warn' });
    const all = [...auto.map(a => ({ ...a, auto: true })), ...this.alerts];
    const h = all.map((a, i) => `<button class="alert ${a.kind}" ${a.auto ? `data-tabgo="${a.tab}"` : `data-alert="${i - auto.length}"`} title="${esc(a.text)}">${icon(a.icon, 18)}</button>`).join('');
    if (h === this.lastAlerts) return;
    this.lastAlerts = h;
    $('alerts').innerHTML = h;
    $('alerts').querySelectorAll('[data-tabgo]').forEach(b => b.addEventListener('click', () => this.setTab(b.dataset.tabgo)));
  },

  // ---------- azioni ----------
  act(name, arg, el) {
    const p = C(S.player);
    let handled = false;
    if (name.includes(':')) {
      const [sid, an] = name.split(':');
      for (const s of this.sections[this.tab] || []) if (s.id === sid && s.actions && s.actions[an]) { s.actions[an](arg, el); handled = true; }
    } else {
      const pd = this.panels[this.tab];
      if (pd && pd.actions && pd.actions[name]) { pd.actions[name](arg, el); handled = true; }
      else for (const s of this.sections[this.tab] || []) if (s.actions && s.actions[name]) { s.actions[name](arg, el); handled = true; break; }
    }
    if (!handled) {
      switch (name) {
        case 'open': this.setTab(arg); break;
        case 'selAll': this.sel = new Set(S.divs.filter(d => d.owner === S.player).map(d => d.id)); break;
        case 'selIdle': this.sel = new Set(S.divs.filter(d => d.owner === S.player && !d.path.length && !d.combat).map(d => d.id)); break;
        case 'desel': this.sel.clear(); break;
        case 'stop': for (const d of S.divs) if (this.sel.has(d.id)) d.path = d.path.length && !S.tiles[d.path[0]].land ? d.path : []; break;
        case 'selDiv': {
          const d = S.divs.find(d => d.id === +arg);
          if (d) { this.sel = new Set([d.id]); Render.centerOn(d.tile, 2.5); }
          break;
        }
        case 'center': Render.centerOn(+arg, 2); break;
        case 'selCountry': this.selCountry = arg; this.setTab('diplomazia'); break;
        default: console.warn('Azione UI sconosciuta:', name, p.code);
      }
    }
    this.dirty = true;
    this.lastPanel = '';
  },

  // ---------- finestre evento ----------
  ask(title, text, buttons, opt = {}) {
    this.modalQueue.push({ title, text, buttons, ...opt });
    if (!this.modalOpen) this.nextModal();
  },
  nextModal() {
    const m = this.modalQueue.shift();
    if (!m) { this.modalOpen = false; $('modal-bg').classList.add('hidden'); return; }
    this.modalOpen = true;
    const pic = m.pic === false ? '' : `<div class="mpic">${m.icon ? icon(m.icon, 64) : ''}</div>`;
    $('modal').innerHTML = `<h2>${esc(m.title)}</h2>${pic}<div class="mtext">${m.html || esc(m.text)}</div><div class="mbtns"></div>`;
    const wrap = $('modal').querySelector('.mbtns');
    m.buttons.forEach((b, i) => {
      const el = document.createElement('button');
      el.textContent = b.label;
      if (i === 0) el.className = 'primary';
      el.onclick = () => { this.nextModal(); if (b.fn) b.fn(); this.dirty = true; };
      wrap.appendChild(el);
    });
    $('modal-bg').classList.remove('hidden');
  },
  help() {
    this.modalQueue.unshift({ title: 'Come si gioca', buttons: [{ label: 'Ho capito' }], html: HELP_HTML, pic: false });
    this.nextModal();
  },
  gameOver(reason) {
    const p = C(S.player);
    const title = reason === 'time' ? 'Fine della guerra' : 'Sconfitta';
    const txt = reason === 'time'
      ? `È il 1946. ${p.name} controlla ${p.tiles} territori con ${p.civ + p.mil} fabbriche.`
      : reason === 'annexed' ? `${p.name} è stata annessa. La tua partita è finita.` : `${p.name} ha capitolato. La tua partita è finita.`;
    this.modalQueue = [{ title, text: txt, icon: reason === 'time' ? 'peace' : 'war', buttons: [{ label: 'Nuova partita', fn: () => location.reload() }, { label: 'Guarda la mappa' }] }];
    this.nextModal();
  },
};

// ---------- risorse della barra in alto ----------
UI.registerTopStat({ id: 'pp', order: 10, icon: 'pp', title: 'Potere politico: serve per la diplomazia, i ministri e le leggi',
  value: p => `${Math.floor(p.pp)} <small class="good">+${p.ppGain.toFixed(2)}</small>` });
UI.registerTopStat({ id: 'stabilita', order: 20, icon: 'stability', title: 'Stabilità', show: p => p.stability != null,
  value: p => `<span class="pct">${pct(p.stability)}<span class="mini"><i style="width:${pct(p.stability)}"></i></span></span>` });
UI.registerTopStat({ id: 'supporto', order: 30, icon: 'warsupport', title: 'Supporto alla guerra', show: p => p.warSupport != null,
  value: p => `<span class="pct">${pct(p.warSupport)}<span class="mini"><i style="width:${pct(p.warSupport)}"></i></span></span>` });
UI.registerTopStat({ id: 'manodopera', order: 40, icon: 'manpower', title: 'Manodopera disponibile', value: p => fmt(p.manpower) });
UI.registerTopStat({ id: 'fabbriche', order: 50, icon: 'factory', title: 'Fabbriche civili / militari',
  value: p => `${p.civ}<small>civ</small> ${p.mil}<small>mil</small>` });
UI.registerTopStat({ id: 'equip', order: 60, icon: 'equipment', title: 'Equipaggiamento in magazzino',
  value: p => typeof Econ !== 'undefined' ? fmt(p.equipment) : `${fmt(p.equipment)} <small class="good">+${Math.round(p.mil * 3 * (1 + p.eqBonus))}</small>` });
UI.registerTopStat({ id: 'divisioni', order: 70, icon: 'division', title: 'Divisioni schierate',
  value: p => S.divs.filter(d => d.owner === p.code && !d.dead).length });

const HELP_HTML = `
<ul class="help">
<li><b>Tempo</b>: Spazio = pausa, tasti + e − = velocità.</li>
<li><b>Schede</b>: i bottoni in alto aprono i pannelli (Politica Q, Ricerca W, Diplomazia E, Commercio R, Costruzione T, Produzione Y, Esercito U, Logistica I, Intelligence O, Focus F). Esc chiude.</li>
<li><b>Mappa</b>: trascina col tasto destro o centrale (o usa le frecce) per spostarti, rotella per lo zoom. Clic su un paese per la diplomazia.</li>
<li><b>Divisioni</b>: clic sul segnalino per selezionare, trascina col sinistro per un riquadro, Shift+clic per aggiungere o togliere. <b>Clic destro</b> su un territorio per muovere o attaccare (da più province insieme = attacco da più direzioni), <b>Ctrl+clic destro</b> per il trasferimento in treno.</li>
<li><b>Gruppi di controllo</b>: Ctrl+numero (1–0) salva la selezione, il numero la richiama, premuto due volte centra la camera.</li>
<li><b>Armate</b>: in basso, «+» assegna le divisioni selezionate a un generale (o trascinale sul ritratto). Disegna la linea del fronte e la freccia d'offensiva, poi ▶ Esegui piano. Ferme sul fronte, le divisioni accumulano il bonus di pianificazione (barra verde).</li>
<li><b>Combattimento</b>: entrare in un territorio nemico occupato da truppe avvia una battaglia. Vince chi esaurisce prima l'organizzazione del nemico; serve circa il doppio della forza per sfondare. Montagne e foreste aiutano il difensore.</li>
<li><b>Accerchiamento</b>: le divisioni sconfitte senza ritirata sicura vengono distrutte.</li>
<li><b>Mare</b>: le divisioni possono attraversare il mare (lentamente) e sbarcare, con metà dell'attacco.</li>
<li><b>Economia</b>: le fabbriche civili costruiscono fabbriche, quelle militari producono equipaggiamento per nuove divisioni e rinforzi.</li>
<li><b>Capitolazione</b>: un paese si arrende quando perde gran parte del territorio (contano capitale ★ e città ■).</li>
<li><b>Storia</b>: gli eventi storici (Anschluss, Polonia 1939, Barbarossa…) accadono se non cambi tu il corso degli eventi.</li>
</ul>`;
