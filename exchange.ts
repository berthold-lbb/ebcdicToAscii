// lib-data-table.component.ts (extraits pertinents)

import {
  Component, Input, TemplateRef, ViewChild, AfterViewInit,
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Observable, from, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

export class DataTableComponent<T extends Record<string, any>> implements AfterViewInit {

  // ========= Déjà présent chez toi =========
  dataSource = new MatTableDataSource<T>([]);
  displayedColumns: string[] = [];         // tes colonnes normales
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // ========= [DÉTAILS DE LIGNE] – API publique =========

  /** Active/désactive la vue détail sur double-clic */
  @Input() enableRowDetail = true;

  /** Clé d’identification unique d’une ligne (facultatif mais recommandé si serveur) */
  @Input() rowIdKey: keyof T | null = null;

  /** Template de détail projeté par le parent */
  private _rowDetailTpl?: TemplateRef<any>;
  @Input() set rowDetailTemplate(tpl: TemplateRef<any> | null | undefined) {
    this._rowDetailTpl = tpl ?? undefined;
  }
  get rowDetailTemplate(): TemplateRef<any> | undefined { return this._rowDetailTpl; }

  /**
   * Fonction asynchrone fournie par le parent pour charger le détail
   * (peut retourner Promise ou Observable). Facultative.
   */
  @Input() detailLoader?: (row: T) => Promise<any> | Observable<any>;

  /** Mise en cache des résultats de détail par id (true par défaut) */
  @Input() detailCache = true;

  // ========= [DÉTAILS DE LIGNE] – État interne =========

  /** id (ou index) de la ligne actuellement ouverte */
  expandedId: string | number | null = null;

  /** map id -> { data, error } */
  private _detailMap = new Map<string | number, { data: any; error?: any }>();

  /** id de la ligne en cours de chargement (pour spinner) */
  private _detailLoadingId: string | number | null = null;

  private _detailSub: Subscription | null = null;

  // ========= [DÉTAILS DE LIGNE] – Helpers pour le template =========

  get isDetailLoading(): boolean {
    return this._detailLoadingId != null && this._detailLoadingId === this.expandedId;
  }
  get detailData(): any | null {
    if (this.expandedId == null) return null;
    return this._detailMap.get(this.expandedId)?.data ?? null;
  }
  get detailError(): any | null {
    if (this.expandedId == null) return null;
    return this._detailMap.get(this.expandedId)?.error ?? null;
  }

  // ========= [DÉTAILS DE LIGNE] – Lifecycle =========

  ngAfterViewInit(): void {
    // Si tu veux automatiquement fermer le détail lorsqu’on change de page/tri :
    if (this.paginator) this.paginator.page.subscribe(() => (this.expandedId = null));
    if (this.sort) this.sort.sortChange.subscribe(() => (this.expandedId = null));
  }

  // ========= [DÉTAILS DE LIGNE] – Actions =========

  /** Double-clic sur une ligne : ouvre/ferme la vue détail et déclenche le chargement */
  onRowDblClick(row: T, indexInPage: number): void {
    if (!this.enableRowDetail) return;
    const id = this._rowKey(row, indexInPage);
    const opening = this.expandedId !== id;
    this.expandedId = opening ? id : null;
    if (opening) this._maybeLoadDetail(row, id);
  }

  /** Relancer manuellement le chargement du détail courant (depuis le template) */
  reloadDetail(row: T) {
    if (this.expandedId == null) return;
    this._detailMap.delete(this.expandedId);
    this._maybeLoadDetail(row, this.expandedId);
  }

  /** Retourne la ligne actuellement ouverte (utile si besoin dans le template) */
  getExpandedRow(): T | null {
    if (this.expandedId == null) return null;
    const base = this.dataSource.filteredData?.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    if (!base) return null;

    if (this.rowIdKey) {
      return base.find(r => String(r[this.rowIdKey!]) === String(this.expandedId)) ?? null;
    }
    // mode sans id : on stockait l’index global
    const idx = Number(this.expandedId);
    return Number.isFinite(idx) ? base[idx] ?? null : null;
  }

  // ========= [DÉTAILS DE LIGNE] – Privé =========

  /** clé unique pour une ligne (id métier si rowIdKey fourni, sinon index global) */
  private _rowKey(row: T, indexInPage: number): string | number {
    if (this.rowIdKey) return row[this.rowIdKey] as any;
    const start = this.paginator ? this.paginator.pageIndex * this.paginator.pageSize : 0;
    return start + indexInPage; // index global
    // NB: si tu es en 100% serveur, préfère rowIdKey pour que l’état survive aux pages
  }

  /** Déclenche (si nécessaire) le chargement du détail pour un id donné */
  private _maybeLoadDetail(row: T, id: string | number) {
    if (!this.detailLoader) return;
    if (this.detailCache && this._detailMap.has(id)) return; // déjà chargé

    // Annule le précédent
    this._detailSub?.unsubscribe();
    this._detailLoadingId = id;

    const src = this.detailLoader(row);
    const obs = (src as any)?.subscribe ? (src as Observable<any>) : from(Promise.resolve(src));

    this._detailSub = obs.pipe(
      finalize(() => { this._detailLoadingId = null; })
    ).subscribe({
      next: (resp) => this._detailMap.set(id, { data: resp, error: null }),
      error: (err) => this._detailMap.set(id, { data: null, error: err }),
    });
  }
}
--------------------------------------------------------------------------------

<!-- lib-data-table.component.html (extrait table) -->
<table mat-table
       [dataSource]="dataSource"
       matSort
       [multiTemplateDataRows]="true"
       class="mat-elevation-z2 dt-table">

  <!-- … tes <ng-container [matColumnDef]="..."> pour les colonnes normales … -->

  <!-- Ligne DATA (double-clic ouvre le détail) -->
  <tr mat-row
      *matRowDef="let row; let i = index; columns: displayedColumns"
      class="clickable-row"
      (dblclick)="onRowDblClick(row, i)">
  </tr>

  <!-- Colonne technique pour la ligne détail (pas dans displayedColumns) -->
  <ng-container matColumnDef="detail">
    <td mat-cell *matCellDef="let row" class="detail-cell"
        [attr.colspan]="displayedColumns.length">
      <!-- Contenu de la vue détail -->
      @if (isDetailLoading) {
        <div class="detail-loading">Chargement…</div>
      } @else if (rowDetailTemplate) {
        <ng-container
          [ngTemplateOutlet]="rowDetailTemplate"
          [ngTemplateOutletContext]="{
            $implicit: row,
            row: row,
            detail: detailData,
            loading: isDetailLoading,
            error: detailError,
            reload: reloadDetail.bind(this)
          }">
        </ng-container>
      } @else {
        <div class="detail-fallback"><strong>Détails : </strong>{{ row | json }}</div>
      }
    </td>
  </ng-container>

  <!-- Ligne DÉTAIL : visible quand le row courant est celui ouvert -->
  <tr mat-row
      *matRowDef="let row; columns: ['detail']"
      class="detail-row"
      [class.open]="getExpandedRow() === row">
  </tr>
