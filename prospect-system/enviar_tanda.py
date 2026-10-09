"""
Envía la siguiente tanda pendiente de correos de captación. Lo lanza el
Programador de tareas de Windows (ver programar_envios.ps1); no hace falta
ejecutarlo a mano.

Pensado para que, si algo no está en orden, NO envíe nada y avise:

  - Solo martes, miércoles o jueves, entre las 10:00 y las 12:30 (hora local).
  - Como mucho UNA tanda por día natural. Si un día falla el ordenador, la tanda
    se retrasa al siguiente hueco válido; nunca se juntan dos el mismo día.
  - Antes de enviar comprueba que la web, la política de privacidad y el aviso
    legal responden: el correo los enlaza y no debe salir apuntando a un 404.
  - Si existe data/PAUSAR_ENVIOS, no envía. Es el interruptor de parada.
  - Solo envía los borradores de la tanda, y solo si siguen en estado "draft",
    el negocio no está dado de baja y no se le ha escrito ya.
  - Al terminar manda un resumen a Pablo. Si no puede enviar, manda un aviso
    (uno por día, no uno por cada intento).

Opciones de prueba:
  --simulacro        no envía ni cambia nada; enseña qué haría
  --ignorar-ventana  salta la comprobación de día y hora (solo con --simulacro)
  --probar-aviso     manda un correo de prueba a Pablo por el canal de avisos
"""
from __future__ import annotations

import json
import os
import smtplib
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
os.chdir(RAIZ)
sys.path.insert(0, str(RAIZ))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from src.config.settings import get_settings  # noqa: E402
from src.outreach.sender import EmailSender  # noqa: E402
from src.storage.database import get_session, init_db  # noqa: E402
from src.storage.db_models import EmailDraft, Lead  # noqa: E402
from src.storage.repository import EmailDraftRepository  # noqa: E402

TANDAS = RAIZ / "data" / "tandas.json"
PAUSA = RAIZ / "data" / "PAUSAR_ENVIOS"
BLOQUEO = RAIZ / "data" / ".envio.lock"
LOG = RAIZ / "logs" / "envios.log"
AVISAR_A = "pablofg1985@gmail.com"
TAREA = "CitaLista-Envio-Tandas"
VENTANA = (10 * 60, 12 * 60 + 30)  # minutos desde medianoche
DIAS_VALIDOS = {1, 2, 3}  # martes, miércoles, jueves
SIMULACRO = "--simulacro" in sys.argv
IGNORAR_VENTANA = "--ignorar-ventana" in sys.argv


def log(msg: str) -> None:
    linea = f"{datetime.now():%Y-%m-%d %H:%M:%S} {'[SIMULACRO] ' if SIMULACRO else ''}{msg}"
    print(linea, flush=True)
    LOG.parent.mkdir(exist_ok=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(linea + "\n")


def avisar(asunto: str, cuerpo: str, una_vez_al_dia: str | None = None) -> None:
    """Correo a Pablo por SMTP. `una_vez_al_dia` evita repetir el mismo aviso."""
    if SIMULACRO:
        log(f"(no se envía el aviso) {asunto}")
        return
    if una_vez_al_dia:
        marca = RAIZ / "data" / f".aviso-{una_vez_al_dia}-{datetime.now():%Y%m%d}"
        if marca.exists():
            return
        marca.write_text("1")
    s = get_settings()
    msg = MIMEText(cuerpo, "plain", "utf-8")
    # El nombre del remitente va en ASCII: con tilde sin codificar Resend rechaza la
    # cabecera ("Invalid `from` field") y el aviso se perdía sin que nadie lo notara.
    msg["Subject"], msg["From"], msg["To"] = asunto, f"Cita-Lista avisos <{s.sender_email}>", AVISAR_A
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=30) as srv:
            srv.starttls()
            srv.login(s.smtp_user, s.smtp_password)
            srv.sendmail(s.sender_email, [AVISAR_A], msg.as_string())
    except Exception as exc:  # el aviso nunca debe romper el envío
        log(f"No se pudo enviar el aviso: {exc}")


def quitar_tarea() -> None:
    try:
        subprocess.run(["schtasks", "/Delete", "/TN", TAREA, "/F"], capture_output=True, timeout=30)
        log(f"Tarea programada '{TAREA}' eliminada: no quedan tandas.")
    except Exception as exc:
        log(f"No se pudo eliminar la tarea programada: {exc}")


def web_viva() -> str | None:
    """Devuelve un texto de error si algo de lo que enlaza el correo no responde."""
    for url in ("https://cita-lista.es/", "https://cita-lista.es/privacidad",
                "https://cita-lista.es/aviso-legal", "https://cita-lista.es/calculadora"):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 CitaLista-envios"})
            if urllib.request.urlopen(req, timeout=20).status != 200:
                return f"{url} no responde 200"
        except Exception as exc:
            return f"{url} falla: {exc}"
    return None


