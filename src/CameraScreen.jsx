import React, { useRef, useEffect, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { MdScience, MdTerrain, MdHistoryEdu, MdCalculate, MdMenuBook, MdMusicNote, MdBrush, MdShare } from 'react-icons/md';

const PROXY_BASE = import.meta.env.VITE_AI_PROXY_URL || '';
const buildProxyUrl = (path) => `${PROXY_BASE.replace(/\/$/, '')}${path}`;

// Translation dictionaries for different languages
const translations = {
    en: {
        loading: 'Loading educational content...',
        detected: 'I detected a',
        explore: 'in your image! Choose a subject to explore and learn more about it.',
        noObject: 'No object detected',
        noObjectDesc: 'No main object could be identified in the photo.',
        detectionError: 'Detection error',
        detectionErrorDesc: 'Could not analyze the image.',
        funFacts: 'Fun facts:',
        recommendedResources: 'Recommended resources:',
        relatedObjects: 'Related objects:',
        shareContent: 'Share content',
        shareViaEmail: 'Email',
        shareViaWhatsApp: 'WhatsApp',
        close: 'Close',
        retake: 'Retake photo',
        Biology: 'Biology',
        Geology: 'Geology',
        History: 'History',
        Mathematics: 'Mathematics',
        'Language Arts': 'Language Arts',
        Music: 'Music',
        Art: 'Art'
    },
    es: {
        loading: 'Cargando contenido educativo...',
        detected: 'He detectado',
        explore: 'en tu imagen! Elige una asignatura para explorar y aprender más sobre ello.',
        noObject: 'Sin objeto detectado',
        noObjectDesc: 'No se ha podido identificar ningún objeto principal en la foto.',
        detectionError: 'Error de detección',
        detectionErrorDesc: 'No se pudo analizar la imagen.',
        funFacts: 'Datos curiosos:',
        recommendedResources: 'Recursos recomendados:',
        relatedObjects: 'Objetos relacionados:',
        shareContent: 'Compartir contenido',
        shareViaEmail: 'Correo electrónico',
        shareViaWhatsApp: 'WhatsApp',
        close: 'Cerrar',
        retake: 'Tomar otra foto',
        Biology: 'Biología',
        Geology: 'Geología',
        History: 'Historia',
        Mathematics: 'Matemáticas',
        'Language Arts': 'Lengua',
        Music: 'Música',
        Art: 'Arte'
    },
    fr: {
        loading: 'Chargement du contenu éducatif...',
        detected: 'J\'ai détecté',
        explore: 'dans votre image! Choisissez une matière pour explorer et en savoir plus.',
        noObject: 'Aucun objet détecté',
        noObjectDesc: 'Aucun objet principal n\'a pu être identifié dans la photo.',
        detectionError: 'Erreur de détection',
        detectionErrorDesc: 'Impossible d\'analyser l\'image.',
        funFacts: 'Faits amusants:',
        recommendedResources: 'Ressources recommandées:',
        relatedObjects: 'Objets connexes:',
        shareContent: 'Partager le contenu',
        shareViaEmail: 'Email',
        shareViaWhatsApp: 'WhatsApp',
        close: 'Fermer',
        retake: 'Reprendre la photo',
        Biology: 'Biologie',
        Geology: 'Géologie',
        History: 'Histoire',
        Mathematics: 'Mathématiques',
        'Language Arts': 'Lettres',
        Music: 'Musique',
        Art: 'Art'
    },
    de: {
        loading: 'Bildungsinhalte werden geladen...',
        detected: 'Ich habe',
        explore: 'in Ihrem Bild erkannt! Wählen Sie ein Fach, um mehr zu erfahren.',
        noObject: 'Kein Objekt erkannt',
        noObjectDesc: 'Es konnte kein Hauptobjekt im Foto identifiziert werden.',
        detectionError: 'Erkennungsfehler',
        detectionErrorDesc: 'Das Bild konnte nicht analysiert werden.',
        funFacts: 'Lustige Fakten:',
        recommendedResources: 'Empfohlene Ressourcen:',
        relatedObjects: 'Verwandte Objekte:',
        shareContent: 'Inhalt teilen',
        shareViaEmail: 'E-Mail',
        shareViaWhatsApp: 'WhatsApp',
        close: 'Schließen',
        retake: 'Foto erneut aufnehmen',
        Biology: 'Biologie',
        Geology: 'Geologie',
        History: 'Geschichte',
        Mathematics: 'Mathematik',
        'Language Arts': 'Sprachwissenschaft',
        Music: 'Musik',
        Art: 'Kunst'
    }
};

// Detect user's language from browser settings
function detectUserLanguage() {
    // 1) Check saved preference (optional override)
    try {
        const saved = localStorage.getItem('curiocity_lang');
        if (saved && translations[saved]) return saved;
    } catch (e) {}

    // 2) Browser language preferences
    const browserLang = (navigator.languages && navigator.languages.length > 0)
        ? navigator.languages[0]
        : (navigator.language || navigator.userLanguage || 'en');
    const langCode = String(browserLang).split('-')[0].toLowerCase();
    if (translations[langCode]) return langCode;

    // 3) Locale fallback
    try {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
        const localeCode = String(locale).split('-')[0].toLowerCase();
        if (translations[localeCode]) return localeCode;
    } catch (e) {}

    // 4) Time zone heuristics for regional defaults
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (/Europe\/Madrid/i.test(tz)) return 'es';
        if (/Europe\/Paris/i.test(tz)) return 'fr';
        if (/Europe\/Berlin/i.test(tz)) return 'de';
    } catch (e) {}

    return 'en';
}

