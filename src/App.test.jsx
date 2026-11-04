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

const aiContent = {
  title: 'La manzana y la vida',
  text: 'Las manzanas crecen en árboles.',
  explanation: 'Primer párrafo.\n\nSegundo párrafo.',
  funFacts: ['Flotan en el agua.'],
  links: [{ title: 'Khan Academy', url: 'https://www.khanacademy.org/x', source: '' }],
  relatedObjects: ['pera']
};

function mockServer({ detect = { object: 'manzana' }, ai = aiContent, aiStatus = 200, subjects = null } = {}) {
  const fetchMock = vi.fn(async url => {
    if (url.endsWith('/api/detect')) return Response.json(detect);
    if (url.endsWith('/api/subjects')) return Response.json({ subjects });
    if (url.endsWith('/api/ai')) return aiStatus === 200 ? Response.json(ai) : new Response('', { status: aiStatus });
    throw new Error('unexpected ' + url);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function takePhoto(user) {
  const shutter = await screen.findByRole('button', { name: 'Hacer foto' });
  await waitFor(() => expect(shutter).toBeEnabled());
  await user.click(shutter);
}

describe('App', () => {
  it('photo → subject → content, in the browser language', async () => {
    const fetchMock = mockServer();
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    expect(await screen.findByRole('heading', { name: 'Manzana' })).toBeInTheDocument();
    expect(screen.getByText('¿Qué quieres descubrir?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Biología/ }));
    expect(await screen.findByRole('heading', { name: aiContent.title })).toBeInTheDocument();
    expect(screen.getByText('Segundo párrafo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Khan Academy/ })).toHaveAttribute('href', aiContent.links[0].url);

    const aiCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/api/ai'));
    expect(JSON.parse(aiCall[1].body)).toEqual({ objectName: 'Manzana', subject: 'Biology', language: 'Spanish', ageGroup: '6-8' });

    // Related object → back to the subject picker for that object
    await user.click(screen.getByRole('button', { name: 'pera' }));
    expect(await screen.findByRole('heading', { name: 'Pera' })).toBeInTheDocument();
  });

  it('sends the chosen age group and remembers it on the device', async () => {
    const fetchMock = mockServer();
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    const older = await screen.findByRole('radio', { name: '9–12 años' });
    expect(screen.getByRole('radio', { name: '6–8 años' })).toBeChecked(); // default
    await user.click(older);
    expect(older).toBeChecked();
    expect(localStorage.getItem('curiocity_age')).toBe('9-12');

    await user.click(screen.getByRole('button', { name: 'Biología' }));
    await screen.findByRole('heading', { name: aiContent.title });
    const aiCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/api/ai'));
    expect(JSON.parse(aiCall[1].body).ageGroup).toBe('9-12');
  });

  it('reads the content aloud with the device voice, in the child\'s language', async () => {
    mockServer();
    const spoken = [];
    const synth = { speak: vi.fn(u => spoken.push(u)), cancel: vi.fn(), getVoices: () => [] };
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', function (text) { this.text = text; });
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    await user.click(await screen.findByRole('button', { name: 'Biología' }));
    await user.click(await screen.findByRole('button', { name: 'Escuchar' }));

    expect(spoken.map(u => u.text)).toEqual([
      aiContent.title, aiContent.text, 'Primer párrafo.', 'Segundo párrafo.', '¿Sabías que…?', ...aiContent.funFacts
    ]);
    expect(spoken[0].lang).toBe('es-ES');

    await user.click(screen.getByRole('button', { name: 'Parar' }));
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Escuchar' })).toBeInTheDocument();
  });

  it('only shows the subjects related to the object', async () => {
    mockServer({ detect: { object: 'plátano', subjects: ['biologia', 'historia'] } });
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    expect(await screen.findByRole('button', { name: 'Biología' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Historia' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Música' })).not.toBeInTheDocument();

    // "other subjects" in the content view is filtered too
    await user.click(screen.getByRole('button', { name: 'Biología' }));
    await screen.findByRole('heading', { name: aiContent.title });
    expect(screen.getByRole('button', { name: /Historia/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Música/ })).not.toBeInTheDocument();
  });

  it('keeps discoveries in a local history that can be reopened and cleared', async () => {
    mockServer();
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    await screen.findByRole('heading', { name: 'Manzana' });
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    await user.click(await screen.findByRole('button', { name: 'Mis descubrimientos' }));
    await user.click(await screen.findByRole('button', { name: /Manzana/ }));
    expect(await screen.findByText('¿Qué quieres descubrir?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
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
    expect(await screen.findByRole('heading', { name: 'Arte: Manzana' })).toBeInTheDocument();
    // offline templates are activities, so the list isn't titled "Did you know…?"
    expect(screen.getByRole('heading', { name: 'Prueba esto' })).toBeInTheDocument();
    expect(screen.queryByText('¿Sabías que…?')).not.toBeInTheDocument();
  });

  it('does not describe people in the photo', async () => {
    mockServer({ detect: { object: null, person: true } });
    const user = userEvent.setup();
    render(<App />);

    await takePhoto(user);
    expect(await screen.findByText('Eso parece una persona')).toBeInTheDocument();
    expect(screen.queryByText('¿Qué quieres descubrir?')).not.toBeInTheDocument();
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
