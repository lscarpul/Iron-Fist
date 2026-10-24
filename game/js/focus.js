'use strict';

// ============================================================================
// Sistema dei focus nazionali in stile Hearts of Iron IV.
// Ogni nazione ha un albero: i focus durano (di norma) 70 giorni, hanno
// prerequisiti (tutti richiesti, oppure "uno tra"), focus mutuamente esclusivi
// (scegliere un ramo chiude l'altro) e condizioni di disponibilità.
// Gli alberi sono definiti in focustrees.js con le funzioni qui sotto.
// ============================================================================

const FOCUS_DAYS = 70;
const FOCUS_TREES = {};

const IDEOLOGIES = {
  democratic: { name: 'Democrazia', short: 'Democratico', color: '#4a86c4', ic: '🗳️' },
  fascist: { name: 'Fascismo', short: 'Fascista', color: '#8a5a2c', ic: '🦅' },
  communist: { name: 'Comunismo', short: 'Comunista', color: '#b8322a', ic: '☭' },
  neutral: { name: 'Non allineato', short: 'Non allineato', color: '#8a8a7a', ic: '⚖️' },
};

// Governo e capo di stato al 1° gennaio 1936
const START_POLITICS = {
  G: ['fascist', 'Adolf Hitler'], F: ['democratic', 'Albert Sarraut'], U: ['democratic', 'Stanley Baldwin'],
  I: ['fascist', 'Benito Mussolini'], S: ['communist', 'Iosif Stalin'], P: ['neutral', 'Ignacy Mościcki'],
  E: ['democratic', 'Manuel Azaña'], O: ['neutral', 'António de Oliveira Salazar'], B: ['democratic', 'Hendrikus Colijn'],
  D: ['democratic', 'Thorvald Stauning'], N: ['democratic', 'Johan Nygaardsvold'], W: ['democratic', 'Per Albin Hansson'],
  K: ['democratic', 'Pehr Evind Svinhufvud'], X: ['neutral', 'Konstantin Päts'], C: ['democratic', 'Edvard Beneš'],
  A: ['neutral', 'Kurt Schuschnigg'], Z: ['democratic', 'Albert Meyer'], H: ['neutral', 'Miklós Horthy'],
  R: ['neutral', 'Carlo II'], Y: ['neutral', 'Principe Paolo'], L: ['neutral', 'Boris III'],
  Q: ['neutral', 'Giorgio II'], T: ['neutral', 'Mustafa Kemal Atatürk'],
  // nazioni della mappa reale e del mondo (tag in stile HoI4)
  HOL: ['democratic', 'Hendrikus Colijn'], LUX: ['democratic', 'Joseph Bech'], EST: ['neutral', 'Konstantin Päts'],
  LAT: ['neutral', 'Kārlis Ulmanis'], LIT: ['neutral', 'Antanas Smetona'], ALB: ['neutral', 'Re Zog I'],
  IRE: ['democratic', 'Éamon de Valera'], ICE: ['democratic', 'Hermann Jónasson'], EGY: ['neutral', 'Re Fuad I'],
  IRQ: ['neutral', 'Re Ghazi'], PER: ['neutral', 'Reza Shah Pahlavi'], SAU: ['neutral', 'Ibn Saud'],
  USA: ['democratic', 'Franklin D. Roosevelt'], JAP: ['fascist', 'Imperatore Hirohito'], CHI: ['neutral', 'Chiang Kai-shek'],
  PRC: ['communist', 'Mao Zedong'], MAN: ['fascist', 'Pu Yi'], MEN: ['fascist', 'Demchugdongrub'],
  SHX: ['neutral', 'Yan Xishan'], GXC: ['neutral', 'Li Zongren'], YUN: ['neutral', 'Long Yun'], XSM: ['neutral', 'Ma Bufang'],
  SIK: ['neutral', 'Sheng Shicai'], MON: ['communist', 'Khorloogiin Choibalsan'], TIB: ['neutral', 'Reting Rinpoche'],
  SIA: ['neutral', 'Phraya Phahon'], CAN: ['democratic', 'William Lyon Mackenzie King'], AST: ['democratic', 'Joseph Lyons'],
  NZL: ['democratic', 'Michael Joseph Savage'], SAF: ['democratic', 'J. B. M. Hertzog'], RAJ: ['democratic', 'Lord Linlithgow'],
  MEX: ['democratic', 'Lázaro Cárdenas'], BRA: ['neutral', 'Getúlio Vargas'], ARG: ['neutral', 'Agustín P. Justo'],
  CHL: ['democratic', 'Arturo Alessandri'], PRU: ['neutral', 'Óscar R. Benavides'], COL: ['democratic', 'Alfonso López Pumarejo'],
  VEN: ['neutral', 'Eleazar López Contreras'], ETH: ['neutral', 'Hailé Selassié'], LIB: ['democratic', 'Edwin Barclay'],
  TAN: ['communist', 'Salchak Toka'], NEP: ['neutral', 'Juddha Shamsher Rana'], BHU: ['neutral', 'Jigme Wangchuck'],
  AFG: ['neutral', 'Mohammed Zahir Shah'], PHI: ['democratic', 'Manuel L. Quezon'], GUA: ['neutral', 'Jorge Ubico'],
  HON: ['neutral', 'Tiburcio Carías Andino'], ELS: ['neutral', 'Maximiliano Hernández Martínez'], NIC: ['neutral', 'Anastasio Somoza'],
  COS: ['democratic', 'León Cortés Castro'], PAN: ['democratic', 'Harmodio Arias'], CUB: ['neutral', 'Fulgencio Batista'],
  HAI: ['neutral', 'Sténio Vincent'], DOM: ['neutral', 'Rafael Trujillo'], ECU: ['neutral', 'Federico Páez'],
  BOL: ['neutral', 'José Luis Tejada Sorzano'], PAR: ['neutral', 'Rafael Franco'], URU: ['neutral', 'Gabriel Terra'],
  YEM: ['neutral', 'Imam Yahya'], OMA: ['neutral', 'Said bin Taimur'],
};

