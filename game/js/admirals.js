'use strict';
// Ammiragli (come in HOI4): comandano le flotte con Attacco, Difesa, Manovra e Coordinamento.
// Nessun limite rigido di navi, ma oltre la capacità di comando il posizionamento in battaglia peggiora.
// Si aggancia a naval.js avvolgendo AN.naval (step, battleDay, applyDamage), senza modificarlo.

// [nome, attacco, difesa, manovra, coordinamento, tratti]
const ADMIRALS = {
  G: [['Erich Raeder', 3, 3, 2, 3, []], ['Karl Dönitz', 4, 2, 3, 4, ['sommergibili']], ['Günther Lütjens', 3, 2, 3, 2, ['aggressivo']]],
  U: [['Andrew Cunningham', 5, 3, 4, 4, ['aggressivo']], ['Dudley Pound', 2, 4, 3, 3, ['difensivo']], ['John Tovey', 4, 3, 3, 3, []], ['James Somerville', 3, 3, 3, 3, []]],
  F: [['François Darlan', 3, 3, 3, 3, []], ['Jean de Laborde', 2, 3, 2, 2, ['difensivo']], ['Marcel Gensoul', 2, 2, 3, 2, []]],
  I: [['Inigo Campioni', 2, 3, 2, 2, ['difensivo']], ['Angelo Iachino', 3, 2, 3, 2, []], ['Carlo Bergamini', 3, 3, 2, 3, []]],
  S: [['Nikolaj Kuznecov', 3, 3, 2, 3, []], ['Ivan Isakov', 2, 3, 2, 2, []]],
  USA: [['Chester Nimitz', 4, 4, 4, 5, []], ['William Halsey', 5, 2, 4, 3, ['aggressivo']], ['Raymond Spruance', 4, 3, 4, 4, []]],
  JAP: [['Isoroku Yamamoto', 5, 3, 4, 4, ['aggressivo']], ['Chūichi Nagumo', 3, 3, 3, 3, []], ['Takeo Kurita', 3, 2, 4, 2, []]],
};
const ADMIRAL_TRAITS = {
  aggressivo: { name: 'Aggressivo', desc: '+10% danni inflitti' },
  difensivo: { name: 'Prudente', desc: '-10% danni subiti' },
  sommergibili: { name: 'Lupo dei mari', desc: '+25% danni inflitti dai sottomarini della flotta' },
  manovra: { name: 'Maestro di manovra', desc: '+1 Manovra effettiva' },
};
const ADMIRAL_COST = 20; // potere di comando per un nuovo ammiraglio
const GENERIC_ADMIRAL_NAMES = ['Ammiraglio Vespucci', 'Ammiraglio Nordahl', 'Ammiraglio Hartmann', 'Ammiraglio Moreau', 'Ammiraglio Grant', 'Ammiraglio Ivanov', 'Ammiraglio Ruiz', 'Ammiraglio Kato'];

