'use strict';

// ============================================================================
// Alberi dei focus fuori dall'Europa centrale: nuove nazioni della mappa reale,
// Asia, Americhe, Commonwealth e Africa. Tag in stile HoI4.
// Un tag che non è sulla mappa non fa danni: i focus che lo nominano restano
// non disponibili e i paesi senza albero usano quello generico.
// ============================================================================

const BALTIC = ['EST', 'LAT', 'LIT'];
const LATAM = ['MEX', 'GUA', 'HON', 'ELS', 'NIC', 'COS', 'PAN', 'CUB', 'HAI', 'DOM', 'COL', 'VEN', 'ECU', 'PRU', 'BOL', 'CHL', 'ARG', 'PAR', 'URU', 'BRA'];
const WARLORDS = ['SHX', 'GXC', 'YUN', 'XSM', 'SIK'];

// ---------- STATI UNITI ----------
defTree('USA', "Stati Uniti d'America", [
  F('USA_newdeal', 'Il secondo New Deal', 4, { eff: { civ: 3, mods: { stability: 0.05 } }, ai: 10, ic: '🏛️' }),
  F('USA_fdr', 'La rielezione di Roosevelt', 2, { pre: ['USA_newdeal'], ex: ['USA_first', 'USA_browder'], cond: { date: '1936-11-03' }, eff: { ppGain: 0.25, mods: { stability: 0.1 } }, ai: 10, ic: '🗳️' }),
  F('USA_first', 'America First', 6, { pre: ['USA_newdeal'], ex: ['USA_browder'], eff: { leader: 'Charles Lindbergh', mods: { war_support: 0.1, stability: -0.1 } }, ai: 0, ic: '🦅' }),
  F('USA_browder', 'Il sindacato al potere', 8, { pre: ['USA_newdeal'], eff: { mods: { stability: -0.15 } }, ai: 0, ic: '✊' }),
  // storico
  F('USA_neutral', 'Leggi sulla neutralità', 1, { pre: ['USA_fdr'], eff: { mods: { stability: 0.05 } }, ai: 10, ic: '⚖️' }),
  F('USA_quarantine', 'Il discorso della quarantena', 3, { pre: ['USA_fdr'], cond: { date: '1937-10-05' }, eff: { mods: { war_support: 0.05 } }, ai: 10, ic: '📜' }),
  F('USA_cash', 'Cash and Carry', 1, { pre: ['USA_neutral'], cond: { year: 1939, war: false }, eff: { mil: 3, aid: { U: 5000, F: 5000 } }, ai: 10, ic: '📦' }),
  F('USA_draft', 'Selective Service Act', 3, { pre: ['USA_quarantine'], cond: { year: 1940 }, eff: { manpower: 300000, mpBonus: 0.2 }, ai: 10, ic: '👥' }),
  F('USA_lend', 'Affitti e prestiti', 1, { pre: ['USA_cash'], cond: { year: 1941 }, eff: { aid: { U: 20000, S: 15000, CHI: 8000 } }, ai: 10, ic: '📦' }),
  F('USA_arsenal', 'Arsenale della democrazia', 3, { pre: ['USA_draft'], eff: { mil: 8, eqBonus: 0.1 }, ai: 10, ic: '⚙️' }),
  F('USA_infamy', 'Una data che vivrà nell\'infamia', 2, { pre: ['USA_lend', 'USA_arsenal'], cond: { atWarWith: ['JAP', 'G', 'I'] }, eff: { joinFaction: 'U', manpower: 500000, mods: { war_support: 0.3 } }, ai: 10, ic: '⚔️' }),
  F('USA_victory', 'Victory Program', 1, { pre: ['USA_infamy'], eff: { mil: 10, mods: { production_efficiency: 0.1 } }, ai: 10, ic: '⚙️' }),
  F('USA_torch', 'Operazione Torch', 3, { pre: ['USA_infamy'], cond: { year: 1942 }, eff: { divs: { inf: 4, arm: 2 }, atkBonus: 0.05 }, ai: 10, ic: '⚔️' }),
  F('USA_overlord', 'Operazione Overlord', 2, { pre: ['USA_victory', 'USA_torch'], cond: { year: 1944 }, eff: { divs: { inf: 6, arm: 3 }, atkBonus: 0.1 }, ai: 10, ic: '⚔️' }),
  // alternativi
  F('USA_isol', 'Fortezza America', 6, { pre: ['USA_first'], eff: { defBonus: 0.15, mil: 3 }, ai: 0, ic: '🧱' }),
  F('USA_silver', 'La Legione d\'argento', 6, { pre: ['USA_isol'], cond: { year: 1938 }, eff: { ideology: 'fascist', leader: 'William Dudley Pelley', mods: { war_support: 0.1 } }, ai: 0 }),
  F('USA_monroe', 'Dottrina Monroe armata', 6, { pre: ['USA_silver'], eff: { createFaction: 'Patto delle Americhe', invite: LATAM }, ai: 0 }),
  F('USA_reds', 'Repubblica Socialista Americana', 8, { pre: ['USA_browder'], eff: { ideology: 'communist', leader: 'Earl Browder', civ: 3 }, ai: 0 }),
  F('USA_intl', 'Solidarietà internazionale', 8, { pre: ['USA_reds'], eff: { joinFaction: 'S', aid: { S: 10000 } }, ai: 0 }),
  // industria
  F('USA_tva', 'Tennessee Valley Authority', 12, { eff: { civ: 3, slots: 3 }, ai: 9, ic: '🏭' }),
  F('USA_detroit', "L'industria di Detroit", 11, { pre: ['USA_tva'], eff: { mil: 4, research: [R('armor')] }, ai: 8 }),
  F('USA_boeing', 'Boeing e Lockheed', 13, { pre: ['USA_tva'], eff: { research: [R('air', 1)], mods: { air_build: 0.1 } }, ai: 8 }),
  F('USA_mit', 'Laboratori del MIT', 12, { pre: ['USA_detroit', 'USA_boeing'], eff: { researchSlots: 1, research: [R('electronics', 1)] }, ai: 8, ic: '🔬' }),
  F('USA_oil', 'Petrolio texano', 14, { pre: ['USA_boeing'], eff: { mods: { resource_gain: 0.2, trade: 0.1 } }, ai: 7, ic: '🛢️' }),
  F('USA_manhattan', 'Progetto Manhattan', 12, { pre: ['USA_mit'], cond: { year: 1942 }, eff: { research: [R('nuclear', 2, true)] }, ai: 8, ic: '☢️' }),
  // esercito
  F('USA_army', "L'esercito americano", 17, { eff: { xp: { army: 30 } }, ai: 8, ic: '🎖️' }),
  F('USA_sfp', 'Potenza di fuoco superiore', 16, { pre: ['USA_army'], eff: { research: [R('doctrine', 1)], atkBonus: 0.05 }, ai: 8 }),
  F('USA_sherman', 'M4 Sherman', 18, { pre: ['USA_army'], cond: { year: 1941 }, eff: { armorTech: true, research: [R('armor', 1, true)] }, ai: 8 }),
  F('USA_marines', 'Corpo dei Marines', 16, { pre: ['USA_sfp'], eff: { divs: { inf: 3 }, atkBonus: 0.03 }, ai: 7 }),
  F('USA_airborne', 'Divisioni aviotrasportate', 18, { pre: ['USA_sherman'], eff: { atkBonus: 0.05, speedBonus: 0.05 }, ai: 6 }),
  // marina e aviazione
  F('USA_twoocean', 'Two-Ocean Navy Act', 21, { cond: { year: 1940 }, eff: { research: [R('naval', 1)], mods: { naval_build: 0.15 } }, ai: 8, ic: '⚓' }),
  F('USA_essex', 'Portaerei classe Essex', 20, { pre: ['USA_twoocean'], eff: { research: [R('naval', 1, true)] }, ai: 7 }),
  F('USA_subs', 'Guerra sottomarina nel Pacifico', 22, { pre: ['USA_twoocean'], eff: { research: [R('naval_doctrine', 1)] }, ai: 7 }),
  F('USA_liberty', 'Navi Liberty', 21, { pre: ['USA_essex', 'USA_subs'], eff: { mods: { naval_build: 0.15, supply: 0.1 } }, ai: 6 }),
  F('USA_usaaf', 'USAAF', 24, { eff: { research: [R('air', 1)], xp: { air: 40 } }, ai: 7, ic: '✈️' }),
  F('USA_b17', 'Fortezze volanti', 24, { pre: ['USA_usaaf'], eff: { research: [R('air_doctrine', 1)], atkBonus: 0.03 }, ai: 6 }),
  F('USA_p51', 'P-51 Mustang', 24, { pre: ['USA_b17'], cond: { year: 1942 }, eff: { research: [R('air', 1, true)] }, ai: 6 }),
]);

