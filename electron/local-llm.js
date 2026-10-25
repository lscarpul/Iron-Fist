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
const NUM_CTX = 24576;    // contesto richiesto a Ollama (il suo predefinito tronca il prompt)
const TIMEOUT_MS = 240000;

const LOCAL_HINT = `

Nota sul formato: per compiere un'azione chiama la funzione corrispondente (tool) con gli argomenti richiesti; puoi chiamarne più di una. Usa solo le funzioni elencate. Dopo aver ricevuto i risultati, rispondi al leader in italiano.`;

function baseUrl(cfg) { return String(cfg.url || PRESETS[cfg.kind]?.url || '').replace(/\/+$/, ''); }

async function http(url, body, ms = TIMEOUT_MS) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
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

function errorInfo(e, cfg) {
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
function toChat(system, messages, kind) {
  const out = [{ role: 'system', content: system + LOCAL_HINT }];
  const names = {};
  for (const m of trimHistory(messages)) {
    const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content;
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
async function send(cfg, req) {
  const kind = cfg.kind === 'openai' ? 'openai' : 'ollama';
  const toolNames = new Set(req.tools.map(t => t.name));
  const messages = toChat(req.system, req.messages, kind);
  const tools = toFunctions(req.tools);
  try {
    if (kind === 'ollama') {
      const r = await http(`${baseUrl(cfg)}/api/chat`, {
        model: cfg.model, messages, tools, stream: false,
        options: { num_ctx: NUM_CTX, temperature: 0.4 },
      });
      const m = fromChat(r.message || {}, r.done_reason, toolNames);
      return { ok: true, message: { ...m, model: r.model || cfg.model } };
    }
    const r = await http(`${baseUrl(cfg)}/chat/completions`, {
      model: cfg.model, messages, tools, tool_choice: 'auto', temperature: 0.4, max_tokens: 2048, stream: false,
    });
    const ch = (r.choices || [])[0] || {};
    const m = fromChat(ch.message || {}, ch.finish_reason, toolNames);
    return { ok: true, message: { ...m, model: r.model || cfg.model } };
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

module.exports = { PRESETS, send, listModels, _test: { toChat, fromChat, callsFromText, trimHistory } };
