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
| `analizar-voz.py` | Mide entonación y pausas de un mp3, para no ajustar la voz de oído |
| `web/` | Página de producto (HTML estático, proyecto Vercel propio) |

## Dependencias del vídeo

**Voz** — `edge-tts`, voces neuronales de Microsoft, gratis y sin clave de API:

```bash
prospect-system/venv/Scripts/python.exe -m pip install edge-tts
```

**numpy** — solo la necesita `analizar-voz.py`, no el montaje del vídeo:

```bash
prospect-system/venv/Scripts/python.exe -m pip install numpy
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

## Por qué la locución va frase a frase

No se manda cada escena de una pieza al sintetizador, sino frase a frase, y el
silencio entre ellas lo pone `hacer-video.mjs`. Tres razones, todas medidas:

- **El motor devuelve cada clip con ~0,26 s de silencio delante y ~0,91 s
  detrás.** Con una llamada por escena eso se sumaba a la pausa de cambio de
  escena y dejaba huecos de más de segundo y medio. Recortado, la pausa es
  exactamente la que se pide.
- **Un párrafo entero aplana la entonación**: la voz corre hacia el final y
  pierde el arco de cada frase. Cortando por frases, cada una recupera su curva
  completa (4,79 → 5,10 semitonos de variación sobre el mismo texto).
- **El tempo deja de ser constante.** Cada frase se sintetiza a la velocidad que
  le toca según su papel: las cortas y rotundas más despacio, las largas y
  explicativas algo más sueltas. Antes las doce escenas iban clavadas al mismo
  ritmo, que es lo que más delataba a la máquina.

Los valores viven en `PAUSAS` y `RITMOS`, en `guion.mjs`. Los `...` del guion no
llegan al sintetizador: son la marca de "aquí un respiro más largo".

Para comprobar si un cambio mejora o empeora, `demo/analizar-voz.py` mide la
variación de entonación en semitonos y el reparto de pausas de cualquier mp3,
sin depender del oído.

## Datos de ejemplo

`seed-demo.mjs` genera dos ventanas a propósito:

- **Historial** (marzo–julio): reservas completadas, no-shows y cancelaciones.
  Sin esto todos los comensales saldrían con "0 visitas" y el CRM —que es lo
  que más vende— se vería vacío.
- **Agenda futura** (agosto–diciembre): reservas confirmadas por delante.

Respeta las reglas reales del sistema: días cerrados, una reserva por mesa y
turno, capacidad de cada mesa, y mesas juntadas para los grupos grandes.


## Motor de voz alternativo: Chatterbox

`edge-tts` (Azure) sigue siendo el motor por defecto. Para probar una voz generada por un modelo
abierto (MIT) que sube y baja el tono de forma menos previsible:

1. Python 3.12 (torch no tiene versión para el 3.14 del proyecto) con
   `pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu`
   y `pip install chatterbox-tts faster-whisper num2words`.
2. Una voz de referencia que ya hable español (sin ella el modelo habla con acento inglés):
   `voz/ref-alvaro.wav` (hombre) o `voz/ref-ximena.wav` (mujer), ambas generadas con Azure.
3. Generar SIN tocar el vídeo publicado:

```bash
MOTOR_VOZ=chatterbox VOZ_PY=<python 3.12>/python.exe FFMPEG_PATH=ffmpeg SALIDA_VIDEO=demo/salida-voz NOMBRE_VIDEO=demo-voz.mp4 node demo/hacer-video.mjs
```

Cada frase se genera 3 veces (`VOZ_TOMAS`), se transcribe con Whisper y se queda la que mejor
coincide con el guion. Se guardan en `.voz-chatterbox/` (caché por contenido: solo se regeneran las
frases cuyo texto cambia). Tarda unos 50 minutos la primera vez (CPU, sin GPU) y unos 4 minutos
después. `VOZ_TEMPO` (por defecto 1,10) ajusta la velocidad global. Las siglas se escriben
deletreadas en el manifiesto («pe de efe»). `voz/pruebas/index.html` compara versiones a oído.
