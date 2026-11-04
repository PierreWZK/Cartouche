import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { I18n } from '../i18n/i18n';
import {
  type Attempt,
  type DailyGame,
  type Progress,
  currentStreak,
  dailyGames,
  dayKey,
  loadProgress,
  saveAttempt,
  score,
  startOrder,
} from './daily';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Page du jeu du jour. Une tentative par jour ; le lien partagé ouvre le jour indiqué (?d=AAAA-MM-JJ).
@Component({
  selector: 'app-daily',
  template: `
    <section class="daily">
      <header class="head">
        <p class="eyebrow">{{ dayLabel() }}</p>
        <h1>{{ d().daily.title }}</h1>
        <p class="lead">{{ d().daily.lead }}</p>
      </header>

      @if (!isToday) {
        <p class="note">{{ d().daily.otherDay }}</p>
      } @else if (attempt()) {
        <p class="note">{{ d().daily.alreadyPlayed }}</p>
      }

      <ol class="order">
        @for (g of order(); track g.id; let i = $index) {
          <li
            class="row"
            [class.right]="locked() && isRight(i)"
            [class.wrong]="locked() && !isRight(i)"
          >
            <span class="pos" aria-hidden="true">{{ i + 1 }}</span>
            <span class="thumb" [style.background]="g.cover ? null : g.art">
              @if (g.cover) {
                <img [src]="g.cover" alt="" loading="lazy" />
              }
            </span>
            <span class="info">
              <span class="title">{{ g.name }}</span>
              <span class="meta">{{ g.platforms[0] }}</span>
              @if (locked()) {
                <span class="year">{{ g.year }}</span>
              }
            </span>
            @if (!locked()) {
              <span class="moves">
                <button
                  type="button"
                  [attr.aria-label]="d().daily.up.replace('{name}', g.name)"
                  [disabled]="i === 0"
                  (click)="move(i, -1)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  [attr.aria-label]="d().daily.down.replace('{name}', g.name)"
                  [disabled]="i === order().length - 1"
                  (click)="move(i, 1)"
                >
                  ↓
                </button>
              </span>
            }
          </li>
        }
      </ol>

      @if (!locked()) {
        <button type="button" class="btn btn-primary wide" (click)="validate()">
          {{ d().daily.validate }}
        </button>
      }

      @if (attempt(); as a) {
        <section class="result" aria-live="polite">
          <p class="score">{{ d().daily.score.replace('{score}', '' + a.score) }}</p>
          @if (a.score === 5) {
            <p>{{ d().daily.perfect }}</p>
          }
          @if (streak() > 0) {
            <p class="streak">{{ d().daily.streak.replace('{n}', '' + streak()) }}</p>
          }
        </section>
      }

      <div class="share">
        <button type="button" class="btn" (click)="share()">
          {{ touch ? d().daily.share : d().daily.copy }}
        </button>
        @if (copied()) {
          <span aria-live="polite">{{ d().daily.copied }}</span>
        }
      </div>
      @if (manualUrl(); as u) {
        <label class="manual">
          <span>{{ d().daily.copyFailed }}</span>
          <input type="text" readonly [value]="u" (focus)="$any($event.target).select()" />
        </label>
      }
    </section>
  `,
  styles: `
    .daily {
      display: grid;
      gap: 20px;
      max-width: 720px;
    }

    .eyebrow {
      margin: 0 0 8px;
      font-family: var(--font-mono);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ambre);
    }

    h1 {
      font-size: clamp(32px, 8vw, 52px);
      font-weight: 800;
    }

    .lead,
    .note {
      margin: 8px 0 0;
      color: color-mix(in srgb, var(--encre) 75%, transparent);
    }

    .note {
      padding: 12px 14px;
      border: 1px solid var(--ligne);
      border-radius: 10px;
      background: var(--surface);
    }

    .order {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }

    .row {
      display: grid;
      grid-template-columns: auto 56px 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 8px 10px;
      border: 1px solid var(--ligne);
      border-radius: 12px;
      background: var(--surface);
    }

    .row.right {
      border-color: #5d9b6b;
    }

    .row.wrong {
      border-color: #b8322b;
    }

    .pos {
      font-family: var(--font-mono);
      color: var(--brume);
    }

    .thumb {
      display: block;
      width: 56px;
      height: 75px;
      border-radius: 4px;
      background: var(--surface-haute);
      overflow: hidden;
    }

    .thumb img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .info {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .title {
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    .meta,
    .year {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--brume);
    }

    .year {
      color: var(--ambre);
      font-size: 14px;
    }

    .moves {
      display: grid;
      gap: 4px;
    }

    .moves button {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      border: 1px solid var(--ligne);
      background: var(--surface-haute);
      color: var(--encre);
      font-size: 18px;
      cursor: pointer;
    }

    .moves button:disabled {
      opacity: 0.35;
      cursor: default;
    }

    .wide {
      width: 100%;
    }

    .result {
      display: grid;
      gap: 6px;
      padding: 16px;
      border-radius: 14px;
      border: 1px solid var(--ambre);
    }

    .score {
      margin: 0;
      font-family: var(--font-titre);
      font-size: 24px;
      font-weight: 800;
      color: var(--ambre);
    }

    .result p {
      margin: 0;
    }

    .streak {
      font-family: var(--font-mono);
      font-size: 13px;
    }

    .share {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .share span {
      color: var(--brume);
    }

    .manual {
      display: grid;
      gap: 6px;
      font-size: 14px;
    }

    .manual input {
      min-height: 44px;
      padding: 0 12px;
      border-radius: 8px;
      border: 1px solid var(--ligne);
      background: var(--surface);
      color: var(--encre);
      font: inherit;
      font-family: var(--font-mono);
    }

    @media (min-width: 768px) {
      .row {
        padding: 10px 14px;
      }

      .moves {
        grid-auto-flow: column;
      }
    }
  `,
})
export class DailyPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly i18n = inject(I18n);
  protected readonly d = this.i18n.dict;
  protected readonly touch = matchMedia('(pointer: coarse)').matches;

  private readonly today = dayKey();
  // Lien partagé : ?d=AAAA-MM-JJ. Sans paramètre, date future ou date mal écrite : le jeu du jour.
  protected readonly day = this.pickDay(this.route.snapshot.queryParamMap.get('d'));
  protected readonly isToday = this.day === this.today;
  private readonly answer = dailyGames(this.day);
  private readonly saved = loadProgress().days[this.day] ?? null;

  protected readonly attempt = signal<Attempt | null>(this.saved);
  protected readonly order = signal<DailyGame[]>(this.initialOrder());
  // Verrouillé : jour passé (on voit la réponse) ou partie déjà jouée aujourd'hui.
  protected readonly locked = computed(() => !this.isToday || this.attempt() !== null);
  protected readonly progress = signal<Progress>(loadProgress());
  protected readonly streak = computed(() => currentStreak(this.progress(), this.today));
  protected readonly copied = signal(false);
  // Présent seulement si la copie automatique a échoué : le lien est alors affiché à copier à la main.
  protected readonly manualUrl = signal<string | null>(null);
  protected readonly dayLabel = computed(() =>
    new Intl.DateTimeFormat(this.i18n.lang(), { dateStyle: 'long', timeZone: 'UTC' }).format(
      new Date(`${this.day}T00:00:00Z`),
    ),
  );

  private pickDay(raw: string | null): string {
    return raw && DAY.test(raw) && raw <= this.today ? raw : this.today;
  }

  private initialOrder(): DailyGame[] {
    // Données locales périmées (autres jeux) : on ignore l'ordre enregistré plutôt que d'afficher une liste vide.
    const restored = (this.saved?.order ?? [])
      .map((id) => this.answer.find((g) => g.id === id))
      .filter((g): g is DailyGame => g !== undefined);
    if (this.saved && restored.length === this.answer.length) return restored;
    // Jour passé non joué : on montre la bonne réponse. Aujourd'hui : ordre mélangé.
    return this.isToday ? startOrder(this.day) : this.answer;
  }

  protected isRight(i: number): boolean {
    return this.order()[i]?.id === this.answer[i]?.id;
  }

  protected move(i: number, delta: 1 | -1) {
    const j = i + delta;
    if (this.locked() || j < 0 || j >= this.order().length) return;
    const next = [...this.order()];
    [next[i], next[j]] = [next[j]!, next[i]!];
    this.order.set(next);
  }

  protected validate() {
    if (this.locked()) return;
    const result: Attempt = {
      score: score(this.order(), this.answer),
      order: this.order().map((g) => g.id),
    };
    this.progress.set(saveAttempt(this.day, result));
    this.attempt.set(result);
  }

  // Sur téléphone : la feuille de partage native. Sur ordinateur : copie du lien, avec confirmation.
  protected async share() {
    const a = this.attempt();
    const text = this.d().daily.shareText.replace('{day}', this.day) + (a ? ` · ${a.score}/5` : '');
    const url = `${location.origin}/jour?d=${this.day}`;
    if (this.touch && navigator.share) {
      await navigator.share({ title: 'Cartouche', text, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard
      .writeText(url)
      .then(() => {
        this.manualUrl.set(null);
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      })
      .catch(() => this.manualUrl.set(url));
  }
}
