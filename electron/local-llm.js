'use strict';
// Fornitore locale per il "Governo": un modello che gira sul PC del giocatore (es. Qwen) tramite
// Ollama (API nativa) o un server compatibile OpenAI (LM Studio, llama.cpp, vLLM...).
// La pagina di gioco parla sempre nel formato dei messaggi di Claude (blocchi text/tool_use/tool_result):
// qui lo si traduce avanti e indietro, e si recuperano le azioni anche quando un modello piccolo
// le scrive nel testo invece di usare le chiamate di funzione.

const PRESETS = {
  ollama: { label: 'Ollama', url: 'http://localhost:11434' },
  openai: { label: 'LM Studio / compatibile OpenAI', url: 'http://localhost:1234/v1' },
};
const MAX_HISTORY = 14;   // messaggi recenti inviati: i modelli piccoli hanno poco contesto
// contesto richiesto a Ollama (il suo predefinito tronca il prompt). Resta fisso: se cambia,
// Ollama ricarica il modello. Più è grande, più memoria serve e più va lento senza GPU.
const NUM_CTX = 12288;
const KEEP_ALIVE = '30m';             // il modello resta in memoria tra un ordine e l'altro
const FIRST_TOKEN_MS = 300000;        // lettura del prompt: su CPU può durare minuti
const IDLE_MS = 90000;                // pausa massima tra due pezzi della risposta
const TIMEOUT_MS = 240000;

const LOCAL_HINT = `

Nota sul formato: per compiere un'azione chiama la funzione corrispondente (tool) con gli argomenti richiesti; puoi chiamarne più di una. Usa solo le funzioni elencate. Dopo aver ricevuto i risultati, rispondi al leader in italiano.`;

function baseUrl(cfg) { return String(cfg.url || PRESETS[cfg.kind]?.url || '').replace(/\/+$/, ''); }

async function http(url, body, ms = TIMEOUT_MS, signal) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  if (signal) signal.addEventListener('abort', () => ctl.abort(), { once: true });
  try {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text.slice(0, 300);
      try { const j = JSON.parse(text); msg = j.error?.message || j.error || msg; } catch { /* testo semplice */ }
      const e = new Error(`HTTP ${res.status}: ${msg}`);
      e.status = res.status;
      throw e;
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

function errorInfo(e, cfg, signal) {
  if (signal && signal.aborted) return { kind: 'cancel', error: 'Ordine annullato.' };
  if (e.timeout) return { kind: 'network', error: e.message };
  if (e.name === 'AbortError') return { kind: 'network', error: 'Il modello locale non ha risposto in tempo. Prova un modello più piccolo o riprova.' };
  if (e.status === 404 && /model/i.test(e.message)) return { kind: 'request', error: `Modello "${cfg.model}" non trovato sul server locale. Scaricalo (es. "ollama pull ${cfg.model}") o scegline un altro nelle impostazioni.` };
  if (e.status) return { kind: 'api', error: `Errore del server locale: ${e.message}` };
  return { kind: 'network', error: `Nessun server locale su ${baseUrl(cfg)}. Avvia ${PRESETS[cfg.kind]?.label || 'il server'} e controlla l'indirizzo nelle impostazioni.` };
}

// ---------- traduzione dei messaggi ----------
// Tiene solo gli ultimi messaggi, partendo da un messaggio dell'utente con testo (mai da risultati orfani).
function trimHistory(messages) {
  if (messages.length <= MAX_HISTORY) return messages;
  for (let i = messages.length - MAX_HISTORY; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'user' && Array.isArray(m.content) && m.content.some(b => b.type === 'text')) return messages.slice(i);
  }
  return messages.slice(-1);
}

