export class DateUtils {

  /**
   * Formes autorisées PENDANT la saisie (tolérantes)
   * - YYYY
   * - YYYY-
   * - YYYY-M | YYYY-MM
   * - YYYY-M- | YYYY-MM-
   * - YYYY-MM-D | YYYY-MM-DD
   */
  static isAllowedIsoShape(raw: string): boolean {
    if (!raw) return true;

    const v = raw.trim();

    return (
      /^\d{4}$/.test(v) ||                     // 2025
      /^\d{4}-$/.test(v) ||                    // 2025-
      /^\d{4}-\d{1,2}$/.test(v) ||             // 2025-1 / 2025-01
      /^\d{4}-\d{1,2}-$/.test(v) ||             // 2025-01-
      /^\d{4}-\d{1,2}-\d{1,2}$/.test(v)         // 2025-01-2 / 2025-01-02
    );
  }

  // (le reste : normalizeToEndOfMonthOrInvalid, isIsoDateStrict, etc.)
}


export class DateUtils {
  static isIsoDateStrict(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }

  static endOfMonthIsoFromYearMonth(y: number, m: number): string {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  static endOfMonthIso(dateIso: string): string {
    const m = dateIso.match(/^(\d{4})-(\d{2})/);
    if (!m) return dateIso;
    return DateUtils.endOfMonthIsoFromYearMonth(Number(m[1]), Number(m[2]));
  }

  private static capMax(iso: string, dateMax?: string): string {
    if (!dateMax || !DateUtils.isIsoDateStrict(dateMax)) return iso;
    return iso <= dateMax ? iso : dateMax; // compare ISO ok
  }

  /**
   * Tolère:
   * - YYYY / YYYY-
   * - YYYY-M / YYYY-MM / YYYY-M-
   * - YYYY-MM-D / YYYY-MM-DD
   *
   * Règles:
   * - YYYY ou YYYY- => YYYY-01-31
   * - YYYY-M ou YYYY-MM ou avec '-' final => fin du mois (01 => 31, 02 => 28/29)
   * - YYYY-MM-D ou YYYY-MM-DD (D 1..31) => fin du mois si la date est valide
   * - si invalide (mois 0/13+, jour 0, jour > nb jours du mois) => ok:false, on ne touche pas.
   */
  static normalizeToEndOfMonthOrInvalid(
    raw: string,
    dateMax?: string
  ): { ok: true; value: string } | { ok: false } {
    const v = (raw ?? '').trim();
    if (!v) return { ok: true, value: '' };

    // YYYY ou YYYY-
    const yOnly = v.match(/^(\d{4})-?$/);
    if (yOnly) {
      const y = Number(yOnly[1]);
      const out = DateUtils.capMax(`${yOnly[1]}-01-31`, dateMax);
      return { ok: true, value: out };
    }

    // YYYY-M ou YYYY-MM ou YYYY-M- ou YYYY-MM-
    const ym = v.match(/^(\d{4})-(\d{1,2})-?$/);
    if (ym) {
      const y = Number(ym[1]);
      const m = Number(ym[2]);
      if (m < 1 || m > 12) return { ok: false };
      const out = DateUtils.capMax(DateUtils.endOfMonthIsoFromYearMonth(y, m), dateMax);
      return { ok: true, value: out };
    }

    // YYYY-MM-D ou YYYY-MM-DD (jour 1-2 chiffres)
    const ymd = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymd) {
      const y = Number(ymd[1]);
      const m = Number(ymd[2]);
      const d = Number(ymd[3]);
      if (m < 1 || m > 12) return { ok: false };
      if (d < 1 || d > 31) return { ok: false };

      // On valide la date réelle (ex: 2025-02-30 => invalid)
      const isoStrict = `${ymd[1]}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!DateUtils.isIsoDateStrict(isoStrict)) return { ok: false };

      const out = DateUtils.capMax(DateUtils.endOfMonthIsoFromYearMonth(y, m), dateMax);
      return { ok: true, value: out };
    }

    // Tout le reste: invalid
    return { ok: false };
  }
}
