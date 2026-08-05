/**
 * setup-whatsapp-templates.mjs — Crea en Meta las dos plantillas de WhatsApp
 * que usa `src/lib/whatsapp.ts`.
 *
 * Se ejecuta UNA VEZ por cuenta de WhatsApp Business (WABA), no en cada
 * despliegue: las plantillas viven en la cuenta de Meta, no en este repo.
 * Categoría "UTILITY" porque son mensajes transaccionales (confirmación de
 * una acción que el propio cliente inició en la web), no marketing — eso
 * además tiene mejor precio y una revisión más rápida.
 *
 * Uso:
 *   META_WABA_ID=... META_WHATSAPP_TOKEN=... node scripts/setup-whatsapp-templates.mjs
 */
const WABA_ID = process.env.META_WABA_ID;
const TOKEN = process.env.META_WHATSAPP_TOKEN;

if (!WABA_ID || !TOKEN) {
  console.error("Faltan META_WABA_ID y/o META_WHATSAPP_TOKEN en el entorno.");
  process.exit(1);
}

const TEMPLATES = [
  {
    name: "reservation_confirmation",
    language: "es",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Hola {{1}}, tu reserva en *{{2}}* está confirmada.\n\n" +
          "📅 {{3}}\n🕒 {{4}} · {{5}} personas\n\nVer o cancelar: {{6}}",
        example: {
          body_text: [
            [
              "Pablo",
              "Restaurante Demo",
              "miércoles, 5 de agosto",
              "20:00",
              "2",
              "https://reservas-restaurante-demo.vercel.app/reservar/abc123",
            ],
          ],
        },
      },
    ],
  },
  {
    name: "reservation_cancellation",
    language: "es",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Hola {{1}}, hemos cancelado tu reserva en *{{2}}* del {{3}} a las {{4}}.\n\n" +
          "Puedes hacer una nueva cuando quieras: {{5}}",
        example: {
          body_text: [
            [
              "Pablo",
              "Restaurante Demo",
              "miércoles, 5 de agosto",
              "20:00",
              "https://reservas-restaurante-demo.vercel.app/reservar",
            ],
          ],
        },
      },
    ],
  },
];

for (const template of TEMPLATES) {
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${WABA_ID}/message_templates`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(template),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    console.error(`✗ ${template.name}:`, JSON.stringify(data));
  } else {
    console.log(`✓ ${template.name} enviada a revisión — id ${data.id}, estado ${data.status}`);
  }
}

console.log(
  "\nRevisa el estado en Meta Business Manager → WhatsApp Manager → Message Templates.\n" +
    "Las plantillas UTILITY sencillas suelen aprobarse en minutos.",
);
