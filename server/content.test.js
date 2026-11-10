// @vitest-environment node
import { describe, expect, it } from 'vitest';
import content from './content.js';

const { cleanRanking, validateLesson, lessonPrompts, rankingPrompts, LESSON_SCHEMA, RANKING_SCHEMA } = content;

const lesson = (extra = {}) => ({
  pregunta_inicial: { pregunta: '¿Qué usaban antes para alumbrar las calles?', opciones: ['Lámparas de aceite', 'Paneles solares', 'Pantallas'], correcta: 0 },
  dato_sorprendente: 'Hubo personas cuyo trabajo era encender las farolas.',
  por_que: 'Antes no había luz eléctrica en las calles.',
  reto: 'Cuenta cuántas farolas ves desde donde estás.',
  reto_foto: false,
  reto_descubrimiento: 'Las primeras farolas se encendían a mano, una a una; hoy muchas se encienden solas con un sensor que nota cuándo oscurece.',
  para_seguir_pensando: '¿Cómo sería tu calle sin farolas?',
  ideas_pregunta_final: ['Estaría muy oscura de noche.', 'Usaríamos linternas.'],
  conexion_debil: false,
  objetos_relacionados: ['vela', 'linterna', 'lámpara', 'sobra'],
  terminos_busqueda: ['Farola'],
  ...extra
});

const reverse = list => [...list].reverse();

describe('validateLesson', () => {
  it('keeps the right answer right after shuffling the options', () => {
    const { lesson: l, searchTerms } = validateLesson(lesson(), reverse);
    expect(l.pregunta_inicial.opciones).toEqual(['Pantallas', 'Paneles solares', 'Lámparas de aceite']);
    expect(l.pregunta_inicial.opciones[l.pregunta_inicial.correcta]).toBe('Lámparas de aceite');
    expect(l.objetos_relacionados).toEqual(['vela', 'linterna', 'lámpara']);
    expect(searchTerms).toEqual(['Farola']);
    expect(l).not.toHaveProperty('terminos_busqueda');
  });

  it('shuffles by default, so the answer is not always the first option', () => {
    const positions = new Set();
    for (let i = 0; i < 40; i++) positions.add(validateLesson(lesson()).lesson.pregunta_inicial.correcta);
    expect(positions.size).toBeGreaterThan(1);
  });

  it.each([
    ['two options', { pregunta_inicial: { pregunta: '¿?', opciones: ['a', 'b'], correcta: 0 } }],
    ['repeated options', { pregunta_inicial: { pregunta: '¿?', opciones: ['Sí', 'sí', 'No'], correcta: 0 } }],
    ['answer out of range', { pregunta_inicial: { pregunta: '¿?', opciones: ['a', 'b', 'c'], correcta: 3 } }],
    ['missing challenge', { reto: '' }],
    ['missing open question', { para_seguir_pensando: undefined }],
    ['an explanation that is far too long', { por_que: 'x'.repeat(2000) }]
  ])('rejects a lesson with %s', (_, extra) => {
    expect(validateLesson(lesson(extra))).toBeNull();
  });

  it('keeps what the challenge could reveal and the final ideas, and marks the lesson complete', () => {
    const result = validateLesson(lesson({ reto_descubrimiento: '  Las primeras farolas se encendían a mano, una a una; hoy muchas se encienden solas con un sensor que nota cuándo oscurece.  ' }), reverse);
    expect(result.complete).toBe(true);
    expect(result.lesson.reto_descubrimiento).toBe('Las primeras farolas se encendían a mano, una a una; hoy muchas se encienden solas con un sensor que nota cuándo oscurece.');
    expect(result.lesson).not.toHaveProperty('reto_observacion');
    expect(result.lesson.ideas_pregunta_final).toEqual(['Estaría muy oscura de noche.', 'Usaríamos linternas.']);
  });

  it.each([
    ['no discovery', { reto_descubrimiento: undefined }],
    ['an empty discovery', { reto_descubrimiento: '   ' }],
    ['a discovery that is far too long', { reto_descubrimiento: 'x'.repeat(400) }],
    ['a discovery that is not text', { reto_descubrimiento: { texto: 'a' } }],
    ['one idea', { ideas_pregunta_final: ['Una'] }],
    ['repeated ideas', { ideas_pregunta_final: ['Una idea', 'una idea'] }],
    ['no ideas', { ideas_pregunta_final: undefined }]
  ])('with %s, still returns the lesson, without that part, and marks it incomplete', (_, extra) => {
    const result = validateLesson(lesson(extra));
    expect(result.complete).toBe(false);
    expect(result.lesson.reto).toBeTruthy();
    if ('reto_descubrimiento' in extra) expect(result.lesson.reto_descubrimiento).toBeNull();
    if ('ideas_pregunta_final' in extra) expect(result.lesson.ideas_pregunta_final).toEqual([]);
  });

  it('rejects anything that is not an object', () => {
    expect(validateLesson(null)).toBeNull();
    expect(validateLesson('texto')).toBeNull();
  });
});