// nomi italiani per i tag che potrebbero non essere ancora sulla mappa (testi dei focus)
const TAG_NAMES = {
  HOL: 'Paesi Bassi', LUX: 'Lussemburgo', EST: 'Estonia', LAT: 'Lettonia', LIT: 'Lituania', ALB: 'Albania',
  IRE: 'Irlanda', ICE: 'Islanda', EGY: 'Egitto', IRQ: 'Iraq', PER: 'Persia', SAU: 'Arabia Saudita',
  USA: 'Stati Uniti', JAP: 'Giappone', CHI: 'Cina', PRC: 'Cina comunista', MAN: 'Manciukuò', MEN: 'Mengjiang',
  SHX: 'Shanxi', GXC: 'Cricca del Guangxi', YUN: 'Yunnan', XSM: 'Xibei San Ma', SIK: 'Sinkiang', MON: 'Mongolia', TIB: 'Tibet',
  SIA: 'Siam', CAN: 'Canada', AST: 'Australia', NZL: 'Nuova Zelanda', SAF: 'Sudafrica', RAJ: 'India britannica',
  MEX: 'Messico', BRA: 'Brasile', ARG: 'Argentina', CHL: 'Cile', PRU: 'Perù', COL: 'Colombia', VEN: 'Venezuela',
  ETH: 'Etiopia', LIB: 'Liberia', X: 'Paesi Baltici', TAN: 'Tannu Tuva', NEP: 'Nepal', BHU: 'Bhutan', AFG: 'Afghanistan',
  PHI: 'Filippine', GUA: 'Guatemala', HON: 'Honduras', ELS: 'El Salvador', NIC: 'Nicaragua', COS: 'Costa Rica', PAN: 'Panama',
  CUB: 'Cuba', HAI: 'Haiti', DOM: 'Repubblica Dominicana', ECU: 'Ecuador', BOL: 'Bolivia', PAR: 'Paraguay', URU: 'Uruguay',
  YEM: 'Yemen', OMA: 'Oman',
};

