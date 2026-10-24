'use strict';

// ============================================================================
// Alberi dei focus nazionali. Coordinate: x = colonna, y = riga (se assente la
// calcola defTree dai prerequisiti). ai: 10 = percorso storico seguito dall'IA,
// 0 = ramo alternativo che l'IA non sceglie mai.
// ============================================================================

const R = (cat, bonus = 0.5, aot = false, uses = 1) => ({ cat, bonus, aot, uses });
const shiftX = (list, dx) => list.map(f => ({ ...f, x: f.x + dx }));

// ---------- rami condivisi ----------

function branchIndustry(x) {
  return shiftX([
    F('ind_effort', 'Sforzo industriale', 1, { eff: { civ: 1, mods: { research_speed: 0.03 } }, ai: 6 }),
    F('ind_constr1', 'Sforzo edilizio', 0, { pre: ['ind_effort'], eff: { civ: 2, slots: 1 }, ai: 5 }),
    F('ind_prod1', 'Sforzo produttivo', 2, { pre: ['ind_effort'], eff: { mil: 2 }, ai: 5 }),
    F('ind_constr2', 'Sforzo edilizio II', 0, { pre: ['ind_constr1'], eff: { civ: 2, mods: { construction_speed: 0.05 } }, ai: 4 }),
    F('ind_lab', 'Laboratori nazionali', 1, { pre: ['ind_constr1', 'ind_prod1'], eff: { researchSlots: 1, research: [R('industry')] }, ai: 4 }),
    F('ind_prod2', 'Sforzo produttivo II', 2, { pre: ['ind_prod1'], eff: { mil: 2, mods: { production_efficiency: 0.05 } }, ai: 4 }),
    F('ind_infra', 'Sforzo infrastrutturale', 0, { pre: ['ind_constr2'], eff: { civ: 1, speedBonus: 0.05, mods: { supply: 0.1 } }, ai: 3 }),
    F('ind_res', 'Sfruttamento delle risorse', 1, { pre: ['ind_lab'], eff: { mods: { resource_gain: 0.15 } }, ai: 3 }),
    F('ind_prod3', 'Sforzo produttivo III', 2, { pre: ['ind_prod2'], eff: { mil: 3, eqBonus: 0.05 }, ai: 3 }),
    F('ind_share', 'Condivisione tecnologica', 1, { pre: ['ind_res'], cond: { faction: true }, eff: { mods: { research_speed: 0.05 } }, ai: 2 }),
  ], x);
}

function branchArmy(x) {
  return shiftX([
    F('army_effort', 'Sforzo militare', 1, { eff: { xp: { army: 25 }, atkBonus: 0.03 }, ai: 5 }),
    F('army_eq1', "Sforzo per l'equipaggiamento", 0, { pre: ['army_effort'], eff: { research: [R('infantry')], eqBonus: 0.05 }, ai: 4 }),
    F('army_doct', 'Sforzo dottrinale', 2, { pre: ['army_effort'], eff: { research: [R('doctrine')], xp: { army: 25 } }, ai: 4 }),
    F('army_mot', 'Motorizzazione', 0, { pre: ['army_eq1'], eff: { research: [R('support')], speedBonus: 0.05 }, ai: 3 }),
    F('army_fort', 'Fortificazioni di confine', 1, { pre: ['army_effort'], y: 2, eff: { defBonus: 0.1, mods: { entrenchment: 0.1 } }, ai: 4 }),
    F('army_cons', 'Leva obbligatoria', 2, { pre: ['army_doct'], eff: { manpower: 40000, mpBonus: 0.15, mods: { conscription: 0.01 } }, ai: 4 }),
    F('army_eq2', "Sforzo per l'equipaggiamento II", 0, { pre: ['army_mot'], eff: { research: [R('artillery')], atkBonus: 0.05 }, ai: 3 }),
    F('army_armor', 'Sforzo corazzato', 1, { pre: ['army_mot', 'army_fort'], eff: { armorTech: true, research: [R('armor')] }, ai: 2 }),
    F('army_spec', 'Forze speciali', 2, { pre: ['army_cons'], eff: { atkBonus: 0.05, recBonus: 0.2 }, ai: 3 }),
  ], x);
}

function branchAir(x) {
  return shiftX([
    F('air_effort', 'Sforzo aeronautico', 0, { eff: { xp: { air: 25 }, research: [R('air')] }, ai: 3 }),
    F('air_fight', 'Caccia intercettori', 0, { pre: ['air_effort'], eff: { research: [R('air')], defBonus: 0.03 }, ai: 2 }),
    F('air_cas', 'Supporto aereo ravvicinato', 1, { pre: ['air_effort'], y: 1, eff: { research: [R('air')], atkBonus: 0.04 }, ai: 2 }),
    F('air_doct', 'Dottrina aerea', 0, { pre: ['air_fight'], eff: { research: [R('air_doctrine', 1)], xp: { air: 25 } }, ai: 2 }),
  ], x);
}

function branchNavy(x) {
  return shiftX([
    F('navy_effort', 'Sforzo navale', 0, { eff: { xp: { navy: 25 }, research: [R('naval')] }, ai: 2 }),
    F('navy_subs', 'Guerra sottomarina', 0, { pre: ['navy_effort'], eff: { research: [R('naval')], mods: { naval_build: 0.05 } }, ai: 1 }),
    F('navy_coast', 'Difesa costiera', 1, { pre: ['navy_effort'], y: 1, eff: { research: [R('naval_doctrine')], defBonus: 0.03 }, ai: 1 }),
  ], x);
}

// rami politici generici: quattro strade esclusive
function branchPolitics(x, o = {}) {
  const dem = o.dem || ['U', 'F'], com = o.com || ['S'], fas = o.fas || ['G', 'I'];
  return shiftX([
    F('pol_effort', 'Sforzo politico', 3, { eff: { ppGain: 0.25 }, ai: 6 }),
    F('pol_lib', 'Etica della libertà', 0, { pre: ['pol_effort'], ex: ['pol_coll', 'pol_nat', 'pol_neut'], eff: { mods: { stability: 0.05 } }, ai: o.ai?.dem ?? 1 }),
    F('pol_coll', 'Ideologia collettivista', 2, { pre: ['pol_effort'], ex: ['pol_nat', 'pol_neut'], eff: { mods: { war_support: 0.05 } }, ai: o.ai?.com ?? 0.2 }),
    F('pol_nat', 'Ideologia nazionalista', 4, { pre: ['pol_effort'], ex: ['pol_neut'], eff: { mods: { war_support: 0.05 } }, ai: o.ai?.fas ?? 0.5 }),
    F('pol_neut', 'Neutralità armata', 6, { pre: ['pol_effort'], eff: { mods: { stability: 0.1 }, defBonus: 0.05 }, ai: o.ai?.neu ?? 2 }),
    F('pol_dem', 'Riforme democratiche', 0, { pre: ['pol_lib'], eff: { ideology: 'democratic', mods: { stability: 0.05 } }, ai: 3 }),
    F('pol_com', 'Governo rivoluzionario', 2, { pre: ['pol_coll'], eff: { ideology: 'communist', mods: { war_support: 0.05 } }, ai: 3 }),
    F('pol_fas', 'Regime autoritario', 4, { pre: ['pol_nat'], eff: { ideology: 'fascist', mods: { war_support: 0.1 } }, ai: 3 }),
    F('pol_neut2', 'Ministero della difesa', 6, { pre: ['pol_neut'], eff: { defBonus: 0.05, mods: { entrenchment: 0.1 } }, ai: 3 }),
    F('pol_dem2', 'Allinearsi con gli Alleati', 0, { pre: ['pol_dem'], cond: { ideology: 'democratic', war: true }, eff: { joinFaction: dem }, ai: 2 }),
    F('pol_com2', 'Fratellanza socialista', 2, { pre: ['pol_com'], cond: { ideology: 'communist' }, eff: { joinFaction: com }, ai: 2 }),
    F('pol_fas2', 'Allinearsi con l\'Asse', 4, { pre: ['pol_fas'], cond: { year: 1938, ideology: 'fascist' }, eff: { joinFaction: fas }, ai: 2 }),
    F('pol_neut3', 'Blocco regionale', 6, { pre: ['pol_neut2'], cond: { noFaction: true, year: 1938 }, eff: { createFaction: o.bloc || 'Blocco neutrale', invite: o.blocInvite || [] }, ai: 0.3 }),
    F('pol_intern', 'Riforme interne', 3, { pre: ['pol_effort'], y: 1, eff: { mods: { stability: 0.05 }, pp: 30 }, ai: 4 }),
    F('pol_prop', 'Ministero della propaganda', 3, { pre: ['pol_intern'], eff: { ppGain: 0.25, mods: { war_support: 0.05 } }, ai: 3 }),
  ], x);
}

