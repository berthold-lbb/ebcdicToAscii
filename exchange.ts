C) Recap (simplifié, sans @if interne, on délègue au parent)
// recap-table.component.ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Row } from '../models/row.model';
import { LibDataTableComponent } from 'src/app/shared/lib-data-table/lib-data-table.component';

@Component({
  selector: 'recap-table',
  standalone: true,
  imports: [CommonModule, LibDataTableComponent],
  templateUrl: './recap-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecapTableComponent {
  @Input() credits: Row[] = [];
  @Input() debits: Row[] = [];
  @Input() rowIdKey: keyof Row = 'idTransaction';

  readonly columns = [
    { field: 'txAmountType', header: 'Type' },
    { field: 'txAmountValue', header: 'Montant' },
  ];

  get allRows(): Row[] { return [...this.credits, ...this.debits]; }
  get totalCredit(): number { return this.credits.reduce((a,r)=>a+Number(r.txAmountValue||0),0); }
  get totalDebit(): number  { return this.debits.reduce((a,r)=>a+Number(r.txAmountValue||0),0); }
  get residual(): number { return this.totalCredit + this.totalDebit; }
  get isBalanced(): boolean { return Math.abs(this.residual) < 0.001; }
}

<!-- recap-table.component.html -->
<lib-data-table
  [data]="allRows"
  [columns]="columns"
  [rowIdKey]="rowIdKey"
  [highlightSelection]="false"
  [enableOrder]="true"
  [pageSize]="5"
  [pageSizeOptions]="[5,10,25]"
  [enableRowDetail]="false">
</lib-data-table>

<div style="margin-top:10px; border-top:2px solid #ddd; padding-top:6px;">
  <div style="display:flex; justify-content:space-between">
    <span>Total Crédit :</span>
    <strong>{{ totalCredit | number:'1.2-2' }}</strong>
  </div>
  <div style="display:flex; justify-content:space-between">
    <span>Total Débit :</span>
    <strong>{{ totalDebit | number:'1.2-2' }}</strong>
  </div>
  <div style="display:flex; justify-content:space-between; font-weight:700;"
       [style.color]="isBalanced ? '#008c53' : '#c62828'">
    <span>Résiduel :</span>
    <span>{{ residual | number:'1.2-2' }}</span>
  </div>
</div>

--------
<!-- Afficher le recap SEULEMENT si sélection -->
@if (showRecap()) {
  <recap-table
    [credits]="selectedCredit()"
    [debits]="selectedDebit()"
    [rowIdKey]="'idTransaction'">
  </recap-table>
}


showRecap = computed(
    () => this.selectedCredit().length > 0 || this.selectedDebit().length > 0
  );