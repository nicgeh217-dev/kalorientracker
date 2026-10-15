// Der Fuchs als SVG. Stimmung: sleeping | happy | proud | curious | miss. accessories: ['scarf','beanie','glasses','crown','cape'].
const NS = 'http://www.w3.org/2000/svg';

function s(tag, attrs = {}, ...children) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const c of children) n.append(c);
  return n;
}

const ORANGE = '#f2711c';
const ORANGE_DARK = '#d95d0e';
const CREAM = '#fff4e6';
const DARK = '#3b2417';

function eyes(mood) {
  const stroke = { stroke: DARK, 'stroke-width': 4.5, 'stroke-linecap': 'round', fill: 'none' };
  if (mood === 'happy' || mood === 'proud') {
    return [s('path', { d: 'M 67 94 Q 76 82 85 94', ...stroke }), s('path', { d: 'M 115 94 Q 124 82 133 94', ...stroke })];
  }
  if (mood === 'sleeping') {
    return [s('path', { d: 'M 67 92 Q 76 100 85 92', ...stroke }), s('path', { d: 'M 115 92 Q 124 100 133 92', ...stroke })];
  }
  const ry = mood === 'miss' ? 10 : 8;
  const eye = (cx) => s('g', { class: 'eye' },
    s('ellipse', { cx, cy: 92, rx: 7, ry, fill: DARK }),
    s('circle', { cx: cx + 2.4, cy: 88.5, r: 2.6, fill: '#fff' }),
    mood === 'miss' ? s('circle', { cx: cx - 2.5, cy: 96, r: 1.6, fill: '#fff', opacity: '.8' }) : null);
  return [eye(76), eye(124)].map((g) => g);
}

function mouth(mood) {
  const stroke = { stroke: DARK, 'stroke-width': 3.5, 'stroke-linecap': 'round', fill: 'none' };
  if (mood === 'happy' || mood === 'proud') return s('path', { class: 'mouth', d: 'M 89 124 Q 100 136 111 124', ...stroke });
  if (mood === 'miss') return s('path', { class: 'mouth', d: 'M 92 131 Q 100 124 108 131', ...stroke });
  if (mood === 'sleeping') return s('path', { class: 'mouth', d: 'M 95 126 Q 100 129 105 126', ...stroke });
  return s('path', { class: 'mouth', d: 'M 93 126 Q 100 131 107 126', ...stroke }); // curious
}

const ACCESSORY_SHAPES = {
  scarf: () => s('g', {},
    s('path', { d: 'M 62 136 Q 100 154 138 136 L 141 151 Q 100 169 59 151 Z', fill: '#e11d48' }),
    s('path', { d: 'M 119 154 L 133 183 L 117 178 Z', fill: '#be123c' })),
  beanie: () => s('g', {},
    s('path', { d: 'M 74 62 Q 100 22 126 62 Z', fill: '#2563eb' }),
    s('rect', { x: 72, y: 58, width: 56, height: 9, rx: 4.5, fill: '#1d4ed8' }),
    s('circle', { cx: 100, cy: 28, r: 7, fill: '#fff' })),
  glasses: () => s('g', { fill: 'rgba(255,255,255,.22)', stroke: DARK, 'stroke-width': 3 },
    s('circle', { cx: 76, cy: 92, r: 14 }),
    s('circle', { cx: 124, cy: 92, r: 14 }),
    s('path', { d: 'M 90 92 L 110 92', fill: 'none' })),
  crown: () => s('path', { d: 'M 78 56 L 82 34 L 92 46 L 100 28 L 108 46 L 118 34 L 122 56 Z', fill: '#facc15', stroke: '#ca8a04', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
};

export function foxSvg({ mood = 'curious', accessories = [], munch = false, size = 120 } = {}) {
  const has = (id) => accessories.includes(id);
  const svg = s('svg', {
    viewBox: '0 0 200 200', width: size, height: size, class: `fox mood-${mood}${munch ? ' munch' : ''}`, role: 'img',
    'aria-label': { sleeping: 'Fuchs schläft', happy: 'Fuchs freut sich', proud: 'Fuchs ist stolz', miss: 'Fuchs hat dich vermisst', curious: 'Fuchs ist neugierig' }[mood],
  });

  if (has('cape')) svg.append(s('path', { d: 'M 62 130 Q 38 170 50 197 L 150 197 Q 162 170 138 130 Z', fill: '#7c3aed' }));

  svg.append(
    s('g', { class: 'tail' },
      s('ellipse', { cx: 166, cy: 128, rx: 17, ry: 38, fill: ORANGE, transform: 'rotate(28 166 128)' }),
      s('ellipse', { cx: 181, cy: 101, rx: 10, ry: 14, fill: CREAM, transform: 'rotate(28 181 101)' })),
    s('g', { class: 'body' },
      s('ellipse', { cx: 100, cy: 152, rx: 42, ry: 38, fill: ORANGE }),
      s('ellipse', { cx: 100, cy: 160, rx: 24, ry: 24, fill: CREAM }),
      s('ellipse', { cx: 80, cy: 188, rx: 12, ry: 7, fill: DARK }),
      s('ellipse', { cx: 120, cy: 188, rx: 12, ry: 7, fill: DARK })),
  );

  const head = s('g', { class: 'head' },
    s('path', { d: 'M 40 92 L 52 38 L 86 62 Q 100 58 114 62 L 148 38 L 160 92 Q 162 132 100 142 Q 38 132 40 92 Z', fill: ORANGE }),
    s('path', { d: 'M 56 52 L 76 66 L 55 80 Z', fill: DARK }),
    s('path', { d: 'M 144 52 L 124 66 L 145 80 Z', fill: DARK }),
    s('path', { d: 'M 41 100 Q 62 140 100 142 Q 138 140 159 100 Q 130 120 100 114 Q 70 120 41 100 Z', fill: CREAM }),
    ...eyes(mood),
    s('ellipse', { cx: 100, cy: 113, rx: 7, ry: 5, fill: DARK }),
    mouth(mood),
  );
  if (mood === 'proud') {
    head.append(s('circle', { cx: 60, cy: 110, r: 7, fill: '#fb7185', opacity: '.45' }), s('circle', { cx: 140, cy: 110, r: 7, fill: '#fb7185', opacity: '.45' }));
  }
  svg.append(head);

  for (const id of ['scarf', 'glasses', 'beanie', 'crown']) if (has(id)) svg.append(ACCESSORY_SHAPES[id]());

  if (mood === 'sleeping') {
    const z = (x, y, size2, delay) => {
      const t = s('text', { x, y, 'font-size': size2, 'font-weight': 800, fill: '#94a3b8', class: 'zzz', style: `animation-delay:${delay}s` });
      t.textContent = 'z';
      return t;
    };
    svg.append(z(156, 56, 26, 0), z(172, 36, 20, 0.8), z(186, 20, 14, 1.6));
  }
  if (mood === 'proud') {
    const star = (x, y, r) => s('path', { class: 'spark', d: `M ${x} ${y - r} L ${x + r * 0.28} ${y - r * 0.28} L ${x + r} ${y} L ${x + r * 0.28} ${y + r * 0.28} L ${x} ${y + r} L ${x - r * 0.28} ${y + r * 0.28} L ${x - r} ${y} L ${x - r * 0.28} ${y - r * 0.28} Z`, fill: '#facc15' });
    svg.append(star(32, 40, 11), star(170, 52, 8), star(22, 90, 6));
  }
  return svg;
}
