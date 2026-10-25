'use strict';
// Scheda Esercito: divisioni, schieramento, progettista divisioni, progettista carri, comando.

const LandUI = {
  sub: 'divisioni', draft: null, brush: 'fanteria', tankDraft: null, paradrop: false,
  mapMode: null, selTile: -1, focusDiv: null,
};

const pctAbs = v => `${Math.round(v * 100)}%`; // pctAbs() di focus.js mette il segno
const n1 = v => (Math.round(v * 10) / 10).toLocaleString('it-IT');
function supIcon(s) { return s < 0.3 ? '<span class="bad" title="Senza rifornimenti">☠</span>' : s < 0.7 ? '<span class="warn" title="Rifornimenti scarsi">⚠</span>' : ''; }
function expName(e) { return e < 0.2 ? 'Recluta' : e < 0.45 ? 'Addestrata' : e < 0.7 ? 'Regolare' : e < 0.9 ? 'Veterana' : 'Élite'; }

function statTable(st, extra = '') {
  return `<table class="ltbl">
    <tr><td>Attacco molle</td><td>${n1(st.sa)}</td><td>Difesa</td><td>${n1(st.def)}</td></tr>
    <tr><td>Attacco duro</td><td>${n1(st.ha)}</td><td>Sfondamento</td><td>${n1(st.brk)}</td></tr>
    <tr><td>Perforazione</td><td>${n1(st.ap)}</td><td>Corazza</td><td>${n1(st.arm)}</td></tr>
    <tr><td>Organizzazione</td><td>${n1(st.org)}</td><td>Forza (PF)</td><td>${n1(st.hp)}</td></tr>
    <tr><td>Larghezza</td><td><b>${st.w}</b></td><td>Durezza</td><td>${pctAbs(st.hard)}</td></tr>
    <tr><td>Velocità</td><td>${n1(st.spd)} km/h</td><td>Rifornimenti</td><td>${st.sup.toFixed(2)}/g</td></tr>
    <tr><td>Manodopera</td><td>${fmt(st.mp)}</td><td>Addestramento</td><td>${st.days} g</td></tr>
    ${st.relN ? `<tr><td>Affidabilità</td><td class="${st.rel < 0.75 ? 'bad' : st.rel < 0.85 ? 'warn' : 'good'}">${pctAbs(st.rel)}</td><td>Forze speciali</td><td>${st.special}</td></tr>` : st.special ? `<tr><td>Forze speciali</td><td>${st.special} btg</td><td></td><td></td></tr>` : ''}
    ${extra}
  </table>
  <p class="hint">Equipaggiamento: ${Object.entries(st.need).map(([f, q]) => `${f} ${fmt(q)}`).join(' · ')}</p>`;
}

function landSubTabs(cur, list, act) {
  return `<div class="lsub">${list.map(([id, name]) => `<button data-act="${act}" data-arg="${id}" class="${cur === id ? 'on' : ''}">${name}</button>`).join('')}</div>`;
}

