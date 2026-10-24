'use strict';

// Pannello Diplomazia: tensione mondiale, relazioni, obiettivi di guerra, fazioni, lend-lease, sudditi.
// Usa l'API dei pannelli della shell HOI4 (UI.registerPanel / registerSection / registerTopStat).
// Se la shell nuova non c'è ancora, la piccola compatibilità qui sotto la simula sul vecchio ui.js.

if (!UI.registerPanel) {
  const panels = {}, sections = {}, tops = [], orig = {};
  const compose = id => {
    if (!(id in orig)) orig[id] = UI['panel_' + id];
    UI['panel_' + id] = function () {
      const p = C(S.player), secs = sections[id] || [];
      const base = panels[id] ? panels[id].render(p) : orig[id] ? orig[id].call(UI) : '';
      return secs.filter(s => s.order < 50).map(s => s.render(p)).join('') + base + secs.filter(s => s.order >= 50).map(s => s.render(p)).join('');
    };
  };
  const addTab = def => {
    const nav = document.getElementById('tabs');
    if (!nav || nav.querySelector(`[data-tab="${def.id}"]`)) return;
    const b = document.createElement('button');
    b.dataset.tab = def.id; b.textContent = def.title;
    nav.appendChild(b);
  };
  UI.registerPanel = def => { panels[def.id] = def; compose(def.id); addTab(def); };
  UI.registerSection = (tab, sec) => {
    (sections[tab] || (sections[tab] = [])).push(Object.assign({ order: 50 }, sec));
    sections[tab].sort((a, b) => a.order - b.order);
    compose(tab);
  };
  UI.registerTopStat = def => { tops.push(def); tops.sort((a, b) => (a.order || 0) - (b.order || 0)); };
  UI.open = tab => UI.setTab(tab);
  UI.notify = (text, o = {}) => log(text, o.kind === 'bad' ? 'bad' : o.kind === 'warn' ? 'warn' : '');
  const renderTop = UI.renderTop, act = UI.act;
  UI.renderTop = function () {
    renderTop.call(this);
    const p = C(S.player);
    document.getElementById('tb-res').insertAdjacentHTML('beforeend',
      tops.map(t => `<span class="res" title="${esc(t.tip ? t.tip(p).replace(/<[^>]+>/g, '') : '')}">${t.icon && t.icon.length < 4 ? t.icon + ' ' : ''}${t.value(p)}</span>`).join(''));
  };
  UI.act = function (name, arg) {
    for (const d of [panels[this.tab], ...(sections[this.tab] || [])]) {
      if (d && d.actions && d.actions[name]) { d.actions[name](arg); this.dirty = true; this.lastPanel = ''; return; }
    }
    return act.call(this, name, arg);
  };
}

const DP = {
  do(r) { playerDo(r); UI.dirty = true; },
  sel() {
    const k = UI.selCountry;
    return k && S.countries[k] && C(k).alive && k !== S.player ? k : null;
  },
  btn(act, label, r, cls = '', arg = '') {
    const ok = r === true || (r && r.ok);
    const tip = r && r.msg ? ` title="${esc(r.msg)}"` : '';
    return `<button class="${cls}" data-act="${act}" data-arg="${esc(arg)}"${ok ? '' : ' disabled'}${tip}>${label}</button>`;
  },
  opinionTag(v) { return `<span class="${v >= 25 ? 'good' : v <= -25 ? 'bad' : ''}">${v > 0 ? '+' : ''}${v}</span>`; },
};

UI.registerTopStat({
  id: 'tensione', order: 5, icon: '🌍',
  value: () => `${Math.floor(S.tension)}%`,
  tip: p => `Tensione mondiale. La tua ideologia (${IDEOLOGIES[p.ideology].name}) può giustificare guerre sopra il ${TENSION_REQ.justify[p.ideology]}%.`,
});

