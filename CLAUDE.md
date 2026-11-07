# CLAUDE.md — Curiocity

## Qué es este proyecto
Curiocity es una Progressive Web App educativa para niños y niñas de **8 a 10 años** (segundo ciclo de Educación Primaria: 3º y 4º). El niño apunta con la cámara del móvil a un objeto cotidiano (una hoja, un perro, una farola, una botella), hace una foto y la app identifica el objeto y le ofrece contenido didáctico adaptado a su edad desde distintas asignaturas.

Es un prototipo de investigación educativa (aprendizaje móvil, ubicuo y autónomo; fomento de la curiosidad) desarrollado en la EASD Sevilla. Se presenta a convocatorias como Ciencia en Acción, así que la claridad del código y de las decisiones de diseño importa.

## Arquitectura
El frontend y el backend están **en el mismo repositorio, en la misma carpeta raíz**.

- **Frontend:** React PWA con Vite (`src/`). Componentes propios, sin MUI; el bottom sheet usa el `<dialog>` nativo. Tiene *service worker* (`public/sw.js`) para abrir sin conexión.
- **Backend:** servidor Express (`server/`) que actúa como proxy hacia OpenAI y busca los enlaces en enciclopedias. Está desplegado en Render. En producción sirve también el frontend compilado (`build/`).
- **Detección de objetos:** primero se usa OpenAI Vision a través del backend. Si el servidor no está disponible, se recurre a COCO-SSD (TensorFlow.js) en el navegador.
- **Modelo de IA:** se configura con la variable `OPENAI_MODEL`; el valor por defecto está en `server/openai.js` (`DEFAULT_MODEL`). Nota: en noviembre de 2026 se cambió de `gpt-4o-mini` a `gpt-6-luna` porque OpenAI retira `gpt-4o-mini` el 14-01-2027.
- **Asignaturas por objeto:** tras detectar el objeto, el modelo puntúa de 0 a 3 su relación con cada una de las 7 asignaturas y escribe un "gancho" de una línea; se destacan las 3 mejores (`/api/subjects`, `server/content.js`).
- **Generación de contenido:** por cada objeto y asignatura, el modelo produce una mini-lección interactiva en JSON estructurado (`json_schema` estricto) que el servidor valida en `server/content.js`: `pregunta_inicial` (3 opciones, la correcta marcada; el servidor baraja las opciones), `dato_sorprendente`, `por_que`, `reto` (un minuto, seguro, con el objeto real), `reto_descubrimiento` ("lo que podías descubrir": 1 o 2 frases que enseñan algo nuevo y cierto, el porqué, la causa o el origen de lo que el reto pide observar; vale lo encuentre o no el niño, sin "si lo has visto…" ni nada sobre su objeto concreto, que la IA no ve), `para_seguir_pensando`, `ideas_pregunta_final` (2 o 3 ideas posibles, no "la" respuesta), `conexion_debil` y términos de búsqueda para las enciclopedias. Si la respuesta no es válida se reintenta una vez; si solo faltan o fallan `reto_descubrimiento` o `ideas_pregunta_final`, también se reintenta una vez y, si siguen fallando, la lección se sirve sin ellas. Si el servidor falla, se usa contenido local sin pregunta ni dato (no se sabe nada cierto del objeto): solo preguntas abiertas y actividades.
- **Edad:** un solo público, de 8 a 10 años (lectores con cierta soltura). No hay selector ni franjas de edad (se quitaron en la fase 3): una sola guía de edad en los prompts de ranking y lección (`AUDIENCE` en `server/content.js`) y un solo tamaño de texto. Al arrancar, la app borra las claves antiguas `curiocity_age` y `curiocity_voice` (`src/oldSettings.js`).
- **Idiomas:** la app detecta el idioma del navegador y admite ES, EN, FR y DE.
- **Recursos externos:** enciclopedias infantiles reales: Vikidia (ES, FR, EN) y Klexikon (DE), además de Wikipedia (Simple English en inglés). La IA solo propone palabras de búsqueda y el servidor comprueba que la página existe. **La app no busca vídeos por ahora** (ni YouTube ni otras plataformas) y se decidió no integrar otros repositorios.

