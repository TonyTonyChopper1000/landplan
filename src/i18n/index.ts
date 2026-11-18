import en from './en.json';

export type Locale = 'en' | 'te';
type Dict = Record<string, string>;
const dicts: Record<Locale, Dict> = { en, te: {} };
let locale: Locale = 'en';

export const setLocale = (l: Locale) => {
  locale = l;
};

/** Look up a string; falls back to English, then to the key. `{name}` placeholders are interpolated. */
export function t(key: keyof typeof en | string, vars?: Record<string, string | number>): string {
  const s = dicts[locale][key] ?? (en as Dict)[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : s;
}
