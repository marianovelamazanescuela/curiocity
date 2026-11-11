// The study version, as its build would run it (__STUDY__ on for this file only).
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.hoisted(() => {
  globalThis.__STUDY__ = true; // Vitest turns define into a global, so a test file can switch it
});

import App from '../App';
import { pendingCount, resetStudyForTests, sendNow, studyParticipant, studyWrites } from './index';
import { closeQueueForTests } from './queue';
import { toCSV } from './export';

const fakeStream = { getTracks: () => [{ stop: vi.fn() }] };

const lesson = {
  pregunta_inicial: { pregunta: '¿Dónde están las semillas?', opciones: ['En la piel', 'En el centro', 'En el rabito'], correcta: 1 },
  dato_sorprendente: 'Si cortas una manzana por la mitad, ves una estrella.',
  por_que: 'Las semillas están en el centro.',
  reto: 'Cuenta las semillas de tu manzana.',
  reto_foto: false,
  reto_descubrimiento: 'Cada hueco de la estrella guarda semillas.',
  para_seguir_pensando: '¿Qué pasaría si plantas una semilla?',
  ideas_pregunta_final: ['Podría crecer un manzano.', 'Necesitaría agua y luz.'],
  conexion_debil: false,
  objetos_relacionados: ['pera'],
  enlaces: [{ title: 'Manzana', url: 'https://es.vikidia.org/wiki/Manzana', source: 'Vikidia' }],
  imagen_dato: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Manzana.jpg',
    ancho: 800,
    alto: 600,
    autor: 'Ana',
    licencia: 'CC BY-SA 4.0',
    archivo: 'https://commons.wikimedia.org/wiki/File:Manzana.jpg'
  }
};
const ranking = { featured: [{ key: 'biologia', hook: 'Dentro hay una estrella' }], others: ['historia', 'artes', 'matematicas', 'lengua', 'geologia', 'musica'] };
const twoObjects = {
  object: 'manzana',
  objects: [
    { name: 'manzana', x: 0.2, y: 0.5, size: 0.3 },
    { name: 'vaso', x: 0.8, y: 0.5, size: 0.3 }
  ]
};

