'use strict';
/**
 * AGENTE-ARNÉS que construye clases. Punto de entrada único: construirClase().
 * Orquesta 6 etapas leyendo config.js; cada etapa elige su modelo por nivel.
 * Se quita borrando esta carpeta + la llamada; se ajusta editando config.js.
 *
 * Pipeline:
 *   1 recuperar   (RAG: material aprobado como grounding → anti-alucinación)
 *   2 planificar  (conceptos, prerrequisitos, outline, riesgos)
 *   3 generar     (lección en 3 capas: niño→profesional→experto)
 *   4 auditar-rápido (estructura, JSON, completitud, tono, longitud)
 *   5 auditar-fuerte (scorecard 7-dim, SOLO si dispara umbral)
 *   6 producir-video (OPCIONAL, no-fatal: MP4 explainer → Bunny Stream)
 *
 * Devuelve { leccion (shape del template), scorecard, aprobado, revisionHumana, meta }.
 * No guarda: el endpoint que lo llame decide persistir el borrador tras revisión.
 */

const { NIVELES, DIMENSIONES, UMBRALES, VIDEO, MAX_REESCRITURAS } = require('./config');
const prov = require('./proveedores');
// './video' (y su dep nativa @napi-rs/canvas + ffmpeg) se carga LAZY dentro de la
// etapa 6, para que el arranque del server nunca dependa de canvas/ffmpeg.

function isEnabled() {
  // El agente está disponible si el generador del nivel estándar tiene proveedor.
  return prov.disponible(NIVELES.estandar.generar);
}

const SYS_BASE =
  'Eres el motor pedagógico de aiLearning (academia de IA aplicada, español de México). ' +
  'Rigor de nivel doctoral con la sencillez de explicárselo a un niño de 5-10 años. ' +
  'Te apegas ESTRICTAMENTE al material aprobado que se te da como fuente; si algo no está ' +
  'en las fuentes, no lo inventas. Respondes SOLO con JSON válido, sin markdown ni texto extra.';

// ---- Etapa 1: recuperar (RAG) --------------------------------------------
// Hoy acepta las fuentes que se le pasen (material aprobado). Hook para RAG real
// (embeddings + tabla de fuentes) más adelante, sin cambiar la interfaz.
async function recuperar(input) {
  const fuentes = (input.fuentes || '').trim();
  return fuentes || '(sin material de referencia — genera con conocimiento general y baja el score de fidelidad)';
}

// ---- Etapa 2: planificar --------------------------------------------------
async function planificar(nivel, input, fuentes) {
  const user =
    `Tema: ${input.tema}\n` + (input.curso ? `Curso: ${input.curso}\n` : '') +
    `Fuentes aprobadas:\n"""${fuentes.slice(0, 6000)}"""\n\n` +
    `Extrae el plan de la lección como JSON: ` +
    `{ "conceptos": [".."], "prerrequisitos": [".."], "outline": [".."], "riesgos": [".."] }. ` +
    `"riesgos" = puntos donde es fácil alucinar o confundir. Todo en español.`;
  return prov.parseJson(await prov.chat(NIVELES[nivel].planificar, { system: SYS_BASE, user, json: true }));
}

// ---- Etapa 3: generar / CONSTRUCTOR (3 capas, template exacto) ------------
// `correcciones` (opcional): notas del revisor/evaluador para una reescritura.
async function generar(nivel, input, plan, fuentes, perfil, correcciones) {
  const voz = (perfil && perfil.voz) || 'clara, cálida, directa, con ejemplos de negocio concretos';
  const user =
    `Diseña la lección "${input.tema}"${input.curso ? ' del curso ' + input.curso : ''}.\n` +
    `Voz/estilo: ${voz}.\n` +
    (perfil && perfil.ejemplos_buenos ? `Imita el estándar de estos ejemplos buenos:\n${perfil.ejemplos_buenos}\n` : '') +
    `Plan: ${JSON.stringify(plan)}\n` +
    `Fuentes aprobadas (apégate a ellas; NO inventes datos fuera de ellas):\n"""${fuentes.slice(0, 8000)}"""\n\n` +
    (correcciones ? `REESCRITURA — el revisor pidió corregir esto, atiéndelo sin perder lo bueno:\n${correcciones}\n\n` : '') +
    `Estándar: rigor doctoral con la sencillez de explicárselo a un niño de 5-10 años. ` +
    `Cada sección mapea 1:1 al template didáctico:\n` +
    `- promesa = "Lo que vas a poder hacer" (resultado concreto, 1 frase).\n` +
    `- idea_simple = "La idea en simple" (analogía para un niño de 5 años).\n` +
    `- explicacion_seria = "La explicación seria" (desarrollo profesional claro).\n` +
    `- precision_experta = "La precisión experta" (matices, límites, excepciones, fundamentos).\n` +
    `- ejemplo_guiado, error_comun, pregunta_pensar, mini_ejercicio = "Practiquemos".\n` +
    `- comprobacion = "Comprobación" (2-3 preguntas de opción múltiple para pasar de clase).\n` +
    `- resumen = "Resumen" (simple y memorable).\n\n` +
    `Devuelve JSON EXACTO con esta forma (todos los campos con texto real, ninguno vacío):\n` +
    `{ "titulo": "..", "promesa": "..", "idea_simple": "..", "explicacion_seria": "..", ` +
    `"precision_experta": "..", "ejemplo_guiado": "..", "error_comun": "..", "pregunta_pensar": "..", ` +
    `"mini_ejercicio": "..", "comprobacion": [ { "q": "..", "opciones": ["a","b","c"], "correcta": 0 } ], "resumen": ".." }. ` +
    `"correcta" es el índice 0-based. Todo en español.`;
  return prov.parseJson(await prov.chat(NIVELES[nivel].generar, { system: SYS_BASE, user, json: true, maxTokens: 8000 }));
}

