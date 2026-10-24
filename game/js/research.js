'use strict';

// Ricerca tecnologica, dottrine terrestri e armi nucleari (stile Hearts of Iron IV).
// - Ogni tecnologia ha un anno storico: ricercarla prima costa +200% di tempo per ogni anno d'anticipo.
// - I bonus di ricerca (focus, spionaggio, Progetto Manhattan) accelerano una ricerca e, se "anticipo",
//   annullano la penalità temporale per quella sola tecnologia.
// - Le quattro dottrine terrestri si sbloccano spendendo esperienza dell'esercito (XP).
// Altri sistemi possono usare: c.researchBonuses = [{ cat, bonus, aot, uses, from }] (o addResearchBonus),
// c.researchSlots, c.mods.research_speed (es. leggi commerciali), c.xp.army, hasTech(c, id), unitMod(c, tipo, stat).

const YEAR_MS = 365.25 * DAY_MS;
const AHEAD_PENALTY = 2.0;       // +200% del tempo per ogni anno di anticipo
const ENTRENCH_DAYS = 10;        // giorni da fermi per il trinceramento massimo
const XP_CAP = 500;
const NUKE_DAYS = 150;           // giorni di reattore per produrre una bomba
const MANHATTAN_PP = 150;
const NUKE_FACTORIES = 60;       // il reattore richiede una grande potenza o un'industria enorme (civili + militari)

// id di categoria condivisi con i focus (focus.js): infantry, armor, artillery, support, air, naval,
// industry, electronics, doctrine, rocketry, nuclear
const TECH_CATS = {
  infantry:    { name: 'Fanteria' },
  artillery:   { name: 'Artiglieria' },
  armor:       { name: 'Corazzati' },
  industry:    { name: 'Industria' },
  electronics: { name: 'Elettronica' },
  nuclear:     { name: 'Nucleare' },
};
const CAT_NAME = { ...Object.fromEntries(Object.entries(TECH_CATS).map(([k, v]) => [k, v.name])),
  support: 'Supporto', air: 'Aviazione', naval: 'Marina', doctrine: 'Dottrine', air_doctrine: 'Dottrine aeree',
  naval_doctrine: 'Dottrine navali', rocketry: 'Razzi' };

