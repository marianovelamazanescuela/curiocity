// Photo thumbnail (or the brand "eyes" when there is no photo) + object name.
export default function ObjectHeader({ photo, objectName, photoAlt, children }) {
  return (
    <header className="object-header">
      <div className="object-header__thumb">
        {photo ? <img src={photo} alt={photoAlt} /> : <img className="object-header__eyes" src="/curiocity-icon.svg" alt="" aria-hidden="true" />}
      </div>
      <div>
        {children}
        <h2 className="object-header__name">{objectName}</h2>
      </div>
    </header>
  );
}
