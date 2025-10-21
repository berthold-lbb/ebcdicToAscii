smart-multi-autocomplete-string.component.ts
import { Component, forwardRef, Input, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import {
  ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS,
  AbstractControl, ValidationErrors
} from '@angular/forms';
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
  template: `
  <mat-form-field [appearance]="appearance" class="w-full smart-multi-af">
    <mat-label>{{ label }}</mat-label>

    <!-- Overlay "trigger condensé" (façon mat-select-trigger) -->
    <span class="smart-overlay" aria-hidden="true">
      @if (!query() && selected().length === 1) {
        {{ selected()[0] }}
      } @else if (!query() && selected().length > 1) {
        {{ selected()[0] }} (+{{ selected().length - 1 }} autres)
      }
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
      <!-- Sélectionnées -->
      @if (sections().selected.length > 0) {
        <mat-optgroup label="Sélectionnées">
          @for (item of sections().selected; track item) {
            <mat-option (click)="toggle(item, trigger)">
              <mat-icon class="mr-2 check-green" fontIcon="check"></mat-icon>
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
              @if (isSelected(item)) { <mat-icon class="mr-2 check-green" fontIcon="check"></mat-icon> }
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
              @if (isSelected(item)) { <mat-icon class="mr-2 check-green" fontIcon="check"></mat-icon> }
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
  styles: [`
    /* Le champ reste strictement dans sa colonne */
    .smart-multi-af { display: block; width: 100%; }

    /* On positionne l'overlay dans l'infix pour ne rien pousser */
    :host ::ng-deep .smart-multi-af .mat-mdc-form-field-infix {
      position: relative;
      width: 100%;
      min-width: 0;
    }

    /* Overlay "trigger condensé" : non interactive, ellipse, centrée verticalement */
    .smart-overlay {
      position: absolute;
      inset-inline: 0;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: rgba(0,0,0,.6);
      font: inherit;
    }

    /* L'input prend 100% et peut se contracter */
    :host ::ng-deep .smart-multi-af .mat-mdc-input-element {
      width: 100%;
      min-width: 0;
    }

    .smart-muted { font-size: .75rem; color: #6b7280; }
    .mr-2 { margin-right: .5rem; } .ml-2 { margin-left: .5rem; }
    .check-green { color: #2e7d32; }
  `]
})
export class SmartMultiAutocompleteStringComponent implements ControlValueAccessor {
  /* Inputs */
  @Input({ required: true }) options: string[] = [];
  @Input() label = 'Sélection';
  @Input() placeholder = 'Rechercher / choisir…';
  @Input() appearance: MatFormFieldAppearance = 'fill';

  /* Récents (optionnels) */
  @Input() recentsEnabled = false;
  /** 'never' | 'onRefocus' | 'always' */
  @Input() recentsMode: 'never' | 'onRefocus' | 'always' = 'onRefocus';
  @Input() storageKey = 'smart-multi-recents';
  @Input() maxRecents = 7;

  disabled = false;

  /* État */
  private readonly _selected = signal<string[]>([]);
  selected = this._selected.asReadonly();

  private readonly _query = signal<string>('');
  query = this._query.asReadonly();

  private readonly recents = signal<string[]>(this.loadRecents());

  /* Sections (Sélectionnées, Récents, Valeurs) */
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
      this.recentsEnabled && recents.length > 0 &&
      (
        (this.recentsMode === 'always' && !q) ||
        (this.recentsMode === 'onRefocus' && !q && hasSelection)
      );

    return { selected: this.selected(), recents: showRecents ? recents : [], values };
  });

  constructor() {
    /* Nettoie toute valeur hors liste si injectée */
    effect(() => {
      const sel = this._selected();
      const clean = sel.filter(v => this.options.includes(v));
      if (clean.length !== sel.length) {
        this._selected.set(clean);
        this.emit(clean);
      }
    });
  }

  /* ---- CVA ---- */
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

  /* ---- Handlers ---- */
  openAll(trigger: MatAutocompleteTrigger) {
    this._query.set('');           // reset filtre
    trigger.openPanel();           // liste complète visible
  }

  onInput(v: string) { this._query.set(v); }

  handleKeydown(e: Event) {
    const ev = e as KeyboardEvent;
    if (ev.key === 'Backspace' && !this._query() && this.selected().length && !this.disabled) {
      this.remove(this.selected()[this.selected().length - 1]);
      ev.preventDefault();
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

  isSelected = (v: string) => this.selected().includes(v);
  private emit(arr: string[]) { this.onChange(arr.length ? arr : null); }

  /* Récents */
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

Utilisation (parent)
form = new FormGroup({
  accounts: new FormControl<string[] | null>(null)
});
options = ['MFI81559500000EUR9','MFI81559500000CAD4','MFI81559500000GBP8','O20502200USD'];

<form [formGroup]="form">
  <app-smart-multi-autocomplete-string
    formControlName="accounts"
    [options]="options"
    [label]="'Compte'"
    [placeholder]="'Rechercher / choisir…'"
    [recentsEnabled]="true"
    [recentsMode]="'always'">
  </app-smart-multi-autocomplete-string>
</form>


Cette fusion te donne le rendu “Sausage (+1 other)” directement dans ton autocomplete existant, sans matPrefix (donc plus de chevauchement), tout en gardant récents et filtre.