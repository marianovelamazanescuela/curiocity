import { MdScience, MdTerrain, MdHistoryEdu, MdCalculate, MdMenuBook, MdMusicNote, MdBrush } from 'react-icons/md';

// One entry per subject. `aiName` is what the server prompt receives;
// the visible label comes from translations[lang].subjects[key].
// `color`: warm palette (reds, oranges, browns) from the project's design guide (CLAUDE.md).
// Light tints so ink-coloured text (#1d1d1b) always has strong contrast; subjects are also
// told apart by icon and label, never by colour alone.
export const SUBJECTS = [
  { key: 'biologia', aiName: 'Biology', icon: MdScience, color: '#efd38f' }, // ochre
  { key: 'geologia', aiName: 'Geology', icon: MdTerrain, color: '#e6d5c1' }, // stone
  { key: 'historia', aiName: 'History', icon: MdHistoryEdu, color: '#e8ad94' }, // terracotta
  { key: 'matematicas', aiName: 'Mathematics', icon: MdCalculate, color: '#ddbb96' }, // caramel
  { key: 'lengua', aiName: 'Language Arts', icon: MdMenuBook, color: '#f3b4a7' }, // coral
  { key: 'musica', aiName: 'Music', icon: MdMusicNote, color: '#dcb2a5' }, // clay
  { key: 'artes', aiName: 'Art', icon: MdBrush, color: '#f6c287' } // orange
];

export const getSubject = key => SUBJECTS.find(s => s.key === key);

/** Subjects to show for an object: only the relevant ones, or all when unknown (null). */
export const subjectsFor = keys => (Array.isArray(keys) && keys.length ? SUBJECTS.filter(s => keys.includes(s.key)) : SUBJECTS);
