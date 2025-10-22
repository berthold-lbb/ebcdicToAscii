Top, on adapte tout à datasource: T[] (pas de signal), on filtre les champs vides (matchTag, matchScore, matchApproval), et on préserve la sélection après le patch (en la reconstruisant avec les nouvelles références). Ça marche avec la méthode 1 (patch par id + coloration par id).

B — éditeur (patch typé + filtre des vides)
// bulk-editor.component.ts
import { Component, EventEmitter, Output } from '@angular/core';
import { FormControl } from '@angular/forms';

export interface InfoTransactionModel {
  idTransaction: string | number;
  matchTag?: string;
  matchDate?: string;
  matchScore?: string;
  matchApproval?: string;
}

type TransactionPatch = Partial<
  Pick<InfoTransactionModel, 'matchTag' | 'matchDate' | 'matchScore' | 'matchApproval'>
>;

export type BulkPatchEvent = {
  patch: TransactionPatch;   // seulement les champs non vides
  color?: string;            // pour ngStyle
  cssClass?: string;         // (option) pour ngClass
};

@Component({
  selector: 'app-bulk-editor',
  template: `
    <input class="form-control" [formControl]="tag"      placeholder="matchTag">
    <input class="form-control" [formControl]="date"     placeholder="matchDate">
    <select class="form-select"  [formControl]="score"   style="max-width: 140px">
      <option value="">score ?</option>
      <option *ngFor="let s of scores" [value]="s">{{s}}</option>
    </select>
    <input class="form-control" [formControl]="approval" placeholder="matchApproval">

    <input type="color" class="form-control form-control-color" [formControl]="color">
    <input class="form-control" [formControl]="klass" placeholder="cssClass (option)">

    <button class="btn btn-primary mt-2" (click)="emit()">Appliquer</button>
  `
})
export class BulkEditorComponent {
  @Output() applyPatch = new EventEmitter<BulkPatchEvent>();

  scores = ['20%','30%','40%','50%','60%','70%','80%','90%','100%'];

  tag      = new FormControl<string>('');
  date     = new FormControl<string>('');
  score    = new FormControl<string>('');
  approval = new FormControl<string>('');
  color    = new FormControl<string>('#fffbd6');
  klass    = new FormControl<string>('');

  private isBlank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

  emit() {
    const p: TransactionPatch = {};

    const t = this.tag.value;
    const d = this.date.value;
    const s = this.score.value;
    const a = this.approval.value;

    if (!this.isBlank(t)) p.matchTag = t!.trim();
    if (!this.isBlank(d)) p.matchDate = d!.trim();
    if (!this.isBlank(s)) p.matchScore = s!.trim();
    if (!this.isBlank(a)) p.matchApproval = a!.trim();

    if (!Object.keys(p).length) return;

    this.applyPatch.emit({
      patch: p,
      color: this.color.value || undefined,
      cssClass: this.klass.value?.trim() || undefined
    });
  }
}

A — host (datasource array, patch par id, couleur par id, sélection reconstruite)
// host.component.ts
import { Component } from '@angular/core';
import type { BulkPatchEvent } from '../bulk-editor/bulk-editor.component';

type Id = string | number;

@Component({
  selector: 'app-transactions-table',
  templateUrl: './host.component.html'
})
export class HostComponent<T extends Record<string, any>> {
  // ==== Données & sélection ====
  rowIdKey: keyof T = 'idTransaction' as any;   // adapte la clé id
  datasource: T[] = [];                          // <-- tableau, pas signal
  selectedROWS: T[] = [];

  // Styles mémorisés par ID (stables même si les objets changent)
  private editedBgById    = new Map<Id, string>();
  private editedClassById = new Map<Id, string>();

  // Utils
  private getId = (row: T): Id => row[this.rowIdKey] as Id;
  private selToIds = (rows: T[]) => new Set(rows.map(r => this.getId(r)));
  private isBlank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

  // Optionnel : re-filtrer un patch arrivé côté A (sécurité)
  private sanitizePatch(patch: Record<string, any>): Record<string, any> {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (!this.isBlank(v)) cleaned[k] = typeof v === 'string' ? v.trim() : v;
    }
    return cleaned;
  }

  onSelectedROWSChange(rows: T[]) {
    this.selectedROWS = rows ?? [];
  }

  // ===== Patch immuable + couleurs garanties + sélection persistante =====
  onApplyPatchFromB(evt: BulkPatchEvent) {
    let { patch, color, cssClass } = evt;
    const cleanPatch = this.sanitizePatch(patch as Record<string, any>);
    if (!Object.keys(cleanPatch).length) return;

    const ids = this.selToIds(this.selectedROWS);
    if (!ids.size) return;

    // 1) Mémoriser style par ID
    if (color)    ids.forEach(id => this.editedBgById.set(id, color!));
    if (cssClass) ids.forEach(id => this.editedClassById.set(id, cssClass!));

    // 2) Appliquer patch IMMUTABLE par id
    const next = this.datasource.map(r => {
      const id = this.getId(r);
      return ids.has(id) ? { ...r, ...cleanPatch } as T : r;
    });

    // 3) Remplacer la datasource (nouvelle référence d'array)
    this.datasource = next;

    // 4) Refaire la sélection avec les NOUVELLES références (persistance assurée)
    this.selectedROWS = next.filter(r => ids.has(this.getId(r)));
  }

  // ==== Hooks de style pour lib-data-table ====
  rowStyleFn = (row: T) => {
    const bg = this.editedBgById.get(this.getId(row));
    return bg ? { backgroundColor: bg } : null;
  };

  rowClassFn = (row: T) => this.editedClassById.get(this.getId(row)) ?? null;
}

<!-- host.component.html -->
<app-bulk-editor (applyPatch)="onApplyPatchFromB($event)"></app-bulk-editor>

<lib-data-table
  [data]="datasource"
  [rowIdKey]="rowIdKey"
  [selectedROWS]="selectedROWS"
  (selectedROWSChange)="onSelectedROWSChange($event)"
  [pageSize]="5"
  [pageSizeOptions]="[5,10,25,50]"
  [enableOrder]="true"

  [rowStyleFn]="rowStyleFn"
  [rowClassFn]="rowClassFn">
</lib-data-table>

lib-data-table (si besoin des hooks)
// lib-data-table.component.ts
@Input() rowStyleFn?: (row: any) => Record<string, string> | null;
@Input() rowClassFn?: (row: any) => string | string[] | Set<string> | null;

trackById = (_: number, row: any) => row[this.rowIdKey as string];

<tr *ngFor="let row of view; trackBy: trackById"
    [ngStyle]="rowStyleFn?.(row) || null"
    [ngClass]="rowClassFn?.(row) || null">
  <!-- cells -->
</tr>

Ce que cette version te garantit

Les champs vides (matchTag, matchScore, matchApproval, etc.) sont ignorés (filtrés côté B et re-sanitisés côté A).

Couleur/classe restent visibles après patch, tri, pagination ou reload → stockées par ID.

Sélection persistante : reconstruite avec les nouvelles références tout de suite après le map.

Compatible OnPush (nouvelle référence de tableau), sans mutation des objets hors patch cib