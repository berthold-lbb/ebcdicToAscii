import { Component, forwardRef, Input, signal, computed, effect } from '@angular/core';
import {
  ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS,
  AbstractControl, ValidationErrors
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
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
  selector: 'app-smart-autocomplete-string',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatAutocompleteModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SmartAutocompleteStringComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SmartAutocompleteStringComponent),
      multi: true,
    },
  ],
  template: `
  <mat-form-field [appearance]="appearance" class="w-full">
    <mat-label>{{ label }}</mat-label>

    <input
      matInput
      [placeholder]="placeholder"
      [matAutocomplete]="auto"
      #trigger="matAutocompleteTrigger"
      [disabled]="disabled"
      (focus)="openAll(trigger)"
      (input)="onInput(($event.target as HTMLInputElement).value)"
      (blur)="onBlur()"
      [value]="ctrl.value ?? ''"
    />

    <mat-autocomplete #auto="matAutocomplete" (optionSelected)="onSelected($event)">
      @for (item of filtered(); track item) {
        <mat-option [value]="item">{{ item }}</mat-option>
      }
      @if (filtered().length === 0) {
        <mat-option disabled>Aucun résultat</mat-option>
      }
    </mat-autocomplete>

    @if (ctrl.invalid && (ctrl.dirty || ctrl.touched)) {
      <mat-error>{{ errorText }}</mat-error>
    }
  </mat-form-field>
  `
})
export class SmartAutocompleteStringComponent implements ControlValueAccessor {
  /** Données source */
  @Input({ required: true }) options: string[] = [];

  /** Libellés / apparence */
  @Input() label = 'Choisir une valeur';
  @Input() placeholder = 'Tapez pour filtrer...';
  @Input() appearance: MatFormFieldAppearance = 'fill';

  /** Récents (optionnels) */
  @Input() recentsEnabled = false;
  @Input() storageKey = 'smart-autocomplete-string-recents';
  @Input() maxRecents = 5;

  /** Message d’erreur */
  @Input() errorText = 'Veuillez choisir une valeur dans la liste.';

  disabled = false;

  ctrl = new FormControl<string | null>(null);
  query = signal<string>('');
  private readonly recents = signal<string[]>(this.loadRecents());

  filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    const base = this.options;
    const hasSelection = !!this.ctrl.value;

    if (!q && !hasSelection) return base;                         // liste complète
    if (q) return base.filter(v => v.toLowerCase().includes(q));  // filtrage

    // refocus sans saisie : récents en tête si activés
    if (this.recentsEnabled) {
      const set = new Set(this.recents());
      const rest = base.filter(v => !set.has(v));
      return [...this.recents(), ...rest];
    }
    return base;
  });

  constructor() {
    // si une valeur libre "non listée" se glisse, on marque invalide
    effect(() => {
      const v = this.ctrl.value;
      if (v && !this.options.includes(v)) {
        this.ctrl.setErrors({ mustSelect: true });
      }
    });
  }

  // ---- CVA
  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.ctrl.setValue(value);
    this.query.set('');
  }
  registerOnChange(fn: (value: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  // ---- Validator
  validate(_: AbstractControl): ValidationErrors | null {
    const v = this.ctrl.value;
    return v === null || this.options.includes(v) ? null : { mustSelect: true };
  }

  // ---- Handlers
  openAll(trigger: MatAutocompleteTrigger) {
    this.query.set('');
    trigger.openPanel();
  }

  onInput(value: string) {
    this.query.set(value);
    if (this.ctrl.value) {               // si on retape après sélection
      this.ctrl.setValue(null, { emitEvent: false });
      this.onChange(null);
    }
  }

  onSelected(ev: MatAutocompleteSelectedEvent) {
    const selected = ev.option.value as string;
    this.ctrl.setValue(selected);
    this.onChange(selected);
    this.onTouched();
    if (this.recentsEnabled) this.pushToRecents(selected);
  }

  onBlur() {
    const v = this.ctrl.value;
    if (!v || !this.options.includes(v)) {
      this.ctrl.setValue(null);
      this.onChange(null);
    }
    this.onTouched();
  }

  // ---- Récents
  private pushToRecents(item: string) {
    const next = [item, ...this.recents().filter(x => x !== item)].slice(0, this.maxRecents);
    this.recents.set(next);
    try { localStorage.setItem(this.storageKey, JSON.stringify(next)); } catch {}
  }
  private loadRecents(): string[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) as string[] : [];
    } catch { return []; }
  }
}
Utilisation (rappel)
html
Copier le code
<app-smart-autocomplete-string
  formControlName="city"
  [label]="'Ville'"
  [placeholder]="'Recherchez une ville...'"
  [options]="cities"
  [recentsEnabled]="true"
  [storageKey]="'cities-recents'">
</app-smart-autocomplete-string>