import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContentView from './ContentView';
import { translations } from '../i18n';
import { orderedSubjects } from '../subjects';

const t = translations.es;

const lesson = {
  pregunta_inicial: { pregunta: '¿Dónde están las semillas?', opciones: ['En la piel', 'En el centro', 'En el rabito'], correcta: 1 },
  dato_sorprendente: 'Si cortas una manzana por la mitad, ves una estrella.',
  por_que: 'Las semillas están en el centro.',
  reto: 'Cuenta las semillas de tu manzana.',
  reto_foto: false,
  para_seguir_pensando: '¿Qué pasaría si plantas una semilla?',
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
      subjects={orderedSubjects(null)}
      lang="es"
      ageGroup="6-8"
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

function mockSpeech() {
  const synth = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', function (text) { this.text = text; });
  return synth;
}

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

  it('skips the fact card when there is no fact, and the offline lesson has 3 cards', () => {
    const { unmount } = renderLesson({ content: { ...lesson, dato_sorprendente: '' } });
    expect(currentCard()).toHaveAccessibleName(/de 4/);
    unmount();
    renderLesson({ content: { offline: true, intro: 'Investiga', por_que: 'Explicación', reto: 'Dibuja', otra_idea: 'Mide', enlaces: [], objetos_relacionados: [] } });
    expect(currentCard()).toHaveAccessibleName('Tarjeta 1 de 3 Investiga tú');
  });

  it('stops reading aloud when the child changes card or leaves the lesson', async () => {
    const synth = mockSpeech();
    localStorage.setItem('curiocity_voice', 'off');
    const user = userEvent.setup();
    const { unmount } = renderLesson();
    await user.click(screen.getByRole('button', { name: 'En el centro' }));
    await user.click(screen.getByRole('button', { name: 'Escuchar' }));
    synth.cancel.mockClear();
    await user.click(next());
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Escuchar' })).toBeInTheDocument(); // not "Parar" any more

    await user.click(screen.getByRole('button', { name: 'Escuchar' }));
    synth.cancel.mockClear();
    unmount();
    expect(synth.cancel).toHaveBeenCalled();
  });
});

describe('Voice', () => {
  it('is on by default for 6-8 and off for 9-12', () => {
    mockSpeech();
    const { unmount } = renderLesson({ ageGroup: '6-8' });
    expect(screen.getByRole('button', { name: 'Voz' })).toHaveAttribute('aria-pressed', 'true');
    unmount();
    renderLesson({ ageGroup: '9-12' });
    expect(screen.getByRole('button', { name: 'Voz' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('remembers the choice on this device, over the age default', async () => {
    const synth = mockSpeech();
    const user = userEvent.setup();
    const { unmount } = renderLesson({ ageGroup: '6-8' });
    synth.cancel.mockClear();
    await user.click(screen.getByRole('button', { name: 'Voz' }));
    expect(screen.getByRole('button', { name: 'Voz' })).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('curiocity_voice')).toBe('off');
    expect(synth.cancel).toHaveBeenCalled(); // silenced right away
    unmount();

    synth.speak.mockClear();
    renderLesson({ ageGroup: '6-8' });
    expect(screen.getByRole('button', { name: 'Voz' })).toHaveAttribute('aria-pressed', 'false');
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('turning it on reads the current card, and every new card after that', async () => {
    const synth = mockSpeech();
    const user = userEvent.setup();
    renderLesson({ ageGroup: '9-12' });
    expect(synth.speak).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Voz' }));
    expect(localStorage.getItem('curiocity_voice')).toBe('on');
    expect(synth.speak.mock.calls.map(([u]) => u.text)).toEqual([lesson.pregunta_inicial.pregunta, ...lesson.pregunta_inicial.opciones]);
    await user.click(screen.getByRole('button', { name: 'En el centro' }));
    synth.speak.mockClear();
    await user.click(next());
    expect(synth.speak.mock.calls.map(([u]) => u.text)).toEqual(['Dato sorprendente', lesson.dato_sorprendente]);
  });

  it('waits for the first interaction with the page (autoplay rules)', () => {
    const synth = mockSpeech();
    vi.stubGlobal('navigator', { ...window.navigator, userActivation: { hasBeenActive: false } });
    renderLesson({ ageGroup: '6-8' });
    expect(synth.speak).not.toHaveBeenCalled();
  });
});