// ---------- GIAPPONE ----------
defTree('JAP', 'Impero del Giappone', [
  F('JAP_226', 'Incidente del 26 febbraio', 4, { cond: { date: '1936-02-26' }, days: 35, eff: { mods: { war_support: 0.1, stability: -0.05 } }, ai: 10, ic: '🗡️' }),
  F('JAP_military', 'Il governo dei militari', 2, { pre: ['JAP_226'], ex: ['JAP_taisho'], eff: { ppGain: 0.25, mil: 2 }, ai: 10, ic: '🎖️' }),
  F('JAP_taisho', 'Ritorno alla democrazia Taishō', 7, { pre: ['JAP_226'], eff: { ideology: 'democratic', leader: 'Kijūrō Shidehara', mods: { stability: 0.05 } }, ai: 0, ic: '🗳️' }),
  F('JAP_marco', 'Incidente del ponte Marco Polo', 1, { pre: ['JAP_military'], cond: { date: '1937-07-07', alive: 'CHI' }, eff: { war: 'CHI', mods: { war_support: 0.1 } }, ai: 10 }),
  F('JAP_anticom', 'Patto Anticomintern', 3, { pre: ['JAP_military'], cond: { date: '1936-11-25' }, eff: { mods: { stability: 0.03 }, text: 'Avvicinamento alla Germania' }, ai: 10, ic: '🤝' }),
  F('JAP_dilemma', 'Il dilemma strategico', 2, { pre: ['JAP_marco', 'JAP_anticom'], eff: { pp: 50 }, ai: 10, ic: '🧭' }),
  F('JAP_north', 'Hokushin-ron: colpire a nord', 1, { pre: ['JAP_dilemma'], ex: ['JAP_south'], eff: { atkBonus: 0.05 }, ai: 1, ic: '❄️' }),
  F('JAP_south', 'Nanshin-ron: colpire a sud', 3, { pre: ['JAP_dilemma'], eff: { research: [R('naval', 1)] }, ai: 10, ic: '🌴' }),
  F('JAP_khalkhin', 'Vendicare Khalkhin Gol', 1, { pre: ['JAP_north'], cond: { year: 1939, anyAlive: ['S', 'MON'] }, eff: { war: ['MON', 'S'] }, ai: 1 }),
  F('JAP_tripart', 'Patto Tripartito', 3, { pre: ['JAP_south'], cond: { date: '1940-09-27' }, eff: { joinFaction: 'G' }, ai: 10 }),
  F('JAP_mrs', 'Patto di neutralità nippo-sovietico', 4, { pre: ['JAP_south'], y: 5, cond: { year: 1941, alive: 'S' }, eff: { nap: 'S' }, ai: 9, ic: '🕊️' }),
  F('JAP_pearl', 'Attacco a Pearl Harbor', 3, { pre: ['JAP_tripart'], y: 6, cond: { date: '1941-12-01', alive: 'USA' }, eff: { war: 'USA', atkBonus: 0.1 }, ai: 10 }),
  F('JAP_resources', 'Le risorse del Sud', 2, { pre: ['JAP_pearl'], eff: { war: ['U', 'HOL'], mods: { resource_gain: 0.25 } }, ai: 10 }),
  F('JAP_sphere', 'Sfera di co-prosperità', 4, { pre: ['JAP_pearl'], eff: { invite: ['MAN', 'MEN', 'SIA'], civ: 3 }, ai: 9, ic: '🌏' }),
  F('JAP_ichigo', 'Operazione Ichi-Go', 3, { pre: ['JAP_resources', 'JAP_sphere'], cond: { year: 1944, atWarWith: 'CHI' }, eff: { atkBonus: 0.1, divs: { inf: 4 } }, ai: 9, ic: '⚔️' }),
  // democrazia
  F('JAP_peace', 'Pace con la Cina', 7, { pre: ['JAP_taisho'], cond: { alive: 'CHI' }, eff: { nap: 'CHI', civ: 3 }, ai: 0, ic: '🕊️' }),
  F('JAP_league', 'Tornare nella Società delle Nazioni', 7, { pre: ['JAP_peace'], eff: { joinFaction: ['U', 'USA'], mods: { stability: 0.1 } }, ai: 0 }),
  F('JAP_redsun', 'Contenere il comunismo in Asia', 7, { pre: ['JAP_league'], cond: { year: 1939, alive: 'PRC' }, eff: { war: 'PRC' }, ai: 0 }),
  // industria
  F('JAP_zaibatsu', 'Zaibatsu', 12, { eff: { civ: 3 }, ai: 9, ic: '🏭' }),
  F('JAP_manchuria', 'Sviluppare la Manciuria', 11, { pre: ['JAP_zaibatsu'], eff: { civ: 2, slots: 2, mods: { resource_gain: 0.15 } }, ai: 8 }),
  F('JAP_mobilize', 'Legge di mobilitazione generale', 13, { pre: ['JAP_zaibatsu'], cond: { year: 1938 }, eff: { mil: 4, mods: { war_support: 0.05 } }, ai: 9, ic: '⚙️' }),
  F('JAP_riken', 'RIKEN', 11, { pre: ['JAP_manchuria'], eff: { researchSlots: 1, research: [R('industry')] }, ai: 7, ic: '🔬' }),
  F('JAP_synth', 'Carburante sintetico', 13, { pre: ['JAP_mobilize'], eff: { research: [R('industry', 1)], mods: { resource_gain: 0.1 } }, ai: 7 }),
  F('JAP_total', 'Economia di guerra totale', 12, { pre: ['JAP_riken', 'JAP_synth'], cond: { war: true }, eff: { mil: 6, eqBonus: 0.1 }, ai: 8, ic: '⚙️' }),
  // esercito
  F('JAP_kwantung', "L'Armata del Kwantung", 17, { eff: { divs: { inf: 3 }, xp: { army: 30 } }, ai: 9, ic: '🎖️' }),
  F('JAP_gbp', 'Dottrina dell\'attacco notturno', 16, { pre: ['JAP_kwantung'], eff: { research: [R('doctrine', 1)], atkBonus: 0.05 }, ai: 8 }),
  F('JAP_tanks', 'Carri Chi-Ha', 18, { pre: ['JAP_kwantung'], eff: { armorTech: true, research: [R('armor')] }, ai: 6 }),
  F('JAP_jungle', 'Guerra nella giungla', 16, { pre: ['JAP_gbp'], eff: { atkBonus: 0.05, speedBonus: 0.05 }, ai: 7, ic: '🌴' }),
  F('JAP_snlf', 'Fanteria di marina', 18, { pre: ['JAP_tanks'], eff: { divs: { inf: 2 }, recBonus: 0.2 }, ai: 6 }),
  F('JAP_honor', 'Fino all\'ultimo uomo', 17, { pre: ['JAP_jungle', 'JAP_snlf'], cond: { war: true, year: 1943 }, eff: { defBonus: 0.15, mods: { entrenchment: 0.1 } }, ai: 8, ic: '🛡️' }),
  // marina e aviazione
  F('JAP_ijn', 'La Marina imperiale', 21, { eff: { xp: { navy: 50 }, research: [R('naval', 1)] }, ai: 9, ic: '⚓' }),
  F('JAP_yamato', 'Classe Yamato', 20, { pre: ['JAP_ijn'], ex: ['JAP_kido'], eff: { research: [R('naval', 1, true)], mods: { naval_build: 0.1 } }, ai: 2 }),
  F('JAP_kido', 'Kido Butai', 22, { pre: ['JAP_ijn'], eff: { research: [R('naval', 1, true), R('naval_doctrine', 1)] }, ai: 9 }),
  F('JAP_lance', 'Siluri Long Lance', 21, { pre: ['JAP_yamato', 'JAP_kido'], y: 2, eff: { research: [R('naval_doctrine')] }, ai: 0 }),
  F('JAP_lance2', 'Siluri Long Lance', 22, { pre: ['JAP_kido'], ex: ['JAP_lance'], eff: { research: [R('naval_doctrine')] }, ai: 8, ic: '⚓' }),
  F('JAP_zero', 'Mitsubishi A6M Zero', 24, { eff: { research: [R('air', 1, true)], xp: { air: 40 } }, ai: 8, ic: '✈️' }),
  F('JAP_navalair', 'Aviazione navale', 24, { pre: ['JAP_zero'], eff: { research: [R('air_doctrine', 1)], atkBonus: 0.03 }, ai: 7 }),
]);