// A fake server: the app's usual routes plus the study ones. `server.online = false` cuts the network.
let server;
function mockServer() {
  // online: false cuts the study routes only (the app's own routes keep working).
  // confirm(event): whether the server confirms that event.
  server = { online: true, received: [], codes: ['LINCE-47', 'GARZA-83', 'NUBE-25'], password: 'clave-investigadora', confirm: () => true };
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (!server.online && url.includes('/api/study/')) throw new TypeError('Failed to fetch');
    if (url.endsWith('/api/detect')) return Response.json(twoObjects);
    if (url.endsWith('/api/subjects')) return Response.json({ ranking });
    if (url.endsWith('/api/ai')) return Response.json(lesson);
    if (url.endsWith('/api/study/codigo')) return Response.json({ codigo: server.codes.shift() });
    if (url.endsWith('/api/study/admin')) {
      const ok = options.headers.Authorization === `Basic ${btoa(`investigador:${server.password}`)}`;
      return new Response(null, { status: ok ? 204 : 401 });
    }
    if (url.endsWith('/api/study/events')) {
      expect(options.headers['X-Study-Key']).toBeDefined();
      const { eventos } = JSON.parse(options.body);
      const accepted = eventos.filter(e => server.confirm(e));
      for (const e of accepted) if (!server.received.some(r => r.id === e.id)) server.received.push(e);
      return Response.json({ ok: true, ids: accepted.map(e => e.id), rechazados: [] });
    }
    throw new Error('unexpected ' + url);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(async () => {
  vi.stubGlobal('navigator', {
    ...window.navigator,
    languages: ['es-ES'],
    language: 'es-ES',
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) }
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
  await closeQueueForTests();
  await new Promise(resolve => {
    const r = indexedDB.deleteDatabase('curiocity_estudio');
    r.onsuccess = r.onerror = r.onblocked = resolve;
  });
  localStorage.clear();
  resetStudyForTests();
  mockServer();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

// Everything recorded so far reaches the (fake) server.
async function deliver() {
  await studyWrites();
  await sendNow();
}

async function startFirstTime(user) {
  const view = render(<App />);
  expect(await screen.findByRole('heading', { name: 'Apunta este código' }, { timeout: 5000 })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Empezar' }));
  return view;
}

async function takePhoto(user) {
  const shutter = await screen.findByRole('button', { name: 'Hacer foto' });
  await waitFor(() => expect(shutter).toBeEnabled());
  await user.click(shutter);
}

async function walkThroughLesson(user) {
  await takePhoto(user);
  await user.click(await screen.findByRole('button', { name: 'manzana' }));
  await user.click(await screen.findByRole('button', { name: /Biología/ }));
  await user.click(await screen.findByRole('button', { name: 'En el centro' }));
  for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: /Siguiente/ }));
  await user.click(screen.getByRole('button', { name: '¡Reto hecho!' }));
  await user.click(screen.getByRole('button', { name: /Siguiente/ }));
  await user.click(screen.getByRole('button', { name: /Ver algunas ideas/ }));
  await user.click(screen.getByRole('button', { name: /Siguiente/ }));
  await screen.findByRole('region', { name: /Sigue explorando/ });
}

describe('participant code', () => {
  it('the first time, shows the code from the server in big letters; later opens keep it without the screen', async () => {
    const user = userEvent.setup();
    const first = await startFirstTime(user);
    expect(screen.queryByRole('heading', { name: 'Apunta este código' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Versión de estudio, código LINCE-47/ })).toHaveTextContent('Estudio · LINCE-47');
    await deliver();
    first.unmount();

    // Another day: same code, no code screen, a new session
    resetStudyForTests();
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Hacer foto' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Apunta este código' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /código LINCE-47/ })).toBeInTheDocument();
    await deliver();

    const starts = server.received.filter(e => e.tipo === 'sesion_inicio');
    expect(starts).toHaveLength(2);
    expect(new Set(starts.map(e => e.sesion)).size).toBe(2);
    expect(server.received.every(e => e.participante === 'LINCE-47')).toBe(true);
  });

  it('without a connection the first time, asks for one and records nothing until there is a code', async () => {
    server.online = false;
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/Hace falta conexión/)).toBeInTheDocument();
    expect(studyParticipant()).toBeNull();
    server.online = true;
    await user.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    expect(await screen.findByText('LINCE-47')).toBeInTheDocument();
  });

  it('the code screen cannot be skipped with Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('LINCE-47');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('heading', { name: 'Apunta este código' })).toBeInTheDocument();
  });
});