// ---------- GERMANIA ----------
defTree('G', 'Il Terzo Reich', [
  // politica storica
  F('G_rhein', 'Rimilitarizzare la Renania', 4, { cond: { date: '1936-03-01' }, eff: { mil: 1, mods: { war_support: 0.05 } }, ai: 10, ic: '🦅' }),
  F('G_hitler', 'Consolidare il Führerprinzip', 2, { pre: ['G_rhein'], ex: ['G_oppose'], eff: { ppGain: 0.25, mods: { stability: 0.05 } }, ai: 10, ic: '🦅' }),
  F('G_anschluss', 'Anschluss', 0, { pre: ['G_hitler'], cond: { year: 1938, alive: 'A' }, eff: { annex: 'A' }, ai: 10 }),
  F('G_romeberlin', 'Asse Roma-Berlino', 2, { pre: ['G_hitler'], cond: { date: '1936-10-01' }, eff: { invite: 'I' }, ai: 10 }),
  F('G_anticom', 'Patto Anticomintern', 4, { pre: ['G_hitler'], cond: { date: '1936-11-01' }, eff: { invite: 'H', mods: { stability: 0.03 } }, ai: 10 }),
  F('G_sudeten', 'Rivendicare i Sudeti', 0, { pre: ['G_anschluss'], cond: { year: 1938, alive: 'C' }, eff: { annex: 'C' }, ai: 10 }),
  F('G_steel', "Patto d'Acciaio", 2, { pre: ['G_romeberlin'], cond: { date: '1939-05-01' }, eff: { invite: 'I', mods: { war_support: 0.05 } }, ai: 10 }),
  F('G_danube', 'Diplomazia danubiana', 4, { pre: ['G_anticom'], cond: { year: 1940 }, eff: { invite: ['R', 'L'] }, ai: 10 }),
  F('G_danzig', 'Danzica o guerra', 0, { pre: ['G_sudeten'], cond: { date: '1939-08-01', alive: 'P' }, eff: { war: 'P' }, ai: 10 }),
  F('G_mrp', 'Patto Molotov-Ribbentrop', 2, { pre: ['G_sudeten', 'G_steel'], cond: { year: 1939, alive: 'S' }, eff: { nap: 'S' }, ai: 10 }),
  F('G_tripart', 'Patto Tripartito', 4, { pre: ['G_danube'], cond: { year: 1940 }, eff: { invite: ['Y', 'K', 'JAP'], mods: { war_support: 0.05 } }, ai: 10 }),
  F('G_weser', 'Weserübung', 0, { pre: ['G_danzig'], cond: { date: '1940-03-15', war: true }, eff: { war: ['D', 'N'] }, ai: 10 }),
  F('G_gelb', 'Fall Gelb', 1, { pre: ['G_danzig'], cond: { date: '1940-04-15', war: true }, eff: { war: 'B', atkBonus: 0.05 }, ai: 10 }),
  F('G_balkan', 'Operazione Marita', 3, { pre: ['G_tripart'], cond: { year: 1941 }, eff: { war: ['Y', 'Q'] }, ai: 10 }),
  F('G_barba', 'Lebensraum a Est', 2, { pre: ['G_mrp', 'G_gelb'], cond: { date: '1941-05-01', alive: 'S' }, eff: { war: 'S', mods: { war_support: 0.1 } }, ai: 10, y: 7 }),
  F('G_total', 'Guerra totale', 2, { pre: ['G_barba'], cond: { war: true, year: 1943 }, eff: { manpower: 300000, mpBonus: 0.3, eqBonus: 0.1, mods: { stability: -0.1, war_support: 0.15 } }, ai: 10 }),
  // politica alternativa
  F('G_oppose', 'Opporsi a Hitler', 8, { pre: ['G_rhein'], eff: { pp: 50, mods: { stability: -0.1 } }, ai: 0, ic: '🗡️' }),
  F('G_kaiser', 'Restaurare il Kaiser', 6, { pre: ['G_oppose'], ex: ['G_weimar', 'G_kpd'], eff: { ideology: 'neutral', leader: 'Guglielmo di Prussia', leaveFaction: true, mods: { stability: 0.05 } }, ai: 0, ic: '👑' }),
  F('G_weimar', 'Ritorno alla repubblica', 8, { pre: ['G_oppose'], ex: ['G_kpd'], eff: { ideology: 'democratic', leader: 'Carl Goerdeler', leaveFaction: true, mods: { stability: 0.1 } }, ai: 0 }),
  F('G_kpd', 'Rivolta spartachista', 10, { pre: ['G_oppose'], eff: { ideology: 'communist', leader: 'Ernst Thälmann', leaveFaction: true, mods: { war_support: 0.1 } }, ai: 0 }),
  F('G_k_empire', 'Ritorno all\'Impero', 6, { pre: ['G_kaiser'], eff: { createFaction: 'Lega degli Imperi Centrali', mods: { stability: 0.1, war_support: 0.05 } }, ai: 0 }),
  F('G_k_mittel', 'Mitteleuropa', 6, { pre: ['G_k_empire'], eff: { invite: ['A', 'H', 'L', 'K'] }, ai: 0, ic: '🤝' }),
  F('G_k_1914', 'Rivendicare i confini del 1914', 6, { pre: ['G_k_mittel'], cond: { year: 1939, alive: 'P' }, eff: { war: 'P' }, ai: 0 }),
  F('G_w_west', 'Riconciliazione con l\'Occidente', 8, { pre: ['G_weimar'], eff: { joinFaction: ['U', 'F'], civ: 2 }, ai: 0 }),
  F('G_w_disarm', 'Disarmo controllato', 8, { pre: ['G_w_west'], eff: { civ: 4, mods: { stability: 0.1 } }, ai: 0, ic: '🕊️' }),
  F('G_w_europe', 'Unione europea', 8, { pre: ['G_w_disarm'], cond: { year: 1940 }, eff: { invite: ['A', 'C', 'B', 'HOL', 'LUX', 'D'] }, ai: 0 }),
  F('G_r_comintern', 'Asse Berlino-Mosca', 10, { pre: ['G_kpd'], eff: { joinFaction: 'S' }, ai: 0 }),
  F('G_r_council', 'Repubblica dei consigli', 10, { pre: ['G_r_comintern'], eff: { civ: 2, mil: 2, mods: { stability: 0.05 } }, ai: 0, ic: '☭' }),
  F('G_r_west', 'Rivoluzione in Occidente', 10, { pre: ['G_r_council'], cond: { year: 1939, alive: 'F' }, eff: { war: 'F' }, ai: 0 }),
  // economia
  F('G_4year', 'Piano quadriennale', 14, { eff: { civ: 2, mil: 1 }, ai: 10 }),
  F('G_autarky', 'Autarchia', 12, { pre: ['G_4year'], eff: { mods: { resource_gain: 0.15 } }, ai: 8 }),
  F('G_kdf', 'Volkswagen e KdF', 14, { pre: ['G_4year'], eff: { civ: 3, mods: { stability: 0.05 } }, ai: 8 }),
  F('G_reichsw', 'Reichswerke Hermann Göring', 16, { pre: ['G_4year'], eff: { mil: 3 }, ai: 9 }),
  F('G_synth', 'Carburante sintetico', 12, { pre: ['G_autarky'], eff: { research: [R('industry', 1)], mods: { resource_gain: 0.1 } }, ai: 7 }),
  F('G_autobahn', 'Autobahn', 14, { pre: ['G_kdf'], eff: { civ: 2, speedBonus: 0.05, mods: { supply: 0.1 } }, ai: 7 }),
  F('G_ruhr', 'Acciaierie della Ruhr', 16, { pre: ['G_reichsw'], eff: { mil: 3, mods: { production_efficiency: 0.05 } }, ai: 8 }),
  F('G_kwi', 'Istituti Kaiser Wilhelm', 13, { pre: ['G_synth', 'G_autobahn'], eff: { researchSlots: 1, mods: { research_speed: 0.05 } }, ai: 6, ic: '🔬' }),
  F('G_wareco', 'Economia di guerra', 16, { pre: ['G_ruhr'], cond: { year: 1939 }, eff: { mil: 5, eqBonus: 0.1, mods: { stability: -0.05 } }, ai: 8 }),
  F('G_speer', 'Ministero Speer', 16, { pre: ['G_wareco'], cond: { war: true, year: 1942 }, eff: { mil: 4, mods: { production_efficiency: 0.1, efficiency_retention: 0.1 } }, ai: 8 }),
  // esercito e aviazione
  F('G_wehr', 'Riarmo della Wehrmacht', 20, { eff: { xp: { army: 30 }, manpower: 50000, mil: 1, atkBonus: 0.05, defBonus: 0.1 }, ai: 10, ic: '🎖️' }),
  F('G_panzer', 'Panzerwaffe', 18, { pre: ['G_wehr'], eff: { armorTech: true, research: [R('armor', 1, true)] }, ai: 9 }),
  F('G_infantry', 'Fanteria tedesca', 20, { pre: ['G_wehr'], eff: { research: [R('infantry')], atkBonus: 0.05 }, ai: 7 }),
  F('G_luftwaffe', 'Luftwaffe', 22, { pre: ['G_wehr'], eff: { research: [R('air', 1, true)], xp: { air: 50 } }, ai: 8 }),
  F('G_blitz', 'Blitzkrieg', 18, { pre: ['G_panzer'], eff: { research: [R('doctrine', 1)], atkBonus: 0.1, speedBonus: 0.1 }, ai: 9 }),
  F('G_motor', 'Divisioni motorizzate', 20, { pre: ['G_panzer', 'G_infantry'], eff: { research: [R('support')], speedBonus: 0.05 }, ai: 7 }),
  F('G_westwall', 'Vallo occidentale', 21, { pre: ['G_infantry'], cond: { year: 1938 }, eff: { defBonus: 0.15, mods: { entrenchment: 0.1 } }, ai: 9, ic: '🧱' }),
  F('G_stuka', 'Stuka', 22, { pre: ['G_luftwaffe'], eff: { research: [R('air')], atkBonus: 0.05 }, ai: 7 }),
  F('G_tiger', 'Carri pesanti', 18, { pre: ['G_blitz'], cond: { year: 1941 }, eff: { research: [R('armor', 1, true)], atkBonus: 0.05 }, ai: 7 }),
  F('G_ss', 'Waffen-SS', 20, { pre: ['G_motor'], cond: { year: 1938 }, eff: { divs: { inf: 3, arm: 1 } }, ai: 7 }),
  F('G_jet', 'Motori a reazione', 22, { pre: ['G_stuka'], cond: { year: 1942 }, eff: { research: [R('air', 1, true)] }, ai: 6 }),
  F('G_v2', 'Armi di rappresaglia', 22, { pre: ['G_jet'], eff: { research: [R('rocketry', 1, true)] }, ai: 6, ic: '🚀' }),
  // marina
  F('G_kriegs', 'Kriegsmarine', 25, { eff: { xp: { navy: 25 }, research: [R('naval')] }, ai: 4 }),
  F('G_zplan', 'Piano Z', 24, { pre: ['G_kriegs'], ex: ['G_uboat'], eff: { research: [R('naval', 1)], mods: { naval_build: 0.1 } }, ai: 1 }),
  F('G_uboat', 'Flotta di U-Boot', 26, { pre: ['G_kriegs'], eff: { research: [R('naval', 1)], mods: { naval_build: 0.05 } }, ai: 4 }),
  F('G_wolf', 'Branchi di lupi', 26, { pre: ['G_uboat'], cond: { war: true }, eff: { research: [R('naval_doctrine', 1)] }, ai: 4 }),
  F('G_bism', 'Classe Bismarck', 24, { pre: ['G_zplan'], eff: { research: [R('naval', 1, true)] }, ai: 1 }),
]);

