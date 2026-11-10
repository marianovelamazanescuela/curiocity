import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activateStudy, changeParticipant, clearStudyData, deactivateStudy, flushStudy, isStudyActive,
  readStudyData, resetStudyForTests, studyStoreLoaded, track, trackLesson
} from './index';
import { changePin, checkPin, cleanParticipant } from './config';
import { CSV_COLUMNS, exportName, summarize, toCSV, toJSON } from './export';
import { closeForTests } from './store';

async function freshDatabase() {
  closeForTests();
  await new Promise(resolve => {
    const r = indexedDB.deleteDatabase('curiocity_estudio');
    r.onsuccess = r.onerror = r.onblocked = resolve;
  });
}

beforeEach(async () => {
  localStorage.clear();
  await freshDatabase();
  resetStudyForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Minimal CSV parser (quoted fields, "" escapes, CRLF), to check the export is valid CSV.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else field += c;
  }
  return rows;
}

describe('switched off (the default)', () => {
  it('records nothing and never loads the storage code', async () => {
    expect(isStudyActive()).toBe(false);
    track('foto', { accion: 'detectada', objetos: ['perro'] });
    expect(trackLesson({ por_que: 'x' }, { objeto: 'Perro', asignatura: 'biologia' })).toBeNull();
    await flushStudy();
    expect(studyStoreLoaded()).toBe(false);
    expect(await new Promise(r => { const q = indexedDB.open('curiocity_estudio'); q.onupgradeneeded = () => r('no existía'); q.onsuccess = () => { q.result.close(); r('existía'); }; })).toBe('no existía');
  });

  it('after switching off, nothing more is recorded', async () => {
    activateStudy('G1-P1');
    track('reto', { resultado: 'hecho' });
    deactivateStudy();
    track('reto', { resultado: 'hecho' });
    const { eventos } = await readStudyData();
    expect(eventos.map(e => e.tipo)).toEqual(['sesion_inicio', 'reto', 'sesion_fin']);
    expect(eventos.at(-1).detalles).toEqual({ motivo: 'desactivado' });
  });
});

describe('switched on', () => {
  it('records each event with time, session, participant and type; context in its own columns', async () => {
    activateStudy('G1-P3');
    track('pantalla', { leccion_id: 'L-1', objeto: 'Manzana', asignatura: 'biologia', pantalla: 'dato', accion: 'entrada' });
    const { eventos } = await readStudyData();
    const e = eventos[1];
    expect(e).toEqual({
      fecha: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/),
      sesion: eventos[0].sesion,
      participante: 'G1-P3',
      tipo: 'pantalla',
      leccion_id: 'L-1',
      objeto: 'Manzana',
      asignatura: 'biologia',
      pantalla: 'dato',
      detalles: { accion: 'entrada' }
    });
    expect(e.sesion).toMatch(/^S-/);
  });

  it('keeps the lesson once, without picture addresses, linked to its events', async () => {
    activateStudy('G1-P3');
    const lesson = {
      dato_sorprendente: 'Dentro hay una estrella.',
      imagen_dato: { src: 'https://upload.wikimedia.org/x.jpg', ancho: 600, alto: 400, autor: 'Ana', licencia: 'CC BY-SA 4.0', archivo: 'https://commons.wikimedia.org/wiki/File:X.jpg', termino: 'Semilla' }
    };
    const id = trackLesson(lesson, { objeto: 'Manzana', asignatura: 'biologia' });
    const { eventos, lecciones } = await readStudyData();
    expect(lecciones).toHaveLength(1);
    expect(lecciones[0]).toMatchObject({ id, participante: 'G1-P3', objeto: 'Manzana', asignatura: 'biologia' });
    expect(lecciones[0].leccion.imagen_dato).toEqual({ autor: 'Ana', licencia: 'CC BY-SA 4.0', archivo: 'https://commons.wikimedia.org/wiki/File:X.jpg', termino: 'Semilla' });
    expect(JSON.stringify(lecciones)).not.toContain('upload.wikimedia.org');
    expect(eventos.find(e => e.tipo === 'leccion')).toMatchObject({ leccion_id: id, objeto: 'Manzana' });
  });

  it('two participants in a row: each with their own session', async () => {
    activateStudy('G1-P1');
    track('foto', { accion: 'detectada', objetos: ['perro'] });
    expect(changeParticipant('G1 P2')).toBe(false); // spaces are not allowed
    expect(changeParticipant('G1-P2')).toBe(true);
    track('foto', { accion: 'detectada', objetos: ['árbol'] });
    const { eventos } = await readStudyData();
    expect(eventos.map(e => `${e.participante}:${e.tipo}`)).toEqual([
      'G1-P1:sesion_inicio', 'G1-P1:foto', 'G1-P1:sesion_fin',
      'G1-P2:sesion_inicio', 'G1-P2:cambio_participante', 'G1-P2:foto'
    ]);
    expect(eventos[4].detalles).toEqual({ anterior: 'G1-P1' });
    expect(new Set(eventos.map(e => e.sesion)).size).toBe(2);
  });

  it('deleting removes every event and lesson', async () => {
    activateStudy('G1-P1');
    trackLesson({ por_que: 'x' }, { objeto: 'Perro', asignatura: 'biologia' });
    await clearStudyData();
    expect(await readStudyData()).toEqual({ eventos: [], lecciones: [] });
  });
});

