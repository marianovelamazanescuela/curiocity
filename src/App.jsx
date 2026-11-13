import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { translations, detectUserLanguage } from './i18n';
import { getSubject, nextSubjects } from './subjects';
import { detectObjects, fetchContent, fetchRanking } from './api';
import { addToHistory, clearHistory, loadHistory } from './history';
import { useCamera } from './useCamera';
import { startStudy, studyCodeSeen, studyParticipant, subscribeStudy, track } from './study';
import Splash from './components/Splash';
import CameraView from './components/CameraView';
import Page, { CircleButton, PageNav } from './components/Page';
import ObjectChooser from './components/ObjectChooser';
import SubjectPicker from './components/SubjectPicker';
import ContentView from './components/ContentView';
import HistoryView from './components/HistoryView';
import Toast from './components/Toast';
import { IconChevronLeft } from './components/icons';

const SPLASH_MS = 1400;
const MAX_IMAGE_SIDE = 800; // the Vision API doesn't need more; keeps uploads small
const THUMB_SIDE = 160; // history thumbnails stay small (~8 KB each)

// Study version only (__STUDY__ is fixed at build time): its pages are a separate file, never part of
// the main version. /?reiniciar-estudio opens the researcher's reset page.
const StudyPages = __STUDY__ ? lazy(() => import('./study/StudyPages')) : null;
const StudyBadge = __STUDY__ ? lazy(() => import('./study/StudyBadge')) : null;
const RESET_PARAM = 'reiniciar-estudio';

function initialStudyView() {
  if (!__STUDY__) return null;
  const params = new URLSearchParams(window.location.search);
  if (params.has(RESET_PARAM)) {
    params.delete(RESET_PARAM); // a reload goes back to the normal app
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
    return 'reset';
  }
  return studyCodeSeen() ? null : 'welcome';
}

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

const noop = () => {};

