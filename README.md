# Curiocity

Aplicación web (PWA) educativa para niños y niñas de 8 a 10 años (3º y 4º de Primaria): apuntan con la cámara a un objeto, la app lo reconoce y les destaca las asignaturas que tienen una relación clara con él (de 1 a 4), cada una con un gancho (Biología, Geología, Historia, Matemáticas, Lengua, Música y Arte). En cada asignatura, una mini-lección interactiva en tarjetas: primero adivinan una pregunta, luego un dato sorprendente y el porqué (a veces con una imagen de ejemplo de Wikimedia Commons), un reto de un minuto con el objeto real (con lo que podían descubrir al hacerlo) y una pregunta para seguir pensando, con algunas ideas. Les acompaña Curi, la mascota hecha con los ojos del logo. También ofrece enlaces a enciclopedias infantiles reales, objetos relacionados, las otras asignaturas destacadas y compartir por WhatsApp o correo. Guarda un historial de descubrimientos solo en el dispositivo.

Idiomas: español, inglés, francés y alemán (se detecta automáticamente del navegador).

## Cómo funciona

```
Navegador (React + Vite)                     Servidor (Express)                 Servicios
────────────────────────                     ──────────────────                 ─────────
Cámara → foto 800 px ── POST /api/detect ──▶ valida imagen, límite peticiones ─▶ OpenAI visión: hasta 4 objetos + posición
Varios objetos → el niño elige uno (anillos sobre la foto y botones)
Objeto (foto, relacionado o historial)
                ─────── POST /api/subjects ▶ puntúa 7 asignaturas, valida ───▶ OpenAI (JSON con esquema): destacadas (2-3, máx. 4) + gancho
Elige asignatura ────── POST /api/ai ──────▶ valida, baraja opciones, caché ─▶ OpenAI (JSON con esquema): pregunta, dato,
                                                                               porqué, reto, pregunta final, palabras de búsqueda
                                             busca esas palabras ─────────────▶ Vikidia / Klexikon / Wikipedia
                                             imagen principal del artículo ───▶ Wikimedia Commons (autor y licencia)
Imagen del dato / porqué ◀── directamente de upload.wikimedia.org (sin cookies ni referer)
```

**Los enlaces y las imágenes nunca los inventa la IA:** solo propone palabras de búsqueda y el servidor devuelve páginas e imágenes que existen de verdad. Las imágenes son solo la imagen principal del artículo, deben estar en Wikimedia Commons con autor y licencia (que se muestran debajo) y se descartan mapas, banderas, escudos, diagramas, iconos, logos, SVG e imágenes pequeñas.

**Privacidad:** la app no tiene cuentas ni analíticas, y el navegador solo habla con nuestro servidor. La única excepción decidida son esas imágenes de ejemplo, que se cargan directamente desde `upload.wikimedia.org`, sin cookies ni referer. Se descartó pasarlas por nuestro servidor por sencillez y coste. (Queda pendiente el reconocimiento de respaldo, que solo se usa si el servidor falla y aún descarga su modelo de servidores de Google.)

Si algo falla, la app sigue funcionando:

| Falla… | Entonces… |
|---|---|
| `/api/detect` | Reconoce los objetos en el propio navegador con TensorFlow.js (COCO-SSD), que solo se descarga en ese caso (hasta 4, con sus cajas reales, sin personas) |
| `/api/subjects` | Muestra las 7 asignaturas sin destacar |
| `/api/ai` | Muestra contenido local con preguntas abiertas y retos en el idioma del usuario, sin pregunta de respuesta única ni dato (no afirman nada sobre el objeto, porque no lo conocen) |
| La red | El *service worker* abre la app igualmente (la detección necesita conexión) |

## Puesta en marcha

Requisitos: Node.js 20 o superior.

```bash
npm install
cp .env.example .env      # y pon tu OPENAI_API_KEY
```

En dos terminales:

```bash
npm run start:proxy       # servidor API en http://localhost:4000
npm start                 # frontend en http://localhost:3000 (redirige /api al servidor)
```

