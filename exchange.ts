import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild
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

  // ========= Données & colonnes =========
  protected readonly TableDataType = TableDataType;

  private _columns: ITableColonne[] = [];
  private _hidden = new Set<string>();
  dataSource = new MatTableDataSource<T>([]);
  visibleColumnDefs: ITableColonne[] = [];
  displayedColumns: string[] = [];

  @Input() set data(value: T[] | null | undefined) {
    const arr = value ?? [];
    this._ensureStableIds(arr);           // nécessaire si pas de rowIdKey
    this.dataSource.data = arr;
    if (!this.serverSide) this._updateClientLength();
    // si la ligne ouverte n’existe plus, on ferme
    this._closeDetailIfRowGone();
    this.cdr.markForCheck();
  }
  @Input() set columns(value: ITableColonne[] | null | undefined) {
    this._columns = (value ?? []).map(c => ({ ...c }));
    this._recomputeVisible();
    this.cdr.markForCheck();
  }
  @Input() set hiddenColumns(value: string[] | null | undefined) {
    this._hidden = new Set((value ?? []).filter(Boolean));
    this._recomputeVisible();
    this.hiddenColumnsChange.emit([...this._hidden]);
    this.cdr.markForCheck();
  }
  @Output() hiddenColumnsChange = new EventEmitter<string[]>();

  // ========= Sélection (existant) =========
  @Input() selectable = true;
  @Input() selectionMode: 'single' | 'multiple' = 'multiple';
  private selection = new SelectionModel<T>(true, []);
  @Input() selectedRows: T[] = [];
  @Output() selectedRowsChange = new EventEmitter<T[]>();
  @Output() selectionChange = new EventEmitter<T[]>();

  // ========= Tri & Pagination =========
  @Input() enableOrder = true;
  @Input() serverSide = false;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50];
  @Input() total = 0;   // server side
  autoLength = 0;       // client side

  @Output() pageChange = new EventEmitter<PageEvent>();
  @Output() sortChange = new EventEmitter<Sort>();

  // ========= Recherche =========
  @Input() searchable = true;
  @Input() filterPlaceholder = 'Search…';
  @Input() filterKeys: string[] = [];
  @Output() filterChange = new EventEmitter<string>();
  searchCtrl = new FormControl<string>('', { nonNullable: true });

  // ========= UI / Loader / Highlight =========
  @Input() stickyHeader = true;
  @Input() loading = false;
  @Input() loadingText: string | null = null;
  @Input() showTopBarWhileLoading = true;
  @Input() highlightSelection = false;
  @Input() highlightColor: string = '#E6F4EA';
  @Input() highlightBarColor: string = '#2E7D32';

  // ========= Cellule cliquable (existant) =========
  @Output() cellClick = new EventEmitter<{ row: T; column: ITableColonne }>();
  onCellClick(ev: MouseEvent, row: T, col: ITableColonne) {
    ev.stopPropagation();
    this.cellClick.emit({ row, column: col });
  }

  // ========= Vue DÉTAIL (2 modes) =========
  /** Active/désactive la fonctionnalité */
  @Input() enableRowDetail = true;

  /** Template projeté depuis le parent (optionnel) */
  private _rowDetailTpl?: TemplateRef<any>;
  @Input() set rowDetailTemplate(tpl: TemplateRef<any> | null | undefined) {
    this._rowDetailTpl = tpl ?? undefined;
  }
  get rowDetailTemplate(): TemplateRef<any> | undefined { return this._rowDetailTpl; }

  /** Mode B : clé d’identification stable */
  @Input() rowIdKey?: keyof T;

  /** Mode A (sans rowIdKey) : référence d’objet */
  expandedRow: T | null = null;

  /** Mode B (avec rowIdKey) : id stable */
  expandedId: IdType | null = null;

  /** Double-clic : ouvre/ferme le détail */
  onRowDblClick(row: T): void {
    if (!this.enableRowDetail) return;

    if (this.rowIdKey) {
      const id = this._rowId(row);
      this.expandedId = (this.expandedId === id) ? null : id;
      this.expandedRow = null; // on n’utilise pas la ref en mode id
    } else {
      this.expandedRow = (this.expandedRow === row) ? null : row;
      this.expandedId = null;
    }

    this.cdr.markForCheck(); // 🔥 force le rafraîchissement avec OnPush
  }

  /** Prédicat pour la 2e RowDef (ligne détail) */
  isDetailRow = (_: number, row: T) => {
    if (!this.enableRowDetail) return false;
    return this.rowIdKey
      ? this.expandedId != null && this._rowId(row) === this.expandedId
      : this.expandedRow != null && row === this.expandedRow;
  };

  // ========= Mat refs =========
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // ========= Ids stables (si pas de rowIdKey) =========
  private _ids = new WeakMap<T, number>();
  private _seq = 1;

  private _ensureStableIds(rows: T[]) {
    if (this.rowIdKey) return;
    for (const r of rows) if (!this._ids.has(r)) this._ids.set(r, this._seq++);
  }
  private _rowId(row: T): IdType {
    if (this.rowIdKey && row && (row as any)[this.rowIdKey] != null) {
      return (row as any)[this.rowIdKey] as IdType;
    }
    // fallback : id synthétique (mode A seulement)
    let id = this._ids.get(row);
    if (id == null) {
      id = this._seq++;
      this._ids.set(row, id);
    }
    return id;
  }

  private _closeDetailIfRowGone() {
    const base = this.dataSource.data ?? [];
    if (this.rowIdKey) {
      if (this.expandedId != null && !base.some(r => this._rowId(r) === this.expandedId)) {
        this.expandedId = null;
      }
    } else {
      if (this.expandedRow != null && !base.includes(this.expandedRow)) {
        this.expandedRow = null;
      }
    }
  }

  // ========= ctor =========
  constructor(private cdr: ChangeDetectorRef) {
    // recherche
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

  // ========= Hooks =========
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
    if (ch['rowIdKey']) {
      // on bascule proprement d’un mode à l’autre
      this.expandedRow = null;
      this.expandedId = null;
      this.cdr.markForCheck();
    }
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.dataSource.sort = this.sort;
      this.sort.sortChange.subscribe(s => {
        if (this.serverSide) this.sortChange.emit(s);
        this.expandedRow = null;
        this.expandedId = null;
        this.cdr.markForCheck();
      });
    }
    if (this.paginator) {
      if (this.serverSide) {
        this.paginator.page.subscribe(p => this.pageChange.emit(p));
      } else {
        this.paginator.page.subscribe(() => {
          this.expandedRow = null;
          this.expandedId = null;
          this.cdr.markForCheck();
        });
      }
    }
  }

  // ========= Sélection (helpers existants) =========
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

  // ========= Colonnes visibles =========
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

  // ========= Filtre & pagination client =========
  private _applyClientFilter(query: string) {
    this.dataSource.filter = query.trim().toLowerCase();
    if (this.paginator && !this.serverSide) this.paginator.firstPage();
    this._updateClientLength();
    this._closeDetailIfRowGone();
    this.cdr.markForCheck();
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
