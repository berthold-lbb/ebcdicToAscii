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

    <!-- Préfixe (valeurs sélectionnées affichées dans l'input) -->
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
      <!-- Section Sélectionnées -->
      @if (sections().selected.length > 0) {
        <mat-optgroup label="Sélectionnées">
          @for (item of sections().selected; track item) {
            <mat-option (click)="toggle(item, trigger)">
              <span class="mr-2 text-green-600">✔</span>
              {{ item }}
              <span class="ml-2 text-xs text-gray-500">(retirer)</span>
            </mat-option>
          }
        </mat-optgroup>
      }

      <!-- Section Récents -->
      @if (sections().recents.length > 0) {
        <mat-optgroup label="Récents">
          @for (item of sections().recents; track item) {
            <mat-option (click)="toggle(item, trigger)" [disabled]="isSelected(item)">
              @if (isSelected(item)) {
                <span class="mr-2 text-green-600">✔</span>
              }
              {{ item }}
            </mat-option>
          }
        </mat-optgroup>
      }

      <!-- Section Valeurs -->
      @if (sections().values.length > 0) {
        <mat-optgroup [label]="query() ? 'Résultats' : 'Valeurs'">
          @for (item of sections().values; track item) {
            <mat-option (click)="toggle(item, trigger)" [disabled]="isSelected(item)">
              @if (isSelected(item)) {
                <span class="mr-2 text-green-600">✔</span>
              }
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
  `
})
export class SmartMultiAutocompleteStringComponent implements ControlValueAccessor {
  @Input({ required: true }) options: string[] = [];

  @Input() label = 'Choisir des valeurs';
  @Input() placeholder = 'Tapez pour filtrer...';
  @Input() appearance: MatFormFieldAppearance = 'fill';

  @Input() recentsEnabled = false;
  @Input() recentsMode: 'never' | 'onRefocus' | 'always' = 'onRefocus';
  @Input() storageKey = 'smart-multi-recents';
  @Input() maxRecents = 7;

  disabled = false;

  private readonly _selected = signal<string[]>([]);
  selected = this._selected.asReadonly();

  private readonly _query = signal<string>('');
  query = this._query.asReadonly();

  private readonly recents = signal<string[]>(this.loadRecents());
  displayString = computed(() => this.selected().join(', '));

  sections = computed(() => {
    const q = this._query().toLowerCase().trim();
    const base = this.options ?? [];
    const filtered = q ? base.filter(v => v.toLowerCase().includes(q)) : base;
    const selSet = new Set(this.selected());
    const values = filtered.filter(v => !selSet.has(v));
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
    effect(() => {
      const sel = this._selected();
      const clean = sel.filter(v => this.options.includes(v));
      if (clean.length !== sel.length) {
        this._selected.set(clean);
        this.emit(clean);
      }
    });
  }

  private onChange: (value: string[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string[] | null): void {
    this._selected.set(Array.isArray(value) ? value.filter(v => this.options.includes(v)) : []);
    this._query.set('');
  }
  registerOnChange(fn: (value: string[] | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  validate(_: AbstractControl): ValidationErrors | null {
    const ok = this.selected().every(v => this.options.includes(v));
    return ok ? null : { mustSelectFromList: true };
  }

  openAll(trigger: MatAutocompleteTrigger) {
    this._query.set('');
    trigger.openPanel();
  }

  onInput(v: string) { this._query.set(v); }

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

  handleBackspace(e: KeyboardEvent) {
    if (!this._query() && this.selected().length && !this.disabled) {
      this.remove(this.selected()[this.selected().length - 1]);
      e.preventDefault();
    }
  }

  onBlur() { this.onTouched(); }

  isSelected = (v: string) => this.selected().includes(v);
  private emit(arr: string[]) { this.onChange(arr.length ? arr : null); }

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