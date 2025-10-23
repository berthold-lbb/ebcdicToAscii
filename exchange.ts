ngOnInit(): void {
  const value$ = this.form.valueChanges.pipe(
    startWith(this.form.value),
    debounceTime(150),
    distinctUntilChanged()
  );

  // ✅ Flux 1 : vérifie uniquement startDate / endDate
  value$
    .pipe(
      map(() => {
        const startDateCtrl = this.form.get('startDate');
        const endDateCtrl = this.form.get('endDate');
        return startDateCtrl?.valid && endDateCtrl?.valid;
      }),
      distinctUntilChanged()
    )
    .subscribe(ready => this.emitReady(ready));

  // ✅ Flux 2 : émet la valeur complète si le formulaire est valide
  value$
    .pipe(
      debounceTime(700),
      filter(() => this.form.valid)
    )
    .subscribe(() => {
      this.autoChange.emit(this.form.getRawValue() as SearchFormValue);
    });
}
