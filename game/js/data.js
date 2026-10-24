'use strict';

// Le capitali e i territori vengono dalla mappa (js/map-data.js, vedi docs/MAPPA.md).
// I paesi aggiunti con la mappa reale usano il tag di Hearts of Iron IV.
const COUNTRY_DEFS = {
  G: { name: 'Germania', color: '#6b7177', civ: 28, mil: 14, inf: 26, arm: 3, armor: true, major: true, aggro: 0.85, faction: 'axis' },
  F: { name: 'Francia', color: '#3a5cc2', civ: 30, mil: 9, inf: 34, arm: 2, armor: true, major: true, aggro: 0.3, faction: 'allies' },
  U: { name: 'Regno Unito', color: '#c2414b', civ: 30, mil: 8, inf: 16, arm: 1, armor: true, major: true, aggro: 0.4, faction: 'allies' },
  I: { name: 'Italia', color: '#4a8a3c', civ: 18, mil: 8, inf: 24, arm: 1, armor: true, major: true, aggro: 0.55 },
  S: { name: 'Unione Sovietica', color: '#7d2222', civ: 32, mil: 18, inf: 60, arm: 4, armor: true, major: true, aggro: 0.6, faction: 'comintern' },
  P: { name: 'Polonia', color: '#d68fb0', civ: 9, mil: 4, inf: 18, arm: 0, aggro: 0.3 },
  E: { name: 'Spagna', color: '#e0b84c', civ: 8, mil: 3, inf: 12, arm: 0, aggro: 0.3 },
  O: { name: 'Portogallo', color: '#3f8f6e', civ: 3, mil: 1, inf: 3, arm: 0, aggro: 0.2 },
  B: { name: 'Belgio', color: '#c9a53a', civ: 8, mil: 2, inf: 6, arm: 0, aggro: 0.2 },
  HOL: { name: 'Paesi Bassi', color: '#e0913a', civ: 6, mil: 1, inf: 4, arm: 0, aggro: 0.15 },
  LUX: { name: 'Lussemburgo', color: '#7fb0d9', civ: 1, mil: 0, inf: 0, arm: 0, aggro: 0.1 },
  D: { name: 'Danimarca', color: '#b5526e', civ: 3, mil: 1, inf: 2, arm: 0, aggro: 0.2 },
  N: { name: 'Norvegia', color: '#8a5a44', civ: 3, mil: 1, inf: 3, arm: 0, aggro: 0.2 },
  W: { name: 'Svezia', color: '#4a86c4', civ: 7, mil: 3, inf: 6, arm: 0, aggro: 0.2 },
  K: { name: 'Finlandia', color: '#dfe3ea', civ: 3, mil: 2, inf: 7, arm: 0, aggro: 0.35 },
  EST: { name: 'Estonia', color: '#5b7fb5', civ: 1, mil: 0, inf: 2, arm: 0, aggro: 0.2 },
  LAT: { name: 'Lettonia', color: '#9a5a6a', civ: 1, mil: 1, inf: 2, arm: 0, aggro: 0.2 },
  LIT: { name: 'Lituania', color: '#c9b84a', civ: 1, mil: 0, inf: 2, arm: 0, aggro: 0.2 },
  C: { name: 'Cecoslovacchia', color: '#4aa3a3', civ: 9, mil: 5, inf: 12, arm: 0, aggro: 0.25 },
  A: { name: 'Austria', color: '#cfc8b0', civ: 4, mil: 1, inf: 4, arm: 0, aggro: 0.2 },
  Z: { name: 'Svizzera', color: '#a33b5f', civ: 5, mil: 1, inf: 4, arm: 0, aggro: 0.1 },
  H: { name: 'Ungheria', color: '#a87d55', civ: 4, mil: 2, inf: 6, arm: 0, aggro: 0.4 },
  R: { name: 'Romania', color: '#a7a23a', civ: 6, mil: 2, inf: 10, arm: 0, aggro: 0.4 },
  Y: { name: 'Jugoslavia', color: '#6c64c8', civ: 5, mil: 2, inf: 10, arm: 0, aggro: 0.3 },
  L: { name: 'Bulgaria', color: '#5f9a6a', civ: 3, mil: 1, inf: 6, arm: 0, aggro: 0.3 },
  Q: { name: 'Grecia', color: '#7fb7e6', civ: 3, mil: 1, inf: 7, arm: 0, aggro: 0.3 },
  ALB: { name: 'Albania', color: '#b8484a', civ: 1, mil: 0, inf: 2, arm: 0, aggro: 0.2 },
  IRE: { name: 'Irlanda', color: '#5fa35a', civ: 2, mil: 0, inf: 2, arm: 0, aggro: 0.1 },
  ICE: { name: 'Islanda', color: '#8fb0c8', civ: 1, mil: 0, inf: 0, arm: 0, aggro: 0.05 },
  EGY: { name: 'Egitto', color: '#c8b46a', civ: 3, mil: 0, inf: 3, arm: 0, aggro: 0.15 },
  IRQ: { name: 'Iraq', color: '#7a9a5a', civ: 2, mil: 0, inf: 3, arm: 0, aggro: 0.2 },
  PER: { name: 'Persia', color: '#5a9a8a', civ: 3, mil: 1, inf: 6, arm: 0, aggro: 0.2 },
  SAU: { name: 'Arabia Saudita', color: '#6f8f4a', civ: 1, mil: 0, inf: 3, arm: 0, aggro: 0.2 },
  T: { name: 'Turchia', color: '#9aa86b', civ: 7, mil: 2, inf: 12, arm: 0, aggro: 0.2 },
};