// Generate child-friendly educational text about an object from a subject perspective
async function getEducationalResources(objectName, subject, userLanguage = 'en') {
    const subjectNames = {
        biologia: "Biology",
        geologia: "Geology",
        historia: "History",
        matematicas: "Mathematics",
        lengua: "Language Arts",
        musica: "Music",
        artes: "Art"
    };

    const subj = subjectNames[subject] || subject;
    
    // Map language codes to full language names for AI
    const languageNames = {
        en: 'English',
        es: 'Spanish',
        fr: 'French',
        de: 'German'
    };
    const languageName = languageNames[userLanguage] || 'English';

    // If an OpenAI API key is provided via environment (REACT_APP_OPENAI_API_KEY),
    // attempt to generate child-friendly text with the Chat Completions API.
    // WARNING: Calling the OpenAI API directly from client-side code exposes the key
    // in the built bundle. Prefer a server-side proxy for production. This client-side
    // call is optional and falls back to a safe, local template generator on failure.
    const fallbackGenerator = () => {
        const lang = userLanguage || 'en';
        const fallback = {
            en: {
                title: `${subj}: Getting to know ${objectName}`,
                intro: `Let's discover what ${objectName} is and why it's interesting from the ${subj} perspective.`,
                subjects: {
                    biologia: {
                        explanation: `${objectName} is part of nature. We can observe how it lives, what it eats, and how it grows. In biology we study its body, life cycle and habitat to understand how it interacts with other living things.`,
                        funFacts: [
                            `Did you know observing ${objectName} can teach us about adaptation and survival?`,
                            `Try simple experiments to see how it reacts to light, water or food.`
                        ]
                    },
                    geologia: {
                        explanation: `${objectName} can tell stories about the Earth. In geology we look at what it is made of, how it formed and what signs it leaves on the landscape.`,
                        funFacts: [
                            `Sometimes ${objectName} is made from materials that formed millions of years ago.`,
                            `Looking at its shape and texture helps us understand processes like erosion or sedimentation.`
                        ]
                    },
                    historia: {
                        explanation: `${objectName} can be a clue to the past. In history we investigate who used it, when and why. Objects help us imagine how people lived before.`,
                        funFacts: [
                            `A simple object can reveal customs, technology or art from other times.`,
                            `Try asking: Who made it? What was it used for?`
                        ]
                    },
                    matematicas: {
                        explanation: `From math we can measure ${objectName}, count parts, compare sizes and look for patterns. Numbers and shapes help us describe it precisely.`,
                        funFacts: [
                            `You can measure its length, height or volume with rulers and measuring cups.`,
                            `Looking for patterns in ${objectName} (like repeated shapes) is a great logic exercise.`
                        ]
                    },
                    lengua: {
                        explanation: `In language arts we can write a story or poem about ${objectName}. We can describe it using adjectives, comparisons and questions to practice expression.`,
                        funFacts: [
                            `Try describing ${objectName} with five different adjectives.`,
                            `You can invent a story where ${objectName} is the main character.`
                        ]
                    },
                    musica: {
                        explanation: `In music we can think about sounds that ${objectName} reminds us of. Maybe it has a rhythm or tone we can use to inspire a melody.`,
                        funFacts: [
                            `Imagine which instrument would sound like ${objectName} and clap a rhythm.`,
                            `Try turning its name into a short song or chorus.`
                        ]
                    },
                    artes: {
                        explanation: `In art we can draw, paint or sculpt ${objectName}. Look at its colors, textures and shapes to create a work inspired by it.`,
                        funFacts: [
                            `Try drawing ${objectName} using only two colors.`,
                            `Try creating an abstract version focusing on its shapes.`
                        ]
                    },
                    default: {
                        explanation: `Let's observe ${objectName} and ask interesting questions: what is it, how does it work and why does it exist?`,
                        funFacts: [`Ask curious questions and try to answer them with examples.`]
                    }
                }
            },
            es: {
                title: `${subj}: Conociendo ${objectName}`,
                intro: `Descubramos qué es ${objectName} y por qué es interesante desde ${subj}.`,
                subjects: {
                    biologia: {
                        explanation: `${objectName} es parte de la naturaleza. Podemos observar cómo vive, qué come y cómo crece. En biología estudiamos su cuerpo, ciclo de vida y hábitat para entender cómo se relaciona con otros seres vivos.`,
                        funFacts: [
                            `¿Sabías que observar ${objectName} puede enseñar adaptación y supervivencia?`,
                            `Haz experimentos sencillos para ver cómo reacciona a la luz, el agua o la comida.`
                        ]
                    },
                    geologia: {
                        explanation: `${objectName} puede contar historias de la Tierra. En geología miramos de qué está hecho, cómo se formó y qué señales deja en el paisaje.`,
                        funFacts: [
                            `A veces ${objectName} está hecho de materiales formados hace millones de años.`,
                            `Su forma y textura ayudan a entender procesos como la erosión o la sedimentación.`
                        ]
                    },
                    historia: {
                        explanation: `${objectName} puede ser una pista del pasado. En historia investigamos quién lo usó, cuándo y por qué. Los objetos nos ayudan a imaginar cómo vivía la gente antes.`,
                        funFacts: [
                            `Un objeto sencillo puede mostrar costumbres, tecnología o arte de otras épocas.`,
                            `Pregunta: ¿Quién lo hizo? ¿Para qué se usaba?`
                        ]
                    },
                    matematicas: {
                        explanation: `Desde matemáticas podemos medir ${objectName}, contar partes, comparar tamaños y buscar patrones. Los números y las formas nos ayudan a describirlo con precisión.`,
                        funFacts: [
                            `Mide su largo, alto o volumen con reglas o recipientes.`,
                            `Buscar patrones en ${objectName} (formas repetidas) es un gran ejercicio de lógica.`
                        ]
                    },
                    lengua: {
                        explanation: `En lengua podemos escribir un cuento o poema sobre ${objectName}. Podemos describirlo con adjetivos, comparaciones y preguntas para practicar la expresión.`,
                        funFacts: [
                            `Describe ${objectName} con cinco adjetivos diferentes.`,
                            `Inventa una historia donde ${objectName} sea el personaje principal.`
                        ]
                    },
                    musica: {
                        explanation: `En música podemos pensar qué sonidos nos recuerda ${objectName}. Tal vez tiene un ritmo o tono que inspire una melodía.`,
                        funFacts: [
                            `Imagina qué instrumento sonaría como ${objectName} y marca un ritmo.`,
                            `Convierte su nombre en una pequeña canción o estribillo.`
                        ]
                    },
                    artes: {
                        explanation: `En arte podemos dibujar, pintar o esculpir ${objectName}. Observa colores, texturas y formas para crear una obra inspirada en él.`,
                        funFacts: [
                            `Dibuja ${objectName} usando solo dos colores.`,
                            `Crea una versión abstracta enfocándote en sus formas.`
                        ]
                    },
                    default: {
                        explanation: `Observemos ${objectName} y hagamos preguntas interesantes: ¿qué es, cómo funciona y por qué existe?`,
                        funFacts: [`Haz preguntas curiosas y trata de responderlas con ejemplos.`]
                    }
                }
            },
            fr: {
                title: `${subj} : Découvrir ${objectName}`,
                intro: `Découvrons ce qu'est ${objectName} et pourquoi c'est intéressant en ${subj}.`,
                subjects: {
                    biologia: {
                        explanation: `${objectName} fait partie de la nature. On peut observer comment il vit, ce qu'il mange et comment il grandit. En biologie, on étudie son corps, son cycle de vie et son habitat.`,
                        funFacts: [
                            `Observer ${objectName} peut apprendre l'adaptation et la survie.`,
                            `Fais des expériences simples pour voir sa réaction à la lumière, à l'eau ou à la nourriture.`
                        ]
                    },
                    geologia: {
                        explanation: `${objectName} peut raconter l'histoire de la Terre. En géologie, on regarde de quoi il est fait, comment il s'est formé et quelles traces il laisse.`,
                        funFacts: [
                            `Parfois ${objectName} est fait de matériaux très anciens.`,
                            `Sa forme et sa texture aident à comprendre l'érosion ou la sédimentation.`
                        ]
                    },
                    historia: {
                        explanation: `${objectName} peut être un indice du passé. En histoire, on cherche qui l'a utilisé, quand et pourquoi.`,
                        funFacts: [
                            `Un objet simple peut révéler des coutumes, des technologies ou de l'art d'autrefois.`,
                            `Demande : Qui l'a fabriqué ? À quoi servait-il ?`
                        ]
                    },
                    matematicas: {
                        explanation: `En mathématiques, on peut mesurer ${objectName}, compter des parties, comparer des tailles et chercher des motifs.`,
                        funFacts: [
                            `Mesure sa longueur, sa hauteur ou son volume.`,
                            `Chercher des motifs dans ${objectName} est un bon exercice de logique.`
                        ]
                    },
                    lengua: {
                        explanation: `En français, on peut écrire une histoire ou un poème sur ${objectName}. On le décrit avec des adjectifs et des comparaisons.`,
                        funFacts: [
                            `Décris ${objectName} avec cinq adjectifs différents.`,
                            `Invente une histoire où ${objectName} est le personnage principal.`
                        ]
                    },
                    musica: {
                        explanation: `En musique, on peut imaginer les sons que ${objectName} évoque. Peut-être un rythme ou une mélodie.`,
                        funFacts: [
                            `Imagine quel instrument ressemblerait à ${objectName} et tape un rythme.`,
                            `Transforme son nom en une petite chanson.`
                        ]
                    },
                    artes: {
                        explanation: `En art, on peut dessiner, peindre ou sculpter ${objectName}. Observe ses couleurs, textures et formes.`,
                        funFacts: [
                            `Dessine ${objectName} avec seulement deux couleurs.`,
                            `Crée une version abstraite centrée sur ses formes.`
                        ]
                    },
                    default: {
                        explanation: `Observons ${objectName} et posons des questions : qu'est-ce que c'est, comment ça marche, pourquoi existe-t-il ?`,
                        funFacts: [`Pose des questions curieuses et essaie d'y répondre.`]
                    }
                }
            },
            de: {
                title: `${subj}: ${objectName} entdecken`,
                intro: `Entdecken wir, was ${objectName} ist und warum es aus Sicht von ${subj} spannend ist.`,
                subjects: {
                    biologia: {
                        explanation: `${objectName} gehört zur Natur. Wir können beobachten, wie es lebt, was es frisst und wie es wächst. In der Biologie untersuchen wir Körper, Lebenszyklus und Lebensraum.`,
                        funFacts: [
                            `Durch das Beobachten von ${objectName} lernen wir etwas über Anpassung und Überleben.`,
                            `Probiere einfache Experimente: Licht, Wasser oder Nahrung.`
                        ]
                    },
                    geologia: {
                        explanation: `${objectName} kann Geschichten über die Erde erzählen. In der Geologie schauen wir, woraus es besteht und wie es entstanden ist.`,
                        funFacts: [
                            `Manches ${objectName} besteht aus sehr alten Materialien.`,
                            `Form und Oberfläche helfen, Erosion oder Ablagerung zu verstehen.`
                        ]
                    },
                    historia: {
                        explanation: `${objectName} kann ein Hinweis auf die Vergangenheit sein. In Geschichte fragen wir: Wer hat es benutzt, wann und warum?`,
                        funFacts: [
                            `Ein einfaches Objekt zeigt Bräuche, Technik oder Kunst von früher.`,
                            `Frage: Wer hat es gemacht? Wozu diente es?`
                        ]
                    },
                    matematicas: {
                        explanation: `In Mathe messen wir ${objectName}, zählen Teile, vergleichen Größen und suchen Muster.`,
                        funFacts: [
                            `Miss Länge, Höhe oder Volumen mit Lineal oder Messbecher.`,
                            `Muster in ${objectName} zu finden ist ein gutes Logiktraining.`
                        ]
                    },
                    lengua: {
                        explanation: `Im Sprachunterricht können wir eine Geschichte oder ein Gedicht über ${objectName} schreiben und es mit Adjektiven beschreiben.`,
                        funFacts: [
                            `Beschreibe ${objectName} mit fünf verschiedenen Adjektiven.`,
                            `Erfinde eine Geschichte, in der ${objectName} die Hauptfigur ist.`
                        ]
                    },
                    musica: {
                        explanation: `In Musik überlegen wir, welche Klänge ${objectName} erinnert. Vielleicht ein Rhythmus oder eine Melodie.`,
                        funFacts: [
                            `Stell dir ein Instrument vor, das wie ${objectName} klingt, und klatsche einen Rhythmus.`,
                            `Mach aus dem Namen eine kleine Melodie.`
                        ]
                    },
                    artes: {
                        explanation: `In Kunst können wir ${objectName} zeichnen, malen oder modellieren. Achte auf Farben, Texturen und Formen.`,
                        funFacts: [
                            `Zeichne ${objectName} nur mit zwei Farben.`,
                            `Erstelle eine abstrakte Version, die die Formen betont.`
                        ]
                    },
                    default: {
                        explanation: `Beobachten wir ${objectName} und stellen Fragen: Was ist es, wie funktioniert es, warum gibt es das?`,
                        funFacts: [`Stelle neugierige Fragen und versuche, sie zu beantworten.`]
                    }
                }
            }
        };

        const base = fallback[lang] || fallback.en;
        const subjectBlock = (base.subjects && (base.subjects[subject] || base.subjects.default)) || fallback.en.subjects.default;
        const title = base.title;
        const intro = base.intro;
        const explanation = subjectBlock.explanation;
        const funFacts = subjectBlock.funFacts;

        // Simple related-objects heuristics for the fallback path.
        const relatedMap = {
            tree: ['leaf', 'seed', 'bark'],
            car: ['wheel', 'tire', 'engine'],
            bottle: ['cap', 'label', 'liquid'],
            book: ['page', 'cover', 'bookmark'],
            dog: ['paw', 'tail', 'bone']
        };
        const key = objectName.toLowerCase();
        const relatedObjects = relatedMap[key] || [
            `small ${objectName}`,
            `parts of ${objectName}`
        ].slice(0, 3);

        return {
            title,
            text: intro,
            explanation,
            funFacts,
            relatedObjects
        };
    };

    // Try calling a local proxy (server) first. This keeps the OpenAI key on the server
    // and avoids exposing it in the client bundle. If the proxy is unavailable or returns
    // an error, fall back to the safe local generator.
    try {
        const proxyEndpoint = buildProxyUrl('/api/ai');
        const resp = await fetch(proxyEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objectName, subject: subj, language: languageName })
        });
        if (resp.ok) {
            const json = await resp.json();
                // Ensure we always provide relatedObjects for the UI.
                if (!json.relatedObjects || !Array.isArray(json.relatedObjects) || json.relatedObjects.length === 0) {
                    const relatedMap = {
                        tree: ['leaf', 'seed', 'bark'],
                        car: ['wheel', 'tire', 'engine'],
                        bottle: ['cap', 'label', 'liquid'],
                        book: ['page', 'cover', 'bookmark'],
                        dog: ['paw', 'tail', 'bone']
                    };
                    const key = String(objectName || '').toLowerCase();
                    json.relatedObjects = relatedMap[key] || [`small ${objectName}`, `parts of ${objectName}`].slice(0, 3);
                }
                try { console.debug('AI resources', json); } catch (e) {}
            if (json && json.title && json.text) {
                if (!Array.isArray(json.funFacts)) json.funFacts = json.funFacts ? [String(json.funFacts)] : [];
                return json;
            }
        } else {
            console.info('AI proxy not available or returned error, falling back to local templates', resp.status, resp.statusText);
        }
    } catch (err) {
        // network errors or CORS issues
        console.info('Could not reach AI proxy, using local templates', err && err.message ? err.message : err);
    }

    // Final fallback
    return fallbackGenerator();
}

