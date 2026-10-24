'use strict';

// Pannello "Ricerca": tecnologie, dottrine terrestri e programma nucleare (logica in research.js).
// Usa UI.registerPanel della nuova interfaccia se presente, altrimenti aggiunge una scheda alla barra attuale.

const RS = { view: 'tech', cat: 'infantry' };

const pct = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const rsTag = (txt, cls = '') => `<span class="tag ${cls}">${txt}</span>`;

function rsViewButtons() {
  const v = [['tech', 'Tecnologie'], ['doc', 'Dottrine'], ['nuke', 'Nucleare']];
  return `<div class="grid3 rs-views">${v.map(([k, n]) =>
    `<button data-act="rs_view" data-arg="${k}" class="${RS.view === k ? 'primary' : ''}">${n}</button>`).join('')}</div>`;
}

function rsTechCard(p, t) {
  const done = p.techs.has(t.id);
  const av = techAvailable(p, t);
  const b = av ? findBonus(p, t) : null;
  const pen = b && b.aot ? 0 : aheadPenalty(t);
  let tags = rsTag(String(t.year), yearsAhead(t) > 0 ? 'warn' : '');
  if (!done && pen > 0) tags += ' ' + rsTag(`anticipo ${pct(pen)}`, 'bad');
  if (b) tags += ' ' + rsTag(`${esc(b.from || 'Bonus')} ${pct(b.bonus || 0)}${b.aot ? ', senza penalità' : ''}`, 'good');
  const running = p.research.some(r => r.id === t.id);
  const part = p.partial[t.id] ? ` · ${Math.round(p.partial[t.id] * 100)}% già fatto` : '';
  const req = !done && !av && !running ? `<small>Richiede: ${[...(t.req || []).map(r => esc(TECH_BY_ID[r].name)),
    ...(t.minFactories && !p.major ? [`grande potenza o ${t.minFactories} fabbriche`] : [])].join(', ')}</small>` : '';
  return `<div class="card ${done || running ? 'cur' : av ? '' : 'dim'}">
    <div class="row"><b>${done ? '✓ ' : ''}${esc(t.name)}</b><small>${done ? 'completata' : running ? 'in corso' : `${Math.ceil(techDays(p, t))} g${part}`}</small></div>
    <p>${esc(effText(t.eff))}</p><p>${tags}</p>${req}
    ${!done && av ? `<button data-act="rs_start" data-arg="${t.id}" ${p.research.length < p.researchSlots ? '' : 'disabled'}>Ricerca</button>` : ''}</div>`;
}

function rsPanelTech(p) {
  let h = `<h3>Slot di ricerca (${p.research.length}/${p.researchSlots})</h3>`;
  for (let i = 0; i < p.researchSlots; i++) {
    const job = p.research[i];
    if (!job) { h += `<div class="card slot empty"><small>Slot libero: scegli una tecnologia qui sotto.</small></div>`; continue; }
    const t = TECH_BY_ID[job.id];
    const pen = aheadPenalty(t, job);
    h += `<div class="card cur slot"><div class="row"><b>${esc(t.name)}</b><button class="x" data-act="rs_cancel" data-arg="${i}" title="Interrompi (il progresso resta)">✕</button></div>
      ${bar(job.frac)}<div class="row"><small>${daysLeft(p, job)} giorni rimanenti</small><small>${esc(CAT_NAME[t.cat])} · ${t.year}</small></div>
      <p>${pen > 0 ? rsTag(`penalità d'anticipo ${pct(pen)}`, 'bad') : ''}${job.from ? ' ' + rsTag(`${esc(job.from)} ${pct(job.bonus)}${job.aot ? ', senza penalità' : ''}`, 'good') : ''}</p></div>`;
  }
  h += `<p class="hint">Velocità di ricerca ${pct(researchSpeedOf(p))}. Ricercare prima dell'anno storico costa +200% di tempo per ogni anno di anticipo: i bonus d'anticipo dei focus e dello spionaggio la annullano per una ricerca.</p>`;
  if (p.researchBonuses.length) {
    h += `<h4>Bonus di ricerca disponibili</h4>` + p.researchBonuses.map(b =>
      `<p>${rsTag(`${esc(b.from || 'Bonus')}: ${pct(b.bonus || 0)} ${esc(CAT_NAME[b.cat] || b.cat)}${b.aot ? ', annulla penalità' : ''}${(b.uses ?? 1) > 1 ? ` (${b.uses} usi)` : ''}`, 'good')}</p>`).join('');
  }
  h += `<div class="rs-cats">${Object.keys(TECH_CATS).map(k => {
    const n = TECHS.filter(t => t.cat === k && techAvailable(p, t)).length;
    return `<button data-act="rs_cat" data-arg="${k}" class="${RS.cat === k ? 'primary' : ''}">${TECH_CATS[k].name}${n ? ` (${n})` : ''}</button>`;
  }).join('')}</div>`;
  for (const t of TECHS.filter(t => t.cat === RS.cat).sort((a, b) => a.year - b.year)) h += rsTechCard(p, t);
  return h;
}

