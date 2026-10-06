// Kleine DOM-Helfer. Text wird immer als textContent gesetzt (nie innerHTML).
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function openSheet(...content) {
  const root = document.getElementById('dialog-root');
  root.replaceChildren(el('div', { class: 'overlay' }, el('div', { class: 'sheet' }, ...content)));
}

export function closeSheet() {
  document.getElementById('dialog-root').replaceChildren();
}

// "72,5" und "72.5" -> 72.5; leer/ungültig/negativ -> null
export function parseNum(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
