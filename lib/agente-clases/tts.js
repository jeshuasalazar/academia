'use strict';
/**
 * TTS pluggable para la etapa de video. Una función sintetizar() que enruta
 * por proveedor ('openai' | 'google' | 'elevenlabs'). Solo usa process.env
 * para las keys — nunca hardcodeadas. Añadir proveedor = un case más.
 */

const ENV_KEY = {
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY'
};

// ¿Hay key configurada para este proveedor de TTS?
function disponibleTTS(proveedor) {
  const env = ENV_KEY[proveedor];
  return Boolean(env && process.env[env]);
}

async function synOpenAI(texto, voz) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: voz || 'alloy',
      input: texto,
      response_format: 'mp3'
    })
  });
  if (!r.ok) throw new Error(`openai-tts ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { buffer: Buffer.from(await r.arrayBuffer()), mime: 'audio/mpeg' };
}

async function synGoogle(texto, voz) {
  const languageCode = (voz || 'es-US-Neural2-B').split('-').slice(0, 2).join('-');
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: texto },
      voice: { languageCode, name: voz || 'es-US-Neural2-B' },
      audioConfig: { audioEncoding: 'MP3' }
    })
  });
  if (!r.ok) throw new Error(`google-tts ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return { buffer: Buffer.from(data.audioContent, 'base64'), mime: 'audio/mpeg' };
}

async function synElevenLabs(texto, voz) {
  const voiceId = voz || '21m00Tcm4TlvDq8ikWAM'; // "Rachel" por defecto
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({ text: texto, model_id: 'eleven_multilingual_v2' })
  });
  if (!r.ok) throw new Error(`elevenlabs-tts ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { buffer: Buffer.from(await r.arrayBuffer()), mime: 'audio/mpeg' };
}

/**
 * Sintetiza texto a audio con el proveedor pedido.
 * @param {string} texto
 * @param {{proveedor?:string, voz?:string}} opts
 * @returns {Promise<{buffer:Buffer, mime:string}>}
 */
async function sintetizar(texto, opts) {
  const { proveedor, voz } = opts || {};
  const prov = proveedor || 'google';
  if (!disponibleTTS(prov)) throw new Error(`Falta API key de TTS para '${prov}' (${ENV_KEY[prov] || 'proveedor desconocido'}).`);
  if (prov === 'openai') return synOpenAI(texto, voz);
  if (prov === 'google') return synGoogle(texto, voz);
  if (prov === 'elevenlabs') return synElevenLabs(texto, voz);
  throw new Error(`Proveedor de TTS desconocido: ${prov}`);
}

module.exports = { sintetizar, disponibleTTS };
