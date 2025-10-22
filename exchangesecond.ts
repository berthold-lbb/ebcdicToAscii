🚮 À SUPPRIMER (si présent dans ta classe)

Anciennes interfaces & helpers de groupage :
GroupHeaderRow<T> (ancienne version avec rows?, count?, collapsed?),
groupRows(...), onDropGrouping(...), onDropGroupingReorder(...),
moveItemInArray(...), addGroup(...), removeGroupAt(...),
toggleGroup(...) (ancienne), isGroupHeaderRow(...).

L’ancienne implémentation de rowsForRender() qui mélangeait group/détail/pagination.

Garde tout le reste (tri, sélection, détail de ligne, pagination, etc.).

✅ data-table.component.ts (bloc grouping complet)

Ajoute les imports/animations et ce bloc dans ta classe.
Rien d’autre de ta table n’a besoin de bouger.

// ===== imports à AJOUTER tout en haut =====
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { animate, state, style, transition, trigger } from '@angular/animations';

// ===== types =====
type IdType = string | number;

interface DetailRow<T> {
  __detail: true;
  forId: IdType;
  host: T;
}

interface GroupHeaderRow {
  __group: true;
  key: string;                         // clé unique (inclut le level)
  level: number;                       // 0,1,2,… selon l’index dans groupBy
  values: Record<string, unknown>;     // { field0: value0, field1: value1, …(jusqu'au level) }
  count: number;                       // nombre de lignes (feuilles) dans CE sous-groupe
}

