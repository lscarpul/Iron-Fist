'use strict';

// Interfaccia dell'economia: produzione (linee, MIO), costruzione, commercio e mercato, leggi.
// Con la shell nuova usa UI.registerPanel / registerSection / registerTopStat;
// con la UI di base sostituisce il pannello "Produzione" con delle sotto-schede.

const EconUI = {
  sub: 'linee', resOpen: null,

  pct: v => Math.round(v * 100) + '%',
  resIcon: r => `<span class="eco-res" title="${RESOURCES[r].name}">${RESOURCES[r].icon}</span>`,
  fail(r) { if (r && r.ok === false) log(r.reason, 'warn'); else if (r === false) log('Azione non possibile.', 'warn'); },

  // ---------- produzione ----------
  linesHtml(p) {
    const assigned = Econ.assignedMil(p), free = Econ.landMil(p) - assigned;
    let h = `<h3>Produzione militare</h3>
      <div class="stats"><div><b>${p.mil}</b><small>fabbriche mil.</small></div><div><b>${assigned}</b><small>assegnate</small></div>
      <div><b class="${free ? 'warn' : ''}">${free}</b><small>libere</small></div></div>
      <p class="hint">${INDUSTRY[p.industry].name} (livello ${Econ.industryLevel(p)}) · output +${this.pct(Econ.outputBonus(p))} · ritenzione ${this.pct(Econ.retention(p, {}))}</p>`;
    if (free > 0) h += `<p class="warn">${free} fabbriche militari non producono nulla: aggiungile a una linea.</p>`;
    p.lines.forEach((ln, i) => {
      const m = Econ.MODELS[ln.model], fam = Econ.FAMILIES[ln.fam], mio = Econ.mioOf(p, ln);
      const cap = Econ.effCap(p, ln);
      const models = fam.models.filter(x => Econ.modelAvailable(p, x));
      const mi = models.indexOf(m);
      const nextM = models[mi + 1], prevM = models[mi - 1];
      const ret = Econ.retention(p, ln);
      const res = Object.keys(m.res).map(r => `<span class="${ln.short.includes(r) ? 'bad' : ''}">${this.resIcon(r)}${m.res[r] * ln.factories}</span>`).join(' ');
      h += `<div class="card eco-line">
        <div class="row"><b>${fam.icon} ${esc(m.name)}</b><small>×${ln.factories} fabbriche</small></div>
        <div class="eco-eff" title="Efficienza ${this.pct(ln.eff)}, cap ${this.pct(cap)}">${bar(ln.eff, 'eff')}<i style="left:${(cap * 100).toFixed(1)}%"></i></div>
        <div class="row"><small>Efficienza <b>${this.pct(ln.eff)}</b> / ${this.pct(cap)}</small><small>${ln.out.toFixed(1)} pezzi/g</small></div>
        <div class="row"><small>Risorse: ${res || '—'}${ln.resF < 1 ? ` <span class="bad">(${this.pct(ln.resF)})</span>` : ''}</small>
          <small>MIO: <button class="eco-mini" data-act="eco_mio" data-arg="${ln.id}" title="Cambia organizzazione">${mio ? esc(mio.name) + ' ' + mio.size : 'nessuna'}</button></small></div>
        <div class="eco-btns">
          <button data-act="eco_fac" data-arg="${ln.id}:-5">−5</button><button data-act="eco_fac" data-arg="${ln.id}:-1">−1</button>
          <button data-act="eco_fac" data-arg="${ln.id}:1" ${free ? '' : 'disabled'}>+1</button><button data-act="eco_fac" data-arg="${ln.id}:5" ${free ? '' : 'disabled'}>+5</button>
          <button data-act="eco_model" data-arg="${ln.id}:${prevM ? prevM.id : ''}" ${prevM ? '' : 'disabled'} title="${prevM ? `Torna a ${esc(prevM.name)}: efficienza → ${this.pct(Math.max(0.1, ln.eff * ret))}` : ''}">‹</button>
          <button data-act="eco_model" data-arg="${ln.id}:${nextM ? nextM.id : ''}" ${nextM ? '' : 'disabled'} title="${nextM ? `Passa a ${esc(nextM.name)}: efficienza → ${this.pct(Math.max(0.1, ln.eff * ret))}` : 'Nessun modello più nuovo'}">${nextM ? 'Nuovo modello ›' : '›'}</button>
          <button data-act="eco_up" data-arg="${ln.id}" ${i ? '' : 'disabled'} title="Più priorità sulle risorse">↑</button>
          <button data-act="eco_rm" data-arg="${ln.id}" title="Chiudi la linea">✕</button>
        </div></div>`;
    });
    h += `<h4>Nuova linea</h4><div class="eco-btns">`;
    for (const f in Econ.FAMILIES) {
      const ok = Econ.familyAvailable(p, f);
      h += `<button data-act="eco_add" data-arg="${f}" ${ok ? '' : 'disabled'}>${Econ.FAMILIES[f].icon} ${esc(Econ.FAMILIES[f].short)}</button>`;
    }
    h += `</div><p class="hint">Una linea nuova parte dal 10% e cresce in fretta all'inizio, poi rallenta. Cambiare modello costa efficienza: meglio un modello vecchio al 100% che uno nuovo al 10%.</p>`;
    h += this.stockHtml(p);
    return h;
  },

  stockHtml(p) {
    let h = `<h3>Magazzino</h3><table class="tbl eco-tbl"><tr><th></th><th>Pezzi</th><th>/giorno</th><th>Qualità</th></tr>`;
    for (const f in Econ.FAMILIES) {
      const d = p.lines.filter(l => l.fam === f).reduce((s, l) => s + l.out, 0);
      h += `<tr><td>${Econ.FAMILIES[f].icon} ${esc(Econ.FAMILIES[f].short)}</td><td>${fmt(p.stock[f] || 0)}</td><td>${d ? '+' + d.toFixed(1) : '—'}</td><td>${this.pct(p.qual[f] || 1)}</td></tr>`;
    }
    h += `</table><p class="hint">⛽ Carburante: ${fmt(p.fuel)} (i corazzati senza carburante dimezzano velocità e attacco)</p>`;
    return h;
  },

  mioHtml(p) {
    let h = `<h3>Organizzazioni militari-industriali</h3><p class="hint">Le MIO crescono con la produzione delle linee a cui sono assegnate. Ogni livello dà un punto per un tratto.</p>`;
    for (const m of p.mios) {
      const need = 400 * (m.size + 1);
      const lines = p.lines.filter(l => l.mio === m.id).length;
      h += `<div class="card ${m.points ? 'cur' : ''}"><div class="row"><b>${Econ.FAMILIES[m.fam].icon} ${esc(m.name)}</b><small>livello ${m.size}${m.points ? ` · <span class="good">${m.points} punti</span>` : ''}</small></div>
        ${bar(m.funds / need)}<small>${lines} linee · fondi ${Math.floor(m.funds)}/${need}</small>`;
      if (m.traits.length) h += `<p>${m.traits.map(t => esc(MIO_TRAIT_BY_ID[t].name)).join(' · ')}</p>`;
      if (m.points) {
        h += '<div class="eco-btns">';
        for (const t of Econ.MIO_TRAITS) {
          if (m.traits.includes(t.id)) continue;
          const ok = !t.req || m.traits.includes(t.req);
          h += `<button data-act="eco_trait" data-arg="${m.id}:${t.id}" ${ok ? '' : 'disabled'} title="${esc(t.desc)}">${esc(t.name)}</button>`;
        }
        h += '</div>';
      }
      h += '</div>';
    }
    return h;
  },

  // ---------- costruzione ----------
  constructionHtml(p) {
    const cb = Econ.civBreakdown(p);
    const slots = `${p.civ + p.mil + p.construction.length}/${factoryCap(p)}`;
    let h = `<h3>Fabbriche civili</h3>
      <div class="stats"><div><b>${cb.total}</b><small>totali</small></div><div><b>${cb.cg}</b><small>beni di consumo</small></div><div><b class="good">${cb.avail}</b><small>disponibili</small></div></div>
      <p class="hint">Commercio: −${cb.tradeOut} per le importazioni, +${cb.tradeIn} dalle esportazioni · slot ${slots} · ${p.refineries} raffinerie</p>
      <h3>Costruisci</h3>`;
    for (const t in Econ.BUILDINGS) {
      const b = Econ.BUILDINGS[t];
      const sp = Econ.CONST.CP_PER_CIV * Econ.CONST.CIVS_PER_PROJECT * Math.max(0.1, 1 + Econ.constructionMod(p, t));
      const ok = Econ.canBuildType(p, t) && canBuild(p) && p.construction.length < 12;
      h += `<div class="card ${Econ.canBuildType(p, t) ? '' : 'dim'}"><div class="row"><b>${b.icon} ${esc(b.name)}</b><small>${fmt(b.cost)} PC · ~${Math.ceil(b.cost / sp)} g</small></div>
        ${t === 'ref' ? `<p>+${b.oil} petrolio al giorno.${b.year && ecoYear() < b.year ? ` Disponibile dal ${b.year}.` : ''}</p>` : ''}
        ${t === 'mil' && Econ.constructionMod(p, 'mil') ? `<p>Velocità ${Econ.constructionMod(p, 'mil') > 0 ? '+' : ''}${this.pct(Econ.constructionMod(p, 'mil'))} (leggi)</p>` : ''}
        <button data-act="eco_build" data-arg="${t}" ${ok ? '' : 'disabled'}>Metti in coda</button></div>`;
    }
    if (p.construction.length) {
      h += `<h4>Cantieri</h4>`;
      p.construction.forEach((j, i) => {
        const b = Econ.BUILDINGS[j.type];
        h += `<div class="qrow eco-q"><span>${b ? b.icon + ' ' + esc(b.name.split(' ')[0]) : esc(j.type)}</span>${bar(j.prog / j.cost)}<small>${j.civs} civ.</small>
          <button class="x" data-act="eco_qup" data-arg="${i}" ${i ? '' : 'disabled'} title="Priorità">↑</button><button class="x" data-act="eco_cancel" data-arg="${i}" title="Annulla">✕</button></div>`;
      });
      h += `<p class="hint">Ogni cantiere usa al massimo ${Econ.CONST.CIVS_PER_PROJECT} fabbriche civili, nell'ordine della coda.</p>`;
    }
    return h;
  },

  // ---------- commercio ----------
  tradeLawHtml(p) {
    let h = `<h3>Legge commerciale</h3>`;
    for (const id in Econ.TRADE_LAWS) {
      const l = Econ.TRADE_LAWS[id], cur = p.tradeLaw === id;
      h += `<div class="card ${cur ? 'cur' : ''}"><div class="row"><b>${esc(l.name)}</b><small>export ${this.pct(l.export)}</small></div><p>${esc(l.desc)}</p>
        ${cur ? '<small class="good">In vigore</small>' : `<button data-act="eco_tlaw" data-arg="${id}" ${p.pp >= LAW_COST.trade ? '' : 'disabled'}>Adotta (⭐${LAW_COST.trade})</button>`}</div>`;
    }
    return h;
  },

  tradeHtml(p) {
    const e = p.eco;
    let h = `<h3>Risorse</h3><table class="tbl eco-tbl"><tr><th></th><th title="Estratte">Estr.</th><th title="Al mercato per la legge commerciale">Merc.</th><th title="Importate">Imp.</th><th title="Disponibili">Disp.</th><th title="Fabbisogno delle linee">Fabb.</th></tr>`;
    for (const r of Econ.RES_IDS) {
      const bad = e.need[r] > e.avail[r];
      h += `<tr class="${this.resOpen === r ? 'sel' : ''}" data-act="eco_res" data-arg="${r}"><td>${this.resIcon(r)} ${RESOURCES[r].name}</td><td>${e.extracted[r]}</td><td>${e.exported[r] ? '−' + e.exported[r] : '0'}</td>
        <td>${e.imported[r] ? '+' + e.imported[r] : '0'}</td><td>${e.avail[r]}</td><td class="${bad ? 'bad' : ''}">${e.need[r]}</td></tr>`;
    }
    h += `</table><p class="hint">Clicca una risorsa per vedere chi la vende. 1 fabbrica civile ogni ${Econ.CONST.RES_PER_CIV} unità importate; chi esporta riceve le fabbriche.</p>`;
    if (this.resOpen) {
      const r = this.resOpen;
      const sellers = Object.keys(S.countries).filter(k => k !== S.player && C(k).alive && Econ.exportFree(k, r) > 0)
        .sort((a, b) => Econ.exportFree(b, r) - Econ.exportFree(a, r));
      h += `<h4>${this.resIcon(r)} ${RESOURCES[r].name} sul mercato</h4>`;
      if (!sellers.length) h += `<p class="hint">Nessuno vende ${RESOURCES[r].name.toLowerCase()} in questo momento.</p>`;
      for (const k of sellers.slice(0, 8)) {
        const free = Econ.exportFree(k, r), ok = Econ.tradeAllowed(k, S.player);
        h += `<div class="qrow eco-sell"><span>${flag(C(k))} ${esc(C(k).name)}</span><small>${free}/g</small>
          <button data-act="eco_imp" data-arg="${k}:${r}:8" ${ok ? '' : 'disabled'}>+8</button>
          <button data-act="eco_imp" data-arg="${k}:${r}:${free}" ${ok ? '' : 'disabled'} title="${ok ? `Tutto (${Math.ceil(free / 8)} fabbriche civili)` : 'Non commercia con te'}">Tutto</button></div>`;
      }
    }
    const mine = S.market.deals.filter(d => d.to === S.player || d.from === S.player);
    if (mine.length) {
      h += `<h4>Accordi in corso</h4>`;
      for (const d of mine) {
        const imp = d.to === S.player, o = C(imp ? d.from : d.to);
        h += `<div class="qrow eco-sell"><span>${imp ? '⬅' : '➡'} ${flag(o)} ${esc(o.name)}</span><small>${this.resIcon(d.res)} ${d.amount} · ${Math.ceil(d.amount / 8)} civ.</small><button class="x" data-act="eco_deal" data-arg="${d.id}" title="Annulla">✕</button></div>`;
      }
    }
    return h;
  },

  marketHtml(p) {
    let h = `<h3>Mercato internazionale</h3><p class="hint">Equipaggiamento venduto in cambio di fabbriche civili per 30 giorni.</p>`;
    const offers = S.market.listings.filter(l => l.seller !== S.player);
    if (offers.length) for (const l of offers.slice(0, 10)) {
      const ok = Econ.tradeAllowed(l.seller, S.player);
      h += `<div class="qrow eco-sell"><span>${flag(C(l.seller))} ${Econ.FAMILIES[l.fam].icon} ${fmt(l.qty)}</span><small>${l.civs} civ. · q ${this.pct(l.q)}</small><button data-act="eco_buy" data-arg="${l.id}" ${ok ? '' : 'disabled'}>Compra</button></div>`;
    } else h += `<p class="hint">Nessuna offerta.</p>`;
    const mine = S.market.listings.filter(l => l.seller === S.player);
    for (const l of mine) h += `<div class="qrow eco-sell"><span>In vendita: ${Econ.FAMILIES[l.fam].icon} ${fmt(l.qty)}</span><small>${l.civs} civ.</small><button class="x" data-act="eco_unlist" data-arg="${l.id}">✕</button></div>`;
    const cons = S.market.contracts.filter(k => k.buyer === S.player || k.seller === S.player);
    for (const k of cons) h += `<p class="hint">${k.buyer === S.player ? 'Ricevi' : 'Consegni'} ${Econ.FAMILIES[k.fam].icon} ${fmt(k.left)} ${k.buyer === S.player ? 'da' : 'a'} ${esc(C(k.buyer === S.player ? k.seller : k.buyer).name)} (${k.civs} civ.)</p>`;
    h += `<h4>Vendi il 20% del magazzino</h4><div class="eco-btns">`;
    for (const f in Econ.FAMILIES) {
      const q = Math.floor((p.stock[f] || 0) * 0.2);
      h += `<button data-act="eco_sell" data-arg="${f}" ${q > 0 ? '' : 'disabled'} title="${fmt(q)} pezzi per ${q > 0 ? Econ.listingPrice(f, q) : 0} fabbriche civili">${Econ.FAMILIES[f].icon} ${fmt(q)}</button>`;
    }
    return h + '</div>';
  },

  // ---------- leggi ----------
  lawsHtml(p) {
    let h = `<h3>Legge economica</h3>`;
    for (const id in Econ.ECON_LAWS) {
      const l = Econ.ECON_LAWS[id], cur = p.econLaw === id, av = Econ.econLawAvailable(p, id);
      h += `<div class="card ${cur ? 'cur' : av ? '' : 'dim'}"><div class="row"><b>${esc(l.name)}</b><small>beni di consumo ${this.pct(l.cg)}</small></div><p>${esc(l.desc)}</p>
        ${cur ? '<small class="good">In vigore</small>' : `<button data-act="eco_elaw" data-arg="${id}" ${av && p.pp >= LAW_COST.econ ? '' : 'disabled'}>Adotta (⭐${LAW_COST.econ})</button>`}</div>`;
    }
    h += `<h3>Dottrina industriale</h3>`;
    for (const id of ['concentrata', 'dispersa']) {
      const d = Econ.INDUSTRY[id], cur = p.industry === id;
      h += `<div class="card ${cur ? 'cur' : ''}"><b>${esc(d.name)}</b><p>${esc(d.desc)}</p>
        ${cur ? `<small class="good">In uso, livello ${Econ.industryLevel(p)}</small>` : `<button data-act="eco_ind" data-arg="${id}" ${p.pp >= LAW_COST.industry ? '' : 'disabled'}>Riconverti (⭐${LAW_COST.industry})</button>`}</div>`;
    }
    return h;
  },

  // ---------- azioni ----------
  act(name, arg) {
    const p = C(S.player);
    const a = String(arg ?? '').split(':');
    switch (name) {
      case 'eco_sub': this.sub = arg; break;
      case 'eco_fac': { const ln = Econ.line(p, a[0]); if (ln) Econ.setLineFactories(p, ln.id, ln.factories + +a[1]); break; }
      case 'eco_model': if (a[1]) this.fail(Econ.changeModel(p, a[0], a[1])); break;
      case 'eco_mio': {
        const ln = Econ.line(p, a[0]);
        if (!ln) break;
        const opts = [null, ...p.mios.filter(m => m.fam === ln.fam).map(m => m.id)];
        Econ.assignMio(p, ln.id, opts[(opts.indexOf(ln.mio) + 1) % opts.length]);
        break;
      }
      case 'eco_up': Econ.moveLine(p, a[0], -1); break;
      case 'eco_rm': Econ.removeLine(p, a[0]); break;
      case 'eco_add': {
        const ln = Econ.addLine(p, arg);
        if (ln) { ln.mio = (p.mios.find(m => m.fam === arg) || {}).id || null; Econ.setLineFactories(p, ln.id, 1); }
        break;
      }
      case 'eco_build': if (!Econ.queueBuild(p, arg)) log('Nessuno slot libero o coda piena.', 'warn'); break;
      case 'eco_cancel': p.construction.splice(+arg, 1); break;
      case 'eco_qup': { const i = +arg; if (i > 0) [p.construction[i - 1], p.construction[i]] = [p.construction[i], p.construction[i - 1]]; break; }
      case 'eco_tlaw': this.fail(Econ.setTradeLaw(p, arg)); break;
      case 'eco_elaw': this.fail(Econ.setEconLaw(p, arg)); break;
      case 'eco_ind': this.fail(Econ.setIndustry(p, arg)); break;
      case 'eco_res': this.resOpen = this.resOpen === arg ? null : arg; break;
      case 'eco_imp': this.fail(Econ.proposeImport(S.player, a[0], a[1], +a[2])); break;
      case 'eco_deal': Econ.cancelDeal(arg); break;
      case 'eco_sell': this.fail(Econ.listEquipment(S.player, arg, Math.floor((p.stock[arg] || 0) * 0.2))); break;
      case 'eco_buy': this.fail(Econ.buyListing(S.player, arg)); break;
      case 'eco_unlist': Econ.cancelListing(arg); break;
      case 'eco_trait': this.fail(Econ.learnTrait(p, a[0], a[1])); break;
      default: return false;
    }
    UI.dirty = true;
    UI.lastPanel = '';
    return true;
  },
  actionMap() {
    const m = {};
    for (const n of ['eco_sub', 'eco_fac', 'eco_model', 'eco_mio', 'eco_up', 'eco_rm', 'eco_add', 'eco_build', 'eco_cancel', 'eco_qup',
      'eco_tlaw', 'eco_elaw', 'eco_ind', 'eco_res', 'eco_imp', 'eco_deal', 'eco_sell', 'eco_buy', 'eco_unlist', 'eco_trait'])
      m[n] = arg => this.act(n, arg);
    return m;
  },

  topStats() {
    const p = C(S.player), e = p.eco;
    const short = Econ.RES_IDS.filter(r => e.need[r] > e.avail[r]);
    const tip = Econ.RES_IDS.map(r => `${RESOURCES[r].icon} ${RESOURCES[r].name}: ${e.avail[r]} disponibili / ${e.need[r]} richiesti`).join('<br>');
    return { short, tip };
  },

  // shell nuova
  registerShell() {
    const actions = this.actionMap();
    UI.registerPanel({ id: 'produzione', title: 'Produzione', icon: 'factory', group: 'state', order: 40, width: 480,
      render: p => this.linesHtml(p) + this.mioHtml(p), actions,
      badge: p => (Econ.landMil(p) - Econ.assignedMil(p)) || null });
    UI.registerPanel({ id: 'costruzione', title: 'Costruzione', icon: 'build', group: 'state', order: 41, width: 440,
      render: p => this.constructionHtml(p), actions });
    UI.registerPanel({ id: 'commercio', title: 'Commercio', icon: 'trade', group: 'state', order: 42, width: 480,
      render: p => this.tradeLawHtml(p) + this.tradeHtml(p) + this.marketHtml(p), actions });
    UI.registerSection('politica', { id: 'leggi-economia', order: 60, render: p => this.lawsHtml(p), actions });
    if (UI.registerTopStat) {
      for (const r of Econ.RES_IDS) UI.registerTopStat({ id: 'res-' + r, order: 80 + Econ.RES_IDS.indexOf(r), icon: RESOURCES[r].icon,
        value: p => { const e = p.eco, net = e.avail[r] - e.need[r]; return `<span class="${net < 0 ? 'bad' : ''}">${net >= 0 ? '+' : ''}${net}</span>`; },
        tip: p => `<b>${RESOURCES[r].name}</b><br>Estratto ${p.eco.extracted[r]}, al mercato −${p.eco.exported[r]}, importato +${p.eco.imported[r]}<br>Disponibile ${p.eco.avail[r]}, richiesto dalle linee ${p.eco.need[r]}` });
      UI.registerTopStat({ id: 'carburante', order: 86, icon: '⛽', value: p => fmt(p.fuel), tip: () => 'Carburante per i corazzati (dal petrolio non usato dalle fabbriche)' });
    }
  },

  // UI di base: sotto-schede nel pannello Produzione
  registerFallback() {
    const SUBS = [['linee', 'Linee'], ['cantieri', 'Cantieri'], ['commercio', 'Commercio'], ['leggi', 'Leggi'], ['mio', 'MIO'], ['recluta', 'Reclute']];
    const origProd = UI.panel_produzione;
    UI.panel_produzione = function () {
      const p = C(S.player), me = EconUI;
      let h = `<div class="eco-subs">${SUBS.map(([id, n]) => `<button class="${me.sub === id ? 'on' : ''}" data-act="eco_sub" data-arg="${id}">${n}</button>`).join('')}</div>`;
      if (me.sub === 'linee') h += me.linesHtml(p);
      else if (me.sub === 'cantieri') h += me.constructionHtml(p);
      else if (me.sub === 'commercio') h += me.tradeLawHtml(p) + me.tradeHtml(p) + me.marketHtml(p);
      else if (me.sub === 'leggi') h += me.lawsHtml(p);
      else if (me.sub === 'mio') h += me.mioHtml(p);
      else h += me.recruitHtml(p);
      return h;
    };
    const origAct = UI.act;
    UI.act = function (name, arg) {
      if (EconUI.act(name, arg)) return;
      return origAct.call(this, name, arg);
    };
    const origTop = UI.renderTop;
    UI.renderTop = function () {
      origTop.call(this);
      const p = C(S.player), { short, tip } = EconUI.topStats();
      const eq = [...document.querySelectorAll('#tb-res .res')].find(el => el.title.startsWith('Equipaggiamento'));
      if (eq) {
        const d = p.lines.filter(l => l.fam === 'fanteria').reduce((s, l) => s + l.out, 0);
        eq.innerHTML = `🔫 ${fmt(p.stock.fanteria)} <small>+${Math.round(d)}/g</small>`;
        eq.title = 'Equipaggiamento di fanteria in magazzino';
      }
      const span = document.createElement('span');
      span.className = 'res' + (short.length ? ' war' : '');
      span.title = tip.replace(/<br>/g, '\n');
      span.innerHTML = short.length ? `⛏️ Mancano: ${short.map(r => RESOURCES[r].icon).join('')}` : '⛏️ Risorse ok';
      const fuel = document.createElement('span');
      fuel.className = 'res'; fuel.title = 'Carburante'; fuel.textContent = `⛽ ${fmt(p.fuel)}`;
      const war = document.querySelector('#tb-res .war:not(.eco), #tb-res .peace');
      $('tb-res').insertBefore(span, war); $('tb-res').insertBefore(fuel, war);
    };
    const origTip = UI.tileTip;
    UI.tileTip = function (ti) { return origTip.call(this, ti) + Econ.tileTip(S.tiles[ti]); };
    this.origProd = origProd;
  },

  // reclutamento (UI di base): stesso contenuto di prima, con i costi in equipaggiamento per famiglia
  recruitHtml(p) {
    let h = `<h3>Reclutamento</h3>`;
    for (const type in UNIT_TYPES) {
      const ut = UNIT_TYPES[type];
      const locked = type === 'arm' && !p.armorTech;
      const n = Econ.needsOf(type);
      const cost = Object.keys(n).map(f => `<span class="${(p.stock[f] || 0) < n[f] ? 'bad' : ''}">${Econ.FAMILIES[f] ? Econ.FAMILIES[f].icon : f} ${fmt(n[f])}</span>`).join(' ');
      h += `<div class="card ${locked ? 'dim' : ''}"><div class="row"><b>${ut.name}</b><small>${ut.days} giorni</small></div>
        <p>Att ${ut.atk} · Dif ${ut.def} · Org ${ut.org} · Vel ${ut.speed}</p>
        <p>${cost} · 👥 ${fmt(ut.mp)}</p>
        ${locked ? '<small>Sblocca con il focus “Ricerca corazzata”</small>' : ''}
        <button data-act="recruit" data-arg="${type}" ${canRecruit(p, type) ? '' : 'disabled'}>Recluta</button></div>`;
    }
    if (p.training.length) {
      h += `<h4>In addestramento</h4>`;
      for (const tr of p.training) h += `<div class="qrow"><span>${UNIT_TYPES[tr.type].name}</span>${bar(1 - tr.days / tr.total)}<small>${tr.days} g</small></div>`;
    }
    return h;
  },
};

if (typeof UI.registerPanel === 'function') EconUI.registerShell();
else EconUI.registerFallback();
