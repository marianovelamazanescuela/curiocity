# Curiocity

Aplicación web (PWA) educativa para niños y niñas de 6 a 12 años: apuntan con la cámara a un objeto, la app lo reconoce y les propone descubrirlo desde distintas asignaturas (Biología, Geología, Historia, Matemáticas, Lengua, Música y Arte) con textos adaptados a su edad, datos curiosos, enlaces seguros y objetos relacionados para seguir explorando.

Idiomas: español, inglés, francés y alemán (se detecta automáticamente del navegador).

## Cómo funciona

```
Navegador (React + Vite)                     Servidor (Express)                 OpenAI
────────────────────────                     ──────────────────                 ──────
Cámara → foto 800 px ── POST /api/detect ──▶ valida imagen, límite peticiones ─▶ visión: nombre del objeto
Elige asignatura ────── POST /api/ai ──────▶ valida, caché, filtra enlaces ───▶ JSON educativo
```

Si algo falla, la app sigue funcionando:

| Falla… | Entonces… |
|---|---|
| `/api/detect` | Reconoce el objeto en el propio navegador con TensorFlow.js (COCO-SSD), que solo se descarga en ese caso |
| `/api/ai` | Muestra contenido de plantillas locales en el idioma del usuario |

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
| `OPENAI_MODEL` | `gpt-4o-mini` | Modelo para visión y textos |
| `RATE_LIMIT_PER_15MIN` | `60` | Peticiones por IP cada 15 min. **En un centro educativo todo el alumnado suele compartir IP: súbelo (p. ej. 400) para uso en clase** |
| `ALLOWED_ORIGINS` | `http://localhost:3000` en desarrollo | Orígenes que pueden llamar a la API desde otro dominio (separados por comas). No hace falta si el servidor sirve también el frontend |
| `CACHE_TTL_SECONDS` | `3600` | Duración de la caché de respuestas |
| `CACHE_MAX_ENTRIES` | `500` | Tamaño máximo de la caché |

Frontend (en el momento del build):

| Variable | Descripción |
|---|---|
| `VITE_AI_PROXY_URL` | URL del servidor si está en otro dominio. Vacía = mismo dominio |
| `VITE_PUBLIC_URL` | URL que aparece en los mensajes compartidos. Por defecto, la de la propia app |

## Despliegue (Render)

[render.yaml](render.yaml) define un único servicio web que compila el frontend y lo sirve junto con la API. Solo hay que configurar `OPENAI_API_KEY` (y conviene `RATE_LIMIT_PER_15MIN`) en el panel de Render.

## Estructura

```
server/
  app.js            API: validación, CORS, límite de peticiones, caché, llamadas a OpenAI
  index.js          arranca el servidor
  app.test.js
src/
  App.jsx           flujo: cámara → análisis → asignaturas → contenido
  components/       CameraView, Sheet (<dialog>), SubjectPicker, ContentView, ObjectHeader, Toast, Splash
  useCamera.js      gestión de la cámara
  api.js            llamadas al servidor + reconocimiento local de respaldo
  i18n.js           todos los textos de la interfaz y detección de idioma
  subjects.js       asignaturas: icono y color
  fallbackContent.js plantillas sin conexión
  share.js          compartir (nativo, correo, WhatsApp)
  styles.css        diseño: tokens de color, tipografía y componentes
public/             logo, iconos, manifest
```

### Añadir un idioma

1. Copia el bloque `en` de [src/i18n.js](src/i18n.js) con el nuevo código (p. ej. `pt`) y tradúcelo; añade también el nombre en `LANGUAGE_NAMES`.
2. Añade sus plantillas en [src/fallbackContent.js](src/fallbackContent.js).
3. `npm test` comprueba que no falta ninguna clave.

### Diseño

Paleta de la marca: crema `#faebd9` y tinta `#1d1d1b`, con un color suave por asignatura (en [src/subjects.js](src/subjects.js)). Tipografía: Sofia Sans. Todos los valores están como variables CSS al principio de [src/styles.css](src/styles.css).
