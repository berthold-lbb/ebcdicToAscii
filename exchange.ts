import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { map, startWith, debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { Observable } from 'rxjs';

import { SmartMultiAutocompleteStringComponent } from '../shared/controls/smart-multi-autocomplete-string.component';

type MatchingMode = 'No matched yet.' | 'Matched';

@Component({
  selector: 'app-transaction-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SmartMultiAutocompleteStringComponent],
  templateUrl: './transaction-search.component.html'
})
export class TransactionSearchComponent implements OnInit {

  // ---- Form ----
  form: FormGroup = this.fb.group({
    startDate:     this.fb.control<Date | null>(null),
    endDate:       this.fb.control<Date | null>(null),
    matchMode:     this.fb.control<MatchingMode>('No matched yet.'),
    matchTag:      this.fb.control<string | null>(null),
    matchAccount:  this.fb.control<string[] | null>(null), // <== contrôle branché sur l'autocomplete
    limit:         this.fb.control<number>(50, { nonNullable: true }),
    offset:        this.fb.control<number>(0,  { nonNullable: true }),
  });

  // ---- Observables anti-NG0100 (à utiliser dans le template) ----
  valid$     = this.form.statusChanges.pipe(map(s => s === 'VALID'), startWith(this.form.valid));
  matchMode$ = this.form.get('matchMode')!.valueChanges.pipe(startWith(this.form.get('matchMode')!.value));
  accounts$  = this.form.get('matchAccount')!.valueChanges.pipe(startWith(this.form.get('matchAccount')!.value));

  // (facultatif) prêt à rechercher selon tes règles
  ready$: Observable<boolean> = this.form.valueChanges.pipe(
    startWith(this.form.getRawValue()),
    debounceTime(150),
    map(() => {
      const s = this.form.get('startDate')!;
      const e = this.form.get('endDate')!;
      return s.valid && e.valid && (this.form.get('matchMode')!.value as MatchingMode) !== null;
    }),
    distinctUntilChanged()
  );

  // ---- Données d’exemple pour l’autocomplete ----
  accountOptions: string[] = [
    'MFI81559500000EUR9','MFI81559500000CAD4','MFI81559500000GBP8','MFI81559500000NZD0'
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    // si tu dois émettre des événements / side-effects, décale les affectations utilisées par le template :
    // this.form.valueChanges.pipe(debounceTime(700), map(...)).subscribe(val => queueMicrotask(() => this.readyFlag = val));
  }

  onSearch() {
    console.log('Submit:', this.form.getRawValue());
  }
}
