import { redirect } from "next/navigation";
import Link from "next/link";
import { getStaffSession } from "@/lib/auth";
import { listGuests } from "@/actions/guests";
import { formatPhone } from "@/lib/phone";
import { guestSignals } from "@/lib/guestSignals";
import { GuestSignalBadges } from "@/components/dashboard/GuestSignalBadges";
import { GuestSearch } from "@/components/dashboard/GuestSearch";
import { Users, ChevronRight } from "lucide-react";

export const metadata = { title: "Comensales" };

const PAGE_SIZE = 50;

/** Mantiene la búsqueda al paginar: sin esto, la página 2 perdía el filtro. */
function pageUrl(query: string | undefined, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("page", String(page));
  return `/dashboard/comensales?${params}`;
}

export default async function ComensalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const { q, page } = await searchParams;
  const currentPage = Math.max(parseInt(page ?? "1", 10) || 1, 1);

  const { guests, total } = await listGuests({
    search: q,
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Comensales</h1>
        <p className="text-sm text-stone-400">
          Ficha de cada cliente: visitas, alergias, notas de sala y no-shows.
        </p>
      </div>

      <GuestSearch defaultValue={q ?? ""} />

      {guests.length === 0 ? (
        <div className="rounded-2xl bg-white border border-stone-100 px-5 py-14 text-center shadow-sm">
          <Users className="h-8 w-8 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-400">
            {q ? "Ningún comensal coincide con la búsqueda." : "Aún no hay comensales registrados."}
          </p>
          {!q && (
            <p className="mt-1 text-xs text-stone-400">
              Las fichas se crean solas con cada reserva.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden divide-y divide-stone-50">
          {guests.map((guest) => (
            <Link
              key={guest.id}
              href={`/dashboard/comensales/${guest.id}`}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-800 truncate">{guest.name}</div>
                <div className="text-xs text-stone-400">{formatPhone(guest.phone)}</div>
                <GuestSignalBadges signals={guestSignals(guest)} className="mt-1" />
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-semibold text-stone-800">{guest.visits_count}</div>
                <div className="text-[10px] uppercase tracking-wide text-stone-400">visitas</div>
              </div>
              <ChevronRight className="h-4 w-4 text-stone-300 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-stone-400">
            Página {currentPage} de {totalPages} · {total} comensales
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={pageUrl(q, currentPage - 1)}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 hover:bg-stone-50"
              >
                Anterior
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={pageUrl(q, currentPage + 1)}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 hover:bg-stone-50"
              >
                Siguiente
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
