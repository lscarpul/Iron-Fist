'use strict';

// Diplomazia in stile Hearts of Iron IV: tensione mondiale con soglie per ideologia,
// opinione tra paesi, giustificazione degli obiettivi di guerra, conferenze di pace
// a punti partecipazione, sudditi con autonomia, lend-lease e pace bianca.
//
// Ogni azione è una funzione pura sullo stato S che ritorna { ok, msg }: la usano
// l'interfaccia, l'IA dei paesi e l'IA testuale (vedi diplo-api.js).

const IDEOLOGIES = {
  democratic: { name: 'Democrazia', color: '#4a86c4' },
  fascism: { name: 'Fascismo', color: '#7a5a3a' },
  communism: { name: 'Comunismo', color: '#b03030' },
  neutrality: { name: 'Non allineato', color: '#8a8a8a' },
};
const DEFAULT_IDEOLOGY = {
  G: 'fascism', I: 'fascism', S: 'communism',
  U: 'democratic', F: 'democratic', B: 'democratic', D: 'democratic', N: 'democratic', W: 'democratic',
  K: 'democratic', X: 'neutrality', C: 'democratic', Z: 'democratic',
};

// Soglie di tensione mondiale (0-100) richieste per ideologia, come in HOI4:
// le democrazie non possono giustificare guerre finché il mondo non è in fiamme.
const TENSION_REQ = {
  justify: { democratic: 80, neutrality: 50, communism: 30, fascism: 0 },
  faction: { democratic: 40, neutrality: 50, communism: 20, fascism: 0 },
  guarantee: { democratic: 0, neutrality: 25, communism: 25, fascism: 10 },
  lendLease: { democratic: 30, neutrality: 30, communism: 0, fascism: 0 },
};
const TENSION_GAIN = { justify: 2, justifyMajor: 5, war: 6, warMajor: 12, annex: 8, capitulation: 4, faction: 2, coup: 3, peace: -4 };

const WARGOAL_TYPES = {
  conquest: { name: 'Conquista', desc: 'Sconto del 30% sui territori del bersaglio alla conferenza di pace' },
  puppet: { name: 'Sottomissione', desc: 'Sconto del 30% per renderlo uno stato fantoccio alla pace' },
};

// Livelli di autonomia dei sudditi, dal più dipendente al più libero.
// extract = quota dell'equipaggiamento prodotto dal suddito che va al signore.
const AUTONOMY_LEVELS = [
  { id: 'integrated', name: 'Fantoccio integrato', extract: 0.5, gain: 0.6 },
  { id: 'puppet', name: 'Fantoccio', extract: 0.3, gain: 0.8 },
  { id: 'dominion', name: 'Dominion', extract: 0.1, gain: 1.0 },
];

const DIPLO_COST = {
  improve: 15, justify: 30, justifyMajor: 20, war: 0, guarantee: 25, faction: 50, create: 80,
  whitePeace: 25, reduceAutonomy: 40, integrate: 100, release: 0, collab: 50, nap: 25, demand: 50,
};

const res = (ok, msg) => ({ ok, msg });

// forza militare approssimativa: divisioni (corazzate contano doppio) e industria bellica
function powerOf(code) {
  let p = 0;
  for (const d of S.divs) if (!d.dead && d.owner === code) p += d.str * (d.type === 'arm' ? 2 : 1);
  return p + C(code).mil * 0.5;
}

