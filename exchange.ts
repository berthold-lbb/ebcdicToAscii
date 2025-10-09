import {
  AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter,
  Input, OnChanges, Output, SimpleChanges, TemplateRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SelectionModel } from '@angular/cdk/collections';

import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs/operators';

export enum TableDataType { STRING, NUMBER, BOOLEAN, DATE, DATETIME, TIME, JSON, OBJECT, LINK }
export interface ITableColonne {
  nom: string;
  label: string;
  type: TableDataType;
  enableOrder: boolean;
  retractable: boolean;
  link?: any;
  clickable?: boolean;
}

type IdType = string | number;
interface DetailRow { __detail: true; forId: IdType; host: any; }

@Component({
  selector: 'lib-data-table',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatCheckboxModule, MatFormFieldModule, MatInputModule,
    MatIconModule, MatMenuModule, MatButtonModule, MatTooltipModule,
    MatProgressSpinnerModule, MatProgressBarModule,
    ReactiveFormsModule
  ],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent<T extends Record<string, any>>
  implements AfterViewInit, OnChanges {

  protected readonly TableDataType = TableDataType;

  // ===== Données & colonnes =====
  private _columns: ITableColonne[] = [];
  private _hidden = new Set<string>();

  dataSource = new MatTableDataSource<T>([]);
  visibleColumnDefs: ITableColonne[] = [];
  displayedColumns: string[] = [];

  @Input() set data(value: T[] | null | undefined) {
    const arr = value ?? [];
    this._ensureStableIds(arr);
    this.dataSource.data = arr;
    if (!this.serverSide) this._updateClientLength();
  }
  @Input() set columns(value: ITableColonne[] | null | undefined) {
    this._columns = (value ?? []).map(c => ({ ...c }));
    this._recomputeVisible();
  }
  @Input() set hiddenColumns(value: string[] | null | undefined) {
    this._hidden = new Set((value ?? []).filter(Boolean));
    this._recomputeVisible();
    this.hiddenColumnsChange.emit([...this._hidden]);
  }
  @Output() hiddenColumnsChange = new EventEmitter<string[]>();
  @Input() showColumnRetractable = true;

  // ===== Sélection =====
  @Input() selectable = true;
  @Input() selectionMode: 'single'|'multiple' = 'multiple';
  private selection = new SelectionModel<T>(true, []);

  @Input()  selectedRows: T[] = [];
  @Output() selectedRowsChange = new EventEmitter<T[]>();
  @Output() selectionChange = new EventEmitter<T[]>();

  // ===== Tri & Pagination =====
  @Input() enableOrder = true;
  @Input() serverSide = false;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [5,10,25,50];
  @Input() total = 0;     // pour serverSide
  autoLength = 0;         // pour clientSide

  @Output() pageChange = new EventEmitter<PageEvent>();
  @Output() sortChange = new EventEmitter<Sort>();

  // ===== Recherche =====
  @Input() searchable = true;
  @Input() filterPlaceholder = 'Search…';
  @Input() filterKeys: string[] = [];
  @Output() filterChange = new EventEmitter<string>();
  searchCtrl = new FormControl<string>('', { nonNullable: true });

  // ===== UI / loader & highlight =====
  @Input() stickyHeader = true;
  @Input() loading = false;
  @Input() loadingText: string | null = null;
  @Input() showTopBarWhileLoading = true;

  @Input() highlightSelection = false;
  @Input() highlightColor: string = '#E6F4EA';
  @Input() highlightBarColor: string = '#2E7D32';

  // ===== Cellule cliquable =====
  @Output() cellClick = new EventEmitter<{ row: T; column: ITableColonne }>();
  onCellClick(ev: MouseEvent, row: T, col: ITableColonne) {
    ev.stopPropagation();
    this.cellClick.emit({ row, column: col });
  }

  // ===== Détail de ligne (sans loader API ici) =====
  @Input() rowIdKey?: keyof T;                 // optionnel si tu as une vraie clé
  @Input() rowDetailTemplate?: TemplateRef<any>; // si absent => fallback JSON

  expandedId: IdType | null = null;            // id de la ligne ouverte

  onRowDblClick(row: T): void {
    const id = this._rowId(row);
    this.expandedId = (this.expandedId === id) ? null : id;
  }

  /** Tableau rendu : base paginée + éventuelle ligne de détail (avec host) */
  get rowsForRender(): Array<T|DetailRow> {
    const baseAll = this.dataSource.filteredData?.length
      ? this.dataSource.filteredData
      : (this.dataSource.data ?? []);

    // pagination client : découpe avant d’injecter le détail
    let pageRows = baseAll;
    if (this.paginator && !this.serverSide) {
      const start = this.paginator.pageIndex * this.paginator.pageSize;
      pageRows = baseAll.slice(start, start + this.paginator.pageSize);
    }

    if (this.expandedId == null) return pageRows;

    const idx = pageRows.findIndex(r => this._rowId(r) === this.expandedId);
    if (idx === -1) return pageRows; // détail hors page courante => rien à insérer

    const host = pageRows[idx];
    const res: Array<T|DetailRow> = pageRows.slice(0, idx + 1);
    res.push({ __detail: true, forId: this.expandedId, host });
    res.push(...pageRows.slice(idx + 1));
    return res;
  }

  /** predicate pour MatTable (ligne “détail” ) */
  isDetailRow = (_i: number, row: T | DetailRow) =>
    (row as any)?.__detail === true;

  // ===== Mat refs =====
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // ===== ids stables si pas de rowIdKey =====
  private _ids = new WeakMap<T, number>();
  private _seq = 1;
  private _ensureStableIds(rows: T[]) {
    if (this.rowIdKey) return;
    for (const r of rows) if (!this._ids.has(r)) this._ids.set(r, this._seq++);
    // si la ligne ouverte a disparu, on la ferme
    if (this.expandedId != null && !rows.some(r => this._rowId(r) === this.expandedId)) {
      this.expandedId = null;
    }
  }

  // ✅ Correctif #1 : _rowId tolérant
  private _rowId(row: T): IdType {
    if (this.rowIdKey && row && (row as any)[this.rowIdKey] != null) {
      return (row as any)[this.rowIdKey] as IdType;
    }
    const id = this._ids.get(row as T);
    if (id != null) return id;
    const next = this._seq++;
    this._ids.set(row as T, next);
    return next;
  }

  // ===== ctor =====
  constructor() {
    // search
    this.searchCtrl.valueChanges
      .pipe(startWith(''), debounceTime(300), distinctUntilChanged())
      .subscribe(q => {
        const query = (q ?? '').trim();
        if (this.serverSide) this.filterChange.emit(query);
        else this._applyClientFilter(query);
      });

    // filtre client
    this.dataSource.filterPredicate = (row: T, filter: string) => {
      const q = (filter || '').toLowerCase();
      const keys = (this.filterKeys?.length ? this.filterKeys : Object.keys(row));
      for (const k of keys) {
        const v = row[k];
        if (v == null) continue;
        const s = (typeof v === 'object') ? JSON.stringify(v) : String(v);
        if (s.toLowerCase().includes(q)) return true;
      }
      return false;
    };
  }

  // ===== Hooks =====
  ngOnChanges(ch: SimpleChanges): void {
    if (ch['selectionMode']) {
      const multi = this.selectionMode !== 'single';
      if (this.selection.isMultipleSelection() !== multi) {
        this.selection = new SelectionModel<T>(multi, this.selection.selected);
      }
    }
    if (ch['selectedRows']) {
      const multi = this.selectionMode !== 'single';
      if (this.selection.isMultipleSelection() !== multi) {
        this.selection = new SelectionModel<T>(multi, []);
      }
      this.selection.clear();
      (this.selectedRows ?? []).forEach(r => this.selection.select(r));
    }
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.dataSource.sort = this.sort;
      this.sort.sortChange.subscribe(s => {
        if (this.serverSide) this.sortChange.emit(s);
        this.expandedId = null;                 // ferme le détail au tri
      });
    }
    if (this.paginator) {
      // IMPORTANT : on ne branche PAS dataSource.paginator (on pagine nous-mêmes)
      if (this.serverSide) {
        this.paginator.page.subscribe(p => this.pageChange.emit(p));
      } else {
        this.paginator.page.subscribe(() => this.expandedId = null); // ferme au changement de page
      }
    }
  }

  // ===== Sélection =====
  isSelected = (row: T) => this.selection.isSelected(row);

  isAllSelected(): boolean {
    const rows = this._currentPageRows();
    return rows.length > 0 && rows.every(r => this.selection.isSelected(r));
  }
  masterToggle(): void {
    const rows = this._currentPageRows();
    if (this.isAllSelected()) rows.forEach(r => this.selection.deselect(r));
    else rows.forEach(r => this.selection.select(r));
    this._emitSelection();
  }
  toggleRow(row: T): void {
    if (this.selectionMode === 'single') {
      this.selection.clear();
      this.selection.select(row);
    } else {
      this.selection.toggle(row);
    }
    this._emitSelection();
  }
  checkboxLabel(row?: T): string {
    if (!row) return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row`;
  }
  private _emitSelection(): void {
    this.selectedRows = this.selection.selected;
    this.selectedRowsChange.emit(this.selectedRows);
    this.selectionChange.emit(this.selectedRows);
  }

  // ===== Colonnes visibles =====
  trackByCol = (_: number, c: ITableColonne) => c.nom;
  isHidden = (col: ITableColonne) => col.retractable && this._hidden.has(col.nom);
  toggleColumn(col: ITableColonne): void {
    if (!col.retractable) return;
    if (this._hidden.has(col.nom)) this._hidden.delete(col.nom);
    else this._hidden.add(col.nom);
    this._recomputeVisible();
    this.hiddenColumnsChange.emit([...this._hidden]);
  }
  private _recomputeVisible(): void {
    this.visibleColumnDefs = this._columns.filter(c => !this.isHidden(c));
    this.displayedColumns = this.visibleColumnDefs.map(c => c.nom);
    if (this.selectable && !this.displayedColumns.includes('select')) {
      this.displayedColumns = ['select', ...this.displayedColumns];
    }
    if (!this.selectable) {
      this.displayedColumns = this.displayedColumns.filter(c => c !== 'select');
    }
  }

  // ===== Filtre & pagination client =====
  private _applyClientFilter(query: string) {
    this.dataSource.filter = query.trim().toLowerCase();
    if (this.paginator && !this.serverSide) this.paginator.firstPage();
    this._updateClientLength();
    // si la ligne ouverte sort du résultat filtré => fermer
    const base = this.dataSource.filteredData ?? this.dataSource.data ?? [];
    if (this.expandedId != null && !base.some(r => this._rowId(r) === this.expandedId)) {
      this.expandedId = null;
    }
  }
  private _updateClientLength() {
    this.autoLength = this.dataSource.filteredData?.length ?? this.dataSource.data?.length ?? 0;
  }
  private _currentPageRows(): T[] {
    const base = this.dataSource.filteredData?.length
      ? this.dataSource.filteredData
      : (this.dataSource.data ?? []);
    if (!this.paginator || this.serverSide) return base;
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return base.slice(start, start + this.paginator.pageSize);
  }
}
-----------------------------------------------------------------------------

<!-- Toolbar et recherche : garde ta version si tu en as une -->

<table mat-table
       [dataSource]="rowsForRender"
       class="mat-elevation-z2 dt-table"
       [multiTemplateDataRows]="true"
       matSort>

  <!-- Exemple de colonne sélection si tu l'utilises, sinon retire-la -->
  @if (selectable) {
    <ng-container matColumnDef="select">
      <th mat-header-cell *matHeaderCellDef class="col-select" [class.sticky]="stickyHeader">
        <mat-checkbox
          (change)="masterToggle()"
          [checked]="isAllSelected()"
          [indeterminate]="selection.hasValue() && !isAllSelected()"
          [aria-label]="checkboxLabel()">
        </mat-checkbox>
      </th>
      <td mat-cell *matCellDef="let row" class="col-select" @if="!(row as any)?.__detail">
        <mat-checkbox
          (click)="$event.stopPropagation()"
          (change)="toggleRow(row)"
          [checked]="isSelected(row)"
          [aria-label]="checkboxLabel(row)">
        </mat-checkbox>
      </td>
    </ng-container>
  }

  <!-- Colonnes dynamiques -->
  @for (col of visibleColumnDefs; track col.nom) {
    <ng-container [matColumnDef]="col.nom">
      <th mat-header-cell *matHeaderCellDef mat-sort-header
          [disabled]="!(enableOrder && col.enableOrder)"
          [class.sticky]="stickyHeader">
        {{ col.label }}
      </th>

      <!-- ✅ Correctif #3 : garde pour éviter d'évaluer sur la ligne de détail -->
      <td mat-cell *matCellDef="let row" class="data-table-colonne-{{ col.nom }}" @if="!(row as any)?.__detail"
          [class.cell-clickable]="col.clickable"
          (click)="col.clickable && onCellClick($event, row, col)">
        {{ row[col.nom] }}
      </td>
    </ng-container>
  }

  <!-- Lignes “données” (double-clic pour ouvrir/fermer le détail) -->
  <tr mat-row *matRowDef="let row; columns: displayedColumns"
      class="clickable-row"
      (dblclick)="onRowDblClick(row)">
  </tr>

  <!-- Colonne technique : détail (pas dans displayedColumns) -->
  <ng-container matColumnDef="detail">
    <td mat-cell *matCellDef="let row" class="detail-cell" [attr.colspan]="displayedColumns.length">
      <div class="detail-wrapper">
        @if (rowDetailTemplate) {
          <!-- ✅ Correctif #2 : on transmet la vraie ligne via row.host -->
          <ng-container
            [ngTemplateOutlet]="rowDetailTemplate"
            [ngTemplateOutletContext]="{ $implicit: row.host, row: row.host }">
          </ng-container>
        }
        @else {
          <div class="detail-fallback">
            <strong>Détails :</strong> {{ row.host | json }}
          </div>
        }
      </div>
    </td>
  </ng-container>

  <!-- Ligne “détail” -->
  <tr mat-row *matRowDef="let row; columns: ['detail']; when: isDetailRow"></tr>

  <!-- Header -->
  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>

  <!-- Aucune donnée -->
  @if ((serverSide ? total : autoLength) === 0) {
    <tr class="mat-row">
      <td class="mat-cell" [attr.colspan]="displayedColumns.length">Aucune donnée</td>
    </tr>
  }
</table>

<!-- Paginator -->
<mat-paginator
  [length]="serverSide ? total : autoLength"
  [pageSize]="pageSize"
  [pageSizeOptions]="pageSizeOptions"
  showFirstLastButtons>
</mat-paginator>
