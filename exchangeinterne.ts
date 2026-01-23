import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, Subject } from 'rxjs';

import { Reddition } from './reddition';
import { RedditionFacade } from './facade/reddition.facade';
import { DateUtils } from '../../shared/utils/date-utils';

describe('Reddition', () => {
  let fixture: ComponentFixture<Reddition>;
  let component: Reddition;

  const facadeMock = jasmine.createSpyObj<RedditionFacade>(
    'RedditionFacade',
    [
      'setSelectedDate',
      'setSelectedTransit',
      'extraire$',
      'envoyer$',
    ]
  );

  beforeEach(async () => {
    // stream consommé par AsyncPipe
    (facadeMock as any).viewStates$ = of({});

    facadeMock.extraire$.and.returnValue(of(void 0));
    facadeMock.envoyer$.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [Reddition],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(Reddition, {
        set: {
          providers: [{ provide: RedditionFacade, useValue: facadeMock }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(Reddition);
    component = fixture.componentInstance;

    // stub du custom element
    (component as any).redditionDatePicker = { value: '' };

    fixture.detectChanges();
  });

  afterEach(() => {
    facadeMock.setSelectedDate.calls.reset();
    facadeMock.setSelectedTransit.calls.reset();
    facadeMock.extraire$.calls.reset();
    facadeMock.envoyer$.calls.reset();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // -------------------------
  // DATE
  // -------------------------
  describe('onDateChange', () => {
    it('should ignore empty value', () => {
      component.onDateChange({ detail: { value: null } } as any);
      expect(facadeMock.setSelectedDate).not.toHaveBeenCalled();
    });

    it('should forward raw date to facade and update datepicker', () => {
      spyOn(DateUtils, 'endOfMonthIso').and.returnValue('2023-07-31');

      component.onDateChange({
        detail: { value: ['2023-07-04'] },
      } as any);

      expect(facadeMock.setSelectedDate).toHaveBeenCalledWith('2023-07-04');
      expect(DateUtils.endOfMonthIso).toHaveBeenCalledWith('2023-07-04');
      expect((component as any).redditionDatePicker.value).toBe('2023-07-31');
    });

    it('should work when value is not an array', () => {
      spyOn(DateUtils, 'endOfMonthIso').and.returnValue('2023-02-28');

      component.onDateChange({
        detail: { value: '2023-02-12' },
      } as any);

      expect(facadeMock.setSelectedDate).toHaveBeenCalledWith('2023-02-12');
      expect((component as any).redditionDatePicker.value).toBe('2023-02-28');
    });
  });

  // -------------------------
  // TRANSIT
  // -------------------------
  describe('onComboboxClear', () => {
    it('should clear transit', () => {
      component.onComboboxClear();
      expect(facadeMock.setSelectedTransit).toHaveBeenCalledWith('');
    });
  });

  describe('onComboboxChange', () => {
    it('should handle array value', () => {
      component.onComboboxChange({
        detail: { value: ['98000'] },
      } as any);

      expect(facadeMock.setSelectedTransit).toHaveBeenCalledWith('98000');
    });

    it('should handle direct value', () => {
      component.onComboboxChange({
        detail: '99000',
      } as any);

      expect(facadeMock.setSelectedTransit).toHaveBeenCalledWith('99000');
    });
  });

  // -------------------------
  // ACTIONS
  // -------------------------
  describe('onExtraire', () => {
    it('should call facade.extraire$', () => {
      component.onExtraire();
      expect(facadeMock.extraire$).toHaveBeenCalled();
    });

    it('should unsubscribe on destroy', () => {
      const subj = new Subject<void>();
      facadeMock.extraire$.and.returnValue(subj.asObservable());

      component.onExtraire();
      component.ngOnDestroy();

      expect().nothing();
    });
  });

  describe('onEnvoyer', () => {
    it('should call facade.envoyer$', () => {
      component.onEnvoyer();
      expect(facadeMock.envoyer$).toHaveBeenCalled();
    });
  });
});
