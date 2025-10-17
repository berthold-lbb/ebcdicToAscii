🧩 Composant partagé (standalone)

smart-multi-autocomplete-string.component.ts

import { Component, forwardRef, Input, computed, effect, signal } from '@angular/core';
import {
  ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS,
  AbstractControl, ValidationErrors
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import {
  MatFormFieldModule,
  MatFormFieldAppearance
} from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
  MatAutocompleteTrigger
} from '@angular/material/autocomplete';

@Component({
  selector: 'app-smart-multi-autocomplete-string',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatAutocompleteModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SmartMultiAutocompleteStringComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SmartMultiAutocompleteStringComponent),
      multi: true,
    },
  ],
  template: `
  <mat-form-field [appearance]="appearance" class="w-full">
    <mat-label>{{ label }}</mat-label>

    <!-- Préfixe : sélection sous forme de 'a, b, c,' puis input pour la recherche -->
    <span matPrefix class="text-gray-600 truncate">
      {{ displayString() }}<ng-container *ngIf="displayString()">,&nbsp;</ng-container>
    </span>

    <input
      matInput
      [placeholder]="selected().length ? '' : placeholder"
      [matAutocomplete]="auto"
      [disabled]="disabled"
      #trigger="matAutocompleteTrigger"
      (focus)="openAll(trigger)"
      (input)="onInput(($event.target as HTMLInputElement).value)"
      (keydown.backspace)="handleBackspace($event)"
      (blur)="onBlur()"
      [value]="query()" />

    <mat-autocomplete #auto="matAutocomplete" (optionSelected)="onSelected($event)">
      <!-- Sélectionnées : toujours visible -->
      <mat-optgroup label="Sélectionnées" *ngIf="sections().selected.length > 0">
        <ng-container *ngFor="let item of sections().selected">
          <mat-option (click)="toggle(item, trigger)">
            <span class="mr-2">✔</span>{{ item }}
            <span class="ml-2 text-xs text-gray-500">(retirer)</span>
          </mat-option>
        </ng-container>
      </mat-optgroup>

      <!-- Récents (si activés et disponibles) -->
      <mat-optgroup label="Récents" *ngIf="sections().recents.length > 0">
        <ng-container *ngFor="let item of sections().recents">
          <mat-option (click)="toggle(item, trigger)" [disabled]="isSelected(item)">
            <span class="mr-2" *ngIf="isSelected(item)">✔</span>{{ item }}
          </mat-option>
        </ng-container>
      </mat-optgroup>

      <!-- Valeurs / Résultats (hors éléments déjà sélectionnés) -->
      <mat-optgroup [label]="query() ? 'Résultats' : 'Valeurs'" *ngIf="sections().values.length > 0">
        <ng-container *ngFor="let item of sections().values">
          <mat-option (click)="toggle(item, trigger)" [disabled]="isSelected(item)">
            <span class="mr-2" *ngIf="isSelected(item)">✔</span>{{ item }}
          </mat-option>
        </ng-container>
      </mat-optgroup>

      <mat-option disabled
                  *ngIf="sections().selected.length === 0
                         && sections().recents.length === 0
                         && sections().values.length === 0">
        Aucun résultat
      </mat-option>
    </mat-autocomplete>
  </mat-form-field>
  `
})
export class SmartMultiAutocompleteStringComponent implements ControlValueAccessor {
  /** Données source */
  @Input({ required: true }) options: string[] = [];

  /** Libellés / apparence */
  @Input() label = 'Choisir des valeurs';
  @Input() placeholder = 'Tapez pour filtrer...';
  @Input() appearance: MatFormFieldAppearance = 'fill';

  /** Historique récents (optionnel) */
  @Input() recentsEnabled = false;
  /** 'never' | 'onRefocus' | 'always' */
  @Input() recentsMode: 'never' | 'onRefocus' | 'always' = 'onRefocus';
  @Input() storageKey = 'smart-multi-recents';
  @Input() maxRecents = 7;

  disabled = false;

  // ---- État interne
  private readonly _selected = signal<string[]>([]);
  selected = this._selected.asReadonly();

  private readonly _query = signal<string>('');
  query = this._query.asReadonly();

  private readonly recents = signal<string[]>(this.loadRecents());

  // Affichage de la sélection dans l'input
  displayString = computed(() => this.selected().join(', '));

  // Sections du panneau
  sections = computed(() => {
    const q = this._query().toLowerCase().trim();
    const base = this.options ?? [];
    const filtered = q ? base.filter(v => v.toLowerCase().includes(q)) : base;

    const selSet = new Set(this.selected());
    const values = filtered.filter(v => !selSet.has(v)); // exclut la sélection

    // récents valides (présents et non sélectionnés)
    let recents: string[] = [];
    if (this.recentsEnabled && this.recents().length) {
      recents = this.recents().filter(r => filtered.includes(r) && !selSet.has(r));
    }

    const hasSelection = this.selected().length > 0;
    const showRecents =
      this.recentsEnabled && recents.length > 0 &&
      (
        (this.recentsMode === 'always' && !q) ||
        (this.recentsMode === 'onRefocus' && !q && hasSelection)
      );

    return {
      selected: this.selected(),
      recents: showRecents ? recents : [],
      values
    };
  });

