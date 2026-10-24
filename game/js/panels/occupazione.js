'use strict';

// Pannello Occupazione: territori occupati per paese, resistenza, conformità, leggi e guarnigione.

UI.registerPanel({
  id: 'occupazione', title: 'Occupazione', icon: 'occupation', group: 'state', order: 95, width: 480,
  render(p) {
    const pc = S.player, st = S.occStats[pc];
    let h = `<h3>Territori occupati</h3>`;
    if (!st) h += `<p class="hint">Non occupi territori stranieri. Quando conquisti o annetti terre altrui, qui gestisci guarnigioni, resistenza e conformità.</p>`;
    else {
      h += `<div class="stats"><div><b>${st.tiles}</b><small>territori</small></div><div><b>${Math.round(st.res)}%</b><small>resistenza</small></div><div><b>${Math.round(st.comp)}%</b><small>conformità</small></div></div>
        <p>Guarnigione: 👥 ${fmt(st.mp)}/g · 🔫 ${st.eq.toFixed(1)}/g · copertura <span class="${st.eff < 0.8 ? 'bad' : 'good'}">${Math.round(st.eff * 100)}%</span><br>
        Estrazione: 🔫 +${st.extractEq.toFixed(1)}/g · 👥 +${fmt(st.extractMp)}/g</p>
        <p class="hint">Se non hai manodopera ed equipaggiamento per la guarnigione la resistenza cresce: sabotaggi, perdite e insurrezioni.</p>`;
      const cores = [...new Set(Occupation.tilesOf(pc).map(t => t.core))];
      for (const core of cores) {
        const c = C(core), n = Occupation.tilesOf(pc, core).length;
        const comp = Occupation.avgCompliance(pc, core), resv = Occupation.avgResistance(pc, core), law = Occupation.law(pc, core);
        h += `<div class="card"><div class="row"><b>${flag(c)} ${esc(c.name)}</b><small>${n} territori${!c.alive ? ' · annesso' : c.capitulated ? ' · capitolato' : ''}</small></div>
          <div class="row3"><small>Resist.</small>${bar(resv / 100, 'bad')}<small>Conform.</small>${bar(comp / 100, 'org')}</div>
          <p>Legge: <b>${OCC_LAWS[law].name}</b> · resistenza ${Math.round(resv)}% · conformità ${Math.round(comp)}%</p>
          <div class="row2">${Object.entries(OCC_LAWS).map(([k, L]) => `<button data-act="law" data-arg="${core}:${k}" title="${esc(L.desc)}" ${k !== law && comp >= L.req ? '' : 'disabled'}>${L.name}</button>`).join('')}</div>
          ${c.capitulated && atWar(pc, core) ? `<button data-act="collab" data-arg="${core}" ${comp >= 40 && Intel.network(pc, core) >= 25 && p.pp >= DIPLO_COST.collab ? '' : 'disabled'} title="Conformità ≥ 40%, rete di intelligence ≥ 25%">Governo collaborazionista (⭐${DIPLO_COST.collab})</button>` : ''}
        </div>`;
      }
    }
    const lost = S.tiles.filter(t => t.land && t.core === pc && Occupation.isOccupied(t));
    if (lost.length) {
      const avg = lost.reduce((s, t) => s + t.res, 0) / lost.length;
      h += `<h3>Il tuo popolo sotto occupazione</h3><p>${lost.length} territori occupati, resistenza media ${Math.round(avg)}%. Con l'operazione "Sostegno alla resistenza" (Intelligence) puoi armarla.</p>`;
    }
    return h;
  },
  actions: {
    law(arg) { const [core, law] = arg.split(':'); DP.do(Occupation.setLaw(S.player, core, law)); },
    collab(core) { DP.do(Diplo.collabGovernment(S.player, core)); },
  },
});
