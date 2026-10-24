'use strict';

// Dati della guerra aerea e navale: telai, moduli, scafi, missioni e forze iniziali.
// Scale ispirate a Hearts of Iron IV (costi in punti produzione, corazza contro perforazione, ecc.).

const KM_PER_HEX = 45;          // un esagono ≈ 45 km
const WING_SIZE = 50;           // aerei per stormo
const FACTORY_OUTPUT = 4.5;     // punti produzione al giorno per fabbrica militare al 100% di efficienza
const DOCKYARD_OUTPUT = 2.5;    // punti produzione al giorno per cantiere navale
const MAX_DOCKS_PER_LINE = 15;
const AIR_EFF_START = 0.1, AIR_EFF_CAP = 0.5, AIR_EFF_RETAIN = 0.3;
const TECH_YEARS = [1936, 1940, 1944];
const CONVOY_COST = 85;
if (typeof BUILD_COST !== 'undefined') BUILD_COST.dock = 70;

// ---------- aviazione ----------
const AIR_ROLES = {
  fighter: { name: 'Caccia', short: 'Caccia', missions: ['superiority', 'intercept'] },
  cas: { name: 'Appoggio ravvicinato', short: 'CAS', missions: ['cas'] },
  strat: { name: 'Bombardiere strategico', short: 'Bomb. strat.', missions: ['strategic'] },
  naval: { name: 'Bombardiere navale', short: 'Bomb. nav.', missions: ['naval', 'patrol'] },
};

const AIR_MISSIONS = {
  superiority: { name: 'Superiorità aerea', where: 'any', desc: 'Abbatte ogni aereo nemico nella regione e dà alle truppe amiche il bonus di superiorità aerea.' },
  intercept: { name: 'Intercettazione', where: 'any', desc: 'Caccia solo i bombardieri e i CAS nemici: più efficace contro di loro, meno contro i caccia.' },
  cas: { name: 'Appoggio ravvicinato', where: 'land', desc: 'Colpisce le divisioni nemiche impegnate in battaglia nella regione.' },
  strategic: { name: 'Bombardamento strategico', where: 'land', desc: "Danneggia l'industria nemica della regione: meno produzione e costruzione." },
  naval: { name: 'Attacco navale', where: 'sea', desc: 'Attacca le flotte e i convogli nemici avvistati nella zona di mare.' },
  patrol: { name: 'Pattugliamento navale', where: 'sea', desc: 'Aiuta le flotte amiche ad avvistare il nemico.' },
};

// statistiche base per ruolo e generazione (1936 / 1940 / 1944)
const AIRFRAMES = {
  fighter: [
    { agility: 50, airAtk: 8, airDef: 10, speed: 440, range: 800, ground: 0, strat: 0, naval: 0, cost: 20 },
    { agility: 58, airAtk: 10, airDef: 13, speed: 540, range: 900, ground: 0, strat: 0, naval: 0, cost: 24 },
    { agility: 66, airAtk: 12, airDef: 16, speed: 650, range: 1000, ground: 0, strat: 0, naval: 0, cost: 28 },
  ],
  cas: [
    { agility: 30, airAtk: 3, airDef: 12, speed: 350, range: 500, ground: 6, strat: 0, naval: 1, cost: 18 },
    { agility: 35, airAtk: 4, airDef: 15, speed: 410, range: 600, ground: 9, strat: 0, naval: 2, cost: 22 },
    { agility: 40, airAtk: 5, airDef: 19, speed: 480, range: 700, ground: 12, strat: 0, naval: 3, cost: 26 },
  ],
  strat: [
    { agility: 15, airAtk: 3, airDef: 18, speed: 330, range: 1500, ground: 1, strat: 6, naval: 0, cost: 40 },
    { agility: 18, airAtk: 3, airDef: 24, speed: 400, range: 2000, ground: 1, strat: 9, naval: 0, cost: 46 },
    { agility: 22, airAtk: 4, airDef: 30, speed: 480, range: 2600, ground: 2, strat: 13, naval: 0, cost: 52 },
  ],
  naval: [
    { agility: 25, airAtk: 2, airDef: 12, speed: 330, range: 900, ground: 0, strat: 0, naval: 5, cost: 22 },
    { agility: 30, airAtk: 3, airDef: 15, speed: 400, range: 1100, ground: 0, strat: 0, naval: 8, cost: 26 },
    { agility: 35, airAtk: 4, airDef: 18, speed: 470, range: 1300, ground: 0, strat: 0, naval: 11, cost: 30 },
  ],
};