const CameraScreen = () => {
    // Refs for video and canvas elements
    const videoBgRef = useRef(null);
    const videoCircleRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    // Detect and set user's language
    const [userLanguage] = useState(() => detectUserLanguage());
    const t = translations[userLanguage] || translations.en;

    // State management
    const [capturedImage, setCapturedImage] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [detectedObject, setDetectedObject] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [loadingDetection, setLoadingDetection] = useState(false);
    const [educationalResources, setEducationalResources] = useState(null);
    // Splash screen control (ensure visible for at least 3 seconds)
    const [showSplash, setShowSplash] = useState(true);
    useEffect(() => {
        const timer = setTimeout(() => setShowSplash(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    // Store raw predictions from the detector in case we want to use them later (we only need the setter)
    const [, setPredictionsState] = useState([]);

    // Default subject list used for detected objects (translated based on user language)
    const defaultSubjects = [
        { key: "biologia", label: t.Biology },
        { key: "geologia", label: t.Geology },
        { key: "historia", label: t.History },
        { key: "matematicas", label: t.Mathematics },
        { key: "lengua", label: t['Language Arts'] },
        { key: "musica", label: t.Music },
        { key: "artes", label: t.Art }
    ];

    // Camera enable function
    const enableCamera = async () => {
        try {
            // Stop any existing stream and clear video elements to avoid interrupted plays
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                if (videoBgRef.current) videoBgRef.current.srcObject = null;
                if (videoCircleRef.current) videoCircleRef.current.srcObject = null;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false,
            });

            streamRef.current = stream;

            // Attach stream to videos and start playback. Some browsers may reject play() with
            // an AbortError if a load/play request is interrupted; catch and ignore that specific error.
            if (videoBgRef.current) {
                try {
                    videoBgRef.current.srcObject = stream;
                    await videoBgRef.current.play();
                } catch (playErr) {
                    if (playErr && (playErr.name === 'AbortError' || (playErr.message && playErr.message.indexOf('interrupted') !== -1))) {
                        console.warn('Video background play() was interrupted; continuing.', playErr.message || playErr);
                    } else {
                        throw playErr;
                    }
                }
            }

            if (videoCircleRef.current) {
                try {
                    videoCircleRef.current.srcObject = stream;
                    await videoCircleRef.current.play();
                } catch (playErr) {
                    if (playErr && (playErr.name === 'AbortError' || (playErr.message && playErr.message.indexOf('interrupted') !== -1))) {
                        console.warn('Video circle play() was interrupted; continuing.', playErr.message || playErr);
                    } else {
                        throw playErr;
                    }
                }
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert("Could not access the camera.");
        }
    };

    // Initialize camera on component mount
    // Request fullscreen on mount
    useEffect(() => {
        const enterFullscreen = async () => {
            try {
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                    await elem.requestFullscreen();
                } else if (elem.webkitRequestFullscreen) {
                    await elem.webkitRequestFullscreen();
                } else if (elem.msRequestFullscreen) {
                    await elem.msRequestFullscreen();
                }
            } catch (err) {
                console.info('Fullscreen request declined or unsupported', err);
            }
        };
        enterFullscreen();
    }, []);

    // Initialize camera on component mount
    useEffect(() => {
        enableCamera();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Handle photo capture
    const handleTakePhoto = async () => {
        const video = videoCircleRef.current;
        if (!video) return;
        
        const canvas = canvasRef.current;
        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        
        ctx.drawImage(
            video,
            (video.videoWidth - size) / 2,
            (video.videoHeight - size) / 2,
            size,
            size,
            0,
            0,
            size,
            size
        );

        const dataUrl = canvas.toDataURL("image/png");
        setCapturedImage(dataUrl);
        setLoadingDetection(true);
        setShowModal(true);

        try {
            // Try OpenAI Vision API first (more accurate)
            const detectEndpoint = buildProxyUrl('/api/detect');
            
            let detectedObjectName = null;
            try {
                // Resize image to reduce payload size (Vision API doesn't need full resolution)
                const resizeCanvas = document.createElement('canvas');
                const maxSize = 800; // Max width/height for detection
                const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height, 1);
                resizeCanvas.width = canvas.width * scale;
                resizeCanvas.height = canvas.height * scale;
                const ctx = resizeCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, 0, resizeCanvas.width, resizeCanvas.height);
                const resizedDataUrl = resizeCanvas.toDataURL('image/jpeg', 0.8);
                
                const visionResp = await fetch(detectEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: resizedDataUrl })
                });
                
                if (visionResp.ok) {
                    const visionData = await visionResp.json();
                    if (visionData && visionData.object) {
                        detectedObjectName = visionData.object;
                        console.log('OpenAI Vision detected:', detectedObjectName);
                    }
                } else {
                    console.warn('Vision API error:', visionResp.status, await visionResp.text());
                }
            } catch (err) {
                console.info('Vision API unavailable, falling back to COCO-SSD', err.message || err);
            }

            // Fallback to COCO-SSD if Vision API failed
            if (!detectedObjectName) {
                const model = await cocoSsd.load();
                const img = new window.Image();
                img.src = dataUrl;
                await new Promise((resolve) => { img.onload = resolve; });
                
                const predictions = await model.detect(img);
                if (predictions && predictions.length > 0) {
                    setPredictionsState(predictions);
                    const mainObject = predictions.reduce((a, b) => (a.score > b.score ? a : b));
                    detectedObjectName = mainObject.class;
                    console.log('COCO-SSD detected:', detectedObjectName);
                }
            }

            if (detectedObjectName) {
                setDetectedObject({
                    title: detectedObjectName.charAt(0).toUpperCase() + detectedObjectName.slice(1),
                    description: `${t.detected} ${detectedObjectName} ${t.explore}`,
                    subjects: defaultSubjects
                });
            } else {
                setDetectedObject({
                    title: t.noObject,
                    description: t.noObjectDesc,
                    subjects: []
                });
            }
            setLoadingDetection(false);
        } catch (e) {
            console.error('Error detecting objects:', e);
            setDetectedObject({
                title: t.detectionError,
                description: t.detectionErrorDesc,
                subjects: []
            });
            setLoadingDetection(false);
        }
    };

    // Handle closing modal and resetting camera
    const handleClose = async () => {
        setShowModal(false);
        setSelectedSubject(null);
        setDetectedObject(null);
        setCapturedImage(null);
        setEducationalResources(null);
        setPredictionsState([]);
        await enableCamera();
    };



    // Share UI state and helper functions
    const [showShareOptions, setShowShareOptions] = useState(false);

    // Toast/snackbar for confirmations
    const [toastState, setToastState] = useState({ open: false, message: '', severity: 'success' });
    const showToast = (message, severity = 'success') => setToastState({ open: true, message, severity });
    const closeToast = (event, reason) => {
        if (reason === 'clickaway') return;
        setToastState(prev => ({ ...prev, open: false }));
    };

    const dataURLtoFile = (dataUrl, filename = 'curiocity-image.png') => {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    };

    const handleDownloadImage = () => {
        if (!capturedImage) return;
        const a = document.createElement('a');
        a.href = capturedImage;
        a.download = 'curiocity-image.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Image downloaded', 'success');
    };

    const shareContent = async () => {
        if (!educationalResources) return;
        const intro = 'Look what I found with Curiocity! https://curiocity-vn5n.onrender.com';
        const facts = (educationalResources.funFacts && educationalResources.funFacts.length > 0) ? ('\n\nFun facts:\n' + educationalResources.funFacts.map(f => '• ' + f).join('\n')) : '';
        const shareText = `${intro}\n\n${educationalResources.title}\n\n${educationalResources.text}\n\n${educationalResources.explanation || ''}${facts}`;

        try {
            // Prefer sharing both text and image when supported.
            // Some platforms drop the text when files are present; include a text file to guarantee delivery.
            if (navigator.share && capturedImage) {
                try {
                    const imageFile = dataURLtoFile(capturedImage);
                    const textBlob = new Blob([shareText], { type: 'text/plain' });
                    const textFile = new File([textBlob], 'curiocity-content.txt', { type: 'text/plain' });
                    const shareData = { title: educationalResources.title, text: shareText, files: [imageFile, textFile] };
                    if (navigator.canShare && navigator.canShare({ files: shareData.files })) {
                        await navigator.share(shareData);
                        showToast('Shared successfully', 'success');
                        return;
                    }
                } catch (e) {
                    // Fall through
                }
            }

            // Fallback: share text-only via native share, then auto-download image for manual attach
            if (navigator.share) {
                await navigator.share({ title: educationalResources.title, text: shareText });
                showToast('Shared text; image ready to download below', 'success');
                if (capturedImage) {
                    handleDownloadImage();
                }
                return;
            }

            // Manual options: Email/WhatsApp + auto-download for convenience
            if (capturedImage) {
                handleDownloadImage();
            }
            setShowShareOptions(true);
        } catch (err) {
            console.info('Native share cancelled or unavailable, showing manual options', err && err.message ? err.message : '');
            if (capturedImage) {
                handleDownloadImage();
            }
            setShowShareOptions(true);
        }
    };

    const shareViaEmail = () => {
        if (!educationalResources) return;
        const intro = 'Look what I found with Curiocity! https://curiocity-vn5n.onrender.com';
        const subject = encodeURIComponent(`${educationalResources.title} — Curiocity`);
        let body = `${intro}\n\n${educationalResources.title}\n\n${educationalResources.text}\n\n${educationalResources.explanation || ''}`;
        if (educationalResources.funFacts && educationalResources.funFacts.length > 0) {
            body += `\n\nFun facts:\n${educationalResources.funFacts.map(f => '• ' + f).join('\n')}`;
        }
        // Always include image as base64 data URL in body for email clients that support it
        if (capturedImage) {
            body += `\n\n---\nImage: ${capturedImage}`;
        }
        body += '\n\nLearn more at: https://curiocity-vn5n.onrender.com';
        const mailto = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
        window.open(mailto);
        showToast('Opened mail composer', 'info');
        setShowShareOptions(false);
    };

    const shareViaWhatsApp = () => {
        if (!educationalResources) return;
        const intro = 'Look what I found with Curiocity! https://curiocity-vn5n.onrender.com';
        let text = `${intro}\n\n${educationalResources.title}\n\n${educationalResources.text}\n\n${educationalResources.explanation || ''}`;
        if (educationalResources.funFacts && educationalResources.funFacts.length > 0) {
            text += `\n\nFun facts:\n${educationalResources.funFacts.map(f => '• ' + f).join('\n')}`;
        }
        // Note: WhatsApp Web and app don't support file sharing via wa.me URL
        // User will need to share image separately or use Download Image button
        text += '\n\n(To share the image: Save it using the Download button and attach manually)';
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        showToast('Opened WhatsApp', 'info');
        setShowShareOptions(false);
    };

    // When a user taps a related object, behave as if a new picture was taken
    // with that object: show the detected-object view and allow subject selection.
    const handleRelatedObjectClick = (related) => {
        setDetectedObject({
            title: related.charAt(0).toUpperCase() + related.slice(1),
            description: `${t.detected} ${related} ${t.explore}`,
            subjects: defaultSubjects
        });
        setSelectedSubject(null);
        setEducationalResources(null);
        setShowShareOptions(false);
        setShowModal(true);
    };

    


    return (
        <div style={{
            position: "relative",
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            fontFamily: "'Sofia Sans', sans-serif"
        }}>
            {showSplash && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ background: '#ffffff', borderRadius: '50%', width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <img src="/curiocity-logo.svg" alt="Curiocity" style={{ width: 128, height: 128 }} />
                        </div>
                        <h2 style={{ color: '#000000', fontWeight: 900, fontSize: 14, margin: 0 }}>Learn from the world around you.</h2>
                        <p style={{ color: '#333', fontSize: 14, marginTop: 8 }}>Loading…</p>
                    </div>
                </div>
            )}
            {capturedImage ? (
                <>
                    <img
                        src={capturedImage}
                        alt="capturada"
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100vw",
                            height: "100vh",
                            objectFit: "cover",
                            zIndex: 20,
                            background: "#faebd9"
                        }}
                    />
                    <Drawer
                        anchor="bottom"
                        open={showModal}
                        onClose={handleClose}
                        PaperProps={{ style: { background: '#faebd9', borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: 'none' } }}
                    >
                        <Box sx={{
                            background: '#faebd9',
                            padding: 2,
                            px: 2,
                            pb: 3,
                            maxWidth: 'min(520px, 90vw)',
                            width: 'min(520px, 90vw)',
                            boxSizing: 'border-box',
                            mx: 'auto',
                            textAlign: 'center',
                            fontFamily: "'Sofia Sans', sans-serif",
                            position: 'relative',
                            maxHeight: '70vh',
                            overflowY: 'auto'
                        }}>
                                {/* Close button */}
                                <button
                                    onClick={handleClose}
                                    style={{
                                        position: 'absolute',
                                        top: 12,
                                        right: 12,
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: '#000000',
                                        color: '#faebd9',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 20,
                                        fontWeight: 'bold',
                                        zIndex: 10,
                                        fontFamily: "'Sofia Sans', sans-serif"
                                    }}
                                    aria-label="Close"
                                >×</button>
                                {selectedSubject ? (
                                    <>
                                        <div style={{ width: '100%', boxSizing: 'border-box', padding: '0 6px' }}>
                                            {educationalResources ? (
                                                <>
                                                    <div style={{ background: '#FFF6E0', borderRadius: 14, padding: 12, marginBottom: 12, textAlign: 'left' }}>
                                                        <h2 style={{ color: "#000000", fontWeight: 900, fontSize: 28, margin: "0 0 8px 0", maxWidth: '100%', wordBreak: 'break-word' }}>
                                                            ✨ {educationalResources.title}
                                                        </h2>
                                                        <p style={{ color: "#333", fontSize: 17, margin: "0 0 8px 0", maxWidth: '100%', wordBreak: 'break-word', fontWeight: 700 }}>
                                                            {educationalResources.text}
                                                        </p>
                                                    </div>

                                                    <div style={{ background: '#FFF0E6', borderRadius: 14, padding: 12, marginBottom: 12, textAlign: 'left' }}>
                                                        <p style={{ color: "#333", fontSize: 16, margin: 0, lineHeight: 1.5, maxWidth: '100%', wordBreak: 'break-word' }}>
                                                            {educationalResources.explanation}
                                                        </p>
                                                    </div>

                                                    {educationalResources.funFacts && educationalResources.funFacts.length > 0 && (
                                                        <div style={{ marginTop: 12, textAlign: 'left', background: '#FFF2E8', borderRadius: 14, padding: 12, marginBottom: 12 }}>
                                                            <h3 style={{ color: "#000000", fontSize: 20, marginBottom: 8 }}>{t.funFacts}</h3>
                                                            <ul style={{ paddingLeft: 20, color: '#333', fontSize: 15, lineHeight: 1.6, maxWidth: '100%', wordBreak: 'break-word' }}>
                                                                {educationalResources.funFacts.map((fact, i) => (
                                                                    <li key={i}>💡 {fact}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {educationalResources.links && educationalResources.links.length > 0 && (
                                                        <div style={{ marginTop: 12, textAlign: 'left', background: '#FFF8E6', borderRadius: 14, padding: 12, marginBottom: 12 }}>
                                                            <h3 style={{ color: "#000000", fontSize: 20, marginBottom: 8 }}>{t.recommendedResources}</h3>
                                                            <ul style={{ paddingLeft: 20, color: '#333', fontSize: 15, lineHeight: 1.6, maxWidth: '100%', wordBreak: 'break-word' }}>
                                                                {educationalResources.links.map((link, i) => (
                                                                    <li key={i}>
                                                                        <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0b63d6', wordBreak: 'break-word' }}>
                                                                            {link.title || link.url}
                                                                        </a>
                                                                        {link.source ? ` — ${link.source}` : null}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {educationalResources.relatedObjects && educationalResources.relatedObjects.length > 0 && (
                                                        <div style={{ marginTop: 12, textAlign: 'left', background: '#FFF5E6', borderRadius: 14, padding: 12, marginBottom: 12 }}>
                                                            <h3 style={{ color: "#000000", fontSize: 20, marginBottom: 8 }}>{t.relatedObjects}</h3>
                                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                                {educationalResources.relatedObjects.map((ro, i) => (
                                                                    <button key={i} onClick={() => handleRelatedObjectClick(ro)} style={{
                                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                                        background: "#000000",
                                                                        color: "#faebd9",
                                                                        border: "none",
                                                                        borderRadius: 14,
                                                                        padding: "8px 12px",
                                                                        fontWeight: 700,
                                                                        fontSize: 14,
                                                                        cursor: "pointer",
                                                                        margin: 2
                                                                    }}>{ro}</button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Share controls: allow sharing the AI text and the captured image via Web Share, Email or WhatsApp */}
                                                    <div style={{ marginTop: 16, textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                                                            <button
                                                                onClick={shareContent}
                                                                style={{
                                                                    fontFamily: "'Sofia Sans', sans-serif",
                                                                    background: "#000000",
                                                                    color: "#faebd9",
                                                                    border: "none",
                                                                    borderRadius: 14,
                                                                    padding: "10px 14px",
                                                                    fontWeight: 700,
                                                                    fontSize: 15,
                                                                    cursor: "pointer",
                                                                    margin: 2,
                                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 8
                                                                }}
                                                            ><MdShare style={{ fontSize: 18, color: '#faebd9' }} />{t.shareContent}</button>

                                                            {/* Download hidden per request */}
                                                            <button
                                                                onClick={handleDownloadImage}
                                                                style={{ display: 'none' }}
                                                            >Download Image</button>
                                                        </div>

                                                        {showShareOptions && (
                                                            <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', background: 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 12 }}>
                                                                <button
                                                                    onClick={shareViaEmail}
                                                                    style={{
                                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                                        background: "#0b63d6",
                                                                        color: "#fff",
                                                                        border: "none",
                                                                        borderRadius: 12,
                                                                        padding: "8px 12px",
                                                                        fontWeight: 700,
                                                                        fontSize: 14,
                                                                        cursor: "pointer",
                                                                        margin: 2
                                                                    }}
                                                                >📧 {t.shareViaEmail}</button>

                                                                <button
                                                                    onClick={shareViaWhatsApp}
                                                                    style={{
                                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                                        background: "#25D366",
                                                                        color: "#fff",
                                                                        border: "none",
                                                                        borderRadius: 12,
                                                                        padding: "8px 12px",
                                                                        fontWeight: 700,
                                                                        fontSize: 14,
                                                                        cursor: "pointer",
                                                                        margin: 2
                                                                    }}
                                                                >💬 {t.shareViaWhatsApp}</button>

                                                                <button
                                                                    onClick={handleDownloadImage}
                                                                    style={{
                                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                                        background: "#ff9500",
                                                                        color: "#fff",
                                                                        border: "none",
                                                                        borderRadius: 12,
                                                                        padding: "8px 12px",
                                                                        fontWeight: 700,
                                                                        fontSize: 14,
                                                                        cursor: "pointer",
                                                                        margin: 2
                                                                    }}
                                                                >📥 Download Image</button>

                                                                <button
                                                                    onClick={() => setShowShareOptions(false)}
                                                                    style={{
                                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                                        background: "#fff",
                                                                        color: "#000000",
                                                                        border: "2px solid #000000",
                                                                        borderRadius: 12,
                                                                        padding: "8px 12px",
                                                                        fontWeight: 700,
                                                                        fontSize: 14,
                                                                        cursor: "pointer",
                                                                        margin: 2
                                                                    }}
                                                                >{t.close}</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <p style={{ color: "#000000", fontSize: 20, maxWidth: '100%', wordBreak: 'break-word' }}>{t.loading}</p>
                                            )}

                                            {/* Connect with more subjects — only show after educational content is loaded */}
                                            {educationalResources && (
                                                <div style={{ marginTop: 18, textAlign: 'left' }}>
                                                    <h3 style={{ color: "#000000", fontSize: 20, marginBottom: 16 }}>{userLanguage === 'es' ? 'Explora más asignaturas:' : userLanguage === 'fr' ? 'Explorez plus de matières:' : userLanguage === 'de' ? 'Entdecken Sie mehr Fächer:' : 'Connect with more subjects:'}</h3>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 }}>
                                                        {(detectedObject && detectedObject.subjects ? detectedObject.subjects : defaultSubjects).map(subj => {
                                                            const icons = {
                                                                biologia: MdScience,
                                                                geologia: MdTerrain,
                                                                historia: MdHistoryEdu,
                                                                matematicas: MdCalculate,
                                                                lengua: MdMenuBook,
                                                                musica: MdMusicNote,
                                                                artes: MdBrush
                                                            };
                                                            const Icon = icons[subj.key] || null;
                                                            return (
                                                                <button key={subj.key}
                                                                    style={{
                                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                                        background: "#000000",
                                                                        color: "#faebd9",
                                                                        border: "none",
                                                                        borderRadius: 14,
                                                                        padding: "8px 12px",
                                                                        fontWeight: 700,
                                                                        fontSize: 15,
                                                                        cursor: "pointer",
                                                                        margin: 2,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 8
                                                                    }}
                                                                    onClick={async () => {
                                                                        setSelectedSubject(subj.key);
                                                                        const resources = await getEducationalResources(detectedObject ? detectedObject.title : '', subj.key, userLanguage);
                                                                        setEducationalResources(resources);
                                                                    }}
                                                                >
                                                                    {Icon ? <Icon style={{ fontSize: 18, color: '#faebd9' }} /> : null}
                                                                    <span style={{ display: 'inline-block' }}>{subj.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {loadingDetection || !detectedObject ? (
                                                            <p style={{ color: "#000000", fontSize: 20 }}>{t.loading}</p>
                                        ) : (
                                            <>
                                                <h2 style={{ color: "#000000", fontWeight: 800, fontSize: 32, margin: 0 }}>
                                                    {detectedObject.title}
                                                </h2>
                                                <p style={{ color: "#333", fontSize: 18, margin: "16px 0 24px 0", maxWidth: '100%', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                                    {detectedObject.description}
                                                </p>

                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>
                                                    {detectedObject.subjects.map(subj => {
                                                        const icons = {
                                                            biologia: MdScience,
                                                            geologia: MdTerrain,
                                                            historia: MdHistoryEdu,
                                                            matematicas: MdCalculate,
                                                            lengua: MdMenuBook,
                                                            musica: MdMusicNote,
                                                            artes: MdBrush
                                                        };
                                                        const Icon = icons[subj.key] || null;
                                                        return (
                                                            <button
                                                                key={subj.key}
                                                                style={{
                                                                    fontFamily: "'Sofia Sans', sans-serif",
                                                                    background: "#000000",
                                                                    color: "#faebd9",
                                                                    border: "none",
                                                                    borderRadius: 14,
                                                                    padding: "8px 12px",
                                                                    fontWeight: 700,
                                                                    fontSize: 15,
                                                                    cursor: "pointer",
                                                                    margin: 2,
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 8
                                                                }}
                                                                onClick={async () => {
                                                                    setSelectedSubject(subj.key);
                                                                    const resources = await getEducationalResources(detectedObject.title, subj.key, userLanguage);
                                                                    setEducationalResources(resources);
                                                                }}
                                                            >
                                                                {Icon ? <Icon style={{ fontSize: 18, color: '#faebd9' }} /> : null}
                                                                <span style={{ display: 'inline-block' }}>{subj.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <button
                                                    onClick={handleClose}
                                                    style={{
                                                        fontFamily: "'Sofia Sans', sans-serif",
                                                        background: "#fff",
                                                        color: "#000000",
                                                        border: "2px solid #000000",
                                                        borderRadius: 16,
                                                        padding: "8px 20px",
                                                        fontWeight: 700,
                                                        fontSize: 16,
                                                        cursor: "pointer",
                                                        marginTop: 8
                                                    }}
                                                >Incorrect object</button>
                                            </>
                                        )}
                                    </>
                                )}
                            </Box>
                    </Drawer>

                    {/* Snackbar / toast for share and other feedback */}
                    <Snackbar open={toastState.open} autoHideDuration={3000} onClose={closeToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                        <Alert onClose={closeToast} severity={toastState.severity} sx={{ width: '100%' }}>
                            {toastState.message}
                        </Alert>
                    </Snackbar>

                </>
            ) : (
                <>
                    <video
                        ref={videoBgRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100vw",
                            height: "100vh",
                            objectFit: "cover",
                            filter: "blur(8px)"
                        }}
                    />


                    {/* Círculo nítido */}
                    <div style={{
                        position: "absolute",
                        top: "44%",
                        left: "50%",
                        width: "56vw",
                        height: "56vw",
                        maxWidth: "72vh",
                        maxHeight: "72vh",
                        transform: "translate(-50%, -50%)",
                        borderRadius: "50%",
                        overflow: "hidden",
                        pointerEvents: "none",
                        border: "2px solid #faebd9",
                        //boxShadow: "0 0 32px 4px #bfa98a, 0 0 0 12px #faebd9"
                    }}>
                        <video
                            ref={videoCircleRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                filter: "none"
                            }}
                        />
                    </div>

                    {/* Decorative question marks removed per UI update */}

                    {/* Botón disparador */}
                    <div style={{
                        position: "absolute",
                        bottom: "6vh",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 90,
                        height: 90,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        zIndex: 10,
                        border: "2px solid #faebd9"
                    }}>
                        <button
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: "50%",
                                background: "#faebd9",
                                border: "0px",
                                outline: "none",
                                cursor: "pointer",
                                fontFamily: "'Sofia Sans', sans-serif",
                                zIndex: 11,
                                pointerEvents: "auto",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}
                            aria-label="Tomar foto"
                            onClick={handleTakePhoto}
                        >
                            <img src="/curiocity-icon.svg" alt="" aria-hidden="true" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                        </button>
                    </div>
                </>
            )}
            {/* Canvas oculto para capturar la imagen */}
            <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
    );
};

export default CameraScreen;
