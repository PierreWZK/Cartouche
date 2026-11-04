import { Injectable, computed, effect, signal } from '@angular/core';
import fr from './fr.json';
import en from './en.json';

const dictionaries = { fr, en };
export type Lang = keyof typeof dictionaries;
type Dict = typeof fr;

const STORAGE_KEY = 'cartouche-lang';

@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = signal<Lang>(this.stored());
  readonly dict = computed<Dict>(() => dictionaries[this.lang()]);

  constructor() {
    document.documentElement.lang = this.lang();
    effect(() => {
      document.title = this.dict().siteTitle;
    });
  }

  setLang(lang: Lang) {
    this.lang.set(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Stockage indisponible (navigation privée) : la langue reste active pour la session.
    }
  }

  // « 0 cartouche posée » en français, « 0 cartridges » en anglais : la règle suit la langue.
  count(n: number, one: string, other: string): string {
    return `${n} ${new Intl.PluralRules(this.lang()).select(n) === 'one' ? one : other}`;
  }

  private stored(): Lang {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === 'fr' || value === 'en') return value;
    } catch {
      // Stockage indisponible : on garde le français par défaut.
    }
    return 'fr';
  }
}
