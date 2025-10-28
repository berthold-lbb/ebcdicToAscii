2) Code – côté parent (Worktable / container)
2.1. Types
type Origin = 'auto' | 'manual';

interface SearchEvt {
  origin: Origin;
  form: SearchFormValue; // ton type existant
}

2.2. Subjects existants, inchangés
readonly autoSearch$   = new Subject<SearchFormValue>();
readonly manualSearch$ = new Subject<SearchFormValue>();

2.3. Handlers utilisés dans le template parent
onAutoSearchChange(f: SearchFormValue) {
  this.autoSearch$.next(f);
}

onManualSearchChange(f: SearchFormValue) {
  this.manualSearch$.next(f);
}

2.4. Pipeline de recherche “tagué”

Remplace ton merge/switchMap actuel par ceci (ou adapte les noms pour coller à ton fichier).

import { merge, map, debounceTime, distinctUntilChanged, switchMap, tap, finalize } from 'rxjs';

const deepEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

// on tague les sources
const auto$ = this.autoSearch$.pipe(
  debounceTime(600),
  map(form => ({ origin: 'auto' as const, form: { ...form } })) // clone = ref neuve
);

const manual$ = this.manualSearch$.pipe(
  map(form => ({ origin: 'manual' as const, form: { ...form } }))
);

// on fusionne, puis on déduplique UNIQUEMENT les autos
merge(auto$, manual$).pipe(
  distinctUntilChanged((prev, curr) =>
    prev.origin === 'auto' &&
    curr.origin === 'auto' &&
    deepEqual(prev.form, curr.form)
  ),
  tap(() => this.transactionLoading = true),
  switchMap(({ form }) =>
    this.loadTransactions(form).pipe(
      finalize(() => this.transactionLoading = false)
    )
  )
).subscribe(rows => {
  this.rows = rows;
});

2.5. Template parent (extrait)
<app-transactions-search
  [disabled]="transactionLoading"
  (search)="onManualSearchChange($event)"            <!-- manuel -->
  (autoChange)="onAutoSearchChange($event)"          <!-- auto -->
  (matchModeChange)="onMatchModeChange($event)"
  (rangeReady)="onRangeTransactionReady($event)">
</app-transactions-search>


Tu ne changes rien au contrat (search) et (autoChange). La logique de déduplication est centralisée ici.

3) Code – côté enfant (TransactionsSearch)
3.1. Méthode submit() sûre (sans nonce, sans changer l’API)

On garantit que l’émission arrive après la propagation des valeurs.

import { filter, take } from 'rxjs';

submit(): void {
  this.form.updateValueAndValidity({ emitEvent: true });

  // si validators async → attendre la fin du PENDING
  if (this.form.pending) {
    this.form.statusChanges
      .pipe(filter(s => s !== 'PENDING'), take(1))
      .subscribe(() => this.submit());
    return;
  }

  queueMicrotask(() => {
    if (this.form.invalid || this.disabled) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = { ...this.form.getRawValue() }; // ref neuve
    this.search.emit(payload);                      // -> manuel
  });
}


Si tu as déjà un onAutoChange() qui émet autoChange, ne touche pas—garde tel quel.

4) Appeler submit() via @ViewChild (parent)
@ViewChild(TransactionsSearch) searchTransactionsComponent!: TransactionsSearch;

constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

triggerSearchProgrammatically(): void {
  // Décale d’un micro-tick + ré-entre dans la Zone Angular
  queueMicrotask(() => {
    this.ngZone.run(() => {
      this.searchTransactionsComponent.submit();
      this.cdr.markForCheck(); // utile si OnPush en amont
    });
  });
}
----------------------------------------------------------------
-----------------------------------------------------------------

unMatcherTransactions(): void {
  if (this.transactionLoading) return;

  const ids = this.selectedFromTable.map(t => t.idTransaction);
  if (!ids.length) return;

  this.transactionLoading = true;                // ON

  const sub = this.worktableService.unMatchBatch(ids).subscribe({
    next: (msg: string) => {
      this.log.success(`Désassociation terminée : ${msg}`);
      // Lancer la recherche APRÈS que [disabled] ait été recalculé :
      queueMicrotask(() => this.searchTransactionsComponent.submit('unmatch'));
      this.tableTransactionsComponent.clearSelection();
    },
    error: (err) => {
      this.log.error(`Erreur lors de la désassociation : ${err?.message ?? err}`);
    },
    complete: () => {
      // si l’Observable complète (delete/POST single shot), pas obligatoire mais OK
    }
  });

  // cleanup *toujours* exécuté (succès, erreur ou unsubscribe)
  sub.add(() => {
    this.transactionLoading = false;             // OFF
    // si ton parent est en OnPush ET que le template lit [disabled],
    // décommente la ligne suivante :
    // this.cdr.markForCheck();
  });
}
Même pattern pour saveMatch :