'use strict';

// Scheda Marina: flotte e missioni, convogli, cantieri navali e costruzioni, progetti (designer).

function anFleetWhere(f) {
  if (f.inPort) return `In porto a ${esc(regionById(regionOfTile(f.home)).name)}`;
  const r = esc(regionById(f.region).name);
  if (f.path.length) return `In navigazione (${r}) verso ${esc(regionById(f.path[f.path.length - 1]).name)}`;
  return `In mare: ${r}`;
}

function anAskFleetMission(f) {
  const ms = ['patrol', 'strike', 'escort', 'raid'];
  anChoose(`Missione: ${f.name}`, [
    ...ms.map(m => ({
      label: NAVAL_MISSIONS[m].name, sub: NAVAL_MISSIONS[m].desc,
      fn: () => anStartPick({
        layer: 'sea',
        hint: `${NAVAL_MISSIONS[m].name}: clicca una zona di mare raggiungibile`,
        invalidMsg: 'Serve una zona di mare raggiungibile dalla flotta.',
        valid: rid => regionById(rid).sea && seaPath(f.inPort ? portSeaRegion(f.home) : f.region, rid) !== null,
        done: rid => { AN.naval.setMission(f, m, rid); log(`${f.name}: ${NAVAL_MISSIONS[m].name} ${seaIn(rid)}.`); },
      }),
    })),
    { label: NAVAL_MISSIONS.idle.name, sub: NAVAL_MISSIONS.idle.desc, fn: () => AN.naval.setMission(f, 'idle') },
  ], 'Screening: una flotta ha bisogno di circa 3 navi di scorta (CT, CL) per ogni nave capitale o portaerei, altrimenti siluri e cannoni nemici arrivano alle navi più preziose.');
}

