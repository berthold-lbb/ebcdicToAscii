models/row.model.ts (si pas déjà défini)
export interface Row {
  idTransaction: string | number;
  txAmountType?: 'credit' | 'debit' | string; // info utile mais pas obligatoire
  txAmountValue: number;                      // signé (+/-) ou non (voir note)
  matchTag?: string;
  originalClientName?: string;
  matchScore?: number;
  account?: string;
  currency?: string;
  // ...autres champs
}

recap-table.component.ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Row } from '../models/row.model';

// ⚠️ Adapte le chemin d'import vers ton lib-data-table
import { LibDataTableComponent } from 'src/app/shared/lib-data-table/lib-data-table.component';

@Component({
  selector: 'recap-table',
  standalone: true,
  imports: [CommonModule, LibDataTableComponent],
  templateUrl: './recap-table.component.html',
  styleUrls: ['./recap-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecapTableComponent {
  /** Lignes sélectionnées côté Crédit */
  @Input({ required: true }) credits: Row[] = [];
  /** Lignes sélectionnées côté Débit */
  @Input({ required: true }) debits: Row[] = [];

  /** Clé d'identifiant (si ton lib en a besoin) */
  @Input() rowIdKey: keyof Row = 'idTransaction';

  /** Colonnes pour ton lib-data-table (adapte si ton lib attend `name/label` au lieu de `field/header`) */
  columns = [
    { field: 'txAmountType', header: 'Transaction Type' },
    { field: 'txAmountValue', header: 'Amount' },
  ];

  /** Fusion (ordre: crédits puis débits) */
  get allRows(): Row[] {
    return [...(this.credits ?? []), ...(this.debits ?? [])];
  }

  /** Si tes montants NE sont PAS signés, signe-les ici via txAmountType */
  private signedAmount(r: Row): number {
    const v = Number(r.txAmountValue ?? 0);
    if (Number.isNaN(v)) return 0;
    // 👉 dé-commente si ta base stocke uniquement des valeurs positives
    // const t = (r.txAmountType ?? '').toLowerCase();
    // return t.includes('credit') || t.includes('crédit') ? -v : v;

    // 👉 sinon, si txAmountValue est déjà signé, garde simplement v :
    return v;
  }

  /** Somme générique */
  private sum(rows: Row[]): number {
    return (rows ?? []).reduce((acc, r) => acc + this.signedAmount(r), 0);
  }

  /** Totaux */
  get totalCredit(): number { return this.sum(this.credits); }
  get totalDebit(): number  { return this.sum(this.debits); }

  /** Résiduel (balance nette) */
  private readonly EPS = 0.0001;
  get residual(): number { return this.totalCredit + this.totalDebit; }
  get isBalanced(): boolean { return Math.abs(this.residual) < this.EPS; }

  /** Afficher le composant seulement si on a des sélections (option : sinon géré par le parent) */
  get hasAnySelection(): boolean {
    return (this.credits?.length ?? 0) > 0 || (this.debits?.length ?? 0) > 0;
  }
}

recap-table.component.html
<!-- Affiche uniquement si on a au moins une sélection -->
@if (hasAnySelection) {
  <!-- Tableau récap avec TON lib-data-table -->
  <lib-data-table
    [data]="allRows"
    [columns]="columns"
    [rowIdKey]="rowIdKey"
    [enableOrder]="true"
    [pageSize]="10"
    [pageSizeOptions]="[5,10,25,50]"
    [highlightSelection]="false"
    [enableRowDetail]="false">
  </lib-data-table>

  <!-- Résumé chiffré -->
  <div class="summary-cards">
    <div class="card credit">
      <div class="label">Total Crédit</div>
      <div class="value">{{ totalCredit | number:'1.2-2' }}</div>
    </div>
    <div class="card debit">
      <div class="label">Total Débit</div>
      <div class="value">{{ totalDebit  | number:'1.2-2' }}</div>
    </div>
    <div class="card residual" [class.balanced]="isBalanced" [class.unbalanced]="!isBalanced">
      <div class="label">Residual Balance</div>
      <div class="value">{{ residual | number:'1.2-2' }}</div>
    </div>
  </div>
}

recap-table.component.scss
.summary-cards {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.card {
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
  background: #fff;

  .label {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
  }
  .value {
    font-weight: 700;
    font-size: 18px;
  }
}

.card.credit .value { color: #2e7d32; }   /* vert foncé */
.card.debit  .value { color: #1565c0; }   /* bleu */
.card.residual {
  border-top: 3px solid transparent;
  &.balanced  { border-color: #008c53;  .value { color: #008c53; } }  /* vert */
  &.unbalanced{ border-color: #c62828;  .value { color: #c62828; } }  /* rouge */
}

Intégration côté Composant B

Affiche recap-table seulement si des lignes sont sélectionnées (ta demande précédente) :

<!-- composant-b.component.html -->
@if (selectedCredit().length > 0 || selectedDebit().length > 0) {
  <recap-table
    [credits]="selectedCredit()"
    [debits]="selectedDebit()"
    [rowIdKey]="'idTransaction'">
  </recap-table>
}