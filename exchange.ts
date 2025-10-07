1) TS — ajouts / corrections

Assure-toi d’avoir ces imports en haut du fichier :

import {
  AfterViewInit, ChangeDetectionStrategy, Component, ContentChild,
  EventEmitter, Input, OnChanges, Output, SimpleChanges, TemplateRef, ViewChild
} from '@angular/core';


Garde ton interface TableAction<T> et ajoute/valide ces champs dans la classe :

// En-tête visible ?
@Input() showHeader = true;

// ===== Colonne “actions” (100% optionnelle) =====
@Input() showActionsColumn = false;
@Input() actionsHeaderLabel = '';
@Input() actions: TableAction<T>[] = [];  // peut rester vide
@Output() action = new EventEmitter<{ actionId: string; row: T; index: number }>();

// Template libre projeté (optionnel)
@ContentChild('rowActions', { read: TemplateRef })
actionsTpl?: TemplateRef<any>;

onAction(a: TableAction<T>, row: T, index: number, ev: MouseEvent) {
  ev.stopPropagation();
  this.action.emit({ actionId: a.id, row, index });
}

isMatPalette(c?: string): c is 'primary'|'accent'|'warn' {
  return c === 'primary' || c === 'accent' || c === 'warn';
}


Dans _recomputeVisible() ne change rien à part t’assurer que la colonne "actions" n’est ajoutée que si showActionsColumn est true (ce que tu fais déjà) :

if (this.showActionsColumn && !this.displayedColumns.includes('actions')) {
  this.displayedColumns = [...this.displayedColumns, 'actions'];
}
if (!this.showActionsColumn) {
  this.displayedColumns = this.displayedColumns.filter(c => c !== 'actions');
}


Rien d’autre à toucher côté TS. Si actionsTpl est undefined et actions est vide, la vue ne rendra rien — pas d’exception.

2) HTML — bloc “actions” sûr (nouvelle syntaxe)

row + index sont fournis via *matCellDef="let row; let i = index".

Si actionsTpl existe → on l’outlet.

Sinon, si actions?.length → on boucle et on rend les boutons.

Sinon → on ne met rien dans la cellule.

<!-- Colonne ACTIONS (optionnelle) -->
@if (showActionsColumn) {
  <ng-container matColumnDef="actions">
    <th mat-header-cell *matHeaderCellDef [class.sticky]="stickyHeader">
      {{ actionsHeaderLabel || '' }}
    </th>

    <td mat-cell *matCellDef="let row; let i = index" class="col-actions">
      @if (actionsTpl) {
        <ng-container
          [ngTemplateOutlet]="actionsTpl"
          [ngTemplateOutletContext]="{ $implicit: row, index: i }">
        </ng-container>
      } @else if (actions?.length) {
        @for (a of actions; track a.id) {
          <button mat-raised-button
                  class="mr-2"
                  [color]="isMatPalette(a.color) ? a.color : null"
                  [ngStyle]="!isMatPalette(a.color) && a.color ? {'background': a.color, 'color':'#fff'} : null"
                  [disabled]="a.disabled?.(row,i)"
                  [matTooltip]="a.tooltip || a.label || ''"
                  (click)="onAction(a,row,i,$event)">
            @if (a.icon) { <mat-icon class="mr-1">{{ a.icon }}</mat-icon> }
            @if (a.label) { <span>{{ a.label }}</span> }
          </button>
        }
      } @else {
        <!-- aucune action fournie : ne rien afficher -->
      }
    </td>
  </ng-container>
}


Ce bloc ne jette aucune erreur même si tu n’envoies ni template ni actions.

3) Rappel : row dans tes colonnes dynamiques

Vérifie que toutes tes cellules ont bien *matCellDef="let row" (et let i = index si tu as besoin de l’index), par ex. :

@case (TableDataType.STRING) {
  <td mat-cell *matCellDef="let row"
      class="data-table-colonne-{{ col.nom }}"
      [class.cell-clickable]="col.clickable"
      (click)="col.clickable && onCellClick($event, row, col)">
    {{ row[col.nom] }}
  </td>
}

4) (optionnel) Masquer le menu colonnes selon un input

Tu as demandé plus haut showColumnRetractable. Si ce n’est pas déjà en place :

TS

@Input() showColumnRetractable = true;


HTML

<div class="dt-toolbar">
  @if (showColumnRetractable) {
    <!-- bouton + menu colonnes ici -->
  }
  @if (searchable) {
    <!-- champ de recherche ici -->
  }
</div>


--------------------------

import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

@Injectable()
export class FrNativeDateAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (value instanceof Date) return this.isValid(value) ? value : null;
    if (typeof value !== 'string' || !value.trim()) return null;

    // Accepte : DD/MM/YYYY ou DD/MM/YYYY HH:mm[:ss]
    const match = value.trim().match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (!match) return null;

    const [, d, m, y, hh = '0', mm = '0', ss = '0'] = match;
    const year = y.length === 2 ? Number(`20${y}`) : Number(y);

    const date = new Date(
      year,
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    );
    return this.isValid(date) ? date : null;
  }

  override format(date: Date, displayFormat: string | unknown): string {
    if (!this.isValid(date)) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    // Format affiché dans l’input : DD/MM/YYYY HH:mm:ss
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
           `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
}
-----------


jobs:
  ci-frontend:
    uses: chemin/vers/le/workflow/ci.yml
    with:
      component-name: frontend
      npm-test-command: test-ci
      manifest-path: ci
    secrets: inherit

    steps:
      - name: 🔍 Vérifier le dossier courant
        shell: bash
        run: |
          echo "📂 Répertoire courant : $(pwd)"
          echo "📁 Contenu du dossier courant :"
          ls -la
          echo "📁 Contenu du dossier coverage :"
          ls -la coverage || echo "⚠️ Dossier coverage introuvable"
