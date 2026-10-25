'use strict';

// Scheda Aviazione: stormi e missioni, produzione aerea con efficienza, progetti (designer).

function anBaseName(ti) {
  const t = S.tiles[ti];
  return `${regionById(regionOfTile(ti)).name}${t.vp >= 20 ? ' (capitale)' : ''}`;
}
function anWingMissionTxt(w) {
  if (!w.mission) return '<span class="an-muted">a terra</span>';
  const inR = wingInRange(w, w.region);
  return `${AIR_MISSIONS[w.mission].name} · ${esc(regionById(w.region).name)}${inR ? '' : ' <span class="bad">(fuori autonomia)</span>'}`;
}

// assegna una missione: scelta della missione, poi della regione sulla mappa
function anAskWingMission(wings) {
  const roles = new Set(wings.map(wingRole));
  const missions = Object.keys(AIR_MISSIONS).filter(m => [...roles].some(r => AIR_ROLES[r].missions.includes(m)));
  anChoose('Missione aerea', [
    ...missions.map(m => ({
      label: AIR_MISSIONS[m].name, sub: AIR_MISSIONS[m].desc,
      fn: () => {
        const ws = wings.filter(w => AIR_ROLES[wingRole(w)].missions.includes(m));
        const range = Math.min(...ws.map(w => wingStats(w).range));
        anStartPick({
          layer: 'air', from: ws[0].base, range,
          hint: `${AIR_MISSIONS[m].name}: clicca la regione (${AIR_MISSIONS[m].where === 'sea' ? 'zona di mare' : AIR_MISSIONS[m].where === 'land' ? 'regione terrestre' : 'qualsiasi'}) entro ${range} km`,
          invalidMsg: 'Regione fuori autonomia o del tipo sbagliato per questa missione.',
          valid: rid => ws.some(w => {
            const reg = regionById(rid), M = AIR_MISSIONS[m];
            return !(M.where === 'land' && reg.sea) && !(M.where === 'sea' && !reg.sea) && wingInRange(w, rid);
          }),
          done: rid => {
            let n = 0;
            for (const w of ws) if (AN.air.setMission(w, m, rid)) n++;
            log(`${n} stormi assegnati a ${AIR_MISSIONS[m].name} su ${regionById(rid).name}.`);
          },
        });
      },
    })),
    { label: 'Nessuna missione (a terra)', fn: () => { for (const w of wings) AN.air.setMission(w, null); } },
  ], 'Le missioni valgono per un\'intera regione strategica. Più a lungo raggio è la base, più regioni puoi coprire.');
}
function anAskRebase(wings) {
  const range = Math.min(...wings.map(w => wingStats(w).range));
  anStartPick({
    layer: 'air', tiles: true, from: wings[0].base,
    hint: 'Nuova base: clicca la tua capitale o una città controllata (★ o ■)',
    invalidMsg: 'Serve una capitale o una città sotto il tuo controllo.',
    valid: ti => S.tiles[ti].vp > 0 && S.tiles[ti].ctrl === S.player,
    done: ti => { for (const w of wings) AN.air.rebase(w, ti); log(`${wings.length} stormi trasferiti a ${anBaseName(ti)}.`); },
    range,
  });
}

