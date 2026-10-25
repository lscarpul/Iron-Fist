'use strict';
// Catena di comando: feldmarescialli → armate (generali, max 24 divisioni) → divisioni. Potere di comando.

function initCommand(c) {
  c.generals = []; c.armies = []; c.nextGenId = 1; c.nextArmyId = 1;
  c.cp = c.major ? 30 : 10;
  const list = GENERALS[c.code] || [];
  for (const [name, fm, atk, def, plan, lg, traits] of list) addGeneral(c, name, fm ? 'fm' : 'gen', atk, def, plan, lg, traits);
  const want = c.major ? 3 : 1;
  const rng = mulberry32(c.code.charCodeAt(0) * 97);
  while (c.generals.length < want) {
    const nm = GENERIC_GENERAL_NAMES[Math.floor(rng() * GENERIC_GENERAL_NAMES.length)];
    addGeneral(c, nm, c.generals.length ? 'gen' : 'fm', 1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 3), []);
  }
}
function addGeneral(c, name, rank, atk, def, plan, lg, traits) {
  const g = { id: c.nextGenId++, name, rank, atk, def, plan, log: lg, traits: traits.slice(), xp: 0, level: Math.round((atk + def + plan + lg) / 4) };
  c.generals.push(g);
  return g;
}
const genById = (c, id) => c.generals.find(g => g.id === id) || null;
const armyById = (c, id) => c.armies.find(a => a.id === id) || null;

function createArmy(c, name, generalId) {
  const a = { id: c.nextArmyId++, name: name || `${c.nextArmyId - 1}ª Armata`, general: generalId ?? null, fm: null };
  c.armies.push(a);
  return a;
}
function armyDivs(c, a) { return S.divs.filter(d => d.owner === c.code && !d.dead && d.army === a.id); }
function disbandArmy(c, aid) {
  for (const d of S.divs) if (d.owner === c.code && d.army === aid) d.army = null;
  c.armies = c.armies.filter(a => a.id !== aid);
}
function assignGeneral(c, aid, gid) {
  const a = armyById(c, aid);
  if (!a) return;
  for (const o of c.armies) if (o.general === gid) o.general = null;
  a.general = gid;
}
function assignFM(c, aid, gid) {
  const a = armyById(c, aid), g = genById(c, gid);
  if (!a || !g || g.rank !== 'fm') return;
  a.fm = gid;
}
const fmArmyCount = (c, gid) => c.armies.filter(a => a.fm === gid).length;
function assignDivsToArmy(c, divs, aid) {
  for (const d of divs) if (d.owner === c.code) d.army = aid;
}

// generale e feldmaresciallo che comandano la divisione
function divGeneral(d) {
  if (d.army == null) return null;
  const c = C(d.owner), a = armyById(c, d.army);
  return a && a.general != null ? genById(c, a.general) : null;
}
function divFM(d) {
  if (d.army == null) return null;
  const c = C(d.owner), a = armyById(c, d.army);
  return a && a.fm != null ? genById(c, a.fm) : null;
}
// bonus di comando applicati alla divisione
function commandMods(d) {
  const m = { atk: 0, def: 0, brk: 0, plan: 0, planSpeed: 0, speed: 0, entrench: 0, winter: false, terrain: 0, terrainPen: 0, special: 0 };
  if (d.army == null) return m;
  const c = C(d.owner), a = armyById(c, d.army);
  if (!a) return m;
  const n = (S.armyCount && S.armyCount.get(c.code + ':' + a.id)) || 0;
  const over = n > ARMY_MAX_DIVS ? ARMY_MAX_DIVS / n : 1; // troppe divisioni: il comando si diluisce
  if (n > ARMY_MAX_DIVS) { const pen = Math.min(0.3, (n - ARMY_MAX_DIVS) * 0.02); m.atk -= pen; m.def -= pen; } // e arriva un malus
  const g = divGeneral(d), fm = divFM(d);
  if (!g && !fm) return m;
  // un feldmaresciallo coordina bene fino a FM_MAX_ARMIES armate: oltre, il suo 50% si diluisce
  const fmArmies = fm ? c.armies.filter(x => x.fm === fm.id).length : 0;
  const fmK = 0.5 * (fmArmies > FM_MAX_ARMIES ? FM_MAX_ARMIES / fmArmies : 1);
  const st = tplStats(d), ter = S.tiles[d.tile].terrain;
  const apply = (gg, k) => {
    m.atk += gg.atk * 0.05 * k * over;
    m.def += gg.def * 0.05 * k * over;
    m.planSpeed += gg.plan * 0.1 * k;
    for (const t of gg.traits) {
      if (t === 'corazzato' && st.kind === 'arm') { m.atk += 0.1 * k; m.speed += 0.1 * k; }
      if (t === 'fanteria' && st.kind === 'inf') { m.atk += 0.1 * k; m.def += 0.1 * k; }
      if (t === 'ostinato') { m.def += 0.1 * k; m.entrench += 0.5 * k; }
      if (t === 'offensiva') { m.atk += 0.08 * k; m.brk += 0.08 * k; }
      if (t === 'inverno') m.winter = true;
      if (t === 'montanaro' && (ter === 'hills' || ter === 'mountain')) m.terrain += 0.15 * k;
      if (t === 'pianificatore') m.plan += 0.1 * k;
      if (t === 'commando' && st.special) m.special += 0.1 * k;
      if (t === 'astuto') m.terrainPen += 0.1 * k;
      if (t === 'pianificatore_rapido') m.planSpeed += 0.25 * k;
    }
  };
  if (g) apply(g, 1);
  if (fm) apply(fm, fmK);
  return m;
}