// ---------- UNIONE SOVIETICA ----------
defTree('S', 'Unione delle Repubbliche Socialiste Sovietiche', [
  F('S_party', 'Congresso del Partito', 4, { eff: { ppGain: 0.25 }, ai: 10, ic: '☭' }),
  F('S_purge', 'La Grande Purga', 1, { pre: ['S_party'], ex: ['S_bukharin', 'S_trotsky', 'S_tsar'], eff: { ppGain: 0.5, atkBonus: -0.1, mods: { stability: 0.1 } }, ai: 10, ic: '⛓️' }),
  F('S_bukharin', 'Riabilitare Bucharin', 4, { pre: ['S_party'], ex: ['S_trotsky', 'S_tsar'], eff: { leader: 'Nikolaj Bucharin', mods: { stability: 0.05 } }, ai: 0 }),
  F('S_trotsky', 'Il ritorno di Trotsky', 6, { pre: ['S_party'], ex: ['S_tsar'], eff: { leader: 'Lev Trotsky', mods: { war_support: 0.1, stability: -0.1 } }, ai: 0 }),
  F('S_tsar', 'Il complotto dei Bianchi', 8, { pre: ['S_party'], eff: { ideology: 'neutral', leader: 'Vladimir Kirillovič', leaveFaction: true, mods: { stability: -0.15 } }, ai: 0, ic: '👑' }),
  // storico
  F('S_nkvd', "Rafforzare l'NKVD", 0, { pre: ['S_purge'], eff: { mods: { stability: 0.1 } }, ai: 10 }),
  F('S_rehab', 'Riabilitare gli ufficiali', 2, { pre: ['S_purge'], cond: { year: 1939 }, eff: { atkBonus: 0.1, xp: { army: 50 } }, ai: 9, ic: '🎖️' }),
  F('S_mrp', 'Patto Molotov-Ribbentrop', 0, { pre: ['S_nkvd'], cond: { year: 1939, alive: 'G' }, eff: { nap: 'G' }, ai: 10 }),
  F('S_winter', "Guerra d'Inverno", 0, { pre: ['S_mrp'], cond: { date: '1939-11-01', alive: 'K' }, eff: { war: 'K' }, ai: 10 }),
  F('S_baltic', 'Sfera d\'influenza baltica', 1, { pre: ['S_mrp'], y: 4, cond: { year: 1940, anyAlive: ['X', 'EST', 'LAT', 'LIT'] }, eff: { annex: ['X', 'EST', 'LAT', 'LIT'] }, ai: 10 }),
  F('S_stavka', 'Stavka', 2, { pre: ['S_rehab'], cond: { war: true }, eff: { atkBonus: 0.05, mods: { planning: 0.1 } }, ai: 8 }),
  F('S_gpw', 'Grande Guerra Patriottica', 1, { pre: [['S_winter', 'S_baltic']], y: 5, cond: { atWarWith: ['G', 'I', 'R', 'H', 'K'] }, eff: { manpower: 300000, defBonus: 0.1, mods: { war_support: 0.2 } }, ai: 10 }),
  F('S_nostep', 'Non un passo indietro', 0, { pre: ['S_gpw'], eff: { defBonus: 0.15, mods: { entrenchment: 0.1 } }, ai: 10 }),
  F('S_lend', 'Affitti e prestiti', 2, { pre: ['S_gpw'], eff: { equipment: 20000 }, ai: 9, ic: '📦' }),
  F('S_bagration', 'Operazione Bagration', 1, { pre: ['S_nostep', 'S_lend'], cond: { year: 1943 }, eff: { atkBonus: 0.15, speedBonus: 0.05 }, ai: 10, ic: '⚔️' }),
  // Bucharin
  F('S_nep', 'Nuova Politica Economica', 4, { pre: ['S_bukharin'], eff: { civ: 4, mods: { stability: 0.05 } }, ai: 0, ic: '🏭' }),
  F('S_coexist', 'Coesistenza pacifica', 4, { pre: ['S_nep'], eff: { nap: ['P', 'K', 'R'], mods: { stability: 0.1 } }, ai: 0, ic: '🕊️' }),
  F('S_popfront', 'Fronte unito antifascista', 4, { pre: ['S_coexist'], cond: { year: 1938 }, eff: { leaveFaction: true, joinFaction: ['U', 'F'] }, ai: 0 }),
  // Trotsky
  F('S_perm', 'Rivoluzione permanente', 6, { pre: ['S_trotsky'], eff: { xp: { army: 50 }, atkBonus: 0.05 }, ai: 0, ic: '☭' }),
  F('S_warsaw', 'Marcia su Varsavia', 6, { pre: ['S_perm'], cond: { year: 1938, alive: 'P' }, eff: { war: 'P' }, ai: 0 }),
  F('S_eurorev', 'Rivoluzione europea', 6, { pre: ['S_warsaw'], eff: { invite: ['K', 'X', 'EST', 'LAT', 'LIT', 'R', 'L', 'Y'], mods: { war_support: 0.1 } }, ai: 0, ic: '🤝' }),
  // Zar
  F('S_holyrus', 'Santa Russia', 8, { pre: ['S_tsar'], eff: { mods: { stability: 0.2 }, manpower: 100000 }, ai: 0, ic: '✝️' }),
  F('S_restore', 'Restaurare la Duma', 8, { pre: ['S_holyrus'], eff: { civ: 3, ppGain: 0.25 }, ai: 0 }),
  F('S_entente', 'Ritorno all\'Intesa', 8, { pre: ['S_restore'], cond: { year: 1938 }, eff: { joinFaction: ['F', 'U'] }, ai: 0 }),
  // industria
  F('S_5yp', 'Secondo piano quinquennale', 13, { eff: { civ: 3 }, ai: 10 }),
  F('S_stakh', 'Movimento stacanovista', 11, { pre: ['S_5yp'], eff: { mil: 2, mods: { production_efficiency: 0.05 } }, ai: 9 }),
  F('S_ural', 'Industrializzare gli Urali', 13, { pre: ['S_5yp'], eff: { civ: 3, slots: 3 }, ai: 9 }),
  F('S_baku', 'Petrolio di Baku', 15, { pre: ['S_5yp'], eff: { mods: { resource_gain: 0.2 } }, ai: 7 }),
  F('S_3yp', 'Terzo piano quinquennale', 12, { pre: ['S_stakh', 'S_ural'], cond: { year: 1938 }, eff: { mil: 4, civ: 2 }, ai: 9 }),
  F('S_transsib', 'Ferrovia Transiberiana', 14, { pre: ['S_ural'], eff: { speedBonus: 0.05, mods: { supply: 0.15 } }, ai: 7 }),
  F('S_evac', 'Evacuare le industrie', 12, { pre: ['S_3yp'], cond: { war: true }, eff: { mil: 3, slots: 2, mods: { efficiency_retention: 0.2 } }, ai: 9 }),
  F('S_academy', 'Accademia delle Scienze', 14, { pre: ['S_transsib'], eff: { researchSlots: 1, mods: { research_speed: 0.05 } }, ai: 6, ic: '🔬' }),
  F('S_tankograd', 'Tankograd', 12, { pre: ['S_evac'], eff: { mil: 4, eqBonus: 0.1 }, ai: 8 }),
  // esercito
  F('S_rkka', "Riforma dell'Armata Rossa", 19, { eff: { xp: { army: 40 } }, ai: 9, ic: '🎖️' }),
  F('S_deep', 'Battaglia in profondità', 17, { pre: ['S_rkka'], ex: ['S_massdoc'], eff: { research: [R('doctrine', 1)], atkBonus: 0.05 }, ai: 2 }),
  F('S_massdoc', 'Assalto di massa', 19, { pre: ['S_rkka'], eff: { research: [R('doctrine', 1)], manpower: 150000, mpBonus: 0.2 }, ai: 9 }),
  F('S_vvs', 'Rinnovare la VVS', 21, { pre: ['S_rkka'], eff: { research: [R('air', 1)], xp: { air: 30 } }, ai: 6 }),
  F('S_t34', 'Progetto T-34', 17, { pre: ['S_deep'], cond: { year: 1939 }, eff: { armorTech: true, research: [R('armor', 1, true)] }, ai: 8 }),
  F('S_t34b', 'Progetto T-34', 18, { pre: ['S_massdoc'], cond: { year: 1939 }, ex: ['S_t34'], eff: { armorTech: true, research: [R('armor', 1, true)] }, ai: 8, ic: '🛡️' }),
  F('S_katy', 'Katjuša', 19, { pre: ['S_massdoc'], y: 3, cond: { year: 1940 }, eff: { research: [R('artillery', 1, true)], atkBonus: 0.05 }, ai: 8 }),
  F('S_il2', 'Il-2 Šturmovik', 21, { pre: ['S_vvs'], eff: { research: [R('air')], atkBonus: 0.05 }, ai: 6 }),
  F('S_guards', 'Divisioni della Guardia', 19, { pre: ['S_katy'], cond: { war: true }, eff: { divs: { inf: 4 }, defBonus: 0.05 }, ai: 8 }),
  F('S_partisan', 'Partigiani sovietici', 21, { pre: ['S_il2'], cond: { war: true }, eff: { defBonus: 0.05, recBonus: 0.2 }, ai: 6 }),
  // marina
  F('S_fleet', 'Grande flotta oceanica', 23, { eff: { xp: { navy: 25 }, research: [R('naval', 1)] }, ai: 2 }),
  F('S_subs', 'Sommergibili del Baltico', 23, { pre: ['S_fleet'], eff: { research: [R('naval')], mods: { naval_build: 0.05 } }, ai: 2 }),
]);

