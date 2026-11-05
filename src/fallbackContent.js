// Offline content used when the AI server is unreachable or returns unusable output.
//
// These templates know nothing about the real object, so they never state facts about it
// ("it lives and grows" would be false for a bottle). Instead they explain what the subject
// looks at and propose questions and safe activities, so the child investigates.
// The object name never appears, which also avoids grammar problems (gender, articles).
const TEMPLATES = {
  es: {
    intro: 'Ahora no puedo preparar tu explicación, ¡pero puedes investigar tú! Aquí tienes algunas preguntas y actividades sobre tu objeto.',
    subjects: {
      biologia: {
        explanation: 'La biología estudia los seres vivos: plantas, animales, hongos y personas. Piensa en tu objeto: ¿es un ser vivo? ¿Lo fue alguna vez? ¿Está hecho de algo que vino de una planta o de un animal?',
        activities: ['Obsérvalo de cerca, con lupa si tienes, y dibuja los detalles que descubras.', 'Haz una lista de seres vivos que podrían usarlo, comerlo o vivir cerca de él.']
      },
      geologia: {
        explanation: 'La geología estudia la Tierra: las rocas, los minerales, el suelo y cómo cambian con el tiempo. Pregúntate: ¿de qué materiales está hecho tu objeto? ¿Alguno de ellos viene de debajo de la tierra?',
        activities: ['Toca tu objeto y describe su textura: ¿es duro o blando, rugoso o liso?', 'Investiga con un adulto de dónde salen los materiales con los que está hecho.']
      },
      historia: {
        explanation: 'La historia estudia cómo vivían las personas en el pasado. Pregúntate: ¿existía tu objeto hace cien años? ¿Y hace mil? ¿Cómo crees que era antes?',
        activities: ['Pregunta a una persona mayor si recuerda cómo era tu objeto cuando era pequeña.', 'Dibuja cómo crees que era tu objeto hace mucho tiempo y cómo será en el futuro.']
      },
      matematicas: {
        explanation: 'Las matemáticas nos ayudan a medir, contar y encontrar patrones. Pregúntate: ¿cuánto mide tu objeto? ¿Qué formas geométricas ves en él?',
        activities: ['Mide tu objeto con una regla o con tu mano y apunta el resultado.', 'Busca en él círculos, triángulos, rectángulos o formas que se repitan.']
      },
      lengua: {
        explanation: 'Con las palabras podemos describir el mundo y contar historias. Pregúntate: ¿qué palabras usarías para describir tu objeto a alguien que no puede verlo?',
        activities: ['Describe tu objeto con cinco adjetivos diferentes.', 'Inventa una historia corta en la que tu objeto sea el protagonista.']
      },
      musica: {
        explanation: 'La música se hace con sonidos, ritmos y silencios. Pregúntate: ¿tu objeto hace algún sonido? ¿Cómo sonaría si lo tocas suavemente?',
        activities: ['Con permiso de un adulto, prueba qué sonidos suaves puede hacer y crea un ritmo con ellos.', 'Inventa una canción corta con el nombre de tu objeto.']
      },
      artes: {
        explanation: 'En el arte observamos colores, formas y texturas para crear. Pregúntate: ¿qué colores tiene tu objeto? ¿Qué forma tiene si lo miras desde arriba?',
        activities: ['Dibuja tu objeto usando solo dos colores.', 'Haz una versión abstracta: dibuja solo sus formas principales.']
      }
    }
  },
  en: {
    intro: "I can't prepare your explanation right now, but you can investigate it yourself! Here are some questions and activities about your object.",
    subjects: {
      biologia: {
        explanation: 'Biology studies living things: plants, animals, fungi and people. Think about your object: is it alive? Was it ever alive? Is it made of something that came from a plant or an animal?',
        activities: ['Look at it closely, with a magnifying glass if you have one, and draw the details you find.', 'Make a list of living things that might use it, eat it or live near it.']
      },
      geologia: {
        explanation: 'Geology studies the Earth: rocks, minerals, soil and how they change over time. Ask yourself: what materials is your object made of? Do any of them come from under the ground?',
        activities: ['Touch your object and describe its texture: is it hard or soft, rough or smooth?', 'With an adult, find out where the materials it is made of come from.']
      },
      historia: {
        explanation: 'History studies how people lived in the past. Ask yourself: did your object exist a hundred years ago? A thousand years ago? What do you think it was like before?',
        activities: ['Ask an older person if they remember what your object was like when they were young.', 'Draw what you think your object looked like long ago and what it will look like in the future.']
      },
      matematicas: {
        explanation: 'Maths helps us measure, count and find patterns. Ask yourself: how big is your object? What shapes can you see in it?',
        activities: ['Measure your object with a ruler or your hand and write down the result.', 'Look for circles, triangles, rectangles or repeating shapes in it.']
      },
      lengua: {
        explanation: 'With words we can describe the world and tell stories. Ask yourself: what words would you use to describe your object to someone who cannot see it?',
        activities: ['Describe your object with five different adjectives.', 'Make up a short story where your object is the main character.']
      },
      musica: {
        explanation: 'Music is made of sounds, rhythms and silences. Ask yourself: does your object make any sound? What would it sound like if you tapped it gently?',
        activities: ['With an adult’s permission, try the gentle sounds it can make and create a rhythm with them.', 'Make up a short song with the name of your object.']
      },
      artes: {
        explanation: 'In art we look at colours, shapes and textures to create. Ask yourself: what colours does your object have? What shape is it when you look at it from above?',
        activities: ['Draw your object using only two colours.', 'Make an abstract version: draw only its main shapes.']
      }
    }
  },
  fr: {
    intro: 'Je ne peux pas préparer ton explication pour le moment, mais tu peux enquêter toi-même ! Voici des questions et des activités sur ton objet.',
    subjects: {
      biologia: {
        explanation: 'La biologie étudie les êtres vivants : plantes, animaux, champignons et humains. Pense à ton objet : est-il vivant ? L’a-t-il déjà été ? Est-il fait de quelque chose qui vient d’une plante ou d’un animal ?',
        activities: ['Observe-le de près, avec une loupe si tu en as une, et dessine les détails que tu découvres.', 'Fais une liste des êtres vivants qui pourraient l’utiliser, le manger ou vivre près de lui.']
      },
      geologia: {
        explanation: 'La géologie étudie la Terre : les roches, les minéraux, le sol et leurs changements. Demande-toi : de quelles matières ton objet est-il fait ? L’une d’elles vient-elle du sous-sol ?',
        activities: ['Touche ton objet et décris sa texture : est-il dur ou mou, rugueux ou lisse ?', 'Cherche avec un adulte d’où viennent les matières qui le composent.']
      },
      historia: {
        explanation: 'L’histoire étudie la vie des gens dans le passé. Demande-toi : ton objet existait-il il y a cent ans ? Et il y a mille ans ? Comment était-il avant ?',
        activities: ['Demande à une personne âgée si elle se souvient de ton objet quand elle était petite.', 'Dessine ton objet tel qu’il était il y a longtemps et tel qu’il sera dans le futur.']
      },
      matematicas: {
        explanation: 'Les mathématiques nous aident à mesurer, compter et trouver des motifs. Demande-toi : quelle taille fait ton objet ? Quelles formes géométriques vois-tu ?',
        activities: ['Mesure ton objet avec une règle ou avec ta main et note le résultat.', 'Cherche des cercles, des triangles, des rectangles ou des formes qui se répètent.']
      },
      lengua: {
        explanation: 'Avec les mots, on peut décrire le monde et raconter des histoires. Demande-toi : quels mots utiliserais-tu pour décrire ton objet à quelqu’un qui ne le voit pas ?',
        activities: ['Décris ton objet avec cinq adjectifs différents.', 'Invente une petite histoire dont ton objet est le héros.']
      },
      musica: {
        explanation: 'La musique est faite de sons, de rythmes et de silences. Demande-toi : ton objet fait-il un bruit ? Comment sonnerait-il si tu le tapotais doucement ?',
        activities: ['Avec la permission d’un adulte, essaie les sons doux qu’il peut faire et crée un rythme.', 'Invente une petite chanson avec le nom de ton objet.']
      },
      artes: {
        explanation: 'En art, on observe les couleurs, les formes et les textures pour créer. Demande-toi : quelles couleurs a ton objet ? Quelle forme a-t-il vu d’en haut ?',
        activities: ['Dessine ton objet avec seulement deux couleurs.', 'Fais une version abstraite : dessine seulement ses formes principales.']
      }
    }
  },
  de: {
    intro: 'Ich kann deine Erklärung gerade nicht vorbereiten, aber du kannst selbst forschen! Hier sind Fragen und Ideen zu deinem Gegenstand.',
    subjects: {
      biologia: {
        explanation: 'Die Biologie erforscht Lebewesen: Pflanzen, Tiere, Pilze und Menschen. Denk an deinen Gegenstand: Lebt er? Hat er einmal gelebt? Ist er aus etwas gemacht, das von einer Pflanze oder einem Tier stammt?',
        activities: ['Schau ihn dir genau an, mit einer Lupe, wenn du eine hast, und zeichne die Details.', 'Schreib auf, welche Lebewesen ihn benutzen, fressen oder in seiner Nähe leben könnten.']
      },
      geologia: {
        explanation: 'Die Geologie erforscht die Erde: Gesteine, Mineralien, den Boden und wie sie sich verändern. Frag dich: Aus welchen Materialien besteht dein Gegenstand? Kommt eines davon aus der Erde?',
        activities: ['Fühle deinen Gegenstand und beschreibe ihn: Ist er hart oder weich, rau oder glatt?', 'Finde mit einem Erwachsenen heraus, woher seine Materialien kommen.']
      },
      historia: {
        explanation: 'Die Geschichte erforscht, wie Menschen früher gelebt haben. Frag dich: Gab es deinen Gegenstand schon vor hundert Jahren? Vor tausend Jahren? Wie sah er früher aus?',
        activities: ['Frag einen älteren Menschen, wie dein Gegenstand früher aussah.', 'Zeichne, wie dein Gegenstand vor langer Zeit aussah und wie er in der Zukunft aussehen wird.']
      },
      matematicas: {
        explanation: 'Mathe hilft uns, zu messen, zu zählen und Muster zu finden. Frag dich: Wie groß ist dein Gegenstand? Welche Formen siehst du daran?',
        activities: ['Miss deinen Gegenstand mit einem Lineal oder deiner Hand und schreib das Ergebnis auf.', 'Such nach Kreisen, Dreiecken, Rechtecken oder Formen, die sich wiederholen.']
      },
      lengua: {
        explanation: 'Mit Wörtern können wir die Welt beschreiben und Geschichten erzählen. Frag dich: Mit welchen Wörtern würdest du deinen Gegenstand jemandem beschreiben, der ihn nicht sieht?',
        activities: ['Beschreibe deinen Gegenstand mit fünf verschiedenen Adjektiven.', 'Erfinde eine kurze Geschichte, in der dein Gegenstand die Hauptfigur ist.']
      },
      musica: {
        explanation: 'Musik besteht aus Klängen, Rhythmen und Pausen. Frag dich: Macht dein Gegenstand ein Geräusch? Wie klingt er, wenn du sanft darauf tippst?',
        activities: ['Probiere mit Erlaubnis eines Erwachsenen leise Klänge aus und mach daraus einen Rhythmus.', 'Erfinde ein kurzes Lied mit dem Namen deines Gegenstands.']
      },
      artes: {
        explanation: 'In der Kunst schauen wir auf Farben, Formen und Oberflächen, um etwas zu gestalten. Frag dich: Welche Farben hat dein Gegenstand? Welche Form hat er von oben gesehen?',
        activities: ['Zeichne deinen Gegenstand mit nur zwei Farben.', 'Mach eine abstrakte Version: Zeichne nur seine wichtigsten Formen.']
      }
    }
  }
};

/**
 * Offline lesson with the same shape as the AI one, minus the quiz: without the server we know
 * nothing true about the object, so there is no question with a "right answer" and no surprising
 * fact. The child gets questions about what the subject looks at and two safe activities.
 */
export function buildFallbackContent(subjectKey, lang) {
  const tpl = TEMPLATES[lang] || TEMPLATES.en;
  const block = tpl.subjects[subjectKey] || tpl.subjects.biologia;
  return {
    offline: true,
    intro: tpl.intro,
    pregunta_inicial: null,
    dato_sorprendente: null,
    por_que: block.explanation,
    reto: block.activities[0],
    reto_foto: false,
    otra_idea: block.activities[1],
    para_seguir_pensando: null,
    conexion_debil: false,
    objetos_relacionados: [],
    enlaces: []
  };
}
