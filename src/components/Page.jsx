import { useEffect, useRef } from 'react';

/**
 * A full-screen page over the camera (subjects, lesson, history, notices). It replaces the old
 * bottom sheet: cream background, its own scroll, Escape goes back to the camera. While a page is
 * open the camera underneath is `inert` (App), so the keyboard and screen readers stay here.
 * When the view changes (`viewKey`), the page scrolls to the top and takes the focus.
 */
export default function Page({ open, onClose, viewKey, children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const page = ref.current;
    if (!open || !page) return;
    page.scrollTo?.({ top: 0 });
    page.focus({ preventScroll: true });
  }, [open, viewKey]);

  if (!open) return null;
  return (
    <div className="page" ref={ref} tabIndex={-1}>
      <div className="page__inner">{children}</div>
    </div>
  );
}

/** Outlined circle button with a thin-stroke icon; `label` is its accessible name. */
export function CircleButton({ label, onClick, big = false, children, ...rest }) {
  return (
    <button className={big ? 'icon-btn icon-btn--big' : 'icon-btn'} onClick={onClick} aria-label={label} {...rest}>
      {children}
    </button>
  );
}

/** Top navigation: a circle on each side and, between them, whatever the page puts there. */
export function PageNav({ left, right, children }) {
  return (
    <div className="page-nav">
      {left}
      <div className="page-nav__center">{children}</div>
      {right}
    </div>
  );
}
