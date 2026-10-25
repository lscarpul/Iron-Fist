'use strict';
// Dati della guerra terrestre in stile HOI4: battaglioni, compagnie di supporto,
// progettista carri, terreno di combattimento, meteo, ferrovie e generali.

// ---------- battaglioni di linea ----------
// w = larghezza, hp = punti forza, org = organizzazione, sa/ha = attacco molle/duro,
// def = difesa, brk = sfondamento, ap = perforazione, arm = corazza, hard = durezza (0-1),
// spd = km/h, sup = rifornimenti/giorno, mp = manodopera, need = equipaggiamento per famiglia,
// days = addestramento, special = forza speciale, tech = tecnologia richiesta (se esiste research.js)
const BATTALIONS = {
  fanteria: { name: 'Fanteria', icon: '🪖', w: 2, hp: 25, org: 60, sa: 6, ha: 1, def: 22, brk: 3, ap: 4, arm: 0, hard: 0, spd: 4, sup: 0.06, mp: 1000, need: { fanteria: 100 }, days: 0 },
  artiglieria: { name: 'Artiglieria', icon: '💥', w: 3, hp: 0.6, org: 0, sa: 25, ha: 2, def: 10, brk: 6, ap: 5, arm: 0, hard: 0, spd: 4, sup: 0.2, mp: 500, need: { artiglieria: 12 }, days: 10 },
  art_motorizzata: { name: 'Artiglieria motorizzata', icon: '🚛', w: 3, hp: 0.6, org: 0, sa: 25, ha: 2, def: 10, brk: 6, ap: 5, arm: 0, hard: 0.1, spd: 12, sup: 0.25, mp: 500, need: { artiglieria: 12, camion: 20 }, days: 15, tech: 'motor', year: 1936 },
  anticarro: { name: 'Anticarro', icon: '🎯', w: 1, hp: 0.6, org: 0, sa: 4, ha: 15, def: 4, brk: 1, ap: 75, arm: 0, hard: 0, spd: 4, sup: 0.1, mp: 500, need: { artiglieria: 12 }, days: 10 },
  contraerea: { name: 'Contraerea', icon: '✳️', w: 1, hp: 0.6, org: 0, sa: 3, ha: 7, def: 4, brk: 1, ap: 25, arm: 0, hard: 0, spd: 4, sup: 0.1, mp: 500, need: { artiglieria: 12 }, days: 10 },
  cavalleria: { name: 'Cavalleria', icon: '🐎', w: 2, hp: 25, org: 70, sa: 6, ha: 1, def: 18, brk: 3, ap: 4, arm: 0, hard: 0, spd: 6, sup: 0.05, mp: 1200, need: { fanteria: 120 }, days: 5 },
  motorizzata: { name: 'Motorizzata', icon: '🚚', w: 2, hp: 25, org: 60, sa: 6, ha: 1, def: 22, brk: 3, ap: 4, arm: 0, hard: 0.1, spd: 12, sup: 0.1, mp: 1000, need: { fanteria: 100, camion: 35 }, days: 10, tech: 'motor', year: 1936 },
  meccanizzata: { name: 'Meccanizzata', icon: '🛡️', w: 2, hp: 30, org: 60, sa: 8, ha: 3, def: 34, brk: 8, ap: 20, arm: 10, hard: 0.6, spd: 8, sup: 0.2, mp: 1000, need: { fanteria: 100, camion: 25, carri: 10 }, days: 20, tech: 'mech', year: 1940 },
  carri: { name: 'Carri armati', icon: '🚜', w: 2, hp: 2, org: 10, hard: 0.95, mp: 500, need: { carri: 50 }, days: 30, tank: true },
  montagna: { name: 'Alpini', icon: '⛰️', w: 2, hp: 20, org: 70, sa: 5, ha: 1, def: 22, brk: 3, ap: 4, arm: 0, hard: 0, spd: 4, sup: 0.07, mp: 1000, need: { fanteria: 120, supporto: 10 }, days: 30, special: 'montagna' },
  marines: { name: 'Marines', icon: '⚓', w: 2, hp: 20, org: 70, sa: 5, ha: 1, def: 20, brk: 4, ap: 4, arm: 0, hard: 0, spd: 4, sup: 0.07, mp: 1000, need: { fanteria: 120, supporto: 10 }, days: 30, special: 'marines' },
  paracadutisti: { name: 'Paracadutisti', icon: '🪂', w: 2, hp: 18, org: 70, sa: 5, ha: 1, def: 18, brk: 4, ap: 4, arm: 0, hard: 0, spd: 4, sup: 0.07, mp: 1000, need: { fanteria: 120, supporto: 20 }, days: 40, special: 'paracadutisti', year: 1938 },
};