// ---------- CINA NAZIONALISTA ----------
defTree('CHI', 'Repubblica di Cina', [
  F('CHI_newlife', 'Movimento Nuova Vita', 3, { eff: { mods: { stability: 0.05 }, ppGain: 0.2 }, ai: 9, ic: '☀️' }),
  F('CHI_xian', "L'incidente di Xi'an", 2, { pre: ['CHI_newlife'], ex: ['CHI_purge'], cond: { date: '1936-12-12' }, eff: { nap: 'PRC', mods: { war_support: 0.1 } }, ai: 10, ic: '🤝' }),
  F('CHI_purge', 'Annientare i banditi rossi', 5, { pre: ['CHI_newlife'], cond: { alive: 'PRC' }, eff: { war: 'PRC' }, ai: 0, ic: '⚔️' }),
  F('CHI_unify', 'Unificare la Cina', 1, { pre: ['CHI_xian'], cond: { anyAlive: WARLORDS }, eff: { annex: WARLORDS }, ai: 6, ic: '🏴' }),
  F('CHI_resist', 'Guerra di resistenza', 3, { pre: ['CHI_xian'], cond: { atWarWith: 'JAP' }, eff: { manpower: 500000, mods: { war_support: 0.2 } }, ai: 10, ic: '🎖️' }),
  F('CHI_scorched', 'Terra bruciata', 3, { pre: ['CHI_resist'], eff: { defBonus: 0.15, mods: { entrenchment: 0.1 } }, ai: 9, ic: '🔥' }),
  F('CHI_burma', 'La strada della Birmania', 1, { pre: ['CHI_unify'], y: 3, cond: { war: true }, eff: { equipment: 10000, mods: { supply: 0.1 } }, ai: 9, ic: '📦' }),
  F('CHI_allies', 'Alleato degli Alleati', 2, { pre: ['CHI_scorched', 'CHI_burma'], cond: { atWarWith: 'JAP', year: 1941 }, eff: { joinFaction: ['U', 'USA'] }, ai: 9 }),
  F('CHI_x_force', 'Forza X in India', 2, { pre: ['CHI_allies'], eff: { divs: { inf: 3 }, atkBonus: 0.1 }, ai: 8 }),
  F('CHI_civil', 'Riprendere la guerra civile', 5, { pre: ['CHI_purge'], y: 2, cond: { year: 1945 }, eff: { war: 'PRC' }, ai: 0, ic: '⚔️' }),
  F('CHI_wang', 'Il governo di Wang Jingwei', 6, { pre: ['CHI_purge'], eff: { ideology: 'fascist', leader: 'Wang Jingwei', joinFaction: 'JAP' }, ai: 0 }),
  // economia ed esercito
  F('CHI_german', 'I consiglieri tedeschi', 8, { eff: { xp: { army: 40 }, atkBonus: 0.05 }, ai: 8, ic: '🎖️' }),
  F('CHI_central', "L'esercito centrale", 7, { pre: ['CHI_german'], eff: { research: [R('infantry', 1)], divs: { inf: 3 } }, ai: 8 }),
  F('CHI_chongqing', 'Le industrie di Chongqing', 9, { pre: ['CHI_german'], eff: { civ: 3, slots: 3, mods: { efficiency_retention: 0.1 } }, ai: 8, ic: '🏭' }),
  F('CHI_arsenal', 'Arsenale di Hanyang', 9, { pre: ['CHI_chongqing'], eff: { mil: 3 }, ai: 8, ic: '⚙️' }),
  F('CHI_mass', 'Assalto di massa', 7, { pre: ['CHI_central'], eff: { research: [R('doctrine', 1)], mpBonus: 0.2 }, ai: 7 }),
  F('CHI_hump', "Il ponte aereo dell'Himalaya", 8, { pre: ['CHI_mass', 'CHI_arsenal'], cond: { year: 1942 }, eff: { equipment: 15000, research: [R('air')] }, ai: 7, ic: '✈️' }),  branchIndustry(11), branchArmy(14), branchAir(17),
]);

