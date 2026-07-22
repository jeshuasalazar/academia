'use strict';
/**
 * Etapa 6 (opcional) del agente-arnés: produce un video explainer MP4 a partir
 * de una lección ya generada y lo sube a Bunny Stream. Pluggable y no-fatal:
 * si algo falla aquí, la lección de TEXTO sigue siendo válida (produccionCompleta
 * nunca lanza). Se quita borrando este archivo + tts.js + slides.js + la llamada
 * en index.js.
 *
 * Pipeline: guionizar (LLM) → producir (slides PNG + TTS + ffmpeg) → subirBunny.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const { VIDEO } = require('./config');
const prov = require('./proveedores');
const { sintetizar } = require('./tts');
const { renderSlide } = require('./slides');

const SYS_GUION =
  'Eres guionista de video explainer para aiLearning (academia de IA aplicada, español de México). ' +
  'Rigor doctoral explicado como a un niño de 5-10 años, subiendo de nivel en 3 capas: simple → serio → experto. ' +
  'Respondes SOLO con JSON válido, sin markdown ni texto extra.';

// ---- guionizar: LLM produce el guion de slides+narración a partir de la lección.
async function guionizar(nivel, leccion) {
  const user =
    `Lección: "${leccion.titulo}"\n` +
    `Idea simple: ${leccion.idea_simple}\n` +
    `Explicación seria: ${leccion.explicacion_seria}\n` +
    `Precisión experta: ${leccion.precision_experta}\n` +
    `Ejemplo guiado: ${leccion.ejemplo_guiado}\n` +
    `Error común: ${leccion.error_comun}\n` +
    `Resumen: ${leccion.resumen}\n\n` +
    `Convierte esto en un guion de video explainer de ${VIDEO.minSlides}-${VIDEO.maxSlides} slides que ` +
    `sube por las 3 capas (empieza en 'simple', pasa por 'serio', cierra en 'experto'). ` +
    `Devuelve JSON EXACTO: { "voz": "descripción breve del tono narrado", "slides": [ ` +
    `{ "id": 1, "capa": "simple"|"serio"|"experto", "titulo": "..", "bullets": ["..", ".."], ` +
    `"narracion": "texto hablado, 2-4 frases naturales" } ] }. Todo en español de México.`;
  const modelo = VIDEO.modeloGuion;
  return prov.parseJson(await prov.chat(modelo, { system: SYS_GUION, user, json: true, maxTokens: 4000 }));
}

// ---- ejecuta un binario externo y espera a que termine (no lanza binarios propios).
function ejecutar(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let stderr = '';
    p.stderr.on('data', (d) => { stderr += d.toString(); });
    p.on('error', reject); // binario no encontrado en PATH
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} salió con código ${code}: ${stderr.slice(-500)}`));
    });
  });
}

// ---- duración en segundos de un archivo de audio/video vía ffprobe.
async function medirDuracion(filePath) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', filePath
    ]);
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d.toString(); });
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve(parseFloat(out.trim()) || 0);
      else reject(new Error(`ffprobe salió con código ${code}: ${err.slice(-300)}`));
    });
  });
}

function tmpDir() {
  const base = process.env.AGENTE_VIDEO_TMP ||
    '/private/tmp/claude-501/-Users-MAC/34873255-c2d1-43e3-baa6-b968beedfdaa/scratchpad';
  const dir = path.join(base, `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Produce el MP4 a partir del guion: renderiza cada slide a PNG, sintetiza su
 * narración a audio, mide duración con ffprobe, y concatena todo con ffmpeg
 * (cada slide dura lo que su audio, fundidos suaves, H.264+AAC, faststart).
 * @param {object} leccion
 * @param {{voz:string, slides:object[]}} guion
 * @param {object} [opts] {ttsProveedor, voz}
 * @returns {Promise<{mp4Path:string, duracionTotal:number}>}
 */