const AIR_MODULES = {
  none: { name: 'Nessuno' },
  mg_light: { name: 'Mitragliatrici leggere', add: { airAtk: 4 }, cost: 1 },
  mg_heavy: { name: 'Mitragliatrici pesanti', add: { airAtk: 7, agility: -2 }, cost: 2 },
  cannon: { name: 'Cannoni da 20 mm', add: { airAtk: 10, agility: -4, ground: 1 }, cost: 4, year: 1940 },
  droptank: { name: 'Serbatoi supplementari', add: { agility: -3 }, mult: { range: 1.4 }, cost: 1 },
  armor_plate: { name: 'Corazzatura', add: { airDef: 6, agility: -3 }, mult: { speed: 0.95 }, cost: 2 },
  engine: { name: 'Motore potenziato', add: { agility: 4 }, mult: { speed: 1.08 }, cost: 3, year: 1940 },
  bombs_light: { name: 'Bombe leggere', add: { ground: 3, naval: 2, agility: -4 }, mult: { speed: 0.95 }, cost: 2 },
  bombs_heavy: { name: 'Bombe pesanti', add: { ground: 5, strat: 3, naval: 3, agility: -6 }, mult: { speed: 0.92 }, cost: 3 },
  rockets: { name: 'Razzi anticarro', add: { ground: 6, agility: -3 }, cost: 3, year: 1940 },
  bomb_bay: { name: 'Vano bombe maggiorato', add: { strat: 5 }, mult: { range: 0.85 }, cost: 4, year: 1940 },
  def_turret: { name: 'Torrette difensive', add: { airDef: 8, airAtk: 2 }, mult: { speed: 0.95 }, cost: 3 },
  torpedo: { name: 'Siluri aerei', add: { naval: 7 }, mult: { speed: 0.93 }, cost: 3 },
  radar_air: { name: 'Radar di bordo', add: { airAtk: 2, naval: 2 }, cost: 4, year: 1944 },
};

const AIR_SLOTS = {
  fighter: [
    { k: 'w', name: 'Armamento', opts: ['mg_light', 'mg_heavy', 'cannon'] },
    { k: 'x', name: 'Speciale', opts: ['none', 'droptank', 'armor_plate', 'engine', 'bombs_light'], def: 'none' },
  ],
  cas: [
    { k: 'w', name: 'Armamento', opts: ['mg_light', 'mg_heavy', 'cannon'] },
    { k: 'b', name: 'Carico offensivo', opts: ['bombs_light', 'bombs_heavy', 'rockets'] },
    { k: 'x', name: 'Speciale', opts: ['none', 'armor_plate', 'droptank', 'engine'], def: 'armor_plate' },
  ],
  strat: [
    { k: 'b', name: 'Carico di bombe', opts: ['bombs_heavy', 'bomb_bay'] },
    { k: 'd', name: 'Difesa', opts: ['none', 'def_turret'] },
    { k: 'x', name: 'Speciale', opts: ['none', 'droptank', 'armor_plate', 'engine', 'radar_air'], def: 'none' },
  ],
  naval: [
    { k: 'p', name: 'Carico', opts: ['bombs_light', 'torpedo'] },
    { k: 'w', name: 'Armamento', opts: ['mg_light', 'mg_heavy'], def: 'mg_light' },
    { k: 'x', name: 'Speciale', opts: ['none', 'droptank', 'armor_plate', 'radar_air'], def: 'none' },
  ],
};