// Il formato di Claude → messaggi stile chat (comuni a Ollama e OpenAI, con piccole differenze)
// Lo stato della partita arriva con ogni ordine: ai modelli locali si manda solo quello più recente,
// le copie vecchie occuperebbero migliaia di token rallentando ogni risposta.
const STATE_RE = /^<(stato_partita|stato_mondo)>/;
function toChat(system, messages, kind) {
  const out = [{ role: 'system', content: system + LOCAL_HINT }];
  const names = {};
  const hist = trimHistory(messages);
  let lastState = -1;
  hist.forEach((m, i) => { if (m.role === 'user' && Array.isArray(m.content) && m.content.some(b => b.type === 'text' && STATE_RE.test(b.text))) lastState = i; });
  for (const [i, m] of hist.entries()) {
    let blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content;
    if (i !== lastState) blocks = blocks.filter(b => !(b.type === 'text' && STATE_RE.test(b.text)));
    if (m.role === 'assistant') {
      const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n');
      const calls = blocks.filter(b => b.type === 'tool_use').map(b => {
        names[b.id] = b.name;
        return kind === 'ollama'
          ? { function: { name: b.name, arguments: b.input || {} } }
          : { id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } };
      });
      const msg = { role: 'assistant', content: text };
      if (calls.length) msg.tool_calls = calls;
      out.push(msg);
    } else {
      const texts = [];
      for (const b of blocks) {
        if (b.type === 'tool_result') {
          const content = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
          const msg = { role: 'tool', content: b.is_error ? `ERRORE: ${content}` : content };
          if (kind === 'ollama') msg.tool_name = names[b.tool_use_id] || undefined;
          else msg.tool_call_id = b.tool_use_id;
          out.push(msg);
        } else if (b.type === 'text') texts.push(b.text);
      }
      if (texts.length) out.push({ role: 'user', content: texts.join('\n\n') });
    }
  }
  return out;
}

function toFunctions(tools) {
  return tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
}

let idSeq = 0;
const newId = () => `local_${Date.now().toString(36)}_${(idSeq++).toString(36)}`;

function parseArgs(a) {
  if (a == null) return {};
  if (typeof a === 'object') return a;
  try { return JSON.parse(a); } catch { return {}; }
}

// Estrae oggetti JSON bilanciati da un testo (anche dentro ```json ... ```)
function jsonObjects(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try { out.push({ obj: JSON.parse(text.slice(i, j + 1)), start: i, end: j + 1 }); i = j; } catch { /* non è JSON */ }
        break;
      }
    }
  }
  return out;
}

// Azioni scritte nel testo: <tool_call>{...}</tool_call> (stile Qwen) o JSON con name/arguments
function callsFromText(text, toolNames) {
  const calls = [];
  let rest = text;
  const found = jsonObjects(text);
  for (const { obj, start, end } of found.reverse()) {
    const list = Array.isArray(obj.tool_calls) ? obj.tool_calls : [obj];
    const got = [];
    for (const o of list) {
      const f = o.function || o;
      const name = f.name || f.tool || f.action;
      if (typeof name === 'string' && toolNames.has(name)) got.push({ name, input: parseArgs(f.arguments ?? f.parameters ?? f.args ?? f.input) });
    }
    if (got.length) {
      calls.unshift(...got);
      rest = rest.slice(0, start) + rest.slice(end);
    }
  }
  rest = rest.replace(/<\/?tool_call>/g, '').replace(/```(?:json)?\s*```/g, '');
  return { calls, rest };
}

function stripThinking(s) {
  return String(s || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*?<\/think>/, '').trim();
}

// Risposta stile chat → formato di Claude
function fromChat(msg, finish, toolNames) {
  let text = stripThinking(msg.content);
  let calls = (msg.tool_calls || []).map(c => ({ name: c.function?.name, input: parseArgs(c.function?.arguments), id: c.id }))
    .filter(c => toolNames.has(c.name));
  if (!calls.length && text) {
    const r = callsFromText(text, toolNames);
    if (r.calls.length) { calls = r.calls; text = r.rest.trim(); }
  }
  const content = [];
  if (text) content.push({ type: 'text', text });
  for (const c of calls) content.push({ type: 'tool_use', id: c.id || newId(), name: c.name, input: c.input });
  if (!content.length) content.push({ type: 'text', text: '(nessuna risposta dal modello)' });
  const stop = calls.length ? 'tool_use' : finish === 'length' ? 'max_tokens' : 'end_turn';
  return { content, stop_reason: stop };
}

