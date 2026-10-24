'use strict';

// Economia stile Hearts of Iron IV:
// - linee di produzione con efficienza (base, cap, crescita non lineare, ritenzione al cambio modello)
// - industria concentrata o dispersa
// - sei risorse strategiche estratte dai territori controllati
// - beni di consumo, leggi economiche e leggi commerciali
// - accordi commerciali di risorse pagati in fabbriche civili, mercato internazionale dell'equipaggiamento
// - organizzazioni militari-industriali (MIO)
// - cantieri: 15 fabbriche civili al massimo per progetto, 5 punti costruzione per fabbrica al giorno
// API pubblica: oggetto globale Econ (vedi in fondo).

const RESOURCES = {
  acciaio:   { name: 'Acciaio',   icon: '⛓️', color: '#9aa4ad' },
  alluminio: { name: 'Alluminio', icon: '🥫', color: '#c9d4dc' },
  gomma:     { name: 'Gomma',     icon: '⚫', color: '#5b5b5b' },
  tungsteno: { name: 'Tungsteno', icon: '💎', color: '#7c8fc9' },
  cromo:     { name: 'Cromo',     icon: '🔩', color: '#b8a24a' },
  petrolio:  { name: 'Petrolio',  icon: '🛢️', color: '#3b3b44' },
};
const RES_IDS = Object.keys(RESOURCES);

// Risorse giornaliere per paese. home = nei territori europei (si possono conquistare),
// overseas = colonie e possedimenti fuori mappa.
const RESOURCE_DEFS = {
  G: { home: { acciaio: 52, alluminio: 12, petrolio: 4 } },
  F: { home: { acciaio: 40, alluminio: 18 }, overseas: { gomma: 10, cromo: 4, tungsteno: 2 } },
  U: { home: { acciaio: 30, alluminio: 4 }, overseas: { gomma: 60, petrolio: 22, cromo: 20, tungsteno: 8, alluminio: 10 } },
  I: { home: { acciaio: 8, alluminio: 10, petrolio: 2 } },
  S: { home: { acciaio: 120, alluminio: 30, tungsteno: 12, cromo: 40, petrolio: 70, gomma: 2 } },
  P: { home: { acciaio: 16, petrolio: 3 } },
  E: { home: { acciaio: 10, tungsteno: 16, alluminio: 2 } },
  O: { home: { tungsteno: 22, acciaio: 2 } },
  B: { home: { acciaio: 22 }, overseas: { gomma: 40, petrolio: 24, alluminio: 6 } },
  D: { home: { acciaio: 2 } },
  N: { home: { alluminio: 10, acciaio: 4 } },
  W: { home: { acciaio: 44, tungsteno: 6 } },
  K: { home: { acciaio: 4, cromo: 2 } },
  X: { home: { acciaio: 2, petrolio: 1 } },
  C: { home: { acciaio: 28, alluminio: 2 } },
  A: { home: { acciaio: 8, alluminio: 4 } },
  Z: { home: { alluminio: 6 } },
  H: { home: { alluminio: 22, petrolio: 4, acciaio: 4 } },
  R: { home: { petrolio: 60, acciaio: 4, alluminio: 2 } },
  Y: { home: { alluminio: 20, cromo: 8, acciaio: 6 } },
  L: { home: { cromo: 2, acciaio: 2 } },
  Q: { home: { cromo: 6, alluminio: 6, acciaio: 2 } },
  T: { home: { cromo: 40, acciaio: 4 } },
};

// Famiglie di equipaggiamento. cost = costo in punti industriali (IC) per pezzo,
// res = risorse richieste per ogni fabbrica della linea, q = qualità (moltiplica le statistiche).
const EQUIP_FAMILIES = {
  fanteria: { name: 'Equip. di fanteria', short: 'Fanteria', icon: '🔫', models: [
    { id: 'fant1', name: 'Fucili mod. 1936', year: 1936, cost: 0.50, q: 1.00, res: { acciaio: 1 } },
    { id: 'fant2', name: 'Fucili mod. 1939', year: 1939, cost: 0.58, q: 1.15, res: { acciaio: 1 } },
    { id: 'fant3', name: 'Fucili mod. 1942', year: 1942, cost: 0.65, q: 1.30, res: { acciaio: 2 } },
  ] },
  supporto: { name: 'Equip. di supporto', short: 'Supporto', icon: '📡', models: [
    { id: 'supp1', name: 'Radio e genio 1936', year: 1936, cost: 4, q: 1.00, res: { acciaio: 1, alluminio: 1 } },
    { id: 'supp2', name: 'Radio e genio 1941', year: 1941, cost: 4.5, q: 1.15, res: { acciaio: 1, alluminio: 1 } },
  ] },
  artiglieria: { name: 'Artiglieria', short: 'Artiglieria', icon: '💥', models: [
    { id: 'art1', name: 'Obice 1936', year: 1936, cost: 3.5, q: 1.00, res: { acciaio: 1, tungsteno: 1 } },
    { id: 'art2', name: 'Obice 1940', year: 1940, cost: 4.0, q: 1.20, res: { acciaio: 1, tungsteno: 1 } },
    { id: 'art3', name: 'Obice 1943', year: 1943, cost: 4.5, q: 1.40, res: { acciaio: 2, tungsteno: 1 } },
  ] },
  carri: { name: 'Carri armati', short: 'Carri', icon: '🛡️', armor: true, models: [
    { id: 'tank1', name: 'Carro leggero 1936', year: 1936, cost: 8, q: 1.00, res: { acciaio: 1, cromo: 1 } },
    { id: 'tank2', name: 'Carro medio 1940', year: 1940, cost: 12, q: 1.35, res: { acciaio: 2, cromo: 1 } },
    { id: 'tank3', name: 'Carro pesante 1943', year: 1943, cost: 20, q: 1.70, res: { acciaio: 3, cromo: 2 } },
  ] },
  camion: { name: 'Camion', short: 'Camion', icon: '🚚', models: [
    { id: 'truck1', name: 'Autocarro 1936', year: 1936, cost: 2.5, q: 1.00, res: { acciaio: 1, gomma: 1 } },
  ] },
};
const MODEL_BY_ID = {};
for (const f in EQUIP_FAMILIES) for (const m of EQUIP_FAMILIES[f].models) { m.fam = f; MODEL_BY_ID[m.id] = m; }

// Equipaggiamento necessario per schierare una divisione (e per rinforzarla, in proporzione).
const EQUIP_NEEDS = {
  inf: { fanteria: 1000, artiglieria: 36, supporto: 30 },
  arm: { fanteria: 400, carri: 100, camion: 120, supporto: 40 },
};

const ECO = {
  IC_PER_FACTORY: 4.5,   // output giornaliero di una fabbrica militare al 100%
  EFF_BASE: 0.10,        // efficienza di partenza di una linea nuova
  EFF_CAP: 0.50,         // cap massimo base
  EFF_GROWTH_K: 0.03,    // crescita = K * base / (attuale * 10) al giorno
  RETENTION: 0.30,       // efficienza tenuta passando a un modello nuovo della stessa famiglia
  CP_PER_CIV: 5,         // punti costruzione al giorno per fabbrica civile
  CIVS_PER_PROJECT: 15,  // fabbriche civili massime su un singolo cantiere
  RES_PER_CIV: 8,        // risorse importabili con una fabbrica civile
  OCCUPIED_RES: 0.6,     // resa delle risorse nei territori occupati
  FUEL_PER_OIL: 6,
  FUEL_CAP: 30000,
};