const AIR_STAT_NAMES = {
  agility: 'Agilità', airAtk: 'Attacco aereo', airDef: 'Difesa aerea', speed: 'Velocità (km/h)', range: 'Autonomia (km)',
  ground: 'Attacco al suolo', strat: 'Bombardamento strategico', naval: 'Attacco navale', cost: 'Costo',
};

// ---------- marina ----------
// line: screen (schermo), capital (navi capitali), carrier (portaerei), sub (sottomarini)
const HULLS = {
  dd: { name: 'Cacciatorpediniere', short: 'CT', line: 'screen', gens: [
    { hp: 18, armor: 0, speed: 32, vis: 12, surfDet: 14, subDet: 6, cost: 700 },
    { hp: 22, armor: 0, speed: 34, vis: 12, surfDet: 16, subDet: 7, cost: 780 },
    { hp: 26, armor: 0, speed: 35, vis: 12, surfDet: 18, subDet: 8, cost: 860 }] },
  cl: { name: 'Incrociatore leggero', short: 'CL', line: 'screen', gens: [
    { hp: 40, armor: 18, speed: 32, vis: 18, surfDet: 18, cost: 1500 },
    { hp: 46, armor: 22, speed: 33, vis: 18, surfDet: 20, cost: 1650 },
    { hp: 52, armor: 26, speed: 33, vis: 18, surfDet: 22, cost: 1800 }] },
  ca: { name: 'Incrociatore pesante', short: 'CA', line: 'capital', gens: [
    { hp: 65, armor: 40, speed: 31, vis: 22, surfDet: 18, cost: 2600 },
    { hp: 72, armor: 48, speed: 32, vis: 22, surfDet: 20, cost: 2850 },
    { hp: 80, armor: 56, speed: 32, vis: 22, surfDet: 22, cost: 3100 }] },
  bb: { name: 'Corazzata', short: 'BB', line: 'capital', gens: [
    { hp: 110, armor: 80, speed: 23, vis: 30, surfDet: 16, cost: 5500 },
    { hp: 125, armor: 95, speed: 28, vis: 30, surfDet: 18, cost: 6200 },
    { hp: 140, armor: 110, speed: 30, vis: 30, surfDet: 20, cost: 7000 }] },
  cv: { name: 'Portaerei', short: 'CV', line: 'carrier', gens: [
    { hp: 70, armor: 20, speed: 30, vis: 30, surfDet: 30, cost: 5000 },
    { hp: 80, armor: 25, speed: 32, vis: 30, surfDet: 32, cost: 5600 },
    { hp: 90, armor: 30, speed: 33, vis: 30, surfDet: 34, cost: 6200 }] },
  ss: { name: 'Sottomarino', short: 'SM', line: 'sub', gens: [
    { hp: 10, armor: 0, speed: 17, subVis: 12, surfDet: 6, cost: 450 },
    { hp: 12, armor: 0, speed: 18, subVis: 10, surfDet: 7, cost: 500 },
    { hp: 14, armor: 0, speed: 19, subVis: 8, surfDet: 8, cost: 560 }] },
};
const HULL_ORDER = ['bb', 'cv', 'ca', 'cl', 'dd', 'ss'];