// ---------- sotto-pannelli ----------
function landPanelDivisioni(p) {
  const mine = S.divs.filter(d => d.owner === S.player && !d.dead);
  const sel = UI.sel;
  const fighting = mine.filter(d => d.combat).length, moving = mine.filter(d => d.path.length && !d.combat).length;
  const noSup = mine.filter(d => (d.supply ?? 1) < 0.3).length;
  let h = `<div class="stats"><div><b>${mine.length}</b><small>divisioni</small></div><div><b>${moving}</b><small>in marcia</small></div><div><b>${fighting}</b><small>in battaglia</small></div></div>
    ${noSup ? `<p class="bad">☠ ${noSup} divisioni senza rifornimenti: logorio e niente recupero di organizzazione.</p>` : ''}
    <div class="row2"><button data-act="selAll">Seleziona tutte</button><button data-act="selIdle">Solo inattive</button></div>
    <div class="row2"><button data-act="stop" ${sel.size ? '' : 'disabled'}>Ferma selezionate</button><button data-act="desel" ${sel.size ? '' : 'disabled'}>Deseleziona</button></div>`;
  const selDivs = mine.filter(d => sel.has(d.id));
  const paras = selDivs.filter(d => isParaDiv(d));
  if (paras.length) h += `<button data-act="paradrop" class="${LandUI.paradrop ? 'primary' : ''}">${LandUI.paradrop ? 'Clicca la zona di lancio sulla mappa…' : `🪂 Aviolancio (${paras.length})`}</button>`;
  h += `<p class="hint">${sel.size ? `<b>${sel.size}</b> selezionate: clic destro sulla mappa per muovere o attaccare (Ctrl+clic destro: in treno).` : 'Clic su un segnalino per selezionare, trascina col sinistro per un riquadro, Ctrl+numero per un gruppo di controllo.'}</p>`;
  const one = selDivs.length === 1 ? selDivs[0] : null;
  if (one) {
    const st = tplStats(one), g = divGeneral(one), a = one.army != null ? armyById(p, one.army) : null;
    const maxOrg = divMaxOrg(one);
    h += `<div class="card cur"><div class="row"><b>${esc(divName(one))}</b><small>${expName(one.exp || 0)}</small></div>
      <div class="row3"><small>Org</small>${bar(one.org / maxOrg, 'org')}<small>Forza</small>${bar(one.str, 'str')}</div>
      <div class="row3"><small>Rifornim.</small>${bar(one.supply ?? 1, (one.supply ?? 1) < 0.5 ? 'bad' : '')}<small>Esper.</small>${bar(one.exp || 0)}</div>
      <p>Trinceramento ${n1(one.ent || 0)}/10 · Pianificazione ${pctAbs(one.plan || 0)} · ${weatherOf(one.tile).icon} ${weatherOf(one.tile).name}</p>
      <p>Comando: ${a ? esc(a.name) : '<span class="warn">nessuna armata</span>'}${g ? ` · ${esc(g.name)}` : ''}</p>
      ${one.attrition > 0 ? `<p class="bad">Logorio: -${(one.attrition * 100).toFixed(2)}% forza al giorno</p>` : ''}
      ${statTable(st)}</div>`;
  }
  const list = [...mine].sort((a, b) => (sel.has(b.id) - sel.has(a.id)) || (b.combat - a.combat) || a.num - b.num).slice(0, 150);
  for (const d of list) {
    const st = d.combat ? '<span class="bad">in battaglia</span>' : d.path.length ? 'in marcia' : 'in attesa';
    h += `<div class="div ${sel.has(d.id) ? 'sel' : ''}" data-act="selDiv" data-arg="${d.id}">
      <div class="row"><b>${supIcon(d.supply ?? 1)} ${esc(divName(d))}</b><small>${st}</small></div>
      <div class="row3"><small>Org</small>${bar(d.org / divMaxOrg(d), 'org')}<small>Forza</small>${bar(d.str, 'str')}</div></div>`;
  }
  if (mine.length > 150) h += `<p class="hint">…e altre ${mine.length - 150}</p>`;
  return h;
}

function landPanelSchieramento(p) {
  const cap = specialCap(p), used = specialUsed(p);
  let h = `<p class="hint">Addestra nuove divisioni dai tuoi modelli. Manodopera: <b>${fmt(p.manpower)}</b>${typeof Econ === 'undefined' ? ` · Equipaggiamento: <b>${fmt(p.equipment)}</b>` : ''}</p>
    <p>Forze speciali: <b class="${used > cap ? 'bad' : ''}">${used}/${cap}</b> battaglioni</p>`;
  for (const t of p.templates) {
    const err = tplAvailable(p, t);
    const st = t.stats;
    h += `<div class="card ${err ? 'dim' : ''}"><div class="row"><b>${esc(t.name)}</b><small>larghezza ${st.w} · ${st.days} g</small></div>
      <p>${tplSummary(t)}</p>
      <p>Molle ${n1(st.sa)} · Duro ${n1(st.ha)} · Dif ${n1(st.def)} · Sfond ${n1(st.brk)} · Org ${n1(st.org)}</p>
      <p>👥 ${fmt(st.mp)} · ${typeof Econ === 'undefined' ? `🔫 ${fmt(st.eqPoints)}` : Object.entries(st.need).map(([f, q]) => `${f} ${fmt(q)}`).join(' · ')}</p>
      ${err ? `<small class="warn">${esc(err)}</small>` : ''}
      <div class="row2"><button data-act="recruitTpl" data-arg="${t.id}" ${canRecruit(p, t.id) ? '' : 'disabled'}>Addestra</button><button data-act="editTpl" data-arg="${t.id}">Modifica</button></div></div>`;
  }
  if (p.training.length) {
    h += `<h4>In addestramento</h4>`;
    for (const tr of p.training) {
      const t = p.templates.find(x => x.id === tr.tpl);
      h += `<div class="qrow"><span>${esc(t ? t.name : UNIT_TYPES[tr.type]?.name || '?')}</span>${bar(1 - tr.days / tr.total)}<small>${tr.days} g</small></div>`;
    }
  }
  return h;
}
function tplSummary(t) {
  const cnt = {};
  for (const b of tplBattalions(t)) cnt[b] = (cnt[b] || 0) + 1;
  const lines = Object.entries(cnt).map(([b, n]) => `${n}× ${BATTALIONS[b].icon} ${BATTALIONS[b].name}`);
  const sup = t.support.map(s => `${SUPPORT[s].icon} ${SUPPORT[s].name}`);
  return esc([...lines, ...sup].join(' · '));
}

