# Etapa 6: producción de video (opcional, pluggable)

Convierte una lección aprobada en un MP4 explainer (slides branded + narración TTS)
y lo sube a Bunny Stream. No-fatal: si falla, la lección de texto sigue publicándose
igual. Se apaga con `AGENTE_VIDEO` sin tocar código; se quita del todo borrando
`tts.js`, `slides.js`, `video.js` y la llamada en `index.js`.

## Archivos

- `tts.js` — TTS pluggable (openai | google | elevenlabs).
- `slides.js` — render de slide 1920x1080 con `@napi-rs/canvas` (binarios precompilados, sin deps de sistema).
- `video.js` — guionizar (LLM) → producir (slides+audio → MP4 con ffmpeg) → subirBunny.
- `../../scripts/producir-video-muestra.js` — prueba end-to-end offline (sin claves).

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `AGENTE_VIDEO` | sí | `'1'` para habilitar la etapa; cualquier otro valor la salta. |
| `AGENTE_TTS` | no | Proveedor de TTS: `openai`\|`google`\|`elevenlabs`. Default `google`. |
| `AGENTE_VOZ` | no | Voz/idioma del proveedor elegido. Default `es-US-Neural2-B`. |
| `OPENAI_API_KEY` | si TTS=openai | Ya usada por el resto del agente. |
| `GOOGLE_API_KEY` | si TTS=google | Google Cloud Text-to-Speech v1. |
| `ELEVENLABS_API_KEY` | si TTS=elevenlabs | ElevenLabs. |
| `BUNNY_STREAM_LIBRARY_ID` | para subir a Bunny | Si falta, el MP4 se genera pero no se sube (queda `video:null`). |
| `BUNNY_STREAM_API_KEY` | para subir a Bunny | AccessKey de Bunny Stream. |

## Railway / nixpacks

El build usa NIXPACKS (`railway.json`). `ffmpeg`/`ffprobe` NO vienen en el runtime de
Node por defecto y son obligatorios para `video.js` (spawn de ambos binarios).
`@napi-rs/canvas` además necesita una fuente Latin instalada en el sistema (los slides
usan la pila `Arial, DejaVu Sans, Liberation Sans, sans-serif`; sin fuente los acentos
se ven como tofu/☐). Se añadió `nixpacks.toml` en la raíz del repo con:

```toml
[phases.setup]
nixPkgs = ["ffmpeg", "dejavu_fonts"]
```

Si la etapa de video se retira, este archivo puede borrarse también.

## Prueba offline

```
node scripts/producir-video-muestra.js
```

No requiere ninguna API key: genera el guion localmente (sin LLM) y, si no hay key de
TTS configurada, usa audio placeholder (silencio de 4s por slide vía `ffmpeg -f lavfi
-i anullsrc`). Renderiza los PNG, cose el MP4 con ffmpeg y NO sube a Bunny. Imprime la
ruta del MP4 final.
