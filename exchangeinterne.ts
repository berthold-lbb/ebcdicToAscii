import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, Observable } from 'rxjs';

import { Reddition } from './reddition'; // <-- adapte le chemin si besoin
import { RedditionFacade } from './reddition.facade'; // <-- adapte
import { DateUtils } from '../utils/date-utils'; // <-- adapte

describe('Reddition component', () => {
  let fixture: ComponentFixture<Reddition>;
  let component: Reddition;

  // Mock façade
  let facade: jasmine.SpyObj<RedditionFacade>;

  beforeEach(async () => {
    facade = jasmine.createSpyObj<RedditionFacade>('RedditionFacade', [
      'setSelectedDate',
      'setSelectedTransit',
      'extraire$',
      'envoyer$',
    ], {
      // propriété/observable
      viewState$: of({}) as any,
      viewStates$: of({}) as any, // selon ton code (tu as viewStates$)
    });

    // par défaut : extraire/envoyer renvoient un observable qui termine
    facade.extraire$.and.returnValue(of(void 0));
    facade.envoyer$.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [Reddition],
      providers: [
        { provide: RedditionFacade, useValue: facade },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      // Important: si ton composant utilise templateUrl, on override le template
      // pour injecter le #redditionDatePicker attendu par @ViewChild
      .overrideComponent(Reddition, {
        set: {
          template: `
            <dsd-date-picker #redditionDatePicker></dsd-date-picker>
            <dsd-combobox></dsd-combobox>
          `,
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(Reddition);
    component = fixture.componentInstance;

    // Vu que @ViewChild sur custom element peut renvoyer ElementRef selon config,
    // on force un stub simple qui supporte `.value = ...`
    (component as any).redditionDatePicker = { value: '' };

    fixture.detectChanges();
  });

  describe('onDateChange', () => {
    it('doit convertir la date (array) -> setSelectedDate + assigner datePicker.value', () => {
      spyOn(DateUtils, 'endOfMonthIso').and.returnValue('2023-07-31');

      const evt = new CustomEvent('dsdDatepickerChange', {
        detail: { value: ['2023-07-04'] },
      });

      component.onDateChange(evt);

      expect(DateUtils.endOfMonthIso).toHaveBeenCalledWith('2023-07-04');
      expect(facade.setSelectedDate).toHaveBeenCalledWith('2023-07-31');
      expect((component as any).redditionDatePicker.value).toBe('2023-07-31');
    });

    it('doit convertir la date (non array) -> setSelectedDate + assigner datePicker.value', () => {
      spyOn(DateUtils, 'endOfMonthIso').and.returnValue('2023-07-31');

      const evt = new CustomEvent('dsdDatepickerChange', {
        detail: { value: '2023-07-12' },
      });

      component.onDateChange(evt);

      expect(DateUtils.endOfMonthIso).toHaveBeenCalledWith('2023-07-12');
      expect(facade.setSelectedDate).toHaveBeenCalledWith('2023-07-31');
      expect((component as any).redditionDatePicker.value).toBe('2023-07-31');
    });

    it('si aucune valeur -> ne fait rien', () => {
      spyOn(DateUtils, 'endOfMonthIso');

      const evt = new CustomEvent('dsdDatepickerChange', {
        detail: { value: null },
      });

      component.onDateChange(evt);

      expect(DateUtils.endOfMonthIso).not.toHaveBeenCalled();
      expect(facade.setSelectedDate).not.toHaveBeenCalled();
    });
  });

  describe('onComboboxClear', () => {
    it('doit vider le transit dans la façade', () => {
      component.onComboboxClear();
      expect(facade.setSelectedTransit).toHaveBeenCalledWith('');
    });
  });

  describe('onComboboxChange', () => {
    it('si evt.detail.value est un array -> prend le 1er', () => {
      const evt = new CustomEvent('dsdComboboxChange', {
        detail: { value: ['98000 - FCDQ'] },
      });

      component.onComboboxChange(evt);

      expect(facade.setSelectedTransit).toHaveBeenCalledWith('98000 - FCDQ');
    });

    it('si evt.detail.value est une string -> prend la string', () => {
      const evt = new CustomEvent('dsdComboboxChange', {
        detail: { value: '98000 - FCDQ' },
      });

      component.onComboboxChange(evt);

      expect(facade.setSelectedTransit).toHaveBeenCalledWith('98000 - FCDQ');
    });

    it("si evt['value'] existe (fallback) -> l’utilise", () => {
      // cas (evt.detail ?? evt)['value']
      const evt: any = { value: '98000 - FCDQ' };

      component.onComboboxChange(evt);

      expect(facade.setSelectedTransit).toHaveBeenCalledWith('98000 - FCDQ');
    });

    it('si newValue est undefined -> passe undefined (ou tu peux choisir de guarder)', () => {
      const evt: any = { detail: undefined };

      component.onComboboxChange(evt);

      // ton code actuel fait setSelectedTransit(Array.isArray(newValue) ? newValue[0] : newValue)
      expect(facade.setSelectedTransit).toHaveBeenCalledWith(undefined as any);
    });
  });

  describe('onExtraire', () => {
    it('doit appeler facade.extraire$ et se désabonner à destroy (takeUntil)', () => {
      const unsubSpy = jasmine.createSpy('unsub');

      facade.extraire$.and.returnValue(
        new Observable<void>((subscriber) => {
          // observable infini
          return () => unsubSpy();
        })
      );

      component.onExtraire();
      expect(facade.extraire$).toHaveBeenCalled();

      // Déclenche ngOnDestroy (BaseComponent) via destroy du fixture
      fixture.destroy();

      expect(unsubSpy).toHaveBeenCalled();
    });
  });

  describe('onEnvoyer', () => {
    it('doit appeler facade.envoyer$ et se désabonner à destroy (takeUntil)', () => {
      const unsubSpy = jasmine.createSpy('unsub');

      facade.envoyer$.and.returnValue(
        new Observable<void>(() => {
          return () => unsubSpy();
        })
      );

      component.onEnvoyer();
      expect(facade.envoyer$).toHaveBeenCalled();

      fixture.destroy();

      expect(unsubSpy).toHaveBeenCalled();
    });
  });
});
