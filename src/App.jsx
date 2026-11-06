import { useCallback, useEffect, useRef, useState } from 'react';
import { translations, detectUserLanguage } from './i18n';
import { getSubject, nextSubjects } from './subjects';
import { detectObject, fetchContent, fetchRanking } from './api';
import { addToHistory, clearHistory, loadHistory } from './history';
import { useCamera } from './useCamera';
import Splash from './components/Splash';
import CameraView from './components/CameraView';
import Sheet from './components/Sheet';
import SubjectPicker from './components/SubjectPicker';
import ContentView from './components/ContentView';
import HistoryView from './components/HistoryView';
import Toast from './components/Toast';

const SPLASH_MS = 1400;
const MAX_IMAGE_SIDE = 800; // the Vision API doesn't need more; keeps uploads small
const THUMB_SIDE = 160; // history thumbnails stay small (~8 KB each)

const capitalize = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Square crop from the centre of the video, scaled down to MAX_IMAGE_SIDE.
function captureSquare(video) {
  const side = Math.min(video.videoWidth, video.videoHeight);
  const out = Math.min(side, MAX_IMAGE_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  canvas
    .getContext('2d')
    .drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, out, out);
  return canvas;
}

function makeThumbnail(canvas) {
  const thumb = document.createElement('canvas');
  thumb.width = THUMB_SIDE;
  thumb.height = THUMB_SIDE;
  thumb.getContext('2d').drawImage(canvas, 0, 0, THUMB_SIDE, THUMB_SIDE);
  return thumb.toDataURL('image/jpeg', 0.7);
}

function requestFullscreenOnMobile() {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return;
  el.requestFullscreen().catch(() => {});
}

