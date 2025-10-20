return forkJoin([credits$, debits$]).pipe(
      map(([c, d]) => {
        const merged = [...c, ...d];
        merged.sort((a, b) => Date.parse(b.entryDate) - Date.parse(a.entryDate)); // tri DESC
        return merged;
      }),
      catchError(() => of<InfoTransactionModel[]>([]))
    );