export default function Splash({ t }) {
  return (
    <div className="splash" role="status">
      <img className="splash__logo" src="/curiocity-logo.svg" alt="Curiocity" />
      <p className="splash__tagline">{t.tagline}</p>
    </div>
  );
}
