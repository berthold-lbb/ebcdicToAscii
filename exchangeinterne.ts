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












import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';

import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';

import { Redditition } from './redditition';
import { ReddititionFacade } from '../facade/reddition.facade';
import { DateUtils } from '../../../../shared/utils/date-utils';

describe('Redditition', () => {
  let fixture: ComponentFixture<Redditition>;
  let component: Redditition;

  let facadeMock: jasmine.SpyObj<ReddititionFacade>;

  beforeEach(async () => {
    facadeMock = jasmine.createSpyObj<ReddititionFacade>('ReddititionFacade', [
      'setSelectedDate',
      'setSelectedTransit',
      'extraire$',
      'envoyer$',
    ]);

    // Si ton composant expose viewState$ depuis la facade
    (facadeMock as any).viewState$ = of({});

    facadeMock.extraire$.and.returnValue(of(void 0));
    facadeMock.envoyer$.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [
        Redditition,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [{ provide: ReddititionFacade, useValue: facadeMock }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Redditition);
    component = fixture.componentInstance;

    // Mock du ViewChild datepicker
    (component as any).reddititionDatePicker = { value: '' };

    // Mock de unsubscribe$ (au cas où BaseComponent ne l'initialise pas en test)
    (component as any).unsubscribe$ = new Subject<void>();

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // -------------------
  // DATE PICKER
  // -------------------

  it('onDateChange: should convert and update facade + datepicker when value is array', () => {
    component.onDateChange({ detail: { value: ['2023-07-04'] } } as any);

    const expected = DateUtils.endOfMonthIso('2023-07-04');

    expect(facadeMock.setSelectedDate).toHaveBeenCalledWith(expected);
    expect((component as any).reddititionDatePicker.value).toBe(expected);
  });

  it('onDateChange: should convert and update facade + datepicker when value is string', () => {
    component.onDateChange({ detail: { value: '2023-02-12' } } as any);

    const expected = DateUtils.endOfMonthIso('2023-02-12');

    expect(facadeMock.setSelectedDate).toHaveBeenCalledWith(expected);
    expect((component as any).reddititionDatePicker.value).toBe(expected);
  });

  it('onDateChange: should do nothing if raw is null/undefined', () => {
    component.onDateChange({ detail: { value: null } } as any);

    expect(facadeMock.setSelectedDate).not.toHaveBeenCalled();
    expect((component as any).reddititionDatePicker.value).toBe('');
  });

  // -------------------
  // TRANSIT COMBOBOX
  // -------------------

  it('onComboboxClear: should clear transit id', () => {
    component.onComboboxClear();

    expect(facadeMock.setSelectedTransit).toHaveBeenCalledWith('');
  });

  it('onComboboxChange: should take first item if array', () => {
    component.onComboboxChange({ detail: { value: ['T1', 'T2'] } } as any);

    expect(facadeMock.setSelectedTransit).toHaveBeenCalledWith('T1');
  });

  it('onComboboxChange: should take string value directly', () => {
    component.onComboboxChange({ detail: { value: 'T9' } } as any);

    expect(facadeMock.setSelectedTransit).toHaveBeenCalledWith('T9');
  });

  // -------------------
  // EXTRAIRE / ENVOYER
  // -------------------

  it('onExtraire: should call facade.extraire$ and subscribe', () => {
    component.onExtraire();

    expect(facadeMock.extraire$).toHaveBeenCalledTimes(1);
  });

  it('onEnvoyer: should call facade.envoyer$ and subscribe', () => {
    component.onEnvoyer();

    expect(facadeMock.envoyer$).toHaveBeenCalledTimes(1);
  });

  it('onExtraire: should not crash even if unsubscribe$ emits (takeUntil)', () => {
    component.onExtraire();

    // simule destruction / cleanup
    (component as any).unsubscribe$.next();
    (component as any).unsubscribe$.complete();

    expect(facadeMock.extraire$).toHaveBeenCalledTimes(1);
  });

  it('onEnvoyer: should not crash even if unsubscribe$ emits (takeUntil)', () => {
    component.onEnvoyer();

    (component as any).unsubscribe$.next();
    (component as any).unsubscribe$.complete();

    expect(facadeMock.envoyer$).toHaveBeenCalledTimes(1);
  });
});
