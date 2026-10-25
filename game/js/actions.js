'use strict';

// Registro delle azioni che il governo (IA testuale) può eseguire per conto del giocatore,
// più il sistema di relazioni: opinione con modificatori che decadono, patti di non aggressione
// e valutazione delle proposte da parte delle altre nazioni.
//
// Altri moduli possono aggiungere azioni con:
//   GameActions.register({ name, description, input_schema, run(input) })
// run agisce per S.player e ritorna una stringa o un oggetto (l'esito), oppure lancia un Error
// con il motivo del fallimento. Con GameActions.registerContext(fn) si aggiungono righe allo
// stato della partita che l'IA riceve a ogni ordine (fn ritorna una stringa o null).

// var (non const) così è visibile anche come window.GameActions agli altri moduli
var GameActions = {
  _list: [],
  _ctx: [],
  register(def) {
    if (!def || !/^[a-z][a-z0-9_]{0,63}$/.test(def.name) || typeof def.run !== 'function') throw new Error('Azione non valida');
    this._list = this._list.filter(a => a.name !== def.name);
    this._list.push(def);
  },
  registerContext(fn) { this._ctx.push(fn); },
  // definizioni per l'API (ordinate per nome, così restano identiche per tutta la conversazione)
  // Le azioni "fallback" (diplomazia ed economia di base) spariscono quando è caricato il modulo
  // che possiede quell'area (Diplo, Econ), così l'IA non vede doppioni.
  // mode: 'government' (solo azioni del nostro governo) o 'narrator' (anche le modifiche libere del mondo)
  active(mode = 'government') {
    return this._list.filter(a => (!a.fallback || !moduleLoaded(a.fallback)) && (!a.mode || a.mode === mode));
  },
  tools(mode) {
    return [...this.active(mode)].sort((a, b) => a.name < b.name ? -1 : 1).map(a => ({
      name: a.name, description: a.description,
      input_schema: a.input_schema || { type: 'object', properties: {} },
    }));
  },
  exec(name, input, mode) {
    const a = this.active(mode).find(x => x.name === name);
    if (!a) return { ok: false, error: `Azione sconosciuta: ${name}` };
    try {
      const r = a.run(input || {});
      UI.dirty = true; UI.lastPanel = '';
      // accetta anche la forma { ok, msg } usata da altri moduli
      if (r && typeof r === 'object' && r.ok === false) return { ok: false, error: String(r.msg || r.error || 'Azione non riuscita') };
      if (r && typeof r === 'object' && r.ok === true && typeof r.msg === 'string' && Object.keys(r).length === 2) return { ok: true, result: r.msg };
      return { ok: true, result: typeof r === 'string' ? r : JSON.stringify(r) };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  },
  context() {
    const out = [];
    for (const fn of this._ctx) {
      try { const s = fn(); if (s) out.push(s); } catch (e) { /* un modulo rotto non blocca il resto */ }
    }
    return out.join('\n');
  },
};

// con la diplomazia completa (Diplo) opinione e patti sono i suoi, altrimenti quelli di Rel
const relOpinion = (a, b) => typeof Diplo !== 'undefined' ? Diplo.opinion(a, b) : Rel.opinion(a, b);
const relHasPact = (a, b) => typeof Diplo !== 'undefined' && S.naps ? Diplo.hasNap(a, b) : Rel.hasPact(a, b);
const relPacts = code => typeof Diplo !== 'undefined' && S.naps ? S.naps.filter(n => n.a === code || n.b === code).map(n => n.a === code ? n.b : n.a)
  : Rel.st().pacts.filter(x => x.a === code || x.b === code).map(x => x.a === code ? x.b : x.a);
// focus: alberi nazionali (focus.js) o elenco di base (data.js)
const focusOf = (c, id) => typeof focusById === 'function' ? focusById(c, id) : FOCUS_BY_ID[id];
const focusList = c => typeof focusTree === 'function' ? focusTree(c).focuses : FOCUSES;

function moduleLoaded(area) {
  if (area === 'diplomacy') return typeof Diplo !== 'undefined';
  if (area === 'economy') return typeof Econ !== 'undefined';
  return false;
}

// ---------- relazioni ----------
const Rel = {
  // rapporti storici di partenza (simmetrici)
  HIST: {
    GF: -25, GP: -20, GS: -50, GC: -15, GU: -10, SP: -30, SK: -40, SX: -25, ST: -10, SR: -20,
    HR: -30, HC: -20, HY: -10, IY: -20, IQ: -15, IE: 10, LQ: -15, LR: -15, LY: -10, TQ: -15,
    FU: 20, FP: 15, FC: 20, FB: 15, UB: 10, UQ: 10, UO: 20, GI: 10, GH: 10, IH: 15, IA: 10,
    WN: 20, WK: 20, DN: 20, DW: 15, KX: 10, PR: 10, CY: 15, RY: 15, EO: 15,
  },
  MAX_MOD: 100,

  st() {
    if (!S.rel) S.rel = { mods: [], pacts: [], cool: {} };
    return S.rel;
  },
  hist(a, b) { return this.HIST[a + b] ?? this.HIST[b + a] ?? 0; },
  modValue(m) {
    const left = Math.abs(m.v) - m.decay * (S.day - m.day) / 30;
    return left <= 0 ? 0 : Math.sign(m.v) * left;
  },
  // modificatore che "a" ha verso "b"
  addMod(a, b, v, decay, why) {
    if (a === b || !C(a)?.alive) return;
    const r = this.st();
    r.mods = r.mods.filter(m => this.modValue(m) !== 0);
    r.mods.push({ a, b, v, decay, day: S.day, why });
    UI.dirty = true;
  },
  // elenco delle voci che compongono l'opinione di a verso b
  breakdown(a, b) {
    if (moduleLoaded('diplomacy')) return [[Math.round(Diplo.opinion(a, b)), 'Opinione']];
    const out = [];
    const h = this.hist(a, b);
    if (h) out.push([h, h > 0 ? 'Legami storici' : 'Rivalità storica']);
    if (atWar(a, b)) out.push([-100, 'In guerra']);
    else {
      if (allied(a, b)) out.push([40, 'Stessa fazione']);
      if (S.guarantees.some(g => g.by === b && g.to === a)) out.push([20, 'Ci garantisce l\'indipendenza']);
      if (S.guarantees.some(g => g.by === a && g.to === b)) out.push([10, 'Gli garantiamo l\'indipendenza']);
      if (this.hasPact(a, b)) out.push([15, 'Patto di non aggressione']);
      const ea = enemiesOf(a), eb = new Set(enemiesOf(b));
      if (ea.some(e => eb.has(e))) out.push([25, 'Nemico comune']);
      const ia = C(a).faction, ib = C(b).faction;
      if (ia && ib && ia !== ib) out.push([-15, 'Fazioni rivali']);
    }
    for (const m of this.st().mods) {
      if (m.a !== a || m.b !== b) continue;
      const v = this.modValue(m);
      if (v) out.push([Math.round(v), m.why]);
    }
    return out;
  },
  opinion(a, b) {
    if (a === b) return 100;
    if (moduleLoaded('diplomacy')) return Math.round(Diplo.opinion(a, b));
    let s = 0;
    for (const [v] of this.breakdown(a, b)) s += v;
    return Math.max(-100, Math.min(100, Math.round(s)));
  },

  hasPact(a, b) { return this.st().pacts.some(p => (p.a === a && p.b === b) || (p.a === b && p.b === a)); },
  removePact(a, b) { const r = this.st(); r.pacts = r.pacts.filter(p => !((p.a === a && p.b === b) || (p.a === b && p.b === a))); },

  // potenza militare grezza di un paese
  power(code) {
    const c = C(code);
    if (!c || !c.alive) return 0;
    let p = c.mil * 25 + c.civ * 6;
    for (const d of S.divs) if (d.owner === code && !d.dead) p += (UNIT_TYPES[d.type].atk + UNIT_TYPES[d.type].def) * d.str;
    return p;
  },
  // potenza del paese più chi lo difenderebbe (fazione + garanti)
  sidePower(code) {
    const side = new Set(membersOf(code));
    for (const g of S.guarantees) if (g.to === code && C(g.by).alive) membersOf(g.by).forEach(x => side.add(x));
    let p = 0;
    for (const x of side) p += this.power(x);
    return { p, side: [...side] };
  },
  // quota (pesata) del territorio di "code" controllata da "by" e dai suoi alleati
  occupied(code, by) {
    let tot = 0, occ = 0;
    for (const t of S.tiles) {
      if (!t.land || t.owner !== code) continue;
      const w = 1 + t.vp;
      tot += w;
      if (t.ctrl !== code && (t.ctrl === by || allied(t.ctrl, by))) occ += w;
    }
    return tot ? occ / tot : 0;
  },
  cooldownLeft(key) { const d = this.st().cool[key]; return d == null ? 0 : Math.max(0, d - S.day); },
  setCooldown(key, days) { this.st().cool[key] = S.day + days; },

  // ---------- valutazione delle proposte (come le IA decidono) ----------
  // ritorna { score, accept, reasons: [[valore, motivo], ...] }
  evaluate(type, target, from = S.player) {
    const t = C(target), p = C(from);
    const op = this.opinion(target, from);
    const R = [];
    const add = (v, why) => { if (v) R.push([Math.round(v), why]); };
    const plannedVs = EVENTS.some(ev => ev.type === 'war' && ev.actor === target && ev.target === from && ev.day >= S.day && !S.fired.has(EVENTS.indexOf(ev)));
    const myPow = this.power(from), theirPow = Math.max(1, this.power(target));
    switch (type) {
      case 'faction_invite': { // "target" entra nella fazione di "from"
        const f = S.factions[p.faction];
        add(-40, 'Diffidenza verso le alleanze');
        add(op * 0.6, `Opinione (${op})`);
        if (t.major) add(-35, 'Grande potenza: preferisce guidare');
        const ourEnemies = new Set(f ? f.members.flatMap(m => enemiesOf(m)) : enemiesOf(from));
        if (enemiesOf(target).some(e => ourEnemies.has(e))) add(70, 'Combattiamo lo stesso nemico');
        else if (ourEnemies.size) add(-35, 'Non vuole essere trascinata nella nostra guerra');
        if (myPow > theirPow * 2) add(15, 'Siamo molto più forti: protezione');
        if (plannedVs) add(-100, 'Ha piani ostili contro di noi');
        break;
      }
      case 'faction_join': { // "from" chiede di entrare nella fazione di "target" (decide il leader)
        const f = S.factions[t.faction];
        const leader = f ? f.leader : target;
        const lop = this.opinion(leader, from);
        R.length = 0;
        add(-20, 'Valutazione della candidatura');
        add(lop * 0.6, `Opinione del leader (${lop})`);
        if (p.major) add(15, 'Siamo una grande potenza');
        else add(10, 'Un alleato in più');
        if (f && f.members.some(m => enemiesOf(m).some(e => !atWar(e, from) && !enemiesOf(from).length))) add(-10, 'Non abbiamo ancora combattuto per loro');
        const theirEnemies = new Set(f ? f.members.flatMap(m => enemiesOf(m)) : []);
        if (enemiesOf(from).some(e => theirEnemies.has(e))) add(40, 'Combattiamo lo stesso nemico');
        if (enemiesOf(from).length && !enemiesOf(from).some(e => theirEnemies.has(e))) add(-40, 'Non vogliono entrare nella nostra guerra');
        return { score: R.reduce((s, r) => s + r[0], 0), accept: R.reduce((s, r) => s + r[0], 0) > 0, reasons: R, decider: leader };
      }
      case 'non_aggression': {
        add(10, 'Base');
        add(op * 0.4, `Opinione (${op})`);
        if (myPow > theirPow * 1.5) add(25, 'Teme la nostra forza');
        if (theirPow > myPow * 2 && t.aggro > 0.5) add(-30, 'Non ci teme e ha ambizioni');
        if (plannedVs) add(-100, 'Ha piani di guerra contro di noi');
        if (t.faction && p.faction && t.faction !== p.faction) add(-20, 'Fazioni rivali');
        break;
      }
      case 'annexation': { // "from" pretende l'annessione di "target" (stile Monaco)
        const def = this.sidePower(target);
        const ratio = myPow / Math.max(1, def.p);
        add(-90, 'Rinunciare all\'indipendenza');
        if (ratio > 8) add(110, `Siamo ${ratio.toFixed(0)} volte più forti di lei e dei suoi difensori`);
        else if (ratio > 4) add(60, `Siamo ${ratio.toFixed(1)} volte più forti`);
        else if (ratio > 2) add(25, `Siamo ${ratio.toFixed(1)} volte più forti`);
        if (def.side.length > 1) add(-50, `Conta sulla protezione di ${def.side.filter(x => x !== target).map(x => C(x).name).join(', ')}`);
        if (t.faction) add(-200, 'Fa parte di una fazione');
        if (t.major) add(-200, 'È una grande potenza');
        add(op * 0.2, `Opinione (${op})`);
        break;
      }
      case 'peace': {
        const occT = this.occupied(target, from), occP = this.occupied(from, target);
        add(-30, 'Vuole vincere la guerra');
        add(occT * 160, `Abbiamo occupato il ${Math.round(occT * 100)}% del suo territorio`);
        add(-occP * 160, `Occupa il ${Math.round(occP * 100)}% del nostro territorio`);
        const r = myPow / theirPow;
        add(Math.max(-30, Math.min(30, (r - 1) * 20)), 'Rapporto di forze');
        const tf = t.faction && S.factions[t.faction];
        if (tf && tf.members.some(m => m !== target && atWar(m, from))) add(-60, 'Non tradirà i suoi alleati');
        add(op * 0.1, `Opinione (${op})`);
        break;
      }
      case 'request_equipment': {
        add(-30, 'Base');
        add(op * 0.7, `Opinione (${op})`);
        if (allied(target, from)) add(30, 'Siamo alleati');
        if (enemiesOf(target).length) add(-40, 'È in guerra e le serve tutto');
        break;
      }
      default: throw new Error('Tipo di proposta sconosciuto');
    }
    const score = R.reduce((s, r) => s + r[0], 0);
    return { score, accept: score > 0, reasons: R };
  },
};

function fmtReasons(ev) {
  return ev.reasons.map(([v, w]) => `${v > 0 ? '+' : ''}${v} ${w}`).join('; ');
}

// ---------- integrazione con la diplomazia di base ----------
// Installata solo se non è caricato il modulo di diplomazia completo (Diplo), che ha la sua logica.
document.addEventListener('DOMContentLoaded', () => { if (!moduleLoaded('diplomacy')) installBaseDiplomacy(); });
function installBaseDiplomacy() {
  // Patti di non aggressione: le IA li rispettano; se è il giocatore a dichiarare guerra il patto si rompe.
  const _baseDeclareWar = declareWar;
  declareWar = function (a, b) {
    if (atWar(a, b) || allied(a, b)) return;
    if (Rel.hasPact(a, b)) {
      if (a !== S.player) {
        log(`${C(a).name} rinuncia ad attaccare ${C(b).name} per rispettare il patto di non aggressione.`, involvesPlayer(a, b) ? 'good' : '');
        return;
      }
      Rel.removePact(a, b);
      for (const k in S.countries) if (k !== a && S.countries[k].alive) Rel.addMod(k, a, -15, 1, 'Ha tradito un patto di non aggressione');
      log(`${C(a).name} straccia il patto di non aggressione con ${C(b).name}!`, 'bad');
    }
    const friendsOfB = new Set(membersOf(b));
    for (const g of S.guarantees) if (g.to === b) friendsOfB.add(g.by);
    for (const k in S.countries) {
      if (k === a || k === b || !S.countries[k].alive || allied(k, a)) continue;
      if (friendsOfB.has(k)) Rel.addMod(k, a, -30, 2, `Ha aggredito ${C(b).name}`);
      else Rel.addMod(k, a, -8, 1, `Aggressione contro ${C(b).name}`);
    }
    _baseDeclareWar(a, b);
  };

  // Le richieste di alleanza dai pulsanti usano la stessa valutazione dell'IA (non più a caso).
  playerInvite = function (target) {
    const p = C(S.player), t = C(target);
    if (!p.faction || t.faction || atWar(S.player, target) || !playerSpend(PP_COST.faction)) return;
    const ev = Rel.evaluate('faction_invite', target);
    if (ev.accept) joinFaction(target, p.faction);
    else { log(`${t.name} ha rifiutato l'invito nella fazione (${fmtReasons(ev)}).`, 'warn'); Rel.addMod(target, S.player, -5, 2, 'Invito respinto'); }
  };
  playerAskJoin = function (target) {
    const p = C(S.player), f = S.factions[C(target).faction];
    if (p.faction || !f || f.members.some(m => atWar(m, S.player)) || !playerSpend(PP_COST.faction)) return;
    const ev = Rel.evaluate('faction_join', target);
    if (ev.accept) joinFaction(S.player, f.id);
    else log(`${f.name} ha respinto la tua richiesta di adesione (${fmtReasons(ev)}).`, 'warn');
  };
}

// Pace separata tra lo schieramento di "a" e il paese "b"
function makePeace(a, b) {
  for (const k of [...S.wars]) {
    const [x, y] = warSides(k);
    if ((x === b && (y === a || allied(y, a))) || (y === b && (x === a || allied(x, a)))) S.wars.delete(k);
  }
  for (const t of S.tiles) {
    if (t.land && t.ctrl !== t.owner && !atWar(t.ctrl, t.owner) && !allied(t.ctrl, t.owner) && C(t.owner).alive) t.ctrl = t.owner;
  }
  for (const d of S.divs) {
    if (d.dead) continue;
    const t = S.tiles[d.tile];
    if (t.land && !allied(t.ctrl, d.owner) && !atWar(t.ctrl, d.owner)) {
      const home = spawnTile(C(d.owner));
      if (home >= 0) { moveDiv(d, home); d.path = []; d.prog = 0; } else destroyDiv(d);
    }
  }
  S.mapDirty = true;
}

// ---------- utilità per le azioni ----------
function findCountry(q) {
  if (q == null) throw new Error('Paese non indicato');
  const s = String(q).trim();
  if (S.countries[s]) return s;
  if (s.length <= 3 && S.countries[s.toUpperCase()]) return s.toUpperCase();
  const norm = x => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const n = norm(s);
  const ALIAS = { germany: 'G', reich: 'G', france: 'F', uk: 'U', inghilterra: 'U', granbretagna: 'U', britain: 'U', unitedkingdom: 'U', italy: 'I', urss: 'S', russia: 'S', sovietunion: 'S', unionesovietica: 'S', poland: 'P', spain: 'E', portugal: 'O', belgio: 'B', olanda: 'B', paesibassi: 'B', denmark: 'D', norway: 'N', sweden: 'W', finland: 'K', baltici: 'X', estonia: 'X', lettonia: 'X', lituania: 'X', czechoslovakia: 'C', hungary: 'H', yugoslavia: 'Y', greece: 'Q', turkey: 'T', switzerland: 'Z' };
  if (ALIAS[n]) return ALIAS[n];
  for (const k in S.countries) if (norm(S.countries[k].name) === n) return k;
  for (const k in S.countries) if (norm(S.countries[k].name).startsWith(n) || n.startsWith(norm(S.countries[k].name))) return k;
  throw new Error(`Paese sconosciuto: "${s}". Usa il codice (es. G, F, U) o il nome.`);
}
function liveTarget(q) {
  const code = findCountry(q);
  if (code === S.player) throw new Error('Non puoi farlo con la tua stessa nazione');
  if (!C(code).alive) throw new Error(`${C(code).name} non esiste più`);
  return code;
}
function spendPP(cost) {
  const p = C(S.player);
  if (p.pp < cost) throw new Error(`Potere politico insufficiente: servono ${cost}, ne hai ${Math.floor(p.pp)}`);
  p.pp -= cost;
}
const countArg = (n, max = 10) => Math.max(1, Math.min(max, Math.floor(Number(n) || 1)));
const COUNTRY_PARAM = { type: 'string', description: 'Codice del paese (es. "G" Germania) o nome' };

const PP_COST_EXTRA = { improve: 10, nap: 25, annex: 50, peace: 30 };

// ---------- azioni: informazioni ----------
GameActions.register({
  name: 'country_report',
  description: 'Rapporto dettagliato su un paese: forza, fazione, guerre, garanzie, opinione reciproca con le voci che la compongono e quanto accetterebbe ora ogni tipo di proposta. Usalo prima di dare consigli o se non sei sicuro dell\'esito di una proposta. Non costa nulla.',
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM }, required: ['country'] },
  run({ country }) {
    const code = findCountry(country), c = C(code), pc = S.player;
    if (!c.alive) return `${c.name} non esiste più.`;
    const out = {
      paese: `${c.name} (${code})`, fabbriche_civili: c.civ, fabbriche_militari: c.mil,
      divisioni: S.divs.filter(d => d.owner === code && !d.dead).length, potenza: Math.round(Rel.power(code)),
      fazione: c.faction ? S.factions[c.faction].name : null, in_guerra_con: enemiesOf(code).map(e => C(e).name),
      garantito_da: S.guarantees.filter(g => g.to === code).map(g => C(g.by).name),
    };
    if (code !== pc) {
      out.relazione = atWar(pc, code) ? 'in guerra' : allied(pc, code) ? 'alleato' : 'neutrale';
      out.patto_non_aggressione = relHasPact(pc, code);
      out.opinione_verso_di_noi = relOpinion(code, pc);
      out.nostra_opinione = relOpinion(pc, code);
      const prev = {};
      if (moduleLoaded('diplomacy')) return out;
      out.voci_opinione = Rel.breakdown(code, pc).map(([v, w]) => `${v > 0 ? '+' : ''}${v} ${w}`);
      const p = C(pc);
      if (p.faction && !c.faction && !atWar(pc, code)) prev.invito_in_fazione = Rel.evaluate('faction_invite', code);
      if (!p.faction && c.faction) prev.adesione_alla_sua_fazione = Rel.evaluate('faction_join', code);
      if (!atWar(pc, code) && !Rel.hasPact(pc, code) && !allied(pc, code)) prev.non_aggressione = Rel.evaluate('non_aggression', code);
      if (!atWar(pc, code) && !allied(pc, code)) prev.richiesta_annessione = Rel.evaluate('annexation', code);
      if (atWar(pc, code)) prev.pace = Rel.evaluate('peace', code);
      if (!atWar(pc, code)) prev.richiesta_equipaggiamento = Rel.evaluate('request_equipment', code);
      out.accettazione_proposte = Object.fromEntries(Object.entries(prev).map(([k, e]) => [k, `${e.accept ? 'ACCETTEREBBE' : 'RIFIUTEREBBE'} (punteggio ${e.score}): ${fmtReasons(e)}`]));
    }
    return out;
  },
});

