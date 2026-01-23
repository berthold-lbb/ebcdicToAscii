1) Util : dernier jour du mois en ISO (robuste, court)
export function endOfMonthIso(dateIso: string): string {
  // attend "YYYY-MM-DD"
  const [y, m] = dateIso.split('-').map(Number);
  if (!y || !m) return dateIso;

  // Jour 0 du mois suivant => dernier jour du mois courant
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();

  return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}


✅ Pas de new Date("YYYY-MM-DD") (source classique du décalage -1)
✅ Pas de regex
✅ Sonar-friendly

2) Intégration dans ta façade : setSelectedDate
Option simple (tu stockes directement le dernier jour du mois)
private readonly selectedDateLabelSubject = new BehaviorSubject<string>('');
readonly selectedDateLabel$ = this.selectedDateLabelSubject.asObservable();

setSelectedDate(input: string | null | undefined): void {
  if (!input) {
    this.selectedDateLabelSubject.next('');
    return;
  }

  // input déjà ISO => on calcule le dernier jour du mois
  this.selectedDateLabelSubject.next(endOfMonthIso(input));
}


Comme ça, partout où tu utilises dateRapport, tu as déjà YYYY-MM-DD avec le dernier jour du mois.

3) Tests unitaires complets
a) Tests de endOfMonthIso
import { endOfMonthIso } from './date-utils';

describe('endOfMonthIso', () => {
  it('should return 2023-07-31 from 2023-07-29', () => {
    expect(endOfMonthIso('2023-07-29')).toBe('2023-07-31');
  });

  it('should handle non-leap year february', () => {
    expect(endOfMonthIso('2023-02-10')).toBe('2023-02-28');
  });

  it('should handle leap year february', () => {
    expect(endOfMonthIso('2024-02-10')).toBe('2024-02-29');
  });

  it('should keep month padding', () => {
    expect(endOfMonthIso('2023-01-05')).toBe('2023-01-31');
  });

  it('should return input if invalid', () => {
    expect(endOfMonthIso('')).toBe('');
    expect(endOfMonthIso('abcd')).toBe('abcd');
  });
});

b) Tests de la façade : setSelectedDate
describe('RedditionFacade - setSelectedDate', () => {
  let facade: any; // ou RedditionFacade si tu as le constructeur simple

  beforeEach(() => {
    // Ici je mock juste le minimum : le subject + méthode
    const selectedDateLabelSubject = new BehaviorSubject<string>('');
    facade = {
      selectedDateLabel$: selectedDateLabelSubject.asObservable(),
      selectedDateLabelSubject,
      setSelectedDate(input: string | null | undefined) {
        if (!input) {
          selectedDateLabelSubject.next('');
          return;
        }
        selectedDateLabelSubject.next(endOfMonthIso(input));
      },
    };
  });

  it('should emit end-of-month ISO date', (done) => {
    facade.selectedDateLabel$.subscribe((v: string) => {
      if (v) {
        expect(v).toBe('2023-07-31');
        done();
      }
    });

    facade.setSelectedDate('2023-07-29');
  });

  it('should emit empty string when input is null', (done) => {
    facade.selectedDateLabel$.subscribe((v: string) => {
      expect(v).toBe('');
      done();
    });

    facade.setSelectedDate(null);
  });
});