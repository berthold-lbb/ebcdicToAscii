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
----------------------------------------------------------
<form [formGroup]="form" (ngSubmit)="onSearch()">

  <!-- Autocomplete multi sélection -->
  <app-smart-multi-autocomplete-string
    formControlName="matchAccount"
    [label]="'Compte'"
    [placeholder]="'Rechercher un compte...'"
    [options]="accountOptions"
    [recentsEnabled]="true"
    [recentsMode]="'onRefocus'"
    [maxRecents]="5">
  </app-smart-multi-autocomplete-string>

  <!-- Match Tag visible uniquement si le mode est 'Matched' (async) -->
  @if ((matchMode$ | async) === 'Matched') {
    <mat-form-field appearance="fill" class="w-300">
      <mat-label>Match tag</mat-label>
      <input matInput formControlName="matchTag" placeholder="ex: TAG_ABC_2025" />
    </mat-form-field>
  }

  <!-- Autres champs… (limit, offset, etc.) -->

  <div class="mt-3">
    <button type="submit" [disabled]="!(valid$ | async)">Rechercher</button>
  </div>

  <!-- Debug asynchrone (évite NG0100) -->
  <pre>Comptes: {{ (accounts$ | async) | json }}</pre>
</form>



----------------------

3) Flux publics pour le template
import { map, startWith, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';

readonly matchMode$: Observable<MatchingMode> =
  this.modeCtrl.valueChanges.pipe(
    startWith(this.modeCtrl.value as MatchingMode),
    distinctUntilChanged(),
    shareReplay(1)
  );

readonly isMatched$ = this.matchMode$.pipe(map(m => m === 'Matched'));

readonly valid$ = this.form.statusChanges.pipe(
  map(s => s === 'VALID'),
  startWith(this.form.valid),
  shareReplay(1)
);

readonly accounts$ = this.form.get('matchAccount')!.valueChanges.pipe(
  startWith(this.form.get('matchAccount')!.value),
  shareReplay(1)
);

4) Output (compat rétro) + wiring
@Output() matchModeChange = new EventEmitter<MatchingMode>();

private readonly destroy$ = new Subject<void>();

ngOnInit(): void {
  // Émettre vers l’Output sans NG0100
  this.matchMode$
    .pipe(/* takeUntil(this.destroy$) si tu veux */)
    .subscribe(mode => queueMicrotask(() => this.matchModeChange.emit(mode)));
}

ngOnDestroy(): void {
  this.destroy$.next(); this.destroy$.complete();
}

5) API claire pour changer le mode (si besoin depuis le code)
setMatchMode(mode: MatchingMode) {
  if (this.modeCtrl.value !== mode) {
    this.modeCtrl.setValue(mode); // déclenche matchMode$ + matchModeChange
  }
}

toggleMatchMode() {
  this.setMatchMode(this.modeCtrl.value === 'Matched' ? 'No matched yet.' : 'Matched');
}

Template (remplacements sûrs)
<!-- AVANT (à éviter) -->
<!-- @if (form.get('matchMode')?.value == 'Matched') { ... } -->

<!-- APRÈS -->
@if ((isMatched$ | async)) {
  <mat-form-field appearance="fill" class="w-300">
    <mat-label>Match tag</mat-label>
    <input matInput formControlName="matchTag" placeholder="ex: TAG_ABC_2025" />
  </mat-form-field>
}

<button type="submit" [disabled]="!(valid$ | async)">Rechercher</button>

<!-- debug non-bloquant -->
<pre>Comptes: {{ (accounts$ | async) | json }}</pre>


Tu peux aussi afficher le mode si besoin :
Mode: {{ (matchMode$ | async) }}