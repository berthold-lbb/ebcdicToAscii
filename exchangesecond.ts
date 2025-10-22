B (éditeur) — émet juste le patch
// bulk-editor.component.ts (B)
import { Component, EventEmitter, Output } from '@angular/core';
import { FormControl } from '@angular/forms';

export type BulkPatchEvent = {
  patch: Record<string, any>;
  color?: string;     // pour ngStyle
  cssClass?: string;  // pour ngClass (optionnel)
};

@Component({
  selector: 'app-bulk-editor',
  template: `
    <input class="form-control" [formControl]="tag"    placeholder="tag">
    <input class="form-control" [formControl]="owner"  placeholder="owner">
    <select class="form-select" [formControl]="score">
      <option value="">score ?</option>
      <option *ngFor="let s of ['20%','30%','40%','50%','60%','70%','80%','90%','100%']" [value]="s">{{s}}</option>
    </select>
    <input type="color" class="form-control form-control-color" [formControl]="color">
    <input class="form-control" [formControl]="klass" placeholder="cssClass (ex: row-edited)">
    <button class="btn btn-primary mt-2" (click)="emit()">Appliquer aux lignes sélectionnées</button>
  `
})
export class BulkEditorComponent {
  @Output() applyPatch = new EventEmitter<BulkPatchEvent>();
  tag = new FormControl<string>(''); owner = new FormControl<string>(''); score = new FormControl<string>('');
  color = new FormControl<string>('#fffbd6'); klass = new FormControl<string>('');

  emit() {
    const p: Record<string, any> = {};
    if (this.tag.value?.trim())   p['tag'] = this.tag.value.trim();
    if (this.owner.value?.trim()) p['owner'] = this.owner.value.trim();
    if (this.score.value?.trim()) p['score'] = this.score.value.trim();
    if (!Object.keys(p).length) return;
    this.applyPatch.emit({ patch: p, color: this.color.value || undefined, cssClass: this.klass.value || undefined });
  }
}

A (contient lib-data-table) — datasource: T[]

Ici on travaille par référence d’objet (puisque (selectedROWSChange) te renvoie T[]).
On mute les objets sélectionnés (pas leurs ids), puis on republie le tableau pour déclencher CD.
On mémorise la couleur/la classe dans des WeakMap<T, string>.

// host.component.ts (A)
import { Component, signal } from '@angular/core';
import type { BulkPatchEvent } from '../bulk-editor/bulk-editor.component';

@Component({
  selector: 'app-transactions-table',
  templateUrl: './host.component.html'
})
export class HostComponent<T extends object = any> {
  rowIdKey = 'idTransaction';            // déjà utilisé par ton lib
  datasource = signal<T[]>([]);          // <= T[]
  selectedROWS: T[] = [];                // <= T[]

  // coloration: T -> couleur / classe
  private editedBg = new WeakMap<T, string>();
  private editedClass = new WeakMap<T, string>();

  onSelectedROWSChange(rows: T[]) {
    this.selectedROWS = rows ?? [];
  }

  // Reçoit le patch depuis B
  onApplyPatchFromB(evt: BulkPatchEvent) {
    if (!this.selectedROWS.length) return;

    const { patch, color, cssClass } = evt;
    const arr = this.datasource();

    // 1) muter chaque objet sélectionné (référence conservée => sélection intacte)
    for (const row of arr) {
      if (this.selectedROWS.includes(row)) {
        Object.assign(row, patch);
        if (color)    this.editedBg.set(row, color);
        if (cssClass) this.editedClass.set(row, cssClass);
      }
    }

    // 2) republier le tableau (nouvelle référence d'array, mêmes objets)
    this.datasource.set([...arr]);
  }

  // Hooks de style/classe consommés par le lib (écran 4)
  rowStyleFn = (row: T) => {
    const bg = this.editedBg.get(row);
    return bg ? { backgroundColor: bg } : null;
  };

  rowClassFn = (row: T) => this.editedClass.get(row) ?? null;
}

<!-- host.component.html (A) -->
<app-bulk-editor (applyPatch)="onApplyPatchFromB($event)"></app-bulk-editor>

<lib-data-table
  [data]="datasource()"
  [rowIdKey]="rowIdKey"
  [selectedROWS]="selectedROWS"
  (selectedROWSChange)="onSelectedROWSChange($event)"
  [pageSize]="5"
  [pageSizeOptions]="[5,10,25,50]"
  [enableOrder]="true"

  <!-- Choisis l’un ou l’autre, selon ce que tu exposes dans ton lib -->
  [rowStyleFn]="rowStyleFn"
  [rowClassFn]="rowClassFn">
</lib-data-table>

Côté lib-data-table (si pas déjà fait)
// lib-data-table.component.ts
@Input() rowStyleFn?: (row: any) => Record<string, string> | null;
@Input() rowClassFn?: (row: any) => string | string[] | Set<string> | null;

<!-- lib-data-table.template.html -->
<tr *ngFor="let row of view; trackBy: trackById"
    [ngStyle]="rowStyleFn?.(row) || null"
    [ngClass]="rowClassFn?.(row) || null">
  <!-- cells -->
</tr>
