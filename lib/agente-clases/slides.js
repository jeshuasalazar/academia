'use strict';
/**
 * Render de un slide branded a PNG (1920x1080) con @napi-rs/canvas (binarios
 * precompilados, sin dependencias de sistema). Paleta tomada de public/css/styles.css
 * (modo oscuro): fondo tinta con acentos azul/coral. Doctoral pero legible.
 */

const { createCanvas, loadImage } = require('@napi-rs/canvas');

const W = 1920, H = 1080;

// Paleta de marca (public/css/styles.css, --bg/--ink/--deep/--blue/--coral).
const PALETA = {
  fondoDe: '#0A1522',
  fondoA: '#12233B',
  ink: '#F2F4F8',
  mute: '#8B96A8',
  blue: '#2D88E8',
  deep: '#1A5FB4',
  coral: '#FF6B47',
  linea: 'rgba(255,255,255,.12)'
};

// Etiqueta y color por capa pedagógica (idea_simple → precision_experta).
const CAPAS = {
  simple:  { label: 'IDEA SIMPLE',        color: '#22A06B' },
  serio:   { label: 'EXPLICACIÓN SERIA',  color: PALETA.blue },
  experto: { label: 'PRECISIÓN EXPERTA',  color: PALETA.coral }
};

// Corta texto en líneas que caben en maxWidth (word-wrap manual con measureText).
function envolverTexto(ctx, texto, maxWidth) {
  const palabras = String(texto || '').split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width > maxWidth && actual) {
      lineas.push(actual);
      actual = p;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

// Dibuja una imagen "cover" (llena el lienzo sin deformar, recorte centrado).
function dibujarCover(ctx, img) {
  const escala = Math.max(W / img.width, H / img.height);
  const w = img.width * escala, h = img.height * escala;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

/**
 * Dibuja un slide branded y devuelve el PNG como Buffer.
 * @param {{capa:'simple'|'serio'|'experto', titulo:string, bullets?:string[]}} slide
 * @param {{tema?:string, fondo?:Buffer}} [opts] fondo = ilustración IA (opcional)
 * @returns {Promise<Buffer>}
 */
async function renderSlide(slide, opts) {
  opts = opts || {};
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const capaInfo = CAPAS[slide.capa] || CAPAS.serio;

  // Fondo base: degradado diagonal tinta (mismo tono que --panel de la app).
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, PALETA.fondoA);
  grad.addColorStop(1, PALETA.fondoDe);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Ilustración IA de fondo (si se pasó): cover + velo para que el texto se lea.
  if (opts.fondo) {
    try {
      const img = await loadImage(opts.fondo);
      dibujarCover(ctx, img);
      // Velo izquierda→derecha: oscuro donde va el texto, deja ver la ilustración
      // a la derecha. Sube el contraste sin tapar el arte.
      const scrim = ctx.createLinearGradient(0, 0, W, 0);
      scrim.addColorStop(0, 'rgba(8,17,28,0.94)');
      scrim.addColorStop(0.55, 'rgba(8,17,28,0.72)');
      scrim.addColorStop(1, 'rgba(8,17,28,0.28)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, W, H);
      // Oscurecido inferior para el footer.
      const scrimB = ctx.createLinearGradient(0, H - 220, 0, H);
      scrimB.addColorStop(0, 'rgba(8,17,28,0)');
      scrimB.addColorStop(1, 'rgba(8,17,28,0.85)');
      ctx.fillStyle = scrimB;
      ctx.fillRect(0, H - 220, W, 220);
    } catch (e) { /* si la imagen no carga, se queda el degradado de marca */ }
  }

  // Franja de acento superior según capa.
  ctx.fillStyle = capaInfo.color;
  ctx.fillRect(0, 0, W, 10);

  // Kicker (capa).
  ctx.fillStyle = capaInfo.color;
  ctx.font = 'bold 34px Arial, DejaVu Sans, Liberation Sans, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(capaInfo.label, 120, 150);

  // Marca aiLearning arriba a la derecha.
  ctx.fillStyle = PALETA.mute;
  ctx.font = '30px Arial, DejaVu Sans, Liberation Sans, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText((opts && opts.tema) || 'aiLearning', W - 120, 150);
  ctx.textAlign = 'left';

  // Ancho de la columna de texto: angosto (izquierda) si hay ilustración detrás.
  const textoAncho = opts.fondo ? Math.round(W * 0.56) : W - 240;

  // Título grande, con word-wrap manual.
  ctx.fillStyle = PALETA.ink;
  ctx.font = 'bold 74px Arial, DejaVu Sans, Liberation Sans, sans-serif';
  const lineasTitulo = envolverTexto(ctx, slide.titulo || '', textoAncho);
  let y = 280;
  for (const linea of lineasTitulo.slice(0, 3)) {
    ctx.fillText(linea, 120, y);
    y += 92;
  }

  // Bullets (hasta 5), debajo del título.
  const bullets = (slide.bullets || []).slice(0, 5);
  ctx.font = '42px Arial, DejaVu Sans, Liberation Sans, sans-serif';
  let by = y + 60;
  for (const b of bullets) {
    ctx.fillStyle = capaInfo.color;
    ctx.beginPath();
    ctx.arc(140, by - 16, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETA.ink;
    const lineasBullet = envolverTexto(ctx, b, textoAncho - 60);
    for (const lb of lineasBullet) {
      ctx.fillText(lb, 180, by);
      by += 56;
    }
    by += 20;
    if (by > H - 160) break; // no desborda el footer
  }

  // Línea separadora y footer.
  ctx.strokeStyle = PALETA.linea;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, H - 110);
  ctx.lineTo(W - 120, H - 110);
  ctx.stroke();

  ctx.fillStyle = PALETA.mute;
  ctx.font = '30px Arial, DejaVu Sans, Liberation Sans, sans-serif';
  ctx.fillText('aiLearning', 120, H - 60);

  return canvas.toBuffer('image/png');
}

module.exports = { renderSlide };
