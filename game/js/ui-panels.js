'use strict';

// Pannelli base della shell. Ogni sistema può sostituirli con UI.registerPanel({ id: ... })
// o arricchirli con UI.registerSection(id, ...) da un proprio file in js/panels/.

const emptyState = (ico, text) => `<div class="empty">${icon(ico, 28)}${text}</div>`;
const UT_ICON = { inf: 'division', arm: 'tank' };

// ============================== POLITICA ==============================
UI.registerPanel({
  id: 'politica', title: 'Politica', icon: 'politics', group: 'state', order: 10, key: 'Q', width: 460,
  render(p) {
    const ideo = IDEOLOGY[ideologyOf(p)], fac = p.faction && S.factions[p.faction];
    let h = `<div class="hero">
      <div class="portrait">${icon('leader', 64)}</div>
      <div class="info">
        <h2>${esc(p.name)}</h2>
        <div>${p.leader ? `<b>${esc(p.leader)}</b><br>` : ''}<span class="tag" style="color:${ideo.color};border-color:${ideo.color}">${ideo.name}</span>
          ${fac ? `<span class="tag gold">${esc(fac.name)}</span>` : ''} ${p.major ? '<span class="tag">Grande potenza</span>' : ''}</div>
        <div class="row"><span>${icon('pp')} Potere politico</span><b>${Math.floor(p.pp)} <small class="good">+${p.ppGain.toFixed(2)}/g</small></b></div>
        <div class="row"><span>${icon('manpower')} Manodopera</span><b>${fmt(p.manpower)}</b></div>
      </div></div>`;
    if (p.stability != null || p.warSupport != null) {
      h += `<div class="row" style="justify-content:space-around">${p.stability != null ? meter(p.stability, 'Stabilità') : ''}${p.warSupport != null ? meter(p.warSupport, 'Supporto guerra', 'var(--red)') : ''}</div>`;
    }
    h += `<h3>${icon('focus')} Focus nazionale<span class="r"><a></a></span></h3>${focusCard(p)}
      <button class="wide" data-act="open" data-arg="focus">Apri l'albero dei focus</button>`;
    const spirits = p.spirits || [...(p.done || [])].map(id => typeof FOCUS_BY_ID !== 'undefined' && FOCUS_BY_ID[id]).filter(Boolean).map(f => ({ name: f.name, desc: f.desc, icon: 'politics' }));
    h += `<h3>${icon('stability')} Spiriti nazionali</h3>`;
    h += spirits.length ? `<div class="spirits">${spirits.map(s => `<span class="spirit" title="${esc(s.name)}: ${esc(s.desc || '')}">${s.ic ? s.ic : icon(s.icon || 'politics', 22)}</span>`).join('')}</div>`
      : `<p class="hint">Nessuno spirito nazionale attivo.</p>`;
    if (p.laws) {
      h += `<h3>${icon('log')} Leggi</h3><table class="tbl">${Object.entries(p.laws).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${esc(v)}</td></tr>`).join('')}</table>`;
    }
    h += `<h3>${icon('leader')} Governo e consiglieri</h3><div class="advisors">${['Ministro', 'Teorico', 'Capo di Stato Maggiore', 'Industria'].map(a => {
      const adv = p.advisors && p.advisors[a];
      return `<div class="advisor">${adv ? esc(adv) : a}</div>`;
    }).join('')}</div>`;
    return h;
  },
});

function focusCard(p) {
  if (!p.focus) return `<div class="card"><p>Nessun focus in corso. Ogni giorno senza focus è un giorno perso.</p></div>`;
  const tree = typeof focusTree === 'function' ? focusTree(p) : null;
  const f = tree ? tree.byId[p.focus] : FOCUS_BY_ID[p.focus];
  const total = p.focusTotal || (f && f.days) || 1;
  return `<div class="slot"><span class="sico">${f && f.ic ? f.ic : icon('focus', 22)}</span><span class="grow"><b>${esc(f ? f.name : p.focus)}</b>
    ${bar(1 - p.focusDays / total, 'eff')}<small class="muted">${p.focusDays} giorni rimanenti</small></span></div>`;
}

// ============================== FOCUS ==============================
// Albero grafico costruito da FOCUSES (id, name, desc, days, req, opzionali x/y/ic).
UI.registerPanel({
  id: 'focus', title: 'Albero dei focus', icon: 'focus', group: 'state', order: 15, key: 'F', width: 'full',
  badge: p => p.focus ? null : '!',
  render(p) {
    if (typeof FOCUSES === 'undefined') return emptyState('focus', 'Nessun albero dei focus disponibile.');
    const pos = layoutFocus(FOCUSES), NW = 150, NH = 104;
    const W = (Math.max(...Object.values(pos).map(q => q.x)) + 1) * NW, H = (Math.max(...Object.values(pos).map(q => q.y)) + 1) * NH;
    let links = '';
    for (const f of FOCUSES) for (const r of f.req || []) {
      const a = pos[r], b = pos[f.id];
      const x1 = a.x * NW + NW / 2, y1 = a.y * NH + 56, x2 = b.x * NW + NW / 2, y2 = b.y * NH + 4, my = (y1 + y2) / 2;
      const done = p.done.has(r);
      links += `<path d="M${x1} ${y1} V${my} H${x2} V${y2}" fill="none" stroke="${done ? '#c9a55a' : '#4a4532'}" stroke-width="3"/>`;
    }
    const nodes = FOCUSES.map(f => {
      const st = p.done.has(f.id) ? 'done' : p.focus === f.id ? 'current' : focusAvailable(p, f) && !p.focus ? 'available' : 'blocked';
      const q = pos[f.id];
      const prog = st === 'current' ? 1 - p.focusDays / f.days : st === 'done' ? 1 : 0;
      return `<button class="fnode ${st}" style="left:${q.x * NW + (NW - 132) / 2}px;top:${q.y * NH}px" data-act="focus" data-arg="${f.id}" ${st === 'available' ? '' : 'disabled'}
        title="${esc(f.name)} (${f.days} giorni): ${esc(f.desc)}${f.req ? ` · Richiede ${esc(f.req.map(r => FOCUS_BY_ID[r].name).join(', '))}` : ''}">
        <span class="fi">${f.ic || icon(st === 'done' ? 'check' : 'focus', 28)}</span><span class="fl">${esc(f.name)}</span><span class="fb"><i style="width:${pct(prog)}"></i></span></button>`;
    }).join('');
    return `${focusCard(p)}<div class="ftree" style="width:${W}px;height:${H}px"><svg class="links" width="${W}" height="${H}">${links}</svg>${nodes}</div>`;
  },
  actions: { focus: id => startFocus(C(S.player), id) },
});

function layoutFocus(list) {
  const pos = {}, byId = Object.fromEntries(list.map(f => [f.id, f]));
  const depth = f => f.req && f.req.length ? 1 + Math.max(...f.req.map(r => depth(byId[r]))) : 0;
  const used = {};
  let col = 0;
  for (const f of list) {
    if (f.x != null) { pos[f.id] = { x: f.x, y: f.y }; continue; }
    const y = depth(f);
    let x = f.req && f.req.length ? f.req.reduce((s, r) => s + pos[r].x, 0) / f.req.length : col++;
    x = Math.round(x * 2) / 2;
    while ((used[y] || []).some(u => Math.abs(u - x) < 1)) x += 1;
    (used[y] = used[y] || []).push(x);
    if (!f.req || !f.req.length) col = Math.max(col, x + 1);
    pos[f.id] = { x, y };
  }
  return pos;
}

// ============================== RICERCA ==============================
UI.registerPanel({
  id: 'ricerca', title: 'Ricerca', icon: 'research', group: 'state', order: 20, key: 'W', width: 520,
  render(p) {
    const slots = p.researchSlots || 2;
    let h = `<h3>${icon('research')} Slot di ricerca<span class="r">${slots} slot</span></h3>`;
    for (let i = 0; i < slots; i++) h += `<div class="slot free">${icon('plus')} Slot libero</div>`;
    h += `<h3>${icon('lock')} Rami tecnologici</h3><div class="grid3">${[
      ['division', 'Fanteria'], ['supply', 'Supporto'], ['tank', 'Corazzati'], ['target', 'Artiglieria'], ['navy', 'Navale'], ['air', 'Aereo'],
      ['factory', 'Industria'], ['radar', 'Elettronica'], ['army', 'Dottrine'],
    ].map(([ic, n]) => `<div class="stat">${icon(ic, 22)}<small style="display:block">${n}</small></div>`).join('')}</div>`;
    h += `<div class="card ${p.armorTech ? 'cur' : 'dim'}"><div class="row"><b>${icon('tank')} Carri armati</b><span class="tag ${p.armorTech ? 'good' : ''}">${p.armorTech ? 'Ricercata' : 'Bloccata'}</span></div>
      <p>Sblocca le divisioni corazzate.${p.armorTech ? '' : ' Si ottiene con il focus “Ricerca corazzata”.'}</p></div>`;
    return h;
  },
  badge: p => p.researchSlots ? null : null,
});

// ============================== PRODUZIONE ==============================
UI.registerPanel({
  id: 'produzione', title: 'Produzione', icon: 'production', group: 'state', order: 60, key: 'Y', width: 500,
  render(p) {
    const eqDay = p.mil * 3 * (1 + p.eqBonus);
    let h = `<div class="stats"><div class="stat">${icon('milfactory', 18)}<b>${p.mil}</b><small>fabbriche militari</small></div>
      <div class="stat">${icon('equipment', 18)}<b>${fmt(p.equipment)}</b><small>in magazzino</small></div>
      <div class="stat">${icon('production', 18)}<b>+${Math.round(eqDay)}</b><small>al giorno</small></div></div>`;
    h += `<h3>${icon('production')} Linee di produzione</h3>`;
    const lines = p.lines || [{ name: 'Equipaggiamento militare', factories: p.mil, eff: 1, output: eqDay }];
    for (const l of lines) {
      h += `<div class="slot"><span class="sico">${icon('equipment', 22)}</span><span class="grow">
        <div class="row"><b>${esc(l.name)}</b><small>${l.factories} fabbriche</small></div>
        ${bar(l.eff, 'eff')}<div class="row"><small>Efficienza ${pct(l.eff)}</small><small>+${Math.round(l.output)}/g</small></div></span></div>`;
    }
    h += `<p class="hint">Le fabbriche militari producono equipaggiamento usato per reclutare nuove divisioni e rinforzare quelle al fronte.</p>`;
    return h;
  },
});

// ============================== COSTRUZIONE ==============================
const BUILDINGS = [
  { id: 'civ', name: 'Fabbrica civile', icon: 'factory', desc: 'Costruisce edifici e paga i beni di consumo.' },
  { id: 'mil', name: 'Fabbrica militare', icon: 'milfactory', desc: 'Produce equipaggiamento.' },
];
UI.registerPanel({
  id: 'costruzione', title: 'Costruzione', icon: 'construction', group: 'state', order: 50, key: 'T', width: 480,
  badge: p => (!p.construction.length && canBuild(p)) ? '!' : null,
  render(p) {
    const speed = Math.max(1, p.civ) * 0.15, full = !canBuild(p) || p.construction.length >= 5;
    let h = `<div class="stats"><div class="stat">${icon('factory', 18)}<b>${p.civ}</b><small>civili</small></div>
      <div class="stat">${icon('milfactory', 18)}<b>${p.mil}</b><small>militari</small></div>
      <div class="stat">${icon('construction', 18)}<b>${p.civ + p.mil + p.construction.length}/${factoryCap(p)}</b><small>slot edifici</small></div></div>`;
    h += `<h3>${icon('construction')} Edifici</h3>`;
    for (const b of BUILDINGS) {
      h += `<div class="slot"><span class="sico">${icon(b.icon, 22)}</span><span class="grow"><b>${b.name}</b><br><small class="muted">${b.desc} Costo ${BUILD_COST[b.id]}</small></span>
        <button class="primary" data-act="build" data-arg="${b.id}" ${full ? 'disabled' : ''}>${icon('plus', 14)} Costruisci</button></div>`;
    }
    h += `<h3>${icon('clock')} Cantieri<span class="r">${speed.toFixed(1)} punti/giorno sul primo</span></h3>`;
    if (!p.construction.length) h += emptyState('construction', 'Nessun cantiere aperto.');
    p.construction.forEach((j, i) => {
      const b = BUILDINGS.find(b => b.id === j.type);
      const days = Math.ceil((j.cost - j.prog) / speed);
      h += `<div class="slot"><span class="sico">${icon(b ? b.icon : 'construction', 20)}</span><span class="grow">
        <div class="row"><b>${b ? b.name : j.type}</b><small>${i === 0 ? `~${days} giorni` : 'in coda'}</small></div>${bar(j.prog / j.cost)}</span>
        <button class="ghost" data-act="cancelBuild" data-arg="${i}" title="Annulla">${icon('close', 14)}</button></div>`;
    });
    return h;
  },
  actions: {
    build: type => queueBuild(C(S.player), type),
    cancelBuild: i => C(S.player).construction.splice(+i, 1),
  },
});

// ============================== COMMERCIO ==============================
const RESOURCES = [
  ['steel', 'Acciaio'], ['aluminium', 'Alluminio'], ['rubber', 'Gomma'], ['tungsten', 'Tungsteno'], ['chromium', 'Cromo'], ['oil', 'Petrolio'],
];
UI.registerPanel({
  id: 'commercio', title: 'Commercio', icon: 'trade', group: 'state', order: 40, key: 'R', width: 500,
  render(p) {
    let h = `<h3>${icon('trade')} Risorse strategiche</h3>`;
    if (p.resources) {
      h += `<table class="tbl"><tr><th>Risorsa</th><th class="n">Prod.</th><th class="n">Import</th><th class="n">Export</th><th class="n">Uso</th></tr>${RESOURCES.map(([k, n]) => {
        const r = p.resources[k] || {};
        const bal = (r.prod || 0) + (r.imp || 0) - (r.exp || 0) - (r.used || 0);
        return `<tr><td>${icon(k)} ${n}</td><td class="n">${r.prod || 0}</td><td class="n">${r.imp || 0}</td><td class="n">${r.exp || 0}</td><td class="n ${bal < 0 ? 'bad' : ''}">${r.used || 0}</td></tr>`;
      }).join('')}</table>`;
    } else {
      h += `<div class="grid3">${RESOURCES.map(([k, n]) => `<div class="stat">${icon(k, 20)}<b>—</b><small>${n}</small></div>`).join('')}</div>
        <p class="hint">Le risorse e gli scambi arrivano con il nuovo sistema economico.</p>`;
    }
    h += `<h3>${icon('log')} Legge commerciale</h3>`;
    h += p.tradeLaw ? `<div class="card cur"><b>${esc(p.tradeLaw.name || p.tradeLaw)}</b>${p.tradeLaw.desc ? `<p>${esc(p.tradeLaw.desc)}</p>` : ''}</div>`
      : `<div class="card"><b>Esportazioni limitate</b><p>Legge predefinita.</p></div>`;
    return h;
  },
});

// ============================== LOGISTICA ==============================
UI.registerPanel({
  id: 'logistica', title: 'Logistica', icon: 'logistics', group: 'state', order: 70, key: 'I', width: 480,
  render(p) {
    const mine = S.divs.filter(d => d.owner === p.code && !d.dead);
    const need = mine.reduce((s, d) => s + (1 - d.str) * UNIT_TYPES[d.type].eq, 0);
    const mpNeed = mine.reduce((s, d) => s + (1 - d.str) * UNIT_TYPES[d.type].mp, 0);
    let h = `<div class="stats"><div class="stat">${icon('equipment', 18)}<b>${fmt(p.equipment)}</b><small>equipaggiamento</small></div>
      <div class="stat">${icon('supply', 18)}<b class="${need > p.equipment ? 'bad' : ''}">${fmt(need)}</b><small>mancante al fronte</small></div>
      <div class="stat">${icon('manpower', 18)}<b>${fmt(mpNeed)}</b><small>rimpiazzi</small></div></div>`;
    const ratio = need ? Math.min(1, p.equipment / need) : 1;
    h += `<h3>${icon('supply')} Stato dei rifornimenti</h3>${bar(ratio, ratio < 0.5 ? 'bad' : 'eff')}
      <p class="hint">${ratio >= 1 ? 'Il magazzino copre tutte le perdite al fronte.' : 'Il magazzino non basta a rinforzare tutte le divisioni.'}</p>`;
    h += `<h3>${icon('rail')} Centri di rifornimento e ferrovie</h3>`;
    h += p.hubs ? p.hubs.map(hb => `<div class="card"><b>${esc(hb.name)}</b>${bar(hb.load)}</div>`).join('')
      : emptyState('rail', 'Hub, ferrovie e camion arrivano con il nuovo sistema logistico.');
    return h;
  },
});

// ============================== DIPLOMAZIA ==============================
UI.registerPanel({
  id: 'diplomazia', title: 'Diplomazia', icon: 'diplomacy', group: 'state', order: 30, key: 'E', width: 480,
  render(p) {
    const pc = S.player;
    let h = '';
    const sc = UI.selCountry && C(UI.selCountry);
    if (sc && sc.alive && sc.code !== pc) {
      const f = sc.faction && S.factions[sc.faction], ideo = IDEOLOGY[ideologyOf(sc)];
      const status = atWar(pc, sc.code) ? '<span class="tag bad">In guerra</span>' : allied(pc, sc.code) ? '<span class="tag good">Alleato</span>' : '<span class="tag">Neutrale</span>';
      const nd = S.divs.filter(d => d.owner === sc.code && !d.dead).length;
      const guar = S.guarantees.filter(g => g.to === sc.code).map(g => C(g.by).name);
      h += `<div class="hero">${flagBig(sc)}<div class="info"><h2>${esc(sc.name)}</h2>
        <div>${status} <span class="tag" style="color:${ideo.color};border-color:${ideo.color}">${ideo.name}</span> ${f ? `<span class="tag gold">${esc(f.name)}</span>` : ''}</div></div></div>
        <div class="stats"><div class="stat"><b>${sc.civ}/${sc.mil}</b><small>fabbriche</small></div><div class="stat"><b>${nd}</b><small>divisioni</small></div><div class="stat"><b>${sc.tiles}</b><small>territori</small></div></div>`;
      if (guar.length) h += `<p class="sub">Garantito da: ${esc(guar.join(', '))}</p>`;
      if (enemiesOf(sc.code).length) h += `<p class="sub">In guerra con: ${esc(enemiesOf(sc.code).map(e => C(e).name).join(', '))}</p>`;
      const canWar = !atWar(pc, sc.code) && !allied(pc, sc.code);
      h += `<h3>${icon('diplomacy')} Azioni diplomatiche</h3>`;
      const guaranteed = S.guarantees.some(g => g.by === pc && g.to === sc.code);
      h += `<button class="wide" data-act="guarantee" ${!guaranteed && !atWar(pc, sc.code) && p.pp >= PP_COST.guarantee ? '' : 'disabled'}>${icon('stability', 14)} Garantisci indipendenza · ${icon('pp', 12)} ${PP_COST.guarantee}</button>`;
      if (p.faction && !sc.faction) h += `<button class="wide" data-act="invite" ${!atWar(pc, sc.code) && p.pp >= PP_COST.faction ? '' : 'disabled'}>${icon('diplomacy', 14)} Invita nella fazione · ${icon('pp', 12)} ${PP_COST.faction}</button>`;
      if (!p.faction && sc.faction) h += `<button class="wide" data-act="askJoin" ${p.pp >= PP_COST.faction && !S.factions[sc.faction].members.some(m => atWar(m, pc)) ? '' : 'disabled'}>${icon('diplomacy', 14)} Chiedi di entrare in ${esc(f.name)} · ${icon('pp', 12)} ${PP_COST.faction}</button>`;
      h += `<button class="wide danger" data-act="war" ${canWar && p.pp >= PP_COST.war ? '' : 'disabled'}>${icon('war', 14)} Dichiara guerra · ${icon('pp', 12)} ${PP_COST.war}</button>`;
      if (canWar && guar.length) h += `<p class="hint warn">${esc(guar.join(', '))} entrerà in guerra in sua difesa.</p>`;
      if (canWar && f && f.members.length) h += `<p class="hint">Attaccandolo entrerai in guerra con tutta la fazione ${esc(f.name)}.</p>`;
      h += `<button class="wide ghost" data-act="center" data-arg="${sc.capital}">${icon('map', 14)} Mostra la capitale</button>`;
    } else {
      h += `<p class="hint" style="margin-top:12px">Clicca un paese sulla mappa o nell'elenco per le azioni diplomatiche.</p>`;
    }
    if (!p.faction) h += `<button class="wide" data-act="createFaction" ${p.pp >= PP_COST.create ? '' : 'disabled'}>${icon('plus', 14)} Fonda una fazione · ${icon('pp', 12)} ${PP_COST.create}</button>`;
    h += `<h3>${icon('diplomacy')} Fazioni</h3>`;
    for (const id in S.factions) {
      const f = S.factions[id];
      if (!f.members.length) continue;
      h += `<div class="card"><div class="row"><b>${esc(f.name)}</b><small>${f.members.length} membri</small></div><div class="cflags">${f.members.map(m => `<span class="tag">${flag(C(m))}${esc(C(m).name)}</span>`).join('')}</div></div>`;
    }
    h += `<h3>${icon('war')} Guerre in corso</h3>`;
    const wars = [...S.wars].map(k => `<div class="row"><span>${flag(C(k[0]))}${esc(C(k[0]).name)}</span>${icon('war', 14, 'bad')}<span>${esc(C(k[1]).name)}${flag(C(k[1]))}</span></div>`);
    h += wars.length ? `<div class="card">${wars.join('')}</div>` : `<p class="hint">Nessuna guerra in corso.</p>`;
    h += `<h3>${icon('map')} Nazioni</h3><table class="tbl"><tr><th>Paese</th><th>Rapporti</th><th class="n">Div.</th></tr>`;
    for (const k in S.countries) {
      const c = C(k);
      if (!c.alive || k === pc) continue;
      const rel = atWar(pc, k) ? '<span class="bad">Guerra</span>' : allied(pc, k) ? '<span class="good">Alleato</span>' : '<span class="muted">Neutrale</span>';
      h += `<tr class="click" data-act="selCountry" data-arg="${k}"><td>${flag(c)}${esc(c.name)}</td><td>${rel}</td><td class="n">${S.divs.filter(d => d.owner === k && !d.dead).length}</td></tr>`;
    }
    return h + '</table>';
  },
  actions: {
    war: () => {
      const t = UI.selCountry;
      UI.ask('Dichiarazione di guerra', `Sei sicuro di voler dichiarare guerra a ${C(t).name}?`,
        [{ label: 'Guerra!', fn: () => playerDeclareWar(t) }, { label: 'Annulla' }], { icon: 'war' });
    },
    guarantee: () => playerGuarantee(UI.selCountry),
    invite: () => playerInvite(UI.selCountry),
    askJoin: () => playerAskJoin(UI.selCountry),
    createFaction: () => playerCreateFaction(),
  },
});

