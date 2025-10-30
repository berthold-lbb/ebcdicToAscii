1) HTML (table + headers)

Ajoute matSort au <table> et branche l’événement. Mets mat-sort-header sur chaque <th> sortable.

<table mat-table
       [dataSource]="rowsForRender"
       class="dt-table"
       multiTemplateDataRows
       matSort
       (matSortChange)="onSort($event)">

  <!-- Exemple d’en-tête triable -->
  <ng-container *ngFor="let col of columns" [matColumnDef]="col.nom">
    <th mat-header-cell *matHeaderCellDef
        [mat-sort-header]="col.nom"
        [disabled]="!!col.disableSort">
      {{ col.label }}
    </th>

    <!-- cellule -->
    <td mat-cell *matCellDef="let row" [class.is-numeric]="col.type==='AMOUNT' || col.type==='NUMBER'">
      {{ getCellValue(row,col) }}
    </td>
  </ng-container>

  <!-- lignes data -->
  <tr mat-row *matRowDef="let row; columns: displayedColumns" ></tr>

  <!-- ligne de détail (tu gardes ton gabarit actuel) -->
  <ng-container matColumnDef="detail">
    <td mat-cell *matCellDef="let row" [attr.colspan]="displayedColumns.length" *ngIf="isDetailRow(0,row)">
      <!-- ... ton contenu detail ... -->
    </td>
  </ng-container>
  <tr mat-row *matRowDef="let row; columns: ['detail']" ></tr>
</table>


Pas de grouping ici. On ne touche ni displayedColumns, ni ton canevas “detail”.

2) TS — tri client avant détail/pagination

Ajoute ce petit bloc dans le composant.

import { Sort } from '@angular/material/sort';

currentSort: Sort | null = null;

// appelé par (matSortChange)
onSort(e: Sort) {
  // garde l’état courant; si on clique pour enlever la direction => annule le tri
  this.currentSort = e.direction ? e : null;

  // si tu relays déjà au parent:
  this.sortChange.emit(e);

  if (!this.serverSide) this.cdr.markForCheck();
}

// valeur “triable” pour une colonne donnée
private getSortValue(item: T, prop: string): any {
  const col = this.columns.find(c => c.nom === prop);

  // récupère la valeur brute (respecte valueGetter si tu l’utilises)
  let raw: any;
  if (col?.valueGetter) raw = col.valueGetter(item, col);
  else raw = (item as any)?.[prop];

  switch (col?.type) {
    case 'AMOUNT':
    case 'NUMBER':
      return Number(raw) || 0;
    case 'DATE':
    case 'DATETIME':
      return raw ? new Date(raw).getTime() : 0;
    case 'BOOLEAN':
      return raw ? 1 : 0;
    default:
      return (raw ?? '').toString().toLowerCase();
  }
}

// applique le tri au tableau “base”, côté client
private applyClientSort(rows: T[]): T[] {
  if (this.serverSide) return rows;                 // backend fera le tri
  if (!this.currentSort || !this.currentSort.direction) return rows;

  const dir = this.currentSort.direction === 'asc' ? 1 : -1;
  const prop = this.currentSort.active;

  return [...rows].sort((a, b) => {
    const va = this.getSortValue(a, prop);
    const vb = this.getSortValue(b, prop);
    if (va < vb) return -1 * dir;
    if (va > vb) return  1 * dir;
    return 0;
  });
}

3) TS — ton getter rowsForRender() (patch)

On ne change pas la structure que tu as : on insère juste l’étape de tri avant l’injection du détail et la pagination.

get rowsForRender(): Array<T | DetailRow<T>> {
  // 1) base filtrée (comme chez toi)
  const baseAll: T[] = (this.dataSource.filteredData?.length
    ? this.dataSource.filteredData
    : this.dataSource.data) ?? [];

  // 2) TRI CLIENT (nouveau)
  const baseSorted = this.applyClientSort(baseAll);

  // 3) PAGINATION CLIENT (tu avais déjà : on découpe avant d’insérer le détail)
  let pageRows = baseSorted;
  if (this.paginator && !this.serverSide) {
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    pageRows = baseSorted.slice(start, start + this.paginator.pageSize);
  }

  // 4) INJECTION DETAIL (identique à ton code)
  if (this.expandedId == null) return pageRows as Array<T | DetailRow<T>>;

  const idx = pageRows.findIndex(r => this._rowId(r as T) === this.expandedId);
  if (idx === -1) return pageRows as Array<T | DetailRow<T>>;

  const host = pageRows[idx] as T;
  const res: Array<T | DetailRow<T>> = pageRows.slice(0, idx + 1);
  res.push({ __detail: true, forId: this.expandedId, host } as DetailRow<T>);
  res.push(...pageRows.slice(idx + 1));
  return res;
}


Remarque : si tu préfères insérer le détail puis paginer, inverse étapes 3 et 4 (mais alors la pagination “compte” la ligne de détail).

4) TS — ngAfterViewInit

Tu peux garder ce que tu as, mais remplace le subscribe pour mettre à jour currentSort :

ngAfterViewInit(): void {
  if (this.sort) {
    // utile si tu utilises encore MatTableDataSource pour le filtrage
    this.dataSource.sort = this.sort;

    // mets à jour notre état de tri custom
    this.sort.sortChange.subscribe(s => {
      this.onSort(s);
    });
  }

  if (this.paginator) {
    this.dataSource.paginator = this.serverSide ? undefined : this.paginator;
    if (this.serverSide) {
      this.paginator.page.subscribe(p => this.pageChange.emit(p));
    }
  }

  this.expandedId = null;
  this.cdr.markForCheck();
}

Ça suffit pour que le tri refonctionne

Tu continues d’alimenter la table avec rowsForRender.

mat-sort-header émet (matSortChange) → currentSort.

rowsForRender trie baseSorted → injecte detail → pagine.

Rien à modifier côté parent/back (sauf si serverSide=true, auquel cas on n’applique pas applyClientSort et on laisse le parent recharger).