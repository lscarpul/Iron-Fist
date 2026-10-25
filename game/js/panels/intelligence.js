'use strict';

// Pannello Intelligence: agenzia, agenti, reti nei paesi stranieri, operazioni.

const IP = {
  target() {
    const k = UI.intelTarget || UI.selCountry;
    return k && S.countries[k] && C(k).alive && k !== S.player ? k : null;
  },
};

document.addEventListener('change', e => {
  if (e.target && e.target.id === 'intel-target') { UI.intelTarget = e.target.value || null; UI.dirty = true; UI.lastPanel = ''; }
});

UI.registerPanel({
  id: 'intelligence', title: 'Intelligence', icon: 'intelligence', group: 'state', order: 90, width: 480,
  badge() { return S && Intel.freeAgents(S.player) || null; },
  render(p) {
    const pc = S.player, g = Intel.agency(pc);
    const free = Intel.freeAgents(pc);
    let h = `<h3>Agenzia di intelligence</h3>
      <div class="stats"><div><b>${g.level}</b><small>livello</small></div><div><b>${free}/${g.agents}</b><small>agenti liberi</small></div><div><b>${Math.round(Intel.counter(pc) * 100)}%</b><small>controspionaggio</small></div></div>`;
    const upCost = 50 * (g.level + 1);
    h += `<div class="row2"><button data-act="upgrade" ${g.level < 4 && p.pp >= upCost ? '' : 'disabled'}>Potenzia (⭐${upCost})</button>`;
    const counter = g.assign.some(x => x.mission === 'counter');
    h += counter ? `<button data-act="recallCounter">Richiama controspionaggio</button></div>` : `<button data-act="counter" ${free ? '' : 'disabled'}>Agente al controspionaggio</button></div>`;
    if (g.captured.length) h += `<p class="hint">${g.captured.length} agenti catturati (tornano disponibili col tempo).</p>`;

    const tk = IP.target();
    const opts = Object.keys(S.countries).filter(k => k !== pc && C(k).alive).sort((a, b) => C(a).name.localeCompare(C(b).name));
    h += `<h3>Bersaglio</h3><select id="intel-target"><option value="">— scegli un paese —</option>${opts.map(k => `<option value="${k}" ${k === tk ? 'selected' : ''}>${esc(C(k).name)}</option>`).join('')}</select>`;
    if (tk) {
      const t = C(tk), net = Intel.network(pc, tk);
      const mine = g.assign.filter(x => x.target === tk && x.mission === 'network').length;
      h += `<div class="card"><div class="row"><b>${flag(t)} Rete in ${esc(t.name)}</b><small>${Math.floor(net)}%</small></div>${bar(net / 100)}
        <p>${mine} agenti al lavoro · controspionaggio nemico ${Math.round(Intel.counter(tk) * 100)}% · bonus in combattimento +${((Intel.combatMod(pc, tk) - 1) * 100).toFixed(1)}%</p>
        <div class="row2"><button data-act="assign" ${free ? '' : 'disabled'}>Invia agente</button><button data-act="recall" ${mine ? '' : 'disabled'}>Richiama agente</button></div></div>`;
      h += `<h4>Operazioni</h4>`;
      for (const id in INTEL_OPS) {
        const op = INTEL_OPS[id], err = Intel.opCheck(pc, tk, id);
        h += `<div class="card ${err ? 'dim' : ''}"><div class="row"><b>${esc(op.name)}</b><small>rete ${op.net}% · ⭐${op.pp} · ${op.days} g</small></div><p>${esc(op.desc)}</p>
          ${err ? `<small>${esc(err)}</small>` : `<small>Successo: ${Math.round(Intel.successChance(pc, tk) * 100)}%</small>`}
          <button data-act="op" data-arg="${id}" ${err ? 'disabled' : ''}>Avvia</button></div>`;
      }
    }
    if (g.ops.length) {
      h += `<h3>Operazioni in corso</h3>`;
      for (const o of g.ops) h += `<div class="qrow"><span>${esc(INTEL_OPS[o.type].name)} · ${esc(C(o.target).name)}</span>${bar(1 - o.days / o.total)}<small>${o.days} g</small></div>`;
    }
    const nets = Object.entries(g.nets).sort((a, b) => b[1] - a[1]);
    if (nets.length) {
      h += `<h3>Reti</h3>`;
      for (const [k, v] of nets) h += `<div class="qrow"><span>${flag(C(k))} ${esc(C(k).name)}</span>${bar(v / 100)}<small>${Math.floor(v)}%</small></div>`;
    }
    const spies = Object.keys(S.intel).filter(k => k !== pc && Intel.network(k, pc) >= 10);
    if (spies.length) h += `<h3>Spie straniere</h3><p class="hint">Reti nemiche nel tuo paese: ${spies.map(k => `${esc(C(k).name)} ${Math.floor(Intel.network(k, pc))}%`).join(', ')}.</p>`;
    return h;
  },
  actions: {
    upgrade() { DP.do(Intel.upgradeAgency(S.player)); },
    counter() { DP.do(Intel.assign(S.player, S.player, 'counter')); },
    recallCounter() { DP.do(Intel.recall(S.player, S.player, 'counter')); },
    assign() { DP.do(Intel.assign(S.player, IP.target(), 'network')); },
    recall() { DP.do(Intel.recall(S.player, IP.target(), 'network')); },
    op(id) { DP.do(Intel.startOp(S.player, IP.target(), id)); },
  },
});