// ============================== INTELLIGENCE ==============================
UI.registerPanel({
  id: 'intelligence', title: 'Intelligence', icon: 'intelligence', group: 'state', order: 80, key: 'O', width: 500,
  render(p) {
    let h = `<h3>${icon('spy')} Agenzia di intelligence</h3>`;
    h += p.agency ? `<div class="card cur"><b>${esc(p.agency.name)}</b></div>` : emptyState('spy', 'Nessuna agenzia di intelligence fondata.');
    h += `<h3>${icon('intelligence')} Rapporti sulle potenze</h3><table class="tbl"><tr><th>Paese</th><th class="n">Civ</th><th class="n">Mil</th><th class="n">Div.</th><th class="n">Terr.</th></tr>`;
    const list = Object.values(S.countries).filter(c => c.alive && c.code !== p.code).sort((a, b) => (b.civ + b.mil) - (a.civ + a.mil));
    for (const c of list) {
      const nd = S.divs.filter(d => d.owner === c.code && !d.dead).length;
      h += `<tr class="click" data-act="selCountry" data-arg="${c.code}"><td>${flag(c)}${esc(c.name)}</td><td class="n">${c.civ}</td><td class="n">${c.mil}</td><td class="n">${nd}</td><td class="n">${c.tiles}</td></tr>`;
    }
    return h + '</table>';
  },
});

