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
| `STUDY_MODE`, `STUDY_KEY`, `STUDY_ADMIN_PASSWORD`, `STUDY_SHEET_URL`, `STUDY_SHEET_SECRET` | — | Solo para la versión de estudio (ver "Versión de estudio"). Sin `STUDY_MODE=true` no tienen efecto |

Frontend (en el momento del build):

| Variable | Descripción |
|---|---|
| `VITE_AI_PROXY_URL` | URL del servidor si está en otro dominio. Vacía = mismo dominio |
| `VITE_PUBLIC_URL` | URL que aparece en los mensajes compartidos. Por defecto, la de la propia app |

## Despliegue (Render)

[render.yaml](render.yaml) define un único servicio web que compila el frontend y lo sirve junto con la API. Solo hay que configurar `OPENAI_API_KEY` en el panel de Render.

En el plan gratuito, Render apaga el servidor tras 15 minutos sin uso y la primera petición puede tardar cerca de un minuto: conviene abrir la app unos minutos antes de una demostración.

## Versión de estudio

### Qué es
Es una segunda publicación del **mismo código**, pensada para un estudio piloto con niños y niñas de 8 a 10 años. Registra de forma anónima cómo se usa la app y envía esos datos a una hoja de cálculo del equipo investigador.

**La versión principal no cambia:** no registra nada y no envía nada. Lo que decide es la variable `STUDY_MODE`, que se fija al compilar. Sin ella, los archivos de la app no contienen ni una línea del registro y el servidor no tiene las rutas `/api/study/*` (responde 404).

```
Móvil (versión de estudio)                Nuestro servidor (Render, Frankfurt)       Hoja de Google (Drive del equipo)
 cola de eventos en el móvil ── lotes ──▶  comprueba clave, campos y tamaños ──────▶  pestaña "eventos"
 (se borran al confirmarse)  ◀─ "recibidos" ─ sin IP ni user-agent; no guarda nada ◀─ pestaña "codigos"
```

### En el móvil
- **Código de participante:**
  - La primera vez, la app pide un código a la hoja, que lo reparte sin repetir nunca uno ya dado. Tiene una palabra corta y dos cifras, por ejemplo `LINCE-47`.
  - Lo muestra en grande con "Apunta este código" y "Empezar". Nadie escribe nada.
  - Esa primera vez hace falta conexión.
- **Un móvil, un niño o niña:** las siguientes veces se usa el mismo código, sin volver a mostrar esa pantalla.
- **En la cámara**, arriba, junto a los ojos, se ve "Estudio · LINCE-47". Al tocarlo se abre una página con:
  - el código;
  - cuántos registros esperan a enviarse;
  - el enlace **"Exportar copia (CSV)"**, con lo que aún no se ha enviado.
- **Envío:**
  - Los eventos esperan en el móvil (IndexedDB) y se envían en lotes de hasta 50 a `POST /api/study/events`.
  - Si falla, se reintenta esperando cada vez más: 5 s, 10 s, 20 s… hasta 5 minutos. También se reintenta al volver la conexión y al abrir la app.
  - **Un evento solo se borra del móvil cuando el servidor confirma que la hoja lo ha guardado.** Si un lote llega dos veces, la hoja no lo repite.
- **Sesiones:** cada vez que se abre la app empieza una sesión. Si la app vuelve tras más de 30 minutos en segundo plano, empieza otra.

### Qué se registra
Cada evento lleva:
- su `id` (aleatorio);
- la `fecha` (ISO, UTC);
- la `sesion` (aleatoria);
- el `participante` (el código);
- su `tipo`;
- cuando aplica, `leccion_id`, `objeto`, `asignatura` y `pantalla`;
- un objeto `detalles`.

| Tipo | Qué guarda |
|---|---|
| `sesion_inicio` / `sesion_fin` | Apertura y cierre. Motivo del cierre: `app_cerrada`, `inactividad` o `reinicio` |
| `foto` | Objetos detectados y método (`server` o `local`), objeto elegido entre varios, "objeto incorrecto" |
| `asignaturas` | Destacadas mostradas; la elegida, si era destacada o de "Más asignaturas" y desde dónde |
| `pantalla` | Entrada y salida de cada pantalla de la lección, con `duracion_ms` y cómo se salió: `avance`, `retroceso`, `salida_x`, `otra_foto`… |
| `pregunta` | Opción elegida, acierto y `tiempo_ms` hasta responder |
| `reto` | `hecho` o `no_encontrado` |
| `ideas_final` | Pulsa "Ver algunas ideas" |
| `final` | Enciclopedia abierta, objeto relacionado, otra asignatura, compartir (solo el canal) |
| `error` | Servidor no disponible, contenido sin conexión, imagen que no carga |
| `leccion` | El JSON de la lección mostrada, una vez por lección, sin las direcciones de las imágenes |

