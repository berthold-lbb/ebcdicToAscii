// auth-context-facade.spec.ts
import { TestBed } from '@angular/core/testing';
import { Subject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';

// ✅ Ajuste ces imports
import { AuthContextFacade } from './auth-context-facade';
import { AuthenticationService } from '../services/authentication.service';
import { Role } from '../models/role';

describe('AuthContextFacade', () => {
  let facade: AuthContextFacade;

  // Spy
  let authSpy: jasmine.SpyObj<AuthenticationService>;

  // Subjects qui simulent les streams renvoyés par auth.hasRole(...)
  let paieSubject: Subject<boolean>;
  let saciSubject: Subject<boolean>;

  // Pour tester le "share" (nombre de souscriptions réelles au source)
  let paieSourceSubscriptions = 0;
  let saciSourceSubscriptions = 0;

  beforeEach(() => {
    paieSubject = new Subject<boolean>();
    saciSubject = new Subject<boolean>();

    authSpy = jasmine.createSpyObj<AuthenticationService>('AuthenticationService', ['hasRole']);

    // 🔥 On renvoie un Observable "cold" qui incrémente un compteur à chaque subscribe.
    // Avec shareReplay(refCount:true), 2 abonnés simultanés doivent donner 1 seule souscription au source.
    const paieCold$: Observable<boolean> = new Observable<boolean>((subscriber) => {
      paieSourceSubscriptions++;
      const sub = paieSubject.subscribe(subscriber);
      return () => sub.unsubscribe();
    });

    const saciCold$: Observable<boolean> = new Observable<boolean>((subscriber) => {
      saciSourceSubscriptions++;
      const sub = saciSubject.subscribe(subscriber);
      return () => sub.unsubscribe();
    });

    // hasRole(...) => selon les rôles reçus, on retourne le flux Paie ou Saci
    authSpy.hasRole.and.callFake((...roles: Role[]) => {
      if (roles.includes(Role.PAIE_FULL)) return paieCold$;
      if (roles.includes(Role.SACI_FULL)) return saciCold$;
      // fallback
      return new Observable<boolean>((sub) => {
        sub.next(false);
        sub.complete();
      });
    });

    TestBed.configureTestingModule({
      providers: [
        AuthContextFacade,
        { provide: AuthenticationService, useValue: authSpy },
      ],
    });

    facade = TestBed.inject(AuthContextFacade);
  });

  it('should create', () => {
    expect(facade).toBeTruthy();
  });

  it('should call auth.hasRole for isPaie$ and isSaci$ with expected roles', () => {
    // IMPORTANT :
    // Dans ton code, comme isPaie$ / isSaci$ sont des champs "readonly" initialisés,
    // hasRole(...) est appelé au moment de l’instanciation du facade.

    // On vérifie que le spy a été appelé avec les rôles attendus.
    // ✅ adapte ici exactement la liste de rôles que tu passes dans le facade.
    expect(authSpy.hasRole).toHaveBeenCalledWith(
      Role.PAIE_FULL,
      Role.PAIE_LECTURE,
      Role.PAIE_SUPPORT
    );

    expect(authSpy.hasRole).toHaveBeenCalledWith(
      Role.SACI_FULL,
      Role.SACI_LECTURE,
      Role.SACI_SUPPORT,
      Role.SUPERVISEUR_SACI
    );
  });

  it('isPaie$ should emit the value returned by auth.hasRole(...)', (done) => {
    facade.isPaie$.pipe(take(1)).subscribe((value) => {
      expect(value).toBeTrue();
      done();
    });

    // On déclenche l'émission
    paieSubject.next(true);
  });

  it('isSaci$ should emit the value returned by auth.hasRole(...)', (done) => {
    facade.isSaci$.pipe(take(1)).subscribe((value) => {
      expect(value).toBeFalse();
      done();
    });

    saciSubject.next(false);
  });

  it('isPaie$ should share the same source subscription between 2 simultaneous subscribers (shareReplay)', () => {
    let v1: boolean | undefined;
    let v2: boolean | undefined;

    const s1 = facade.isPaie$.subscribe((v) => (v1 = v));
    const s2 = facade.isPaie$.subscribe((v) => (v2 = v));

    // Les 2 abonnements sont actifs => shareReplay doit faire 1 seule souscription au source
    expect(paieSourceSubscriptions).toBe(1);

    // On émet
    paieSubject.next(true);

    expect(v1).toBeTrue();
    expect(v2).toBeTrue();

    s1.unsubscribe();
    s2.unsubscribe();
  });

  it('isSaci$ should share the same source subscription between 2 simultaneous subscribers (shareReplay)', () => {
    let v1: boolean | undefined;
    let v2: boolean | undefined;

    const s1 = facade.isSaci$.subscribe((v) => (v1 = v));
    const s2 = facade.isSaci$.subscribe((v) => (v2 = v));

    expect(saciSourceSubscriptions).toBe(1);

    saciSubject.next(false);

    expect(v1).toBeFalse();
    expect(v2).toBeFalse();

    s1.unsubscribe();
    s2.unsubscribe();
  });
});
