1) Dans A (le composant qui encapsule lib-data-table)

Il expose déjà [(selectedRows)] (tu le montres dans B ✅).

On ajoute deux @Input():

applyValues: { tag?: string; proprietaire?: string; score?: number }

applyTrigger: number (un compteur; à chaque incrément → on applique aux lignes sélectionnées)

A connaît sa dataSource (tu l’as dans ton screenshot 1). Il patchera ses lignes.

// composant-a.component.ts
import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, signal, computed } from '@angular/core';

type Id = string | number;
export interface Row {
  idTransaction: Id;
  tag?: string;
  proprietaire?: string;
  score?: number; // 10..100
  // ...autres colonnes
}

@Component({
  selector: 'composant-a',
  standalone: true,
  templateUrl: './composant-a.component.html',
})
export class ComposantAComponent implements OnChanges {
  // --- Data du tableau (A est la source pour lib-data-table) ---
  @Input() dataSource: Row[] = [];
  @Output() dataSourceChange = new EventEmitter<Row[]>(); // si tu veux remonter au parent (optionnel)

  // --- Sélection surfacée vers B ---
  @Input() selectedRows: any[] = [];
  @Output() selectedRowsChange = new EventEmitter<any[]>();

  // --- Clé d'identifiant (tu la passes déjà à lib-data-table) ---
  @Input() rowIdKey: keyof Row = 'idTransaction';

  // --- Nouveau: patch à appliquer + trigger ---
  @Input() applyValues: Partial<Pick<Row, 'tag' | 'proprietaire' | 'score'>> | null = null;
  @Input() applyTrigger = 0; // le parent B fera: this.applyTrigger++

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['applyTrigger']) {
      this.applyPatchToSelected();
    }
  }

  private normalizeSelectionToIds(sel: any[]): Set<Id> {
    if (!sel?.length) return new Set<Id>();
    const first = sel[0];
    if (typeof first === 'string' || typeof first === 'number') {
      return new Set<Id>(sel as Id[]);
    }
    // sinon, ce sont des objets:
    return new Set<Id>(sel.map((r: any) => r?.[this.rowIdKey as string]));
  }

  private applyPatchToSelected() {
    if (!this.applyValues) return;
    const ids = this.normalizeSelectionToIds(this.selectedRows);
    if (!ids.size) return;

    const { tag, proprietaire, score } = this.applyValues;

    // Patch immuable
    const patched = this.dataSource.map(r => {
      if (!ids.has(r[this.rowIdKey] as Id)) return r;
      return {
        ...r,
        ...(tag !== undefined ? { tag } : {}),
        ...(proprietaire !== undefined ? { proprietaire } : {}),
        ...(score !== undefined ? { score } : {}),
      };
    });

    this.dataSource = patched;
    this.dataSourceChange.emit(patched); // utile si B tient la vérité
    // Optionnel: vider la sélection après
    // this.selectedRows = [];
    // this.selectedRowsChange.emit([]);
  }
}

<!-- composant-a.component.html -->
<lib-data-table
  [data]="dataSource"
  [columns]="columns"               <!-- tes colonnes existantes -->
  [hiddenColumns]="hiddenColumns"
  [enableOrder]="true"
  [loading]="loading"
  [pageSize]="5"
  [pageSizeOptions]="[5,10,25,50]"
  [highlightSelection]="highlightedOn"
  [highlightColor]="colorBG"
  [rowIdKey]="rowIdKey"
  [enableRowDetail]="true"
  [rowDetailTemplate]="detailTpl"

  [(selectedRows)]="selectedRows"
  (selectedRowsChange)="selectedRowsChange.emit($event)"

  (cellClick)="onCellClick($event)"
>
</lib-data-table>

<ng-template #detailTpl let-row="row">
  <!-- ton template détail -->
  <div>Id: {{ row.idTransaction }} — Tag: {{ row.tag }} — Prop: {{ row.proprietaire }} — Score: {{ row.score }}%</div>
</ng-template>

2) Dans B (le parent de A)

B a 3 contrôles : tag, propriétaire, score (10..100%).

B passe ces valeurs à A via [applyValues].

Quand on clique “Appliquer”, B incrémente applyTrigger → A applique aux lignes sélectionnées.

// composant-b.component.ts
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ComposantAComponent, Row } from './composant-a.component';

@Component({
  selector: 'composant-b',
  standalone: true,
  imports: [ReactiveFormsModule, ComposantAComponent],
  templateUrl: './composant-b.component.html',
})
export class ComposantBComponent {
  // B peut fournir la data à A (ou A peut la charger ; dans les deux cas, A patchera sa copie)
  dataSource = signal<Row[]>([
    { idTransaction: 1, tag: '', proprietaire: '', score: 50 },
    // ...
  ]);

  // sélection qui remonte depuis A (IDs ou objets – on s’en fiche, A sait normaliser)
  selectedFromTable = signal<any[]>([]);

  // 3 inputs
  tagCtrl = new FormControl<string>('', { nonNullable: true });
  proprietaireCtrl = new FormControl<string>('', { nonNullable: true });
  scoreCtrl = new FormControl<string>('70%'); // 10%..100%

  // Déclencheur
  applyCounter = signal(0);

  // Valeurs “propres” à passer à A
  get applyValues() {
    return {
      tag: this.tagCtrl.value?.trim() || undefined,
      proprietaire: this.proprietaireCtrl.value?.trim() || undefined,
      score: this.coercePercent(this.scoreCtrl.value) ?? undefined,
    } as Partial<Pick<Row, 'tag'|'proprietaire'|'score'>>;
  }

  private coercePercent(v: string | null): number | null {
    if (!v) return null;
    const m = v.match(/^(\d{1,3})\s*%?$/);
    if (!m) return null;
    const n = Number(m[1]);
    return n >= 0 && n <= 100 ? n : null;
    }

  apply() {
    // incrémenter -> A reçoit ngOnChanges(applyTrigger) et applique
    this.applyCounter.update(n => n + 1);
  }

  onRangeCreditReady(e: any) {
    // ton handler existant
  }
}

<!-- composant-b.component.html -->
<div class="toolbar" style="display:flex; gap:.5rem; align-items:center; flex-wrap:wrap;">
  <input [formControl]="tagCtrl" placeholder="Tag" />
  <input [formControl]="proprietaireCtrl" placeholder="Propriétaire" />
  <select [formControl]="scoreCtrl">
    <option *ngFor="let p of [10,20,30,40,50,60,70,80,90,100]" [value]="p + '%'">{{ p }}%</option>
  </select>

  <button type="button"
          (click)="apply()"
          [disabled]="!selectedFromTable().length">
    Appliquer aux lignes sélectionnées
  </button>
</div>

<composant-a
  [dataSource]="dataSource()"
  (dataSourceChange)="dataSource.set($event)"     <!-- si tu veux que B garde la vérité -->
  [(selectedRows)]="selectedFromTable()"
  (selectedRowsChange)="selectedFromTable.set($event)"

  [rowIdKey]="'idTransaction'"

  [highlightedOn]="highlightedOn"
  [colorBG]="colorBG"

  [applyValues]="applyValues"
  [applyTrigger]="applyCounter()"

  (rangeReady)="onRangeCreditReady($event)"
></composant-a>