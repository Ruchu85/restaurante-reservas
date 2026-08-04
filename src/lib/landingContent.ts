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

/** Precio en euros con el formato español. */
export const precio = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

/** URL de una foto de Pexels con recorte y compresión al vuelo. */
export function pexels(id: number, width: number, height?: number): string {
  const crop = height ? `&h=${height}&fit=crop` : "";
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}${crop}`;
}

/*
  Criterio de las fotos, en este orden:

  1. Ningún rótulo, logotipo ni pizarra de otro negocio a la vista. Una foto
     con la marca de otro restaurante desmonta la web entera.
  2. Interiores en penumbra con luz cálida, y cocina de producto: nada que se
     lea como otra cocina distinta de la que anuncia la carta.
  3. Temperatura de color parecida; el resto lo acerca el tratamiento común
     de `.foto-editorial` (globals.css).

  Aun así son fotos de banco de locales distintos. La única solución de verdad
  es que el restaurante aporte su propio reportaje: ningún filtro convierte
  seis salas en una.
*/
export const IMAGES = {
  historia: 5490965,    // barra en penumbra con lámparas cálidas
  chef: 4253312,        // cocinero emplatando con pinzas
  comedor: 941861,      // sala de noche con las copas servidas
  servicio: 6270541,    // cigala emplatada, cocina de producto
} as const;

export interface Plato {
  nombre: string;
  descripcion: string;
  precio: number;
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
      },
      {
        nombre: "Brochetas de cordero a la brasa",
        descripcion: "Cordero lechal, especias del Mediterráneo y yogur de menta.",
        precio: 21.5,
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
  puntuacion: number;
}

/*
  Reseñas de EJEMPLO. No llevan la marca del portal donde estarían publicadas
  —Google, TripAdvisor— porque atribuir a un portal un texto que nadie escribió
  es afirmar algo falso ante el visitante. Por la misma razón el JSON-LD no
  emite `aggregateRating`. Cuando el restaurante tenga reseñas reales, se
  traen de la API de Google Places y entonces sí se puede citar la fuente.
*/
export const RESENAS: Resena[] = [
  {
    autor: "Marta Ribera",
    texto:
      "El arroz de carabineros es de los mejores que he comido en Madrid. Reservamos por la web en dos minutos y nos guardaron la mesa de la ventana que pedimos.",
    puntuacion: 5,
  },
  {
    autor: "Javier Ortiz",
    texto:
      "Fuimos doce por un cumpleaños y lo organizaron sin un solo fallo. Se acordaban de la alergia al marisco de mi hermana sin que tuviéramos que repetirla.",
    puntuacion: 5,
  },
  {
    autor: "Claire Dubois",
    texto:
      "Cocina honesta y producto excelente. La terraza al atardecer merece mucho la pena. Volveremos en nuestro próximo viaje a Madrid.",
    puntuacion: 5,
  },
];

export const GALERIA = [
  { id: 941861, alt: "Comedor de noche con las mesas preparadas y copas de vino" },
  { id: 2290070, alt: "Sala en penumbra antes del servicio" },
  { id: 4253312, alt: "Emplatado final con una cucharada de salsa" },
  { id: 3298687, alt: "Cocinero trabajando con la sartén" },
  { id: 262978, alt: "Pase de platos hacia la sala" },
  { id: 5490915, alt: "Postre emplatado con frutos rojos" },
];

/** Frases de la cinta que separa el hero del resto de la página. */
export const RECLAMOS = [
  "Cocina mediterránea de autor",
  "Producto de temporada",
  "Brasa de encina",
  "Pescado de lonja",
  "Huerta cercana",
  "Bodega del Bierzo",
];

/**
 * Lo que está en temporada ahora mismo.
 *
 * Es el contenido que distingue a un restaurante de una plantilla: nombres
 * concretos, procedencias y meses. Un negocio real lo actualiza cuatro veces
 * al año y es lo que hace que la web parezca viva.
 */
export const TEMPORADA = {
  titulo: "En la mesa ahora mismo",
  entradilla:
    "Agosto es mes de tomate y de pescado azul. Esto es lo que entra estos días por la puerta de atrás.",
  productos: [
    { nombre: "Tomate rosa", origen: "Barbastro, Huesca", meses: "Julio a septiembre" },
    { nombre: "Bonito del norte", origen: "Lonja de Bermeo", meses: "Junio a octubre" },
    { nombre: "Higo de la Vera", origen: "Cáceres", meses: "Agosto a octubre" },
    { nombre: "Pimiento asado", origen: "Huerta de Navarra", meses: "Agosto a noviembre" },
  ],
};

/** La bodega, contada como la contaría el sumiller. */
export const BODEGA = {
  titulo: "La bodega",
  texto:
    "Ciento veinte referencias, casi todas españolas y ninguna por encima de las mil botellas de producción. Mencía del Bierzo, albariño de Val do Salnés y jerez de velo, que servimos por copas para que nadie tenga que comprometerse con una botella entera.",
  datos: [
    ["120", "referencias"],
    ["14", "por copas"],
    ["9", "denominaciones"],
  ],
};

/** Quien firma la cocina. Aparece con foto, así que nombre y foto han de casar. */
export const JEFE_COCINA = {
  nombre: "Álvaro Quintana",
  cargo: "jefe de cocina",
  cita:
    "Si un producto no está en su punto, ese día no lo servimos. Es la única norma que no se negocia.",
  alt: "El jefe de cocina trabajando con una sartén en la cocina",
};