describe('participant and adult codes', () => {
  it('participant codes: no spaces, up to 12 characters', () => {
    expect(cleanParticipant(' G1-P3 ')).toBe('G1-P3');
    expect(cleanParticipant('Ana López')).toBeNull();
    expect(cleanParticipant('')).toBeNull();
    expect(cleanParticipant('x'.repeat(13))).toBeNull();
    expect(cleanParticipant('x'.repeat(12))).toBe('x'.repeat(12));
    expect(activateStudy('con espacio')).toBe(false);
    expect(isStudyActive()).toBe(false);
  });

  it('the adult code is 2468 until it is changed, and is never stored in plain text', async () => {
    expect(await checkPin('2468')).toBe(true);
    expect(await checkPin('1234')).toBe(false);
    expect(await checkPin('24680')).toBe(false);
    expect(await changePin('97')).toBe(false);
    expect(await changePin('1357')).toBe(true);
    expect(await checkPin('1357')).toBe(true);
    expect(await checkPin('2468')).toBe(false);
    expect(localStorage.getItem('curiocity_study_v1')).not.toContain('1357');
  });
});

describe('export', () => {
  const eventos = [
    { fecha: '2026-11-10T09:00:00.000Z', sesion: 'S-1', participante: 'G1-P1', tipo: 'sesion_inicio', detalles: {} },
    { fecha: '2026-11-10T09:00:30.000Z', sesion: 'S-1', participante: 'G1-P1', tipo: 'foto', detalles: { accion: 'detectada', objetos: ['manzana, roja', 'vaso "alto"'], metodo: 'servidor' } },
    { fecha: '2026-11-10T09:01:00.000Z', sesion: 'S-1', participante: 'G1-P1', tipo: 'leccion', leccion_id: 'L-1', objeto: 'Manzana', asignatura: 'biologia', detalles: {} },
    { fecha: '2026-11-10T09:01:20.000Z', sesion: 'S-1', participante: 'G1-P1', tipo: 'pregunta', leccion_id: 'L-1', objeto: 'Manzana', asignatura: 'biologia', pantalla: 'pregunta', detalles: { opcion: 1, acierta: true, tiempo_ms: 8000 } },
    { fecha: '2026-11-10T09:03:00.000Z', sesion: 'S-1', participante: 'G1-P1', tipo: 'reto', leccion_id: 'L-1', detalles: { resultado: 'hecho' } },
    { fecha: '2026-11-10T09:05:00.000Z', sesion: 'S-1', participante: 'G1-P1', tipo: 'pantalla', leccion_id: 'L-1', pantalla: 'explorar', detalles: { accion: 'entrada' } },
    { fecha: '2026-11-10T09:10:00.000Z', sesion: 'S-2', participante: '=G2', tipo: 'foto', detalles: { accion: 'detectada', objetos: ['línea\nnueva'] } }
  ];

  it('the CSV is valid: one row per event, flat columns and the details as JSON', () => {
    const csv = toCSV(eventos);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const rows = parseCSV(csv.slice(1));
    expect(rows[0]).toEqual(CSV_COLUMNS);
    expect(rows).toHaveLength(eventos.length + 1);
    expect(rows.every(r => r.length === CSV_COLUMNS.length)).toBe(true);
    expect(JSON.parse(rows[2][8])).toEqual(eventos[1].detalles); // commas and quotes survive
    expect(rows[4].slice(4, 8)).toEqual(['L-1', 'Manzana', 'biologia', 'pregunta']);
    expect(JSON.parse(rows[7][8]).objetos).toEqual(['línea\nnueva']);
    expect(rows[7][2]).toBe("'=G2"); // never runs as a spreadsheet formula
  });

  it('the JSON has every event and lesson', () => {
    const data = JSON.parse(toJSON({ eventos, lecciones: [{ id: 'L-1' }] }, new Date('2026-11-10T10:00:00Z')));
    expect(data).toMatchObject({ app: 'Curiocity', exportado: '2026-11-10T10:00:00.000Z', lecciones: [{ id: 'L-1' }] });
    expect(data.eventos).toHaveLength(eventos.length);
  });

  it('names the file curiocity-estudio-AAAAMMDD-HHMM', () => {
    expect(exportName(new Date(2026, 10, 9, 8, 5))).toBe('curiocity-estudio-20261109-0805');
  });

  it('sums up each participant', () => {
    expect(summarize(eventos)).toEqual([
      { participante: 'G1-P1', sesiones: 1, fotos: 1, lecciones: 1, completadas: 1, preguntas: 1, aciertos: 1, retos: 1, minutos: 5 },
      { participante: '=G2', sesiones: 1, fotos: 1, lecciones: 0, completadas: 0, preguntas: 0, aciertos: 0, retos: 0, minutos: 0 }
    ]);
  });
});