// ============================== ESERCITO ==============================
UI.registerPanel({
  id: 'esercito', title: 'Esercito', icon: 'army', group: 'military', order: 10, key: 'U', width: 460,
  badge: p => p.training.length || null,
  render(p) {
    const mine = S.divs.filter(d => d.owner === p.code && !d.dead);
    const fighting = mine.filter(d => d.combat).length, moving = mine.filter(d => d.path.length && !d.combat).length;
    let h = `<div class="stats"><div class="stat"><b>${mine.length}</b><small>divisioni</small></div><div class="stat"><b>${moving}</b><small>in marcia</small></div><div class="stat"><b class="${fighting ? 'bad' : ''}">${fighting}</b><small>in battaglia</small></div></div>`;
    h += `<h3>${icon('division')} Recluta e schiera</h3>`;
    for (const type in UNIT_TYPES) {
      const ut = UNIT_TYPES[type], locked = type === 'arm' && !p.armorTech;
      h += `<div class="slot ${locked ? 'dim' : ''}"><span class="sico">${icon(UT_ICON[type] || 'division', 22)}</span><span class="grow">
        <div class="row"><b>${ut.name}</b><small>${ut.days} giorni</small></div>
        <small class="muted">Att ${ut.atk} · Dif ${ut.def} · Org ${ut.org} · ${icon('equipment', 12)} ${fmt(ut.eq)} · ${icon('manpower', 12)} ${fmt(ut.mp)}</small>
        ${locked ? '<br><small class="warn">Richiede la tecnologia dei carri armati</small>' : ''}</span>
        <button class="primary" data-act="recruit" data-arg="${type}" ${canRecruit(p, type) ? '' : 'disabled'}>Recluta</button></div>`;
    }
    if (p.training.length) {
      h += `<h4>In addestramento</h4>`;
      for (const tr of p.training) h += `<div class="row"><span style="width:90px">${UNIT_TYPES[tr.type].name}</span>${bar(1 - tr.days / tr.total)}<small>${tr.days} g</small></div>`;
    }
    h += `<h3>${icon('army')} Divisioni<span class="r">${UI.sel.size ? `${UI.sel.size} selezionate` : ''}</span></h3>
      <div class="grid2"><button data-act="selAll">Seleziona tutte</button><button data-act="selIdle">Solo inattive</button></div>
      <div class="grid2"><button data-act="stop" ${UI.sel.size ? '' : 'disabled'}>Ferma</button><button data-act="desel" ${UI.sel.size ? '' : 'disabled'}>Deseleziona</button></div>
      <p class="hint">${UI.sel.size ? 'Clic destro sulla mappa per muovere o attaccare.' : 'Clic su un segnalino per selezionare, Shift+trascina per un riquadro.'}</p><div class="list">`;
    const list = [...mine].sort((a, b) => (UI.sel.has(b.id) - UI.sel.has(a.id)) || (b.combat - a.combat) || a.num - b.num).slice(0, 150);
    for (const d of list) {
      const ut = UNIT_TYPES[d.type];
      const st = d.combat ? '<span class="bad">in battaglia</span>' : d.path.length ? 'in marcia' : 'in attesa';
      h += `<div class="div ${UI.sel.has(d.id) ? 'sel' : ''}" data-act="selDiv" data-arg="${d.id}">
        <span class="ut" style="background:${p.color}">${icon(UT_ICON[d.type] || 'division', 14)}</span><b>${esc(divName(d))}</b><small class="muted">${st}</small>
        <div class="row3"><small>Org</small>${bar(d.org / ut.org, 'org')}<small>Forza</small>${bar(d.str, 'str')}</div></div>`;
    }
    h += '</div>';
    if (mine.length > 150) h += `<p class="hint">…e altre ${mine.length - 150}</p>`;
    return h;
  },
  actions: {
    recruit: type => { if (recruit(C(S.player), type)) log(`Nuova divisione di ${UNIT_TYPES[type].name} in addestramento.`); },
  },
});

// ============================== MARINA / AVIAZIONE ==============================
UI.registerPanel({
  id: 'marina', title: 'Marina', icon: 'navy', group: 'military', order: 20, width: 460,
  render: () => `<h3>${icon('navy')} Flotte</h3>${emptyState('navy', 'Nessuna flotta in servizio. Cantieri navali, convogli e flotte arrivano con il sistema navale.')}
    <h3>${icon('dockyard')} Cantieri navali</h3><p class="hint">Le divisioni possono comunque attraversare il mare con un clic destro sulla costa nemica.</p>`,
});
UI.registerPanel({
  id: 'aviazione', title: 'Aviazione', icon: 'air', group: 'military', order: 30, width: 460,
  render: () => `<h3>${icon('air')} Stormi</h3>${emptyState('air', 'Nessuno stormo schierato. Basi aeree, caccia e bombardieri arrivano con il sistema aereo.')}`,
});