// ---------- chiamate ----------
// Ollama in streaming: si sa subito se il modello sta ancora leggendo il prompt o sta già scrivendo,
// e un modello bloccato si riconosce dal silenzio invece che da un unico timeout lunghissimo.
async function ollamaChat(cfg, body, onProgress, signal) {
  const ctl = new AbortController();
  if (signal) signal.addEventListener('abort', () => ctl.abort(), { once: true });
  let timer = null, why = null;
  const arm = (ms, msg) => { clearTimeout(timer); timer = setTimeout(() => { why = msg; ctl.abort(); }, ms); };
  arm(FIRST_TOKEN_MS, `Il modello locale sta impiegando più di ${FIRST_TOKEN_MS / 60000} minuti a leggere gli ordini. Probabilmente gira senza scheda video: prova un modello più piccolo (es. qwen2.5:3b).`);
  onProgress({ phase: 'prompt' });   // Ollama manda le intestazioni solo col primo pezzo di risposta
  try {
    const res = await fetch(`${baseUrl(cfg)}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, stream: true }), signal: ctl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = text.slice(0, 300);
      try { const j = JSON.parse(text); msg = j.error?.message || j.error || msg; } catch { /* testo semplice */ }
      const e = new Error(`HTTP ${res.status}: ${msg}`); e.status = res.status; throw e;
    }
    const dec = new TextDecoder();
    let buf = '', content = '', calls = [], last = {}, chunks = 0;
    for await (const part of res.body) {
      buf += dec.decode(part, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line) continue;
        const j = JSON.parse(line);
        if (j.error) { const e = new Error(`Errore del modello: ${j.error}`); e.status = 500; throw e; }
        if (j.message) {
          content += j.message.content || '';
          if (j.message.tool_calls) calls.push(...j.message.tool_calls);
        }
        chunks++;
        arm(IDLE_MS, 'Il modello locale si è fermato a metà risposta. Riprova.');
        onProgress({ phase: 'writing', tokens: chunks });
        last = j;
      }
    }
    return { model: last.model, done_reason: last.done_reason, message: { role: 'assistant', content, tool_calls: calls } };
  } catch (e) {
    if (why && !(signal && signal.aborted)) { const t = new Error(why); t.timeout = true; throw t; }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function send(cfg, req, onProgress = () => {}, signal) {
  const kind = cfg.kind === 'openai' ? 'openai' : 'ollama';
  const toolNames = new Set(req.tools.map(t => t.name));
  const messages = toChat(req.system, req.messages, kind);
  const tools = toFunctions(req.tools);
  try {
    if (kind === 'ollama') {
      const r = await ollamaChat(cfg, {
        model: cfg.model, messages, tools, keep_alive: KEEP_ALIVE,
        options: { num_ctx: NUM_CTX, temperature: 0.4 },
      }, onProgress, signal);
      const m = fromChat(r.message || {}, r.done_reason, toolNames);
      return { ok: true, message: { ...m, model: r.model || cfg.model } };
    }
    onProgress({ phase: 'prompt' });
    const r = await http(`${baseUrl(cfg)}/chat/completions`, {
      model: cfg.model, messages, tools, tool_choice: 'auto', temperature: 0.4, max_tokens: 2048, stream: false,
    }, FIRST_TOKEN_MS, signal);
    const ch = (r.choices || [])[0] || {};
    const m = fromChat(ch.message || {}, ch.finish_reason, toolNames);
    return { ok: true, message: { ...m, model: r.model || cfg.model } };
  } catch (e) {
    return { ok: false, ...errorInfo(e, cfg, signal) };
  }
}

// Carica il modello in memoria in anticipo (all'apertura della finestra), così il primo ordine
// non paga anche il caricamento da disco.
async function warmup(cfg) {
  if (cfg.kind === 'openai' || !cfg.model) return { ok: true };
  try {
    await http(`${baseUrl(cfg)}/api/generate`, { model: cfg.model, keep_alive: KEEP_ALIVE, options: { num_ctx: NUM_CTX } }, 120000);
    return { ok: true };
  } catch (e) {
    return { ok: false, ...errorInfo(e, cfg) };
  }
}

// Modelli installati sul server locale (per l'elenco nelle impostazioni)
async function listModels(cfg) {
  try {
    if (cfg.kind === 'openai') {
      const r = await http(`${baseUrl(cfg)}/models`, null, 5000);
      return { ok: true, models: (r.data || []).map(m => m.id) };
    }
    const r = await http(`${baseUrl(cfg)}/api/tags`, null, 5000);
    return { ok: true, models: (r.models || []).map(m => m.name) };
  } catch (e) {
    return { ok: false, ...errorInfo(e, cfg) };
  }
}

module.exports = { PRESETS, send, warmup, listModels, _test: { toChat, fromChat, callsFromText, trimHistory } };