function landPanelProgettista(p) {
  const dr = LandUI.draft && p.templates.find(t => t.id === LandUI.draft.tplId) ? LandUI.draft : null;
  let h = `<p class="hint">Esperienza esercito: <b>${Math.floor(armyXP(p))}</b> XP. Ogni battaglione cambiato costa ${DESIGNER_XP.battalion} XP, ogni compagnia di supporto ${DESIGNER_XP.support}.</p>
    <div class="lchips">${p.templates.map(t => `<button data-act="editTpl" data-arg="${t.id}" class="${dr && dr.tplId === t.id ? 'on' : ''}">${esc(t.name)}</button>`).join('')}</div>`;
  if (!dr) return h + `<p class="hint">Scegli un modello da modificare.</p>`;
  const tpl = p.templates.find(t => t.id === dr.tplId);
  const tmp = { ...tpl, lines: dr.lines, support: dr.support, tank: dr.tank };
  const st = computeTemplate(p, tmp);
  const cost = tplDiffCost(tpl, dr);
  // tavolozza
  h += `<h4>Battaglione da inserire</h4><div class="lchips">` + Object.entries(BATTALIONS).map(([k, b]) => {
    const ok = techOk(p, b) && (!b.tank || p.armorTech);
    return `<button data-act="brush" data-arg="${k}" class="${LandUI.brush === k ? 'on' : ''}" ${ok ? '' : 'disabled'} title="${esc(b.name)}">${b.icon} ${esc(b.name)}</button>`;
  }).join('') + `<button data-act="brush" data-arg="" class="${LandUI.brush === '' ? 'on' : ''}">✕ Svuota</button></div>`;
  // griglia 5×5
  h += `<h4>Battaglioni di linea</h4><div class="lgrid">`;
  for (let j = 0; j < TPL_ROWS; j++) for (let i = 0; i < TPL_COLS; i++) {
    const b = dr.lines[i][j];
    const changed = (tpl.lines[i][j] || null) !== (b || null);
    h += `<div class="lslot ${b ? 'full' : ''} ${changed ? 'chg' : ''}" data-act="slot" data-arg="${i},${j}" title="${b ? esc(BATTALIONS[b].name) : 'Vuoto'}">${b ? BATTALIONS[b].icon + `<small>${esc(BATTALIONS[b].name.split(' ')[0])}</small>` : '+'}</div>`;
  }
  h += `</div><h4>Compagnie di supporto (${dr.support.length}/${TPL_SUPPORT})</h4><div class="lchips">`;
  for (const [k, sp] of Object.entries(SUPPORT)) {
    const on = dr.support.includes(k);
    h += `<button data-act="support" data-arg="${k}" class="${on ? 'on' : ''}" title="${esc(sp.desc)}" ${!on && dr.support.length >= TPL_SUPPORT ? 'disabled' : ''}>${sp.icon} ${esc(sp.name)}</button>`;
  }
  h += `</div>`;
  if (tplBattalions(tmp).some(b => BATTALIONS[b].tank)) {
    h += `<h4>Modello di carro</h4><div class="lchips">${p.tankDesigns.map(ds => `<button data-act="tplTank" data-arg="${ds.id}" class="${dr.tank === ds.id ? 'on' : ''}">${esc(ds.name)}</button>`).join('')}</div>`;
  }
  h += `<h4>Statistiche</h4>${statTable(st)}`;
  h += widthAdvice(st.w);
  h += `<div class="row2"><button class="primary" data-act="saveTpl" ${cost && armyXP(p) >= cost ? '' : 'disabled'}>Salva (${cost} XP)</button><button data-act="resetTpl">Annulla modifiche</button></div>
    <div class="row2"><button data-act="copyTpl" ${armyXP(p) >= DESIGNER_XP.newTemplate ? '' : 'disabled'}>Duplica (${DESIGNER_XP.newTemplate} XP)</button><button class="danger" data-act="delTpl" ${p.templates.length > 1 ? '' : 'disabled'}>Elimina</button></div>
    <p class="hint">Le divisioni esistenti si riorganizzano: perdono metà dell'organizzazione e pagano l'equipaggiamento mancante.</p>`;
  return h;
}
function widthAdvice(w) {
  const fits = ['plains', 'forest', 'hills', 'mountain'].map(k => {
    const T = LAND_TERRAIN[k], name = TERRAIN[k]?.name || k;
    const n = Math.floor(T.width / w), over = Math.ceil(T.width / w) * w - T.width;
    return `${name} ${T.width}: ${n}× (${n * w}${over && n * w < T.width ? `, +1 sfora di ${over}` : ''})`;
  });
  return `<p class="hint">Larghezza ${w}. Quante ne entrano in un fronte: ${fits.join(' · ')}. Larghezze efficienti: 15, 21, 30, 35.</p>`;
}