const FACTION_DEFS = {
  allies: { name: 'Alleati', leader: 'U' },
  axis: { name: 'Asse', leader: 'G' },
  comintern: { name: 'Comintern', leader: 'S' },
};

const TERRAIN = {
  plains:   { name: 'Pianura',  cost: 1.0, def: 1.0, arm: 1.0, shade: 1.0 },
  forest:   { name: 'Foresta',  cost: 1.5, def: 1.25, arm: 0.7, shade: 0.86 },
  hills:    { name: 'Colline',  cost: 1.6, def: 1.3, arm: 0.8, shade: 0.94 },
  mountain: { name: 'Montagna', cost: 2.4, def: 1.6, arm: 0.5, shade: 0.76 },
  desert:   { name: 'Deserto',  cost: 1.1, def: 1.0, arm: 1.0, shade: 1.05 },
  marsh:    { name: 'Palude',   cost: 2.0, def: 1.35, arm: 0.6, shade: 0.9 },
  urban:    { name: 'Urbano',   cost: 1.3, def: 1.5, arm: 0.6, shade: 0.95 },
};

const UNIT_TYPES = {
  inf: { name: 'Fanteria', short: 'Fant.', atk: 12, def: 20, org: 60, speed: 0.30, eq: 500, mp: 10000, days: 60 },
  arm: { name: 'Corazzata', short: 'Coraz.', atk: 36, def: 16, org: 50, speed: 0.60, eq: 1600, mp: 8000, days: 90 },
};

const BUILD_COST = { civ: 90, mil: 75 };

const FOCUSES = [
  { id: 'ind1', name: 'Espansione industriale', desc: '+3 fabbriche civili', days: 35, apply: c => { c.civ += 3; } },
  { id: 'arm1', name: 'Riarmo', desc: '+3 fabbriche militari', days: 35, apply: c => { c.mil += 3; } },
  { id: 'ind2', name: 'Industria pesante', req: ['ind1'], desc: '+2 civili, +2 militari', days: 42, apply: c => { c.civ += 2; c.mil += 2; } },
  { id: 'arm2', name: 'Economia di guerra', req: ['arm1'], desc: '+4 militari, +20% equipaggiamento', days: 50, apply: c => { c.mil += 4; c.eqBonus += 0.2; } },
  { id: 'army1', name: "Riforma dell'esercito", desc: '+10% attacco divisioni', days: 35, apply: c => { c.atkBonus += 0.1; } },
  { id: 'tank', name: 'Ricerca corazzata', desc: 'Sblocca le divisioni corazzate', days: 50, apply: c => { c.armorTech = true; }, avail: c => !c.armorTech },
  { id: 'army2', name: 'Guerra lampo', req: ['army1', 'tank'], desc: '+15% attacco, +10% velocità', days: 50, apply: c => { c.atkBonus += 0.15; c.speedBonus += 0.1; } },
  { id: 'def1', name: 'Dottrina difensiva', desc: '+15% difesa divisioni', days: 35, apply: c => { c.defBonus += 0.15; } },
  { id: 'def2', name: 'Linee fortificate', req: ['def1'], desc: '+20% difesa divisioni', days: 50, apply: c => { c.defBonus += 0.2; } },
  { id: 'mob', name: 'Mobilitazione generale', desc: '+150k manodopera, +30% crescita', days: 35, apply: c => { c.manpower += 150000; c.mpBonus += 0.3; } },
  { id: 'prop', name: 'Ministero della propaganda', desc: '+1 potere politico al giorno', days: 35, apply: c => { c.ppGain += 1; } },
  { id: 'infra', name: 'Ferrovie strategiche', desc: '+15% velocità di movimento', days: 35, apply: c => { c.speedBonus += 0.15; } },
  { id: 'logi', name: 'Logistica militare', desc: '+50% rinforzi e recupero organizzazione', days: 35, apply: c => { c.recBonus += 0.5; } },
];
const FOCUS_BY_ID = Object.fromEntries(FOCUSES.map(f => [f.id, f]));
const AI_FOCUS_MAJOR = ['ind1', 'arm1', 'ind2', 'arm2', 'army1', 'tank', 'army2', 'mob', 'infra', 'logi', 'def1', 'prop', 'def2'];
const AI_FOCUS_MINOR = ['def1', 'ind1', 'arm1', 'def2', 'mob', 'ind2', 'logi', 'army1', 'arm2', 'infra', 'prop', 'tank', 'army2'];

