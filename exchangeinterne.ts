export class DateUtils {
  /** Formes tolérées pendant la saisie */
  static isAllowedIsoShape(raw: string): boolean {
    const v = (raw ?? '').trim();
    return /^(\d{4}|\d{4}-|\d{4}-\d{2}|\d{4}-\d{2}-|\d{4}-\d{2}-\d{2})$/.test(v);
  }

  static isIsoDateStrict(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const [y, m, d] = value.split('-').map(Number);
    if (m < 1 || m > 12) return false;

    const days = this.daysInMonth(y, m);
    return d >= 1 && d <= days;
  }

  static daysInMonth(y: number, m: number): number {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  static endOfMonthIso(y: number, m: number): string {
    return `${y}-${String(m).padStart(2, '0')}-${String(this.daysInMonth(y, m)).padStart(2, '0')}`;
  }

  /**
   * Normalise vers fin de mois OU invalide
   */
  static normalizeToEndOfMonthOrInvalid(
    raw: string
  ): { ok: true; value: string } | { ok: false } {
    const v = (raw ?? '').trim();
    if (!v) return { ok: true, value: '' };

    // 2025 ou 2025-
    if (/^\d{4}-?$/.test(v)) {
      const y = Number(v.slice(0, 4));
      return { ok: true, value: this.endOfMonthIso(y, 1) };
    }

    // 2025-01 ou 2025-01-
    if (/^\d{4}-\d{2}-?$/.test(v)) {
      const [yStr, mStr] = v.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (m < 1 || m > 12) return { ok: false };
      return { ok: true, value: this.endOfMonthIso(y, m) };
    }

    // 2025-02-01 (strict)
    if (!this.isIsoDateStrict(v)) return { ok: false };

    const [yStr, mStr] = v.split('-');
    return { ok: true, value: this.endOfMonthIso(Number(yStr), Number(mStr)) };
  }
}
