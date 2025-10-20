1) Composant réutilisable <app-date-time-picker>
date-time-picker.component.ts
import { Component, Input, forwardRef, inject } from '@angular/core';
import {
  ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS, Validator, AbstractControl
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule, MatDatepickerInputEvent } from '@angular/material/datepicker';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-date-time-picker',
  imports: [CommonModule, MatFormFieldModule, MatInputModule, MatDatepickerModule],
  templateUrl: './date-time-picker.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateTimePickerComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DateTimePickerComponent),
      multi: true,
    },
  ],
})
export class DateTimePickerComponent implements ControlValueAccessor, Validator {
  /** UI props */
  @Input() label = 'Date';
  @Input() placeholder = 'dd/MM/yyyy HH:mm:ss';
  @Input() appearance: 'fill' | 'outline' = 'fill';
  @Input() min: Date | null = null;
  @Input() max: Date | null = null;

  /** Comportement */
  @Input() withTimeOnPick = true;       // ajoute l'heure courante quand on choisit la date
  @Input() injectNowOnFocus = false;    // injecte l'heure courante au focus si pas d'heure
  @Input() required = false;

  value: Date | null = null;
  disabled = false;

  // ControlValueAccessor
  private onChange: (v: Date | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: Date | null): void { this.value = v; }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  // Validator (facultatif — juste pour "required")
  validate(_: AbstractControl) {
    if (this.required && !this.value) return { required: true };
    return null;
  }

  // UI handlers
  onDateChange(ev: MatDatepickerInputEvent<Date>) {
    const picked = ev.value ?? null;
    if (!picked) {
      this.value = null;
      this.onChange(this.value);
      return;
    }
    this.value = this.withTimeOnPick ? this.combineWithNow(picked) : picked;
    this.onChange(this.value);
  }

  onFocus() {
    if (!this.injectNowOnFocus) return;
    const now = new Date();
    if (!this.value) {
      this.value = now;
      this.onChange(this.value);
    }
  }

  private combineWithNow(d: Date) {
    const now = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(),
      now.getHours(), now.getMinutes(), now.getSeconds());
  }
}

date-time-picker.component.html
<mat-form-field [appearance]="appearance" style="width:240px;min-width:200px">
  <mat-label>{{ label }}</mat-label>
  <input
    matInput
    [matDatepicker]="picker"
    [placeholder]="placeholder"
    [min]="min"
    [max]="max"
    [disabled]="disabled"
    (focus)="onFocus()"
    (dateChange)="onDateChange($event)"
    [value]="value"
  />
  <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
  <mat-datepicker #picker></mat-datepicker>
</mat-form-field>

2) Utilisation dans ton FormGroup
component.ts
private fb = inject(FormBuilder);

form = this.fb.group({
  startDate: [null, Validators.required],
  endDate:   [null, Validators.required],
  // ... tes autres champs
});

component.html
<form [formGroup]="form">
  <app-date-time-picker
    formControlName="startDate"
    label="Start Date"
    [withTimeOnPick]="true"
    [injectNowOnFocus]="true"
    [required]="true">
  </app-date-time-picker>

  <app-date-time-picker
    formControlName="endDate"
    label="End Date"
    [withTimeOnPick]="true"
    [required]="true">
  </app-date-time-picker>
</form>