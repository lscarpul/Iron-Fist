'use strict';

// "Governo": il giocatore dà ordini diplomatici ed economici in linguaggio naturale e un modello
// (locale via Ollama, oppure Claude) li interpreta ed esegue con le azioni registrate in GameActions.
// Le chiamate passano dal processo principale di Electron (window.governoAPI).

const Gov = {
  open: false, view: 'chat', busy: false,
  game: null,       // partita a cui si riferisce la conversazione
  conv: [],         // messaggi inviati all'API (solo in coda: mai modificati, per la cache e il pensiero)
  tools: null, system: null,
  lines: [],        // cosa mostra la chat: { who: 'me'|'gov'|'act'|'err'|'info', text, ok }
  status: null,
  MAX_STEPS: 15,
  // narrator = come l'IA di Pax Historia: oltre al governo può cambiare liberamente il mondo
  mode: pref('gov-mode', 'narrator'),
  newsEvery: +pref('gov-news', '3'),   // mesi di gioco tra un notiziario e l'altro (0 = mai)
  newsBusy: false,
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
    $('gov-body').addEventListener('change', e => { if (e.target.id) this.change(e.target.id, e.target.value); });
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
      this.newsTick();
      if (this.open && this.view === 'chat' && (this.busy || this.newsBusy)) this.updateBusy();
    }, 1000);
    const api = this.api();
    if (api && api.onProgress) api.onProgress(p => { this.progress = p; this.updateBusy(); });
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
    // il modello locale si carica in memoria subito, non al primo ordine
    const st = this.status;
    if (st && st.provider === 'local' && st.ready && api.warmup && this.warmed !== st.local?.model) { this.warmed = st.local?.model; api.warmup(); }
    if (this.status && this.status.provider === 'local' && !this.localModels) this.scanLocal();
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
    else if (this.status && !this.status.ready) h += `<div class="gl err">${this.status.provider === 'local' ? 'Nessun modello locale scelto. Avvia Ollama e' : 'Manca la chiave API di Claude.'} <a href="#" data-gov="toset">apri le impostazioni ⚙</a>.</div>`;
    for (const l of this.lines) {
      if (l.who === 'act') h += `<div class="gl act ${l.ok ? 'ok' : 'ko'}">${l.ok ? '✔' : '✖'} ${esc(l.text)}</div>`;
      else h += `<div class="gl ${l.who}">${l.who === 'gov' ? richText(l.text) : esc(l.text).replace(/\n/g, '<br>')}</div>`;
    }
    if (this.busy || this.newsBusy) h += `<div class="gl info" id="gov-busy">${this.busyText()}</div>`;
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
    const lc = s.local;
    let h = `
      <h4>Chi fa da governo</h4>
      <select id="gov-provider">
        <option value="local" ${s.provider === 'local' ? 'selected' : ''}>Modello locale sul tuo PC (gratis)</option>
        <option value="claude" ${s.provider === 'claude' ? 'selected' : ''}>Claude, via API di Anthropic (a pagamento)</option>
      </select>`;
    if (s.provider === 'local') {
      const models = this.localModels || [];
      const opts = [...new Set([lc.model, ...models].filter(Boolean))];
      h += `
      <h4>Server locale</h4>
      <select id="gov-lkind">${Object.entries(s.presets).map(([k, v]) => `<option value="${k}" ${k === lc.kind ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>
      <div class="gov-key"><input id="gov-lurl" value="${esc(lc.url)}" spellcheck="false"><button data-gov="lscan">Cerca modelli</button></div>
      <h4>Modello</h4>
      <select id="gov-lmodel">${opts.length ? opts.map(m => `<option ${m === lc.model ? 'selected' : ''}>${esc(m)}</option>`).join('') : '<option value="">nessun modello trovato</option>'}</select>
      <p id="gov-lmsg" class="hint">${esc(this.localMsg || '')}</p>
      <p class="hint">Con Ollama avviato, i modelli scaricati compaiono qui (es. <code>ollama pull qwen2.5:7b</code>). Servono modelli che supportano le chiamate di funzione: Qwen 2.5/3, Llama 3.1+, Mistral. Più il modello è grande, meglio capisce gli ordini; un 7-8B va bene, sotto i 4B sbaglia spesso.</p>`;
    } else {
      const src = s.source === 'env' ? 'variabile d\'ambiente ANTHROPIC_API_KEY' : s.source === 'saved' ? 'chiave salvata (cifrata) su questo PC' : 'nessuna';
      h += `
      <h4>Chiave API di Claude</h4>
      <p>In uso: <b>${src}</b></p>
      ${s.source === 'env' ? '<p class="hint">Finché la variabile ANTHROPIC_API_KEY è impostata ha la precedenza sulla chiave salvata.</p>' : ''}
      <p class="hint">Crea una chiave su <a href="https://console.anthropic.com/settings/keys" target="_blank">console.anthropic.com</a>. Ogni ordine costa qualche centesimo di dollaro di credito API. La chiave resta sul tuo PC, cifrata da Windows, e la usa solo il processo principale del gioco.</p>
      <div class="gov-key"><input id="gov-key" type="password" placeholder="sk-ant-…" autocomplete="off" spellcheck="false"><button data-gov="savekey" class="primary">Salva</button></div>
      ${s.source === 'saved' ? '<button data-gov="clearkey">Elimina la chiave salvata</button>' : ''}
      <p id="gov-keymsg" class="hint"></p>
      <h4>Modello</h4>
      <select id="gov-model">${s.models.map(m => `<option value="${m.id}" ${m.id === s.model ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>`;
    }
    return h + `
      <h4>Modalità</h4>
      <select id="gov-mode">
        <option value="narrator" ${this.mode === 'narrator' ? 'selected' : ''}>Narratore libero, come Pax Historia: può cambiare il mondo</option>
        <option value="government" ${this.mode === 'government' ? 'selected' : ''}>Solo governo: diplomazia ed economia con le regole del gioco</option>
      </select>
      <p class="hint">Da narratore il governo giudica cosa è plausibile e può fondare città, spostare confini, far nascere nazioni, cambiare regimi e pubblicare notizie.</p>
      <h4>Notiziario del mondo</h4>
      <select id="gov-news" ${this.mode === 'narrator' ? '' : 'disabled'}>
        ${[[0, 'Mai'], [1, 'Ogni mese'], [3, 'Ogni 3 mesi'], [6, 'Ogni 6 mesi'], [12, 'Ogni anno']].map(([v, l]) => `<option value="${v}" ${this.newsEvery === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <p class="hint">Il narratore inventa eventi plausibili nel mondo (colpi di stato, crisi, nuove città, trattati) a intervalli regolari di tempo di gioco.</p>
      <h4>Conversazione</h4>
      <button data-gov="reset">Ricomincia la conversazione</button>
      <p class="hint">Il governo ricorda gli scambi precedenti di questa partita. Ricominciare la svuota (non annulla le azioni già fatte).</p>`;
  },

  // cerca i modelli sul server locale; se non ne è scelto nessuno prende il primo (preferendo Qwen)
  async scanLocal(cfg) {
    const api = this.api();
    const r = await api.localModels(cfg);
    if (!r.ok) { this.localModels = []; this.localMsg = r.error; this.render(); return; }
    this.localModels = r.models;
    this.localMsg = r.models.length ? `${r.models.length} modelli trovati.` : 'Il server risponde ma non ha modelli: scaricane uno (es. ollama pull qwen2.5:7b).';
    const lc = { ...this.status.local, ...(cfg || {}) };
    if ((!lc.model || !r.models.includes(lc.model)) && r.models.length) {
      lc.model = r.models.find(m => /qwen/i.test(m)) || r.models[0];
      const s = await api.setLocal(lc);
      if (s.ok) this.status = s.status;
    }
    this.render();
  },

  async action(name, el) {
    const api = this.api();
    if (name === 'toset') { this.setView('set'); return; }
    if (name === 'ex') { $('gov-input').value = el.dataset.text; this.submit(); return; }
    if (name === 'cancel') { this.cancelling = true; this.updateBusy(); api.cancel?.(); return; }
    if (name === 'reset') { this.game = null; this.ensureGame(); this.setView('chat'); return; }
    if (name === 'savekey') {
      const r = await api.setKey($('gov-key').value);
      if (r.ok) { this.status = r.status; this.render(); $('gov-keymsg').textContent = 'Chiave salvata.'; }
      else $('gov-keymsg').textContent = r.error;
      return;
    }
    if (name === 'clearkey') { const r = await api.clearKey(); this.status = r.status; this.render(); return; }
    if (name === 'lscan') { await this.scanLocal({ kind: $('gov-lkind').value, url: $('gov-lurl').value.trim() }); return; }
  },

  async change(id, value) {
    const api = this.api();
    let r = null;
    if (id === 'gov-mode') { this.mode = value === 'government' ? 'government' : 'narrator'; savePref('gov-mode', this.mode); this.tools = null; this.render(); return; }
    if (id === 'gov-news') { this.newsEvery = +value || 0; savePref('gov-news', String(this.newsEvery)); if (S) S.lastNewsDay = S.day; return; }
    if (id === 'gov-provider') { r = await api.setProvider(value); this.tools = null; if (value === 'local') setTimeout(() => this.scanLocal(), 0); }
    else if (id === 'gov-model') r = await api.setModel(value);
    else if (id === 'gov-lkind') {
      const kind = value;
      r = await api.setLocal({ kind, url: this.status.presets[kind].url, model: '' });
      if (r.ok) { this.status = r.status; this.scanLocal(); return; }
    } else if (id === 'gov-lmodel') r = await api.setLocal({ ...this.status.local, model: value });
    else if (id === 'gov-lurl') { r = await api.setLocal({ ...this.status.local, url: value.trim() }); if (r.ok) { this.status = r.status; this.scanLocal(); return; } }
    if (!r) return;
    if (r.ok) this.status = r.status; else this.localMsg = r.error;
    this.render();
  },

  // ---------- conversazione con il modello ----------
  buildSystem(mode) {
    return this.governmentPrompt() + (mode === 'narrator' ? NARRATOR_PROMPT : '');
  },
  governmentPrompt() {
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

  // avanzamento della richiesta in corso, con il tempo trascorso e il tasto per annullarla
  busyText() {
    const p = this.progress || {};
    const secs = Math.round((Date.now() - (this.busySince || Date.now())) / 1000);
    const local = this.status?.provider === 'local';
    let what = 'Il governo sta deliberando';
    if (p.phase === 'prompt') what = local ? 'Il modello legge la situazione' : 'Il governo sta deliberando';
    else if (p.phase === 'writing') what = `Il governo scrive la risposta (${p.tokens} pezzi)`;
    const slow = local && p.phase === 'prompt' && secs > 45 ? '<br><small>Senza scheda video il primo ordine può richiedere qualche minuto; i successivi sono più veloci.</small>' : '';
    return `<span class="busy">${what}… ${secs} s</span> <button data-gov="cancel" class="gov-cancel" ${this.cancelling ? 'disabled' : ''}>${this.cancelling ? 'Annullo…' : 'Annulla'}</button>${slow}`;
  },
  updateBusy() {
    const el = document.getElementById('gov-busy');
    if (el) el.innerHTML = this.busyText();
  },
  // strumenti da mandare: a Claude tutti (restano in cache), a un modello locale solo quelli che
  // c'entrano con l'ordine, con descrizioni brevi, perché ogni token in più costa secondi
  toolsFor(text, mode) {
    const all = GameActions.tools(mode);
    if (this.status?.provider !== 'local') return all;
    return compactTools(pickTools(all, text, mode));
  },

  async submit() {
    const inp = $('gov-input');
    const text = inp.value.trim();
    if (!text || this.busy || !S) return;
    const api = this.api();
    if (!api) return;
    if (!this.status) await this.refreshStatus();
    if (!this.status?.ready) { this.setView('set'); return; }
    this.ensureGame();
    inp.value = '';
    this.lines.push({ who: 'me', text });
    if (!this.tools || this.convMode !== this.mode || this.conv.length > this.MAX_CONV) this.startConversation();
    const local = this.status.provider === 'local';
    const tools = this.toolsFor(text, this.convMode);
    const userBlocks = [
      { type: 'text', text: `<stato_partita>\n${gameStateText(local ? { compact: true, focus: tools.some(t => t.name === 'start_national_focus') } : undefined)}\n</stato_partita>` },
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
    this.busySince = Date.now(); this.progress = null; this.cancelling = false;
    this.render();
    try {
      await this.loop(this.conv, this.system, tools, this.convMode);
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
    this.convMode = this.mode;
    this.tools = GameActions.tools(this.mode);
    this.system = this.buildSystem(this.mode);
    if (recap) {
      this.conv.push({ role: 'user', content: [{ type: 'text', text: `Riassunto degli ultimi scambi (la conversazione precedente è stata chiusa perché troppo lunga):\n${recap}` }] });
      this.conv.push({ role: 'assistant', content: [{ type: 'text', text: 'Ricevuto, proseguiamo da qui.' }] });
    }
  },

  async loop(conv, system, tools, mode) {
    const api = this.api();
    const game = S;
    for (let step = 0; step < this.MAX_STEPS; step++) {
      const r = await api.send({ system, tools, messages: conv });
      if (S !== game) return; // nel frattempo è iniziata un'altra partita
      if (!r.ok) {
        // una richiesta fallita al primo passo non lascia traccia: si toglie l'ordine non risposto
        if (step === 0) conv.pop();
        this.lines.push({ who: r.kind === 'cancel' ? 'info' : 'err', text: r.error });
        if (r.kind === 'auth' || r.kind === 'nokey') this.refreshStatus();
        return;
      }
      const m = r.message;
      conv.push({ role: 'assistant', content: m.content });
      for (const b of m.content) if (b.type === 'text' && b.text.trim()) this.lines.push({ who: 'gov', text: b.text.trim() });
      this.render();
      if (m.stop_reason === 'refusal') { this.lines.push({ who: 'err', text: 'Il governo non può dar seguito a questa richiesta.' }); return; }
      if (m.stop_reason === 'max_tokens') { this.lines.push({ who: 'err', text: 'Risposta interrotta perché troppo lunga.' }); return; }
      if (m.stop_reason === 'pause_turn') continue;
      if (m.stop_reason !== 'tool_use') return;
      const results = [];
      for (const b of m.content) {
        if (b.type !== 'tool_use') continue;
        const res = GameActions.exec(b.name, b.input, mode);
        const label = actionLabel(b.name, b.input);
        const refused = res.ok && /"esito":"RIFIUTATO"/.test(res.result);
        if (label) this.lines.push({ who: 'act', ok: res.ok && !refused, text: !res.ok ? `${label}: ${res.error}` : refused ? `${label}: rifiutata` : label });
        results.push({ type: 'tool_result', tool_use_id: b.id, content: res.ok ? res.result : res.error, ...(res.ok ? {} : { is_error: true }) });
      }
      conv.push({ role: 'user', content: results });
      this.progress = null;
      this.render();
    }
    this.lines.push({ who: 'err', text: 'Troppi passaggi per un solo ordine: mi fermo qui.' });
  },

  // ---------- notiziario: eventi del mondo generati dal narratore ----------
  newsTick() {
    if (!S || S.over || this.mode !== 'narrator' || !this.newsEvery || this.busy || this.newsBusy) return;
    if (!this.status?.ready) return;
    if (S.lastNewsDay == null) { S.lastNewsDay = S.day; return; }
    if (S.day - S.lastNewsDay < this.newsEvery * 30) return;
    S.lastNewsDay = S.day;
    this.generateNews();
  },
  async generateNews() {
    const game = S;
    this.newsBusy = true;
    this.busySince = Date.now(); this.progress = null; this.cancelling = false;
    this.ensureGame();
    this.lines.push({ who: 'info', text: `📰 Notiziario del ${dateLabel(S.day)}` });
    this.render();
    const conv = [{ role: 'user', content: [{ type: 'text', text: `<stato_mondo>\n${worldStateText()}\n</stato_mondo>\n\n<stato_partita>\n${gameStateText(this.status?.provider === 'local' ? { compact: true } : undefined)}\n</stato_partita>\n\nSono passati ${this.newsEvery} mesi dall'ultimo notiziario. Racconta da 1 a 3 eventi plausibili accaduti nel mondo in questo periodo e applicane le conseguenze con gli strumenti.` }] }];
    try {
      const local = this.status?.provider === 'local';
      const tools = GameActions.tools('narrator').filter(t => !local || NEWS_TOOLS.test(t.name));
      await this.loop(conv, NEWS_PROMPT, local ? compactTools(tools) : tools, 'narrator');
    } finally {
      this.newsBusy = false;
      this.render();
    }
  },
};

// Etichetta leggibile di un'azione nella chat (null = azione di sola lettura, non mostrata)
function actionLabel(name, input) {
  if (name === 'country_report') return null;
  if (name === 'notizia') return `📰 ${input.titolo || 'Notizia'}`;
  if (name === 'crea_citta') return `Nuova città: ${input.nome} (${input.luogo})`;
  if (name === 'cedi_regioni') return `Regioni a ${input.a}: ${input.regioni}`;
  if (name === 'crea_nazione') return `Nuova nazione: ${input.nome}`;
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

// ---------- strumenti per i modelli locali ----------
// Ogni gruppo: quali strumenti (per nome) e quali parole dell'ordine lo richiamano (radici senza accenti).
const TOOL_GROUPS = [
  { tools: /migliora_relazioni|patto_non_aggressione|rompi_patto|garantisci|embargo|annulla_accordo/,
    words: /relazi|rapport|amic|opinion|patt|garan|embargo|accord|trattat|negoz|propo|aggress|rompi|diplom/ },
  { tools: /dichiara_guerra|obiettivo_guerra|pretesa|pace_bianca/,
    words: /guerr|pace|pretes|obiettiv|giustific|annett|invad|attacc|conquist|monaco/ },
  { tools: /fazione/, words: /fazion|allea|asse|comintern|blocco/ },
  { tools: /suddito|autonomia/, words: /suddit|fantocc|autonom|vassall|liber/ },
  { tools: /lend_lease/, words: /lend|prest|aiut|forni/ },
  { tools: /costruisci|fabbriche_linea|legge_economica|dottrina_industriale|economia_stato/,
    words: /fabbric|costru|cantier|legg|econom|industri|mobilit/ },
  { tools: /linea_produzione|modello_linea|fabbriche_linea|compra|vendi/,
    words: /produ|linea|equipagg|carri|cannon|fucil|aere|nav|compr|vend|armi/ },
  { tools: /importa|legge_commerciale/, words: /risors|petrol|acciai|gomma|allumin|tungst|cromo|commerc|import|scamb/ },
  { tools: /recruit/, words: /divisio|reclut|addestr|eserc|trupp|soldat/ },
  { tools: /spionaggio|agenzia|collaborazionista/, words: /spi|agent|sabot|colpo|intellig|decritt|propagand|collabor/ },
  { tools: /occupazione/, words: /occup|resist|guarnig|conform/ },
  { tools: /focus/, words: /focus|ricerc|tecnolog|dottrin|piano/ },
];
// strumenti del narratore (cambiano il mondo) e parole che li richiamano
const WORLD_WORDS = /citt|fond|region|provinc|nazion|indipend|govern|regim|capo di|leader|notizi|rinomin|capital|confin|colpo di stato|punti vittoria|separat|rivolt|elezion|cedi|cession|territor|schier|evento|inventa|nasce|nuov[oa] stato/;
const NEWS_TOOLS = /notizia|cambia_governo|cambia_rapporti|modifica_risorse|crea_citta|cedi_regioni|crea_nazione|schiera_divisioni|guerra_tra|pace_tra|elenca_regioni|rinomina_nazione/;
function normText(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function pickTools(all, text, mode) {
  const t = normText(text);
  const want = new Set(['country_report']);
  let hit = false;
  for (const g of TOOL_GROUPS) if (g.words.test(t)) { hit = true; for (const x of all) if (g.tools.test(x.name)) want.add(x.name); }
  if (mode === 'narrator') {
    const gov = new Set(GameActions.tools('government').map(x => x.name));
    const world = all.filter(x => !gov.has(x.name));
    if (WORLD_WORDS.test(t)) { hit = true; for (const x of world) want.add(x.name); }
  }
  // ordine generico ("che facciamo?"): le azioni più comuni
  if (!hit) for (const x of all) if (/migliora_relazioni|costruisci|start_national_focus|notizia/.test(x.name)) want.add(x.name);
  return all.filter(x => want.has(x.name));
}
// descrizioni accorciate alla prima frase: i modelli piccoli leggono più in fretta e sbagliano meno
function compactTools(tools) {
  const cut = (d, n) => { d = String(d || ''); const i = d.search(/[.:;](\s|$)/); if (i > 20 && i < n) d = d.slice(0, i + 1); return d.length > n ? d.slice(0, n - 1) + '…' : d; };
  return tools.map(t => {
    const props = {};
    for (const [k, v] of Object.entries(t.input_schema?.properties || {})) props[k] = { ...v, ...(v.description ? { description: cut(v.description, 80) } : {}) };
    return { ...t, description: cut(t.description, 160), input_schema: { ...t.input_schema, properties: props } };
  });
}

// preferenze per questo PC (localStorage può mancare: si usano i valori predefiniti)
function pref(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }
function savePref(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* non salvata */ } }

const NARRATOR_PROMPT = `

Modalità narratore (come l'IA di Pax Historia): oltre a governare sei anche il narratore e arbitro del mondo. Hai strumenti per cambiarlo liberamente: fondare città con punti vittoria, rinominarle, spostare regioni tra paesi, far nascere o annettere nazioni, cambiare regimi e capi di stato, far scoppiare guerre o firmare paci tra paesi qualsiasi, cambiare rapporti, risorse e truppe, pubblicare notizie.
- Quando il leader descrive un'azione libera ("costruisco una nuova città sul Baltico", "finanzio un colpo di stato in Romania", "compro l'Alaska dagli USA"), giudica cosa è plausibile con i suoi mezzi, il periodo storico e la reazione degli altri paesi, poi applica l'esito con gli strumenti. Le azioni ambiziose possono riuscire solo in parte, fallire o costare: in quel caso togli risorse al giocatore (potere politico, fabbriche, equipaggiamento) con modifica_risorse.
- Per le azioni che il gioco già regola (dichiarazioni di guerra del giocatore, proposte diplomatiche, costruzioni, focus) usa le azioni di governo, non quelle libere.
- Fai reagire il mondo: dopo un cambiamento importante pubblica una notizia e, se serve, cambia i rapporti dei paesi coinvolti.
- Mantieni il mondo coerente: usa i nomi delle regioni e delle città che esistono sulla mappa, non togliere territori a paesi in guerra senza una pace, non creare cose assurde per il 1936-1946 a meno che il leader non lo chieda espressamente per gioco.`;

const NEWS_PROMPT = `Sei il narratore di Iron Fist, un gioco di grande strategia sul modello di Hearts of Iron IV ambientato nel mondo tra il 1936 e il 1946. Ogni qualche mese di gioco racconti cosa succede nel mondo, come fa l'IA di Pax Historia.

Ricevi lo stato del mondo e della nazione del giocatore. Inventa da 1 a 3 eventi plausibili per il periodo e la situazione (crisi politiche, colpi di stato, elezioni, trattati, scoperte, rivolte, nuove città, catastrofi, mosse delle grandi potenze), ispirandoti alla storia reale ma reagendo a come la partita è andata davvero. Per ogni evento pubblica una notizia con lo strumento notizia e applicane le conseguenze concrete con gli altri strumenti (cambia_governo, cambia_rapporti, modifica_risorse, crea_citta, cedi_regioni, crea_nazione, schiera_divisioni, guerra_tra...). Non decidere al posto del giocatore e non fargli dichiarare guerre: gli eventi possono toccarlo, ma le sue scelte restano sue. Tieni gli effetti proporzionati. Alla fine scrivi una sola frase di riepilogo in italiano.`;

function richText(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}

Gov.init();