// eff: [bersaglio, statistica, valore]. Bersaglio 'inf'/'arm'/'all' = modificatori delle divisioni,
// 'c' = campo della nazione (sommato), 'flag' = sblocco.
const TECHS = [
  { id: 'inf1', cat: 'infantry', name: 'Armi di fanteria I', year: 1936, days: 100, eff: [['inf', 'attack', 0.05]] },
  { id: 'sup1', cat: 'infantry', alt: 'support', name: 'Equipaggiamento di supporto', year: 1936, days: 80, eff: [['c', 'recBonus', 0.1]] },
  { id: 'inf2', cat: 'infantry', name: 'Armi di fanteria II', year: 1939, days: 120, req: ['inf1'], eff: [['inf', 'attack', 0.1], ['inf', 'defense', 0.05]] },
  { id: 'motor', cat: 'infantry', name: 'Fanteria motorizzata', year: 1938, days: 120, req: ['inf1'], eff: [['inf', 'speed', 0.15]] },
  { id: 'mech', cat: 'infantry', name: 'Fanteria meccanizzata', year: 1940, days: 150, req: ['motor'], eff: [['inf', 'speed', 0.1], ['inf', 'defense', 0.05], ['inf', 'breakthrough', 0.1]] },
  { id: 'inf3', cat: 'infantry', name: 'Armi di fanteria migliorate', year: 1942, days: 140, req: ['inf2'], eff: [['inf', 'attack', 0.1], ['inf', 'defense', 0.1]] },
  { id: 'mech2', cat: 'infantry', name: 'Meccanizzata migliorata', year: 1943, days: 160, req: ['mech'], eff: [['inf', 'defense', 0.1], ['inf', 'breakthrough', 0.1]] },

  { id: 'art1', cat: 'artillery', name: 'Artiglieria campale', year: 1936, days: 100, eff: [['inf', 'attack', 0.05]] },
  { id: 'at1', cat: 'artillery', name: 'Cannoni anticarro', year: 1938, days: 110, req: ['art1'], eff: [['inf', 'defense', 0.1]] },
  { id: 'art2', cat: 'artillery', name: 'Artiglieria migliorata', year: 1939, days: 120, req: ['art1'], eff: [['inf', 'attack', 0.1]] },
  { id: 'rocket', cat: 'artillery', alt: 'rocketry', name: 'Artiglieria a razzo', year: 1941, days: 140, req: ['art2'], eff: [['all', 'attack', 0.05]] },
  { id: 'art3', cat: 'artillery', name: 'Artiglieria avanzata', year: 1942, days: 150, req: ['art2'], eff: [['inf', 'attack', 0.1], ['inf', 'breakthrough', 0.05]] },
  { id: 'at2', cat: 'artillery', name: 'Anticarro avanzati', year: 1943, days: 150, req: ['at1'], eff: [['inf', 'defense', 0.1]] },

  { id: 'tank1', cat: 'armor', name: 'Carro leggero', year: 1936, days: 120, eff: [['flag', 'armorTech']] },
  { id: 'tank2', cat: 'armor', name: 'Carro medio', year: 1939, days: 150, req: ['tank1'], eff: [['arm', 'attack', 0.15], ['arm', 'defense', 0.1]] },
  { id: 'tank3', cat: 'armor', name: 'Carro pesante', year: 1940, days: 150, req: ['tank2'], eff: [['arm', 'breakthrough', 0.2], ['arm', 'defense', 0.1], ['arm', 'speed', -0.05]] },
  { id: 'tank4', cat: 'armor', name: 'Carro medio migliorato', year: 1941, days: 160, req: ['tank2'], eff: [['arm', 'attack', 0.15], ['arm', 'speed', 0.1]] },
  { id: 'tank5', cat: 'armor', name: 'Carro medio avanzato', year: 1943, days: 170, req: ['tank4'], eff: [['arm', 'attack', 0.15], ['arm', 'breakthrough', 0.1]] },
  { id: 'tank6', cat: 'armor', name: 'Carro armato moderno', year: 1945, days: 200, req: ['tank5', 'tank3'], eff: [['arm', 'attack', 0.2], ['arm', 'defense', 0.2], ['arm', 'speed', 0.1]] },

  { id: 'ind1', cat: 'industry', name: 'Produzione di massa', year: 1936, days: 100, eff: [['c', 'eqBonus', 0.1]] },
  { id: 'ind2', cat: 'industry', name: 'Tecniche di costruzione', year: 1937, days: 100, req: ['ind1'], eff: [['c', 'constructionBonus', 0.1]] },
  { id: 'ind3', cat: 'industry', name: 'Catena di montaggio', year: 1939, days: 130, req: ['ind1'], eff: [['c', 'eqBonus', 0.15]] },
  { id: 'ind4', cat: 'industry', name: 'Costruzione avanzata', year: 1940, days: 130, req: ['ind2'], eff: [['c', 'constructionBonus', 0.15], ['c', 'capBonus', 2]] },
  { id: 'ind5', cat: 'industry', name: 'Produzione flessibile', year: 1942, days: 150, req: ['ind3'], eff: [['c', 'eqBonus', 0.15]] },
  { id: 'ind6', cat: 'industry', name: 'Automazione industriale', year: 1944, days: 170, req: ['ind5'], eff: [['c', 'eqBonus', 0.2], ['c', 'constructionBonus', 0.1]] },

  { id: 'elec1', cat: 'electronics', name: 'Ingegneria elettronica', year: 1936, days: 90, eff: [['c', 'researchSpeed', 0.03]] },
  { id: 'radio', cat: 'electronics', name: 'Radio da campo', year: 1938, days: 110, req: ['elec1'], eff: [['c', 'recBonus', 0.1]] },
  { id: 'radar', cat: 'electronics', name: 'Radar', year: 1939, days: 120, req: ['radio'], eff: [['all', 'defense', 0.05]] },
  { id: 'comp1', cat: 'electronics', name: 'Macchine calcolatrici', year: 1940, days: 130, req: ['elec1'], eff: [['c', 'researchSpeed', 0.05]] },
  { id: 'decrypt', cat: 'electronics', name: 'Decrittazione', year: 1942, days: 150, req: ['comp1'], eff: [['all', 'attack', 0.05]] },
  { id: 'comp2', cat: 'electronics', name: 'Calcolatore elettronico', year: 1944, days: 170, req: ['comp1'], eff: [['c', 'researchSpeed', 0.07]] },

  { id: 'atom', cat: 'nuclear', name: 'Ricerca atomica', year: 1940, days: 150, req: ['elec1'], eff: [['c', 'researchSpeed', 0.02]] },
  { id: 'reactor', cat: 'nuclear', name: 'Reattore nucleare', year: 1943, days: 240, req: ['atom'], minFactories: NUKE_FACTORIES, eff: [['flag', 'reactor']] },
  { id: 'abomb', cat: 'nuclear', name: 'Bomba atomica', year: 1945, days: 300, req: ['reactor'], minFactories: NUKE_FACTORIES, eff: [['flag', 'abomb']] },
];
const TECH_BY_ID = Object.fromEntries(TECHS.map(t => [t.id, t]));
for (const t of TECHS) t.ts = Date.UTC(t.year, 0, 1);

