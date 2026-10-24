'use strict';
// Ponte verso l'API di Claude per il "Governo" (IA testuale). Vive nel processo principale:
// la chiave API non arriva mai alla pagina di gioco.
// Chiave: variabile d'ambiente ANTHROPIC_API_KEY se presente, altrimenti quella inserita nel gioco,
// salvata cifrata con safeStorage (DPAPI su Windows) nella cartella dati dell'app.
const { ipcMain, safeStorage, app } = require('electron');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk').default;

const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (consigliato)', fallback: true },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (più rapido)', fallback: true },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (economico)', fallback: false },
];
const DEFAULT_MODEL = MODELS[0].id;

const settingsFile = () => path.join(app.getPath('userData'), 'governo.json');
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; }
}
function writeSettings(s) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(s));
}

function savedKey() {
  const s = readSettings();
  if (!s.keyEnc || !safeStorage.isEncryptionAvailable()) return null;
  try { return safeStorage.decryptString(Buffer.from(s.keyEnc, 'base64')); } catch { return null; }
}
function currentKey() {
  const env = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (env) return { key: env, source: 'env' };
  const k = savedKey();
  return k ? { key: k, source: 'saved' } : { key: null, source: null };
}
function currentModel() {
  const m = readSettings().model;
  return MODELS.some(x => x.id === m) ? m : DEFAULT_MODEL;
}

let client = null, clientKey = null;
function getClient(key) {
  if (!client || clientKey !== key) { client = new Anthropic({ apiKey: key, maxRetries: 2, timeout: 120000 }); clientKey = key; }
  return client;
}

function status() {
  const { source } = currentKey();
  return { hasKey: !!source, source, model: currentModel(), models: MODELS.map(({ id, label }) => ({ id, label })), canSave: safeStorage.isEncryptionAvailable() };
}

function errorInfo(e) {
  if (e instanceof Anthropic.AuthenticationError) return { kind: 'auth', error: 'Chiave API non valida o revocata.' };
  if (e instanceof Anthropic.PermissionDeniedError) return { kind: 'auth', error: 'La chiave non ha accesso a questo modello.' };
  if (e instanceof Anthropic.RateLimitError) return { kind: 'rate', error: 'Troppe richieste o credito esaurito: riprova tra poco.' };
  if (e instanceof Anthropic.BadRequestError) return { kind: 'request', error: `Richiesta rifiutata dall'API: ${e.message}` };
  if (e instanceof Anthropic.APIConnectionError) return { kind: 'network', error: 'Nessuna connessione con l\'API di Claude.' };
  if (e instanceof Anthropic.APIError) return { kind: 'api', error: `Errore dell'API (${e.status ?? '?'}): ${e.message}` };
  return { kind: 'internal', error: String(e && e.message || e) };
}

// Una singola chiamata all'API. Il ciclo degli strumenti gira nella pagina di gioco,
// perché è lì che vivono lo stato della partita e le azioni.
async function send(_e, req) {
  const { key } = currentKey();
  if (!key) return { ok: false, kind: 'nokey', error: 'Manca la chiave API.' };
  const model = currentModel();
  const info = MODELS.find(m => m.id === model);
  if (!req || typeof req.system !== 'string' || !Array.isArray(req.messages) || !Array.isArray(req.tools)) {
    return { ok: false, kind: 'internal', error: 'Richiesta non valida.' };
  }
  const betas = ['thinking-binding-controls-2026-08-01'];
  const params = {
    model,
    max_tokens: 16000,
    // system e strumenti restano identici per tutta la conversazione: vengono letti dalla cache
    system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
    tools: req.tools,
    messages: req.messages,
    cache_control: { type: 'ephemeral' },
    thinking: { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
    output_config: { effort: 'low' },
  };
  if (info.fallback) { betas.push('server-side-fallback-2026-07-01'); params.fallbacks = 'default'; }
  params.betas = betas;
  try {
    const msg = await getClient(key).beta.messages.create(params);
    return { ok: true, message: { content: msg.content, stop_reason: msg.stop_reason, model: msg.model, usage: msg.usage } };
  } catch (e) {
    return { ok: false, ...errorInfo(e) };
  }
}

function register() {
  ipcMain.handle('governo:status', () => status());
  ipcMain.handle('governo:setKey', (_e, key) => {
    key = String(key || '').trim();
    if (!/^sk-ant-[\w-]{20,}$/.test(key)) return { ok: false, error: 'La chiave deve iniziare con sk-ant-' };
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: 'Cifratura non disponibile su questo sistema: usa la variabile ANTHROPIC_API_KEY.' };
    const s = readSettings();
    s.keyEnc = safeStorage.encryptString(key).toString('base64');
    writeSettings(s);
    return { ok: true, status: status() };
  });
  ipcMain.handle('governo:clearKey', () => {
    const s = readSettings();
    delete s.keyEnc;
    writeSettings(s);
    return { ok: true, status: status() };
  });
  ipcMain.handle('governo:setModel', (_e, model) => {
    if (!MODELS.some(m => m.id === model)) return { ok: false, error: 'Modello sconosciuto' };
    const s = readSettings();
    s.model = model;
    writeSettings(s);
    return { ok: true, status: status() };
  });
  ipcMain.handle('governo:send', send);
}

module.exports = { register };
