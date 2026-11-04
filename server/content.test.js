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
  para_seguir_pensando: '¿Cómo sería tu calle sin farolas?',
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
  it('adapt to the age group and the language, and ask for safe, honest content', () => {
    const young = lessonPrompts({ objectName: 'Farola', subject: 'History', language: 'Spanish', ageGroup: '6-8' }).system;
    const older = lessonPrompts({ objectName: 'Farola', subject: 'History', language: 'Spanish', ageGroup: '9-12' }).system;
    expect(young).toMatch(/6-8 years old/);
    expect(older).toMatch(/9-12 years old/);
    expect(young).toMatch(/Write every field in Spanish/);
    expect(young).toMatch(/never taste, eat/);
    expect(young).toMatch(/never go near traffic/);
    expect(young).toMatch(/never use tools/);
    expect(young).toMatch(/Never invent a connection/);
    expect(young).toMatch(/Seville.*only when it fits naturally/s);
    expect(young).toMatch(/Never include URLs/);
    expect(rankingPrompts({ objectName: 'Farola', language: 'French', ageGroup: '6-8' }).system).toMatch(/hook in French/);
  });

  it('use strict JSON schemas that list every field as required', () => {
    for (const { schema } of [LESSON_SCHEMA, RANKING_SCHEMA]) {
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required.sort()).toEqual(Object.keys(schema.properties).sort());
    }
  });
});