const STAT_LABEL = { attack: 'attacco', defense: 'difesa', breakthrough: 'sfondamento', speed: 'velocità', width: 'larghezza' };
const UNIT_LABEL = { inf: 'fanteria', arm: 'corazzati', all: 'divisioni' };
const CFIELD_LABEL = {
  recBonus: 'rinforzi e recupero org.', eqBonus: 'produzione equipaggiamento', constructionBonus: 'velocità costruzione',
  researchSpeed: 'velocità di ricerca', mpBonus: 'crescita manodopera', entMax: 'trinceramento massimo',
  planMax: 'pianificazione massima', planSpeed: 'velocità di pianificazione',
};
const FLAG_LABEL = { armorTech: 'Sblocca le divisioni corazzate', reactor: 'Sblocca il reattore nucleare', abomb: 'Il reattore produce bombe atomiche' };

function effText(eff) {
  return eff.map(([tg, st, v]) => {
    if (tg === 'flag') return FLAG_LABEL[st];
    const sign = v > 0 ? '+' : '';
    if (tg === 'c' && st === 'capBonus') return `+${v} slot fabbrica`;
    if (tg === 'c' && st === 'planSpeed') return `${sign}${Math.round(v * 100)}% ${CFIELD_LABEL[st]}`;
    if (tg === 'c') return `${sign}${Math.round(v * 100)}% ${CFIELD_LABEL[st] || st}`;
    return `${sign}${Math.round(v * 100)}% ${STAT_LABEL[st]} ${UNIT_LABEL[tg]}`;
  }).join(', ');
}