// ---------- CINA COMUNISTA ----------
defTree('PRC', 'Partito Comunista Cinese', [
  F('PRC_yanan', "La base di Yan'an", 2, { eff: { civ: 1, mods: { stability: 0.1 } }, ai: 9, ic: '☭' }),
  F('PRC_front', 'Secondo fronte unito', 1, { pre: ['PRC_yanan'], ex: ['PRC_civil'], cond: { date: '1936-12-12', alive: 'CHI' }, eff: { nap: 'CHI' }, ai: 10, ic: '🤝' }),
  F('PRC_civil', 'Nessun compromesso con il KMT', 4, { pre: ['PRC_yanan'], cond: { alive: 'CHI' }, eff: { war: 'CHI' }, ai: 0, ic: '⚔️' }),
  F('PRC_peoplewar', 'Guerra di popolo', 0, { pre: ['PRC_front'], eff: { defBonus: 0.15, recBonus: 0.3 }, ai: 9, ic: '🌾' }),
  F('PRC_8route', "L'Ottava Armata", 2, { pre: ['PRC_front'], eff: { divs: { inf: 3 }, manpower: 100000 }, ai: 9, ic: '🎖️' }),
  F('PRC_100reg', 'Offensiva dei cento reggimenti', 1, { pre: ['PRC_peoplewar', 'PRC_8route'], cond: { atWarWith: 'JAP', year: 1940 }, eff: { atkBonus: 0.1 }, ai: 9, ic: '⚔️' }),
  F('PRC_rectify', 'Campagna di rettificazione', 1, { pre: ['PRC_100reg'], eff: { ppGain: 0.5, mods: { stability: 0.1 } }, ai: 8 }),
  F('PRC_soviet', 'Il sostegno sovietico', 3, { pre: ['PRC_8route'], y: 3, cond: { alive: 'S' }, eff: { joinFaction: 'S', equipment: 5000 }, ai: 6 }),
  F('PRC_final', 'La guerra di liberazione', 2, { pre: [['PRC_rectify', 'PRC_soviet']], y: 5, cond: { year: 1945, alive: 'CHI' }, eff: { war: 'CHI', atkBonus: 0.1 }, ai: 9 }),
  F('PRC_land', 'Riforma agraria', 4, { pre: ['PRC_civil'], eff: { manpower: 200000, mods: { stability: 0.05 } }, ai: 0, ic: '🌾' }),  branchIndustry(6), branchArmy(9),
]);