const BUILDINGS = {
  civ: { name: 'Fabbrica civile', icon: '🏭', cost: 10800 },
  mil: { name: 'Fabbrica militare', icon: '⚙️', cost: 7200 },
  ref: { name: 'Raffineria sintetica', icon: '⛽', cost: 6000, year: 1937, oil: 3 },
};

const TRADE_LAWS = {
  chiusa:     { name: 'Economia chiusa',          export: 0.00, research: -0.10, build: -0.10, output: 0.00, desc: 'Tieni il 100% delle risorse estratte. -10% velocità di ricerca, -10% velocità di costruzione.' },
  limitata:   { name: 'Esportazioni limitate',    export: 0.25, research: 0.00,  build: 0.00,  output: 0.00, desc: 'Il 25% delle risorse va sul mercato mondiale. Nessun bonus.' },
  esport:     { name: 'Economia di esportazione', export: 0.50, research: 0.05,  build: 0.10,  output: 0.05, desc: 'Il 50% delle risorse va sul mercato. +5% ricerca, +10% costruzione, +5% output delle fabbriche.' },
  libero:     { name: 'Libero scambio',           export: 0.80, research: 0.10,  build: 0.15,  output: 0.10, desc: "L'80% delle risorse va sul mercato (anche se nessuno le compra non puoi usarle). +10% ricerca, +15% costruzione, +10% output delle fabbriche." },
};
const ECON_LAWS = {
  civile:   { name: 'Economia civile',         cg: 0.35, milBuild: -0.30, desc: '35% delle fabbriche ai beni di consumo, -30% velocità di costruzione delle fabbriche militari.' },
  precoce:  { name: 'Mobilitazione precoce',   cg: 0.30, milBuild: -0.10, desc: '30% ai beni di consumo, -10% costruzione militare.' },
  parziale: { name: 'Mobilitazione parziale',  cg: 0.25, milBuild: 0.00,  desc: '25% ai beni di consumo. Richiede il 1938 o una guerra.', req: c => S.day >= 730 || ecoAtWar(c) },
  guerra:   { name: 'Economia di guerra',      cg: 0.20, milBuild: 0.10,  desc: '20% ai beni di consumo, +10% costruzione militare. Richiede metà 1939 o una guerra.', req: c => S.day >= 1280 || ecoAtWar(c) },
  totale:   { name: 'Mobilitazione totale',    cg: 0.10, milBuild: 0.20,  mp: -0.2, desc: '10% ai beni di consumo, +20% costruzione militare, -20% crescita della manodopera. Richiede una guerra.', req: c => ecoAtWar(c) },
};
const LAW_COST = { trade: 100, econ: 120, industry: 150 };

const INDUSTRY = {
  none:        { name: 'Nessuna dottrina' },
  concentrata: { name: 'Industria concentrata', desc: 'Più output e cap di efficienza, ma cambiando modello perdi quasi tutta l\'efficienza.' },
  dispersa:    { name: 'Industria dispersa', desc: 'Meno output grezzo, ma alta ritenzione dell\'efficienza, crescita più rapida e protezione dai bombardamenti.' },
};

const MIO_TRAITS = [
  { id: 'cap',    name: 'Standardizzazione',     desc: '+5% cap di efficienza' },
  { id: 'growth', name: 'Catena di montaggio',   desc: '+15% crescita dell\'efficienza' },
  { id: 'cost',   name: 'Produzione di massa',   desc: '-8% costo di produzione' },
  { id: 'retain', name: 'Utensili modulari',     desc: '+15% ritenzione dell\'efficienza', req: 'growth' },
  { id: 'output', name: 'Turni straordinari',    desc: '+6% output delle fabbriche', req: 'cap' },
  { id: 'res',    name: 'Materiali sostitutivi', desc: '-25% fabbisogno di risorse', req: 'cost' },
  { id: 'qual',   name: 'Controllo qualità',     desc: '+5% qualità dell\'equipaggiamento', req: 'cost' },
];
const MIO_TRAIT_BY_ID = Object.fromEntries(MIO_TRAITS.map(t => [t.id, t]));
const MIO_NAMES = {
  G: { fanteria: 'Mauser-Werke', supporto: 'Siemens', artiglieria: 'Krupp', carri: 'Henschel', camion: 'Opel' },
  I: { fanteria: 'Beretta', supporto: 'Magneti Marelli', artiglieria: 'Ansaldo', carri: 'Fiat-Ansaldo', camion: 'Fiat' },
  F: { fanteria: 'MAS', supporto: 'Thomson-Houston', artiglieria: 'Schneider', carri: 'Renault', camion: 'Berliet' },
  U: { fanteria: 'Royal Small Arms Factory', supporto: 'Marconi', artiglieria: 'Vickers-Armstrongs', carri: 'Vauxhall', camion: 'Leyland' },
  S: { fanteria: 'Arsenale di Tula', supporto: 'Arsenale di Leningrado', artiglieria: 'Fabbrica n. 92', carri: 'Fabbrica Kirov', camion: 'ZiS' },
};
const MIO_GENERIC = { fanteria: 'Arsenale nazionale', supporto: 'Officine elettromeccaniche', artiglieria: 'Fonderia di Stato', carri: 'Officine corazzate', camion: 'Officine automobilistiche' };

// leggi e dottrine iniziali (1936, come in HOI4)
const ECO_START = {
  G: { econ: 'parziale', trade: 'esport', industry: 'concentrata' },
  I: { econ: 'precoce', trade: 'esport', industry: 'concentrata' },
  S: { econ: 'civile', trade: 'chiusa', industry: 'dispersa' },
  U: { econ: 'civile', trade: 'libero', industry: 'dispersa' },
  F: { econ: 'civile', trade: 'libero', industry: 'dispersa' },
};

// ---------- utilità ----------
function ecoAtWar(c) { return enemiesOf(c.code).length > 0; }
function ecoMod(c, key) {
  if (typeof modOf === 'function') return modOf(c, key) || 0;
  return (c.mods && c.mods[key]) || 0;
}
const ecoYear = () => dayDate(S.day).getUTCFullYear();
const ecoMonth = () => dayDate(S.day).getUTCMonth();
const resObj = () => Object.fromEntries(RES_IDS.map(r => [r, 0]));

