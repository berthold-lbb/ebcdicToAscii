Composant réutilisable

smart-multi-autocomplete-string.component.ts

import { Component, forwardRef, Input, signal, computed, effect } from '@angular/core';
import {
  ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS,
  AbstractControl, ValidationErrors
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import {
  MatFormFieldModule, MatFormFieldAppearance
} from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger
} from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-smart-multi-autocomplete-string',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatAutocompleteModule, MatIconModule
  ],
  // ===== TEMPLATE (Angular 20, @if/@for) =====
  template: `
  <mat-form-field [appearance]="appearance" class="w-full smart-multi-af">
    <mat-label>{{ label }}</mat-label>

    <!-- Préfixe: valeurs sélectionnées en texte "a, b, c," -->
    <span matPrefix class="smart-prefix">
      {{ displayString() }}
      @if (displayString()) { ,&nbsp; }
    </span>

    <input
      matInput
      [placeholder]="selected().length ? '' : placeholder"
      [matAutocomplete]="auto"
      [disabled]="disabled"
      #trigger="matAutocompleteTrigger"
      (focus)="openAll(trigger)"
      (input)="onInput($any($event.target).value)"
      (keydown)="handleKeydown($event)"
      (blur)="onBlur()"
      [value]="query()" />

    <mat-autocomplete #auto="matAutocomplete" (optionSelected)="onSelected($event)">
      <!-- Sélectionnées (toujours visible) -->
      @if (sections().selected.length > 0) {
        <mat-optgroup label="Sélectionnées">
          @for (item of sections().selected; track item) {
            <mat-option (click)="toggle(item, trigger)">
              <mat-icon class="mr-2" fontIcon="check" color="primary"></mat-icon>
              {{ item }}
              <span class="ml-2 smart-muted">(retirer)</span>
            </mat-option>
          }
        </mat-optgroup>
      }

      <!-- Récents -->
      @if (sections().recents.length > 0) {
        <mat-optgroup label="Récents">
          @for (item of sections().recents; track item) {
            <mat-option (click)="toggle(item, trigger)" [disabled]="isSelected(item)">
              @if (isSelected(item)) { <mat-icon class="mr-2" fontIcon="check" color="primary"></mat-icon> }
              {{ item }}
            </mat-option>
          }
        </mat-optgroup>
      }

      <!-- Valeurs / Résultats -->
      @if (sections().values.length > 0) {
        <mat-optgroup [label]="query() ? 'Résultats' : 'Valeurs'">
          @for (item of sections().values; track item) {
            <mat-option (click)="toggle(item, trigger)" [disabled]="isSelected(item)">
              @if (isSelected(item)) { <mat-icon class="mr-2" fontIcon="check" color="primary"></mat-icon> }
              {{ item }}
            </mat-option>
          }
        </mat-optgroup>
      }

      @if (
        sections().selected.length === 0 &&
        sections().recents.length === 0 &&
        sections().values.length === 0
      ) {
        <mat-option disabled>Aucun résultat</mat-option>
      }
    </mat-autocomplete>
  </mat-form-field>
  `,
  // ===== STYLES ciblés (éviter l'élargissement du champ) =====
  styles: [`
    /* Affixe (prefix) contraint: ne pas pousser l'input */
    .smart-multi-af .mdc-text-field__affix.smart-prefix,
    .smart-prefix {
      max-width: 60%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: inline-block;
      vertical-align: middle;
    }
    /* forcer l'infix à se comporter en flex pour que l'input prenne l'espace restant */
    :host ::ng-deep .smart-multi-af .mat-mdc-form-field-infix {
      display: flex;
      align-items: center;
      gap: .25rem;
    }
    :host ::ng-deep .smart-multi-af .mat-mdc-input-element {
      flex: 1 1 auto;
      min-width: 0;
    }
    .smart-muted { font-size: 0.75rem; color: #6b7280; }
    .mr-2 { margin-right: .5rem; } .ml-2 { margin-left: .5rem; }
  `]
})
export class SmartMultiAutocompleteStringComponent implements ControlValueAccessor {
  // --- Inputs
  @Input({ required: true }) options: string[] = [];
  @Input() label = 'Choisir des valeurs';
  @Input() placeholder = 'Tapez pour filtrer...';
  @Input() appearance: MatFormFieldAppearance = 'fill';