function landPanelCarri(p) {
  let h = `<p class="hint">Progetta i carri: telaio, cannone, corazza e motore decidono attacco, perforazione, corazza, velocità e <b>affidabilità</b> (guasti e logorio). Salvare un progetto costa ${DESIGNER_XP.tankModule * 2} XP.</p>
    <div class="lchips">${p.tankDesigns.map(ds => `<button data-act="editTank" data-arg="${ds.id}" class="${LandUI.tankDraft && LandUI.tankDraft.id === ds.id ? 'on' : ''}">${esc(ds.name)}</button>`).join('')}
    <button data-act="newTank">+ Nuovo progetto</button></div>`;
  const dr = LandUI.tankDraft;
  if (!dr) return h;
  const st = tankStats(dr), err = tankDesignValid(p, dr);
  const ch = TANK_CHASSIS[dr.chassis];
  const opt = (act, obj, cur, filt = () => true) => `<div class="lchips">${Object.entries(obj).filter(([k, v]) => filt(k, v)).map(([k, v]) =>
    `<button data-act="${act}" data-arg="${k}" class="${cur === k ? 'on' : ''}" ${techOk(p, v) ? '' : 'disabled'} title="${v.year ? 'Dal ' + v.year : ''}">${esc(v.name)}</button>`).join('')}</div>`;
  h += `<h4>Telaio</h4>${opt('tkChassis', TANK_CHASSIS, dr.chassis)}
    <h4>Cannone</h4>${opt('tkGun', TANK_GUNS, dr.gun, k => ch.guns.includes(k))}
    <h4>Ruolo</h4><div class="lchips">${Object.entries(TANK_ROLES).map(([k, v]) => `<button data-act="tkRole" data-arg="${k}" class="${dr.role === k ? 'on' : ''}">${esc(v.name)}</button>`).join('')}</div>
    <h4>Corazza</h4>${opt('tkArmor', TANK_ARMOR, dr.armor)}
    <div class="row"><span>Spessore corazza: ${dr.armUp}/${TANK_UPG_MAX}</span><span><button data-act="tkUp" data-arg="armUp,-1">−</button> <button data-act="tkUp" data-arg="armUp,1">+</button></span></div>
    <h4>Motore</h4>${opt('tkEngine', TANK_ENGINE, dr.engine)}
    <div class="row"><span>Potenza motore: ${dr.engUp}/${TANK_UPG_MAX}</span><span><button data-act="tkUp" data-arg="engUp,-1">−</button> <button data-act="tkUp" data-arg="engUp,1">+</button></span></div>
    <h4>Accessori</h4><div class="lchips">${Object.entries(TANK_EXTRAS).map(([k, v]) => `<button data-act="tkExtra" data-arg="${k}" class="${dr.extras.includes(k) ? 'on' : ''}" ${techOk(p, v) ? '' : 'disabled'}>${esc(v.name)}</button>`).join('')}</div>
    <h4>Prestazioni del battaglione</h4>
    <table class="ltbl">
      <tr><td>Attacco molle</td><td>${st.sa}</td><td>Attacco duro</td><td>${st.ha}</td></tr>
      <tr><td>Perforazione</td><td>${st.ap}</td><td>Corazza</td><td>${st.arm}</td></tr>
      <tr><td>Sfondamento</td><td>${st.brk}</td><td>Difesa</td><td>${st.def}</td></tr>
      <tr><td>Velocità</td><td>${st.spd} km/h</td><td>Affidabilità</td><td class="${st.rel < 0.75 ? 'bad' : st.rel < 0.85 ? 'warn' : 'good'}">${pctAbs(st.rel)}</td></tr>
      <tr><td>Costo</td><td>${st.cost}</td><td>Rifornimenti</td><td>${st.sup}</td></tr>
    </table>
    ${err ? `<p class="warn">${esc(err)}</p>` : ''}
    <div class="row2"><button class="primary" data-act="saveTank" ${err ? 'disabled' : ''}>${dr.isNew ? 'Crea progetto' : 'Aggiorna progetto'}</button><button data-act="saveTankNew" ${err || dr.isNew ? 'disabled' : ''}>Salva come nuovo</button></div>`;
  return h;
}