// ---------- dottrine terrestri ----------
const DOCTRINE_XP = [50, 75, 100, 125, 150];
const DOCTRINES = {
  mobile: {
    name: 'Guerra di movimento', hist: 'Germania',
    desc: 'Blitzkrieg: velocità e sfondamento dei corazzati. Serve un\'industria capace di produrre molti carri.',
    tiers: [
      { name: 'Blitzkrieg', eff: [['arm', 'speed', 0.1], ['arm', 'breakthrough', 0.15]] },
      { name: 'Guerra di manovra', eff: [['inf', 'speed', 0.1], ['arm', 'attack', 0.1]] },
      { name: 'Sfondamento in profondità', eff: [['arm', 'breakthrough', 0.2], ['c', 'recBonus', 0.1]] },
      { name: 'Forze mobili', eff: [['arm', 'speed', 0.1], ['inf', 'speed', 0.05], ['arm', 'attack', 0.1]] },
      { name: 'Kampfgruppe', eff: [['arm', 'breakthrough', 0.15], ['arm', 'defense', 0.1], ['inf', 'breakthrough', 0.1]] },
    ],
  },
  fire: {
    name: 'Potenza di fuoco superiore', hist: 'Stati Uniti',
    desc: 'Attacco molto più alto per fanteria e artiglieria: ogni soldato diventa letale. La scelta più solida senza grandi flotte di carri.',
    tiers: [
      { name: 'Supporto di fuoco', eff: [['inf', 'attack', 0.1]] },
      { name: 'Fuoco di sbarramento', eff: [['inf', 'attack', 0.1], ['inf', 'defense', 0.05]] },
      { name: 'Fuoco integrato', eff: [['all', 'attack', 0.05], ['inf', 'breakthrough', 0.1]] },
      { name: 'Artiglieria di supporto', eff: [['inf', 'attack', 0.1]] },
      { name: 'Dominio della potenza di fuoco', eff: [['inf', 'attack', 0.1], ['inf', 'defense', 0.1]] },
    ],
  },
  plan: {
    name: 'Grande piano di battaglia', hist: 'Regno Unito, Giappone',
    desc: 'Trinceramento per una difesa inamovibile e pianificazione massima: le truppe ferme a lungo preparano offensive con oltre +60% di danno.',
    tiers: [
      { name: 'Trinceramento', eff: [['c', 'entMax', 0.1]] },
      { name: 'Pianificazione metodica', eff: [['c', 'planMax', 0.1], ['c', 'planSpeed', 0.25]] },
      { name: 'Difesa elastica', eff: [['inf', 'defense', 0.1], ['c', 'entMax', 0.05]] },
      { name: 'Operazioni coordinate', eff: [['c', 'planMax', 0.1], ['c', 'planSpeed', 0.25]] },
      { name: 'Piano di battaglia', eff: [['c', 'planMax', 0.1], ['inf', 'defense', 0.1]] },
    ],
  },
  mass: {
    name: 'Assalto di massa', hist: 'URSS, Cina',
    desc: 'Più uomini nello stesso fronte (larghezza ridotta), rinforzi e manodopera abbondanti: vinci per logorio.',
    tiers: [
      { name: 'Ondate umane', eff: [['c', 'mpBonus', 0.2], ['inf', 'defense', 0.05]] },
      { name: 'Profondità strategica', eff: [['c', 'recBonus', 0.2], ['inf', 'width', -0.1]] },
      { name: 'Mobilitazione di massa', eff: [['c', 'mpBonus', 0.2], ['inf', 'attack', 0.05]] },
      { name: 'Guerra di logoramento', eff: [['inf', 'defense', 0.1], ['c', 'recBonus', 0.2]] },
      { name: 'Assalto di massa', eff: [['inf', 'attack', 0.1], ['inf', 'width', -0.1], ['c', 'mpBonus', 0.2]] },
    ],
  },
};
const DOCTRINE_AI = { G: 'mobile', F: 'plan', U: 'plan', I: 'fire', S: 'mass', P: 'mass', T: 'mass', E: 'fire', K: 'plan' };

// ---------- stato per nazione ----------
function initResearch(c, def) {
  c.techs = new Set();
  c.research = [];                      // [{ id, frac, bonus, aot, from, bcat }]
  c.partial = {};                       // progresso conservato delle ricerche annullate
  c.researchSlots = def.major ? 3 : 2;
  c.researchSpeed = 0;                  // dalle tecnologie; si somma a c.mods.research_speed
  c.researchBonuses = c.researchBonuses || []; // [{ cat, bonus, aot, uses, from }]
  c.mods = c.mods || {};
  c.xp = c.xp || { army: 0, air: 0, navy: 0 };
  c.um = { inf: {}, arm: {} };          // modificatori delle divisioni da tecnologie e dottrine
  c.constructionBonus = 0; c.capBonus = 0;
  c.entMax = 0.1; c.planMax = 0.3; c.planSpeed = 0;
  c.xp.army += def.major ? 30 : 10;
  // alias usato dal progettista divisioni: c.armyXP e c.xp.army sono lo stesso valore
  if (!Object.getOwnPropertyDescriptor(c, 'armyXP')) {
    Object.defineProperty(c, 'armyXP', { get() { return this.xp.army; }, set(v) { this.xp.army = v; }, enumerable: false, configurable: true });
  }
  c.doctrine = null; c.doctrineTier = 0;
  c.reactor = false; c.abomb = false; c.nukes = 0; c.nukeProg = 0; c.nukeShock = 0; c.manhattan = false;
  const start = ['inf1'];
  if (def.major) start.push('art1', 'sup1', 'ind1', 'elec1');
  if (def.armor) start.push('tank1');
  for (const id of start) completeTech(c, id, true);
}

