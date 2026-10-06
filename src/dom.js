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

// Macht aus einem <select> einen Apple-artigen Segment-Schalter.
// Das <select> bleibt die Quelle der Wahrheit (value + input-Event), so ändert sich die Formularlogik nicht.
export function segmented(select) {
  const wrap = el('div', { class: 'seg' }, select);
  const buttons = [...select.options].map((opt) => {
    const b = el('button', { type: 'button', onClick: () => { select.value = opt.value; select.dispatchEvent(new Event('input', { bubbles: true })); sync(); } }, opt.dataset.short ?? opt.textContent);
    return [opt.value, b];
  });
  function sync() {
    for (const [v, b] of buttons) b.classList.toggle('on', select.value === v);
  }
  wrap.append(...buttons.map(([, b]) => b));
  sync();
  return wrap;
}

export function openSheet(...content) {
  const root = document.getElementById('dialog-root');
  root.replaceChildren(el('div', { class: 'overlay' }, el('div', { class: 'sheet' }, ...content)));
}

// Kurze Einblendung unten mit optionaler Aktion (z. B. "Rückgängig").
export function toast(text, actionLabel, onAction, ms = 5000) {
  document.getElementById('toast-root')?.remove();
  const node = el('div', { id: 'toast-root', class: 'toast', role: 'status' },
    el('span', {}, text),
    actionLabel ? el('button', { onClick: () => { node.remove(); onAction?.(); } }, actionLabel) : null);
  document.body.append(node);
  setTimeout(() => node.remove(), ms);
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
