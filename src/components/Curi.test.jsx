import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Curi, { CuriThinking } from './Curi';

const STATES = ['idle', 'thinking', 'correct', 'almost', 'done'];

const renderCuri = props => render(<Curi {...props} />).container.querySelector('svg');

describe('Curi', () => {
  it('is decorative: hidden from screen readers and not focusable', () => {
    const svg = renderCuri();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it.each(STATES)('marks the "%s" state with a class', state => {
    const svg = renderCuri({ state });
    expect(svg).toHaveClass('curi', `curi--${state}`);
    expect(svg).toHaveAttribute('data-state', state);
  });

  it('falls back to idle for an unknown state', () => {
    expect(renderCuri({ state: 'sad' })).toHaveClass('curi--idle');
  });

  it.each(STATES)('draws the mouth as one continuous ink line with round ends (%s)', state => {
    const svg = renderCuri({ state });
    const mouths = svg.querySelectorAll('.curi__mouth');
    expect(mouths).toHaveLength(1);
    const d = mouths[0].getAttribute('d');
    expect(d.match(/M/g)).toHaveLength(1); // a single sub-path: never broken in pieces
    expect(svg).toHaveAttribute('stroke', '#1d1d1b');
    expect(svg).toHaveAttribute('stroke-linecap', 'round');
    expect(mouths[0]).not.toHaveAttribute('stroke-dasharray');
  });

  it('has a different mouth for each state (correct and done share the wide smile)', () => {
    const d = state => renderCuri({ state }).querySelector('.curi__mouth').getAttribute('d');
    expect(new Set(STATES.map(d)).size).toBe(4);
    expect(d('correct')).toBe(d('done'));
  });

  it('keeps both eyes of the logo, each with its pupil, and no body', () => {
    const svg = renderCuri();
    expect(svg.querySelectorAll('.curi__eye')).toHaveLength(2);
    expect(svg.querySelectorAll('.curi__pupil')).toHaveLength(2);
  });

  it('scales with the size prop', () => {
    expect(renderCuri({ size: 106 })).toHaveAttribute('width', '106');
  });

  it('CuriThinking announces its message as text', () => {
    render(<CuriThinking label="Curi está pensando…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Curi está pensando…');
  });
});
