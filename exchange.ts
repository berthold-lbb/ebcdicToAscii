1) Déclaration du form (pas de subscribe)
this.form = this.fb.group(
  {
    matchMode: this.fb.control<MatchingMode | null>('No matched yet'),
    matchTag:  this.fb.control<string | null>(null), // reste ENABLED
    // ...
  },
  { validators: [this.matchTagRequiredIfMatched()] }
);

2) Validateur de groupe robuste
private matchTagRequiredIfMatched(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const mode = group.get('matchMode')?.value;
    const tagCtrl = group.get('matchTag');
    if (!tagCtrl) return null;

    const hasTag = tagCtrl.value !== null && tagCtrl.value !== '';

    if (mode === 'Matched' && !hasTag) {
      // ajoute uniquement NOTRE erreur
      const prev = tagCtrl.errors ?? {};
      if (!prev['requiredWhenMatched']) {
        tagCtrl.setErrors({ ...prev, requiredWhenMatched: true });
      }
      return { requiredWhenMatched: true }; // rend aussi le form invalide
    } else {
      // retire uniquement NOTRE erreur, garde le reste
      if (tagCtrl.errors?.['requiredWhenMatched']) {
        const { requiredWhenMatched, ...rest } = tagCtrl.errors!;
        tagCtrl.setErrors(Object.keys(rest).length ? rest : null);
      }
      return null;
    }
  };
}

3) Template (tu peux continuer à cacher le champ)
<!-- affiché seulement en mode Matched -->
@if (form.get('matchMode')?.value === 'Matched') {
  <mat-form-field appearance="fill" class="w-300">
    <mat-label>Match tag</mat-label>
    <input matInput formControlName="matchTag" placeholder="ex: TX-2025" />
    @if (form.get('matchTag')?.hasError('requiredWhenMatched') && form.get('matchTag')?.touched) {
      <mat-error>Le tag est requis en mode “Matched”.</mat-error>
    }
  </mat-form-field>
}

4) Ton pipe d’émission peut rester
value$
  .pipe(debounceTime(700), filter(() => this.form.valid))
  .subscribe(() => this.autoChange.emit(this.form.getRawValue() as SearchFormValue));


Si malgré tout tu veux vider le tag en repassant à “No matched yet” (pour éviter une valeur résiduelle cachée), ajoute juste une ligne dans un endroit où tu gères le switch (ex. bouton/toggle) :

if (this.form.get('matchMode')?.value !== 'Matched') {
  this.form.get('matchTag')?.setValue(null);
}


(Pas besoin de subscribe global.)

Avec ça, quand tu passes à Matched sans matchTag, form.valid devient false → rien n’est émis. Quand tu repasses à No matched yet, l’erreur est retirée et le form peut redevenir valide.