// Modificatori permanenti (c.mods). Quelli segnati "wired" agiscono già sul gioco,
// gli altri sono pronti per i sistemi di ricerca, stabilità ecc.
const MOD_LABELS = {
  research_speed: 'velocità di ricerca',
  construction_speed: 'velocità di costruzione',
  stability: 'stabilità',
  war_support: 'supporto alla guerra',
  factory_output: 'produzione delle fabbriche',
  production_efficiency: 'efficienza produttiva massima',
  efficiency_retention: 'ritenzione dell\'efficienza',
  resource_gain: 'risorse estratte',
  supply: 'capacità di rifornimento',
  entrenchment: 'trinceramento',
  planning: 'pianificazione massima',
  naval_build: 'velocità di costruzione navale',
  air_build: 'produzione aerea',
  trade: 'opinione commerciale',
  conscription: 'leva disponibile',
};

const EFFECT_LABELS = {
  atkBonus: 'attacco delle divisioni', defBonus: 'difesa delle divisioni', speedBonus: 'velocità di movimento',
  recBonus: 'rinforzi e recupero organizzazione', mpBonus: 'crescita della manodopera', eqBonus: 'produzione di equipaggiamento',
};

const RESEARCH_CATS = {
  infantry: 'Fanteria', armor: 'Corazzati', artillery: 'Artiglieria', support: 'Supporto', air: 'Aviazione',
  naval: 'Marina', industry: 'Industria', electronics: 'Elettronica', doctrine: 'Dottrine terrestri',
  air_doctrine: 'Dottrine aeree', naval_doctrine: 'Dottrine navali', rocketry: 'Razzi', nuclear: 'Nucleare',
};

// ---------- DSL per definire gli alberi ----------
// F(id, nome, x, opzioni). opzioni:
//   pre: ['a', ['b','c']]  = a E (b O c)        ex: focus mutuamente esclusivi
//   y: riga (altrimenti calcolata dai prerequisiti)   days: durata (default 70)
//   cond: { year, date, alive:[..], dead:[..], ideology, notIdeology, peace, war, faction, noFaction, major }
//   eff: effetti (vedi applyFocusEffects)   ai: peso per l'IA (default 1, storico 10, 0 = mai)
//   ic: icona   d: testo descrittivo
function F(id, name, x, o = {}) { return { id, name, x, ...o }; }

function defTree(code, title, parts) {
  const list = parts.flat();
  const byId = {};
  for (const f of list) {
    if (byId[f.id]) throw new Error(`Focus duplicato ${code}.${f.id}`);
    f.days = f.days || FOCUS_DAYS;
    f.pre = (f.pre || []).map(p => Array.isArray(p) ? p : [p]);
    f.ex = f.ex || [];
    f.eff = f.eff || {};
    if (f.ai == null) f.ai = 1;
    byId[f.id] = f;
  }
  // esclusioni simmetriche e righe calcolate dai prerequisiti
  for (const f of list) for (const e of f.ex) {
    if (!byId[e]) throw new Error(`Esclusione sconosciuta ${code}.${f.id} -> ${e}`);
    if (!byId[e].ex.includes(f.id)) byId[e].ex.push(f.id);
  }
  const rowOf = f => {
    if (f.y != null) return f.y;
    let y = 0;
    for (const g of f.pre) for (const p of g) {
      if (!byId[p]) throw new Error(`Prerequisito sconosciuto ${code}.${f.id} -> ${p}`);
      y = Math.max(y, rowOf(byId[p]) + 1);
    }
    return (f.y = y);
  };
  list.forEach(rowOf);
  for (const f of list) if (!f.ic) f.ic = guessIcon(f);
  FOCUS_TREES[code] = { code, title, focuses: list, byId };
  return FOCUS_TREES[code];
}

function guessIcon(f) {
  const e = f.eff;
  if (e.ideology) return IDEOLOGIES[e.ideology].ic;
  if (e.war) return '⚔️';
  if (e.annex) return '🏴';
  if (e.createFaction || e.joinFaction || e.invite || e.guarantee || e.nap) return '🤝';
  if (e.research?.some(r => r.cat === 'air' || r.cat === 'air_doctrine')) return '✈️';
  if (e.research?.some(r => r.cat === 'naval' || r.cat === 'naval_doctrine')) return '⚓';
  if (e.research?.some(r => r.cat === 'armor')) return '🛡️';
  if (e.mil) return '⚙️';
  if (e.civ || e.slots) return '🏭';
  if (e.research) return '🔬';
  if (e.atkBonus || e.defBonus || e.divs || e.xp) return '🎖️';
  if (e.manpower || e.mpBonus) return '👥';
  return '📜';
}

