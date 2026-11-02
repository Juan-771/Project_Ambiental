export const BINS = [
  {
    id: "white",
    label: "Blanco",
    hint: "Aprovechables",
    detail: "Limpios y secos: plástico, vidrio, metal, papel y cartón.",
  },
  {
    id: "green",
    label: "Verde",
    hint: "Orgánicos",
    detail: "Cáscaras y restos de alimentos crudos.",
  },
  {
    id: "black",
    label: "Negro",
    hint: "No aprovechables",
    detail: "Lo que está sucio o no se recicla.",
  },
];

export const WASTE = [
  { id: "botella-plastico", name: "Botella de plástico", bin: "white", why: "Está limpia y seca: el plástico aprovechable va al blanco." },
  { id: "botella-vidrio", name: "Botella de vidrio", bin: "white", why: "El vidrio limpio se recupera. Va al contenedor blanco." },
  { id: "lata", name: "Lata", bin: "white", why: "Los metales limpios son aprovechables y van al blanco." },
  { id: "periodico", name: "Periódico", bin: "white", why: "El papel seco y limpio va al contenedor blanco." },
  { id: "caja", name: "Caja de cartón", bin: "white", why: "El cartón limpio se recicla en el contenedor blanco." },
  { id: "cascara", name: "Cáscara de banano", bin: "green", why: "Es un resto de fruta. Lo orgánico aprovechable va al verde." },
  { id: "comida", name: "Restos de fruta cruda", bin: "green", why: "Las cáscaras y los restos crudos van al verde. La comida ya preparada, según la cartilla del MinAmbiente, va al negro." },
  { id: "servilleta", name: "Servilleta sucia", bin: "black", why: "Está sucia y no se puede reciclar. Va al negro." },
  { id: "higienico", name: "Papel higiénico usado", bin: "black", why: "Por higiene no se aprovecha. Va al contenedor negro." },
];

export const QUESTIONS = [
  {
    id: "q-reciclar",
    q: "¿Por qué es importante reciclar?",
    options: [
      "Para que los materiales vuelvan a usarse y haya menos basura",
      "Para mezclar todos los residuos en una sola bolsa",
      "Para que la basura desaparezca sola",
      "Para pintar los contenedores de varios colores",
    ],
    answer: 0,
    why: "Reciclar recupera materiales y reduce lo que termina en el relleno o en la naturaleza.",
  },
  {
    id: "q-rios",
    q: "¿Qué sucede cuando contaminamos los ríos?",
    options: [
      "El agua queda limpia para todos",
      "Los peces crecen más rápido",
      "El agua y los seres vivos se enferman",
      "El río se convierte en agua potable",
    ],
    answer: 2,
    why: "La basura y los químicos dañan el agua, los animales y a quienes dependen del río.",
  },
  {
    id: "q-botella",
    q: "¿En qué contenedor se deposita una botella de plástico limpia?",
    options: ["Verde", "Negro", "Blanco", "En cualquiera"],
    answer: 2,
    why: "El plástico limpio y seco es aprovechable. Va al contenedor blanco.",
  },
  {
    id: "q-agua",
    q: "¿Qué podemos hacer para ahorrar agua?",
    options: [
      "Dejar la llave abierta mientras nos enjabonamos",
      "Cerrar la llave al cepillarnos y reutilizar el agua cuando se pueda",
      "Lavar la calle con manguera todos los días",
      "Ducharnos con el agua corriendo sin control",
    ],
    answer: 1,
    why: "Cerrar la llave y reutilizar agua evita desperdiciar un recurso limitado.",
  },
  {
    id: "q-reutilizar",
    q: "¿Qué significa reutilizar?",
    options: [
      "Botar algo después de un solo uso",
      "Quemar los residuos",
      "Enterrar el plástico",
      "Volver a usar un objeto en lugar de desecharlo",
    ],
    answer: 3,
    why: "Reutilizar es darle otra vida al objeto antes de convertirlo en basura.",
  },
  {
    id: "q-bosque",
    q: "¿Qué consecuencias tiene la deforestación?",
    options: [
      "Se pierden árboles, animales y aire más limpio",
      "Aparecen más bosques solos",
      "Los ríos se llenan de peces",
      "El suelo queda más protegido",
    ],
    answer: 0,
    why: "Sin árboles hay menos oxígeno, menos hogar para los animales y más suelo desprotegido.",
  },
];

export const SITUATIONS = [
  {
    id: "s-casa",
    q: "En casa hay una cáscara de banano y una botella de plástico limpia. ¿Cómo las separas?",
    options: [
      "Cáscara al verde y botella al blanco",
      "Las dos al negro",
      "Cáscara al blanco y botella al verde",
      "Las dos al blanco",
    ],
    answer: 0,
    why: "Lo orgánico va al verde. El plástico limpio va al blanco.",
  },
  {
    id: "s-contamina",
    q: "¿Cuál de estas acciones contamina el ambiente?",
    options: [
      "Separar los residuos en casa",
      "Cerrar la llave al lavarse",
      "Tirar aceite usado al desagüe",
      "Llevar cartón limpio al contenedor blanco",
    ],
    answer: 2,
    why: "El aceite en el desagüe ensucia el agua y dificulta su tratamiento.",
  },
  {
    id: "s-agua",
    q: "¿Cuál es la mejor práctica para cuidar el agua?",
    options: [
      "Reparar las fugas y usar solo el agua necesaria",
      "Dejar la manguera abierta por si acaso",
      "Lavar el carro todos los días con manguera",
      "Botar el agua de la lluvia",
    ],
    answer: 0,
    why: "Arreglar fugas y usar lo justo evita perder agua potable.",
  },
  {
    id: "s-reciclaje",
    q: "Tienes una servilleta con comida y un periódico seco. ¿Qué haces?",
    options: [
      "Periódico al blanco y servilleta sucia al negro",
      "Los dos al verde",
      "Los dos al blanco",
      "Periódico al negro y servilleta al blanco",
    ],
    answer: 0,
    why: "El papel limpio se aprovecha. La servilleta sucia no, y va al negro.",
  },
];

