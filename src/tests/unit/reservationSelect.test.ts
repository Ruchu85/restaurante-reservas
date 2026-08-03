import { describe, it, expect } from "vitest";
import {
  RESERVATION_SELECT,
  RESERVATION_WITH_TABLE_SELECT,
  PUBLIC_RESERVATION_SELECT,
} from "@/lib/reservations";

/**
 * Desde que existe `reservation_tables` (mesas juntadas) hay dos caminos entre
 * `reservations` y `restaurant_tables`:
 *
 *   1. reservations.table_id → restaurant_tables.id
 *   2. reservations → reservation_tables → restaurant_tables
 *
 * Si el embed no dice cuál usar, PostgREST responde PGRST201 y se cae TODA
 * lectura de reservas: el panel, la página pública y la creación de reservas.
 * Pasó en producción y el error que veía el cliente era solo
 * "Error al crear la reserva.".
 *
 * Estos tests son baratos y evitan que alguien "simplifique" el select
 * quitando la FK explícita.
 */

const SELECTS = {
  RESERVATION_SELECT,
  RESERVATION_WITH_TABLE_SELECT,
  PUBLIC_RESERVATION_SELECT,
};

describe("selects de reservas — desambiguación de PostgREST", () => {
  for (const [name, select] of Object.entries(SELECTS)) {
    it(`${name} indica la FK al incrustar la mesa`, () => {
      expect(select).toContain("restaurant_tables!reservations_table_id_fkey");
    });

    it(`${name} no deja ningún embed ambiguo de restaurant_tables`, () => {
      // Cualquier "restaurant_tables(" sin el "!fk" delante sería ambiguo.
      const ambiguo = /restaurant_tables\(/.test(
        select.replace(/restaurant_tables!reservations_table_id_fkey\(/g, ""),
      );
      expect(ambiguo).toBe(false);
    });
  }

  it("el select público no expone las notas internas del equipo", () => {
    expect(PUBLIC_RESERVATION_SELECT).not.toContain("internal_notes");
    expect(PUBLIC_RESERVATION_SELECT).not.toContain("*");
  });
});