// ---------- compagnie di supporto (larghezza 0) ----------
// mod: modificatori speciali applicati alla divisione
const SUPPORT = {
  genio: { name: 'Genio', icon: '🔧', hp: 2, org: 20, sa: 0, ha: 0, def: 6, brk: 0, sup: 0.03, mp: 300, need: { supporto: 30 }, mod: { entrench: 0.5, terrainPen: -0.1 }, desc: '+trinceramento, -penalità terreno' },
  ricognizione: { name: 'Ricognizione', icon: '🔭', hp: 1, org: 30, sa: 2, ha: 0, def: 2, brk: 2, sup: 0.02, mp: 200, need: { supporto: 30 }, mod: { recon: 1 }, desc: '+tattiche, migliore scelta del bersaglio' },
  art_supporto: { name: 'Artiglieria di supporto', icon: '💥', hp: 0.2, org: 0, sa: 12, ha: 1, def: 5, brk: 2, sup: 0.1, mp: 300, need: { artiglieria: 12 }, mod: {}, desc: '+attacco molle' },
  ac_supporto: { name: 'Anticarro di supporto', icon: '🎯', hp: 0.2, org: 0, sa: 2, ha: 6, def: 2, brk: 0, ap: 70, sup: 0.05, mp: 300, need: { artiglieria: 12 }, mod: {}, desc: '+attacco duro e perforazione' },
  logistica: { name: 'Compagnia logistica', icon: '📦', hp: 0.5, org: 10, sa: 0, ha: 0, def: 0, brk: 0, sup: 0, mp: 200, need: { supporto: 20, camion: 10 }, mod: { supplyUse: -0.15 }, desc: '-15% consumo rifornimenti' },
  ospedale: { name: 'Ospedale da campo', icon: '🏥', hp: 0.5, org: 10, sa: 0, ha: 0, def: 0, brk: 0, sup: 0.02, mp: 300, need: { supporto: 30 }, mod: { casualties: -0.3, expKeep: 0.3 }, desc: '-30% perdite di manodopera' },
  manutenzione: { name: 'Officina di manutenzione', icon: '🛠️', hp: 0.5, org: 10, sa: 0, ha: 0, def: 0, brk: 0, sup: 0.03, mp: 300, need: { supporto: 30 }, mod: { reliability: 0.1 }, desc: '+10% affidabilità dei mezzi' },
  trasmissioni: { name: 'Trasmissioni', icon: '📡', hp: 0.5, org: 15, sa: 0, ha: 0, def: 0, brk: 0, sup: 0.02, mp: 200, need: { supporto: 30 }, mod: { reinforce: 0.3, planning: 0.3 }, desc: '+rinforzi, pianificazione più rapida' },
};

const TPL_ROWS = 5, TPL_COLS = 5, TPL_SUPPORT = 5;
const DESIGNER_XP = { battalion: 5, support: 10, newTemplate: 10, tankModule: 5 };