def main() -> int:
    if "--probar-aviso" in sys.argv:
        avisar("Cita-Lista · prueba del canal de avisos", "Si lees esto, los avisos de los envíos programados te llegan.")
        log("Aviso de prueba enviado.")
        return 0

    ahora = datetime.now()
    if PAUSA.exists():
        log("Existe data/PAUSAR_ENVIOS: no se envía nada.")
        return 0

    if not IGNORAR_VENTANA or not SIMULACRO:
        minutos = ahora.hour * 60 + ahora.minute
        if ahora.weekday() not in DIAS_VALIDOS or not (VENTANA[0] <= minutos <= VENTANA[1]):
            log(f"Fuera de ventana ({ahora:%A %H:%M}): martes a jueves de 10:00 a 12:30. No se envía.")
            return 0

    plan = json.loads(TANDAS.read_text(encoding="utf-8"))
    hoy = ahora.strftime("%Y-%m-%d")
    if any(t.get("fecha_envio") == hoy for t in plan["tandas"]):
        log("Hoy ya se envió una tanda: máximo una por día.")
        return 0
    pendientes = [t for t in plan["tandas"] if t["estado"] == "pendiente"]
    if not pendientes:
        log("No quedan tandas pendientes.")
        if not SIMULACRO:
            quitar_tarea()
        return 0
    tanda = pendientes[0]
    if tanda["no_antes_de"] > hoy and not SIMULACRO:
        log(f"{tanda['nombre']} no se envía antes del {tanda['no_antes_de']}.")
        return 0

    # Evita dos ejecuciones a la vez (el reintento de las 11:30 mientras la de las 10:30 sigue enviando).
    if BLOQUEO.exists() and datetime.fromtimestamp(BLOQUEO.stat().st_mtime) > ahora - timedelta(hours=2):
        log("Ya hay un envío en marcha (bloqueo reciente). Salgo.")
        return 0
    if not SIMULACRO:
        BLOQUEO.write_text(ahora.isoformat())

    try:
        settings = get_settings()
        if settings.dry_run:
            log("DRY_RUN=true en .env: no se envía nada.")
            avisar("Cita-Lista · envío NO realizado", "DRY_RUN está activo en prospect-system/.env.", "dryrun")
            return 1
        if not settings.email_sending_configured():
            log("Falta la configuración de envío (SMTP).")
            avisar("Cita-Lista · envío NO realizado", "Falta la configuración SMTP en prospect-system/.env.", "smtp")
            return 1
        problema = web_viva()
        if problema:
            log(f"La web no está en condiciones: {problema}. No se envía.")
            avisar("Cita-Lista · envío NO realizado", f"No envié {tanda['nombre']} porque {problema}.\n"
                   "Los correos enlazan esas páginas. Lo reintentará en el siguiente hueco.", "web")
            return 1

        init_db(settings.database_url)
        validos, descartados = [], []
        with get_session() as sesion:
            for did in tanda["ids"]:
                d = sesion.get(EmailDraft, did)
                lead = sesion.get(Lead, d.lead_id) if d else None
                if not d or not lead:
                    descartados.append((did, "no existe"))
                elif d.status != "draft":
                    descartados.append((lead.name, f"borrador en estado {d.status}"))
                elif lead.do_not_contact:
                    descartados.append((lead.name, "dado de baja"))
                elif not lead.email:
                    descartados.append((lead.name, "sin email"))
                elif lead.email_status == "sent":
                    descartados.append((lead.name, "ya se le escribió"))
                else:
                    validos.append((did, lead.name, lead.email))
            ya_aprobados = sesion.query(EmailDraft).filter(EmailDraft.status == "approved").count()
        for quien, motivo in descartados:
            log(f"  descartado: {quien} ({motivo})")
        if ya_aprobados:
            # El envío manda TODO lo aprobado: si hay algo ajeno a la tanda, se para.
            log(f"Hay {ya_aprobados} borradores aprobados ajenos a la tanda: no envío para no mezclarlos.")
            avisar("Cita-Lista · envío NO realizado", f"Hay {ya_aprobados} borradores en estado 'approved' que no son de la tanda; "
                   "los he dejado sin tocar. Revisa `main.py emails review`.", "ajenos")
            return 1

        log(f"{tanda['nombre']}: {len(validos)} correos listos ({len(descartados)} descartados).")
        for _, nombre, email in validos:
            log(f"  -> {nombre} <{email}>")
        if SIMULACRO:
            log("Simulacro terminado: no se ha enviado ni modificado nada.")
            return 0
        if not validos:
            tanda["estado"] = "vacia"
            TANDAS.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")
            return 0

        with get_session() as sesion:
            repo = EmailDraftRepository(sesion)
            for did, _, _ in validos:
                repo.update_status(did, "approved")
            sesion.commit()

        resultado = EmailSender().send_approved_drafts(limit=len(validos))
        enviados, errores = resultado.get("sent", 0), resultado.get("errors", 0)
        log(f"Resultado: {enviados} enviados, {errores} con error.")

        tanda.update(estado="enviada", fecha_envio=hoy, enviados=enviados, errores=errores)
        TANDAS.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")

        siguiente = next((t for t in plan["tandas"] if t["estado"] == "pendiente"), None)
        cuerpo = [f"{tanda['nombre']}: {enviados} correos enviados, {errores} con error.", ""]
        cuerpo += [f"  - {n} <{e}>" for _, n, e in validos]
        if descartados:
            cuerpo += ["", "No se enviaron:"] + [f"  - {q}: {m}" for q, m in descartados]
        cuerpo += ["", f"Siguiente: {siguiente['nombre']} (no antes del {siguiente['no_antes_de']}, 10:30)." if siguiente
                   else "Era la última tanda. He quitado la tarea programada.",
                   "", "Las respuestas llegan a tu buzón de Zoho. Quien diga que no quiere más correos:",
                   "  venv\\Scripts\\python.exe main.py optout <email>",
                   "Para parar el resto: crea el fichero prospect-system\\data\\PAUSAR_ENVIOS."]
        avisar(f"Cita-Lista · {tanda['nombre']} enviada ({enviados} correos)", "\n".join(cuerpo))
        if not siguiente:
            quitar_tarea()
        return 0 if errores == 0 else 1
    except Exception as exc:
        log(f"ERROR inesperado: {exc!r}")
        avisar("Cita-Lista · error en el envío programado", f"Algo falló y paré: {exc!r}\nMira prospect-system/logs/envios.log.", "error")
        return 1
    finally:
        if not SIMULACRO and BLOQUEO.exists():
            BLOQUEO.unlink()


if __name__ == "__main__":
    sys.exit(main())