</table>
--------------------------------------------------------------------------------
<!-- parent.component.html -->
<lib-data-table
  [data]="rows"
  [columns]="columns"
  [rowIdKey]="'id'"                    <!-- recommandé -->
  [rowDetailTemplate]="detailTpl"      <!-- template projeté -->
  [detailLoader]="loadDetail"          <!-- fonction de fetch (Promise/Observable) -->
  [detailCache]="true">
</lib-data-table>

<!-- Template de détail -->
<ng-template #detailTpl let-row let-detail="detail" let-loading="loading" let-error="error" let-reload="reload">
  @if (loading) {
    <div class="p-2">Chargement du détail pour <b>{{ row.id }}</b>…</div>
  } @else if (error) {
    <div class="p-2 text-warn">
      Erreur : {{ error?.message || (error | json) }}
      <button mat-button color="primary" (click)="reload(row)">Réessayer</button>
    </div>
  } @else {
    <div class="detail-grid">
      <div><b>ID :</b> {{ row.id }}</div>
      <div><b>Account :</b> {{ detail?.account }}</div>
      <div><b>Currency :</b> {{ detail?.currency }}</div>
      <div><b>Amount :</b> {{ detail?.amount | number:'1.0-2' }}</div>
    </div>
  }
</ng-template>


--------------------------------------------------------------------------------recent
import {
  AfterViewInit, ChangeDetectionStrategy, Component, ContentChild,
  EventEmitter, Input, OnChanges, Output, SimpleChanges, TemplateRef, ViewChild
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
  STRING=0, NUMBER=1, BOOLEAN=2, DATE=3, DATETIME=4, TIME=5, JSON=6, OBJECT=7, LINK=8
}
export interface ITableColonne {
  nom: string;
  label: string;
  type: TableDataType;
  enableOrder: boolean;
  retractable: boolean;
  link?: any;

  /** Rendez une cellule cliquable et recevez (cellClick) */
  clickable?: boolean;
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

  // ========================================================
  // Données & colonnes
  // ========================================================
  protected readonly TableDataType = TableDataType;

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

  // Afficher/masquer le bouton “Colonnes”
  @Input() showColumnRetractable = true;