// ---------- stato ----------
function initFocusState(c) {
  const [ideo, leader] = START_POLITICS[c.code] || ['neutral', ''];
  c.ideology = ideo;
  c.leader = leader;
  // altri sistemi (ricerca) possono aver già creato questi campi: si sommano, non si sovrascrivono
  c.mods = c.mods || {};
  c.researchBonuses = c.researchBonuses || [];
  c.xp = c.xp || { army: 0, air: 0, navy: 0 };
  c.extraSlots = 0;
  c.naps = new Set();
  c.focusLog = [];
}

const focusTree = c => FOCUS_TREES[c.code] || (c.major ? FOCUS_TREES._generic_major : FOCUS_TREES._generic);
const focusById = (c, id) => focusTree(c).byId[id];
const curYear = () => dayDate(S.day).getUTCFullYear();
const addMod = (c, k, v) => { c.mods[k] = +((c.mods[k] || 0) + v).toFixed(3); };
const modOf = (c, k) => (c.mods && c.mods[k]) || 0;
const asList = v => v == null ? [] : Array.isArray(v) ? v : [v];
const countryName = code => (S && S.countries[code]?.name) || COUNTRY_DEFS[code]?.name || TAG_NAMES[code] || code;
// nelle liste di bersagli contano solo i paesi presenti sulla mappa
const existing = v => asList(v).filter(k => !S || S.countries[k]);

function condMet(c, cond) {
  if (!cond) return true;
  if (cond.year && curYear() < cond.year) return false;
  if (cond.date && S.day < Math.round((Date.parse(cond.date) - START_TS) / DAY_MS)) return false;
  if (cond.alive && !asList(cond.alive).every(k => S.countries[k]?.alive)) return false;
  if (cond.dead && !asList(cond.dead).every(k => !S.countries[k]?.alive)) return false;
  if (cond.anyAlive && !asList(cond.anyAlive).some(k => S.countries[k]?.alive)) return false;
  if (cond.exists && !asList(cond.exists).every(k => S.countries[k])) return false;
  if (cond.ideology && !asList(cond.ideology).includes(c.ideology)) return false;
  if (cond.notIdeology && asList(cond.notIdeology).includes(c.ideology)) return false;
  if (cond.peace && enemiesOf(c.code).length) return false;
  if (cond.war && !enemiesOf(c.code).length) return false;
  if (cond.faction && !c.faction) return false;
  if (cond.noFaction && c.faction) return false;
  if (cond.notAllied && asList(cond.notAllied).some(k => allied(k, c.code))) return false;
  if (cond.notAtWarWith && asList(cond.notAtWarWith).some(k => atWar(k, c.code))) return false;
  if (cond.atWarWith && !asList(cond.atWarWith).some(k => atWar(k, c.code))) return false;
  if (cond.ideologyOf) for (const k in cond.ideologyOf) if (S.countries[k]?.ideology !== cond.ideologyOf[k]) return false;
  return true;
}

function condText(cond) {
  if (!cond) return [];
  const r = [];
  const names = v => asList(v).map(countryName).join(', ');
  if (cond.year) r.push(`Dal ${cond.year}`);
  if (cond.date) { const d = new Date(Date.parse(cond.date)); r.push(`Dal ${d.getUTCDate()} ${MONTHS_IT[d.getUTCMonth()]} ${d.getUTCFullYear()}`); }
  if (cond.alive) r.push(`Esiste: ${names(cond.alive)}`);
  if (cond.dead) r.push(`Non esiste più: ${names(cond.dead)}`);
  if (cond.anyAlive) r.push(`Esiste almeno uno tra: ${names(cond.anyAlive)}`);
  if (cond.exists) r.push(`Presente sulla mappa: ${names(cond.exists)}`);
  if (cond.ideology) r.push(`Governo: ${asList(cond.ideology).map(i => IDEOLOGIES[i].short).join(' o ')}`);
  if (cond.notIdeology) r.push(`Governo non ${asList(cond.notIdeology).map(i => IDEOLOGIES[i].short).join(' né ')}`);
  if (cond.peace) r.push('In pace');
  if (cond.war) r.push('In guerra');
  if (cond.faction) r.push('In una fazione');
  if (cond.noFaction) r.push('Fuori da ogni fazione');
  if (cond.notAllied) r.push(`Non alleato con: ${names(cond.notAllied)}`);
  if (cond.notAtWarWith) r.push(`Non in guerra con: ${names(cond.notAtWarWith)}`);
  if (cond.atWarWith) r.push(`In guerra con: ${names(cond.atWarWith)}`);
  if (cond.ideologyOf) for (const k in cond.ideologyOf) r.push(`${countryName(k)} con governo ${IDEOLOGIES[cond.ideologyOf[k]].short}`);
  return r;
}