// ---------- REGNO UNITO ----------
defTree('U', 'Regno Unito', [
  F('U_crown', 'La crisi della Corona', 4, { cond: { date: '1936-06-01' }, eff: { pp: 25 }, ai: 10, ic: '👑' }),
  F('U_abdic', 'Abdicazione di Edoardo VIII', 2, { pre: ['U_crown'], ex: ['U_edward', 'U_unions'], eff: { mods: { stability: 0.1 } }, ai: 10, ic: '👑' }),
  F('U_edward', 'Il Re resta sul trono', 6, { pre: ['U_crown'], ex: ['U_unions'], eff: { mods: { stability: -0.05, war_support: 0.05 } }, ai: 0, ic: '👑' }),
  F('U_unions', 'Sciopero generale', 8, { pre: ['U_crown'], eff: { mods: { stability: -0.1 } }, ai: 0, ic: '✊' }),
  // storico
  F('U_appease', 'Appeasement', 1, { pre: ['U_abdic'], eff: { mods: { stability: 0.1 }, civ: 1 }, ai: 10, ic: '🕊️' }),
  F('U_rearm', 'Riarmo della Gran Bretagna', 3, { pre: ['U_abdic'], cond: { year: 1937 }, eff: { mil: 3, mods: { war_support: 0.05 } }, ai: 10 }),
  F('U_guar', 'Garanzie europee', 1, { pre: ['U_appease'], cond: { date: '1939-03-01' }, eff: { guarantee: ['P', 'Q', 'R'] }, ai: 10 }),
  F('U_entente', 'Allargare l\'Intesa', 3, { pre: ['U_rearm'], cond: { year: 1939, war: true }, eff: { invite: ['B', 'HOL', 'N', 'D', 'W'] }, ai: 10 }),
  F('U_churchill', 'Churchill al governo', 2, { pre: ['U_guar', 'U_entente'], cond: { war: true }, eff: { leader: 'Winston Churchill', ppGain: 0.5, mods: { war_support: 0.2 } }, ai: 10, ic: '🎩' }),
  F('U_turkey', 'Corteggiare la Turchia', 0, { pre: ['U_churchill'], cond: { alive: 'T' }, eff: { invite: ['T', 'Q', 'Y'] }, ai: 8 }),
  F('U_arsenal', 'Arsenale della democrazia', 2, { pre: ['U_churchill'], eff: { equipment: 15000, mil: 2 }, ai: 9, ic: '📦' }),
  F('U_combined', 'Offensiva combinata di bombardamento', 4, { pre: ['U_churchill'], cond: { year: 1942 }, eff: { research: [R('air_doctrine', 1)], atkBonus: 0.05 }, ai: 8, ic: '✈️' }),
  F('U_overlord', 'Secondo fronte', 2, { pre: ['U_arsenal'], cond: { year: 1943, war: true }, eff: { atkBonus: 0.1, divs: { inf: 4, arm: 2 } }, ai: 10, ic: '⚔️' }),
  // fascista
  F('U_mosley', 'Mosley al governo', 6, { pre: ['U_edward'], eff: { ideology: 'fascist', leader: 'Oswald Mosley', leaveFaction: true }, ai: 0 }),
  F('U_bufp', 'Unione Britannica', 6, { pre: ['U_mosley'], eff: { mil: 3, mods: { war_support: 0.1 } }, ai: 0, ic: '⚙️' }),
  F('U_naxis', 'Patto con Berlino', 6, { pre: ['U_bufp'], cond: { year: 1938 }, eff: { joinFaction: 'G' }, ai: 0 }),
  F('U_ireland', 'Rivendicare l\'Europa', 6, { pre: ['U_naxis'], cond: { year: 1939, alive: 'F' }, eff: { war: 'F' }, ai: 0 }),
  // comunista
  F('U_pollitt', 'Repubblica Popolare Britannica', 8, { pre: ['U_unions'], eff: { ideology: 'communist', leader: 'Harry Pollitt', leaveFaction: true }, ai: 0 }),
  F('U_nation', 'Nazionalizzare l\'industria', 8, { pre: ['U_pollitt'], eff: { civ: 3, mil: 2 }, ai: 0, ic: '🏭' }),
  F('U_comint', 'Unirsi al Comintern', 8, { pre: ['U_nation'], eff: { joinFaction: 'S' }, ai: 0 }),
  // industria
  F('U_shadow', 'Fabbriche ombra', 12, { eff: { mil: 3 }, ai: 9 }),
  F('U_empire', 'Risorse dell\'Impero', 10, { pre: ['U_shadow'], eff: { civ: 2, mods: { resource_gain: 0.2 } }, ai: 8 }),
  F('U_aero', 'Industria aeronautica', 12, { pre: ['U_shadow'], eff: { mil: 2, mods: { air_build: 0.1 } }, ai: 8 }),
  F('U_trade', 'Commercio imperiale', 14, { pre: ['U_shadow'], eff: { civ: 2, mods: { trade: 0.15 } }, ai: 7 }),
  F('U_radar', 'Catena di radar', 11, { pre: ['U_empire', 'U_aero'], eff: { research: [R('electronics', 1)], defBonus: 0.05 }, ai: 8, ic: '📡' }),
  F('U_ultra', 'Bletchley Park', 13, { pre: ['U_aero', 'U_trade'], eff: { research: [R('electronics', 1)], researchSlots: 1 }, ai: 8, ic: '🔐' }),
  F('U_tube', 'Tube Alloys', 12, { pre: ['U_radar', 'U_ultra'], cond: { year: 1941 }, eff: { research: [R('nuclear', 1)] }, ai: 5, ic: '☢️' }),
  // esercito e RAF
  F('U_army', 'Esercito di cittadini', 17, { eff: { manpower: 80000, xp: { army: 25 } }, ai: 8, ic: '🎖️' }),
  F('U_gbp', 'Grande piano di battaglia', 16, { pre: ['U_army'], eff: { research: [R('doctrine', 1)], defBonus: 0.05, mods: { planning: 0.1 } }, ai: 8 }),
  F('U_cruiser', 'Carri incrociatori', 18, { pre: ['U_army'], eff: { armorTech: true, research: [R('armor')] }, ai: 7 }),
  F('U_bef', 'Corpo di spedizione', 17, { pre: ['U_gbp', 'U_cruiser'], cond: { year: 1939 }, eff: { divs: { inf: 3, arm: 1 } }, ai: 8 }),
  F('U_commando', 'Commando', 17, { pre: ['U_bef'], eff: { atkBonus: 0.05, recBonus: 0.2 }, ai: 6 }),
  F('U_raf', 'Espansione della RAF', 20, { eff: { research: [R('air', 1)], xp: { air: 50 } }, ai: 8, ic: '✈️' }),
  F('U_spitfire', 'Spitfire', 20, { pre: ['U_raf'], eff: { research: [R('air', 1, true)], defBonus: 0.05 }, ai: 8 }),
  F('U_bomber', 'Comando Bombardieri', 20, { pre: ['U_spitfire'], eff: { research: [R('air')], atkBonus: 0.03 }, ai: 6 }),
  // marina
  F('U_navy', 'Royal Navy', 23, { eff: { xp: { navy: 50 }, research: [R('naval', 1)] }, ai: 7 }),
  F('U_convoy', 'Scorta ai convogli', 22, { pre: ['U_navy'], eff: { research: [R('naval_doctrine', 1)] }, ai: 6 }),
  F('U_carrier', 'Portaerei di flotta', 24, { pre: ['U_navy'], eff: { research: [R('naval', 1, true)], mods: { naval_build: 0.1 } }, ai: 6 }),
  F('U_home', 'Home Fleet', 23, { pre: ['U_convoy', 'U_carrier'], eff: { defBonus: 0.05 }, ai: 6 }),
]);

