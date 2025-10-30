1) Modèle de colonne
// table-data.types.ts
export enum TableDataType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  AMOUNT = 'AMOUNT',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  TIME = 'TIME',
}

export interface ITableColonne<T = any> {
  nom: string;                 // clé dans l’objet
  label: string;               // titre affiché
  type: TableDataType;
  enableOrder: boolean;        // 👉 c’est CE flag qui autorise le tri sur cette colonne
  clickable?: boolean;
  retractable?: boolean;
  link?: string;
  valueGetter?: (row: T) => any;  // valeur calculée optionnelle
}

export class TableColonne<T = any> implements ITableColonne<T> {
  constructor(
    public nom: string,
    public label: string,
    public type: TableDataType = TableDataType.STRING,
    public enableOrder: boolean = true,
    public clickable: boolean = false,
    public retractable: boolean = false,
    public link: string = '',
    public valueGetter?: (row: T) => any,
  ) {}
}

2) Composant Datatable – TypeScript
// data-table.component.ts
import {
  AfterViewInit, ChangeDetectorRef, Component, Input, OnChanges, Output, EventEmitter, ViewChild
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { ITableColonne, TableColonne, TableDataType } from './table-data.types';

export interface DetailRow<T> {
  __detail: true;
  forId: string | number;
  host: T;
}

@Component({
  selector: 'lib-data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
})
export class DataTableComponent<T extends Record<string, any>> implements AfterViewInit, OnChanges {

  // ====== API publique ======
  @Input() columns: ITableColonne<T>[] = [];
  @Input() dataSource = new MatTableDataSource<T>([]);
  @Input() visibleColumns: ITableColonne<T>[] = []; // si tu en as déjà une, sinon derive de columns
  @Input() serverSide = false;

  // pagination
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50];
  @Input() total = 0;

  // tri (nouveau nom)
  @Input() enableSorting = true;

  @Output() pageChange = new EventEmitter<PageEvent>();
  @Output() sortChange = new EventEmitter<Sort>();

  @ViewChild(MatPaginator, { static: false }) paginator!: MatPaginator;
  @ViewChild(MatSort, { static: false }) sort!: MatSort;

  // état local du tri
  currentSort: Sort | null = null;

  // ====== détail ======
  @Input() expandedId: string | number | null = null;
  @Input() rowIdKey: keyof T | ((row: T) => string | number) = 'id';

  constructor(private cdr: ChangeDetectorRef) {}

  // utilitaire id
  private _rowId = (r: T): string | number =>
    typeof this.rowIdKey === 'function' ? this.rowIdKey(r) : (r[this.rowIdKey] as any);

  ngOnChanges(): void {
    // si tu relies dataSource.data ailleurs, marque la vue
    this.cdr.markForCheck();
  }

  ngAfterViewInit(): void {
    // branche MatSort uniquement si le tri est activé au niveau composant
    if (this.sort && this.enableSorting) {
      this.dataSource.sort = this.sort; // ok de le laisser si tu utilises MatTableDataSource pour filtrer
      this.sort.sortChange.subscribe(s => {
        this.onSort(s);                      // met à jour currentSort
        if (this.serverSide) this.sortChange.emit(s);
        this.expandedId = null;
        this.cdr.markForCheck();
      });
    }

    if (this.paginator) {
      this.dataSource.paginator = this.serverSide ? undefined : this.paginator;
      this.paginator.page.subscribe(p => {
        if (this.serverSide) this.pageChange.emit(p);
        this.expandedId = null;
        this.cdr.markForCheck();
      });
    }
  }

  // =========== TRI CLIENT ===========

  onSort(e: Sort) {
    // on respecte enableSorting global
    this.currentSort = (this.enableSorting && e.direction) ? e : null;
    if (!this.serverSide) this.cdr.markForCheck();
  }

  private getSortValue(item: T, prop: string): any {
    const col = this.columns.find(c => c.nom === prop);
    const raw = col?.valueGetter ? col.valueGetter(item) : (item as any)?.[prop];

    switch (col?.type) {
      case TableDataType.AMOUNT:
      case TableDataType.NUMBER:   return Number(raw) || 0;
      case TableDataType.DATE:
      case TableDataType.DATETIME: return raw ? new Date(raw).getTime() : 0;
      case TableDataType.BOOLEAN:  return raw ? 1 : 0;
      default:                     return (raw ?? '').toString().toLowerCase();
    }
  }

  private applyClientSort(rows: T[]): T[] {
    if (this.serverSide || !this.currentSort?.direction) return rows;
    const dir = this.currentSort.direction === 'asc' ? 1 : -1;
    const prop = this.currentSort.active;

    // sécurité : si la colonne n’autorise pas le tri, ignore
    const col = this.columns.find(c => c.nom === prop);
    if (!col || !col.enableOrder || !this.enableSorting) return rows;

    return [...rows].sort((a, b) => {
      const va = this.getSortValue(a, prop);
      const vb = this.getSortValue(b, prop);
      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });
  }

  // ====== Rendu final : tri -> pagination -> détail ======
  get rowsForRender(): Array<T | DetailRow<T>> {
    const baseAll: T[] = (this.dataSource.filteredData?.length
      ? this.dataSource.filteredData
      : this.dataSource.data) ?? [];

    // 1) tri
    const baseSorted = this.applyClientSort(baseAll);

    // 2) pagination client
    let pageRows = baseSorted;
    if (this.paginator && !this.serverSide) {
      const start = this.paginator.pageIndex * this.paginator.pageSize;
      pageRows = baseSorted.slice(start, start + this.paginator.pageSize);
    }

    // 3) insertion de la ligne de détail si présente
    if (this.expandedId == null) return pageRows as Array<T | DetailRow<T>>;

    const idx = pageRows.findIndex(r => this._rowId(r as T) === this.expandedId);
    if (idx === -1) return pageRows as Array<T | DetailRow<T>>;

    const host = pageRows[idx] as T;
    const out: Array<T | DetailRow<T>> = pageRows.slice(0, idx + 1);
    out.push({ __detail: true, forId: this.expandedId, host } as DetailRow<T>);
    out.push(...pageRows.slice(idx + 1));
    return out;
  }

  // helpers de type dans le template
  isDetailRow = (_: number, row: any): row is DetailRow<T> =>
    !!row && typeof row === 'object' && (row as any).__detail === true;
  isDataRow   = (_: number, row: any): row is T => !this.isDetailRow(_, row);
}