// ---------- azioni: diplomazia ----------
GameActions.register({
  name: 'improve_relations',
  fallback: 'diplomacy',
  description: `Invia diplomatici per migliorare i rapporti con un paese: +20 all'opinione che ha di noi, che decade di 2 al mese. Costa ${PP_COST_EXTRA.improve} potere politico; una volta ogni 30 giorni per paese.`,
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM }, required: ['country'] },
  run({ country }) {
    const code = liveTarget(country);
    if (atWar(S.player, code)) throw new Error('Siamo in guerra con questo paese');
    const cd = Rel.cooldownLeft('imp' + code);
    if (cd) throw new Error(`I diplomatici sono già al lavoro: riprova tra ${cd} giorni`);
    spendPP(PP_COST_EXTRA.improve);
    Rel.addMod(code, S.player, 20, 2, 'Missione diplomatica');
    Rel.setCooldown('imp' + code, 30);
    log(`Missione diplomatica in ${C(code).name}: i rapporti migliorano.`, 'good');
    return `Fatto. Opinione di ${C(code).name} verso di noi ora: ${Rel.opinion(code, S.player)}.`;
  },
});

GameActions.register({
  name: 'declare_war',
  fallback: 'diplomacy',
  description: `Dichiara guerra a un paese (${PP_COST.war} potere politico). Entrano in guerra anche la sua fazione e chi lo garantisce. Se esiste un patto di non aggressione viene stracciato (tutti ci giudicheranno peggio). Usala solo se il leader lo ordina esplicitamente.`,
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM }, required: ['country'] },
  run({ country }) {
    const code = liveTarget(country);
    if (atWar(S.player, code)) throw new Error('Siamo già in guerra');
    if (allied(S.player, code)) throw new Error('È un nostro alleato');
    spendPP(PP_COST.war);
    declareWar(S.player, code);
    return `Guerra dichiarata. Ora siamo in guerra con: ${enemiesOf(S.player).map(e => C(e).name).join(', ')}.`;
  },
});

