1) Composant partagé (CVA + Validator) — string[] + récents optionnels

src/app/shared/controls/smart-autocomplete-string/smart-autocomplete-string.component.ts

import { Component, forwardRef, Input, signal, computed, effect } from '@angular/core';
import {
  ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS,
  AbstractControl, ValidationErrors
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

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
      [disabled]="disabled"
      (focus)="openAll(auto)"
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
  /** Liste source */
  @Input({ required: true }) options: string[] = [];

  /** Label / placeholder / apparence */
  @Input() label = 'Choisir une valeur';
  @Input() placeholder = 'Tapez pour filtrer...';
  @Input() appearance: 'fill' | 'outline' | 'standard' | 'legacy' = 'fill';

  /** Gestion des récents (optionnelle) */
  @Input() recentsEnabled = false;
  @Input() storageKey = 'smart-autocomplete-string-recents';
  @Input() maxRecents = 5;

  /** Texte d’erreur */
  @Input() errorText = 'Veuillez choisir une valeur dans la liste.';

  disabled = false;

  // contrôle interne (valeur finale toujours une string de la liste ou null)
  ctrl = new FormControl<string | null>(null);
  query = signal<string>('');

  // internes
  private readonly recents = signal<string[]>(this.loadRecents());

  // logique d’affichage
  filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    const base = this.options;
    const hasSelection = !!this.ctrl.value;

    // 1) rien saisi & aucune sélection -> liste complète
    if (!q && !hasSelection) return base;

    // 2) saisie -> filtrage
    if (q) return base.filter(v => v.toLowerCase().includes(q));

    // 3) avec sélection existante (refocus sans saisie)
    if (this.recentsEnabled) {
      const recentSet = new Set(this.recents());
      const rest = base.filter(v => !recentSet.has(v));
      return [...this.recents(), ...rest];
    }
    return base;
  });

  constructor() {
    // si une chaîne non présente est posée, marquer invalide
    effect(() => {
      const v = this.ctrl.value;
      if (v && !this.options.includes(v)) {
        this.ctrl.setErrors({ mustSelect: true });
      }
    });
  }

  // --- CVA
  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.ctrl.setValue(value);
    this.query.set('');
  }
  registerOnChange(fn: (value: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  // --- Validator (exposé au parent)
  validate(_: AbstractControl): ValidationErrors | null {
    const v = this.ctrl.value;
    const ok = v === null || this.options.includes(v);
    return ok ? null : { mustSelect: true };
  }

  // --- handlers template
  openAll(auto: { openPanel: () => void }) {
    this.query.set('');
    auto.openPanel();
  }

  onInput(value: string) {
    this.query.set(value);
    // si on retape après sélection -> tant qu’on n’a pas choisi, le form value repasse à null
    if (this.ctrl.value) {
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

  // --- récents
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

2) Exemple d’utilisation (avec ou sans récents)

src/app/features/city-form/city-form.component.ts

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { SmartAutocompleteStringComponent } from '@shared/controls/smart-autocomplete-string/smart-autocomplete-string.component';

@Component({
  selector: 'app-city-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, SmartAutocompleteStringComponent],
  template: `
  <form [formGroup]="form" class="p-4" (ngSubmit)="submit()">
    <!-- Version avec récents activés -->
    <app-smart-autocomplete-string
      formControlName="city"
      [label]="'Ville'"
      [options]="cities"
      [placeholder]="'Recherchez une ville...'"
      [recentsEnabled]="true"
      [storageKey]="'cities-recents'"
      [maxRecents]="5"
    ></app-smart-autocomplete-string>

    <!-- (Optionnel) Une seconde instance sans récents -->
    <!--
    <app-smart-autocomplete-string
      formControlName="city2"
      [label]="'Ville (sans récents)'"
      [options]="cities"
      [recentsEnabled]="false">
    </app-smart-autocomplete-string>
    -->

    <div class="mt-4">
      <button mat-raised-button color="primary" [disabled]="form.invalid">Soumettre</button>
    </div>

    <pre class="mt-4">Valeur du formulaire :
{{ form.value | json }}
    </pre>
  </form>
  `
})
export class CityFormComponent {
  cities = ['Québec', 'Montréal', 'Ottawa', 'Toronto', 'Vancouver'];

  form = new FormGroup({
    city: new FormControl<string | null>(null, Validators.required),
    // city2: new FormControl<string | null>(null),
  });

  submit() {
    if (this.form.valid) {
      console.log('Ville sélectionnée :', this.form.value.city);
    } else {
      this.form.markAllAsTouched();
    }
  }
}