// ---- Etapa 4: auditar rápido (mecánico) -----------------------------------
async function auditarRapido(nivel, leccion) {
  const requeridos = ['titulo', 'promesa', 'idea_simple', 'explicacion_seria', 'precision_experta',
    'ejemplo_guiado', 'error_comun', 'pregunta_pensar', 'mini_ejercicio', 'comprobacion', 'resumen'];
  const faltantes = requeridos.filter((k) => !leccion[k] || (Array.isArray(leccion[k]) && !leccion[k].length));
  // Chequeo local (barato de verdad: sin llamar modelo si ya falta estructura).
  return { faltantes, estructura_ok: faltantes.length === 0 };
}

// ---- Etapa 5: auditar fuerte (scorecard 7-dim) ----------------------------
async function auditarFuerte(nivel, leccion, fuentes) {
  const modelo = NIVELES[nivel].auditarFuerte;
  const dims = DIMENSIONES.map((d) => `"${d.id}": 1-10  // ${d.label}`).join(', ');
  const user =
    `Audita esta lección contra sus fuentes y puntúa cada dimensión 1-10.\n` +
    `OJO: en "riesgo" 1=sin alucinación, 10=mucha. En el resto 10=mejor.\n` +
    `Fuentes:\n"""${fuentes.slice(0, 6000)}"""\n\nLección:\n${JSON.stringify(leccion).slice(0, 8000)}\n\n` +
    `Devuelve JSON: { ${dims}, "notas": "qué corregir en 1-2 frases" }.`;
  const sc = prov.parseJson(await prov.chat(modelo, {
    system: 'Eres un auditor pedagógico crítico e independiente. Detectas afirmaciones no sustentadas por las fuentes. Respondes SOLO JSON.',
    user, json: true
  }));
  return sc;
}

// ---- Orquestador ----------------------------------------------------------
async function construirClase(input, opts) {
  opts = opts || {};
  const nivel = NIVELES[opts.nivel] ? opts.nivel : 'estandar';
  const ctx = { temaSensible: Boolean(opts.temaSensible), flagship: Boolean(opts.flagship) };
  const meta = { nivel, etapas: [] };

  meta.agentes = [];

  // 1) INVESTIGADOR — recupera fuentes (RAG/grounding) y arma el plan con riesgos.
  const fuentes = await recuperar(input); meta.etapas.push('recuperar');
  const plan = await planificar(nivel, input, fuentes); meta.etapas.push('planificar');
  meta.agentes.push('investigador');

  const puedeFuerte = NIVELES[nivel].auditarFuerte && prov.disponible(NIVELES[nivel].auditarFuerte);

  // 2-4) CONSTRUCTOR → REVISOR → EVALUADOR, con hasta MAX_REESCRITURAS vueltas.
  // Si el revisor (estructura) o el evaluador (scorecard) rechaza, devuelve la
  // lección al constructor con notas concretas y se reescribe UNA vez. Sube la
  // calidad sin intervención humana, con modelos inferiores.
  let leccion = null, rapido = null, scorecard = null, correcciones = null, intentos = 0;
  while (true) {
    leccion = await generar(nivel, input, plan, fuentes, opts.perfil, correcciones);
    meta.etapas.push(intentos ? 'reescribir' : 'generar');
    if (intentos === 0) meta.agentes.push('constructor');

    // REVISOR (mecánico): estructura/JSON/completitud.
    rapido = await auditarRapido(nivel, leccion); meta.etapas.push('auditar-rapido');
    if (intentos === 0) meta.agentes.push('revisor');

    // EVALUADOR (scorecard 7-dim): solo si aplica por umbral/flag/estructura rota.
    const debeFuerte = puedeFuerte && (nivel === 'excelencia' || ctx.temaSensible || ctx.flagship || !rapido.estructura_ok);
    scorecard = debeFuerte ? await auditarFuerte(nivel, leccion, fuentes) : null;
    if (debeFuerte) {
      meta.etapas.push('auditar-fuerte');
      if (meta.agentes.indexOf('evaluador') === -1) meta.agentes.push('evaluador');
    }

    const scoreOk = scorecard ? UMBRALES.aprobado(scorecard) : true;
    if ((rapido.estructura_ok && scoreOk) || intentos >= MAX_REESCRITURAS) break;

    correcciones = [
      rapido.faltantes && rapido.faltantes.length ? 'Campos faltantes o vacíos: ' + rapido.faltantes.join(', ') + '.' : '',
      scorecard && scorecard.notas ? 'Notas del evaluador: ' + scorecard.notas : ''
    ].filter(Boolean).join(' ');
    intentos += 1;
  }
  meta.faltantes = rapido.faltantes;
  meta.reescrituras = intentos;

  const aprobado = rapido.estructura_ok && (scorecard ? UMBRALES.aprobado(scorecard) : true);
  const revisionHumana = !aprobado;

  // Etapa 6 (opcional, NO-FATAL): produce el video explainer y lo sube a Bunny.
  // Un fallo aquí nunca tumba la lección de texto ya aprobada.
  if (aprobado && VIDEO.habilitado && input.origen !== 'humano') {
    try {
      const video = require('./video'); // lazy: solo aquí se toca canvas/ffmpeg
      const v = await video.produccionCompleta(leccion, { nivel, humano: input.origen === 'humano' });
      if (v.video) leccion.video = v.video;
      if (v.guion) leccion.guion = v.guion;
      meta.etapas.push('producir-video');
    } catch (e) {
      meta.videoError = String(e.message || e);
    }
  }

  return { leccion, scorecard, plan, aprobado, revisionHumana, meta };
}

module.exports = { isEnabled, construirClase, DIMENSIONES };
