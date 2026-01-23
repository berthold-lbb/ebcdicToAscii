@ViewChild('redditionDatePicker', { static: true })
redditionDatePicker!: {
  value: string;
  reset: () => void;
};

onDateChange(evt: CustomEvent): void {
  const raw =
    Array.isArray(evt.detail?.value)
      ? evt.detail.value[0]
      : evt.detail?.value;

  if (!raw) return;

  // raw = YYYY-MM-DD
  const converted = this.toEndOfMonthIso(raw);

  // 1️⃣ Store / Facade (source of truth)
  this.facade.setSelectedDate(converted);

  // 2️⃣ Réinjecter la valeur CONVERTIE dans le composant DSD
  // 👉 c’est LA ligne clé
  this.redditionDatePicker.value = converted;
}