Comandos (definidos en `package.json`):
- `npm run start:proxy`: servidor Express (API) en el puerto 4000.
- `npm start`: frontend en desarrollo (Vite) en el puerto 3000; redirige `/api` al servidor.
- `npm run build`: compila el frontend en `build/`.
- `npm test`: tests (Vitest) del servidor y de la interfaz.
- `npm run lint`: ESLint.

Variables de entorno y despliegue: ver `README.md`.

## Flujo de la app
1. **Cámara:** se abre directamente la cámara trasera a pantalla completa. Hay un círculo central nítido, el exterior está desenfocado y el botón de disparo va centrado abajo.
2. **Detección:** los resultados aparecen en un **bottom sheet** (no en un modal centrado), con la foto visible detrás.
3. **"Objeto incorrecto":** es la única acción de recuperación y devuelve al usuario a la cámara.
4. **Asignaturas:** Biología, Geología, Historia, Matemáticas, Lengua, Música y Arte. Las 3 con más relación con el objeto aparecen destacadas, cada una con su gancho; el resto queda en el desplegable "Más asignaturas". Si no se puede calcular la relación (sin servidor), se muestran las 7 sin destacar.
5. **Lección en tarjetas** (`ContentView.jsx`), una idea por tarjeta: pregunta de curiosidad con 3 opciones → dato sorprendente → porqué → reto de un minuto con el objeto real → tarjeta final (pregunta para seguir pensando y, debajo, enlaces a enciclopedias, objetos relacionados, compartir y otras asignaturas). Sin conexión son 3 tarjetas (investiga, reto, "Prueba esto"). Puntos de progreso y botones "Anterior" / "Siguiente" fijos abajo; también se puede deslizar con el dedo (solo gestos claramente horizontales). La pregunta no deja avanzar hasta que se responde; el niño recibe un mensaje amable (acierto o "¡Casi!"). En el reto, "¡Reto hecho!" (si el reto es fotografiar otro objeto, se ofrece hacer otra foto); no hay "Ahora no": "Siguiente" ya cumple esa función. El reto tiene dos botones, "¡Reto hecho!" y "No lo he encontrado"; los dos muestran "Lo que podías descubrir" (`reto_descubrimiento`), con Curi "done" o "idle" respectivamente: nada suena a fallo. Sin descubrimiento, "¡Reto hecho!" muestra "¡Genial, qué buena investigación!" y "No lo he encontrado", "¡No pasa nada! Mirar con atención ya es investigar." Las lecciones antiguas con `reto_observacion` se abren sin errores (el campo se ignora). En la tarjeta final, la pregunta va con "Piénsalo un momento…" y el botón "Ver algunas ideas". Al final de la lección, "Míralo desde otra asignatura" ofrece solo las otras asignaturas destacadas, con su gancho, sin las ya vistas de ese objeto mientras la app está abierta; si no queda ninguna o no hay ranking, en su lugar se invita a hacer otra foto, junto a los objetos relacionados. El foco pasa a la tarjeta nueva. Si la relación con la asignatura es débil, se avisa solo en la primera frase del porqué (no hay nota aparte). No hay vídeos.
6. **Sin voz ni sonidos:** la lectura en voz alta se quitó en la fase 3 (la voz del dispositivo sonaba robótica y daba miedo a los niños). Una voz más natural con un servicio externo se descartó por coste y privacidad; los sonidos en las interacciones están aplazados. No añadir voz ni sonidos sin consultarlo.
7. **Curi** (`Curi.jsx`): la mascota, hecha solo con los ojos del logo (O y C, con sus pupilas) y una boca de una única línea continua. Estados: `idle`, `thinking`, `correct`, `almost`, `done`. Aparece al cargar asignaturas y lección ("Curi está pensando…"), en la respuesta, al hacer el reto y en el historial vacío. Nunca sobre la cámara. Es decorativa (`aria-hidden`), animada solo con CSS y sin animación con `prefers-reduced-motion`.
8. **Historial y compartir:** hay un historial de exploración guardado solo en el dispositivo. Para compartir hay tres botones siempre visibles: WhatsApp (wa.me con el texto), Correo y "Más…" (la hoja de compartir del sistema, solo si el navegador la admite; es la única vía que adjunta la foto, así que WhatsApp y el correo no la prometen). El texto compartido lleva objeto · asignatura, la pregunta con su respuesta correcta, el dato sorprendente y la marca Curiocity.
9. **Fotos de personas:** la app no las describe; muestra un aviso para que se fotografíen objetos.

