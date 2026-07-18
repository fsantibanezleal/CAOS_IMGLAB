import { useShellLang } from '@fasl-work/caos-app-shell';

// Tiny bilingual helper (EN canonical + ES) bound to the shell's language store.
// Usage: const t = useT(); ... t('Fourier basis', 'base de Fourier').
export function useT() {
  const lang = useShellLang();
  return (en: string, es: string) => (lang === 'es' ? es : en);
}