function rsPanelDoc(p) {
  let h = `<h3>Dottrine terrestri</h3>
    <div class="stats"><div class="stat"><b>${Math.floor(p.xp.army)}</b><small>XP esercito</small></div>
    <div class="stat"><b>${p.doctrine ? p.doctrineTier + '/5' : '—'}</b><small>livello</small></div>
    <div class="stat"><b>${Math.round(p.entMax * 100)}% / ${Math.round(p.planMax * 100)}%</b><small>trincea / piano</small></div></div>
    <p class="hint">L'esercito guadagna esperienza ogni giorno, di più addestrando divisioni e combattendo. Scegliere una dottrina esclude le altre tre. Le divisioni ferme si trincerano (+difesa) e pianificano l'offensiva (+attacco, si consuma attaccando).</p>`;
  for (const key in DOCTRINES) {
    const D = DOCTRINES[key];
    const mine = p.doctrine === key, other = p.doctrine && !mine;
    const n = doctrineNext(p, key);
    h += `<div class="card ${mine ? 'cur' : other ? 'dim' : ''}"><div class="row"><b>${esc(D.name)}</b><small>${esc(D.hist)}</small></div><p>${esc(D.desc)}</p>`;
    D.tiers.forEach((tr, i) => {
      const got = mine && i < p.doctrineTier;
      const next = n && n.tier === i;
      if (!mine && !next && !other) return; // prima di scegliere mostra solo il primo livello
      if (other && i > 0) return;
      h += `<p>${got ? '✓' : next ? '▶' : '·'} <b>${esc(tr.name)}</b>: ${esc(effText(tr.eff))}</p>`;
    });
    if (n) h += `<button data-act="rs_doc" data-arg="${key}" ${p.xp.army >= n.cost ? '' : 'disabled'}>${p.doctrine ? 'Sblocca' : 'Adotta'} ${esc(D.tiers[n.tier].name)} (${n.cost} XP)</button>`;
    else if (mine) h += `<p class="good">Dottrina completata.</p>`;
    h += `</div>`;
  }
  return h;
}

