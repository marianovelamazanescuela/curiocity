import { useCallback, useEffect, useState } from 'react';

function openRearCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return Promise.reject(new Error('getUserMedia not supported'));
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false
  });
}

/**
 * Owns the rear-camera MediaStream. `active` turns the camera on/off (it is switched off
 * while a page is open over it, to save battery).
 * status: 'idle' | 'starting' | 'ready' | 'error'
 */
export function useCamera(active) {
  const [stream, setStream] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    let opened = null;

    openRearCamera()
      .then(s => {
        opened = s;
        // React StrictMode runs effects twice in development: drop streams from stale runs.
        if (cancelled) s.getTracks().forEach(track => track.stop());
        else setStream(s);
      })
      .catch(err => {
        console.error('Camera error:', err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (opened) opened.getTracks().forEach(track => track.stop());
      setStream(null);
    };
  }, [active, attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt(n => n + 1);
  }, []);

  let status = 'starting';
  if (!active) status = 'idle';
  else if (failed) status = 'error';
  else if (stream) status = 'ready';

  return { stream: active ? stream : null, status, retry };
}