  // ========================================================
  // Sélection (two-way binding)
  // ========================================================
  @Input() selectable = true;
  @Input() selectionMode: 'single'|'multiple' = 'multiple';

  /** SelectionModel interne */
  private selection = new SelectionModel<T>(true, []);

  /** API publique two-way */
  @Input()  selectedRows: T[] = [];
  @Output() selectedRowsChange = new EventEmitter<T[]>();
  /** (optionnel rétro-compat) */
  @Output() selectionChange = new EventEmitter<T[]>();

  // ========================================================
  // Tri & Pagination
  // ========================================================
  @Input() enableOrder = true;

  @Input() serverSide = false;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [5,10,25,50];
  @Input() total = 0;
  autoLength = 0;

  @Output() pageChange = new EventEmitter<PageEvent>();
  @Output() sortChange = new EventEmitter<Sort>();

  // ========================================================
  // Recherche
  // ========================================================
  @Input() searchable = true;
  @Input() filterPlaceholder = 'Search…';
  @Input() filterKeys: string[] = [];
  @Output() filterChange = new EventEmitter<string>();
  searchCtrl = new FormControl<string>('', { nonNullable: true });

  // ========================================================
  // UI / loader
  // ========================================================
  @Input() stickyHeader = true;
  @Input() loading = false;
  @Input() loadingText: string | null = null;
  @Input() showTopBarWhileLoading = true;

  // Coloration des lignes sélectionnées
  @Input() highlightSelection = false;
  @Input() highlightColor: string = '#E6F4EA';
  @Input() highlightBarColor: string = '#2E7D32';

  // Cellule cliquable
  @Output() cellClick = new EventEmitter<{ row: T; column: ITableColonne }>();
  onCellClick(ev: MouseEvent, row: T, col: ITableColonne) {
    ev.stopPropagation();
    this.cellClick.emit({ row, column: col });
  }

  // ========================================================
  // Vue Détail (ligne enfant, sans API)
  // ========================================================
  @Input() enableRowDetail = true;

  /** Template projeté depuis le parent (optionnel) */
  private _rowDetailTpl?: TemplateRef<any>;
  @Input() set rowDetailTemplate(tpl: TemplateRef<any> | null | undefined) {
    this._rowDetailTpl = tpl ?? undefined;
  }
  get rowDetailTemplate(): TemplateRef<any> | undefined { return this._rowDetailTpl; }

  /** Ligne actuellement ouverte */
  expandedRow: T | null = null;

  /** Predicate pour la 2e rowDef (ligne “détail”) */
  isDetailRow = (_index: number, row: T) => row === this.expandedRow;

  /** Double-clic : ouvre/ferme la vue détail */
  onRowDblClick(row: T): void {
    if (!this.enableRowDetail) return;
    this.expandedRow = (this.expandedRow === row) ? null : row;
  }

  // ========================================================
  // Mat refs
  // ========================================================
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // ========================================================
  // ctor
  // ========================================================
  constructor() {
    // Recherche
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

  // ========================================================
  // Hooks
  // ========================================================
  ngOnChanges(ch: SimpleChanges): void {
    // single / multiple
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
      this.sort.sortChange.subscribe(s => {
        if (this.serverSide) this.sortChange.emit(s);
        // ferme la vue détail quand on trie
        this.expandedRow = null;
      });
    }
    if (this.paginator) {
      this.dataSource.paginator = this.serverSide ? undefined : this.paginator;
      this.paginator.page.subscribe(p => {
        if (this.serverSide) this.pageChange.emit(p);
        // ferme la vue détail quand on change de page
        this.expandedRow = null;
      });
    }
  }

  // ========================================================
  // Sélection helpers
  // ========================================================
  isSelected = (row: T) => this.selection.isSelected(row);

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

  // ========================================================
  // Colonnes visibles
  // ========================================================
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

    // colonne select
    if (this.selectable && !this.displayedColumns.includes('select')) {
      this.displayedColumns = ['select', ...this.displayedColumns];
    }
    if (!this.selectable) {
      this.displayedColumns = this.displayedColumns.filter(c => c !== 'select');
    }
  }

  // ========================================================
  // Filtre client & pagination
  // ========================================================
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
--------------------------------------------------------------------------------

