'use strict';

// "Governo": il giocatore dà ordini diplomatici ed economici in linguaggio naturale e Claude
// li interpreta ed esegue con le azioni registrate in GameActions. Le chiamate all'API passano
// dal processo principale di Electron (window.governoAPI), che custodisce la chiave.

const Gov = {
  open: false, view: 'chat', busy: false,
  game: null,       // partita a cui si riferisce la conversazione
  conv: [],         // messaggi inviati all'API (solo in coda: mai modificati, per la cache e il pensiero)
  tools: null, system: null,
  lines: [],        // cosa mostra la chat: { who: 'me'|'gov'|'act'|'err'|'info', text, ok }
  status: null,
  MAX_STEPS: 15,
  MAX_CONV: 120,

  api() { return window.governoAPI || null; },

  init() {
    const btn = document.createElement('button');
    btn.id = 'gov-toggle';
    btn.className = 'hidden'; // compare quando inizia la partita
    btn.title = 'Governo: dai ordini diplomatici ed economici a parole (T)';
    btn.innerHTML = '🗣 Governo';
    btn.addEventListener('click', () => this.toggle());
    document.body.appendChild(btn);

    const w = document.createElement('div');
    w.id = 'gov-win';
    w.className = 'hidden';
    w.innerHTML = `
      <header>
        <b id="gov-title">Governo</b>
        <nav>
          <button data-view="chat">Ordini</button>
          <button data-view="rel">Relazioni</button>
          <button data-view="set" title="Impostazioni">⚙</button>
        </nav>
        <button class="x" id="gov-close" title="Chiudi">✕</button>
      </header>
      <div id="gov-body"></div>
      <form id="gov-form">
        <textarea id="gov-input" rows="2" placeholder="Es. proponi un patto di non aggressione all'URSS e costruisci due fabbriche militari"></textarea>
        <button type="submit" class="primary" id="gov-send">Invia</button>
      </form>`;
    document.body.appendChild(w);
    w.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => this.setView(b.dataset.view)));
    $('gov-close').addEventListener('click', () => this.toggle(false));
    $('gov-form').addEventListener('submit', e => { e.preventDefault(); this.submit(); });
    const inp = $('gov-input');
    // i tasti scritti qui non devono arrivare alle scorciatoie del gioco (Spazio = pausa ecc.)
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.submit(); }
      if (e.key === 'Escape') this.toggle(false);
    });
    w.addEventListener('keydown', e => e.stopPropagation());
    $('gov-body').addEventListener('click', e => {
      const el = e.target.closest('[data-gov]');
      if (el) this.action(el.dataset.gov, el);
    });
    window.addEventListener('keydown', e => {
      if (!S || UI.modalOpen || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.code === 'KeyT' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); this.toggle(true); }
    });
    setInterval(() => {
      btn.classList.toggle('hidden', !S);
      if (this.open && this.view === 'rel' && S) this.render();
    }, 1000);
  },

  toggle(force) {
    if (!S) return;
    this.open = force ?? !this.open;
    $('gov-win').classList.toggle('hidden', !this.open);
    $('gov-toggle').classList.toggle('on', this.open);
    if (this.open) {
      this.ensureGame();
      this.refreshStatus();
      this.render();
      if (this.view === 'chat') setTimeout(() => $('gov-input').focus(), 0);
    }
  },
  setView(v) {
    this.view = v;
    this.render();
    if (v === 'chat') $('gov-input').focus();
  },

  async refreshStatus() {
    const api = this.api();
    this.status = api ? await api.status() : null;
    this.render();
  },

  ensureGame() {
    if (this.game === S) return;
    this.game = S;
    this.conv = []; this.tools = null; this.system = null;
    this.lines = [{ who: 'info', text: `Il governo di ${C(S.player).name} attende i suoi ordini. Può chiedere di trattare con altri paesi, migliorare i rapporti, stringere o rompere alleanze, chiedere la pace, costruire fabbriche, addestrare divisioni, scegliere il focus nazionale, oppure semplicemente un consiglio.` }];
  },

  // ---------- disegno ----------
  render() {
    if (!S) return;
    const p = C(S.player);
    $('gov-title').innerHTML = `${flag(p)} Governo di ${esc(p.name)}`;
    document.querySelectorAll('#gov-win nav button').forEach(b => b.classList.toggle('on', b.dataset.view === this.view));
    $('gov-form').classList.toggle('hidden', this.view !== 'chat');
    const body = $('gov-body');
    if (this.view === 'chat') body.innerHTML = this.renderChat();
    else if (this.view === 'rel') body.innerHTML = this.renderRel();
    else body.innerHTML = this.renderSettings();
    if (this.view === 'chat') body.scrollTop = body.scrollHeight;
    $('gov-send').disabled = this.busy;
    $('gov-input').disabled = this.busy;
  },

  renderChat() {
    let h = '';
    if (!this.api()) h += `<div class="gl err">Il governo a parole funziona solo nell'app desktop di Iron Fist.</div>`;
    else if (this.status && !this.status.hasKey) h += `<div class="gl err">Manca la chiave API di Claude. <a href="#" data-gov="toset">Inseriscila nelle impostazioni ⚙</a>.</div>`;
    for (const l of this.lines) {
      if (l.who === 'act') h += `<div class="gl act ${l.ok ? 'ok' : 'ko'}">${l.ok ? '✔' : '✖'} ${esc(l.text)}</div>`;
      else h += `<div class="gl ${l.who}">${l.who === 'gov' ? richText(l.text) : esc(l.text).replace(/\n/g, '<br>')}</div>`;
    }
    if (this.busy) h += `<div class="gl info busy">Il governo sta deliberando…</div>`;
    if (this.lines.length <= 1 && !this.busy) {
      const ex = ['Come stanno i rapporti con i nostri vicini?', 'Cosa mi consigli di costruire adesso?', 'Migliora i rapporti con la Polonia'];
      h += `<div class="gov-ex">${ex.map(t => `<button data-gov="ex" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
    }
    return h;
  },

  renderRel() {
    const pc = S.player;
    const rows = Object.values(S.countries).filter(c => c.alive && c.code !== pc)
      .map(c => ({ c, op: Rel.opinion(c.code, pc), mine: Rel.opinion(pc, c.code) }))
      .sort((a, b) => b.op - a.op);
    let h = `<p class="hint">Opinione che ogni paese ha di noi (da −100 a +100). Decide se accetta le nostre proposte. Passa sopra a una riga per vedere da cosa dipende.</p><table class="gov-rel">`;
    for (const { c, op, mine } of rows) {
      const st = atWar(pc, c.code) ? '<span class="tag bad">guerra</span>' : allied(pc, c.code) ? '<span class="tag good">alleato</span>' : '';
      const extra = [
        Rel.hasPact(pc, c.code) ? '<span class="tag" title="Patto di non aggressione">PNA</span>' : '',
        S.guarantees.some(g => g.by === pc && g.to === c.code) ? '<span class="tag" title="Lo garantiamo">garantito</span>' : '',
      ].join('');
      const tip = Rel.breakdown(c.code, pc).map(([v, w]) => `${v > 0 ? '+' : ''}${v} ${w}`).join('\n') || 'Nessun fattore';
      const pct = Math.abs(op) / 2;
      h += `<tr title="${esc(tip)}"><td>${flag(c)} ${esc(c.name)}</td><td>${st}${extra}</td>
        <td class="opbar"><span class="${op >= 0 ? 'pos' : 'neg'}" style="width:${pct}%;${op >= 0 ? 'left:50%' : `left:${50 - pct}%`}"></span></td>
        <td class="num ${op > 0 ? 'good' : op < 0 ? 'bad' : ''}">${op > 0 ? '+' : ''}${op}</td>
        <td class="num dim" title="La nostra opinione di loro">${mine > 0 ? '+' : ''}${mine}</td></tr>`;
    }
    return h + '</table>';
  },

  renderSettings() {
    const api = this.api(), s = this.status;
    if (!api) return `<p>Disponibile solo nell'app desktop.</p>`;
    if (!s) return `<p>Caricamento…</p>`;
    const src = s.source === 'env' ? 'variabile d\'ambiente ANTHROPIC_API_KEY' : s.source === 'saved' ? 'chiave salvata (cifrata) su questo PC' : 'nessuna';
    return `
      <h4>Chiave API di Claude</h4>
      <p>In uso: <b>${src}</b></p>
      ${s.source === 'env' ? '<p class="hint">Finché la variabile ANTHROPIC_API_KEY è impostata ha la precedenza sulla chiave salvata.</p>' : ''}
      <p class="hint">Crea una chiave su <a href="https://console.anthropic.com/settings/keys" target="_blank">console.anthropic.com</a>. Ogni ordine costa qualche centesimo di dollaro di credito API. La chiave resta sul tuo PC, cifrata da Windows, e la usa solo il processo principale del gioco.</p>
      <div class="gov-key"><input id="gov-key" type="password" placeholder="sk-ant-…" autocomplete="off" spellcheck="false"><button data-gov="savekey" class="primary">Salva</button></div>
      ${s.source === 'saved' ? '<button data-gov="clearkey">Elimina la chiave salvata</button>' : ''}
      <p id="gov-keymsg" class="hint"></p>
      <h4>Modello</h4>
      <select id="gov-model">${s.models.map(m => `<option value="${m.id}" ${m.id === s.model ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
      <h4>Conversazione</h4>
      <button data-gov="reset">Ricomincia la conversazione</button>
      <p class="hint">Il governo ricorda gli scambi precedenti di questa partita. Ricominciare la svuota (non annulla le azioni già fatte).</p>`;
  },

  async action(name, el) {
    const api = this.api();
    if (name === 'toset') { this.setView('set'); return; }
    if (name === 'ex') { $('gov-input').value = el.dataset.text; this.submit(); return; }
    if (name === 'reset') { this.game = null; this.ensureGame(); this.setView('chat'); return; }
    if (name === 'savekey') {
      const r = await api.setKey($('gov-key').value);
      if (r.ok) { this.status = r.status; this.render(); $('gov-keymsg').textContent = 'Chiave salvata.'; }
      else $('gov-keymsg').textContent = r.error;
      return;
    }
    if (name === 'clearkey') { const r = await api.clearKey(); this.status = r.status; this.render(); return; }
  },

  // ---------- conversazione con Claude ----------
  buildSystem() {
    const p = C(S.player);
    return `Sei il governo di ${p.name} in Iron Fist, un gioco di grande strategia ambientato in Europa tra il 1936 e il 1946 sul modello di Hearts of Iron IV. Il giocatore è il capo della nazione: ti scrive ordini, domande e messaggi in italiano, in linguaggio naturale. Tu interpreti cosa vuole e lo realizzi con gli strumenti a disposizione, che sono le uniche azioni diplomatiche ed economiche possibili nel gioco.

Come lavori:
- Esegui ciò che il leader chiede o che ne segue in modo evidente. Se un ordine comprende più azioni, falle tutte. Se una richiesta è ambigua o un'azione è grave e non chiaramente voluta (dichiarare guerra, rompere un patto, uscire da una fazione, pretendere un'annessione), chiedi conferma prima.
- Ogni messaggio del leader arriva con lo stato attuale della partita tra i tag <stato_partita>. Usalo per codici dei paesi, risorse, costi e opinioni. Se ti servono dettagli su un paese o vuoi sapere se accetterebbe una proposta, usa lo strumento di rapporto prima di proporre o consigliare.
- Le proposte agli altri paesi le decide il gioco, non tu: riporta fedelmente l'esito restituito dallo strumento, senza inventare accettazioni o concessioni. Puoi dare voce al governo straniero con una breve risposta diplomatica coerente con i motivi dell'esito.
- Se il leader vuole qualcosa che nessuno strumento permette, dillo e proponi l'alternativa più vicina. Se un'azione fallisce, spiega perché con il motivo restituito.
- Quando il leader parla direttamente a un paese ("dite alla Francia che..."), rispondi come quel governo reagirebbe, in base all'opinione e alla situazione, e usa gli strumenti se dal dialogo nasce un accordo concreto.
- Se chiede un consiglio, ragiona da stratega di Hearts of Iron IV: economia prima della guerra, alleanze, minacce ai confini, tempistiche storiche.

Rispondi in italiano, in modo conciso (di solito da due a sei frasi), con il tono di un ministro che riferisce al capo. Scrivi testo semplice senza titoli né tabelle; puoi usare **grassetto** per i nomi importanti. Non elencare di nuovo le azioni eseguite una per una: il leader le vede già nel registro, riassumi l'esito.`;
  },

  async submit() {
    const inp = $('gov-input');
    const text = inp.value.trim();
    if (!text || this.busy || !S) return;
    const api = this.api();
    if (!api) return;
    if (!this.status) await this.refreshStatus();
    if (!this.status?.hasKey) { this.setView('set'); return; }
    this.ensureGame();
    inp.value = '';
    this.lines.push({ who: 'me', text });
    if (!this.tools || this.conv.length > this.MAX_CONV) this.startConversation();
    const userBlocks = [
      { type: 'text', text: `<stato_partita>\n${gameStateText()}\n</stato_partita>` },
      { type: 'text', text },
    ];
    // se il turno precedente si è interrotto dopo i risultati degli strumenti, l'ultimo messaggio è
    // già dell'utente: si aggiunge lì (dopo di esso non c'è ancora nessuna risposta)
    const last = this.conv[this.conv.length - 1];
    if (last && last.role === 'user') last.content.push(...userBlocks);
    else this.conv.push({ role: 'user', content: userBlocks });

    const wasPaused = S.paused;
    S.paused = true;
    this.busy = true;
    this.render();
    try {
      await this.loop();
    } finally {
      this.busy = false;
      if (!wasPaused && !S.over && S.paused) S.paused = false;
      UI.dirty = true;
      this.render();
      if (this.open) $('gov-input').focus();
    }
  },

  startConversation() {
    const recap = this.conv.length
      ? this.lines.filter(l => l.who === 'me' || l.who === 'gov').slice(-8).map(l => `${l.who === 'me' ? 'Leader' : 'Governo'}: ${l.text}`).join('\n')
      : '';
    this.conv = [];
    this.tools = GameActions.tools();
    this.system = this.buildSystem();
    if (recap) {
      this.conv.push({ role: 'user', content: [{ type: 'text', text: `Riassunto degli ultimi scambi (la conversazione precedente è stata chiusa perché troppo lunga):\n${recap}` }] });
      this.conv.push({ role: 'assistant', content: [{ type: 'text', text: 'Ricevuto, proseguiamo da qui.' }] });
    }
  },

  async loop() {
    const api = this.api();
    const game = S;
    for (let step = 0; step < this.MAX_STEPS; step++) {
      const r = await api.send({ system: this.system, tools: this.tools, messages: this.conv });
      if (S !== game) return; // nel frattempo è iniziata un'altra partita
      if (!r.ok) {
        // una richiesta fallita al primo passo non lascia traccia: si toglie l'ordine non risposto
        if (step === 0) this.conv.pop();
        this.lines.push({ who: 'err', text: r.error });
        if (r.kind === 'auth' || r.kind === 'nokey') this.refreshStatus();
        return;
      }
      const m = r.message;
      this.conv.push({ role: 'assistant', content: m.content });
      for (const b of m.content) if (b.type === 'text' && b.text.trim()) this.lines.push({ who: 'gov', text: b.text.trim() });
      this.render();
      if (m.stop_reason === 'refusal') { this.lines.push({ who: 'err', text: 'Il governo non può dar seguito a questa richiesta.' }); return; }
      if (m.stop_reason === 'max_tokens') { this.lines.push({ who: 'err', text: 'Risposta interrotta perché troppo lunga.' }); return; }
      if (m.stop_reason === 'pause_turn') continue;
      if (m.stop_reason !== 'tool_use') return;
      const results = [];
      for (const b of m.content) {
        if (b.type !== 'tool_use') continue;
        const res = GameActions.exec(b.name, b.input);
        const label = actionLabel(b.name, b.input);
        const refused = res.ok && /"esito":"RIFIUTATO"/.test(res.result);
        if (label) this.lines.push({ who: 'act', ok: res.ok && !refused, text: !res.ok ? `${label}: ${res.error}` : refused ? `${label}: rifiutata` : label });
        results.push({ type: 'tool_result', tool_use_id: b.id, content: res.ok ? res.result : res.error, ...(res.ok ? {} : { is_error: true }) });
      }
      this.conv.push({ role: 'user', content: results });
      this.render();
    }
    this.lines.push({ who: 'err', text: 'Troppi passaggi per un solo ordine: mi fermo qui.' });
  },
};