function rsPanelNuke(p) {
  const st = id => p.techs.has(id) ? '<span class="good">✓</span>' : p.research.some(r => r.id === id) ? '<span class="warn">in corso</span>' : '<span class="hint">—</span>';
  let h = `<h3>Programma nucleare</h3>
    <p>${st('atom')} Ricerca atomica (1940) → ${st('reactor')} Reattore nucleare (1943) → ${st('abomb')} Bomba atomica (1945)</p>
    <p class="hint">Le tecnologie nucleari si trovano nella categoria Nucleare; reattore e bomba richiedono una grande potenza (o almeno ${NUKE_FACTORIES} fabbriche). Con la Bomba atomica il reattore produce una bomba ogni ${NUKE_DAYS} giorni.</p>
    <div class="card ${p.manhattan ? 'cur' : canManhattan(p) ? '' : 'dim'}"><div class="row"><b>Progetto Manhattan</b><small>⭐ ${MANHATTAN_PP}</small></div>
    <p>Programma segreto: +100% alle prossime 2 ricerche nucleari senza penalità d'anticipo e +3% velocità di ricerca. Richiede Ricerca atomica.</p>
    ${p.manhattan ? '<p class="good">Avviato.</p>' : `<button data-act="rs_manhattan" ${canManhattan(p) && p.pp >= MANHATTAN_PP ? '' : 'disabled'}>Avvia il programma</button>`}</div>`;
  if (p.abomb) {
    h += `<div class="stats"><div class="stat"><b>${p.nukes}</b><small>bombe pronte</small></div><div class="stat"><b>${Math.round(p.nukeProg * 100)}%</b><small>prossima bomba</small></div><div class="stat"><b>${enemiesOf(S.player).length}</b><small>nemici</small></div></div>${bar(p.nukeProg)}`;
    const tg = p.nukes > 0 ? nukeTargets(S.player).sort((a, b) => b.vp - a.vp).slice(0, 12) : [];
    if (tg.length) {
      h += `<h4>Bersagli (città nemiche)</h4>`;
      for (const t of tg) {
        const o = C(t.owner);
        const nd = (S.byTile.get(t.i) || []).filter(d => !d.dead && atWar(d.owner, S.player)).length;
        h += `<div class="qrow"><span>${flag(o)} ${t.vp >= 20 ? 'Capitale' : 'Città'}</span><small>${esc(o.name)}${nd ? ` · ${nd} div.` : ''}</small>
          <span><button data-act="rs_center" data-arg="${t.i}" title="Mostra">◎</button> <button class="danger" data-act="rs_nuke" data-arg="${t.i}">☢</button></span></div>`;
      }
    } else if (p.nukes > 0) h += `<p class="hint">Nessuna città nemica da colpire: serve essere in guerra.</p>`;
  }
  const others = Object.values(S.countries).filter(c => c.alive && c.code !== S.player && c.abomb);
  if (others.length) h += `<p class="bad">Potenze nucleari: ${others.map(c => esc(c.name)).join(', ')}</p>`;
  return h;
}

function rsRender(p) {
  return rsViewButtons() + (RS.view === 'doc' ? rsPanelDoc(p) : RS.view === 'nuke' ? rsPanelNuke(p) : rsPanelTech(p));
}

const RS_ACTIONS = {
  rs_view(arg) { RS.view = arg; },
  rs_cat(arg) { RS.cat = arg; },
  rs_start(arg) { startResearch(C(S.player), arg); },
  rs_cancel(arg) { cancelResearch(C(S.player), +arg); },
  rs_doc(arg) { adoptDoctrine(C(S.player), arg); },
  rs_manhattan() { launchManhattan(C(S.player)); },
  rs_center(arg) { Render.centerOn(+arg, 2.5); },
  rs_nuke(arg) {
    const t = S.tiles[+arg];
    UI.ask('Bomba atomica', `Sganciare una bomba atomica su ${t.vp >= 20 ? 'la capitale' : 'una città'} di ${C(t.owner).name}? Le divisioni nella zona saranno devastate e l'industria colpita.`,
      [{ label: 'Sgancia', fn: () => dropNuke(S.player, +arg) }, { label: 'Annulla' }]);
  },
};

if (typeof UI.registerPanel === 'function') {
  UI.registerPanel({
    id: 'ricerca', title: 'Ricerca', icon: 'research', group: 'state', order: 30, width: 520,
    render: rsRender,
    actions: RS_ACTIONS,
    badge: p => (p.researchSlots - p.research.length) || null,
  });
} else {
  // interfaccia attuale: aggiunge la scheda alla barra e instrada le azioni rs_*
  const nav = document.getElementById('tabs');
  const btn = document.createElement('button');
  btn.dataset.tab = 'ricerca'; btn.textContent = 'Ricerca';
  nav.insertBefore(btn, nav.querySelector('[data-tab="esercito"]'));
  nav.style.gridTemplateColumns = `repeat(${nav.children.length}, 1fr)`;
  const css = document.createElement('style');
  css.textContent = `.tag{display:inline-block;font-size:11px;padding:0 5px;border:1px solid var(--line);border-radius:3px;margin:1px 0}
    .tag.good{border-color:#3d6b3d}.tag.bad{border-color:#7a2f26}.tag.warn{border-color:#7a6a2a}
    .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0}
    .rs-cats{display:flex;flex-wrap:wrap;gap:4px;margin:10px 0 4px}.rs-cats button{padding:3px 7px;font-size:12px}`;
  document.head.appendChild(css);
  UI.panel_ricerca = function () { return rsRender(C(S.player)); };
  const act = UI.act;
  UI.act = function (name, arg) {
    if (!RS_ACTIONS[name]) return act.call(this, name, arg);
    RS_ACTIONS[name](arg);
    this.dirty = true; this.lastPanel = '';
  };
}
