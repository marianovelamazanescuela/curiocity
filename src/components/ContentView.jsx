import { useState } from 'react';
import { MdArrowBack, MdShare, MdEmail, MdDownload, MdOpenInNew, MdLightbulbOutline } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { getSubject } from '../subjects';
import { buildShareText, downloadDataUrl, mailtoUrl, nativeShare, whatsappUrl } from '../share';
import ObjectHeader from './ObjectHeader';

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function LoadingContent({ label }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      <div className="skeleton__line skeleton__line--title" />
      <div className="skeleton__line" />
      <div className="skeleton__line" />
      <div className="skeleton__line skeleton__line--short" />
      <p className="skeleton__label">{label}</p>
    </div>
  );
}

function ShareBar({ t, content, photo, onToast }) {
  const [showOptions, setShowOptions] = useState(false);

  const savePhoto = () => {
    if (!photo) return;
    downloadDataUrl(photo, 'curiocity.jpg');
    onToast(t.imageDownloaded);
  };

  const share = async () => {
    const result = await nativeShare({ title: content.title, text: buildShareText(content, t), imageDataUrl: photo });
    if (result === 'shared') onToast(t.shared);
    else if (result === 'shared-text') {
      if (photo) downloadDataUrl(photo, 'curiocity.jpg');
      onToast(photo ? t.sharedTextOnly : t.shared);
    } else if (result === 'unsupported') setShowOptions(true);
  };

  const viaEmail = () => {
    window.open(mailtoUrl(`${content.title} — Curiocity`, buildShareText(content, t, { withAttachHint: Boolean(photo) })));
    onToast(t.openedMail, 'info');
  };

  const viaWhatsApp = () => {
    window.open(whatsappUrl(buildShareText(content, t, { withAttachHint: Boolean(photo) })), '_blank', 'noopener');
    onToast(t.openedWhatsApp, 'info');
  };

  return (
    <div className="share">
      <button className="btn btn--primary btn--wide" onClick={share} aria-expanded={showOptions}>
        <MdShare aria-hidden="true" /> {t.share}
      </button>
      {showOptions && (
        <div className="share__options">
          <button className="btn btn--outline" onClick={viaEmail}><MdEmail aria-hidden="true" /> {t.shareViaEmail}</button>
          <button className="btn btn--outline" onClick={viaWhatsApp}><FaWhatsapp aria-hidden="true" /> {t.shareViaWhatsApp}</button>
          {photo && <button className="btn btn--outline" onClick={savePhoto}><MdDownload aria-hidden="true" /> {t.downloadImage}</button>}
        </div>
      )}
    </div>
  );
}

export default function ContentView({ t, photo, objectName, subjectKey, subjects, content, onBack, onSelectSubject, onRelatedObject, onToast }) {
  const subject = getSubject(subjectKey);
  const paragraphs = content ? String(content.explanation || '').split(/\n\s*\n/).filter(Boolean) : [];

  return (
    <article className="content" style={{ '--subject': subject.color }}>
      <button className="link-btn" onClick={onBack}>
        <MdArrowBack aria-hidden="true" /> {t.back}
      </button>

      <ObjectHeader photo={photo} objectName={objectName} photoAlt={t.capturedPhoto}>
        <span className="chip chip--subject">
          <subject.icon aria-hidden="true" /> {t.subjects[subjectKey]}
        </span>
      </ObjectHeader>

      {!content ? (
        <LoadingContent label={t.loading} />
      ) : (
        <>
          <section className="card card--subject">
            <h3 className="card__title">{content.title}</h3>
            <p className="card__lead">{content.text}</p>
          </section>

          {paragraphs.length > 0 && (
            <section className="prose">
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </section>
          )}

          {content.funFacts.length > 0 && (
            <section>
              {/* Offline templates contain activities, not facts */}
              <h3 className="section-title">{content.offline ? t.tryThis : t.funFacts}</h3>
              <ul className="facts">
                {content.funFacts.map((fact, i) => (
                  <li key={i} className="facts__item">
                    <MdLightbulbOutline className="facts__icon" aria-hidden="true" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {content.links.length > 0 && (
            <section>
              <h3 className="section-title">{t.recommendedResources}</h3>
              <ul className="links">
                {content.links.map((link, i) => (
                  <li key={i}>
                    <a className="links__item" href={link.url} target="_blank" rel="noopener noreferrer">
                      <span>
                        <span className="links__title">{link.title || link.url}</span>
                        <span className="links__source">{link.source || hostnameOf(link.url)}</span>
                      </span>
                      <MdOpenInNew aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {content.relatedObjects.length > 0 && (
            <section>
              <h3 className="section-title">{t.relatedObjects}</h3>
              <div className="chips">
                {content.relatedObjects.map(name => (
                  <button key={name} className="chip chip--button" onClick={() => onRelatedObject(name)}>{name}</button>
                ))}
              </div>
            </section>
          )}

          <ShareBar t={t} content={content} photo={photo} onToast={onToast} />

          {subjects.length > 1 && (
          <section>
            <h3 className="section-title">{t.otherSubjects}</h3>
            <div className="chips chips--scroll">
              {subjects.filter(s => s.key !== subjectKey).map(({ key, icon: Icon, color }) => (
                <button key={key} className="chip chip--button chip--tinted" style={{ '--subject': color }} onClick={() => onSelectSubject(key)}>
                  <Icon aria-hidden="true" /> {t.subjects[key]}
                </button>
              ))}
            </div>
          </section>
          )}
        </>
      )}
    </article>
  );
}
