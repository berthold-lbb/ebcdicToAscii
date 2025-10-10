import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

/**
 * Service d’exemple – remplace par TON service réel.
 * Il doit exposer une méthode getById(id) -> Observable<any>
 */
export abstract class DetailApi {
  abstract getById(id: string | number): Observable<any>;
}

@Component({
  selector: 'app-transaction-details-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './transaction-details-card.component.html',
  styleUrls: ['./transaction-details-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionDetailsCardComponent implements OnChanges {
  /** La ligne hôte reçue depuis le rowDetailTemplate du DataTable */
  @Input({ required: true }) row!: any;

  /**
   * Où trouver la liste des IDs dans la row ?
   * ex: row['relatedIds'] -> [233, 234]  OU  row['ids'] -> [...]
   */
  @Input() idsKey: string = 'relatedIds';

  /** Disposition souhaitée : 'stack' (3), 'grid' (4) ou 'auto' */
  @Input() layout: 'stack' | 'grid' | 'auto' = 'auto';

  /** Service à utiliser (si tu veux l’injecter directement ici) */
  constructor(private api: DetailApi) {}

  // === état affiché dans le template
  loading = false;
  error: any = null;
  items: any[] = [];

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['row']) {
      this.load();
    }
  }

  /** Décide pile vs grille : si 'auto', 1–2 items -> grid, sinon stack */
  get computedLayout(): 'stack' | 'grid' {
    if (this.layout === 'stack' || this.layout === 'grid') return this.layout;
    const n = this.items?.length ?? 0;
    return n <= 2 ? 'grid' : 'stack';
  }

  /** Recharge manuel (bouton Réessayer) */
  reload() {
    this.load();
  }

  private load() {
    this.loading = true;
    this.error = null;
    this.items = [];

    const ids: Array<string | number> = Array.isArray(this.row?.[this.idsKey])
      ? this.row[this.idsKey]
      : [];

    if (!ids.length) {
      // Rien à charger : on laisse une carte “vide” ou rien du tout.
      this.loading = false;
      this.items = [];
      return;
    }

    // Plusieurs appels en parallèle pour chaque id
    forkJoin(ids.map(id => this.api.getById(id)))
      .pipe(
        map(results => results as any[]),
        catchError(err => {
          this.error = err;
          return of<any[]>([]);
        })
      )
      .subscribe(results => {
        this.items = results;
        this.loading = false;
      });
  }
}
------------------------------
<div class="detail-card" [class.grid]="computedLayout === 'grid'">
  <!-- LOADING -->
  <div class="detail-loading" *ngIf="loading">
    <mat-icon class="spin">autorenew</mat-icon>
    <span>Chargement…</span>
  </div>

  <!-- ERROR -->
  <div class="detail-error" *ngIf="!loading && error">
    <mat-icon color="warn">error</mat-icon>
    <span>Une erreur est survenue.</span>
    <button mat-stroked-button color="primary" (click)="reload()">Réessayer</button>
  </div>

  <!-- CONTENT -->
  <div class="detail-body" *ngIf="!loading && !error">
    <!-- Grille ou pile selon computedLayout -->
    <mat-card class="detail-item" *ngFor="let it of items">
      <mat-card-title>{{ it?.title || it?.name || 'Item' }}</mat-card-title>
      <mat-card-content><pre>{{ it | json }}</pre></mat-card-content>
    </mat-card>

    <!-- Cas où il n’y a rien à afficher -->
    <div class="empty" *ngIf="items.length === 0">
      <mat-icon>info</mat-icon>
      <span>Aucune donnée à afficher</span>
    </div>
  </div>
</div>
------------------------------
.detail-card {
  margin: 8px 10px 12px 28px;  /* décalage vers la droite = enfant visuel */
  padding: 12px;
  background: rgba(0,0,0,.03);
  border: 1px solid #e6e6e6;
  border-radius: 10px;
}

.detail-card.grid .detail-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(260px, 1fr));
  gap: 12px;
}
.detail-card:not(.grid) .detail-body {
  display: block;
}

.detail-item {
  border: 1px solid #e6e6e6;
  border-left: 4px solid #2e7d32; /* lien visuel avec la row parent */
  border-radius: 8px;
}

.detail-loading, .detail-error, .empty {
  display: flex; align-items: center; gap: 8px;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
-------------------------------
<lib-data-table
  [data]="dataSource"
  [columns]="columns"
  [rowDetailTemplate]="detailTpl"  <!-- très important -->
  [enableRowDetail]="true">
</lib-data-table>

<!-- Le DataTable te passe 'row' dans le contexte -->
<ng-template #detailTpl let-row>
  <!-- Tu peux choisir l’input idsKey et la disposition -->
  <app-transaction-details-card
    [row]="row"
    idsKey="relatedIds"
    layout="auto">
  </app-transaction-details-card>
</ng-template>
