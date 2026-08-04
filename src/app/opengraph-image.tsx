import { ImageResponse } from "next/og";
import { getRestaurant } from "@/lib/restaurant";

/**
 * Tarjeta que se ve al compartir el enlace por WhatsApp o redes.
 *
 * Se sirve desde el propio dominio en vez de enlazar la foto de Pexels: los
 * rastreadores de las redes fallan a menudo con dominios de terceros, y así
 * la previsualización lleva el nombre del restaurante encima de la foto.
 */
/*
  1200×630 es lo que piden las redes. Lo que pesaba 1,1 MB no era el tamaño
  sino la fotografía de fondo: un degradado plano a resolución completa se
  queda en unas decenas de kilobytes y se ve nítido en pantallas retina.
*/
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Reserva tu mesa";

export default async function OpengraphImage() {
  const restaurant = await getRestaurant();
  const nombre = restaurant?.name ?? "Restaurante";
  const descripcion = restaurant?.description ?? "Cocina mediterránea de autor";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "linear-gradient(135deg, #1c1917 0%, #3b2a17 55%, #78350f 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: "0 88px 80px",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#fbbf24",
              fontSize: 28,
              letterSpacing: 6,
              textTransform: "uppercase",
              marginBottom: 24,
            }}
          >
            Reserva tu mesa
          </div>
          <div style={{ display: "flex", color: "#fff", fontSize: 92, fontWeight: 700 }}>
            {nombre}
          </div>
          <div style={{ display: "flex", color: "#e7e5e4", fontSize: 36, marginTop: 20 }}>
            {descripcion}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