// ---------- progettista carri ----------
const TANK_CHASSIS = {
  L1: { name: 'Leggero I', cls: 'leggero', year: 1936, arm: 10, spd: 10, rel: 0.85, brk: 18, def: 5, cost: 100, sup: 0.3, guns: ['mg', 'lgun'] },
  L2: { name: 'Leggero II', cls: 'leggero', year: 1939, tech: 'tank2', arm: 16, spd: 12, rel: 0.86, brk: 24, def: 7, cost: 120, sup: 0.3, guns: ['mg', 'lgun', 'mgun_s'] },
  M1: { name: 'Medio I', cls: 'medio', year: 1938, arm: 35, spd: 8, rel: 0.8, brk: 32, def: 8, cost: 170, sup: 0.45, guns: ['mg', 'lgun', 'mgun_s', 'how'] },
  M2: { name: 'Medio II', cls: 'medio', year: 1941, tech: 'tank2', arm: 50, spd: 8.5, rel: 0.82, brk: 40, def: 10, cost: 200, sup: 0.45, guns: ['lgun', 'mgun_s', 'mgun_l', 'how'] },
  M3: { name: 'Medio III', cls: 'medio', year: 1943, tech: 'tank3', arm: 70, spd: 9, rel: 0.85, brk: 48, def: 12, cost: 240, sup: 0.5, guns: ['mgun_s', 'mgun_l', 'hgun', 'how'] },
  H1: { name: 'Pesante I', cls: 'pesante', year: 1939, tech: 'tank2', arm: 80, spd: 5, rel: 0.72, brk: 40, def: 14, cost: 300, sup: 0.7, guns: ['lgun', 'mgun_s', 'mgun_l', 'hgun', 'how'] },
  H2: { name: 'Pesante II', cls: 'pesante', year: 1943, tech: 'tank3', arm: 120, spd: 5.5, rel: 0.72, brk: 52, def: 18, cost: 380, sup: 0.8, guns: ['mgun_l', 'hgun', 'how'] },
};
const TANK_GUNS = {
  mg: { name: 'Mitragliatrici', year: 1936, sa: 14, ha: 2, ap: 8, brk: 2, cost: 5, rel: 0 },
  lgun: { name: 'Cannone leggero (37 mm)', year: 1936, sa: 8, ha: 14, ap: 45, brk: 4, cost: 15, rel: 0 },
  mgun_s: { name: 'Cannone medio corto (75 mm)', year: 1938, sa: 18, ha: 12, ap: 55, brk: 6, cost: 25, rel: 0 },
  mgun_l: { name: 'Cannone medio lungo (75 mm L/48)', year: 1941, sa: 14, ha: 22, ap: 95, brk: 6, cost: 35, rel: -0.02 },
  hgun: { name: 'Cannone pesante (88 mm)', year: 1942, sa: 16, ha: 30, ap: 140, brk: 8, cost: 50, rel: -0.04, spd: -0.5 },
  how: { name: 'Obice (105 mm)', year: 1939, sa: 32, ha: 6, ap: 30, brk: 4, cost: 30, rel: 0 },
};
const TANK_ARMOR = {
  rivettata: { name: 'Corazza rivettata', year: 1936, armMul: 1, rel: 0, costMul: 1 },
  saldata: { name: 'Corazza saldata', year: 1938, armMul: 1.15, rel: 0.03, costMul: 1.08 },
  fusa: { name: 'Corazza fusa', year: 1941, armMul: 1.25, rel: -0.02, costMul: 1.12 },
};
const TANK_ENGINE = {
  benzina: { name: 'Motore a benzina', year: 1936, rel: 0, spd: 0, sup: 0 },
  diesel: { name: 'Motore diesel', year: 1939, rel: 0.05, spd: -0.3, sup: -0.05 },
};
const TANK_EXTRAS = {
  radio: { name: 'Radio', year: 1938, brk: 4, cost: 6, rel: 0 },
  torretta3: { name: 'Torretta a 3 uomini', year: 1938, atkMul: 0.1, cost: 8, rel: -0.01, noTD: true },
  piastre: { name: 'Piastre aggiuntive', year: 1940, armMul: 0.1, spd: -0.5, rel: -0.03, cost: 6 },
  ricambi: { name: 'Parti di ricambio', year: 1936, rel: 0.05, cost: 4 },
};
const TANK_ROLES = {
  carro: { name: 'Carro armato', sa: 1, ha: 1, ap: 1, arm: 1, brk: 1, cost: 1 },
  cacciacarri: { name: 'Cacciacarri', sa: 0.6, ha: 1.3, ap: 1.1, arm: 1.15, brk: 0.5, cost: 0.85 },
  semovente: { name: 'Semovente d\'artiglieria', sa: 1.6, ha: 0.7, ap: 0.8, arm: 0.7, brk: 0.6, cost: 0.85 },
};
const TANK_UPG_MAX = 5;

