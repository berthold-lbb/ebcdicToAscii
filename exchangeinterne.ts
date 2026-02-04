rawDate = '';
saisieIncomplete = false;
saisieInvalid = false;

@ViewChild('redditionDatePicker', { static: false }) redditionDatePicker!: any;

private setFromEvent(evt: any): string {
  const val = Array.isArray(evt?.detail?.value) ? evt.detail.value[0] : evt?.detail?.value;
  return (val ?? '').toString();
}

/** (dateChange) : on suit la valeur (picker ou input), mais on ne normalise pas ici */
onDateChange(evt: CustomEvent): void {
  this.rawDate = this.setFromEvent(evt).trim();

  if (!this.rawDate) {
    this.saisieIncomplete = false;
    this.saisieInvalid = false;
    this.facade.setSelectedDate('');
    return;
  }

  // Pendant la frappe, si la forme n'est pas complète => incomplete
  this.saisieIncomplete = !DateUtils.isAllowedIsoShape(this.rawDate);
  this.saisieInvalid = false; // pas de rouge tant qu'on n'a pas "commit"
}

/** (keyup) : idem, on ne normalise jamais sur keyup */
onDateKeyup(evt: KeyboardEvent): void {
  const v = (evt.target as HTMLInputElement)?.value ?? '';
  this.rawDate = v.trim();

  if (!this.rawDate) {
    this.saisieIncomplete = false;
    this.saisieInvalid = false;
    this.facade.setSelectedDate('');
    return;
  }

  this.saisieIncomplete = !DateUtils.isAllowedIsoShape(this.rawDate);
  this.saisieInvalid = false;
}

/** (focusout) : commit + fallback */
onDateFocusOut(): void {
  if (!this.rawDate) return;

  // si encore incomplet => on applique le fallback (ex: 2025, 2025-01)
  const r = DateUtils.normalizeToEndOfMonthOrInvalid(this.rawDate);

  if (!r.ok) {
    this.saisieInvalid = true; // on laisse l’input intact
    return;
  }

  this.saisieInvalid = false;
  this.saisieIncomplete = false;

  const normalized = r.value;
  this.facade.setSelectedDate(normalized);
  if (this.redditionDatePicker) this.redditionDatePicker.value = normalized;
}




export class DateUtils {
  /** Autorise uniquement: YYYY | YYYY-MM | YYYY-MM-DD */
  static isAllowedIsoShape(raw: string): boolean {
    const v = (raw ?? '').trim();
    return /^(\d{4}|\d{4}-\d{2}|\d{4}-\d{2}-\d{2})$/.test(v);
  }

  /** Strict calendrier pour YYYY-MM-DD (refuse 2025-02-48, 2025-02-00, etc.) */
  static isIsoDateStrict(value: string): boolean {
    const v = (value ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;

    const [y, m, d] = v.split('-').map(Number);
    if (m < 1 || m > 12) return false;

    const days = this.daysInMonth(y, m);
    return d >= 1 && d <= days;
  }

  /** yyyy-mm-dd (UTC) du dernier jour du mois de y/m */
  static endOfMonthIsoFromYearMonth(y: number, m: number): string {
    const days = this.daysInMonth(y, m);
    return `${y}-${String(m).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
  }

  static daysInMonth(y: number, m: number): number {
    // m: 1..12
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  /**
   * Règles demandées:
   * - "2025" -> "2025-01-31"
   * - "2025-02" -> "2025-02-28/29"
   * - "2025-02-01" -> "2025-02-28/29"
   * - "2025-02-00" / "2025-02-48" / "2025-14" -> invalid (on ne touche pas)
   */
  static normalizeToEndOfMonthOrInvalid(raw: string): { ok: true; value: string } | { ok: false } {
    const v = (raw ?? '').trim();
    if (!v) return { ok: true, value: '' };

    if (!this.isAllowedIsoShape(v)) return { ok: false };

    // YYYY
    if (/^\d{4}$/.test(v)) {
      const y = Number(v);
      return { ok: true, value: this.endOfMonthIsoFromYearMonth(y, 1) };
    }

    // YYYY-MM
    if (/^\d{4}-\d{2}$/.test(v)) {
      const [yStr, mStr] = v.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (m < 1 || m > 12) return { ok: false };
      return { ok: true, value: this.endOfMonthIsoFromYearMonth(y, m) };
    }

    // YYYY-MM-DD
    if (!this.isIsoDateStrict(v)) return { ok: false };
    const [yStr, mStr] = v.split('-');
    return { ok: true, value: this.endOfMonthIsoFromYearMonth(Number(yStr), Number(mStr)) };
  }
}