const hasTech = (c, id) => c.techs.has(id);
const unitMod = (c, type, stat) => (c.um[type] && c.um[type][stat]) || 0;

function applyEff(c, eff) {
  for (const [tg, st, v] of eff) {
    if (tg === 'flag') c[st] = true;
    else if (tg === 'c') c[st] = (c[st] || 0) + v;
    else for (const ty of tg === 'all' ? Object.keys(UNIT_TYPES) : [tg]) {
      const m = c.um[ty] || (c.um[ty] = {});
      m[st] = (m[st] || 0) + v;
    }
  }
}

function completeTech(c, id, silent) {
  const t = TECH_BY_ID[id];
  if (!t || c.techs.has(id)) return;
  c.techs.add(id);
  applyEff(c, t.eff);
  delete c.partial[id];
  if (silent) return;
  if (c.code === S.player) log(`Ricerca completata: ${t.name}.`, 'good');
  if (id === 'abomb') log(`${c.name} ha sviluppato la bomba atomica!`, 'big');
}

function techAvailable(c, t) {
  if (c.techs.has(t.id) || c.research.some(r => r.id === t.id)) return false;
  if (t.minFactories && !c.major && c.civ + c.mil < t.minFactories) return false;
  return !t.req || t.req.every(r => c.techs.has(r));
}

const researchSpeedOf = c => c.researchSpeed + (c.mods.research_speed || 0);

// anni d'anticipo rispetto all'anno storico (0 se in ritardo o in pari)
function yearsAhead(t) { return Math.max(0, (t.ts - (START_TS + S.day * DAY_MS)) / YEAR_MS); }
function aheadPenalty(t, job) { return job && job.aot ? 0 : yearsAhead(t) * AHEAD_PENALTY; }

// giorni effettivi per completare l'intera tecnologia alle condizioni attuali
function techDays(c, t, job) {
  const b = job ? job : (findBonus(c, t) || { bonus: 0, aot: false });
  return t.days * (1 + aheadPenalty(t, b)) / ((1 + researchSpeedOf(c)) * (1 + b.bonus));
}
function daysLeft(c, job) {
  const t = TECH_BY_ID[job.id];
  return Math.ceil((1 - job.frac) * techDays(c, t, job));
}

// t: tecnologia oppure id di categoria (es. 'doctrine')
function findBonus(c, t) {
  const cats = typeof t === 'string' ? [t] : [t.cat, t.alt];
  return c.researchBonuses.find(b => cats.includes(b.cat) && (b.uses ?? 1) > 0);
}
function takeBonus(c, b) {
  b.uses = (b.uses ?? 1) - 1;
  if (b.uses <= 0) c.researchBonuses = c.researchBonuses.filter(x => x !== b);
}
function addResearchBonus(c, cat, bonus, aot, from, uses = 1) {
  c.researchBonuses.push({ cat, bonus, aot: !!aot, uses, from });
  if (c.code === S.player) log(`Nuovo bonus di ricerca: ${from} (${CAT_NAME[cat] || cat}).`, 'good');
}

function startResearch(c, id) {
  const t = TECH_BY_ID[id];
  if (!t || !techAvailable(c, t) || c.research.length >= c.researchSlots) return false;
  const b = findBonus(c, t);
  const job = { id, frac: c.partial[id] || 0, bonus: 0, aot: false, from: null, bcat: null };
  if (b) {
    takeBonus(c, b);
    job.bonus = b.bonus || 0; job.aot = !!b.aot; job.from = b.from || 'Bonus'; job.bcat = b.cat;
  }
  c.research.push(job);
  return true;
}
function cancelResearch(c, idx) {
  const job = c.research[idx];
  if (!job) return;
  c.research.splice(idx, 1);
  c.partial[job.id] = job.frac;
  // il bonus non usato torna disponibile
  if (job.from) c.researchBonuses.push({ cat: job.bcat, bonus: job.bonus, aot: job.aot, uses: 1, from: job.from });
}

