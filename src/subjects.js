import { MdScience, MdTerrain, MdHistoryEdu, MdCalculate, MdMenuBook, MdMusicNote, MdBrush } from 'react-icons/md';

// One entry per subject. `aiName` is what the server prompt receives;
// the visible label comes from translations[lang].subjects[key].
// `color` is a soft tint used behind ink-coloured text (all pass WCAG AA with #1d1d1b).
export const SUBJECTS = [
  { key: 'biologia', aiName: 'Biology', icon: MdScience, color: '#cfe3bf' },
  { key: 'geologia', aiName: 'Geology', icon: MdTerrain, color: '#e6d3b8' },
  { key: 'historia', aiName: 'History', icon: MdHistoryEdu, color: '#f1c8b3' },
  { key: 'matematicas', aiName: 'Mathematics', icon: MdCalculate, color: '#c3daea' },
  { key: 'lengua', aiName: 'Language Arts', icon: MdMenuBook, color: '#f4e1a1' },
  { key: 'musica', aiName: 'Music', icon: MdMusicNote, color: '#dccbe8' },
  { key: 'artes', aiName: 'Art', icon: MdBrush, color: '#f4c1c1' }
];

export const getSubject = key => SUBJECTS.find(s => s.key === key);
