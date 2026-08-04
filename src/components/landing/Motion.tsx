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
 * Ojo con lo que se desactiva al pedir menos movimiento: solo las
 * *animaciones*. La cabecera sólida y el arranque de los vídeos son
 * comportamiento funcional y tienen que seguir ocurriendo — si no, el menú
 * queda en blanco sobre blanco.
 */
export function Motion() {
  useEffect(() => {
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const limpiezas: (() => void)[] = [];

    // ── Aparición al entrar en pantalla ──────────────────────────────
    if (!sinMovimiento) {
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
      document
        .querySelectorAll<HTMLElement>("[data-reveal], [data-lineas], [data-cortina]")
        .forEach((el) => observador.observe(el));
      limpiezas.push(() => observador.disconnect());
    }

    // ── Vídeos que solo se descargan al acercarse ────────────────────
    // `autoPlay` anula `preload="none"` en Chrome, y el atributo `poster` se
    // descarga siempre aunque el vídeo no. Por eso ambos se ponen desde aquí:
    // así la carga inicial no arrastra megabytes de secciones que están a
    // cinco pantallas de distancia.
    //
    // En móvil o con ahorro de datos activado el vídeo no llega a pedirse: el
    // póster cuenta la misma historia por una fracción del peso.
    const conexion = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    const conVideo =
      !conexion?.saveData &&
      !/^(slow-)?2g$/.test(conexion?.effectiveType ?? "") &&
      window.matchMedia("(min-width: 768px)").matches;

    const diferidos = document.querySelectorAll<HTMLVideoElement>("[data-video-diferido]");
    if (diferidos.length) {
      const obsVideo = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            if (!e.isIntersecting) continue;
            const v = e.target as HTMLVideoElement;
            obsVideo.unobserve(v);

            if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster;
            if (!conVideo) continue;

            v.preload = "auto";
            v.play().catch(() => {
              /* el navegador puede bloquearlo: se queda el póster */
            });
          }
        },
        { rootMargin: "300px 0px" },
      );
      diferidos.forEach((v) => obsVideo.observe(v));
      limpiezas.push(() => obsVideo.disconnect());
    }

    // ── Cabecera, barra de progreso y parallax ───────────────────────
    const cabecera = document.querySelector<HTMLElement>("[data-header]");
    const progreso = document.querySelector<HTMLElement>("[data-progress]");
    const capas = sinMovimiento
      ? []
      : Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));

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
    limpiezas.push(() => {
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
    });

    return () => limpiezas.forEach((f) => f());
  }, []);

  return null;
}