GameActions.register({
  name: 'guarantee_independence',
  fallback: 'diplomacy',
  description: `Garantisce l'indipendenza di un paese (${PP_COST.guarantee} potere politico): se viene attaccato entriamo in guerra in sua difesa. Migliora la sua opinione di noi.`,
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM }, required: ['country'] },
  run({ country }) {
    const code = liveTarget(country);
    if (atWar(S.player, code)) throw new Error('Siamo in guerra con questo paese');
    if (S.guarantees.some(g => g.by === S.player && g.to === code)) throw new Error('Lo garantiamo già');
    spendPP(PP_COST.guarantee);
    guarantee(S.player, code);
    return `Garanzia concessa a ${C(code).name}.`;
  },
});

GameActions.register({
  name: 'revoke_guarantee',
  fallback: 'diplomacy',
  description: 'Ritira la nostra garanzia di indipendenza a un paese. Gratis, ma peggiora molto la sua opinione di noi.',
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM }, required: ['country'] },
  run({ country }) {
    const code = liveTarget(country);
    const n = S.guarantees.length;
    S.guarantees = S.guarantees.filter(g => !(g.by === S.player && g.to === code));
    if (S.guarantees.length === n) throw new Error('Non lo stiamo garantendo');
    Rel.addMod(code, S.player, -30, 2, 'Ci ha abbandonati');
    log(`${C(S.player).name} ritira la garanzia a ${C(code).name}.`, 'warn');
    return 'Garanzia ritirata.';
  },
});

