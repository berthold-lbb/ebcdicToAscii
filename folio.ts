private readonly refreshSubject = new Subject<void>();
readonly refresh$ = this.refreshSubject.asObservable();

refresh(): void {
  this.refreshSubject.next();
}


private readonly criteriaTrigger$ = merge(
  // 1) quand criteria change
  this.criterias.pipe(map((c) => c)),

  // 2) quand on refresh -> on reprend le dernier criteria
  this.refresh$.pipe(
    withLatestFrom(this.criterias),
    map(([, c]) => c)
  )
).pipe(
  shareReplay({ bufferSize: 1, refCount: true })
);
