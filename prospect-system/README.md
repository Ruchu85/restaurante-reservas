# Prospect System

Sistema modular de prospección B2B para identificar restaurantes en España y automatizar el contacto comercial por email y WhatsApp.

**Siempre comienza en modo dry-run.** Ningún email se envía sin configuración explícita.

---

## Instalación

```bash
cd prospect-system
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Copia `.env.example` a `.env` y rellena tus claves:

```bash
cp .env.example .env
```

---

## Configuración mínima

Para prospección básica, solo necesitas:

```env
GOOGLE_PLACES_API_KEY=tu_clave_aqui
SENDER_NAME=Tu Nombre
SENDER_EMAIL=tu@email.com
```

Consigue la clave en [Google Cloud Console](https://console.cloud.google.com) activando la **Places API**.

---

## Uso

### Pipeline completo (recomendado)

```bash
# Busca, enriquece, puntúa y genera borradores para Madrid
python main.py pipeline "Madrid"

# Con score mínimo personalizado
python main.py pipeline "Sevilla" --min-score 60
```

### Pasos individuales

```bash
# 1. Buscar restaurantes en una ciudad, provincia o comunidad
python main.py prospect "Barcelona"
python main.py prospect "Andalucía"
python main.py prospect "León" --query "bar de tapas"

# 2. Enriquecer leads: analizar webs, buscar emails
python main.py enrich --limit 100

# 3. Calcular scores
python main.py score

# 4. Generar borradores de email
python main.py emails generate --min-score 50

# 5. Revisar y aprobar borradores (interactivo)
python main.py emails review

# 6. Ver emails que se enviarían (dry-run)
python main.py emails send

# 7. Enviar emails reales (requiere DRY_RUN=false en .env)
python main.py emails send --force
```

### Utilidades

```bash
# Ver estadísticas
python main.py stats

# Exportar a CSV
python main.py export
python main.py export --output data/madrid_leads.csv --min-score 60

# Marcar opt-out
python main.py optout --email contacto@restaurante.com
```

---

## Outreach por WhatsApp

En restauración el teléfono funciona mucho mejor que el email: los locales
publican su móvil y responden por WhatsApp. Este flujo genera los mensajes,
los agrupa **por provincia** y deja una página HTML lista para enviarlos a mano.

```bash
# 0. Ver cobertura de teléfonos por provincia
run.bat whatsapp provinces

# 1. Generar borradores (SOLO móviles: los fijos no tienen WhatsApp)
run.bat whatsapp generate --min-score 50
run.bat whatsapp generate --province "Madrid"

# 2. Revisar y aprobar uno a uno
run.bat whatsapp review

# 3. Exportar la página HTML agrupada por provincia
run.bat whatsapp export
run.bat whatsapp export --province "A Coruña"

# 4. Enviar desde el HTML y sincronizar el estado
run.bat whatsapp mark-sent --ids "id1,id2,id3"