GameActions.register({
  name: 'propose_non_aggression_pact',
  fallback: 'diplomacy',
  description: `Propone un patto di non aggressione (${PP_COST_EXTRA.nap} potere politico, spesi anche se rifiuta). Se accetta, nessuno dei due può attaccare l'altro senza stracciare il patto. Decide il paese in base a opinione, forza e piani.`,
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM }, required: ['country'] },
  run({ country }) {
    const code = liveTarget(country);
    if (atWar(S.player, code)) throw new Error('Siamo in guerra: serve prima la pace');
    if (allied(S.player, code)) throw new Error('È già un alleato');
    if (Rel.hasPact(S.player, code)) throw new Error('Il patto esiste già');
    spendPP(PP_COST_EXTRA.nap);
    const ev = Rel.evaluate('non_aggression', code);
    if (!ev.accept) {
      log(`${C(code).name} respinge il patto di non aggressione.`, 'warn');
      return { esito: 'RIFIUTATO', punteggio: ev.score, motivi: fmtReasons(ev) };
    }
    Rel.st().pacts.push({ a: S.player, b: code, day: S.day });
    log(`Firmato un patto di non aggressione con ${C(code).name}.`, 'good');
    return { esito: 'ACCETTATO', punteggio: ev.score, motivi: fmtReasons(ev) };
  },
});

