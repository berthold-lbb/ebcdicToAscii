private formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

private parseYMDLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d); // ✅ local, pas UTC
}

setSelectedDate(input: Date | string | null | undefined): void {
  if (!input) {
    this.selectedDateLabelSubject.next('');
    return;
  }

  const d = input instanceof Date ? input : this.parseYMDLocal(input);

  // ✅ dernier jour du même mois
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);

  this.selectedDateLabelSubject.next(this.formatYMD(end));
}