@Component({
  // ...
  imports: [
    // … tes imports actuels …
    DragDropModule
  ],
  animations: [
    trigger('groupToggle', [
      state('collapsed', style({ height: '0px', opacity: 0, overflow: 'hidden' })),
      state('expanded',  style({ height: '*',   opacity: 1 })),
      transition('collapsed <=> expanded', animate('180ms ease'))
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent<T extends Record<string, any>> /* … */ {

  // … tes membres existants (dataSource, paginator, sort, selection, etc.) …

  // ──────────────────────────────────────────────────────────
  // 1) API grouping
  @Input() enableGrouping = false;
  /** colonnes à grouper, dans l'ordre (ex: ['state', 'phone']) */
  @Input() groupBy: string[] = [];
  @Input() groupHint = 'Drag a column header here to group by that column';

  private collapsedGroups = new Set<string>();      // stocke les clés pliées

  // helper : colonne déjà groupée ?
  isColumnGrouped = (name: string) => this.groupBy.includes(name);

  // DnD : dépôt depuis l’entête vers le panneau de groupage
  dropOnGroupPanel(ev: CdkDragDrop<string[]>): void {
    const col = ev.item?.data as string;
    if (!col || this.isColumnGrouped(col)) return;
    this.groupBy = [...this.groupBy, col];
    this.collapsedGroups.clear();
  }

  // retirer une colonne du groupBy
  ungroup(name: string): void {
    const i = this.groupBy.indexOf(name);
    if (i !== -1) {
      const copy = [...this.groupBy];
      copy.splice(i, 1);
      this.groupBy = copy;
      this.collapsedGroups.clear();
    }
  }

  // chevron
  toggleGroup(key: string): void {
    if (this.collapsedGroups.has(key)) this.collapsedGroups.delete(key);
    else this.collapsedGroups.add(key);
  }

  // ──────────────────────────────────────────────────────────
  // 2) construction des groupes multi‐niveaux + comptage

  /** sépareteur rare + préfixe de level pour des clés uniques */
  private makePrefixKey(vals: unknown[], level: number): string {
    // exemple: "L0|Arkansas"  "L1|Arkansas␟(800) 555-2797"
    const SEP = '␟';
    const v = vals.slice(0, level + 1).map(x => String(x)).join(SEP);
    return `L${level}|${v}`;
  }

  /** trie client par les colonnes du groupBy, pour avoir des blocs contigus (si nécessaire) */
  private sortByGroupFields(base: T[]): T[] {
    if (!this.enableGrouping || this.groupBy.length === 0) return base;
    const fields = [...this.groupBy];
    // tri stable simple
    return [...base].sort((a, b) => {
      for (const f of fields) {
        const av = a?.[f], bv = b?.[f];
        if (av == null && bv == null) continue;
        if (av == null) return -1;
        if (bv == null) return 1;
        if (av < bv) return -1;
        if (av > bv) return 1;
      }
      return 0;
    });
  }

  /** première passe : comptage des feuilles pour chaque préfixe (chaque level) */
  private buildCountMap(sorted: T[]): Map<string, number> {
    const counts = new Map<string, number>();
    if (!this.enableGrouping || this.groupBy.length === 0) return counts;
    for (const r of sorted) {
      const vals = this.groupBy.map(f => r?.[f]);
      for (let lvl = 0; lvl < this.groupBy.length; lvl++) {
        const key = this.makePrefixKey(vals, lvl);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }

  /**
   * seconde passe : émettre les en-têtes de groupe imbriqués
   * + les lignes, en insérant un header à chaque changement de valeur au niveau considéré
   */
  private buildGroupedSequence(sorted: T[], counts: Map<string, number>): Array<T | GroupHeaderRow> {
    if (!this.enableGrouping || this.groupBy.length === 0) return sorted;
    const out: Array<T | GroupHeaderRow> = [];
    const prev: unknown[] = new Array(this.groupBy.length).fill(Symbol('init'));

    for (const row of sorted) {
      const vals = this.groupBy.map(f => row?.[f]);

      // détecte à partir de quel niveau la valeur change
      let changedAt = -1;
      for (let lvl = 0; lvl < vals.length; lvl++) {
        if (vals[lvl] !== prev[lvl]) { changedAt = lvl; break; }
      }
      // si le premier niveau a changé (ou rien n’a encore été émis), on émet les headers
      if (changedAt !== -1) {
        for (let lvl = changedAt; lvl < this.groupBy.length; lvl++) {
          const key = this.makePrefixKey(vals, lvl);
          const header: GroupHeaderRow = {
            __group: true,
            key,
            level: lvl,
            values: Object.fromEntries(
              this.groupBy.slice(0, lvl + 1).map((f, i) => [f, vals[i]])
            ),
            count: counts.get(key) ?? 0
          };
          out.push(header);
        }
        // met à jour les "prev"
        for (let lvl = 0; lvl < vals.length; lvl++) prev[lvl] = vals[lvl];
      }

      out.push(row);
    }

    return out;
  }

  /** masque les blocs situés sous un header plié (parent compris) */
  private applyCollapse(seq: Array<T | GroupHeaderRow | DetailRow<T>>): Array<T | GroupHeaderRow | DetailRow<T>> {
    if (this.collapsedGroups.size === 0) return seq;

    const out: Array<T | GroupHeaderRow | DetailRow<T>> = [];
    // niveau actuellement masqué (si un parent est collapsed). null = rien masqué
    let hideLevel: number | null = null;

    for (const item of seq) {
      const isHeader = !!(item as any).__group;
      if (isHeader) {
        const h = item as GroupHeaderRow;

        // si on arrive à un header de niveau supérieur ou égal à hideLevel -> on peut réévaluer
        if (hideLevel !== null && h.level <= hideLevel) hideLevel = null;

        const collapsed = this.collapsedGroups.has(h.key);

        // si un parent est masqué (hideLevel !== null) et que ce header est plus profond -> on le masque aussi
        if (hideLevel !== null && h.level > hideLevel) {
          // ne rien pousser (tout le sous-arbre reste caché)
          continue;
        }

        out.push(item);
        if (collapsed) hideLevel = h.level; // à partir d’ici on cache tout ce qui est plus profond
        continue;
      }

      // item = data row / detail row
      if (hideLevel !== null) continue; // sous un parent plié -> on masque
      out.push(item);
    }

    return out;
  }

  // ──────────────────────────────────────────────────────────
  // 3) predicates MatTable
  isGroupHeader = (_: number, row: any): row is GroupHeaderRow =>
    !!row && typeof row === 'object' && (row as any).__group === true;

  isDetailRow = (_: number, row: any) =>
    !!row && typeof row === 'object' && (row as any).__detail === true;

  // ──────────────────────────────────────────────────────────
  // 4) pagination générique (après grouping + détail)
  private pageSlice<R>(rows: R[]): R[] {
    if (!this.paginator || this.serverSide) return rows;
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return rows.slice(start, start + this.paginator.pageSize);
  }

  // ──────────────────────────────────────────────────────────
  // 5) séquence finale de rendu (REMPLACE ton ancien getter)
  get rowsForRender(): Array<T | GroupHeaderRow | DetailRow<T>> {
    // base (filtrée si besoin)
    const base = this.dataSource.filteredData?.length
      ? (this.dataSource.filteredData as T[])
      : (this.dataSource.data ?? []);

    // tri par colonnes de groupBy pour que les blocs soient contigus
    const sorted = this.sortByGroupFields(base);

    // multi-group + headers + count
    const grouped = this.buildGroupedSequence(sorted, this.buildCountMap(sorted));

    // insérer la ligne de détail juste après l’hôte
    const withDetail: Array<T | GroupHeaderRow | DetailRow<T>> = [];
    for (const it of grouped) {
      withDetail.push(it as any);
      if (!this.expandedId) continue;
      if (!this.isGroupHeader(0, it) && !this.isDetailRow(0, it)) {
        const id = this._rowId(it as T);
        if (id === this.expandedId) {
          withDetail.push({ __detail: true, forId: id, host: it as T });
        }
      }
    }

    // appliquer collapse
    const collapsed = this.applyCollapse(withDetail);

    // pagination
    return this.pageSlice(collapsed);
  }

  // … garde tes autres méthodes (_rowId, onRowDblClick, sélection, etc.) …
}

🧱 data-table.component.html (zones à ajouter)

Panneau de groupage à gauche dans la toolbar.

Entête draggable (drag des th vers le panneau).

Ligne header de groupe avec indentation, libellé “Field: Value (count)”, chevron.

Les colonnes groupées sont masquées de l’entête et des cellules.

<div class="dt-root">

  <!-- TOOLBAR -->
  <div class="dt-toolbar">
    <!-- GAUCHE : panneau de groupage -->
    <div class="dt-toolbar-left" *ngIf="enableGrouping">
      <div class="group-panel"
           cdkDropList cdkDropListOrientation="horizontal"
           (cdkDropListDropped)="dropOnGroupPanel($event)">
        <span class="group-hint" *ngIf="groupBy.length === 0">{{ groupHint }}</span>

        <ng-container *ngFor="let g of groupBy">
          <span class="group-chip" cdkDrag [cdkDragData]="g" cdkDragPreviewClass="drag-chip">
            {{ (visibleColumnDefs.find(c => c.nom===g) || _columns.find(c => c.nom===g))?.label || g }}
            <button mat-icon-button type="button" (click)="ungroup(g)" title="Remove">
              <mat-icon>close</mat-icon>
            </button>
          </span>
        </ng-container>
      </div>
    </div>

    <!-- DROITE : tes icônes / search / actions -->
    <div class="dt-toolbar-right">
      <ng-content select="[toolbar-actions]"></ng-content>
    </div>
  </div>

  <!-- TABLE SCROLLABLE -->
  <div class="dt-center dt-scroll">
    <table mat-table [dataSource]="rowsForRender" class="dt-table" multiTemplateDataRows>

      <!-- Colonnes dynamiques : EN-TÊTES DRAGGABLES + masquer si groupées -->
      <ng-container *ngFor="let col of visibleColumnDefs" [matColumnDef]="col.nom">
        <th mat-header-cell *matHeaderCellDef
            cdkDrag [cdkDragData]="col.nom" cdkDragPreviewClass="drag-header"
            *ngIf="!isColumnGrouped(col.nom)">
          {{ col.label }}
        </th>

        <!-- TA cellule par défaut (tu peux garder ton switch TableDataType) -->
        <td mat-cell *matCellDef="let row"
            *ngIf="!isColumnGrouped(col.nom) && !(row as any).__detail && !(row as any).__group">
          {{ row[col.nom] }}
        </td>
      </ng-container>

      <!-- LIGNE: header de groupe -->
      <ng-container matColumnDef="__group">
        <th mat-header-cell *matHeaderCellDef class="invisible"></th>
        <td mat-cell *matCellDef="let row" [attr.colspan]="displayedColumns.length" *ngIf="(row as any).__group">
          <div class="group-header-row" [style.padding-left.px]="16 + (row as any).level * 20">
            <button class="chev" type="button" (click)="toggleGroup((row as any).key)">
              <mat-icon>
                {{ collapsedGroups.has((row as any).key) ? 'chevron_right' : 'expand_more' }}
              </mat-icon>
            </button>
            <strong>
              <!-- affiche "Field: Value" du niveau courant -->
              <!-- le champ concerné est groupBy[row.level] -->
              {{ (visibleColumnDefs.find(x => x.nom===groupBy[(row as any).level]) || _columns.find(x => x.nom===groupBy[(row as any).level]))?.label
                 || groupBy[(row as any).level] }}:
              {{ (row as any).values[groupBy[(row as any).level]] }}
              ({{ (row as any).count }})
            </strong>
          </div>
        </td>
      </ng-container>

      <!-- LIGNE: détail -->
      <ng-container matColumnDef="__detail">
        <th mat-header-cell *matHeaderCellDef class="invisible"></th>
        <td mat-cell *matCellDef="let row" [attr.colspan]="displayedColumns.length" *ngIf="(row as any).__detail">
          <div class="detail-card" [@groupToggle]="'expanded'">
            <ng-container *ngIf="rowDetailTemplate; else jsonFallback"
              [ngTemplateOutlet]="rowDetailTemplate"
              [ngTemplateOutletContext]="{$implicit: (row as any).host, row: (row as any).host}">
            </ng-container>
            <ng-template #jsonFallback>
              <pre>{{ (row as any).host | json }}</pre>
            </ng-template>
          </div>
        </td>
      </ng-container>

      <!-- ROW DEFS -->
      <tr mat-header-row
          *matHeaderRowDef="displayedColumns.filter(c => !isColumnGrouped(c)); sticky: stickyHeader"></tr>

      <tr mat-row *matRowDef="let row; columns: ['__group']; when: isGroupHeader"></tr>
      <tr mat-row *matRowDef="let row; columns: ['__detail']; when: isDetailRow"></tr>

      <tr mat-row
          *matRowDef="let row; columns: displayedColumns.filter(c => !isColumnGrouped(c))"
          (dblclick)="onRowDblClick(row)">
      </tr>
    </table>
  </div>

  <!-- PAGINATEUR -->
  <mat-paginator class="dt-paginator"
                 [length]="serverSide ? total : autoLength"
                 [pageSize]="pageSize"
                 [pageSizeOptions]="pageSizeOptions"
                 [showFirstLastButtons]="true">
  </mat-paginator>
</div>

🎨 data-table.component.scss (ajouts utiles)
.dt-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 10px; border-bottom:1px solid #e0e0e0; background:#fafafa; }
.dt-toolbar-left { display:flex; align-items:center; min-width:320px; }
.group-panel { min-height:36px; display:flex; gap:8px; align-items:center; padding:4px 8px; border:1px dashed #c7c7c7; border-radius:8px; background:#fff; }
.group-hint { color:#888; font-style:italic; }
.group-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:16px; background:#eaeaea; cursor:grab; }
.drag-header, .drag-chip { padding:6px 10px; border-radius:16px; background:#eaeaea; box-shadow:0 4px 12px rgba(0,0,0,.15); }
.invisible { visibility:hidden; height:0; padding:0; margin:0; border:0; }

.group-header-row { display:flex; align-items:center; gap:8px; padding:6px 0; }
.group-header-row .chev { border:none; background:transparent; cursor:pointer; display:flex; align-items:center; }

.dt-center.dt-scroll { overflow:auto; position:relative; }
.dt-table { width:100%; }
.dt-paginator { border-top:1px solid #e0e0e0; background:#fff; }

🧪 Exemple d’utilisation
<lib-data-table
  [data]="rows"
  [columns]="columns"
  [rowIdKey]="'id'"
  [enableRowDetail]="true"
  [rowDetailTemplate]="detailTpl"

  [enableGrouping]="true"
  [groupBy]="['state','phone']"
  [groupHint]="'Drag a column header here to group by that column'">

  <!-- à droite de la barre (icônes/recherche) -->
  <div toolbar-actions>
    <!-- tes actions -->
  </div>
</lib-data-table>

<ng-template #detailTpl let-row>
  <app-transaction-details [row]="row"></app-transaction-details>
</ng-template>

Points clés

Multi-grouping : groupBy=['col1','col2',...]. On émet des headers imbriqués (level 0, puis 1, …) à chaque changement.

Compteurs : calculés via buildCountMap() et affichés (count) au niveau courant.

Collapse : toggleGroup(key) sur un header cache toutes les lignes et les sous-headers jusqu’au prochain header de niveau ≤.

Drag & Drop : on drag un <th> (en-tête) vers la group-panel. La colonne disparaît de l’en-tête et devient un “chip” dans la panel (comme DevExtreme).

Tri pour cohérence : sortByGroupFields trie côté client par groupBy pour que les blocs soient contigus (si ton serveur ne le garantit pas).

Compatibilité : aucun @if/@for — uniquement *ngIf/*ngFor. Toutes tes autres features restent intactes.