**Nunca se registra** la foto ni ninguna imagen, la ubicación, identificadores del dispositivo, la IP, el *user-agent* ni texto escrito por el niño. El servidor solo deja pasar los campos de la tabla: un evento con cualquier otro campo, o con un tipo, código o tamaño no válidos, se descarta. Un test comprueba que ni la IP ni el *user-agent* llegan a la hoja ni a los registros del servidor. Detalle en lenguaje llano: [docs/ESTUDIO-PRIVACIDAD.md](docs/ESTUDIO-PRIVACIDAD.md).

### Cómo se publica, paso a paso

**1. La hoja de cálculo** (con la cuenta de la Consejería):
1. En Google Drive, crea una hoja de cálculo nueva, por ejemplo "Curiocity · estudio piloto". Las pestañas `eventos` y `codigos` se crean solas con la primera petición.
2. Ve a **Extensiones › Apps Script**. Borra el contenido de `Código.gs` y pega el de [server/study-sheet.gs](server/study-sheet.gs). Guarda.
3. Ve a **Configuración del proyecto** (rueda dentada) › **Propiedades de la secuencia de comandos** › **Añadir propiedad**:
   - nombre: `SECRETO`;
   - valor: una frase larga y aleatoria, de 30 caracteres o más.

   Apúntala: es `STUDY_SHEET_SECRET`.
4. Ve a **Implementar › Nueva implementación**, con el tipo **Aplicación web**:
   - **Ejecutar como:** "Yo".
   - **Quién tiene acceso:** "Cualquier usuario". Es necesario para que nuestro servidor llegue; el `SECRETO` es lo que impide que otros escriban.
   - Pulsa **Implementar**, autoriza el acceso con tu cuenta y copia la URL que acaba en `/exec`: es `STUDY_SHEET_URL`.
   - Si tu cuenta no ofrece "Cualquier usuario", el administrador del dominio lo tiene limitado y habrá que pedirlo.
5. Si más adelante cambias el script: **Implementar › Gestionar implementaciones › editar (lápiz) › Versión: nueva versión**. La URL se mantiene.

**2. El servicio en Render:**
1. **New › Web Service**, con el mismo repositorio de GitHub y la rama `main`.
2. Configúralo así:
   - **Name:** `curiocity-estudio`;
   - **Region:** **Frankfurt (EU Central)**;
   - **Instance type:** Free.
3. Los comandos, los mismos que el servicio principal:
   - **Build Command:** `npm ci --include=dev && npm run build`;
   - **Start Command:** `node server/index.js`.
4. **Environment** (variables):

| Variable | Valor |
|---|---|
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `OPENAI_API_KEY` | La misma clave que el servicio principal |
| `STUDY_MODE` | `true` |
| `STUDY_KEY` | Una cadena aleatoria (por ejemplo, 32 letras y cifras). Va dentro de la app de estudio: frena peticiones sueltas, pero **no es secreta**. Lo que protege de verdad es la validación del servidor, el límite de peticiones y el `SECRETO` de la hoja |
| `STUDY_ADMIN_PASSWORD` | Contraseña del equipo investigador para `/?reiniciar-estudio` |
| `STUDY_SHEET_URL` | La URL `/exec` del paso 1.4 |
| `STUDY_SHEET_SECRET` | El valor de `SECRETO` del paso 1.3 |
| `RATE_LIMIT_PER_15MIN` | `600`. En clase, todos los móviles comparten la IP del centro y el límite normal (60) se quedaría corto |

5. **Create Web Service.** `STUDY_MODE` y `STUDY_KEY` se leen al compilar: si las cambias, vuelve a desplegar.
6. **Comprobación:** abre la URL del servicio en un móvil. Debe salir "Apunta este código", y en la hoja debe aparecer la pestaña `codigos` con ese código.