export default function App() {
  const [lang] = useState(detectUserLanguage);
  const t = translations[lang] || translations.en;

  const [showSplash, setShowSplash] = useState(true);
  // camera → analyzing (frozen photo in the viewfinder) → result (sheet open); or history (sheet open)
  const [phase, setPhase] = useState('camera');
  const [photo, setPhoto] = useState(null);
  // { status: 'found'|'none'|'person'|'error', object, fromPhoto }
  const [detection, setDetection] = useState(null);
  const [history, setHistory] = useState(loadHistory);
  const [subjectKey, setSubjectKey] = useState(null);
  const [content, setContent] = useState(null);
  const [toast, setToast] = useState(null);
  // Subjects the child has already seen for each object, only while the app is open: { [object]: [keys] }
  const [seenSubjects, setSeenSubjects] = useState({});
  // Subject ranking for the current object: { forKey, value } (value null = unknown)
  const [ranking, setRanking] = useState({ forKey: null, value: null });

  const videoRef = useRef(null);
  const requestRef = useRef(null); // AbortController of the in-flight request

  const camera = useCamera(phase === 'camera');

  // Which subjects connect best with the object (with a hook each). Asked whenever the object
  // changes: after a photo, a related object or a history entry.
  const foundObject = detection && detection.status === 'found' ? detection.object : null;
  useEffect(() => {
    if (!foundObject) return undefined;
    const controller = new AbortController();
    fetchRanking(foundObject, lang, controller.signal)
      .then(value => setRanking({ forKey: foundObject, value }))
      .catch(() => {}); // aborted: a newer object replaced this one
    return () => controller.abort();
  }, [foundObject, lang]);
  // undefined while loading, null if unknown (show every subject), else { featured, others }
  const currentRanking = foundObject && ranking.forKey === foundObject ? ranking.value : undefined;

  useEffect(() => {
    document.documentElement.lang = lang;
    const timer = setTimeout(() => setShowSplash(false), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [lang]);

  // Cancels whatever request is in flight and returns a signal for the next one.
  // This prevents a slow, older answer from replacing a newer one.
  const newRequest = () => {
    if (requestRef.current) requestRef.current.abort();
    requestRef.current = new AbortController();
    return requestRef.current.signal;
  };

  const hideToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((message, severity = 'success') => setToast({ message, severity, id: Date.now() }), []);

  const handleShutter = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    requestFullscreenOnMobile();

    const canvas = captureSquare(video);
    setPhoto(canvas.toDataURL('image/jpeg', 0.85));
    setPhase('analyzing');
    const signal = newRequest();

    try {
      const { object, person } = await detectObject(canvas, lang, signal);
      if (person) setDetection({ status: 'person' });
      else if (object) {
        const name = capitalize(object);
        setDetection({ status: 'found', object: name, fromPhoto: true });
        setHistory(addToHistory({ object: name, thumb: makeThumbnail(canvas) }));
      } else setDetection({ status: 'none' });
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Detection failed:', err);
      setDetection({ status: 'error' });
    }
    setPhase('result');
  };

  const handleClose = () => {
    newRequest(); // abort anything pending
    setPhase('camera');
    setPhoto(null);
    setDetection(null);
    setSubjectKey(null);
    setContent(null);
  };

  const loadSubject = async (key, objectName = detection.object) => {
    const subject = getSubject(key);
    setSubjectKey(key);
    setSeenSubjects(seen => ({ ...seen, [objectName]: [...new Set([...(seen[objectName] || []), key])] }));
    setContent(null); // show the loading state instead of the previous subject's content
    const signal = newRequest();
    try {
      const result = await fetchContent({ objectName, subject, lang, signal });
      setContent(result);
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    }
  };

  const handleRelatedObject = name => {
    newRequest();
    setDetection({ status: 'found', object: capitalize(name), fromPhoto: false });
    setSubjectKey(null);
    setContent(null);
  };

  const openHistory = () => {
    newRequest();
    setPhase('history');
  };

  const openHistoryEntry = entry => {
    setPhoto(entry.thumb);
    setDetection({ status: 'found', object: entry.object, fromPhoto: true });
    setSubjectKey(null);
    setContent(null);
    setHistory(addToHistory(entry)); // moves it to the top
    setPhase('result');
  };

  const backToSubjects = () => {
    newRequest();
    setSubjectKey(null);
    setContent(null);
  };

  let sheetBody = null;
  if (phase === 'history') {
    sheetBody = <HistoryView t={t} lang={lang} entries={history} onOpen={openHistoryEntry} onClear={() => setHistory(clearHistory())} />;
  } else if (detection && detection.status !== 'found') {
    const messages = {
      error: [t.detectionError, t.detectionErrorDesc],
      person: [t.personTitle, t.personDesc],
      none: [t.noObject, t.noObjectDesc]
    };
    const [title, text] = messages[detection.status] || messages.none;
    sheetBody = (
      <div className="message">
        <h2 className="message__title">{title}</h2>
        <p className="message__text">{text}</p>
        <button className="btn btn--primary" onClick={handleClose}>{t.retake}</button>
      </div>
    );
  } else if (detection && !subjectKey) {
    sheetBody = (
      <SubjectPicker
        t={t}
        photo={detection.fromPhoto ? photo : null}
        objectName={detection.object}
        ranking={currentRanking}
        onSelect={key => loadSubject(key)}
        onWrongObject={handleClose}
      />
    );
  } else if (detection) {
    sheetBody = (
      <ContentView
        key={`${detection.object}|${subjectKey}`}
        t={t}
        photo={detection.fromPhoto ? photo : null}
        objectName={detection.object}
        subjectKey={subjectKey}
        nextSubjects={nextSubjects(currentRanking || null, subjectKey, seenSubjects[detection.object])}
        content={content}
        onBack={backToSubjects}
        onSelectSubject={key => loadSubject(key)}
        onRelatedObject={handleRelatedObject}
        onToast={showToast}
        onTakePhoto={handleClose}
      />
    );
  }

  return (
    <div className="app">
      <CameraView
        t={t}
        videoRef={videoRef}
        stream={camera.stream}
        cameraStatus={camera.status}
        photo={photo}
        analyzing={phase === 'analyzing'}
        onShutter={handleShutter}
        onRetryCamera={camera.retry}
        onOpenHistory={openHistory}
      />
      <Sheet
        open={phase === 'result' || phase === 'history'}
        onClose={handleClose}
        closeLabel={t.close}
        scrollKey={`${phase}|${detection?.object}|${subjectKey}|${Boolean(content)}`}
        overlay={<Toast toast={toast} onDone={hideToast} />}
      >
        {sheetBody}
      </Sheet>
      {showSplash && <Splash t={t} />}
    </div>
  );
}