3) Template – HTML (Angular 20 @for / @if)

Seules deux choses à ajouter : matSort sur la table, et mat-sort-header + disabled sur l’en-tête.

<!-- data-table.component.html -->
<table mat-table
       [dataSource]="rowsForRender"
       class="dt-table"
       [class.dt-blurred]="loading"
       [multiTemplateDataRows]="true"
       matSort
       (matSortChange)="onSort($event)">

  <!-- Exemple : colonne de sélection éventuelle -->
  @if (selectable) {
    <ng-container matColumnDef="__select">
      <th mat-header-cell *matHeaderCellDef></th>
      <td mat-cell *matCellDef="let row"></td>
    </ng-container>
  }

  <!-- ======= EN-TÊTES dynamiques ======= -->
  @for (col of visibleColumns; track col.nom) {
    <ng-container [matColumnDef]="col.nom">
      <th mat-header-cell *matHeaderCellDef
          [mat-sort-header]="col.nom"
          [disabled]="!enableSorting || !col.enableOrder"
          [class.sticky]="stickyHeader"
          [class.is-numeric]="col.type==='AMOUNT' || col.type==='NUMBER'">
        {{ col.label }}
      </th>

      <!-- ======= CELLS (tu gardes ton switch/pipe existant) ======= -->
      <td mat-cell *matCellDef="let row"
          [class.is-numeric]="col.type==='AMOUNT' || col.type==='NUMBER'">
        @switch (col.type) {
          @case (TableDataType.AMOUNT)  { {{ (col.valueGetter ? col.valueGetter(row) : row[col.nom]) | currency:'CAD':'symbol':'1.2-2':'fr-CA' }} }
          @case (TableDataType.NUMBER)  { {{ (col.valueGetter ? col.valueGetter(row) : row[col.nom]) | number:'1.0-0':'fr-CA' }} }
          @case (TableDataType.DATE)    { {{ col.valueGetter ? col.valueGetter(row) : row[col.nom] | date:'dd/MM/yyyy':'':'fr-CA' }} }
          @case (TableDataType.DATETIME){ {{ col.valueGetter ? col.valueGetter(row) : row[col.nom] | date:'dd/MM/yyyy HH:mm:ss':'':'fr-CA' }} }
          @case (TableDataType.BOOLEAN) { {{ (col.valueGetter ? col.valueGetter(row) : row[col.nom]) ? 'Oui' : 'Non' }} }
          @default                      { {{ col.valueGetter ? col.valueGetter(row) : row[col.nom] }} }
        }
      </td>
    </ng-container>
  }

  <!-- ===== ligne de détail ===== -->
  <ng-container matColumnDef="detail">
    <td mat-cell class="detail-cell" *matCellDef="let row" [attr.colspan]="visibleColumns.length + (selectable?1:0)"
        @if="isDetailRow(0,row)">
      <ng-content select="[rowDetail]"></ng-content>
    </td>
  </ng-container>

  <!-- rows -->
  <tr mat-row *matRowDef="let row; columns: visibleColumns.map(c => c.nom)" @if="isDataRow(0,row)"></tr>
  <tr mat-row *matRowDef="let row; columns: ['detail']" @if="isDetailRow(0,row)"></tr>
</table>

<!-- paginator -->
<mat-paginator *ngIf="!serverSide"
               [length]="dataSource.filteredData?.length || dataSource.data.length || 0"
               [pageSize]="pageSize"
               [pageSizeOptions]="pageSizeOptions"
               [showFirstLastButtons]="true">
</mat-paginator>