// ---------- FRANCIA ----------
defTree('F', 'Repubblica Francese', [
  F('F_elect', 'Le elezioni del 1936', 4, { cond: { date: '1936-04-15' }, eff: { pp: 25 }, ai: 10, ic: '🗳️' }),
  F('F_popfront', 'Fronte Popolare', 2, { pre: ['F_elect'], ex: ['F_right'], eff: { leader: 'Léon Blum', civ: 1, mods: { stability: 0.05 } }, ai: 10 }),
  F('F_right', 'Le leghe di destra', 7, { pre: ['F_elect'], eff: { mods: { stability: -0.05, war_support: 0.1 } }, ai: 0, ic: '🦅' }),
  // storico
  F('F_matignon', 'Accordi di Matignon', 1, { pre: ['F_popfront'], eff: { mods: { stability: 0.1 }, civ: 1 }, ai: 10 }),
  F('F_daladier', 'Governo Daladier', 2, { pre: ['F_matignon'], ex: ['F_thorez'], cond: { year: 1938 }, eff: { leader: 'Édouard Daladier', mil: 2, mods: { war_support: 0.1 } }, ai: 10, ic: '🗳️' }),
  F('F_little', 'Piccola Intesa', 0, { pre: ['F_matignon'], y: 3, eff: { guarantee: ['Y', 'R'], mods: { stability: 0.03 } }, ai: 9 }),
  F('F_guar', 'Garantire l\'Europa orientale', 0, { pre: ['F_little'], cond: { year: 1939 }, eff: { guarantee: ['P', 'C'] }, ai: 9 }),
  F('F_maginot', 'Estendere la Linea Maginot', 2, { pre: ['F_daladier'], eff: { defBonus: 0.15, mods: { entrenchment: 0.1 } }, ai: 10, ic: '🧱' }),
  F('F_belgium', 'Piano Dyle', 1, { pre: ['F_maginot'], cond: { alive: 'B' }, eff: { guarantee: 'B', defBonus: 0.05 }, ai: 8 }),
  F('F_resist', 'Resistere ad ogni costo', 3, { pre: ['F_maginot'], cond: { war: true }, eff: { manpower: 100000, defBonus: 0.05, mods: { war_support: 0.2 } }, ai: 10, ic: '🎖️' }),
  F('F_libre', 'La Francia Libera', 2, { pre: ['F_resist'], cond: { war: true, year: 1940 }, eff: { leader: 'Charles de Gaulle', atkBonus: 0.1, divs: { inf: 2 } }, ai: 10, ic: '✠' }),
  // comunista
  F('F_thorez', 'Governo Thorez', 4, { pre: ['F_matignon'], cond: { year: 1937 }, eff: { ideology: 'communist', leader: 'Maurice Thorez', leaveFaction: true }, ai: 0 }),
  F('F_commune', 'La nuova Comune', 4, { pre: ['F_thorez'], eff: { civ: 2, mil: 2, mods: { war_support: 0.05 } }, ai: 0, ic: '☭' }),
  F('F_red_int', 'Internazionale rossa', 4, { pre: ['F_commune'], eff: { joinFaction: 'S' }, ai: 0 }),
  // destra
  F('F_rocque', 'Governo de La Rocque', 6, { pre: ['F_right'], ex: ['F_orleans'], eff: { ideology: 'fascist', leader: 'François de La Rocque', leaveFaction: true }, ai: 0 }),
  F('F_orleans', 'Restaurazione orleanista', 8, { pre: ['F_right'], eff: { ideology: 'neutral', leader: 'Enrico d\'Orléans', leaveFaction: true, mods: { stability: 0.1 } }, ai: 0, ic: '👑' }),
  F('F_latin', 'Blocco Latino', 6, { pre: ['F_rocque'], eff: { createFaction: 'Blocco Latino', invite: ['I', 'E', 'O'] }, ai: 0 }),
  F('F_rhine', 'Il Reno come confine', 6, { pre: ['F_latin'], cond: { year: 1939, alive: 'G' }, eff: { war: 'G', mods: { war_support: 0.1 } }, ai: 0 }),
  F('F_royal', 'Armata reale', 8, { pre: ['F_orleans'], eff: { manpower: 60000, atkBonus: 0.05 }, ai: 0, ic: '🎖️' }),
  F('F_catholic', 'Lega cattolica', 8, { pre: ['F_royal'], eff: { createFaction: 'Lega Cattolica', invite: ['B', 'A', 'E', 'O'] }, ai: 0 }),
  // industria
  F('F_rearm', 'Piano di riarmo del 1936', 12, { eff: { mil: 3 }, ai: 9 }),
  F('F_nation', 'Nazionalizzare l\'industria bellica', 11, { pre: ['F_rearm'], eff: { mil: 2, mods: { production_efficiency: 0.05 } }, ai: 8 }),
  F('F_colon', 'Risorse coloniali', 13, { pre: ['F_rearm'], eff: { civ: 2, mods: { resource_gain: 0.15 } }, ai: 8 }),
  F('F_sncf', 'Rete SNCF', 11, { pre: ['F_nation'], eff: { civ: 1, speedBonus: 0.05, mods: { supply: 0.1 } }, ai: 7 }),
  F('F_aero', 'Industria aeronautica', 13, { pre: ['F_colon'], eff: { mil: 1, research: [R('air', 1)] }, ai: 7 }),
  F('F_cnrs', 'CNRS', 12, { pre: ['F_sncf', 'F_aero'], eff: { researchSlots: 1, mods: { research_speed: 0.05 } }, ai: 6, ic: '🔬' }),
  // esercito
  F('F_army', 'Armée de terre', 17, { eff: { xp: { army: 30 } }, ai: 8, ic: '🎖️' }),
  F('F_batconduite', 'Bataille conduite', 16, { pre: ['F_army'], eff: { research: [R('doctrine', 1)], defBonus: 0.1 }, ai: 8 }),
  F('F_charb1', 'Char B1', 18, { pre: ['F_army'], eff: { armorTech: true, research: [R('armor')] }, ai: 7 }),
  F('F_dlm', 'Divisioni leggere meccanizzate', 18, { pre: ['F_charb1'], eff: { research: [R('support')], speedBonus: 0.05 }, ai: 6 }),
  F('F_colonial', 'Truppe coloniali', 16, { pre: ['F_batconduite'], eff: { manpower: 60000, divs: { inf: 3 } }, ai: 8 }),
  F('F_degaulle', 'Le idee di de Gaulle', 17, { pre: ['F_dlm', 'F_colonial'], cond: { year: 1938 }, eff: { research: [R('armor', 1, true)], atkBonus: 0.1 }, ai: 6 }),
  F('F_air', 'Armée de l\'air', 20, { eff: { research: [R('air')], xp: { air: 30 } }, ai: 6, ic: '✈️' }),
  F('F_d520', 'Dewoitine D.520', 20, { pre: ['F_air'], eff: { research: [R('air', 1, true)], defBonus: 0.03 }, ai: 6 }),
  F('F_navy', 'Marine nationale', 22, { eff: { research: [R('naval', 1)], xp: { navy: 25 } }, ai: 4 }),
  F('F_mers', 'Squadra del Mediterraneo', 22, { pre: ['F_navy'], eff: { research: [R('naval_doctrine')], defBonus: 0.03 }, ai: 4 }),
]);

