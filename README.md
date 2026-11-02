# Misión Planeta Verde

Videojuego educativo web para aprender a separar residuos en casa y cuidar el agua, los ríos y los árboles. El jugador completa tres misiones y ve cómo el planeta pasa de contaminado a más sano.

## Objetivo

Practicar el código de colores de Colombia (blanco, verde y negro) y conceptos de reducir, reutilizar y reciclar, con una explicación antes y después de cada actividad.

El producto usa la tecnología para aprender y construir conocimiento (TAC): no es una página informativa. Cada decisión tiene una consecuencia, una explicación y un puntaje.

## Problema

En la casa y en el colegio los residuos a menudo se mezclan. Lo aprovechable se contamina y termina más basura en el suelo, el agua y el relleno.

## Tecnologías

- HTML5, CSS3 y JavaScript en módulos, sin framework.
- Lucide Icons para los iconos.
- GSAP solo para apariciones cortas.
- Sonidos generados con la API de audio del navegador. Se pueden silenciar.
- `localStorage` para la mejor puntuación, el historial y el progreso de misiones.

Las ilustraciones son SVG del propio proyecto. No hay fotos ni música de terceros.

## Multijugador

El servidor usa Node.js, Express, Socket.IO y SQLite (`server/data/mision.sqlite`). Cada sala tiene su código, sus jugadores y su podio. Los puntos los calcula el servidor: el navegador no puede inventarlos. Dos personas con el mismo apodo reciben identificadores distintos.

```powershell
npm install
npm start
```

Abre `http://127.0.0.1:8787/`. Todo el mundo entra con su nombre. Si el nombre coincide con `ADMIN_NAME`, la siguiente pantalla pide solo la contraseña (`ADMIN_PASSWORD`). El resto escribe el código de la sala. Esos datos están en `.env` y no deben subirse a internet.

Para dejarlo en línea puedes usar Render o Railway: comando `npm start`, variable `PORT`, `ADMIN_PASSWORD` y `SESSION_SECRET`. SQLite guarda los datos en el disco de esa máquina; si el servicio se reinicia sin disco persistente, las salas se borran.

`npm test` comprueba dos salas separadas, el rechazo de una sala llena, que un acierto no sume dos veces y que el panel general no mezcle los podios.

## Cómo ejecutarlo en solitario

Hace falta un navegador moderno (Chrome, Edge o Firefox). Desde la carpeta del proyecto:

```powershell
python -m http.server 8765
```

Abre `http://127.0.0.1:8765/`.

No uses la apertura directa del archivo (`file://`): los módulos de JavaScript no cargan así.

## Cómo se juega

1. Bienvenida. Puedes continuar una partida guardada o empezar de cero.
2. Lección breve antes de cada misión.
3. Clasificación: arrastra el residuo o tócalo y luego elige el contenedor.
4. Preguntas de cuatro opciones, con explicación inmediata.
5. Reto final de 45 segundos. Se abre al terminar las dos misiones anteriores.
6. Resumen de lo aprendido, insignias y un llamado a separar en casa.

Puntos: 10 por acierto, 20 al completar la misión y 15 extra si se termina dentro del tiempo. Un mismo residuo o pregunta no suma dos veces. El error no suma.

Insignias: Aprendiz ecológico, Experto del reciclaje (al menos 70 % en la clasificación), Guardián del planeta (tres misiones) y Héroe ambiental (tres misiones y al menos 85 % de precisión).

## Storyboard

1. El planeta pide ayuda.
2. Se explica el concepto.
3. Se practica la clasificación.
4. Se responden preguntas.
5. Se resuelve un reto con tiempo.
6. Se muestra lo aprendido y se invita a actuar en la comunidad.

## Integrantes

| Bloque | Responsabilidad |
| --- | --- |
| Integrante 1 | Pantallas, puntuación, tiempo y guardado |
| Integrante 2 | Residuos, preguntas, reto y textos educativos |
| Integrante 3 | Interfaz de cristal, planeta, animaciones y accesibilidad |

Al presentar, cada persona escribe su nombre junto a su bloque. El juego no solicita ni guarda datos personales.

## Fuentes

- Ministerio de Ambiente y Desarrollo Sostenible. Resolución 2184 de 2019 y cartilla del código de colores. https://www.minambiente.gov.co/gobierno-unifica-el-codigo-de-colores-para-la-separacion-de-residuos-en-la-fuente-a-nivel-nacional/
- Cartilla: https://www.minambiente.gov.co/wp-content/uploads/2020/12/CODIGO_COLORES_VFF.pdf
- Programa de las Naciones Unidas para el Medio Ambiente. Global Waste Management Outlook 2024. https://www.unep.org/en/publications/report/global-waste-management-outlook-2024

Esas mismas fuentes están dentro del juego, en **Fuentes**. La bitácora académica está en **Bitácora del proyecto**.

## Carpetas

```text
index.html
css/styles.css
js/main.js
js/data/content.js
js/core/scoring.js
js/core/storage.js
js/ui/fx.js
assets/
```

`assets/` no guarda imágenes ni audio externos: el planeta es SVG y los tonos se crean al jugar.

## Créditos de herramientas

- Tipografías Nunito y Fraunces (Google Fonts, licencia OFL).
- Iconos Lucide (licencia ISC).
- GSAP (GreenSock), usado para animaciones breves.
