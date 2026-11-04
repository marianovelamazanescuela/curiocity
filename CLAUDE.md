# CLAUDE.md — Curiocity

## Qué es este proyecto
Curiocity es una Progressive Web App educativa para niños y niñas de **6 a 12 años**. El niño apunta con la cámara del móvil a un objeto cotidiano (una hoja, un perro, una farola, una botella), hace una foto y la app identifica el objeto y le ofrece contenido didáctico adaptado a su edad desde distintas asignaturas.

Es un prototipo de investigación educativa (aprendizaje móvil, ubicuo y autónomo; fomento de la curiosidad) desarrollado en la EASD Sevilla. Se presenta a convocatorias como Ciencia en Acción, así que la claridad del código y de las decisiones de diseño importa.

## Arquitectura
El frontend y el backend están **en el mismo repositorio, en la misma carpeta raíz**.

- **Frontend:** React PWA con Vite (`src/`). Componentes propios, sin MUI; el bottom sheet usa el `<dialog>` nativo. Tiene *service worker* (`public/sw.js`) para abrir sin conexión.
- **Backend:** servidor Express (`server/`) que actúa como proxy hacia OpenAI y busca los enlaces en enciclopedias. Está desplegado en Render. En producción sirve también el frontend compilado (`build/`).
- **Detección de objetos:** primero se usa OpenAI Vision a través del backend. Si el servidor no está disponible, se recurre a COCO-SSD (TensorFlow.js) en el navegador.
- **Modelo de IA:** se configura con la variable `OPENAI_MODEL`; el valor por defecto está en `server/openai.js` (`DEFAULT_MODEL`). Nota: en noviembre de 2026 se cambió de `gpt-4o-mini` a `gpt-6-luna` porque OpenAI retira `gpt-4o-mini` el 14-01-2027.
- **Generación de contenido:** el modelo, a través del backend, produce explicaciones, curiosidades y actividades, adaptadas al grupo de edad elegido (6–8 o 9–12). Si el servidor falla, se usan plantillas locales con preguntas y actividades (nunca afirmaciones sobre el objeto).
- **Idiomas:** la app detecta el idioma del navegador y admite ES, EN, FR y DE.
- **Recursos externos:** enciclopedias infantiles reales: Vikidia (ES, FR, EN) y Klexikon (DE), además de Wikipedia (Simple English en inglés). La IA solo propone palabras de búsqueda y el servidor comprueba que la página existe. Se decidió no integrar YouTube ni otros repositorios por ahora.

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
4. **Asignaturas:** Biología, Geología, Historia, Matemáticas, Lengua, Música y Arte. Solo se muestran las que tienen relación con el objeto (un plátano no muestra Música).
5. **Contenido:** explicación, curiosidades, enlaces a enciclopedias, objetos relacionados para seguir explorando y botón para escucharlo en voz alta (voz del propio dispositivo).
6. **Historial y compartir:** hay un historial de exploración guardado solo en el dispositivo y se puede compartir por la hoja nativa de compartir, WhatsApp o correo.
7. **Fotos de personas:** la app no las describe; muestra un aviso para que se fotografíen objetos.

## Reglas importantes
- **Nunca inventar URLs.** Los enlaces solo pueden ser de las enciclopedias permitidas (Vikidia, Klexikon, Wikipedia). La IA solo propone términos de búsqueda y el servidor comprueba que la página existe. No añadir otras fuentes (vídeos, YouTube, etc.) sin consultarlo.
- **La clave de OpenAI nunca debe llegar al frontend.** Todas las llamadas a OpenAI pasan por el backend Express.
- **Público infantil:** el contenido tiene que ser seguro, preciso y adaptado a la edad, con un tono amable, frases cortas y vocabulario sencillo.
- **Privacidad:** la app es individual, sin cuentas ni datos personales de menores. No se añaden analíticas, rastreadores ni funciones sociales sin consultarlo.
- **Rigor científico:** el contenido educativo debe ser correcto. Ante la duda, es mejor menos contenido que contenido dudoso.

## Diseño visual (mantener coherencia)
- **Tipografía:** Sofia Sans en toda la app.
- **Paleta cálida:** base crema y tinta, con tintes cálidos por asignatura. Usa siempre las variables de `src/styles.css` y los colores de `src/subjects.js`; no metas colores sueltos. Cualquier color nuevo de fondo debe tener contraste AA con el texto `--ink`.
- Formas redondeadas, botones grandes y fáciles de pulsar. Las asignaturas usan iconos de Material Design (decidido mantenerlos) y un color cálido cada una (`src/subjects.js`).
- La tipografía se sirve desde el propio proyecto (`public/fonts/`), no desde Google Fonts, para no enviar la IP de los niños a terceros.
- Nada de alertas rojas agresivas: texto oscuro sobre fondos suaves.
- Los textos de los paneles deben ajustarse bien en pantallas pequeñas.

## Forma de trabajar
- El autor es diseñador y docente, no desarrollador a tiempo completo. **Explica los cambios en español y de forma clara** antes de aplicarlos si son grandes.
- Trabajo solo en un prototipo: los commits pueden ir directamente a main. Para cambios grandes o arriesgados, propón crear una rama.
- Antes de actualizar dependencias o cambiar de modelo de IA, explica el impacto y pide confirmación.
- Después de cada cambio ejecuta `npm test` y `npm run lint`, y añade o actualiza tests cuando cambie el comportamiento.
- Cuando cierres una mejora relevante de diseño o de técnica, añade una entrada breve (fecha, qué se cambió y por qué) a `docs/ITERACIONES.md`.