// ---------- ciclo giornaliero ----------
function researchStep(c) {
  if (c.armorTech && !c.techs.has('tank1')) completeTech(c, 'tank1', true); // sbloccato da un focus
  for (let i = c.research.length - 1; i >= 0; i--) {
    const job = c.research[i];
    job.frac += 1 / techDays(c, TECH_BY_ID[job.id], job);
    if (job.frac >= 1) { c.research.splice(i, 1); completeTech(c, job.id); }
  }
  if (c.abomb) {
    c.nukeProg += 1 / NUKE_DAYS;
    if (c.nukeProg >= 1) {
      c.nukeProg = 0; c.nukes++;
      if (c.code === S.player) log('Il reattore ha prodotto una nuova bomba atomica.', 'good');
    }
  }
  c.nukeShock = Math.max(0, c.nukeShock - 0.0005);
  if (c.code !== S.player) aiResearch(c);
}

// dopo il movimento: trinceramento, pianificazione ed esperienza dell'esercito
function researchTick() {
  const fighting = {};
  for (const d of S.divs) {
    if (d.dead) continue;
    const c = C(d.owner);
    if (typeof LAND_HANDLES_PLANNING === 'undefined') { // il sistema di guerra terrestre li gestisce da sé
      if (d.lastTile !== d.tile) { d.lastTile = d.tile; d.ent = 0; }
      else if (!d.path.length) d.ent = Math.min(ENTRENCH_DAYS, (d.ent || 0) + 1);
      if (d.combat || d.path.length) d.plan = Math.max(0, (d.plan || 0) - (d.combat ? 0.03 : 0.01));
      else d.plan = Math.min(c.planMax, (d.plan || 0) + 0.01 * (1 + c.planSpeed));
    }
    if (d.combat) fighting[d.owner] = (fighting[d.owner] || 0) + 1;
  }
  for (const k in S.countries) {
    const c = S.countries[k];
    if (!c.alive) continue;
    const gain = 0.12 + c.training.length * 0.01 + Math.min(1, (fighting[k] || 0) * 0.02);
    c.xp.army = Math.min(XP_CAP, c.xp.army + gain);
  }
}

// ---------- modificatori di combattimento (usati da game.js) ----------
const entrenchBonus = d => (d.ent || 0) / ENTRENCH_DAYS * C(d.owner).entMax;
const divAtkMul = d => (1 + unitMod(C(d.owner), d.type, 'attack')) * (1 + (d.plan || 0));
const divDefMul = d => (1 + unitMod(C(d.owner), d.type, 'defense')) * (1 + entrenchBonus(d));
const divSpeedMul = d => Math.max(0.3, 1 + unitMod(C(d.owner), d.type, 'speed'));
const divBreakMul = d => 1 + unitMod(C(d.owner), d.type, 'breakthrough');

// ---------- dottrine ----------
// un bonus 'doctrine' dei focus riduce il costo in XP del prossimo livello
function doctrineNext(c, key) {
  if (c.doctrine && c.doctrine !== key) return null;
  const tier = c.doctrine ? c.doctrineTier : 0;
  if (tier >= DOCTRINES[key].tiers.length) return null;
  const b = findBonus(c, 'doctrine');
  return { tier, cost: Math.round(DOCTRINE_XP[tier] / (1 + (b ? b.bonus || 0 : 0))), b };
}
function adoptDoctrine(c, key) {
  const n = doctrineNext(c, key);
  if (!n || c.xp.army < n.cost) return false;
  c.xp.army -= n.cost;
  if (n.b) takeBonus(c, n.b);
  c.doctrine = key; c.doctrineTier = n.tier + 1;
  const tr = DOCTRINES[key].tiers[n.tier];
  applyEff(c, tr.eff);
  if (c.code === S.player) log(`Dottrina adottata: ${tr.name} (${DOCTRINES[key].name}).`, 'good');
  return true;
}

