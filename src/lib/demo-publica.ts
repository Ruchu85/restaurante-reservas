/**
 * Este mismo código sirve dos cosas distintas: el restaurante de demostración
 * que se enseña en la captación (`restaurante-demo`, un local ficticio) y, en
 * el futuro, el de un cliente real.
 *
 * La diferencia importa para los buscadores. El restaurante ficticio NO debe
 * indexarse: mientras lo estuvo, quien buscaba la marca «Cita-Lista» en Google
 * encontraba «Restaurante Los Angeles», un local que no existe, en lugar de la
 * página de producto. Un cliente real, en cambio, quiere justo lo contrario.
 */
export function esDemoPublica(): boolean {
  return (process.env.NEXT_PUBLIC_RESTAURANT_SLUG || "") === "restaurante-demo";
}
