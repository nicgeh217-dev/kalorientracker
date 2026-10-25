import { foxSvg } from './views/fox.js';
import { foodIconSvg } from './views/food-icons.js';

const SESSION_KEY = 'splashShown';
const NS = 'http://www.w3.org/2000/svg';

export function shouldShowSplash({ navigationType, launchAction, reducedMotion, shownThisSession }) {
  return !(reducedMotion || launchAction != null || shownThisSession || navigationType === 'reload');
}

export function splashAlreadyShown() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}

function markShown() {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ohne Speicher: Splash darf wiederkommen */ }
}

// Ring, Fuchs und drei Essens-Symbole, zusammen höchstens 1,4 s. Es werden nur transform und opacity animiert.
// Tipp überspringt. Der Ring wandert am Ende Richtung Kalorien-Karte (Annäherung, kein echter gemeinsamer Elementübergang).
export function runSplash(root) {
  markShown();
  const ringSvg = document.createElementNS(NS, 'svg');
  ringSvg.setAttribute('viewBox', '0 0 200 200');
  ringSvg.setAttribute('class', 'sp-ring');
  ringSvg.innerHTML = '<circle cx="100" cy="100" r="84" fill="none" stroke="#26262b" stroke-width="14"/>'
    + '<circle cx="100" cy="100" r="84" fill="none" stroke="#f2711c" stroke-width="14" stroke-linecap="round" stroke-dasharray="396 132" transform="rotate(-90 100 100)"/>';
  const fox = document.createElement('div');
  fox.className = 'sp-fox';
  fox.append(foxSvg({ mood: 'happy', size: 96 }));
  const foods = ['onigiri', 'milk', 'ramyun'].map((id, i) => {
    const d = document.createElement('div');
    d.className = `sp-food sp-food-${i}`;
    d.append(foodIconSvg(id, 56));
    return d;
  });
  root.replaceChildren(ringSvg, fox, ...foods);

  const opts = (delay, duration, easing = 'cubic-bezier(.22,1,.36,1)') => ({ delay, duration, easing, fill: 'both' });
  const anims = [
    ringSvg.animate([{ transform: 'rotate(-140deg) scale(.7)', opacity: 0 }, { transform: 'rotate(0) scale(1)', opacity: 1 }], opts(0, 450)),
    fox.animate([{ transform: 'translateY(40px) scale(.6)', opacity: 0 }, { transform: 'translateY(-14px) scale(1.05)', opacity: 1, offset: 0.6 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], opts(150, 450)),
    ...foods.map((f, i) => f.animate([
      { transform: `translate(${(i - 1) * 130}px, 90px) scale(.9)`, opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { transform: 'translate(0, 6px) scale(.55)', opacity: 0 },
    ], opts(500 + i * 70, 380, 'cubic-bezier(.5,0,.7,.4)'))),
    ringSvg.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-200px) scale(.45)' }], opts(880, 280, 'ease-in')),
    fox.animate([{ opacity: 1 }, { opacity: 0 }], opts(880, 230)),
    root.animate([{ opacity: 1 }, { opacity: 0 }], opts(1020, 260, 'ease-out')),
  ];

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      for (const a of anims) a.cancel();
      root.remove();
      resolve();
    };
    root.addEventListener('pointerdown', finish, { once: true });
    setTimeout(finish, 1300);
  });
}
