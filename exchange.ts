this.transactionLoading = true;

this.worktableService.unMatchBatch(idTransactions).pipe(
  tap({
    next: (response) => {
      this.log.success(`Suppression terminée : ${response}`);
      this.searchTransactionsComponent.submit();
    },
    error: (err) => {
      this.log.error("Erreur lors de la désassociation : " + err.message);
    },
  }),
  finalize(() => (this.transactionLoading = false))
).subscribe();