// stato di un focus per il paese: done | current | available | blocked (condizioni) | locked (prerequisiti) | excluded
function focusState(c, f) {
  if (c.done.has(f.id)) return 'done';
  if (c.focus === f.id) return 'current';
  if (f.ex.some(e => c.done.has(e) || c.focus === e)) return 'excluded';
  if (!f.pre.every(g => g.some(p => c.done.has(p)))) return 'locked';
  if (!condMet(c, f.cond)) return 'blocked';
  return 'available';
}
function focusAvailable(c, f) { return focusState(c, f) === 'available'; }

function startFocus(c, id) {
  const f = focusById(c, id);
  if (!f || c.focus || !focusAvailable(c, f)) return false;
  c.focus = id;
  c.focusDays = Math.max(7, Math.round(f.days * (1 - modOf(c, 'focus_speed'))));
  c.focusTotal = c.focusDays;
  return true;
}
function cancelFocus(c) { c.focus = null; c.focusDays = 0; }

// chiamata ogni giorno da economy()
function focusDay(c) {
  if (!c.focus) return;
  if (--c.focusDays > 0) return;
  const f = focusById(c, c.focus);
  c.focus = null;
  if (!f) return;
  c.done.add(f.id);
  c.focusLog.push({ id: f.id, day: S.day });
  if (c.code === S.player) log(`Focus nazionale completato: ${f.name}.`, 'good');
  else if (c.major && (f.eff.ideology || f.eff.war || f.eff.createFaction)) log(`${c.name} completa il focus “${f.name}”.`, 'big');
  applyFocusEffects(c, f.eff, f);
}

function power(code) {
  const c = C(code);
  let d = 0;
  for (const x of S.divs) if (x.owner === code && !x.dead) d += x.str;
  return c.civ + c.mil * 2 + d;
}

function applyFocusEffects(c, e, f) {
  const code = c.code;
  for (const k of ['civ', 'mil', 'manpower', 'equipment', 'pp', 'ppGain', 'extraSlots']) if (e[k]) c[k] += e[k];
  if (e.slots) c.extraSlots += e.slots;
  if (e.researchSlots) c.researchSlots = (c.researchSlots || 0) + e.researchSlots;
  for (const k in EFFECT_LABELS) if (e[k]) c[k] += e[k];
  if (e.armorTech) c.armorTech = true;
  if (e.mods) for (const k in e.mods) addMod(c, k, e.mods[k]);
  if (e.xp) for (const k in e.xp) c.xp[k] = (c.xp[k] || 0) + e.xp[k];
  if (e.research) for (const r of e.research) c.researchBonuses.push({ ...r, from: f.name });
  if (e.leader) c.leader = e.leader;
  if (e.ideology && e.ideology !== c.ideology) {
    c.ideology = e.ideology;
    // un cambio di regime fa uscire dalla fazione di ideologia diversa
    const fac = c.faction && S.factions[c.faction];
    if (fac && fac.leader !== code && C(fac.leader).ideology !== e.ideology && !enemiesOf(code).length) {
      leaveFaction(code);
      log(`${c.name} lascia la sua fazione dopo il cambio di regime.`, involvesPlayer(code) ? 'warn' : '');
    }
    log(`${c.name}: nuovo regime ${IDEOLOGIES[e.ideology].short.toLowerCase()}${e.leader ? ` guidato da ${e.leader}` : ''}.`, 'big');
    S.mapDirty = true;
  }
  if (e.divs) {
    const tile = spawnTile(c);
    if (tile >= 0) for (const t in e.divs) for (let i = 0; i < e.divs[t]; i++) createDiv(code, t, tile);
  }
  if (e.leaveFaction && c.faction) { leaveFaction(code); log(`${c.name} esce dalla sua fazione.`, involvesPlayer(code) ? 'warn' : ''); }
  if (e.createFaction) {
    if (c.faction && S.factions[c.faction]?.leader !== code && !enemiesOf(code).length) leaveFaction(code);
    if (!c.faction) {
      const id = 'f_' + code;
      S.factions[id] = { id, name: e.createFaction, leader: code, members: [] };
      joinFaction(code, id);
    }
  }
  if (e.joinFaction) {
    const leader = asList(e.joinFaction).map(k => S.countries[k]).find(l => l && l.alive && l.faction);
    if (leader && c.faction !== leader.faction && !S.factions[leader.faction].members.some(m => atWar(m, code))) {
      if (!c.faction || !enemiesOf(code).length) joinFaction(code, leader.faction);
    }
  }
  if (e.aid) for (const t in e.aid) if (S.countries[t]?.alive && !atWar(code, t)) {
    C(t).equipment += e.aid[t];
    log(`${c.name} invia ${fmt(e.aid[t])} di equipaggiamento a ${C(t).name}.`, involvesPlayer(code, t) ? 'good' : '');
  }
  for (const t of asList(e.invite)) focusInvite(c, t);
  for (const t of asList(e.guarantee)) if (S.countries[t]?.alive && !atWar(code, t)) guarantee(code, t);
  for (const t of asList(e.nap)) if (S.countries[t]?.alive) {
    c.naps.add(t); C(t).naps.add(code);
    log(`${c.name} e ${C(t).name} firmano un patto di non aggressione.`, involvesPlayer(code, t) ? 'good' : '');
  }
  for (const t of asList(e.annex)) focusAnnex(c, t, f);
  for (const t of asList(e.war)) {
    const tg = S.countries[t];
    if (!tg?.alive || atWar(code, t) || allied(code, t)) continue;
    c.naps.delete(t); tg.naps.delete(code);
    declareWar(code, t);
  }
  UI.dirty = true;
}

