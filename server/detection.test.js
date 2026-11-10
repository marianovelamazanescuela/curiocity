// @vitest-environment node
import { describe, expect, it } from 'vitest';
import detection from './detection.js';

const { cleanDetection, detectionPrompt, DETECTION_SCHEMA } = detection;
const obj = (name, x = 0.5, y = 0.5, size = 0.3) => ({ name, x, y, size });

describe('cleanDetection', () => {
  it('no objects: an empty list', () => {
    expect(cleanDetection({ objects: [], person: false })).toEqual({ objects: [], person: false });
    expect(cleanDetection(null)).toEqual({ objects: [], person: false });
    expect(cleanDetection({ objects: 'perro' })).toEqual({ objects: [], person: false });
  });

  it('one object, cleaned', () => {
    expect(cleanDetection({ objects: [obj(' "manzana roja". ', 0.4, 0.6, 0.5)], person: false }, 'Spanish')).toEqual({
      objects: [{ name: 'manzana roja', x: 0.4, y: 0.6, size: 0.5 }],
      person: false
    });
  });

  it('keeps up to 4 objects in the model’s order', () => {
    const four = ['perro', 'árbol', 'banco', 'farola'].map(n => obj(n));
    expect(cleanDetection({ objects: four, person: false }, 'Spanish').objects.map(o => o.name)).toEqual(['perro', 'árbol', 'banco', 'farola']);
    const six = [...four, obj('papelera'), obj('bicicleta')];
    expect(cleanDetection({ objects: six, person: false }, 'Spanish').objects.map(o => o.name)).toEqual(['perro', 'árbol', 'banco', 'farola']);
  });

  it('clamps positions out of range and fills in missing ones', () => {
    const [o] = cleanDetection({ objects: [{ name: 'perro', x: -0.3, y: 1.7, size: 4 }] }).objects;
    expect(o).toEqual({ name: 'perro', x: 0, y: 1, size: 1 });
    const [p] = cleanDetection({ objects: [{ name: 'perro', x: 'centro', y: null, size: NaN }] }).objects;
    expect(p).toEqual({ name: 'perro', x: 0.5, y: 0.5, size: 0.5 });
  });

  it('merges repeated names (ignoring case and accents) and drops empty ones', () => {
    const r = cleanDetection({ objects: [obj('Árbol', 0.2), obj('arbol', 0.8), obj(''), obj('none'), obj(42), obj('x'.repeat(61)), obj('banco')] }, 'Spanish');
    expect(r.objects.map(o => [o.name, o.x])).toEqual([['Árbol', 0.2], ['banco', 0.5]]);
  });

  it('never offers people or body parts, in each language', () => {
    expect(cleanDetection({ objects: [obj('niña con gafas'), obj('mano'), obj('manzana')], person: true }, 'Spanish')).toEqual({
      objects: [{ name: 'manzana', x: 0.5, y: 0.5, size: 0.3 }],
      person: false // there is an object to offer: no notice
    });
    expect(cleanDetection({ objects: [obj('girl'), obj('hand')] }, 'English')).toEqual({ objects: [], person: true });
    expect(cleanDetection({ objects: [obj('enfant')] }, 'French').person).toBe(true);
    expect(cleanDetection({ objects: [obj('Mädchen')] }, 'German').person).toBe(true);
    expect(cleanDetection({ objects: [], person: true }, 'Spanish')).toEqual({ objects: [], person: true });
    // whole words only: these are objects
    expect(cleanDetection({ objects: [obj('handbag'), obj('apple pie')] }, 'English').objects).toHaveLength(2);
    expect(cleanDetection({ objects: [obj('manopla')] }, 'Spanish').objects).toHaveLength(1);
  });

  it('asks for up to 4 objects with positions and never people', () => {
    const prompt = detectionPrompt('Spanish');
    expect(prompt).toMatch(/up to 4 main objects/);
    expect(prompt).toMatch(/Never list people/);
    expect(prompt).toContain('Spanish');
    expect(DETECTION_SCHEMA.strict).toBe(true);
    expect(DETECTION_SCHEMA.schema.properties.objects.items.required).toEqual(['name', 'x', 'y', 'size']);
  });
});
