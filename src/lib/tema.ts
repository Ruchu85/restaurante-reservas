/**
 * Tema del panel de gestión.
 *
 * Este módulo lo importan tanto el layout (servidor) como el interruptor
 * (cliente), así que NO puede tocar `next/headers`: bastaba con importarlo
 * desde el componente cliente para que Next arrastrara código de servidor al
 * bundle y la ruta entera devolviera un 500. La lectura de la cookie se hace
 * en el layout, que ya es un componente de servidor.
 *
 * Va en cookie y no en localStorage a propósito: así el layout puede pintar la
 * clase del tema en el primer HTML. Con localStorage habría que esperar a la
 * hidratación y la pantalla daría un fogonazo blanco en cada carga.
 */
export const TEMA_COOKIE = "panel_tema";

export type Tema = "claro" | "oscuro";

/**
 * Sin cookie, oscuro. Se fija aquí y no se mira `prefers-color-scheme` a
 * propósito: por este panel entra gente desde el enlace de demo, y el aspecto
 * con el que lo ven no debería depender de cómo tenga cada uno configurado su
 * sistema. Quien prefiera claro lo cambia con el botón y se le recuerda.
 */
export function temaDesdeCookie(valor: string | undefined): Tema {
  return valor === "claro" ? "claro" : "oscuro";
}
