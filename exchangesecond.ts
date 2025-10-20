transactions-combined.component.ts
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { merge, Subject, forkJoin, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';

// ⚙️ Modèles simples — tu peux les extraire dans un fichier models.ts
export interface Tx {
  idTransaction: string;
  date: string;          // ISO string
  description?: string;
  amount: number;
  account?: string;
}
export type CombinedTx = Tx & { transactionType: 'CREDIT' | 'DEBIT' };

export interface SearchFormValue {
  startDate: Date | null;
  endDate: Date | null;
  matchTag: string | null;
  matchAccount: string | null;
  matchingStatus: 'NoMatched' | 'Matched';
  limit: number;
  offset: number;
}

@Component({
  standalone: true,
  selector: 'app-transactions-combined',
  imports: [],
  templateUrl: './transactions-combined.component.html',
})
export class TransactionsCombinedComponent {
  // ———————————————————————
  // état UI
  loading = false;
  rows: CombinedTx[] = [];
  total = 0;

  // colonnes pour ton datatable
  columns = [
    { name: 'transactionType', label: 'Type', type: 'STRING' },
    { name: 'date', label: 'Date', type: 'DATE', enableOrder: true },
    { name: 'description', label: 'Description', type: 'STRING' },
    { name: 'amount', label: 'Amount', type: 'AMOUNT', enableOrder: true },
    { name: 'account', label: 'Account', type: 'STRING' },
  ];

  // ———————————————————————
  // deux flux : auto & manuel
  private autoSearch$ = new Subject<SearchFormValue>();
  private manualSearch$ = new Subject<SearchFormValue>();

  constructor(private http: HttpClient) {}

  ngOnInit() {
    // 🔁 combine auto (avec délai) + manuel (immédiat)
    merge(
      this.autoSearch$.pipe(
        debounceTime(600),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
      ),
      this.manualSearch$
    )
      .pipe(
        tap(() => (this.loading = true)),
        switchMap((f) =>
          this.loadTransactions(f).pipe(finalize(() => (this.loading = false)))
        )
      )
      .subscribe((merged) => {
        this.rows = merged;
        this.total = merged.length;
      });
  }

  // ———————————————————————
  // ⚡ Déclenché par clic "Search"
  onSearchManual(f: SearchFormValue) {
    this.manualSearch$.next(f);
  }

  // ⏳ Déclenché automatiquement (changement de formulaire)
  onAutoChange(f: SearchFormValue) {
    this.autoSearch$.next(f);
  }

  // ———————————————————————
  // Chargement combiné crédit + débit
  private loadTransactions(f: SearchFormValue) {
    const payload = this.toPayload(f);

    const credits$ = this.getCredits(payload).pipe(
      map((p: Tx[]) => p.map((r) => ({ ...r, transactionType: 'CREDIT' as const })))
    );

    const debits$ = this.getDebits(payload).pipe(
      map((p: Tx[]) => p.map((r) => ({ ...r, transactionType: 'DEBIT' as const })))
    );

    return forkJoin([credits$, debits$]).pipe(
      map(([c, d]) =>
        [...c, ...d].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      ),
      catchError(() => of<CombinedTx[]>([]))
    );
  }

  // ———————————————————————
  private getCredits(payload: any) {
    return this.http.post<Tx[]>('/api/credits/search', payload);
  }

  private getDebits(payload: any) {
    return this.http.post<Tx[]>('/api/debits/search', payload);
  }

  private toPayload(f: SearchFormValue) {
    return {
      startDate: f.startDate,
      endDate: f.endDate,
      matchTag: f.matchTag,
      matchAccount: f.matchAccount,
      matchingStatus: f.matchingStatus,
      limit: f.limit,
      offset: f.offset,
    };
  }
}

🧩 transactions-combined.component.html
<!-- Barre de recherche -->
<app-transactions-search
  [disabled]="loading"
  (search)="onSearchManual($event)"
  (autoChange)="onAutoChange($event)">
</app-transactions-search>

<!-- Tableau combiné -->
<section class="card">
  <div class="header">
    <h3>Toutes les transactions ({{ total }})</h3>
    <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>
  </div>

  <lib-data-table
    [data]="rows"
    [columns]="columns"
    [loading]="loading"
    [rowIdKey]="'idTransaction'"
    [pageSize]="25"
    [pageSizeOptions]="[25, 50, 100]">
  </lib-data-table>
</section>

<style>
  .card {
    margin-top: 12px;
    background: #fff;
    border-radius: 8px;
    padding: 8px 12px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
</style>