// ---------- nucleare ----------
function canManhattan(c) { return !c.manhattan && c.techs.has('atom') && !c.abomb; }
function launchManhattan(c) {
  if (!canManhattan(c) || c.pp < MANHATTAN_PP) return false;
  c.pp -= MANHATTAN_PP;
  c.manhattan = true;
  c.researchBonuses.push({ cat: 'nuclear', bonus: 1.0, aot: true, uses: 2, from: 'Progetto Manhattan' });
  c.researchSpeed += 0.03;
  log(`${c.name} avvia un programma atomico segreto.`, c.code === S.player ? 'good' : '');
  return true;
}

function nukeTargets(code) {
  const en = new Set(enemiesOf(code));
  return S.tiles.filter(t => t.land && t.vp > 0 && en.has(t.ctrl));
}

function dropNuke(by, ti) {
  const a = C(by), t = S.tiles[ti];
  if (a.nukes < 1 || !t.land || !atWar(by, t.ctrl)) return false;
  a.nukes--;
  const hit = (tile, f) => {
    for (const d of [...(S.byTile.get(tile) || [])]) {
      if (d.dead) continue;
      d.str *= f; d.org = 0; d.plan = 0; d.ent = 0;
      if (d.str < 0.05) destroyDiv(d);
    }
  };
  hit(ti, 0.35);
  for (const n of t.nb) if (S.tiles[n].land) hit(n, 0.75);
  const v = C(t.owner);
  if (v.alive && atWar(by, t.owner)) {
    v.civ = Math.max(0, v.civ - Math.max(1, Math.round(v.civ * 0.08)));
    v.mil = Math.max(0, v.mil - Math.max(1, Math.round(v.mil * 0.08)));
    v.nukeShock += t.vp >= 20 ? 0.15 : 0.08;
  }
  (S.nuked || (S.nuked = [])).push({ ti, day: S.day, by });
  S.mapDirty = true;
  const where = t.vp >= 20 ? `sulla capitale di ${v.name}` : `su una città di ${v.name}`;
  log(`☢ ${a.name} sgancia una bomba atomica ${where}!`, 'big');
  if (t.owner === S.player || allied(t.owner, S.player)) UI.dirty = true;
  return true;
}

// ---------- IA ----------
const AI_CAT_W = {
  major: { industry: 1.0, infantry: 1.1, artillery: 1.15, armor: 1.2, electronics: 1.25, nuclear: 1.6 },
  minor: { infantry: 1.0, artillery: 1.1, industry: 1.15, electronics: 1.4, armor: 1.6, nuclear: 3 },
};
function aiResearch(c) {
  while (c.research.length < c.researchSlots) {
    const w = AI_CAT_W[c.major ? 'major' : 'minor'];
    let best = null, bs = Infinity;
    for (const t of TECHS) {
      if (!techAvailable(c, t)) continue;
      if (t.cat === 'armor' && !c.major && !c.armorTech && S.day < 1100) continue;
      const pen = aheadPenalty(t, findBonus(c, t));
      const s = techDays(c, t) * w[t.cat] * (pen > 0.6 ? 3 : 1);
      if (s < bs) { bs = s; best = t; }
    }
    if (!best || !startResearch(c, best.id)) break;
  }
  if ((S.day + c.slot) % 10 !== 0) return;
  const key = c.doctrine || DOCTRINE_AI[c.code] || ['fire', 'plan', 'fire', 'mass'][c.code.charCodeAt(0) % 4];
  adoptDoctrine(c, key);
  if (c.major && canManhattan(c) && c.pp >= MANHATTAN_PP + 50 && S.day > 1800 && ['U', 'S', 'G'].includes(c.code)) launchManhattan(c);
  if (c.nukes > 0 && (S.day + c.slot) % 20 === 0) {
    const tg = nukeTargets(c.code);
    if (!tg.length) return;
    const score = t => t.vp * 2 + (S.byTile.get(t.i) || []).filter(d => atWar(d.owner, c.code)).length * 3;
    tg.sort((a, b) => score(b) - score(a));
    dropNuke(c.code, tg[0].i);
  }
}