## Reglas importantes
- **Nunca inventar URLs.** Los enlaces solo pueden ser de las enciclopedias permitidas (Vikidia, Klexikon, Wikipedia). La IA solo propone términos de búsqueda y el servidor comprueba que la página existe. No añadir otras fuentes (vídeos, YouTube, etc.) sin consultarlo.
- **La clave de OpenAI nunca debe llegar al frontend.** Todas las llamadas a OpenAI pasan por el backend Express.
- **Público infantil:** el contenido tiene que ser seguro, preciso y adaptado a 8–10 años, con un tono amable, frases cortas, vocabulario sencillo y como mucho un número o término técnico, explicado de forma sencilla.
- **Privacidad:** la app es individual, sin cuentas ni datos personales de menores. No se añaden analíticas, rastreadores ni funciones sociales sin consultarlo.
- **Rigor científico:** el contenido educativo debe ser correcto. Ante la duda, es mejor menos contenido que contenido dudoso. Si la relación entre el objeto y una asignatura es floja, se dice, no se inventa. Cuidado con las simplificaciones botánicas sobre qué parte de la flor forma cada fruto (la pulpa de la manzana viene sobre todo del receptáculo, no del ovario): si no es seguro, no se entra en ese detalle.
- **Retos seguros:** nada de tocar animales desconocidos, probar o comer cosas, acercarse al tráfico, usar herramientas, ni abrir o romper el objeto. Estas reglas están en el prompt (`server/content.js`) y se aplican también a "lo que podías descubrir". El reto tiene que mirar algo con sentido desde la asignatura (en Historia, una pista del pasado en el propio objeto, nunca etiquetas, envoltorios o cables); si se cambia el prompt, hay que mantenerlas.
- **Contexto local:** Sevilla, Andalucía o España solo cuando encaje de forma natural, nunca forzado.

## Diseño visual (mantener coherencia)
- **Tipografía:** Literata en toda la app (interfaz y lección), con una sola variable (`--font`) para cambiarla en una línea. El logotipo (SVG) no cambia. Botones y etiquetas de sección a peso 600; los encabezados dentro de las tarjetas de la lección (etiquetas en mayúsculas, "Lo que podías descubrir", la pregunta inicial) a peso normal (400), porque hay poco espacio. Mayúsculas con poco espaciado (0,05em). Texto de la lección a 18,5 px / 1,5.
- **Paleta cálida:** base crema y tinta, con tintes cálidos por asignatura. Usa siempre las variables de `src/styles.css` y los colores de `src/subjects.js`; no metas colores sueltos. Cualquier color nuevo de fondo debe tener contraste AA con el texto `--ink`.
- Formas redondeadas, botones grandes y fáciles de pulsar. Las asignaturas usan iconos de Material Design (decidido mantenerlos) y un color cálido cada una (`src/subjects.js`).
- La tipografía se sirve desde el propio proyecto (`public/fonts/`, con su licencia OFL), no desde Google Fonts, para no enviar la IP de los niños a terceros.
- Nada de alertas rojas agresivas: texto oscuro sobre fondos suaves.
- Los textos de los paneles deben ajustarse bien en pantallas pequeñas.

## Forma de trabajar
- El autor es diseñador y docente, no desarrollador a tiempo completo. **Explica los cambios en español y de forma clara** antes de aplicarlos si son grandes.
- Trabajo solo en un prototipo: los commits pueden ir directamente a main. Para cambios grandes o arriesgados, propón crear una rama.
- Antes de actualizar dependencias o cambiar de modelo de IA, explica el impacto y pide confirmación.
- Después de cada cambio ejecuta `npm test` y `npm run lint`, y añade o actualiza tests cuando cambie el comportamiento.
- Cuando cierres una mejora relevante de diseño o de técnica, añade una entrada breve (fecha, qué se cambió y por qué) a `docs/ITERACIONES.md`.
