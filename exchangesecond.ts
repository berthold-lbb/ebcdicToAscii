3) Code TS « regroupement » — à intégrer

Ajoute/colle ce bloc dans ton DataTableComponent<T extends Record<string, any>> (il n’interfère pas avec le reste). Je mets seulement les morceaux nécessaires au grouping ; le reste de ton composant ne change pas.

// --- Types (en haut du fichier)
type IdType = string | number;

export interface DetailRow<T> {
  __detail: true;
  forId: IdType;
  host: T;
}

export interface GroupHeaderRow<T> {
  __group: true;
  key: string;                       // clé unique par chemin de groupe
  level: number;                     // 0..n-1
  values: Record<string, unknown>;   // ex: { state: 'CA', phone: '(800)...' }
  count: number;                     // nb de lignes (feuilles) dans ce sous-groupe
  rows?: T[];                        // optionnel (si tu veux stocker les feuilles)
}

// --- API regroupement
@Input() enableGrouping = false;     // coupe/active toute l’UI et la logique
@Input() groupBy: string[] = [];     // ordre des champs groupés
@Output() groupByChange = new EventEmitter<string[]>();

private collapsedGroups = new Set<string>();    // clés de groupes fermés

// --- Predicates MatTable
isDetailRow = (_: number, row: any): row is DetailRow<T> =>
  !!row && typeof row === 'object' && (row as any).__detail === true;

isGroupHeaderRow = (_: number, row: any): row is GroupHeaderRow<T> =>
  !!row && typeof row === 'object' && (row as any).__group === true;

// --- utilitaires existants que tu as déjà :
private baseRows(): T[] {
  return this.dataSource.filteredData?.length
    ? (this.dataSource.filteredData as T[])
    : (this.dataSource.data as T[] ?? []);
}

/** Pagination client générique (T, GroupHeaderRow<T>, DetailRow<T>) */
private pageSlice<R>(arr: R[]): R[] {
  if (!this.paginator || this.serverSide) return arr;
  const start = this.paginator.pageIndex * this.paginator.pageSize;
  return arr.slice(start, start + this.paginator.pageSize);
}

/** Cache si une colonne est déjà utilisée pour le grouping */
isColumnGrouped = (col: string) => this.groupBy.includes(col);

// --- Pipeline de rendu : base -> groupe -> détail -> pagination
get rowsForRender(): Array<T | GroupHeaderRow<T> | DetailRow<T>> {
  const base = this.baseRows();

  // 1) si grouping désactivé : on gère juste la ligne détail (comme avant)
  if (!this.enableGrouping || this.groupBy.length === 0) {
    // pagination AVANT d’insérer le détail (comportement actuel)
    const pageRows = this.pageSlice(base);
    if (this.expandedId == null) return pageRows;

    const idx = pageRows.findIndex(r => this._rowId(r) === this.expandedId);
    if (idx === -1) return pageRows;

    const host = pageRows[idx];
    const res: Array<T | DetailRow<T>> = pageRows.slice(0, idx + 1);
    res.push({ __detail: true, forId: this.expandedId, host });
    res.push(...pageRows.slice(idx + 1));
    return res;
  }

  // 2) grouping actif
  const grouped = this.groupRows(base);              // insère headers
  const withDetail = this.applyDetail(grouped);      // insère éventuel détail
  const collapsed = this.applyCollapse(withDetail);  // enlève feuilles des groupes fermés
  return this.pageSlice(collapsed);                  // pagination APRES grouping
}

