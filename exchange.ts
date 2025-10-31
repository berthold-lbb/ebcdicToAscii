TypeScript (component)
export class TransactionDetailsCard implements OnChanges {
  @Input() row!: MatchDto;                 // comme chez toi
  @Input() layout: 'stack' | 'grid' = 'auto';

  loading = false;
  error: string | null = null;
  items: any[] = [];

  // 👉 prédicat configurable au besoin (selon ton modèle)
  // - si tu as un champ 'side' => ('CREDIT' | 'DEBIT'), remplace par: t.side === 'CREDIT'
  // - sinon, on prend le signe du montant
  private isCredit = (t: any) => (t.side ? t.side === 'CREDIT' : Number(t.amountValue ?? t.amount) >= 0);

  get credits(): any[] { return this.items.filter(this.isCredit); }
  get debits():  any[] { return this.items.filter(t => !this.isCredit(t)); }

  get computedLayout(): 'stack' | 'grid' {
    if (this.layout !== 'auto') return this.layout;
    return this.items.length < 2 ? 'stack' : 'grid';
  }

  constructor(private transactionsService: TransactionService) {}

  ngOnChanges(): void { this.reload(); }

  reload(): void {
    const ids: number[] = this.row?.transactions ?? [];
    if (!ids?.length) { this.items = []; return; }
    this.loading = true; this.error = null;
    forkJoin(ids.map(id => this.transactionsService.getById(id))).pipe(
      map(results => results as any[]),
      catchError(err => { this.error = err?.message ?? 'Erreur inconnue'; return of<any[]>([]); }),
      finalize(() => this.loading = false),
    ).subscribe(res => this.items = res);
  }

  trackById = (_: number, t: any) => t?.id ?? _;
}

Template (Angular v17+ control flow)
<div class="details-card" [class.grid]="computedLayout==='grid'">
  @if (loading) {
    <div class="loading">
      <mat-icon>autorenew</mat-icon> <span>Chargement…</span>
    </div>
  } @else if (error) {
    <div class="error">
      <mat-icon color="warn">error</mat-icon>
      <span>Une erreur est survenue</span>
      <button mat-stroked-button color="primary" (click)="reload()">Réessayer</button>
    </div>
  } @else {
    <div class="two-columns" [class.stack]="computedLayout==='stack'">
      <!-- Colonne CRÉDITS -->
      <section class="col">
        <header class="col-header">Crédits</header>
        @if (credits.length === 0) {
          <div class="empty">Aucun crédit</div>
        } @else {
          <div class="cards">
            @for (t of credits; track trackById) {
              <app-transaction-details-card [row]="t"></app-transaction-details-card>
            }
          </div>
        }
      </section>

      <!-- Colonne DÉBITS -->
      <section class="col">
        <header class="col-header">Débits</header>
        @if (debits.length === 0) {
          <div class="empty">Aucun débit</div>
        } @else {
          <div class="cards">
            @for (t of debits; track trackById) {
              <app-transaction-details-card [row]="t"></app-transaction-details-card>
            }
          </div>
        }
      </section>
    </div>
  }
</div>

Styles (SCSS/CSS)
.details-card { width: 100%; }
.two-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  &.stack { grid-template-columns: 1fr; } // pour mobile ou layout 'stack'
}

.col { display: flex; flex-direction: column; gap: 8px; }
.col-header { font-weight: 600; opacity: .8; }
.cards { display: grid; grid-template-columns: 1fr; gap: 8px; }

.loading, .error, .empty { display: flex; align-items: center; gap: 8px; }

Variantes possibles

Material Grid List
Remplace .two-columns par <mat-grid-list [cols]="computedLayout==='grid' ? 2 : 1" rowHeight="fit"> avec deux <mat-grid-tile>, un pour «Crédits», un pour «Débits». Utile si tu veux rester full-Material.

Deux lib-data-table
Si tu préfères garder ton composant de tableau : instancie deux lib-data-table côte à côte, avec [data]="credits" et [data]="debits". Même wrapper .two-columns et tu conserves tri/pagination indépendants pour chaque côté.

Points d’attention

Prédicat crédit/débit : adapte isCredit à ton vrai modèle (side, type, signe du montant…).

Réactivité : credits/debits sont des getters basés sur items; pas de copie inutile.

Responsive : force layout='stack' depuis le parent si tu veux 1 colonne sur mobile, sinon laisse auto.

TrackBy : garde trackById pour éviter les re-renders quand tu recharges.