// ---------- ITALIA ----------
defTree('I', "Regno d'Italia", [
  F('I_impero', "Proclamazione dell'Impero", 4, { cond: { date: '1936-05-01' }, eff: { pp: 50, mods: { war_support: 0.05 } }, ai: 10, ic: '🦅' }),
  F('I_axis', 'Asse Roma-Berlino', 1, { pre: ['I_impero'], ex: ['I_stresa', 'I_king', 'I_pci'], cond: { date: '1936-10-01' }, eff: { joinFaction: 'G' }, ai: 10 }),
  F('I_stresa', 'Fronte di Stresa', 4, { pre: ['I_impero'], ex: ['I_king', 'I_pci'], eff: { guarantee: 'A', mods: { stability: 0.05 } }, ai: 0, ic: '🤝' }),
  F('I_king', 'Il Re riprende il potere', 6, { pre: ['I_impero'], ex: ['I_pci'], eff: { ideology: 'neutral', leader: 'Vittorio Emanuele III', leaveFaction: true }, ai: 0, ic: '👑' }),
  F('I_pci', "L'insurrezione rossa", 8, { pre: ['I_impero'], eff: { ideology: 'communist', leader: 'Palmiro Togliatti', leaveFaction: true, mods: { stability: -0.1 } }, ai: 0 }),
  // storico
  F('I_etiopia', "Completare la conquista dell'Etiopia", 2, { y: 0, days: 35, cond: { alive: 'ETH' }, eff: { war: 'ETH', xp: { army: 25 } }, ai: 10, ic: '⚔️' }),
  F('I_albania', 'Protettorato albanese', 3, { pre: ['I_steel'], y: 4, cond: { date: '1939-04-01', alive: 'ALB' }, eff: { annex: 'ALB' }, ai: 10 }),
  F('I_spagna', 'Intervento in Spagna', 0, { pre: ['I_axis'], eff: { xp: { army: 40, air: 30 } }, ai: 9, ic: '🎖️' }),
  F('I_steel', "Patto d'Acciaio", 2, { pre: ['I_axis'], cond: { date: '1939-05-01' }, eff: { mods: { war_support: 0.1 }, mil: 1 }, ai: 10 }),
  F('I_danube', 'Influenza danubiana', 0, { pre: ['I_spagna'], eff: { invite: ['H', 'R', 'L'] }, ai: 8 }),
  F('I_nizza', 'Nizza e Savoia', 3, { pre: ['I_steel'], cond: { date: '1940-06-01', alive: 'F', atWarWith: 'U' }, eff: { war: 'F' }, ai: 10 }),
  F('I_reni', 'Spezzare le reni alla Grecia', 1, { pre: ['I_danube', 'I_steel'], y: 4, cond: { date: '1940-10-01', alive: 'Q' }, eff: { war: 'Q' }, ai: 10 }),
  F('I_dalmazia', 'Pretese sulla Dalmazia', 0, { pre: ['I_reni'], cond: { year: 1941, alive: 'Y' }, eff: { war: 'Y' }, ai: 10 }),
  F('I_csir', 'Corpo di spedizione in Russia', 2, { pre: ['I_reni'], cond: { atWarWith: 'S' }, eff: { divs: { inf: 3 }, mods: { war_support: 0.05 } }, ai: 9 }),
  // Stresa
  F('I_s_danube', 'Protettorato danubiano', 4, { pre: ['I_stresa'], eff: { guarantee: ['H', 'Y'], invite: ['A', 'H'] }, ai: 0 }),
  F('I_s_allies', 'Rinnovare l\'Intesa', 4, { pre: ['I_s_danube'], cond: { year: 1938 }, eff: { joinFaction: ['U', 'F'] }, ai: 0 }),
  F('I_s_brenner', 'Guardia al Brennero', 4, { pre: ['I_s_allies'], cond: { year: 1939, alive: 'G' }, eff: { war: 'G', defBonus: 0.1 }, ai: 0 }),
  // monarchia
  F('I_badoglio', 'Governo Badoglio', 6, { pre: ['I_king'], eff: { leader: 'Pietro Badoglio', mods: { stability: 0.1 } }, ai: 0, ic: '🎖️' }),
  F('I_neutral', 'Neutralità armata', 6, { pre: ['I_badoglio'], eff: { defBonus: 0.1, mods: { entrenchment: 0.1 } }, ai: 0, ic: '🛡️' }),
  F('I_latin', 'Lega Latina', 6, { pre: ['I_neutral'], cond: { year: 1938 }, eff: { createFaction: 'Lega Latina', invite: ['E', 'O', 'Q'] }, ai: 0 }),
  // comunista
  F('I_consigli', 'Repubblica dei consigli', 8, { pre: ['I_pci'], eff: { civ: 2, mil: 2 }, ai: 0, ic: '☭' }),
  F('I_comint', 'Unirsi al Comintern', 8, { pre: ['I_consigli'], eff: { joinFaction: 'S' }, ai: 0 }),
  F('I_balkred', 'Balcani rossi', 8, { pre: ['I_comint'], cond: { year: 1939, alive: 'Y' }, eff: { war: 'Y' }, ai: 0 }),
  // industria
  F('I_autarchia', 'Autarchia', 13, { eff: { mods: { resource_gain: 0.15 }, civ: 1 }, ai: 9 }),
  F('I_ansaldo', 'Ansaldo e FIAT', 11, { pre: ['I_autarchia'], eff: { mil: 3 }, ai: 9 }),
  F('I_bonifica', 'Bonifica integrale', 13, { pre: ['I_autarchia'], eff: { civ: 2, mods: { stability: 0.05 } }, ai: 7 }),
  F('I_iri', 'Istituto per la Ricostruzione Industriale', 15, { pre: ['I_autarchia'], eff: { civ: 2, mods: { production_efficiency: 0.05 } }, ai: 8 }),
  F('I_sud', 'Industrializzare il Mezzogiorno', 13, { pre: ['I_bonifica'], eff: { civ: 3, slots: 2 }, ai: 7 }),
  F('I_wareco', 'Economia di guerra', 11, { pre: ['I_ansaldo'], cond: { year: 1939 }, eff: { mil: 4, eqBonus: 0.05 }, ai: 8 }),
  F('I_cnr', 'Consiglio Nazionale delle Ricerche', 15, { pre: ['I_iri'], eff: { researchSlots: 1, mods: { research_speed: 0.05 } }, ai: 6, ic: '🔬' }),
  // esercito
  F('I_esercito', 'Regio Esercito', 19, { eff: { xp: { army: 30 } }, ai: 8, ic: '🎖️' }),
  F('I_alpini', 'Alpini', 18, { pre: ['I_esercito'], eff: { defBonus: 0.1, research: [R('infantry')] }, ai: 7 }),
  F('I_bersa', 'Bersaglieri', 20, { pre: ['I_esercito'], eff: { speedBonus: 0.05, atkBonus: 0.05 }, ai: 7 }),
  F('I_guerrarapida', 'Guerra di rapido corso', 19, { pre: ['I_alpini', 'I_bersa'], eff: { research: [R('doctrine', 1)], atkBonus: 0.05 }, ai: 7 }),
  F('I_m13', 'Carri M13/40', 20, { pre: ['I_bersa'], y: 3, cond: { year: 1939 }, eff: { armorTech: true, research: [R('armor', 1, true)] }, ai: 7 }),
  F('I_arditi', 'Arditi', 18, { pre: ['I_guerrarapida'], y: 3, eff: { atkBonus: 0.05, recBonus: 0.2 }, ai: 6 }),
  F('I_aero', 'Regia Aeronautica', 22, { eff: { research: [R('air', 1)], xp: { air: 30 } }, ai: 6, ic: '✈️' }),
  F('I_macchi', 'Macchi C.202', 22, { pre: ['I_aero'], cond: { year: 1940 }, eff: { research: [R('air', 1, true)], defBonus: 0.03 }, ai: 6 }),
  F('I_marina', 'Regia Marina', 24, { eff: { research: [R('naval', 1)], xp: { navy: 40 } }, ai: 6, ic: '⚓' }),
  F('I_nostrum', 'Mare Nostrum', 24, { pre: ['I_marina'], eff: { research: [R('naval', 1, true)], mods: { naval_build: 0.1 } }, ai: 6 }),
  F('I_decima', 'Decima MAS', 24, { pre: ['I_nostrum'], eff: { research: [R('naval_doctrine', 1)], atkBonus: 0.02 }, ai: 5 }),
]);

// ---------- NAZIONI MINORI ----------
// ogni minore = ramo nazionale + industria + esercito + politica generica (+ aviazione, + marina se ha coste)
function minorTree(code, title, nat, o = {}) {
  const w = Math.max(0, ...nat.map(f => f.x)) + 2;
  const parts = [nat];
  let x = w;
  if (!o.noPol) { parts.push(branchPolitics(x, o.pol || {})); x += 8; }
  parts.push(branchIndustry(x)); x += 3;
  parts.push(branchArmy(x)); x += 3;
  parts.push(branchAir(x)); x += 2;
  if (!o.landlocked) parts.push(branchNavy(x));
  return defTree(code, title, parts);
}

minorTree('P', 'Seconda Repubblica di Polonia', [
  F('P_sanacja', 'Regime della Sanacja', 1, { eff: { mods: { stability: 0.05 }, ppGain: 0.25 }, ai: 8, ic: '🦅' }),
  F('P_cop', 'Distretto Industriale Centrale', 0, { pre: ['P_sanacja'], eff: { civ: 3, slots: 2 }, ai: 9, ic: '🏭' }),
  F('P_intermarium', 'Intermarium', 2, { pre: ['P_sanacja'], eff: { createFaction: 'Intermarium', invite: ['X', 'EST', 'LAT', 'LIT', 'K', 'R', 'C', 'H'] }, ai: 2 }),
  F('P_alliance', 'Alleanza con la Francia', 1, { pre: ['P_sanacja'], y: 2, cond: { year: 1938 }, eff: { joinFaction: ['F', 'U'] }, ai: 8 }),
  F('P_lines', 'Fortificare la frontiera occidentale', 0, { pre: ['P_cop'], eff: { defBonus: 0.15, mods: { entrenchment: 0.1 } }, ai: 9, ic: '🧱' }),
  F('P_cavalry', 'Cavalleria polacca', 2, { pre: ['P_alliance'], eff: { speedBonus: 0.05, atkBonus: 0.05, divs: { inf: 2 } }, ai: 7, ic: '🐎' }),
  F('P_enigma', "Decifrare l'Enigma", 1, { pre: ['P_lines', 'P_cavalry'], eff: { research: [R('electronics', 1)], defBonus: 0.05 }, ai: 6, ic: '🔐' }),
], { pol: { ai: { neu: 3 }, bloc: 'Intermarium' } });

minorTree('E', 'Repubblica Spagnola', [
  F('E_crisis', 'La crisi del 1936', 1, { cond: { date: '1936-07-01' }, eff: { mods: { stability: -0.1, war_support: 0.1 } }, ai: 9, ic: '⚔️' }),
  F('E_republic', 'Difendere la Repubblica', 0, { pre: ['E_crisis'], ex: ['E_national', 'E_carlist'], eff: { ideology: 'democratic', leader: 'Manuel Azaña', xp: { army: 30 }, divs: { inf: 3 } }, ai: 3, ic: '🗳️' }),
  F('E_national', 'Il Bando nazionale', 2, { pre: ['E_crisis'], ex: ['E_carlist'], eff: { ideology: 'fascist', leader: 'Francisco Franco', xp: { army: 30 }, divs: { inf: 3 } }, ai: 6, ic: '🦅' }),
  F('E_carlist', 'Il pretendente carlista', 4, { pre: ['E_crisis'], eff: { ideology: 'neutral', leader: 'Alfonso Carlo di Borbone', divs: { inf: 2 }, mods: { stability: 0.05 } }, ai: 1, ic: '👑' }),
  F('E_brigades', 'Brigate internazionali', 0, { pre: ['E_republic'], eff: { manpower: 40000, joinFaction: ['F', 'U'] }, ai: 5 }),
  F('E_falange', 'Falange unificata', 2, { pre: ['E_national'], eff: { mods: { stability: 0.1 }, ppGain: 0.25 }, ai: 7 }),
  F('E_requetes', 'Requetés', 4, { pre: ['E_carlist'], eff: { defBonus: 0.1, atkBonus: 0.05 }, ai: 5, ic: '🎖️' }),
  F('E_rebuild', 'Ricostruire la Spagna', 2, { pre: [['E_brigades', 'E_falange', 'E_requetes']], y: 3, eff: { civ: 3, mods: { stability: 0.1 } }, ai: 8, ic: '🏭' }),
  F('E_gibraltar', 'Rivendicare Gibilterra', 3, { pre: ['E_falange'], y: 3, cond: { year: 1940, ideology: 'fascist' }, eff: { joinFaction: 'G', mods: { war_support: 0.1 } }, ai: 1 }),
], { noPol: true });

