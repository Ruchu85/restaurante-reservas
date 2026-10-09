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
 *
 * REGLA DE HONESTIDAD: esto se envía en frío a restaurantes reales. No se
 * promete nada que no se pueda cumplir ni se insinúa una clientela que
 * todavía no existe. La oferta que se dice aquí (30 días, sin comisiones,
 * sin compromiso) tiene que ser LA MISMA que la del email y el WhatsApp de
 * prospección: si el vídeo ofrece menos que el mensaje que lo enlaza, el que
 * lo note desconfía y el que no, se queda con la peor de las dos.
 */
// Se probaron las nueve voces de edge-tts que hablan español, midiendo la
// variación de entonación en semitonos: Ximena salió la más expresiva (4,79,
// frente a 2,64 de Elvira) y, junto al resto de voces nativas, con un ritmo de
// pausas bastante más variado que las multilingües, que pausan como un metrónomo.
export const VOZ = "es-ES-XimenaNeural";

// Rótulo permanente de la esquina. Lleva el nombre del producto porque, sin
// él, el vídeo era anónimo: se podía ver entero sin llegar a saber cómo se
// llama esto ni dónde buscarlo después.
export const MARCA = "Cita-Lista";
export const MARCA_COLA = "Reservas para restaurantes";

/**
 * Cuánto silencio va detrás de cada frase, en segundos.
 *
 * La locución NO se sintetiza de una pieza por escena. Mandar un párrafo
 * entero a la síntesis aplana la entonación —la voz "corre" hacia el final y
 * pierde el arco de cada frase— y deja las pausas a criterio del motor, que
 * con los puntos suspensivos es impredecible: unas veces los ignora y otras
 * mete un corte brusco. Midiendo las dos formas sobre el mismo texto, frase a
 * frase sube la variación de tono de 4,8 a 5,1 semitonos y la de las pausas de
 * 0,43 a 0,72: justo los dos rasgos que separan una voz viva de una plana.
 *
 * Así que se corta por frases, se sintetiza cada una por separado —cada una
 * recupera su curva de entonación completa— y el silencio lo ponemos aquí.
 */
export const PAUSAS = {
  frase: 0.24, // base entre frases de una misma idea
  larga: 0.46, // donde el guion escribe "..." — un respiro con intención
  escena: 0.80, // al cambiar de escena: cambia la imagen, pide más aire
  entrada: 0.30, // antes de la primera palabra del vídeo

  // Una pausa fija en todos los puntos vuelve a sonar a máquina, solo que a
  // otro ritmo: al dejar los silencios clavados en el mismo valor la
  // variación cayó de 0,62 a 0,24 y la locución se volvió metronómica. Quien
  // narra bien no pausa siempre igual: para más tras una frase larga, porque
  // el que escucha necesita colocarla, y coge aire antes de soltar una frase
  // corta y rotunda. Estos dos ajustes reproducen eso a partir del propio
  // texto, así que la variación sale del sentido de la frase y no de un valor
  // aleatorio que sonaría errático.
  porFraseLarga: 0.14, // se suma en proporción a lo larga que fue la frase anterior
  anteFraseCorta: 0.13, // se suma si la siguiente es breve y va con intención
};

/**
 * Velocidad de cada frase, en el formato de porcentaje que espera edge-tts.
 *
 * Con la entonación ya en rango natural (4,7 semitonos de variación) y el aire
 * muerto fuera, lo que quedaba delatando a la máquina era el tempo: las doce
 * escenas iban exactamente a la misma velocidad de principio a fin. Nadie
 * narra así. Una frase corta y rotunda se dice más despacio porque ahí está el
 * golpe; una frase larga y explicativa se pasa un punto más rápido porque es
 * andamiaje. El cierre de cada escena también baja el ritmo, que es como se
 * marca que una idea termina.
 */
export const RITMOS = {
  golpe: "-8%", // frase corta: es el remate, se saborea
  normal: "-3%",
  andamiaje: "0%", // frase larga y explicativa: no conviene recrearse
  cierreEscena: -2, // puntos extra de lentitud en la última frase de cada escena
};

