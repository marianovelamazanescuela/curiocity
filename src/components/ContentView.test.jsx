import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContentView from './ContentView';
import { translations } from '../i18n';

const t = translations.es;

const lesson = {
  pregunta_inicial: { pregunta: '¿Dónde están las semillas?', opciones: ['En la piel', 'En el centro', 'En el rabito'], correcta: 1 },
  dato_sorprendente: 'Si cortas una manzana por la mitad, ves una estrella.',
  por_que: 'Las semillas están en el centro.',
  reto: 'Cuenta las semillas de tu manzana.',
  reto_foto: false,
  reto_descubrimiento: 'Las semillas de la manzana se forman en el centro, protegidas por una envoltura dura como de papel.',
  para_seguir_pensando: '¿Qué pasaría si plantas una semilla?',
  ideas_pregunta_final: ['Podría crecer un manzano.', 'Necesitaría agua y luz.'],
  conexion_debil: false,
  objetos_relacionados: [],
  enlaces: []
};

function renderLesson(props = {}) {
  return render(
    <ContentView
      t={t}
      photo={null}
      objectName="Manzana"
      subjectKey="biologia"
      content={lesson}
      onBack={() => {}}
      onSelectSubject={() => {}}
      onRelatedObject={() => {}}
      onToast={() => {}}
      onTakePhoto={() => {}}
      {...props}
    />
  );
}

const currentCard = () => screen.getByRole('region', { name: /Tarjeta/ });
const next = () => screen.getByRole('button', { name: /Siguiente/ });

function swipe(element, { dx, dy = 0 }) {
  fireEvent.touchStart(element, { touches: [{ clientX: 200, clientY: 300 }] });
  fireEvent.touchEnd(element, { changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] });
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Lesson cards', () => {
  it('shows progress dots and big Previous / Next buttons', () => {
    const { container } = renderLesson();
    expect(container.querySelectorAll('.dots__dot')).toHaveLength(5);
    expect(container.querySelector('.dots__dot--on')).toBe(container.querySelector('.dots__dot'));
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled(); // first card
    expect(next()).toHaveClass('lesson-nav__btn');
  });

  it('does not move past the question until it is answered, not even by swiping', async () => {
    const user = userEvent.setup();
    renderLesson();
    expect(next()).toBeDisabled();
    expect(next()).toHaveAccessibleDescription('Elige una respuesta para seguir');
    swipe(currentCard(), { dx: -120 });
    expect(currentCard()).toHaveAccessibleName(/Tarjeta 1 de 5/);

    await user.click(screen.getByRole('button', { name: 'En el centro' }));
    expect(next()).toBeEnabled();
    expect(screen.queryByText('Elige una respuesta para seguir')).not.toBeInTheDocument();
  });

  it('moves the focus to the new card, so keyboards and screen readers follow', async () => {
    const user = userEvent.setup();
    renderLesson();
    expect(currentCard()).not.toHaveFocus(); // not stolen on first render
    await user.click(screen.getByRole('button', { name: 'En el centro' }));
    await user.click(next());
    expect(currentCard()).toHaveAccessibleName('Tarjeta 2 de 5 Dato sorprendente');
    expect(currentCard()).toHaveFocus();

    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(currentCard()).toHaveAccessibleName(/Tarjeta 1 de 5/);
    expect(currentCard()).toHaveFocus();
  });

  it('changes card with a clear horizontal swipe, and ignores vertical scrolling', async () => {
    const user = userEvent.setup();
    renderLesson();
    await user.click(screen.getByRole('button', { name: 'En el centro' }));

    swipe(currentCard(), { dx: -120 }); // to the left: next
    expect(currentCard()).toHaveAccessibleName(/Tarjeta 2 de 5/);
    swipe(currentCard(), { dx: -70, dy: 200 }); // mostly vertical: scrolling, not a swipe
    expect(currentCard()).toHaveAccessibleName(/Tarjeta 2 de 5/);
    swipe(currentCard(), { dx: -30 }); // too short
    expect(currentCard()).toHaveAccessibleName(/Tarjeta 2 de 5/);
    swipe(currentCard(), { dx: 120 }); // to the right: previous
    expect(currentCard()).toHaveAccessibleName(/Tarjeta 1 de 5/);
  });

  it('has no "Not now" on the challenge: "Siguiente" already does that', async () => {
    const user = userEvent.setup();
    renderLesson();
    await user.click(screen.getByRole('button', { name: 'En el centro' }));
    for (let i = 0; i < 3; i++) await user.click(next());
    expect(currentCard()).toHaveAccessibleName(/Reto de un minuto/);
    expect(screen.queryByRole('button', { name: 'Ahora no' })).not.toBeInTheDocument();
    expect(next()).toBeEnabled();
  });

  it('warns about a weak link only once: in the first sentence of "why", not with an extra note', async () => {
    const user = userEvent.setup();
    const weak = { ...lesson, conexion_debil: true, por_que: 'Una manzana tiene poco que ver con la música, pero…\n\nAl morderla suena.' };
    const { container } = renderLesson({ content: weak });
    expect(screen.queryByText(/poca relación/)).not.toBeInTheDocument(); // no note before the question
    expect(container.querySelector('.note')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'En el centro' }));
    await user.click(next());
    await user.click(next());
    expect(screen.getByText('Una manzana tiene poco que ver con la música, pero…')).toBeInTheDocument();
  });

  it('skips the fact card when there is no fact, and the offline lesson has 3 cards', () => {
    const { unmount } = renderLesson({ content: { ...lesson, dato_sorprendente: '' } });
    expect(currentCard()).toHaveAccessibleName(/de 4/);
    unmount();
    renderLesson({ content: { offline: true, intro: 'Investiga', por_que: 'Explicación', reto: 'Dibuja', otra_idea: 'Mide', enlaces: [], objetos_relacionados: [] } });
    expect(currentCard()).toHaveAccessibleName('Tarjeta 1 de 3 Investiga tú');
  });
});

