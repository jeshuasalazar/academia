'use strict';
/**
 * Generación de ilustraciones pluggable para la etapa de video. Una función
 * generarImagen() que enruta por proveedor. Solo usa process.env para las keys.
 * Devuelve un Buffer PNG/JPEG que slides.js compone COMO FONDO (el texto legible
 * lo dibuja el canvas encima; los modelos de imagen escriben texto mal).
 *
 * Precio (ref jul-2026, por imagen 16:9): FLUX.1 schnell en Together/fal ≈ $0.003,
 * DeepInfra ≈ $0.001, xAI grok-2-image ≈ $0.07, OpenAI gpt-image-1 ≈ $0.04.
 * Recomendado para "mejor precio": together o fal (FLUX schnell).
 *
 * Añadir proveedor = un case más. NUNCA hardcodear keys.
 */

const ENV_KEY = {
  together:  'TOGETHER_API_KEY',
  fal:       'FAL_KEY',
  deepinfra: 'DEEPINFRA_API_KEY',
  kie:       'KIE_API_KEY',
  xai:       'XAI_API_KEY',
  openai:    'OPENAI_API_KEY',
  google:    'GOOGLE_API_KEY'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Sufijo de estilo fijo → coherencia de marca entre escenas. "no text" es clave:
// el modelo no debe intentar escribir (lo hace mal); el texto lo pone el canvas.
const ESTILO =
  'flat vector editorial illustration, minimal, clean geometric shapes, ' +
  'deep navy background (#0A1522), blue (#2D88E8) and coral (#FF6B47) accents, ' +
  'soft glow, generous negative space, no text, no words, no letters, 16:9';

function disponibleImagen(proveedor) {
  const env = ENV_KEY[proveedor];
  return Boolean(env && process.env[env]);
}

// Descarga una URL de imagen a Buffer (algunos proveedores devuelven url, no b64).
async function urlABuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`img-fetch ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function prompt(base) {
  return `${String(base || '').trim()}. ${ESTILO}`;
}

// ---- Together AI — FLUX.1 schnell (recomendado por precio) ------------------
async function genTogether(base) {
  const r = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.TOGETHER_API_KEY}` },
    body: JSON.stringify({
      model: process.env.AGENTE_IMG_MODELO || 'black-forest-labs/FLUX.1-schnell',
      prompt: prompt(base), width: 1344, height: 768, n: 1, steps: 4, response_format: 'b64_json'
    })
  });
  if (!r.ok) throw new Error(`together-img ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const item = (d.data && d.data[0]) || {};
  if (item.b64_json) return { buffer: Buffer.from(item.b64_json, 'base64'), mime: 'image/png' };
  if (item.url) return { buffer: await urlABuffer(item.url), mime: 'image/png' };
  throw new Error('together-img sin imagen');
}

// ---- fal.ai — FLUX.1 schnell -----------------------------------------------
async function genFal(base) {
  const r = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${process.env.FAL_KEY}` },
    body: JSON.stringify({ prompt: prompt(base), image_size: 'landscape_16_9', num_images: 1, num_inference_steps: 4 })
  });
  if (!r.ok) throw new Error(`fal-img ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const img = (d.images && d.images[0]) || {};
  if (img.url) return { buffer: await urlABuffer(img.url), mime: img.content_type || 'image/png' };
  throw new Error('fal-img sin imagen');
}

// ---- DeepInfra — FLUX.1 schnell (OpenAI-compat), el más barato -------------
async function genDeepInfra(base) {
  const r = await fetch('https://api.deepinfra.com/v1/openai/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}` },
    body: JSON.stringify({
      model: process.env.AGENTE_IMG_MODELO || 'black-forest-labs/FLUX-1-schnell',
      prompt: prompt(base), size: '1344x768', n: 1
    })
  });
  if (!r.ok) throw new Error(`deepinfra-img ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const item = (d.data && d.data[0]) || {};
  if (item.b64_json) return { buffer: Buffer.from(item.b64_json, 'base64'), mime: 'image/png' };
  if (item.url) return { buffer: await urlABuffer(item.url), mime: 'image/png' };
  throw new Error('deepinfra-img sin imagen');
}

// ---- KIE.ai — gateway (FLUX Kontext y otros), ASÍNCRONO: submit + poll ------
// POST genera y devuelve taskId; se pollea record-info hasta successFlag=1.
// Headless-friendly (Bearer key) → sí corre en el worker de Railway.
async function genKie(base) {
  const key = process.env.KIE_API_KEY;
  const submit = await fetch('https://api.kie.ai/api/v1/flux/kontext/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      prompt: prompt(base), aspectRatio: '16:9',
      model: process.env.AGENTE_IMG_MODELO || 'flux-kontext-pro', outputFormat: 'png'
    })
  });
  if (!submit.ok) throw new Error(`kie-img ${submit.status}: ${(await submit.text()).slice(0, 200)}`);
  const sj = await submit.json();
  const taskId = sj.data && sj.data.taskId;
  if (!taskId) throw new Error(`kie-img sin taskId: ${JSON.stringify(sj).slice(0, 200)}`);

  const t0 = Date.now();
  while (Date.now() - t0 < 120000) { // hasta 2 min
    await sleep(3000);
    const q = await fetch(`https://api.kie.ai/api/v1/flux/kontext/record-info?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${key}` }
    });
    if (!q.ok) continue;
    const d = (await q.json()).data || {};
    if (d.successFlag === 1) {
      const url = d.response && d.response.resultImageUrl;
      if (!url) throw new Error('kie-img éxito sin url');
      return { buffer: await urlABuffer(url), mime: 'image/png' };
    }
    if (d.successFlag === 2 || d.successFlag === 3) throw new Error(`kie-img fallo: ${d.errorMessage || d.successFlag}`);
  }
  throw new Error('kie-img timeout (2 min)');
}