El servicio de estudio **no guarda nada**: reenvía cada lote a la hoja. Por eso le vale el plan gratuito, que borra el disco al reiniciarse. Si el servidor está dormido o la hoja no responde, los móviles conservan los eventos y los reenvían después. Conviene abrir la app unos minutos antes de cada sesión, para que se despierte y para que los móviles nuevos reciban su código.

### Reutilizar un móvil con otro niño o niña
Solo el equipo investigador: abre `https://<servicio-de-estudio>/?reiniciar-estudio` en ese móvil y escribe `STUDY_ADMIN_PASSWORD`.

La app hace tres cosas:
1. cierra la sesión;
2. **envía todo lo pendiente**;
3. pide un código nuevo y lo muestra con "Apunta este código".

Si queda algo sin enviar (por ejemplo, sin conexión), avisa y no cambia nada. No hay botón de "siguiente participante" dentro de la app.

### Exportar y borrar los datos
- **Exportar:** en la hoja, **Archivo › Descargar › Valores separados por comas (.csv)** o **Microsoft Excel**, con la pestaña `eventos` abierta. Hay una fila por evento, columnas planas y los detalles en una columna JSON. La columna `recibido` es la hora a la que llegó a la hoja.
- **Copia desde el móvil:** "Exportar copia (CSV)", tocando "Estudio · CÓDIGO" en la cámara. Solo trae lo que el móvil aún no ha enviado.
- **Borrar al terminar el estudio:**
  1. borra la hoja de cálculo y **vacía la papelera** de Drive (si no, queda allí 30 días);
  2. en Render, borra el servicio `curiocity-estudio` (o pon `STUDY_MODE=false`);
  3. en cada móvil, borra los datos del sitio en el navegador, o desinstala la app.

### Probarla en local
Sin tocar Google: [scripts/study-sheet-local.js](scripts/study-sheet-local.js) hace de hoja de cálculo con el mismo script, y guarda los datos en `.study-local/`.

```bash
node scripts/study-sheet-local.js        # "hoja" en http://localhost:4300 (CSV: /eventos.csv)
STUDY_MODE=true STUDY_KEY=clave-local npm run build
PORT=4200 STUDY_MODE=true STUDY_KEY=clave-local STUDY_ADMIN_PASSWORD=prueba \
  STUDY_SHEET_URL=http://localhost:4300 STUDY_SHEET_SECRET=local node server/index.js
```

## Estructura

```
server/
  app.js            rutas de la API: validación, CORS, límite de peticiones, caché
  content.js        prompts, esquemas JSON y validación del ranking de asignaturas y de las lecciones
  openai.js         llamada a OpenAI (la clave solo existe en el servidor)
  detection.js      prompt, esquema y validación de la detección (hasta 4 objetos, sin personas)
  encyclopedia.js   búsqueda de páginas reales en Vikidia, Klexikon y Wikipedia
  images.js         imagen principal del artículo, solo de Wikimedia Commons con autor y licencia
  study.js          versión de estudio (solo con STUDY_MODE): valida los eventos y los reenvía a la hoja
  study-sheet.gs    script de la hoja de cálculo del estudio (se pega en Apps Script)
  study-sheet-fake.js la misma hoja simulada en Node, para los tests y la prueba en local
  index.js          arranca el servidor
  app.test.js, content.test.js, images.test.js
src/
  App.jsx           flujo: cámara → análisis → asignaturas → contenido; historial
  components/       CameraView, Page (páginas a pantalla completa), ObjectChooser (elegir entre varios objetos), SubjectPicker, SubjectRow, ContentView (lección en tarjetas), Curi (mascota), HistoryView, icons (trazo fino), Toast, Splash
  useCamera.js      gestión de la cámara
  api.js            llamadas al servidor + reconocimiento local de respaldo
  detection.js      lista de objetos de la foto (respuesta del servidor o cajas de COCO-SSD)
  history.js        historial guardado solo en el dispositivo
  i18n.js           textos de la interfaz e idioma
  oldSettings.js    borra al arrancar ajustes de versiones anteriores (voz, edad)
  subjects.js       asignaturas: icono, color y las que se ofrecen al final de la lección
  fallbackContent.js contenido sin conexión (preguntas abiertas y retos)
  share.js          compartir (WhatsApp, correo y hoja del sistema)
  study/            versión de estudio (solo con STUDY_MODE): registro, cola de envío, código, reinicio
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