describe('Without voice', () => {
  it('has no voice toggle and no read-aloud buttons', async () => {
    const user = userEvent.setup();
    renderLesson();
    expect(screen.queryByRole('button', { name: /Voz|Escuchar/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'En el centro' }));
    await user.click(next());
    expect(screen.queryByRole('button', { name: /Voz|Escuchar/ })).not.toBeInTheDocument();
  });
});

describe('Sharing', () => {
  async function goToEnd(user, props) {
    renderLesson(props);
    await user.click(screen.getByRole('button', { name: 'En el centro' }));
    for (let i = 0; i < 4; i++) await user.click(next());
  }

  it('always shows WhatsApp and Correo; "Más…" only when the browser has a share sheet', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('navigator', { ...window.navigator, share: undefined });
    await goToEnd(user);
    expect(screen.getByRole('button', { name: 'WhatsApp' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Correo' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Más…' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Guardar foto/ })).not.toBeInTheDocument();
  });

  it('WhatsApp opens wa.me with the text, and never promises the photo', async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal('open', open);
    await goToEnd(user, { photo: 'data:image/jpeg;base64,AAAA' });
    await user.click(screen.getByRole('button', { name: 'WhatsApp' }));
    const url = new URL(open.mock.calls[0][0]);
    expect(url.host).toBe('wa.me');
    const text = url.searchParams.get('text');
    expect(text).toMatch(/^Manzana · Biología/);
    expect(text).toContain('¿Dónde están las semillas?\n→ En el centro');
    expect(text).toContain(lesson.dato_sorprendente);
    expect(text).toContain('Curiocity');
    expect(text).not.toMatch(/foto|base64/i);
  });

  it('"Más…" opens the system share sheet with the photo attached', async () => {
    const user = userEvent.setup();
    const share = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...window.navigator, share, canShare: () => true });
    const onToast = vi.fn();
    await goToEnd(user, { photo: 'data:image/jpeg;base64,AAAA', onToast });
    await user.click(screen.getByRole('button', { name: 'Más…' }));
    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0][0];
    expect(data.files[0].name).toBe('curiocity.jpg');
    expect(data.text).toMatch(/^Manzana · Biología/);
    expect(onToast).toHaveBeenCalledWith('¡Compartido!');
  });
});

