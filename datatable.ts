import {
  AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewChild
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { ITableColonne, TableDataType } from '../model/table-colonne.model';

@Component({
  selector: 'lib-data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent<T> implements AfterViewInit {
  TableDataType = TableDataType;

  // ====== Etat interne ======
  private _columns: ITableColonne[] = [];
  private _hidden = new Set<string>();

  dataSource = new MatTableDataSource<T>([]);
  visibleColumnDefs: ITableColonne[] = [];
  displayedColumns: string[] = [];
  autoLength = 0; // longueur client-side

  // ====== Entrées ======
  @Input() set data(value: T[] | null | undefined) {
    this.dataSource.data = value ?? [];
    if (!this.serverSide) this.autoLength = this.dataSource.data?.length ?? 0;
    if (this.autoStopLoadingOnData) this.loading = false;
  }

  @Input() set columns(value: ITableColonne[] | null | undefined) {
    this._columns = (value ?? []).map(c => ({ ...c }));
    this.recomputeVisible();
  }

  /** Colonnes initialement masquées (noms) */
  @Input() set hiddenColumns(value: string[] | null | undefined) {
    this._hidden = new Set((value ?? []).filter(Boolean));
    this.recomputeVisible();
  }
  /** Pour permettre [(hiddenColumns)] côté parent */
  @Output() hiddenColumnsChange = new EventEmitter<string[]>();

  @Input() enableOrder = true;

  // Pagination: client (par défaut) ou serveur
  @Input() serverSide = false;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50];
  @Input() total = 0; // utilisé seulement en serverSide

  // UI/UX
  @Input() maxHeight = 520;           // px
  @Input() stickyHeader = true;
  @Input() loading = false;
  @Input() autoStopLoadingOnData = true;

  /** Afficher le menu “Colonnes” */
  @Input() showColumnMenu = true;

  // ====== Sortie (pour le mode serveur) ======
  @Output() pageChange = new EventEmitter<PageEvent>();
  @Output() sortChange = new EventEmitter<Sort>();

  // ====== ViewChild ======
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // ====== Cycle ======
  ngAfterViewInit() {
    if (this.sort) {
      this.dataSource.sort = this.sort;
      if (this.serverSide) {
        this.sort.sortChange.subscribe(s => this.sortChange.emit(s));
      }
    }

    if (this.paginator) {
      this.dataSource.paginator = this.serverSide ? undefined : this.paginator;
      if (this.serverSide) {
        this.paginator.page.subscribe(p => this.pageChange.emit(p));
      }
    }
  }

  // ====== Helpers ======
  trackByCol = (_: number, c: ITableColonne) => c.nom;

  /** Public: savoir si une colonne est masquée (respecte retractable) */
  isHidden(col: ITableColonne): boolean {
    return col.retractable && this._hidden.has(col.nom);
  }

  /** Toggle depuis le menu */
  toggleColumn(col: ITableColonne): void {
    if (!col.retractable) return;
    if (this._hidden.has(col.nom)) this._hidden.delete(col.nom);
    else this._hidden.add(col.nom);
    this.recomputeVisible();
    this.hiddenColumnsChange.emit(Array.from(this._hidden));
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


--------------------------------------------------------------------------------------------------------------
--------------------------------------------------------------------------------------------------------------

import {
  AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter,
  Input, Output, ViewChild, OnChanges, SimpleChanges
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; // 🔹
import { MatProgressBarModule } from '@angular/material/progress-bar';         // 🔹
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs/operators';

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
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatCheckboxModule, MatFormFieldModule, MatInputModule,
    MatIconModule, MatMenuModule, MatButtonModule,
    MatProgressSpinnerModule, MatProgressBarModule, // 🔹
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

  // ===== Sélection =====
  @Input() selectable = true;
  @Input() selectionMode: 'single'|'multiple' = 'multiple';
  selection = new SelectionModel<T>(true, []);
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

  // ===== UI =====
  @Input() stickyHeader = true;

  // ===== Loader ===== 🔹
  /** Active l’overlay de chargement (spinner au centre + barre fine en haut) */
  @Input() loading = false;
  /** Texte optionnel sous le spinner */
  @Input() loadingText: string | null = null;
  /** Afficher une barre de progression fine en haut */
  @Input() showTopBarWhileLoading = true;

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
  isAllSelected(): boolean {
    const pageRows = this._currentPageRows();
    return pageRows.length > 0 && pageRows.every(r => this.selection.isSelected(r));
  }
  masterToggle(): void {
    const pageRows = this._currentPageRows();
    if (this.isAllSelected()) pageRows.forEach(r => this.selection.deselect(r));
    else pageRows.forEach(r => this.selection.select(r));
    this.selectionChange.emit(this.selection.selected);
  }
  toggleRow(row: T): void {
    if (this.selectionMode === 'single') {
      this.selection.clear();
      this.selection.select(row);
    } else {
      this.selection.toggle(row);
    }
    this.selectionChange.emit(this.selection.selected);
  }
  checkboxLabel(row?: T): string {
    if (!row) return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row`;
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

--------------------
searchCtrl = new FormControl<string>('', { nonNullable: true });

constructor() {
  this.searchCtrl.valueChanges
    .pipe(startWith(''), debounceTime(300), distinctUntilChanged())
    .subscribe(q => {
      const query = (q ?? '').trim();
      if (this.serverSide) {
        this.filterChange.emit(query);
      } else {
        // filtrage client
        this.dataSource.filter = query.toLowerCase();
        if (this.paginator) this.paginator.firstPage();
      }
    });

  // prédicat de filtre (client)
  this.dataSource.filterPredicate = (row: any, filter: string) => {
    const q = filter.toLowerCase();
    const keys = this.filterKeys?.length ? this.filterKeys : Object.keys(row);
    return keys.some(k => {
      const v = row[k];
      const s = (typeof v === 'object') ? JSON.stringify(v) : String(v ?? '');
      return s.toLowerCase().includes(q);
    });
  };
}