const SHIP_MODULES = {
  none: { name: 'Nessuno' },
  lb1: { name: 'Batteria leggera I', add: { lAtk: 6, lPrc: 35 }, cost: 60 },
  lb2: { name: 'Batteria leggera II', add: { lAtk: 8, lPrc: 42 }, cost: 80, year: 1940 },
  lb3: { name: 'Batteria leggera III', add: { lAtk: 10, lPrc: 50 }, cost: 100, year: 1944 },
  clb1: { name: 'Batteria da incrociatore leggero I', add: { lAtk: 12, lPrc: 45 }, cost: 180 },
  clb2: { name: 'Batteria da incrociatore leggero II', add: { lAtk: 16, lPrc: 55 }, cost: 230, year: 1940 },
  hcb1: { name: 'Batteria da incrociatore pesante I', add: { hAtk: 8, hPrc: 70, lAtk: 4, lPrc: 30 }, cost: 350 },
  hcb2: { name: 'Batteria da incrociatore pesante II', add: { hAtk: 11, hPrc: 85, lAtk: 5, lPrc: 35 }, cost: 430, year: 1940 },
  hb1: { name: 'Batteria pesante I', add: { hAtk: 22, hPrc: 100 }, cost: 900 },
  hb2: { name: 'Batteria pesante II', add: { hAtk: 28, hPrc: 120 }, cost: 1100, year: 1940 },
  hb3: { name: 'Batteria pesante III', add: { hAtk: 34, hPrc: 140 }, cost: 1300, year: 1944 },
  torp1: { name: 'Lanciasiluri I', add: { torp: 12 }, cost: 60 },
  torp2: { name: 'Lanciasiluri II', add: { torp: 18 }, cost: 90, year: 1940 },
  dc1: { name: 'Cariche di profondità I', add: { subAtk: 6 }, cost: 30 },
  dc2: { name: 'Cariche di profondità II', add: { subAtk: 10 }, cost: 50, year: 1940 },
  sonar1: { name: 'Sonar', add: { subDet: 15, subAtk: 2 }, cost: 70 },
  aa1: { name: 'Contraerea leggera', add: { aa: 6 }, cost: 40 },
  aa2: { name: 'Contraerea pesante', add: { aa: 11 }, cost: 70, year: 1940 },
  radar1: { name: 'Radar di superficie I', add: { surfDet: 20 }, cost: 150, year: 1940 },
  radar2: { name: 'Radar di superficie II', add: { surfDet: 35 }, cost: 220, year: 1944 },
  eng_light: { name: 'Motori potenziati', add: { vis: 2 }, mult: { speed: 1.06 }, cost: 120 },
  ar_cl1: { name: 'Corazza leggera', add: { armor: 6, hp: 4 }, mult: { speed: 0.98 }, cost: 150 },
  ar_ca1: { name: 'Corazza da incrociatore I', add: { armor: 12, hp: 8 }, mult: { speed: 0.97 }, cost: 300 },
  ar_ca2: { name: 'Corazza da incrociatore II', add: { armor: 18, hp: 10 }, mult: { speed: 0.97 }, cost: 400, year: 1940 },
  ar_bb1: { name: 'Corazza da corazzata I', add: { armor: 20, hp: 15 }, mult: { speed: 0.97 }, cost: 700 },
  ar_bb2: { name: 'Corazza da corazzata II', add: { armor: 30, hp: 20 }, mult: { speed: 0.97 }, cost: 900, year: 1940 },
  ar_bb3: { name: 'Corazza da corazzata III', add: { armor: 40, hp: 25 }, mult: { speed: 0.97 }, cost: 1100, year: 1944 },
  deck1: { name: 'Ponte di volo', add: { deck: 40 }, cost: 600 },
  deck2: { name: 'Ponte di volo ampliato', add: { deck: 60 }, cost: 900, year: 1940 },
  storp1: { name: 'Siluri da sottomarino I', add: { torp: 14 }, cost: 60 },
  storp2: { name: 'Siluri da sottomarino II', add: { torp: 20 }, cost: 90, year: 1940 },
  storp3: { name: 'Siluri da sottomarino III', add: { torp: 26 }, cost: 120, year: 1944 },
  silent: { name: 'Motori silenziosi', add: { subVis: -2 }, mult: { speed: 0.95 }, cost: 50, year: 1940 },
  snorkel: { name: 'Snorkel', add: { subVis: -4 }, cost: 80, year: 1944 },
};

