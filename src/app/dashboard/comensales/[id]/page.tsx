import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getStaffSession } from "@/lib/auth";
import { getGuestWithHistory } from "@/actions/guests";
import { formatPhone } from "@/lib/phone";
import { formatTime } from "@/lib/utils";
import { toLocalDate } from "@/lib/dates";
import { GuestProfileForm } from "@/components/dashboard/GuestProfileForm";
import { WhatsAppButton } from "@/components/dashboard/WhatsAppButton";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Ficha de comensal" };

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmada",
  seated: "En mesa",
  completed: "Completada",
  no_show: "No llegó",
  cancelled: "Cancelada",
};

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const result = await getGuestWithHistory(id);
  if (!result) notFound();

  const { guest, reservations } = result;

  const stats = [
    { label: "Visitas", value: guest.visits_count },
    { label: "Comensales totales", value: guest.total_covers },
    { label: "No-shows", value: guest.no_shows_count },
    { label: "Cancelaciones", value: guest.cancellations_count },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/comensales"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Comensales
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{guest.name}</h1>
          <p className="text-sm text-stone-400">
            {formatPhone(guest.phone)}
            {guest.email && ` · ${guest.email}`}
          </p>
          {guest.last_visit_at && (
            <p className="mt-0.5 text-xs text-stone-400">
              Última visita: {toLocalDate(new Date(guest.last_visit_at), session.timezone)}
            </p>
          )}
        </div>
        <WhatsAppButton
          phone={guest.phone}
          guestName={guest.name}
          partySize={2}
          template="confirm"
          label="WhatsApp"
          timeZone={session.timezone}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value }) => (
          <div key={label} className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm">
            <div className="text-2xl font-bold text-stone-800">{value}</div>
            <div className="text-xs text-stone-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <GuestProfileForm guest={guest} />

      <div className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-50">
          <h2 className="font-semibold text-stone-800">Historial de reservas</h2>
        </div>
        {reservations.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-400">Sin reservas registradas.</p>
        ) : (
          <div className="divide-y divide-stone-50">
            {reservations.map((r) => (
              <Link
                key={r.id}
                href={`/dashboard/reservas?date=${toLocalDate(new Date(r.starts_at), session.timezone)}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-800">
                    {toLocalDate(new Date(r.starts_at), session.timezone)} · {formatTime(r.starts_at, session.timezone)}
                  </div>
                  <div className="text-xs text-stone-400">
                    {r.party_size} personas
                    {r.table && ` · ${r.table.name}`}
                    {r.notes && ` · ${r.notes}`}
                  </div>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === "no_show"
                      ? "bg-red-100 text-red-800"
                      : r.status === "cancelled"
                        ? "bg-stone-100 text-stone-400"
                        : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
