"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, TableProperties, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { createTable, updateTable, deleteTable, toggleTableActive } from "@/actions/tables";
import type { RestaurantTable, TableSection } from "@/types";

const SECTION_LABELS: Record<TableSection, string> = {
  interior: "Interior",
  terraza: "Terraza",
  barra: "Barra",
  privado: "Privado",
  sala_vip: "Sala VIP",
};

const SECTION_COLORS: Record<TableSection, string> = {
  interior: "bg-blue-50 text-blue-700 border-blue-200",
  terraza: "bg-green-50 text-green-700 border-green-200",
  barra: "bg-amber-50 text-amber-700 border-amber-200",
  privado: "bg-purple-50 text-purple-700 border-purple-200",
  sala_vip: "bg-rose-50 text-rose-700 border-rose-200",
};

interface TableFormValues {
  name: string;
  capacity: number;
  min_capacity: number;
  section: TableSection;
}

const DEFAULT_FORM: TableFormValues = {
  name: "",
  capacity: 4,
  min_capacity: 1,
  section: "interior",
};

export function MesasClient({ tables: initialTables }: { tables: RestaurantTable[] }) {
  const router = useRouter();
  const [tables, setTables] = useState<RestaurantTable[]>(initialTables);
  const [editTarget, setEditTarget] = useState<RestaurantTable | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TableFormValues>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const sections = Object.keys(SECTION_LABELS) as TableSection[];
  const groupedBySection = sections.map((s) => ({
    section: s,
    tables: tables.filter((t) => t.section === s),
  })).filter((g) => g.tables.length > 0);

  function openNew() {
    setEditTarget(null);
    setForm(DEFAULT_FORM);
    setShowForm(true);
  }

  function openEdit(t: RestaurantTable) {
    setEditTarget(t);
    setForm({ name: t.name, capacity: t.capacity, min_capacity: t.min_capacity, section: t.section });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Introduce un nombre para la mesa"); return; }
    setSaving(true);
    try {
      if (editTarget) {
        const res = await updateTable(editTarget.id, form);
        if (res.error) { toast.error(res.error); return; }
        toast.success("Mesa actualizada");
      } else {
        const res = await createTable(form);
        if (res.error) { toast.error(res.error); return; }
        toast.success("Mesa creada");
      }
      router.refresh();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta mesa? Las reservas existentes no se borrarán.")) return;
    const res = await deleteTable(id);
    if (res.error) { toast.error(res.error); return; }
    toast.success("Mesa eliminada");
    setTables((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleToggleActive(t: RestaurantTable) {
    const res = await toggleTableActive(t.id, !t.active);
    if (res.error) { toast.error(res.error); return; }
    setTables((prev) => prev.map((x) => x.id === t.id ? { ...x, active: !x.active } : x));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-800">Mesas</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Añadir mesa
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total mesas", value: tables.length },
          { label: "Activas", value: tables.filter(t => t.active).length },
          { label: "Capacidad total", value: tables.filter(t => t.active).reduce((s, t) => s + t.capacity, 0) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-stone-800">{value}</div>
            <div className="text-xs text-stone-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tables by section */}
      {tables.length === 0 ? (
        <div className="rounded-2xl bg-white border border-stone-100 p-12 text-center shadow-sm">
          <TableProperties className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-400">Aún no hay mesas configuradas</p>
          <button onClick={openNew} className="mt-3 text-sm text-amber-600 hover:text-amber-700">
            Añadir la primera mesa
          </button>
        </div>
      ) : (
        groupedBySection.map(({ section, tables: sectionTables }) => (
          <div key={section} className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-50 flex items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium border", SECTION_COLORS[section])}>
                {SECTION_LABELS[section]}
              </span>
              <span className="text-xs text-stone-400">{sectionTables.length} mesas</span>
            </div>
            <div className="divide-y divide-stone-50">
              {sectionTables.map((t) => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-semibold", !t.active && "line-through text-stone-400")}>
                      {t.name}
                    </div>
                    <div className="text-xs text-stone-400">
                      {t.capacity} personas máx. · mín. {t.min_capacity}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleActive(t)}
                    className={cn(
                      "text-xs rounded-full px-2.5 py-1 font-medium transition-colors",
                      t.active
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-stone-100 text-stone-500 hover:bg-stone-200",
                    )}
                  >
                    {t.active ? "Activa" : "Inactiva"}
                  </button>
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Form dialog */}
      <DialogPrimitive.Root open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <DialogPrimitive.Title className="text-lg font-bold text-stone-800">
                {editTarget ? "Editar mesa" : "Nueva mesa"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close className="p-1 rounded-lg hover:bg-stone-100">
                <X className="h-4 w-4 text-stone-500" />
              </DialogPrimitive.Close>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Mesa 1, Terraza A…"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Capacidad máx.</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: parseInt(e.target.value) || 1 }))}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Capacidad mín.</label>
                  <input
                    type="number"
                    min={1}
                    max={form.capacity}
                    value={form.min_capacity}
                    onChange={(e) => setForm((f) => ({ ...f, min_capacity: parseInt(e.target.value) || 1 }))}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Zona</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(SECTION_LABELS) as TableSection[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, section: s }))}
                      className={cn(
                        "rounded-lg py-2 text-xs font-medium border transition-colors",
                        form.section === s
                          ? "bg-amber-600 text-white border-amber-600"
                          : "bg-stone-50 text-stone-600 border-stone-200 hover:border-amber-300",
                      )}
                    >
                      {SECTION_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <DialogPrimitive.Close asChild>
                  <button className="flex-1 rounded-lg border border-stone-200 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
                    Cancelar
                  </button>
                </DialogPrimitive.Close>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Guardando…" : editTarget ? "Guardar" : "Crear mesa"}
                </button>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
