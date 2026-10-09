/**
 * Esqueleto de carga del panel.
 *
 * Sin este archivo, Next se queda en la pantalla anterior hasta que el
 * servidor termina de responder: al pulsar "Reservas" no pasaba nada durante
 * medio segundo y parecía que el clic no había entrado. Con él, la respuesta
 * es inmediata y el contenido entra cuando llega.
 *
 * Además habilita la precarga: para una ruta dinámica, el router de Next solo
 * precarga hasta el primer límite de carga, así que sin `loading.tsx` no había
 * nada que precargar al pasar el ratón por encima del menú.
 */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="h-8 w-48 rounded-lg bg-stone-200" />
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-stone-100" />
        ))}
      </div>
      <div className="mt-5 space-y-2 rounded-2xl bg-panel p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="h-9 w-12 flex-shrink-0 rounded-lg bg-stone-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-40 rounded bg-stone-100" />
              <div className="h-3 w-24 rounded bg-stone-100" />
            </div>
            <div className="h-6 w-20 flex-shrink-0 rounded-full bg-stone-100" />
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
