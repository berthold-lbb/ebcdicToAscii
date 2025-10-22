2) data-table.component.ts (blocs à remplacer)
import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, EventEmitter, Input, OnChanges, Output,
  SimpleChanges, TemplateRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { CdkDrag, CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';          // ⬅️ DnD

export type IdType = string | number;

export interface DetailRow<T> {
  __detail: true;
  forId: IdType;
  host: T;
}

export interface GroupHeaderRow<T> {                                                // ⬅️ on garde ta forme
  __group: true;
  key: string;                 // unique: level|field0=val0|field1=val1…
  level: number;               // 0..n
  values: Record<string, unknown>;
  rows?: T[];
  count: number;
  collapsed?: boolean;
}

@Component({
  selector: 'lib-data-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule, MatPaginatorModule, MatSortModule,
    CdkDrag, CdkDropList
  ],
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent<T extends Record<string, any>>
  implements AfterViewInit, OnChanges {

  // ======== EXISTANT (garde tes inputs/outputs actuels) ========
  dataSource = new MatTableDataSource<T>([]);
  @Input() columns: Array<{ nom: string; label: string; /* … tes champs … */ }>= [];
  @Input() displayedColumns: string[] = [];
  @Input() rowDetailTemplate?: TemplateRef<any>;
  @Input() rowIdKey?: keyof T;             // si dispo côté parent
  @Input() serverSide = false;
  @Input() total = 0;
  // … garde sélection, recherche, surlignage, etc.

  // ======== GROUPING – API ========
  @Input() enableGrouping = true;           // active/désactive toute la feature
  @Input() groupBy: string[] = [];          // ordre des niveaux
  @Output() groupByChange = new EventEmitter<string[]>();

  /** sens de tri par champ de groupement (asc/desc) */
  private groupSort = new Map<string, 'asc' | 'desc'>();

  /** headers ouverts (clé) */
  private _groupOpen = new Set<string>();

  /** “corbeille” DropList pour l’en-tête (drag back to header) */
  headerDropBin: string[] = [];

  // ======== TYPE GUARDS ========
  isDetailRow = (_: number, row: any): row is DetailRow<T> =>
    !!row && typeof row === 'object' && (row as any).__detail === true;

  isGroupHeaderRow = (_: number, row: any): row is GroupHeaderRow<T> =>
    !!row && typeof row === 'object' && (row as any).__group === true;

  isDataRow = (_: number, row: any): row is T =>
    !!row && typeof row === 'object' && !(row as any).__detail && !(row as any).__group;

  // ======== IDs stables (si pas de rowIdKey) ========
  private _ids = new WeakMap<T, number>();
  private _seq = 1;
  private _rowId(row: T): IdType {
    if (this.rowIdKey && row[this.rowIdKey] != null) return row[this.rowIdKey] as any as IdType;
    const known = this._ids.get(row);
    if (known != null) return known;
    const id = this._seq++; this._ids.set(row, id); return id;
  }
  private _ensureStableIds(rows: T[]): void {
    if (this.rowIdKey) return;
    for (const r of rows) if (!this._ids.has(r)) this._ids.set(r, this._seq++);
  }

  // ======== Base + pagination client ========
  private baseRows(): T[] {
    return this.dataSource.filteredData?.length
      ? (this.dataSource.filteredData as T[])
      : (this.dataSource.data as T[]);
  }
  private pageSlice<R>(arr: R[]): R[] {
    if (!this.paginator || this.serverSide) return arr;
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return arr.slice(start, start + this.paginator.pageSize);
  }

  // ======== GROUPING – logique ========
  private makeKey(level: number, values: Record<string, unknown>): string {
    const segs = Array.from({ length: level + 1 }, (_, i) => this.groupBy[i])
      .map(f => `${f}=${String(values[f])}`);
    return `${level}|${segs.join('|')}`;
  }

  private groupRows(base: T[]): Array<T | GroupHeaderRow<T>> {
    if (!this.enableGrouping || this.groupBy.length === 0) return base;

    // Tri suivant groupBy + sens par niveau
    const sorted = [...base].sort((a, b) => {
      for (const f of this.groupBy) {
        const dir = this.groupSort.get(f) ?? 'asc';
        const av = (a as any)[f]; const bv = (b as any)[f];
        if (av == null && bv == null) continue;
        if (av == null) return dir === 'asc' ? -1 : 1;
        if (bv == null) return dir === 'asc' ?  1 : -1;
        if (av <  bv) return dir === 'asc' ? -1 : 1;
        if (av >  bv) return dir === 'asc' ?  1 : -1;
      }
      return 0;
    });

    const out: Array<T | GroupHeaderRow<T>> = [];
    let prev: Record<string, unknown> = {};

    const valuesAt = (row: T, level: number): Record<string, unknown> => {
      const o: Record<string, unknown> = {};
      for (let i = 0; i <= level; i++) { const f = this.groupBy[i]; o[f] = (row as any)[f]; }
      return o;
    };

    const pushHeader = (level: number, vals: Record<string, unknown>) => {
      const key = this.makeKey(level, vals);
      out.push({
        __group: true,
        key, level, values: vals,
        count: 0,
        collapsed: !this._groupOpen.has(key)
      } as GroupHeaderRow<T>);
    };

    for (const row of sorted) {
      for (let level = 0; level < this.groupBy.length; level++) {
        const vals = valuesAt(row, level);
        const changed =
          level === 0
            ? prev[this.groupBy[0]] !== vals[this.groupBy[0]]
            : this.groupBy.slice(0, level + 1).some(f => prev[f] !== vals[f]);
        if (changed) {
          pushHeader(level, vals);
          for (let i = 0; i <= level; i++) prev[this.groupBy[i]] = vals[this.groupBy[i]];
          for (let i = level + 1; i < this.groupBy.length; i++) delete prev[this.groupBy[i]];
        }
      }
      // incrément du dernier header rencontré
      const last = this.groupBy.length - 1;
      if (last >= 0) {
        const vals = valuesAt(row, last);
        const key = this.makeKey(last, vals);
        // cherche depuis la fin le dernier header
        for (let i = out.length - 1; i >= 0; i--) {
          const it = out[i];
          if (this.isGroupHeaderRow(0, it)) { it.count++; break; }
        }
      }
      out.push(row);
    }
    return out;
  }

  private applyCollapse(seq: Array<T | GroupHeaderRow<T> | DetailRow<T>>)
  : Array<T | GroupHeaderRow<T> | DetailRow<T>> {
    if (!this.enableGrouping || this.groupBy.length === 0) return seq;

    const res: Array<T | GroupHeaderRow<T> | DetailRow<T>> = [];
    const open: boolean[] = [];

    for (const item of seq) {
      if (this.isGroupHeaderRow(0, item)) {
        const o = !item.collapsed;
        open[item.level] = o;
        for (let i = item.level + 1; i < open.length; i++) open[i] = false;
        res.push(item);
      } else if (this.isDataRow(0, item)) {
        if (open.slice(0, this.groupBy.length).every(Boolean)) res.push(item);
      } else {
        res.push(item); // detail row : laisser passer (insertion déjà faite)
      }
    }
    return res;
  }

  toggleGroupHeader(row: GroupHeaderRow<T>): void {
    row.collapsed = !row.collapsed;
    if (!row.collapsed) this._groupOpen.add(row.key); else this._groupOpen.delete(row.key);
  }

  cycleGroupSort(field: string): void {
    const cur = this.groupSort.get(field);
    const next: 'asc' | 'desc' = cur === 'asc' ? 'desc' : 'asc';
    this.groupSort.set(field, next);
    this.groupByChange.emit([...this.groupBy]); // notifie le parent si besoin
  }

  removeGroup(field: string): void {
    this.groupBy = this.groupBy.filter(f => f !== field);
    this.groupSort.delete(field);
    this.groupByChange.emit([...this.groupBy]);
  }

  // DnD : header → barre
  onDropToGrouping(ev: CdkDragDrop<string[]>): void {
    if (!this.enableGrouping) return;
    const field = ev.item.data as string;
    if (this.groupBy.includes(field)) return;
    this.groupBy = [...this.groupBy, field];
    if (!this.groupSort.has(field)) this.groupSort.set(field, 'asc');
    this.groupByChange.emit([...this.groupBy]);
  }
  // DnD : barre → header (annule ce groupement)
  onDropToHeader(ev: CdkDragDrop<string[]>): void {
    if (!this.enableGrouping) return;
    const field = ev.item.data as string;
    if (!this.groupBy.includes(field)) return;
    this.removeGroup(field);
  }

  // ======== rowsForRender ========
  expandedId: IdType | null = null;        // garde ta logique d’ouverture détail
  get rowsForRender(): Array<T | GroupHeaderRow<T> | DetailRow<T>> {
    const base = this.baseRows();
    this._ensureStableIds(base);

    const g = this.groupRows(base);
    const visible = this.applyCollapse(g as any);

    // insérer ligne détail si visible
    if (this.expandedId == null) return this.pageSlice(visible);

    const withDetail: Array<T | GroupHeaderRow<T> | DetailRow<T>> = [];
    for (const item of visible) {
      withDetail.push(item);
      if (this.isDataRow(0, item) && this._rowId(item) === this.expandedId) {
        withDetail.push({ __detail: true, forId: this.expandedId, host: item } as DetailRow<T>);
      }
    }
    return this.pageSlice(withDetail);
  }

  // ======== cycle de vie que tu avais déjà ========
  constructor(private cdr: ChangeDetectorRef) {}
  ngOnChanges(_: SimpleChanges): void {}
  ngAfterViewInit(): void {}
  // … tri MatSort, recherche, sélection etc. restent
}

3) data-table.component.html

Barre de groupement à gauche, tes icônes/search à droite.
Les cellules d’en-tête sont draggables si la colonne n’est pas déjà groupée.
La ligne <thead> est un drop target pour “drag back to header”.

<div class="dt-root">

  <!-- ========== TOOLBAR ========== -->
  <div class="dt-toolbar">
    <!-- Gauche : zone de groupement -->
    <div class="dt-toolbar-left" *ngIf="enableGrouping">
      <div class="group-drop"
           cdkDropList
           [cdkDropListData]="groupBy"
           (cdkDropListDropped)="onDropToGrouping($event)">
        <span class="hint">Drag a column header here to group by that column</span>

        <div class="group-chips" *ngIf="groupBy.length">
          <ng-container *ngFor="let f of groupBy">
            <div class="chip" cdkDrag [cdkDragData]="f" cdkDragPreviewClass="drag-chip">
              <span class="label">{{ (columns.find(c => c.nom===f)?.label) || f }}</span>
              <button mat-icon-button class="icon" (click)="cycleGroupSort(f)" matTooltip="Toggle sort">
                <mat-icon>swap_vert</mat-icon>
              </button>
              <button mat-icon-button class="icon danger" (click)="removeGroup(f)" matTooltip="Remove">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </ng-container>
        </div>
      </div>
    </div>

    <!-- Droite : tes actions existantes (icônes + search) -->
    <div class="dt-toolbar-right">
      <!-- … tes boutons … -->
      <mat-form-field appearance="outline" class="dt-search-field" *ngIf="searchable">
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [placeholder]="filterPlaceholder" [formControl]="searchCtrl">
      </mat-form-field>
    </div>
  </div>

  <!-- ========== TABLE + SCROLL ========== -->
  <div class="dt-center dt-scroll">
    <table mat-table [dataSource]="rowsForRender" class="dt-table" multiTemplateDataRows>

      <!-- thead comme drop target pour “drag back to header” -->
      <thead cdkDropList (cdkDropListDropped)="onDropToHeader($event)">
        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      </thead>

      <!-- En-têtes : draggables uniquement si pas groupés -->
      <ng-container *ngFor="let col of columns" [matColumnDef]="col.nom">
        <th mat-header-cell *matHeaderCellDef
            cdkDrag [cdkDragData]="col.nom" cdkDragPreviewClass="drag-header"
            *ngIf="!groupBy.includes(col.nom)">
          {{ col.label }}
        </th>
      </ng-container>

      <!-- Cells data (ton switch/type formatting actuel) -->
      <ng-container *ngFor="let col of columns" [matColumnDef]="col.nom">
        <td mat-cell *matCellDef="let row" *ngIf="isDataRow(0,row)">
          {{ row[col.nom] }}
        </td>
      </ng-container>

      <!-- Group header row -->
      <ng-container matColumnDef="__groupheader">
        <td mat-cell *matCellDef="let row" [attr.colspan]="displayedColumns.length"
            *ngIf="isGroupHeaderRow(0,row)">
          <div class="group-header" [style.padding-left.px]="16 + row.level*16">
            <button mat-icon-button class="chev" (click)="toggleGroupHeader(row)">
              <mat-icon>{{ row.collapsed ? 'chevron_right' : 'expand_more' }}</mat-icon>
            </button>
            <div class="title">
              <strong>{{ groupBy[row.level] }}:</strong>
              <span>{{ row.values[groupBy[row.level]] }}</span>
              <span class="count">({{ row.count }})</span>
            </div>
          </div>
        </td>
      </ng-container>

      <!-- Detail row -->
      <ng-container matColumnDef="detail">
        <td mat-cell class="detail-cell" *matCellDef="let row" [attr.colspan]="displayedColumns.length"
            *ngIf="isDetailRow(0,row)">
          <div class="detail-card">
            <ng-container *ngIf="rowDetailTemplate; else detailFallback"
                          [ngTemplateOutlet]="rowDetailTemplate"
                          [ngTemplateOutletContext]="{ $implicit: row.host, row: row.host }">
            </ng-container>
            <ng-template #detailFallback>
              <div class="detail-fallback"><strong>Détails:</strong> {{ row.host | json }}</div>
            </ng-template>
          </div>
        </td>
      </ng-container>

      <!-- Row defs -->
      <tr mat-row *matRowDef="let row; columns: displayedColumns" *ngIf="isDataRow(0,row)"></tr>
      <tr mat-row *matRowDef="let row; columns: ['__groupheader']" *ngIf="isGroupHeaderRow(0,row)"></tr>
      <tr mat-row *matRowDef="let row; columns: ['detail']" *ngIf="isDetailRow(0,row)"></tr>
    </table>
  </div>

  <!-- ========== PAGINATOR ========== -->
  <mat-paginator #paginator
    [length]="serverSide ? total : (dataSource.filteredData?.length || dataSource.data.length)"
    [pageSize]="10"
    [pageSizeOptions]="[5,10,25,50]"
    [showFirstLastButtons]="true">
  </mat-paginator>
</div>

4) data-table.component.scss (ajouts)
.dt-toolbar{ display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background:#fafafa; border-bottom:1px solid #e0e0e0; }
.dt-toolbar-left{ display:flex; align-items:center; gap:8px; }
.dt-toolbar-right{ display:flex; align-items:center; gap:8px; }

.group-drop{ display:flex; align-items:center; gap:8px; padding:6px 10px; border:1px dashed #c7c7c7; border-radius:20px; background:#fff; }
.group-drop .hint{ color:#888; font-size:.9rem; }
.group-chips{ display:flex; gap:6px; }
.chip{ display:flex; align-items:center; gap:4px; padding:4px 10px; border-radius:20px; background:#e9ecef; }
.chip .label{ font-weight:600; }
.chip .icon{ width:28px; height:28px; }
.chip .danger{ color:#b00020; }

.drag-header,.drag-chip{ padding:6px 12px; border-radius:16px; background:#eee; box-shadow:0 2px 8px rgba(0,0,0,.15); }

.dt-center.dt-scroll{ overflow-x:auto; overflow-y:hidden; position:relative; background:#fafafa; }
.dt-table{ min-width:max-content; width:100%; border:1px solid #e0e0e0; border-radius:8px; background:#fff; }

.group-header{ display:flex; align-items:center; gap:6px; padding:6px 0; }
.group-header .title{ display:flex; align-items:baseline; gap:6px; }
.group-header .count{ color:#777; }
.detail-card{ margin-left:24px; border-left:4px solid #2e7d32; background:#f7f9fc; padding:12px; border-radius:8px; }

5) À supprimer de ton ancien code

Anciennes fonctions/groupes : groupRows(...), applyCollapse(...), ancien rowsForRender si différent, anciens isGroupHeader... avec autre nommage.

Toute UI ancienne de groupement (liste de colonnes “disponibles” en bas, etc.).

À garder : tout le reste (types de colonnes, pipes, sélection, recherche, tri MatSort, détail).

6) Exemple d’utilisation (parent)
<lib-data-table
  [data]="rows"
  [columns]="cols"
  [displayedColumns]="cols.map(c=>c.nom)"
  [enableGrouping]="true"
  [groupBy]="['state','phone']"           <!-- multi-niveau -->
  (groupByChange)="groupBy = $event"
  [rowDetailTemplate]="detailTpl">
</lib-data-table>

<ng-template #detailTpl let-row>
  <strong>Row:</strong> {{ row | json }}
</ng-template>