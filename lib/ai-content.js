'use strict';
/**
 * Autogeneración de contenido con Claude (Hito 6).
 * Usa Claude Haiku 4.5 (mejor costo-beneficio) para generar el contenido
 * estructurado de una sesión: descripción, resumen, puntos clave, notas y
 * preguntas para pasar de clase. El instructor revisa y edita antes de publicar.
 *
 * Requiere ANTHROPIC_API_KEY. Si falta, isEnabled()=false y el endpoint responde 503.
 */

let _client = null;
function client() {
  if (_client) return _client;
  const Anthropic = require('@anthropic-ai/sdk');
  _client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno
  return _client;
}

function isEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = 'claude-haiku-4-5';

// Forma JSON esperada (se pide en el prompt; se valida al parsear). Se usa este
// enfoque en vez de structured outputs para compatibilidad con el SDK instalado.
const JSON_SHAPE =
  '{\n' +
  '  "titulo": "string",\n' +
  '  "descripcion": "string (2-3 frases)",\n' +
  '  "resumen": "string (un párrafo)",\n' +
  '  "puntos_clave": ["string", "..."],\n' +
  '  "notas": "string",\n' +
  '  "preguntas_pase": [{ "q": "string", "opciones": ["a","b","c"], "correcta": 0 }]\n' +
  '}';

const PLAN_TONO = {
  explorador: 'nivel introductorio, lenguaje sencillo, para quien apenas conoce IA',
  esencial: 'nivel práctico e intermedio, orientado a aplicar IA en el trabajo diario',
  'ai-native-pro': 'nivel avanzado, con automatizaciones, flujos y criterio técnico',
  pro: 'nivel avanzado, con automatizaciones, flujos y criterio técnico'
};

/**
 * Genera el contenido estructurado de una lección.
 * @param {{tema:string, plan?:string, curso?:string, contexto?:string}} params
 * @returns {Promise<object>} draft de lección (mismo shape que structured_content + titulo)
 */
async function generarLeccion({ tema, plan, curso, contexto }) {
  if (!tema) throw new Error('Falta el tema.');
  const tono = PLAN_TONO[plan] || PLAN_TONO.esencial;
  const system =
    'Eres un diseñador instruccional de aiLearning, una academia de IA aplicada en español (México). ' +
    'Creas contenido claro, accionable y con ejemplos concretos de negocio. Escribe SIEMPRE en español. ' +
    'Respondes ÚNICAMENTE con JSON válido, sin texto antes ni después, sin bloques de código markdown.';
  const user =
    `Diseña una lección para la Academia aiLearning y devuélvela como JSON con exactamente esta forma:\n` +
    JSON_SHAPE + '\n\n' +
    `Tema: ${tema}\n` +
    (curso ? `Curso: ${curso}\n` : '') +
    `Público objetivo: ${tono}.\n` +
    (contexto ? `Contexto adicional: ${contexto}\n` : '') +
    `Requisitos: título atractivo; descripción de 2-3 frases; resumen de un párrafo; 3 a 5 puntos ` +
    `importantes; notas útiles para el alumno; 2 a 3 preguntas para pasar de clase (opción múltiple, ` +
    `3 opciones cada una; "correcta" es el índice 0-based de la opción correcta). Todo en español, ` +
    `práctico y específico. Responde SOLO el JSON.`;

  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: user }]
  });

  const textBlock = (resp.content || []).find((b) => b.type === 'text');
  if (!textBlock) throw new Error('La IA no devolvió contenido.');
  // Extrae el primer objeto JSON del texto (tolera envoltura accidental).
  const raw = textBlock.text.trim();
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  let data;
  try { data = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw); }
  catch (e) { throw new Error('Respuesta de IA no parseable.'); }
  return {
    titulo: data.titulo,
    structured: {
      descripcion: data.descripcion,
      resumen: data.resumen,
      puntos_clave: data.puntos_clave || [],
      notas: data.notas,
      preguntas_pase: data.preguntas_pase || []
    }
  };
}

module.exports = { isEnabled, generarLeccion };
