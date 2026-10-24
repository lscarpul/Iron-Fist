'use strict';

// Mappa d'Europa a bassa risoluzione: ogni carattere = una regione (verrà ingrandita 2x in esagoni).
// '.' = mare. Le lettere sono i codici dei paesi in COUNTRY_DEFS.
const MAP_ASCII = [
  '............................................',
  '..................NNNNWW...KK....SSSSSSSSSS',
  '.................NNNNWWW..KKKK..SSSSSSSSSSS',
  '................NNNNWWW...KKKK.SSSSSSSSSSSS',
  '...............NNNNWWWW..KKKK.SSSSSSSSSSSSS',
  '...............NNN.WWWW...KKK.SSSSSSSSSSSSS',
  '.......UU......NN..WWW.....KKSSSSSSSSSSSSSS',
  '......UUU......NN..WWW........SSSSSSSSSSSSS',
  '.....UUUU...........WW....XXXSSSSSSSSSSSSSS',
  '..U..UUU.........DD.......XXXSSSSSSSSSSSSSSS',
  '.UU...UUU........DD.......XXXSSSSSSSSSSSSSSS',
  '.U....UUUU.....BBGGGGGG..PPPPPSSSSSSSSSSSSSS',
  '......UUUU....BBGGGGGGGGPPPPPPSSSSSSSSSSSSSS',
  '.............BBGGGGGGGGGPPPPPPSSSSSSSSSSSSSS',
  '...........FFFFGGGGGGGCCCCPPPPSSSSSSSSSSSSSS',
  '..........FFFFFFGGGGGCCCCCCHHRRSSSSSSSSSSSSS',
  '.........FFFFFFFZZGAAAAAAHHHHRRRRSSSSSSSSSSS',
  '.........FFFFFFFZZIIIAAYYHHHHRRRRRSSSSSSSSSS',
  '..........FFFFFFFIIIIYYYYYYYRRRRRR..SSSSSSS.',
  '...OEEEEEEEFFFF..IIII.YYYYYYLLLLLL...SSSS...',
  '...OEEEEEEEEE.....IIII..YYYYLLLLL...........',
  '...OEEEEEEEEE......IIII..QQQQQ.TTTTTTTTTTTTT',
  '...OEEEEEEEE........IIIII..QQQ..TTTTTTTTTTTT',
  '....EEEEEEE.........II.III..QQ..TTTTTTTTTTTT',
  '.....EEEE.................Q.................',
  '............................................',
];

