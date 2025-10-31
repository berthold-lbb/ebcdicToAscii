Composant — version “drop-in”
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { Subject, of } from 'rxjs';
import { debounceTime, map, distinctUntilChanged, switchMap, exhaustMap, tap, catchError, takeUntil, filter } from 'rxjs/operators';
import { TransactionDetailsService } from './transaction-details.service';

type Tx = any;

@Component({
  selector: 'app-transaction-details-card',
  templateUrl: './transaction-details-card.html',
  styleUrls: ['./transaction-details-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionDetailsCard implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) row!: { transactions: number[] };

  items: Tx[] = [];
  loading = false;
  error: string | null = null;

  private reload$  = new Subject<number[]>();
  private destroy$ = new Subject<void>();

  constructor(private tx: TransactionDetailsService) {}

  /** ---- RELOAD PIPELINE ---- */
  ngOnInit(): void {
    this.reload$
      .pipe(
        debounceTime(120),                                // lisse double-clics
        map(ids => Array.from(new Set(ids ?? []))),       // déduplique
        filter(ids => ids.length > 0),                    // ignore vide
        map(ids => ids.join(',')),                        // clé stable
        distinctUntilChanged(),                           // évite re-charges identiques
        tap(() => { this.loading = true; this.error = null; }),

        // 👉 Choisis ta stratégie :
        // 1) exhaustMap = ignore les nouvelles demandes tant que la précédente n’est pas finie
        exhaustMap(key =>
          this.tx.getMany(key.split(',').map(Number)).pipe(
            catchError(err => { this.error = err?.message ?? 'Erreur inconnue'; return of([] as Tx[]); })
          )
        ),
        // 2) (Alternative) switchMap = annule la précédente pour garder la plus récente
        // switchMap(key => this.tx.getMany(key.split(',').map(Number)).pipe(
        //   catchError(err => { this.error = err?.message ?? 'Erreur inconnue'; return of([] as Tx[]); })
        // )),

        takeUntil(this.destroy$)
      )
      .subscribe(results => {
        this.items = results;
        this.loading = false;
      });

    // premier affichage si l'input est déjà là
    if (this.row?.transactions?.length) this.reload$.next(this.row.transactions);
  }

  /** ---- TRIGGER venant d’un bouton "Recharger" ---- */
  reload(): void {
    this.reload$.next(this.row?.transactions ?? []);
  }

  /** ---- Ne pousse que si la liste d’IDs a réellement changé ---- */
  ngOnChanges(ch: SimpleChanges): void {
    if (ch['row']) {
      const prev = (ch['row'].previousValue?.transactions ?? []).join(',');
      const curr = (ch['row'].currentValue?.transactions ?? []).join(',');
      if (curr && prev !== curr) this.reload$.next(this.row.transactions);
    }
  }

  /** ---- Nettoyage ---- */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** ---- Helpers d’affichage ---- */
  private isCredit = (t: Tx) => t?.side ? t.side === 'CREDIT' : Number(t?.xAmountValue ?? t?.amount) >= 0;
  get credits(): Tx[] { return this.items.filter(this.isCredit); }
  get debits():  Tx[] { return this.items.filter(t => !this.isCredit(t)); }

  get computedLayout(): 'grid'|'stack' {
    return (this.items?.length ?? 0) < 2 ? 'stack' : 'grid';
  }

  trackById(index: number, item: Tx): string|number {
    // Clé unique et stable même si ids en double
    const side = item?.side ?? (this.isCredit(item) ? 'C' : 'D');
    return item?.id != null ? `${side}:${item.id}` : `${side}:idx:${index}`;
  }
}
