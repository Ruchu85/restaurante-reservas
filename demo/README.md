# Demo / Material comercial

Genera el material de marketing (capturas reales de la app + landing + PDF)
que se enlaza en los emails de prospección.

**Landing pública:** https://landing-gold-kappa-38.vercel.app
**PDF dossier:** https://landing-gold-kappa-38.vercel.app/gesticitas-demo.pdf

Todo el material usa el salón **"Peluquería Aurora"** (datos ficticios),
aislado en el slug `salon-demo`. No toca el salón real de producción.

## Flujo para regenerar

```bash
# 1. Poblar datos demo + crear usuario demo (idempotente)
node demo/seed-demo.mjs

# 2. Levantar la app apuntando al salón demo
NEXT_PUBLIC_SALON_SLUG=salon-demo pnpm dev

# 3. (en otra terminal) Capturar pantallas reales con Playwright
npx playwright test --config=demo/playwright.demo.ts

# 4. Generar el PDF a partir de la landing
node demo/make-pdf.mjs

# 5. Desplegar la landing a Vercel
cd demo/landing && npx vercel deploy --prod --yes
```

## Credenciales del usuario demo

- Email: `demo@salondemo.es`
- Password: `DemoSalon2026!`
- Rol: admin del salón demo

## Archivos

| Archivo | Qué hace |
|---------|----------|
| `seed-demo.mjs` | Puebla salón demo (servicios, clientes, 48 citas, horarios) y crea el usuario demo |
| `playwright.demo.ts` | Config de Playwright dedicada a capturas (no interfiere con los e2e) |
| `capture.spec.ts` | Login (inyección de sesión) + capturas de las pantallas clave |
| `make-pdf.mjs` | Renderiza la landing a PDF con Chromium |
| `landing/index.html` | Landing comercial autocontenida (HTML+CSS) |
| `landing/screenshots/` | Capturas reales de la app |

> Nota: para que el sidebar muestre "Peluquería Aurora" en las capturas, se
> edita temporalmente el nombre en `DashboardNav.tsx` y se revierte después.
