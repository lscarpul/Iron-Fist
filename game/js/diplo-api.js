'use strict';

// Interfaccia per l'IA testuale: descrive lo stato diplomatico in testo e registra le azioni
// di diplomazia, spionaggio e occupazione nel registro GameActions (game/js/actions.js).
// Ogni azione agisce per S.player; ritorna { ok, msg } (ok:false = l'azione non è avvenuta, msg dice perché).

const DiploAPI = {
  // trova un paese dal codice (es. "G") o dal nome, anche parziale ("germania", "regno unito")
  find(q) {
    if (q == null) return null;
    const s = String(q).trim();
    if (S.countries[s]) return s;
    const low = s.toLowerCase();
    for (const k in S.countries) if (S.countries[k].name.toLowerCase() === low) return k;
    for (const k in S.countries) if (S.countries[k].name.toLowerCase().includes(low)) return k;
    return null;
  },

  summary(code = S.player) {
    const c = C(code), L = [];
    L.push(`Data: ${dateLabel(S.day)}. Tensione mondiale: ${Math.floor(S.tension)}%.`);
    L.push(`${c.name} (${code}), ${IDEOLOGIES[c.ideology].name}, potere politico ${Math.floor(c.pp)}, equipaggiamento ${fmt(c.equipment)}.`);
    const req = k => TENSION_REQ[k][c.ideology];
    L.push(`Soglie di tensione per la tua ideologia: giustificare guerre ${req('justify')}%, fazioni ${req('faction')}%, garanzie ${req('guarantee')}%, lend-lease a non alleati ${req('lendLease')}%.`);
    if (c.faction) L.push(`Fazione: ${S.factions[c.faction].name} (${S.factions[c.faction].members.map(m => C(m).name).join(', ')}).`);
    if (c.overlord) L.push(`Sei suddito di ${C(c.overlord).name} (${AUTONOMY_LEVELS[c.autonomy.level].name}, autonomia ${Math.round(c.autonomy.score)}%).`);
    const subs = Diplo.subjectsOf(code);
    if (subs.length) L.push(`Sudditi: ${subs.map(s => `${C(s).name} (${AUTONOMY_LEVELS[C(s).autonomy.level].name}, autonomia ${Math.round(C(s).autonomy.score)}%)`).join(', ')}.`);
    const en = enemiesOf(code);
    if (en.length) L.push(`In guerra con: ${en.map(e => `${C(e).name}${C(e).capitulated ? ' (capitolato)' : ` (resa ${Math.round(Diplo.surrenderProgress(e) * 100)}%)`}`).join(', ')}. Tua resa: ${Math.round(Diplo.surrenderProgress(code) * 100)}%.`);
    const wg = S.wargoals.filter(w => w.by === code || w.vs === code);
    for (const w of wg) L.push(`Obiettivo di guerra ${WARGOAL_TYPES[w.type].name}: ${C(w.by).name} contro ${C(w.vs).name}, ${w.ready ? 'pronto' : `${Math.ceil(w.days)} giorni`}.`);
    const naps = S.naps.filter(n => n.a === code || n.b === code).map(n => C(n.a === code ? n.b : n.a).name);
    if (naps.length) L.push(`Patti di non aggressione con: ${naps.join(', ')}.`);
    const ll = S.lendLease.filter(l => l.from === code || l.to === code);
    for (const l of ll) L.push(`Lend-lease: ${C(l.from).name} → ${C(l.to).name}, ${l.perDay}/giorno.`);
    const g = S.intel[code];
    L.push(`Intelligence: agenzia livello ${g.level}, ${g.agents} agenti (${Intel.freeAgents(code)} liberi). Reti: ${Object.entries(g.nets).map(([t, v]) => `${C(t).name} ${Math.floor(v)}%`).join(', ') || 'nessuna'}.`);
    const occ = S.occStats[code];
    if (occ) L.push(`Occupazione: ${occ.tiles} territori, resistenza media ${Math.round(occ.res)}%, conformità ${Math.round(occ.comp)}%, guarnigione ${Math.round(occ.eff * 100)}%.`);
    L.push('Paesi (opinione verso di te / tua opinione / ideologia / stato):');
    for (const k in S.countries) {
      const x = C(k);
      if (k === code || !x.alive) continue;
      const st = atWar(code, k) ? 'in guerra' : allied(code, k) ? 'alleato' : x.capitulated ? 'capitolato' : 'neutrale';
      L.push(`- ${x.name} (${k}): ${Diplo.opinion(k, code)} / ${Diplo.opinion(code, k)} / ${IDEOLOGIES[x.ideology].name} / ${st}${x.faction ? `, ${S.factions[x.faction].name}` : ''}${x.overlord ? `, suddito di ${C(x.overlord).name}` : ''}`);
    }
    return L.join('\n');
  },
};

