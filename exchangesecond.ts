Parfait — voici une intégration complète (TS + HTML) pour ajouter le grouping avec glisser-déposer (Angular CDK) à ton lib-data-table, sans casser tes autres fonctionnalités (sélection, pagination client/serveur, tri, détail de ligne, toolbar/paginator fixes, etc.).

Je marque clairement les ajouts avec // 🆕 et les blocs à conserver par // … (ton code existant).

data-table.component.ts (extraits complets avec ajouts)
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

// 🆕 CDK drag-and-drop
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

export enum TableDataType { STRING, NUMBER, BOOLEAN, DATE, DATETIME, TIME, JSON, OBJECT, LINK /* … tes autres types */ }
export interface ITableColonne {
  nom: string;
  label: string;
  type: TableDataType;
  enableOrder: boolean;
  retractable: boolean;
  link?: any;
  clickable?: boolean;

  // 🆕 (optionnel) interdiction de grouper sur cette colonne
  groupable?: boolean;
}

// === Lignes “techniques” =====
type IdType = string | number;

// 🆕 En-tête de groupe
interface GroupHeaderRow {
  __group: true;
  level: number;       // 0,1,2…
  field: string;       // nom de colonne
  value: any;          // valeur du groupe
  count: number;       // nb d’éléments dans ce groupe (feuilles)
}

// (tu as déjà une ligne détail ; on la garde telle quelle)
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
    ReactiveFormsModule,
    // 🆕 CDK directives
    CdkDropList, CdkDrag
  ],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent<T extends Record<string, any>>
  implements AfterViewInit, OnChanges {

  protected readonly TableDataType = TableDataType;

  // ====== TON ETAT EXISTANT : colonnes, datasource, sélection, tri, pagination, filtre… ======
  // … (ton code existant inchangé)

  // =======================
  // 🆕 1) API de Grouping
  // =======================
  /** Active/désactive complètement l’UI et la logique de regroupement */
  @Input() enableGrouping = false;

  /** Colonnes actuellement utilisées pour le regroupement (ordre = priorité) */
  @Input() groupedBy: string[] = [];

  /** Remonte les changements au parent si tu veux les persister */
  @Output() groupedByChange = new EventEmitter<string[]>();

  /** Ouvre/ferme les groupes (clé = chemin “field=value|field2=value2…”) */
  private _groupOpen = new Set<string>();

  /** Utilitaire : valeur affichable pour l’en-tête de groupe */
  private _formatGroupLabel(field: string, val: any): string {
    const col = this._columns.find(c => c.nom === field);
    const label = col?.label ?? field;
    return `${label}: ${val ?? '—'}`;
  }

  // =======================
  // 🆕 2) Drag & drop header
  // =======================
  /** Colonnes éligibles au grouping (filtrées de celles déjà groupées) */
  get groupableColumns(): ITableColonne[] {
    if (!this.enableGrouping) return [];
    return this.visibleColumnDefs
      .filter(c => (c.groupable ?? true))  // par défaut groupable
      .filter(c => !this.groupedBy.includes(c.nom));
  }

  /** Déplacement dans la barre de grouping */
  onDropGrouping(ev: CdkDragDrop<string[]>) {
    // réordonner l’existant
    moveItemInArray(this.groupedBy, ev.previousIndex, ev.currentIndex);
    this.groupedByChange.emit([...this.groupedBy]);
  }

  /** Ajout depuis la liste “disponibles” -> zone groupée */
  addGroup(field: string) {
    if (!this.groupedBy.includes(field)) {
      this.groupedBy = [...this.groupedBy, field];
      this.groupedByChange.emit([...this.groupedBy]);
    }
  }

  /** Retrait d’un niveau de regroupement */
  removeGroupAt(index: number) {
    const copy = [...this.groupedBy];
    copy.splice(index, 1);
    this.groupedBy = copy;
    this.groupedByChange.emit([...this.groupedBy]);
  }

  /** Bascule ouvert/fermé d’un header de groupe */
  toggleGroup(key: string) {
    if (this._groupOpen.has(key)) this._groupOpen.delete(key);
    else this._groupOpen.add(key);
  }

  // =====================================================
  // 🆕 3) Construction des lignes à rendre (group + détail)
  // =====================================================
  /** Récupère les lignes “de base” (après tri/filtre, avant pagination) */
  private _baseRows(): T[] {
    const data = this.dataSource.filteredData?.length
      ? this.dataSource.filteredData
      : (this.dataSource.data ?? []);
    return data;
  }

  /** Applique pagination client sur un tableau donné */
  private _pageSlice(rows: (T | GroupHeaderRow | DetailRow)[]): (T | GroupHeaderRow | DetailRow)[] {
    if (!this.paginator || this.serverSide) return rows;
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return rows.slice(start, start + this.paginator.pageSize);
    // (NB : pagination *après* grouping pour un rendu cohérent)
  }

  /** Clé hiérarchique unique d’un groupe en fonction d’un chemin */
  private _groupKey(path: Array<{ field: string; value: any }>): string {
    return path.map(p => `${p.field}=${String(p.value)}`).join('|');
  }

  /** Algo de regroupement simple (n niveaux) */
  private _groupRows(base: T[]): (T | GroupHeaderRow)[] {
    if (!this.enableGrouping || this.groupedBy.length === 0) return base;

    const out: (T | GroupHeaderRow)[] = [];

    const recurse = (
      rows: T[],
      level: number,
      path: Array<{ field: string; value: any }>
    ) => {
      const field = this.groupedBy[level];
      if (!field) {
        // feuille : pas de niveau suivant
        rows.forEach(r => out.push(r));
        return;
      }

      // partitionner par valeur
      const bucket = new Map<any, T[]>();
      for (const r of rows) {
        const v = r[field];
        const existing = bucket.get(v);
        if (existing) existing.push(r);
        else bucket.set(v, [r]);
      }

      // pour chaque groupe, émettre un header puis descendre
      for (const [val, list] of bucket.entries()) {
        const keyPath = [...path, { field, value: val }];
        const key = this._groupKey(keyPath);

        out.push({
          __group: true,
          level,
          field,
          value: val,
          count: list.length
        });

        // si le groupe est fermé : ne pas développer
        if (!this._groupOpen.has(key)) continue;

        if (level < this.groupedBy.length - 1) {
          recurse(list, level + 1, keyPath);
        } else {
          list.forEach(r => out.push(r));
        }
      }
    };

    recurse(base, 0, []);
    return out;
  }

  /** Id stable (tu as déjà la logique — inchangée) */
  // … _ensureStableIds, _rowId, etc. (ton code existant)

  /** Construit les lignes finales (grouping -> détail -> pagination) */
  get rowsForRender(): Array<T | GroupHeaderRow | DetailRow> {
    // 1) base après filtre/tri
    const base = this._baseRows();

    // 2) regrouper si activé
    const grouped = this._groupRows(base);

    // 3) insérer une éventuelle ligne de détail (si la ligne ouverte est visible)
    const withDetail: Array<T | GroupHeaderRow | DetailRow> = [];
    for (let i = 0; i < grouped.length; i++) {
      const r = grouped[i];
      withDetail.push(r);
      if ((r as any).__group || this.expandedId == null) continue;
      // r est une vraie ligne ? on vérifie l’id
      const isHost = this._rowId(r as T) === this.expandedId;
      if (isHost) {
        withDetail.push({ __detail: true, forId: this.expandedId, host: r } as DetailRow);
      }
    }

    // 4) pagination *après* grouping/détail
    return this._pageSlice(withDetail);
  }

  /** Predicates multi-templates */
  isGroupHeader = (_: number, row: any): row is GroupHeaderRow => !!row?.__group;
  isDetailRow  = (_: number, row: any): row is DetailRow  => !!row?.__detail;

  // ====== TON CODE EXISTANT : sélection, handlers, hooks paginator/sort, filtre, etc. ======
  // … (inchangé)
}