const SHIP_SLOTS = {
  dd: [
    { k: 'm', name: 'Armamento principale', opts: ['lb1', 'lb2', 'lb3'] },
    { k: 't', name: 'Siluri', opts: ['none', 'torp1', 'torp2'] },
    { k: 'a', name: 'Antisommergibile', opts: ['none', 'dc1', 'dc2', 'sonar1'], def: 'dc1' },
    { k: 'x', name: 'Speciale', opts: ['none', 'aa1', 'radar1', 'eng_light'], def: 'none' },
  ],
  cl: [
    { k: 'm', name: 'Armamento principale', opts: ['clb1', 'clb2'] },
    { k: 's', name: 'Secondario', opts: ['none', 'lb1', 'aa1', 'aa2'] },
    { k: 't', name: 'Siluri', opts: ['none', 'torp1', 'torp2'], def: 'none' },
    { k: 'r', name: 'Corazza', opts: ['none', 'ar_cl1'] },
    { k: 'x', name: 'Speciale', opts: ['none', 'radar1', 'radar2', 'sonar1', 'dc1'] },
  ],
  ca: [
    { k: 'm', name: 'Armamento principale', opts: ['hcb1', 'hcb2'] },
    { k: 's', name: 'Secondario', opts: ['lb1', 'aa1', 'aa2'] },
    { k: 'r', name: 'Corazza', opts: ['ar_ca1', 'ar_ca2'] },
    { k: 'x', name: 'Speciale', opts: ['none', 'radar1', 'radar2', 'torp1'] },
  ],
  bb: [
    { k: 'm', name: 'Armamento principale', opts: ['hb1', 'hb2', 'hb3'] },
    { k: 's', name: 'Secondario', opts: ['lb1', 'lb2', 'aa1', 'aa2'] },
    { k: 'r', name: 'Corazza', opts: ['ar_bb1', 'ar_bb2', 'ar_bb3'] },
    { k: 'x', name: 'Speciale', opts: ['none', 'radar1', 'radar2', 'aa1'] },
  ],
  cv: [
    { k: 'd', name: 'Ponte di volo', opts: ['deck1', 'deck2'] },
    { k: 's', name: 'Contraerea', opts: ['aa1', 'aa2'] },
    { k: 'r', name: 'Corazza', opts: ['none', 'ar_cl1'] },
    { k: 'x', name: 'Speciale', opts: ['none', 'radar1', 'radar2'] },
  ],
  ss: [
    { k: 't', name: 'Siluri', opts: ['storp1', 'storp2', 'storp3'] },
    { k: 'x', name: 'Speciale', opts: ['none', 'silent', 'snorkel'] },
  ],
};

const SHIP_STAT_NAMES = {
  hp: 'Punti struttura', armor: 'Corazza', speed: 'Velocità (nodi)', lAtk: 'Attacco leggero', lPrc: 'Perforazione leggera',
  hAtk: 'Attacco pesante', hPrc: 'Perforazione pesante', torp: 'Attacco siluri', aa: 'Contraerea', subAtk: 'Attacco antisom.',
  subDet: 'Rilevamento sottomarini', surfDet: 'Rilevamento superficie', vis: 'Visibilità', subVis: 'Visibilità sottomarina',
  deck: 'Aerei imbarcati', cost: 'Costo',
};

const NAVAL_MISSIONS = {
  idle: { name: 'In porto', desc: 'La flotta resta in porto: si ripara e non combatte.' },
  patrol: { name: 'Pattugliamento', desc: 'Cerca il nemico nella zona (avvistamento ×2.5) e combatte se lo trova.' },
  strike: { name: 'Forza d\'attacco', desc: 'Ingaggia qualunque flotta nemica avvistata nella zona e protegge gli sbarchi.' },
  escort: { name: 'Scorta convogli', desc: 'Protegge i convogli amici dagli attacchi nella zona.' },
  raid: { name: 'Guerra ai convogli', desc: 'Affonda i convogli nemici che passano nella zona. Ideale per i sottomarini.' },
};

