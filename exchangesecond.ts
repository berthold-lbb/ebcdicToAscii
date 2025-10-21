smart-multi-select-string.component.ts
import { Component, Input, forwardRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import {
  ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS,
  AbstractControl, ValidationErrors
} from '@angular/forms';

import { MatFormFieldModule, MatFormFieldAppearance } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-smart-multi-select-string',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatSelectModule, MatIconModule, MatInputModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SmartMultiSelectStringComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => SmartMultiSelectStringComponent), multi: true },
  ],
  template: `
  <mat-form-field [appearance]="appearance" class="w-full">
    <mat-label>{{ label }}</mat-label>

    <mat-select
      [disabled]="disabled"
      [placeholder]="placeholder"
      [multiple]="true"
      [value]="selected()"
      (openedChange)="onOpenedChange($event)"
      (selectionChange)="onSelectionChange($event.value)"
      panelClass="smart-select-panel">

      <!-- TRIGGER (texte condensé comme l’exemple “Extra cheese (+2 others)”) -->
      <mat-select-trigger>
        @if (selected().length === 0) {
          <span class="trigger-placeholder">{{ placeholder }}</span>
        } @else if (selected().length === 1) {
          <span class="trigger-main">{{ selected()[0] }}</span>
        } @else {
          <span class="trigger-main">{{ selected()[0] }}</span>
          <span class="trigger-rest">(+{{ selected().length - 1 }} autres)</span>
        }
      </mat-select-trigger>

      <!-- Barre de recherche dans le panneau -->
      <mat-option disabled class="search-option" (click)="$event.stopPropagation()">
        <mat-icon fontIcon="search" class="mr-2" aria-hidden="true"></mat-icon>
        <input
          matInput
          [placeholder]="searchPlaceholder"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
          (keydown)="$event.stopPropagation()"
          class="search-input" />
      </mat-option>

      <!-- Section Sélectionnées -->
      @if (selected().length > 0) {
        <mat-optgroup label="Sélectionnées">
          @for (opt of selected(); track opt) {
            <mat-option [value]="opt" (click)="$event.stopPropagation(); toggle(opt)">
              <mat-icon fontIcon="check" class="mr-2 check-green" aria-hidden="true"></mat-icon>
              {{ opt }}
              <span class="ml-2 smart-muted">(retirer)</span>
            </mat-option>
          }
        </mat-optgroup>
      }

      <!-- Section Valeurs (filtrées et non sélectionnées) -->
      @if (filteredValues().length > 0) {
        <mat-optgroup [label]="query() ? 'Résultats' : 'Valeurs'">
          @for (opt of filteredValues(); track opt) {
            <mat-option [value]="opt" (click)="$event.stopPropagation(); toggle(opt)">
              @if (isSelected(opt)) {
                <mat-icon fontIcon="check" class="mr-2 check-green" aria-hidden="true"></mat-icon>
              }
              {{ opt }}
            </mat-option>
          }
        </mat-optgroup>
      }

      @if (selected().length === 0 && filteredValues().length === 0) {
        <mat-option disabled>Aucun résultat</mat-option>
      }
    </mat-select>
  </mat-form-field>
  `,
  styles: [`
    /* Panneau: fixe la ligne de recherche en haut (look propre) */
    .smart-select-panel .mat-mdc-select-panel { padding-top: 0; }
    .search-option { position: sticky; top: 0; z-index: 2; background: var(--mdc-theme-surface, #fff); }
    .search-option .search-input { width: 100%; }
    .smart-muted { color: #6b7280; font-size: .75rem; }
    .mr-2 { margin-right: .5rem; } .ml-2 { margin-left: .5rem; }
    .check-green { color: #2e7d32; }

    /* Trigger style (condensé, comme l’exemple que tu veux) */
    .trigger-placeholder { opacity: .6; }
    .trigger-main { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .trigger-rest { margin-left: .25rem; opacity: .8; }
  `]
})
export class SmartMultiSelectStringComponent implements ControlValueAccessor {
  @Input({ required: true }) options: string[] = [];

  @Input() label = 'Sélection';
  @Input() placeholder = 'Choisir…';
  @Input() searchPlaceholder = 'Rechercher…';
  @Input() appearance: MatFormFieldAppearance = 'fill';

  disabled = false;

  // état
  private readonly _selected = signal<string[]>([]);
  selected = this._selected.asReadonly();

  query = signal<string>('');

  // valeurs non sélectionnées et filtrées
  filteredValues = computed(() => {
    const q = this.query().toLowerCase().trim();
    const set = new Set(this.selected());
    const base = this.options.filter(o => !set.has(o));
    return q ? base.filter(o => o.toLowerCase().includes(q)) : base;
  });

  // CVA
  private onChange: (v: string[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: string[] | null): void {
    const clean = Array.isArray(v) ? v.filter(x => this.options.includes(x)) : [];
    this._selected.set(clean);
  }
  registerOnChange(fn: (v: string[] | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  validate(_: AbstractControl): ValidationErrors | null {
    const ok = this.selected().every(x => this.options.includes(x));
    return ok ? null : { mustSelectFromList: true };
  }

  // interactions
  onOpenedChange(opened: boolean) {
    if (opened) this.query.set('');      // au focus: tout voir
    else this.onTouched();
  }

  onSelectionChange(value: string[]) {
    // mat-select nous renvoie l’ensemble complet quand on coche/décoche via space,
    // mais comme on gère (click) manuellement, on garde la source de vérité locale.
    this.emit();
  }

  toggle(value: string) {
    const cur = this.selected();
    if (cur.includes(value)) {
      this._selected.set(cur.filter(v => v !== value));
    } else {
      this._selected.set([...cur, value]);
    }
    this.emit();
  }

  isSelected = (v: string) => this.selected().includes(v);

  private emit() {
    const arr = this.selected();
    this.onChange(arr.length ? arr : null);
  }
}

Exemple d’usage (FormGroup)
// parent.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { SmartMultiSelectStringComponent } from './smart-multi-select-string.component';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-demo-form',
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, SmartMultiSelectStringComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="p-4">
      <app-smart-multi-select-string
        formControlName="accounts"                        <!-- string[] | null -->
        [options]="accounts"
        [label]="'Compte'"
        [placeholder]="'Choisir…'"
        [searchPlaceholder]="'Filtrer…'"
        [appearance]="'fill'">
      </app-smart-multi-select-string>

      <div class="mt-4">
        <button mat-raised-button color="primary" type="submit">OK</button>
      </div>

      <pre>Valeur: {{ form.value | json }}</pre>
    </form>
  `
})
export class DemoFormComponent {
  accounts = [
    'MFI81559500000EUR9',
    'MFI81559500000CAD4',
    'MFI81559500000GBP8',
    'O20502200USD'
  ];

  form = new FormGroup({
    accounts: new FormControl<string[] | null>(null)
  });

  submit() { console.log(this.form.value.accounts); } // null ou string[]
}
