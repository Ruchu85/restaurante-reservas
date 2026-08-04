/**
 * guion.mjs — Guion del vídeo de demostración.
 *
 * Cada escena tiene su locución y la captura que la acompaña. Las duraciones
 * NO se fijan aquí: se miden del audio real que genera la síntesis de voz, de
 * modo que imagen y voz van siempre sincronizadas aunque se cambie el texto.
 */
export const VOZ = "es-ES-ElviraNeural";
export const RITMO = "-4%"; // algo más pausado que el ritmo por defecto

export const ESCENAS = [
  {
    id: "01",
    titulo: "El problema",
    subtitulo: "Reservas por teléfono, libreta y dobles reservas",
    imagen: "10-web-publica.png",
    encuadre: "arriba",
    texto:
      "Si llevas un restaurante, esto te suena: el teléfono suena en pleno servicio, " +
      "la libreta se llena de tachones y, algún día, dos mesas acaban reservadas a la misma hora.",
  },
  {
    id: "02",
    titulo: "Tu web, con reservas",
    subtitulo: "El cliente reserva solo, a cualquier hora",
    imagen: "10-web-publica.png",
    encuadre: "arriba",
    texto:
      "Te montamos la web de tu restaurante, con tu carta y tus fotos. " +
      "Y dentro, un sistema de reservas que trabaja por ti las veinticuatro horas.",
  },
  {
    id: "03",
    titulo: "Reservar en dos minutos",
    subtitulo: "Fecha, hora y comensales. Confirmación inmediata",
    imagen: "m4-reservar.png",
    encuadre: "movil",
    texto:
      "El cliente elige día, hora y número de comensales. " +
      "Solo ve los huecos que de verdad tienes libres, porque el sistema mira tus mesas en tiempo real.",
  },
  {
    id: "04",
    titulo: "El servicio del día",
    subtitulo: "Todo lo que entra hoy, de un vistazo",
    imagen: "04-reservas.png",
    encuadre: "arriba",
    texto:
      "Tú abres el panel y ves el servicio entero: quién viene, a qué hora, cuántos son y en qué mesa.",
  },
  {
    id: "05",
    titulo: "Reconoce a tu cliente",
    subtitulo: "Visitas, alergias y no-shows, sin preguntar",
    imagen: "04-reservas.png",
    encuadre: "detalle",
    texto:
      "Y algo que marca la diferencia: la aplicación reconoce a quien ya ha venido. " +
      "Te avisa de que es un cliente habitual, de que tiene alergia al marisco, " +
      "o de que ya te ha dejado dos mesas vacías.",
  },
  {
    id: "06",
    titulo: "Ficha del comensal",
    subtitulo: "Su historial completo en una pantalla",
    imagen: "09-ficha-comensal.png",
    encuadre: "arriba",
    texto:
      "Cada cliente tiene su ficha, con todas sus visitas, sus notas de sala y sus alergias. " +
      "Se crea sola con cada reserva: tú no tienes que apuntar nada.",
  },
  {
    id: "07",
    titulo: "La sala, bajo control",
    subtitulo: "Mesas juntadas y ritmo de cocina",
    imagen: "03-dia.png",
    encuadre: "arriba",
    texto:
      "Para los grupos grandes junta mesas automáticamente. " +
      "Y puedes limitar cuántos comensales entran a la vez, para que la cocina no se ahogue.",
  },
  {
    id: "08",
    titulo: "Sin dobles reservas",
    subtitulo: "La garantía está en la base de datos",
    imagen: "02-calendario.png",
    encuadre: "arriba",
    texto:
      "Y lo más importante: una mesa no se puede reservar dos veces. " +
      "No es una comprobación del programa, es una regla de la propia base de datos. No falla.",
  },
  {
    id: "09",
    titulo: "Los números del negocio",
    subtitulo: "Ocupación, origen y tasa de no-show",
    imagen: "06-informes.png",
    encuadre: "arriba",
    texto:
      "Al final del mes sabes cuánta gente ha pasado, de dónde vienen tus reservas " +
      "y cuántos te han fallado.",
  },
  {
    id: "10",
    titulo: "Pruébalo gratis",
    subtitulo: "Siete días, sin compromiso",
    imagen: "01-panel.png",
    encuadre: "arriba",
    texto:
      "Web y sistema de reservas, funcionando desde el primer día. " +
      "Te damos siete días gratis para que lo pruebes con tu propio restaurante. Sin compromiso.",
  },
];
