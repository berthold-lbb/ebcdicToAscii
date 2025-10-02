import {
  AfterViewInit, ChangeDetectionStrategy, Component, ContentChild, EventEmitter,
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

export enum TableDataType { STRING=0, NUMBER=1, BOOLEAN=2, DATE=3, DATETIME=4, TIME=5, JSON=6, OBJECT=7, LINK=8 }

export interface ITableColonne {
  nom: string;
  label: string;
  type: TableDataType;
  enableOrder: boolean;
  retractable: boolean;
  link?: any;
  clickable?: boolean;
}

export interface TableAction<T> {
  id: string;
  label?: string;
  icon?: string;
  color?: 'primary'|'accent'|'warn'|string;
  tooltip?: string;
  show?: (row: T, index: number) => boolean;
  disabled?: (row: T, index: number) => boolean;
}

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

  TableDataType = TableDataType;

  // ===== Données & colonnes =====
  private _columns: ITableColonne[] = [];
  private _hidden = new Set<string>();
  dataSource = new MatTableDataSource<T>([]);
  visibleColumnDefs: ITableColonne[] = [];
  displayedColumns: string[] = [];

  @Input() set data(value: T[] | null | undefined) {
    this.dataSource.data = value ?? [];
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

  // ===== Menu colonnes rétractables visible ? =====
  @Input() showColumnRetractable = true;

  // ===== Sélection (two-way) =====
  @Input() selectable = true;
  @Input() selectionMode: 'single'|'multiple' = 'multiple';
  private selection = new SelectionModel<T>(true, []);

  @Input()  selectedRows: T[] = [];
  @Output() selectedRowsChange = new EventEmitter<T[]>();
  @Output() selectionChange = new EventEmitter<T[]>(); // rétro-compat

  // ===== Tri & Pagination =====
  @Input() enableOrder = true;
  @Input() serverSide = false;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [5,10,25,50];
  @Input() total = 0;
  autoLength = 0;

  @Output() pageChange = new EventEmitter<PageEvent>();
  @Output() sortChange = new EventEmitter<Sort>();

  // ===== Recherche =====
  @Input() searchable = true;
  @Input() filterPlaceholder = 'Search…';
  @Input() filterKeys: string[] = [];
  @Output() filterChange = new EventEmitter<string>();
  searchCtrl = new FormControl<string>('', { nonNullable: true });

  // ===== UI =====
  @Input() stickyHeader = true;
  @Input() showHeader = true;
  @Input() loading = false;
  @Input() loadingText: string | null = null;
  @Input() showTopBarWhileLoading = true;

  // ===== Coloration sélection =====
  @Input() highlightSelection = false;
  @Input() highlightColor: string = '#E6F4EA';
  @Input() highlightBarColor: string = '#2E7D32';

  // ===== Cellule cliquable =====
  @Output() cellClick = new EventEmitter<{ row: T; column: ITableColonne }>();
  onCellClick(ev: MouseEvent, row: T, col: ITableColonne) {
    ev.stopPropagation();
    this.cellClick.emit({ row, column: col });
  }

  // ===== Colonne actions =====
  @Input() showActionsColumn = false;
  @Input() actionsHeaderLabel = '';
  @Input() actions: TableAction<T>[] = [];
  @Output() action = new EventEmitter<{ actionId: string; row: T; index: number }>();
  @ContentChild('rowActions', { read: TemplateRef }) actionsTpl?: TemplateRef<any>;

  onAction(a: TableAction<T>, row: T, i: number, ev: MouseEvent) {
    ev.stopPropagation();
    this.action.emit({ actionId: a.id, row, index: i });
  }
  isMatPalette(c?: string): c is 'primary'|'accent'|'warn' {
    return c === 'primary' || c === 'accent' || c === 'warn';
  }

  ----------------------------------------------------------------------------
  /** événement émis quand un bouton d’actions est cliqué */
  @Output() action = new EventEmitter<{ actionId: string; row: T; index: number }>();

  /* ---- champs privés + setters (pattern strict) ---- */

  private _showActionsColumn = false;
  private _rowActionsTpl?: TemplateRef<any>;
  private _actions: TableAction<T>[] = [];

  /** forcer l’affichage de la colonne actions */
  @Input() set showActionsColumn(v: boolean) {
    this._showActionsColumn = !!v;
    this._recomputeVisible(); // 🔁 recalcule immédiatement
  }
  get showActionsColumn(): boolean { return this._showActionsColumn; }

  /** Template custom pour les actions */
  @Input() set rowActionsTemplate(tpl: TemplateRef<any> | null | undefined) {
    this._rowActionsTpl = tpl ?? undefined; // 🔎 normalisation
    this._recomputeVisible();               // 🔁 recalcule immédiatement
  }
  get rowActionsTemplate(): TemplateRef<any> | undefined {
    return this._rowActionsTpl;
  }

  /** Liste d’actions fallback si pas de template */
  @Input() set actions(value: TableAction<T>[] | null | undefined) {
    this._actions = value ?? [];
    this._recomputeVisible();               // 🔁 recalcule immédiatement
  }
  get actions(): TableAction<T>[] { return this._actions; }

  /** Vrai si on DOIT afficher la colonne actions (forcé OU template OU liste d’actions) */
  get hasActionsColumn(): boolean {
    return this._showActionsColumn || !!this._rowActionsTpl || (this._actions?.length > 0);
  }
  ----------------------------------------------------------------------

  onAction(a: TableAction<T>, row: T, i: number, ev: MouseEvent) {
    ev?.stopPropagation?.();
    if (a?.disabled && (typeof a.disabled === 'function' ? a.disabled(row) : a.disabled)) {
      return;
    }
    this.action.emit({ actionId: a.id, row, index: i });
  }


  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor() {
    this.searchCtrl.valueChanges
      .pipe(startWith(''), debounceTime(300), distinctUntilChanged())
      .subscribe(q => {
        const query = (q ?? '').trim();
        if (this.serverSide) this.filterChange.emit(query);
        else this._applyClientFilter(query);
      });

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
      this.sort.sortChange.subscribe(s => { if (this.serverSide) this.sortChange.emit(s); });
    }
    if (this.paginator) {
      this.dataSource.paginator = this.serverSide ? undefined : this.paginator;
      this.paginator.page.subscribe(p => { if (this.serverSide) this.pageChange.emit(p); });
    }
  }

  // ===== Sélection helpers =====
  isSelected(row: T): boolean { return this.selection.isSelected(row); }

  isAllSelected(): boolean {
    const pageRows = this._currentPageRows();
    return pageRows.length > 0 && pageRows.every(r => this.selection.isSelected(r));
  }

  masterToggle(): void {
    const pageRows = this._currentPageRows();
    if (this.isAllSelected()) pageRows.forEach(r => this.selection.deselect(r));
    else pageRows.forEach(r => this.selection.select(r));
    this.emitSelection();
  }

  toggleRow(row: T): void {
    if (this.selectionMode === 'single') {
      this.selection.clear();
      this.selection.select(row);
    } else {
      this.selection.toggle(row);
    }
    this.emitSelection();
  }

  checkboxLabel(row?: T): string {
    if (!row) return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row`;
  }

  private emitSelection(): void {
    this.selectedRows = this.selection.selected;
    this.selectedRowsChange.emit(this.selectedRows);
    this.selectionChange.emit(this.selectedRows);
  }

  // ===== Colonnes visibles / menu =====
  trackByCol = (_: number, c: ITableColonne) => c.nom;
  isHidden(col: ITableColonne): boolean { return col.retractable && this._hidden.has(col.nom); }
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

    // case: colonne d’actions (nouvelle logique unifiée)
    if (this.hasActionsColumn && !this.displayedColumns.includes('actions')) {
      this.displayedColumns = [...this.displayedColumns, 'actions'];
    }
    if (!this.hasActionsColumn && this.displayedColumns.includes('actions')) {
      this.displayedColumns = this.displayedColumns.filter(c => c !== 'actions');
    }
  }

  // ===== Filtre client & pagination locale =====
  private _applyClientFilter(query: string) {
    this.dataSource.filter = query.trim().toLowerCase();
    if (this.paginator) this.paginator.firstPage();
    this._updateClientLength();
  }
  private _updateClientLength() {
    this.autoLength = this.dataSource.filteredData?.length ?? this.dataSource.data?.length ?? 0;
  }
  private _currentPageRows(): T[] {
    const base = this.dataSource.filteredData?.length ? this.dataSource.filteredData : this.dataSource.data;
    if (!this.paginator || this.serverSide) return base ?? [];
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return (base ?? []).slice(start, start + this.paginator.pageSize);
  }

  
}



------------------------------------------------------------------------------------

import {
  AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter,
  Input, OnChanges, Output, SimpleChanges, ViewChild
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

export enum TableDataType { STRING=0, NUMBER=1, BOOLEAN=2, DATE=3, DATETIME=4, TIME=5, JSON=6, OBJECT=7, LINK=8 }
export interface ITableColonne {
  nom: string; label: string; type: TableDataType;
  enableOrder: boolean; retractable: boolean;
  link?: any;
  clickable?: boolean; // pour (cellClick)
}

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

  TableDataType = TableDataType;

  // ===== Données & colonnes =====
  private _columns: ITableColonne[] = [];
  private _hidden = new Set<string>();

  dataSource = new MatTableDataSource<T>([]);
  visibleColumnDefs: ITableColonne[] = [];
  displayedColumns: string[] = [];

  @Input() set data(value: T[] | null | undefined) {
    this.dataSource.data = value ?? [];
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

  // ===== Sélection (Two-way) =====
  @Input() selectable = true;
  @Input() selectionMode: 'single'|'multiple' = 'multiple';

  /** SelectionModel interne */
  selection = new SelectionModel<T>(true, []);

  /** API publique two-way */
  @Input()  selectedRows: T[] = [];
  @Output() selectedRowsChange = new EventEmitter<T[]>();
  /** (optionnel rétro-compat) */
  @Output() selectionChange = new EventEmitter<T[]>();

  // ===== Tri & Pagination =====
  @Input() enableOrder = true;
  @Input() serverSide = false;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [5,10,25,50];
  @Input() total = 0;
  autoLength = 0;

  @Output() pageChange = new EventEmitter<PageEvent>();
  @Output() sortChange = new EventEmitter<Sort>();

  // ===== Recherche =====
  @Input() searchable = true;
  @Input() filterPlaceholder = 'Search…';
  @Input() filterKeys: string[] = [];
  @Output() filterChange = new EventEmitter<string>();
  searchCtrl = new FormControl<string>('', { nonNullable: true });

  // ===== UI / Loader =====
  @Input() stickyHeader = true;
  @Input() loading = false;
  @Input() loadingText: string | null = null;
  @Input() showTopBarWhileLoading = true;

  // ===== Coloration des lignes sélectionnées (pilotée par le parent) =====
  @Input() highlightSelection = false;
  @Input() highlightColor: string = '#E6F4EA';   // fond
  @Input() highlightBarColor: string = '#2E7D32';// barre latérale gauche

  // ===== Cellule cliquable =====
  @Output() cellClick = new EventEmitter<{ row: T; column: ITableColonne }>();
  onCellClick(ev: MouseEvent, row: T, col: ITableColonne) {
    ev.stopPropagation();
    this.cellClick.emit({ row, column: col });
  }

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor() {
    // Search
    this.searchCtrl.valueChanges
      .pipe(startWith(''), debounceTime(300), distinctUntilChanged())
      .subscribe(q => {
        const query = (q ?? '').trim();
        if (this.serverSide) this.filterChange.emit(query);
        else this._applyClientFilter(query);
      });

    // Filtre client
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

  ngOnChanges(ch: SimpleChanges): void {
    // mode single/multiple
    if (ch['selectionMode']) {
      const multi = this.selectionMode !== 'single';
      if (this.selection.isMultipleSelection() !== multi) {
        this.selection = new SelectionModel<T>(multi, this.selection.selected);
      }
    }
    // synchro depuis le parent pour [(selectedRows)]
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
      this.sort.sortChange.subscribe(s => { if (this.serverSide) this.sortChange.emit(s); });
    }
    if (this.paginator) {
      this.dataSource.paginator = this.serverSide ? undefined : this.paginator;
      this.paginator.page.subscribe(p => { if (this.serverSide) this.pageChange.emit(p); });
    }
  }

  // ===== Sélection helpers =====
  isSelected(row: T): boolean { return this.selection.isSelected(row); }

  isAllSelected(): boolean {
    const pageRows = this._currentPageRows();
    return pageRows.length > 0 && pageRows.every(r => this.selection.isSelected(r));
  }

  masterToggle(): void {
    const pageRows = this._currentPageRows();
    if (this.isAllSelected()) pageRows.forEach(r => this.selection.deselect(r));
    else pageRows.forEach(r => this.selection.select(r));
    this.emitSelection();
  }

  toggleRow(row: T): void {
    if (this.selectionMode === 'single') {
      this.selection.clear();
      this.selection.select(row);
    } else {
      this.selection.toggle(row);
    }
    this.emitSelection();
  }

  checkboxLabel(row?: T): string {
    if (!row) return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row`;
  }

  private emitSelection(): void {
    this.selectedRows = this.selection.selected;
    this.selectedRowsChange.emit(this.selectedRows); // two-way
    this.selectionChange.emit(this.selectedRows);    // rétro-compat
  }

  // ===== Colonnes visibles / menu =====
  trackByCol = (_: number, c: ITableColonne) => c.nom;
  isHidden(col: ITableColonne): boolean { return col.retractable && this._hidden.has(col.nom); }
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

  // ===== Filtre client =====
  private _applyClientFilter(query: string) {
    this.dataSource.filter = query.trim().toLowerCase();
    if (this.paginator) this.paginator.firstPage();
    this._updateClientLength();
  }
  private _updateClientLength() {
    this.autoLength = this.dataSource.filteredData?.length ?? this.dataSource.data?.length ?? 0;
  }
  private _currentPageRows(): T[] {
    const base = this.dataSource.filteredData ?? this.dataSource.data ?? [];
    if (!this.paginator || this.serverSide) return base;
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return base.slice(start, start + this.paginator.pageSize);
  }
}
