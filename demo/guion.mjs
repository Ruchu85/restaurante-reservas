/**
 * guion.mjs — Guion del vídeo de demostración.
 *
 * Cada escena tiene su locución y la captura que la acompaña. Las duraciones
 * NO se fijan aquí: se miden del audio real que genera la síntesis de voz, de
 * modo que imagen y voz van siempre sincronizadas aunque se cambie el texto.
 *
 * El texto está escrito para hablarse, no para leerse: frases cortas, algún
 * punto suspensivo donde conviene una pausa real, nada de listas encadenadas
 * con "y" — es lo que más ayuda a que una voz sintética no suene a robot,
 * más que cualquier ajuste de velocidad o tono.
 */
export const VOZ = "es-ES-XimenaNeural"; // voz más reciente que Elvira; prosodia más natural
export const RITMO = "-2%"; // casi al ritmo natural de la voz; -4% sonaba plodding con Ximena

export const ESCENAS = [
  {
    id: "01",
    titulo: "El problema",
    subtitulo: "Reservas por teléfono, libreta y dobles reservas",
    // Distinta de la escena 02 a propósito: si las dos primeras escenas usan
    // la misma imagen, la animación de deriva no basta para que no se note
    // el "congelado" al pasar de una a otra. Recorte sin el titular "Galería"
    // — mostrar esa etiqueta durante el planteamiento del problema no pega.
    imagen: "14-ambiente.png",
    encuadre: "arriba",
    texto:
      "Si llevas un restaurante, esto te suena. El teléfono no para en mitad del servicio... " +
      "la libreta se llena de tachones. Y, alguna noche, dos mesas acaban reservadas a la misma hora.",
  },
  {
    id: "02",
    titulo: "Tu web, con reservas",
    subtitulo: "Carta, fotos y vídeo — no una plantilla",
    imagen: "13-hero.png",
    encuadre: "arriba",
    texto:
      "Te montamos la web de tu restaurante. Con tu carta, tus fotos... y un vídeo de fondo, " +
      "no una plantilla como las de todos. Dentro, un sistema de reservas que trabaja por ti, " +
      "las veinticuatro horas.",
  },
  {
    id: "03",
    titulo: "Una web que vende sola",
    // Sin "galería" en el subtítulo: la captura de esta escena solo enseña
    // temporada y bodega, y prometer algo que no se ve en pantalla resta.
    subtitulo: "Temporada y bodega — detalles que generan confianza",
    imagen: "11-temporada.png",
    encuadre: "arriba",
    texto:
      "Con secciones que ya cuentan algo: qué hay en temporada, cuántas referencias tiene tu bodega. " +
      "Cosas que hacen que un cliente confíe... antes incluso de llamar.",
  },
  {
    id: "04",
    titulo: "Reservar en dos minutos",
    subtitulo: "Fecha, hora y comensales. Confirmación inmediata",
    imagen: "m4-reservar.png",
    encuadre: "movil",
    texto:
      "El cliente elige día, hora y comensales, desde el móvil. Solo ve los huecos que de verdad " +
      "tienes libres, porque el sistema mira tus mesas en tiempo real.",
  },
  {
    id: "05",
    titulo: "El servicio del día",
    subtitulo: "Todo lo que entra hoy, de un vistazo",
    imagen: "04-reservas.png",
    encuadre: "arriba",
    texto:
      "Tú abres el panel y ves el servicio entero. Quién viene, a qué hora, cuántos son... y en qué mesa.",
  },
  {
    id: "06",
    titulo: "Reconoce a tu cliente",
    subtitulo: "Visitas, alergias y no-shows, sin preguntar",
    imagen: "04-reservas.png",
    encuadre: "detalle",
    texto:
      "Y esto marca la diferencia: la aplicación reconoce a quien ya ha venido. Te avisa si es " +
      "habitual, si tiene alergia al marisco... o si ya te dejó dos mesas vacías.",
  },
  {
    id: "07",
    titulo: "Ficha del comensal",
    subtitulo: "Su historial completo en una pantalla",
    imagen: "09-ficha-comensal.png",
    encuadre: "arriba",
    texto:
      "Cada cliente tiene su ficha. Todas sus visitas, sus notas de sala, sus alergias... se crea " +
      "sola, con cada reserva. Tú no apuntas nada.",
  },
  {
    id: "08",
    titulo: "La sala, bajo control",
    subtitulo: "Mesas juntadas y ritmo de cocina",
    // Antes usaba 03-dia.png, que es la misma vista de calendario que la
    // escena 09 con otra fecha — parecían la misma captura repetida y no
    // enseñaba ninguna mesa mientras se hablaba de mesas.
    imagen: "07-mesas.png",
    encuadre: "detalle",
    texto:
      // "junta mesas solo" se lee como "solamente", no como "sola/automática";
      // con concordancia femenina porque el sujeto es "la aplicación".
      "Para los grupos grandes, la aplicación junta las mesas automáticamente. Y puedes limitar cuántos comensales entran a la vez, " +
      "para que la cocina no se ahogue.",
  },
  {
    id: "09",
    titulo: "Sin dobles reservas",
    subtitulo: "La garantía está en la base de datos",
    imagen: "02-calendario.png",
    encuadre: "arriba",
    texto:
      "Y lo más importante: una mesa no se puede reservar dos veces. No es una comprobación del " +
      "programa... es una regla de la propia base de datos. No falla, nunca.",
  },
  {
    id: "10",
    titulo: "Los números del negocio",
    subtitulo: "Comensales, cancelaciones y de dónde vienen tus reservas",
    // No es 06-informes.png entera: esa captura se hizo en un día que la
    // aplicación marca como "hoy" y el tile "Comensales hoy" salía a 0 —
    // parece un dato roto justo en la escena que vende "mira cuánto sabes de
    // tu negocio". Este recorte se queda con las dos secciones que no
    // dependen del día exacto de la captura.
    imagen: "15-informes-origen.png",
    encuadre: "arriba",
    texto:
      "Al final del mes sabes cuánta gente ha pasado, de dónde vienen tus reservas... y cuántos te han fallado.",
  },
  {
    id: "11",
    titulo: "Pruébalo gratis",
    subtitulo: "Siete días, sin compromiso",
    // No usa 01-panel.png (el panel de "Inicio" muestra el día de HOY: si se
    // recaptura sin reservas sembradas para esa fecha exacta, el cierre del
    // vídeo enseña un panel a cero). El hero de la web es un cierre más
    // fuerte de todas formas: termina en el producto, no en un admin vacío.
    imagen: "13-hero.png",
    encuadre: "arriba",
    texto:
      "Web y sistema de reservas, funcionando desde el primer día. Siete días gratis, para probarlo " +
      "con tu propio restaurante. Sin compromiso.",
  },
];
