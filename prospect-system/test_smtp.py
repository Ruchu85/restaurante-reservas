"""Test de envío SMTP con email realista."""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv
import os

load_dotenv()

TO = "pablofg1985@gmail.com"

smtp_host = os.getenv("SMTP_HOST")
smtp_port = int(os.getenv("SMTP_PORT", 587))
smtp_user = os.getenv("SMTP_USER")
smtp_pass = os.getenv("SMTP_PASSWORD")
sender_email = os.getenv("SENDER_EMAIL")

print(f"Enviando desde: {sender_email}")
print(f"SMTP: {smtp_host}:{smtp_port}")
print(f"Para: {TO}")

SUBJECT = "Gestiona tu agenda sin papeles ni llamadas"

TEXT = """Hola,

Te escribo porque llevo un tiempo desarrollando una herramienta para que los salones de peluqueria puedan gestionar sus citas de forma sencilla, sin depender de papel ni de llamadas al telefono.

La app permite ver la agenda del dia de un vistazo, crear y modificar citas en segundos, y evitar solapamientos entre profesionales. Todo desde el movil.

Si te interesa echarle un vistazo sin compromiso, me encantaria mostrartela en una llamada rapida de 15 minutos.

Un saludo,
Pablo
GestiCitas
"""

HTML = """<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; font-size: 15px; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Hola,</p>
  <p>Te escribo porque llevo un tiempo desarrollando una herramienta para que los salones de peluqueria puedan gestionar sus citas de forma sencilla, sin depender de papel ni de llamadas al telefono.</p>
  <p>La app permite:</p>
  <ul>
    <li>Ver la agenda del dia de un vistazo</li>
    <li>Crear y modificar citas en segundos</li>
    <li>Evitar solapamientos entre profesionales</li>
    <li>Todo desde el movil</li>
  </ul>
  <p>Si te interesa echarle un vistazo sin compromiso, me encantaria mostrartela en una llamada rapida de 15 minutos.</p>
  <p>Un saludo,<br>
  <strong>Pablo</strong><br>
  GestiCitas</p>
</body>
</html>"""

msg = MIMEMultipart("alternative")
msg["Subject"] = SUBJECT
msg["From"] = f"Pablo de GestiCitas <{sender_email}>"
msg["To"] = TO
msg["Reply-To"] = sender_email

msg.attach(MIMEText(TEXT, "plain", "utf-8"))
msg.attach(MIMEText(HTML, "html", "utf-8"))

try:
    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(sender_email, TO, msg.as_string())
    print("OK - Email enviado correctamente")
except Exception as e:
    print(f"ERROR: {e}")
