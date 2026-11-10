# Iteraciones de Curiocity

Registro breve de las mejoras relevantes de diseño y de técnica: fecha, qué se cambió y por qué. Las entradas más recientes van arriba.

---

## 2026-11-10 — Elegir entre varios objetos de la foto (fase 6, parte A)

**Qué se cambió y por qué**
- **La detección devuelve hasta 4 objetos** con su posición aproximada (centro y tamaño, entre 0 y 1). El servidor valida la respuesta: recorta las posiciones, fusiona los nombres repetidos y descarta personas y partes del cuerpo en los 4 idiomas. El respaldo COCO-SSD usa sus cajas reales con los mismos límites. *Por qué:* antes la app decidía por el niño; con un perro junto a un árbol, a veces elegía el que no era.
- **Con varios objetos, el niño elige.** La foto ocupa todo el ancho, con un anillo crema sobre cada objeto y su nombre; debajo, "¿Qué quieres explorar?" y los mismos objetos como botones grandes, que son la vía accesible porque las posiciones son aproximadas. Con un solo objeto no cambia nada. "Volver" en las asignaturas vuelve a la elección, y el historial guarda el objeto elegido.
- **Personas:** nunca se ofrecen. Si junto a una persona hay objetos, se ofrecen los objetos; si solo hay personas, se mantiene el aviso.

**Cómo se probó:** 171 tests en verde (validación con 0, 1, 4 y 6 objetos, posiciones fuera de rango, repetidos y personas; respaldo COCO-SSD; interfaz), lint y build. Recorrido real con OpenAI y tres fotos de Wikimedia Commons (frutero, parque nevado con árbol y banco, escritorio). Capturas a 360 px en `capturas/fase-6/varios-objetos/`.

**Resultado de las posiciones:** razonables cuando los objetos están separados: el banco y el árbol del parque, y el portátil y los libros del escritorio. En el frutero, los anillos de las frutas se solapan y sus nombres se pisan, y la lámpara del escritorio queda algo desplazada. Los botones de debajo siempre funcionan.

---

## 2026-11-10 — Número variable de asignaturas destacadas e imágenes de ejemplo (fase 5)

**Qué se cambió y por qué**
- **Asignaturas destacadas:** ahora se destacan todas las que puntúan 2 o 3 (relación clara o muy fuerte), de mayor a menor y como mucho 4. Si ninguna llega a 2, solo la mejor. *Por qué:* destacar siempre 3 obligaba a subir asignaturas flojas en objetos con pocas relaciones claras. El prompt del ranking no relaja la exigencia: dice además que solo el 2 y el 3 se destacan, para que la IA no infle las notas.
- **Imagen de ejemplo en "¿Sabías que…?" y "¿Por qué?":**
  - La IA nunca propone URLs: solo un título de artículo para cada pantalla (`imagen_dato`, `imagen_porque`), o nada.
  - El servidor busca ese artículo con título exacto en las enciclopedias del idioma y toma **solo su imagen principal**. La acepta únicamente si está en Wikimedia Commons con autor y licencia, sale de `upload.wikimedia.org` y no es un mapa, bandera, escudo, diagrama, icono, logo, SVG ni una imagen pequeña.
  - La imagen va debajo del texto (primero estaba entre la etiqueta y el texto; se bajó tras revisar las capturas). Bajo la imagen, el crédito con autor, licencia y enlace al archivo. Si falla al cargar, desaparece sin dejar hueco.
  - *Por qué:* ver lo que cuenta el dato (por ejemplo, las semillas en estrella de una manzana) ayuda a entenderlo y a recordarlo.
- **Privacidad (decisión):** las imágenes se cargan directamente desde `upload.wikimedia.org`, sin cookies ni referer. Es la única excepción decidida a la regla de que el navegador solo habla con nuestro servidor. **Se descartó pasar las imágenes por nuestro servidor por sencillez y coste** (más tráfico y más código en el plan gratuito de Render). Wikimedia intenta poner cookies con las imágenes (una para contar visitantes únicos y otra con la ubicación aproximada), y `crossorigin="anonymous"` hace que el navegador ni las envíe ni las guarde.
- **Rigor:** en una primera ronda salieron imágenes sueltas (garrafas de agua para un dato sobre el fondo de una botella, un manzano genérico para un dato sobre los restos de la flor). Se endureció el prompt: el artículo tiene que tratar justo de lo que nombra el texto, nunca del propio objeto ni de algo parecido. Si no, mejor sin imagen.

**Cómo se probó:** 154 tests en verde (esquema, filtros, falta de autor o licencia, imagen que falla al cargar, de 0 a 6 asignaturas con puntuación 2 o más), lint y build. Recorrido real con manzana, botella y farola, OpenAI y Wikimedia reales. Capturas a 360 px en `capturas/fase-5/`.

