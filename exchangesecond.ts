private sameSearch(a: SearchFormValue, b: SearchFormValue): boolean {
  const ts = (d: Date | null) => (d ? d.getTime() : null);
  return (
    ts(a.startDate) === ts(b.startDate) &&
    ts(a.endDate) === ts(b.endDate) &&
    a.matchAccount === b.matchAccount &&
    a.limit === b.limit &&
    a.offset === b.offset &&
    a.matchingStatus === b.matchingStatus &&
    (a.matchTag ?? null) === (b.matchTag ?? null)
  );
}

ngOnInit() {
  merge(
    this.autoSearch$.pipe(
      debounceTime(600),
      distinctUntilChanged((a, b) => this.sameSearch(a, b))
    ),
    this.manualSearch$ // immédiat
  )
    .pipe(
      tap(() => this.transactionLoading = true),
      switchMap(f => this.loadTransactions(f)
        .pipe(finalize(() => this.transactionLoading = false))
      )
    )
    .subscribe(rows => {
      this.rows = rows;
      this.total = rows.length;
    });
}