import { ImageResponse } from "next/og";

/** Icono para «Añadir a pantalla de inicio» en iOS. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 116,
          fontWeight: 700,
        }}
      >
        R
      </div>
    ),
    size,
  );
}