// ---------- MANCIUKUÒ e MENGJIANG ----------
minorTree('MAN', 'Impero del Manciukuò', [
  F('MAN_puyi', "L'imperatore Kangde", 1, { eff: { ppGain: 0.2, mods: { stability: 0.05 } }, ai: 9, ic: '👑' }),
  F('MAN_rail', 'Ferrovia della Manciuria meridionale', 0, { pre: ['MAN_puyi'], eff: { civ: 2, mods: { supply: 0.1 } }, ai: 8, ic: '🚂' }),
  F('MAN_showa', 'Acciaierie di Anshan', 2, { pre: ['MAN_puyi'], eff: { mil: 2, mods: { resource_gain: 0.2 } }, ai: 8, ic: '⚙️' }),
  F('MAN_loyal', "Fedeltà al Giappone", 0, { pre: ['MAN_rail'], ex: ['MAN_free'], cond: { alive: 'JAP' }, eff: { joinFaction: 'JAP' }, ai: 9 }),
  F('MAN_free', 'Indipendenza vera', 2, { pre: ['MAN_showa'], eff: { ideology: 'neutral', leaveFaction: true, mods: { stability: -0.1 } }, ai: 0, ic: '🗡️' }),
], { noPol: true });

minorTree('MEN', 'Governo autonomo del Mengjiang', [
  F('MEN_prince', 'Il principe De', 1, { eff: { ppGain: 0.2 }, ai: 9, ic: '👑' }),
  F('MEN_cavalry', 'Cavalleria mongola', 0, { pre: ['MEN_prince'], eff: { speedBonus: 0.1, divs: { inf: 1 } }, ai: 8, ic: '🐎' }),
  F('MEN_japan', 'Protettorato giapponese', 2, { pre: ['MEN_prince'], cond: { alive: 'JAP' }, eff: { joinFaction: 'JAP' }, ai: 8 }),
], { noPol: true, landlocked: true });

// ---------- SIGNORI DELLA GUERRA CINESI ----------
function warlordTree(code, title, nat) {
  return minorTree(code, title, [
    ...nat,
    F(code + '_kmt', 'Sottomettersi al Kuomintang', 4, { cond: { alive: 'CHI' }, eff: { joinFaction: 'CHI', mods: { stability: 0.05 } }, ai: 3, ic: '🤝' }),
    F(code + '_japan', 'Resistere al Giappone', 4, { pre: [code + '_kmt'], cond: { atWarWith: 'JAP' }, eff: { defBonus: 0.15, manpower: 50000 }, ai: 8, ic: '🎖️' }),
  ], { landlocked: code !== 'GXC', pol: { ai: { neu: 3 } } });
}
warlordTree('SHX', 'Cricca dello Shanxi', [
  F('SHX_model', 'La provincia modello', 1, { eff: { civ: 2, mods: { stability: 0.05 } }, ai: 8, ic: '🏭' }),
  F('SHX_arsenal', 'Arsenale di Taiyuan', 1, { pre: ['SHX_model'], eff: { mil: 2 }, ai: 8, ic: '⚙️' }),
]);
warlordTree('GXC', 'Cricca del Guangxi', [
  F('GXC_model', 'Il Guangxi modello', 1, { eff: { civ: 1, manpower: 40000 }, ai: 8, ic: '🎖️' }),
  F('GXC_militia', 'Milizia popolare', 1, { pre: ['GXC_model'], eff: { defBonus: 0.1, divs: { inf: 2 } }, ai: 8 }),
]);
warlordTree('YUN', 'Cricca dello Yunnan', [
  F('YUN_tin', 'Miniere di stagno di Gejiu', 1, { eff: { civ: 1, mods: { resource_gain: 0.2 } }, ai: 8, ic: '⛏️' }),
  F('YUN_rail', 'Ferrovia dello Yunnan', 1, { pre: ['YUN_tin'], eff: { civ: 1, mods: { supply: 0.1 } }, ai: 7, ic: '🚂' }),
]);
warlordTree('XSM', 'Xibei San Ma', [
  F('XSM_hui', 'Cavalleria hui', 1, { eff: { speedBonus: 0.1, atkBonus: 0.05 }, ai: 8, ic: '🐎' }),
  F('XSM_gansu', 'Corridoio del Gansu', 1, { pre: ['XSM_hui'], eff: { defBonus: 0.1 }, ai: 7, ic: '⛰️' }),
]);
warlordTree('SIK', 'Sinkiang', [
  F('SIK_soviet', 'Il protettore sovietico', 1, { cond: { alive: 'S' }, eff: { joinFaction: 'S', equipment: 3000 }, ai: 6, ic: '☭' }),
  F('SIK_oil', 'Petrolio di Dushanzi', 1, { pre: ['SIK_soviet'], eff: { mods: { resource_gain: 0.25 } }, ai: 7, ic: '🛢️' }),
]);

// ---------- COMMONWEALTH ----------
function dominionTree(code, title, nat, o = {}) {
  return minorTree(code, title, [
    F(code + '_west', 'Statuto di Westminster', 1, { eff: { ppGain: 0.2, mods: { stability: 0.05 } }, ai: 8, ic: '📜' }),
    F(code + '_crown', 'Fedeltà alla Corona', 0, { pre: [code + '_west'], ex: [code + '_indep'], cond: { atWarWith: ['G', 'I', 'JAP'] }, eff: { joinFaction: 'U', mods: { war_support: 0.15 } }, ai: 9, ic: '👑' }),
    F(code + '_indep', 'Piena indipendenza', 2, { pre: [code + '_west'], eff: { leaveFaction: true, mods: { stability: 0.05 }, pp: 50 }, ai: 0, ic: '🗽' }),
    F(code + '_exp', 'Corpo di spedizione', 0, { pre: [code + '_crown'], eff: { divs: { inf: o.divs || 2 }, xp: { army: 25 } }, ai: 8, ic: '🎖️' }),
    ...shiftX(nat, 3),
  ], { noPol: !!o.noPol });
}

dominionTree('CAN', 'Dominion del Canada', [
  F('CAN_arsenal', 'Le fabbriche dell\'Impero', 0, { eff: { mil: 3, aid: { U: 5000 } }, ai: 8, ic: '⚙️' }),
  F('CAN_bcatp', 'Piano di addestramento aereo', 1, { eff: { research: [R('air', 1)], xp: { air: 50 } }, ai: 7, ic: '✈️' }),
  F('CAN_rcn', 'Marina reale canadese', 1, { pre: ['CAN_bcatp'], eff: { research: [R('naval_doctrine', 1)], mods: { naval_build: 0.1 } }, ai: 6, ic: '⚓' }),
  F('CAN_mines', 'Miniere del Quebec e dell\'Ontario', 0, { pre: ['CAN_arsenal'], eff: { civ: 2, mods: { resource_gain: 0.25 } }, ai: 7, ic: '⛏️' }),
], { noPol: true, divs: 3 });

