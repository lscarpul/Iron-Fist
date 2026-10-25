'use strict';

// Spionaggio in stile HOI4 (La Résistance): ogni paese ha un'agenzia con un numero di agenti.
// Gli agenti costruiscono reti di intelligence nei paesi bersaglio (0-100%) o fanno
// controspionaggio in patria. Con una rete abbastanza forte si lanciano operazioni.
// La rete dà anche un bonus in combattimento contro quel paese.

const INTEL_OPS = {
  sabotaggio: {
    name: 'Sabotaggio industriale', net: 30, pp: 30, days: 40,
    desc: 'Distrugge una fabbrica militare, il 10% dell\'equipaggiamento e rallenta i cantieri.',
    apply(a, t) {
      t.mil = Math.max(1, t.mil - 1);
      t.equipment *= 0.9;
      for (const j of t.construction) j.prog *= 0.7;
    },
  },
  progetti: {
    name: 'Furto di progetti', net: 40, pp: 35, days: 50,
    desc: 'Ruba progetti militari: +1 bonus di ricerca anticipata; se il bersaglio ha i corazzati e tu no, li sblocchi.',
    apply(a, t) {
      a.blueprints = (a.blueprints || 0) + 1;
      if (t.armorTech && !a.armorTech) a.armorTech = true;
    },
  },
  propaganda: {
    name: 'Campagna di propaganda', net: 25, pp: 25, days: 30,
    desc: 'Per 180 giorni il bersaglio guadagna 0,3 potere politico in meno al giorno.',
    apply(a, t) { Intel.addEffect(t.code, 'ppGain', -0.3, 180); },
  },
  resistenza: {
    name: 'Sostegno alla resistenza', net: 30, pp: 25, days: 45,
    desc: 'Arma la resistenza nei territori occupati dal bersaglio: +15 resistenza subito e più crescita per 180 giorni.',
    apply(a, t) {
      S.resSupport[t.code] = { until: S.day + 180, amount: 15 };
      for (const tl of S.tiles) if (tl.land && tl.ctrl === t.code && Occupation.isOccupied(tl)) tl.res = Math.min(100, (tl.res || 0) + 15);
    },
  },
  collaborazione: {
    name: 'Preparare un governo collaborazionista', net: 50, pp: 50, days: 60, war: true,
    desc: 'Il bersaglio capitola prima: soglia di resa più bassa del 10% (fino a 30%).',
    apply(a, t) { t.collabBonus = Math.min(0.3, t.collabBonus + 0.1); },
  },
  decrittazione: {
    name: 'Decrittazione dei codici', net: 50, pp: 40, days: 60,
    desc: 'Per 180 giorni il bonus di combattimento della rete contro il bersaglio raddoppia.',
    apply(a, t) { S.decrypt[a.code + t.code] = S.day + 180; },
  },
  colpo: {
    name: 'Colpo di stato', net: 70, pp: 100, days: 90, peace: true, minor: true,
    desc: 'Installa un governo della tua ideologia in un paese minore in pace con te; se hai una fazione, ci entra.',
    apply(a, t) {
      t.ideology = a.ideology;
      if (t.faction) leaveFaction(t.code);
      Diplo.addRel(t.code, a.code, 50);
      Diplo.addTension(TENSION_GAIN.coup);
      if (a.faction && !t.overlord && !S.factions[a.faction].members.some(m => atWar(m, t.code))) joinFaction(t.code, a.faction);
      S.mapDirty = true;
    },
  },
};

