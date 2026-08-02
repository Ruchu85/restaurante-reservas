import { describe, it, expect } from "vitest";
import {
  madridDayRangeUtc,
  madridRangeUtc,
  localDateTimeToUtc,
  timezoneOffsetMinutes,
  toLocalDate,
  dayOfWeek,
  addDays,
} from "@/lib/dates";

describe("timezoneOffsetMinutes", () => {
  it("devuelve +120 en horario de verano (CEST)", () => {
    expect(timezoneOffsetMinutes(new Date("2026-08-02T12:00:00Z"))).toBe(120);
  });

  it("devuelve +60 en horario de invierno (CET)", () => {
    expect(timezoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"))).toBe(60);
  });
});

describe("localDateTimeToUtc", () => {
  it("convierte una hora local de verano a UTC", () => {
    expect(localDateTimeToUtc("2026-08-02", "20:30").toISOString()).toBe(
      "2026-08-02T18:30:00.000Z",
    );
  });

  it("convierte una hora local de invierno a UTC", () => {
    expect(localDateTimeToUtc("2026-01-15", "20:30").toISOString()).toBe(
      "2026-01-15T19:30:00.000Z",
    );
  });

  it("es correcto la noche del cambio de hora de primavera", () => {
    // 2026-03-29: a las 02:00 CET los relojes saltan a las 03:00 CEST.
    // 01:30 aún es CET (+1) → 00:30 UTC.
    expect(localDateTimeToUtc("2026-03-29", "01:30").toISOString()).toBe(
      "2026-03-29T00:30:00.000Z",
    );
    // 04:00 ya es CEST (+2) → 02:00 UTC.
    expect(localDateTimeToUtc("2026-03-29", "04:00").toISOString()).toBe(
      "2026-03-29T02:00:00.000Z",
    );
  });

  it("es correcto la noche del cambio de hora de otoño", () => {
    expect(localDateTimeToUtc("2026-10-25", "23:00").toISOString()).toBe(
      "2026-10-25T22:00:00.000Z",
    );
  });
});

describe("madridDayRangeUtc", () => {
  it("cubre el día natural de Madrid, no el día UTC", () => {
    // Este es el bug que causaba dobles reservas: la ventana correcta de un día
    // de verano empieza a las 22:00 UTC del día anterior.
    expect(madridDayRangeUtc("2026-08-02")).toEqual({
      from: "2026-08-01T22:00:00.000Z",
      to: "2026-08-02T22:00:00.000Z",
    });
  });

  it("se ajusta al horario de invierno", () => {
    expect(madridDayRangeUtc("2026-01-15")).toEqual({
      from: "2026-01-14T23:00:00.000Z",
      to: "2026-01-15T23:00:00.000Z",
    });
  });

  it("incluye una reserva de madrugada en su día local", () => {
    const { from, to } = madridDayRangeUtc("2026-08-02");
    // 00:30 del 2 de agosto en Madrid = 22:30 UTC del día 1.
    const madrugada = "2026-08-01T22:30:00.000Z";
    expect(madrugada >= from && madrugada < to).toBe(true);
  });

  it("excluye una reserva que ya pertenece al día siguiente", () => {
    const { to } = madridDayRangeUtc("2026-08-02");
    // 00:30 del 3 de agosto en Madrid = 22:30 UTC del día 2.
    expect("2026-08-02T22:30:00.000Z" >= to).toBe(true);
  });

  it("el día del cambio de hora de otoño dura 25 horas", () => {
    const { from, to } = madridDayRangeUtc("2026-10-25");
    const hours = (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
    expect(hours).toBe(25);
  });
});

describe("madridRangeUtc", () => {
  it("cubre un rango inclusivo de días naturales", () => {
    expect(madridRangeUtc("2026-08-01", "2026-08-03")).toEqual({
      from: "2026-07-31T22:00:00.000Z",
      to: "2026-08-03T22:00:00.000Z",
    });
  });
});

describe("toLocalDate", () => {
  it("asigna una reserva de madrugada al día local correcto", () => {
    expect(toLocalDate(new Date("2026-08-01T22:30:00.000Z"))).toBe("2026-08-02");
  });
});

describe("dayOfWeek", () => {
  it("no depende de la zona horaria del servidor", () => {
    expect(dayOfWeek("2026-08-02")).toBe(0); // domingo
    expect(dayOfWeek("2026-08-03")).toBe(1); // lunes
  });
});

describe("addDays", () => {
  it("cruza fin de mes correctamente", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