export default function App() {
  const [lang] = useState(detectUserLanguage);
  const t = translations[lang] || translations.en;
  // Study version: 'welcome' (the code, the first time), 'sheet' (details) or 'reset'; null otherwise.
  const [studyView, setStudyView] = useState(initialStudyView);
  const [studyCode, setStudyCode] = useState(studyParticipant);

  const [showSplash, setShowSplash] = useState(true);
  // camera → analyzing (frozen photo in the viewfinder) → result (full-screen page); or history (page)
  const [phase, setPhase] = useState(() => (studyView ? 'study' : 'camera'));
  const [photo, setPhoto] = useState(null);
  // { status: 'found'|'choose'|'none'|'person'|'error', object, fromPhoto, choices }
  // choose: several objects in the photo, the child picks one (objects: [{ name, x, y, size }]);
  // found: choices keeps those objects, so "Volver" can go back to choosing.
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
  const thumbRef = useRef(null); // thumbnail of the last photo, saved in the history with the chosen object

  const camera = useCamera(phase === 'camera');

  // Which subjects connect best with the object (with a hook each). Asked whenever the object
  // changes: after a photo, a related object or a history entry.
  const foundObject = detection && detection.status === 'found' ? detection.object : null;
  useEffect(() => {
    if (!foundObject) return undefined;
    const controller = new AbortController();
    fetchRanking(foundObject, lang, controller.signal)
      .then(value => {
        setRanking({ forKey: foundObject, value });
        track('asignaturas', { accion: 'mostradas', objeto: foundObject, destacadas: value ? value.featured.map(f => f.key) : null });
        if (!value) track('error', { motivo: 'asignaturas_sin_servidor', objeto: foundObject });
      })
      .catch(() => {}); // aborted: a newer object replaced this one
    return () => controller.abort();
  }, [foundObject, lang]);
  // undefined while loading, null if unknown (show every subject), else { featured, others }
  const currentRanking = foundObject && ranking.forKey === foundObject ? ranking.value : undefined;

  // Study version: a session per app opening, sending in the background, and the camera's badge.
  useEffect(() => {
    if (!__STUDY__) return undefined;
    const stop = startStudy();
    const unsubscribe = subscribeStudy(() => setStudyCode(studyParticipant()));
    return () => {
      stop();
      unsubscribe();
    };
  }, []);

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
      const { objects, person, method } = await detectObjects(canvas, lang, signal);
      thumbRef.current = makeThumbnail(canvas);
      track('foto', { accion: 'detectada', objetos: objects.map(o => o.name), metodo: method, persona: person || undefined });
      if (method === 'local') track('error', { motivo: 'servidor_no_disponible', donde: 'deteccion' });
      if (person) setDetection({ status: 'person' });
      else if (objects.length > 1) setDetection({ status: 'choose', objects });
      else if (objects.length === 1) chooseObject(objects[0]);
      else setDetection({ status: 'none' });
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Detection failed:', err);
      track('error', { motivo: 'deteccion_fallida' });
      setDetection({ status: 'error' });
    }
    setPhase('result');
  };

  // The child explores one object of the photo: it goes to the history, with the photo's thumbnail.
  const chooseObject = (chosen, choices = null) => {
    const name = capitalize(chosen.name);
    if (choices) track('foto', { accion: 'elegido', objeto: name, entre: choices.map(o => o.name) });
    setDetection({ status: 'found', object: name, fromPhoto: true, choices });
    setSubjectKey(null);
    setContent(null);
    setHistory(addToHistory({ object: name, thumb: thumbRef.current }));
  };

  const backToChoices = () => {
    newRequest();
    setDetection({ status: 'choose', objects: detection.choices });
  };

  const handleClose = () => {
    newRequest(); // abort anything pending
    setStudyView(null);
    setPhase('camera');
    setPhoto(null);
    setDetection(null);
    setSubjectKey(null);
    setContent(null);
  };

  // from: 'asignaturas' (subjects page) or 'final' (end of a lesson)
  const loadSubject = async (key, from = 'asignaturas', objectName = detection.object) => {
    const subject = getSubject(key);
    const featured = Boolean(currentRanking && currentRanking.featured.some(f => f.key === key));
    track('asignaturas', { accion: 'elegida', objeto: objectName, asignatura: key, destacada: featured, desde: from });
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

  const openStudyView = view => {
    newRequest();
    setStudyView(view);
    setPhase('study');
  };

  const wrongObject = () => {
    track('foto', { accion: 'objeto_incorrecto', objeto: detection && detection.object });
    handleClose();
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

  const backToCamera = <CircleButton label={t.backToCamera} onClick={handleClose}><IconChevronLeft /></CircleButton>;

  let pageBody = null;
  if (phase === 'study' && StudyPages) {
    pageBody = (
      <Suspense fallback={null}>
        <StudyPages view={studyView} lang={lang} backButton={backToCamera} onDone={handleClose} onToast={showToast} onViewChange={setStudyView} />
      </Suspense>
    );
  } else if (phase === 'history') {
    pageBody = (
      <HistoryView
        t={t}
        lang={lang}
        entries={history}
        backButton={backToCamera}
        onOpen={openHistoryEntry}
        onClear={() => setHistory(clearHistory())}
      />
    );
  } else if (detection && detection.status === 'choose') {
    pageBody = (
      <ObjectChooser
        t={t}
        photo={photo}
        objects={detection.objects}
        onChoose={o => chooseObject(o, detection.objects)}
        onBackToCamera={handleClose}
        onRetake={handleClose}
      />
    );
  } else if (detection && detection.status !== 'found') {
    const messages = {
      error: [t.detectionError, t.detectionErrorDesc],
      person: [t.personTitle, t.personDesc],
      none: [t.noObject, t.noObjectDesc]
    };
    const [title, text] = messages[detection.status] || messages.none;
    pageBody = (
      <section className="message">
        <PageNav left={backToCamera} />
        <h2 className="message__title">{title}</h2>
        <p className="message__text">{text}</p>
        <button className="btn btn--primary" onClick={handleClose}>{t.retake}</button>
      </section>
    );
  } else if (detection && !subjectKey) {
    pageBody = (
      <SubjectPicker
        t={t}
        photo={detection.fromPhoto ? photo : null}
        objectName={detection.object}
        ranking={currentRanking}
        onSelect={key => loadSubject(key, 'asignaturas')}
        onBackToCamera={detection.choices ? backToChoices : handleClose}
        backLabel={detection.choices ? t.backToObjects : t.backToCamera}
        onWrongObject={wrongObject}
      />
    );
  } else if (detection) {
    pageBody = (
      <ContentView
        key={`${detection.object}|${subjectKey}`}
        t={t}
        photo={detection.fromPhoto ? photo : null}
        objectName={detection.object}
        subjectKey={subjectKey}
        nextSubjects={nextSubjects(currentRanking || null, subjectKey, seenSubjects[detection.object])}
        content={content}
        onBack={backToSubjects}
        onSelectSubject={key => loadSubject(key, 'final')}
        onRelatedObject={handleRelatedObject}
        onToast={showToast}
        onTakePhoto={handleClose}
      />
    );
  }

  const pageOpen = phase === 'result' || phase === 'history' || phase === 'study';

  return (
    <div className="app">
      <CameraView
        inert={pageOpen}
        t={t}
        videoRef={videoRef}
        stream={camera.stream}
        cameraStatus={camera.status}
        photo={photo}
        analyzing={phase === 'analyzing'}
        onShutter={handleShutter}
        onRetryCamera={camera.retry}
        onOpenHistory={openHistory}
        studyBadge={
          StudyBadge && studyCode ? (
            <Suspense fallback={null}>
              <StudyBadge lang={lang} code={studyCode} onPress={() => openStudyView('sheet')} disabled={phase === 'analyzing'} />
            </Suspense>
          ) : null
        }
      />
      {/* The code screen closes only with "Empezar", so the child always sees the code once */}
      <Page open={pageOpen} onClose={studyView === 'welcome' ? noop : handleClose} viewKey={`${studyView}|${phase}|${detection?.status}|${detection?.object}|${subjectKey}|${Boolean(content)}`}>
        {pageBody}
      </Page>
      <Toast toast={toast} onDone={hideToast} />
      {showSplash && <Splash t={t} />}
    </div>
  );
}
