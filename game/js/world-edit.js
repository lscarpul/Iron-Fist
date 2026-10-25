'use strict';

// Modifiche libere del mondo per il "Governo" in modalità Narratore (come l'IA di Pax Historia):
// nuove città e punti vittoria, passaggi di stati tra paesi, nuove nazioni, cambi di regime,
// eventi e notizie, truppe e risorse. Ogni funzione controlla gli argomenti e lascia il mondo
// coerente (proprietario/controllo/nucleo delle province, capitali, divisioni, fabbriche).
// Le azioni sono registrate in GameActions con mode: 'narrator' e parametri semplici in italiano,
// pensati anche per un modello locale piccolo.

const WorldEdit = {
  norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); },

  // ---------- ricerca di luoghi ----------
  // città già esistente (nome della città su una provincia)
  findCity(q) {
    const n = this.norm(q);
    if (!n) return -1;
    let best = -1;
    for (const t of S.tiles) if (t.land && t.city && this.norm(t.city) === n && (best < 0 || t.vp > S.tiles[best].vp)) best = t.i;
    if (best >= 0) return best;
    for (const t of S.tiles) if (t.land && t.city && n.length >= 4 && this.norm(t.city).startsWith(n) && (best < 0 || t.vp > S.tiles[best].vp)) best = t.i;
    return best;
  },
  // stato della mappa per nome, oppure lo stato che contiene la città indicata
  findState(q) {
    const n = this.norm(q);
    if (!n || typeof MAP === 'undefined') return -1;
    const st = MAP.states;
    for (let s = 0; s < st.length; s++) if (this.norm(st[s].name) === n) return s;
    const ci = this.findCity(q);
    if (ci >= 0 && S.tiles[ci].state >= 0) return S.tiles[ci].state;
    if (n.length >= 4) for (let s = 0; s < st.length; s++) if (this.norm(st[s].name).startsWith(n)) return s;
    // "Corsica" → "Alta Corsica"
    if (n.length >= 5) for (let s = 0; s < st.length; s++) if (this.norm(st[s].name).includes(n)) return s;
    return -1;
  },
  // regioni di un paese con la città principale, per scoprire i nomi da usare negli altri strumenti
  regions(country) {
    const code = this.country(country);
    const by = new Map();
    for (const t of S.tiles) {
      if (!t.land || t.owner !== code || t.state < 0) continue;
      const r = by.get(t.state) || { n: 0, city: null, vp: -1 };
      r.n++;
      if (t.city && (t.vp || 0) > r.vp) { r.city = t.city; r.vp = t.vp || 0; }
      by.set(t.state, r);
    }
    const rows = [...by].sort((a, b) => b[1].vp - a[1].vp).slice(0, 40)
      .map(([st, r]) => `${this.stateName(st)}${r.city ? ` (${r.city}${r.vp > 0 ? ` ${r.vp} PV` : ''})` : ''}`);
    return `Regioni di ${C(code).name}${by.size > 40 ? ' (le 40 principali)' : ''}: ${rows.join(', ')}.`;
  },
  stateTiles(s) { return MAP.states[s].provinces.filter(i => S.tiles[i] && S.tiles[i].land); },
  stateName(s) { return MAP.states[s].name; },
  // luogo generico: città, stato o paese → elenco di province candidate
  placeTiles(q) {
    const ci = this.findCity(q);
    if (ci >= 0) return { tiles: [ci], label: S.tiles[ci].city };
    const s = this.findState(q);
    if (s >= 0) return { tiles: this.stateTiles(s), label: this.stateName(s) };
    try {
      const code = findCountry(q);
      const tiles = S.tiles.filter(t => t.land && t.owner === code).map(t => t.i);
      if (tiles.length) return { tiles, label: C(code).name, center: C(code).capital };
    } catch (e) { /* non è un paese */ }
    throw new Error(`Luogo sconosciuto: "${q}". Indica una città esistente, una regione (stato) o un paese; elenca_regioni mostra i nomi validi.`);
  },
  country(q) {
    const code = findCountry(q);
    if (!C(code).alive) throw new Error(`${C(code).name} non esiste più`);
    return code;
  },
  list(v) { return String(v || '').split(/[,;]| e /).map(x => x.trim()).filter(Boolean); },

  // ---------- città e punti vittoria ----------
  createCity(name, place, vp) {
    name = String(name || '').trim().slice(0, 40);
    if (!name) throw new Error('Serve il nome della città');
    if (this.findCity(name) >= 0 && this.norm(S.tiles[this.findCity(name)].city) === this.norm(name)) throw new Error(`Esiste già una città chiamata ${name}`);
    vp = Math.max(1, Math.min(50, Math.round(Number(vp) || 5)));
    const { tiles, label, center } = this.placeTiles(place);
    // la provincia libera (senza città) più vicina al centro del luogo
    let pool = tiles.filter(i => !S.tiles[i].city);
    if (!pool.length) {
      const near = new Set();
      for (const i of tiles) for (const n of S.tiles[i].nb) if (S.tiles[n].land && !S.tiles[n].city && S.tiles[n].owner === S.tiles[i].owner) near.add(n);
      pool = [...near];
    }
    if (!pool.length) throw new Error(`Non c'è spazio per una nuova città in ${label}`);
    // per un paese intero si parte dalla capitale, non dal baricentro (che può cadere in una colonia)
    const c0 = center != null && S.tiles[center] ? S.tiles[center] : null;
    const cx = c0 ? c0.cx : tiles.reduce((s, i) => s + S.tiles[i].cx, 0) / tiles.length;
    const cy = c0 ? c0.cy : tiles.reduce((s, i) => s + S.tiles[i].cy, 0) / tiles.length;
    pool.sort((a, b) => Math.hypot(S.tiles[a].cx - cx, S.tiles[a].cy - cy) - Math.hypot(S.tiles[b].cx - cx, S.tiles[b].cy - cy));
    const t = S.tiles[pool[0]];
    t.city = name; t.vp = vp;
    if (vp >= 10 && t.terrain !== 'urban') t.terrain = 'urban';
    S.mapDirty = true;
    const st = t.state >= 0 ? ` (${this.stateName(t.state)})` : '';
    log(`Fondata la città di ${name}${st}, ${C(t.owner).name}: ${vp} punti vittoria.`, involvesPlayer(t.owner) ? 'good' : 'big');
    return `Città ${name} creata in ${label}${st}, territorio di ${C(t.owner).name}, ${vp} punti vittoria.`;
  },
  editCity(city, newName, vp) {
    const i = this.findCity(city);
    if (i < 0) throw new Error(`Città sconosciuta: ${city}`);
    const t = S.tiles[i], old = t.city, out = [];
    if (newName && String(newName).trim()) { t.city = String(newName).trim().slice(0, 40); out.push(`rinominata ${t.city}`); }
    if (vp != null && vp !== '') { t.vp = Math.max(0, Math.min(50, Math.round(Number(vp) || 0))); out.push(`${t.vp} punti vittoria`); }
    if (!out.length) throw new Error('Indica un nuovo nome o i punti vittoria');
    S.mapDirty = true;
    log(`${old}: ${out.join(', ')}.`, involvesPlayer(t.owner) ? 'good' : '');
    return `${old}: ${out.join(', ')}.`;
  },
  moveCapital(country, city) {
    const code = this.country(country), i = this.findCity(city);
    if (i < 0) throw new Error(`Città sconosciuta: ${city}`);
    if (S.tiles[i].owner !== code) throw new Error(`${S.tiles[i].city} non appartiene a ${C(code).name}`);
    C(code).capital = i;
    S.tiles[i].vp = Math.max(S.tiles[i].vp, 15);
    S.mapDirty = true;
    log(`${C(code).name} sposta la capitale a ${S.tiles[i].city}.`, involvesPlayer(code) ? 'good' : 'big');
    return `Capitale di ${C(code).name}: ${S.tiles[i].city}.`;
  },

  // ---------- territori ----------
  // passa le province a un nuovo proprietario e sistema tutto il resto
  giveTiles(tiles, to) {
    const losers = new Map();
    for (const i of tiles) {
      const t = S.tiles[i];
      if (t.owner === to) continue;
      losers.set(t.owner, (losers.get(t.owner) || 0) + 1);
      t.owner = to; t.ctrl = to; t.core = to;
    }
    countTiles();
    const tgt = C(to);
    for (const [from, n] of losers) {
      const f = C(from);
      const share = n / Math.max(1, f.tiles + n);
      const civ = Math.floor(f.civ * share), mil = Math.floor(f.mil * share);
      f.civ -= civ; f.mil -= mil; tgt.civ += civ; tgt.mil += mil;
      if (!f.tiles) { killCountry(from); log(`${f.name} cessa di esistere.`, 'big'); continue; }
      if (S.tiles[f.capital].owner !== from) {
        const own = S.tiles.filter(t => t.land && t.owner === from).sort((a, b) => b.vp - a.vp);
        f.capital = own[0].i;
      }
    }
    if (S.tiles[tgt.capital] == null || S.tiles[tgt.capital].owner !== to) {
      const own = S.tiles.filter(t => t.land && t.owner === to).sort((a, b) => b.vp - a.vp);
      tgt.capital = own[0].i;
    }
    // divisioni rimaste in territorio non più amico tornano a casa
    for (const d of S.divs) {
      if (d.dead) continue;
      const t = S.tiles[d.tile];
      if (t.land && !allied(t.ctrl, d.owner) && !atWar(t.ctrl, d.owner)) {
        const home = spawnTile(C(d.owner));
        if (home >= 0) { moveDiv(d, home); d.path = []; d.prog = 0; } else destroyDiv(d);
      }
    }
    if (typeof AN !== 'undefined' && typeof portsOf === 'function') for (const k of [to, ...losers.keys()]) if (C(k).alive) C(k).ports = portsOf(k);
    S.mapDirty = true;
  },
  transferStates(states, to) {
    const code = this.country(to);
    const names = this.list(states);
    if (!names.length) throw new Error('Indica almeno una regione (stato) o città');
    const tiles = [], done = [], unknown = [];
    for (const nm of names) {
      const s = this.findState(nm);
      if (s < 0) { unknown.push(nm); continue; }
      tiles.push(...this.stateTiles(s));
      done.push(this.stateName(s));
    }
    if (!tiles.length) throw new Error(`Regioni sconosciute: ${unknown.join(', ')}. Usa elenca_regioni per i nomi validi, oppure il nome di una città della regione.`);
    if (tiles.some(i => atWar(S.tiles[i].owner, code))) throw new Error('Durante una guerra i territori passano solo con la conquista o la pace');
    const from = [...new Set(tiles.map(i => S.tiles[i].owner))].filter(k => k !== code).map(k => C(k).name);
    this.giveTiles(tiles, code);
    log(`${done.join(', ')} passa${done.length > 1 ? 'no' : ''} a ${C(code).name}${from.length ? ` (da ${from.join(', ')})` : ''}.`, involvesPlayer(code) ? 'good' : 'big');
    return `Passati a ${C(code).name}: ${done.join(', ')}.${unknown.length ? ` Non trovati: ${unknown.join(', ')}.` : ''}`;
  },

  // ---------- nazioni ----------
  newCode(name) {
    // "Repubblica di Catalogna" → CAT: si saltano le parole generiche
    const generic = /^(repubblica|regno|impero|stato|stati|libero|libera|federazione|unione|popolare|socialista|democratica|del|della|dei|di|de|la|il|lo|le|of|the|republic|kingdom|empire|state|free)$/i;
    const words = String(name).split(/[\s'-]+/).filter(w => w && !generic.test(this.norm(w)));
    const letters = this.norm(words.join('') || name).replace(/[0-9]/g, '').toUpperCase() || 'NAZ';
    const tries = [letters.slice(0, 3), letters[0] + letters.slice(-2), letters.slice(0, 2) + 'X'];
    for (const t of tries) if (t.length === 3 && !S.countries[t] && !COUNTRY_DEFS[t]) return t;
    for (let k = 1; k < 1000; k++) { const t = 'N' + String(k).padStart(2, '0'); if (!S.countries[t] && !COUNTRY_DEFS[t]) return t; }
    throw new Error('Troppe nazioni');
  },
  randomColor(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
    const l = 0.42, s = 0.5, a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('');
  },
  createNation(name, states, ideology, leader, color) {
    name = String(name || '').trim().slice(0, 40);
    if (!name) throw new Error('Serve il nome della nazione');
    if (Object.values(S.countries).some(c => c.alive && this.norm(c.name) === this.norm(name))) throw new Error(`${name} esiste già`);
    const ideo = this.ideology(ideology || 'neutral');
    const names = this.list(states);
    const tiles = [];
    for (const nm of names) { const s = this.findState(nm); if (s >= 0) tiles.push(...this.stateTiles(s)); }
    if (!tiles.length) throw new Error('Indica le regioni (stati) o le città che formano la nuova nazione');
    if (tiles.some(i => S.tiles[i].ctrl !== S.tiles[i].owner)) throw new Error('Alcune di quelle regioni sono occupate: prima serve la pace');
    const code = this.newCode(name);
    const def = { name, color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : this.randomColor(name), civ: 0, mil: 0, inf: 0, arm: 0, aggro: 0.3, custom: true };
    COUNTRY_DEFS[code] = def;
    const c = {
      code, name: def.name, color: def.color, major: false, aggro: def.aggro,
      civ: 0, mil: 0, manpower: 0, equipment: 0, pp: 50, ppGain: 1.5,
      eqBonus: 0, atkBonus: 0, defBonus: 0, speedBonus: 0, mpBonus: 0, recBonus: 0,
      armorTech: false, focus: null, focusDays: 0, done: new Set(),
      construction: [], training: [], faction: null, alive: true,
      capital: tiles[0], tiles: 0, slot: Object.keys(S.countries).length % 3, divCounter: 0,
    };
    if (typeof initFocusState === 'function') initFocusState(c);
    S.countries[code] = c;
    if (typeof initResearch === 'function') initResearch(c, def);
    if (typeof initLandCountry === 'function') initLandCountry(c);
    if (typeof initCommand === 'function') initCommand(c);
    if (typeof Econ !== 'undefined' && Econ.initCountry) Econ.initCountry(c);
    c.ideology = ideo; c.leader = String(leader || '').slice(0, 40);
    c.overlord = null; c.autonomy = null; c.capitulated = false; c.collabBonus = 0;
    if (S.intel) S.intel[code] = { level: 0, agents: 1, assign: [], nets: {}, ops: [], captured: [] };
    if (S.an) {
      c.dock = 0; c.convoys = 0; c.convoyNeed = 0; c.convoysLost = 0; c.indDamage = 0;
      c.airLines = []; c.navLines = []; c.airStock = {};
    }
    c.trucks = 80; c.motorHubs = []; c.autoMotor = code !== S.player;
    c.nukeShock = c.nukeShock || 0;
    const from = [...new Set(tiles.map(i => S.tiles[i].owner))].map(k => C(k).name);
    this.giveTiles(tiles, code);
    c.capital = S.tiles.filter(t => t.land && t.owner === code).sort((x, y) => y.vp - x.vp)[0].i;
    c.manpower = c.tiles * 1000 + c.civ * 3000;
    if (S.an && typeof ensureDefaultDesign === 'function') {
      try {
        for (const role in AIR_ROLES) ensureDefaultDesign(c, 'air', role);
        for (const h in HULLS) ensureDefaultDesign(c, 'naval', h);
      } catch (e) { /* progetti creati alla prima produzione */ }
    }
    // un piccolo esercito iniziale
    const n = Math.max(1, Math.min(8, Math.round(c.tiles / 4)));
    const own = S.tiles.filter(t => t.land && t.owner === code);
    for (let k = 0; k < n; k++) createDiv(code, 'inf', own[Math.floor(k * own.length / n)].i);
    if (typeof autoArmies === 'function') autoArmies(c);
    log(`Nasce ${name} (${IDEOLOGIES[ideo].short.toLowerCase()}) da territori di ${from.join(', ')}.`, 'big');
    return `Nata la nazione ${name} (codice ${code}): ${c.tiles} province, capitale ${S.tiles[c.capital].city || 'senza nome'}, ${n} division${n === 1 ? "e" : "i"}.`;
  },
  ideology(q) {
    const n = this.norm(q);
    const map = { democratic: 'democratic', democrazia: 'democratic', democratico: 'democratic', democratica: 'democratic', fascist: 'fascist', fascismo: 'fascist', fascista: 'fascist', nazista: 'fascist', communist: 'communist', comunismo: 'communist', comunista: 'communist', neutral: 'neutral', neutrale: 'neutral', nonallineato: 'neutral', monarchia: 'neutral', autoritario: 'neutral' };
    const id = map[n] || Object.keys(IDEOLOGIES).find(k => this.norm(IDEOLOGIES[k].name) === n || this.norm(IDEOLOGIES[k].short) === n);
    if (!id || !IDEOLOGIES[id]) throw new Error('Ideologia: democrazia, fascismo, comunismo o non allineato');
    return id;
  },
  changeGovernment(country, ideology, leader) {
    const code = this.country(country), c = C(code);
    const e = {};
    if (ideology) e.ideology = this.ideology(ideology);
    if (leader) e.leader = String(leader).trim().slice(0, 40);
    if (!e.ideology && !e.leader) throw new Error('Indica la nuova ideologia o il nuovo capo');
    if (typeof applyFocusEffects === 'function') applyFocusEffects(c, e, { name: 'Governo' });
    else { if (e.ideology) c.ideology = e.ideology; if (e.leader) c.leader = e.leader; }
    if (e.leader && !e.ideology) log(`${c.name}: nuovo capo di stato, ${e.leader}.`, involvesPlayer(code) ? 'good' : 'big');
    S.mapDirty = true;
    return `${c.name}: governo ${IDEOLOGIES[c.ideology].short.toLowerCase()}${c.leader ? `, guidato da ${c.leader}` : ''}.`;
  },
  editNation(country, name, color) {
    const code = this.country(country), c = C(code), old = c.name;
    if (!name && !color) throw new Error('Indica un nuovo nome o un colore');
    if (name) c.name = String(name).trim().slice(0, 40);
    if (color) {
      if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Colore nel formato #rrggbb');
      c.color = color;
    }
    if (COUNTRY_DEFS[code]) { COUNTRY_DEFS[code].name = c.name; COUNTRY_DEFS[code].color = c.color; }
    S.mapDirty = true;
    log(name && name !== old ? `${old} prende il nome di ${c.name}.` : `${c.name} cambia colori.`, 'big');
    return `${old}: ora ${c.name} (${c.color}).`;
  },

  // ---------- risorse e truppe ----------
  adjust(country, d) {
    const code = this.country(country), c = C(code), out = [];
    const lim = (v, a) => Math.max(-a, Math.min(a, Math.round(Number(v) || 0)));
    const pp = lim(d.potere_politico, 500), civ = lim(d.fabbriche_civili, 50), mil = lim(d.fabbriche_militari, 50);
    const mp = lim(d.manodopera, 5000000), eq = lim(d.equipaggiamento, 200000);
    if (pp) { c.pp = Math.max(0, Math.min(999, c.pp + pp)); out.push(`potere politico ${pp > 0 ? '+' : ''}${pp}`); }
    if (civ) { c.civ = Math.max(0, c.civ + civ); out.push(`fabbriche civili ${civ > 0 ? '+' : ''}${civ}`); }
    if (mil) { c.mil = Math.max(0, c.mil + mil); out.push(`fabbriche militari ${mil > 0 ? '+' : ''}${mil}`); }
    if (mp) { c.manpower = Math.max(0, c.manpower + mp); out.push(`manodopera ${mp > 0 ? '+' : ''}${mp}`); }
    if (eq) { c.equipment = Math.max(0, c.equipment + eq); out.push(`equipaggiamento ${eq > 0 ? '+' : ''}${eq}`); }
    if (!out.length) throw new Error('Nessuna variazione indicata');
    log(`${c.name}: ${out.join(', ')}.`, involvesPlayer(code) ? 'good' : '');
    return `${c.name}: ${out.join(', ')}.`;
  },
  spawnDivisions(country, count, place, type) {
    const code = this.country(country), c = C(code);
    const n = Math.max(1, Math.min(20, Math.round(Number(count) || 1)));
    const ty = type === 'arm' || /coraz|carr/i.test(type || '') ? 'arm' : 'inf';
    let tiles = place ? this.placeTiles(place).tiles.filter(i => S.tiles[i].ctrl === code) : [];
    if (!tiles.length) { const s = spawnTile(c); if (s >= 0) tiles = [s]; }
    if (!tiles.length) throw new Error(`${c.name} non controlla territori dove schierarle`);
    for (let k = 0; k < n; k++) createDiv(code, ty, tiles[k % tiles.length]);
    if (typeof autoArmies === 'function') autoArmies(c);
    log(`${c.name} schiera ${n} nuov${n === 1 ? "a divisione" : "e divisioni"}.`, involvesPlayer(code) ? 'good' : '');
    return `${n} divisioni di ${ty === 'arm' ? 'carri' : 'fanteria'} schierate per ${c.name}.`;
  },

  // ---------- relazioni tra paesi qualsiasi ----------
  war(a, b) {
    const x = this.country(a), y = this.country(b);
    if (x === y) throw new Error('Un paese non può attaccare se stesso');
    if (atWar(x, y)) throw new Error('Sono già in guerra');
    if (allied(x, y)) throw new Error('Sono alleati');
    declareWar(x, y);
    return `${C(x).name} è in guerra con ${C(y).name}.`;
  },
  peace(a, b) {
    const x = this.country(a), y = this.country(b);
    if (!atWar(x, y)) throw new Error('Non sono in guerra');
    makePeace(x, y);
    log(`Pace tra ${C(x).name} e ${C(y).name}.`, involvesPlayer(x, y) ? 'good' : 'big');
    return `Pace firmata tra ${C(x).name} e ${C(y).name}.`;
  },
  relations(a, b, v) {
    const x = this.country(a), y = this.country(b);
    const d = Math.max(-100, Math.min(100, Math.round(Number(v) || 0)));
    if (!d) throw new Error('Indica di quanto cambia l\'opinione (es. 20 o -30)');
    if (typeof Diplo !== 'undefined') { Diplo.addRel(x, y, d, 100); Diplo.addRel(y, x, d, 100); }
    else { Rel.addMod(x, y, d, 1, 'Eventi'); Rel.addMod(y, x, d, 1, 'Eventi'); }
    return `Rapporti tra ${C(x).name} e ${C(y).name} ${d > 0 ? 'migliorati' : 'peggiorati'} di ${Math.abs(d)}.`;
  },
  annexNation(by, target) {
    const x = this.country(by), y = this.country(target);
    if (x === y) throw new Error('Paese uguale');
    if (atWar(x, y)) throw new Error('Sono in guerra: serve vincerla');
    annex(x, y);
    return `${C(x).name} ha annesso ${C(y).name}.`;
  },

  // ---------- notizie ----------
  news(title, text, country) {
    title = String(title || '').trim().slice(0, 80);
    text = String(text || '').trim().slice(0, 600);
    if (!title || !text) throw new Error('Servono titolo e testo');
    let code = null;
    if (country) { try { code = findCountry(country); } catch (e) { /* notizia generale */ } }
    S.news = S.news || [];
    S.news.unshift({ day: S.day, title, text, country: code });
    if (S.news.length > 60) S.news.pop();
    log(`📰 ${title}`, 'big');
    if (typeof UI !== 'undefined' && UI.ask) UI.ask(`📰 ${title}`, text, [{ label: 'Continua' }]);
    return `Notizia pubblicata: ${title}.`;
  },
};

// quadro del mondo per il narratore: regimi delle potenze, fazioni, guerre, ultime notizie
function worldStateText() {
  const L = [`Data: ${dateLabel(S.day)}.`];
  const ideo = c => (IDEOLOGIES[c.ideology] || IDEOLOGIES.neutral).short;
  const pw = Object.values(S.countries).filter(c => c.alive && c.major);
  L.push('Grandi potenze: ' + pw.map(c => `${c.code} ${c.name} (${ideo(c)}${c.leader ? `, guidata da ${c.leader}` : ''}, fabbriche ${c.civ}/${c.mil})`).join('; ') + '.');
  const fac = Object.values(S.factions || {}).filter(f => f.members && f.members.length);
  L.push('Fazioni: ' + (fac.length ? fac.map(f => `${f.name}: ${f.members.map(m => C(m).name).join(', ')}`).join('; ') : 'nessuna') + '.');
  const wars = [...S.wars].map(k => warSides(k).map(x => C(x).name).join(' contro '));
  L.push('Guerre in corso: ' + (wars.length ? wars.slice(0, 12).join('; ') + (wars.length > 12 ? ` e altre ${wars.length - 12}` : '') : 'nessuna') + '.');
  const subj = Object.values(S.countries).filter(c => c.alive && c.overlord).map(c => `${c.name} di ${C(c.overlord).name}`);
  if (subj.length) L.push('Sudditi: ' + subj.join(', ') + '.');
  if (S.news && S.news.length) L.push('Ultime notizie: ' + S.news.slice(0, 6).map(n => `${dateLabel(n.day)} ${n.title}`).join('; ') + '.');
  return L.join('\n');
}

// ---------- azioni per il Governo (modalità Narratore) ----------
(function registerWorldActions() {
  const S_ = (d) => ({ type: 'string', description: d });
  const N_ = (d) => ({ type: 'integer', description: d });
  const reg = (name, description, props, required, run) => GameActions.register({
    name, description, mode: 'narrator',
    input_schema: { type: 'object', properties: props, required },
    run,
  });
  reg('elenca_regioni', 'Elenca i nomi delle regioni (stati della mappa) di un paese con la loro città principale. Usalo prima di cedere regioni o creare nazioni se non sei sicuro dei nomi.',
    { paese: S_('Paese') }, ['paese'], a => WorldEdit.regions(a.paese));
  reg('crea_citta', 'Fonda una nuova città con punti vittoria (come in Hearts of Iron IV) in una regione, vicino a una città o in un paese. Punti vittoria: 1-5 cittadina, 10 città importante, 15-30 capitale.',
    { nome: S_('Nome della nuova città'), luogo: S_('Regione (stato), città vicina o paese dove fondarla'), punti_vittoria: N_('Punti vittoria 1-50') },
    ['nome', 'luogo'], a => WorldEdit.createCity(a.nome, a.luogo, a.punti_vittoria));
  reg('modifica_citta', 'Rinomina una città esistente e/o cambia i suoi punti vittoria.',
    { citta: S_('Città esistente'), nuovo_nome: S_('Nuovo nome (facoltativo)'), punti_vittoria: N_('Nuovi punti vittoria 0-50 (facoltativo)') },
    ['citta'], a => WorldEdit.editCity(a.citta, a.nuovo_nome, a.punti_vittoria));
  reg('sposta_capitale', 'Sposta la capitale di un paese in una sua città.',
    { paese: S_('Paese'), citta: S_('Città del paese') }, ['paese', 'citta'], a => WorldEdit.moveCapital(a.paese, a.citta));
  reg('cedi_regioni', 'Passa una o più regioni (stati della mappa, o le regioni che contengono le città indicate) a un altro paese, in pace: trattati, compravendite, plebisciti.',
    { regioni: S_('Nomi di regioni o città, separati da virgola'), a: S_('Paese che le riceve') }, ['regioni', 'a'], a => WorldEdit.transferStates(a.regioni, a.a));
  reg('crea_nazione', 'Fa nascere una nuova nazione da una o più regioni (stati o città) di paesi esistenti: secessioni, indipendenze, stati fantoccio.',
    { nome: S_('Nome della nuova nazione'), regioni: S_('Regioni o città che la formano, separate da virgola'), ideologia: S_('democrazia, fascismo, comunismo o non allineato'), capo: S_('Capo di stato (facoltativo)'), colore: S_('Colore #rrggbb (facoltativo)') },
    ['nome', 'regioni'], a => WorldEdit.createNation(a.nome, a.regioni, a.ideologia, a.capo, a.colore));
  reg('annetti_paese', 'Un paese ne annette pacificamente un altro (unione, Anschluss).',
    { annessore: S_('Paese che annette'), paese: S_('Paese annesso') }, ['annessore', 'paese'], a => WorldEdit.annexNation(a.annessore, a.paese));
  reg('cambia_governo', 'Cambia regime e/o capo di stato di un paese (colpo di stato, rivoluzione, elezioni).',
    { paese: S_('Paese'), ideologia: S_('democrazia, fascismo, comunismo o non allineato (facoltativo)'), capo: S_('Nuovo capo di stato (facoltativo)') },
    ['paese'], a => WorldEdit.changeGovernment(a.paese, a.ideologia, a.capo));
  reg('rinomina_nazione', 'Cambia nome e/o colore sulla mappa di un paese.',
    { paese: S_('Paese'), nome: S_('Nuovo nome (facoltativo)'), colore: S_('Colore #rrggbb (facoltativo)') }, ['paese'], a => WorldEdit.editNation(a.paese, a.nome, a.colore));
  reg('modifica_risorse', 'Aggiunge o toglie risorse a un paese per effetto di eventi (numeri negativi per togliere): potere politico, fabbriche, manodopera, equipaggiamento.',
    { paese: S_('Paese'), potere_politico: N_('Variazione'), fabbriche_civili: N_('Variazione'), fabbriche_militari: N_('Variazione'), manodopera: N_('Variazione'), equipaggiamento: N_('Variazione') },
    ['paese'], a => WorldEdit.adjust(a.paese, a));
  reg('schiera_divisioni', 'Crea nuove divisioni per un paese (milizie, volontari, rivolte, aiuti).',
    { paese: S_('Paese'), numero: N_('Quante 1-20'), luogo: S_('Regione o città del paese (facoltativo)'), tipo: S_('fanteria o carri') },
    ['paese', 'numero'], a => WorldEdit.spawnDivisions(a.paese, a.numero, a.luogo, a.tipo));
  reg('guerra_tra', 'Fa scoppiare una guerra tra due paesi qualsiasi (anche non il nostro).',
    { attaccante: S_('Paese che attacca'), difensore: S_('Paese attaccato') }, ['attaccante', 'difensore'], a => WorldEdit.war(a.attaccante, a.difensore));
  reg('pace_tra', 'Pace bianca tra due paesi in guerra: i territori occupati tornano ai proprietari.',
    { paese_a: S_('Paese'), paese_b: S_('Paese') }, ['paese_a', 'paese_b'], a => WorldEdit.peace(a.paese_a, a.paese_b));
  reg('cambia_rapporti', 'Migliora o peggiora i rapporti reciproci tra due paesi qualsiasi.',
    { paese_a: S_('Paese'), paese_b: S_('Paese'), valore: N_('Da -100 a 100') }, ['paese_a', 'paese_b', 'valore'], a => WorldEdit.relations(a.paese_a, a.paese_b, a.valore));
  reg('notizia', 'Pubblica un evento o una notizia nel mondo di gioco (compare al giocatore come avviso). Usala per raccontare cosa succede e le conseguenze delle azioni.',
    { titolo: S_('Titolo breve'), testo: S_('Testo della notizia, 1-3 frasi'), paese: S_('Paese coinvolto (facoltativo)') }, ['titolo', 'testo'], a => WorldEdit.news(a.titolo, a.testo, a.paese));
})();
