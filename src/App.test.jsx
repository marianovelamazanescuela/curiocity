import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// ---- Browser APIs that jsdom doesn't implement ----
const fakeStream = { getTracks: () => [{ stop: vi.fn() }] };

beforeEach(() => {
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
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const lesson = {
  pregunta_inicial: { pregunta: '¿Dónde están las semillas?', opciones: ['En la piel', 'En el centro', 'En el rabito'], correcta: 1 },
  dato_sorprendente: 'Si cortas una manzana por la mitad, ves una estrella.',
  por_que: 'Las semillas están en el centro.\n\nAsí están protegidas.',
  reto: 'Cuenta las semillas de tu manzana.',
  reto_foto: false,
  para_seguir_pensando: '¿Qué pasaría si plantas una semilla?',
  conexion_debil: false,
  objetos_relacionados: ['pera'],
  enlaces: [{ title: 'Manzana', url: 'https://es.vikidia.org/wiki/Manzana', source: 'Vikidia' }]
};

const ranking = {
  featured: [
    { key: 'biologia', hook: 'Dentro hay una estrella escondida' },
    { key: 'historia', hook: 'Hace miles de años ya se comían' },
    { key: 'artes', hook: 'Muchos pintores las han pintado' }
  ],
  others: ['matematicas', 'lengua', 'geologia', 'musica']
};

function mockServer({ detect = { object: 'manzana' }, ai = lesson, aiStatus = 200, subjects = { ranking } } = {}) {
  const fetchMock = vi.fn(async url => {
    if (url.endsWith('/api/detect')) return Response.json(detect);
    if (url.endsWith('/api/subjects')) return Response.json(subjects);
    if (url.endsWith('/api/ai')) return aiStatus === 200 ? Response.json(ai) : new Response('', { status: aiStatus });
    throw new Error('unexpected ' + url);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const bodyOf = (fetchMock, path) => JSON.parse(fetchMock.mock.calls.filter(([url]) => url.endsWith(path)).at(-1)[1].body);

async function takePhoto(user) {
  const shutter = await screen.findByRole('button', { name: 'Hacer foto' });
  await waitFor(() => expect(shutter).toBeEnabled());
  await user.click(shutter);
}

describe('App', () => {
  it('shows the 3 best subjects with a hook and the rest under "Más asignaturas"', async () => {
    const fetchMock = mockServer();
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    expect(await screen.findByRole('heading', { name: 'Manzana' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Biología.*Dentro hay una estrella escondida/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Historia.*Hace miles de años/ })).toBeInTheDocument();
    expect(bodyOf(fetchMock, '/api/subjects')).toEqual({ objectName: 'Manzana', language: 'Spanish' });

    const more = screen.getByText('Más asignaturas');
    expect(more.closest('details')).not.toHaveAttribute('open');
    await user.click(more);
    expect(more.closest('details')).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Música' })).toBeInTheDocument();
  });

  it('opens the subjects as a full-screen page over an inert camera; both top buttons and Escape go back', async () => {
    mockServer();
    const user = userEvent.setup();
    const { container } = render(<App />);

    await takePhoto(user);
    expect(await screen.findByRole('heading', { name: 'Manzana' })).toBeInTheDocument();
    expect(screen.getByText('Has encontrado')).toBeInTheDocument();
    expect(container.querySelector('.camera')).toHaveAttribute('inert');
    expect(container.querySelector('dialog')).toBeNull(); // no bottom sheet any more

    await user.click(screen.getByRole('button', { name: 'Objeto incorrecto: hacer otra foto' }));
    expect(await screen.findByRole('button', { name: 'Hacer foto' })).toBeInTheDocument();
    expect(container.querySelector('.camera')).not.toHaveAttribute('inert');

    await takePhoto(user);
    await screen.findByRole('heading', { name: 'Manzana' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Manzana' })).not.toBeInTheDocument());

    await takePhoto(user);
    await screen.findByRole('heading', { name: 'Manzana' });
    await user.click(screen.getByRole('button', { name: 'Volver a la cámara' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Manzana' })).not.toBeInTheDocument());
  });

  it('shows every subject, without hooks, when the ranking is unknown', async () => {
    mockServer({ subjects: { ranking: null } });
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    expect(await screen.findByRole('button', { name: 'Música' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^(Biología|Geología|Historia|Matemáticas|Lengua|Música|Arte)$/ })).toHaveLength(7);
    expect(screen.queryByText('Más asignaturas')).not.toBeInTheDocument();
  });

  it('walks through the lesson card by card: question, fact, why, challenge and final card', async () => {
    const fetchMock = mockServer();
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    await user.click(await screen.findByRole('button', { name: /Biología/ }));
    expect(await screen.findByRole('heading', { name: lesson.pregunta_inicial.pregunta })).toBeInTheDocument();
    expect(bodyOf(fetchMock, '/api/ai')).toEqual({ objectName: 'Manzana', subject: 'Biology', language: 'Spanish' });
    expect(screen.getByRole('region', { name: /Tarjeta 1 de 6/ })).toBeInTheDocument();

    // Nothing is explained before the child answers, and "Siguiente" waits for an answer
    expect(screen.queryByText(lesson.dato_sorprendente)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Siguiente/ })).not.toBeInTheDocument();
    expect(screen.getByText('Elige una respuesta para seguir')).toBeInTheDocument();

    // A wrong answer gets a kind message with the right one
    await user.click(screen.getByRole('button', { name: 'En la piel' }));
    expect(screen.getByText('¡Casi! La respuesta es: En el centro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En el centro' })).toBeDisabled();

    // One idea per card
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByRole('region', { name: /Tarjeta 2 de 6.*¿Sabías que…?/ })).toBeInTheDocument();
    expect(screen.getByText(lesson.dato_sorprendente)).toBeInTheDocument();
    expect(screen.queryByText('Así están protegidas.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByText('Así están protegidas.')).toBeInTheDocument();
    expect(screen.queryByText(lesson.dato_sorprendente)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByText(lesson.reto)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '¡Reto hecho!' }));
    expect(screen.getByText('¡Genial, qué buena investigación!')).toBeInTheDocument();

    // Screen 5: the open question alone
    expect(screen.queryByText(lesson.para_seguir_pensando)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByText(lesson.para_seguir_pensando)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Vikidia/ })).not.toBeInTheDocument();

    // Screen 6, "Sigue explorando": other subjects, related objects, links, sharing. No "Siguiente".
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByRole('region', { name: /Tarjeta 6 de 6.*Sigue explorando/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Siguiente/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manzana.*Vikidia/ })).toHaveAttribute('href', lesson.enlaces[0].url);
    // only the other featured subjects, with their hook; no invitation to take another photo yet
    expect(screen.getByRole('button', { name: /^Historia\s*Hace miles de años/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Arte\s*Muchos pintores/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Matemáticas|Música/ })).not.toBeInTheDocument();
    expect(screen.queryByText('¿Exploramos otro objeto?')).not.toBeInTheDocument();

    // "Anterior" goes back, and what the child did is kept
    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(screen.getByText(lesson.reto)).toBeInTheDocument();
    expect(screen.getByText('¡Genial, qué buena investigación!')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));

    // Related object → subject picker for that object
    await user.click(screen.getByRole('button', { name: 'pera' }));
    expect(await screen.findByRole('heading', { name: 'Pera' })).toBeInTheDocument();
    await waitFor(() => expect(bodyOf(fetchMock, '/api/subjects').objectName).toBe('Pera'));
  });

  it('at the end, leaves out the subjects already seen and then invites to take another photo', async () => {
    mockServer();
    const user = userEvent.setup();
    render(<App />);

    const goToEnd = async () => {
      await user.click(await screen.findByRole('button', { name: lesson.pregunta_inicial.opciones[1] }));
      for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    };
    const endSubjects = () =>
      screen.queryAllByRole('button', { name: /^(Biología|Historia|Arte)\s*\S/ }).map(b => b.querySelector('.subject-row__label').textContent);

    await takePhoto(user);
    await user.click(await screen.findByRole('button', { name: /Biología/ }));
    await goToEnd();
    expect(endSubjects()).toEqual(['Historia', 'Arte']);

    await user.click(screen.getByRole('button', { name: /^Historia\s*Hace/ }));
    await goToEnd();
    expect(endSubjects()).toEqual(['Arte']); // Biología was already seen

    await user.click(screen.getByRole('button', { name: /^Arte\s*Muchos/ }));
    await goToEnd();
    expect(endSubjects()).toEqual([]);
    expect(screen.queryByText('Míralo desde otra asignatura')).not.toBeInTheDocument();
    expect(screen.getByText('¿Exploramos otro objeto?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hacer otra foto' }));
    expect(await screen.findByRole('button', { name: 'Hacer foto' })).toBeInTheDocument();
  });

  it('without a ranking (server unavailable), the end of the lesson invites to take another photo', async () => {
    mockServer({ subjects: { ranking: null } });
    const user = userEvent.setup();
    render(<App />);
    await takePhoto(user);
    await user.click(await screen.findByRole('button', { name: 'Biología' }));
    await user.click(await screen.findByRole('button', { name: lesson.pregunta_inicial.opciones[1] }));
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.queryByText('Míralo desde otra asignatura')).not.toBeInTheDocument();
    expect(screen.getByText('¿Exploramos otro objeto?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pera' })).toBeInTheDocument(); // next to the related objects
  });

  it('celebrates a right answer, and "Siguiente" moves on without doing the challenge', async () => {
    mockServer();
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    await user.click(await screen.findByRole('button', { name: /Biología/ }));
    await user.click(await screen.findByRole('button', { name: 'En el centro' }));
    expect(screen.getByText('¡Bien visto!')).toBeInTheDocument();
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByText(lesson.reto)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ahora no' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByText(lesson.para_seguir_pensando)).toBeInTheDocument();
  });

  it('offers a new photo when the challenge is to find a similar object', async () => {
    mockServer({ ai: { ...lesson, reto: 'Busca otra fruta redonda y hazle una foto.', reto_foto: true } });
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    await user.click(await screen.findByRole('button', { name: /Biología/ }));
    await user.click(await screen.findByRole('button', { name: 'En el centro' }));
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    await user.click(screen.getByRole('button', { name: '¡Reto hecho!' }));
    await user.click(screen.getByRole('button', { name: 'Hacer otra foto' }));
    expect(await screen.findByRole('button', { name: 'Hacer foto' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Manzana' })).not.toBeInTheDocument());
  });

  it('has no age selector: a single audience (8-10)', async () => {
    mockServer();
    const user = userEvent.setup();
    render(<App />);
    await takePhoto(user);
    await screen.findByRole('button', { name: /Biología/ });
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByText(/Tengo|6–8|9–12/)).not.toBeInTheDocument();
  });

  it('keeps discoveries in a local history that can be reopened and cleared', async () => {
    mockServer();
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    await screen.findByRole('heading', { name: 'Manzana' });
    await user.click(screen.getByRole('button', { name: 'Volver a la cámara' }));

    await user.click(await screen.findByRole('button', { name: 'Mis descubrimientos' }));
    await user.click(await screen.findByRole('button', { name: /Manzana/ }));
    expect(await screen.findByText('¿Desde dónde quieres mirar?')).toBeInTheDocument();
    expect(await screen.findByText('Dentro hay una estrella escondida')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Volver a la cámara' }));
    await user.click(await screen.findByRole('button', { name: 'Mis descubrimientos' }));
    await user.click(await screen.findByRole('button', { name: 'Borrar historial' }));
    await user.click(screen.getByRole('button', { name: 'Toca otra vez para borrar' }));
    expect(screen.getByText(/Aquí aparecerán tus descubrimientos/)).toBeInTheDocument();
    expect(localStorage.getItem('curiocity_history_v1')).toBeNull();
  });

  it('uses the localized offline content when the AI server fails', async () => {
    mockServer({ aiStatus: 502 });
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    await user.click(await screen.findByRole('button', { name: /Arte/ }));
    expect(await screen.findByText(/Ahora no puedo preparar tu explicación/)).toBeInTheDocument();
    // no quiz offline: nothing true is known about the object
    expect(screen.queryByText('Adivina primero')).not.toBeInTheDocument();
    // 3 cards: investigate (intro + explanation), challenge, final
    expect(screen.getByRole('region', { name: /Tarjeta 1 de 4.*Investiga tú/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByText('Dibuja tu objeto usando solo dos colores.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '¡Reto hecho!' }));
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByRole('heading', { name: 'Prueba esto' })).toBeInTheDocument();
  });

  it('does not describe people in the photo', async () => {
    mockServer({ detect: { object: null, person: true } });
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    expect(await screen.findByText('Eso parece una persona')).toBeInTheDocument();
    expect(screen.queryByText('¿Desde dónde quieres mirar?')).not.toBeInTheDocument();
  });

  it('tells the child when nothing was recognised', async () => {
    mockServer({ detect: { object: null } });
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    expect(await screen.findByText('Mmm, no lo he visto bien')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Otra foto' }));
    expect(await screen.findByRole('button', { name: 'Hacer foto' })).toBeInTheDocument();
  });

  it('explains what to do when the camera is blocked', async () => {
    mockServer();
    navigator.mediaDevices.getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No puedo usar la cámara');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