describe('After the challenge: what you could discover', () => {
  async function goToChallenge(user, props) {
    const r = renderLesson(props);
    await user.click(screen.getByRole('button', { name: 'En el centro' }));
    for (let i = 0; i < 3; i++) await user.click(next());
    return r;
  }

  it('offers "¡Reto hecho!" and "No lo he encontrado", and both show the same discovery', async () => {
    const user = userEvent.setup();
    const { unmount } = await goToChallenge(user);
    expect(screen.queryByText(lesson.reto_descubrimiento)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No lo he encontrado' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '¡Reto hecho!' }));
    expect(screen.getByRole('status')).toHaveTextContent('Lo que podías descubrir');
    expect(screen.getByRole('status')).toHaveTextContent(lesson.reto_descubrimiento);
    expect(document.querySelector('.discovery .curi--done')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reto hecho|No lo he encontrado/ })).not.toBeInTheDocument();
    expect(document.activeElement).toHaveClass('discovery'); // the focus is not lost with the buttons
    unmount();

    await goToChallenge(user);
    await user.click(screen.getByRole('button', { name: 'No lo he encontrado' }));
    expect(screen.getByRole('status')).toHaveTextContent('Lo que podías descubrir');
    expect(screen.getByRole('status')).toHaveTextContent(lesson.reto_descubrimiento);
    expect(document.querySelector('.discovery .curi--idle')).toBeInTheDocument(); // calm, nothing that sounds like failing
    expect(document.querySelector('.curi--almost')).not.toBeInTheDocument();
  });

  it('without a discovery: the cheer for "¡Reto hecho!" and a kind message for "No lo he encontrado"', async () => {
    const user = userEvent.setup();
    const content = { ...lesson, reto_descubrimiento: null };
    const { unmount } = await goToChallenge(user, { content });
    await user.click(screen.getByRole('button', { name: '¡Reto hecho!' }));
    expect(screen.getByRole('status')).toHaveTextContent('¡Genial, qué buena investigación!');
    expect(screen.queryByText('Lo que podías descubrir')).not.toBeInTheDocument();
    unmount();

    await goToChallenge(user, { content });
    await user.click(screen.getByRole('button', { name: 'No lo he encontrado' }));
    expect(screen.getByRole('status')).toHaveTextContent('¡No pasa nada! Mirar con atención ya es investigar.');
    expect(document.querySelector('.challenge__done .curi--idle')).toBeInTheDocument();
  });

  it('opens an old lesson that still has reto_observacion (phase 3) without errors, ignoring it', async () => {
    const user = userEvent.setup();
    const { reto_descubrimiento: _unused, ...rest } = lesson;
    const old = {
      ...rest,
      reto_observacion: { pregunta: '¿Viste más de cinco semillas?', opciones: [{ texto: 'Sí', conclusion: 'Si…' }, { texto: 'No', conclusion: 'Si no…' }] }
    };
    await goToChallenge(user, { content: old });
    await user.click(screen.getByRole('button', { name: '¡Reto hecho!' }));
    expect(screen.getByRole('status')).toHaveTextContent('¡Genial, qué buena investigación!');
    expect(screen.queryByText('¿Viste más de cinco semillas?')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sí' })).not.toBeInTheDocument();
  });

  it('a photo challenge still offers to take another photo, whichever button was pressed', async () => {
    const user = userEvent.setup();
    await goToChallenge(user, { content: { ...lesson, reto_foto: true } });
    await user.click(screen.getByRole('button', { name: 'No lo he encontrado' }));
    expect(screen.getByRole('button', { name: 'Hacer otra foto' })).toBeInTheDocument();
  });
});

describe('Ideas for the final question', () => {
  async function goToEnd(user, props) {
    renderLesson(props);
    await user.click(screen.getByRole('button', { name: 'En el centro' }));
    for (let i = 0; i < 4; i++) await user.click(next());
  }

  it('first asks to think, then shows the ideas as possibilities when asked', async () => {
    const user = userEvent.setup();
    await goToEnd(user);
    expect(screen.getByText(lesson.para_seguir_pensando)).toBeInTheDocument();
    expect(screen.getByText('Piénsalo un momento…')).toBeInTheDocument();
    expect(screen.queryByText(lesson.ideas_pregunta_final[0])).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver algunas ideas' }));
    expect(screen.getByText('Hay muchas respuestas posibles. Aquí tienes algunas:')).toBeInTheDocument();
    for (const idea of lesson.ideas_pregunta_final) expect(screen.getByText(idea)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver algunas ideas' })).not.toBeInTheDocument();
    expect(document.activeElement).toHaveClass('ideas'); // the focus is not lost with the button
  });

  it('without ideas there is no button, and offline content has no pause or ideas', async () => {
    const user = userEvent.setup();
    const { unmount } = await (async () => {
      const r = renderLesson({ content: { ...lesson, ideas_pregunta_final: [] } });
      await user.click(screen.getByRole('button', { name: 'En el centro' }));
      for (let i = 0; i < 4; i++) await user.click(next());
      return r;
    })();
    expect(screen.getByText('Piénsalo un momento…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver algunas ideas' })).not.toBeInTheDocument();
    unmount();

    renderLesson({ content: { offline: true, intro: 'Investiga', por_que: 'Explicación', reto: 'Dibuja', otra_idea: 'Mide', enlaces: [], objetos_relacionados: [] } });
    await user.click(next());
    await user.click(next());
    expect(screen.getByText('Mide')).toBeInTheDocument();
    expect(screen.queryByText('Piénsalo un momento…')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver algunas ideas' })).not.toBeInTheDocument();
  });
});