<div class="dt-root">
  <!-- Toolbar: menu colonnes + recherche -->
  <div class="dt-toolbar">
    <div class="left">
      @if (showColumnRetractable) {
        <button mat-button [matMenuTriggerFor]="colsMenu">
          <mat-icon>view_column</mat-icon> Colonnes
        </button>
        <mat-menu #colsMenu="matMenu" xPosition="after">
          @for (c of _columns; track c.nom) {
            <button mat-menu-item (click)="toggleColumn(c)" [disabled]="!c.retractable">
              <mat-icon class="mr-2">
                {{ isHidden(c) ? 'check_box_outline_blank' : 'check_box' }}
              </mat-icon>
              <span>{{ c.label }}</span>
              @if (!c.retractable) {
                <mat-icon class="ml-auto" matTooltip="Non rétractable">lock</mat-icon>
              }
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

  <!-- Loader top bar -->
  @if (loading && showTopBarWhileLoading) {
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  }

  <!-- Table -->
  <table mat-table [dataSource]="dataSource"
         class="mat-elevation-z2 dt-table"
         matSort
         [multiTemplateDataRows]="true">

    <!-- Colonne sélection -->
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
        <td mat-cell *matCellDef="let row" class="col-select">
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
            <td mat-cell class="data-table-colonne-{{ col.nom }}"
                [class.cell-clickable]="col.clickable"
                (click)="col.clickable && onCellClick($event, row, col)"
                *matCellDef="let row">
              {{ row[col.nom] }}
            </td>
          }
          @case (TableDataType.NUMBER) {
            <td mat-cell class="data-table-colonne-{{ col.nom }}" *matCellDef="let row">
              {{ row[col.nom] }}
            </td>
          }
          @case (TableDataType.BOOLEAN) {
            <td mat-cell class="data-table-colonne-{{ col.nom }}" *matCellDef="let row">
              {{ row[col.nom] }}
            </td>
          }
          @case (TableDataType.DATE) {
            <td mat-cell class="data-table-colonne-{{ col.nom }}" *matCellDef="let row">
              {{ row[col.nom] | date:'dd/MM/yyyy' }}
            </td>
          }
          @case (TableDataType.TIME) {
            <td mat-cell class="data-table-colonne-{{ col.nom }}" *matCellDef="let row">
              {{ row[col.nom] | date:'HH:mm:ss' }}
            </td>
          }
          @case (TableDataType.DATETIME) {
            <td mat-cell class="data-table-colonne-{{ col.nom }}" *matCellDef="let row">
              {{ row[col.nom] | date:'dd/MM/yyyy HH:mm:ss' }}
            </td>
          }
          @case (TableDataType.JSON) {
            <td mat-cell class="data-table-colonne-{{ col.nom }}" *matCellDef="let row">
              {{ row[col.nom] | json }}
            </td>
          }
          @case (TableDataType.OBJECT) {
            <td mat-cell class="data-table-colonne-{{ col.nom }}" *matCellDef="let row">
              {{ row[col.nom] }}
            </td>
          }
          @case (TableDataType.LINK) {
            <td mat-cell class="data-table-colonne-{{ col.nom }}" *matCellDef="let row">
              <a [routerLink]="[col.link, row[col.nom]]" (click)="$event.stopPropagation()">
                {{ row[col.nom] }}
              </a>
            </td>
          }
          @default {
            <td mat-cell class="data-table-colonne-{{ col.nom }}" *matCellDef="let row">
              {{ row[col.nom] }}
            </td>
          }
        }
      </ng-container>
    }

    <!-- Lignes normales -->
    @if (true) {
      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
    }

    <tr mat-row
        *matRowDef="let row; let i = index; columns: displayedColumns"
        class="clickable-row"
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
            <ng-container *ngTemplateOutlet="rowDetailTemplate; context: {$implicit: row, row: row}"></ng-container>
          } @else {
            <div class="detail-fallback">
              <strong>Détails :</strong> {{ row | json }}
            </div>
          }
        </div>
      </td>
    </ng-container>

    <!-- Ligne de détail (n’apparaît que si isDetailRow === true) -->
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

  <!-- Loader overlay centré -->
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
--------------------------------------------------------------------------------
<!-- parent.component.html -->
<lib-data-table
  [data]="rows"
  [columns]="columns"
  [enableOrder]="true"
  [pageSize]="10"
  [pageSizeOptions]="[5,10,25,50]"
  [searchable]="true"
  [showColumnRetractable]="true"
  [enableRowDetail]="true"
  [rowDetailTemplate]="detailTpl"
  (cellClick)="onCellClick($event)">
</lib-data-table>

<!-- Vue détail locale (pas d’API) -->
<ng-template #detailTpl let-row>
  <div style="background: rgba(0,0,0,.04); padding:12px; border-left:3px solid #2E7D32;">
    <div><b>ID:</b> {{ row.id }}</div>
    <div><b>Account:</b> {{ row.account }}</div>
    <div><b>Currency:</b> {{ row.currency }}</div>
    <div><b>Amount:</b> {{ row.amount | number:'1.0-2' }}</div>
  </div>
</ng-template>

