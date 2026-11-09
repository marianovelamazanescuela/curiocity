import { useEffect, useRef } from 'react';
import { MdHistory, MdNoPhotography } from 'react-icons/md';

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
        <img className="camera__logo" src="/curiocity-logo.svg" alt="Curiocity" />
        <button className="icon-btn camera__history" onClick={onOpenHistory} aria-label={t.history} disabled={frozen}>
          <MdHistory aria-hidden="true" />
        </button>
      </header>

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

      <div className="camera__bottom">
        {cameraError ? (
          <div className="camera__notice" role="alert">
            <strong>{t.cameraError}</strong>
            <span>{t.cameraErrorDesc}</span>
            <button className="btn btn--primary" onClick={onRetryCamera}>{t.retry}</button>
          </div>
        ) : (
          <>
            <p className="camera__hint" aria-live="polite">{analyzing ? t.analyzing : t.hint}</p>
            <button
              className="shutter"
              onClick={onShutter}
              disabled={frozen || cameraStatus !== 'ready'}
              aria-label={t.takePhoto}
            >
              <img src="/curiocity-icon.svg" alt="" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </main>
  );
}