dominionTree('AST', 'Commonwealth dell\'Australia', [
  F('AST_bhp', 'Acciaierie di Newcastle', 0, { eff: { mil: 2, civ: 1 }, ai: 8, ic: '⚙️' }),
  F('AST_diggers', 'I Diggers', 1, { eff: { atkBonus: 0.05, defBonus: 0.05 }, ai: 8, ic: '🎖️' }),
  F('AST_brisbane', 'Linea di Brisbane', 1, { pre: ['AST_diggers'], cond: { atWarWith: 'JAP' }, eff: { defBonus: 0.15 }, ai: 8, ic: '🧱' }),
  F('AST_usa', "Guardare all'America", 0, { pre: ['AST_bhp'], cond: { atWarWith: 'JAP', alive: 'USA' }, eff: { equipment: 5000, mods: { war_support: 0.1 } }, ai: 7, ic: '🤝' }),
], { noPol: true });

dominionTree('NZL', 'Dominion della Nuova Zelanda', [
  F('NZL_welfare', 'Lo Stato sociale di Savage', 0, { eff: { civ: 1, mods: { stability: 0.1 } }, ai: 8, ic: '🏛️' }),
  F('NZL_maori', 'Battaglione maori', 1, { eff: { atkBonus: 0.05, divs: { inf: 1 } }, ai: 7, ic: '🎖️' }),
], { noPol: true, divs: 1 });

dominionTree('SAF', 'Unione Sudafricana', [
  F('SAF_gold', "L'oro del Witwatersrand", 0, { eff: { civ: 2, mods: { trade: 0.15 } }, ai: 8, ic: '🪙' }),
  F('SAF_smuts', 'Smuts contro Hertzog', 1, { cond: { year: 1939 }, eff: { leader: 'Jan Smuts', mods: { war_support: 0.1 } }, ai: 8, ic: '🗳️' }),
  F('SAF_ob', "L'Ossewabrandwag", 2, { ex: ['SAF_smuts'], cond: { year: 1939 }, eff: { ideology: 'fascist', leader: 'Oswald Pirow', leaveFaction: true }, ai: 0, ic: '🦅' }),
  F('SAF_iscor', 'ISCOR', 0, { pre: ['SAF_gold'], eff: { mil: 2, mods: { resource_gain: 0.2 } }, ai: 7, ic: '⚙️' }),
], { noPol: true });

dominionTree('RAJ', 'India britannica', [
  F('RAJ_army', "L'Esercito indiano", 0, { eff: { manpower: 500000, divs: { inf: 4 } }, ai: 9, ic: '🎖️' }),
  F('RAJ_tata', 'Acciaierie Tata', 1, { eff: { mil: 3, civ: 2 }, ai: 8, ic: '⚙️' }),
  F('RAJ_cripps', 'La missione Cripps', 1, { pre: ['RAJ_tata'], cond: { year: 1942 }, eff: { mods: { stability: 0.1 }, pp: 50 }, ai: 7, ic: '📜' }),
  F('RAJ_quit', 'Quit India', 2, { cond: { year: 1942 }, eff: { ideology: 'democratic', leader: 'Jawaharlal Nehru', leaveFaction: true, mods: { stability: -0.1 } }, ai: 0, ic: '🕊️' }),
  F('RAJ_bose', "L'Esercito nazionale indiano", 3, { cond: { year: 1942 }, ex: ['RAJ_quit'], eff: { ideology: 'fascist', leader: 'Subhas Chandra Bose', leaveFaction: true, joinFaction: 'JAP' }, ai: 0, ic: '🦅' }),
], { noPol: true, divs: 4 });

// ---------- AMERICA LATINA ----------
minorTree('MEX', 'Stati Uniti Messicani', [
  F('MEX_cardenas', 'Le riforme di Cárdenas', 1, { eff: { mods: { stability: 0.1 }, ppGain: 0.2 }, ai: 9, ic: '🌾' }),
  F('MEX_pemex', 'Nazionalizzare il petrolio', 0, { pre: ['MEX_cardenas'], cond: { date: '1938-03-18' }, eff: { civ: 2, mods: { resource_gain: 0.3 } }, ai: 9, ic: '🛢️' }),
  F('MEX_ejido', 'Riforma agraria', 2, { pre: ['MEX_cardenas'], eff: { manpower: 50000, mods: { stability: 0.05 } }, ai: 8, ic: '🌾' }),
  F('MEX_201', 'Squadrone 201', 1, { pre: ['MEX_pemex', 'MEX_ejido'], cond: { year: 1942, atWarWith: ['G', 'JAP'] }, eff: { joinFaction: ['USA', 'U'], research: [R('air')] }, ai: 6, ic: '✈️' }),
]);

minorTree('BRA', 'Stati Uniti del Brasile', [
  F('BRA_vargas', 'L\'Estado Novo di Vargas', 1, { cond: { date: '1937-11-10' }, eff: { ppGain: 0.25, mods: { stability: 0.1 } }, ai: 9, ic: '⚖️' }),
  F('BRA_csn', 'Volta Redonda', 0, { pre: ['BRA_vargas'], eff: { mil: 2, civ: 2 }, ai: 8, ic: '⚙️' }),
  F('BRA_rubber', 'I soldati della gomma', 2, { pre: ['BRA_vargas'], eff: { mods: { resource_gain: 0.3, trade: 0.1 } }, ai: 8, ic: '🌳' }),
  F('BRA_feb', 'Força Expedicionária Brasileira', 1, { pre: ['BRA_csn', 'BRA_rubber'], cond: { year: 1942 }, eff: { joinFaction: ['USA', 'U'], divs: { inf: 2 } }, ai: 6, ic: '🐍' }),
  F('BRA_integral', 'Il colpo integralista', 3, { pre: ['BRA_rubber'], cond: { year: 1938 }, eff: { ideology: 'fascist', leader: 'Plínio Salgado' }, ai: 0, ic: '🦅' }),
]);

