Voici une version qui rafraîchit immédiatement, annule la requête en cours, et notifie OnPush :

import { ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject, of } from 'rxjs';
import { map, distinctUntilChanged, switchMap, catchError, finalize } from 'rxjs/operators';

@Component({
  // ...
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionDetailsCard {
  private reload$ = new Subject<number[]>();
  items: any[] = [];
  loading = false;
  error: string | null = null;

  constructor(private tx: TransactionDetailsService, private cdr: ChangeDetectorRef) {}

  // à appeler quand les ids changent (ngOnChanges) ou via un bouton
  triggerReload(ids: number[]) { this.reload$.next(ids ?? []); }

  ngOnInit() {
    this.reload$
      .pipe(
        // clé stable sans délai pour démarrer immédiatement
        map(ids => Array.from(new Set(ids)).join(',')),
        distinctUntilChanged(),

        // 👉 démarre tout de suite et ANNULE l'appel précédent si on re-clique
        switchMap(key => {
          const ids = key ? key.split(',').map(Number) : [];
          if (!ids.length) return of([] as any[]);

          this.loading = true; this.error = null;
          this.cdr.markForCheck();                    // notifie OnPush

          return this.tx.getMany(ids).pipe(
            catchError(err => { this.error = err?.message ?? 'Erreur'; return of([] as any[]); }),
            finalize(() => { this.loading = false; this.cdr.markForCheck(); })
          );
        })
      )
      .subscribe(results => {
        // ⚠️ re-crée la référence pour OnPush
        this.items = [...results];
        this.cdr.markForCheck();
      });
  }
}

Dans ngOnChanges
ngOnChanges(ch: SimpleChanges) {
  if (ch['row']) {
    const prev = (ch['row'].previousValue?.transactions ?? []).join(',');
    const curr = (ch['row'].currentValue?.transactions ?? []).join(',');
    if (curr && prev !== curr) this.triggerReload(this.row.transactions);
  }
}