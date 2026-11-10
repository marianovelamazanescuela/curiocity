import { describe, expect, it } from 'vitest';
import { objectsFromCoco, objectsFromServer } from './detection';

const box = (cls, x, y, w, h, score = 0.9) => ({ class: cls, score, bbox: [x, y, w, h] });

describe('objectsFromCoco (local fallback)', () => {
  it('uses the real boxes, normalised over the photo', () => {
    expect(objectsFromCoco([box('dog', 100, 200, 300, 200)], 800)).toEqual({
      objects: [{ name: 'dog', x: 0.313, y: 0.375, size: 0.375 }],
      person: false
    });
  });

  it('never offers people; the notice only when there is nothing else', () => {
    expect(objectsFromCoco([box('person', 0, 0, 800, 800), box('apple', 10, 10, 100, 100)], 800)).toEqual({
      objects: [{ name: 'apple', x: 0.075, y: 0.075, size: 0.125 }],
      person: false
    });
    expect(objectsFromCoco([box('person', 0, 0, 800, 800)], 800)).toEqual({ objects: [], person: true });
    expect(objectsFromCoco([], 800)).toEqual({ objects: [], person: false });
  });

  it('one entry per class (the biggest), biggest first, at most 4', () => {
    const r = objectsFromCoco(
      [
        box('cup', 0, 0, 50, 50),
        box('apple', 0, 0, 100, 100),
        box('apple', 400, 400, 200, 200),
        box('bench', 0, 0, 600, 300),
        box('book', 0, 0, 120, 120),
        box('clock', 0, 0, 80, 80),
        box('bottle', 0, 0, 60, 200)
      ],
      800
    );
    expect(r.objects.map(o => o.name)).toEqual(['bench', 'apple', 'book', 'bottle']);
    expect(r.objects[1]).toEqual({ name: 'apple', x: 0.625, y: 0.625, size: 0.25 });
  });

  it('keeps boxes that go past the edge inside the photo', () => {
    expect(objectsFromCoco([box('tree', 700, -100, 400, 300)], 800).objects[0]).toEqual({ name: 'tree', x: 1, y: 0.063, size: 0.5 });
  });
});

describe('objectsFromServer', () => {
  it('takes the objects, clamped, at most 4', () => {
    const objects = ['perro', 'árbol', 'banco', 'farola', 'papelera'].map(name => ({ name, x: 1.4, y: -1, size: 0.3 }));
    const r = objectsFromServer({ object: 'perro', objects });
    expect(r.objects).toHaveLength(4);
    expect(r.objects[0]).toEqual({ name: 'perro', x: 1, y: 0, size: 0.3 });
  });

  it('understands people, nothing found and the old single-object answer', () => {
    expect(objectsFromServer({ object: null, objects: [], person: true })).toEqual({ objects: [], person: true });
    expect(objectsFromServer({ object: null, objects: [] })).toEqual({ objects: [], person: false });
    expect(objectsFromServer({ object: 'manzana' })).toEqual({ objects: [{ name: 'manzana', x: 0.5, y: 0.5, size: 0.5 }], person: false });
    expect(objectsFromServer(null)).toEqual({ objects: [], person: false });
  });
});