**Pendiente:**
- Pocas lecciones tienen imagen: 2 de 12 pantallas en la prueba. Muchos artículos no existen con ese título exacto, y en Commons falta a veces el autor.
- La IA puede elegir un artículo que no corresponde exactamente al texto, y el servidor no lo puede comprobar. Ejemplo: "Manzano silvestre" (el europeo) para un dato sobre los manzanos de Kazajistán.
- Revisar una muestra con docentes.

---

## 2026-11-09 — Rediseño C: páginas a pantalla completa, titulares como el logo y botones ligeros (fase 4)

Rama `feature/rediseno-c`. El rediseño se hizo en Claude Design: se probaron dos alternativas, A y B, y la C es la síntesis que se aplica aquí (capturas de referencia en `capturas/diseno-c/`).

**Por qué**
- **Pantallas recargadas y poco aire** entre componentes: tarjetas de color, cajas y etiquetas en mayúsculas competían entre sí.
- **Panel frente a página:** el panel inferior dejaba poco sitio, con la cámara asomando detrás. Una página a pantalla completa da más espacio y una navegación más clara.
- **Tipografía alejada del logo:** con Literata en todo, nada recordaba al trazo fino y condensado del logotipo.
- **Peso de los botones negros:** tiraban de la vista más que el propio contenido.
- **Logo superior innecesario:** la pastilla con "curiocity" ocupaba sitio en todas las pantallas sin aportar.

**Qué se cambió**
- **Páginas a pantalla completa** para asignaturas, lección, historial y avisos, en lugar del panel inferior. La cámara sigue siendo la pantalla de inicio y queda inerte mientras hay una página abierta. Navegación con círculos de contorno e iconos de trazo fino.
- **Vuelve Sofia Sans Condensed**, solo para los titulares que hacen eco del logo: el nombre del objeto en minúsculas (salvo en alemán), las asignaturas y la pastilla de la lección. Literata sigue para la lectura, y se añade su cursiva para las etiquetas de apoyo. Las dos fuentes están alojadas en el proyecto, sin peticiones a Google.
- **Sin botones negros:** píldora de papel con borde de tinta, píldora de línea fina y círculos de contorno.
- **Asignaturas como lista** con líneas finas, y la foto en un círculo con anillo, como el visor.
- **Lección sobre el fondo crema:** el color de la asignatura queda solo en la pastilla de arriba, con progreso en segmentos.
- **Cámara sin logo:** los ojos en crema como marca, el texto en cursiva bajo el visor y un disparador nuevo.

**Ajustes tras probar el prototipo (mismo PR)**
- **"¿Sabías que…?" y "¿Por qué?" con la misma composición:** Curi arriba (quieto en el dato, pensando en el porqué), la etiqueta en cursiva y el texto al mismo tamaño, 22,5 px / 1,4 (el dato baja de 27 px). A 360 px el porqué cabe; si fuera más largo, la pantalla hace scroll y no se corta.
- **Navegación más simple:** arriba solo quedan la pastilla, centrada, y la X, que ahora sale de la lección y vuelve a las asignaturas. El círculo "Anterior" está en todas las pantallas; en la primera vuelve a las asignaturas.
- **Final en dos pantallas (6 en total):** "Para seguir pensando" muestra solo la pregunta y las ideas. "Sigue explorando" lleva a Curi contento y, en este orden, las otras asignaturas, los objetos relacionados, las enciclopedias y compartir. Abajo, "Hacer otra foto" en lugar de "Siguiente". *Por qué:* la tarjeta final mezclaba la pregunta para pensar con todo lo demás y quedaba larguísima.

**Cómo se probó:** 132 tests en verde (incluido uno nuevo de contraste), lint y build. Capturas de los ajustes (pantallas 2 a 6, manzana y farola, 360 y 390 px) en `capturas/fase-4/ajustes/`. Capturas a 360 y 390 px de todas las pantallas con manzana, botella y farola (`capturas/fase-4/`), con el servidor y OpenAI reales: nada se sale de la pantalla y ninguna petición va a Google. Contraste mínimo de 4,5:1: tinta suave sobre crema (6,6:1), tinta sobre cada tinte (8,7:1 o más) y opciones no elegidas de la pregunta (se subió su opacidad para llegar).

---

## 2026-11-07 — Reto simplificado: una sola conclusión, "lo que podías descubrir"

Rama `feature/reto-simplificado`. Al revisar los 9 retos con observación de la fase 3 (`retos-e-ideas-v3.json`), solo unos 4 aportaban algo.

**Por qué se simplifica**
- **La opción "no lo vi"** llevaba casi siempre a una conclusión vacía ("puede que no se vea bien").
- **Obviedades:** algunas conclusiones solo describían lo que el niño ya había visto.
- **Retos fuera de la asignatura:** algunos retos de Historia no miraban el pasado (buscar la etiqueta, ver cables).