describe('cleanRanking', () => {
  const all = ['biologia', 'geologia', 'historia', 'matematicas', 'lengua', 'musica', 'artes'];
  const scores = { historia: 3, matematicas: 2, artes: 2, biologia: 1, geologia: 0, lengua: 1, musica: 0 };
  const model = () => ({ subjects: all.map(key => ({ key, score: scores[key], hook: scores[key] >= 2 ? `gancho ${key}` : '' })) });

  const withScores = sc => ({ subjects: all.map(key => ({ key, score: sc[key] || 0, hook: sc[key] ? `gancho ${key}` : '' })) });
  const featuredKeys = sc => cleanRanking(withScores(sc)).featured.map(f => f.key);

  it('features every subject scoring 2 or 3, best first, up to 4', () => {
    expect(featuredKeys({ historia: 2, artes: 1, lengua: 1 })).toEqual(['historia']);
    expect(featuredKeys({ historia: 2, artes: 3, lengua: 1 })).toEqual(['artes', 'historia']);
    expect(featuredKeys({ historia: 2, artes: 3, musica: 2, lengua: 1 })).toEqual(['artes', 'historia', 'musica']);
    expect(featuredKeys({ biologia: 2, historia: 3, artes: 2, musica: 3 })).toEqual(['historia', 'musica', 'biologia', 'artes']);
    expect(featuredKeys({ biologia: 2, geologia: 2, historia: 3, matematicas: 2, artes: 3, musica: 2 })).toEqual(['historia', 'artes', 'biologia', 'geologia']);
  });

  it('with no subject scoring 2, features only the best one scoring 1', () => {
    const r = cleanRanking(withScores({ lengua: 1, artes: 1 }));
    expect(r.featured).toEqual([{ key: 'lengua', hook: 'gancho lengua' }]);
    expect(r.others).toEqual(['artes', 'biologia', 'geologia', 'historia', 'matematicas', 'musica']);
    expect(cleanRanking(withScores({}))).toBeNull(); // nothing at all: the app shows the 7 subjects
  });

  it('keeps every subject that is not featured under "More subjects", in order', () => {
    expect(cleanRanking(model())).toEqual({
      featured: [
        { key: 'historia', hook: 'gancho historia' },
        { key: 'matematicas', hook: 'gancho matematicas' },
        { key: 'artes', hook: 'gancho artes' }
      ],
      others: ['biologia', 'lengua', 'geologia', 'musica']
    });
  });

  it('never features a subject without a hook or with no connection', () => {
    const m = { subjects: [{ key: 'historia', score: 3, hook: 'Antes se encendían una a una' }, { key: 'musica', score: 0, hook: 'inventado' }, ...all.slice(0, 3).map(key => ({ key, score: 1, hook: '' }))] };
    const r = cleanRanking(m);
    expect(r.featured).toEqual([{ key: 'historia', hook: 'Antes se encendían una a una' }]);
    expect(r.others).toHaveLength(6); // every subject stays reachable under "More subjects"
  });

  it('ignores unknown and repeated keys and returns null when too incomplete', () => {
    expect(cleanRanking({ subjects: [{ key: 'hacking', score: 3, hook: 'x' }, { key: 'historia', score: 3, hook: 'x' }] })).toBeNull();
    expect(cleanRanking({})).toBeNull();
  });
});

describe('prompts', () => {
  it('write for 8-10 year-olds in the child language, and ask for safe, honest content', () => {
    const young = lessonPrompts({ objectName: 'Farola', subject: 'History', language: 'Spanish' }).system;
    expect(young).toMatch(/8-10 years old/);
    expect(young).toMatch(/Write every field in Spanish/);
    expect(young).toMatch(/never taste, eat/);
    expect(young).toMatch(/never go near traffic/);
    expect(young).toMatch(/never use tools/);
    expect(young).toMatch(/Never invent a connection/);
    expect(young).toMatch(/Seville.*only when it fits naturally/s);
    expect(young).toMatch(/Never include URLs/);
    expect(young).toMatch(/which part of the flower becomes each fruit/);
    expect(rankingPrompts({ objectName: 'Manzana', language: 'Spanish' }).system).toMatch(/receptacle/);
    // what the challenge could reveal: one text, valid whether the child found it or not
    expect(young).toMatch(/reto_descubrimiento/);
    expect(young).toMatch(/teach something NEW and true/);
    expect(young).toMatch(/valid whether the child found it or not/);
    expect(young).toMatch(/never write "if you saw it…"/);
    expect(young).toMatch(/never just repeat the challenge/);
    expect(young).not.toMatch(/reto_observacion/);
    // the challenge looks at something that makes sense from the subject
    expect(young).toMatch(/makes sense FROM this subject/);
    expect(young).toMatch(/never labels, stickers, price tags, packaging or cables/);
    expect(young).toMatch(/never state what this child's object has/);
    expect(young).toMatch(/ideas_pregunta_final: 2 or 3/);
    expect(rankingPrompts({ objectName: 'Farola', language: 'French' }).system).toMatch(/hook in French/);
  });

  it('use strict JSON schemas that list every field as required', () => {
    for (const { schema } of [LESSON_SCHEMA, RANKING_SCHEMA]) {
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required.sort()).toEqual(Object.keys(schema.properties).sort());
    }
  });
});