minorTree('C', 'Cecoslovacchia', [
  F('C_benes', 'Il governo Beneš', 1, { eff: { mods: { stability: 0.05 }, ppGain: 0.2 }, ai: 8, ic: '🗳️' }),
  F('C_border', 'Fortificazioni dei Sudeti', 0, { pre: ['C_benes'], eff: { defBonus: 0.2, mods: { entrenchment: 0.15 } }, ai: 10, ic: '🧱' }),
  F('C_skoda', 'Škoda', 2, { pre: ['C_benes'], eff: { mil: 3, research: [R('armor')], armorTech: true }, ai: 9, ic: '⚙️' }),
  F('C_little', 'Rinnovare la Piccola Intesa', 1, { pre: ['C_border', 'C_skoda'], eff: { createFaction: 'Piccola Intesa', invite: ['Y', 'R'] }, ai: 1 }),
  F('C_soviet', 'Trattato con Mosca', 0, { pre: ['C_border'], y: 3, cond: { year: 1937 }, eff: { joinFaction: 'S' }, ai: 1 }),
  F('C_munich', 'Rifiutare Monaco', 2, { pre: ['C_skoda'], y: 3, cond: { year: 1938 }, eff: { manpower: 60000, divs: { inf: 4 }, mods: { war_support: 0.2 } }, ai: 8, ic: '🎖️' }),
], { landlocked: true, pol: { ai: { dem: 3 } } });

minorTree('K', 'Finlandia', [
  F('K_mannerheim', 'La Linea Mannerheim', 0, { eff: { defBonus: 0.2, mods: { entrenchment: 0.15 } }, ai: 10, ic: '🧱' }),
  F('K_sisu', 'Sisu', 2, { eff: { mods: { war_support: 0.1 }, recBonus: 0.2 }, ai: 8, ic: '❄️' }),
  F('K_motti', 'Tattiche motti', 1, { pre: ['K_mannerheim', 'K_sisu'], eff: { atkBonus: 0.1, defBonus: 0.05 }, ai: 9, ic: '🎖️' }),
  F('K_ski', 'Truppe sciatrici', 0, { pre: ['K_motti'], eff: { speedBonus: 0.1, divs: { inf: 2 } }, ai: 8, ic: '⛷️' }),
  F('K_scand', 'Difesa scandinava', 2, { pre: ['K_motti'], eff: { createFaction: 'Unione Nordica', invite: ['W', 'N', 'D'] }, ai: 0.5 }),
  F('K_continue', 'Guerra di Continuazione', 1, { pre: ['K_ski'], y: 3, cond: { year: 1941, alive: 'S', notAllied: 'S' }, eff: { joinFaction: 'G', mods: { war_support: 0.1 } }, ai: 6 }),
], { pol: { bloc: 'Unione Nordica', blocInvite: ['W', 'N', 'D', 'X', 'EST', 'LAT', 'LIT'] } });

minorTree('W', 'Svezia', [
  F('W_neutral', 'La neutralità svedese', 1, { eff: { mods: { stability: 0.1 } }, ai: 9, ic: '⚖️' }),
  F('W_iron', 'Ferro di Kiruna', 0, { pre: ['W_neutral'], eff: { civ: 2, mods: { resource_gain: 0.2 } }, ai: 9, ic: '⛏️' }),
  F('W_bofors', 'Bofors', 2, { pre: ['W_neutral'], eff: { mil: 2, research: [R('artillery', 1)] }, ai: 8, ic: '⚙️' }),
  F('W_saab', 'SAAB', 2, { pre: ['W_bofors'], eff: { research: [R('air', 1)], mods: { air_build: 0.1 } }, ai: 6, ic: '✈️' }),
  F('W_nordic', 'Difesa nordica', 0, { pre: ['W_iron'], cond: { year: 1938 }, eff: { createFaction: 'Unione Nordica', invite: ['N', 'D', 'K'] }, ai: 0.5 }),
], { pol: { bloc: 'Unione Nordica', blocInvite: ['N', 'D', 'K'] } });

minorTree('N', 'Norvegia', [
  F('N_fleet', 'Flotta mercantile', 1, { eff: { civ: 1, mods: { trade: 0.1 } }, ai: 7, ic: '⚓' }),
  F('N_heavy', 'Acqua pesante di Vemork', 0, { pre: ['N_fleet'], eff: { research: [R('nuclear', 1)] }, ai: 4, ic: '☢️' }),
  F('N_coast', 'Fortezze costiere', 2, { pre: ['N_fleet'], eff: { defBonus: 0.15 }, ai: 8, ic: '🧱' }),
  F('N_west', 'Avvicinarsi a Londra', 1, { pre: ['N_heavy', 'N_coast'], cond: { war: true }, eff: { joinFaction: 'U' }, ai: 3 }),
], { pol: { bloc: 'Unione Nordica', blocInvite: ['W', 'D', 'K'] } });

minorTree('D', 'Danimarca', [
  F('D_agri', 'Esportazioni agricole', 1, { eff: { civ: 1, mods: { trade: 0.1 } }, ai: 7, ic: '🌾' }),
  F('D_bohr', 'Istituto Niels Bohr', 0, { pre: ['D_agri'], eff: { mods: { research_speed: 0.05 }, research: [R('nuclear', 1)] }, ai: 5, ic: '🔬' }),
  F('D_jutland', 'Difesa dello Jutland', 2, { pre: ['D_agri'], eff: { defBonus: 0.15, divs: { inf: 1 } }, ai: 8, ic: '🧱' }),
], { pol: { bloc: 'Unione Nordica', blocInvite: ['W', 'N', 'K'] } });

minorTree('X', 'Paesi Baltici', [
  F('X_entente', 'Intesa baltica', 1, { eff: { mods: { stability: 0.05 }, ppGain: 0.2 }, ai: 8, ic: '🤝' }),
  F('X_forest', 'Fratelli della foresta', 0, { pre: ['X_entente'], eff: { defBonus: 0.15, recBonus: 0.2 }, ai: 8, ic: '🌲' }),
  F('X_ports', 'Porti di Riga e Tallinn', 2, { pre: ['X_entente'], eff: { civ: 2 }, ai: 7, ic: '⚓' }),
  F('X_west', 'Garanzie occidentali', 1, { pre: ['X_forest', 'X_ports'], cond: { year: 1939 }, eff: { joinFaction: ['U', 'F'] }, ai: 2 }),
]);

minorTree('B', 'Regno del Belgio', [
  F('B_neutral', 'Neutralità belga', 1, { eff: { mods: { stability: 0.1 } }, ai: 9, ic: '⚖️' }),
  F('B_eben', "Forte Eben-Emael", 0, { pre: ['B_neutral'], eff: { defBonus: 0.2, mods: { entrenchment: 0.1 } }, ai: 9, ic: '🧱' }),
  F('B_colonies', 'Risorse del Congo', 2, { pre: ['B_neutral'], eff: { civ: 2, mods: { resource_gain: 0.2 } }, ai: 8, ic: '⛏️' }),
  F('B_water', 'Linea K-W', 0, { pre: ['B_eben'], eff: { defBonus: 0.1 }, ai: 7, ic: '🧱' }),
  F('B_allies', 'Accordo con gli Alleati', 2, { pre: ['B_colonies'], cond: { war: true }, eff: { joinFaction: ['U', 'F'] }, ai: 2 }),
]);

minorTree('A', "Stato federale d'Austria", [
  F('A_vaterland', 'Fronte Patriottico', 1, { eff: { mods: { stability: 0.05 }, ppGain: 0.2 }, ai: 8, ic: '⚖️' }),
  F('A_italy', 'Protocolli di Roma', 0, { pre: ['A_vaterland'], eff: { mods: { stability: 0.05 }, defBonus: 0.05, text: "L'Italia veglia sull'indipendenza austriaca" }, ai: 4, ic: '🤝' }),
  F('A_habsburg', 'Restaurare gli Asburgo', 2, { pre: ['A_vaterland'], eff: { ideology: 'neutral', leader: "Otto d'Asburgo", mods: { stability: 0.1 } }, ai: 1, ic: '👑' }),
  F('A_resist', 'Resistere all\'Anschluss', 1, { pre: [['A_italy', 'A_habsburg']], y: 2, eff: { defBonus: 0.15, divs: { inf: 2 }, mods: { war_support: 0.15 } }, ai: 3, ic: '🎖️' }),
  F('A_danube', 'Confederazione danubiana', 2, { pre: ['A_habsburg'], y: 3, eff: { createFaction: 'Confederazione Danubiana', invite: ['H', 'C', 'Y'] }, ai: 1 }),
], { landlocked: true });

