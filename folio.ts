import { TestBed } from '@angular/core/testing';
import { NgxsModule } from '@ngxs/store';
import { BehaviorSubject, of } from 'rxjs';
import { take } from 'rxjs/operators';

import { TransitContextFacade } from './transit-context.facade';
import { TransitRepository } from '../repositories/transit.repository';
import { AuthContextFacade } from '../../auth/facade/auth-context.facade'; // adapte le chemin

describe('TransitContextFacade', () => {
  let repoSpy: jasmine.SpyObj<TransitRepository>;

  // streams contrôlables
  let isPaie$: BehaviorSubject<boolean>;
  let isSaci$: BehaviorSubject<boolean>;

  function createFacade() {
    TestBed.resetTestingModule();

    isPaie$ = new BehaviorSubject<boolean>(false);
    isSaci$ = new BehaviorSubject<boolean>(false);

    const authMock: Partial<AuthContextFacade> = {
      isPaie$: isPaie$.asObservable(),
      isSaci$: isSaci$.asObservable(),
    };

    repoSpy = jasmine.createSpyObj<TransitRepository>('TransitRepository', ['obtenirTransits']);

    TestBed.configureTestingModule({
      imports: [NgxsModule.forRoot([])],
      providers: [
        TransitContextFacade,
        { provide: AuthContextFacade, useValue: authMock },
        { provide: TransitRepository, useValue: repoSpy },
      ],
    });

    const facade = TestBed.inject(TransitContextFacade);

    // ✅ très important : runEffect ne doit pas “casser” ton test
    // on le remplace par un pass-through : runEffect(source$) => source$
    spyOn<any>(facade, 'runEffect').and.callFake((source$) => source$);

    return facade;
  }

  it('doit se créer', () => {
    repoSpy = jasmine.createSpyObj<TransitRepository>('TransitRepository', ['obtenirTransits']);
    const facade = createFacade();
    expect(facade).toBeTruthy();
  });

  it('transits$ doit appeler obtenirTransits au premier abonnement (startWith)', (done) => {
    const facade = createFacade();

    repoSpy.obtenirTransits.and.returnValue(
      of([
        { idSociete: null } as any,
        { idSociete: 'S1' } as any,
      ])
    );

    facade.transits$.pipe(take(1)).subscribe((list) => {
      expect(list.length).toBe(2);

      expect(repoSpy.obtenirTransits).toHaveBeenCalledTimes(1);
      expect(repoSpy.obtenirTransits).toHaveBeenCalledWith({
        inclureTransitsFusionnes: true,
      } as any);

      done();
    });
  });

  it('transitsFiltres$: si isPaie=true => garde idSociete != null', (done) => {
    const facade = createFacade();

    repoSpy.obtenirTransits.and.returnValue(
      of([
        { idSociete: null } as any,
        { idSociete: 'S1' } as any,
        { idSociete: 'S2' } as any,
      ])
    );

    // PAIE => filtre idSociete != null
    isPaie$.next(true);
    isSaci$.next(false);

    facade.transitsFiltres$.pipe(take(1)).subscribe((list) => {
      expect(list.map((x: any) => x.idSociete)).toEqual(['S1', 'S2']);
      done();
    });
  });

  it('transitsFiltres$: si isSaci=true (et pas paie) => garde idSociete == null', (done) => {
    const facade = createFacade();

    repoSpy.obtenirTransits.and.returnValue(
      of([
        { idSociete: null } as any,
        { idSociete: 'S1' } as any,
      ])
    );

    // SACI => filtre idSociete == null
    isPaie$.next(false);
    isSaci$.next(true);

    facade.transitsFiltres$.pipe(take(1)).subscribe((list) => {
      expect(list.map((x: any) => x.idSociete)).toEqual([null]);
      done();
    });
  });

  it('transitsFiltres$: si aucun rôle => retourne la liste complète', (done) => {
    const facade = createFacade();

    repoSpy.obtenirTransits.and.returnValue(
      of([
        { idSociete: null } as any,
        { idSociete: 'S1' } as any,
      ])
    );

    isPaie$.next(false);
    isSaci$.next(false);

    facade.transitsFiltres$.pipe(take(1)).subscribe((list) => {
      expect(list.length).toBe(2);
      done();
    });
  });

  it('refreshTransits() doit déclencher un nouvel appel repository (switchMap)', (done) => {
    const facade = createFacade();

    repoSpy.obtenirTransits.and.returnValue(of([]));

    // 1er abonnement => 1er call (startWith)
    facade.transits$.pipe(take(1)).subscribe(() => {
      expect(repoSpy.obtenirTransits).toHaveBeenCalledTimes(1);

      // refresh => doit provoquer un 2e call
      facade.refreshTransits();

      facade.transits$.pipe(take(1)).subscribe(() => {
        expect(repoSpy.obtenirTransits).toHaveBeenCalledTimes(2);
        done();
      });
    });
  });
});
