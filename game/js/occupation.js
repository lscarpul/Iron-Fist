'use strict';

// Occupazione in stile HOI4 (La Résistance). Ogni territorio ricorda la nazione di cui è
// "nucleo" (t.core). Un territorio controllato da chi non è alleato del suo nucleo è occupato:
// ha una resistenza (t.res, 0-100) e una conformità (t.comp, 0-100).
// L'occupante paga ogni giorno una guarnigione in manodopera ed equipaggiamento; se non riesce
// a pagarla la resistenza cresce, arrivano sabotaggi e, al massimo, insurrezioni.
// La conformità alta rende i territori produttivi (estrazione di risorse) e sblocca leggi più miti.

const OCC_LAWS = {
  civile: { name: 'Supervisione civile', req: 35, garrison: 0.6, suppress: 0.6, res: -5, comp: 1.5, extract: 0.6, desc: 'Guarnigione leggera, conformità rapida, poca estrazione. Richiede conformità media ≥ 35%.' },
  polizia: { name: 'Polizia locale', req: 20, garrison: 0.8, suppress: 1.1, res: 0, comp: 1.2, extract: 0.75, desc: 'Equilibrio tra controllo e consenso. Richiede conformità media ≥ 20%.' },
  militare: { name: 'Governo militare', req: 0, garrison: 1, suppress: 1, res: 0, comp: 1, extract: 0.8, desc: 'La legge di partenza.' },
  pugno: { name: 'Pugno di ferro', req: 0, garrison: 1.4, suppress: 1.6, res: 15, comp: -1, extract: 1, desc: 'Repressione brutale: massima estrazione e soppressione, ma la conformità crolla e la resistenza cerca vendetta.' },
};
const GARRISON = { mp: 2, eq: 0.04 };

