# Curiocity

Aplicación web (PWA) educativa para niños y niñas de 8 a 10 años (3º y 4º de Primaria): apuntan con la cámara a un objeto, la app lo reconoce y les propone las 3 asignaturas que más relación tienen con él, cada una con un gancho (Biología, Geología, Historia, Matemáticas, Lengua, Música y Arte). En cada asignatura, una mini-lección interactiva en tarjetas: primero adivinan una pregunta, luego un dato sorprendente, el porqué, un reto de un minuto con el objeto real (con lo que podían descubrir al hacerlo) y una pregunta para seguir pensando, con algunas ideas. Les acompaña Curi, la mascota hecha con los ojos del logo. También ofrece enlaces a enciclopedias infantiles reales, objetos relacionados, las otras asignaturas destacadas y compartir por WhatsApp o correo. Guarda un historial de descubrimientos solo en el dispositivo.

Idiomas: español, inglés, francés y alemán (se detecta automáticamente del navegador).

## Cómo funciona

```
Navegador (React + Vite)                     Servidor (Express)                 Servicios
────────────────────────                     ──────────────────                 ─────────
Cámara → foto 800 px ── POST /api/detect ──▶ valida imagen, límite peticiones ─▶ OpenAI visión: objeto
Objeto (foto, relacionado o historial)
                ─────── POST /api/subjects ▶ puntúa 7 asignaturas, valida ───▶ OpenAI (JSON con esquema): 3 mejores + gancho
Elige asignatura ────── POST /api/ai ──────▶ valida, baraja opciones, caché ─▶ OpenAI (JSON con esquema): pregunta, dato,
                                                                               porqué, reto, pregunta final, palabras de búsqueda
                                             busca esas palabras ─────────────▶ Vikidia / Klexikon / Wikipedia
```

**Los enlaces nunca los inventa la IA:** solo propone palabras de búsqueda y el servidor devuelve páginas que existen de verdad.

Si algo falla, la app sigue funcionando:

| Falla… | Entonces… |
|---|---|
| `/api/detect` | Reconoce el objeto en el propio navegador con TensorFlow.js (COCO-SSD), que solo se descarga en ese caso |
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

## Estructura

```
server/
  app.js            rutas de la API: validación, CORS, límite de peticiones, caché
  content.js        prompts, esquemas JSON y validación del ranking de asignaturas y de las lecciones
  openai.js         llamada a OpenAI (la clave solo existe en el servidor)
  encyclopedia.js   búsqueda de páginas reales en Vikidia, Klexikon y Wikipedia
  index.js          arranca el servidor
  app.test.js, content.test.js
src/
  App.jsx           flujo: cámara → análisis → asignaturas → contenido; historial
  components/       CameraView, Sheet (<dialog>), SubjectPicker, ContentView (lección en tarjetas), SubjectCard, Curi (mascota), HistoryView, ObjectHeader, Toast, Splash
  useCamera.js      gestión de la cámara
  api.js            llamadas al servidor + reconocimiento local de respaldo
  history.js        historial guardado solo en el dispositivo
  i18n.js           textos de la interfaz e idioma
  oldSettings.js    borra al arrancar ajustes de versiones anteriores (voz, edad)
  subjects.js       asignaturas: icono, color y las que se ofrecen al final de la lección
  fallbackContent.js contenido sin conexión (preguntas abiertas y retos)
  share.js          compartir (WhatsApp, correo y hoja del sistema)
  styles.css        diseño: tipografía, tokens de color y componentes
public/
  sw.js             service worker (abrir sin conexión)
  fonts/            Literata (toda la app), alojada en el proyecto (licencia OFL)
  …                 logo, iconos, manifest
```

### Añadir un idioma

1. Copia el bloque `en` de [src/i18n.js](src/i18n.js) con el nuevo código (p. ej. `pt`) y tradúcelo; añade también el nombre en `LANGUAGE_NAMES`.
2. Añade sus plantillas en [src/fallbackContent.js](src/fallbackContent.js) y sus enciclopedias en [server/encyclopedia.js](server/encyclopedia.js).
3. `npm test` comprueba que no falta ninguna clave.

### Diseño

Paleta de la marca: crema `#faebd9` y tinta `#1d1d1b`, con un color cálido por asignatura (ocre, piedra, terracota, caramelo, coral, arcilla y naranja; en [src/subjects.js](src/subjects.js)). Tipografía: Literata en toda la app (`--font`), alojada en `public/fonts/`. Todos los valores están como variables CSS al principio de [src/styles.css](src/styles.css).
