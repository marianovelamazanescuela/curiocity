import { useEffect, useRef } from 'react';
import { MdClose } from 'react-icons/md';

// Bottom sheet built on the native <dialog>: focus trap, Escape to close and
// screen-reader semantics come for free.
// `overlay` renders inside the dialog (top layer) but outside the animated panel, e.g. toasts.
export default function Sheet({ open, onClose, closeLabel, scrollKey, overlay, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (dialog.close) dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  // Scroll back to the top when the view changes (new subject, related object…)
  const bodyRef = useRef(null);
  useEffect(() => {
    if (bodyRef.current && bodyRef.current.scrollTo) bodyRef.current.scrollTo({ top: 0 });
  }, [scrollKey]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
      onClick={e => {
        // A click on the dialog element itself (not its content) is a click on the backdrop.
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="sheet__panel">
        <div className="sheet__handle" aria-hidden="true" />
        <button className="icon-btn sheet__close" onClick={onClose} aria-label={closeLabel}>
          <MdClose aria-hidden="true" />
        </button>
        <div className="sheet__body" ref={bodyRef}>
          {open && children}
        </div>
      </div>
      {overlay}
    </dialog>
  );
}
