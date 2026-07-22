'use strict';
/**
 * Cliente multi-proveedor del agente-arnés. Una sola función chat() que enruta
 * por proveedor. xAI/OpenAI/DeepSeek/Google exponen la API compatible con
 * OpenAI (mismo shape); Anthropic usa su SDK. Añadir un proveedor = una entrada
 * en ENDPOINTS + su env key. Node 18+ (fetch global).
 */

const { MODELOS } = require('./config');

// Proveedores compatibles con OpenAI: {base, envKey}.
const ENDPOINTS = {
  xai:      { base: 'https://api.x.ai/v1',                                   env: 'XAI_API_KEY' },
  openai:   { base: 'https://api.openai.com/v1',                             env: 'OPENAI_API_KEY' },
  deepseek: { base: 'https://api.deepseek.com/v1',                           env: 'DEEPSEEK_API_KEY' },
  google:   { base: 'https://generativelanguage.googleapis.com/v1beta/openai', env: 'GOOGLE_API_KEY' }
};

function keyDe(proveedor) {
  if (proveedor === 'anthropic') return process.env.ANTHROPIC_API_KEY;
  const e = ENDPOINTS[proveedor];
  return e ? process.env[e.env] : null;
}

// ¿Está configurado el modelo (su proveedor tiene key)?
function disponible(modeloKey) {
  const m = MODELOS[modeloKey];
  return Boolean(m && keyDe(m.proveedor));
}

async function chatOpenAICompat(proveedor, modelo, system, user, json, maxTokens) {
  const { base } = ENDPOINTS[proveedor];
  const body = {
    model: modelo,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: maxTokens || 4000,
    ...(json ? { response_format: { type: 'json_object' } } : {})
  };
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keyDe(proveedor)}` },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`${proveedor} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return data.choices && data.choices[0] && data.choices[0].message.content;
}

let _anthropic = null;
async function chatAnthropic(modelo, system, user, maxTokens) {
  if (!_anthropic) { const A = require('@anthropic-ai/sdk'); _anthropic = new A(); }
  const resp = await _anthropic.messages.create({
    model: modelo, max_tokens: maxTokens || 4000, system,
    messages: [{ role: 'user', content: user }]
  });
  const b = (resp.content || []).find((x) => x.type === 'text');
  return b ? b.text : '';
}

/**
 * Llama al modelo referenciado por su clave de config.
 * @param {string} modeloKey  clave en MODELOS (ej. 'grok_45')
 * @param {{system:string, user:string, json?:boolean}} args
 * @returns {Promise<string>} texto (o JSON string si json=true)
 */
async function chat(modeloKey, { system, user, json, maxTokens }) {
  const m = MODELOS[modeloKey];
  if (!m) throw new Error(`Modelo desconocido: ${modeloKey}`);
  if (!keyDe(m.proveedor)) throw new Error(`Falta API key de ${m.proveedor} (${modeloKey}).`);
  if (m.proveedor === 'anthropic') return chatAnthropic(m.modelo, system, user, maxTokens);
  return chatOpenAICompat(m.proveedor, m.modelo, system, user, json, maxTokens);
}

// Extrae el primer objeto JSON de un texto (tolera envoltura).
function parseJson(txt) {
  const raw = String(txt || '').trim();
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  return JSON.parse(s >= 0 && e > s ? raw.slice(s, e + 1) : raw);
}

module.exports = { chat, disponible, parseJson, keyDe };