data-table.component.html (parties pertinentes)

Je garde ta structure « toolbar | table-wrap (scroll) | paginator ».
J’insère la barre de grouping dans la toolbar, puis une rowDef supplémentaire pour les headers de groupes.

<!-- ===== Toolbar (ta structure existante) ===== -->
<div class="dt-toolbar">
  <div class="dt-toolbar-left">
    <!-- … tes actions / titre … -->
  </div>

  <div class="dt-toolbar-right">
    <!-- 🆕 Zone grouping (affichée seulement si enableGrouping) -->
    <div class="dt-grouping" *ngIf="enableGrouping">
      <!-- Liste des colonnes groupées (drag re-order) -->
      <div
        class="dt-group-target"
        cdkDropList
        [cdkDropListData]="groupedBy"
        (cdkDropListDropped)="onDropGrouping($event)"
        aria-label="Group by drop area">

        <ng-container *ngIf="groupedBy.length; else emptyGrouping">
          <div class="dt-chip" *ngFor="let f of groupedBy; let i = index" cdkDrag>
            <span class="dt-chip-label">{{ _columns.find(c => c.nom===f)?.label || f }}</span>
            <button mat-icon-button (click)="removeGroupAt(i)" matTooltip="Remove">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </ng-container>

        <ng-template #emptyGrouping>
          <span class="dt-group-placeholder">Glissez une colonne ici pour regrouper</span>
        </ng-template>
      </div>

      <!-- Liste des colonnes disponibles (cliquables/draggables) -->
      <div class="dt-group-source">
        <div class="dt-chip ghost" *ngFor="let c of groupableColumns" (click)="addGroup(c.nom)" cdkDrag>
          {{ c.label }}
        </div>
      </div>
    </div>

    <!-- … ton champ de recherche / icônes … -->
  </div>
</div>

