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
  A 1200×630 el PNG que genera ImageResponse pesaba 1,1 MB y WhatsApp y varios
  rastreadores descartan las previsualizaciones grandes. Se genera a la mitad
  de tamaño —las redes reescalan— y sin foto de fondo: el degradado sobre el
  tono de la casa pesa una fracción y se lee mejor en miniatura.
*/
export const size = { width: 600, height: 315 };
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
            padding: "0 44px 40px",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#fbbf24",
              fontSize: 15,
              letterSpacing: 3,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Reserva tu mesa
          </div>
          <div style={{ display: "flex", color: "#fff", fontSize: 48, fontWeight: 700 }}>
            {nombre}
          </div>
          <div style={{ display: "flex", color: "#e7e5e4", fontSize: 20, marginTop: 10 }}>
            {descripcion}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