// annessione pacifica: l'IA accetta se è nettamente più debole e senza grandi potenze a proteggerla
function annexAccepted(actor, t) {
  const tg = C(t);
  const side = new Set(membersOf(t));
  for (const g of S.guarantees) if (g.to === t && C(g.by).alive) side.add(g.by);
  side.delete(t);
  if ([...side].some(k => C(k).major)) return false;
  let p = power(t);
  for (const k of side) p += power(k);
  return p < power(actor) * 0.45;
}

// annessione pacifica: l'IA accetta se è nettamente più debole e senza protettori
function focusAnnex(c, t, f) {
  const tg = S.countries[t];
  if (!tg?.alive || atWar(c.code, t) || allied(c.code, t)) return;
  if (t === S.player) {
    UI.ask(f.name, `${c.name} pretende l'annessione del tuo paese. Se rifiuti sarà la guerra.`,
      [{ label: 'Rifiuta: guerra!', fn: () => declareWar(c.code, t) }, { label: 'Accetta (fine partita)', fn: () => annex(c.code, t) }]);
    return;
  }
  if (annexAccepted(c.code, t)) annex(c.code, t);
  else {
    log(`${tg.name} respinge le richieste di ${c.name}: è la guerra!`, involvesPlayer(c.code, t) ? 'bad' : '');
    declareWar(c.code, t);
  }
}

function focusInvite(c, t) {
  const tg = S.countries[t];
  if (!c.faction || !tg?.alive || tg.faction || membersOf(c.code).some(m => atWar(m, t))) return;
  if (t === S.player) {
    UI.ask('Invito in fazione', `${c.name} ti invita a entrare in ${S.factions[c.faction].name}. Accetti?`,
      [{ label: 'Entra', fn: () => joinFaction(t, c.faction) }, { label: 'Rifiuta' }]);
    return;
  }
  const same = tg.ideology === c.ideology;
  if (same || (tg.ideology === 'neutral' && Math.random() < 0.5)) joinFaction(t, c.faction);
  else log(`${tg.name} declina l'invito di ${c.name}.`, involvesPlayer(c.code) ? 'warn' : '');
}

