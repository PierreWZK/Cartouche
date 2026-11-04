import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

export interface Account {
  id: string;
  email: string;
  shareId: string;
  // Absents de la réponse de connexion : seul /api/me les donne.
  username?: string | null;
  shelfPublic?: boolean;
}

// Compte, favoris et notes de la communauté. Appelé par app-layout, connexion, fiche et étagère.
// Sans base côté serveur, tout reste désactivé (mode démo).
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);

  readonly user = signal<Account | null>(null);
  readonly enabled = signal(false);
  readonly favouriteIds = signal<ReadonlySet<string>>(new Set());
  readonly ready = signal(false);

  private started = false;

  // Démarrage à la demande : seules les pages qui ont besoin du compte l'appellent (jamais /demo).
  ensureStarted(): void {
    if (this.started) return;
    this.started = true;
    this.init().subscribe();
  }

  // Le serveur dit si les comptes existent, puis on regarde si une session est ouverte.
  init(): Observable<void> {
    return this.http.get<{ accounts: boolean }>('/api/health').pipe(
      tap((h) => this.enabled.set(h.accounts)),
      map(() => undefined),
      catchError(() => of(undefined)),
      tap(() => this.refresh()),
    );
  }

  refresh(): void {
    if (!this.enabled()) {
      this.ready.set(true);
      return;
    }
    this.http.get<Account>('/api/me').subscribe({
      next: (u) => {
        this.user.set(u);
        this.loadFavourites();
        this.ready.set(true);
      },
      error: () => {
        this.user.set(null);
        this.favouriteIds.set(new Set());
        this.ready.set(true);
      },
    });
  }

  register(email: string, password: string): Observable<Account> {
    return this.http
      .post<Account>('/api/auth/register', { email, password })
      .pipe(tap((u) => this.signedIn(u)));
  }

  login(email: string, password: string): Observable<Account> {
    return this.http
      .post<Account>('/api/auth/login', { email, password })
      .pipe(tap((u) => this.signedIn(u)));
  }

  logout(): Observable<unknown> {
    return this.http.post('/api/auth/logout', {}).pipe(
      tap(() => {
        this.user.set(null);
        this.favouriteIds.set(new Set());
      }),
    );
  }

  toggleFavourite(gameId: string): Observable<unknown> {
    const on = this.favouriteIds().has(gameId);
    const url = `/api/me/favorites/${encodeURIComponent(gameId)}`;
    const req = on ? this.http.delete(url) : this.http.put(url, {});
    return req.pipe(
      tap(() => {
        const next = new Set(this.favouriteIds());
        if (on) next.delete(gameId);
        else next.add(gameId);
        this.favouriteIds.set(next);
      }),
    );
  }

  rate(gameId: string, score: number): Observable<unknown> {
    return this.http.put(`/api/games/${encodeURIComponent(gameId)}/rating`, { score });
  }

  // Pseudo et visibilité ; le compte en mémoire suit la modification.
  saveProfile(patch: { username: string | null; shelfPublic: boolean }): Observable<unknown> {
    return this.http
      .put('/api/me/profile', patch)
      .pipe(tap(() => this.user.update((u) => (u ? { ...u, ...patch } : u))));
  }

  // Suppression définitive : le serveur efface le compte, on repart en visiteur.
  deleteAccount(password: string): Observable<unknown> {
    return this.http.request('DELETE', '/api/me', { body: { password } }).pipe(
      tap(() => {
        this.user.set(null);
        this.favouriteIds.set(new Set());
      }),
    );
  }

  shareId(): Observable<string> {
    return this.http.get<{ shareId: string }>('/api/me/share').pipe(map((r) => r.shareId));
  }

  // Code d'erreur renvoyé par l'API (ou « network »), pour afficher le bon message.
  static errorCode(err: unknown): string {
    return err instanceof HttpErrorResponse ? (err.error?.error ?? 'network') : 'network';
  }

  private signedIn(u: Account) {
    this.user.set(u);
    this.loadFavourites();
  }

  private loadFavourites() {
    this.http.get<{ gameIds: string[] }>('/api/me/favorites').subscribe({
      next: (r) => this.favouriteIds.set(new Set(r.gameIds)),
      error: () => this.favouriteIds.set(new Set()),
    });
  }
}
