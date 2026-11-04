// Offline templates used when the AI server is unreachable or returns unusable output.
// o = object name, s = translated subject label.
const TEMPLATES = {
  en: {
    title: (s, o) => `${s}: getting to know ${o}`,
    intro: (s, o) => `Let's discover what ${o} is and why it's interesting from the ${s} perspective.`,
    subjects: {
      biologia: {
        explanation: o => `${o} can be part of nature. We can observe how it lives, what it needs and how it grows. In biology we study bodies, life cycles and habitats to understand how living things interact.`,
        funFacts: o => [`Observing ${o} can teach us about adaptation and survival.`, 'Try simple experiments to see how it reacts to light, water or food.']
      },
      geologia: {
        explanation: o => `${o} can tell stories about the Earth. In geology we look at what it is made of, how it formed and what signs it leaves on the landscape.`,
        funFacts: o => [`Sometimes ${o} is made from materials that formed millions of years ago.`, 'Its shape and texture help us understand processes like erosion or sedimentation.']
      },
      historia: {
        explanation: o => `${o} can be a clue to the past. In history we investigate who used it, when and why. Objects help us imagine how people lived before.`,
        funFacts: () => ['A simple object can reveal customs, technology or art from other times.', 'Ask: who made it? What was it used for?']
      },
      matematicas: {
        explanation: o => `With maths we can measure ${o}, count its parts, compare sizes and look for patterns. Numbers and shapes help us describe it precisely.`,
        funFacts: o => ['Measure its length, height or volume with a ruler or a measuring cup.', `Looking for patterns in ${o} (like repeated shapes) is a great logic exercise.`]
      },
      lengua: {
        explanation: o => `We can write a story or poem about ${o}. Describe it with adjectives, comparisons and questions to practise expressing yourself.`,
        funFacts: o => [`Describe ${o} with five different adjectives.`, `Invent a story where ${o} is the main character.`]
      },
      musica: {
        explanation: o => `In music we can think about the sounds ${o} reminds us of. Maybe it has a rhythm or tone that could inspire a melody.`,
        funFacts: o => [`Imagine which instrument would sound like ${o} and clap a rhythm.`, 'Turn its name into a short song or chorus.']
      },
      artes: {
        explanation: o => `In art we can draw, paint or sculpt ${o}. Look at its colours, textures and shapes to create a work inspired by it.`,
        funFacts: o => [`Draw ${o} using only two colours.`, 'Create an abstract version focusing on its shapes.']
      }
    }
  },
  es: {
    title: (s, o) => `${s}: conociendo ${o}`,
    intro: (s, o) => `Descubramos qué es ${o} y por qué es interesante desde ${s}.`,
    subjects: {
      biologia: {
        explanation: o => `${o} puede ser parte de la naturaleza. Podemos observar cómo vive, qué necesita y cómo crece. En biología estudiamos cuerpos, ciclos de vida y hábitats para entender cómo se relacionan los seres vivos.`,
        funFacts: o => [`Observar ${o} puede enseñarnos sobre adaptación y supervivencia.`, 'Haz experimentos sencillos para ver cómo reacciona a la luz, el agua o la comida.']
      },
      geologia: {
        explanation: o => `${o} puede contar historias de la Tierra. En geología miramos de qué está hecho, cómo se formó y qué señales deja en el paisaje.`,
        funFacts: o => [`A veces ${o} está hecho de materiales formados hace millones de años.`, 'Su forma y textura ayudan a entender procesos como la erosión o la sedimentación.']
      },
      historia: {
        explanation: o => `${o} puede ser una pista del pasado. En historia investigamos quién lo usó, cuándo y por qué. Los objetos nos ayudan a imaginar cómo vivía la gente antes.`,
        funFacts: () => ['Un objeto sencillo puede mostrar costumbres, tecnología o arte de otras épocas.', 'Pregunta: ¿quién lo hizo? ¿Para qué se usaba?']
      },
      matematicas: {
        explanation: o => `Con las matemáticas podemos medir ${o}, contar sus partes, comparar tamaños y buscar patrones. Los números y las formas nos ayudan a describirlo con precisión.`,
        funFacts: o => ['Mide su largo, alto o volumen con una regla o un recipiente.', `Buscar patrones en ${o} (formas repetidas) es un gran ejercicio de lógica.`]
      },
      lengua: {
        explanation: o => `Podemos escribir un cuento o un poema sobre ${o}. Descríbelo con adjetivos, comparaciones y preguntas para practicar la expresión.`,
        funFacts: o => [`Describe ${o} con cinco adjetivos diferentes.`, `Inventa una historia donde ${o} sea el personaje principal.`]
      },
      musica: {
        explanation: o => `En música podemos pensar qué sonidos nos recuerda ${o}. Tal vez tiene un ritmo o un tono que inspire una melodía.`,
        funFacts: o => [`Imagina qué instrumento sonaría como ${o} y marca un ritmo.`, 'Convierte su nombre en una pequeña canción o estribillo.']
      },
      artes: {
        explanation: o => `En arte podemos dibujar, pintar o esculpir ${o}. Observa sus colores, texturas y formas para crear una obra inspirada en él.`,
        funFacts: o => [`Dibuja ${o} usando solo dos colores.`, 'Crea una versión abstracta fijándote en sus formas.']
      }
    }
  },
  fr: {
    title: (s, o) => `${s} : découvrir ${o}`,
    intro: (s, o) => `Découvrons ce qu'est ${o} et pourquoi c'est intéressant en ${s}.`,
    subjects: {
      biologia: {
        explanation: o => `${o} peut faire partie de la nature. On peut observer comment il vit, ce dont il a besoin et comment il grandit. En biologie, on étudie les corps, les cycles de vie et les habitats.`,
        funFacts: o => [`Observer ${o} peut nous apprendre l'adaptation et la survie.`, "Fais des expériences simples pour voir sa réaction à la lumière, à l'eau ou à la nourriture."]
      },
      geologia: {
        explanation: o => `${o} peut raconter l'histoire de la Terre. En géologie, on regarde de quoi il est fait, comment il s'est formé et quelles traces il laisse.`,
        funFacts: o => [`Parfois ${o} est fait de matériaux très anciens.`, "Sa forme et sa texture aident à comprendre l'érosion ou la sédimentation."]
      },
      historia: {
        explanation: o => `${o} peut être un indice du passé. En histoire, on cherche qui l'a utilisé, quand et pourquoi.`,
        funFacts: () => ["Un objet simple peut révéler des coutumes, des technologies ou de l'art d'autrefois.", "Demande : qui l'a fabriqué ? À quoi servait-il ?"]
      },
      matematicas: {
        explanation: o => `En mathématiques, on peut mesurer ${o}, compter ses parties, comparer des tailles et chercher des motifs.`,
        funFacts: o => ['Mesure sa longueur, sa hauteur ou son volume.', `Chercher des motifs dans ${o} est un bon exercice de logique.`]
      },
      lengua: {
        explanation: o => `On peut écrire une histoire ou un poème sur ${o}. Décris-le avec des adjectifs et des comparaisons.`,
        funFacts: o => [`Décris ${o} avec cinq adjectifs différents.`, `Invente une histoire où ${o} est le personnage principal.`]
      },
      musica: {
        explanation: o => `En musique, on peut imaginer les sons que ${o} évoque. Peut-être un rythme ou une mélodie.`,
        funFacts: o => [`Imagine quel instrument ressemblerait à ${o} et tape un rythme.`, 'Transforme son nom en une petite chanson.']
      },
      artes: {
        explanation: o => `En art, on peut dessiner, peindre ou sculpter ${o}. Observe ses couleurs, ses textures et ses formes.`,
        funFacts: o => [`Dessine ${o} avec seulement deux couleurs.`, 'Crée une version abstraite centrée sur ses formes.']
      }
    }
  },
  de: {
    title: (s, o) => `${s}: ${o} entdecken`,
    intro: (s, o) => `Entdecken wir, was ${o} ist und warum es im Fach ${s} spannend ist.`,
    subjects: {
      biologia: {
        explanation: o => `${o} kann ein Teil der Natur sein. Wir können beobachten, wie es lebt, was es braucht und wie es wächst. In der Biologie untersuchen wir Körper, Lebenszyklen und Lebensräume.`,
        funFacts: o => [`Durch das Beobachten von ${o} lernen wir etwas über Anpassung und Überleben.`, 'Probiere einfache Experimente mit Licht, Wasser oder Nahrung.']
      },
      geologia: {
        explanation: o => `${o} kann Geschichten über die Erde erzählen. In der Geologie schauen wir, woraus es besteht und wie es entstanden ist.`,
        funFacts: () => ['Manche Dinge bestehen aus Materialien, die vor Millionen Jahren entstanden sind.', 'Form und Oberfläche helfen, Erosion oder Ablagerung zu verstehen.']
      },
      historia: {
        explanation: o => `${o} kann ein Hinweis auf die Vergangenheit sein. In Geschichte fragen wir: Wer hat es benutzt, wann und warum?`,
        funFacts: () => ['Ein einfaches Objekt zeigt Bräuche, Technik oder Kunst von früher.', 'Frage: Wer hat es gemacht? Wozu diente es?']
      },
      matematicas: {
        explanation: o => `In Mathe messen wir ${o}, zählen Teile, vergleichen Größen und suchen Muster.`,
        funFacts: o => ['Miss Länge, Höhe oder Volumen mit Lineal oder Messbecher.', `Muster in ${o} zu finden ist ein gutes Logiktraining.`]
      },
      lengua: {
        explanation: o => `Wir können eine Geschichte oder ein Gedicht über ${o} schreiben und es mit Adjektiven beschreiben.`,
        funFacts: o => [`Beschreibe ${o} mit fünf verschiedenen Adjektiven.`, `Erfinde eine Geschichte, in der ${o} die Hauptfigur ist.`]
      },
      musica: {
        explanation: o => `In Musik überlegen wir, an welche Klänge uns ${o} erinnert. Vielleicht an einen Rhythmus oder eine Melodie.`,
        funFacts: o => [`Stell dir ein Instrument vor, das wie ${o} klingt, und klatsche einen Rhythmus.`, 'Mach aus dem Namen eine kleine Melodie.']
      },
      artes: {
        explanation: o => `In Kunst können wir ${o} zeichnen, malen oder modellieren. Achte auf Farben, Texturen und Formen.`,
        funFacts: o => [`Zeichne ${o} nur mit zwei Farben.`, 'Erstelle eine abstrakte Version, die die Formen betont.']
      }
    }
  }
};

export function buildFallbackContent(objectName, subjectKey, subjectLabel, lang) {
  const tpl = TEMPLATES[lang] || TEMPLATES.en;
  const block = tpl.subjects[subjectKey] || tpl.subjects.biologia;
  return {
    title: tpl.title(subjectLabel, objectName),
    text: tpl.intro(subjectLabel, objectName),
    explanation: block.explanation(objectName),
    funFacts: block.funFacts(objectName),
    links: [],
    relatedObjects: [],
    offline: true
  };
}
