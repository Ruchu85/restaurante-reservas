import { ImageResponse } from "next/og";

/**
 * Favicon generado en el build a partir de la inicial del restaurante. Así no
 * hay que mantener un .ico por cliente: cada restaurante que despliegue esta
 * plantilla obtiene el suyo. Antes la pestaña salía con el icono genérico.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const inicial = (process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? "R").trim().charAt(0).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c1917",
          color: "#f59e0b",
          fontSize: 22,
          fontWeight: 700,
          borderRadius: 6,
        }}
      >
        {inicial}
      </div>
    ),
    size,
  );
}