UI.registerPanel({
  id: 'aviazione', title: 'Aviazione', icon: 'air', group: 'military', order: 20, width: 480,

  render(p) {
    const A = S.an, code = p.code;
    const mine = A.wings.filter(w => w.owner === code);
    const planes = mine.reduce((a, w) => a + w.planes, 0);
    const active = mine.filter(wingActive).length;
    const used = airFactoriesUsed(p);
    let h = '';
    if (ANUI.pick && ANUI.pick.layer === 'air') h += `<div class="an-pick">${esc(ANUI.pick.hint)} <button data-act="anCancel">Annulla</button></div>`;
    h += `<h3>Forza aerea</h3>
      <div class="stats"><div><b>${fmt(planes)}</b><small>aerei</small></div><div><b>${mine.length}</b><small>stormi</small></div><div><b>${active}</b><small>in missione</small></div></div>`;
    if (p.indDamage > 0.01) h += `<p class="bad">Industria danneggiata dai bombardamenti: −${Math.round(p.indDamage * 100)}% produzione.</p>`;
    h += `<p class="an-hint">Superiorità aerea: chi la ottiene in una regione toglie fino al 35% di efficacia alle divisioni nemiche che combattono lì. Sulla mappa: verde = nostra, rosso = nemica.</p>`;

    // stormi per base
    h += `<h3>Stormi</h3>`;
    const byBase = new Map();
    for (const w of mine) { if (!byBase.has(w.base)) byBase.set(w.base, []); byBase.get(w.base).push(w); }
    if (!mine.length) h += `<p class="an-hint">Nessuno stormo. Produci aerei e crea uno stormo dal magazzino qui sotto.</p>`;
    for (const [b, ws] of byBase) {
      h += `<div class="an-group"><div class="row"><b>🛫 ${esc(anBaseName(b))}</b><span>
        <button class="an-sm" data-act="anMissionBase" data-arg="${b}">Missione a tutti</button>
        <button class="an-sm" data-act="anRebaseBase" data-arg="${b}">Trasferisci</button></span></div>`;
      for (const w of ws) {
        const d = designOf(w.design);
        h += `<div class="card an-wing"><div class="row"><b>${esc(wingName(w))}</b><small>${esc(d.name)}</small></div>
          <div class="row3"><small>Aerei</small>${anBar(w.planes / WING_SIZE, 'str')}<small>${Math.floor(w.planes)}/${WING_SIZE}</small><span></span></div>
          <p>${anWingMissionTxt(w)}</p>
          <div class="an-btns"><button class="an-sm" data-act="anMission" data-arg="${w.id}">Missione</button>
          <button class="an-sm" data-act="anRebase" data-arg="${w.id}">Base</button>
          <button class="an-sm" data-act="anGround" data-arg="${w.id}" ${w.mission ? '' : 'disabled'}>A terra</button>
          <button class="an-sm" data-act="anDisband" data-arg="${w.id}">Sciogli</button></div></div>`;
      }
      h += `</div>`;
    }

    // magazzino
    const stock = Object.entries(p.airStock).filter(([, n]) => n >= 1);
    h += `<h3>Magazzino aerei</h3>`;
    if (!stock.length) h += `<p class="an-hint">Nessun aereo di riserva: gli stormi si rinforzano da qui in automatico.</p>`;
    for (const [id, n] of stock) {
      h += `<div class="qrow"><span>${esc(designOf(id).name)}</span><small>${Math.floor(n)} aerei</small><button class="an-sm" data-act="anNewWing" data-arg="${id}">Crea stormo</button></div>`;
    }

    // produzione
    h += `<h3>Produzione aerea</h3>
      <p class="an-hint">Fabbriche militari assegnate agli aerei: <b>${used}</b> su ${p.mil} (le altre producono equipaggiamento terrestre). L'efficienza parte dal ${Math.round(AIR_EFF_START * 100)}% e cresce in fretta all'inizio, poi rallenta fino al ${Math.round((p.effCap != null ? p.effCap : AIR_EFF_CAP) * 100)}%. Cambiare modello sulla linea ne fa perdere gran parte.</p>`;
    for (const l of p.airLines) {
      const d = designOf(l.design);
      const perDay = l.factories * FACTORY_OUTPUT * l.eff * anIndustryMult(p) / d.stats.cost;
      h += `<div class="card"><div class="row"><b>${esc(d.name)}</b><small>${perDay.toFixed(2)} aerei/giorno</small></div>
        <div class="row3"><small>Efficienza</small>${anBar(l.eff, 'eff')}<small>${Math.round(l.eff * 100)}%</small><span></span></div>
        <div class="an-btns"><span>Fabbriche</span><button class="an-sm" data-act="anFac" data-arg="${l.id}:-5">−5</button><button class="an-sm" data-act="anFac" data-arg="${l.id}:-1">−</button>
        <b class="an-num">${l.factories}</b><button class="an-sm" data-act="anFac" data-arg="${l.id}:1" ${used < p.mil ? '' : 'disabled'}>+</button><button class="an-sm" data-act="anFac" data-arg="${l.id}:5" ${used < p.mil ? '' : 'disabled'}>+5</button>
        <button class="an-sm" data-act="anLineModel" data-arg="${l.id}">Cambia modello</button><button class="an-sm x" data-act="anLineDel" data-arg="${l.id}">✕</button></div></div>`;
    }
    h += `<button data-act="anNewLine">+ Nuova linea di produzione</button>`;

    // progetti
    h += `<h3>Progetti</h3>`;
    for (const d of designsOf(code, 'air')) {
      h += `<div class="qrow an-design"><span><b>${esc(d.name)}</b><br><small>${AIR_ROLES[d.type].name} ${TECH_YEARS[d.gen]} · ${anDesignLine(d)}</small></span><span></span><button class="an-sm" data-act="anCopy" data-arg="${d.id}">Modifica</button></div>`;
    }
    h += `<button class="primary" data-act="anDesigner">Progetta un nuovo aereo</button>`;
    return h;
  },

  actions: {
    anCancel() { anCancelPick(); },
    anMission(id) { const w = S.an.wings.find(w => w.id === +id); if (w) anAskWingMission([w]); },
    anMissionBase(b) { const ws = S.an.wings.filter(w => w.owner === S.player && w.base === +b); if (ws.length) anAskWingMission(ws); },
    anRebase(id) { const w = S.an.wings.find(w => w.id === +id); if (w) anAskRebase([w]); },
    anRebaseBase(b) { const ws = S.an.wings.filter(w => w.owner === S.player && w.base === +b); if (ws.length) anAskRebase(ws); },
    anGround(id) { const w = S.an.wings.find(w => w.id === +id); if (w) AN.air.setMission(w, null); },
    anDisband(id) { const w = S.an.wings.find(w => w.id === +id); if (w) AN.air.disband(w); },
    anNewWing(id) {
      const p = C(S.player), bases = airBases(S.player);
      if (!bases.length) { log('Nessuna base aerea disponibile.', 'warn'); return; }
      const base = bases.includes(p.capital) ? p.capital : bases[0];
      const n = Math.min(WING_SIZE, Math.floor(p.airStock[id] || 0));
      if (n < 1) return;
      p.airStock[id] -= n;
      const w = createWing(S.player, id, base, n);
      log(`Formato il ${wingName(w)} a ${anBaseName(base)}.`, 'good');
    },
    anFac(arg) {
      const [id, dv] = arg.split(':').map(Number), p = C(S.player);
      const l = p.airLines.find(l => l.id === id);
      if (!l) return;
      const free = p.mil - airFactoriesUsed(p);
      l.factories = Math.max(0, l.factories + Math.min(dv, free));
    },
    anLineModel(id) {
      const p = C(S.player), l = p.airLines.find(l => l.id === +id);
      if (!l) return;
      const cur = designOf(l.design);
      anChoose('Cambia modello', designsOf(S.player, 'air').filter(d => d.id !== l.design).map(d => ({
        label: d.name, sub: `${AIR_ROLES[d.type].name} · ${d.type === cur.type ? `mantiene il ${Math.round((p.effRetention != null ? p.effRetention : AIR_EFF_RETAIN) * 100)}% dell'efficienza` : "l'efficienza riparte da zero"}`,
        fn: () => setAirLineDesign(p, l, d.id),
      })), `Linea attuale: ${cur.name}, efficienza ${Math.round(l.eff * 100)}%. Conviene spesso continuare a produrre un modello vecchio ad alta efficienza.`);
    },
    anLineDel(id) { const p = C(S.player); p.airLines = p.airLines.filter(l => l.id !== +id); },
    anNewLine() {
      const p = C(S.player);
      anChoose('Nuova linea di produzione', designsOf(S.player, 'air').map(d => ({
        label: d.name, sub: `${AIR_ROLES[d.type].name} · costo ${d.stats.cost}`,
        fn: () => addAirLine(p, d.id, Math.min(5, p.mil - airFactoriesUsed(p))),
      })));
    },
    anDesigner() { anOpenDesigner('air'); },
    anCopy(id) { anOpenDesigner('air', designOf(id)); },
  },
});