const Diplo = {
  // ---------- stato ----------
  init() {
    S.tension = 0;
    S.relMod = {};      // relMod[a][b]: modificatore dinamico dell'opinione di a verso b
    S.wargoals = [];    // { by, vs, type, days, total, ready, expires }
    S.warInfo = {};     // warKey → { start, goals: [{ by, vs, type }] }
    S.contrib = {};     // contrib[sconfitto][vincitore]: punti partecipazione accumulati
    S.lendLease = [];   // { from, to, perDay }
    S.naps = [];        // patti di non aggressione { a, b, since }
    S.peace = null;     // conferenza di pace in corso
    S.peaceQueue = [];
    for (const k in S.countries) {
      const c = S.countries[k];
      c.ideology = c.ideology || DEFAULT_IDEOLOGY[k] || 'neutrality';
      c.overlord = null;
      c.autonomy = null;      // { level, score } se suddito
      c.capitulated = false;
      c.collabBonus = 0;      // riduce la soglia di capitolazione (operazione "governo collaborazionista")
    }
  },

  ideo(code) { return C(code).ideology || 'neutrality'; },
  worldTension() { return S.tension; },
  addTension(v) { S.tension = Math.max(0, Math.min(100, S.tension + v)); },
  tensionOk(code, kind) { return S.tension >= TENSION_REQ[kind][this.ideo(code)]; },

  // ---------- sudditi ----------
  top(code) {
    let c = C(code), n = 0;
    while (c.overlord && n++ < 4) c = C(c.overlord);
    return c.code;
  },
  subjectsOf(code) {
    const r = [];
    for (const k in S.countries) if (S.countries[k].alive && S.countries[k].overlord === code) r.push(k);
    return r;
  },

  // ---------- opinione ----------
  baseOpinion(a, b) {
    const ia = this.ideo(a), ib = this.ideo(b);
    let v = 0;
    if (ia === ib) v += ia === 'neutrality' ? 10 : 25;
    else {
      const pair = [ia, ib].sort().join('-');
      v += { 'communism-fascism': -50, 'democratic-fascism': -30, 'communism-democratic': -20 }[pair] || 0;
    }
    if (C(a).faction && C(a).faction === C(b).faction) v += 30;
    if (S.guarantees.some(g => g.by === b && g.to === a)) v += 20;
    if (C(a).overlord === b) v += 10;
    return v;
  },
  rel(a, b) { return (S.relMod[a] && S.relMod[a][b]) || 0; },
  addRel(a, b, v, cap = 60) {
    const m = S.relMod[a] || (S.relMod[a] = {});
    m[b] = Math.max(-cap, Math.min(cap, (m[b] || 0) + v));
  },
  // Opinione che il paese `from` ha del paese `to`, da -100 a 100.
  opinion(from, to) {
    if (from === to) return 100;
    if (atWar(from, to)) return -100;
    return Math.max(-100, Math.min(100, Math.round(this.baseOpinion(from, to) + this.rel(from, to))));
  },

  spend(code, cost) {
    const c = C(code);
    if (c.pp < cost) return false;
    c.pp -= cost;
    return true;
  },
  needPP(cost) { return res(false, `Potere politico insufficiente (servono ${cost}).`); },
  check(a, b) {
    if (!S.countries[a] || !S.countries[b]) return 'Paese sconosciuto.';
    if (!C(a).alive || !C(b).alive) return 'Il paese non esiste più.';
    if (a === b) return 'Non puoi farlo con te stesso.';
    return null;
  },

  improveRelations(a, b) {
    const e = this.check(a, b); if (e) return res(false, e);
    if (atWar(a, b)) return res(false, 'Siete in guerra.');
    if (this.rel(b, a) >= 60) return res(false, `Le relazioni con ${C(b).name} sono già al massimo ottenibile con la diplomazia.`);
    if (!this.spend(a, DIPLO_COST.improve)) return this.needPP(DIPLO_COST.improve);
    this.addRel(b, a, 15);
    return res(true, `Missione diplomatica in ${C(b).name}: opinione verso ${C(a).name} ora ${this.opinion(b, a)}.`);
  },

  // ---------- obiettivi di guerra ----------
  wargoal(by, vs, readyOnly = true) {
    return S.wargoals.find(w => w.by === by && w.vs === vs && (!readyOnly || w.ready));
  },
  justifyWargoal(by, vs, type = 'conquest') {
    const e = this.check(by, vs); if (e) return res(false, e);
    if (!WARGOAL_TYPES[type]) return res(false, `Tipo di obiettivo sconosciuto: usa ${Object.keys(WARGOAL_TYPES).join(' o ')}.`);
    const a = C(by), b = C(vs);
    if (a.overlord) return res(false, 'Un suddito non può giustificare obiettivi di guerra.');
    if (allied(by, vs)) return res(false, `${b.name} è un alleato.`);
    if (atWar(by, vs)) return res(false, `Sei già in guerra con ${b.name}.`);
    if (b.capitulated) return res(false, `${b.name} ha già capitolato.`);
    if (this.wargoal(by, vs, false)) return res(false, `Hai già un obiettivo di guerra contro ${b.name}.`);
    if (this.hasNap(by, vs)) return res(false, `Hai un patto di non aggressione con ${b.name}: rompilo prima.`);
    if (!this.tensionOk(by, 'justify')) {
      return res(false, `Tensione mondiale troppo bassa: ${IDEOLOGIES[a.ideology].name.toLowerCase()} richiede almeno ${TENSION_REQ.justify[a.ideology]}% (ora ${Math.floor(S.tension)}%).`);
    }
    const cost = DIPLO_COST.justify + (b.major ? DIPLO_COST.justifyMajor : 0);
    if (!this.spend(by, cost)) return this.needPP(cost);
    const days = Math.round((b.major ? 70 : 45) * (1 - S.tension / 200));
    S.wargoals.push({ by, vs, type, days, total: days, ready: false, expires: 0 });
    this.addRel(vs, by, -30);
    for (const k in S.countries) if (k !== by && this.ideo(k) === 'democratic' && C(k).alive) this.addRel(k, by, -5);
    if (involvesPlayer(by, vs)) log(`${a.name} inizia a giustificare un obiettivo di guerra (${WARGOAL_TYPES[type].name}) contro ${b.name}: ${days} giorni.`, vs === S.player ? 'bad' : '');
    return res(true, `Giustificazione avviata contro ${b.name} (${WARGOAL_TYPES[type].name}), pronta tra ${days} giorni.`);
  },
  cancelWargoal(by, vs) {
    const n = S.wargoals.length;
    S.wargoals = S.wargoals.filter(w => !(w.by === by && w.vs === vs));
    return n === S.wargoals.length ? res(false, 'Nessun obiettivo di guerra da annullare.') : res(true, `Obiettivo di guerra contro ${C(vs).name} annullato.`);
  },

  canDeclareWar(a, b) {
    const e = this.check(a, b); if (e) return res(false, e);
    const A = C(a), B = C(b);
    if (A.overlord) return res(false, 'Un suddito non può dichiarare guerra: segue le guerre del suo signore.');
    if (allied(a, b)) return res(false, `${B.name} è un alleato.`);
    if (atWar(a, b)) return res(false, `Sei già in guerra con ${B.name}.`);
    if (B.capitulated) return res(false, `${B.name} ha già capitolato.`);
    if (this.hasNap(a, b)) return res(false, `Hai un patto di non aggressione con ${B.name}: rompilo prima.`);
    if (this.wargoal(a, b)) return res(true, 'Obiettivo di guerra pronto.');
    // entrare in una guerra a fianco di un alleato non richiede obiettivi
    if (enemiesOf(b).some(x => allied(x, a))) return res(true, `${B.name} è in guerra con un tuo alleato.`);
    const j = this.wargoal(a, b, false);
    return res(false, j ? `L'obiettivo di guerra contro ${B.name} sarà pronto tra ${Math.ceil(j.days)} giorni.` : `Serve un obiettivo di guerra giustificato contro ${B.name}.`);
  },
  declareWar(a, b) {
    const r = this.canDeclareWar(a, b);
    if (!r.ok) return r;
    declareWar(a, b);
    return res(true, `${C(a).name} è in guerra con ${C(b).name}.`);
  },

  // chiamata da declareWar (game.js) dopo aver aggiunto le guerre
  onWar(a, b) {
    const key = warKey(a, b);
    if (this.hasNap(a, b)) this.breakNap(a, b);
    const goal = S.wargoals.find(w => w.by === a && w.vs === b && w.ready);
    if (!S.warInfo[key]) S.warInfo[key] = { start: S.day, goals: [] };
    if (goal) {
      S.warInfo[key].goals.push({ by: a, vs: b, type: goal.type });
      S.wargoals = S.wargoals.filter(w => w !== goal);
    }
    // i sudditi seguono il signore in guerra (e il signore del difensore lo difende già via membersOf)
    for (const s of this.subjectsOf(a)) {
      for (const y of enemiesOf(a)) if (!allied(s, y) && !C(y).capitulated) S.wars.add(warKey(s, y));
    }
    this.addTension(C(a).major || C(b).major ? TENSION_GAIN.warMajor : TENSION_GAIN.war);
    for (const k in S.countries) if (C(k).alive && k !== a && k !== b && !allied(k, a)) this.addRel(k, a, -8);
  },
  onAnnex(actor) {
    this.addTension(TENSION_GAIN.annex);
    for (const k in S.countries) if (C(k).alive && k !== actor && this.ideo(k) === 'democratic') this.addRel(k, actor, -10);
  },

  // ---------- garanzie e fazioni ----------
  guarantee(by, to) {
    const e = this.check(by, to); if (e) return res(false, e);
    if (atWar(by, to)) return res(false, 'Siete in guerra.');
    if (C(by).overlord) return res(false, 'Un suddito non può garantire altri paesi.');
    if (S.guarantees.some(g => g.by === by && g.to === to)) return res(false, `Garantisci già ${C(to).name}.`);
    if (!this.tensionOk(by, 'guarantee')) return res(false, `Serve tensione mondiale ≥ ${TENSION_REQ.guarantee[this.ideo(by)]}%.`);
    if (!this.spend(by, DIPLO_COST.guarantee)) return this.needPP(DIPLO_COST.guarantee);
    guarantee(by, to);
    return res(true, `Hai garantito l'indipendenza di ${C(to).name}.`);
  },
  createFaction(code, name) {
    const c = C(code);
    if (c.faction) return res(false, 'Sei già in una fazione.');
    if (c.overlord) return res(false, 'Un suddito non può fondare fazioni.');
    if (!this.tensionOk(code, 'faction')) return res(false, `Serve tensione mondiale ≥ ${TENSION_REQ.faction[c.ideology]}%.`);
    if (!this.spend(code, DIPLO_COST.create)) return this.needPP(DIPLO_COST.create);
    createFaction(code);
    if (name) S.factions[c.faction].name = String(name).slice(0, 40);
    this.addTension(TENSION_GAIN.faction);
    return res(true, `Fondata la fazione ${S.factions[c.faction].name}.`);
  },
  // punteggio con cui `who` valuta l'adesione alla fazione di `leader`
  factionScore(who, leader) {
    const sharedEnemy = enemiesOf(who).some(e => enemiesOf(leader).includes(e) || membersOf(leader).some(m => atWar(m, e)));
    let s = this.opinion(who, leader);
    if (sharedEnemy) s += 60;
    if (this.ideo(who) === this.ideo(leader)) s += 20;
    if (C(who).major) s -= 40;
    // un paese minacciato da un vicino potente cerca protezione
    if (S.wargoals.some(w => w.vs === who && w.by !== leader && !allied(w.by, leader))) s += 25;
    return s;
  },
  inviteToFaction(inviter, target) {
    const e = this.check(inviter, target); if (e) return res(false, e);
    const p = C(inviter), t = C(target);
    if (!p.faction) return res(false, 'Non sei in una fazione.');
    if (t.faction) return res(false, `${t.name} è già in una fazione.`);
    if (t.overlord) return res(false, `${t.name} è un suddito di ${C(t.overlord).name}.`);
    if (atWar(inviter, target)) return res(false, 'Siete in guerra.');
    if (S.factions[p.faction].members.some(m => atWar(m, target))) return res(false, `${t.name} è in guerra con un membro della fazione.`);
    const sharedEnemy = enemiesOf(target).some(x => S.factions[p.faction].members.some(m => atWar(m, x)));
    if (!sharedEnemy && !this.tensionOk(target, 'faction')) return res(false, `${t.name} non entra in fazioni con tensione mondiale sotto il ${TENSION_REQ.faction[t.ideology]}%.`);
    if (!this.spend(inviter, DIPLO_COST.faction)) return this.needPP(DIPLO_COST.faction);
    const score = this.factionScore(target, inviter);
    if (score < 30) return res(false, `${t.name} ha rifiutato l'invito (valutazione ${score}, serve 30).`);
    joinFaction(target, p.faction);
    this.addTension(TENSION_GAIN.faction);
    return res(true, `${t.name} entra in ${S.factions[p.faction].name}.`);
  },
  askToJoinFaction(code, memberOf) {
    const e = this.check(code, memberOf); if (e) return res(false, e);
    const p = C(code), f = S.factions[C(memberOf).faction];
    if (!f) return res(false, `${C(memberOf).name} non è in una fazione.`);
    if (p.faction) return res(false, 'Sei già in una fazione.');
    if (p.overlord) return res(false, 'Un suddito non può entrare in fazioni.');
    if (f.members.some(m => atWar(m, code))) return res(false, 'Sei in guerra con un membro della fazione.');
    if (!this.tensionOk(code, 'faction') && !enemiesOf(code).length) return res(false, `Serve tensione mondiale ≥ ${TENSION_REQ.faction[p.ideology]}%.`);
    if (!this.spend(code, DIPLO_COST.faction)) return this.needPP(DIPLO_COST.faction);
    const score = this.opinion(f.leader, code) + (this.ideo(f.leader) === p.ideology ? 20 : 0) + (p.major ? -20 : 10)
      + (enemiesOf(code).some(x => f.members.some(m => atWar(m, x))) ? 60 : 0);
    if (score < 20) return res(false, `${f.name} ha respinto la richiesta (valutazione ${score}, serve 20).`);
    joinFaction(code, f.id);
    this.addTension(TENSION_GAIN.faction);
    return res(true, `Sei entrato in ${f.name}.`);
  },
  leaveFaction(code) {
    if (!C(code).faction) return res(false, 'Non sei in una fazione.');
    if (enemiesOf(code).length) return res(false, 'Non puoi lasciare la fazione durante una guerra.');
    const name = S.factions[C(code).faction].name;
    leaveFaction(code);
    S.mapDirty = true;
    return res(true, `Hai lasciato ${name}.`);
  },

  // ---------- patti di non aggressione e pretese ----------
  hasNap(a, b) { return S.naps.some(n => (n.a === a && n.b === b) || (n.a === b && n.b === a)); },
  signNap(a, b) {
    const e = this.check(a, b); if (e) return res(false, e);
    if (atWar(a, b)) return res(false, 'Siete in guerra.');
    if (this.hasNap(a, b)) return res(false, `Avete già un patto di non aggressione.`);
    if (!this.spend(a, DIPLO_COST.nap)) return this.needPP(DIPLO_COST.nap);
    const score = this.opinion(b, a) + (S.wargoals.some(w => w.by === b && w.vs === a) ? -50 : 0)
      + (powerOf(a) > powerOf(b) * 1.5 ? 25 : 0) + (enemiesOf(b).length ? 20 : 0);
    if (score < 0) return res(false, `${C(b).name} rifiuta il patto (valutazione ${score}, serve 0).`);
    S.naps.push({ a, b, since: S.day });
    S.wargoals = S.wargoals.filter(w => !((w.by === a && w.vs === b) || (w.by === b && w.vs === a)));
    log(`Patto di non aggressione tra ${C(a).name} e ${C(b).name}.`, involvesPlayer(a, b) ? 'good' : '');
    return res(true, `Patto di non aggressione firmato con ${C(b).name}.`);
  },
  breakNap(a, b) {
    if (!this.hasNap(a, b)) return res(false, `Non hai un patto con ${C(b).name}.`);
    S.naps = S.naps.filter(n => !((n.a === a && n.b === b) || (n.a === b && n.b === a)));
    for (const k in S.countries) if (k !== a && C(k).alive) this.addRel(k, a, k === b ? -50 : -15);
    this.addTension(3);
    log(`${C(a).name} rompe il patto di non aggressione con ${C(b).name}!`, involvesPlayer(a, b) ? 'bad' : 'big');
    return res(true, `Patto con ${C(b).name} rotto: tutti ora si fidano meno di te.`);
  },
  // Pretesa stile Monaco: annessione senza guerra se il bersaglio è isolato e molto più debole.
  demandAnnexation(a, b) {
    const e = this.check(a, b); if (e) return res(false, e);
    const A = C(a), B = C(b);
    if (A.overlord) return res(false, 'Un suddito non può avanzare pretese.');
    if (atWar(a, b) || allied(a, b)) return res(false, 'Non possibile con un nemico o un alleato.');
    if (B.major) return res(false, 'Una grande potenza non si piega a una pretesa.');
    if (b === S.player) return res(false, 'Non puoi farlo contro il giocatore.');
    if (!this.tensionOk(a, 'justify')) return res(false, `Serve tensione mondiale ≥ ${TENSION_REQ.justify[A.ideology]}%.`);
    if (!this.spend(a, DIPLO_COST.demand)) return this.needPP(DIPLO_COST.demand);
    const protectors = membersOf(b).filter(m => m !== b).concat(S.guarantees.filter(g => g.to === b && g.by !== a && C(g.by).alive).map(g => g.by));
    const ratio = powerOf(a) / Math.max(1, powerOf(b));
    if (protectors.length || ratio < 3) {
      this.addRel(b, a, -30);
      this.addTension(2);
      return res(false, `${B.name} respinge la pretesa (${protectors.length ? 'ha protettori: ' + protectors.map(x => C(x).name).join(', ') : `rapporto di forze ${ratio.toFixed(1)}:1, serve 3:1`}).`);
    }
    annex(a, b);
    return res(true, `${B.name} cede alla pretesa ed è annessa da ${A.name}.`);
  },

  // ---------- lend-lease ----------
  lendLeaseCheck(from, to) {
    const e = this.check(from, to); if (e) return e;
    if (atWar(from, to)) return 'Siete in guerra.';
    if (!this.tensionOk(from, 'lendLease') && !allied(from, to)) return `Serve tensione mondiale ≥ ${TENSION_REQ.lendLease[this.ideo(from)]}% per il lend-lease verso paesi non alleati.`;
    return null;
  },
  lendLease(from, to, amount) {
    const e = this.lendLeaseCheck(from, to); if (e) return res(false, e);
    amount = Math.floor(+amount);
    if (!(amount > 0)) return res(false, 'Quantità non valida.');
    if (C(from).equipment < amount) return res(false, `Hai solo ${fmt(C(from).equipment)} di equipaggiamento.`);
    this.transfer(from, to, amount);
    return res(true, `Inviati ${fmt(amount)} di equipaggiamento a ${C(to).name}.`);
  },
  transfer(from, to, amount) {
    C(from).equipment -= amount;
    C(to).equipment += amount;
    this.addRel(to, from, Math.min(10, amount / 300));
    const t = C(to);
    if (t.overlord === from && t.autonomy) t.autonomy.score = Math.max(0, t.autonomy.score - amount / 150);
  },
  setLendLease(from, to, perDay) {
    const e = this.lendLeaseCheck(from, to); if (e) return res(false, e);
    perDay = Math.max(0, Math.floor(+perDay || 0));
    S.lendLease = S.lendLease.filter(l => !(l.from === from && l.to === to));
    if (!perDay) return res(true, `Lend-lease verso ${C(to).name} sospeso.`);
    S.lendLease.push({ from, to, perDay });
    return res(true, `Lend-lease verso ${C(to).name}: ${perDay} equipaggiamento al giorno.`);
  },
  requestLendLease(to, from, amount) {
    const e = this.lendLeaseCheck(from, to); if (e) return res(false, e);
    amount = Math.floor(+amount);
    if (!(amount > 0)) return res(false, 'Quantità non valida.');
    const F = C(from);
    const op = this.opinion(from, to);
    const shared = enemiesOf(to).some(x => atWar(x, from) || enemiesOf(from).length === 0 && this.opinion(from, x) < -20);
    if (op < 25 && !(allied(from, to) && op >= 0)) return res(false, `${F.name} rifiuta: opinione ${op} (serve 25, o 0 tra alleati).`);
    if (!shared && !allied(from, to)) return res(false, `${F.name} non ha interesse ad armarvi.`);
    if (F.equipment < amount * 3 + 2000) return res(false, `${F.name} non ha equipaggiamento in eccesso.`);
    this.transfer(from, to, amount);
    return res(true, `${F.name} vi invia ${fmt(amount)} di equipaggiamento.`);
  },

  // ---------- pace bianca e capitolazione ----------
  // Progresso verso la capitolazione (0-1), come la barra di resa di HOI4.
  surrenderProgress(code) {
    const c = C(code);
    if (!c.alive) return 1;
    if (c.capitulated) return 1;
    let tot = 0, held = 0;
    for (const t of S.tiles) {
      if (!t.land || t.owner !== code) continue;
      const w = 1 + t.vp;
      tot += w;
      if (allied(t.ctrl, code)) held += w;
    }
    if (!tot) return 1;
    const thr = 0.33 + c.collabBonus;
    let sp = (1 - held / tot) / (1 - thr);
    if (!allied(S.tiles[c.capital].ctrl, code)) sp = Math.max(sp, (1 - held / tot) / (1 - (0.55 + c.collabBonus)));
    return Math.max(0, Math.min(1, sp));
  },
  family(code) { const t = this.top(code); return [t, ...this.subjectsOf(t)]; },
  proposeWhitePeace(a, b) {
    const e = this.check(a, b); if (e) return res(false, e);
    if (!atWar(a, b)) return res(false, `Non sei in guerra con ${C(b).name}.`);
    if (C(a).overlord) return res(false, 'Decide il tuo signore.');
    const tb = this.top(b);
    if (!this.spend(a, DIPLO_COST.whitePeace)) return this.needPP(DIPLO_COST.whitePeace);
    const spa = this.surrenderProgress(a), spb = this.surrenderProgress(tb);
    const age = S.day - ((S.warInfo[warKey(a, b)] || {}).start ?? S.day);
    const accept = (spb >= 0.2 && spb > spa + 0.05) || (age >= 365 && Math.abs(spa - spb) < 0.1 && this.opinion(tb, a) > -60);
    if (!accept) return res(false, `${C(tb).name} rifiuta la pace bianca (resa: loro ${Math.round(spb * 100)}%, tua ${Math.round(spa * 100)}%).`);
    this.makePeace(a, tb);
    return res(true, `Pace bianca firmata con ${C(tb).name}.`);
  },
  // chiude la guerra tra le due "famiglie" (signore + sudditi) e restituisce i territori occupati
  makePeace(a, b) {
    const fa = this.family(a), fb = this.family(b);
    const sa = new Set(fa), sb = new Set(fb);
    for (const x of fa) for (const y of fb) S.wars.delete(warKey(x, y));
    for (const t of S.tiles) {
      if (!t.land) continue;
      if ((sa.has(t.owner) && sb.has(t.ctrl)) || (sb.has(t.owner) && sa.has(t.ctrl))) t.ctrl = t.owner;
    }
    for (const x of fa) for (const y of fb) delete S.warInfo[warKey(x, y)];
    log(`Pace tra ${C(a).name} e ${C(b).name}.`, involvesPlayer(a, b) ? 'good' : '');
    this.addTension(TENSION_GAIN.peace);
    sendHomeStrays();
    S.mapDirty = true;
  },

  // punti partecipazione: danni inflitti in battaglia e territori occupati
  addContrib(loser, winner, v) {
    if (!loser || !winner || loser === winner) return;
    const m = S.contrib[loser] || (S.contrib[loser] = {});
    m[winner] = (m[winner] || 0) + v;
  },
  onCombat(atk, defs, A, D) {
    const nA = atk.length, nD = defs.length;
    for (const d of defs) for (const x of atk) this.addContrib(d.owner, x.owner, A / nA / nD);
    for (const x of atk) for (const d of defs) this.addContrib(x.owner, d.owner, D / nA / nD * 0.6);
  },
  onOccupy(t, by) { this.addContrib(t.owner, by, 20 + t.vp * 4); },

  // territorio senza più chi combatte per il paese capitolato → conferenza di pace
  stillFighting(code) {
    const enemies = enemiesOf(code).filter(e => !C(e).capitulated);
    if (!enemies.length) return false;
    for (const k in S.countries) {
      const y = S.countries[k];
      if (k === code || !y.alive || y.capitulated) continue;
      const side = allied(k, code) || S.guarantees.some(g => g.by === k && g.to === code);
      if (side && enemies.some(e => atWar(e, k))) return true;
    }
    return false;
  },

  // ---------- autonomia dei sudditi ----------
  makeSubject(over, sub, level = 1, joinWars = true) {
    const s = C(sub);
    for (const x of this.subjectsOf(sub)) C(x).overlord = null;
    if (s.faction) leaveFaction(sub);
    for (const k of [...S.wars]) {
      const [k0, k1] = warSides(k);
      if (k0 !== sub && k1 !== sub) continue;
      const other = k0 === sub ? k1 : k0;
      if (this.family(over).includes(other) || !joinWars) S.wars.delete(k);
    }
    s.overlord = over;
    s.autonomy = { level, score: 30 };
    s.capitulated = false;
    S.guarantees = S.guarantees.filter(g => g.by !== sub);
    if (joinWars) for (const e of enemiesOf(over)) if (!allied(sub, e) && !C(e).capitulated) S.wars.add(warKey(sub, e));
    S.mapDirty = true;
    log(`${s.name} diventa ${AUTONOMY_LEVELS[level].name.toLowerCase()} di ${C(over).name}.`, involvesPlayer(over, sub) ? 'good' : 'big');
  },
  reduceAutonomy(over, sub) {
    const s = C(sub);
    if (!s || s.overlord !== over) return res(false, `${s ? s.name : sub} non è un tuo suddito.`);
    if (!this.spend(over, DIPLO_COST.reduceAutonomy)) return this.needPP(DIPLO_COST.reduceAutonomy);
    s.autonomy.score = Math.max(0, s.autonomy.score - 15);
    this.addRel(sub, over, -5);
    return res(true, `Autonomia di ${s.name} ridotta (${Math.round(s.autonomy.score)}% del livello ${AUTONOMY_LEVELS[s.autonomy.level].name}).`);
  },
  integrateSubject(over, sub) {
    const s = C(sub);
    if (!s || s.overlord !== over) return res(false, `${s ? s.name : sub} non è un tuo suddito.`);
    if (s.autonomy.level !== 0 || s.autonomy.score > 50) return res(false, `Si può annettere solo un fantoccio integrato con autonomia ≤ 50% (ora: ${AUTONOMY_LEVELS[s.autonomy.level].name}, ${Math.round(s.autonomy.score)}%).`);
    if (enemiesOf(sub).length) return res(false, 'Non durante una guerra.');
    if (!this.spend(over, DIPLO_COST.integrate)) return this.needPP(DIPLO_COST.integrate);
    annex(over, sub);
    return res(true, `${s.name} è stato annesso.`);
  },
  releaseSubject(over, sub) {
    const s = C(sub);
    if (!s || s.overlord !== over) return res(false, `${s ? s.name : sub} non è un tuo suddito.`);
    s.overlord = null; s.autonomy = null;
    this.addRel(sub, over, 30);
    S.mapDirty = true;
    log(`${s.name} ottiene la piena indipendenza da ${C(over).name}.`, involvesPlayer(over, sub) ? 'good' : '');
    return res(true, `${s.name} è ora indipendente.`);
  },
  autonomyDaily(s) {
    const over = C(s.overlord), A = s.autonomy;
    if (!over.alive) { s.overlord = null; s.autonomy = null; return; }
    const L = AUTONOMY_LEVELS[A.level];
    const ratio = (s.civ + s.mil) / Math.max(1, over.civ + over.mil);
    A.score += 0.05 * L.gain * (1 + ratio * 2) * (this.opinion(s.code, over.code) < 0 ? 1.5 : 1);
    // estrazione di equipaggiamento verso il signore
    const take = s.mil * 3 * (1 + s.eqBonus) * L.extract;
    if (s.equipment >= take) { s.equipment -= take; over.equipment += take; }
    if (A.score >= 100) {
      if (A.level >= AUTONOMY_LEVELS.length - 1) {
        s.overlord = null; s.autonomy = null;
        log(`${s.name} ha raggiunto l'indipendenza da ${over.name}!`, involvesPlayer(s.code, over.code) ? 'warn' : 'big');
        S.mapDirty = true;
        return;
      }
      A.level++; A.score = 20;
      if (involvesPlayer(s.code, over.code)) log(`${s.name} sale a ${AUTONOMY_LEVELS[A.level].name}.`, 'warn');
    } else if (A.score <= 0) {
      if (A.level > 0) { A.level--; A.score = 80; if (involvesPlayer(s.code, over.code)) log(`${s.name} scende a ${AUTONOMY_LEVELS[A.level].name}.`, 'good'); }
      else A.score = 0;
    }
  },

  // ---------- governo collaborazionista ----------
  collabGovernment(occ, target) {
    const e = this.check(occ, target); if (e) return res(false, e);
    const t = C(target);
    if (!atWar(occ, target)) return res(false, `Non sei in guerra con ${t.name}.`);
    if (!t.capitulated) return res(false, `${t.name} deve prima capitolare.`);
    if (C(occ).overlord) return res(false, 'Un suddito non può insediare governi.');
    const comp = Occupation.avgCompliance(occ, target);
    if (comp < 40) return res(false, `Conformità media nei territori di ${t.name} troppo bassa: ${Math.round(comp)}% (serve 40%).`);
    const net = Intel.network(occ, target);
    if (net < 25) return res(false, `Rete di intelligence in ${t.name} troppo debole: ${Math.round(net)}% (serve 25%).`);
    if (!this.spend(occ, DIPLO_COST.collab)) return this.needPP(DIPLO_COST.collab);
    // separa la pace: il paese esce da tutte le guerre e diventa un fantoccio neutrale del vincitore
    for (const k of [...S.wars]) if (warSides(k).includes(target)) S.wars.delete(k);
    this.makeSubject(occ, target, 1, false);
    for (const tl of S.tiles) if (tl.land && tl.owner === target && allied(tl.ctrl, occ)) tl.ctrl = target;
    delete S.contrib[target];
    sendHomeStrays();
    log(`Governo collaborazionista insediato in ${t.name} sotto ${C(occ).name}.`, involvesPlayer(occ, target) ? 'good' : 'big');
    return res(true, `${t.name} ora ha un governo collaborazionista fedele a ${C(occ).name}.`);
  },

  // ---------- ciclo giornaliero ----------
  daily() {
    // la tensione cala lentamente in tempo di pace
    if (!S.wars.size) this.addTension(-0.02);
    for (const a in S.relMod) for (const b in S.relMod[a]) {
      const v = S.relMod[a][b];
      S.relMod[a][b] = Math.abs(v) < 0.03 ? 0 : v - Math.sign(v) * 0.03;
    }
    for (const w of S.wargoals) {
      if (!w.ready) {
        if (--w.days <= 0) {
          w.ready = true; w.expires = S.day + 365;
          this.addTension(C(w.vs).major ? TENSION_GAIN.justifyMajor : TENSION_GAIN.justify);
          if (involvesPlayer(w.by, w.vs)) log(`Obiettivo di guerra di ${C(w.by).name} contro ${C(w.vs).name} pronto.`, w.by === S.player ? 'good' : 'bad');
        }
      }
    }
    S.wargoals = S.wargoals.filter(w => C(w.by).alive && C(w.vs).alive && !atWar(w.by, w.vs) && (!w.ready || w.expires > S.day));
    for (const l of S.lendLease) {
      if (this.lendLeaseCheck(l.from, l.to)) { l.perDay = 0; continue; }
      if (C(l.from).equipment > 2000 + l.perDay) this.transfer(l.from, l.to, l.perDay);
    }
    S.lendLease = S.lendLease.filter(l => l.perDay > 0);
    for (const k in S.countries) {
      const c = S.countries[k];
      if (!c.alive) continue;
      if (c.overlord) this.autonomyDaily(c);
      // un paese capitolato che riprende la capitale torna in guerra
      if (c.capitulated && S.tiles[c.capital].ctrl === k) {
        c.capitulated = false;
        log(`${c.name} è stata liberata e torna a combattere!`, involvesPlayer(k) ? 'good' : 'big');
      }
    }
    if (!S.peace) {
      for (const k in S.countries) {
        const c = S.countries[k];
        if (c.alive && c.capitulated && !this.stillFighting(k)) { Peace.start(k); break; }
      }
    }
  },

  // ---------- IA dei paesi ----------
  aiThink(c) {
    const code = c.code;
    if (c.overlord) return;
    // lend-lease agli alleati in guerra
    if (c.major && c.equipment > 8000 && !enemiesOf(code).length) {
      for (const m of membersOf(code)) {
        if (m === code || !enemiesOf(m).length || S.lendLease.some(l => l.from === code && l.to === m)) continue;
        this.setLendLease(code, m, 8);
      }
    }
    // tenere sotto controllo i sudditi
    for (const s of this.subjectsOf(code)) if (C(s).autonomy.score > 70 && c.pp > 120) this.reduceAutonomy(code, s);
    // pace bianca quando la guerra è persa
    if (!c.capitulated && this.surrenderProgress(code) > 0.6 && c.pp > 60) {
      const en = enemiesOf(code).filter(e => !C(e).capitulated);
      if (en.length === 1) this.proposeWhitePeace(code, en[0]);
    }
    // governo collaborazionista sulle grandi potenze capitolate
    for (const e of enemiesOf(code)) {
      if (C(e).capitulated && C(e).major && c.pp > 80) { this.collabGovernment(code, e); break; }
    }
    // relazioni con i vicini della stessa ideologia
    if (c.pp > 150 && Math.random() < 0.1) {
      const cands = Object.keys(S.countries).filter(k => k !== code && C(k).alive && this.ideo(k) === c.ideology && this.rel(k, code) < 40);
      if (cands.length) this.improveRelations(code, cands[Math.floor(Math.random() * cands.length)]);
    }
  },
};

