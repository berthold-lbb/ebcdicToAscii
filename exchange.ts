✅ Exemple complet et élégant (sans subscribe, tout à la déclaration)
this.form = this.fb.group(
  {
    matchMode: this.fb.control<MatchingMode | null>('No matched yet'),
    matchTag: this.fb.control<string | null>(null),
    startDate: this.fb.control<Date | null>(null),
    endDate: this.fb.control<Date | null>(null),
    matchAccount: this.fb.control<string | null>(null),
    limit: this.fb.control<number>(50, { nonNullable: true }),
    offset: this.fb.control<number>(0, { nonNullable: true }),
  },
  {
    validators: [this.matchTagRequiredIfMatched()],
  }
);

🧩 Validator conditionnel (déclaré une seule fois)
private matchTagRequiredIfMatched(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const mode = group.get('matchMode')?.value;
    const tag = group.get('matchTag')?.value;

    if (mode === 'Matched' && (tag === null || tag === '')) {
      group.get('matchTag')?.setErrors({ required: true });
      return { matchTagRequired: true };
    }

    // retire l'erreur si le mode change
    if (group.get('matchTag')?.hasError('required')) {
      group.get('matchTag')?.setErrors(null);
    }

    return null;
  };
}
