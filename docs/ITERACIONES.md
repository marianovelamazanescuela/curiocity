# Iteraciones de Curiocity

Registro breve de las mejoras relevantes de diseño y de técnica: fecha, qué se cambió y por qué. Las entradas más recientes van arriba.

---

## 2026-11-04 — Contenidos que despiertan curiosidad (fase 1)

Rama `feature/contenidos-interesantes`. Respuesta al jurado de Ciencia en Acción: "el interés de algunos contenidos no es muy grande".

**Qué se cambió y por qué**

- **Las 3 asignaturas con más relación, destacadas y con un gancho.** El modelo puntúa de 0 a 3 la relación del objeto con cada asignatura y escribe una frase que invita a entrar (farola → Historia: "Antes, las farolas se encendían una a una al caer la noche"). El resto queda en "Más asignaturas". *Por qué:* antes todas salían al mismo nivel y sin ninguna razón para elegir una, y las de relación débil daban textos forzados.
- **De la explicación a la mini-lección interactiva.** Pregunta con 3 opciones antes de explicar nada → dato sorprendente → porqué breve → reto de un minuto con el objeto real → pregunta para seguir pensando. *Por qué:* el texto tipo enciclopedia era pasivo; adivinar antes de leer y hacer algo con el objeto invitan a participar.
- **Reglas del prompt:** adaptación a 6–8 y 9–12 años; datos comprobables y nada de explicaciones que la ciencia aún discute; si la relación es floja, decirlo; retos seguros (sin tocar animales, probar cosas, acercarse al tráfico, usar herramientas ni abrir el objeto); contexto de Sevilla solo cuando encaje.
- **JSON con esquema estricto, validado en el servidor y con un reintento.** Las opciones se barajan en el servidor. Si falla, el contenido sin conexión no lleva pregunta ni dato.
- **Se mantienen** la detección, el modelo (`gpt-6-luna`), las enciclopedias y el selector de edad del panel. La app no busca vídeos por ahora.

**Cómo se probó:** manzana, botella y farola, en las dos franjas de edad, con la app completa en local (fotos reales, OpenAI real). Se hicieron cinco rondas de ajuste del prompt hasta quitar los fallos de la primera (Biología favorecida por ser la primera de la lista, preguntas mal construidas, un dato discutido sobre insectos y farolas).

**Pendiente:** revisar con docentes una muestra de lecciones. Ejemplo de simplificación encontrada: "la pulpa de la manzana viene del ovario" (en la manzana viene sobre todo del receptáculo). Probarlo con niños y niñas, y la fase 2 de rediseño visual.

---

## 2026-11-04 — Revisión completa: seguridad, rediseño, rigor del contenido y nuevo modelo de IA

Diez commits (`b79de67` → `9245b57`) a partir del estado del 13-02-2026 (`f6c8703`).

**Qué se cambió y por qué**

- **Seguridad del servidor** (`b79de67`). El servidor ya solo acepta peticiones de la propia app, tiene un límite de peticiones, solo admite fotos en formato imagen y textos cortos, y la caché tiene un tamaño máximo. *Por qué:* cualquiera podía usar la API de OpenAI del proyecto desde fuera.
- **Migración de Create React App a Vite** (`6bf7a00`). *Por qué:* Create React App está abandonado. Las vulnerabilidades de las dependencias pasan de 68 a 0.
- **Rediseño de la interfaz y reorganización del código** (`16cea32`). Diseño basado en la marca (crema, tinta, "ojos" del logo), panel inferior accesible y el archivo de 1.350 líneas dividido en módulos, sin MUI. *Por qué:* coherencia visual, accesibilidad y un código mantenible. La carga inicial pasa de 1,4 MB a 232 KB.
- **Tipografía Sofia Sans** (`4eb77ad`), alojada en el propio proyecto (`dac39b1`). *Por qué:* lo pide la guía de diseño, y servirla desde aquí evita enviar la IP de los niños a Google Fonts.
- **Rigor del contenido** (`b459c79`). Los enlaces salen de enciclopedias reales (Vikidia, Klexikon, Wikipedia) en lugar de generarlos la IA, se baja la temperatura del modelo, las fotos de personas no se describen y las plantillas sin conexión pasan a ser preguntas y actividades. *Por qué:* cumplir las reglas "nunca inventar URLs" y "mejor menos contenido que contenido dudoso".
- **Asignaturas relevantes, historial local y paleta cálida** (`58549db`). *Por qué:* lo pide el flujo de la app (un plátano no muestra Música). El historial se guarda solo en el dispositivo, por privacidad.
- **Lectura en voz alta, selector de edad (6–8 / 9–12) y PWA que abre sin conexión** (`fbe1098`). *Por qué:* hay niños de 6–7 años que aún leen con dificultad, y el texto debe adaptarse a la edad.
- **Documentación** (`a22e7ca`). `CLAUDE.md` entra en el repositorio y se reescribe el README. *Por qué:* dejar por escrito la arquitectura y las decisiones del proyecto.
- **Cambio de modelo de `gpt-4o-mini` a `gpt-6-luna`** (`9245b57`), y una búsqueda en enciclopedias más estricta. *Por qué:* OpenAI retira `gpt-4o-mini` el 14-01-2027. En una comparación con 10 fotos y 5 textos reales, la detección fue equivalente y los textos más rigurosos y mejor adaptados a la edad.

**Decisiones de no hacer:** no se integran vídeos de YouTube, Khan Academy ni repositorios OER; no se ajusta el límite de peticiones para el aula, porque la app no se usará allí; no se añade un selector manual de idioma; se mantienen los iconos de Material Design.

**Pendiente:** probar en móviles reales (sobre todo iPhone); alojar en el proyecto el modelo de reconocimiento local de respaldo, que ahora se descarga de servidores de Google; tener en cuenta el arranque lento del plan gratuito de Render en las demostraciones.
