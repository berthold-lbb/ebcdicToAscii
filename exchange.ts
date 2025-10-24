// Exemple de modèle (adapte les noms si besoin)
type TxType = 'CREDIT' | 'DEBIT';
interface InfoTransactionModel {
  idTransaction: string;
  entryDate: string;   // ISO string
  amount: number;
  transactionType: TxType; // 'CREDIT' | 'DEBIT'
  // ... autres champs
}

interface Page<T> { content: T[]; totalElements: number; }

private toPayload(f: SearchFormValue) {
  return {
    startDate: f.startDate,
    endDate: f.endDate,
    matchAccount: f.matchAccount,
    matchMode: f.matchMode,        // 'NoMatched' | 'Matched'
    matchTag: f.matchTag ?? null,  // seulement si NoMatched
    limit: f.limit ?? 50,
    offset: f.offset ?? 0
  };
}

// ---- NOUVEAU: un seul appel REST
private getTransactions(payload: any) {
  return this.transactionsService.search(payload).pipe(
    // ton API peut renvoyer Page<T> ou directement T[] ; on normalise
    map((res: Page<InfoTransactionModel> | InfoTransactionModel[]) =>
      Array.isArray(res) ? res : (res?.content ?? [])
    )
  );
}

// ---- NOUVEAU: charge, trie, calcule les totaux
private loadTransactions(f: SearchFormValue) {
  const payload = this.toPayload(f);

  return this.getTransactions(payload).pipe(
    map(list => {
      // tri du plus récent au plus ancien
      list.sort((a, b) => Date.parse(b.entryDate) - Date.parse(a.entryDate));

      // totaux
      const totalCredit = list
        .filter(x => x.transactionType === 'CREDIT')
        .reduce((s, x) => s + (Number(x.amount) || 0), 0);

      const totalDebit = list
        .filter(x => x.transactionType === 'DEBIT')
        .reduce((s, x) => s + (Number(x.amount) || 0), 0);

      // expose ce dont tu as besoin dans le composant
      this.total = list.length;
      this.totalCredit = totalCredit;
      this.totalDebit = totalDebit;
      this.residual = totalCredit - totalDebit;   // si tu l’utilises

      return list; // ← renvoie la liste pour l’affichage (lib-data-table)
    }),
    catchError(() => {
      this.total = this.totalCredit = this.totalDebit = this.residual = 0;
      return of<InfoTransactionModel[]>([]);
    })
  );
}