UI.registerPanel({
  id: 'diplomazia', title: 'Diplomazia', icon: 'diplomacy', group: 'state', order: 80, width: 480,
  render(p) {
    const pc = S.player;
    const pp = Math.floor(p.pp);
    let h = `<h3>Tensione mondiale</h3>${bar(S.tension / 100, S.tension >= 50 ? 'bad' : '')}
      <p class="hint">${Math.floor(S.tension)}%. ${IDEOLOGIES[p.ideology].name}: giustificare guerre ≥ ${TENSION_REQ.justify[p.ideology]}%, fazioni ≥ ${TENSION_REQ.faction[p.ideology]}%, lend-lease ≥ ${TENSION_REQ.lendLease[p.ideology]}%.</p>`;

    const sk = DP.sel();
    if (sk) {
      const sc = C(sk), f = sc.faction && S.factions[sc.faction];
      const war = atWar(pc, sk);
      const status = war ? '<span class="bad">In guerra</span>' : allied(pc, sk) ? '<span class="good">Alleato</span>' : sc.capitulated ? 'Capitolato' : 'Neutrale';
      const nd = S.divs.filter(d => d.owner === sk && !d.dead).length;
      const guar = S.guarantees.filter(g => g.to === sk).map(g => C(g.by).name);
      h += `<h3>${flag(sc)} ${esc(sc.name)}</h3>
        <div class="stats"><div><b>${sc.civ}/${sc.mil}</b><small>fabbriche</small></div><div><b>${nd}</b><small>divisioni</small></div><div><b>${sc.tiles}</b><small>territori</small></div></div>
        <p>${IDEOLOGIES[sc.ideology].name} · ${status}<br>
        Opinione di ${esc(sc.name)} su di te: ${DP.opinionTag(Diplo.opinion(sk, pc))} · tua: ${DP.opinionTag(Diplo.opinion(pc, sk))}<br>
        Fazione: ${f ? esc(f.name) : 'nessuna'}${guar.length ? `<br>Garantito da: ${esc(guar.join(', '))}` : ''}
        ${sc.overlord ? `<br>Suddito di ${esc(C(sc.overlord).name)}: ${AUTONOMY_LEVELS[sc.autonomy.level].name}, autonomia ${Math.round(sc.autonomy.score)}%` : ''}
        ${enemiesOf(sk).length ? `<br>In guerra con: ${esc(enemiesOf(sk).map(e => C(e).name).join(', '))} · resa ${Math.round(Diplo.surrenderProgress(sk) * 100)}%` : ''}
        ${Diplo.hasNap(pc, sk) ? '<br>Patto di non aggressione in vigore' : ''}</p>`;

      h += DP.btn('improve', `Migliora relazioni (⭐${DIPLO_COST.improve})`, { ok: !war && pp >= DIPLO_COST.improve && Diplo.rel(sk, pc) < 60 });

      // obiettivi di guerra
      const wg = Diplo.wargoal(pc, sk, false);
      if (wg && !wg.ready) {
        h += `<div class="card"><div class="row"><b>Obiettivo: ${WARGOAL_TYPES[wg.type].name}</b><small>${Math.ceil(wg.days)} g</small></div>${bar(1 - wg.days / wg.total)}
          <button data-act="cancelWg">Annulla giustificazione</button></div>`;
      } else if (wg && wg.ready) {
        h += `<div class="card cur"><b>Obiettivo pronto: ${WARGOAL_TYPES[wg.type].name}</b><p>Scade il ${dateLabel(wg.expires)}.</p></div>`;
      } else if (!war && !allied(pc, sk)) {
        const jc = DIPLO_COST.justify + (sc.major ? DIPLO_COST.justifyMajor : 0);
        const r = Diplo.check(pc, sk) || (p.overlord ? 'Un suddito non può giustificare obiettivi di guerra.' : null) ||
          (Diplo.hasNap(pc, sk) ? 'Patto di non aggressione in vigore.' : null) ||
          (!Diplo.tensionOk(pc, 'justify') ? `Serve tensione mondiale ≥ ${TENSION_REQ.justify[p.ideology]}%.` : null) ||
          (pp < jc ? `Servono ${jc} di potere politico.` : null);
        const rr = r ? { ok: false, msg: r } : { ok: true };
        h += `<div class="row2">${DP.btn('justify', `Giustifica conquista (⭐${jc})`, rr, '', 'conquest')}${DP.btn('justify', `Giustifica sottomissione (⭐${jc})`, rr, '', 'puppet')}</div>`;
        if (r) h += `<p class="hint">${esc(r)}</p>`;
      }
      if (!war && !allied(pc, sk)) {
        const r = Diplo.canDeclareWar(pc, sk);
        h += DP.btn('war', 'Dichiara guerra', r, 'danger');
        if (!r.ok) h += `<p class="hint">${esc(r.msg)}</p>`;
        else if (guar.length || f) h += `<p class="hint">Entreranno in guerra anche: ${esc([...new Set([...guar, ...(f ? f.members.filter(m => m !== sk).map(m => C(m).name) : [])])].join(', ') || 'nessuno')}.</p>`;
      }
      if (war) {
        h += DP.btn('whitePeace', `Proponi pace bianca (⭐${DIPLO_COST.whitePeace})`, { ok: pp >= DIPLO_COST.whitePeace });
        if (sc.capitulated) h += DP.btn('collab', `Governo collaborazionista (⭐${DIPLO_COST.collab})`, { ok: Occupation.avgCompliance(pc, sk) >= 40 && Intel.network(pc, sk) >= 25, msg: `Conformità ${Math.round(Occupation.avgCompliance(pc, sk))}% (serve 40), rete ${Math.round(Intel.network(pc, sk))}% (serve 25)` });
      } else {
        const guaranteed = S.guarantees.some(g => g.by === pc && g.to === sk);
        h += DP.btn('guarantee', `Garantisci indipendenza (⭐${DIPLO_COST.guarantee})`, { ok: !guaranteed && !p.overlord && Diplo.tensionOk(pc, 'guarantee') && pp >= DIPLO_COST.guarantee });
        h += Diplo.hasNap(pc, sk) ? DP.btn('breakNap', 'Rompi patto di non aggressione', true, 'danger')
          : DP.btn('nap', `Patto di non aggressione (⭐${DIPLO_COST.nap})`, { ok: pp >= DIPLO_COST.nap });
        if (!sc.major && !allied(pc, sk)) h += DP.btn('demand', `Pretesa di annessione (⭐${DIPLO_COST.demand})`, { ok: pp >= DIPLO_COST.demand && Diplo.tensionOk(pc, 'justify') && !p.overlord, msg: 'Accetta solo se isolato e tu sei 3 volte più forte' });
        if (p.faction && !sc.faction && !sc.overlord) h += DP.btn('invite', `Invita nella fazione (⭐${DIPLO_COST.faction})`, { ok: pp >= DIPLO_COST.faction, msg: `Valutazione: ${Diplo.factionScore(sk, pc)} (serve 30)` });
        if (!p.faction && f) h += DP.btn('askJoin', `Chiedi di entrare in ${esc(f.name)} (⭐${DIPLO_COST.faction})`, { ok: pp >= DIPLO_COST.faction });
        const ll = S.lendLease.find(l => l.from === pc && l.to === sk);
        const llErr = Diplo.lendLeaseCheck(pc, sk);
        h += `<h4>Lend-lease</h4><div class="row2">${DP.btn('ll', 'Invia 500 🔫', { ok: !llErr && p.equipment >= 500, msg: llErr }, '', 500)}${DP.btn('ll', 'Invia 2000 🔫', { ok: !llErr && p.equipment >= 2000, msg: llErr }, '', 2000)}</div>
          <div class="row2">${ll ? DP.btn('llDaily', `Sospendi invio (${ll.perDay}/g)`, true, '', 0) : DP.btn('llDaily', 'Invio continuo 10/g', { ok: !llErr, msg: llErr }, '', 10)}${DP.btn('reqLL', 'Chiedi 1000 🔫', { ok: !Diplo.lendLeaseCheck(sk, pc) })}</div>`;
      }
      if (sc.overlord === pc) {
        h += `<h4>Suddito</h4><div class="row2">${DP.btn('reduceAut', `Riduci autonomia (⭐${DIPLO_COST.reduceAutonomy})`, { ok: pp >= DIPLO_COST.reduceAutonomy })}${DP.btn('integrate', `Annetti (⭐${DIPLO_COST.integrate})`, { ok: sc.autonomy.level === 0 && sc.autonomy.score <= 50 && pp >= DIPLO_COST.integrate, msg: 'Solo fantocci integrati con autonomia ≤ 50%' })}</div>${DP.btn('release', 'Concedi indipendenza', true)}`;
      }
      h += `<button data-act="center" data-arg="${sc.capital}">Mostra capitale</button>`;
    } else {
      h += `<p class="hint">Clicca un paese sulla mappa per relazioni, obiettivi di guerra, patti e lend-lease.</p>`;
    }

    h += `<h3>La tua nazione</h3><p>${IDEOLOGIES[p.ideology].name} · fazione: ${p.faction ? esc(S.factions[p.faction].name) : 'nessuna'}
      ${p.overlord ? `<br>Suddito di ${esc(C(p.overlord).name)} (${AUTONOMY_LEVELS[p.autonomy.level].name}, autonomia ${Math.round(p.autonomy.score)}%)` : ''}</p>`;
    if (!p.faction) h += DP.btn('createFaction', `Fonda una fazione (⭐${DIPLO_COST.create})`, { ok: pp >= DIPLO_COST.create && Diplo.tensionOk(S.player, 'faction') && !p.overlord, msg: `Serve tensione ≥ ${TENSION_REQ.faction[p.ideology]}%` });
    else h += DP.btn('leaveFaction', 'Lascia la fazione', { ok: !enemiesOf(pc).length });

    const wgs = S.wargoals.filter(w => w.by === pc || w.vs === pc);
    if (wgs.length) {
      h += `<h4>Obiettivi di guerra</h4>`;
      for (const w of wgs) h += `<div class="qrow"><span>${esc(C(w.by).name)} → ${esc(C(w.vs).name)}</span>${bar(w.ready ? 1 : 1 - w.days / w.total, w.vs === pc ? 'bad' : '')}<small>${w.ready ? 'pronto' : Math.ceil(w.days) + ' g'}</small></div>`;
    }
    const subs = Diplo.subjectsOf(pc);
    if (subs.length) {
      h += `<h4>Sudditi</h4>`;
      for (const s of subs) h += `<div class="qrow"><span>${flag(C(s))} ${esc(C(s).name)}</span>${bar(C(s).autonomy.score / 100)}<small>${AUTONOMY_LEVELS[C(s).autonomy.level].name}</small></div>`;
    }
    const lls = S.lendLease.filter(l => l.from === pc || l.to === pc);
    if (lls.length) h += `<h4>Lend-lease attivi</h4><p class="done">${lls.map(l => `${esc(C(l.from).name)} → ${esc(C(l.to).name)}: ${l.perDay}/g`).join('<br>')}</p>`;
    h += `<h3>Fazioni</h3>`;
    for (const id in S.factions) {
      const f = S.factions[id];
      h += `<div class="card"><b>${esc(f.name)}</b><p>${f.members.map(m => `${flag(C(m))} ${esc(C(m).name)}${Diplo.subjectsOf(m).length ? ` <small>(+ ${Diplo.subjectsOf(m).map(s => esc(C(s).name)).join(', ')})</small>` : ''}`).join('<br>')}</p></div>`;
    }
    const wars = [...S.wars].map(k => `${esc(C(k[0]).name)} ⚔ ${esc(C(k[1]).name)}`);
    h += `<h3>Guerre in corso</h3><p class="done">${wars.length ? wars.join('<br>') : 'Nessuna'}</p>`;
    return h;
  },
  actions: {
    improve() { DP.do(Diplo.improveRelations(S.player, DP.sel())); },
    justify(type) { DP.do(Diplo.justifyWargoal(S.player, DP.sel(), type)); },
    cancelWg() { DP.do(Diplo.cancelWargoal(S.player, DP.sel())); },
    war() {
      const t = DP.sel();
      UI.ask('Dichiarazione di guerra', `Sei sicuro di voler dichiarare guerra a ${C(t).name}?`,
        [{ label: 'Guerra!', fn: () => DP.do(Diplo.declareWar(S.player, t)) }, { label: 'Annulla' }]);
    },
    whitePeace() { DP.do(Diplo.proposeWhitePeace(S.player, DP.sel())); },
    collab() { DP.do(Diplo.collabGovernment(S.player, DP.sel())); },
    guarantee() { DP.do(Diplo.guarantee(S.player, DP.sel())); },
    nap() { DP.do(Diplo.signNap(S.player, DP.sel())); },
    breakNap() {
      const t = DP.sel();
      UI.ask('Rompere il patto?', `Tutti i paesi si fideranno meno di te e ${C(t).name} ti odierà.`, [{ label: 'Rompi il patto', fn: () => DP.do(Diplo.breakNap(S.player, t)) }, { label: 'Annulla' }]);
    },
    demand() { DP.do(Diplo.demandAnnexation(S.player, DP.sel())); },
    invite() { DP.do(Diplo.inviteToFaction(S.player, DP.sel())); },
    askJoin() { DP.do(Diplo.askToJoinFaction(S.player, DP.sel())); },
    ll(n) { DP.do(Diplo.lendLease(S.player, DP.sel(), +n)); },
    llDaily(n) { DP.do(Diplo.setLendLease(S.player, DP.sel(), +n)); },
    reqLL() { DP.do(Diplo.requestLendLease(S.player, DP.sel(), 1000)); },
    reduceAut() { DP.do(Diplo.reduceAutonomy(S.player, DP.sel())); },
    integrate() { DP.do(Diplo.integrateSubject(S.player, DP.sel())); },
    release() { DP.do(Diplo.releaseSubject(S.player, DP.sel())); },
    createFaction() { DP.do(Diplo.createFaction(S.player)); },
    leaveFaction() { DP.do(Diplo.leaveFaction(S.player)); },
    center(ti) { Render.centerOn(+ti, 2); },
  },
});

// tooltip della mappa: resistenza e conformità dei territori occupati
if (typeof UI.tileTip === 'function') {
  const tileTip = UI.tileTip;
  UI.tileTip = function (ti) {
    let h = tileTip.call(this, ti);
    const o = Occupation.tileInfo(ti);
    if (o) h += `<br>Nucleo di ${esc(C(o.core).name)} · resistenza <span class="${o.res > 50 ? 'bad' : ''}">${Math.round(o.res)}%</span> · conformità ${Math.round(o.comp)}%`;
    return h;
  };
}
