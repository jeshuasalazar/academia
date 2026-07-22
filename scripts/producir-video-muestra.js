'use strict';
/**
 * Prueba OFFLINE de la etapa 6 (video). No requiere ninguna API key:
 * - Si hay XAI key, podría guionizar con LLM (aquí no lo hacemos: generamos
 *   el guion localmente para que el script sea 100% reproducible sin claves).
 * - Si no hay key de TTS (disponibleTTS falso para el proveedor configurado),
 *   usa audio PLACEHOLDER por slide (silencio de 4s vía `ffmpeg -f lavfi
 *   -i anullsrc`) para poder probar el pipeline completo sin secretos.
 * - Renderiza slides con @napi-rs/canvas + cose el MP4 final con ffmpeg.
 * - NO sube a Bunny en modo offline.
 *
 * Uso: node scripts/producir-video-muestra.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { VIDEO } = require('../lib/agente-clases/config');
const { disponibleTTS } = require('../lib/agente-clases/tts');
const videoEtapa = require('../lib/agente-clases/video');

// ---- Lección de muestra: "¿Qué es un modelo de lenguaje?" (3 capas) --------
const LECCION_MUESTRA = {
  titulo: '¿Qué es un modelo de lenguaje?',
  promesa: 'Vas a entender, de verdad, qué hace un modelo de lenguaje cuando "habla".',
  idea_simple:
    'Un modelo de lenguaje es como un amigo que leyó muchísimos libros y ahora adivina, ' +
    'palabra por palabra, qué sigue en una frase. No "sabe" cosas como tú: adivina con muy buena puntería.',
  explicacion_seria:
    'Un modelo de lenguaje es un sistema estadístico entrenado con enormes cantidades de texto para ' +
    'predecir la siguiente palabra (token) dado el contexto previo. Aprende patrones del lenguaje —gramática, ' +
    'hechos, estilo— sin tener una base de datos explícita: todo queda codificado como pesos numéricos.',
  precision_experta:
    'Formalmente, un LLM aproxima P(token_n | token_1..n-1) usando una red transformer con atención. ' +
    'No "entiende" en el sentido humano: minimiza pérdida de predicción sobre corpus masivos. Sus límites ' +
    '—alucinación, sesgo del corpus, ventana de contexto finita— se derivan directamente de ese objetivo estadístico.',
  ejemplo_guiado:
    'Si escribes "El cielo es de color", el modelo calcula probabilidades altas para "azul" porque esa ' +
    'combinación apareció muchísimas veces en su entrenamiento.',
  error_comun: 'Pensar que el modelo "busca" la respuesta en una base de datos, como un buscador.',
  pregunta_pensar: '¿Qué pasaría si entrenaras un modelo solo con texto en un idioma que no conoces?',
  mini_ejercicio: 'Completa tres veces la frase "La inteligencia artificial es..." y observa qué tan distinto sale cada vez.',
  comprobacion: [
    { q: '¿Qué predice un modelo de lenguaje?', opciones: ['La siguiente palabra', 'La verdad absoluta', 'El futuro'], correcta: 0 }
  ],
  resumen: 'Un modelo de lenguaje adivina la siguiente palabra usando patrones aprendidos de muchísimo texto; no "sabe", predice.'
};

// ---- Guion local (sin LLM): 8 slides subiendo simple → serio → experto ----
function guionLocal(leccion) {
  return {
    voz: 'clara, cálida, ritmo pausado, ejemplos cotidianos',
    slides: [
      { id: 1, capa: 'simple', titulo: leccion.titulo,
        bullets: ['Un amigo que leyó muchísimos libros', 'Adivina qué palabra sigue'],
        narracion: leccion.idea_simple },
      { id: 2, capa: 'simple', titulo: 'Ejemplo guiado',
        bullets: ['"El cielo es de color..."', 'El modelo apuesta por "azul"'],
        narracion: leccion.ejemplo_guiado },
      { id: 3, capa: 'simple', titulo: 'Error común',
        bullets: ['No es un buscador', 'No consulta una base de datos'],
        narracion: leccion.error_comun },
      { id: 4, capa: 'serio', titulo: 'Definición profesional',
        bullets: ['Sistema estadístico', 'Predice el siguiente token', 'Entrenado con texto masivo'],
        narracion: leccion.explicacion_seria },
      { id: 5, capa: 'serio', titulo: 'Cómo aprende',
        bullets: ['Gramática, hechos y estilo', 'Todo codificado como pesos numéricos'],
        narracion: 'Aprende patrones del lenguaje sin tener una base de datos explícita: todo queda codificado como pesos numéricos.' },
      { id: 6, capa: 'experto', titulo: 'Precisión experta',
        bullets: ['P(token_n | contexto)', 'Arquitectura transformer + atención'],
        narracion: leccion.precision_experta },
      { id: 7, capa: 'experto', titulo: 'Límites reales',
        bullets: ['Alucinación', 'Sesgo del corpus', 'Ventana de contexto finita'],
        narracion: 'Sus límites se derivan directamente del objetivo estadístico: alucinación, sesgo del corpus y ventana de contexto finita.' },
      { id: 8, capa: 'experto', titulo: 'Para pensar',
        bullets: [leccion.pregunta_pensar],
        narracion: leccion.resumen }
    ]
  };
}

// ---- Placeholder de audio offline: silencio de 4s vía ffmpeg anullsrc -----
function sintetizarPlaceholder(narracion, audioPath) {
  return videoEtapa.ejecutar('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
    '-t', '4', '-q:a', '9', '-acodec', 'libmp3lame', audioPath
  ]);
}

async function main() {
  const dir = '/private/tmp/claude-501/-Users-MAC/34873255-c2d1-43e3-baa6-b968beedfdaa/scratchpad';
  fs.mkdirSync(dir, { recursive: true });

  const ttsOk = disponibleTTS(VIDEO.ttsProveedor);
  console.log(`[muestra] TTS proveedor configurado: ${VIDEO.ttsProveedor} (key presente: ${ttsOk})`);

  const guion = guionLocal(LECCION_MUESTRA);
  console.log('[muestra] Guion generado (offline, sin LLM):');
  console.log(JSON.stringify(guion, null, 2));

  const opts = { ttsProveedor: VIDEO.ttsProveedor, voz: VIDEO.voz };
  if (!ttsOk) {
    console.log('[muestra] Sin key de TTS: usando audio PLACEHOLDER (silencio 4s por slide).');
    opts.sintetizarAudio = sintetizarPlaceholder;
  }

  const { mp4Path, duracionTotal } = await videoEtapa.producir(LECCION_MUESTRA, guion, opts);
  console.log(`[muestra] MP4 generado: ${mp4Path}`);
  console.log(`[muestra] Duración total: ${duracionTotal.toFixed(1)}s`);
  console.log('[muestra] Modo offline: NO se sube a Bunny Stream.');
}

main().catch((e) => {
  console.error('[muestra] Error:', e.message || e);
  process.exit(1);
});
