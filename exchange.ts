@Injectable({ providedIn: 'root' })
export class TransactionDetailsService {
  private readonly BASE_API = `${environment.API}/transactions`;

  // 1️⃣ Dictionnaire de cache : "id" → { date d’enregistrement, résultat partagé }
  private cache = new Map<number, { at: number; obs$: Observable<any> }>();

  // 2️⃣ Durée de vie du cache (ici 5 minutes)
  private readonly TTL_MS = 5 * 60 * 1000;

  constructor(private http: HttpClient) {}

  // 3️⃣ Méthode principale : récupère une transaction (avec cache)
  getById(id: number, opts?: { force?: boolean }): Observable<any> {
    const force = !!opts?.force;
    const cached = this.cache.get(id);

    // 🟢 Étape 1 : si on a déjà la donnée et qu’elle n’a pas expiré → on la renvoie directement
    if (!force && cached && this.isFresh(cached.at)) {
      return cached.obs$;
    }

    // 🔵 Étape 2 : sinon on refait l’appel HTTP
    const obs$ = this.http.get<any>(`${this.BASE_API}/${id}`).pipe(
      // ✅ shareReplay garde la dernière valeur en mémoire pour tous les abonnés
      shareReplay({ bufferSize: 1, refCount: false }),

      // ❌ en cas d’erreur, on supprime du cache (on ne garde pas une erreur)
      catchError(err => {
        this.cache.delete(id);
        return throwError(() => err);
      })
    );

    // 🟣 Étape 3 : on stocke la nouvelle réponse dans le cache
    this.cache.set(id, { at: Date.now(), obs$ });
    return obs$;
  }

  // 4️⃣ Méthode utilitaire : récupère plusieurs ids en une fois
  getMany(ids: number[]): Observable<any[]> {
    const unique = [...new Set(ids)];
    return forkJoin(unique.map(id => this.getById(id)));
  }

  // 5️⃣ Vide le cache (partiellement ou totalement)
  invalidate(ids?: number[]) {
    if (!ids || ids.length === 0) this.cache.clear();
    else ids.forEach(id => this.cache.delete(id));
  }

  // 6️⃣ Vérifie si la donnée est encore "fraîche"
  private isFresh(at: number): boolean {
    return Date.now() - at < this.TTL_MS;
  }
}
