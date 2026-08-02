import { describe, it, expect } from "vitest";
import { normalizePhone, isSpanishMobile, formatPhone, whatsappLink } from "@/lib/phone";
import { guestSignals } from "@/lib/guestSignals";

describe("normalizePhone", () => {
  it("normaliza todas las variantes del mismo número a la misma clave", () => {
    const variants = [
      "600112233",
      "600 11 22 33",
      "+34600112233",
      "+34 600 11 22 33",
      "0034600112233",
      "34600112233",
      "(600) 11-22-33",
    ];
    const normalized = new Set(variants.map(normalizePhone));
    expect(normalized).toEqual(new Set(["+34600112233"]));
  });

  it("conserva números internacionales", () => {
    expect(normalizePhone("+33612345678")).toBe("+33612345678");
  });

  it("devuelve cadena vacía para entradas vacías", () => {
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone("   ")).toBe("");
  });
});

describe("isSpanishMobile", () => {
  it("acepta móviles 6xx y 7xx", () => {
    expect(isSpanishMobile("600112233")).toBe(true);
    expect(isSpanishMobile("+34712345678")).toBe(true);
  });

  it("rechaza fijos 8xx y 9xx", () => {
    expect(isSpanishMobile("910000000")).toBe(false);
    expect(isSpanishMobile("+34800123456")).toBe(false);
  });

  it("rechaza números incompletos", () => {
    expect(isSpanishMobile("60011")).toBe(false);
    expect(isSpanishMobile(null)).toBe(false);
  });
});

describe("whatsappLink", () => {
  it("genera un enlace wa.me con el mensaje codificado", () => {
    const link = whatsappLink("600112233", "Hola Ana, ¿confirmas?");
    expect(link).toBe("https://wa.me/34600112233?text=Hola%20Ana%2C%20%C2%BFconfirmas%3F");
  });

  it("no genera enlace para un fijo español (no tiene WhatsApp)", () => {
    expect(whatsappLink("912345678", "Hola")).toBeNull();
  });

  it("no genera enlace sin teléfono", () => {
    expect(whatsappLink(null, "Hola")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("formatea números españoles de forma legible", () => {
    expect(formatPhone("600112233")).toBe("+34 600 11 22 33");
  });
});

describe("guestSignals", () => {
  const base = { visits_count: 0, no_shows_count: 0, tags: [], allergies: null };

  it("no devuelve señales para un comensal nuevo", () => {
    expect(guestSignals(base)).toHaveLength(0);
  });

  it("marca al cliente habitual", () => {
    const signals = guestSignals({ ...base, visits_count: 5 });
    expect(signals.some((s) => s.label === "Cliente habitual" && s.tone === "positive")).toBe(true);
  });

  it("marca los no-shows repetidos como riesgo", () => {
    const signals = guestSignals({ ...base, no_shows_count: 3 });
    expect(signals.some((s) => s.tone === "danger")).toBe(true);
  });

  it("muestra las alergias como aviso", () => {
    const signals = guestSignals({ ...base, allergies: "Marisco" });
    expect(signals.some((s) => s.label.includes("Marisco") && s.tone === "warning")).toBe(true);
  });

  it("tolera un comensal inexistente", () => {
    expect(guestSignals(null)).toEqual([]);
  });
});
