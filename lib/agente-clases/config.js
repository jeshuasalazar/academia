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
  grok_fast:   { proveedor: 'xai',       modelo: 'grok-4.1-fast', precio: [0.20, 0.50] },
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

module.exports = { MODELOS, NIVELES, DIMENSIONES, UMBRALES };