Para probar la cámara desde el móvil hace falta HTTPS (o `localhost`).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm start` / `npm run dev` | Frontend en modo desarrollo (Vite) |
| `npm run start:proxy` | Servidor Express (API + build estático) |
| `npm run build` | Genera `build/` para producción |
| `npm run preview` | Sirve `build/` localmente |
| `npm test` | Tests (Vitest) del servidor y de la interfaz |
| `npm run lint` | ESLint |
| `npm run generate-icons` | Regenera los PNG de `public/icons/` desde los SVG |

## Variables de entorno

Servidor (`.env` o panel de Render):

| Variable | Por defecto | Descripción |
|---|---|---|
| `OPENAI_API_KEY` | — | **Obligatoria.** Clave de OpenAI |
| `OPENAI_MODEL` | `gpt-6-luna` | Modelo para visión y textos. Se usa sin razonamiento oculto (`reasoning_effort: none`): más rápido y barato. `gpt-4o-mini` funciona hasta que OpenAI lo retire (14-01-2027) |
| `RATE_LIMIT_PER_15MIN` | `60` | Peticiones por IP cada 15 min (si varios dispositivos comparten conexión, comparten también el límite) |
| `ALLOWED_ORIGINS` | `http://localhost:3000` en desarrollo | Orígenes que pueden llamar a la API desde otro dominio (separados por comas). No hace falta si el servidor sirve también el frontend |
| `CACHE_TTL_SECONDS` | `3600` | Duración de la caché de respuestas |
| `CACHE_MAX_ENTRIES` | `500` | Tamaño máximo de la caché |

Frontend (en el momento del build):

| Variable | Descripción |
|---|---|
| `VITE_AI_PROXY_URL` | URL del servidor si está en otro dominio. Vacía = mismo dominio |
| `VITE_PUBLIC_URL` | URL que aparece en los mensajes compartidos. Por defecto, la de la propia app |

## Despliegue (Render)

[render.yaml](render.yaml) define un único servicio web que compila el frontend y lo sirve junto con la API. Solo hay que configurar `OPENAI_API_KEY` en el panel de Render.

En el plan gratuito, Render apaga el servidor tras 15 minutos sin uso y la primera petición puede tardar cerca de un minuto: conviene abrir la app unos minutos antes de una demostración.

## Modo estudio

Registro anónimo de uso para estudios piloto con niños y niñas de 8 a 10 años. **Está desactivado por defecto y, desactivado, no registra nada:** cada llamada de registro termina en su primera línea y el código de almacenamiento ni siquiera se descarga.

**Cómo se activa (solo adultos)**
1. En la cámara, mantén pulsados **3 segundos** los ojos del logo (arriba a la izquierda).
2. Escribe el **código de adulto** de 4 cifras. Por defecto es `2468`; cámbialo en el propio panel antes del estudio.
3. Escribe un **código de participante** sin espacios y de 12 caracteres como mucho, por ejemplo `G1-P3`. **No escribas nombres.**
4. Pulsa "Activar el modo estudio". Mientras está activo, aparece un punto pequeño junto a los ojos del logo.

El panel permite también:
- cambiar de participante (por ejemplo, al pasar el móvil al siguiente niño o niña);
- ver un resumen;
- exportar los datos;
- borrar los datos, con doble confirmación;
- cambiar el código de adulto;
- desactivar el modo.

**Qué registra.** Cada evento lleva fecha y hora (ISO), un id de sesión aleatorio, el código de participante y el tipo:
- `sesion_inicio`, `sesion_fin` y `cambio_participante`.
- `foto`:
  - objetos detectados y método (servidor o local);
  - objeto elegido, si había varios;
  - "objeto incorrecto".
- `asignaturas`: destacadas mostradas y asignatura elegida (destacada o de "Más asignaturas"; desde la página de asignaturas o desde el final).
- `pantalla`:
  - entrada y salida de cada pantalla de la lección, con su duración;
  - cómo se salió: avance, retroceso, X, otra foto, otra asignatura u objeto relacionado.
- `pregunta`: opción elegida, si acierta y tiempo hasta responder.
- `reto`: hecho o no encontrado.
- `ideas_final`: pulsa "Ver algunas ideas".
- `final`: enciclopedia abierta, objeto relacionado, otra asignatura, compartir (solo el canal, nunca el contenido).
- `error`:
  - servidor no disponible;
  - asignaturas sin servidor;
  - contenido sin conexión;
  - imagen que no carga.
- `leccion`: la lección generada por la IA, guardada una vez por lección con un id que la enlaza con sus eventos (sin direcciones de imágenes).

**Qué no registra nunca:**
- la foto ni ninguna imagen;
- la ubicación;
- identificadores del dispositivo, la IP o el *user-agent*;
- texto escrito por el niño o la niña.

