1) Types “sentinelles”
type IdType = string | number;

export interface DetailRow<T> {
  __detail: true;
  forId: IdType;
  host: T;                // la vraie ligne parente
}

export interface GroupHeaderRow<T> {
  __group: true;
  level: number;          // 0, 1, 2… si groupBy a plusieurs champs
  field: string;          // nom de la colonne/group-by
  value: unknown;         // valeur du groupe
  rows?: T[];             // optionnel (client-side)  -> rowcount = rows.length
  count?: number;         // optionnel (server-side)  -> rowcount = count
  collapsed?: boolean;
}


Si tu fais le grouping client-side, tu peux n’utiliser que rows. Si tu veux rester flexible (client/serveur), garde rows? + count? et affiche rows?.length ?? count ?? 0.

2) Prédicats MatTable (type guards)
// Est-ce une ligne de détail ?
isDetailRow = (_: number, row: unknown): row is DetailRow<T> =>
  !!row && typeof row === 'object' && (row as any).__detail === true;

// Est-ce un en-tête de groupe ?
isGroupHeaderRow = (_: number, row: unknown): row is GroupHeaderRow<T> =>
  !!row && typeof row === 'object' && (row as any).__group === true;

// Donnée “normale” (ni détail ni group header)
isDataRow = (i: number, row: unknown): row is T =>
  !this.isDetailRow(i, row) && !this.isGroupHeaderRow(i, row);

3) Helpers de base
/** Données après filtre/tri (sans pagination, sans grouping, sans détail) */
private _baseRows(): T[] {
  return this.dataSource.filteredData?.length
    ? this.dataSource.filteredData as T[]
    : (this.dataSource.data ?? []);
}

/** Couper un tableau selon le paginator (client-side) */
private _pageSlice<R>(arr: R[]): R[] {
  if (!this.paginator || this.serverSide) return arr;
  const start = this.paginator.pageIndex * this.paginator.pageSize;
  return arr.slice(start, start + this.paginator.pageSize);
}

/** Taille d’un groupe pour le template (rows?.length ou count) */
getGroupSize = (g: GroupHeaderRow<T>) => g.rows?.length ?? g.count ?? 0;

4) Grouping simple (client-side)

Ici je pars d’un groupBy: string[] (ex: ['state', 'city']).
On insère un GroupHeaderRow à chaque changement de clé.

@Input() enableGrouping = false;
@Input() groupBy: string[] = [];  // ex. ['state'] ou ['state','city']

/** Regroupe base[] en intercalant des GroupHeaderRow<T> */
private _groupRows(base: T[]): Array<T | GroupHeaderRow<T>> {
  if (!this.enableGrouping || !this.groupBy?.length) return base;

  // ordonner par les champs groupBy pour avoir des blocs cohérents
  const sorted = [...base].sort((a, b) => {
    for (const f of this.groupBy) {
      const av = (a as any)[f]; const bv = (b as any)[f];
      if (av < bv) return -1;
      if (av > bv) return  1;
    }
    return 0;
  });

  const out: Array<T | GroupHeaderRow<T>> = [];
  let prevKey = '';
  let currentRows: T[] = [];
  let currentLevelValues: any[] = [];

  const makeKey = (r: T) => this.groupBy.map(f => String((r as any)[f])).join('␟');

  for (const r of sorted) {
    const key = makeKey(r);
    if (key !== prevKey) {
      // on clôt le groupe précédent (si on veut pousser currentRows dans le header)
      currentRows = [];
      currentLevelValues = [];

      // créer les headers pour chaque niveau
      for (let lvl = 0; lvl < this.groupBy.length; lvl++) {
        const field = this.groupBy[lvl];
        const value = (r as any)[field];
        // si la valeur de ce niveau a changé, on insère un header
        if (currentLevelValues[lvl] !== value) {
          currentLevelValues[lvl] = value;
          out.push({
            __group: true,
            level: lvl,
            field,
            value,
            rows: currentRows,  // on référencera les éléments suivants
          } as GroupHeaderRow<T>);
        }
      }
      prevKey = key;
    }
    currentRows.push(r);
    out.push(r);
  }

  return out;
}


Cette version est légère et autonome (pas de lib externe).
Si tu veux drag-&-drop des champs de grouping plus tard, on branchera CdkDragDrop sur groupBy.

5) Insertion de la ligne de détail après grouping

Insérer la ligne de détail juste après sa ligne hôte (et uniquement si elle est visible dans le tableau groupé courant).

6) Pagination après grouping & détail

Pour ne pas “casser” les entêtes de groupe, on pagine à la fin.