GameActions.register({
  name: 'cancel_non_aggression_pact',
  fallback: 'diplomacy',
  description: 'Denuncia (cancella) un patto di non aggressione senza dichiarare guerra. Peggiora l\'opinione di quel paese.',
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM }, required: ['country'] },
  run({ country }) {
    const code = liveTarget(country);
    if (!Rel.hasPact(S.player, code)) throw new Error('Non c\'è nessun patto');
    Rel.removePact(S.player, code);
    Rel.addMod(code, S.player, -25, 2, 'Ha denunciato il nostro patto');
    log(`${C(S.player).name} denuncia il patto di non aggressione con ${C(code).name}.`, 'warn');
    return 'Patto cancellato.';
  },
});

GameActions.register({
  name: 'create_faction',
  fallback: 'diplomacy',
  description: `Fonda una nuova fazione (alleanza militare) guidata da noi (${PP_COST.create} potere politico). Solo se non siamo già in una fazione.`,
  input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Nome della fazione (facoltativo)' } } },
  run({ name }) {
    const p = C(S.player);
    if (p.faction) throw new Error(`Siamo già in ${S.factions[p.faction].name}`);
    spendPP(PP_COST.create);
    createFaction(S.player);
    if (name) S.factions[p.faction].name = String(name).slice(0, 40);
    return `Fondata la fazione "${S.factions[p.faction].name}".`;
  },
});

