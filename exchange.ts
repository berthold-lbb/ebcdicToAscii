a) Ajoute une fonction optionnelle au modèle de colonne
// data-table.component.ts
export interface ITableColonne {
  nom: string;
  label: string;
  type: TableDataType;
  enableOrder: boolean;
  retractable: boolean;
  link?: any;
  clickable?: boolean;

  /** ➕ Valeur calculée pour colonnes virtuelles (non présentes dans le payload) */
  valueGetter?: (row: T) => any;
}

b) Utilise valueGetter quand tu rends une cellule

Dans ton HTML, là où tu avais {{ row[col.nom] }}, remplace par :

<!-- Exemple pour les types “généraux” -->
<td mat-cell class="data-table-colonne {{ col.nom }}"
    *matCellDef="let row: any"
    [class.col-clickable]="col.clickable"
    (click)="col.clickable && onCellClick($event, row, col)">
  {{ (col.valueGetter ? col.valueGetter(row) : row[col.nom]) }}
</td>


Pour tes types formatés (AMOUNT, DATE…), applique le pipe après le getter :

<!-- AMOUNT -->
<td mat-cell class="data-table-colonne {{ col.nom }}" *matCellDef="let row: any">
  {{ (col.valueGetter ? col.valueGetter(row) : row[col.nom]) | number:'1.0-0' }}
</td>

c) Gérer le tri client (MatSort) sur colonnes virtuelles
ngAfterViewInit(): void {
  if (this.sort) {
    this.dataSource.sort = this.sort;

    // ➕ tri sur valueGetter si présent
    this.dataSource.sortingDataAccessor = (row: T, columnName: string) => {
      const col = this._columns.find(c => c.nom === columnName);
      if (col?.valueGetter) {
        const v = col.valueGetter(row);
        // uniformise pour MatSort
        if (v == null) return '';
        if (typeof v === 'string' || typeof v === 'number') return v as any;
        return JSON.stringify(v);
      }
      return (row as any)[columnName];
    };

    this.sort.sortChange.subscribe(s => {
      if (this.serverSide) this.sortChange.emit(s);
      this.expandedId = null;
    });
  }
}

d) (Optionnel) Inclure les colonnes virtuelles dans la recherche client

Si tu veux que la barre de recherche “voit” les colonnes virtuelles quand leur nom est présent dans filterKeys, adapte le filterPredicate :

this.dataSource.filterPredicate = (row: T, filter: string) => {
  const q = (filter || '').toLowerCase();

  // si filterKeys est défini : ne cherche que dans ces clés
  const keys = this.filterKeys?.length ? this.filterKeys : Object.keys(row);

  for (const k of keys) {
    const col = this._columns.find(c => c.nom === k);
    let v: any;
    if (col?.valueGetter) {
      v = col.valueGetter(row);
    } else {
      v = (row as any)[k];
    }
    if (v == null) continue;
    const s = (typeof v === 'object') ? JSON.stringify(v) : String(v);
    if (s.toLowerCase().includes(q)) return true;
  }
  return false;
};

e) Déclare tes colonnes “Crédit/Débit” sans modifier le payload

Dans ton parent :

columns: ITableColonne[] = [
  // …
  {
    nom: 'credit',
    label: 'Crédit',
    type: TableDataType.AMOUNT,
    enableOrder: true,
    retractable: true,
    valueGetter: (r) => r?.type?.toLowerCase() === 'credit' ? Number(r?.amount) || 0 : null,
  },
  {
    nom: 'debit',
    label: 'Débit',
    type: TableDataType.AMOUNT,
    enableOrder: true,
    retractable: true,
    valueGetter: (r) => r?.type?.toLowerCase() === 'debit' ? Number(r?.amount) || 0 : null,
  },
];








data-table.component.ts
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

export enum TableDataType {
  STRING, NUMBER, BOOLEAN, DATE, DATETIME, TIME, JSON, OBJECT, LINK,
  AMOUNT, PERCENT
}