describe('events', () => {
  it('records the whole walk and sends it to the server, without the photo or image addresses', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    await startFirstTime(user);
    await walkThroughLesson(user);
    await user.click(screen.getByRole('link', { name: /Manzana/ }));
    await user.click(screen.getByRole('button', { name: /WhatsApp/ }));
    await user.click(screen.getByRole('button', { name: 'Hacer otra foto' }));
    await deliver();

    const eventos = server.received;
    const summary = eventos.map(e => [e.tipo, e.detalles.accion || e.detalles.resultado || ''].join(':'));
    expect(summary).toEqual(
      expect.arrayContaining([
        'sesion_inicio:', 'foto:detectada', 'foto:elegido', 'asignaturas:mostradas', 'asignaturas:elegida', 'leccion:',
        'pantalla:entrada', 'pregunta:', 'pantalla:salida', 'reto:hecho', 'ideas_final:', 'final:enciclopedia', 'final:compartir'
      ])
    );
    for (const e of eventos) {
      expect(e).toMatchObject({ participante: 'LINCE-47', sesion: expect.stringMatching(/^S-/) });
      expect(e.id).toMatch(/^[a-z0-9-]{10,40}$/);
      expect(new Date(e.fecha).toISOString()).toBe(e.fecha);
    }
    const find = (tipo, accion) => eventos.find(e => e.tipo === tipo && (!accion || e.detalles.accion === accion));
    expect(find('foto', 'detectada').detalles).toEqual({ accion: 'detectada', objetos: ['manzana', 'vaso'], metodo: 'server' });
    expect(find('asignaturas', 'elegida')).toMatchObject({ asignatura: 'biologia', detalles: { destacada: true, desde: 'asignaturas' } });
    expect(find('pregunta')).toMatchObject({ pantalla: 'pregunta', detalles: { opcion: 1, acierta: true } });
    expect(find('final', 'compartir').detalles).toEqual({ accion: 'compartir', canal: 'whatsapp' });

    // The lesson once, with an id that links every screen
    const lessons = eventos.filter(e => e.tipo === 'leccion');
    expect(lessons).toHaveLength(1);
    expect(lessons[0].detalles.leccion.dato_sorprendente).toBe(lesson.dato_sorprendente);
    expect(lessons[0].detalles.leccion.imagen_dato).toEqual({ autor: 'Ana', licencia: 'CC BY-SA 4.0', archivo: lesson.imagen_dato.archivo });
    expect(eventos.filter(e => e.tipo === 'pantalla').every(e => e.leccion_id === lessons[0].leccion_id)).toBe(true);
    const exits = eventos.filter(e => e.tipo === 'pantalla' && e.detalles.accion === 'salida');
    expect(exits.map(e => `${e.pantalla}:${e.detalles.salida}`)).toEqual([
      'pregunta:avance', 'dato:avance', 'porque:avance', 'reto:avance', 'pensar:avance', 'explorar:otra_foto'
    ]);
    // Never the photo or any image
    const all = JSON.stringify(eventos);
    expect(all).not.toMatch(/data:image|base64|upload\.wikimedia/);
    expect(await pendingCount()).toBe(0);
  });

  it('without a connection nothing is lost: the outbox empties when the connection comes back', async () => {
    const user = userEvent.setup();
    await startFirstTime(user);
    await deliver();
    const before = server.received.length;

    server.online = false;
    await takePhoto(user);
    await user.click(await screen.findByRole('button', { name: 'manzana' }));
    await deliver(); // fails: offline
    const waiting = await pendingCount();
    expect(waiting).toBeGreaterThan(0);
    expect(server.received).toHaveLength(before);

    server.online = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(async () => expect(await pendingCount()).toBe(0));
    expect(server.received.length).toBe(before + waiting);
    expect(server.received.some(e => e.tipo === 'foto' && e.detalles.accion === 'elegido')).toBe(true);
  });

  it('an event leaves the phone only when the server confirms it', async () => {
    const user = userEvent.setup();
    await startFirstTime(user);
    await takePhoto(user);
    await user.click(await screen.findByRole('button', { name: 'manzana' }));
    await studyWrites();
    server.confirm = e => e.tipo !== 'foto'; // the server confirms everything but the photo events
    await sendNow();
    expect(await pendingCount()).toBe(2); // the photo detected and the object chosen are still here
    expect(server.received.some(e => e.tipo === 'foto')).toBe(false);
    server.confirm = () => true;
    await sendNow();
    expect(await pendingCount()).toBe(0);
  });

  it('after a failure it waits longer and longer before trying again', async () => {
    const fetchMock = mockServer();
    server.online = false;
    const timeouts = vi.spyOn(globalThis, 'setTimeout');
    const user = userEvent.setup();
    localStorage.setItem('curiocity_estudio', JSON.stringify({ codigo: 'LINCE-47', visto: true }));
    render(<App />);
    await screen.findByRole('button', { name: 'Hacer foto' });
    await deliver();
    await sendNow();
    await sendNow();
    const waits = timeouts.mock.calls.map(([, ms]) => ms).filter(ms => ms >= 5000);
    expect(waits.slice(0, 3)).toEqual([5000, 10000, 20000]);
    expect(fetchMock).toHaveBeenCalled();
    await user.keyboard('{Escape}');
  });
});

