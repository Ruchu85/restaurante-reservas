"""
Locución con Chatterbox (modelo abierto, licencia MIT) como alternativa a edge-tts.

Por qué existe: edge-tts (voces de Azure) ya estaba exprimido —se probaron las
nueve voces españolas y se cortó la locución frase a frase para recuperar la
entonación— y seguía sonando a máquina. Chatterbox genera la prosodia entera
con un modelo de lenguaje, así que sube y baja el tono de forma menos
previsible. Se mide con analizar-voz.py: 5,6-5,9 semitonos de variación frente a
4,4-5,0 de Azure en el mismo texto.

Cómo funciona:
  - Recibe un manifiesto JSON: [{"clave": "01-0", "texto": "...", "ritmo": "-3%"}, ...]
  - Para cada frase genera N tomas (semillas distintas) y las transcribe con
    Whisper. Descarta las que no dicen lo que dice el guion (alucinaciones,
    palabras comidas, repeticiones) y, entre las buenas, se queda con la más
    expresiva. Sin esto, un modelo generativo se equivoca una de cada pocas.
  - Escribe un mp3 por frase y un informe con lo que midió.

Se necesita una voz de referencia que ya hable español (ver --referencia): sin
ella el modelo habla español con acento inglés, porque hereda el acento de la
voz de la que copia el timbre.

Se ejecuta con el Python 3.12 donde está instalado chatterbox-tts (torch no
tiene versión para el Python 3.14 del proyecto). Ver README de esta carpeta.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
from functools import partialmethod
from pathlib import Path

# Las barras de progreso de cada muestreo inundan la consola y los registros.
from tqdm import tqdm
tqdm.__init__ = partialmethod(tqdm.__init__, disable=True)

import numpy as np
import torch
import torchaudio as ta

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")


def normalizar(t: str) -> list[str]:
    # Whisper escribe "9 y media" con cifras y el guion dice "nueve": sin pasar
    # los números a palabras se contaba como error una frase perfecta.
    from num2words import num2words
    t = re.sub(r"\d+", lambda m: num2words(int(m.group()), lang="es"), t.replace("€", " euros"))
    t = unicodedata.normalize("NFKD", t.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.findall(r"[a-z0-9ñ]+", t)


def wer(ref: list[str], hip: list[str]) -> float:
    """Tasa de error de palabras (distancia de edición / palabras del guion)."""
    d = list(range(len(hip) + 1))
    for i, r in enumerate(ref, 1):
        prev, d[0] = d[0], i
        for j, h in enumerate(hip, 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (r != h))
            prev, d[j] = d[j], cur
    return d[len(hip)] / max(1, len(ref))


def semitonos(x: np.ndarray, sr: int) -> float:
    """Variación de tono en semitonos (misma idea que analizar-voz.py)."""
    win, hop = int(0.04 * sr), int(0.010 * sr)
    lo, hi = int(sr / 350), int(sr / 70)
    f0 = []
    for i in range(0, len(x) - win, hop):
        seg = x[i:i + win]
        if np.sqrt(np.mean(seg ** 2)) < 0.015:
            continue
        seg = seg - seg.mean()
        ac = np.correlate(seg, seg, "full")[win - 1:]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        k = int(np.argmax(ac[lo:hi])) + lo
        if ac[k] > 0.35:
            f0.append(sr / k)
    if len(f0) < 10:
        return 0.0
    v = np.array(f0)
    return float(np.std(12 * np.log2(v / np.median(v))))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("manifiesto")
    ap.add_argument("salida")
    ap.add_argument("--referencia", required=True, help="wav de una voz que hable español")
    ap.add_argument("--tomas", type=int, default=3)
    ap.add_argument("--exageracion", type=float, default=0.5)
    ap.add_argument("--cfg", type=float, default=0.3)
    ap.add_argument("--temperatura", type=float, default=0.8)
    a = ap.parse_args()

    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    from faster_whisper import WhisperModel

    salida = Path(a.salida)
    salida.mkdir(parents=True, exist_ok=True)
    items = json.load(open(a.manifiesto, encoding="utf-8"))

    t0 = time.time()
    tts = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    asr = WhisperModel("small", device="cpu", compute_type="int8")
    print(f"modelos cargados en {time.time() - t0:.0f}s · {len(items)} frases · {a.tomas} tomas", flush=True)

    # Caché: cada frase se identifica por lo que determina su sonido. Si el
    # texto, el ritmo, la voz de referencia o los parámetros no cambian, no se
    # vuelve a generar (una frase cuesta unos 30 s por toma en CPU).
    ref_hash = hashlib.sha1(Path(a.referencia).read_bytes()).hexdigest()[:10]
    params = f"{a.tomas}|{a.exageracion}|{a.cfg}|{a.temperatura}|{ref_hash}"

    informe = []
    for n, it in enumerate(items, 1):
        h = hashlib.sha1(f"{it['texto']}|{it.get('ritmo', '')}|{params}".encode()).hexdigest()
        meta = salida / f"{it['clave']}.json"
        if (salida / f"{it['clave']}.mp3").exists() and meta.exists() and json.load(open(meta))["hash"] == h:
            informe.append(json.load(open(meta))["informe"])
            print(f"[{n}/{len(items)}] {it['clave']} · en caché", flush=True)
            continue
        guion = normalizar(it["texto"])
        tomas = []
        for k in range(a.tomas):
            torch.manual_seed(1000 * n + k)
            t1 = time.time()
            wav = tts.generate(
                it["texto"], language_id="es", audio_prompt_path=a.referencia,
                exaggeration=a.exageracion, cfg_weight=a.cfg, temperature=a.temperatura,
            )
            x = wav.squeeze().numpy().astype(np.float32)
            seg, _ = asr.transcribe(x if tts.sr == 16000 else
                                    ta.functional.resample(wav, tts.sr, 16000).squeeze().numpy(),
                                    language="es", beam_size=5)
            dicho = " ".join(s.text for s in seg)
            e = wer(guion, normalizar(dicho))
            dur = len(x) / tts.sr
            cps = len(it["texto"]) / dur  # caracteres por segundo
            st = semitonos(x, tts.sr)
            # Fuera de rango humano: demasiado rápido o demasiado lento es un fallo.
            ok = e <= 0.20 and 9 <= cps <= 22
            tomas.append(dict(k=k, wav=wav, wer=e, dur=dur, cps=cps, st=st, ok=ok, dicho=dicho, seg=time.time() - t1))
        buenas = [t for t in tomas if t["ok"]] or sorted(tomas, key=lambda t: t["wer"])[:1]
        mejor = max(buenas, key=lambda t: t["st"] - 8 * t["wer"])
        crudo = salida / f"{it['clave']}.wav"
        ta.save(str(crudo), mejor["wav"], tts.sr)

        # Ritmo por frase: se aplica con atempo (±8 %), que no altera el timbre.
        pct = float(str(it.get("ritmo", "0%")).replace("%", "").replace("+", "") or 0)
        tempo = max(0.85, min(1.15, 1 + pct / 100))
        filtro = f"atempo={tempo:.4f}" if abs(tempo - 1) > 0.005 else "anull"
        subprocess.run([FFMPEG, "-v", "quiet", "-y", "-i", str(crudo), "-af", filtro,
                        "-c:a", "libmp3lame", "-q:a", "2", str(salida / f"{it['clave']}.mp3")], check=True)
        crudo.unlink()

        fila = dict(clave=it["clave"], texto=it["texto"], elegida=mejor["k"], wer=round(mejor["wer"], 3),
                    st=round(mejor["st"], 2), cps=round(mejor["cps"], 1),
                    tomas=[dict(k=t["k"], wer=round(t["wer"], 3), st=round(t["st"], 2), ok=t["ok"]) for t in tomas],
                    dicho=mejor["dicho"])
        informe.append(fila)
        json.dump(dict(hash=h, informe=fila), open(meta, "w", encoding="utf-8"), ensure_ascii=False)
        print(f"[{n}/{len(items)}] {it['clave']} · toma {mejor['k']} · WER {mejor['wer']:.2f} · "
              f"{mejor['st']:.1f} st · {sum(t['seg'] for t in tomas):.0f}s", flush=True)
        json.dump(informe, open(salida / "informe.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    medios = [i["wer"] for i in informe]
    print(f"HECHO · WER medio {np.mean(medios):.3f} · peor {max(medios):.3f}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