minorTree('ARG', 'Repubblica Argentina', [
  F('ARG_infame', 'Il decennio infame', 1, { eff: { mods: { stability: -0.05 }, civ: 1 }, ai: 8, ic: '⚖️' }),
  F('ARG_beef', 'Esportazioni di carne e grano', 0, { pre: ['ARG_infame'], eff: { civ: 2, mods: { trade: 0.2 } }, ai: 8, ic: '🐄' }),
  F('ARG_gou', 'Il Gruppo degli Ufficiali Uniti', 2, { pre: ['ARG_infame'], cond: { date: '1943-06-04' }, eff: { leader: 'Pedro Pablo Ramírez', mil: 2, mods: { war_support: 0.05 } }, ai: 6, ic: '🎖️' }),
  F('ARG_peron', 'Il giustizialismo di Perón', 2, { pre: ['ARG_gou'], cond: { year: 1944 }, eff: { leader: 'Juan Domingo Perón', civ: 2, mods: { stability: 0.15 } }, ai: 6, ic: '✊' }),
  F('ARG_abc', 'Il Patto ABC', 0, { pre: ['ARG_beef'], eff: { createFaction: 'Patto ABC', invite: ['BRA', 'CHL'] }, ai: 1, ic: '🤝' }),
]);

minorTree('CHL', 'Repubblica del Cile', [
  F('CHL_copper', 'Il rame cileno', 1, { eff: { civ: 1, mods: { resource_gain: 0.3 } }, ai: 8, ic: '⛏️' }),
  F('CHL_front', 'Il Fronte Popolare cileno', 0, { pre: ['CHL_copper'], cond: { date: '1938-10-25' }, eff: { leader: 'Pedro Aguirre Cerda', civ: 2, mods: { stability: 0.05 } }, ai: 8, ic: '🗳️' }),
  F('CHL_corfo', 'CORFO', 2, { pre: ['CHL_copper'], eff: { civ: 2, slots: 2 }, ai: 7, ic: '🏭' }),
]);

// ---------- ASIA E AFRICA ----------
minorTree('SIA', 'Regno del Siam', [
  F('SIA_phibun', 'Il governo di Phibun', 1, { cond: { year: 1938 }, eff: { leader: 'Plaek Phibunsongkhram', mods: { war_support: 0.1 } }, ai: 8, ic: '🦅' }),
  F('SIA_thai', 'Da Siam a Thailandia', 0, { pre: ['SIA_phibun'], eff: { mods: { stability: 0.1 } }, ai: 8, ic: '🐘' }),
  F('SIA_indochina', "Rivendicare l'Indocina", 2, { pre: ['SIA_phibun'], cond: { year: 1940 }, eff: { atkBonus: 0.05, mods: { war_support: 0.1 } }, ai: 7, ic: '📜' }),
  F('SIA_japan', 'Alleanza con Tokyo', 1, { pre: ['SIA_thai', 'SIA_indochina'], cond: { year: 1941, alive: 'JAP' }, eff: { joinFaction: 'JAP' }, ai: 6 }),
  F('SIA_freethai', 'Movimento Thai Libero', 3, { pre: ['SIA_indochina'], ex: ['SIA_japan'], eff: { joinFaction: ['U', 'USA'] }, ai: 1, ic: '🕊️' }),
]);

minorTree('ETH', 'Impero d\'Etiopia', [
  F('ETH_selassie', 'Appello alla Società delle Nazioni', 1, { days: 35, eff: { pp: 50, mods: { war_support: 0.2 } }, ai: 10, ic: '📜' }),
  F('ETH_arbegnoch', 'Gli Arbegnoch', 0, { pre: ['ETH_selassie'], days: 35, eff: { defBonus: 0.2, recBonus: 0.3 }, ai: 10, ic: '⛰️' }),
  F('ETH_guard', 'La Guardia imperiale', 2, { pre: ['ETH_selassie'], days: 35, eff: { divs: { inf: 2 }, atkBonus: 0.05 }, ai: 9, ic: '🎖️' }),
], { landlocked: true });

// ---------- NUOVE NAZIONI EUROPEE E MEDIORIENTALI DELLA MAPPA REALE ----------
minorTree('HOL', 'Regno dei Paesi Bassi', [
  F('HOL_neutral', 'Neutralità olandese', 1, { eff: { mods: { stability: 0.1 } }, ai: 9, ic: '⚖️' }),
  F('HOL_water', "Linea d'acqua olandese", 0, { pre: ['HOL_neutral'], eff: { defBonus: 0.2, mods: { entrenchment: 0.1 } }, ai: 9, ic: '🌊' }),
  F('HOL_indies', 'Le Indie orientali', 2, { pre: ['HOL_neutral'], eff: { civ: 2, mods: { resource_gain: 0.3 } }, ai: 8, ic: '🛢️' }),
  F('HOL_philips', 'Philips', 1, { pre: ['HOL_water', 'HOL_indies'], eff: { research: [R('electronics', 1)] }, ai: 6, ic: '📡' }),
  F('HOL_exile', 'Governo in esilio', 1, { pre: ['HOL_philips'], cond: { war: true }, eff: { joinFaction: 'U' }, ai: 6 }),
]);

minorTree('LUX', 'Granducato del Lussemburgo', [
  F('LUX_arbed', 'Acciaierie ARBED', 1, { eff: { civ: 1, mods: { resource_gain: 0.2 } }, ai: 8, ic: '⚙️' }),
  F('LUX_neutral', 'Neutralità disarmata', 1, { pre: ['LUX_arbed'], eff: { mods: { stability: 0.15 } }, ai: 8, ic: '⚖️' }),
], { landlocked: true });