<!-- ===== Zone scroll + table ===== -->
<div class="dt-center dt-scroll">
  <div class="dt-table-wrap">
    <table mat-table
           [dataSource]="rowsForRender"
           [multiTemplateDataRows]="true"  <!-- important pour multi types -->
           matSort>

      <!-- ========= Colonne: GROUP HEADER (une seule cellule qui span) ========= -->
      <ng-container matColumnDef="__group__">
        <td mat-cell class="group-cell" [attr.colspan]="displayedColumns.length">
          <div class="group-header" [style.paddingLeft.px]="16 + row.level * 24">
            <button mat-icon-button (click)="toggleGroup(_groupKey([{field: row.field, value: row.value}]))"
                    [attr.aria-label]="'Toggle '+row.field">
              <mat-icon>expand_more</mat-icon>
            </button>
            <strong>{{ _formatGroupLabel(row.field, row.value) }}</strong>
            <span class="badge">{{ row.count }}</span>
          </div>
        </td>
      </ng-container>

      <!-- ========= Colonne: DETAIL ROW (comme tu l’avais) ========= -->
      <ng-container matColumnDef="__detail__">
        <td mat-cell class="detail-cell" [attr.colspan]="displayedColumns.length">
          <div class="detail-card">
            <ng-container *ngIf="rowDetailTemplate; else defaultDetail"
                          [ngTemplateOutlet]="rowDetailTemplate"
                          [ngTemplateOutletContext]="{ $implicit: row.host, row: row.host }">
            </ng-container>
            <ng-template #defaultDetail>
              <div class="detail-fallback"><strong>Détails:</strong> {{ row.host | json }}</div>
            </ng-template>
          </div>
        </td>
      </ng-container>

      <!-- ========= Tes colonnes de données existantes ========= -->
      <!-- (on garde ton *matColumnDef, tes switch @case types, etc.) -->
      <!-- … tes <ng-container matColumnDef="..."> existants … -->

      <!-- ========= RowDefs (ordre important) ========= -->
      <!-- 1) GROUP HEADER rows -->
      <tr mat-row *matRowDef="let row; columns: ['__group__']; when: isGroupHeader"></tr>

      <!-- 2) DETAIL rows -->
      <tr mat-row *matRowDef="let row; columns: ['__detail__']; when: isDetailRow"></tr>

      <!-- 3) DATA rows -->
      <tr mat-row *matRowDef="let row; columns: displayedColumns"
          (dblclick)="onRowDblClick(row)">
      </tr>

      <!-- Header row (inchangé) -->
      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
    </table>
  </div>
</div>

<!-- ===== Paginator (fixe) ===== -->
<div class="dt-paginator">
  <mat-paginator
    [length]="serverSide ? total : autoLength"
    [pageSize]="pageSize"
    [pageSizeOptions]="pageSizeOptions"
    [showFirstLastButtons]="true">
  </mat-paginator>
</div>

Styles rapides (SCSS) à ajouter
/* Barre de grouping dans la toolbar */
.dt-grouping {
  display: flex; align-items: center; gap: 10px;
  .dt-group-target {
    min-width: 260px; min-height: 38px; padding: 6px 8px;
    border: 1px dashed #bdbdbd; border-radius: 8px; background: #fff;
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  }
  .dt-group-placeholder { color: #888; font-size: .9rem; }
  .dt-group-source { display: flex; gap: 6px; flex-wrap: wrap; }
  .dt-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 8px; border-radius: 16px; background: #e8f0fe; color: #1a73e8;
    cursor: grab;
    &.ghost { background: #f3f6fc; color: #5f6368; }
    button { width: 24px; height: 24px; }
  }
}

/* Ligne header de groupe */
.group-cell { padding: 0 !important; background: #fafafa; }
.group-header {
  display: flex; align-items: center; gap: 6px;
  height: 40px; border-bottom: 1px solid #eee;
  .badge { margin-left: auto; background: #eee; border-radius: 10px; padding: 2px 8px; font-size: .75rem; }
}

/* Carte de détail (tu avais déjà un card ; garde ton style si besoin) */
.detail-card { margin: 8px 0 12px 24px; background: #f7f7fb; border: 1px solid #e9e9f4; border-radius: 8px; padding: 12px; }

Points importants

Aucune dépendance additionnelle à part @angular/cdk (déjà souvent présent avec Material).
Tu as juste importé CdkDropList et CdkDrag dans imports: [...].

enableGrouping=false ➜ la zone UI est masquée et _groupRows renvoie les lignes inchangées.
Donc le composant se comporte exactement comme avant.

La pagination client est appliquée après le regroupement & les détails (comportement le plus naturel).
En mode serveur, tu continues d’émettre pageChange comme avant.

Les rowDefs “when” coexistent maintenant pour 3 types: group, detail, data.

Pour ouvrir/fermer un groupe, j’utilise Set<string> (_groupOpen) avec la clé hiérarchique construite depuis le chemin du groupe. Le petit bouton de l’en-tête appelle toggleGroup(key).