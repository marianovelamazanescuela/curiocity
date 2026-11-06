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