function landPanelComando(p) {
  let h = `<div class="row"><b>Potere di comando</b><span>${Math.floor(p.cp)}/${cpMax(p)}</span></div>${bar(p.cp / cpMax(p))}
    <p class="hint">Si accumula ogni giorno (di più con i feldmarescialli), fino a ${cpMax(p)}. Serve per nuovi generali (${CP_COST.general}), promozioni a feldmaresciallo (${CP_COST.promote}), nuovi tratti (${CP_COST.trait}) e per le manovre d'emergenza sui ritratti in basso: ${CP_ABILITY.force.icon} ${CP_ABILITY.force.name} (${CP_ABILITY.force.cost}) e ${CP_ABILITY.last.icon} ${CP_ABILITY.last.name} (${CP_ABILITY.last.cost}).</p>
    <p class="hint">Le divisioni ricevono il 100% dei bonus del generale e il 50% di quelli del feldmaresciallo (che coordina fino a ${FM_MAX_ARMIES} armate). Oltre ${ARMY_MAX_DIVS} divisioni per armata i bonus si diluiscono e arriva un malus fino al -30%.</p>
    <h4>Armate (max ${ARMY_MAX_DIVS} divisioni per generale)</h4>`;
  const selCount = UI.sel.size;
  for (const a of p.armies) {
    const divs = armyDivs(p, a), g = a.general != null ? genById(p, a.general) : null, fm = a.fm != null ? genById(p, a.fm) : null;
    const sup = divs.length ? divs.reduce((s, d) => s + (d.supply ?? 1), 0) / divs.length : 1;
    h += `<div class="card"><div class="row"><b>${esc(a.name)}</b><small class="${divs.length > ARMY_MAX_DIVS ? 'bad' : ''}">${divs.length}/${ARMY_MAX_DIVS} div.</small></div>
      <p>Generale: ${g ? esc(g.name) : '<span class="warn">nessuno</span>'} <button data-act="cycleGen" data-arg="${a.id}">Cambia</button></p>
      <p>Feldmaresciallo: ${fm ? `${esc(fm.name)}${fmArmyCount(p, fm.id) > FM_MAX_ARMIES ? ` <span class="bad">(${fmArmyCount(p, fm.id)}/${FM_MAX_ARMIES} armate)</span>` : ''}` : '—'} <button data-act="cycleFM" data-arg="${a.id}">Cambia</button></p>
      ${a.plan ? `<p>Piano: fronte di ${a.plan.front.length} province${a.plan.off.length ? ' · offensiva' : ''}${a.plan.exec ? ' · <span class="good">in esecuzione</span>' : ''}</p>` : ''}
      <p>Rifornimenti medi ${pctAbs(sup)} ${supIcon(sup)}</p>
      <div class="row2"><button data-act="selArmy" data-arg="${a.id}">Seleziona divisioni</button><button data-act="assignArmy" data-arg="${a.id}" ${selCount ? '' : 'disabled'}>Assegna selezionate (${selCount})</button></div>
      <button class="danger" data-act="disbandArmy" data-arg="${a.id}">Sciogli armata</button></div>`;
  }
  const unassigned = S.divs.filter(d => d.owner === p.code && !d.dead && (d.army == null || !armyById(p, d.army))).length;
  h += `${unassigned ? `<p class="warn">${unassigned} divisioni senza armata: niente bonus del generale e pianificazione dimezzata.</p>` : ''}
    <div class="row2"><button data-act="newArmy">+ Nuova armata</button><button data-act="autoArmy" ${unassigned ? '' : 'disabled'}>Organizza le libere</button></div>
    <h4>Generali</h4>`;
  for (const g of p.generals) {
    const cmd = p.armies.filter(a => a.general === g.id || a.fm === g.id).map(a => a.name);
    const free = Object.keys(GENERAL_TRAITS).filter(t => !g.traits.includes(t) && (!GENERAL_TRAITS[t].fm || g.rank === 'fm'));
    h += `<div class="card"><div class="row"><b>${g.rank === 'fm' ? '★ ' : ''}${esc(g.name)}</b><small>${g.rank === 'fm' ? 'Feldmaresciallo' : 'Generale'} · liv. ${g.level}</small></div>
      <p>Attacco ${g.atk} · Difesa ${g.def} · Pianificazione ${g.plan} · Logistica ${g.log}</p>
      ${bar(g.xp / (100 * g.level))}
      <p>${g.traits.length ? g.traits.map(t => `<span title="${esc(GENERAL_TRAITS[t].desc)}">◆ ${esc(GENERAL_TRAITS[t].name)}</span>`).join(' ') : 'Nessun tratto'}</p>
      ${cmd.length ? `<p>Comanda: ${esc(cmd.join(', '))}</p>` : ''}
      <div class="row2">${g.rank === 'gen' ? `<button data-act="promote" data-arg="${g.id}" ${p.cp >= CP_COST.promote ? '' : 'disabled'}>Promuovi (${CP_COST.promote})</button>` : '<span></span>'}
      <button data-act="trait" data-arg="${g.id}" ${p.cp >= CP_COST.trait && free.length && g.traits.length < 4 ? '' : 'disabled'}>Tratto: ${free.length ? esc(GENERAL_TRAITS[free[(LandUI.traitIdx || 0) % free.length]].name) : '—'} (${CP_COST.trait})</button></div>
      ${free.length > 1 ? `<button data-act="nextTrait">Altro tratto ›</button>` : ''}</div>`;
  }
  h += `<button data-act="recruitGen" ${p.cp >= CP_COST.general ? '' : 'disabled'}>Recluta un generale (${CP_COST.general} potere di comando)</button>`;
  return h;
}