UI.registerPanel({
  id: 'marina', title: 'Marina', icon: 'navy', group: 'military', order: 15, width: 480,

  render(p) {
    const A = S.an, code = p.code;
    const fleets = A.fleets.filter(f => f.owner === code);
    const ships = fleets.reduce((a, f) => a + f.ships.length, 0);
    let h = '';
    if (ANUI.pick && ANUI.pick.layer === 'sea') h += `<div class="an-pick">${esc(ANUI.pick.hint)} <button data-act="anCancel">Annulla</button></div>`;
    h += `<h3>Marina</h3>
      <div class="stats"><div><b>${ships}</b><small>navi</small></div><div><b>${p.dock}</b><small>cantieri navali</small></div>
      <div><b class="${p.convoys < p.convoyNeed ? 'bad' : ''}">${Math.floor(p.convoys)}/${p.convoyNeed}</b><small>convogli</small></div></div>`;
    if (p.convoys < p.convoyNeed) h += `<p class="bad">Convogli insufficienti: −${Math.round(25 * (1 - p.convoys / Math.max(1, p.convoyNeed)))}% produzione e rifornimenti oltremare a rischio.</p>`;
    if (p.convoysLost >= 1) h += `<p class="an-hint">Convogli perduti in guerra: ${Math.floor(p.convoysLost)}.</p>`;
    if (p.ports.length) h += `<button data-act="anDock" ${typeof canBuild === 'function' && p.construction.length < 5 ? '' : 'disabled'}>+ Costruisci cantiere navale (${BUILD_COST.dock} punti)</button>`;
    else h += `<p class="an-hint">Senza porti la tua nazione non può avere una marina.</p>`;

    // battaglie in corso
    const myB = A.battles.filter(b => [...b.a, ...b.b].some(id => { const f = A.fleets.find(x => x.id === id); return f && allied(f.owner, code); }));
    if (myB.length) {
      h += `<h3>Battaglie navali</h3>`;
      for (const b of myB) {
        const side = b.a.some(id => { const f = A.fleets.find(x => x.id === id); return f && allied(f.owner, code); }) ? 'a' : 'b', foe = side === 'a' ? 'b' : 'a';
        const hpM = AN.naval.sideHp(b, side) / Math.max(1, b.hp0[side]), hpF = AN.naval.sideHp(b, foe) / Math.max(1, b.hp0[foe]);
        h += `<div class="card cur"><div class="row"><b>${esc(regionById(b.region).name)}</b><small>giorno ${b.day}</small></div>
          <div class="row3"><small>Noi</small>${anBar(hpM, 'org')}<small>Nemico</small>${anBar(hpF, 'bad')}</div>
          <p>Affondate: ${b.sunk[foe]} nemiche · perse ${b.sunk[side]}</p></div>`;
      }
    }

    // flotte
    h += `<h3>Flotte</h3>`;
    if (!fleets.length) h += `<p class="an-hint">Nessuna flotta. Le navi varate si radunano nel porto principale.</p>`;
    for (const f of fleets) {
      const hp = fleetHpFrac(f);
      const n = fleetCounts(f);
      const caps = (n.bb || 0) + (n.ca || 0) + (n.cv || 0), scr = (n.dd || 0) + (n.cl || 0);
      const screening = caps ? Math.min(1, scr / (3 * caps)) : 1;
      const tags = [];
      if (f.battle != null) tags.push(anTag('in battaglia', 'bad'));
      if (f.repairing) tags.push(anTag('riparazioni', 'warn'));
      if (caps && screening < 1) tags.push(anTag(`schermo ${Math.round(screening * 100)}%`, 'warn'));
      if (f.spotted != null && S.day - f.spotted <= 1 && !f.inPort) tags.push(anTag('avvistata', 'warn'));
      h += `<div class="card an-fleet"><div class="row"><b>${esc(f.name)}</b><small>${tags.join(' ')}</small></div>
        <p>${fleetSummary(f)}</p>
        <div class="row3"><small>Scafi</small>${anBar(hp, 'str')}<small>${Math.round(hp * 100)}%</small><span></span></div>
        <p>${anFleetWhere(f)} · <b>${NAVAL_MISSIONS[f.mission].name}</b>${f.goal != null && f.mission !== 'idle' ? ` (${esc(regionById(f.goal).name)})` : ''}</p>
        <div class="an-btns"><button class="an-sm" data-act="anFMission" data-arg="${f.id}" ${f.battle != null ? 'disabled' : ''}>Missione</button>
        <button class="an-sm" data-act="anFPort" data-arg="${f.id}" ${f.mission === 'idle' ? 'disabled' : ''}>In porto</button>
        <button class="an-sm" data-act="anFSplit" data-arg="${f.id}" ${f.ships.length > 1 && f.battle == null ? '' : 'disabled'}>Dividi</button>
        <button class="an-sm" data-act="anFMerge" data-arg="${f.id}" ${f.battle == null ? '' : 'disabled'}>Unisci qui</button>
        <button class="an-sm" data-act="anFShips" data-arg="${f.id}">Navi</button></div></div>`;
    }

    // flotte nemiche avvistate
    const seen = A.fleets.filter(f => atWar(f.owner, code) && !f.inPort && fleetVisible(f));
    if (seen.length) {
      h += `<h3>Flotte nemiche avvistate</h3>`;
      for (const f of seen) h += `<div class="qrow"><span>${flag(C(f.owner))} ${esc(C(f.owner).name)}</span><small>${esc(regionById(f.region).name)}</small><small>${fleetSummary(f)}</small></div>`;
    }

    // produzione navale
    const used = docksUsed(p);
    h += `<h3>Cantieri navali</h3>
      <p class="an-hint">Cantieri in uso: <b>${used}</b> su ${p.dock}. Ogni linea usa al massimo ${MAX_DOCKS_PER_LINE} cantieri; le navi non hanno efficienza produttiva.</p>`;
    for (const l of p.navLines) {
      const isC = l.design === 'convoy';
      const cost = isC ? CONVOY_COST : designOf(l.design).stats.cost;
      const perDay = l.docks * DOCKYARD_OUTPUT * anIndustryMult(p);
      h += `<div class="card"><div class="row"><b>${isC ? 'Convogli' : esc(designOf(l.design).name)}</b><small>${l.left} da varare${perDay ? ` · ${Math.ceil((cost - l.prog) / perDay)} g` : ''}</small></div>
        ${anBar(l.prog / cost)}
        <div class="an-btns"><span>Cantieri</span><button class="an-sm" data-act="anDocks" data-arg="${l.id}:-1">−</button><b class="an-num">${l.docks}</b>
        <button class="an-sm" data-act="anDocks" data-arg="${l.id}:1" ${used < p.dock && l.docks < MAX_DOCKS_PER_LINE ? '' : 'disabled'}>+</button>
        <span>Quantità</span><button class="an-sm" data-act="anCount" data-arg="${l.id}:-1">−</button><b class="an-num">${l.left}</b><button class="an-sm" data-act="anCount" data-arg="${l.id}:1">+</button>
        <button class="an-sm x" data-act="anNavDel" data-arg="${l.id}">✕</button></div></div>`;
    }
    h += `<button data-act="anNewNav" ${p.dock ? '' : 'disabled'}>+ Nuova costruzione navale</button>`;

    // progetti
    h += `<h3>Progetti navali</h3>`;
    for (const d of designsOf(code, 'naval')) {
      h += `<div class="qrow an-design"><span><b>${esc(d.name)}</b><br><small>${HULLS[d.type].name} ${TECH_YEARS[d.gen]} · ${anDesignLine(d)}</small></span><span></span><button class="an-sm" data-act="anNCopy" data-arg="${d.id}">Modifica</button></div>`;
    }
    h += `<button class="primary" data-act="anNDesigner">Progetta una nuova nave</button>`;
    return h;
  },

  actions: {
    anCancel() { anCancelPick(); },
    anDock() { if (queueBuild(C(S.player), 'dock')) log('Cantiere navale in costruzione.'); },
    anFMission(id) { const f = S.an.fleets.find(f => f.id === +id); if (f) anAskFleetMission(f); },
    anFPort(id) { const f = S.an.fleets.find(f => f.id === +id); if (f) AN.naval.setMission(f, 'idle'); },
    anFSplit(id) {
      const f = S.an.fleets.find(f => f.id === +id);
      if (!f) return;
      const n = fleetCounts(f);
      anChoose(`Dividi ${f.name}`, [
        { label: 'Separa i sottomarini', disabled: !n.ss || n.ss === f.ships.length, fn: () => AN.naval.split(f, 'subs') },
        { label: 'Separa le navi di scorta (CT, CL)', disabled: !(n.dd || n.cl) || (n.dd || 0) + (n.cl || 0) === f.ships.length, fn: () => AN.naval.split(f, 'screens') },
        { label: 'Dividi a metà', fn: () => AN.naval.split(f, 'half') },
      ]);
    },
    anFMerge(id) {
      const f = S.an.fleets.find(f => f.id === +id);
      if (!f) return;
      const n = AN.naval.mergeHere(f);
      log(n ? `${n} flotte unite a ${f.name}.` : 'Nessun\'altra flotta nello stesso porto o nella stessa zona.', n ? '' : 'warn');
    },
    anFShips(id) {
      const f = S.an.fleets.find(f => f.id === +id);
      if (!f) return;
      const rows = [...f.ships].sort((a, b) => HULL_ORDER.indexOf(designOf(a.design).type) - HULL_ORDER.indexOf(designOf(b.design).type)).map(s => {
        const st = shipStat(s);
        return `<tr><td>${esc(s.name)}</td><td>${HULLS[designOf(s.design).type].short}</td><td>${Math.round(s.hp)}/${st.hp}</td><td>${anDesignLine(designOf(s.design))}</td></tr>`;
      }).join('');
      anModal(f.name, `<table class="an-tbl"><tr><th>Nave</th><th></th><th>Scafo</th><th>Caratteristiche</th></tr>${rows}</table>`);
    },
    anDocks(arg) {
      const [id, dv] = arg.split(':').map(Number), p = C(S.player);
      const l = p.navLines.find(l => l.id === id);
      if (!l) return;
      const free = p.dock - docksUsed(p);
      l.docks = Math.max(0, Math.min(MAX_DOCKS_PER_LINE, l.docks + Math.min(dv, free)));
    },
    anCount(arg) {
      const [id, dv] = arg.split(':').map(Number), p = C(S.player);
      const l = p.navLines.find(l => l.id === id);
      if (l) l.left = Math.max(1, l.left + dv);
    },
    anNavDel(id) { const p = C(S.player); p.navLines = p.navLines.filter(l => l.id !== +id); },
    anNewNav() {
      const p = C(S.player);
      const docks = () => Math.min(MAX_DOCKS_PER_LINE, p.dock - docksUsed(p));
      anChoose('Nuova costruzione navale', [
        { label: 'Convogli', sub: `Navi mercantili per commercio e trasporto truppe · costo ${CONVOY_COST}`, fn: () => addNavLine(p, 'convoy', docks(), 10) },
        ...designsOf(S.player, 'naval').map(d => ({ label: d.name, sub: `${HULLS[d.type].name} · ${anDesignLine(d)}`, fn: () => addNavLine(p, d.id, docks(), 1) })),
      ]);
    },
    anNDesigner() { anOpenDesigner('naval'); },
    anNCopy(id) { anOpenDesigner('naval', designOf(id)); },
  },
});
