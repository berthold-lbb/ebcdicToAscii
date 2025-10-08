import {
  AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter,
  Input, OnChanges, Output, SimpleChanges, ViewChild, TemplateRef
} from '@angular/core';
/* … vos imports existants … */

@Component({
  selector: 'lib-data-table',
  standalone: true,
  /* … imports, templateUrl, styleUrl … */
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent<T extends Record<string, any>>
  implements AfterViewInit, OnChanges {

  /* … TOUT VOTRE CODE EXISTANT … */

  // ====== Détails de ligne (row detail) ======
  /** Active l’affichage d’une ligne de détail sous la ligne */
  @Input() enableRowDetail = true;
  /** Template projeté pour afficher le contenu du détail */
  private _rowDetailTpl?: TemplateRef<any>;
  @Input() set rowDetailTemplate(tpl: TemplateRef<any> | null | undefined) {
    this._rowDetailTpl = tpl ?? undefined;
  }
  get hasRowDetail(): boolean { return !!this._rowDetailTpl && this.enableRowDetail; }

  /** Ligne actuellement déployée (single expand) */
  expandedRow: T | null = null;

  onRowDblClick(row: T): void {
    if (!this.hasRowDetail) return;
    this.expandedRow = (this.expandedRow === row) ? null : row;
  }

  /** Predicat utilisé par le *matRowDef when pour la ligne de détail */
  readonly isDetailRow = (_: number, r: T | { detailFor: T }) =>
    (r as any)?.detailFor !== undefined;

  /** Donne aux *matRowDef un tableau étendu pour matérialiser la ligne de détail */
  get rowsWithDetail(): any[] {
    if (!this.hasRowDetail || !this.dataSource?.filteredData?.length) {
      return this.dataSource?.filteredData ?? this.dataSource?.data ?? [];
    }
    const base = this.dataSource.filteredData ?? this.dataSource.data ?? [];
    if (!this.expandedRow) return base;
    // insère un « sentinel object » juste après la ligne expandée
    const i = base.indexOf(this.expandedRow);
    if (i < 0) return base;
    const copy = base.slice();
    copy.splice(i + 1, 0, { detailFor: this.expandedRow });
    return copy;
  }
}
-------------------------------------------------------------------------------------
<div class="dt-root">

  <!-- … votre toolbar et le loader top bar … -->

  <table mat-table
         [dataSource]="rowsWithDetail"
         class="mat-elevation-z2 dt-table"
         matSort
         [multiTemplateDataRows]="true">

    <!-- Colonne SELECT (inchangée) -->
    @if (selectable) {
      <ng-container matColumnDef="select">
        <th mat-header-cell *matHeaderCellDef class="col-select" [class.sticky]="stickyHeader">
          <!-- … -->
        </th>
        <td mat-cell *matCellDef="let row" class="col-select">
          <!-- … -->
        </td>
      </ng-container>
    }

    <!-- Colonnes dynamiques (inchangées) -->
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
                (click)="col.clickable && onCellClick($event, row, col)">
              {{ row[col.nom] }}
            </td>
          }
          @case (TableDataType.NUMBER)   { <td mat-cell class="data-table-colonne-{{ col.nom }}">{{ row[col.nom] }}</td> }
          @case (TableDataType.BOOLEAN)  { <td mat-cell class="data-table-colonne-{{ col.nom }}">{{ row[col.nom] }}</td> }
          @case (TableDataType.DATE)     { <td mat-cell class="data-table-colonne-{{ col.nom }}">{{ row[col.nom] | date:'dd/MM/yyyy' }}</td> }
          @case (TableDataType.TIME)     { <td mat-cell class="data-table-colonne-{{ col.nom }}">{{ row[col.nom] | date:'HH:mm:ss' }}</td> }
          @case (TableDataType.DATETIME) { <td mat-cell class="data-table-colonne-{{ col.nom }}">{{ row[col.nom] | date:'dd/MM/yyyy HH:mm:ss' }}</td> }
          @case (TableDataType.JSON)     { <td mat-cell class="data-table-colonne-{{ col.nom }}">{{ row[col.nom] | json }}</td> }
          @case (TableDataType.OBJECT)   { <td mat-cell class="data-table-colonne-{{ col.nom }}">{{ row[col.nom] }}</td> }
          @case (TableDataType.LINK) {
            <td mat-cell class="data-table-colonne-{{ col.nom }}">
              <a [routerLink]="[col.link, row[col.nom]]" (click)="$event.stopPropagation()">{{ row[col.nom] }}</a>
            </td>
          }
          @default                         { <td mat-cell class="data-table-colonne-{{ col.nom }}">{{ row[col.nom] }}</td> }
        }
      </ng-container>
    }

    <!-- Colonne DÉTAIL (cell qui s'étend sur toutes les colonnes) -->
    <ng-container matColumnDef="detail">
      <td mat-cell *matCellDef="let ctx" class="detail-cell"
          [attr.colspan]="displayedColumns.length">
        <!-- Ombre/fond sombre + card -->
        <div class="detail-wrapper">
          <div class="detail-card">
            <!-- Template projeté : donne accès à 'row' et 'index' -->
            @if (_rowDetailTpl) {
              <ng-container *ngTemplateOutlet="_rowDetailTpl; context: {$implicit: ctx.detailFor, row: ctx.detailFor}"></ng-container>
            } @else {
              <!-- Fallback (si pas de template fourni) -->
              <div class="detail-fallback">
                Aucun template de détail fourni.
              </div>
            }
          </div>
        </div>
      </td>
    </ng-container>

    <!-- En-tête -->
    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>

    <!-- Ligne principale (double-clic pour ouvrir/fermer le détail) -->
    <tr mat-row
        *matRowDef="let row; columns: displayedColumns"
        class="clickable-row"
        (click)="selectable && toggleRow(row)"
        (dblclick)="onRowDblClick(row)"
        [class.row-selected]="isSelected(row) && highlightSelection"
        [ngStyle]="(isSelected(row) && highlightSelection)
                    ? {'--sel-bg': highlightColor, '--sel-bar': highlightBarColor}
                    : null">
    </tr>

    <!-- Ligne de détail (s’affiche quand rowsWithDetail injecte {detailFor:row}) -->
    <tr mat-row
        *matRowDef="let ctx; columns: ['detail']; when: isDetailRow"
        class="detail-row">
    </tr>

    <!-- Aucune donnée -->
    @if ((serverSide ? total : autoLength) === 0) {
      <tr class="mat-row">
        <td class="mat-cell" [attr.colspan]="displayedColumns.length">Aucune donnée</td>
      </tr>
    }
  </table>

  <!-- Overlay loader + paginator (inchangés) -->
  @if (loading) { <!-- … --> }
  <mat-paginator
    [length]="serverSide ? total : autoLength"
    [pageSize]="pageSize"
    [pageSizeOptions]="pageSizeOptions"
    showFirstLastButtons>
  </mat-paginator>
</div>
-------------------------------------------------------------------------------------
/* Ombre légère au survol habituel de vos lignes, etc… */
.clickable-row { cursor: pointer; }

/* L’enveloppe pleine largeur de la cellule détail */
.detail-cell {
  padding: 0 !important;
  border: 0;
}

.detail-row {
  /* retire les séparateurs excessifs */
  .mat-mdc-cell { border-bottom: none; }
}

/* Fond assombri et carte centrée */
.detail-wrapper {
  position: relative;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.04); /* voile sombre type devExtreme */
}