GameActions.register({
  name: 'invite_to_faction',
  fallback: 'diplomacy',
  description: `Invita un paese nella nostra fazione (${PP_COST.faction} potere politico, spesi anche se rifiuta). Decide il paese in base a opinione, nemici comuni e forza.`,
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM }, required: ['country'] },
  run({ country }) {
    const code = liveTarget(country), p = C(S.player), t = C(code);
    if (!p.faction) throw new Error('Non abbiamo una fazione: fondane una prima');
    if (t.faction) throw new Error(`${t.name} è già in ${S.factions[t.faction].name}`);
    if (atWar(S.player, code)) throw new Error('Siamo in guerra con questo paese');
    spendPP(PP_COST.faction);
    const ev = Rel.evaluate('faction_invite', code);
    if (ev.accept) { joinFaction(code, p.faction); return { esito: 'ACCETTATO', punteggio: ev.score, motivi: fmtReasons(ev) }; }
    Rel.addMod(code, S.player, -5, 2, 'Invito respinto');
    log(`${t.name} ha rifiutato l'invito nella fazione.`, 'warn');
    return { esito: 'RIFIUTATO', punteggio: ev.score, motivi: fmtReasons(ev) };
  },
});

GameActions.register({
  name: 'request_faction_membership',
  fallback: 'diplomacy',
  description: `Chiede di entrare nella fazione di cui fa parte il paese indicato (${PP_COST.faction} potere politico). Decide il leader della fazione.`,
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM }, required: ['country'] },
  run({ country }) {
    const code = liveTarget(country), p = C(S.player), f = S.factions[C(code).faction];
    if (p.faction) throw new Error(`Siamo già in ${S.factions[p.faction].name}: prima bisogna uscirne`);
    if (!f) throw new Error(`${C(code).name} non è in nessuna fazione`);
    if (f.members.some(m => atWar(m, S.player))) throw new Error('Siamo in guerra con un membro di quella fazione');
    spendPP(PP_COST.faction);
    const ev = Rel.evaluate('faction_join', code);
    if (ev.accept) { joinFaction(S.player, f.id); return { esito: 'ACCETTATO', decide: C(ev.decider).name, motivi: fmtReasons(ev) }; }
    log(`${f.name} ha respinto la tua richiesta di adesione.`, 'warn');
    return { esito: 'RIFIUTATO', decide: C(ev.decider).name, punteggio: ev.score, motivi: fmtReasons(ev) };
  },
});

GameActions.register({
  name: 'leave_faction',
  fallback: 'diplomacy',
  description: 'Esce dalla fazione di cui facciamo parte. I membri ci giudicheranno molto peggio. Non possibile durante una guerra combattuta insieme.',
  input_schema: { type: 'object', properties: {} },
  run() {
    const p = C(S.player), f = S.factions[p.faction];
    if (!f) throw new Error('Non siamo in nessuna fazione');
    const others = f.members.filter(m => m !== S.player);
    if (enemiesOf(S.player).length && others.some(m => enemiesOf(m).length)) throw new Error('Non si abbandonano gli alleati durante la guerra');
    leaveFaction(S.player);
    for (const m of others) Rel.addMod(m, S.player, -40, 2, 'Ha abbandonato la fazione');
    log(`${p.name} esce dalla fazione ${f.name}.`, 'warn');
    S.mapDirty = true;
    return `Usciti da ${f.name}.`;
  },
});

GameActions.register({
  name: 'demand_annexation',
  fallback: 'diplomacy',
  description: `Pretende che un paese si lasci annettere pacificamente, come l'Anschluss o Monaco (${PP_COST_EXTRA.annex} potere politico). Accetta solo se è isolato e molto più debole di noi; se rifiuta, ci odierà e anche gli altri paesi ci giudicheranno peggio. Non dichiara guerra.`,
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM }, required: ['country'] },
  run({ country }) {
    const code = liveTarget(country);
    if (atWar(S.player, code)) throw new Error('Siamo in guerra: chiedi la pace o conquistalo');
    if (allied(S.player, code)) throw new Error('Non si annette un alleato così');
    spendPP(PP_COST_EXTRA.annex);
    const ev = Rel.evaluate('annexation', code);
    const name = C(code).name;
    for (const k in S.countries) if (k !== S.player && k !== code && S.countries[k].alive && !allied(k, S.player)) Rel.addMod(k, S.player, -10, 1, `Pretese su ${name}`);
    if (ev.accept) { annex(S.player, code); return { esito: 'ACCETTATO', motivi: fmtReasons(ev) }; }
    Rel.addMod(code, S.player, -40, 2, 'Ha preteso la nostra annessione');
    log(`${name} respinge le pretese di annessione.`, 'warn');
    return { esito: 'RIFIUTATO', punteggio: ev.score, motivi: fmtReasons(ev) };
  },
});

GameActions.register({
  name: 'propose_peace',
  fallback: 'diplomacy',
  description: `Propone una pace separata (pace bianca) a un paese con cui siamo in guerra (${PP_COST_EXTRA.peace} potere politico). Se accetta, cessano le ostilità tra lui e il nostro schieramento e i territori occupati tornano ai proprietari. Decide in base all'andamento della guerra.`,
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM }, required: ['country'] },
  run({ country }) {
    const code = liveTarget(country);
    if (!atWar(S.player, code)) throw new Error('Non siamo in guerra con questo paese');
    spendPP(PP_COST_EXTRA.peace);
    const ev = Rel.evaluate('peace', code);
    if (!ev.accept) {
      log(`${C(code).name} respinge la proposta di pace.`, 'warn');
      return { esito: 'RIFIUTATO', punteggio: ev.score, motivi: fmtReasons(ev) };
    }
    makePeace(S.player, code);
    Rel.addMod(code, S.player, 10, 1, 'Pace firmata');
    log(`Firmata la pace con ${C(code).name}.`, 'good');
    return { esito: 'ACCETTATO', motivi: fmtReasons(ev) };
  },
});

