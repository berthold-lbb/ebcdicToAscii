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
