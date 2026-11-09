import { useEffect, useRef } from 'react';
import { MdNoPhotography } from 'react-icons/md';
import { IconHistory } from './icons';

// Attaches a MediaStream to a <video> element.
function useStream(ref, stream) {
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream || null;
    if (stream) {
      video.play().catch(err => {
        if (err.name !== 'AbortError') console.warn('Video play failed:', err);
      });
    }
  }, [ref, stream]);
}

// The logo's eyes (O and C with their pupils), in currentColor: the brand mark on the camera.
function BrandEyes() {
  return (
    <svg className="camera__eyes" viewBox="0 0 46.91 35.64" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M10.37,35.64c-3.31,0-5.87-.96-7.67-2.88-1.8-1.92-2.7-4.68-2.7-8.28v-13.32C0,7.56.91,4.8,2.74,2.88,4.56.96,7.1,0,10.37,0s5.84.95,7.6,2.84c1.75,1.9,2.63,4.67,2.63,8.32v13.32c0,3.6-.89,6.36-2.66,8.28-1.78,1.92-4.3,2.88-7.56,2.88ZM10.37,34.13c2.83,0,4.99-.84,6.48-2.52,1.49-1.68,2.23-4.1,2.23-7.27v-13.03c0-3.22-.74-5.65-2.23-7.31-1.49-1.66-3.65-2.48-6.48-2.48s-5.02.83-6.55,2.48c-1.54,1.66-2.3,4.09-2.3,7.31v13.03c0,3.17.77,5.59,2.3,7.27,1.54,1.68,3.72,2.52,6.55,2.52Z" />
      <path d="M37.53,35.64c-3.36.05-5.92-.86-7.67-2.74-1.75-1.87-2.63-4.68-2.63-8.42v-13.1c0-3.84.86-6.7,2.59-8.57s4.22-2.81,7.49-2.81c2.11,0,3.88.41,5.29,1.22,1.42.82,2.51,1.96,3.28,3.42.77,1.46,1.1,3.23,1.01,5.29,0,.24-.1.36-.29.36h-1.01c-.14,0-.22-.1-.22-.29.05-2.59-.64-4.66-2.05-6.19-1.42-1.54-3.42-2.3-6.01-2.3-2.83,0-4.97.8-6.41,2.41-1.44,1.61-2.16,4.09-2.16,7.45v13.03c0,3.31.73,5.76,2.2,7.34,1.46,1.58,3.66,2.38,6.59,2.38,2.74,0,4.74-.76,6.01-2.27,1.27-1.51,1.88-3.78,1.84-6.8,0-.19.07-.29.22-.29h1.01c.14,0,.22.1.22.29.05,3.41-.68,6.01-2.2,7.81-1.51,1.8-3.88,2.72-7.09,2.77Z" />
      <ellipse cx="41.58" cy="17.44" rx="3.72" ry="5.93" />
      <ellipse cx="14.49" cy="17.44" rx="3.72" ry="5.93" />
    </svg>
  );
}

export default function CameraView({ inert, t, videoRef, stream, cameraStatus, photo, analyzing, onShutter, onRetryCamera, onOpenHistory }) {
  const bgRef = useRef(null);
  useStream(bgRef, stream);
  useStream(videoRef, stream);

  const frozen = Boolean(photo);
  const cameraError = cameraStatus === 'error' && !frozen;

  return (
    <main className="camera" inert={inert}>
      {/* Blurred full-screen backdrop: live video, or the captured photo once frozen */}
      {frozen ? (
        <img className="camera__backdrop" src={photo} alt="" aria-hidden="true" />
      ) : (
        <video className="camera__backdrop" ref={bgRef} autoPlay playsInline muted aria-hidden="true" />
      )}

      <header className="camera__top">
        <h1 className="camera__brand">
          <BrandEyes />
          <span className="visually-hidden">Curiocity</span>
        </h1>
        <button className="icon-btn camera__history" onClick={onOpenHistory} aria-label={t.history} disabled={frozen}>
          <IconHistory />
        </button>
      </header>

      <div className="camera__center">
        <div className={`viewfinder${analyzing ? ' viewfinder--analyzing' : ''}`}>
          <div className="viewfinder__lens">
            {frozen ? (
              <img src={photo} alt={t.capturedPhoto} />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted aria-hidden="true" />
            )}
            {cameraError && (
              <div className="viewfinder__error">
                <MdNoPhotography aria-hidden="true" />
              </div>
            )}
          </div>
        </div>
        {!cameraError && <p className="camera__hint" aria-live="polite">{analyzing ? t.analyzing : t.hint}</p>}
      </div>

      <div className="camera__bottom">
        {cameraError ? (
          <div className="camera__notice" role="alert">
            <strong>{t.cameraError}</strong>
            <span>{t.cameraErrorDesc}</span>
            <button className="btn btn--primary" onClick={onRetryCamera}>{t.retry}</button>
          </div>
        ) : (
          <>
            <button
              className="shutter"
              onClick={onShutter}
              disabled={frozen || cameraStatus !== 'ready'}
              aria-label={t.takePhoto}
            >
              <span className="shutter__dot" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </main>
  );
}
