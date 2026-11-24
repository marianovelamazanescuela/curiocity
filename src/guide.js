// The welcome guide is shown only the first time the app opens. The mark is saved when the child
// finishes or skips it. If the browser blocks storage, the guide simply appears again next time.
export const GUIDE_KEY = 'curiocity_guia_v1';

export function guideSeen() {
  try {
    return window.localStorage.getItem(GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markGuideSeen() {
  try {
    window.localStorage.setItem(GUIDE_KEY, '1');
  } catch {
    // storage blocked: nothing to do, the app works the same
  }
}