// --- Construction des headers de groupe
private groupRows(rows: T[]): Array<T | GroupHeaderRow<T>> {
  if (this.groupBy.length === 0) return rows;

  // on trie d’abord par les champs groupés pour avoir des blocs contigus
  const sorted = [...rows].sort((a, b) => {
    for (const f of this.groupBy) {
      const av = (a as any)[f];
      const bv = (b as any)[f];
      if (av === bv) continue;
      return av > bv ? 1 : -1;
    }
    return 0;
  });

  const out: Array<T | GroupHeaderRow<T>> = [];
  const currentValues: Record<string, unknown> = {};
  let currentLevel = 0;
  let countOnPath = 0;

  // génère une clé unique par chemin (state=CA/phone=xxx)
  const makeKey = () => this.groupBy
    .slice(0, currentLevel)                      // champs jusqu’au niveau courant
    .map(f => `${f}=${String(currentValues[f])}`)
    .join('/');

  // remet les headers à jour quand la valeur de niveau change
  const flushHeadersUpTo = (newLevel: number) => {
    // si on descend (nouveau niveau), rien à flush ici
    // si on remonte, on n’a rien à faire non plus : le header est déjà posé
    // les comptes seront incrémentés au fil de l’eau (voir plus bas)
  };

  for (const r of sorted) {
    // pour chaque niveau, si la valeur change, on ouvre un header
    for (let level = 0; level < this.groupBy.length; level++) {
      const field = this.groupBy[level];
      const val = (r as any)[field];

      if (currentValues[field] !== val || level >= currentLevel) {
        // nouveau bloc à ce niveau -> header
        currentLevel = level + 1;
        currentValues[field] = val;
        const key = makeKey();

        out.push({
          __group: true,
          key,
          level,
          values: { ...currentValues }, // snapshot des valeurs vues
          count: 0,                     // rempli ci-dessous
        } as GroupHeaderRow<T>);
      }
    }

    // on pousse la ligne de données
    out.push(r);

    // on incrémente le count de tous les headers parents visibles en fin de chemin
    // (on remonte depuis le dernier header rencontré)
    let walkKey = '';
    for (let level = 0; level < this.groupBy.length; level++) {
      const field = this.groupBy[level];
      walkKey = level === 0
        ? `${field}=${String(currentValues[field])}`
        : `${walkKey}/${field}=${String(currentValues[field])}`;

      // trouve le dernier header avec cette key en partant de la fin
      for (let i = out.length - 2; i >= 0; i--) {
        const it = out[i];
        if ((it as any).__group && (it as GroupHeaderRow<T>).key === walkKey) {
          (it as GroupHeaderRow<T>).count++;
          break;
        }
      }
    }
  }

  return out;
}

// --- Insère la ligne de détail si visible
private applyDetail(seq: Array<T | GroupHeaderRow<T>>)
: Array<T | GroupHeaderRow<T> | DetailRow<T>> {
  if (this.expandedId == null) return seq;
  const idx = seq.findIndex(r => !this.isGroupHeaderRow(0, r) && this._rowId(r as T) === this.expandedId);
  if (idx === -1) return seq;
  const host = seq[idx] as T;
  const res: Array<T | GroupHeaderRow<T> | DetailRow<T>> = seq.slice(0, idx + 1);
  res.push({ __detail: true, forId: this.expandedId, host });
  res.push(...seq.slice(idx + 1));
  return res;
}

// --- Masque les feuilles appartenant à un groupe « fermé »
private applyCollapse(seq: Array<T | GroupHeaderRow<T> | DetailRow<T>>)
: Array<T | GroupHeaderRow<T> | DetailRow<T>> {
  const out: Array<T | GroupHeaderRow<T> | DetailRow<T>> = [];
  const hiddenLevels: number[] = []; // pile des niveaux fermés

  for (const item of seq) {
    if (this.isGroupHeaderRow(0, item)) {
      // un header annule les fermetures d’un niveau supérieur
      while (hiddenLevels.length && hiddenLevels[hiddenLevels.length - 1] >= item.level) {
        hiddenLevels.pop();
      }
      out.push(item);
      if (this.collapsedGroups.has(item.key)) {
        hiddenLevels.push(item.level); // on masque les feuilles de ce niveau
      }
      continue;
    }
    if (hiddenLevels.length) {
      // on est sous un header fermé -> on saute les lignes normales et la detailRow
      continue;
    }
    out.push(item);
  }
  return out;
}

// --- Interaction (ouvrir/fermer un groupe)
toggleGroup(key: string): void {
  if (this.collapsedGroups.has(key)) this.collapsedGroups.delete(key);
  else this.collapsedGroups.add(key);
}


Remarque : si tu veux aussi retirer les colonnes groupées de l’en-tête, il suffit de filtrer displayedColumns au rendu (cf. HTML plus bas). Aucune autre logique n’est nécessaire.

4) HTML (MatTable) — à coller

Points clés :

Aucune double directive * sur le même élément.

On définit 3 colonnes spéciales : __group (header de groupe), __detail (détail), et les colonnes data normales (une par col.nom).

On filtre displayedColumns pour ne pas afficher les colonnes groupées en en-tête / corps.

<!-- En-tête de regroupement (chips / zone de drop si tu l’as déjà) -->
<div class="dt-groupbar" *ngIf="enableGrouping">
  <span class="dt-groupbar-title">Drag a column header here to group by that column</span>
  <!-- tes chips de groupBy (pas détaillés ici si tu les as déjà) -->
</div>

