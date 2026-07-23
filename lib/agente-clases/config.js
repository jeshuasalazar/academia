'use strict';
/**
 * CONFIG del agente-arnés que construye clases. TODAS las perillas viven aquí.
 * Cambiar un modelo, un umbral o una dimensión = editar este archivo; no toca
 * el resto de la academia. Cada modelo es {proveedor, modelo} → proveedores.js
 * sabe cómo llamarlo. Los proveedores se activan según las env keys presentes.
 *
 * Principio: planear con modelo capaz-corto, generar con uno fuerte-barato,
 * auditar con uno capaz e independiente (otra familia).
 */

// Catálogo de modelos disponibles (precio referencial jul-2026, in/out por M).
const MODELOS = {
  // grok-4.1-fast NO existe en esta cuenta; el no-reasoning 4.20 es el barato.
  grok_fast:   { proveedor: 'xai',       modelo: 'grok-4.20-0309-non-reasoning', precio: [1.25, 2.50] },
  grok_43:     { proveedor: 'xai',       modelo: 'grok-4.3',      precio: [1.25, 2.50] },
  grok_45:     { proveedor: 'xai',       modelo: 'grok-4.5',      precio: [2.00, 6.00] },
  haiku:       { proveedor: 'anthropic', modelo: 'claude-haiku-4-5',  precio: [1.00, 5.00] },
  sonnet:      { proveedor: 'anthropic', modelo: 'claude-sonnet-5',   precio: [2.00, 10.0] },
  gemini_flash:{ proveedor: 'google',    modelo: 'gemini-3-flash',    precio: [0.50, 3.00] },
  deepseek:    { proveedor: 'deepseek',  modelo: 'deepseek-v4',       precio: [0.14, 0.28] }
};

// Mezcla por NIVEL. Cada rol apunta a una clave de MODELOS. Editable en caliente.
const NIVELES = {
  economico: {
    planificar: 'grok_fast',
    generar:    'grok_fast',
    auditarRapido: 'deepseek',
    auditarFuerte: null            // sin auditoría fuerte
  },
  estandar: {
    planificar: 'grok_fast',
    generar:    'grok_43',
    auditarRapido: 'deepseek',
    auditarFuerte: 'sonnet'        // solo si dispara umbral
  },
  excelencia: {
    planificar: 'grok_45',
    generar:    'grok_45',
    auditarRapido: 'deepseek',
    auditarFuerte: 'sonnet'        // cross-family, más agresivo
  }
};

// Pipeline de 4 agentes (roles). Cada rol reusa un modelo de NIVELES:
//   investigador → planificar   (recupera fuentes + arma el plan con riesgos)
//   constructor  → generar      (escribe la lección en el template exacto, 3 capas)
//   revisor      → auditarRapido (estructura/JSON/completitud; pide reescritura)
//   evaluador    → auditarFuerte (scorecard 7-dim; decide aprobado/revisión humana)
// El revisor y el evaluador pueden devolver la lección al constructor para UNA
// reescritura con sus notas, antes de marcar revisión humana. Sube la calidad
// sin intervención, usando modelos inferiores (grok/sonnet), no un modelo premium.
const MAX_REESCRITURAS = Number(process.env.AGENTE_MAX_REESCRITURAS || 1);

// Dimensiones del scorecard (1-10). Agregar/quitar = editar este array.
const DIMENSIONES = [
  { id: 'rigor',        label: 'Rigor' },
  { id: 'claridad',     label: 'Claridad' },
  { id: 'profundidad',  label: 'Profundidad' },
  { id: 'aplicabilidad',label: 'Aplicabilidad' },
  { id: 'fidelidad',    label: 'Fidelidad a fuentes' },
  { id: 'riesgo',       label: 'Riesgo de alucinación' }, // OJO: 1=bajo, 10=alto
  { id: 'simplicidad',  label: 'Simplicidad explicativa' }
];

// Reglas para disparar auditoría FUERTE y/o marcar revisión humana.
const UMBRALES = {
  dispararFuerte: (sc, ctx) =>
    (sc.rigor < 8) || (sc.profundidad < 8) || (sc.riesgo > 3) ||
    Boolean(ctx && (ctx.temaSensible || ctx.flagship)),
  // Publica solo si pasa; si no, queda como borrador con "revisión humana".
  aprobado: (sc) =>
    sc.rigor >= 7 && sc.claridad >= 7 && sc.profundidad >= 7 &&
    sc.aplicabilidad >= 7 && sc.fidelidad >= 7 && sc.simplicidad >= 7 &&
    sc.riesgo <= 4
};

// Etapa 6 (opcional): producción de video explainer MP4 → Bunny Stream.
// Pluggable: si AGENTE_VIDEO no es '1' la etapa se salta entera (no-fatal).
const VIDEO = {
  habilitado: process.env.AGENTE_VIDEO === '1',
  ttsProveedor: process.env.AGENTE_TTS || 'google',
  voz: process.env.AGENTE_VOZ || 'es-US-Neural2-B',
  resolucion: '1920x1080',
  fps: 30,
  modeloGuion: 'grok_fast',
  minSlides: 6,
  maxSlides: 12,
  fade: 0.4,
  bunnyLibraryId: process.env.BUNNY_STREAM_LIBRARY_ID || null,
  kenBurns: process.env.AGENTE_KENBURNS !== '0'  // zoom/paneo suave (gratis) por defecto
};

// Ilustraciones IA por escena (pluggable, imagenes.js). Se activa poniendo
// AGENTE_IMG=<proveedor> (together|fal|deepinfra|xai|openai|google). Sin él, los
// slides usan el fondo degradado de marca (comportamiento anterior). "Mejor
// precio": together o fal (FLUX.1 schnell, ~$0.003/img → ~$0.03/video).
const IMG = {
  proveedor: process.env.AGENTE_IMG || null,
  habilitado: Boolean(process.env.AGENTE_IMG && process.env.AGENTE_IMG !== 'none')
};

module.exports = { MODELOS, NIVELES, DIMENSIONES, UMBRALES, VIDEO, IMG, MAX_REESCRITURAS };