// cap = coordinate della capitale nella mappa ASCII [x, y]
const COUNTRY_DEFS = {
  G: { name: 'Germania', color: '#6b7177', civ: 28, mil: 14, inf: 26, arm: 3, cap: [20, 12], armor: true, major: true, aggro: 0.85, faction: 'axis' },
  F: { name: 'Francia', color: '#3a5cc2', civ: 30, mil: 9, inf: 34, arm: 2, cap: [12, 15], armor: true, major: true, aggro: 0.3, faction: 'allies' },
  U: { name: 'Regno Unito', color: '#c2414b', civ: 30, mil: 8, inf: 16, arm: 1, cap: [8, 12], armor: true, major: true, aggro: 0.4, faction: 'allies' },
  I: { name: 'Italia', color: '#4a8a3c', civ: 18, mil: 8, inf: 24, arm: 1, cap: [20, 20], armor: true, major: true, aggro: 0.55 },
  S: { name: 'Unione Sovietica', color: '#7d2222', civ: 32, mil: 18, inf: 60, arm: 4, cap: [37, 10], armor: true, major: true, aggro: 0.6, faction: 'comintern' },
  P: { name: 'Polonia', color: '#d68fb0', civ: 9, mil: 4, inf: 18, arm: 0, cap: [27, 12] , aggro: 0.3 },
  E: { name: 'Spagna', color: '#e0b84c', civ: 8, mil: 3, inf: 12, arm: 0, cap: [7, 21], aggro: 0.3 },
  O: { name: 'Portogallo', color: '#3f8f6e', civ: 3, mil: 1, inf: 3, arm: 0, cap: [3, 20], aggro: 0.2 },
  B: { name: 'Benelux', color: '#e0913a', civ: 12, mil: 3, inf: 9, arm: 0, cap: [14, 12], aggro: 0.2 },
  D: { name: 'Danimarca', color: '#b5526e', civ: 3, mil: 1, inf: 2, arm: 0, cap: [17, 10], aggro: 0.2 },
  N: { name: 'Norvegia', color: '#8a5a44', civ: 3, mil: 1, inf: 3, arm: 0, cap: [16, 6], aggro: 0.2 },
  W: { name: 'Svezia', color: '#4a86c4', civ: 7, mil: 3, inf: 6, arm: 0, cap: [21, 6], aggro: 0.2 },
  K: { name: 'Finlandia', color: '#dfe3ea', civ: 3, mil: 2, inf: 7, arm: 0, cap: [28, 5], aggro: 0.35 },
  X: { name: 'Paesi Baltici', color: '#9a86b8', civ: 3, mil: 1, inf: 4, arm: 0, cap: [27, 9], aggro: 0.2 },
  C: { name: 'Cecoslovacchia', color: '#4aa3a3', civ: 9, mil: 5, inf: 12, arm: 0, cap: [23, 14], aggro: 0.25 },
  A: { name: 'Austria', color: '#cfc8b0', civ: 4, mil: 1, inf: 4, arm: 0, cap: [23, 16], aggro: 0.2 },
  Z: { name: 'Svizzera', color: '#a33b5f', civ: 5, mil: 1, inf: 4, arm: 0, cap: [16, 16], aggro: 0.1 },
  H: { name: 'Ungheria', color: '#a87d55', civ: 4, mil: 2, inf: 6, arm: 0, cap: [26, 16], aggro: 0.4 },
  R: { name: 'Romania', color: '#a7a23a', civ: 6, mil: 2, inf: 10, arm: 0, cap: [31, 17], aggro: 0.4 },
  Y: { name: 'Jugoslavia', color: '#6c64c8', civ: 5, mil: 2, inf: 10, arm: 0, cap: [25, 18], aggro: 0.3 },
  L: { name: 'Bulgaria', color: '#5f9a6a', civ: 3, mil: 1, inf: 6, arm: 0, cap: [29, 19], aggro: 0.3 },
  Q: { name: 'Grecia', color: '#7fb7e6', civ: 3, mil: 1, inf: 7, arm: 0, cap: [28, 22], aggro: 0.3 },
  T: { name: 'Turchia', color: '#9aa86b', civ: 7, mil: 2, inf: 12, arm: 0, cap: [37, 22], aggro: 0.2 },
};

const FACTION_DEFS = {
  allies: { name: 'Alleati', leader: 'U' },
  axis: { name: 'Asse', leader: 'G' },
  comintern: { name: 'Comintern', leader: 'S' },
};

// Zone montuose in coordinate ASCII: [x0, y0, x1, y1, probabilità]
const MOUNTAIN_ZONES = [
  [15, 15, 23, 18, 0.55], // Alpi
  [7, 18, 11, 19, 0.6],   // Pirenei
  [27, 14, 32, 17, 0.35], // Carpazi
  [18, 18, 24, 23, 0.3],  // Appennini
  [21, 18, 30, 24, 0.4],  // Balcani
  [31, 21, 43, 23, 0.35], // Anatolia
  [15, 1, 20, 7, 0.55],   // Alpi scandinave
];
const FOREST_RICH = new Set(['S', 'K', 'W', 'X', 'P', 'N']);

const TERRAIN = {
  plains:   { name: 'Pianura',  cost: 1.0, def: 1.0, arm: 1.0, shade: 1.0 },
  forest:   { name: 'Foresta',  cost: 1.5, def: 1.25, arm: 0.7, shade: 0.86 },
  hills:    { name: 'Colline',  cost: 1.6, def: 1.3, arm: 0.8, shade: 0.94 },
  mountain: { name: 'Montagna', cost: 2.4, def: 1.6, arm: 0.5, shade: 0.76 },
};

const UNIT_TYPES = {
  inf: { name: 'Fanteria', short: 'Fant.', atk: 12, def: 20, org: 60, speed: 0.30, eq: 500, mp: 10000, days: 60 },
  arm: { name: 'Corazzata', short: 'Coraz.', atk: 36, def: 16, org: 50, speed: 0.60, eq: 1600, mp: 8000, days: 90 },
};