**Nada se envía al servidor ni a terceros.** Los datos se guardan en el propio dispositivo (IndexedDB, base `curiocity_estudio`, separada del historial). Solo salen de él cuando un adulto los exporta.

**Exportar.** En el panel, "Exportar CSV" o "Exportar JSON". Si el navegador tiene hoja de compartir para ese archivo, se abre; si no, se descarga. El archivo se llama `curiocity-estudio-AAAAMMDD-HHMM`.
- **CSV:** una fila por evento, con las columnas `fecha, sesion, participante, tipo, leccion_id, objeto, asignatura, pantalla, detalles`. La columna `detalles` va en JSON. Está en UTF-8 con BOM; las celdas que empiezan por `=`, `+`, `-` o `@` llevan un apóstrofo delante para que la hoja de cálculo no las ejecute.
- **JSON:** todos los eventos y todas las lecciones.

**Resumen por participante:**
- fotos;
- lecciones empezadas y completadas (completada = llega a "Sigue explorando");
- aciertos sobre preguntas;
- retos hechos;
- minutos (cada sesión, de su primer a su último evento).

## Estructura

```
server/
  app.js            rutas de la API: validación, CORS, límite de peticiones, caché
  content.js        prompts, esquemas JSON y validación del ranking de asignaturas y de las lecciones
  openai.js         llamada a OpenAI (la clave solo existe en el servidor)
  detection.js      prompt, esquema y validación de la detección (hasta 4 objetos, sin personas)
  encyclopedia.js   búsqueda de páginas reales en Vikidia, Klexikon y Wikipedia
  images.js         imagen principal del artículo, solo de Wikimedia Commons con autor y licencia
  index.js          arranca el servidor
  app.test.js, content.test.js, images.test.js
src/
  App.jsx           flujo: cámara → análisis → asignaturas → contenido; historial
  components/       CameraView, Page (páginas a pantalla completa), ObjectChooser (elegir entre varios objetos), SubjectPicker, SubjectRow, ContentView (lección en tarjetas), Curi (mascota), HistoryView, StudyPanel (panel de adulto del modo estudio), icons (trazo fino), Toast, Splash
  useCamera.js      gestión de la cámara
  api.js            llamadas al servidor + reconocimiento local de respaldo
  detection.js      lista de objetos de la foto (respuesta del servidor o cajas de COCO-SSD)
  history.js        historial guardado solo en el dispositivo
  i18n.js           textos de la interfaz e idioma
  oldSettings.js    borra al arrancar ajustes de versiones anteriores (voz, edad)
  subjects.js       asignaturas: icono, color y las que se ofrecen al final de la lección
  fallbackContent.js contenido sin conexión (preguntas abiertas y retos)
  share.js          compartir (WhatsApp, correo y hoja del sistema)
  study/            modo estudio: fachada de registro (index), ajustes (config), almacenamiento IndexedDB (store, se carga solo si se activa), exportación y resumen (export), textos del panel
  styles.css        diseño: tipografía, tokens de color y componentes
public/
  sw.js             service worker (abrir sin conexión)
  fonts/            Literata (lectura e interfaz, redonda y cursiva) y Sofia Sans Condensed (titulares), alojadas en el proyecto (licencia OFL)
  …                 logo, iconos, manifest
```

### Añadir un idioma

1. Copia el bloque `en` de [src/i18n.js](src/i18n.js) con el nuevo código (p. ej. `pt`) y tradúcelo; añade también el nombre en `LANGUAGE_NAMES`.
2. Añade sus plantillas en [src/fallbackContent.js](src/fallbackContent.js) y sus enciclopedias en [server/encyclopedia.js](server/encyclopedia.js).
3. `npm test` comprueba que no falta ninguna clave.

### Diseño

Paleta de la marca: crema `#faebd9` y tinta `#1d1d1b`, con un color cálido por asignatura (ocre, piedra, terracota, caramelo, coral, arcilla y naranja; en [src/subjects.js](src/subjects.js)). Tipografía: Literata para la lectura y la interfaz (`--font`) y Sofia Sans Condensed solo para los titulares que hacen eco del logo (`--font-display`), alojadas en `public/fonts/`. Sin botones con fondo negro: píldoras de papel con borde de tinta y círculos de contorno. Todos los valores están como variables CSS al principio de [src/styles.css](src/styles.css).
