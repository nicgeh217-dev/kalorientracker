import { ICON_IDS } from '../food-icons.js';

const NS = 'http://www.w3.org/2000/svg';

// Flache Symbole auf 48x48, feste Farben (wirken in Hell- und Dunkelmodus).
const SHAPES = {
  onigiri: `<path d="M24 6 L42 38 Q43 42 39 42 H9 Q5 42 6 38 Z" fill="#f4f1ea"/><path d="M17 30 H31 V42 H17 Z" fill="#1c2b22"/><circle cx="24" cy="22" r="2.2" fill="#f2711c"/>`,
  ramyun: `<path d="M6 24 H42 Q42 40 24 40 Q6 40 6 24 Z" fill="#f2711c"/><path d="M12 22 Q16 12 20 22 M20 22 Q24 10 28 22 M28 22 Q32 12 36 22" stroke="#ffd36e" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M34 6 L28 24" stroke="#c9a56a" stroke-width="2.5" stroke-linecap="round"/><path d="M38 8 L31 24" stroke="#c9a56a" stroke-width="2.5" stroke-linecap="round"/>`,
  milk: `<path d="M15 8 H33 V14 L37 20 V40 Q37 43 34 43 H14 Q11 43 11 40 V20 L15 14 Z" fill="#f4f1ea"/><rect x="11" y="24" width="26" height="9" fill="#4da3ff"/><rect x="15" y="5" width="18" height="5" rx="1.5" fill="#4da3ff"/>`,
  drumstick: `<circle cx="29" cy="19" r="13" fill="#c97a3b"/><path d="M20 28 L10 38" stroke="#f4f1ea" stroke-width="5" stroke-linecap="round"/><circle cx="8" cy="40" r="3.5" fill="#f4f1ea"/><circle cx="8" cy="36" r="3.5" fill="#f4f1ea"/><path d="M24 12 Q30 10 34 14" stroke="#e8a15f" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  rice: `<path d="M6 22 H42 Q42 40 24 40 Q6 40 6 22 Z" fill="#26262b" stroke="#8a8a92" stroke-width="1.5"/><path d="M9 22 Q10 10 24 9 Q38 10 39 22 Z" fill="#f4f1ea"/><circle cx="19" cy="16" r="1.4" fill="#d9d4c7"/><circle cx="27" cy="14" r="1.4" fill="#d9d4c7"/><circle cx="31" cy="19" r="1.4" fill="#d9d4c7"/>`,
  bread: `<path d="M8 22 Q8 8 24 8 Q40 8 40 22 V38 Q40 41 37 41 H11 Q8 41 8 38 Z" fill="#d9964a"/><path d="M16 17 Q24 12 32 17" stroke="#f0c27b" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M12 28 H36" stroke="#b97832" stroke-width="2" stroke-linecap="round"/>`,
  egg: `<path d="M24 5 Q38 5 38 27 Q38 42 24 42 Q10 42 10 27 Q10 5 24 5 Z" fill="#f4f1ea"/><circle cx="24" cy="29" r="8" fill="#ffb020"/><circle cx="21.5" cy="26.5" r="2" fill="#ffd36e"/>`,
  broccoli: `<rect x="20" y="26" width="8" height="16" rx="3" fill="#8bc97a"/><circle cx="16" cy="22" r="8" fill="#3ccf7a"/><circle cx="32" cy="22" r="8" fill="#3ccf7a"/><circle cx="24" cy="15" r="9" fill="#2fb868"/>`,
  apple: `<path d="M24 14 Q14 8 9 18 Q5 32 15 41 Q20 44 24 41 Q28 44 33 41 Q43 32 39 18 Q34 8 24 14 Z" fill="#ff6b57"/><path d="M24 14 Q24 8 28 5" stroke="#8a5a2b" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M27 10 Q33 5 37 9 Q32 13 27 10 Z" fill="#3ccf7a"/>`,
  candy: `<rect x="8" y="14" width="32" height="22" rx="4" fill="#7a4a2b"/><path d="M8 25 H40 M24 14 V36" stroke="#5a3520" stroke-width="2"/><path d="M8 19 L2 14 V36 L8 31 Z M40 19 L46 14 V36 L40 31 Z" fill="#ff7ac0"/>`,
  avocado: `<path d="M24 4 Q34 4 38 20 Q42 38 24 44 Q6 38 10 20 Q14 4 24 4 Z" fill="#3a7d44"/><path d="M24 9 Q31 9 34 21 Q37 35 24 40 Q11 35 14 21 Q17 9 24 9 Z" fill="#c8e08a"/><circle cx="24" cy="29" r="7" fill="#8a5a2b"/>`,
  plate: `<circle cx="24" cy="24" r="19" fill="#f4f1ea"/><circle cx="24" cy="24" r="12" fill="#e4dfd2"/><path d="M40 6 V20 M37 6 V12 M43 6 V12 M40 20 V42" stroke="#8a8a92" stroke-width="2" stroke-linecap="round"/>`,
};

export function foodIconSvg(id, size = 40) {
  const key = ICON_IDS.includes(id) ? id : 'plate';
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 48 48');
  s.setAttribute('width', String(size));
  s.setAttribute('height', String(size));
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.innerHTML = SHAPES[key];
  return s;
}
