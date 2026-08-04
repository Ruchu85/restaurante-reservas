"use client";

import { useEffect } from "react";

/**
 * Motor de animaciones de la web pública.
 *
 * Un único observador para toda la página en vez de un componente por
 * elemento: menos JavaScript en el navegador y ningún re-render de React al
 * hacer scroll. Los elementos se marcan con `data-reveal` en el HTML y el CSS
 * hace la animación; aquí solo se les añade la clase cuando entran en pantalla.
 *
 * Si el visitante ha pedido menos movimiento en su sistema, no se activa nada:
 * el CSS ya deja todo visible y esto sale sin tocar el DOM.
 */
export function Motion() {
  useEffect(() => {
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sinMovimiento) return;

    // ── Aparición al entrar en pantalla ──────────────────────────────
    const elementos = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          const retardo = Number(el.dataset.revealDelay ?? 0);
          setTimeout(() => el.classList.add("is-visible"), retardo);
          observador.unobserve(el); // una sola vez: no queremos parpadeos al volver
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    elementos.forEach((el) => observador.observe(el));

    // ── Cabecera y barra de progreso ─────────────────────────────────
    const cabecera = document.querySelector<HTMLElement>("[data-header]");
    const progreso = document.querySelector<HTMLElement>("[data-progress]");
    const capas = document.querySelectorAll<HTMLElement>("[data-parallax]");

    let pendiente = false;
    const alScroll = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;

        cabecera?.classList.toggle("is-solid", y > 80);

        if (progreso) {
          const alto = document.documentElement.scrollHeight - window.innerHeight;
          progreso.style.transform = `scaleX(${alto > 0 ? y / alto : 0})`;
        }

        // Parallax solo sobre lo que está en pantalla: mover elementos fuera
        // de vista cuesta lo mismo y no se ve.
        for (const capa of capas) {
          const caja = capa.getBoundingClientRect();
          if (caja.bottom < 0 || caja.top > window.innerHeight) continue;
          const factor = Number(capa.dataset.parallax ?? 0.15);
          const centro = caja.top + caja.height / 2 - window.innerHeight / 2;
          capa.style.transform = `translate3d(0, ${(-centro * factor).toFixed(1)}px, 0)`;
        }

        pendiente = false;
      });
    };

    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll, { passive: true });

    return () => {
      observador.disconnect();
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
    };
  }, []);

  return null;
}
