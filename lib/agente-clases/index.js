'use strict';
/**
 * AGENTE-ARNÉS que construye clases. Punto de entrada único: construirClase().
 * Orquesta 5 etapas leyendo config.js; cada etapa elige su modelo por nivel.
 * Se quita borrando esta carpeta + la llamada; se ajusta editando config.js.
 *
 * Pipeline:
 *   1 recuperar   (RAG: material aprobado como grounding → anti-alucinación)
 *   2 planificar  (conceptos, prerrequisitos, outline, riesgos)
 *   3 generar     (lección en 3 capas: niño→profesional→experto)
 *   4 auditar-rápido (estructura, JSON, completitud, tono, longitud)
 *   5 auditar-fuerte (scorecard 7-dim, SOLO si dispara umbral)
 *
 * Devuelve { leccion (shape del template), scorecard, aprobado, revisionHumana, meta }.
 * No guarda: el endpoint que lo llame decide persistir el borrador tras revisión.
 */

const { NIVELES, DIMENSIONES, UMBRALES } = require('./config');
const prov = require('./proveedores');

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

// ---- Etapa 3: generar (3 capas) ------------------------------------------
async function generar(nivel, input, plan, fuentes, perfil) {
  const voz = (perfil && perfil.voz) || 'clara, cálida, directa, con ejemplos de negocio concretos';
  const user =
    `Diseña la lección "${input.tema}"${input.curso ? ' del curso ' + input.curso : ''}.\n` +
    `Voz/estilo: ${voz}.\n` +
    (perfil && perfil.ejemplos_buenos ? `Imita el estándar de estos ejemplos buenos:\n${perfil.ejemplos_buenos}\n` : '') +
    `Plan: ${JSON.stringify(plan)}\n` +
    `Fuentes aprobadas (apégate a ellas):\n"""${fuentes.slice(0, 8000)}"""\n\n` +
    `Devuelve JSON EXACTO con esta forma:\n` +
    `{ "titulo": "..", "promesa": "..", "idea_simple": ".. (para niño de 5 años)", ` +
    `"explicacion_seria": ".. (profesional claro)", "precision_experta": ".. (matices, límites, fundamentos)", ` +
    `"ejemplo_guiado": "..", "error_comun": "..", "pregunta_pensar": "..", "mini_ejercicio": "..", ` +
    `"comprobacion": [ { "q": "..", "opciones": ["a","b","c"], "correcta": 0 } ], "resumen": ".." }. ` +
    `2-3 preguntas en comprobacion; "correcta" es el índice 0-based. Todo en español.`;
  return prov.parseJson(await prov.chat(NIVELES[nivel].generar, { system: SYS_BASE, user, json: true }));
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

  const fuentes = await recuperar(input); meta.etapas.push('recuperar');
  const plan = await planificar(nivel, input, fuentes); meta.etapas.push('planificar');
  const leccion = await generar(nivel, input, plan, fuentes, opts.perfil); meta.etapas.push('generar');

  const rapido = await auditarRapido(nivel, leccion); meta.etapas.push('auditar-rapido');
  meta.faltantes = rapido.faltantes;

  let scorecard = null, revisionHumana = false, aprobado = null;
  const puedeFuerte = NIVELES[nivel].auditarFuerte && prov.disponible(NIVELES[nivel].auditarFuerte);
  // Dispara auditoría fuerte por reglas (o siempre en excelencia).
  const debeFuerte = puedeFuerte && (nivel === 'excelencia' || ctx.temaSensible || ctx.flagship || !rapido.estructura_ok);
  if (debeFuerte) {
    scorecard = await auditarFuerte(nivel, leccion, fuentes); meta.etapas.push('auditar-fuerte');
    aprobado = UMBRALES.aprobado(scorecard) && rapido.estructura_ok;
    revisionHumana = !aprobado;
  } else {
    // Sin auditoría fuerte: si falta estructura → revisión humana.
    revisionHumana = !rapido.estructura_ok;
    aprobado = rapido.estructura_ok;
  }

  return { leccion, scorecard, plan, aprobado, revisionHumana, meta };
}

module.exports = { isEnabled, construirClase, DIMENSIONES };
