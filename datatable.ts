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