import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Row } from '../models/row.model';
import { LibDataTableComponent } from 'src/app/shared/lib-data-table/lib-data-table.component';

@Component({
  selector: 'recap-table',
  standalone: true,
  imports: [CommonModule, LibDataTableComponent],
  templateUrl: './recap-table.component.html',
  styleUrls: ['./recap-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecapTableComponent {
  /** colonnes pour ton lib */
  readonly columns = [
    { field: 'txAmountType', header: 'Type' },
    { field: 'txAmountValue', header: 'Montant' },
  ];

  /** états internes (références stables passées au lib) */
  allRows: Row[] = [];
  totalCredit = 0;
  totalDebit  = 0;
  residual    = 0;
  isBalanced  = false;
  hasAnySelection = false;

  private readonly EPS = 0.001;

  /** buffers des inputs (références actuelles) */
  private _credits: Row[] = [];
  private _debits: Row[] = [];

  /** setters d'Input —> recalcul immédiat et unique */
  @Input() set credits(val: Row[] | null | undefined) {
    this._credits = val ?? [];
    this.recompute();
  }
  @Input() set debits(val: Row[] | null | undefined) {
    this._debits = val ?? [];
    this.recompute();
  }

  @Input() rowIdKey: keyof Row = 'idTransaction';

  /** ----- utils ----- */
  private signedAmount(r: Row): number {
    const v = Number(r.txAmountValue ?? 0);
    if (Number.isNaN(v)) return 0;

    // Si tes montants ne sont PAS signés, décommente pour signer via le type:
    // const t = (r.txAmountType ?? '').toLowerCase();
    // return t.includes('credit') || t.includes('crédit') ? -v : v;

    return v; // s'ils sont déjà signés
  }

  private sum(rows: Row[]): number {
    let acc = 0;
    for (let i = 0; i < rows.length; i++) acc += this.signedAmount(rows[i]);
    return acc;
  }

  /** Recalcule les dérivés UNE seule fois par changement d'inputs */
  private recompute(): void {
    const c = this._credits;
    const d = this._debits;

    // ⚠️ Une SEULE nouvelle référence ici (stable pour le lib)
    this.allRows = [...c, ...d];

    this.totalCredit = this.sum(c);
    this.totalDebit  = this.sum(d);
    this.residual    = this.totalCredit + this.totalDebit;
    this.isBalanced  = Math.abs(this.residual) < this.EPS;
    this.hasAnySelection = c.length > 0 || d.length > 0;
  }
}