const Intel = {
  init() {
    S.intel = {};
    S.resSupport = {};
    S.decrypt = {};
    S.effects = [];
    for (const k in S.countries) {
      const c = S.countries[k];
      S.intel[k] = { level: 0, agents: c.major ? 2 : 1, assign: [], nets: {}, ops: [], captured: [] };
    }
  },

  agency(code) { return S.intel[code]; },
  network(a, b) { return (S.intel[a] && S.intel[a].nets[b]) || 0; },
  counter(code) {
    const g = S.intel[code];
    if (!g) return 0;
    return Math.min(0.6, 0.15 * g.assign.filter(x => x.mission === 'counter').length + 0.05 * g.level);
  },
  busy(code) {
    const g = S.intel[code];
    return g.assign.length + g.ops.length + g.captured.length;
  },
  freeAgents(code) { return Math.max(0, S.intel[code].agents - this.busy(code)); },

  upgradeAgency(code) {
    const g = S.intel[code];
    if (g.level >= 4) return { ok: false, msg: 'Agenzia già al livello massimo.' };
    const cost = 50 * (g.level + 1);
    if (!Diplo.spend(code, cost)) return Diplo.needPP(cost);
    g.level++; g.agents++;
    return { ok: true, msg: `Agenzia potenziata al livello ${g.level}: ${g.agents} agenti.` };
  },
  assign(code, target, mission = 'network') {
    const g = S.intel[code];
    if (mission === 'counter') target = code;
    else {
      const e = Diplo.check(code, target); if (e) return { ok: false, msg: e };
    }
    if (!this.freeAgents(code)) return { ok: false, msg: 'Nessun agente libero: richiamane uno o potenzia l\'agenzia.' };
    g.assign.push({ target, mission });
    return { ok: true, msg: mission === 'counter' ? 'Agente assegnato al controspionaggio.' : `Agente inviato a costruire una rete in ${C(target).name}.` };
  },
  recall(code, target, mission) {
    const g = S.intel[code];
    const i = g.assign.findIndex(x => (!target || x.target === target) && (!mission || x.mission === mission));
    if (i < 0) return { ok: false, msg: 'Nessun agente corrispondente.' };
    g.assign.splice(i, 1);
    return { ok: true, msg: 'Agente richiamato.' };
  },
  successChance(a, b) { return Math.max(0.1, Math.min(0.95, 0.45 + this.network(a, b) / 200 - this.counter(b))); },
  opCheck(a, b, id) {
    const op = INTEL_OPS[id];
    if (!op) return `Operazione sconosciuta. Disponibili: ${Object.keys(INTEL_OPS).join(', ')}.`;
    const e = Diplo.check(a, b); if (e) return e;
    if (this.network(a, b) < op.net) return `Serve una rete del ${op.net}% in ${C(b).name} (ora ${Math.floor(this.network(a, b))}%).`;
    if (op.war && !atWar(a, b)) return 'Solo contro un paese con cui sei in guerra.';
    if (op.peace && atWar(a, b)) return 'Non contro un paese con cui sei in guerra.';
    if (op.minor && C(b).major) return 'Non contro una grande potenza.';
    if (op.minor && C(b).overlord) return 'Il bersaglio è un suddito.';
    if (S.intel[a].ops.some(o => o.target === b && o.type === id)) return 'Operazione già in corso.';
    // l'operazione usa un agente libero, oppure uno di quelli che lavorano alla rete su quel paese
    if (!this.freeAgents(a) && !S.intel[a].assign.some(x => x.target === b)) return 'Nessun agente disponibile.';
    if (C(a).pp < op.pp) return `Potere politico insufficiente (servono ${op.pp}).`;
    return null;
  },
  startOp(a, b, id) {
    const e = this.opCheck(a, b, id);
    if (e) return { ok: false, msg: e };
    const op = INTEL_OPS[id], g = S.intel[a];
    if (!this.freeAgents(a)) g.assign.splice(g.assign.findIndex(x => x.target === b), 1);
    C(a).pp -= op.pp;
    g.ops.push({ type: id, target: b, days: op.days, total: op.days });
    return { ok: true, msg: `${op.name} contro ${C(b).name} avviata: ${op.days} giorni, probabilità di successo ${Math.round(this.successChance(a, b) * 100)}%.` };
  },
  addEffect(code, stat, amount, days) {
    C(code)[stat] += amount;
    S.effects.push({ code, stat, amount, until: S.day + days });
  },

  // moltiplicatore per l'attacco/difesa di `a` contro `b`
  combatMod(a, b) {
    const net = this.network(a, b);
    if (!net) return 1;
    const dec = (S.decrypt[a + b] || 0) > S.day ? 2 : 1;
    return 1 + 0.08 * dec * net / 100;
  },

  daily() {
    for (let i = S.effects.length - 1; i >= 0; i--) {
      const e = S.effects[i];
      if (e.until > S.day) continue;
      if (S.countries[e.code]) S.countries[e.code][e.stat] -= e.amount;
      S.effects.splice(i, 1);
    }
    for (const k in S.intel) {
      const g = S.intel[k], c = C(k);
      if (!c.alive) continue;
      g.captured = g.captured.filter(x => x.until > S.day);
      const working = new Set();
      for (const x of g.assign) {
        if (x.mission !== 'network' || !C(x.target).alive) continue;
        working.add(x.target);
        g.nets[x.target] = Math.min(100, this.network(k, x.target) + 0.2 * (1 + 0.1 * g.level) * (1 - this.counter(x.target)));
      }
      for (const t in g.nets) if (!working.has(t)) { g.nets[t] = Math.max(0, g.nets[t] - 0.05); if (!g.nets[t]) delete g.nets[t]; }
      g.assign = g.assign.filter(x => x.mission === 'counter' || C(x.target).alive);
      for (let i = g.ops.length - 1; i >= 0; i--) {
        const o = g.ops[i];
        if (--o.days > 0) continue;
        g.ops.splice(i, 1);
        const op = INTEL_OPS[o.type], t = C(o.target);
        if (!t.alive) continue;
        const me = involvesPlayer(k) && k === S.player, them = o.target === S.player;
        if (Math.random() < this.successChance(k, o.target)) {
          op.apply(c, t);
          if (me) log(`Spionaggio: ${op.name} in ${t.name} riuscita!`, 'good');
          else if (them) log(`Spionaggio nemico: ${c.name} ha condotto "${op.name}" contro di noi.`, 'bad');
        } else {
          g.captured.push({ until: S.day + 90 });
          g.nets[o.target] = Math.max(0, this.network(k, o.target) - 20);
          Diplo.addRel(o.target, k, -20);
          if (me) log(`Spionaggio: ${op.name} in ${t.name} fallita, un agente è stato catturato.`, 'bad');
          else if (them) log(`Il controspionaggio ha catturato un agente di ${c.name} (${op.name}).`, 'good');
        }
      }
    }
  },

  // IA dei paesi: reti sui nemici (o sui prossimi bersagli), controspionaggio in guerra, qualche operazione
  aiThink(c) {
    const code = c.code, g = S.intel[code];
    const enemies = enemiesOf(code).filter(e => !C(e).capitulated);
    const planned = typeof plannedTarget === 'function' ? plannedTarget(code) : null;
    const targets = enemies.length ? enemies : planned ? [planned] : [];
    if (!targets.length && c.major) {
      let best = null, bo = 0;
      for (const k in S.countries) if (k !== code && C(k).alive && C(k).major && Diplo.opinion(code, k) < bo) { bo = Diplo.opinion(code, k); best = k; }
      if (best) targets.push(best);
    }
    if (enemies.length && g.agents >= 2 && !g.assign.some(x => x.mission === 'counter') && this.freeAgents(code)) this.assign(code, code, 'counter');
    for (const t of targets) {
      if (!this.freeAgents(code)) break;
      if (!g.assign.some(x => x.target === t)) this.assign(code, t);
    }
    if (!c.major || c.pp < 120 || Math.random() > 0.3) return;
    const t = targets[0];
    if (!t) return;
    const prefs = atWar(code, t) ? ['collaborazione', 'decrittazione', 'sabotaggio', 'resistenza'] : ['progetti', 'propaganda', 'sabotaggio'];
    for (const id of prefs) if (!this.opCheck(code, t, id)) { this.startOp(code, t, id); break; }
  },
};