// Etichetta leggibile di un'azione nella chat (null = azione di sola lettura, non mostrata)
function actionLabel(name, input) {
  if (name === 'country_report') return null;
  const cn = () => { try { return C(findCountry(input.country)).name; } catch (e) { return input.country; } };
  switch (name) {
    case 'improve_relations': return `Missione diplomatica: ${cn()}`;
    case 'declare_war': return `Dichiarazione di guerra: ${cn()}`;
    case 'guarantee_independence': return `Garanzia di indipendenza: ${cn()}`;
    case 'revoke_guarantee': return `Garanzia ritirata: ${cn()}`;
    case 'propose_non_aggression_pact': return `Proposta di patto di non aggressione: ${cn()}`;
    case 'cancel_non_aggression_pact': return `Patto di non aggressione denunciato: ${cn()}`;
    case 'create_faction': return 'Fondazione di una fazione';
    case 'invite_to_faction': return `Invito nella fazione: ${cn()}`;
    case 'request_faction_membership': return `Richiesta di adesione alla fazione di ${cn()}`;
    case 'leave_faction': return 'Uscita dalla fazione';
    case 'demand_annexation': return `Pretesa di annessione: ${cn()}`;
    case 'propose_peace': return `Proposta di pace: ${cn()}`;
    case 'send_equipment': return `Aiuti militari a ${cn()}: ${input.amount}`;
    case 'request_equipment': return `Richiesta di equipaggiamento a ${cn()}`;
    case 'build_factories': return `Cantieri: ${input.count || 1} fabbrica/he ${input.type === 'mil' ? 'militari' : 'civili'}`;
    case 'cancel_construction': return 'Cantiere annullato';
    case 'recruit_divisions': return `Reclutamento: ${input.count || 1} ${UNIT_TYPES[input.type]?.name || input.type}`;
    case 'start_national_focus': return `Focus nazionale: ${FOCUS_BY_ID[input.focus_id]?.name || input.focus_id}`;
    default: {
      const t = name.replace(/_/g, ' ');
      const who = input && (input.country || input.paese || input.target);
      let c = '';
      if (who) { try { c = `: ${C(findCountry(who)).name}`; } catch (e) { c = `: ${who}`; } }
      return t.charAt(0).toUpperCase() + t.slice(1) + c;
    }
  }
}

function richText(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}

Gov.init();