const BUILD_COST = { civ: 90, mil: 75 };

// I focus nazionali sono in focus.js (motore) e focustrees.js (alberi).

// Eventi storici. Se l'attore è il giocatore, gli viene chiesto se procedere.
const EVENTS = [
  { date: '1938-03-12', type: 'annex', actor: 'G', target: 'A', title: 'Anschluss', text: "La Germania annette l'Austria." },
  { date: '1938-09-30', type: 'annex', actor: 'G', target: 'C', title: 'Accordi di Monaco', text: 'La Germania annette la Cecoslovacchia.' },
  { date: '1939-03-31', type: 'guarantee', actor: 'U', target: 'P', title: 'Garanzia britannica', text: "Il Regno Unito garantisce l'indipendenza della Polonia." },
  { date: '1939-03-31', type: 'guarantee', actor: 'F', target: 'P', title: 'Garanzia francese', text: "La Francia garantisce l'indipendenza della Polonia." },
  { date: '1939-05-22', type: 'join', actor: 'I', faction: 'axis', title: "Patto d'Acciaio", text: "L'Italia entra nell'Asse." },
  { date: '1939-09-01', type: 'war', actor: 'G', target: 'P', title: 'Invasione della Polonia', text: 'La Germania invade la Polonia.' },
  { date: '1939-11-30', type: 'war', actor: 'S', target: 'K', title: "Guerra d'Inverno", text: "L'URSS attacca la Finlandia." },
  { date: '1940-04-09', type: 'war', actor: 'G', target: 'D', title: 'Operazione Weserübung', text: 'La Germania attacca la Danimarca.' },
  { date: '1940-04-09', type: 'war', actor: 'G', target: 'N', title: 'Operazione Weserübung', text: 'La Germania attacca la Norvegia.' },
  { date: '1940-05-10', type: 'war', actor: 'G', target: 'B', title: 'Fall Gelb', text: 'La Germania invade il Benelux.' },
  { date: '1940-06-10', type: 'war', actor: 'I', target: 'F', title: "L'Italia entra in guerra", text: "L'Italia dichiara guerra alla Francia." },
  { date: '1940-06-15', type: 'annex', actor: 'S', target: 'X', title: 'Occupazione dei Baltici', text: "L'URSS annette i Paesi Baltici." },
  { date: '1940-10-28', type: 'war', actor: 'I', target: 'Q', title: 'Campagna di Grecia', text: "L'Italia attacca la Grecia." },
  { date: '1940-11-20', type: 'join', actor: 'H', faction: 'axis', title: 'Patto Tripartito', text: "L'Ungheria entra nell'Asse." },
  { date: '1940-11-23', type: 'join', actor: 'R', faction: 'axis', title: 'Patto Tripartito', text: "La Romania entra nell'Asse." },
  { date: '1941-03-01', type: 'join', actor: 'L', faction: 'axis', title: 'Patto Tripartito', text: "La Bulgaria entra nell'Asse." },
  { date: '1941-04-06', type: 'war', actor: 'G', target: 'Y', title: 'Invasione della Jugoslavia', text: 'La Germania attacca la Jugoslavia.' },
  { date: '1941-04-06', type: 'war', actor: 'G', target: 'Q', title: 'Operazione Marita', text: 'La Germania attacca la Grecia.' },
  { date: '1941-06-22', type: 'war', actor: 'G', target: 'S', title: 'Operazione Barbarossa', text: "La Germania invade l'Unione Sovietica." },
  { date: '1941-06-22', type: 'war', actor: 'R', target: 'S', title: 'Barbarossa', text: "La Romania attacca l'URSS." },
  { date: '1941-06-22', type: 'war', actor: 'I', target: 'S', title: 'Barbarossa', text: "L'Italia dichiara guerra all'URSS." },
  { date: '1941-06-25', type: 'war', actor: 'K', target: 'S', title: 'Guerra di Continuazione', text: "La Finlandia attacca l'URSS." },
  { date: '1941-06-27', type: 'war', actor: 'H', target: 'S', title: 'Barbarossa', text: "L'Ungheria attacca l'URSS." },
];
