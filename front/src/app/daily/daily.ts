import { Game } from '../data/game.model';
import poolData from './daily-pool.json';

// Le jeu du jour : 5 jeux tirés d'une base figée de 200 jeux (snapshot-daily.ts côté API),
// donc identique pour tout le monde et hors ligne. Le tirage dépend de la date UTC seulement.
export const DAILY_SIZE = 5;

export type DailyGame = Pick<Game, 'id' | 'name' | 'year' | 'platforms' | 'cover' | 'art'>;
const pool = poolData as DailyGame[];
const KEY = 'cartouche-daily';

export interface Attempt {
  score: number;
  order: string[];
}

export interface Progress {
  streak: number;
  last: string | null;
  days: Record<string, Attempt>;
}

export const dayKey = (d = new Date()): string => d.toISOString().slice(0, 10);

export function previousDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return dayKey(d);
}

// Générateur déterministe : FNV-1a pour la graine, puis mulberry32.
function seeded(text: string): () => number {
  let h = 2166136261;
  for (const c of text) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// Les 5 jeux du jour, dans l'ordre de sortie (du plus ancien au plus récent) : la bonne réponse.
// Cinq années différentes : deux jeux de la même année rendraient l'ordre ambigu.
export function dailyGames(day: string): DailyGame[] {
  const years = new Set<number>();
  const picked: DailyGame[] = [];
  for (const g of shuffle(pool, seeded(day))) {
    if (years.has(g.year)) continue;
    years.add(g.year);
    picked.push(g);
    if (picked.length === DAILY_SIZE) break;
  }
  return picked.sort((a, b) => a.year - b.year);
}

// Ordre de départ, mélangé avec une autre graine. Jamais déjà trié, sinon la partie est gagnée d'avance.
export function startOrder(day: string): DailyGame[] {
  const answer = dailyGames(day);
  let order = shuffle(answer, seeded(`${day}|order`));
  if (order.every((g, i) => g.id === answer[i]!.id))
    order = [order[1]!, order[0]!, ...order.slice(2)];
  return order;
}

// Nombre de jeux à la bonne place.
export function score(order: readonly DailyGame[], answer: readonly DailyGame[]): number {
  return order.filter((g, i) => g.id === answer[i]?.id).length;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      if (typeof p.streak === 'number' && p.days) return p;
    }
  } catch {
    // Stockage indisponible (navigation privée) : on repart de zéro pour la visite.
  }
  return { streak: 0, last: null, days: {} };
}

// Enregistre la tentative du jour et met la série à jour. Une seule tentative par jour.
export function saveAttempt(day: string, attempt: Attempt): Progress {
  const p = loadProgress();
  if (p.days[day]) return p;
  const next: Progress = {
    streak: p.last === previousDay(day) ? p.streak + 1 : 1,
    last: day,
    days: { ...p.days, [day]: attempt },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Non enregistré : la partie reste visible pour la visite en cours.
  }
  return next;
}

// La série ne compte que si la dernière partie date d'aujourd'hui ou d'hier.
export function currentStreak(p: Progress, today: string): number {
  return p.last === today || p.last === previousDay(today) ? p.streak : 0;
}