function balticTree(code, title, leaderFocus) {
  return minorTree(code, title, [
    F(code + '_reg', leaderFocus, 1, { eff: { ppGain: 0.2, mods: { stability: 0.05 } }, ai: 8, ic: '⚖️' }),
    F(code + '_entente', 'Intesa baltica', 0, { pre: [code + '_reg'], eff: { createFaction: 'Intesa Baltica', invite: BALTIC.filter(k => k !== code) }, ai: 2, ic: '🤝' }),
    F(code + '_forest', 'Fratelli della foresta', 2, { pre: [code + '_reg'], eff: { defBonus: 0.15, recBonus: 0.2 }, ai: 8, ic: '🌲' }),
    F(code + '_ports', 'Commercio sul Baltico', 1, { pre: [code + '_entente', code + '_forest'], eff: { civ: 2, mods: { trade: 0.1 } }, ai: 7, ic: '⚓' }),
  ], { pol: { bloc: 'Intesa Baltica', blocInvite: BALTIC.filter(k => k !== code) } });
}
balticTree('EST', 'Repubblica di Estonia', "L'era del silenzio di Päts");
balticTree('LAT', 'Repubblica di Lettonia', 'Il regime di Ulmanis');
balticTree('LIT', 'Repubblica di Lituania', 'Il regime di Smetona');

minorTree('ALB', "Regno d'Albania", [
  F('ALB_zog', 'Re Zog I', 1, { eff: { ppGain: 0.2 }, ai: 8, ic: '👑' }),
  F('ALB_mount', 'Difesa delle montagne', 0, { pre: ['ALB_zog'], eff: { defBonus: 0.2 }, ai: 9, ic: '⛰️' }),
  F('ALB_italy', 'Dipendenza dall\'Italia', 2, { pre: ['ALB_zog'], eff: { civ: 2, mods: { stability: 0.05 } }, ai: 6, ic: '🤝' }),
]);

minorTree('IRE', 'Stato Libero d\'Irlanda', [
  F('IRE_const', 'La Costituzione del 1937', 1, { cond: { date: '1937-07-01' }, eff: { mods: { stability: 0.1 }, ppGain: 0.2 }, ai: 9, ic: '📜' }),
  F('IRE_emergency', "L'Emergenza", 0, { pre: ['IRE_const'], cond: { year: 1939 }, eff: { defBonus: 0.15, manpower: 30000 }, ai: 9, ic: '🛡️' }),
  F('IRE_ports', 'I porti del Trattato', 2, { pre: ['IRE_const'], cond: { date: '1938-04-25' }, eff: { civ: 1, mods: { trade: 0.1 } }, ai: 8, ic: '⚓' }),
]);

minorTree('ICE', 'Regno d\'Islanda', [
  F('ICE_althing', "L'Althing", 1, { eff: { mods: { stability: 0.1 } }, ai: 8, ic: '🏛️' }),
  F('ICE_fish', 'Flotta peschereccia', 1, { pre: ['ICE_althing'], eff: { civ: 1, mods: { trade: 0.1 } }, ai: 7, ic: '🐟' }),
]);

minorTree('EGY', "Regno d'Egitto", [
  F('EGY_treaty', 'Trattato anglo-egiziano', 1, { cond: { date: '1936-08-26' }, eff: { mods: { stability: 0.1 }, civ: 1 }, ai: 9, ic: '📜' }),
  F('EGY_farouk', 'Re Faruq', 0, { pre: ['EGY_treaty'], eff: { ppGain: 0.2, leader: 'Re Faruq' }, ai: 8, ic: '👑' }),
  F('EGY_cotton', 'Il cotone egiziano', 2, { pre: ['EGY_treaty'], eff: { civ: 2, mods: { trade: 0.15 } }, ai: 8, ic: '🌾' }),
  F('EGY_wafd', 'Il governo Wafd', 1, { pre: ['EGY_farouk', 'EGY_cotton'], cond: { year: 1942 }, eff: { leader: 'Mustafa el-Nahhas', mods: { stability: 0.05 } }, ai: 7, ic: '🗳️' }),
]);

minorTree('IRQ', "Regno dell'Iraq", [
  F('IRQ_oil', 'Petrolio di Kirkuk', 1, { eff: { civ: 1, mods: { resource_gain: 0.3 } }, ai: 9, ic: '🛢️' }),
  F('IRQ_square', 'Il Quadrato d\'oro', 0, { pre: ['IRQ_oil'], cond: { year: 1941 }, eff: { ideology: 'fascist', leader: 'Rashid Ali al-Gaylani', leaveFaction: true, joinFaction: 'G' }, ai: 2, ic: '🦅' }),
  F('IRQ_british', 'Fedeltà al trattato', 2, { pre: ['IRQ_oil'], ex: ['IRQ_square'], eff: { mods: { stability: 0.1 } }, ai: 5, ic: '🤝' }),
]);

minorTree('PER', 'Impero di Persia', [
  F('PER_reza', 'Le riforme di Reza Shah', 1, { eff: { civ: 2, ppGain: 0.2 }, ai: 9, ic: '👑' }),
  F('PER_rail', 'Ferrovia Transiraniana', 0, { pre: ['PER_reza'], cond: { year: 1938 }, eff: { civ: 1, mods: { supply: 0.15 } }, ai: 8, ic: '🚂' }),
  F('PER_oil', "Petrolio di Abadan", 2, { pre: ['PER_reza'], eff: { mods: { resource_gain: 0.3, trade: 0.1 } }, ai: 8, ic: '🛢️' }),
  F('PER_iran', 'Da Persia a Iran', 1, { pre: ['PER_rail', 'PER_oil'], eff: { mods: { stability: 0.1 } }, ai: 7, ic: '🦁' }),
]);

minorTree('SAU', 'Regno dell\'Arabia Saudita', [
  F('SAU_dhahran', 'Il petrolio di Dhahran', 1, { cond: { year: 1938 }, eff: { civ: 2, mods: { resource_gain: 0.4 } }, ai: 9, ic: '🛢️' }),
  F('SAU_ikhwan', 'Gli Ikhwan', 0, { eff: { defBonus: 0.1, speedBonus: 0.05 }, ai: 8, ic: '🐪' }),
  F('SAU_aramco', 'ARAMCO', 1, { pre: ['SAU_dhahran'], eff: { civ: 2, mods: { trade: 0.15 } }, ai: 7, ic: '🛢️' }),
]);
