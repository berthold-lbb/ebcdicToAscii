import { AfterViewInit, Component, Input, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';

export enum TableDataType { STRING=0, NUMBER=1, BOOLEAN=2, DATE=3, DATETIME=4, TIME=5, JSON=6, OBJECT=7, LINK=8 }
export interface ITableColonne {
  nom: string;
  label: string;
  type: TableDataType;
  enableOrder: boolean;
  retractable: boolean;
  link?: any;
}

@Component({
  selector: 'lib-data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent<T> implements AfterViewInit {
  TableDataType = TableDataType;

  @Input() set data(value: T[] | null | undefined) { this.dataSource.data = value ?? []; }
  @Input() set columns(value: ITableColonne[] | null | undefined) {
    this._columns = (value ?? []).map(c => ({ ...c }));
    this.recomputeVisible();
  }
  @Input() set hiddenColumns(v: string[] | null | undefined) {
    this._hidden = new Set((v ?? []).filter(Boolean));
    this.recomputeVisible();
  }

  /** Loader principal (overlay) */
  @Input() loading = false;
  /** Afficher un mini spinner dans chaque th en plus de l’overlay */
  @Input() showHeaderSpinner = false;

  /** Tri global (et par colonne via col.enableOrder) */
  @Input() enableOrder = false;

  dataSource = new MatTableDataSource<T>([]);
  displayedColumns: string[] = [];
  visibleColumnDefs: ITableColonne[] = [];

  private _columns: ITableColonne[] = [];
  private _hidden = new Set<string>();

  @ViewChild(MatSort) sort!: MatSort;
  ngAfterViewInit() { if (this.sort) this.dataSource.sort = this.sort; }

  trackByCol = (_: number, c: ITableColonne) => c.nom;

  private isHidden(col: ITableColonne): boolean {
    if (!col.retractable) return false;
    return this._hidden.has(col.nom);
  }
  private recomputeVisible() {
    this.visibleColumnDefs = this._columns.filter(c => !this.isHidden(c));
    this.displayedColumns = this.visibleColumnDefs.map(c => c.nom);
  }
}




// Example of usage of loading and rows
import { finalize } from 'rxjs/operators';
loading = false;
rows: any[] = [];

load() {
  this.loading = true;
  this.creditService.getCredits(payload)
    .pipe(finalize(() => this.loading = false))
    .subscribe(resp => {
      this.rows = Array.isArray(resp?.content) ? [...resp.content] : [];
    });