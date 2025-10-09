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
interface DetailRow { __detail: true; forId: IdType; }

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

  // ===== Détail de ligne =====
  @Input() rowIdKey?: keyof T;                 // optionnel si tu as une vraie clé
  @Input() rowDetailTemplate?: TemplateRef<any>; // si absent => fallback JSON

  expandedId: IdType | null = null;            // id de la ligne ouverte

  onRowDblClick(row: T): void {
    const id = this._rowId(row);
    this.expandedId = (this.expandedId === id) ? null : id;
  }

  /** Tableau rendu : base paginée + éventuelle ligne de détail */
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

    const res: Array<T|DetailRow> = pageRows.slice(0, idx + 1);
    res.push({ __detail: true, forId: this.expandedId });
    res.push(...pageRows.slice(idx + 1));
    return res;
  }

  /** predicate pour MatTable */
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
  private _rowId(row: T): IdType {
    if (this.rowIdKey && row[this.rowIdKey] != null) return row[this.rowIdKey] as unknown as IdType;
    return this._ids.get(row)!; // assuré par _ensureStableIds
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
-----------
<div class="dt-root">
  <!-- Toolbar -->
  <div class="dt-toolbar">
    <div class="left">
      @if (showColumnRetractable) {
        <button mat-button [matMenuTriggerFor]="colsMenu">
          <mat-icon>view_column</mat-icon> Colonnes
        </button>
        <mat-menu #colsMenu="matMenu" xPosition="after">
          @for (c of _columns; track c.nom) {
            <button mat-menu-item (click)="toggleColumn(c)" [disabled]="!c.retractable">
              <mat-icon class="mr-2">{{ isHidden(c) ? 'check_box_outline_blank' : 'check_box' }}</mat-icon>
              <span>{{ c.label }}</span>
              @if (!c.retractable) { <mat-icon class="ml-auto" matTooltip="Non rétractable">lock</mat-icon> }
            </button>
          }
        </mat-menu>
      }
    </div>

    @if (searchable) {
      <div class="right">
        <mat-form-field appearance="outline" class="dt-search">
          <mat-label>{{ filterPlaceholder }}</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [formControl]="searchCtrl" placeholder="Search..." />
        </mat-form-field>
      </div>
    }
  </div>

  @if (loading && showTopBarWhileLoading) {
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  }

  <table mat-table
         [dataSource]="rowsForRender"
         class="mat-elevation-z2 dt-table"
         matSort
         [multiTemplateDataRows]="true">

    <!-- Col sélection -->
    @if (selectable) {
      <ng-container matColumnDef="select">
        <th mat-header-cell *matHeaderCellDef class="col-select" [class.sticky]="stickyHeader">
          <mat-checkbox
            (change)="masterToggle()"
            [checked]="isAllSelected()"
            [indeterminate]="selection.hasValue() && !isAllSelected()"
            [aria-label]="checkboxLabel()"
            (keydown.space)="$event.preventDefault(); masterToggle()"
            (keydown.enter)="$event.preventDefault(); masterToggle()">
          </mat-checkbox>
        </th>
        <td mat-cell *matCellDef="let row" class="col-select" @if="!(row as any).__detail">
          <mat-checkbox
            (click)="$event.stopPropagation()"
            (change)="toggleRow(row)"
            [checked]="isSelected(row)"
            [aria-label]="checkboxLabel(row)"
            (keydown.space)="$event.preventDefault(); toggleRow(row)"
            (keydown.enter)="$event.preventDefault(); toggleRow(row)">
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

        @switch (col.type) {
          @case (TableDataType.STRING) {
            <td mat-cell *matCellDef="let row" @if="!(row as any).__detail"
                class="data-table-colonne-{{ col.nom }}"
                [class.cell-clickable]="col.clickable"
                (click)="col.clickable && onCellClick($event, row, col)">
              {{ row[col.nom] }}
            </td>
          }
          @case (TableDataType.NUMBER)   { <td mat-cell *matCellDef="let row" @if="!(row as any).__detail">{{ row[col.nom] }}</td> }
          @case (TableDataType.BOOLEAN)  { <td mat-cell *matCellDef="let row" @if="!(row as any).__detail">{{ row[col.nom] }}</td> }
          @case (TableDataType.DATE)     { <td mat-cell *matCellDef="let row" @if="!(row as any).__detail">{{ row[col.nom] | date:'dd/MM/yyyy' }}</td> }
          @case (TableDataType.TIME)     { <td mat-cell *matCellDef="let row" @if="!(row as any).__detail">{{ row[col.nom] | date:'HH:mm:ss' }}</td> }
          @case (TableDataType.DATETIME) { <td mat-cell *matCellDef="let row" @if="!(row as any).__detail">{{ row[col.nom] | date:'dd/MM/yyyy HH:mm:ss' }}</td> }
          @case (TableDataType.JSON)     { <td mat-cell *matCellDef="let row" @if="!(row as any).__detail">{{ row[col.nom] | json }}</td> }
          @case (TableDataType.OBJECT)   { <td mat-cell *matCellDef="let row" @if="!(row as any).__detail">{{ row[col.nom] }}</td> }
          @case (TableDataType.LINK) {
            <td mat-cell *matCellDef="let row" @if="!(row as any).__detail">
              <a [routerLink]="[col.link, row[col.nom]]" (click)="$event.stopPropagation()">{{ row[col.nom] }}</a>
            </td>
          }
          @default { <td mat-cell *matCellDef="let row" @if="!(row as any).__detail">{{ row[col.nom] }}</td> }
        }
      </ng-container>
    }

    <!-- Header -->
    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>

    <!-- Lignes normales -->
    <tr mat-row
        *matRowDef="let row; columns: displayedColumns"
        class="clickable-row"
        @if="!(row as any).__detail"
        (dblclick)="onRowDblClick(row)"
        (click)="selectable && toggleRow(row)"
        [class.row-selected]="isSelected(row) && highlightSelection"
        [ngStyle]="(isSelected(row) && highlightSelection)
                     ? {'--sel-bg': highlightColor, '--sel-bar': highlightBarColor}
                     : null">
    </tr>

    <!-- Colonne technique pour la ligne de détail -->
    <ng-container matColumnDef="detail">
      <td mat-cell class="detail-cell" [attr.colspan]="displayedColumns.length">
        <div class="detail-wrapper">
          @if (rowDetailTemplate) {
            <ng-container *ngTemplateOutlet="rowDetailTemplate; context: {$implicit: row.__host, row: row.__host}"></ng-container>
          } @else {
            <div class="detail-fallback"><strong>Détails :</strong> {{ row.__host ?? row | json }}</div>
          }
        </div>
      </td>
    </ng-container>

    <!-- Lignes de détail (quand: isDetailRow) -->
    <tr mat-row
        *matRowDef="let row; columns: ['detail']; when: isDetailRow"
        class="detail-row">
    </tr>

    @if ((serverSide ? total : autoLength) === 0) {
      <tr class="mat-row">
        <td class="mat-cell" [attr.colspan]="displayedColumns.length">Aucune donnée</td>
      </tr>
    }
  </table>

  @if (loading) {
    <div class="dt-loading">
      <mat-progress-spinner mode="indeterminate" diameter="40"></mat-progress-spinner>
      @if (loadingText) { <div class="loading-text">{{ loadingText }}</div> }
    </div>
  }

  <mat-paginator
    [length]="serverSide ? total : autoLength"
    [pageSize]="pageSize"
    [pageSizeOptions]="pageSizeOptions"
    showFirstLastButtons>
  </mat-paginator>
</div>