export const MISSIONS = [
  { id: "sort", title: "Clasificación", text: "Arrastra cada residuo o tócalo y luego elige el contenedor.", icon: "recycle", speedLimit: 90 },
  { id: "quiz", title: "Preguntas", text: "Elige la respuesta y lee por qué.", icon: "help-circle", speedLimit: 80 },
  { id: "final", title: "Reto final", text: "Resuelve las situaciones antes de que acabe el tiempo.", icon: "timer", speedLimit: 45 },
];

export const LESSONS = {
  sort: {
    title: "Antes de clasificar",
    lines: [
      "Reciclar es convertir un material usado en materia prima para algo nuevo.",
      "En Colombia, la Resolución 2184 de 2019 unificó tres colores para separar en casa.",
      "Blanco: plástico, vidrio, metales, papel y cartón limpios y secos.",
      "Verde: orgánicos aprovechables, como cáscaras y restos de alimentos crudos.",
      "Negro: lo que no se aprovecha, como el papel higiénico, las servilletas sucias o el papel con comida.",
    ],
    example: "Ejemplo: una botella enjuagada va al blanco. Una cáscara de banano va al verde.",
    tip: "Si el residuo está mojado o con comida, no lo pongas con los aprovechables.",
    fact: "Este código aplica en los municipios que tienen programas de aprovechamiento. Si no los hay, la cartilla indica usar solo el recipiente negro.",
  },
  quiz: {
    title: "Antes de las preguntas",
    lines: [
      "Reducir es generar menos residuos. Reutilizar es volver a usar algo.",
      "Reciclar ayuda, pero viene después: el PNUMA explica que evitar el residuo o reutilizarlo gasta menos energía que reciclarlo.",
      "Contaminar un río daña el agua y a quienes viven de ella.",
      "Ahorrar agua puede ser tan simple como cerrar la llave mientras te enjabonas.",
      "Cuidar los árboles protege el suelo, los animales y el aire.",
    ],
    example: "Ejemplo: una botella lavada puede servir de nuevo antes de llevarla al blanco.",
    tip: "Primero reduce, luego reutiliza y, al final, separa para reciclar.",
    fact: "El Programa de las Naciones Unidas para el Medio Ambiente ordena así la prioridad: prevenir, reutilizar y después reciclar.",
  },
  final: {
    title: "Antes del reto",
    lines: [
      "Vas a decidir en situaciones de una casa.",
      "Separa lo limpio y seco, lo orgánico crudo y lo que ya no se aprovecha.",
      "Elige la acción que contamina menos.",
      "Si dudas, recuerda el orden: reducir, reutilizar, reciclar.",
    ],
    example: "Ejemplo: el aceite de cocina no se bota por el desagüe.",
    tip: "Lee toda la situación. Una sola palabra, como «sucia» o «cruda», cambia el contenedor.",
    fact: "Separar en la fuente significa hacerlo en el lugar donde se genera el residuo: la casa, el colegio o el trabajo.",
  },
};

export const SUMMARIES = {
  sort: [
    "Blanco: aprovechables limpios y secos.",
    "Verde: cáscaras y restos crudos.",
    "Negro: papel higiénico, servilletas sucias y lo que no se recupera.",
  ],
  quiz: [
    "Reducir y reutilizar van antes que reciclar.",
    "Cerrar la llave ahorra agua.",
    "Lo que llega al río no desaparece.",
  ],
  final: [
    "En casa se separa con los tres colores.",
    "El aceite usado no va al desagüe.",
    "El papel limpio se aprovecha; el papel sucio, no.",
  ],
};

export const SOURCES = [
  {
    name: "Ministerio de Ambiente y Desarrollo Sostenible de Colombia",
    detail: "Resolución 2184 de 2019. Código de colores: verde, blanco y negro.",
    url: "https://www.minambiente.gov.co/gobierno-unifica-el-codigo-de-colores-para-la-separacion-de-residuos-en-la-fuente-a-nivel-nacional/",
  },
  {
    name: "Cartilla Código de colores, MinAmbiente",
    detail: "Blanco: plástico, vidrio, metales, papel y cartón. Verde: cáscaras y restos crudos. Negro: papel higiénico, servilletas y comida preparada.",
    url: "https://www.minambiente.gov.co/wp-content/uploads/2020/12/CODIGO_COLORES_VFF.pdf",
  },
  {
    name: "Programa de las Naciones Unidas para el Medio Ambiente (PNUMA)",
    detail: "Jerarquía de residuos: prevenir, preparar para reutilizar, reciclar, recuperar y, al final, disponer.",
    url: "https://www.unep.org/en/publications/report/global-waste-management-outlook-2024",
  },
];

export const BADGE_DEFS = [
  { id: "aprendiz", label: "Aprendiz ecológico", test: (s) => s.completed >= 1 },
  { id: "experto", label: "Experto del reciclaje", test: (s) => s.sortAccuracy >= 0.7 && s.done.sort },
  { id: "guardian", label: "Guardián del planeta", test: (s) => s.completed === 3 },
  { id: "heroe", label: "Héroe ambiental", test: (s) => s.completed === 3 && s.accuracy >= 0.85 },
];