# Utilidades
run.bat whatsapp stats
run.bat whatsapp discard-landlines
```

### Cómo se descartan los números sin WhatsApp

En España **solo los móviles (prefijos 6xx y 7xx) pueden registrar una cuenta de
WhatsApp**; los fijos (8xx/9xx) no. Por eso `whatsapp generate` filtra por prefijo
y no crea mensajes para fijos.

No existe ninguna API pública y legítima que confirme si un número concreto está
dado de alta en WhatsApp —las que lo prometen violan los términos de servicio de
Meta y acaban con la cuenta bloqueada—, así que el prefijo es el filtro más
fiable sin enviar mensajes a ciegas. Si aun así quieres incluir fijos (por
ejemplo para llamar), usa `--include-landlines`.

`whatsapp provinces` muestra exactamente cuántos leads de cada provincia son
contactables:

```
Provincia        Leads   Móvil (WhatsApp)   Solo fijo   Sin teléfono
Madrid             128                 74          49              5
Barcelona           96                 51          40              5
...
```

### La página HTML

`whatsapp export` genera `data/whatsapp_por_provincias.html`:

- **Navegación fija** con todas las provincias y su número de mensajes.
- **Una sección por provincia**, ordenada por ciudad y nombre.
- Botón **«Abrir en WhatsApp»** por fila: abre WhatsApp Web o el móvil con el
  mensaje ya escrito; solo hay que pulsar Enviar.
- **Marca de enviado** persistente en el navegador (`localStorage`), con
  contador por provincia y progreso global.
- Botón **«Copiar IDs enviados»** para pegarlos en `whatsapp mark-sent` y dejar
  la base de datos sincronizada.

Ritmo recomendado: **20–30 mensajes por sesión** para que WhatsApp no limite la
cuenta. Mejor franja para restaurantes: **martes a jueves de 10:00 a 12:00**,
fuera del servicio.

---

## Flujo de datos

```
Google Places API
      ↓
  [prospect]        → Busca y guarda leads con status=new
      ↓
  [enrich]          → Analiza webs, detecta booking platform, busca emails → status=enriched
      ↓
  [score]           → Calcula score 0-100 con explicación → status=scored
      ↓
  [emails generate] → Genera borradores personalizados → status=email_draft
      ↓
  [emails review]   → Revisión manual → status=email_approved
      ↓
  [emails send]     → Envío controlado (dry-run por defecto) → status=email_sent
```

---

## Sistema de scoring

| Factor | Puntos |
|--------|--------|
| Buena valoración sin reservas online | +15 |
| Muchas reseñas (negocio activo) | +10 |
| Sin sistema de reservas online | +20 |
| Usa WhatsApp para citas | +20 |
| Sin página web | +15 |
| Instagram activo sin reservas | +10 |
| Email disponible | +5 |
| Negocio local independiente | +10 |
| Ya usa plataforma avanzada (Booksy/Treatwell) | -30 |
| Cadena o franquicia | -35 |
| Negocio grande | -20 |
| Sin email encontrado | -10 |
| Datos incompletos | -5 |

---

## Envío de emails

El sistema incluye protecciones contra envío accidental:

1. `DRY_RUN=true` está hardcodeado como valor por defecto.
2. `emails send` sin `--force` siempre opera en dry-run.
3. Para envío real: establece `DRY_RUN=false` en `.env` Y usa `--force`.
4. Límite diario configurable (`DAILY_EMAIL_LIMIT`).
5. Mecanismo de opt-out integrado.

---

## Cumplimiento legal

Este sistema está diseñado para B2B en España. Consideraciones:

- **RGPD**: Solo se procesan datos públicos de negocios (no datos personales de consumidores).
- **LSSI-CE**: El envío a empresas y autónomos de emails comerciales es legal si: (1) los datos son públicos, (2) el email es profesional del negocio, (3) se incluye mecanismo de baja.
- **Opt-out**: El template incluye siempre instrucciones de baja. Usa `python main.py optout` para registrarlas.
- **Fuentes**: Todos los datos provienen de Google Places API (oficial) y páginas web públicas de los negocios.
- **Rate limiting**: El sistema incluye pausas entre requests para no sobrecargar APIs.

> **Recomendación**: Consulta con un asesor legal antes de lanzar campañas a escala. Este sistema es una herramienta técnica, no asesoramiento jurídico.

---

## Escalado

Para escalar a nivel nacional:
1. Ejecuta `pipeline` por cada provincia (50 provincias = ~3.000–6.000 leads esperados).
2. Usa PostgreSQL en lugar de SQLite (`DATABASE_URL=postgresql+psycopg2://...`).
3. Añade un scheduler (cron / GitHub Actions) para ejecutar por lotes nocturnos.
4. Integra más fuentes: Páginas Amarillas scraping (revisa ToS), Yelp API, etc.

---

## Tests

```bash
pytest tests/ -v
```