// Eventi storici. Se l'attore è il giocatore, gli viene chiesto se procedere.
const EVENTS = [
  { date: '1938-03-12', type: 'annex', actor: 'G', target: 'A', title: 'Anschluss', text: "La Germania annette l'Austria." },
  { date: '1938-09-30', type: 'annex', actor: 'G', target: 'C', title: 'Accordi di Monaco', text: 'La Germania annette la Cecoslovacchia.' },
  { date: '1939-03-31', type: 'guarantee', actor: 'U', target: 'P', title: 'Garanzia britannica', text: "Il Regno Unito garantisce l'indipendenza della Polonia." },
  { date: '1939-03-31', type: 'guarantee', actor: 'F', target: 'P', title: 'Garanzia francese', text: "La Francia garantisce l'indipendenza della Polonia." },
  { date: '1939-04-07', type: 'war', actor: 'I', target: 'ALB', title: "Invasione dell'Albania", text: "L'Italia invade l'Albania." },
  { date: '1939-05-22', type: 'join', actor: 'I', faction: 'axis', title: "Patto d'Acciaio", text: "L'Italia entra nell'Asse." },
  { date: '1939-09-01', type: 'war', actor: 'G', target: 'P', title: 'Invasione della Polonia', text: 'La Germania invade la Polonia.' },
  { date: '1939-11-30', type: 'war', actor: 'S', target: 'K', title: "Guerra d'Inverno", text: "L'URSS attacca la Finlandia." },
  { date: '1940-04-09', type: 'war', actor: 'G', target: 'D', title: 'Operazione Weserübung', text: 'La Germania attacca la Danimarca.' },
  { date: '1940-04-09', type: 'war', actor: 'G', target: 'N', title: 'Operazione Weserübung', text: 'La Germania attacca la Norvegia.' },
  { date: '1940-05-10', type: 'war', actor: 'G', target: 'HOL', title: 'Fall Gelb', text: 'La Germania invade i Paesi Bassi.' },
  { date: '1940-05-10', type: 'war', actor: 'G', target: 'B', title: 'Fall Gelb', text: 'La Germania invade il Belgio.' },
  { date: '1940-05-10', type: 'war', actor: 'G', target: 'LUX', title: 'Fall Gelb', text: 'La Germania invade il Lussemburgo.' },
  { date: '1940-06-10', type: 'war', actor: 'I', target: 'F', title: "L'Italia entra in guerra", text: "L'Italia dichiara guerra alla Francia." },
  { date: '1940-06-15', type: 'annex', actor: 'S', target: 'LIT', title: 'Occupazione dei Baltici', text: "L'URSS annette la Lituania." },
  { date: '1940-06-17', type: 'annex', actor: 'S', target: 'LAT', title: 'Occupazione dei Baltici', text: "L'URSS annette la Lettonia." },
  { date: '1940-06-17', type: 'annex', actor: 'S', target: 'EST', title: 'Occupazione dei Baltici', text: "L'URSS annette l'Estonia." },
  { date: '1940-10-28', type: 'war', actor: 'I', target: 'Q', title: 'Campagna di Grecia', text: "L'Italia attacca la Grecia." },
  { date: '1940-11-20', type: 'join', actor: 'H', faction: 'axis', title: 'Patto Tripartito', text: "L'Ungheria entra nell'Asse." },
  { date: '1940-11-23', type: 'join', actor: 'R', faction: 'axis', title: 'Patto Tripartito', text: "La Romania entra nell'Asse." },
  { date: '1941-03-01', type: 'join', actor: 'L', faction: 'axis', title: 'Patto Tripartito', text: "La Bulgaria entra nell'Asse." },
  { date: '1941-04-06', type: 'war', actor: 'G', target: 'Y', title: 'Invasione della Jugoslavia', text: 'La Germania attacca la Jugoslavia.' },
  { date: '1941-04-06', type: 'war', actor: 'G', target: 'Q', title: 'Operazione Marita', text: 'La Germania attacca la Grecia.' },
  { date: '1941-05-02', type: 'war', actor: 'U', target: 'IRQ', title: 'Guerra anglo-irachena', text: "Il Regno Unito interviene in Iraq dopo il colpo di stato." },
  { date: '1941-06-22', type: 'war', actor: 'G', target: 'S', title: 'Operazione Barbarossa', text: "La Germania invade l'Unione Sovietica." },
  { date: '1941-06-22', type: 'war', actor: 'R', target: 'S', title: 'Barbarossa', text: "La Romania attacca l'URSS." },
  { date: '1941-06-22', type: 'war', actor: 'I', target: 'S', title: 'Barbarossa', text: "L'Italia dichiara guerra all'URSS." },
  { date: '1941-06-25', type: 'war', actor: 'K', target: 'S', title: 'Guerra di Continuazione', text: "La Finlandia attacca l'URSS." },
  { date: '1941-06-27', type: 'war', actor: 'H', target: 'S', title: 'Barbarossa', text: "L'Ungheria attacca l'URSS." },
  { date: '1941-08-25', type: 'war', actor: 'U', target: 'PER', title: "Invasione anglo-sovietica dell'Iran", text: 'Il Regno Unito invade la Persia.' },
  { date: '1941-08-25', type: 'war', actor: 'S', target: 'PER', title: "Invasione anglo-sovietica dell'Iran", text: "L'URSS invade la Persia." },
];