// ---------- terreno in battaglia (valori HOI4) ----------
// width/extra = larghezza base e aggiuntiva per ogni direzione d'attacco in più;
// atk = penalità all'attaccante; tank = moltiplicatore per i carri; supply = perdita rifornimenti
const LAND_TERRAIN = {
  plains: { width: 70, extra: 35, atk: 0, tank: 1, supply: 1, move: 1 },
  forest: { width: 60, extra: 30, atk: -0.15, tank: 0.7, supply: 1.3, move: 1 },
  hills: { width: 80, extra: 40, atk: -0.25, tank: 0.8, supply: 1.4, move: 1 },
  mountain: { width: 75, extra: 25, atk: -0.5, tank: 0.5, supply: 2, move: 1 },
  urban: { width: 96, extra: 32, atk: -0.3, tank: 0.7, supply: 1, move: 1 },
  marsh: { width: 50, extra: 25, atk: -0.4, tank: 0.5, supply: 1.6, move: 1 },
  desert: { width: 75, extra: 25, atk: 0, tank: 1, supply: 1.5, move: 1 },
  jungle: { width: 60, extra: 30, atk: -0.3, tank: 0.6, supply: 1.8, move: 1 },
};
const DEFAULT_TERRAIN = { width: 70, extra: 35, atk: 0, tank: 1, supply: 1.2, move: 1 };
// bonus delle forze speciali per terreno
const SPECIAL_TERRAIN = { montagna: { mountain: 0.25, hills: 0.2, forest: 0.1 } };

// ---------- meteo ----------
const WEATHER = [
  { id: 'sereno', name: 'Sereno', icon: '☀️', spd: 1, supply: 1, atk: 0, attr: 0, color: null },
  { id: 'pioggia', name: 'Pioggia', icon: '🌧️', spd: 0.85, supply: 1.3, atk: -0.1, attr: 0, color: 'rgba(80,140,220,0.22)' },
  { id: 'fango', name: 'Fango', icon: '🟫', spd: 0.5, supply: 2.0, atk: -0.25, attr: 0, color: 'rgba(120,80,30,0.42)' },
  { id: 'neve', name: 'Neve', icon: '❄️', spd: 0.75, supply: 1.4, atk: -0.15, attr: 0.001, color: 'rgba(235,245,255,0.35)' },
  { id: 'neveprof', name: 'Neve profonda', icon: '🌨️', spd: 0.5, supply: 2.0, atk: -0.3, attr: 0.003, color: 'rgba(255,255,255,0.6)' },
];
const W_CLEAR = 0, W_RAIN = 1, W_MUD = 2, W_SNOW = 3, W_DEEP = 4;

// ---------- ferrovie, hub, camion ----------
const RAIL_CAP = [0, 15, 25, 40, 60, 85];   // rifornimenti/giorno trasportabili per livello di ferrovia
const FEEDER_STEPS = 5;                   // tratte prima di un hub in cui si conta la saturazione
const HUB_MAX = 40;                       // capacità massima di un hub
const CAPITAL_SUPPLY = 60;                // rifornimenti generati nella capitale
const FLOW_LOSS = { cavalli: 0.25, camion: 0.15 }; // perdita di flusso per esagono
const FLOW_MIN = 0.25;
const TRUCKS_PER_SUPPLY = 12;             // camion necessari per ogni punto di rifornimento motorizzato
const BUILD_LAND = { rail: 60, hub: 120, infra: 50 };            // costo in punti costruzione (economia base)
const BUILD_LAND_HOI4 = { rail: 1600, hub: 10000, infra: 3000 }; // costo con economy.js (unità HOI4)
// livello di sviluppo dei paesi: [ferrovia, infrastrutture]
const LAND_DEV = {
  G: [3, 4], F: [3, 4], U: [3, 4], B: [3, 5], D: [2, 4], Z: [3, 4], I: [2, 3], C: [2, 3], A: [2, 3],
  W: [2, 3], N: [1, 2], P: [2, 2], H: [2, 3], S: [1, 2], K: [1, 2], X: [1, 2], E: [1, 2], O: [1, 2],
  R: [1, 2], Y: [1, 2], L: [1, 2], Q: [1, 2], T: [1, 1],
};