// ---------- aviolancio ----------
function isParaDiv(d) {
  const b = tplBattalions(tplOf(d));
  return b.length && b.every(x => x === 'paracadutisti');
}
function paradropCheck(c, ti) {
  const t = S.tiles[ti];
  if (!t.land) return 'Bisogna lanciarsi sulla terraferma';
  if (!allied(t.ctrl, c.code) && !atWar(t.ctrl, c.code)) return 'Territorio neutrale';
  if (hasHostile(ti, c.code)) return 'Zona di lancio occupata da truppe nemiche';
  const near = S.hubs.some(h => allied(S.tiles[h.tile].ctrl, c.code) && landDistKm(h.tile, ti) <= 650);
  return near ? null : 'Troppo lontano dalle basi (max 650 km da un hub amico)';
}
function doParadrop(ti) {
  const p = C(S.player);
  const err = paradropCheck(p, ti);
  if (err) { log(err, 'warn'); return; }
  let n = 0;
  for (const d of S.divs) {
    if (d.dead || d.owner !== S.player || !UI.sel.has(d.id) || !isParaDiv(d)) continue;
    if (d.org < divMaxOrg(d) * 0.8) continue;
    moveDiv(d, ti); d.path = []; d.prog = 0; d.org *= 0.5; d.ent = 0; d.plan = 0;
    occupy(S.tiles[ti], d.owner);
    n++;
  }
  log(n ? `${n} divisioni paracadutate.` : 'Nessuna divisione pronta al lancio (serve almeno l\'80% di organizzazione).', n ? 'good' : 'warn');
  LandUI.paradrop = false;
}

