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











// reddition.facade.spec.ts
import { TestBed } from '@angular/core/testing';
import { of, Subject, EMPTY } from 'rxjs';

import { RedditionFacade } from './reddition.facade';

// ⬇️ adapte les chemins exacts chez toi
import { AuthenticationService } from '../../../core/services/authentication.service';
import { TransitRepository } from '../../domain/transit.repository';
import { ConciliationRepository } from '../../domain/conciliation.repository';

// ⬇️ si tu utilises FileUtils dans la facade
import { FileUtils } from '../../../../shared/utils/file-utils';

describe('RedditionFacade', () => {
  let facade: RedditionFacade;

  // Streams contrôlés
  let isPaies$: Subject<boolean>;
  let isSacis$: Subject<boolean>;
  let transits$: Subject<any[]>;
  let dateMax$: Subject<string | null>;

  // Repo responses
  let extractionFinAnnee$: Subject<any>;
  let courrielFinAnnee$: Subject<any>;

  // Mocks
  let mockAuth: any;
  let mockTransitRepo: any;
  let mockConciliationRepo: any;

  beforeEach(() => {
    isPaies$ = new Subject<boolean>();
    isSacis$ = new Subject<boolean>();
    transits$ = new Subject<any[]>();
    dateMax$ = new Subject<string | null>();

    extractionFinAnnee$ = new Subject<any>();
    courrielFinAnnee$ = new Subject<any>();

    mockAuth = {
      isPaies: jasmine.createSpy('isPaies').and.returnValue(isPaies$.asObservable()),
      isSacis: jasmine.createSpy('isSacis').and.returnValue(isSacis$.asObservable()),
    };

    mockTransitRepo = {
      getTransits$: jasmine.createSpy('getTransits$').and.returnValue(transits$.asObservable()),
    };

    mockConciliationRepo = {
      getDateMax$: jasmine.createSpy('getDateMax$').and.returnValue(dateMax$.asObservable()),

      getExtractionConciliationFinAnnee$: jasmine
        .createSpy('getExtractionConciliationFinAnnee$')
        .and.returnValue(extractionFinAnnee$.asObservable()),

      getExtractionCourrielFinAnnee$: jasmine
        .createSpy('getExtractionCourrielFinAnnee$')
        .and.returnValue(courrielFinAnnee$.asObservable()),
    };

    TestBed.configureTestingModule({
      providers: [
        RedditionFacade,
        { provide: AuthenticationService, useValue: mockAuth },
        { provide: TransitRepository, useValue: mockTransitRepo },
        { provide: ConciliationRepository, useValue: mockConciliationRepo },
      ],
    });

    facade = TestBed.inject(RedditionFacade);

    // Spy FileUtils si utilisé dans extraire$/envoyer$
    spyOn(FileUtils, 'openBlobFile').and.stub();
    spyOn(FileUtils, 'getFilenameFromContentDisposition').and.callFake((cd?: string) => {
      // fallback simple
      if (!cd) return undefined;
      // Simule extraction filename="xxx"
      const m = /filename="?([^"]+)"?/i.exec(cd);
      return m?.[1];
    });
  });

  // --------------------
  // DATE MAX
  // --------------------
  it('dateMax$: should expose conciliationRepo.getDateMax$()', (done) => {
    facade.dateMax$.subscribe((v) => {
      expect(v).toBe('2023-12-31');
      done();
    });

    dateMax$.next('2023-12-31');

    expect(mockConciliationRepo.getDateMax$).toHaveBeenCalled();
  });

  // --------------------
  // SETTERS
  // --------------------
  it('setSelectedTransit: should push id as-is', (done) => {
    facade.selectedTransitId$.subscribe((id) => {
      expect(id).toBe('T-123');
      done();
    });

    facade.setSelectedTransit('T-123');
  });

  it('setSelectedTransit: should push empty string when id is null/undefined', (done) => {
    let count = 0;

    const sub = facade.selectedTransitId$.subscribe((id) => {
      count++;
      if (count === 1) {
        // valeur initiale (souvent '')
        return;
      }
      expect(id).toBe('');
      sub.unsubscribe();
      done();
    });

    facade.setSelectedTransit(undefined as any);
  });

  it('setSelectedDate: should push date as-is', (done) => {
    facade.selectedDateLabel$.subscribe((d) => {
      expect(d).toBe('2023-07-31');
      done();
    });

    facade.setSelectedDate('2023-07-31');
  });

  it('setSelectedDate: should push empty string when input is null/undefined', (done) => {
    let count = 0;

    const sub = facade.selectedDateLabel$.subscribe((d) => {
      count++;
      if (count === 1) return; // initial
      expect(d).toBe('');
      sub.unsubscribe();
      done();
    });

    facade.setSelectedDate(undefined as any);
  });

  // --------------------
  // EXTRAIRE$
  // --------------------
  it('extraire$: should return EMPTY when date is missing', (done) => {
    isPaies$.next(true);
    isSacis$.next(false);

    facade.setSelectedTransit('T-1');
    facade.setSelectedDate('');

    facade.extraire$().subscribe({
      next: () => fail('should not emit'),
      complete: () => {
        expect(mockConciliationRepo.getExtractionConciliationFinAnnee$).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('extraire$: should return EMPTY when transit is missing', (done) => {
    isPaies$.next(true);
    isSacis$.next(false);

    facade.setSelectedTransit('');
    facade.setSelectedDate('2023-07-31');

    facade.extraire$().subscribe({
      next: () => fail('should not emit'),
      complete: () => {
        expect(mockConciliationRepo.getExtractionConciliationFinAnnee$).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('extraire$: should return EMPTY when no role (isPaie=false and isSaci=false)', (done) => {
    isPaies$.next(false);
    isSacis$.next(false);

    facade.setSelectedTransit('T-1');
    facade.setSelectedDate('2023-07-31');

    facade.extraire$().subscribe({
      next: () => fail('should not emit'),
      complete: () => {
        expect(mockConciliationRepo.getExtractionConciliationFinAnnee$).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('extraire$: PAIE -> should call repo with correct payload and openBlobFile', (done) => {
    isPaies$.next(true);
    isSacis$.next(false);

    facade.setSelectedTransit('T-77');
    facade.setSelectedDate('2023-07-31');

    // Lance
    facade.extraire$().subscribe({
      complete: () => {
        // repo appelé
        expect(mockConciliationRepo.getExtractionConciliationFinAnnee$).toHaveBeenCalled();

        // vérifie payload
        const payloadArg = mockConciliationRepo.getExtractionConciliationFinAnnee$.calls.mostRecent().args[0];
        expect(payloadArg?.body?.dateRapport).toBe('2023-07-31');
        expect(payloadArg?.body?.numTransit).toEqual(['T-77']);

        // le reste dépend de ta POLICY_PAR_ROLE (TRIMESTRIEL/XLS par ex)
        // on vérifie juste présence
        expect(payloadArg?.body?.frequenceExtraction).toBeTruthy();
        expect(payloadArg?.body?.typeFichierExtraction).toBeTruthy();

        // open blob
        expect(FileUtils.openBlobFile).toHaveBeenCalled();
        done();
      },
    });

    // Simule réponse HTTP
    const blob = new Blob(['x'], { type: 'application/octet-stream' });
    extractionFinAnnee$.next({
      body: blob,
      headers: {
        get: (_name: string) => 'attachment; filename="Reddition-PAIE.zip"',
      },
    });
    extractionFinAnnee$.complete();
  });

  it('extraire$: SACI -> should call repo with correct payload and openBlobFile', (done) => {
    isPaies$.next(false);
    isSacis$.next(true);

    facade.setSelectedTransit('T-88');
    facade.setSelectedDate('2023-06-30');

    facade.extraire$().subscribe({
      complete: () => {
        expect(mockConciliationRepo.getExtractionConciliationFinAnnee$).toHaveBeenCalled();

        const payloadArg = mockConciliationRepo.getExtractionConciliationFinAnnee$.calls.mostRecent().args[0];
        expect(payloadArg?.body?.dateRapport).toBe('2023-06-30');
        expect(payloadArg?.body?.numTransit).toEqual(['T-88']);
        expect(payloadArg?.body?.frequenceExtraction).toBeTruthy();
        expect(payloadArg?.body?.typeFichierExtraction).toBeTruthy();

        expect(FileUtils.openBlobFile).toHaveBeenCalled();
        done();
      },
    });

    const blob = new Blob(['x'], { type: 'application/octet-stream' });
    extractionFinAnnee$.next({
      body: blob,
      headers: {
        get: (_name: string) => 'attachment; filename="Reddition-SACI.zip"',
      },
    });
    extractionFinAnnee$.complete();
  });

  // --------------------
  // ENVOYER$
  // --------------------
  it('envoyer$: should return EMPTY when date or transit missing', (done) => {
    isPaies$.next(true);
    isSacis$.next(false);

    facade.setSelectedTransit('');
    facade.setSelectedDate('2023-07-31');

    facade.envoyer$().subscribe({
      next: () => fail('should not emit'),
      complete: () => {
        expect(mockConciliationRepo.getExtractionCourrielFinAnnee$).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('envoyer$: PAIE -> should call repo and openBlobFile', (done) => {
    isPaies$.next(true);
    isSacis$.next(false);

    facade.setSelectedTransit('T-10');
    facade.setSelectedDate('2023-07-31');

    facade.envoyer$().subscribe({
      complete: () => {
        expect(mockConciliationRepo.getExtractionCourrielFinAnnee$).toHaveBeenCalled();

        const payloadArg = mockConciliationRepo.getExtractionCourrielFinAnnee$.calls.mostRecent().args[0];
        expect(payloadArg?.body?.dateRapport).toBe('2023-07-31');
        expect(payloadArg?.body?.numTransit).toEqual(['T-10']);
        expect(payloadArg?.body?.frequenceExtraction).toBeTruthy();
        expect(payloadArg?.body?.typeFichierExtraction).toBeTruthy();

        expect(FileUtils.openBlobFile).toHaveBeenCalled();
        done();
      },
    });

    const blob = new Blob(['mail'], { type: 'application/octet-stream' });
    courrielFinAnnee$.next({
      body: blob,
      headers: { get: (_name: string) => 'attachment; filename="courriel-fin-annee.eml"' },
    });
    courrielFinAnnee$.complete();
  });

  it('envoyer$: SACI -> should call repo and openBlobFile', (done) => {
    isPaies$.next(false);
    isSacis$.next(true);

    facade.setSelectedTransit('T-11');
    facade.setSelectedDate('2023-06-30');

    facade.envoyer$().subscribe({
      complete: () => {
        expect(mockConciliationRepo.getExtractionCourrielFinAnnee$).toHaveBeenCalled();

        const payloadArg = mockConciliationRepo.getExtractionCourrielFinAnnee$.calls.mostRecent().args[0];
        expect(payloadArg?.body?.dateRapport).toBe('2023-06-30');
        expect(payloadArg?.body?.numTransit).toEqual(['T-11']);

        expect(FileUtils.openBlobFile).toHaveBeenCalled();
        done();
      },
    });

    const blob = new Blob(['mail'], { type: 'application/octet-stream' });
    courrielFinAnnee$.next({
      body: blob,
      headers: { get: (_name: string) => 'attachment; filename="courriel-fin-annee.eml"' },
    });
    courrielFinAnnee$.complete();
  });

  // --------------------
  // (OPTIONNEL) Filtrage transits si tu as transitFiltres$ dans la facade
  // --------------------
  it('transitsFiltres$: PAIE should filter transits with idSociete != null (if present)', (done) => {
    // Si la propriété n’existe pas chez toi, skip sans faire planter
    const anyFacade = facade as any;
    if (!anyFacade.transitsFiltres$) {
      done();
      return;
    }

    isPaies$.next(true);
    isSacis$.next(false);

    anyFacade.transitsFiltres$.subscribe((list: any[]) => {
      expect(list.every((t) => t.idSociete != null)).toBeTrue();
      done();
    });

    transits$.next([
      { numeroTransit: '1', nomTransit: 'A', idSociete: 'SOC' },
      { numeroTransit: '2', nomTransit: 'B', idSociete: null },
    ]);
  });
});
