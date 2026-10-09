"""
Mide la expresividad de una locución sin necesidad de oírla.

La señal que mejor separa "robot" de "persona" es la variación de la entonación:
una voz plana se mueve en un margen estrecho de tono, una natural sube y baja.
Se mide en semitonos (escala perceptual) y no en hercios, porque el oído
percibe el tono de forma logarítmica: 20 Hz de variación sobre una voz grave
se notan muchísimo más que sobre una aguda.
"""
import subprocess, sys, os, glob
import numpy as np

FFMPEG = os.path.join(
    os.environ.get("TEMP", "/tmp"),
    "claude/d--Proyectos-Claude-APP-Restaurantes/7473faa5-088d-4d46-a279-3514556f8c10/scratchpad",
    "tools/node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg.exe",
)
SR = 16000


def pcm(path):
    out = subprocess.run(
        [FFMPEG, "-v", "quiet", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        capture_output=True,
    ).stdout
    return np.frombuffer(out, dtype=np.int16).astype(np.float32) / 32768.0


def f0_track(x, fmin=70, fmax=350):
    """F0 por autocorrelación en ventanas de 40 ms."""
    win = int(0.04 * SR)
    hop = int(0.010 * SR)
    lo, hi = int(SR / fmax), int(SR / fmin)
    out = []
    for i in range(0, len(x) - win, hop):
        seg = x[i : i + win]
        if np.sqrt(np.mean(seg**2)) < 0.015:  # silencio
            out.append(0.0)
            continue
        seg = seg - seg.mean()
        ac = np.correlate(seg, seg, "full")[win - 1 :]
        if ac[0] <= 0:
            out.append(0.0)
            continue
        ac = ac / ac[0]
        band = ac[lo:hi]
        if len(band) == 0:
            out.append(0.0)
            continue
        k = int(np.argmax(band)) + lo
        # Solo se acepta como voz si el pico de autocorrelación es claro; si no,
        # es ruido o consonante sorda y estimaría un tono inventado.
        out.append(SR / k if ac[k] > 0.35 else 0.0)
    return np.array(out)


def pausas(x):
    """Reparto de silencios: una locución natural alterna pausas de distinta duración."""
    win = int(0.02 * SR)
    e = np.array([np.sqrt(np.mean(x[i : i + win] ** 2)) for i in range(0, len(x) - win, win)])
    sil = e < 0.01
    trozos, n = [], 0
    for s in sil:
        if s:
            n += 1
        elif n:
            trozos.append(n * 0.02)
            n = 0
    return [t for t in trozos if t >= 0.08]


print(f"{'voz':<36} {'semitonos':>9} {'F0 med':>7} {'voz%':>6} {'pausas':>7} {'var.pausa':>9}")
print("-" * 80)
filas = []
for f in sorted(glob.glob(os.path.join(sys.argv[1], "*.mp3"))):
    x = pcm(f)
    if len(x) == 0:
        continue
    f0 = f0_track(x)
    v = f0[f0 > 0]
    if len(v) < 10:
        continue
    st = 12 * np.log2(v / np.median(v))  # desviación en semitonos
    p = pausas(x)
    nombre = os.path.splitext(os.path.basename(f))[0]
    filas.append((float(np.std(st)), nombre, float(np.median(v)), len(v) / len(f0), len(p), float(np.std(p)) if len(p) > 1 else 0.0))

for st, nombre, med, vr, np_, pv in sorted(filas, reverse=True):
    print(f"{nombre:<36} {st:>9.2f} {med:>7.0f} {vr*100:>5.0f}% {np_:>7} {pv:>9.2f}")