minorTree('Z', 'Confederazione Svizzera', [
  F('Z_neutral', 'Neutralità perpetua', 1, { eff: { mods: { stability: 0.15 } }, ai: 9, ic: '⚖️' }),
  F('Z_reduit', 'Ridotto nazionale', 0, { pre: ['Z_neutral'], eff: { defBonus: 0.25, mods: { entrenchment: 0.2 } }, ai: 10, ic: '🏔️' }),
  F('Z_banks', 'Banche svizzere', 2, { pre: ['Z_neutral'], eff: { civ: 3, mods: { trade: 0.15 } }, ai: 8, ic: '🏦' }),
  F('Z_militia', 'Esercito di milizia', 1, { pre: ['Z_reduit', 'Z_banks'], eff: { manpower: 50000, divs: { inf: 2 } }, ai: 8, ic: '🎖️' }),
], { landlocked: true });

minorTree('H', "Regno d'Ungheria", [
  F('H_horthy', 'La reggenza di Horthy', 1, { eff: { mods: { stability: 0.05 }, ppGain: 0.2 }, ai: 8, ic: '⚖️' }),
  F('H_trianon', 'Revisionismo di Trianon', 0, { pre: ['H_horthy'], eff: { mods: { war_support: 0.1 } }, ai: 9, ic: '📜' }),
  F('H_kingdom', 'Restaurare la monarchia', 2, { pre: ['H_horthy'], ex: ['H_arrow'], eff: { leader: "Ottone d'Asburgo", mods: { stability: 0.1 } }, ai: 1, ic: '👑' }),
  F('H_arrow', 'Le Croci Frecciate', 0, { pre: ['H_trianon'], eff: { ideology: 'fascist', leader: 'Ferenc Szálasi' }, ai: 1 }),
  F('H_vienna', 'Arbitrati di Vienna', 1, { pre: ['H_trianon'], y: 2, cond: { year: 1938 }, eff: { joinFaction: ['G', 'I'], civ: 2 }, ai: 8 }),
  F('H_danube', 'Patto danubiano', 2, { pre: ['H_kingdom'], eff: { createFaction: 'Intesa Danubiana', invite: ['A', 'C', 'Y'] }, ai: 1 }),
], { landlocked: true, noPol: false });

minorTree('R', 'Regno di Romania', [
  F('R_carol', 'La dittatura reale', 1, { eff: { ppGain: 0.25, mods: { stability: 0.05 } }, ai: 8, ic: '👑' }),
  F('R_ploiesti', 'Pozzi di Ploiești', 0, { pre: ['R_carol'], eff: { civ: 2, mods: { resource_gain: 0.25 } }, ai: 9, ic: '🛢️' }),
  F('R_guard', 'Guardia di Ferro', 2, { pre: ['R_carol'], ex: ['R_entente'], cond: { year: 1940 }, eff: { ideology: 'fascist', leader: 'Ion Antonescu' }, ai: 6 }),
  F('R_entente', 'Fedeltà alla Piccola Intesa', 3, { pre: ['R_carol'], eff: { joinFaction: ['F', 'U'] }, ai: 2, ic: '🤝' }),
  F('R_axis', 'Unirsi all\'Asse', 2, { pre: ['R_guard'], cond: { year: 1940 }, eff: { joinFaction: 'G' }, ai: 8 }),
  F('R_bessarabia', 'Riprendere la Bessarabia', 1, { pre: ['R_axis', 'R_ploiesti'], cond: { atWarWith: 'S' }, eff: { atkBonus: 0.1, divs: { inf: 2 } }, ai: 8, ic: '⚔️' }),
], { noPol: false });

minorTree('Y', 'Regno di Jugoslavia', [
  F('Y_regency', 'La reggenza del principe Paolo', 1, { eff: { mods: { stability: 0.05 } }, ai: 8, ic: '👑' }),
  F('Y_sporazum', 'Accordo serbo-croato', 0, { pre: ['Y_regency'], eff: { mods: { stability: 0.15 } }, ai: 8, ic: '🤝' }),
  F('Y_mines', 'Miniere di Bor', 2, { pre: ['Y_regency'], eff: { civ: 2, mods: { resource_gain: 0.2 } }, ai: 8, ic: '⛏️' }),
  F('Y_coup', 'Il colpo di stato di Belgrado', 0, { pre: ['Y_sporazum'], cond: { year: 1941 }, eff: { leader: 'Pietro II', joinFaction: ['U'], mods: { war_support: 0.15 } }, ai: 3 }),
  F('Y_balkan', 'Intesa balcanica', 2, { pre: ['Y_mines'], eff: { createFaction: 'Intesa Balcanica', invite: ['Q', 'R', 'T'] }, ai: 3 }),
  F('Y_chetnik', 'Guerriglia in montagna', 1, { pre: ['Y_coup', 'Y_balkan'], y: 3, eff: { defBonus: 0.15, recBonus: 0.3 }, ai: 6, ic: '⛰️' }),
]);

minorTree('L', 'Regno di Bulgaria', [
  F('L_tsar', 'Lo zar Boris III', 1, { eff: { ppGain: 0.2, mods: { stability: 0.05 } }, ai: 8, ic: '👑' }),
  F('L_salonika', 'Accordo di Salonicco', 0, { pre: ['L_tsar'], eff: { mil: 2, xp: { army: 25 } }, ai: 8, ic: '⚙️' }),
  F('L_macedonia', 'Rivendicare la Macedonia', 2, { pre: ['L_tsar'], eff: { mods: { war_support: 0.1 } }, ai: 7, ic: '📜' }),
  F('L_axis', 'Patto Tripartito', 1, { pre: ['L_salonika', 'L_macedonia'], cond: { year: 1941 }, eff: { joinFaction: 'G' }, ai: 7 }),
]);

minorTree('Q', 'Regno di Grecia', [
  F('Q_metaxas', 'Il regime del 4 agosto', 1, { cond: { date: '1936-08-04' }, eff: { leader: 'Ioannis Metaxas', ppGain: 0.25 }, ai: 9, ic: '⚖️' }),
  F('Q_line', 'Linea Metaxas', 0, { pre: ['Q_metaxas'], eff: { defBonus: 0.2, mods: { entrenchment: 0.15 } }, ai: 9, ic: '🧱' }),
  F('Q_ochi', 'Il giorno del No', 2, { pre: ['Q_metaxas'], cond: { war: true }, eff: { manpower: 50000, mods: { war_support: 0.2 }, divs: { inf: 2 } }, ai: 9, ic: '🎖️' }),
  F('Q_allies', 'Alleanza con Londra', 1, { pre: ['Q_line'], y: 2, cond: { year: 1939 }, eff: { joinFaction: 'U' }, ai: 3 }),
  F('Q_megali', 'Megali Idea', 3, { pre: ['Q_metaxas'], eff: { mods: { war_support: 0.1 }, atkBonus: 0.05 }, ai: 2, ic: '🏛️' }),
]);

minorTree('T', 'Repubblica di Turchia', [
  F('T_kemal', 'Le riforme kemaliste', 1, { eff: { ppGain: 0.25, mods: { stability: 0.05 } }, ai: 9, ic: '⚖️' }),
  F('T_montreux', 'Convenzione di Montreux', 0, { pre: ['T_kemal'], cond: { date: '1936-07-20' }, eff: { defBonus: 0.1, mods: { trade: 0.1 } }, ai: 9, ic: '⚓' }),
  F('T_etatism', 'Statalismo', 2, { pre: ['T_kemal'], eff: { civ: 3, slots: 2 }, ai: 9, ic: '🏭' }),
  F('T_hatay', 'La questione di Hatay', 0, { pre: ['T_montreux'], cond: { year: 1938 }, eff: { mods: { war_support: 0.05 }, pp: 50 }, ai: 6, ic: '📜' }),
  F('T_inonu', 'Il governo di İnönü', 2, { pre: ['T_etatism'], cond: { date: '1938-11-11' }, eff: { leader: 'İsmet İnönü', mods: { stability: 0.1 } }, ai: 8, ic: '⚖️' }),
  F('T_saadabad', 'Patto di Saadabad', 1, { pre: ['T_hatay', 'T_inonu'], eff: { createFaction: 'Patto di Saadabad', invite: ['Q', 'L'] }, ai: 2, ic: '🤝' }),
  F('T_ottoman', 'Rinascita ottomana', 3, { pre: ['T_inonu'], cond: { year: 1940 }, eff: { ideology: 'fascist', atkBonus: 0.1, mods: { war_support: 0.15 } }, ai: 0, ic: '☪️' }),
], { pol: { ai: { neu: 4 } } });

minorTree('O', 'Repubblica Portoghese', [
  F('O_estado', 'Estado Novo', 1, { eff: { ppGain: 0.25, mods: { stability: 0.1 } }, ai: 9, ic: '⚖️' }),
  F('O_alliance', "L'antica alleanza", 0, { pre: ['O_estado'], cond: { year: 1943 }, eff: { joinFaction: 'U' }, ai: 2, ic: '🤝' }),
  F('O_iberian', 'Patto iberico', 2, { pre: ['O_estado'], eff: { nap: 'E', mods: { stability: 0.05 } }, ai: 7, ic: '🕊️' }),
  F('O_wolfram', 'Il tungsteno portoghese', 1, { pre: ['O_estado'], y: 2, eff: { civ: 2, mods: { resource_gain: 0.25 } }, ai: 8, ic: '⛏️' }),
]);

// albero generico per nazioni senza albero proprio (ad es. aggiunte dalla mappa)
defTree('_generic', 'Albero generico', [branchPolitics(0), branchIndustry(8), branchArmy(11), branchAir(14), branchNavy(16)]);
FOCUS_TREES._generic_major = FOCUS_TREES._generic;