**Qué se cambió**
- Fuera las opciones. `reto_observacion` se sustituye por `reto_descubrimiento`: 1 o 2 frases con algo nuevo y cierto (el porqué, la causa o el origen) de lo que el reto pide observar, que vale lo encuentre o no el niño.
- El reto tiene que mirar algo con sentido desde la asignatura. En Historia, una pista del pasado en el propio objeto (forma, material, uniones, desgaste, diseño antiguo), nunca etiquetas, envoltorios ni cables.
- En la tarjeta del reto, "¡Reto hecho!" y "No lo he encontrado" muestran la misma conclusión, con Curi en "done" o en "idle": nada suena a fallo. Sin conclusión, un mensaje amable.

**Cómo se probó:** se generaron de nuevo las 9 lecciones con OpenAI real (`capturas/fase-3/retos-v4.json`) y se hicieron capturas a 360 px de la tarjeta del reto (`capturas/fase-3/reto-v4/`). En un primer intento, la manzana en Historia volvió a pedir una etiqueta, y se concretó la regla de Historia en el prompt. Quedan flojos Matemáticas de la manzana (una idea casi obvia) y Biología de la botella (más reciclaje que biología, porque la relación con la asignatura es débil).

---

## 2026-11-07 — Iconos de la app: fondo opaco y ojos dentro de la zona segura

Los iconos tenían los ojos de borde a borde (Android los cortaba al recortar en círculo) y la zona de los ojos era transparente (en fondos oscuros no se veían e iOS la rellenaba de negro). Ahora son crema opaco, con los ojos al 60 % del ancho (80 % en los favicons, con el trazo algo más grueso para que se vea a 16 px). Hay iconos *maskable* nuevos con los ojos al 50 %, y la caché del service worker pasa a v3 para que los móviles reciban los iconos nuevos.

---

## 2026-11-06 — Ajustes tras probar la fase 2: sin voz, 8–10 años, Literata en toda la app (fase 3)

Rama `feature/fase-3-ajustes`. Ajustes tras probar la fase 2 con la app real.

**Qué se cambió y por qué**

- **Se quita la voz** (lectura automática, botón "Voz" y botones "Escuchar"). *Por qué:* la voz del dispositivo suena robótica y a los niños les daba miedo. Al arrancar se borra la clave `curiocity_voice`. *Descartadas:* una voz más natural con un servicio externo (por coste y por privacidad: el texto saldría a otro proveedor) y los sonidos en las interacciones (aplazados).
- **Público de 8 a 10 años** (3º y 4º de Primaria), sin selector ni franjas de edad. Una sola guía de edad en los prompts y un solo tamaño de texto (18,5 px / 1,5). El servidor deja de usar `ageGroup`, también en la clave de la caché. Al arrancar se borra la clave `curiocity_age`. *Por qué:* un público concreto permite afinar mejor el contenido, y el selector añadía una decisión que los niños no necesitaban. *Descartada:* mantener las dos franjas.
- **Literata en toda la app**, con una sola variable (`--font`). Se quitan Sofia Sans y su licencia (`sofia-sans-latin.woff2`, `sofia-sans-latin-ext.woff2`, `OFL.txt`); se precarga Literata. Revisado a 360 px: botones a peso 600, mayúsculas con menos espaciado (0,05em) y cifras alineadas. *Por qué:* una sola tipografía da una voz más coherente y cálida a toda la app.
- **"Míralo desde otra asignatura"** ofrece solo las otras asignaturas destacadas, con su gancho, sin las ya vistas de ese objeto. Si no queda ninguna o no hay ranking, invita a hacer otra foto. *Por qué:* ofrecer las 7 llevaba a asignaturas con poca relación con el objeto.
- **Experimental: pregunta de observación tras el reto** (`reto_observacion`). Opciones sin acierto ni error, cada una con una conclusión general en condicional, porque la IA no ve el objeto. **Ideas para la pregunta final** (`ideas_pregunta_final`), presentadas como posibilidades tras "Piénsalo un momento…". Si faltan, se reintenta una vez y, si no, la lección funciona como antes. *Por qué:* que el reto y la pregunta final tengan respuesta y no se queden en el aire. Queda en prueba hasta valorar los retos que salen.
- **Compartir:** WhatsApp, Correo y "Más…" siempre a la vista; solo "Más…" (hoja del sistema) adjunta la foto. El texto compartido sigue la nueva lección (objeto · asignatura, pregunta y respuesta, dato y Curiocity).
- **Rigor botánico:** regla general en el prompt sobre qué parte de la flor forma cada fruto. La lección de Biología de la manzana ya dice que la pulpa viene de la base de la flor (receptáculo) y el centro con las pepitas, del ovario.
- **Sin cambios** en la detección, el modelo, las enciclopedias, la cámara ni Curi.