// ---------- comando ----------
const ARMY_MAX_DIVS = 24, FM_MAX_ARMIES = 5;
const CP_BASE = 0.5, CP_MAX = 100;
const CP_COST = { general: 20, promote: 30, trait: 20 };
const GENERAL_TRAITS = {
  corazzato: { name: 'Comandante corazzato', desc: '+10% attacco e velocità delle divisioni corazzate' },
  fanteria: { name: 'Esperto di fanteria', desc: '+10% attacco e difesa delle divisioni di fanteria' },
  ostinato: { name: 'Difensore ostinato', desc: '+10% difesa, trinceramento più rapido' },
  offensiva: { name: 'Dottrina offensiva', desc: '+8% attacco e sfondamento' },
  logistica: { name: 'Mago della logistica', desc: '-15% consumo di rifornimenti' },
  inverno: { name: 'Specialista invernale', desc: 'Dimezza le penalità di neve e fango' },
  montanaro: { name: 'Montanaro', desc: '+15% in colline e montagna' },
  pianificatore: { name: 'Pianificatore', desc: '+10% pianificazione massima' },
  commando: { name: 'Comandante di commando', desc: '+10% attacco delle forze speciali, +12 limite forze speciali' },
  astuto: { name: 'Astuto (Trickster)', desc: 'Penalità di fiumi e terreni difficili ridotte del 10%' },
  pianificatore_rapido: { name: 'Pianificatore rapido', desc: '+25% velocità di pianificazione (solo feldmarescialli)', fm: true },
};
// generali storici: [nome, feldmaresciallo?, attacco, difesa, pianificazione, logistica, tratti]
const GENERALS = {
  G: [['Gerd von Rundstedt', 1, 4, 4, 4, 3, ['pianificatore']], ['Fedor von Bock', 1, 4, 3, 3, 3, ['offensiva']],
    ['Heinz Guderian', 0, 5, 2, 3, 3, ['corazzato']], ['Erwin Rommel', 0, 5, 2, 2, 3, ['corazzato', 'offensiva']],
    ['Erich von Manstein', 0, 5, 4, 5, 3, ['pianificatore']], ['Wilhelm von Leeb', 0, 2, 5, 3, 3, ['ostinato']],
    ['Eduard Dietl', 0, 3, 4, 2, 2, ['montanaro']]],
  F: [['Maurice Gamelin', 1, 2, 4, 4, 3, ['ostinato']], ['Alphonse Georges', 0, 2, 4, 3, 3, ['fanteria']],
    ['Charles Huntziger', 0, 2, 3, 2, 3, []], ['Charles de Gaulle', 0, 4, 2, 3, 2, ['corazzato']],
    ['Henri Giraud', 0, 3, 3, 3, 2, []]],
  U: [['John Gort', 1, 3, 4, 3, 4, ['logistica']], ['Bernard Montgomery', 0, 3, 4, 5, 4, ['pianificatore']],
    ['Harold Alexander', 0, 3, 4, 3, 3, ['fanteria']], ['Richard O\'Connor', 0, 4, 2, 3, 3, ['corazzato']]],
  I: [['Rodolfo Graziani', 1, 2, 3, 2, 2, []], ['Pietro Badoglio', 0, 2, 3, 3, 3, ['ostinato']],
    ['Giovanni Messe', 0, 4, 4, 3, 3, ['fanteria']], ['Italo Gariboldi', 0, 2, 3, 2, 2, ['montanaro']]],
  S: [['Georgij Žukov', 1, 5, 4, 4, 3, ['offensiva']], ['Semën Timošenko', 1, 3, 3, 3, 3, []],
    ['Ivan Konev', 0, 4, 3, 3, 2, ['inverno']], ['Konstantin Rokossovskij', 0, 4, 4, 4, 3, ['corazzato']],
    ['Vasilij Čujkov', 0, 3, 5, 2, 2, ['ostinato']], ['Aleksandr Vasilevskij', 0, 3, 3, 5, 4, ['pianificatore']]],
  P: [['Edward Rydz-Śmigły', 1, 2, 3, 2, 2, []], ['Władysław Anders', 0, 3, 3, 2, 2, ['fanteria']]],
  K: [['Carl Gustaf Mannerheim', 1, 3, 5, 4, 3, ['inverno', 'ostinato']]],
  E: [['Francisco Franco', 1, 3, 3, 3, 2, []]],
  Y: [['Dušan Simović', 0, 2, 3, 2, 2, ['montanaro']]],
  Q: [['Alexandros Papagos', 1, 3, 4, 3, 2, ['montanaro']]],
  R: [['Ion Antonescu', 1, 3, 3, 2, 2, []]],
  H: [['Gusztáv Jány', 0, 2, 3, 2, 2, []]],
};
const GENERIC_GENERAL_NAMES = ['Generale Rossi', 'Generale Novak', 'Generale Berg', 'Generale Ionescu', 'Generale Petrov',
  'Generale Horvat', 'Generale Lindqvist', 'Generale Duarte', 'Generale Dimitrov', 'Generale Kaya', 'Generale Jansen', 'Generale Varga'];
