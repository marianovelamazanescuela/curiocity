// Thin-stroke icons (1.5 px at 24 px) for navigation and actions, drawn like the logo's monoline.
// Decorative: the button that holds them carries the accessible name.
// The subjects keep their Material Design icons (src/subjects.js).

function Icon({ children }) {
  return (
    <svg
      className="thin-icon"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconChevronLeft = () => <Icon><path d="M14.5 6 8.5 12l6 6" /></Icon>;
export const IconChevronRight = () => <Icon><path d="m9.5 6 6 6-6 6" /></Icon>;
export const IconChevronDown = () => <Icon><path d="m6 9.5 6 6 6-6" /></Icon>;
export const IconClose = () => <Icon><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></Icon>;
export const IconArrowLeft = () => <Icon><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>;
export const IconArrowRight = () => <Icon><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const IconOpen = () => <Icon><path d="M9 6h9v9M18 6 6 18" /></Icon>;
export const IconCamera = () => (
  <Icon>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);
// "Mis descubrimientos": a clock with a back arrow (what you found before)
export const IconHistory = () => (
  <Icon>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
    <path d="M4.5 4.5V9H9M12 8v4.2l3 1.8" />
  </Icon>
);