**Cómo se probó:** 107 tests en verde, lint y build. Recorrido completo a 360 px con el servidor real y OpenAI real con manzana, botella y farola, en las 3 asignaturas destacadas de cada una (9 lecciones). Las 9 trajeron pregunta de observación e ideas. No se sale nada de la pantalla, no hay peticiones a Google y no aparece el selector de edad. Capturas y JSON en `capturas/fase-3/` (fuera del repositorio).

**Ajuste del prompt del reto con observación.** En la primera prueba, varias opciones eran comodines ("Otro detalle", "No estoy seguro") y algunas conclusiones solo repetían la opción. El prompt ahora:
- prohíbe las opciones comodín;
- pide que cada conclusión explique algo nuevo y cierto (la causa o el porqué de lo observado);
- pide retos con un resultado concreto, sin salir de la asignatura. Un primer intento solo con "resultado concreto" convertía retos de Historia y Biología en "compara su altura con tu mano", y por eso se añadió esta condición.

Se volvieron a generar las 9 lecciones: las opciones son concretas y las conclusiones explican el porqué (`capturas/fase-3/retos-e-ideas-v3.json`; la primera versión está en `retos-e-ideas.json`).

**Pendiente:** decidir si el reto con observación se queda.

---

## 2026-11-05 — Interfaz de la lección: tarjetas, Curi, Literata y voz (fase 2)

Rama `feature/fase-2-interfaz`. Objetivo: que la mini-lección sea más visual, más fácil de seguir para quien todavía lee con dificultad (6–8 años) y con más personalidad, sin perder la identidad de la marca.

**Qué se cambió y por qué**

- **Literata para el texto de la lección** (variable `--font-content`). Sofia Sans se queda en la interfaz. Versión variable con tamaño óptico (110 KB latin, 90 KB latin-ext), alojada en el proyecto con su licencia OFL. Se carga al abrir la primera lección y no se precarga. Texto a 20 px / 1,55 en 6–8 y a 17,5 px / 1,5 en 9–12. *Por qué:* una serifa de lectura, abierta y robusta, ayuda a quien empieza a leer y separa visualmente "lo que se lee" de "lo que se pulsa". *Descartadas:* Computer Modern / Latin Modern (demasiado fina en pantalla para quien empieza a leer) y STIX Two (demasiado seria).
- **Curi, la mascota.** Solo los ojos del logo (O y C con sus pupilas) y una boca de una única línea continua. Tiene 5 estados: espera, pensando, acierto, ¡casi! y reto hecho. Aparece en las esperas, en la respuesta, en el reto y en el historial vacío. *Por qué:* da personalidad y feedback emocional sin añadir un personaje nuevo a la marca. El "¡casi!" anima, nunca entristece. *Descartadas:* una mascota con cuerpo ("bichito") o con forma de lupa, porque se alejaban del logo.
- **Lección en tarjetas,** una idea por tarjeta: pregunta → dato → porqué → reto → final. Lleva puntos de progreso, botones grandes "Anterior" / "Siguiente" fijos abajo y se puede deslizar con el dedo. La pregunta no deja avanzar sin responder. Se quita "Ahora no" del reto. *Por qué:* antes la lección se desplegaba hacia abajo en una columna larga; una tarjeta cada vez es más fácil de seguir a los 6–8 años.
- **Voz más presente.** Botón "Voz" guardado en el dispositivo. En 6–8, cada tarjeta se lee sola al aparecer; en 9–12, la voz está desactivada por defecto. *Por qué:* que quien aún no lee con soltura pueda seguir la lección sin depender de un adulto.
- **Ajustes de la fase 1.** La edad por defecto es 6–8 también en el servidor. El aviso de relación débil queda solo en la primera frase del porqué (se quita la nota de la interfaz, que era genérica y salía antes de la pregunta).
- **Sin cambios** en los prompts, la detección, el modelo, las enciclopedias ni la cámara.

**Cómo se probó:** tests nuevos de tarjetas, Curi y voz (89 tests en verde), lint y build. Recorrido completo a 360 px con el servidor real, OpenAI real y la cámara simulada con la foto de una manzana, en las dos franjas de edad. No se sale nada de la pantalla y las peticiones de red van solo al propio servidor (ninguna a Google). Capturas guardadas fuera del repositorio, en `capturas/fase-2/`.

**Pendiente:** probarlo con niños y niñas, sobre todo la lectura automática y el deslizamiento, y probar en iPhone (Safari no anima el cambio de boca de Curi, solo lo cambia). Sigue apareciendo la simplificación "la manzana se forma del ovario" (en la manzana, la parte carnosa viene sobre todo del receptáculo): conviene revisarla en el prompt en una fase de contenidos.

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