function generalGainXP(c, g, v) {
  g.xp += v;
  const need = 100 * g.level;
  if (g.xp >= need && g.level < 9) {
    g.xp -= need; g.level++;
    const keys = ['atk', 'def', 'plan', 'log'];
    const k = keys[Math.floor(Math.random() * 4)];
    g[k] = Math.min(9, g[k] + 1);
    if (c.code === S.player) log(`${g.name} sale al livello ${g.level}.`, 'good');
    // combattendo i comandanti possono sviluppare un tratto nuovo
    const free = Object.keys(GENERAL_TRAITS).filter(t => !g.traits.includes(t) && (!GENERAL_TRAITS[t].fm || g.rank === 'fm'));
    if (free.length && g.traits.length < 4 && Math.random() < 0.35) {
      const t = free[Math.floor(Math.random() * free.length)];
      g.traits.push(t);
      if (c.code === S.player) log(`${g.name} ha sviluppato il tratto «${GENERAL_TRAITS[t].name}».`, 'good');
    }
  }
}

// ---------- potere di comando ----------
function cpMax(c) { return CP_MAX; }
function commandStep(c) {
  const fm = c.generals.filter(g => g.rank === 'fm').length;
  c.cp = Math.min(cpMax(c), (c.cp || 0) + CP_BASE + 0.1 * fm);
  battlePlanStep(c);
  abilityStep(c);
  // esperienza dell'esercito: addestramento in pace, molto di più in guerra
  const nd = S.divs.filter(d => d.owner === c.code && !d.dead).length;
  addArmyXP(c, 0.02 + nd * 0.002 + (enemiesOf(c.code).length ? 0.1 : 0));
}
function recruitGeneral(c) {
  if (c.cp < CP_COST.general) return false;
  c.cp -= CP_COST.general;
  const rng = Math.random;
  const nm = GENERIC_GENERAL_NAMES[Math.floor(rng() * GENERIC_GENERAL_NAMES.length)];
  addGeneral(c, nm, 'gen', 1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 3), []);
  return true;
}
function promoteGeneral(c, gid) {
  const g = genById(c, gid);
  if (!g || g.rank === 'fm' || c.cp < CP_COST.promote) return false;
  c.cp -= CP_COST.promote;
  g.rank = 'fm';
  for (const a of c.armies) if (a.general === gid) a.general = null;
  return true;
}
function addTrait(c, gid, trait) {
  const g = genById(c, gid);
  if (!g || g.traits.includes(trait) || g.traits.length >= 4 || c.cp < CP_COST.trait) return false;
  c.cp -= CP_COST.trait;
  g.traits.push(trait);
  return true;
}

// organizza automaticamente le divisioni senza armata (IA e partenza)
function autoArmies(c) {
  const free = S.divs.filter(d => d.owner === c.code && !d.dead && (d.army == null || !armyById(c, d.army)));
  if (!free.length) return;
  const gens = c.generals.filter(g => g.rank === 'gen' && !c.armies.some(a => a.general === g.id));
  const fms = c.generals.filter(g => g.rank === 'fm');
  for (const d of free) {
    let a = c.armies.find(x => armyDivs(c, x).length < ARMY_MAX_DIVS);
    if (!a) {
      const g = gens.shift() || null;
      a = createArmy(c, null, g ? g.id : null);
      if (fms.length) a.fm = fms[(c.armies.length - 1) % fms.length].id;
    }
    d.army = a.id;
  }
}