describe('researcher pages', () => {
  it('the badge opens the details, with a CSV copy of what is still on the phone', async () => {
    const user = userEvent.setup();
    await startFirstTime(user);
    server.online = false;
    await takePhoto(user);
    await user.click(await screen.findByRole('button', { name: 'manzana' }));
    await user.click(await screen.findByRole('button', { name: 'Volver a los objetos' }));
    await user.click(screen.getByRole('button', { name: 'Hacer otra foto' }));
    await deliver();

    const blobs = [];
    vi.stubGlobal('URL', { ...URL, createObjectURL: blob => (blobs.push(blob), 'blob:copia'), revokeObjectURL: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: /código LINCE-47/ }));
    expect(await screen.findByRole('heading', { name: 'Versión de estudio' })).toBeInTheDocument();
    expect(await screen.findByText(/registros esperando a enviarse/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Exportar copia (CSV)' }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    const csv = await blobs[0].text();
    expect(csv.split('\r\n')[0]).toContain('"id","fecha","sesion","participante","tipo"');
    expect(csv).toContain('"foto"');
    expect(csv).toContain('LINCE-47');
  });

  it('/?reiniciar-estudio asks for the password, sends what is pending and gives a new code', async () => {
    localStorage.setItem('curiocity_estudio', JSON.stringify({ codigo: 'LINCE-47', visto: true }));
    server.codes = ['GARZA-83'];
    window.history.replaceState(null, '', '/?reiniciar-estudio');
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Reiniciar el estudio en este móvil' }, { timeout: 5000 })).toBeInTheDocument();
    expect(window.location.search).toBe(''); // a reload goes back to the normal app

    await user.type(screen.getByLabelText('Contraseña'), 'otra');
    await user.click(screen.getByRole('button', { name: 'Reiniciar con un código nuevo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Contraseña incorrecta');
    expect(studyParticipant()).toBe('LINCE-47');

    await user.clear(screen.getByLabelText('Contraseña'));
    await user.type(screen.getByLabelText('Contraseña'), server.password);
    await user.click(screen.getByRole('button', { name: 'Reiniciar con un código nuevo' }));
    expect(await screen.findByRole('heading', { name: 'Apunta este código' })).toBeInTheDocument();
    expect(screen.getByText('GARZA-83')).toBeInTheDocument();
    const end = server.received.find(e => e.tipo === 'sesion_fin');
    expect(end).toMatchObject({ participante: 'LINCE-47', detalles: { motivo: 'reinicio' } });

    await user.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(await screen.findByRole('button', { name: /código GARZA-83/ })).toBeInTheDocument();
  });

  it('does not reset while something could not be sent', async () => {
    localStorage.setItem('curiocity_estudio', JSON.stringify({ codigo: 'LINCE-47', visto: true }));
    window.history.replaceState(null, '', '/?reiniciar-estudio');
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText('Contraseña');
    server.confirm = () => false; // the server answers but confirms nothing
    await user.type(screen.getByLabelText('Contraseña'), server.password);
    await user.click(screen.getByRole('button', { name: 'Reiniciar con un código nuevo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se han podido enviar \d+ registros/);
    expect(studyParticipant()).toBe('LINCE-47');
  });
});

describe('backup CSV', () => {
  it('escapes commas, quotes, line breaks and formulas', () => {
    const csv = toCSV([{ id: 'a', tipo: 'foto', objeto: '=SUMA(1)', detalles: { texto: 'dijo "hola", y\nadiós' } }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain(`"'=SUMA(1)"`);
    expect(csv).toContain('"{""texto"":""dijo \\""hola\\"", y\\nadiós""}"');
  });
});
