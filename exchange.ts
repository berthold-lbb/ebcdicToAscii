forkJoin(ids.map(id =>
  this.worktableService.delete(id).pipe(
    map(() => ({ id, ok: true })),
    catchError(err => of({ id, ok: false, err }))
  )
)).subscribe(results => {
  const ok = results.filter(r => r.ok).length;
  const ko = results.length - ok;
  this.log.info(`Suppression terminée: ${ok} ok / ${ko} échec(s).`);
  this.searchTransactionsComponent.submit();
});