// ---------- testi degli effetti ----------
const pct = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const num = v => `${v > 0 ? '+' : ''}${fmt(v)}`;
function effectText(e) {
  const r = [];
  const names = v => (existing(v).length ? existing(v) : asList(v)).map(countryName).join(', ');
  if (e.text) r.push(e.text);
  if (e.ideology) r.push(`Il governo diventa ${IDEOLOGIES[e.ideology].short.toLowerCase()}${e.leader ? ` (${e.leader})` : ''}`);
  else if (e.leader) r.push(`Nuovo capo: ${e.leader}`);
  if (e.civ) r.push(`${num(e.civ)} ${Math.abs(e.civ) === 1 ? 'fabbrica civile' : 'fabbriche civili'}`);
  if (e.mil) r.push(`${num(e.mil)} ${Math.abs(e.mil) === 1 ? 'fabbrica militare' : 'fabbriche militari'}`);
  if (e.slots) r.push(`${num(e.slots)} slot per edifici`);
  if (e.researchSlots) r.push(`+${e.researchSlots} slot di ricerca`);
  if (e.manpower) r.push(`${num(e.manpower)} manodopera`);
  if (e.equipment) r.push(`${num(e.equipment)} equipaggiamento`);
  if (e.pp) r.push(`${num(e.pp)} potere politico`);
  if (e.ppGain) r.push(`${e.ppGain > 0 ? '+' : ''}${e.ppGain} potere politico al giorno`);
  for (const k in EFFECT_LABELS) if (e[k]) r.push(`${pct(e[k])} ${EFFECT_LABELS[k]}`);
  if (e.armorTech) r.push('Sblocca le divisioni corazzate');
  if (e.mods) for (const k in e.mods) r.push(`${pct(e.mods[k])} ${MOD_LABELS[k] || k}`);
  if (e.xp) for (const k in e.xp) r.push(`+${e.xp[k]} esperienza ${{ army: 'esercito', air: 'aviazione', navy: 'marina' }[k]}`);
  if (e.research) for (const x of e.research) r.push(`Bonus ricerca ${RESEARCH_CATS[x.cat] || x.cat}: ${Math.round(x.bonus * 100)}%${x.aot ? ' (annulla la penalità di anticipo)' : ''}${x.uses > 1 ? ` ×${x.uses}` : ''}`);
  if (e.divs) for (const t in e.divs) r.push(`+${e.divs[t]} divisioni di ${UNIT_TYPES[t].name.toLowerCase()}`);
  if (e.leaveFaction) r.push('Esce dalla fazione attuale');
  if (e.createFaction) r.push(`Fonda la fazione “${e.createFaction}”`);
  if (e.joinFaction) r.push(`Entra nella fazione di ${names(e.joinFaction)}`);
  if (e.invite) r.push(`Invita nella fazione: ${names(e.invite)}`);
  if (e.guarantee) r.push(`Garantisce l'indipendenza di ${names(e.guarantee)}`);
  if (e.nap) r.push(`Patto di non aggressione con ${names(e.nap)}`);
  if (e.aid) for (const t in e.aid) r.push(`Invia ${fmt(e.aid[t])} di equipaggiamento a ${countryName(t)}`);
  if (e.annex) r.push(`Chiede l'annessione di ${names(e.annex)} (se rifiuta: guerra)`);
  if (e.war) r.push(`Dichiara guerra a ${names(e.war)}`);
  return r;
}

// ---------- IA ----------
function aiPickFocus(c) {
  if (c.focus) return;
  let best = null, bs = 0;
  for (const f of focusTree(c).focuses) {
    if (f.ai <= 0 || !focusAvailable(c, f)) continue;
    // le guerre volute dai focus si scelgono solo se l'esercito è pronto
    if (f.eff.war && asList(f.eff.war).some(t => S.countries[t]?.alive && power(t) > power(c.code) * 1.1) && f.ai < 10) continue;
    // niente ultimatum che porterebbero a una guerra contro una grande potenza
    if (f.eff.annex && asList(f.eff.annex).some(t => S.countries[t]?.alive && t !== S.player && !annexAccepted(c.code, t))) continue;
    let s = f.ai * (0.75 + Math.random() * 0.5);
    if (enemiesOf(c.code).length && (f.eff.mil || f.eff.atkBonus || f.eff.defBonus || f.eff.divs)) s *= 1.5;
    if (s > bs) { bs = s; best = f; }
  }
  if (best) startFocus(c, best.id);
}