async function producir(leccion, guion, opts) {
  opts = opts || {};
  const dir = tmpDir();
  const ttsProveedor = opts.ttsProveedor || VIDEO.ttsProveedor;
  const voz = opts.voz || VIDEO.voz;
  const slides = guion.slides || [];

  const segmentos = []; // { png, audio, duracion }
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const png = path.join(dir, `slide-${String(i).padStart(2, '0')}.png`);
    const buf = await renderSlide(slide, { tema: leccion.titulo });
    fs.writeFileSync(png, buf);

    const audio = path.join(dir, `audio-${String(i).padStart(2, '0')}.mp3`);
    if (opts.sintetizarAudio) {
      // Inyectable para modo offline (placeholder de silencio con anullsrc).
      await opts.sintetizarAudio(slide.narracion, audio);
    } else {
      const { buffer } = await sintetizar(slide.narracion, { proveedor: ttsProveedor, voz });
      fs.writeFileSync(audio, buffer);
    }
    const duracion = await medirDuracion(audio);
    segmentos.push({ png, audio, duracion: duracion > 0 ? duracion : 4 });
  }

  // Por cada slide: un mini-clip mp4 (imagen fija + su audio) con fundidos.
  const clips = [];
  for (let i = 0; i < segmentos.length; i++) {
    const s = segmentos[i];
    const clip = path.join(dir, `clip-${String(i).padStart(2, '0')}.mp4`);
    const fade = Math.min(VIDEO.fade, s.duracion / 3);
    const vf = `scale=${VIDEO.resolucion.replace('x', ':')},fps=${VIDEO.fps},` +
      `fade=t=in:st=0:d=${fade},fade=t=out:st=${Math.max(0, s.duracion - fade)}:d=${fade}`;
    await ejecutar('ffmpeg', [
      '-y', '-loop', '1', '-i', s.png, '-i', s.audio,
      '-t', String(s.duracion),
      '-vf', vf,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-shortest',
      clip
    ]);
    clips.push(clip);
  }

  // Concatena los clips (mismo códec, sin recodificar de nuevo por costura simple).
  const listaPath = path.join(dir, 'lista.txt');
  fs.writeFileSync(listaPath, clips.map((c) => `file '${c}'`).join('\n'));
  const mp4Path = path.join(dir, 'video-final.mp4');
  await ejecutar('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', listaPath,
    '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart',
    mp4Path
  ]);

  const duracionTotal = segmentos.reduce((acc, s) => acc + s.duracion, 0);
  return { mp4Path, duracionTotal };
}

// ---- subirBunny: crea el video en Bunny Stream y sube el binario. No-fatal.
async function subirBunny(mp4Path, titulo) {
  const libraryId = VIDEO.bunnyLibraryId;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) throw new Error('Falta BUNNY_STREAM_LIBRARY_ID o BUNNY_STREAM_API_KEY.');

  const crear = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: titulo })
  });
  if (!crear.ok) throw new Error(`bunny-crear ${crear.status}: ${(await crear.text()).slice(0, 200)}`);
  const { guid: videoId } = await crear.json();

  const bin = fs.readFileSync(mp4Path);
  const subir = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
    method: 'PUT',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/octet-stream' },
    body: bin
  });
  if (!subir.ok) throw new Error(`bunny-subir ${subir.status}: ${(await subir.text()).slice(0, 200)}`);

  return { proveedor: 'bunny', libraryId, videoId };
}

/**
 * Etapa completa de video: guion → producción → (subida Bunny si hay key).
 * NUNCA lanza: cualquier fallo se devuelve como {saltado:true, motivo} o con
 * video:null, para no tumbar la lección de texto que ya está aprobada.
 */
async function produccionCompleta(leccion, opts) {
  opts = opts || {};
  if (leccion.origen === 'humano' || opts.humano) return { saltado: true, motivo: 'humano' };
  if (!VIDEO.habilitado) return { saltado: true, motivo: 'deshabilitado' };

  try {
    const guion = await guionizar(opts.nivel || 'estandar', leccion);
    const { mp4Path, duracionTotal } = await producir(leccion, guion, opts);

    let video = null;
    if (VIDEO.bunnyLibraryId && process.env.BUNNY_STREAM_API_KEY) {
      try {
        video = await subirBunny(mp4Path, leccion.titulo);
      } catch (e) {
        video = null; // subida no-fatal: el mp4 local sigue existiendo
      }
    }

    return { video, guion, mp4Path, duracionTotal, saltado: false };
  } catch (e) {
    return { saltado: true, motivo: `error: ${String(e.message || e)}` };
  }
}

module.exports = { guionizar, producir, subirBunny, produccionCompleta, medirDuracion, ejecutar };
