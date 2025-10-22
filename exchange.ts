Parfait — on intègre exactement ce que tu veux :

Barre de groupement (à gauche) avec puces (chips) pour chaque champ groupé.

Cliquer sur ↑/↓ alterne le tri du niveau (asc/desc).

Cliquer sur ✕ (ou glisser la puce vers l’en-tête) annule ce groupement spécifique.

Glisser un en-tête vers la barre ⇒ le champ est ajouté aux groupements et disparaît de l’en-tête.

Collapse/expand des entêtes de groupe (chevron).

Aucun @if/@for. On reste en *ngIf/*ngFor.

On garde tes noms (isGroupHeaderRow, GroupHeaderRow<T>, rows?, count, collapsed?) et tes features (pagination, détail, sélection…).

Étape 1 — TypeScript (remplacer/ajouter)

Remplace tes anciennes fonctions de grouping par celles-ci. Garde tes autres fonctionnalités inchangées (datasource, search, paginator, détail, sélection, etc.).

// imports ➜ ajoute CDK DnD
import { CdkDrag, CdkDropList, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

// === Types conservés (avec tes champs) ===
export interface GroupHeaderRow<T> {
  __group: true;
  key: string;
  level: number;
  values: Record<string, unknown>;
  rows?: T[];
  count: number;
  collapsed?: boolean;
}
export interface DetailRow<T> { __detail: true; forId: string|number; host: T; }

// ===== API Grouping =====
@Input() enableGrouping = false;
@Input() groupBy: string[] = [];
@Output() groupByChange = new EventEmitter<string[]>();

// tri par niveau (champ -> 'asc'|'desc')
private groupSort = new Map<string, 'asc'|'desc'>();

// headers de groupe ouverts
private _groupOpen = new Set<string>();

// zone “fantôme” pour le drop inverse (barre ➜ en-tête)
headerDropBin: string[] = [];

// ==== Helpers conservés ====
isGroupHeaderRow = (_: number, row: any): row is GroupHeaderRow<T> =>
  !!row && typeof row === 'object' && (row as any).__group === true;
isDetailRow = (_: number, row: any): row is DetailRow<T> =>
  !!row && typeof row === 'object' && (row as any).__detail === true;
isDataRow = (_: number, row: any): row is T =>
  !!row && typeof row === 'object' && !(row as any).__detail && !(row as any).__group;

// En-tête visible ? (masquer si groupée)
isColumnGrouped = (f: string) => this.groupBy.includes(f);

// ===== Grouping core =====
private makeKey(level: number, values: Record<string, unknown>): string {
  const path = Array.from({length: level+1}, (_,i)=> this.groupBy[i])
    .map(f => `${f}=${String(values[f])}`);
  return `${level}|${path.join('|')}`;
}

private groupRows(base: T[]): Array<T | GroupHeaderRow<T>> {
  if (!this.enableGrouping || this.groupBy.length === 0) return base;

  // tri selon groupBy + sens
  const sorted = [...base].sort((a,b) => {
    for (const field of this.groupBy) {
      const dir = this.groupSort.get(field) ?? 'asc';
      const av = (a as any)[field], bv = (b as any)[field];
      if (av == null && bv == null) continue;
      if (av == null) return dir === 'asc' ? -1 : 1;
      if (bv == null) return dir === 'asc' ?  1 : -1;
      if (av <  bv)   return dir === 'asc' ? -1 : 1;
      if (av >  bv)   return dir === 'asc' ?  1 : -1;
    }
    return 0;
  });

  const out: Array<T | GroupHeaderRow<T>> = [];
  let prev: Record<string, unknown> = {};

  const valuesAt = (row: T, level: number) => {
    const o: Record<string, unknown> = {};
    for (let i=0;i<=level;i++) { const f=this.groupBy[i]; o[f]=(row as any)[f]; }
    return o;
  };
  const pushHeader = (level: number, vals: Record<string, unknown>) => {
    const key = this.makeKey(level, vals);
    out.push({
      __group: true, key, level, values: vals,
      count: 0, collapsed: !this._groupOpen.has(key)
    } as GroupHeaderRow<T>);
  };

  for (const row of sorted) {
    for (let level=0; level<this.groupBy.length; level++) {
      const vals = valuesAt(row, level);
      const changed =
        level === 0
          ? (prev[this.groupBy[0]] !== vals[this.groupBy[0]])
          : this.groupBy.slice(0, level+1).some(f => prev[f] !== vals[f]);
      if (changed) {
        pushHeader(level, vals);
        for (let i=0;i<=level;i++) prev[this.groupBy[i]] = vals[this.groupBy[i]];
        for (let i=level+1;i<this.groupBy.length;i++) delete prev[this.groupBy[i]];
      }
    }
    // incrément du dernier header
    const last = this.groupBy.length - 1;
    if (last >= 0) {
      const hdr = out.slice().reverse().find(r => this.isGroupHeaderRow(0,r)) as GroupHeaderRow<T>|undefined;
      if (hdr) hdr.count++;
    }
    out.push(row);
  }
  return out;
}

private applyCollapse(seq: Array<T | GroupHeaderRow<T> | DetailRow<T>>)
: Array<T | GroupHeaderRow<T> | DetailRow<T>> {
  if (!this.enableGrouping || this.groupBy.length === 0) return seq;
  const res: typeof seq = [];
  const open: boolean[] = [];
  for (const it of seq) {
    if (this.isGroupHeaderRow(0,it)) {
      open[it.level] = !it.collapsed;
      for (let i=it.level+1;i<open.length;i++) open[i]=false;
      res.push(it);
    } else if (this.isDataRow(0,it)) {
      if (open.slice(0,this.groupBy.length).every(Boolean)) res.push(it);
    } else {
      res.push(it); // lignes de détail laissez passer
    }
  }
  return res;
}

// Actions UI
toggleGroupHeader(row: GroupHeaderRow<T>) {
  row.collapsed = !row.collapsed;
  if (row.collapsed) this._groupOpen.delete(row.key); else this._groupOpen.add(row.key);
}
cycleGroupSort(field: string) {
  const cur = this.groupSort.get(field) ?? 'asc';
  this.groupSort.set(field, cur === 'asc' ? 'desc' : 'asc');
  this.groupByChange.emit([...this.groupBy]); // notifie (pour persister si besoin)
}
removeGroup(field: string) {
  if (!this.groupBy.includes(field)) return;
  this.groupBy = this.groupBy.filter(f => f !== field);
  this.groupSort.delete(field);
  this.groupByChange.emit([...this.groupBy]);
}

// DnD : en-tête ➜ barre
onDropToGrouping(ev: CdkDragDrop<string[]>) {
  if (!this.enableGrouping) return;
  const field = (ev.item.data as string);
  if (!this.groupBy.includes(field)) {
    this.groupBy = [...this.groupBy, field];
    if (!this.groupSort.has(field)) this.groupSort.set(field, 'asc');
    this.groupByChange.emit([...this.groupBy]);
  }
}
// DnD : barre ➜ en-tête (annuler ce groupement)
onDropToHeader(ev: CdkDragDrop<string[]>) {
  if (!this.enableGrouping) return;
  const field = (ev.item.data as string);
  this.removeGroup(field);
}

// ====== Rendu final (garde le reste de tes méthodes) ======
get rowsForRender(): Array<T | GroupHeaderRow<T> | DetailRow<T>> {
  const base = this.baseRows();                 // ta méthode existante
  const grouped = this.groupRows(base);
  const visible = this.applyCollapse(grouped as any);

  if (this.expandedId == null) return this.pageSlice(visible);

  const withDetail: Array<T | GroupHeaderRow<T> | DetailRow<T>> = [];
  for (const it of visible) {
    withDetail.push(it);
    if (this.isDataRow(0,it) && this._rowId(it) === this.expandedId) {
      withDetail.push({ __detail: true, forId: this.expandedId, host: it } as DetailRow<T>);
    }
  }
  return this.pageSlice(withDetail);
}


🔥 Supprime tes anciens groupRows, applyCollapse, toggleGroup, etc. si tu en avais déjà d’autres versions. Garde tout le reste (recherche, tri MatSort pour les colonnes visibles, pagination, détail, sélection…).

Étape 2 — HTML (adapter la toolbar + en-têtes drag)

Zone de groupement à gauche. Tes icônes + barre de recherche restent à droite.
En-tête de tableau draggable et <thead> est un drop target (pour annuler).

<div class="dt-toolbar">
  <!-- GAUCHE : barre de groupement -->
  <div class="dt-toolbar-left" *ngIf="enableGrouping">
    <div class="group-drop"
         cdkDropList
         [cdkDropListData]="groupBy"
         (cdkDropListDropped)="onDropToGrouping($event)">
      <span class="hint">Drag a column header here to group by that column</span>

      <div class="group-chips" *ngIf="groupBy.length">
        <ng-container *ngFor="let f of groupBy">
          <div class="chip" cdkDrag [cdkDragData]="f" cdkDragPreviewClass="drag-chip">
            <span class="label">{{ (_columns?.find(c => c.nom===f)?.label) || f }}</span>
            <!-- tri ↑/↓ -->
            <button type="button" class="icon" mat-icon-button (click)="cycleGroupSort(f)" matTooltip="Sort level">
              <mat-icon>swap_vert</mat-icon>
            </button>
            <!-- supprimer ce groupement -->
            <button type="button" class="icon danger" mat-icon-button (click)="removeGroup(f)" matTooltip="Remove">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </ng-container>
      </div>
    </div>
  </div>

  <!-- DROITE : tes actions existantes -->
  <div class="dt-toolbar-right">
    <!-- ... tes icônes, colonnes, refresh ... -->
    <mat-form-field *ngIf="searchable" appearance="outline" class="dt-search-field">
      <mat-icon matPrefix>search</mat-icon>
      <input matInput [placeholder]="filterPlaceholder" [formControl]="searchCtrl">
    </mat-form-field>
  </div>
</div>

<div class="dt-center dt-scroll">
  <table mat-table [dataSource]="rowsForRender" class="dt-table" multiTemplateDataRows>
    <!-- l'en-tête devient un drop target pour “dé-groupper” en glissant une puce -->
    <thead cdkDropList (cdkDropListDropped)="onDropToHeader($event)">
      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
    </thead>

    <!-- En-têtes colonnes : drag source, cachées si groupées -->
    <ng-container *ngFor="let col of visibleColumnDefs" [matColumnDef]="col.nom">
      <th mat-header-cell *matHeaderCellDef
          cdkDrag [cdkDragData]="col.nom" cdkDragPreviewClass="drag-header"
          *ngIf="!isColumnGrouped(col.nom)">
        {{ col.label }}
      </th>

      <!-- Cellules data (inchangé, place ton switch de types ici) -->
      <td mat-cell *matCellDef="let row" *ngIf="isDataRow(0,row)">
        {{ row[col.nom] }}
      </td>
    </ng-container>

    <!-- Ligne header de groupe -->
    <ng-container matColumnDef="__groupheader">
      <td mat-cell *matCellDef="let row" [attr.colspan]="displayedColumns.length" *ngIf="isGroupHeaderRow(0,row)">
        <div class="group-header" [style.padding-left.px]="16 + row.level*16">
          <button class="chev" mat-icon-button (click)="toggleGroupHeader(row)">
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

    <!-- Ligne de détail -->
    <ng-container matColumnDef="detail">
      <td mat-cell class="detail-cell" *matCellDef="let row" [attr.colspan]="displayedColumns.length" *ngIf="isDetailRow(0,row)">
        <div class="detail-card">
          <ng-container *ngIf="rowDetailTemplate; else detailFallback"
                        [ngTemplateOutlet]="rowDetailTemplate"
                        [ngTemplateOutletContext]="{ $implicit: row.host, row: row.host }"></ng-container>
          <ng-template #detailFallback><div class="detail-fallback">{{ row.host | json }}</div></ng-template>
        </div>
      </td>
    </ng-container>

    <!-- row defs -->
    <tr mat-row *matRowDef="let row; columns: displayedColumns" *ngIf="isDataRow(0,row)"></tr>
    <tr mat-row *matRowDef="let row; columns: ['__groupheader']" *ngIf="isGroupHeaderRow(0,row)"></tr>
    <tr mat-row *matRowDef="let row; columns: ['detail']" *ngIf="isDetailRow(0,row)"></tr>
  </table>
</div>

<mat-paginator #paginator
  [length]="serverSide ? total : autoLength"
  [pageSize]="pageSize"
  [pageSizeOptions]="pageSizeOptions"
  [showFirstLastButtons]="true">
</mat-paginator>

Étape 3 — SCSS (ajouts succincts)
.dt-toolbar{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#fafafa;border-bottom:1px solid #e0e0e0;}
.dt-toolbar-left{display:flex;align-items:center;gap:8px;min-height:40px;}
.group-drop{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px dashed #c7c7c7;border-radius:20px;background:#fff;}
.group-drop .hint{color:#888;font-size:.9rem;}
.group-chips{display:flex;gap:6px;}
.chip{display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;background:#e9ecef;}
.chip .label{font-weight:600;}
.chip .icon{width:28px;height:28px;}
.chip .danger{color:#b00020;}
.drag-header,.drag-chip{padding:6px 12px;border-radius:16px;background:#eee;box-shadow:0 2px 8px rgba(0,0,0,.15);}
.group-header{display:flex;align-items:center;gap:6px;padding:6px 0;}
.group-header .title{display:flex;align-items:baseline;gap:6px;}
.group-header .count{color:#777;}
.detail-card{margin-left:24px;border-left:4px solid #2e7d32;background:#f7f9fc;padding:12px;border-radius:8px;}

Ce que fait “retirer le filtre de la barre”

Ici la “barre des filtres” = barre de groupement.

Cliquer sur ✕ d’une puce ou glisser la puce vers l’en-tête (drop sur <thead>) appelle removeGroup(field) → annule ce groupement uniquement. Les autres groupements restent.

Tri Up/Down sur le groupement

Le bouton swap_vert appelle cycleGroupSort(field) qui alterne asc ⇄ desc pour ce niveau.

L’ordre est pris en compte dans groupRows() (tri des données avant génération des headers).

Ce que tu peux supprimer

Toute ancienne implémentation de grouping (fonctions groupRows, applyCollapse, toggleGroup, anciens types/guards si différents).

Garde tout le reste (types de colonnes, pipes, détail de ligne, pagination, recherche, sélection).

Exemple d’utilisation (parent)
<lib-data-table
  [data]="rows"
  [columns]="_columns"
  [enableGrouping]="true"
  [groupBy]="groupFields"
  (groupByChange)="groupFields = $event"
  [rowIdKey]="'id'"
  [enableRowDetail]="true"
  [rowDetailTemplate]="detailTpl">
</lib-data-table>

<ng-template #detailTpl let-row>
  <!-- rendu personnalisé -->
  <div>Transaction {{ row.id }} — {{ row.clientName }}</div>
</ng-template>


C’est tout prêt à coller. Tu auras le drag-to-group, drag-back-to-header (annule le groupement), tri ↑/↓ par niveau, collapse/expand, pagination après grouping, détail de ligne intact.