.detail-card {
  background: var(--mat-table-background, #fff);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,.12);
  padding: 12px 16px;
}

/* Sélection avec barre latérale (déjà dans votre version) */
.row-selected {
  background: var(--sel-bg, #E6F4EA) !important;
  position: relative;
}
.row-selected::before {
  content: '';
  position: absolute; inset: 0 auto 0 0;
  width: 4px; background: var(--sel-bar, #2E7D32);
  border-top-left-radius: 4px; border-bottom-left-radius: 4px;
}
--------------------------------------------------------------------------------------

<!-- parent.component.html -->
<lib-data-table
  [data]="rows"
  [columns]="columns"
  [enableOrder]="true"
  [pageSize]="10"
  [pageSizeOptions]="[5,10,25,50]"
  [enableRowDetail]="true"
  [rowDetailTemplate]="detailTpl">
</lib-data-table>

<!-- Template de détail projeté -->
<ng-template #detailTpl let-row>
  <div class="detail-grid">
    <div><b>ID:</b> {{ row.id }}</div>
    <div><b>Client:</b> {{ row.clientName }}</div>
    <div><b>Téléphone:</b> {{ row.phone }}</div>
    <div><b>Adresse:</b> {{ row.address }}</div>
    <div class="actions">
      <button mat-stroked-button color="primary" (click)="$event.stopPropagation(); view(row)">Voir</button>
      <button mat-stroked-button color="accent"  (click)="$event.stopPropagation(); edit(row)">Editer</button>
    </div>
  </div>
</ng-template>