7) Version finale de rowsForRender
/** Tableau rendu = base filtrée/triée -> groupée -> + éventuelle ligne de détail -> paginée */
get rowsForRender(): Array<T | GroupHeaderRow<T> | DetailRow<T>> {
  // 1) base après filtre/tri :
  const base = this._baseRows();

  // 2) regrouper (ou pas) :
  const grouped = this._groupRows(base); // Array<T | GroupHeaderRow<T>>

  // 3) insérer l’éventuelle ligne de détail
  if (this.expandedId == null) {
    // pas de détail -> on pagine directement
    return this._pageSlice(grouped);
  }

  const withDetail: Array<T | GroupHeaderRow<T> | DetailRow<T>> = [];
  for (const item of grouped) {
    if (!this.isGroupHeaderRow(0, item) && !this.isDetailRow(0, item)) {
      // data row
      withDetail.push(item);
      if (this._rowId(item) === this.expandedId) {
        withDetail.push({ __detail: true, forId: this.expandedId, host: item } as DetailRow<T>);
      }
    } else {
      // header de groupe (ou détail si jamais présent) -> pousser tel quel
      withDetail.push(item as any);
    }
  }

  // 4) pagination *après* grouping + détail
  return this._pageSlice(withDetail);
}


Différence vs ta version sans group (écran 1) :
– tu paginais avant d’insérer le détail ;
– ici, pour le grouping, on pagine après avoir injecté les GroupHeaders et la DetailRow, ce qui évite d’avoir un header sans ses lignes ou l’inverse.

8) HTML MatTable (3 rowDefs)

RowDef données : matRowDef avec displayedColumns.

RowDef “group header” : 1 case qui s’étale sur toutes les colonnes.

RowDef “detail” : 1 case étendue, avec le template projeté.

<table mat-table [dataSource]="rowsForRender" class="dt-table" matSort>

  <!-- Colonnes “normales” -->
  <ng-container *ngFor="let col of visibleColumnDefs" [matColumnDef]="col.nom">
    <th mat-header-cell *matHeaderCellDef>{{ col.label }}</th>
    <td mat-cell *matCellDef="let row" [class.clickable]="col.clickable"
        (click)="col.clickable && onCellClick($event, row, col)">
      <!-- protège la ligne de détail et le group header -->
      @if (isDataRow(0, row)) {
        <!-- ton switch CASE actuel (STRING, NUMBER, AMOUNT, DATE, etc.) -->
        {{ row[col.nom] }}
      }
    </td>
  </ng-container>

  <!-- Colonne technique “detail” (non listée dans displayedColumns) -->
  <ng-container matColumnDef="detail">
    <td mat-cell class="detail-cell" [attr.colspan]="displayedColumns.length">
      @if (isDetailRow(0, row)) {
        <div class="detail-wrapper" [@detailToggle]>
          @if (rowDetailTemplate) {
            <ng-container *ngTemplateOutlet="rowDetailTemplate; context: {$implicit: row.host, row: row.host}"></ng-container>
          } @else {
            <div class="detail-fallback">
              <strong>Détails :</strong> {{ row.host | json }}
            </div>
          }
        </div>
      }
    </td>
  </ng-container>

  <!-- Colonne technique “groupHeader” (non listée non plus) -->
  <ng-container matColumnDef="groupHeader">
    <td mat-cell class="group-cell" [attr.colspan]="displayedColumns.length">
      @if (isGroupHeaderRow(0, row)) {
        <div class="group-header" [style.padding-left.px]="8 + row.level * 12">
          <span class="badge">Lvl {{ row.level }}</span>
          <strong>{{ row.field }}:</strong> {{ row.value }}
          <span class="muted">({{ getGroupSize(row) }})</span>
        </div>
      }
    </td>
  </ng-container>

  <!-- Row defs -->
  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>

  <!-- Données -->
  <tr mat-row *matRowDef="let row; columns: displayedColumns;" [matRowDefWhen]="isDataRow"
      (dblclick)="onRowDblClick(row)"></tr>

  <!-- Group header -->
  <tr mat-row *matRowDef="let row; columns: ['groupHeader'];" [matRowDefWhen]="isGroupHeaderRow"></tr>

  <!-- Détail -->
  <tr mat-row *matRowDef="let row; columns: ['detail'];" [matRowDefWhen]="isDetailRow"></tr>
</table>


⚠️ displayedColumns ne doit pas contenir 'detail' ni 'groupHeader'.
Ces deux colonnes techniques sont ciblées par leurs rowDef dédiées.