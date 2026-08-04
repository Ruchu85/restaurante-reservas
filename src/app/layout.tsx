import type { Metadata, Viewport } from "next";
import { Geist, Fraunces } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Sin fuente mono propia: solo se usa para el código de reserva y en una
// columna del panel, y cargarla en el layout raíz metía 23 KB en la ruta
// crítica de la portada, donde no se usa. La mono del sistema sirve igual.

/**
 * Serif de display para los titulares de la web pública. Una sola sans para
 * todo hacía que el sitio pareciera un panel de control, no un restaurante.
 * `opsz` es un eje variable: a tamaños grandes afina los remates.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  // Fuente variable: el rango completo de grosor en un solo archivo. Los ejes
  // se pueden pedir solo si no se fija `weight`.
  // Solo `opsz`: pedir SOFT y WONK sumaba unos 60 KB de ejes que ningún
  // estilo de esta web usa.
  axes: ["opsz"],
});

export const metadata: Metadata = {
  // Sin esto las URLs relativas de canonical y Open Graph no se resuelven y
  // Next avisa en el build.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "Restaurante Demo — Reservas Online",
  description: "Reserva tu mesa en Restaurante Demo. Cocina mediterránea de autor en Madrid.",
};

/**
 * El hero es oscuro: sin `themeColor`, en Android la barra del navegador sale
 * blanca y corta la pantalla en dos. Va en `viewport`, no en `metadata`:
 * Next 15 ya no lo acepta ahí.
 */
export const viewport: Viewport = {
  themeColor: "#1c1917",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Las variables de next/font van en <html>, no en <body>: el tema de
  // Tailwind y `--tipo-display` se declaran en :root y las sustituyen ahí.
  // Declaradas en <body> resultaban inválidas al resolverse en :root y la web
  // entera se quedaba con la fuente del sistema.
  return (
    <html lang="es" className={`${geistSans.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