  // Récents (facultatif)
  @Input() recentsEnabled = false;
  /** 'never' | 'onRefocus' | 'always' */
  @Input() recentsMode: 'never' | 'onRefocus' | 'always' = 'onRefocus';
  @Input() storageKey = 'smart-multi-recents';
  @Input() maxRecents = 7;

  disabled = false;

  // --- État
  private readonly _selected = signal<string[]>([]);
  selected = this._selected.asReadonly();

  private readonly _query = signal<string>('');
  query = this._query.asReadonly();

  private readonly recents = signal<string[]>(this.loadRecents());

  // Affichage dans l'input
  displayString = computed(() => this.selected().join(', '));

  // Sections du panneau
  sections = computed(() => {
    const q = this._query().toLowerCase().trim();
    const base = this.options ?? [];
    const filtered = q ? base.filter(v => v.toLowerCase().includes(q)) : base;

    const selSet = new Set(this.selected());
    const values = filtered.filter(v => !selSet.has(v)); // exclut sélection

    let recents: string[] = [];
    if (this.recentsEnabled && this.recents().length) {
      recents = this.recents().filter(r => filtered.includes(r) && !selSet.has(r));
    }

    const hasSelection = this.selected().length > 0;
    const showRecents =
      this.recentsEnabled &&
      recents.length > 0 &&
      (
        (this.recentsMode === 'always' && !q) ||
        (this.recentsMode === 'onRefocus' && !q && hasSelection)
      );

    return { selected: this.selected(), recents: showRecents ? recents : [], values };
  });

  constructor() {
    // Nettoyage si jamais une valeur non listée est injectée
    effect(() => {
      const sel = this._selected();
      const clean = sel.filter(v => this.options.includes(v));
      if (clean.length !== sel.length) {
        this._selected.set(clean);
        this.emit(clean);
      }
    });
  }

  // --- CVA
  private onChange: (value: string[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string[] | null): void {
    this._selected.set(Array.isArray(value) ? value.filter(v => this.options.includes(v)) : []);
    this._query.set('');
  }
  registerOnChange(fn: (value: string[] | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  // --- Validator (toutes les valeurs doivent venir de la liste)
  validate(_: AbstractControl): ValidationErrors | null {
    const ok = this.selected().every(v => this.options.includes(v));
    return ok ? null : { mustSelectFromList: true };
  }

  // --- Handlers
  openAll(trigger: MatAutocompleteTrigger) {
    this._query.set('');
    trigger.openPanel();
  }

  onInput(v: string) { this._query.set(v); }

  // Angular envoie Event; on filtre la touche Backspace ici
  handleKeydown(e: Event) {
    const ev = e as KeyboardEvent;
    if (ev.key === 'Backspace') {
      this.handleBackspace();
      ev.preventDefault();
    }
  }

  handleBackspace() {
    if (!this._query() && this.selected().length && !this.disabled) {
      this.remove(this.selected()[this.selected().length - 1]);
    }
  }

  onSelected(ev: MatAutocompleteSelectedEvent) {
    const value = ev.option.value as string;
    this.toggle(value);
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

  onBlur() { this.onTouched(); }

  // --- Helpers
  isSelected = (v: string) => this.selected().includes(v);
  private emit(arr: string[]) { this.onChange(arr.length ? arr : null); }

  // --- Récents
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

Exemple d’utilisation (FormGroup)
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

    <pre>Valeur: {{ form.value | json }}</pre>
  </form>
  `
})
export class MultiCityFormComponent {
  allCities = ['Québec', 'Montréal', 'Ottawa', 'Toronto', 'Vancouver', 'Calgary', 'Halifax'];
  form = new FormGroup({ cities: new FormControl<string[] | null>(null) });

  submit() { console.log(this.form.value.cities); } // null ou string[]
}