export interface ITableColonne<T = any> {
  nom: string;
  label: string;
  type: TableDataType;
  enableOrder: boolean;
  retractable: boolean;
  link?: any;
  clickable?: boolean;

  /** ➕ Valeur calculée pour colonnes virtuelles (non présentes dans le payload) */
  valueGetter?: (row: T) => any;
}

type IdType = string | number;
interface DetailRow<T> { __detail: true; forId: IdType; host: T; }

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
  private _columns: ITableColonne<T>[] = [];
  private _hidden = new Set<string>();

  dataSource = new MatTableDataSource<T>([]);
  visibleColumnDefs: ITableColonne<T>[] = [];
  displayedColumns: string[] = [];

  @Input() set data(value: T[] | null | undefined) {
    const arr = value ?? [];
    this._ensureStableIds(arr);
    this.dataSource.data = arr;
    if (!this.serverSide) this._updateClientLength();
  }
  @Input() set columns(value: ITableColonne<T>[] | null | undefined) {
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
  @Output() cellClick = new EventEmitter<{ row: T; column: ITableColonne<T> }>();
  onCellClick(ev: MouseEvent, row: T, col: ITableColonne<T>) {
    ev.stopPropagation();
    this.cellClick.emit({ row, column: col });
  }

  // ===== Détail de ligne =====
  @Input() rowIdKey?: keyof T;                  // optionnel si vraie clé
  @Input() rowDetailTemplate?: TemplateRef<any>;// si absent => fallback JSON
  expandedId: IdType | null = null;             // id de la ligne ouverte

  onRowDblClick(row: T): void {
    const id = this._rowId(row);
    this.expandedId = (this.expandedId === id) ? null : id;
  }

  /** Données pour l’affichage (page courante + ligne de détail) */
  get rowsForRender(): Array<T|DetailRow<T>> {
    const baseAll = this.dataSource.filteredData?.length
      ? this.dataSource.filteredData
      : (this.dataSource.data ?? []);

    let pageRows = baseAll;
    if (this.paginator && !this.serverSide) {
      const start = this.paginator.pageIndex * this.paginator.pageSize;
      pageRows = baseAll.slice(start, start + this.paginator.pageSize);
    }

    if (this.expandedId == null) return pageRows;

    const idx = pageRows.findIndex(r => this._rowId(r) === this.expandedId);
    if (idx === -1) return pageRows;

    const host = pageRows[idx];
    const res: Array<T|DetailRow<T>> = pageRows.slice(0, idx + 1);
    res.push({ __detail: true, forId: this.expandedId, host } as DetailRow<T>);
    res.push(...pageRows.slice(idx + 1));
    return res;
  }

  /** predicate pour MatTable (ligne “détail”) */
  isDetailRow = (_i: number, row: T | DetailRow<T>) =>
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
    if (this.rowIdKey && row && (row as any)[this.rowIdKey] != null) {
      return (row as any)[this.rowIdKey] as IdType;
    }
    const id = this._ids.get(row);
    if (id != null) return id;
    const next = this._seq++;
    this._ids.set(row, next);
    return next;
  }

  // ===== ctor =====
  constructor() {
    // recherche
    this.searchCtrl.valueChanges
      .pipe(startWith(''), debounceTime(300), distinctUntilChanged())
      .subscribe(q => {
        const query = (q ?? '').trim();
        if (this.serverSide) this.filterChange.emit(query);
        else this._applyClientFilter(query);
      });

    // filtre client — inclut valueGetter si la colonne est listée dans filterKeys
    this.dataSource.filterPredicate = (row: T, filter: string) => {
      const q = (filter || '').toLowerCase();
      const keys = (this.filterKeys?.length ? this.filterKeys : Object.keys(row));
      for (const k of keys) {
        const col = this._columns.find(c => c.nom === k);
        const v = col?.valueGetter ? col.valueGetter(row) : (row as any)[k];
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

      // ➕ tri sur valueGetter si présent
      this.dataSource.sortingDataAccessor = (row: T, columnName: string) => {
        const col = this._columns.find(c => c.nom === columnName);
        if (col?.valueGetter) {
          const v = col.valueGetter(row);
          if (v == null) return '';
          if (typeof v === 'string' || typeof v === 'number') return v as any;
          return JSON.stringify(v);
        }
        return (row as any)[columnName];
      };

      this.sort.sortChange.subscribe(s => {
        if (this.serverSide) this.sortChange.emit(s);
        this.expandedId = null;                 // ferme le détail au tri
      });
    }
    if (this.paginator) {
      // on ne branche PAS dataSource.paginator (pagination manuelle)
      if (this.serverSide) {
        this.paginator.page.subscribe(p => this.pageChange.emit(p));
      } else {
        this.paginator.page.subscribe(() => this.expandedId = null);
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
  trackByCol = (_: number, c: ITableColonne<T>) => c.nom;
  isHidden = (col: ITableColonne<T>) => col.retractable && this._hidden.has(col.nom);
  toggleColumn(col: ITableColonne<T>): void {
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

  // ===== Utilitaires rendu =====
  getCellValue(row: T, col: ITableColonne<T>): any {
    return col.valueGetter ? col.valueGetter(row) : (row as any)[col.nom];
  }
}

data-table.component.html
<div class="dt-root" [class.dt-blurred]="loading">
  <div class="dt-toolbar" *ngIf="searchable || showColumnRetractable">
    <div class="dt-toolbar-left">
      <ng-container *ngIf="showColumnRetractable">
        <button mat-icon-button [matMenuTriggerFor]="colsMenu" matTooltip="Colonnes">
          <mat-icon>view_column</mat-icon>
        </button>
        <mat-menu #colsMenu="matMenu">
          <button mat-menu-item *ngFor="let c of _columns" (click)="toggleColumn(c)">
            <mat-icon>{{ isHidden(c) ? 'check_box_outline_blank' : 'check_box' }}</mat-icon>
            <span>{{ c.label }}</span>
          </button>
        </mat-menu>
      </ng-container>
    </div>

    <div class="dt-toolbar-right" *ngIf="searchable">
      <mat-form-field appearance="outline" class="dt-search-field">
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [placeholder]="filterPlaceholder" [formControl]="searchCtrl">
        <button *ngIf="searchCtrl.value" matSuffix mat-icon-button (click)="searchCtrl.setValue('')">
          <mat-icon>close</mat-icon>
        </button>
      </mat-form-field>
    </div>
  </div>

  <div class="dt-table-wrap">
    <table mat-table [dataSource]="rowsForRender"
           matSort *ngIf="enableOrder"
           [multiTemplateDataRows]="true"
           class="mat-elevation-z2 dt-table">

      <!-- Sélection -->
      <ng-container matColumnDef="select" *ngIf="selectable">
        <th mat-header-cell *matHeaderCellDef>
          <mat-checkbox
            (change)="$event ? masterToggle() : null"
            [checked]="isAllSelected()"
            [indeterminate]="selection.hasValue() && !isAllSelected()"
            [aria-label]="checkboxLabel()">
          </mat-checkbox>
        </th>
        <td mat-cell *matCellDef="let row"
            @if="!(row as any).__detail">
          <mat-checkbox
            (click)="$event.stopPropagation()"
            (change)="toggleRow(row)"
            [checked]="isSelected(row)"
            [aria-label]="checkboxLabel(row)">
          </mat-checkbox>
        </td>
      </ng-container>

      <!-- Colonnes dynamiques -->
      <ng-container *ngFor="let col of visibleColumnDefs; trackBy: trackByCol"
                    [matColumnDef]="col.nom">

        <!-- STRING / fallback -->
        <td mat-cell *matCellDef="let row"
            class="data-table-colonne {{ col.nom }}"
            @if="!(row as any).__detail"
            [class.col-clickable]="col.clickable"
            (click)="col.clickable && onCellClick($event, row, col)">
          {{ getCellValue(row, col) }}
        </td>

        <th mat-header-cell *matHeaderCellDef
            [mat-sort-header]="col.enableOrder ? col.nom : null">
          {{ col.label }}
        </th>
      </ng-container>

      <!-- Types spéciaux (AMOUNT, NUMBER, DATE...) -->
      <ng-container *ngFor="let col of visibleColumnDefs" [matColumnDef]="col.nom + '-typed'"></ng-container>

      <!-- Surcharges par type (AMOUNT) -->
      <ng-container *ngFor="let col of visibleColumnDefs">
        <td mat-cell *matCellDef="let row"
            class="data-table-colonne {{ col.nom }}"
            @if="!(row as any).__detail && col.type === TableDataType.AMOUNT">
          {{ getCellValue(row, col) | number:'1.0-0' }}
        </td>
      </ng-container>

      <!-- Ligne “détail” (colonne technique unique) -->
      <ng-container matColumnDef="detail">
        <td mat-cell class="detail-cell" *matCellDef="let row"
            [attr.colspan]="displayedColumns.length"
            @if="(row as any).__detail">
          <div class="detail-wrapper">
            @if (rowDetailTemplate) {
              <ng-container
                *ngTemplateOutlet="rowDetailTemplate; context: {$implicit: (row as any).host, row: (row as any).host}">
              </ng-container>
            } @else {
              <div class="detail-fallback">
                <strong>Détails :</strong> {{ (row as any).host | json }}
              </div>
            }
          </div>
        </td>
      </ng-container>

      <!-- Header row -->
      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>

      <!-- Data rows -->
      <tr mat-row *matRowDef="let row; columns: displayedColumns"
          (dblclick)="onRowDblClick(row)"
          @if="!(row as any).__detail">
      </tr>

      <!-- Detail row -->
      <tr mat-row *matRowDef="let row; columns: ['detail']"
          [matRowDefWhen]="isDetailRow">
      </tr>
    </table>
  </div>

  <!-- Paginator -->
  <mat-paginator *ngIf="!serverSide"
                 [length]="autoLength"
                 [pageSize]="pageSize"
                 [pageSizeOptions]="pageSizeOptions">
  </mat-paginator>

  <mat-paginator *ngIf="serverSide"
                 [length]="total"
                 [pageSize]="pageSize"
                 [pageSizeOptions]="pageSizeOptions">
  </mat-paginator>
</div>

data-table.component.scss (mini)
.dt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}
.dt-toolbar-right { display: flex; align-items: center; gap: 8px; }
.dt-search-field { width: 260px; }

.dt-table { width: 100%; }
.detail-cell { padding: 0 !important; background: transparent; }
.detail-wrapper {
  padding: 12px 16px 16px 28px;
  background: rgba(0,0,0,0.03);
  border-left: 4px solid #2e7d32;
  border-radius: 4px;
}
.detail-fallback { font-family: monospace; white-space: pre-wrap; }




----------

transactions-search.component.ts (MAJ)
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule, MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CommonModule } from '@angular/common';

export type MatchingStatus = 'NoMatched' | 'Matched';

export interface SearchFormValue {
  startDate: Date | null;
  endDate: Date | null;
  matchingStatus: MatchingStatus;    // ← switch
  matchTag: string | null;           // ← champ texte (visible seulement si NoMatched)
  matchAccount: string | null;
  limit: number;
  offset: number;
}

@Component({
  standalone: true,
  selector: 'app-transactions-search',
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatDatepickerModule,
    MatButtonModule, MatButtonToggleModule
  ],
  templateUrl: './transactions-search.component.html'
})
export class TransactionsSearchComponent {
  private fb = inject(FormBuilder);

  @Input() disabled = false;
  @Output() search = new EventEmitter<SearchFormValue>();

  form = this.fb.group({
    startDate: this.fb.control<Date | null>(null, { validators: [Validators.required] }),
    endDate:   this.fb.control<Date | null>(null, { validators: [Validators.required] }),
    matchingStatus: this.fb.control<MatchingStatus>('NoMatched', { nonNullable: true }),
    matchTag: this.fb.control<string | null>(null),          // ← pas required
    matchAccount: this.fb.control<string | null>(null, { validators: [Validators.required] }),
    limit:  this.fb.control<number>(50, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    offset: this.fb.control<number>(0,  { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
  }, { validators: [dateRangeValidator] });

  // util: préserver l'heure courante
  onDatePick(ctrl: 'startDate' | 'endDate', ev: MatDatepickerInputEvent<Date>) {
    const val = ev.value;
    if (!val) return;
    const now = new Date();
    const withTime = new Date(
      val.getFullYear(), val.getMonth(), val.getDate(),
      now.getHours(), now.getMinutes(), now.getSeconds()
    );
    this.form.get(ctrl)?.setValue(withTime);
  }

  submit() {
    if (this.form.invalid || this.disabled) {
      this.form.markAllAsTouched();
      return;
    }
    this.search.emit(this.form.getRawValue() as SearchFormValue);
  }
}

function dateRangeValidator(group: AbstractControl) {
  const s = group.get('startDate')?.value as Date | null;
  const e = group.get('endDate')?.value as Date | null;
  if (s && e && e.getTime() < s.getTime()) {
    return { range: 'endBeforeStart' };
  }
  return null;
}

transactions-search.component.html (MAJ)
<mat-card class="search-card" [class.is-disabled]="disabled">
  <form [formGroup]="form" (ngSubmit)="submit()">
    <div class="row">
      <mat-form-field appearance="fill">
        <mat-label>Start Date</mat-label>
        <input matInput [matDatepicker]="pickerStart"
               formControlName="startDate"
               placeholder="dd/MM/yyyy HH:mm:ss"
               (dateChange)="onDatePick('startDate', $event)">
        <mat-datepicker-toggle matSuffix [for]="pickerStart"></mat-datepicker-toggle>
        <mat-datepicker #pickerStart></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="fill">
        <mat-label>End Date</mat-label>
        <input matInput [matDatepicker]="pickerEnd"
               formControlName="endDate"
               placeholder="dd/MM/yyyy HH:mm:ss"
               (dateChange)="onDatePick('endDate', $event)">
        <mat-datepicker-toggle matSuffix [for]="pickerEnd"></mat-datepicker-toggle>
        <mat-datepicker #pickerEnd></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="fill" class="grow">
        <mat-label>Match Account</mat-label>
        <input matInput formControlName="matchAccount" />
      </mat-form-field>

      <mat-form-field appearance="fill" class="w-120">
        <mat-label>Limit</mat-label>
        <input matInput type="number" min="1" formControlName="limit" />
      </mat-form-field>

      <mat-form-field appearance="fill" class="w-120">
        <mat-label>Offset</mat-label>
        <input matInput type="number" min="0" formControlName="offset" />
      </mat-form-field>

      <button mat-raised-button color="primary" type="submit" [disabled]="disabled || form.invalid">
        Search
      </button>
    </div>

    <!-- Switch MatchingStatus -->
    <div class="row align">
      <span class="mr">Matching:</span>
      <mat-button-toggle-group formControlName="matchingStatus" aria-label="Matching status">
        <mat-button-toggle value="NoMatched">No matched yet</mat-button-toggle>
        <mat-button-toggle value="Matched">Matched</mat-button-toggle>
      </mat-button-toggle-group>
    </div>

    <!-- Match Tag (n'apparaît que si NoMatched) -->
    @if (form.get('matchingStatus')?.value === 'NoMatched') {
      <div class="row">
        <mat-form-field appearance="fill" class="grow">
          <mat-label>Match tag</mat-label>
          <input matInput formControlName="matchTag" placeholder="ex: TAG_ABC_2025" />
        </mat-form-field>
      </div>
    }
  </form>
</mat-card>

<style>
  .search-card { padding: 12px; border-radius: 10px; }
  .is-disabled { opacity: .6; pointer-events: none; }
  .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
  .align { align-items: center; margin-top: 8px; }
  .grow { flex: 1 1 260px; }
  .w-120 { width: 120px; }
  mat-form-field { width: 240px; min-width: 200px; }
</style>