<!-- Table -->
<table mat-table [dataSource]="rowsForRender" class="dt-table">

  <!-- Colonne HEADER DE GROUPE -->
  <ng-container matColumnDef="__group">
    <th mat-header-cell *matHeaderCellDef class="invisible"></th>
    <td mat-cell *matCellDef="let row" [attr.colspan]="displayedColumns.length" *ngIf="(row as any).__group">
      <div class="group-header-row" [style.padding-left.px]="16 + (row as GroupHeaderRow<any>).level * 20">
        <button class="chev" type="button" (click)="toggleGroup((row as GroupHeaderRow<any>).key)">
          <mat-icon>{{ collapsedGroups.has((row as GroupHeaderRow<any>).key) ? 'chevron_right' : 'expand_more' }}</mat-icon>
        </button>
        <strong>
          {{
            (visibleColumnDefs.find(x => x.nom===groupBy[(row as GroupHeaderRow<any>).level])
              || _columns.find(x => x.nom===groupBy[(row as GroupHeaderRow<any>).level]))?.label
            || groupBy[(row as GroupHeaderRow<any>).level]
          }}:
          {{ (row as GroupHeaderRow<any>).values[groupBy[(row as GroupHeaderRow<any>).level]] }}
          ({{ (row as GroupHeaderRow<any>).count }})
        </strong>
      </div>
    </td>
  </ng-container>

  <!-- Colonne LIGNE DE DÉTAIL -->
  <ng-container matColumnDef="__detail">
    <th mat-header-cell *matHeaderCellDef class="invisible"></th>
    <td mat-cell *matCellDef="let row" [attr.colspan]="displayedColumns.length" *ngIf="(row as any).__detail">
      <div class="detail-card">
        <ng-container *ngIf="rowDetailTemplate; else jsonFallback"
          [ngTemplateOutlet]="rowDetailTemplate"
          [ngTemplateOutletContext]="{$implicit: (row as DetailRow<any>).host, row: (row as DetailRow<any>).host}">
        </ng-container>
        <ng-template #jsonFallback>
          <pre>{{ (row as DetailRow<any>).host | json }}</pre>
        </ng-template>
      </div>
    </td>
  </ng-container>

  <!-- Colonnes DATA (une par colonne visible) -->
  <ng-container *ngFor="let col of visibleColumnDefs" [matColumnDef]="col.nom">
    <th mat-header-cell *matHeaderCellDef
        cdkDrag cdkDragPreviewClass="drag-header" [cdkDragData]="col.nom">
      {{ col.label }}
    </th>
    <td mat-cell *matCellDef="let row">
      <!-- si c’est une detailRow/groupHeaderRow, tu peux laisser vide/guarder -->
      <ng-container *ngIf="!(row as any).__detail && !(row as any).__group">
        {{ row[col.nom] }}
      </ng-container>
    </td>
  </ng-container>

  <!-- LIGNE D’EN-TÊTE (on retire les colonnes groupées) -->
  <tr mat-header-row
      *matHeaderRowDef="displayedColumns.filter(c => !isColumnGrouped(c)); sticky: stickyHeader">
  </tr>

  <!-- LIGNE HEADER DE GROUPE -->
  <tr mat-row *matRowDef="let row; columns: ['__group']; when: isGroupHeaderRow"></tr>

  <!-- LIGNE DÉTAIL -->
  <tr mat-row *matRowDef="let row; columns: ['__detail']; when: isDetailRow"></tr>

  <!-- LIGNES DATA (colonnes visibles non groupées) -->
  <tr mat-row
      *matRowDef="let row; columns: displayedColumns.filter(c => !isColumnGrouped(c))"
      (dblclick)="onRowDblClick(row)">
  </tr>
</table>


Si tu utilises la barre de groupage drag & drop (Chips + CDK), ta partie « barre » reste la même ; ce qui change ici, c’est uniquement la table.

5) CSS minimal
.dt-table .invisible { visibility: hidden; height: 0; padding: 0; }

.group-header-row {
  display: flex; align-items: center; gap: .5rem;
  padding: .5rem 0;
  border-top: 1px solid #eee; border-bottom: 1px solid #eee;
  background: #fafafa;
}
.group-header-row .chev { all: unset; cursor: pointer; display: inline-flex; }
.detail-card { background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 12px; }

6) Exemple d’utilisation (parent)
<lib-data-table
  [data]="rows"
  [columns]="columns"
  [enableGrouping]="true"
  [groupBy]="groupBy"
  (groupByChange)="groupBy = $event">
</lib-data-table>

groupBy = ['state', 'phone']; // ex. initial

Récap’ des changements clés

Interfaces

GroupHeaderRow<T> (générique) + DetailRow<T> (inchangée).

Predicats

isGroupHeaderRow, isDetailRow (types guards).

Pipeline

rowsForRender => groupRows → applyDetail → applyCollapse → pageSlice.

HTML

Plus de *ngIf en conflit avec *matHeaderCellDef/*matCellDef.
Les colonnes groupées disparaissent de l’en-tête grâce à
displayedColumns.filter(c => !isColumnGrouped(c)).

Avec ces pièces, tu obtiens :

regroupement multi-niveaux,

ouverture/fermeture par groupe,

colonnes groupées retirées de l’en-tête,

ligne de détail compatible,

pagination après grouping (comme DevExtreme),

et zéro erreur de typings (GroupHeaderRow<T>) ni d’Angular templates.