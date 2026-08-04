import { ImageResponse } from "next/og";
import { getRestaurant } from "@/lib/restaurant";
import { pexels, IMAGES } from "@/lib/landingContent";

/**
 * Tarjeta que se ve al compartir el enlace por WhatsApp o redes.
 *
 * Se sirve desde el propio dominio en vez de enlazar la foto de Pexels: los
 * rastreadores de las redes fallan a menudo con dominios de terceros, y así
 * la previsualización lleva el nombre del restaurante encima de la foto.
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
          background: "#1c1917",
          position: "relative",
        }}
      >

        <img
          src={pexels(IMAGES.historia, 1200, 630)}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, objectFit: "cover", opacity: 0.55 }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: "0 72px 72px",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#fbbf24",
              fontSize: 26,
              letterSpacing: 4,
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Reserva tu mesa
          </div>
          <div style={{ display: "flex", color: "#fff", fontSize: 82, fontWeight: 700 }}>
            {nombre}
          </div>
          <div style={{ display: "flex", color: "#d6d3d1", fontSize: 32, marginTop: 14 }}>
            {descripcion}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