const Occupation = {
  init() {
    S.occLaw = {};   // occLaw[occupante][nucleo] = id legge
    S.occStats = {};
    const tilesOf = {};
    for (const t of S.tiles) if (t.land) tilesOf[t.owner] = (tilesOf[t.owner] || 0) + 1;
    for (const t of S.tiles) {
      if (!t.land) continue;
      t.core = t.owner;
      t.res = 0; t.comp = 0;
      const o = C(t.owner);
      t.ind = (o.civ + o.mil) / Math.max(1, tilesOf[t.owner]);
    }
  },

  isOccupied(t) {
    return !!(t.land && t.core && t.ctrl && t.ctrl !== t.core && !allied(t.ctrl, t.core));
  },
  law(occ, core) { return (S.occLaw[occ] && S.occLaw[occ][core]) || 'militare'; },
  tilesOf(occ, core) { return S.tiles.filter(t => t.land && t.ctrl === occ && (!core || t.core === core) && this.isOccupied(t)); },
  avgCompliance(occ, core) {
    const ts = this.tilesOf(occ, core);
    return ts.length ? ts.reduce((s, t) => s + t.comp, 0) / ts.length : 0;
  },
  avgResistance(occ, core) {
    const ts = this.tilesOf(occ, core);
    return ts.length ? ts.reduce((s, t) => s + t.res, 0) / ts.length : 0;
  },
  setLaw(occ, core, law) {
    const L = OCC_LAWS[law];
    if (!L) return { ok: false, msg: `Legge sconosciuta. Disponibili: ${Object.keys(OCC_LAWS).join(', ')}.` };
    if (!this.tilesOf(occ, core).length) return { ok: false, msg: `Non occupi territori di ${C(core).name}.` };
    const comp = this.avgCompliance(occ, core);
    if (comp < L.req) return { ok: false, msg: `${L.name} richiede conformità ≥ ${L.req}% (ora ${Math.floor(comp)}%).` };
    (S.occLaw[occ] || (S.occLaw[occ] = {}))[core] = law;
    return { ok: true, msg: `Territori di ${C(core).name}: legge "${L.name}".` };
  },
  // resistenza verso cui tende il territorio
  target(t) {
    const L = OCC_LAWS[this.law(t.ctrl, t.core)], core = C(t.core);
    let v = 35 + L.res - t.comp * 0.4 + (t.vp ? 5 : 0);
    if (core.alive && atWar(t.core, t.ctrl)) v += 15;
    if (core.capitulated) v += 10;
    const sup = S.resSupport[t.ctrl];
    if (sup && sup.until > S.day) v += sup.amount;
    return Math.max(0, Math.min(100, v));
  },

  daily() {
    const byOcc = {};
    for (const t of S.tiles) {
      if (!t.land) continue;
      if (!this.isOccupied(t)) {
        // territorio tornato al nucleo o in mano a un alleato: la resistenza si spegne
        if (t.res) t.res = Math.max(0, t.res - 1);
        if (t.ctrl === t.core && t.comp) t.comp = 0;
        continue;
      }
      (byOcc[t.ctrl] || (byOcc[t.ctrl] = [])).push(t);
    }
    S.occStats = {};
    for (const occ in byOcc) {
      const c = C(occ), ts = byOcc[occ];
      if (!c.alive) continue;
      // guarnigione richiesta
      let mp = 0, eq = 0;
      for (const t of ts) {
        const g = OCC_LAWS[this.law(occ, t.core)].garrison * (1 + t.res / 50) * (1 + t.vp / 20);
        mp += GARRISON.mp * g; eq += GARRISON.eq * g;
      }
      const eff = Math.min(1, c.manpower / Math.max(1, mp), c.equipment / Math.max(0.01, eq));
      c.manpower = Math.max(0, c.manpower - mp * eff);
      c.equipment = Math.max(0, c.equipment - eq * eff);
      const st = { tiles: ts.length, mp, eq, eff, extractEq: 0, extractMp: 0, attacks: 0, uprisings: 0, res: 0, comp: 0 };
      for (const t of ts) {
        const L = OCC_LAWS[this.law(occ, t.core)];
        t.res += (this.target(t) - t.res) * 0.02 - eff * L.suppress * 0.12;
        t.res = Math.max(0, Math.min(100, t.res));
        // la conformità cresce col tempo, frenata dalla resistenza (sopra il 60% cala)
        if (L.comp < 0) t.comp -= 0.04;
        else t.comp += 0.08 * L.comp * (1 - t.comp / 100) * (1 - t.res / 60);
        t.comp = Math.max(0, Math.min(100, t.comp));
        // estrazione: industria e manodopera dei territori occupati (non di quelli già annessi)
        if (t.owner !== occ) {
          const k = L.extract * (0.25 + 0.75 * t.comp / 100);
          st.extractEq += t.ind * 3 * 0.5 * k;
          st.extractMp += 1.5 * k;
        }
        // sabotaggi della resistenza
        if (t.res >= 40 && Math.random() < t.res / 4000) {
          st.attacks++;
          c.equipment = Math.max(0, c.equipment - 15);
          for (const d of S.byTile.get(t.i) || []) if (d.owner === occ) { d.org = Math.max(0, d.org - 10); d.str = Math.max(0.05, d.str - 0.01); }
        }
        // insurrezione: il territorio torna al legittimo proprietario
        if (t.res >= 90 && C(t.core).alive && atWar(t.core, occ) && !(S.byTile.get(t.i) || []).some(d => !d.dead && d.owner === occ) && Math.random() < 0.003) {
          st.uprisings++;
          t.ctrl = t.core; t.res = 50;
          if (!C(t.core).capitulated) { const d = createDiv(t.core, 'inf', t.i); d.str = 0.4; d.org = 20; }
          S.mapDirty = true;
          if (involvesPlayer(occ, t.core)) log(`Insurrezione! Un territorio di ${C(t.core).name} si libera da ${c.name}.`, occ === S.player ? 'bad' : 'good');
        }
        // dopo anni di piena conformità un territorio annesso diventa nucleo
        if (t.owner === occ && t.comp >= 95 && t.res < 5) { t.core = occ; t.res = 0; }
        st.res += t.res; st.comp += t.comp;
      }
      c.equipment += st.extractEq;
      c.manpower += st.extractMp;
      st.res /= ts.length; st.comp /= ts.length;
      S.occStats[occ] = st;
      if (occ === S.player && S.day % 30 === 0) {
        log(`Occupazione: ${ts.length} territori, resistenza media ${Math.round(st.res)}%, conformità ${Math.round(st.comp)}%, guarnigione ${Math.round(eff * 100)}%.`, eff < 0.8 || st.res > 60 ? 'warn' : '');
      }
    }
  },

  aiThink(c) {
    const occ = c.code;
    const cores = new Set(this.tilesOf(occ).map(t => t.core));
    for (const core of cores) {
      const comp = this.avgCompliance(occ, core), resv = this.avgResistance(occ, core);
      const st = S.occStats[occ];
      let want = 'militare';
      if (c.ideology === 'fascist' && resv > 60 && st && st.eff > 0.9) want = 'pugno';
      else if (comp >= OCC_LAWS.civile.req) want = 'civile';
      else if (comp >= OCC_LAWS.polizia.req) want = 'polizia';
      if (this.law(occ, core) !== want) this.setLaw(occ, core, want);
    }
  },

  tileInfo(ti) {
    const t = S.tiles[ti];
    if (!this.isOccupied(t)) return null;
    return { core: t.core, occupier: t.ctrl, res: t.res, comp: t.comp, law: this.law(t.ctrl, t.core) };
  },
};
