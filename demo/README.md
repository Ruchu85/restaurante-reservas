# Material comercial

Genera el material de venta a partir de la aplicación real: capturas, vídeo con
locución y la página de producto que se enlaza en los mensajes de prospección.

**Página de producto:** https://demo-reservas-restaurante-kappa.vercel.app
**Demo en vivo:** https://reservas-restaurante-demo.vercel.app

Todo usa el restaurante ficticio `restaurante-demo`. No toca ningún cliente real.

## Regenerar

```bash
# 1. Datos de ejemplo (idempotente; --limpiar para rehacerlos)
node demo/seed-demo.mjs

# 2. Capturas de la app real, con sesión de admin
node demo/capturar.mjs

# 3. Vídeo con locución (necesita edge-tts y ffmpeg, ver abajo)
node demo/hacer-video.mjs

# 4. Publicar la página
cd demo/web && npx vercel deploy --prod --yes --scope pablofg1985-5961s-projects
```

## Archivos

| Archivo | Qué hace |
|---|---|
| `seed-demo.mjs` | Reservas y comensales de marzo a diciembre de 2026 |
| `capturar.mjs` | Capturas de escritorio y móvil con Playwright |
| `guion.mjs` | Texto y encuadre de cada escena del vídeo |
| `hacer-video.mjs` | Sintetiza la voz, monta la animación, graba y añade el audio |
| `web/` | Página de producto (HTML estático, proyecto Vercel propio) |

## Dependencias del vídeo

**Voz** — `edge-tts`, voces neuronales de Microsoft, gratis y sin clave de API:

```bash
prospect-system/venv/Scripts/python.exe -m pip install edge-tts
```

**ffmpeg** — para unir imagen y voz. `hacer-video.mjs` lo busca en la ruta de
`ffmpeg-static`; se puede indicar otra con la variable `FFMPEG_PATH`:

```bash
FFMPEG_PATH=/ruta/a/ffmpeg node demo/hacer-video.mjs
```

## Por qué el guion no fija duraciones

Cada escena dura exactamente lo que dura su locución, medida del audio ya
sintetizado. Así se puede reescribir un texto sin que la imagen se
desincronice, que es el problema clásico de estos vídeos.

## Datos de ejemplo

`seed-demo.mjs` genera dos ventanas a propósito:

- **Historial** (marzo–julio): reservas completadas, no-shows y cancelaciones.
  Sin esto todos los comensales saldrían con "0 visitas" y el CRM —que es lo
  que más vende— se vería vacío.
- **Agenda futura** (agosto–diciembre): reservas confirmadas por delante.

Respeta las reglas reales del sistema: días cerrados, una reserva por mesa y
turno, capacidad de cada mesa, y mesas juntadas para los grupos grandes.