// Definizioni delle azioni: nome, descrizione per l'IA, parametri e funzione.
const country = { type: 'string', description: 'Paese: codice (es. "G") o nome (es. "Germania")' };
const DIPLO_ACTIONS = [
  ['migliora_relazioni', `Migliora l'opinione di un paese verso di te (+15). Costo ${DIPLO_COST.improve} potere politico.`, { paese: country }, a => Diplo.improveRelations(S.player, a.paese)],
  ['giustifica_obiettivo_guerra', `Inizia a giustificare un obiettivo di guerra (45-70 giorni): è l'azione per "giustifica annessione/conquista/guerra". Non annette nulla: quando è pronto permette di dichiarare guerra. Costo ${DIPLO_COST.justify} PP (+${DIPLO_COST.justifyMajor} contro grandi potenze). Serve tensione mondiale sopra la soglia della tua ideologia. tipo: "conquest" (territori) o "puppet" (stato fantoccio).`,
    { paese: country, tipo: { type: 'string', enum: ['conquest', 'puppet'] } }, a => Diplo.justifyWargoal(S.player, a.paese, a.tipo || 'conquest')],
  ['annulla_obiettivo_guerra', 'Annulla un obiettivo di guerra in giustificazione o pronto.', { paese: country }, a => Diplo.cancelWargoal(S.player, a.paese)],
  ['dichiara_guerra', 'Dichiara guerra. Serve un obiettivo di guerra pronto, oppure che il bersaglio sia in guerra con un tuo alleato. Garanti e fazione del bersaglio entrano in guerra.', { paese: country }, a => Diplo.declareWar(S.player, a.paese)],
  ['garantisci_indipendenza', `Garantisci un paese: se attaccato entri in guerra. Costo ${DIPLO_COST.guarantee} PP.`, { paese: country }, a => Diplo.guarantee(S.player, a.paese)],
  ['crea_fazione', `Fonda una fazione. Costo ${DIPLO_COST.create} PP.`, { nome: { type: 'string', description: 'Nome della fazione (facoltativo)' } }, a => Diplo.createFaction(S.player, a.nome)],
  ['invita_in_fazione', `Invita un paese nella tua fazione. Costo ${DIPLO_COST.faction} PP. Accetta se opinione, ideologia e nemici comuni bastano.`, { paese: country }, a => Diplo.inviteToFaction(S.player, a.paese)],
  ['chiedi_adesione_fazione', `Chiedi di entrare nella fazione di un paese. Costo ${DIPLO_COST.faction} PP.`, { paese: country }, a => Diplo.askToJoinFaction(S.player, a.paese)],
  ['lascia_fazione', 'Lascia la tua fazione (non in guerra).', {}, () => Diplo.leaveFaction(S.player)],
  ['patto_non_aggressione', `Proponi un patto di non aggressione. Costo ${DIPLO_COST.nap} PP. Blocca obiettivi di guerra tra i due.`, { paese: country }, a => Diplo.signNap(S.player, a.paese)],
  ['rompi_patto', 'Rompi un patto di non aggressione: grave perdita di opinione con tutti.', { paese: country }, a => Diplo.breakNap(S.player, a.paese)],
  ['pretesa_annessione', `Pretesa stile Monaco: chiedi a un paese minore di farsi annettere subito, senza guerra. Usala solo se il leader chiede espressamente di pretendere o annettere subito, mai per "giustificare". Costo ${DIPLO_COST.demand} PP. Accetta solo se isolato (nessuna fazione o garante) e tu sei almeno 3 volte più forte.`, { paese: country }, a => Diplo.demandAnnexation(S.player, a.paese)],
  ['lend_lease', 'Invia equipaggiamento a un paese. quantita = una tantum; al_giorno = invio giornaliero continuo (0 per sospenderlo).',
    { paese: country, quantita: { type: 'number' }, al_giorno: { type: 'number' } },
    a => a.al_giorno != null ? Diplo.setLendLease(S.player, a.paese, a.al_giorno) : Diplo.lendLease(S.player, a.paese, a.quantita)],
  ['chiedi_lend_lease', 'Chiedi equipaggiamento a un paese amico (serve opinione ≥ 25 o alleanza e nemici in comune).', { paese: country, quantita: { type: 'number' } }, a => Diplo.requestLendLease(S.player, a.paese, a.quantita)],
  ['pace_bianca', `Proponi pace bianca: ognuno torna ai confini. Costo ${DIPLO_COST.whitePeace} PP. Accetta se sta perdendo più di te, o dopo un anno di stallo.`, { paese: country }, a => Diplo.proposeWhitePeace(S.player, a.paese)],
  ['riduci_autonomia', `Riduci l'autonomia di un tuo suddito (-15%). Costo ${DIPLO_COST.reduceAutonomy} PP.`, { paese: country }, a => Diplo.reduceAutonomy(S.player, a.paese)],
  ['annetti_suddito', `Annetti un fantoccio integrato con autonomia ≤ 50%. Costo ${DIPLO_COST.integrate} PP.`, { paese: country }, a => Diplo.integrateSubject(S.player, a.paese)],
  ['libera_suddito', 'Concedi la piena indipendenza a un suddito.', { paese: country }, a => Diplo.releaseSubject(S.player, a.paese)],
  ['governo_collaborazionista', `Insedia un governo collaborazionista in un paese capitolato: esce dalla guerra e diventa tuo fantoccio. Costo ${DIPLO_COST.collab} PP; serve conformità media ≥ 40% nei suoi territori occupati e rete di intelligence ≥ 25%.`, { paese: country }, a => Diplo.collabGovernment(S.player, a.paese)],
  ['legge_occupazione', `Cambia la legge di occupazione nei territori di un paese occupato. Leggi: ${Object.entries(OCC_LAWS).map(([k, l]) => `"${k}" (${l.name}: ${l.desc})`).join('; ')}.`,
    { paese: country, legge: { type: 'string', enum: Object.keys(OCC_LAWS) } }, a => Occupation.setLaw(S.player, a.paese, a.legge)],
  ['rete_spionaggio', 'Invia un agente a costruire una rete di intelligence in un paese (missione "network"), oppure al controspionaggio in patria (missione "counter"). Oppure richiama un agente (richiama: true).',
    { paese: country, missione: { type: 'string', enum: ['network', 'counter'] }, richiama: { type: 'boolean' } },
    a => a.richiama ? Intel.recall(S.player, a.paese, a.missione) : Intel.assign(S.player, a.paese, a.missione || 'network')],
  ['operazione_spionaggio', `Lancia un'operazione di spionaggio. Operazioni: ${Object.entries(INTEL_OPS).map(([k, o]) => `"${k}" (${o.name}: ${o.desc} Rete ≥ ${o.net}%, ${o.pp} PP, ${o.days} giorni)`).join('; ')}.`,
    { paese: country, operazione: { type: 'string', enum: Object.keys(INTEL_OPS) } }, a => Intel.startOp(S.player, a.paese, a.operazione)],
  ['potenzia_agenzia', 'Potenzia l\'agenzia di intelligence: +1 agente e controspionaggio migliore. Costo 50 PP × livello successivo.', {}, () => Intel.upgradeAgency(S.player)],
];

function registerDiploActions() {
  if (typeof GameActions === 'undefined' || !GameActions.register) return false;
  for (const [name, description, props, fn] of DIPLO_ACTIONS) {
    GameActions.register({
      name, description,
      input_schema: { type: 'object', properties: props, required: Object.keys(props).filter(k => k === 'paese' && !/rete_spionaggio/.test(name)) },
      run(input = {}) {
        const a = { ...input };
        if ('paese' in props && a.paese != null) {
          const code = DiploAPI.find(a.paese);
          if (!code) return { ok: false, msg: `Paese sconosciuto: ${a.paese}.` };
          a.paese = code;
        }
        const r = fn(a);
        if (typeof UI !== 'undefined') UI.dirty = true;
        return r;
      },
    });
  }
  return true;
}
if (typeof window !== 'undefined') window.addEventListener('DOMContentLoaded', registerDiploActions);
