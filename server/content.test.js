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
  reto_observacion: {
    pregunta: '¿Has contado más de cinco farolas?',
    opciones: [
      { texto: 'Sí', conclusion: 'Si hay muchas, puede ser porque la calle es larga o muy transitada.' },
      { texto: 'No', conclusion: 'Si hay pocas, puede ser porque la calle es corta o tranquila.' }
    ]
  },
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

  it('keeps the observation question (options in order) and the final ideas, and marks the lesson complete', () => {
    const result = validateLesson(lesson(), reverse);
    expect(result.complete).toBe(true);
    expect(result.lesson.reto_observacion.pregunta).toBe('¿Has contado más de cinco farolas?');
    expect(result.lesson.reto_observacion.opciones.map(o => o.texto)).toEqual(['Sí', 'No']);
    expect(result.lesson.reto_observacion.opciones[0].conclusion).toMatch(/^Si hay muchas/);
    expect(result.lesson.ideas_pregunta_final).toEqual(['Estaría muy oscura de noche.', 'Usaríamos linternas.']);
  });

  it.each([
    ['no observation', { reto_observacion: undefined }],
    ['one option', { reto_observacion: { pregunta: '¿?', opciones: [{ texto: 'Sí', conclusion: 'Si…' }] } }],
    ['four options', { reto_observacion: { pregunta: '¿?', opciones: ['a', 'b', 'c', 'd'].map(t => ({ texto: t, conclusion: 'Si…' })) } }],
    ['an option without conclusion', { reto_observacion: { pregunta: '¿?', opciones: [{ texto: 'Sí', conclusion: '' }, { texto: 'No', conclusion: 'Si…' }] } }],
    ['repeated options', { reto_observacion: { pregunta: '¿?', opciones: [{ texto: 'Sí', conclusion: 'a' }, { texto: 'sí', conclusion: 'b' }] } }],
    ['one idea', { ideas_pregunta_final: ['Una'] }],
    ['repeated ideas', { ideas_pregunta_final: ['Una idea', 'una idea'] }],
    ['no ideas', { ideas_pregunta_final: undefined }]
  ])('with %s, still returns the lesson, without that part, and marks it incomplete', (_, extra) => {
    const result = validateLesson(lesson(extra));
    expect(result.complete).toBe(false);
    expect(result.lesson.reto).toBeTruthy();
    if ('reto_observacion' in extra) expect(result.lesson.reto_observacion).toBeNull();
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

  it('features the 3 best subjects with their hook and keeps the rest in order', () => {
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
    // observation after the challenge: no right answer, conditional conclusions, nothing about this object
    expect(young).toMatch(/reto_observacion/);
    expect(young).toMatch(/no right or wrong answer/);
    expect(young).toMatch(/written as a condition/);
    expect(young).toMatch(/never state anything about this child's object/);
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
