// Ordnet einem Essensnamen eines von zwölf Symbolen zu. Reihenfolge = Priorität.
export const ICON_IDS = ['onigiri', 'ramyun', 'milk', 'drumstick', 'rice', 'bread', 'egg', 'broccoli', 'apple', 'candy', 'avocado', 'plate'];

const KEYWORDS = {
  onigiri: ['kimbap', 'gimbap', '삼각김밥', '김밥', 'onigiri', 'sushi'],
  ramyun: ['ramyun', 'ramen', '라면', 'nudel', 'noodle', 'instant'],
  milk: ['milk', 'milch', '우유', 'joghurt', 'yogurt', 'latte'],
  drumstick: ['hähnchen', 'chicken', 'huhn', '치킨', 'fleisch', 'rind', 'schwein', 'bulgogi', 'döner'],
  rice: ['reis', 'rice', 'bibimbap', '밥', 'curry'],
  bread: ['brot', 'bread', 'toast', 'sandwich', 'wrap', 'burger', 'brötchen', 'croissant', '빵'],
  egg: ['ei', 'egg', 'eier', '계란'],
  broccoli: ['salat', 'salad', 'gemüse', 'brokkoli', 'broccoli'],
  apple: ['apfel', 'apple', 'banane', 'banana', 'obst', 'frucht', 'orange', '사과'],
  candy: ['schoko', 'chocolate', 'bonbon', 'keks', 'cookie', 'kuchen', 'cake', 'eis', 'riegel'],
  avocado: ['avocado', 'nuss', 'nut', 'mandel'],
};

const matches = (word, kw) => ([...kw].length >= 4 ? word.startsWith(kw) : word === kw);

export function foodIconFor(name) {
  const words = String(name ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const id of ICON_IDS) {
    if (KEYWORDS[id]?.some((kw) => words.some((w) => matches(w, kw)))) return id;
  }
  return 'plate';
}