// ---- xAI — grok-2-image (reusa XAI_API_KEY; más caro) ----------------------
async function genXai(base) {
  const r = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.XAI_API_KEY}` },
    body: JSON.stringify({ model: 'grok-2-image-1212', prompt: prompt(base), n: 1, response_format: 'b64_json' })
  });
  if (!r.ok) throw new Error(`xai-img ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const item = (d.data && d.data[0]) || {};
  if (item.b64_json) return { buffer: Buffer.from(item.b64_json, 'base64'), mime: 'image/png' };
  if (item.url) return { buffer: await urlABuffer(item.url), mime: 'image/png' };
  throw new Error('xai-img sin imagen');
}

// ---- OpenAI — gpt-image-1 --------------------------------------------------
async function genOpenAI(base) {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt: prompt(base), size: '1536x1024', n: 1 })
  });
  if (!r.ok) throw new Error(`openai-img ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const item = (d.data && d.data[0]) || {};
  if (item.b64_json) return { buffer: Buffer.from(item.b64_json, 'base64'), mime: 'image/png' };
  if (item.url) return { buffer: await urlABuffer(item.url), mime: 'image/png' };
  throw new Error('openai-img sin imagen');
}

// ---- Google — Imagen (requiere Gemini API habilitada + key sin restricción) -
async function genGoogle(base) {
  const modelo = process.env.AGENTE_IMG_MODELO || 'imagen-4.0-fast-generate-001';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:predict?key=${process.env.GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [{ prompt: prompt(base) }], parameters: { sampleCount: 1, aspectRatio: '16:9' } })
  });
  if (!r.ok) throw new Error(`google-img ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const p = (d.predictions && d.predictions[0]) || {};
  if (p.bytesBase64Encoded) return { buffer: Buffer.from(p.bytesBase64Encoded, 'base64'), mime: p.mimeType || 'image/png' };
  throw new Error('google-img sin imagen');
}

const ROUTERS = {
  together: genTogether, fal: genFal, deepinfra: genDeepInfra, kie: genKie,
  xai: genXai, openai: genOpenAI, google: genGoogle
};

/**
 * Genera una ilustración para una escena. Devuelve Buffer o lanza (el caller la
 * trata como NO-FATAL: si falla, slides.js cae al fondo degradado de marca).
 * @param {string} descripcion metáfora visual concreta (inglés recomendado)
 * @param {{proveedor?:string}} opts
 * @returns {Promise<{buffer:Buffer, mime:string}>}
 */
async function generarImagen(descripcion, opts) {
  const prov = (opts && opts.proveedor) || process.env.AGENTE_IMG || 'together';
  if (!disponibleImagen(prov)) throw new Error(`Falta API key de imagen para '${prov}' (${ENV_KEY[prov] || 'proveedor desconocido'}).`);
  const fn = ROUTERS[prov];
  if (!fn) throw new Error(`Proveedor de imagen desconocido: ${prov}`);
  return fn(descripcion);
}

module.exports = { generarImagen, disponibleImagen, ESTILO };
