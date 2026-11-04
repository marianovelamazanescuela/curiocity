import { useEffect } from 'react';

const DURATION_MS = 3000;

export default function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, onDone]);

  return (
    <div className="toast-region" aria-live="polite">
      {toast && (
        <div key={toast.id} className={`toast toast--${toast.severity}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
}