// ---------- azioni ----------
const ESERCITO_ACTIONS = {
    landSub(arg) { LandUI.sub = arg; },
    selAll() { UI.sel = new Set(S.divs.filter(d => d.owner === S.player && !d.dead).map(d => d.id)); },
    selIdle() { UI.sel = new Set(S.divs.filter(d => d.owner === S.player && !d.dead && !d.path.length).map(d => d.id)); },
    desel() { UI.sel.clear(); },
    stop() { for (const d of S.divs) if (UI.sel.has(d.id)) d.path = d.path.length && !S.tiles[d.path[0]].land ? d.path : []; },
    selDiv(arg) { const d = S.divs.find(x => x.id === +arg); if (d) { UI.sel = new Set([d.id]); Render.centerOn(d.tile, 2.5); } },
    paradrop() { LandUI.paradrop = !LandUI.paradrop; },
    recruitTpl(arg) { const p = C(S.player); if (recruit(p, +arg)) log(`Nuova ${p.templates.find(t => t.id === +arg).name} in addestramento.`); },
    editTpl(arg) {
      const t = C(S.player).templates.find(x => x.id === +arg);
      LandUI.draft = { tplId: t.id, lines: t.lines.map(c => c.slice()), support: t.support.slice(), tank: t.tank };
      LandUI.sub = 'progettista';
    },
    brush(arg) { LandUI.brush = arg; },
    slot(arg) {
      const [i, j] = arg.split(',').map(Number);
      const dr = LandUI.draft;
      dr.lines[i][j] = LandUI.brush || null;
      if (LandUI.brush === 'carri' && dr.tank == null) dr.tank = C(S.player).tankDesigns[0]?.id ?? null;
    },
    support(arg) { const s = LandUI.draft.support, i = s.indexOf(arg); if (i >= 0) s.splice(i, 1); else if (s.length < TPL_SUPPORT) s.push(arg); },
    tplTank(arg) { LandUI.draft.tank = +arg; },
    saveTpl() { const p = C(S.player), err = applyTemplateEdit(p, LandUI.draft.tplId, LandUI.draft); if (err) log(err, 'warn'); else { log('Modello di divisione aggiornato.', 'good'); ESERCITO_ACTIONS.editTpl(LandUI.draft.tplId); } },
    resetTpl() { ESERCITO_ACTIONS.editTpl(LandUI.draft.tplId); },
    copyTpl() { const t = copyTemplate(C(S.player), LandUI.draft.tplId); if (t) ESERCITO_ACTIONS.editTpl(t.id); },
    delTpl() { if (deleteTemplate(C(S.player), LandUI.draft.tplId)) LandUI.draft = null; else log('Il modello è in uso da divisioni schierate o in addestramento.', 'warn'); },
    editTank(arg) { const ds = C(S.player).tankDesigns.find(x => x.id === +arg); LandUI.tankDraft = { ...ds, extras: ds.extras.slice() }; },
    newTank() { LandUI.tankDraft = { id: null, isNew: true, name: `Carro ${C(S.player).nextTankId}`, chassis: 'L1', gun: 'mg', armor: 'rivettata', engine: 'benzina', armUp: 0, engUp: 0, extras: [], role: 'carro' }; },
    tkChassis(arg) { const dr = LandUI.tankDraft; dr.chassis = arg; if (!TANK_CHASSIS[arg].guns.includes(dr.gun)) dr.gun = TANK_CHASSIS[arg].guns[0]; },
    tkGun(arg) { LandUI.tankDraft.gun = arg; },
    tkRole(arg) { LandUI.tankDraft.role = arg; },
    tkArmor(arg) { LandUI.tankDraft.armor = arg; },
    tkEngine(arg) { LandUI.tankDraft.engine = arg; },
    tkUp(arg) { const [k, v] = arg.split(','); const dr = LandUI.tankDraft; dr[k] = Math.max(0, Math.min(TANK_UPG_MAX, dr[k] + +v)); },
    tkExtra(arg) { const e = LandUI.tankDraft.extras, i = e.indexOf(arg); if (i >= 0) e.splice(i, 1); else e.push(arg); },
    saveTank() { const p = C(S.player), dr = LandUI.tankDraft; const err = saveTankDesign(p, dr, dr.isNew); if (err) log(err, 'warn'); else { log(`Progetto ${dr.name} salvato.`, 'good'); LandUI.tankDraft = null; } },
    saveTankNew() { const p = C(S.player), dr = { ...LandUI.tankDraft, name: LandUI.tankDraft.name + ' B' }; const err = saveTankDesign(p, dr, true); if (err) log(err, 'warn'); else { log(`Nuovo progetto ${dr.name}.`, 'good'); LandUI.tankDraft = null; } },
    cycleGen(arg) {
      const p = C(S.player), a = armyById(p, +arg);
      const gens = p.generals.filter(g => g.rank === 'gen');
      const i = gens.findIndex(g => g.id === a.general);
      const next = gens[(i + 1) % (gens.length + 1)];
      if (next) assignGeneral(p, a.id, next.id); else a.general = null;
    },
    cycleFM(arg) {
      const p = C(S.player), a = armyById(p, +arg);
      const fms = p.generals.filter(g => g.rank === 'fm');
      const i = fms.findIndex(g => g.id === a.fm);
      a.fm = fms[(i + 1) % (fms.length + 1)]?.id ?? null;
    },
    selArmy(arg) { const p = C(S.player); UI.sel = new Set(armyDivs(p, armyById(p, +arg)).map(d => d.id)); },
    assignArmy(arg) { const p = C(S.player); assignDivsToArmy(p, S.divs.filter(d => UI.sel.has(d.id)), +arg); },
    disbandArmy(arg) { disbandArmy(C(S.player), +arg); },
    newArmy() { createArmy(C(S.player)); },
    autoArmy() { autoArmies(C(S.player)); },
    promote(arg) { promoteGeneral(C(S.player), +arg); },
    trait(arg) {
      const p = C(S.player), g = genById(p, +arg);
      const free = Object.keys(GENERAL_TRAITS).filter(t => !g.traits.includes(t) && (!GENERAL_TRAITS[t].fm || g.rank === 'fm'));
      addTrait(p, g.id, free[(LandUI.traitIdx || 0) % free.length]);
    },
    nextTrait() { LandUI.traitIdx = (LandUI.traitIdx || 0) + 1; },
    recruitGen() { recruitGeneral(C(S.player)); },
};

// ---------- registrazione del pannello ----------
UI.registerPanel({
  id: 'esercito', title: 'Esercito', icon: 'army', group: 'military', order: 10, width: 520,
  render(p) {
    const subs = [['divisioni', 'Divisioni'], ['schieramento', 'Schieramento'], ['progettista', 'Progettista'], ['carri', 'Carri'], ['comando', 'Comando']];
    const body = { divisioni: landPanelDivisioni, schieramento: landPanelSchieramento, progettista: landPanelProgettista, carri: landPanelCarri, comando: landPanelComando }[LandUI.sub](p);
    return `<h3>Esercito</h3>${landSubTabs(LandUI.sub, subs, 'landSub')}${body}`;
  },
  badge(p) { const n = S.divs.filter(d => d.owner === p.code && !d.dead && (d.supply ?? 1) < 0.3).length; return n || null; },
  actions: ESERCITO_ACTIONS,
});