const Econ = {
  RESOURCES, RES_IDS, FAMILIES: EQUIP_FAMILIES, MODELS: MODEL_BY_ID, NEEDS: EQUIP_NEEDS,
  TRADE_LAWS, ECON_LAWS, INDUSTRY, BUILDINGS, MIO_TRAITS, CONST: ECO,

  // ---------- estensioni per gli altri sistemi ----------
  registerFamily(id, def) {
    EQUIP_FAMILIES[id] = def;
    for (const m of def.models) { m.fam = id; MODEL_BY_ID[m.id] = m; }
    if (S) for (const k in S.countries) {
      const c = S.countries[k];
      if (c.stock[id] == null) { c.stock[id] = 0; c.qual[id] = 1; }
    }
  },
  registerNeeds(type, needs) { EQUIP_NEEDS[type] = needs; },
  needsOf(type) {
    return EQUIP_NEEDS[type] || { fanteria: (UNIT_TYPES[type] && UNIT_TYPES[type].eq) || 500 };
  },

  // ---------- inizializzazione ----------
  init() {
    S.market = { deals: [], listings: [], contracts: [], nextId: 1, ext: {}, flow: {} };
    this.assignTileResources();
    for (const code in S.countries) this.initCountry(S.countries[code]);
  },

  assignTileResources() {
    // le risorse "home" sono distribuite sui territori del paese: chi li conquista le estrae
    for (const t of S.tiles) if (t.land && !t.res) t.res = null;
    if (S.tiles.some(t => t.res)) return; // la mappa le ha già fornite
    const rng = mulberry32(1939);
    for (const code in RESOURCE_DEFS) {
      const own = S.tiles.filter(t => t.land && t.owner === code);
      if (!own.length) continue;
      for (const [r, amt] of Object.entries(RESOURCE_DEFS[code].home || {})) {
        const n = Math.max(1, Math.min(own.length, Math.ceil(amt / 6)));
        const per = amt / n;
        for (let k = 0; k < n; k++) {
          const t = own[Math.floor(rng() * own.length)];
          t.res = t.res || {};
          t.res[r] = (t.res[r] || 0) + per;
        }
      }
    }
  },

  initCountry(c) {
    const def = COUNTRY_DEFS[c.code] || {};
    const st = ECO_START[c.code] || {};
    c.tradeLaw = st.trade || 'libero';
    c.econLaw = st.econ || 'civile';
    c.industry = st.industry || 'dispersa';
    c.overseas = Object.assign(resObj(), (RESOURCE_DEFS[c.code] || {}).overseas || {});
    c.refineries = 0;
    c.stock = {}; c.qual = {};
    for (const f in EQUIP_FAMILIES) { c.stock[f] = 0; c.qual[f] = 1; }
    const mil = c.mil;
    c.stock.fanteria = mil * 800 + 6000;
    c.stock.artiglieria = mil * 30 + 120;
    c.stock.supporto = mil * 20 + 80;
    c.stock.carri = (def.arm || 0) * 160 + (def.armor ? 40 : 0);
    c.stock.camion = (def.arm || 0) * 160 + mil * 20;
    const oil = ((RESOURCE_DEFS[c.code] || {}).home || {}).petrolio || 0;
    c.fuel = 1500 + (oil + c.overseas.petrolio) * 150;
    // c.equipment resta come alias dell'equipaggiamento di fanteria (compatibilità)
    delete c.equipment;
    Object.defineProperty(c, 'equipment', {
      get() { return this.stock.fanteria; },
      set(v) { this.stock.fanteria = Math.max(0, v); },
      configurable: true, enumerable: false,
    });
    c.lines = [];
    c.lineSeq = 1;
    c.construction = [];
    c.mios = [];
    for (const f in EQUIP_FAMILIES) this.addMio(c, f);
    c.eco = { fuelUse: 0, avail: resObj(), used: resObj(), need: resObj(), exported: resObj(), imported: resObj(), extracted: resObj(), civs: {}, out: {} };
    // linee iniziali: in HOI4 si parte con linee già avviate a efficienza media
    const share = def.armor && def.arm ? { fanteria: 0.5, artiglieria: 0.2, supporto: 0.1, carri: 0.12, camion: 0.08 }
      : { fanteria: 0.6, artiglieria: 0.25, supporto: 0.15 };
    let left = mil;
    const fams = Object.keys(share);
    fams.forEach((f, i) => {
      const n = i === fams.length - 1 ? left : Math.min(left, Math.round(mil * share[f]));
      if (n <= 0) return;
      left -= n;
      const ln = this.addLine(c, f);
      ln.factories = n;
      ln.eff = 0.35;
      ln.mio = c.mios.find(m => m.fam === f).id;
    });
  },

  addMio(c, fam) {
    const nm = (MIO_NAMES[c.code] || {})[fam] || MIO_GENERIC[fam] || ('Consorzio ' + EQUIP_FAMILIES[fam].short);
    const m = { id: c.code + '-' + fam, fam, name: nm, size: 0, funds: 0, points: 0, traits: [] };
    c.mios.push(m);
    return m;
  },

  // ---------- modificatori ----------
  industryLevel(c) {
    if (c.industry === 'none') return 0;
    if (c.industryTech != null) return c.industryTech; // fornito dalla ricerca, se presente
    const y = ecoYear();
    return y < 1938 ? 1 : y < 1940 ? 2 : y < 1942 ? 3 : 4;
  },
  mioOf(c, line) { return line.mio ? c.mios.find(m => m.id === line.mio) : null; },
  mioHas(m, t) { return !!m && m.traits.includes(t); },
  effCap(c, line) {
    const L = this.industryLevel(c);
    let cap = ECO.EFF_CAP + ecoMod(c, 'production_efficiency');
    if (c.industry === 'concentrata') cap += 0.05 * L;
    else if (c.industry === 'dispersa') cap += 0.03 * L;
    if (this.mioHas(this.mioOf(c, line), 'cap')) cap += 0.05;
    return Math.min(1, cap);
  },
  growthBonus(c, line) {
    let g = 0;
    if (c.industry === 'dispersa') g += 0.10 * this.industryLevel(c);
    if (this.mioHas(this.mioOf(c, line), 'growth')) g += 0.15;
    return g;
  },
  retention(c, line) {
    const L = this.industryLevel(c);
    let r = ECO.RETENTION;
    if (c.industry === 'concentrata') r = 0.15;
    else if (c.industry === 'dispersa') r = 0.40 + 0.10 * L;
    r += ecoMod(c, 'efficiency_retention');
    if (this.mioHas(this.mioOf(c, line), 'retain')) r += 0.15;
    return Math.min(0.95, r);
  },
  outputBonus(c, line) {
    const L = this.industryLevel(c);
    let o = TRADE_LAWS[c.tradeLaw].output + (c.eqBonus || 0) + ecoMod(c, 'factory_output');
    if (c.industry === 'concentrata') o += 0.10 * L;
    else if (c.industry === 'dispersa') o += 0.05 * L;
    if (line && this.mioHas(this.mioOf(c, line), 'output')) o += 0.06;
    return o;
  },
  bombingResist(c) { return c.industry === 'dispersa' ? 0.1 * this.industryLevel(c) : 0; },
  researchMod(c) { return TRADE_LAWS[c.tradeLaw].research; },
  constructionMod(c, type) {
    let m = TRADE_LAWS[c.tradeLaw].build + ecoMod(c, 'construction_speed') + (c.constructionBonus || 0);
    if (type === 'mil') m += ECON_LAWS[c.econLaw].milBuild;
    return m;
  },
  manpowerMod(c) { return ECON_LAWS[c.econLaw].mp || 0; },
  qualityMod(owner, type) {
    const c = C(owner);
    if (!c || !c.qual) return 1;
    const n = this.needsOf(type);
    let tot = 0, w = 0;
    for (const f in n) { const k = n[f] * ((EQUIP_FAMILIES[f] && EQUIP_FAMILIES[f].models[0].cost) || 1); tot += k * (c.qual[f] || 1); w += k; }
    return w ? tot / w : 1;
  },
  fuelMod(owner, type) {
    if (type !== 'arm') return 1;
    const c = C(owner);
    return c && c.fuel <= 0 ? 0.5 : 1;
  },

  modelAvailable(c, m) {
    if (EQUIP_FAMILIES[m.fam].armor && !c.armorTech) return false;
    if (c.models && c.models.has && c.models.has(m.id)) return true; // sbloccato dalla ricerca
    if (c.models && c.models.has) return m === EQUIP_FAMILIES[m.fam].models[0] || ecoYear() >= m.year + 1;
    return ecoYear() >= m.year;
  },
  bestModel(c, fam) {
    const ms = EQUIP_FAMILIES[fam].models.filter(m => this.modelAvailable(c, m));
    return ms[ms.length - 1] || null;
  },
  familyAvailable(c, fam) { return !!this.bestModel(c, fam); },

  // ---------- fabbriche civili ----------
  civBreakdown(c) {
    const total = c.civ;
    const cg = Math.round(ECON_LAWS[c.econLaw].cg * (c.civ + c.mil));
    const fl = S.market.flow[c.code] || { civOut: 0, civIn: 0 };
    const avail = Math.max(0, total - cg - fl.civOut + fl.civIn);
    return { total, cg, tradeOut: fl.civOut, tradeIn: fl.civIn, avail, short: total - cg - fl.civOut + fl.civIn < 0 };
  },
  assignedMil(c) { return c.lines.reduce((s, l) => s + l.factories, 0); },

  // ---------- linee di produzione ----------
  addLine(c, fam, modelId) {
    const m = modelId ? MODEL_BY_ID[modelId] : this.bestModel(c, fam);
    if (!m || m.fam !== fam || !this.modelAvailable(c, m)) return null;
    const ln = { id: c.lineSeq++, fam, model: m.id, factories: 0, eff: ECO.EFF_BASE, mio: null, out: 0, resF: 1, short: [] };
    c.lines.push(ln);
    return ln;
  },
  line(c, id) { return c.lines.find(l => l.id === +id); },
  removeLine(c, id) { c.lines = c.lines.filter(l => l.id !== +id); },
  setLineFactories(c, id, n) {
    const ln = this.line(c, id);
    if (!ln) return false;
    const free = c.mil - this.assignedMil(c) + ln.factories;
    n = Math.max(0, Math.min(free, Math.floor(n)));
    if (n > ln.factories) {
      // le fabbriche aggiunte partono dall'efficienza base: la media della linea cala
      ln.eff = (ln.eff * ln.factories + ECO.EFF_BASE * (n - ln.factories)) / n;
    }
    ln.factories = n;
    return true;
  },
  changeModel(c, id, modelId) {
    const ln = this.line(c, id), m = MODEL_BY_ID[modelId];
    if (!ln || !m || m.fam !== ln.fam || m.id === ln.model || !this.modelAvailable(c, m)) return false;
    ln.model = m.id;
    ln.eff = Math.max(ECO.EFF_BASE, ln.eff * this.retention(c, ln));
    return true;
  },
  assignMio(c, id, mioId) {
    const ln = this.line(c, id);
    if (!ln) return false;
    if (!mioId) { ln.mio = null; return true; }
    const m = c.mios.find(x => x.id === mioId);
    if (!m || m.fam !== ln.fam) return false;
    ln.mio = m.id;
    return true;
  },
  moveLine(c, id, dir) {
    const i = c.lines.findIndex(l => l.id === +id), j = i + dir;
    if (i < 0 || j < 0 || j >= c.lines.length) return;
    [c.lines[i], c.lines[j]] = [c.lines[j], c.lines[i]];
  },
  learnTrait(c, mioId, tid) {
    const m = c.mios.find(x => x.id === mioId), t = MIO_TRAIT_BY_ID[tid];
    if (!m || !t || m.points < 1 || m.traits.includes(tid) || (t.req && !m.traits.includes(t.req))) return false;
    m.points--; m.traits.push(tid);
    return true;
  },

  // ---------- equipaggiamento per le divisioni ----------
  canPay(c, type, frac = 1, margin = 1) {
    const n = this.needsOf(type);
    for (const f in n) if ((c.stock[f] || 0) < n[f] * frac * margin) return false;
    return true;
  },
  pay(c, type, frac = 1) {
    const n = this.needsOf(type);
    for (const f in n) c.stock[f] = Math.max(0, (c.stock[f] || 0) - n[f] * frac);
    return true;
  },
  addStock(c, fam, units, q) {
    const s = c.stock[fam] || 0;
    if (units <= 0) return;
    c.qual[fam] = ((c.qual[fam] || 1) * s + q * units) / (s + units);
    c.stock[fam] = s + units;
  },

  // ---------- cantieri ----------
  canBuildType(c, type) {
    const b = BUILDINGS[type];
    return !!b && (!b.year || ecoYear() >= b.year);
  },
  queueBuild(c, type) {
    if (!this.canBuildType(c, type) || !canBuild(c) || c.construction.length >= 12) return false;
    c.construction.push({ type, prog: 0, cost: BUILDINGS[type].cost, civs: 0 });
    return true;
  },

  // ---------- commercio di risorse ----------
  exportPool(code) {
    const c = C(code), ext = S.market.ext[code] || resObj();
    const sh = TRADE_LAWS[c.tradeLaw].export;
    return Object.fromEntries(RES_IDS.map(r => [r, Math.floor(ext[r] * sh)]));
  },
  exportFree(code, r) {
    const used = S.market.deals.filter(d => d.from === code && d.res === r).reduce((s, d) => s + d.amount, 0);
    return Math.max(0, this.exportPool(code)[r] - used);
  },
  tradeAllowed(from, to) {
    if (from === to) return false;
    const a = C(from), b = C(to);
    if (!a || !b || !a.alive || !b.alive || atWar(from, to)) return false;
    if ((a.embargo && a.embargo.includes(to)) || (b.embargo && b.embargo.includes(from))) return false;
    // un paese non vende ai nemici dei suoi alleati di fazione
    if (a.faction && S.factions[a.faction] && S.factions[a.faction].members.some(m => atWar(m, to))) return false;
    if (typeof opinionOf === 'function' && opinionOf(from, to) < -50) return false;
    return true;
  },
  // importer compra `amount` unità/giorno di `res` da exporter, pagando 1 fabbrica civile ogni 8
  proposeImport(importer, exporter, res, amount) {
    amount = Math.floor(amount);
    if (!RESOURCES[res]) return { ok: false, reason: 'Risorsa sconosciuta.' };
    if (amount <= 0) return { ok: false, reason: 'Quantità non valida.' };
    if (!this.tradeAllowed(exporter, importer)) return { ok: false, reason: `${C(exporter).name} non commercia con ${C(importer).name}.` };
    const free = this.exportFree(exporter, res);
    if (free <= 0) return { ok: false, reason: `${C(exporter).name} non ha ${RESOURCES[res].name.toLowerCase()} in vendita.` };
    amount = Math.min(amount, free);
    const civs = Math.ceil(amount / ECO.RES_PER_CIV);
    const cb = this.civBreakdown(C(importer));
    if (cb.avail < civs) return { ok: false, reason: `Servono ${civs} fabbriche civili libere, ne hai ${cb.avail}.` };
    const ex = S.market.deals.find(d => d.from === exporter && d.to === importer && d.res === res);
    if (ex) ex.amount += amount;
    else S.market.deals.push({ id: S.market.nextId++, from: exporter, to: importer, res, amount, since: S.day });
    this.computeFlows();
    if (involvesPlayer(importer, exporter) && (importer === S.player || exporter === S.player))
      log(`Accordo commerciale: ${C(importer).name} importa ${amount} ${RESOURCES[res].name.toLowerCase()} da ${C(exporter).name}.`, 'good');
    return { ok: true, amount, civs };
  },
  cancelDeal(id, why) {
    const d = S.market.deals.find(x => x.id === +id);
    if (!d) return false;
    S.market.deals = S.market.deals.filter(x => x !== d);
    if (d.from === S.player || d.to === S.player)
      log(`Accordo annullato: ${RESOURCES[d.res].name} da ${C(d.from).name} a ${C(d.to).name}${why ? ' (' + why + ')' : ''}.`, 'warn');
    this.computeFlows();
    return true;
  },
  setEmbargo(by, target, on) {
    const c = C(by);
    c.embargo = (c.embargo || []).filter(x => x !== target);
    if (on) c.embargo.push(target);
  },

  // ---------- mercato internazionale dell'equipaggiamento ----------
  unitPrice(fam) { return EQUIP_FAMILIES[fam].models[0].cost; },
  listingPrice(fam, qty) {
    // fabbriche civili pagate per 30 giorni: circa il valore industriale dell'equipaggiamento
    return Math.max(1, Math.ceil(qty * this.unitPrice(fam) / (30 * ECO.IC_PER_FACTORY * 0.5)));
  },
  listEquipment(seller, fam, qty) {
    const c = C(seller);
    qty = Math.floor(qty);
    if (!EQUIP_FAMILIES[fam] || qty <= 0) return { ok: false, reason: 'Offerta non valida.' };
    const listed = S.market.listings.filter(l => l.seller === seller && l.fam === fam).reduce((s, l) => s + l.qty, 0);
    if ((c.stock[fam] || 0) - listed < qty) return { ok: false, reason: 'Equipaggiamento insufficiente in magazzino.' };
    const l = { id: S.market.nextId++, seller, fam, qty, civs: this.listingPrice(fam, qty), q: c.qual[fam] || 1, day: S.day };
    S.market.listings.push(l);
    if (seller === S.player) log(`Messi in vendita ${fmt(qty)} ${EQUIP_FAMILIES[fam].short.toLowerCase()} sul mercato internazionale.`);
    return { ok: true, listing: l };
  },
  cancelListing(id) { S.market.listings = S.market.listings.filter(l => l.id !== +id); },
  buyListing(buyer, id) {
    const l = S.market.listings.find(x => x.id === +id);
    if (!l) return { ok: false, reason: 'Offerta non più disponibile.' };
    if (l.seller === buyer) return { ok: false, reason: 'Non puoi comprare la tua offerta.' };
    if (!this.tradeAllowed(l.seller, buyer)) return { ok: false, reason: `${C(l.seller).name} non vende a ${C(buyer).name}.` };
    if (this.civBreakdown(C(buyer)).avail < l.civs) return { ok: false, reason: `Servono ${l.civs} fabbriche civili libere.` };
    S.market.listings = S.market.listings.filter(x => x !== l);
    S.market.contracts.push({ id: S.market.nextId++, seller: l.seller, buyer, fam: l.fam, left: l.qty, rate: l.qty / 30, civs: l.civs, q: l.q });
    this.computeFlows();
    if (buyer === S.player || l.seller === S.player)
      log(`${C(buyer).name} compra ${fmt(l.qty)} ${EQUIP_FAMILIES[l.fam].short.toLowerCase()} da ${C(l.seller).name} (${l.civs} fabbriche civili per 30 giorni).`, 'good');
    return { ok: true };
  },

  // ---------- leggi ----------
  setTradeLaw(c, id, free) {
    if (!TRADE_LAWS[id] || c.tradeLaw === id) return { ok: false, reason: 'Legge già in vigore o sconosciuta.' };
    if (!free && c.pp < LAW_COST.trade) return { ok: false, reason: `Servono ${LAW_COST.trade} di potere politico.` };
    if (!free) c.pp -= LAW_COST.trade;
    c.tradeLaw = id;
    if (c.code === S.player) log(`Nuova legge commerciale: ${TRADE_LAWS[id].name}.`, 'good');
    return { ok: true };
  },
  econLawAvailable(c, id) { const l = ECON_LAWS[id]; return !!l && (!l.req || l.req(c)); },
  setEconLaw(c, id, free) {
    if (!ECON_LAWS[id] || c.econLaw === id) return { ok: false, reason: 'Legge già in vigore o sconosciuta.' };
    if (!this.econLawAvailable(c, id)) return { ok: false, reason: `${ECON_LAWS[id].name}: ${ECON_LAWS[id].desc}` };
    if (!free && c.pp < LAW_COST.econ) return { ok: false, reason: `Servono ${LAW_COST.econ} di potere politico.` };
    if (!free) c.pp -= LAW_COST.econ;
    c.econLaw = id;
    if (c.code === S.player) log(`Nuova legge economica: ${ECON_LAWS[id].name}.`, 'good');
    return { ok: true };
  },
  setIndustry(c, id, free) {
    if (!INDUSTRY[id] || id === 'none' || c.industry === id) return { ok: false, reason: 'Dottrina già scelta o sconosciuta.' };
    if (!free && c.pp < LAW_COST.industry) return { ok: false, reason: `Servono ${LAW_COST.industry} di potere politico.` };
    if (!free) c.pp -= LAW_COST.industry;
    c.industry = id;
    // riconvertire l'industria costa: tutte le linee perdono metà dell'efficienza
    for (const l of c.lines) l.eff = Math.max(ECO.EFF_BASE, l.eff * 0.5);
    if (c.code === S.player) log(`Dottrina industriale: ${INDUSTRY[id].name}. Le linee perdono metà dell'efficienza durante la riconversione.`, 'warn');
    return { ok: true };
  },

  // ---------- simulazione giornaliera ----------
  computeFlows() {
    const flow = {};
    const F = code => flow[code] || (flow[code] = { civOut: 0, civIn: 0, imp: resObj(), exp: resObj() });
    for (const d of S.market.deals) {
      const civs = Math.ceil(d.amount / ECO.RES_PER_CIV);
      F(d.to).civOut += civs; F(d.from).civIn += civs;
      F(d.to).imp[d.res] += d.amount; F(d.from).exp[d.res] += d.amount;
    }
    for (const k of S.market.contracts) { F(k.buyer).civOut += k.civs; F(k.seller).civIn += k.civs; }
    S.market.flow = flow;
  },

  worldDaily() {
    const m = S.market;
    // estrazione dai territori controllati
    const ext = {};
    for (const code in S.countries) {
      const c = S.countries[code];
      if (!c.alive) continue;
      const gain = 1 + ecoMod(c, 'resource_gain');
      ext[code] = Object.fromEntries(RES_IDS.map(r => [r, (c.overseas[r] || 0) * gain]));
      ext[code].petrolio += c.refineries * BUILDINGS.ref.oil;
    }
    for (const t of S.tiles) {
      if (!t.res || !t.land || !ext[t.ctrl]) continue;
      const f = (t.ctrl === t.owner ? 1 : ECO.OCCUPIED_RES) * (1 + ecoMod(C(t.ctrl), 'resource_gain'));
      for (const r in t.res) ext[t.ctrl][r] += t.res[r] * f;
    }
    for (const code in ext) for (const r of RES_IDS) ext[code][r] = Math.floor(ext[code][r]);
    m.ext = ext;

    // accordi non più validi (guerra, embargo, paese scomparso, risorse perse)
    for (const d of [...m.deals]) {
      if (!this.tradeAllowed(d.from, d.to)) { this.cancelDeal(d.id, 'rapporti interrotti'); continue; }
    }
    for (const code in ext) {
      for (const r of RES_IDS) {
        const pool = this.exportPool(code)[r];
        let used = 0;
        for (const d of m.deals.filter(d => d.from === code && d.res === r)) {
          if (used + d.amount > pool) {
            const rest = pool - used;
            if (rest <= 0) { this.cancelDeal(d.id, 'risorse esaurite'); continue; }
            d.amount = rest;
          }
          used += d.amount;
        }
      }
    }
    m.listings = m.listings.filter(l => C(l.seller).alive && S.day - l.day < 180);
    // consegne del mercato internazionale
    for (const k of [...m.contracts]) {
      const s = C(k.seller), b = C(k.buyer);
      if (!s.alive || !b.alive || !this.tradeAllowed(k.seller, k.buyer)) { m.contracts = m.contracts.filter(x => x !== k); continue; }
      const q = Math.min(k.left, k.rate, s.stock[k.fam] || 0);
      s.stock[k.fam] -= q;
      this.addStock(b, k.fam, q, k.q);
      k.left -= q;
      if (k.left <= 0.01 || (s.stock[k.fam] || 0) <= 0) m.contracts = m.contracts.filter(x => x !== k);
    }
    this.computeFlows();

    // consumo di carburante dei corazzati
    for (const code in ext) S.countries[code].eco.fuelUse = 0;
    for (const d of S.divs) {
      if (d.dead || d.type !== 'arm') continue;
      const c = C(d.owner), use = d.combat || d.path.length ? 8 : 1;
      c.fuel = Math.max(0, c.fuel - use);
      c.eco.fuelUse += use;
    }
  },

  daily(c) {
    const isP = c.code === S.player;
    const e = c.eco;
    const ext = S.market.ext[c.code] || resObj();
    const fl = S.market.flow[c.code] || { imp: resObj(), exp: resObj(), civOut: 0, civIn: 0 };
    const pool = this.exportPool(c.code);
    for (const r of RES_IDS) {
      e.extracted[r] = ext[r];
      e.exported[r] = pool[r];           // in HOI4 la quota va al mercato anche se nessuno compra
      e.imported[r] = fl.imp[r];
      e.avail[r] = ext[r] - pool[r] + fl.imp[r];
      e.used[r] = 0; e.need[r] = 0;
    }
    // il petrolio non usato dalle linee diventa carburante: conta come fabbisogno se le scorte calano
    if (c.fuel < ECO.FUEL_CAP * 0.5) e.need.petrolio += Math.ceil((e.fuelUse || 0) * 1.5 / ECO.FUEL_PER_OIL);
    // se le fabbriche civili non bastano a pagare le importazioni, cade l'ultimo accordo
    if (this.civBreakdown(c).short) {
      const mine = S.market.deals.filter(d => d.to === c.code);
      if (mine.length) this.cancelDeal(mine[mine.length - 1].id, 'fabbriche civili insufficienti');
    }

    // produzione: le linee in cima hanno la priorità sulle risorse
    let assigned = 0;
    for (const ln of c.lines) {
      if (assigned + ln.factories > c.mil) ln.factories = Math.max(0, c.mil - assigned); // fabbriche perse
      assigned += ln.factories;
      const m = MODEL_BY_ID[ln.model], mio = this.mioOf(c, ln);
      ln.short = [];
      if (!ln.factories) { ln.out = 0; ln.resF = 1; continue; }
      const resMul = this.mioHas(mio, 'res') ? 0.75 : 1;
      let ratio = 1;
      for (const r in m.res) {
        const need = Math.ceil(m.res[r] * ln.factories * resMul);
        const got = Math.min(need, Math.max(0, e.avail[r] - e.used[r]));
        e.need[r] += need; e.used[r] += got;
        if (got < need) { ln.short.push(r); ratio = Math.min(ratio, got / need); }
      }
      ln.resF = 0.25 + 0.75 * ratio; // senza risorse si produce solo una frazione
      const ic = ln.factories * ECO.IC_PER_FACTORY * ln.eff * (1 + this.outputBonus(c, ln)) * ln.resF;
      const cost = m.cost * (this.mioHas(mio, 'cost') ? 0.92 : 1);
      ln.out = ic / cost;
      this.addStock(c, ln.fam, ln.out, m.q * (this.mioHas(mio, 'qual') ? 1.05 : 1));
      // crescita dell'efficienza: veloce all'inizio, lenta vicino al cap
      const cap = this.effCap(c, ln);
      if (ln.eff < cap) ln.eff = Math.min(cap, ln.eff + ECO.EFF_GROWTH_K * ECO.EFF_BASE / (ln.eff * 10) * (1 + this.growthBonus(c, ln)));
      else ln.eff = cap;
      if (mio) mio.funds += ln.factories * ln.eff;
    }
    for (const mio of c.mios) {
      const need = 400 * (mio.size + 1);
      if (mio.funds >= need) {
        mio.funds -= need; mio.size++; mio.points++;
        if (isP) log(`${mio.name} cresce al livello ${mio.size}: nuovo tratto disponibile.`, 'good');
      }
    }

    // carburante dal petrolio rimasto (le linee non lo usano)
    c.fuel = Math.min(ECO.FUEL_CAP, c.fuel + Math.max(0, e.avail.petrolio - e.used.petrolio) * ECO.FUEL_PER_OIL);

    // cantieri: ogni progetto usa al massimo 15 fabbriche civili
    let civs = this.civBreakdown(c).avail;
    for (let i = 0; i < c.construction.length; i++) {
      const j = c.construction[i];
      j.civs = Math.min(ECO.CIVS_PER_PROJECT, civs);
      civs -= j.civs;
      j.prog += j.civs * ECO.CP_PER_CIV * Math.max(0.1, 1 + this.constructionMod(c, j.type));
    }
    for (let i = c.construction.length - 1; i >= 0; i--) {
      const j = c.construction[i];
      if (j.prog < j.cost) continue;
      c.construction.splice(i, 1);
      if (typeof landBuildDone === 'function' && landBuildDone(c, j)) continue; // ferrovie, hub (guerra terrestre)
      if (!BUILDINGS[j.type]) continue;
      if (j.type === 'ref') c.refineries++;
      else c[j.type]++;
      if (isP) log(`Completata: ${BUILDINGS[j.type].name.toLowerCase()}.`, 'good');
    }
    e.civs = this.civBreakdown(c);
  },

  // ---------- IA ----------
  aiThink(c) {
    const war = ecoAtWar(c);
    // leggi
    if ((S.day + c.slot) % 30 === 0) {
      const order = ['civile', 'precoce', 'parziale', 'guerra', 'totale'];
      const want = war ? (c.major ? 'totale' : 'guerra') : (c.aggro >= 0.5 ? 'guerra' : S.day > 1000 ? 'parziale' : 'precoce');
      const cur = order.indexOf(c.econLaw);
      for (let i = order.indexOf(want); i > cur; i--) {
        if (this.econLawAvailable(c, order[i]) && c.pp >= LAW_COST.econ + 20) { this.setEconLaw(c, order[i]); break; }
      }
      const tl = this.aiTradeLaw(c);
      if (c.tradeLaw !== tl && c.pp >= LAW_COST.trade + 40) this.setTradeLaw(c, tl);
    }
    this.aiLines(c, war);
    if ((S.day + c.slot) % 15 === 0) this.aiTrade(c);
    if ((S.day + c.slot) % 20 === 0) this.aiMarket(c, war);
    for (const m of c.mios) {
      while (m.points > 0) {
        const t = MIO_TRAITS.find(t => !m.traits.includes(t.id) && (!t.req || m.traits.includes(t.req)));
        if (!t || !this.learnTrait(c, m.id, t.id)) break;
      }
    }
    this.aiBuild(c, war);
  },

  // la legge più aperta i cui ammanchi di risorse si possono coprire importando
  aiTradeLaw(c) {
    if (c.code === 'S') return 'chiusa';
    const e = c.eco, cb = this.civBreakdown(c);
    const capacity = Math.max(0, cb.total - cb.cg) * 0.35 * ECO.RES_PER_CIV;
    for (const id of ['libero', 'esport', 'limitata']) {
      const sh = TRADE_LAWS[id].export;
      let gap = 0;
      for (const r of RES_IDS) gap += Math.max(0, e.need[r] - Math.floor(e.extracted[r] * (1 - sh)));
      if (gap <= capacity) return id;
    }
    return 'chiusa';
  },

  aiLines(c, war) {
    let free = c.mil - this.assignedMil(c);
    const target = c.armorTech ? { fanteria: 0.45, artiglieria: 0.2, supporto: 0.1, carri: 0.15, camion: 0.1 }
      : { fanteria: 0.55, artiglieria: 0.25, supporto: 0.12, camion: 0.08 };
    while (free > 0) {
      let best = null, bd = -Infinity;
      for (const f in target) {
        if (!this.familyAvailable(c, f)) continue;
        const have = c.lines.filter(l => l.fam === f).reduce((s, l) => s + l.factories, 0);
        const d = target[f] * c.mil - have;
        if (d > bd) { bd = d; best = f; }
      }
      if (!best) break;
      let ln = c.lines.find(l => l.fam === best);
      if (!ln) { ln = this.addLine(c, best); if (!ln) break; ln.mio = (c.mios.find(m => m.fam === best) || {}).id || null; }
      this.setLineFactories(c, ln.id, ln.factories + 1);
      free--;
    }
    // cambio modello solo d'inverno o in pace, a efficienza ormai alta
    const winter = [10, 11, 0, 1].includes(ecoMonth());
    if ((S.day + c.slot) % 10 !== 0 || (war && !winter)) return;
    for (const ln of c.lines) {
      const bm = this.bestModel(c, ln.fam);
      if (bm && bm.id !== ln.model && ln.eff >= this.effCap(c, ln) * 0.8) this.changeModel(c, ln.id, bm.id);
    }
  },

  aiTrade(c) {
    const e = c.eco;
    for (const r of RES_IDS) {
      let deficit = e.need[r] - e.avail[r];
      if (deficit <= 0) {
        // troppa roba importata: libera fabbriche civili
        const surplus = e.avail[r] - e.need[r];
        const d = S.market.deals.find(d => d.to === c.code && d.res === r);
        if (d && surplus >= Math.min(d.amount, ECO.RES_PER_CIV)) this.cancelDeal(d.id);
        continue;
      }
      const sellers = Object.keys(S.countries)
        .filter(k => this.tradeAllowed(k, c.code) && this.exportFree(k, r) > 0)
        .sort((a, b) => (allied(b, c.code) - allied(a, c.code)) || (this.exportFree(b, r) - this.exportFree(a, r)));
      for (const k of sellers) {
        if (deficit <= 0) break;
        const cb = this.civBreakdown(c);
        if (cb.avail < 3) return; // tiene qualche fabbrica per i cantieri
        const amt = Math.min(deficit, this.exportFree(k, r), (cb.avail - 2) * ECO.RES_PER_CIV);
        if (amt <= 0) break;
        const res = this.proposeImport(c.code, k, r, amt);
        if (res.ok) deficit -= res.amount;
      }
    }
  },

  aiMarket(c, war) {
    const divs = S.divs.filter(d => d.owner === c.code && !d.dead).length;
    if (!war) {
      // vende il surplus di fanteria se ha molto più del necessario
      const reserve = 3000 + divs * 300;
      const listed = S.market.listings.some(l => l.seller === c.code);
      if (!listed && c.stock.fanteria > reserve * 2 && Math.random() < 0.3) this.listEquipment(c.code, 'fanteria', Math.floor((c.stock.fanteria - reserve) * 0.3));
      return;
    }
    // in guerra compra ciò che manca per schierare nuove divisioni
    const n = this.needsOf('inf');
    for (const f in n) {
      if ((c.stock[f] || 0) >= n[f] * 3) continue;
      const l = S.market.listings.find(l => l.fam === f && this.tradeAllowed(l.seller, c.code));
      if (l && this.civBreakdown(c).avail >= l.civs + 2) { this.buyListing(c.code, l.id); break; }
    }
  },

  aiBuild(c, war) {
    const tense = war || S.day > 730;
    for (let k = 0; k < 3; k++) {
      const used = c.construction.length * ECO.CIVS_PER_PROJECT;
      if (used >= this.civBreakdown(c).avail || !canBuild(c)) break;
      let type = Math.random() < (tense ? 0.75 : 0.35) ? 'mil' : 'civ';
      if (this.canBuildType(c, 'ref') && c.eco.avail.petrolio < 10 && c.refineries < 4 && c.major && Math.random() < 0.15) type = 'ref';
      if (!this.queueBuild(c, type)) break;
    }
  },

  // ---------- testo e azioni ----------
  tileTip(t) {
    if (!t.res) return '';
    const s = RES_IDS.filter(r => t.res[r]).map(r => `${RESOURCES[r].icon} ${Math.round(t.res[r])}`).join(' ');
    return s ? `<br>Risorse: ${s}` : '';
  },
  summary(code) {
    const c = C(code), e = c.eco, cb = this.civBreakdown(c);
    const res = RES_IDS.map(r => `${RESOURCES[r].name}: estratto ${e.extracted[r]}, esportato ${e.exported[r]}, importato ${e.imported[r]}, disponibile ${e.avail[r]}, fabbisogno ${e.need[r]}`).join('; ');
    const lines = c.lines.map(l => `linea #${l.id} ${MODEL_BY_ID[l.model].name}: ${l.factories} fabbriche, efficienza ${Math.round(l.eff * 100)}%/${Math.round(this.effCap(c, l) * 100)}%${l.short.length ? ', manca ' + l.short.join(', ') : ''}`).join('; ');
    const deals = S.market.deals.filter(d => d.to === code || d.from === code)
      .map(d => `#${d.id} ${d.amount} ${d.res} da ${C(d.from).name} a ${C(d.to).name}`).join('; ') || 'nessuno';
    const stock = Object.keys(c.stock).map(f => `${f} ${Math.floor(c.stock[f])}`).join(', ');
    return `Economia di ${c.name}. Legge economica: ${ECON_LAWS[c.econLaw].name}. Legge commerciale: ${TRADE_LAWS[c.tradeLaw].name}. ` +
      `Industria: ${INDUSTRY[c.industry].name}. Fabbriche: ${c.civ} civili (${cb.cg} ai beni di consumo, ${cb.tradeOut} al commercio, +${cb.tradeIn} dal commercio, ${cb.avail} libere), ` +
      `${c.mil} militari (${c.mil - this.assignedMil(c)} non assegnate), ${c.refineries} raffinerie. Carburante ${Math.floor(c.fuel)}. ` +
      `Risorse: ${res}. Linee: ${lines || 'nessuna'}. Accordi: ${deals}. Magazzino: ${stock}. Cantieri: ${c.construction.map(j => BUILDINGS[j.type].name).join(', ') || 'nessuno'}.`;
  },

  registerActions() {
    if (typeof GameActions === 'undefined' || !GameActions.register) return;
    const P = () => C(S.player);
    const ok = (r, msg) => { if (r && r.ok === false) throw new Error(r.reason); if (r === false) throw new Error('Azione non possibile.'); UI.dirty = true; return msg; };
    const code = name => {
      if (S.countries[name]) return name;
      const k = Object.keys(S.countries).find(k => S.countries[k].name.toLowerCase() === String(name).toLowerCase());
      if (!k) throw new Error(`Paese sconosciuto: ${name}`);
      return k;
    };
    const reg = (name, description, props, run, required) => GameActions.register({
      name, description, input_schema: { type: 'object', properties: props, required: required || Object.keys(props) }, run,
    });
    const str = (d, e) => e ? { type: 'string', description: d, enum: e } : { type: 'string', description: d };
    const num = d => ({ type: 'number', description: d });
    reg('economia_stato', "Restituisce lo stato dell'economia del giocatore (risorse, linee, accordi, leggi).", {}, () => this.summary(S.player));
    reg('legge_commerciale', 'Cambia la legge commerciale (costa potere politico). chiusa=0% export, limitata=25%, esport=50%, libero=80% con bonus a ricerca, costruzione e output.',
      { legge: str('Legge', Object.keys(TRADE_LAWS)) }, i => ok(this.setTradeLaw(P(), i.legge), `Legge commerciale: ${TRADE_LAWS[i.legge].name}.`));
    reg('legge_economica', 'Cambia la legge economica (beni di consumo e velocità di costruzione militare).',
      { legge: str('Legge', Object.keys(ECON_LAWS)) }, i => ok(this.setEconLaw(P(), i.legge), `Legge economica: ${ECON_LAWS[i.legge].name}.`));
    reg('dottrina_industriale', 'Sceglie industria concentrata o dispersa.',
      { dottrina: str('Dottrina', ['concentrata', 'dispersa']) }, i => ok(this.setIndustry(P(), i.dottrina), `Dottrina: ${INDUSTRY[i.dottrina].name}.`));
    reg('importa_risorsa', 'Crea un accordo per importare una risorsa da un altro paese, pagando 1 fabbrica civile ogni 8 unità al giorno.',
      { paese: str('Paese esportatore (nome o codice)'), risorsa: str('Risorsa', RES_IDS), quantita: num('Unità al giorno') },
      i => { const r = this.proposeImport(S.player, code(i.paese), i.risorsa, i.quantita); ok(r); return `Importi ${r.amount} ${i.risorsa} al giorno per ${r.civs} fabbriche civili.`; });
    reg('annulla_accordo', 'Annulla un accordo commerciale di risorse per id (vedi economia_stato).',
      { id: num('Id accordo') }, i => {
        const d = S.market.deals.find(d => d.id === +i.id);
        if (!d || (d.to !== S.player && d.from !== S.player)) throw new Error('Accordo non trovato.');
        return ok(this.cancelDeal(i.id), 'Accordo annullato.');
      });
    reg('embargo', 'Attiva o toglie un embargo commerciale verso un paese.',
      { paese: str('Paese'), attivo: { type: 'boolean' } }, i => { this.setEmbargo(S.player, code(i.paese), !!i.attivo); return 'Fatto.'; });
    reg('costruisci', 'Mette in coda nei cantieri una fabbrica civile, militare o una raffineria.',
      { edificio: str('Tipo', Object.keys(BUILDINGS)), quantita: num('Quante (default 1)') },
      i => { let n = 0; for (let k = 0; k < Math.max(1, i.quantita || 1); k++) if (this.queueBuild(P(), i.edificio)) n++; if (!n) throw new Error('Nessuno slot o coda piena.'); UI.dirty = true; return `${n} in costruzione.`; }, ['edificio']);
    reg('linea_produzione', 'Crea una linea di produzione per una famiglia di equipaggiamento con N fabbriche militari.',
      { famiglia: str('Famiglia', Object.keys(EQUIP_FAMILIES)), fabbriche: num('Fabbriche') },
      i => { const ln = this.addLine(P(), i.famiglia); if (!ln) throw new Error('Famiglia non disponibile.'); this.setLineFactories(P(), ln.id, i.fabbriche); UI.dirty = true; return `Linea #${ln.id} creata con ${ln.factories} fabbriche.`; });
    reg('fabbriche_linea', 'Imposta il numero di fabbriche militari su una linea.',
      { linea: num('Id linea'), fabbriche: num('Fabbriche') }, i => ok(this.setLineFactories(P(), i.linea, i.fabbriche), 'Fatto.'));
    reg('modello_linea', "Cambia il modello prodotto da una linea (perde parte dell'efficienza).",
      { linea: num('Id linea'), modello: str('Id modello', Object.keys(MODEL_BY_ID)) }, i => ok(this.changeModel(P(), i.linea, i.modello), 'Modello cambiato.'));
    reg('vendi_equipaggiamento', 'Mette in vendita equipaggiamento sul mercato internazionale.',
      { famiglia: str('Famiglia', Object.keys(EQUIP_FAMILIES)), quantita: num('Pezzi') }, i => ok(this.listEquipment(S.player, i.famiglia, i.quantita), 'Offerta pubblicata.'));
    reg('compra_equipaggiamento', 'Compra un\'offerta del mercato internazionale per id.',
      { id: num('Id offerta') }, i => ok(this.buyListing(S.player, i.id), 'Acquisto concluso.'));
  },
};

document.addEventListener('DOMContentLoaded', () => Econ.registerActions());
