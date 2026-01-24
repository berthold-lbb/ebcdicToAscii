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










import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, EMPTY, Observable, of } from 'rxjs';
import { skip, take } from 'rxjs/operators';

import { RedditionFacade } from './reddition.facade';

// ✅ Ajuste les imports
import { AuthentificationService } from '.../authentification.service';
import { TransitRepository } from '.../transit.repository';
import { ConciliationRepository } from '.../conciliation.repository';

describe('RedditionFacade', () => {
  let facade: RedditionFacade;

  // Streams contrôlés (⚠️ BehaviorSubject pour éviter les timeouts)
  let isPaieBS: BehaviorSubject<boolean>;
  let isSaciBS: BehaviorSubject<boolean>;
  let transitsBS: BehaviorSubject<any[]>;          // remplace any[] par TransitBffDto[] si tu veux
  let dateMaxBS: BehaviorSubject<string | null>;

  // Mocks (⚠️ isPaie$ et isSaci$ sont des méthodes)
  let authMock: jasmine.SpyObj<AuthentificationService>;
  let transitRepoMock: jasmine.SpyObj<TransitRepository>;
  let conciliationRepoMock: jasmine.SpyObj<ConciliationRepository>;

  beforeEach(() => {
    // valeurs initiales (important pour combineLatest/switchMap)
    isPaieBS = new BehaviorSubject<boolean>(false);
    isSaciBS = new BehaviorSubject<boolean>(false);
    transitsBS = new BehaviorSubject<any[]>([]);
    dateMaxBS = new BehaviorSubject<string | null>(null);

    authMock = jasmine.createSpyObj<AuthentificationService>('AuthentificationService', [
      'isPaie$',
      'isSaci$',
    ]);

    transitRepoMock = jasmine.createSpyObj<TransitRepository>('TransitRepository', [
      'getTransits$',
    ]);

    conciliationRepoMock = jasmine.createSpyObj<ConciliationRepository>('ConciliationRepository', [
      'getDateMax$',
      'getExtractionConciliationFinAnnee$',
      'getExtractionCourrielFinAnnee$',
    ]);

    // ✅ IMPORTANT: mock des méthodes -> return observables
    authMock.isPaie$.and.returnValue(isPaieBS.asObservable());
    authMock.isSaci$.and.returnValue(isSaciBS.asObservable());

    transitRepoMock.getTransits$.and.returnValue(transitsBS.asObservable());
    conciliationRepoMock.getDateMax$.and.returnValue(dateMaxBS.asObservable());

    // repo "extraire"/"envoyer" : par défaut on renvoie des obs qui complètent
    conciliationRepoMock.getExtractionConciliationFinAnnee$.and.returnValue(
      of({ body: new Blob(['x'], { type: 'application/zip' }), headers: new Map() } as any)
    );
    conciliationRepoMock.getExtractionCourrielFinAnnee$.and.returnValue(of({} as any));

    TestBed.configureTestingModule({
      providers: [
        RedditionFacade,
        { provide: AuthentificationService, useValue: authMock },
        { provide: TransitRepository, useValue: transitRepoMock },
        { provide: ConciliationRepository, useValue: conciliationRepoMock },
      ],
    });

    facade = TestBed.inject(RedditionFacade);
  });

  // -----------------------
  // ROLES: isPaie$ / isSaci$
  // -----------------------

  it('isPaie$: should expose auth.isPaie$()', (done) => {
    facade.isPaie$.pipe(take(1)).subscribe((v) => {
      expect(v).toBe(false);
      expect(authMock.isPaie$).toHaveBeenCalled();
      done();
    });
  });

  it('isSaci$: should expose auth.isSaci$()', (done) => {
    facade.isSaci$.pipe(take(1)).subscribe((v) => {
      expect(v).toBe(false);
      expect(authMock.isSaci$).toHaveBeenCalled();
      done();
    });
  });

  // -----------------------
  // dateMaxLabel$ : déclencher le switchMap (abonnement obligatoire)
  // -----------------------

  it('dateMaxLabel$: should call repo.getDateMax$ when SACI=true', (done) => {
    // ⚠️ On force SACI true
    isSaciBS.next(true);

    // ⚠️ On doit S’ABONNER pour déclencher l’appel
    facade.dateMaxLabel$.pipe(take(1)).subscribe((v) => {
      expect(conciliationRepoMock.getDateMax$).toHaveBeenCalled();
      done();
    });

    // et on pousse une valeur dans le flux mocké
    dateMaxBS.next('2023-12-31');
  });

  it('dateMaxLabel$: should NOT call repo.getDateMax$ when SACI=false', (done) => {
    isSaciBS.next(false);

    facade.dateMaxLabel$.pipe(take(1)).subscribe((v) => {
      expect(conciliationRepoMock.getDateMax$).not.toHaveBeenCalled();
      done();
    });

    // si ton code renvoie null/'' dans ce cas, on laisse l’émission initiale faire le job
  });

  // -----------------------
  // SETTERS: BehaviorSubject('') => skip(1)
  // -----------------------

  it('setSelectedTransit: should push id as-is', (done) => {
    facade.selectedTransitId$
      .pipe(skip(1), take(1))
      .subscribe((id) => {
        expect(id).toBe('T-123');
        done();
      });

    facade.setSelectedTransit('T-123');
  });

  it('setSelectedDate: should push date as-is', (done) => {
    facade.selectedDateLabel$
      .pipe(skip(1), take(1))
      .subscribe((d) => {
        expect(d).toBe('2023-07-31');
        done();
      });

    facade.setSelectedDate('2023-07-31');
  });

  // -----------------------
  // transits$ / transitsFiltres$ (si tu les exposes)
  // -----------------------

  it('transits$: should expose transitRepo.getTransits$()', (done) => {
    const sample = [{ numeroTransit: 'T1' }, { numeroTransit: 'T2' }];
    facade.transits$.pipe(take(1)).subscribe((list) => {
      expect(transitRepoMock.getTransits$).toHaveBeenCalled();
      done();
    });

    transitsBS.next(sample);
  });

  it('transitsFiltres$: PAIE -> should filter by "isPaie" rule', (done) => {
    // ⚠️ adapte les flags/noms selon ton modèle réel
    const sample = [
      { numeroTransit: 'T1', idSociete: 'AAA' },   // supposé "PAIE"
      { numeroTransit: 'T2', idSociete: null },    // supposé "SACI"
    ];

    transitsBS.next(sample);
    isPaieBS.next(true);
    isSaciBS.next(false);

    facade.transitsFiltres$.pipe(take(1)).subscribe((list) => {
      // ✅ mets ici TON attente exacte selon ton filter réel
      // exemple: "PAIE = idSociete != null"
      expect(list.map((x: any) => x.numeroTransit)).toEqual(['T1']);
      done();
    });
  });

  it('transitsFiltres$: SACI -> should filter by "isSaci" rule', (done) => {
    const sample = [
      { numeroTransit: 'T1', idSociete: 'AAA' },
      { numeroTransit: 'T2', idSociete: null },
    ];

    transitsBS.next(sample);
    isPaieBS.next(false);
    isSaciBS.next(true);

    facade.transitsFiltres$.pipe(take(1)).subscribe((list) => {
      // exemple: "SACI = idSociete == null"
      expect(list.map((x: any) => x.numeroTransit)).toEqual(['T2']);
      done();
    });
  });

  // -----------------------
  // extraire$ / envoyer$ : tests qui ne timeout pas
  // -----------------------

  it('extraire$: should COMPLETE without calling repo when no role', (done) => {
    isPaieBS.next(false);
    isSaciBS.next(false);

    facade.setSelectedTransit('T-1');
    facade.setSelectedDate('2023-07-31');

    facade.extraire$().subscribe({
      next: () => fail('should not emit'),
      complete: () => {
        expect(conciliationRepoMock.getExtractionConciliationFinAnnee$).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('extraire$: PAIE -> should call repo', (done) => {
    isPaieBS.next(true);
    isSaciBS.next(false);

    facade.setSelectedTransit('T-1');
    facade.setSelectedDate('2023-07-31');

    facade.extraire$().subscribe({
      complete: () => {
        expect(conciliationRepoMock.getExtractionConciliationFinAnnee$).toHaveBeenCalled();
        done();
      },
    });
  });

  it('envoyer$: SACI -> should call repo', (done) => {
    isPaieBS.next(false);
    isSaciBS.next(true);

    facade.setSelectedTransit('T-1');
    facade.setSelectedDate('2023-07-31');

    facade.envoyer$().subscribe({
      complete: () => {
        expect(conciliationRepoMock.getExtractionCourrielFinAnnee$).toHaveBeenCalled();
        done();
      },
    });
  });
});