GameActions.register({
  name: 'send_equipment',
  fallback: 'diplomacy',
  description: 'Invia equipaggiamento militare a un paese (affitti e prestiti). Migliora molto la sua opinione di noi.',
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM, amount: { type: 'integer', description: 'Quantità di equipaggiamento' } }, required: ['country', 'amount'] },
  run({ country, amount }) {
    const code = liveTarget(country), p = C(S.player);
    if (atWar(S.player, code)) throw new Error('Non si arma il nemico');
    const n = Math.floor(Number(amount));
    if (!(n > 0)) throw new Error('Quantità non valida');
    if (p.equipment < n) throw new Error(`Abbiamo solo ${Math.floor(p.equipment)} di equipaggiamento`);
    p.equipment -= n; C(code).equipment += n;
    Rel.addMod(code, S.player, Math.min(35, Math.round(n / 150)), 3, 'Aiuti militari');
    log(`Inviati ${fmt(n)} di equipaggiamento a ${C(code).name}.`, 'good');
    return `Consegnati ${n}. Opinione di ${C(code).name} verso di noi: ${Rel.opinion(code, S.player)}.`;
  },
});

GameActions.register({
  name: 'request_equipment',
  fallback: 'diplomacy',
  description: 'Chiede a un paese amico di cederci equipaggiamento militare. Accetta se ci stima e non è in guerra (o siamo alleati); cede al massimo il 25% delle sue scorte.',
  input_schema: { type: 'object', properties: { country: COUNTRY_PARAM, amount: { type: 'integer', description: 'Quantità richiesta' } }, required: ['country', 'amount'] },
  run({ country, amount }) {
    const code = liveTarget(country), t = C(code);
    if (atWar(S.player, code)) throw new Error('Siamo in guerra con questo paese');
    const cd = Rel.cooldownLeft('req' + code);
    if (cd) throw new Error(`Abbiamo già chiesto da poco: riprova tra ${cd} giorni`);
    Rel.setCooldown('req' + code, 60);
    const ev = Rel.evaluate('request_equipment', code);
    if (!ev.accept) return { esito: 'RIFIUTATO', punteggio: ev.score, motivi: fmtReasons(ev) };
    const n = Math.max(0, Math.min(Math.floor(Number(amount) || 0), Math.floor(t.equipment * 0.25)));
    if (!n) return { esito: 'RIFIUTATO', motivi: 'Non ha scorte da cedere' };
    t.equipment -= n; C(S.player).equipment += n;
    Rel.addMod(code, S.player, -5, 1, 'Ci ha chiesto aiuti');
    log(`${t.name} ci cede ${fmt(n)} di equipaggiamento.`, 'good');
    return { esito: 'ACCETTATO', ceduti: n, motivi: fmtReasons(ev) };
  },
});

// ---------- azioni: economia ----------
GameActions.register({
  name: 'build_factories',
  fallback: 'economy',
  description: `Mette in cantiere nuove fabbriche (costo ${BUILD_COST.civ} punti costruzione la civile, ${BUILD_COST.mil} la militare; le fabbriche civili producono i punti). Le civili accelerano la costruzione, le militari producono equipaggiamento. Coda massima 5 cantieri e limite di slot in base al territorio.`,
  input_schema: { type: 'object', properties: { type: { type: 'string', enum: ['civ', 'mil'], description: 'civ = civile, mil = militare' }, count: { type: 'integer', description: 'Quante (1-5)' } }, required: ['type'] },
  run({ type, count }) {
    if (type !== 'civ' && type !== 'mil') throw new Error('Tipo deve essere civ o mil');
    const p = C(S.player), n = countArg(count, 5);
    let ok = 0;
    for (let i = 0; i < n; i++) if (queueBuild(p, type)) ok++;
    if (!ok) throw new Error(`Impossibile: ${p.construction.length >= 5 ? 'coda cantieri piena (5)' : `slot esauriti (${p.civ + p.mil + p.construction.length}/${factoryCap(p)})`}`);
    log(`Avviati ${ok} cantieri di fabbriche ${type === 'civ' ? 'civili' : 'militari'}.`);
    return `In cantiere ${ok} su ${n}. Coda: ${p.construction.map(j => j.type).join(', ')}; slot ${p.civ + p.mil + p.construction.length}/${factoryCap(p)}.`;
  },
});

GameActions.register({
  name: 'cancel_construction',
  fallback: 'economy',
  description: 'Annulla cantieri in corso. index = posizione nella coda partendo da 0, oppure "all" per svuotarla.',
  input_schema: { type: 'object', properties: { index: { type: 'string', description: 'Numero (da 0) oppure "all"' } }, required: ['index'] },
  run({ index }) {
    const p = C(S.player);
    if (!p.construction.length) throw new Error('Nessun cantiere in corso');
    if (String(index) === 'all') { const n = p.construction.length; p.construction = []; return `Annullati ${n} cantieri.`; }
    const i = Math.floor(Number(index));
    if (!(i >= 0 && i < p.construction.length)) throw new Error(`Indice non valido (0-${p.construction.length - 1})`);
    p.construction.splice(i, 1);
    return 'Cantiere annullato.';
  },
});

GameActions.register({
  name: 'recruit_divisions',
  description: 'Addestra nuove divisioni. inf = fanteria, arm = corazzata (richiede la tecnologia corazzata). Ogni divisione consuma equipaggiamento e manodopera.',
  input_schema: { type: 'object', properties: { type: { type: 'string', enum: ['inf', 'arm'] }, count: { type: 'integer', description: 'Quante (1-10)' } }, required: ['type'] },
  run({ type, count }) {
    if (!UNIT_TYPES[type]) throw new Error('Tipo deve essere inf o arm');
    const p = C(S.player), n = countArg(count, 10), ut = UNIT_TYPES[type];
    let ok = 0;
    for (let i = 0; i < n; i++) if (recruit(p, type)) ok++;
    if (!ok) throw new Error(type === 'arm' && !p.armorTech ? 'Tecnologia corazzata non ancora disponibile' : `Risorse insufficienti: servono ${ut.eq} equipaggiamento e ${ut.mp} manodopera a divisione`);
    log(`${ok} nuove divisioni di ${ut.name} in addestramento.`);
    return `In addestramento ${ok} su ${n} (pronte tra ${ut.days} giorni). Restano ${Math.floor(p.equipment)} equipaggiamento e ${Math.floor(p.manpower)} manodopera.`;
  },
});