  constructor() {
    // Sécurité : on nettoie toute valeur non listée si jamais injectée
    effect(() => {
      const sel = this._selected();
      const clean = sel.filter(v => this.options.includes(v));
      if (clean.length !== sel.length) {
        this._selected.set(clean);
        this.emit(clean);
      }
    });
  }

  // ---- CVA
  private onChange: (value: string[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string[] | null): void {
    this._selected.set(Array.isArray(value) ? value.filter(v => this.options.includes(v)) : []);
    this._query.set('');
  }
  registerOnChange(fn: (value: string[] | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  // ---- Validator (valeurs doivent venir de la liste)
  validate(_: AbstractControl): ValidationErrors | null {
    const ok = this.selected().every(v => this.options.includes(v));
    return ok ? null : { mustSelectFromList: true };
  }

  // ---- Handlers
  openAll(trigger: MatAutocompleteTrigger) {
    this._query.set('');
    trigger.openPanel();
  }

  onInput(v: string) { this._query.set(v); }

  onSelected(ev: MatAutocompleteSelectedEvent) {
    const value = ev.option.value as string;
    this.toggle(value);
    // garder la frappe enchaînée
    this._query.set('');
  }

  toggle(value: string, reopen?: MatAutocompleteTrigger) {
    if (this.isSelected(value)) {
      this.remove(value);
    } else {
      const next = [...this.selected(), value];
      this._selected.set(next);
      this.pushToRecents(value);
      this.emit(next);
    }
    if (reopen) setTimeout(() => reopen.openPanel());
  }

  remove(value: string) {
    const next = this.selected().filter(v => v !== value);
    this._selected.set(next);
    this.emit(next);
  }

  handleBackspace(e: KeyboardEvent) {
    if (!this._query() && this.selected().length && !this.disabled) {
      this.remove(this.selected()[this.selected().length - 1]);
      e.preventDefault();
    }
  }

  onBlur() { this.onTouched(); }

  // ---- Helpers
  isSelected = (v: string) => this.selected().includes(v);
  private emit(arr: string[]) { this.onChange(arr.length ? arr : null); }

  // ---- Récents
  private pushToRecents(item: string) {
    if (!this.recentsEnabled) return;
    const list = [item, ...this.recents().filter(x => x !== item)];
    const limited = this.maxRecents > 0 ? list.slice(0, this.maxRecents) : list;
    this.recents.set(limited);
    try { localStorage.setItem(this.storageKey, JSON.stringify(limited)); } catch {}
  }
  private loadRecents(): string[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const arr = raw ? JSON.parse(raw) as string[] : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
}

🧪 Exemple d’utilisation avec FormGroup

multi-city-form.component.ts

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { SmartMultiAutocompleteStringComponent } from './smart-multi-autocomplete-string.component';

@Component({
  selector: 'app-multi-city-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, SmartMultiAutocompleteStringComponent],
  template: `
  <form [formGroup]="form" class="p-4" (ngSubmit)="submit()">
    <app-smart-multi-autocomplete-string
      formControlName="cities"                 <!-- string[] | null -->
      [options]="allCities"
      [label]="'Villes'"
      [placeholder]="'Tapez pour filtrer...'"
      [appearance]="'fill'"
      [recentsEnabled]="true"
      [recentsMode]="'always'"
      [storageKey]="'cities-multi-recents'">
    </app-smart-multi-autocomplete-string>

    <div class="mt-4">
      <button mat-raised-button color="primary" type="submit">Soumettre</button>
    </div>

    <pre class="mt-4">Valeur du formulaire :
{{ form.value | json }}
    </pre>
  </form>
  `
})
export class MultiCityFormComponent {
  allCities = ['Québec', 'Montréal', 'Ottawa', 'Toronto', 'Vancouver', 'Calgary', 'Halifax'];

  // IMPORTANT : le contrôle accepte null quand aucune sélection
  form = new FormGroup({
    cities: new FormControl<string[] | null>(null),
  });

  submit() {
    // form.value.cities est soit null, soit string[]
    console.log('Sélection :', this.form.value.cities);
  }
}

✅ À retenir

Aucune sélection → null.

Plusieurs sélections → string[].

Les “Sélectionnées” restent visibles en tête ; les “Résultats/Valeurs” n’affichent que ce qui n’est pas déjà sélectionné ; coche ✔ sur les éléments sélectionnés (et clic = toggle).

Si tu veux la variante objets { id, label } avec la même UX, je te l’adapte en 1 bloc.