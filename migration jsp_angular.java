  --------------------------------------------------------------------------------------------------------------------------------------------------
  ----------------------------------------------------------------------------------------------------------------

import { Component } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule, NativeDateAdapter } from '@angular/material/core';



// Adapter custom pour dd/MM/yyyy HH:mm (mets :ss si tu veux les secondes)
class FrDateTimeAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: any): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = pad(date.getDate());
    const m = pad(date.getMonth() + 1);
    const y = date.getFullYear();
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    // const ss = pad(date.getSeconds()); // décommente si tu veux HH:mm:ss
    // return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
    return `${d}/${m}/${y} ${hh}:${mm}`;
  }
}

export const FR_DT_FORMATS = {
  parse:   { dateInput: 'input' },
  display: {
    dateInput: 'input',
    monthYearLabel: 'MMMM yyyy',
    dateA11yLabel: 'input',
    monthYearA11yLabel: 'MMMM yyyy',
  },
};




@Component({
  selector: 'app-credit',
  standalone: true,
  templateUrl: './credit.component.html',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: DateAdapter, useClass: FrDateTimeAdapter }, // 👈 affiche dd/MM/yyyy HH:mm
    { provide: MAT_DATE_FORMATS, useValue: FR_DT_FORMATS }
  ]
})
export class CreditComponent {
  form = this.fb.group({
    startDate: [null as Date | null, Validators.required],
    endDate:   [null as Date | null, Validators.required],
  });

  constructor(private fb: FormBuilder) {}

  /** Injecte l'heure/minute courantes sur la date sélectionnée */
  injectNow(controlName: 'startDate' | 'endDate', picked: Date | null) {
    if (!picked) return;
    const now = new Date();
    const withTime = new Date(
      picked.getFullYear(), picked.getMonth(), picked.getDate(),
      now.getHours(), now.getMinutes(), 0 // mets now.getSeconds() si tu veux les secondes
    );
    this.form.get(controlName)?.setValue(withTime);
  }
}


<!-- Date début -->
<mat-form-field appearance="fill">
  <mat-label>Date début</mat-label>
  <input
    matInput
    [matDatepicker]="pStart"
    formControlName="startDate"
    placeholder="JJ/MM/AAAA HH:mm"
    (dateChange)="injectNow('startDate', $event.value)"
  >
  <mat-datepicker-toggle matSuffix [for]="pStart"></mat-datepicker-toggle>
  <mat-datepicker #pStart startView="multi-year"></mat-datepicker>
</mat-form-field>

<!-- Date fin -->
<mat-form-field appearance="fill">
  <mat-label>Date fin</mat-label>
  <input
    matInput
    [matDatepicker]="pEnd"
    formControlName="endDate"
    placeholder="JJ/MM/AAAA HH:mm"
    (dateChange)="injectNow('endDate', $event.value)"
    [min]="form.value.startDate || null"
  >
  <mat-datepicker-toggle matSuffix [for]="pEnd"></mat-datepicker-toggle>
  <mat-datepicker #pEnd startView="multi-year"></mat-datepicker>
</mat-form-field>

