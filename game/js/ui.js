'use strict';

const $ = id => document.getElementById(id);
const bar = (f, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, f * 100)).toFixed(1)}%"></i></div>`;
const flag = c => `<span class="flag" style="background:${c.color}"></span>`;

const UI = {
  tab: 'politica', selCountry: null, sel: new Set(), dirty: true, modalQueue: [], modalOpen: false,
  lastPanel: '', lastLog: '',

  init() {
    document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
    document.querySelectorAll('#tb-speed button').forEach(b => b.addEventListener('click', () => this.setSpeed(+b.dataset.speed)));
    $('btn-help').addEventListener('click', () => this.help());
    $('panel').addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      e.preventDefault();
      this.act(b.dataset.act, b.dataset.arg);
    });
    window.addEventListener('keydown', e => {
      if (!S || this.modalOpen) return;
      if (e.code === 'Space') { e.preventDefault(); this.setSpeed(S.paused ? S.speed : 0); }
      else if (/^Digit[1-5]$/.test(e.code)) this.setSpeed(+e.code.slice(5));
      else if (e.code === 'Escape') { this.sel.clear(); this.dirty = true; }
      else if (e.code === 'KeyA' && e.ctrlKey) { e.preventDefault(); this.act('selAll'); }
    });
    this.initMapInput();
    this.setTab('politica');
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
    cv.addEventListener('mousedown', e => {
      const [x, y] = pos(e);
      if (e.button === 2) {
        const ti = Render.tileAt(x, y);
        if (ti >= 0 && this.sel.size) {
          const divs = S.divs.filter(d => this.sel.has(d.id) && !d.dead);
          orderMove(divs, ti);
        }
        return;
      }
      if (e.button !== 0) return;
      drag = { x0: x, y0: y, tx: Render.view.tx, ty: Render.view.ty, moved: false, box: e.shiftKey };
    });
    window.addEventListener('mousemove', e => {
      if (!S) return;
      const [x, y] = pos(e);
      if (drag) {
        if (Math.abs(x - drag.x0) + Math.abs(y - drag.y0) > 4) drag.moved = true;
        if (drag.moved) {
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
      if (!drag || e.button !== 0) return;
      const [x, y] = pos(e);
      if (drag.box && drag.moved) {
        const [ax, ay] = Render.toWorld(Math.min(drag.x0, x), Math.min(drag.y0, y));
        const [bx, by] = Render.toWorld(Math.max(drag.x0, x), Math.max(drag.y0, y));
        if (!e.ctrlKey) this.sel.clear();
        for (const d of S.divs) {
          const t = S.tiles[d.tile];
          if (d.owner === S.player && t.cx >= ax && t.cx <= bx && t.cy >= ay && t.cy <= by) this.sel.add(d.id);
        }
        if (this.sel.size) this.setTab('esercito');
      } else if (!drag.moved) {
        this.clickTile(Render.tileAt(x, y), e.ctrlKey || e.shiftKey);
      }
      Render.box = null;
      drag = null;
      this.dirty = true;
    });
    window.addEventListener('resize', () => { if (S) Render.resize(); });
  },

  clickTile(ti, add) {
    if (ti < 0) return;
    const t = S.tiles[ti];
    const mine = (S.byTile.get(ti) || []).filter(d => d.owner === S.player && !d.dead);
    if (mine.length) {
      if (!add) this.sel.clear();
      const allIn = mine.every(d => this.sel.has(d.id));
      for (const d of mine) allIn && add ? this.sel.delete(d.id) : this.sel.add(d.id);
      this.setTab('esercito');
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
    h += `<br>${TERRAIN[t.terrain].name}${o.capital === t.i ? ' · Capitale' : ''}${t.vp ? ` · ${t.vp} punti vittoria` : ''}`;
    h += `<br>Infrastrutture ${t.infra}/5${t.rail ? ` · ferrovia liv. ${t.rail}` : ''}${t.port ? ` · porto ${t.port}` : ''}`;
    h += ` · difesa ×${TERRAIN[t.terrain].def}`;
    const divs = (S.byTile.get(ti) || []).filter(d => !d.dead);
    const by = {};
    for (const d of divs) by[d.owner] = (by[d.owner] || 0) + 1;
    for (const k in by) h += `<br>${flag(C(k))} ${by[k]} divisioni ${esc(C(k).name)}`;
    return h;
  },

  setTab(tab) {
    this.tab = tab;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    this.dirty = true;
    this.lastPanel = '';
  },
  setSpeed(sp) {
    if (!S || S.over) return;
    if (sp === 0) S.paused = true;
    else { S.speed = sp; S.paused = false; }
    this.dirty = true;
  },

  update() {
    if (!S || !this.dirty) return;
    this.dirty = false;
    for (const id of [...this.sel]) if (!S.divs.some(d => d.id === id)) this.sel.delete(id);
    this.renderTop();
    const html = this['panel_' + this.tab]();
    if (html !== this.lastPanel) { $('panel').innerHTML = html; this.lastPanel = html; }
    const lg = S.log.slice(0, 40).map(l => `<div class="${l.cls}"><time>${dateLabel(l.day)}</time>${esc(l.msg)}</div>`).join('');
    if (lg !== this.lastLog) { $('log').innerHTML = lg; this.lastLog = lg; }
  },

  renderTop() {
    const p = C(S.player);
    $('tb-country').innerHTML = `${flag(p)}<span>${esc(p.name)}</span>`;
    const eqDay = p.mil * 3 * (1 + p.eqBonus);
    const enemies = enemiesOf(S.player);
    const res = [
      ['🏭', p.civ, 'Fabbriche civili: costruiscono nuove fabbriche'],
      ['⚙️', p.mil, 'Fabbriche militari: producono equipaggiamento'],
      ['👥', fmt(p.manpower), 'Manodopera disponibile'],
      ['🔫', `${fmt(p.equipment)} <small>+${Math.round(eqDay)}/g</small>`, 'Equipaggiamento in magazzino'],
      ['⭐', `${Math.floor(p.pp)} <small>+${p.ppGain.toFixed(1)}/g</small>`, 'Potere politico: serve per la diplomazia'],
      ['🎖️', S.divs.filter(d => d.owner === S.player).length, 'Divisioni schierate'],
    ];
    $('tb-res').innerHTML = res.map(([i, v, t]) => `<span class="res" title="${t}">${i} ${v}</span>`).join('') +
      (enemies.length ? `<span class="res war" title="Nemici">⚔ ${enemies.map(e => esc(C(e).name)).join(', ')}</span>` : `<span class="res peace">In pace</span>`);
    $('tb-date').textContent = dateLabel(S.day);
    document.querySelectorAll('#tb-speed button').forEach(b => {
      const sp = +b.dataset.speed;
      b.classList.toggle('on', sp === 0 ? S.paused : (!S.paused && S.speed === sp));
    });
  },

  // ---------- pannelli ----------
  panel_politica() {
    const p = C(S.player);
    let h = `<h3>Focus nazionale</h3>`;
    if (p.focus) {
      const f = FOCUS_BY_ID[p.focus];
      h += `<div class="card cur"><b>${esc(f.name)}</b><p>${esc(f.desc)}</p>${bar(1 - p.focusDays / f.days)}<small>${p.focusDays} giorni rimanenti</small></div>`;
    } else h += `<p class="hint">Scegli un focus: si completa in automatico col passare dei giorni.</p>`;
    for (const f of FOCUSES) {
      if (p.done.has(f.id) || p.focus === f.id) continue;
      const av = focusAvailable(p, f);
      const reqTxt = f.req ? `Richiede: ${f.req.map(r => FOCUS_BY_ID[r].name).join(', ')}` : '';
      h += `<div class="card ${av ? '' : 'dim'}"><div class="row"><b>${esc(f.name)}</b><small>${f.days} g</small></div><p>${esc(f.desc)}</p>
        ${!av && reqTxt ? `<small>${esc(reqTxt)}</small>` : ''}
        <button data-act="focus" data-arg="${f.id}" ${!av || p.focus ? 'disabled' : ''}>Avvia</button></div>`;
    }
    if (p.done.size) h += `<h3>Completati</h3><p class="done">${[...p.done].map(id => esc(FOCUS_BY_ID[id].name)).join(' · ')}</p>`;
    return h;
  },

  panel_produzione() {
    const p = C(S.player);
    const speed = Math.max(1, p.civ) * 0.15;
    let h = `<h3>Industria</h3>
      <div class="stats"><div><b>${p.civ}</b><small>civili</small></div><div><b>${p.mil}</b><small>militari</small></div>
      <div><b>${p.civ + p.mil}/${factoryCap(p)}</b><small>slot</small></div></div>
      <div class="row2">
        <button data-act="build" data-arg="civ" ${canBuild(p) && p.construction.length < 5 ? '' : 'disabled'}>+ Fabbrica civile</button>
        <button data-act="build" data-arg="mil" ${canBuild(p) && p.construction.length < 5 ? '' : 'disabled'}>+ Fabbrica militare</button>
      </div>`;
    if (p.construction.length) {
      h += `<h4>Cantieri (${speed.toFixed(1)} punti/giorno)</h4>`;
      p.construction.forEach((j, i) => {
        h += `<div class="qrow"><span>${j.type === 'civ' ? '🏭 Civile' : '⚙️ Militare'}</span>${bar(j.prog / j.cost)}<button class="x" data-act="cancelBuild" data-arg="${i}" title="Annulla">✕</button></div>`;
      });
    }
    h += `<h3>Reclutamento</h3>`;
    for (const type in UNIT_TYPES) {
      const ut = UNIT_TYPES[type];
      const locked = type === 'arm' && !p.armorTech;
      h += `<div class="card ${locked ? 'dim' : ''}"><div class="row"><b>${ut.name}</b><small>${ut.days} giorni</small></div>
        <p>Att ${ut.atk} · Dif ${ut.def} · Org ${ut.org} · Vel ${ut.speed}</p>
        <p>🔫 ${fmt(ut.eq)} · 👥 ${fmt(ut.mp)}</p>
        ${locked ? '<small>Sblocca con il focus “Ricerca corazzata”</small>' : ''}
        <button data-act="recruit" data-arg="${type}" ${canRecruit(p, type) ? '' : 'disabled'}>Recluta</button></div>`;
    }
    if (p.training.length) {
      h += `<h4>In addestramento</h4>`;
      for (const tr of p.training) h += `<div class="qrow"><span>${UNIT_TYPES[tr.type].name}</span>${bar(1 - tr.days / tr.total)}<small>${tr.days} g</small></div>`;
    }
    return h;
  },

  panel_esercito() {
    const mine = S.divs.filter(d => d.owner === S.player && !d.dead);
    const fighting = mine.filter(d => d.combat).length, moving = mine.filter(d => d.path.length && !d.combat).length;
    let h = `<h3>Esercito</h3>
      <div class="stats"><div><b>${mine.length}</b><small>divisioni</small></div><div><b>${moving}</b><small>in marcia</small></div><div><b>${fighting}</b><small>in battaglia</small></div></div>
      <div class="row2"><button data-act="selAll">Seleziona tutte</button><button data-act="selIdle">Solo inattive</button></div>
      <div class="row2"><button data-act="stop" ${this.sel.size ? '' : 'disabled'}>Ferma selezionate</button><button data-act="desel" ${this.sel.size ? '' : 'disabled'}>Deseleziona</button></div>
      <p class="hint">${this.sel.size ? `<b>${this.sel.size}</b> selezionate: clic destro sulla mappa per muovere o attaccare.` : 'Clic su un segnalino per selezionare, Shift+trascina per un riquadro.'}</p>`;
    const list = [...mine].sort((a, b) => (this.sel.has(b.id) - this.sel.has(a.id)) || (b.combat - a.combat) || a.num - b.num).slice(0, 150);
    for (const d of list) {
      const ut = UNIT_TYPES[d.type];
      const st = d.combat ? '<span class="bad">in battaglia</span>' : d.path.length ? 'in marcia' : 'in attesa';
      h += `<div class="div ${this.sel.has(d.id) ? 'sel' : ''}" data-act="selDiv" data-arg="${d.id}">
        <div class="row"><b>${divName(d)}</b><small>${st}</small></div>
        <div class="row3"><small>Org</small>${bar(d.org / ut.org, 'org')}<small>Forza</small>${bar(d.str, 'str')}</div></div>`;
    }
    if (mine.length > 150) h += `<p class="hint">…e altre ${mine.length - 150}</p>`;
    return h;
  },

  panel_diplomazia() {
    const pc = S.player, p = C(pc);
    let h = '';
    const sc = this.selCountry && C(this.selCountry);
    if (sc && sc.alive && sc.code !== pc) {
      const f = sc.faction && S.factions[sc.faction];
      const status = atWar(pc, sc.code) ? '<span class="bad">In guerra</span>' : allied(pc, sc.code) ? '<span class="good">Alleato</span>' : 'Neutrale';
      const nd = S.divs.filter(d => d.owner === sc.code && !d.dead).length;
      const guar = S.guarantees.filter(g => g.to === sc.code).map(g => C(g.by).name);
      h += `<h3>${flag(sc)} ${esc(sc.name)}</h3>
        <div class="stats"><div><b>${sc.civ}/${sc.mil}</b><small>fabbriche</small></div><div><b>${nd}</b><small>divisioni</small></div><div><b>${sc.tiles}</b><small>territori</small></div></div>
        <p>Rapporti: ${status}<br>Fazione: ${f ? esc(f.name) : 'nessuna'}${guar.length ? `<br>Garantito da: ${esc(guar.join(', '))}` : ''}
        ${enemiesOf(sc.code).length ? `<br>In guerra con: ${esc(enemiesOf(sc.code).map(e => C(e).name).join(', '))}` : ''}</p>`;
      const canWar = !atWar(pc, sc.code) && !allied(pc, sc.code);
      h += `<button class="danger" data-act="war" ${canWar && p.pp >= PP_COST.war ? '' : 'disabled'}>Dichiara guerra (⭐${PP_COST.war})</button>`;
      if (canWar && guar.length) h += `<p class="hint">Attenzione: ${esc(guar.join(', '))} entrerà in guerra in sua difesa.</p>`;
      if (f && f.members.length) h += `<p class="hint">Attaccandolo entrerai in guerra con tutta la fazione ${esc(f.name)}.</p>`;
      const guaranteed = S.guarantees.some(g => g.by === pc && g.to === sc.code);
      h += `<button data-act="guarantee" ${!guaranteed && !atWar(pc, sc.code) && p.pp >= PP_COST.guarantee ? '' : 'disabled'}>Garantisci indipendenza (⭐${PP_COST.guarantee})</button>`;
      if (p.faction && !sc.faction) h += `<button data-act="invite" ${!atWar(pc, sc.code) && p.pp >= PP_COST.faction ? '' : 'disabled'}>Invita nella fazione (⭐${PP_COST.faction})</button>`;
      if (!p.faction && sc.faction) h += `<button data-act="askJoin" ${p.pp >= PP_COST.faction && !S.factions[sc.faction].members.some(m => atWar(m, pc)) ? '' : 'disabled'}>Chiedi di entrare in ${esc(f.name)} (⭐${PP_COST.faction})</button>`;
      h += `<button data-act="center" data-arg="${sc.capital}">Mostra capitale</button>`;
    } else {
      h += `<h3>Diplomazia</h3><p class="hint">Clicca un paese sulla mappa per vedere le azioni diplomatiche.</p>`;
    }
    h += `<h3>La tua nazione</h3><p>Fazione: ${p.faction ? esc(S.factions[p.faction].name) : 'nessuna'}</p>`;
    if (!p.faction) h += `<button data-act="createFaction" ${p.pp >= PP_COST.create ? '' : 'disabled'}>Fonda una fazione (⭐${PP_COST.create})</button>`;
    h += `<h3>Fazioni</h3>`;
    for (const id in S.factions) {
      const f = S.factions[id];
      h += `<div class="card"><b>${esc(f.name)}</b><p>${f.members.map(m => `${flag(C(m))} ${esc(C(m).name)}`).join('<br>')}</p></div>`;
    }
    const wars = [...S.wars].map(k => k.split('|')).map(([a, b]) => `${esc(C(a).name)} ⚔ ${esc(C(b).name)}`);
    h += `<h3>Guerre in corso</h3><p class="done">${wars.length ? wars.join('<br>') : 'Nessuna'}</p>`;
    return h;
  },

  act(name, arg) {
    const p = C(S.player);
    switch (name) {
      case 'focus': startFocus(p, arg); break;
      case 'build': queueBuild(p, arg); break;
      case 'cancelBuild': p.construction.splice(+arg, 1); break;
      case 'recruit': if (recruit(p, arg)) log(`Nuova divisione di ${UNIT_TYPES[arg].name} in addestramento.`); break;
      case 'selAll': this.sel = new Set(S.divs.filter(d => d.owner === S.player).map(d => d.id)); this.setTab('esercito'); break;
      case 'selIdle': this.sel = new Set(S.divs.filter(d => d.owner === S.player && !d.path.length).map(d => d.id)); break;
      case 'desel': this.sel.clear(); break;
      case 'stop': for (const d of S.divs) if (this.sel.has(d.id)) { d.path = d.path.length && !S.tiles[d.path[0]].land ? d.path : []; } break;
      case 'selDiv': {
        const d = S.divs.find(d => d.id === +arg);
        if (d) { this.sel = new Set([d.id]); Render.centerOn(d.tile, 2.5); }
        break;
      }
      case 'center': Render.centerOn(+arg, 2); break;
      case 'war': {
        const t = this.selCountry;
        this.ask('Dichiarazione di guerra', `Sei sicuro di voler dichiarare guerra a ${C(t).name}?`,
          [{ label: 'Guerra!', fn: () => playerDeclareWar(t) }, { label: 'Annulla' }]);
        break;
      }
      case 'guarantee': playerGuarantee(this.selCountry); break;
      case 'invite': playerInvite(this.selCountry); break;
      case 'askJoin': playerAskJoin(this.selCountry); break;
      case 'createFaction': playerCreateFaction(); break;
    }
    this.dirty = true;
    this.lastPanel = '';
  },

  // ---------- finestre modali ----------
  ask(title, text, buttons) {
    this.modalQueue.push({ title, text, buttons });
    if (!this.modalOpen) this.nextModal();
  },
  nextModal() {
    const m = this.modalQueue.shift();
    if (!m) { this.modalOpen = false; $('modal-bg').classList.add('hidden'); return; }
    this.modalOpen = true;
    $('modal').innerHTML = `<h2>${esc(m.title)}</h2><div class="mtext">${m.html || esc(m.text)}</div><div class="mbtns"></div>`;
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
    this.modalQueue.unshift({
      title: 'Come si gioca', buttons: [{ label: 'Ho capito' }], html: HELP_HTML,
    });
    this.nextModal();
  },
  gameOver(reason) {
    const p = C(S.player);
    const title = reason === 'time' ? 'Fine della guerra' : 'Sconfitta';
    const txt = reason === 'time'
      ? `È il 1946. ${p.name} controlla ${p.tiles} territori con ${p.civ + p.mil} fabbriche.`
      : reason === 'annexed' ? `${p.name} è stata annessa. La tua partita è finita.` : `${p.name} ha capitolato. La tua partita è finita.`;
    this.modalQueue = [{ title, text: txt, buttons: [{ label: 'Nuova partita', fn: () => location.reload() }, { label: 'Guarda la mappa' }] }];
    this.nextModal();
  },
};

const HELP_HTML = `
<ul class="help">
<li><b>Tempo</b>: Spazio = pausa, tasti 1–5 = velocità.</li>
<li><b>Mappa</b>: trascina per spostarti, rotella per lo zoom.</li>
<li><b>Divisioni</b>: clic sul segnalino per selezionare (Ctrl/Shift+clic per aggiungere, Shift+trascina per un riquadro). <b>Clic destro</b> su un territorio per muovere o attaccare.</li>
<li><b>Combattimento</b>: entrare in un territorio nemico occupato da truppe avvia una battaglia. Vince chi esaurisce prima l'organizzazione del nemico; serve circa il doppio della forza per sfondare. Montagne e foreste aiutano il difensore.</li>
<li><b>Accerchiamento</b>: le divisioni sconfitte senza ritirata sicura vengono distrutte.</li>
<li><b>Mare</b>: le divisioni possono attraversare il mare (lentamente) e sbarcare, con metà dell'attacco.</li>
<li><b>Economia</b>: le fabbriche civili costruiscono fabbriche, quelle militari producono equipaggiamento per nuove divisioni e rinforzi.</li>
<li><b>Capitolazione</b>: un paese si arrende quando perde gran parte del territorio (contano capitale ★ e città ■).</li>
<li><b>Storia</b>: gli eventi storici (Anschluss, Polonia 1939, Barbarossa…) accadono se non cambi tu il corso degli eventi.</li>
</ul>`;
