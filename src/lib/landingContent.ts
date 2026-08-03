/**
 * Contenido editorial de la web pública.
 *
 * Son datos de DEMOSTRACIÓN: carta, galería, equipo y reseñas van aquí en vez
 * de en la base de datos porque no forman parte del sistema de reservas. Para
 * un restaurante real, esto es lo primero que hay que sustituir por su carta y
 * sus propias fotos.
 *
 * Las imágenes son de Pexels (uso comercial libre, sin atribución obligatoria).
 * En producción conviene servir fotos propias desde el mismo dominio: cargan
 * más rápido y evitan que el local parezca un catálogo genérico.
 */

/** URL de una foto de Pexels con recorte y compresión al vuelo. */
export function pexels(id: number, width: number, height?: number): string {
  const crop = height ? `&h=${height}&fit=crop` : "";
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}${crop}`;
}

export const IMAGES = {
  hero: 1581384,        // terraza al anochecer con luces cálidas
  historia: 260922,     // barra del local, ambiente nocturno
  chef: 4253312,        // chef emplatando
  comedor: 262047,      // sala principal
  servicio: 262978,     // pase de platos
  sobremesa: 5638732,   // mesa larga compartida
} as const;

export interface Plato {
  nombre: string;
  descripcion: string;
  precio: number;
  imagen?: number;
  etiquetas?: string[];
}

export interface SeccionCarta {
  id: string;
  titulo: string;
  descripcion: string;
  platos: Plato[];
}

export const CARTA: SeccionCarta[] = [
  {
    id: "entrantes",
    titulo: "Para empezar",
    descripcion: "Pensados para compartir en el centro de la mesa.",
    platos: [
      {
        nombre: "Tostada de aguacate y huevo de codorniz",
        descripcion: "Pan de masa madre, aguacate, huevo de codorniz y semillas tostadas.",
        precio: 12.5,
        imagen: 566566,
        etiquetas: ["Vegetariano"],
      },
      {
        nombre: "Boquerones en vinagre de Jerez",
        descripcion: "Marinados 24 horas, con aceite de oliva virgen extra de Jaén.",
        precio: 11,
      },
      {
        nombre: "Croquetas de jamón ibérico",
        descripcion: "Bechamel cremosa de cocción lenta. Seis unidades.",
        precio: 13.5,
      },
      {
        nombre: "Burrata con tomate de temporada",
        descripcion: "Burrata de Puglia, tomate rosa de Barbastro y albahaca fresca.",
        precio: 14,
        etiquetas: ["Vegetariano"],
      },
    ],
  },
  {
    id: "principales",
    titulo: "Principales",
    descripcion: "Producto de temporada, brasa de encina y cocciones largas.",
    platos: [
      {
        nombre: "Salmón salvaje a la brasa",
        descripcion: "Con rúcula, tomate cherry confitado y reducción de Pedro Ximénez.",
        precio: 23,
        imagen: 725991,
      },
      {
        nombre: "Brochetas de cordero a la brasa",
        descripcion: "Cordero lechal, especias del Mediterráneo y yogur de menta.",
        precio: 21.5,
        imagen: 2233729,
      },
      {
        nombre: "Arroz meloso de carabineros",
        descripcion: "Fondo de marisco de doce horas. Mínimo dos personas, precio por persona.",
        precio: 26,
        etiquetas: ["2 personas"],
      },
      {
        nombre: "Presa ibérica con puré de castañas",
        descripcion: "Bellota 100%, madurada 30 días, con castañas asadas y jugo de asado.",
        precio: 24.5,
      },
    ],
  },
  {
    id: "postres",
    titulo: "Postres",
    descripcion: "Elaborados cada mañana en nuestro obrador.",
    platos: [
      {
        nombre: "Texturas de chocolate y frambuesa",
        descripcion: "Chocolate 70% de origen único, frambuesa fresca y crujiente de cacao.",
        precio: 8.5,
        imagen: 1109197,
      },
      {
        nombre: "Torrija caramelizada",
        descripcion: "De brioche, con helado de canela hecho en casa.",
        precio: 7.5,
      },
      {
        nombre: "Tarta de queso de La Vera",
        descripcion: "Cremosa por dentro, con mermelada de higos.",
        precio: 7,
      },
    ],
  },
];

export const MENU_DEGUSTACION = {
  titulo: "Menú degustación",
  descripcion:
    "Siete pasos que recorren el Mediterráneo, con maridaje opcional de vinos españoles. Se sirve a mesa completa.",
  precio: 58,
  precioMaridaje: 28,
  pasos: 7,
};

export interface Resena {
  autor: string;
  texto: string;
  fuente: string;
  puntuacion: number;
}

export const RESENAS: Resena[] = [
  {
    autor: "Marta Ribera",
    texto:
      "El arroz de carabineros es de los mejores que he comido en Madrid. Reservamos por la web en dos minutos y nos guardaron la mesa de la ventana que pedimos.",
    fuente: "Google",
    puntuacion: 5,
  },
  {
    autor: "Javier Ortiz",
    texto:
      "Fuimos doce por un cumpleaños y lo organizaron sin un solo fallo. Se acordaban de la alergia al marisco de mi hermana sin que tuviéramos que repetirla.",
    fuente: "TripAdvisor",
    puntuacion: 5,
  },
  {
    autor: "Claire Dubois",
    texto:
      "Cocina honesta y producto excelente. La terraza al atardecer merece mucho la pena. Volveremos en nuestro próximo viaje a Madrid.",
    fuente: "Google",
    puntuacion: 5,
  },
];

export const GALERIA = [
  { id: 1267320, alt: "Emplatado de un plato de autor en cocina" },
  { id: 262047, alt: "Sala principal del comedor" },
  { id: 2233729, alt: "Brochetas de cordero en la brasa" },
  { id: 696218, alt: "Comensales brindando en una celebración" },
  { id: 1109197, alt: "Postre de chocolate emplatado" },
  { id: 941861, alt: "Mesa preparada con copas de vino" },
];