function addAdmiral(c, name, atk, def, man, coord, traits) {
  const a = { id: c.nextAdmId++, name, atk, def, man, coord, traits: traits.slice(), xp: 0, level: Math.round((atk + def + man + coord) / 4) };
  c.admirals.push(a);
  return a;
}
function initAdmirals(c) {
  c.admirals = []; c.nextAdmId = 1;
  for (const [nm, a, d, m, co, tr] of ADMIRALS[c.code] || []) addAdmiral(c, nm, a, d, m, co, tr);
  const want = (c.ports || []).length ? (c.major ? 2 : 1) : 0;
  const rng = mulberry32(c.code.charCodeAt(0) * 131 + 7);
  while (c.admirals.length < want) addAdmiral(c, GENERIC_ADMIRAL_NAMES[Math.floor(rng() * GENERIC_ADMIRAL_NAMES.length)], 1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 3), []);
}
const admById = (c, id) => (c.admirals || []).find(a => a.id === id) || null;
// capacità di comando: navi che l'ammiraglio posiziona senza penalità
const admCapacity = a => 15 + 3 * a.level;
function fleetAdmiral(f) { return f.admiral != null ? admById(C(f.owner), f.admiral) : null; }
function assignAdmiral(c, fid, aid) {
  const f = S.an.fleets.find(x => x.id === fid && x.owner === c.code);
  if (!f) return;
  for (const g of S.an.fleets) if (g.owner === c.code && g.admiral === aid) g.admiral = null;
  f.admiral = aid;
}
function recruitAdmiral(c) {
  if (c.cp < ADMIRAL_COST) return false;
  c.cp -= ADMIRAL_COST;
  const r = Math.random;
  addAdmiral(c, GENERIC_ADMIRAL_NAMES[Math.floor(r() * GENERIC_ADMIRAL_NAMES.length)], 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3), []);
  return true;
}
// efficienza di posizionamento (1 = perfetta) e modificatori della flotta
function fleetCommand(f) {
  const a = fleetAdmiral(f);
  if (!a) return { atk: 1, def: 1, pos: 1, sub: 1 };
  const pos = f.ships.length > admCapacity(a) ? Math.max(0.5, admCapacity(a) / f.ships.length) : 1;
  const man = a.man + (a.traits.includes('manovra') ? 1 : 0);
  return {
    pos,
    atk: (1 + 0.04 * a.atk + 0.03 * a.coord + (a.traits.includes('aggressivo') ? 0.1 : 0)) * (0.5 + 0.5 * pos),
    def: (1 + 0.04 * a.def + 0.03 * man) * (a.traits.includes('difensivo') ? 1.1 : 1) / (1 + 0.5 * (1 - pos)),
    sub: a.traits.includes('sommergibili') ? 1.25 : 1,
  };
}
// media dei modificatori di uno schieramento, pesata per numero di navi
function sideCommand(bt, side) {
  let n = 0, atk = 0, def = 0, sub = 0;
  for (const f of AN.naval.sideFleets(bt, side)) {
    const m = fleetCommand(f), w = f.ships.length;
    const subs = f.ships.filter(isSub).length / Math.max(1, w);
    n += w; atk += m.atk * w * (1 + (m.sub - 1) * subs); def += m.def * w;
  }
  return n ? { atk: atk / n, def: def / n } : { atk: 1, def: 1 };
}
function admiralGainXP(c, a, v) {
  a.xp += v;
  const need = 60 * a.level;
  if (a.xp < need || a.level >= 9) return;
  a.xp -= need; a.level++;
  const k = ['atk', 'def', 'man', 'coord'][Math.floor(Math.random() * 4)];
  a[k] = Math.min(9, a[k] + 1);
  if (c.code === S.player) log(`${a.name} sale al livello ${a.level}.`, 'good');
}
// ogni giorno: ammiragli liberi alle flotte senza comandante (IA, e flotte nuove del giocatore se lo vuole)
function admiralsDaily() {
  for (const code in S.countries) {
    const c = S.countries[code];
    if (!c.alive) continue;
    if (!c.admirals) initAdmirals(c);
    if (code === S.player && c.admAuto === false) continue;
    const fleets = S.an.fleets.filter(f => f.owner === code && !f.dead && f.ships.length);
    for (const f of fleets) if (f.admiral != null && !admById(c, f.admiral)) f.admiral = null;
    const free = c.admirals.filter(a => !fleets.some(f => f.admiral === a.id)).sort((x, y) => y.level - x.level);
    for (const f of fleets.filter(f => f.admiral == null && !f.reserve).sort((x, y) => y.ships.length - x.ships.length)) {
      if (!free.length) break;
      const sub = f.ships.every(isSub), i = free.findIndex(x => x.traits.includes('sommergibili') === sub);
      const a = free.splice(i >= 0 ? i : 0, 1)[0];
      f.admiral = a.id;
    }
  }
}

(function hookNaval() {
  if (typeof AN === 'undefined' || !AN.naval) return;
  const N = AN.naval, step = N.step, battleDay = N.battleDay, applyDamage = N.applyDamage;
  N.step = function () { admiralsDaily(); return step.apply(this, arguments); };
  // i danni subiti da `side` vengono da chi spara (l'altro schieramento)
  N.applyDamage = function (bt, side, dmg) {
    const me = sideCommand(bt, side), foe = sideCommand(bt, side === 'a' ? 'b' : 'a'), k = foe.atk / me.def;
    if (k !== 1) for (const [s, d] of dmg) dmg.set(s, d * k);
    return applyDamage.call(this, bt, side, dmg);
  };
  N.battleDay = function (bt) {
    const r = battleDay.apply(this, arguments);
    for (const side of ['a', 'b']) for (const f of this.sideFleets(bt, side)) {
      const a = fleetAdmiral(f);
      if (a) admiralGainXP(C(f.owner), a, 4);
    }
    return r;
  };
})();