export const ESCENAS = [
  {
    id: "01",
    titulo: "Dos mesas a la misma hora",
    // El rótulo anterior era "El problema": etiqueta la escena en vez de
    // contar nada. Este ya es el problema, dicho.
    subtitulo: "Lo que acaba costando la libreta",
    // Antes: 14-ambiente.png, que es el mosaico de la galería de la web —
    // con sus separaciones blancas se lee como "sección galería", no como
    // una sala. Este recorte se queda con la foto grande.
    imagen: "18-mesa-noche.png",
    encuadre: "arriba",
    texto:
      "Sábado, nueve y media. Dos familias en la puerta... con la misma mesa reservada. " +
      "Con una libreta, y el teléfono sonando en pleno servicio, antes o después pasa.",
  },
  {
    id: "02",
    titulo: "Tu web, con las reservas dentro",
    subtitulo: "Sin comisiones y sin repartir tus clientes",
    imagen: "13-hero.png",
    encuadre: "arriba",
    texto:
      "Te monto la web de tu restaurante, con tu carta y tus fotos. Tú me mandas lo que tengas, " +
      "aunque sea un PDF. Y dentro, un sistema de reservas que trabaja por ti las veinticuatro " +
      "horas. Tuyo... sin comisión por cubierto, y sin repartir tus clientes con nadie.",
  },
  {
    id: "03",
    titulo: "Reservar, en dos minutos",
    subtitulo: "Solo aparecen las horas que te quedan libres",
    // Antes: m4-reservar.png, el primer paso del formulario. La voz decía "solo
    // ve los huecos que de verdad tienes libres" y en pantalla no había ni una
    // hora: se prometía algo que no se veía. Esta es la parrilla real de un
    // miércoles, con siete horas — las que quedaban, no las del horario.
    imagen: "19-horas.png",
    encuadre: "paso",
    texto:
      "Tu cliente elige día, hora y comensales desde el móvil. Solo le aparecen los huecos que de " +
      "verdad tienes libres, porque el sistema mira tus mesas en tiempo real.",
  },
  {
    id: "04",
    titulo: "Confirmación al instante",
    subtitulo: "Por WhatsApp y por email, sola",
    // Recorte de la captura del móvil: entera dejaba la conversación diminuta
    // en mitad del cuadro y el mensaje era ilegible en un teléfono, que es
    // justo donde se abre este vídeo cuando llega por WhatsApp.
    imagen: "17b-whatsapp-recorte.png",
    encuadre: "chat",
    texto:
      "Y le llega la confirmación al momento, por WhatsApp y por email. Tú no escribes nada... " +
      "se envía sola.",
  },
  {
    id: "05",
    titulo: "El servicio del día",
    subtitulo: "Toca una franja y ves quién ocupa cada mesa",
    // La misma pantalla, pero capturada a lo ancho de un móvil. La versión de
    // escritorio, reducida al cuadro del vídeo y vista en un teléfono, dejaba
    // los nombres de las mesas en dos o tres píxeles: se veían las barras de
    // color y nada más. Y este panel se usa de pie y con una mano en pleno
    // servicio, así que enseñarlo en un teléfono también cuenta mejor la historia.
    // Recorte de la captura móvil, no el teléfono entero: enseñando la pantalla
    // completa el texto vuelve a quedarse pequeño dentro del cuadro. Con la
    // franja abierta a lo ancho, los nombres de las mesas se leen también
    // cuando el vídeo se ve en un teléfono.
    imagen: "m5b-franja.png",
    encuadre: "arriba",
    // Aquí se decía además "para los grupos grandes, junta las mesas él solo".
    // Es verdad y es un buen argumento, pero en esta pantalla no se ve ninguna
    // mesa unida: era la voz prometiendo algo que el espectador no encuentra.
    // Fuera hasta que haya una captura que lo enseñe.
    texto:
      "Tú abres el panel y ves el servicio entero. Tocas una franja horaria... y sabes al momento " +
      "qué mesa está libre, y quién ocupa cada una.",
  },
  {
    id: "06",
    titulo: "Reconoce a tu cliente",
    subtitulo: "Visitas, alergias y no-shows, sin preguntar",
    // Los cuatro datos que menciona la voz —visitas, no-shows, alergia y
    // cliente habitual— son etiquetas pequeñas: en la captura de escritorio se
    // convertían en manchas de color al ver el vídeo en un teléfono, justo
    // donde llega. Esta es la lista de comensales tal cual se ve en un móvil,
    // con las mismas etiquetas en cuerpo grande.
    imagen: "m3b-comensales.png",
    encuadre: "arriba",
    // Antes esto eran dos escenas ("Reconoce a tu cliente" y "Ficha del
    // comensal") que decían lo mismo con distinta captura. Fundidas en una.
    // La voz dice "alguna alergia" y no "alergia al marisco": la pantalla
    // pone "Pescado azul" y decir otra cosa distinta encima de la imagen es
    // el tipo de descuido que se nota.
    texto:
      "Y algo que marca la diferencia: reconoce a quien ya ha venido. Te avisa si es habitual, " +
      "si tiene alguna alergia... o si ya te dejó dos mesas vacías. Su ficha se hace sola, con cada reserva.",
  },
  {
    id: "07",
    titulo: "Sin dobles reservas",
    // El subtítulo no repite la frase de la pantalla: dice lo que ella no dice.
    subtitulo: "No depende de que nadie se acuerde de mirar",
    // Sin captura, a propósito. Este es el argumento más fuerte del producto y
    // no hay pantalla que lo demuestre: el anti-solape se nota cuando NO pasa
    // nada. Pasó por el calendario del mes (una rejilla vacía que parecía decir
    // "aquí no reserva nadie") y por un recorte de la vista de franjas, que
    // repetía la pantalla de la escena anterior y encima ilustraba "hay muchas
    // reservas", que no es lo mismo. Dicho en letra grande se lee en cualquier
    // pantalla y rompe la sucesión de nueve cuadros iguales.
    declaracion: {
      frase: "Una mesa no se puede reservar <em>dos veces</em>",
      apoyo: "Ni aunque las dos reservas entren en el mismo segundo",
    },
    // "Es una regla de la propia base de datos" no significa nada para un
    // hostelero, y "no falla, nunca" era lo único que sobrevendía en todo el
    // vídeo. Dicho por lo que le pasa a él, no por cómo está hecho.
    texto:
      "Y lo más importante: una mesa no se puede reservar dos veces. Aunque entren dos reservas " +
      "en el mismo segundo, solo una se queda con la mesa... y no depende de que nadie se acuerde de mirar.",
  },
  {
    id: "08",
    titulo: "Los números del negocio",
    subtitulo: "Cuánta gente entra, y de dónde viene",
    // Las tres cifras que canta la voz, sacadas de la pantalla de informes del
    // restaurante de ejemplo (330 comensales del mes, 53% de las reservas
    // entradas por la web, 2 no presentados). Iban sobre la captura de
    // informes, pero allí las etiquetas miden 22 px: dentro del cuadro del
    // vídeo se quedaban en cuatro píxeles y, en un móvil, la voz cantaba tres
    // datos que el que mira no podía comprobar en pantalla.
    declaracion: {
      frase: "Al final del mes, <em>lo sabes</em>",
      cifras: [
        ["330", "comensales"],
        // "entraron por la web" y no "entran por TU web": son datos del
        // restaurante de ejemplo, y en segunda persona se leen como una
        // promesa de lo que va a pasarle a quien mira.
        ["53%", "entraron por la web"],
        ["2", "no presentados"],
      ],
      // Sin esta línea, tres cifras enormes en segunda persona se leen como una
      // promesa de resultados. Salen del restaurante de ejemplo del vídeo, y
      // hay que decirlo: es la misma regla que llevó a quitar "no falla, nunca".
      nota: "Datos del restaurante de ejemplo",
    },
    texto:
      "Al final del mes sabes cuánta gente ha pasado, de dónde vienen tus reservas... y cuántos te han fallado.",
  },
  {
    id: "09",
    titulo: "Pruébalo con tu restaurante",
    // El subtítulo repetía palabra por palabra los tres chips de la tarjeta,
    // en el mismo fotograma. Ahora dice lo que los chips no dicen.
    subtitulo: "Te contesto yo, no un formulario",
    // Única escena sin captura. El cierre anterior repetía la imagen de la
    // escena 02 y terminaba sin pedir nada: ni el nombre del producto, ni
    // quién hay detrás, ni qué tiene que hacer el que lo está viendo. Un
    // vídeo de captación que no pide respuesta no genera respuestas.
    //
    // El email va en la tarjeta porque "responde a este mensaje" se pierde en
    // cuanto alguien reenvía el vídeo a su socio: el correo sobrevive al reenvío.
    tarjeta: {
      puntos: ["30 días gratis", "Sin comisiones por reserva", "Sin compromiso"],
      cta: "Responde a este mensaje",
      firma: "Pablo Fernández",
      correo: "pablo.fernandez@cita-lista.es",
      web: "cita-lista.es",
    },
    // La frase del PDF se ha movido a la escena 02, donde sí hay una web en
    // pantalla: aquí alargaba el cierre hasta 21 s, el 19% del vídeo, sobre
    // una imagen fija.
    texto:
      "Se llama Cita-Lista, y lo he hecho yo. Me llamo Pablo. Es un proyecto pequeño y recién " +
      "empezado, así que hablarías siempre conmigo. Treinta días gratis, sin compromiso... " +
      "Si quieres verlo con tu restaurante, responde a este mensaje.",
  },
];