// nomi delle zone di mare (coordinate della mappa ASCII)
const SEA_NAMES = [
  ['Mare di Norvegia', 10, 2], ['Mare del Nord', 13, 8], ['Skagerrak', 18, 9], ['Mar Baltico', 23, 10],
  ['Golfo di Botnia', 24, 3], ['Golfo di Finlandia', 29, 7], ['Mare di Barents', 36, 0], ['Atlantico settentrionale', 2, 4],
  ['Atlantico', 1, 13], ['Canale della Manica', 9, 13], ['Golfo di Biscaglia', 6, 17], ['Atlantico meridionale', 1, 23],
  ['Mediterraneo occidentale', 12, 22], ['Mar Tirreno', 18, 21], ['Mar Adriatico', 22, 19], ['Mar Ionio', 23, 24],
  ['Mar Egeo', 30, 22], ['Mar Nero', 34, 19], ['Mediterraneo orientale', 37, 24],
];

// forze iniziali (gennaio 1936)
const START_NAVY = {
  U: { dd: 30, cl: 14, ca: 8, bb: 10, cv: 3, ss: 10, docks: 14, convoys: 140 },
  F: { dd: 20, cl: 8, ca: 6, bb: 5, cv: 1, ss: 20, docks: 7, convoys: 60 },
  I: { dd: 18, cl: 10, ca: 7, bb: 4, ss: 25, docks: 6, convoys: 50 },
  G: { dd: 10, cl: 5, ca: 2, bb: 2, ss: 12, docks: 5, convoys: 30 },
  S: { dd: 12, cl: 4, bb: 3, ss: 25, docks: 4, convoys: 20 },
  E: { dd: 6, cl: 4, ca: 1, ss: 4, docks: 2, convoys: 15 },
  T: { dd: 4, ss: 2, docks: 1, convoys: 8 },
  Q: { dd: 4, docks: 1, convoys: 10 },
  Y: { dd: 2, ss: 2, docks: 0, convoys: 4 },
  N: { dd: 2, docks: 1, convoys: 20 },
  W: { dd: 6, cl: 1, docks: 1, convoys: 12 },
  K: { dd: 1, ss: 2, convoys: 4 },
  P: { dd: 2, ss: 2, convoys: 4 },
  O: { dd: 2, docks: 0, convoys: 6 },
  R: { dd: 2, convoys: 3 },
  B: { dd: 1, docks: 1, convoys: 12 },
  D: { dd: 2, docks: 1, convoys: 8 },
  X: { convoys: 3 }, L: { convoys: 2 }, H: {}, C: {}, A: {}, Z: {},
};

const START_AIR = {
  U: { fighter: 300, strat: 100, naval: 50 },
  F: { fighter: 300, cas: 50, strat: 100 },
  G: { fighter: 300, cas: 100, strat: 50 },
  I: { fighter: 250, cas: 50, strat: 100, naval: 50 },
  S: { fighter: 400, cas: 150, strat: 150 },
  P: { fighter: 100, cas: 50 }, E: { fighter: 50 }, C: { fighter: 100, cas: 50 }, W: { fighter: 50 },
  T: { fighter: 50 }, R: { fighter: 50 }, Y: { fighter: 50 }, H: { fighter: 50 }, B: { fighter: 50 },
  Q: { fighter: 50 }, K: { fighter: 50 },
};

// quota delle fabbriche militari che l'IA dedica agli aerei
// dipendenza dal commercio marittimo: convogli necessari ≈ fabbriche × fattore
const TRADE_DEP = { U: 1.5, I: 0.9, F: 0.8, G: 0.6, S: 0.2, N: 1.2, O: 1, Q: 1, D: 1, B: 1 };

const AI_AIR_SHARE = { major: 0.35, minor: 0.12 };
const AI_AIR_MIX = { fighter: 0.55, cas: 0.25, strat: 0.12, naval: 0.08 };
const AI_NAVY_MIX = { dd: 0.38, ss: 0.24, cl: 0.14, ca: 0.08, bb: 0.1, cv: 0.06 };