// ---------- conferenza di pace ----------
const DIRS = ['Est', 'Sud-Est', 'Sud', 'Sud-Ovest', 'Ovest', 'Nord-Ovest', 'Nord', 'Nord-Est'];
const Peace = {
  // Divide il territorio dello sconfitto in regioni: per stato se la mappa li ha,
  // altrimenti attorno a capitale e città.
  regions(loser) {
    const L = C(loser);
    const own = S.tiles.filter(t => t.land && t.owner === loser);
    if (!own.length) return [];
    const groups = new Map();
    if (own.some(t => t.state != null)) {
      for (const t of own) { const k = t.state ?? -1; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
    } else {
      const seeds = own.filter(t => t.vp > 0);
      if (!seeds.length) seeds.push(own[0]);
      const owner = new Map(), q = [];
      for (const s of seeds) { owner.set(s.i, s.i); q.push(s.i); }
      while (q.length) {
        const u = q.shift();
        for (const v of S.tiles[u].nb) if (!owner.has(v) && S.tiles[v].owner === loser && S.tiles[v].land) { owner.set(v, owner.get(u)); q.push(v); }
      }
      for (const t of own) {
        let k = owner.get(t.i);
        if (k == null) k = 'isole';
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(t);
      }
    }
    const cap = S.tiles[L.capital];
    const used = {};
    const out = [];
    const ind = (L.civ + L.mil) / own.length;
    for (const [k, ts] of groups) {
      let name;
      if (typeof k === 'number' && k >= 0 && ts[0].stateName) name = ts[0].stateName;
      else if (ts.some(t => t.i === L.capital)) name = 'Capitale';
      else if (k === 'isole') name = 'Isole';
      else {
        const mx = ts.reduce((s, t) => s + t.cx, 0) / ts.length, my = ts.reduce((s, t) => s + t.cy, 0) / ts.length;
        const ang = Math.atan2(my - cap.cy, mx - cap.cx);
        name = DIRS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
      }
      used[name] = (used[name] || 0) + 1;
      if (used[name] > 1) name += ' ' + used[name];
      const vp = ts.reduce((s, t) => s + t.vp, 0);
      out.push({ id: out.length, name: `${L.name} ${name}`, tiles: ts.map(t => t.i), vp, cost: Math.max(5, Math.round(ts.length * 1.2 + vp + ind * ts.length * 4)) });
    }
    return out;
  },

  start(loser) {
    const L = C(loser);
    const winners = enemiesOf(loser).filter(w => !C(w).capitulated && !C(w).overlord);
    // i sudditi non partecipano: i loro punti vanno al signore
    for (const w of enemiesOf(loser)) if (C(w).overlord && !winners.includes(Diplo.top(w)) && atWar(Diplo.top(w), loser)) winners.push(Diplo.top(w));
    if (!winners.length) { this.restore(loser); return; }
    const regions = this.regions(loser);
    const contrib = S.contrib[loser] || {};
    for (const w of enemiesOf(loser)) if (C(w).overlord && contrib[w]) Diplo.addContrib(loser, Diplo.top(w), contrib[w]);
    const total = winners.reduce((s, w) => s + (contrib[w] || 0), 0);
    const pool = regions.reduce((s, r) => s + r.cost, 0) * 1.1;
    const pts = {};
    for (const w of winners) pts[w] = Math.round(pool * (total > 0 ? 0.2 / winners.length + 0.8 * (contrib[w] || 0) / total : 1 / winners.length));
    S.peace = {
      loser, winners, pts, regions, passed: [], auto: false, puppetBy: null,
      tiles0: regions.reduce((s, r) => s + r.tiles.length, 0), civ0: L.civ, mil0: L.mil,
    };
    log(`Conferenza di pace per ${L.name}: ${winners.map(w => `${C(w).name} ${pts[w]} pt`).join(', ')}.`, involvesPlayer(loser, ...winners) ? 'big' : '');
    this.step();
  },

  goals(w, loser) {
    const g = [];
    for (const k in S.warInfo) for (const x of S.warInfo[k].goals) if (x.by === w && x.vs === loser) g.push(x.type);
    return g;
  },
  costOf(conf, w, opt) {
    const goals = this.goals(w, conf.loser);
    if (opt.type === 'take') {
      const r = conf.regions.find(x => x.id === opt.region);
      let c = r.cost;
      if (goals.includes('conquest')) c *= 0.7;
      const held = r.tiles.filter(i => S.tiles[i].ctrl === w).length;
      if (held * 2 >= r.tiles.length) c *= 0.8;
      return Math.max(1, Math.round(c));
    }
    if (opt.type === 'puppet') {
      let c = conf.regions.reduce((s, r) => s + r.cost, 0) * 0.6;
      if (goals.includes('puppet')) c *= 0.7;
      return Math.max(1, Math.round(c));
    }
    return 0;
  },
  options(conf, w) {
    const o = [];
    for (const r of conf.regions) o.push({ type: 'take', region: r.id, label: `Prendi ${r.name} (${r.tiles.length} territori${r.vp ? `, ${r.vp} PV` : ''})` });
    if (!conf.puppetBy && conf.regions.length && !C(w).overlord) o.push({ type: 'puppet', label: `Rendi ${C(conf.loser).name} uno stato fantoccio (tiene le regioni rimaste)` });
    for (const x of o) x.cost = this.costOf(conf, w, x);
    return o.filter(x => x.cost <= conf.pts[w]);
  },
  nextBidder(conf) {
    if (!conf.regions.length || conf.puppetBy) return null;
    const live = conf.winners.filter(w => !conf.passed.includes(w) && C(w).alive && this.options(conf, w).length);
    live.sort((a, b) => conf.pts[b] - conf.pts[a]);
    return live[0] || null;
  },
  step() {
    const conf = S.peace;
    while (conf && S.peace === conf) {
      const w = this.nextBidder(conf);
      if (!w) { this.finish(conf); return; }
      if (w === S.player && !conf.auto) { this.askPlayer(conf); return; }
      this.apply(conf, w, this.aiChoice(conf, w));
    }
  },
  askPlayer(conf) {
    const opts = this.options(conf, S.player);
    const lines = conf.winners.map(w => `${C(w).name}: ${conf.pts[w]} pt`).join(' · ');
    const buttons = opts.map(o => ({ label: `${o.label} · ${o.cost} pt`, fn: () => { this.apply(conf, S.player, o); this.step(); } }));
    buttons.push({ label: 'Lascia decidere ai consiglieri', fn: () => { conf.auto = true; this.step(); } });
    buttons.push({ label: 'Passa (non prendere altro)', fn: () => { this.apply(conf, S.player, { type: 'pass' }); this.step(); } });
    UI.ask(`Conferenza di pace: ${C(conf.loser).name}`,
      `Punti partecipazione: ${lines}. Regioni rimaste: ${conf.regions.length}. Ciò che nessuno reclama resta a ${C(conf.loser).name}.`, buttons);
  },
  // scelta valida per l'IA testuale o l'interfaccia: indice nelle opzioni o 'pass'
  playerChoose(choice) {
    const conf = S.peace;
    if (!conf || this.nextBidder(conf) !== S.player) return res(false, 'Non è il tuo turno in una conferenza di pace.');
    const opts = this.options(conf, S.player);
    const o = choice === 'pass' ? { type: 'pass' } : opts[+choice];
    if (!o) return res(false, 'Opzione non valida.');
    this.apply(conf, S.player, o);
    this.step();
    return res(true, 'Fatto.');
  },
  aiChoice(conf, w) {
    const opts = this.options(conf, w);
    const W = C(w);
    const goals = this.goals(w, conf.loser);
    const pup = opts.find(o => o.type === 'puppet');
    if (pup && (goals.includes('puppet') || (W.ideology !== 'fascism' && conf.regions.length > 1 && Math.random() < 0.4))) return pup;
    let best = null, bs = -Infinity;
    for (const o of opts) {
      if (o.type !== 'take') continue;
      const r = conf.regions.find(x => x.id === o.region);
      const held = r.tiles.filter(i => S.tiles[i].ctrl === w).length / r.tiles.length;
      let adj = false;
      for (const i of r.tiles) { for (const n of S.tiles[i].nb) if (S.tiles[n].owner === w) { adj = true; break; } if (adj) break; }
      if (!adj && held < 0.5 && W.ideology === 'democratic') continue;
      const s = (r.cost + r.vp * 2) * (1 + held) * (adj ? 1.3 : 0.5) / o.cost;
      if (s > bs) { bs = s; best = o; }
    }
    return best || pup || { type: 'pass' };
  },
  apply(conf, w, o) {
    if (o.type === 'pass') { conf.passed.push(w); return; }
    const cost = this.costOf(conf, w, o);
    if (cost > conf.pts[w]) { conf.passed.push(w); return; }
    conf.pts[w] -= cost;
    if (o.type === 'puppet') { conf.puppetBy = w; return; }
    const r = conf.regions.find(x => x.id === o.region);
    if (!r) return;
    conf.regions = conf.regions.filter(x => x !== r);
    const L = C(conf.loser), W = C(w);
    const share = r.tiles.length / Math.max(1, conf.tiles0);
    const dc = Math.min(L.civ, Math.round(conf.civ0 * share)), dm = Math.min(L.mil, Math.round(conf.mil0 * share));
    L.civ -= dc; L.mil -= dm; W.civ += dc; W.mil += dm;
    for (const i of r.tiles) { const t = S.tiles[i]; t.owner = w; t.ctrl = w; }
    S.mapDirty = true;
    log(`${W.name} ottiene ${r.name}.`, involvesPlayer(w, conf.loser) ? 'big' : '');
  },
  finish(conf) {
    const loser = conf.loser, L = C(loser);
    S.peace = null;
    for (const w of conf.winners) for (const x of Diplo.family(w)) S.wars.delete(warKey(x, loser));
    for (const k of [...S.wars]) { const [k0, k1] = warSides(k); if ((k0 === loser || k1 === loser) && conf.winners.some(w => allied(w, k0 === loser ? k1 : k0))) S.wars.delete(k); }
    for (const k in S.warInfo) if (warSides(k).includes(loser) && !S.wars.has(k)) delete S.warInfo[k];
    delete S.contrib[loser];
    for (const t of S.tiles) if (t.land && t.owner === loser) t.ctrl = loser;
    const left = S.tiles.filter(t => t.land && t.owner === loser);
    if (!left.length) {
      for (const d of S.divs) if (d.owner === loser) destroyDiv(d);
      killCountry(loser);
      log(`${L.name} cessa di esistere.`, 'big');
    } else {
      L.capitulated = false;
      if (S.tiles[L.capital].owner !== loser) {
        const nc = left.sort((a, b) => b.vp - a.vp)[0];
        L.capital = nc.i; nc.vp = Math.max(nc.vp, 20);
      }
      L.civ = Math.max(1, L.civ); L.mil = Math.max(1, L.mil);
      if (L.faction) leaveFaction(loser);
      if (conf.puppetBy) Diplo.makeSubject(conf.puppetBy, loser, 1);
      else log(`${L.name} firma la pace e mantiene ${left.length} territori.`, involvesPlayer(loser) ? 'warn' : '');
    }
    Diplo.addTension(TENSION_GAIN.peace);
    sendHomeStrays();
    S.mapDirty = true;
    UI.dirty = true;
  },
  // nessun vincitore (es. hanno tutti firmato la pace): il paese torna in sé
  restore(loser) {
    const L = C(loser);
    L.capitulated = false;
    for (const t of S.tiles) if (t.land && t.owner === loser && !atWar(t.ctrl, loser)) t.ctrl = loser;
    S.mapDirty = true;
  },
};

// Un giorno di diplomazia, spionaggio e occupazione (chiamato da tick() in game.js).
// L'IA dei paesi per questi sistemi gira ogni 10 giorni, sfalsata per paese.
function diploTick() {
  Diplo.daily();
  Intel.daily();
  Occupation.daily();
  for (const k in S.countries) {
    const c = S.countries[k];
    if (!c.alive || c.capitulated || k === S.player || (S.day + c.slot * 3) % 10 !== 0) continue;
    Diplo.aiThink(c);
    Intel.aiThink(c);
    Occupation.aiThink(c);
  }
}