GameActions.register({
  name: 'start_national_focus',
  description: 'Avvia un focus nazionale (uno alla volta). Gli id disponibili sono elencati nello stato della partita.',
  input_schema: { type: 'object', properties: { focus_id: { type: 'string' } }, required: ['focus_id'] },
  run({ focus_id }) {
    const p = C(S.player), f = focusOf(p, focus_id);
    if (!f) throw new Error(`Focus sconosciuto: ${focus_id}`);
    if (p.focus) throw new Error(`È già in corso "${focusOf(p, p.focus).name}" (${p.focusDays} giorni)`);
    if (!startFocus(p, focus_id)) throw new Error('Focus non disponibile (già fatto o requisiti mancanti)');
    log(`Avviato il focus nazionale: ${f.name}.`);
    return `Avviato "${f.name}": ${f.days} giorni.`;
  },
});

// ---------- stato della partita per l'IA ----------
// compact: versione corta per i modelli locali (senza l'elenco completo dei paesi della diplomazia
// e senza i focus disponibili, a meno che servano: focus = true)
function gameStateText({ compact = false, focus = true } = {}) {
  const pc = S.player, p = C(pc);
  const L = [];
  L.push(`Data: ${dateLabel(S.day)}. Guidiamo: ${p.name} (${pc}).`);
  L.push(`Potere politico ${Math.floor(p.pp)} (+${p.ppGain.toFixed(1)}/g). Fabbriche civili ${p.civ}, militari ${p.mil}, slot ${p.civ + p.mil + p.construction.length}/${factoryCap(p)}. Equipaggiamento ${Math.floor(p.equipment)}${typeof Econ !== 'undefined' ? '' : ` (+${Math.round(p.mil * 3 * (1 + p.eqBonus))}/g)`}, manodopera ${Math.floor(p.manpower)}. Divisioni ${S.divs.filter(d => d.owner === pc && !d.dead).length}${p.training.length ? ` + ${p.training.length} in addestramento` : ''}. Corazzati: ${p.armorTech ? 'sì' : 'no'}.`);
  L.push(`Cantieri: ${p.construction.length ? p.construction.map((j, i) => `[${i}] ${j.type} ${Math.round(100 * j.prog / j.cost)}%`).join(', ') : 'nessuno'}.`);
  const avail = compact && !focus ? '' : ` Disponibili: ${focusList(p).filter(f => focusAvailable(p, f)).map(f => `${f.id} "${f.name}" ${f.days}g${f.desc || f.d ? `: ${f.desc || f.d}` : ''}`).join(' | ') || 'nessuno'}.`;
  L.push(`Focus: ${p.focus ? `${focusOf(p, p.focus).name} (${p.focusDays} g)` : 'nessuno'}.${avail}`);
  L.push(`Fazione: ${p.faction ? S.factions[p.faction].name : 'nessuna'}. Nemici: ${enemiesOf(pc).map(e => C(e).name).join(', ') || 'nessuno'}. Garantiamo: ${S.guarantees.filter(g => g.by === pc).map(g => C(g.to).name).join(', ') || 'nessuno'}. Patti di non aggressione: ${relPacts(pc).map(k => C(k).name).join(', ') || 'nessuno'}.`);
  // nel mondo intero i paesi sono tanti: per esteso solo quelli che contano per noi, gli altri solo per nome
  const near = new Set();
  for (const t of S.tiles) if (t.land && t.owner === pc) for (const n of t.nb) { const o = S.tiles[n].owner; if (o && o !== pc) near.add(o); }
  const relevant = k => { const c = S.countries[k]; return c.major || near.has(k) || atWar(pc, k) || allied(pc, k) || Math.abs(relOpinion(k, pc)) >= 30 || S.guarantees.some(g => (g.by === pc && g.to === k) || (g.by === k && g.to === pc)); };
  const others = [];
  L.push('Paesi principali e vicini (codice, nome, fazione, fabbriche civ/mil, divisioni, rapporto con noi, opinione loro→noi / noi→loro):');
  for (const k in S.countries) {
    const c = S.countries[k];
    if (!c.alive || k === pc) continue;
    if (!relevant(k)) { others.push(`${k} ${c.name}`); continue; }
    const st = atWar(pc, k) ? 'GUERRA' : allied(pc, k) ? 'alleato' : 'neutrale';
    const ew = enemiesOf(k);
    const ideo = typeof IDEOLOGIES !== 'undefined' && IDEOLOGIES[c.ideology] ? `, ${IDEOLOGIES[c.ideology].short.toLowerCase()}` : '';
    L.push(`- ${k} ${c.name}${c.major ? ' (grande potenza)' : ''}${ideo}, ${c.faction ? S.factions[c.faction].name : 'nessuna fazione'}, ${c.civ}/${c.mil}, ${S.divs.filter(d => d.owner === k && !d.dead).length} div, ${st}, ${relOpinion(k, pc)}/${relOpinion(pc, k)}${ew.length ? `, in guerra con ${ew.map(e => C(e).name).join(', ')}` : ''}`);
  }
  if (others.length) L.push(`Altri paesi: ${others.join(', ')}.`);
  const gone = Object.values(S.countries).filter(c => !c.alive).map(c => c.name);
  if (gone.length) L.push(`Paesi scomparsi: ${gone.join(', ')}.`);
  if (typeof DiploAPI !== 'undefined' && DiploAPI.summary) {
    try {
      let d = DiploAPI.summary(pc);
      // l'elenco di tutti i paesi ripete quello sopra: nella versione corta si tiene solo l'intestazione
      if (compact) d = d.split('\n').filter(l => !/^- |^Paesi \(opinione/.test(l)).join('\n');
      L.push(d);
    } catch (e) { /* ignora */ }
  }
  if (typeof Econ !== 'undefined' && Econ.summary) { try { L.push(Econ.summary(pc)); } catch (e) { /* ignora */ } }
  const extra = GameActions.context();
  if (extra) L.push(extra);
  return L.join('\n');
}
