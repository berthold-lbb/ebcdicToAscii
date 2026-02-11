AuthContextFacadeimport { TestBed } from '@angular/core/testing';
import { NgxsModule } from '@ngxs/store';
import { defer, of, Observable } from 'rxjs';
import { take } from 'rxjs/operators';

import { AuthContextFacade } from './auth-context.facade';
import { AuthenticationService } from '../services/authentication.service';
import { Role } from '../models/role';

describe('AuthContextFacade', () => {
  let authSpy: jasmine.SpyObj<AuthenticationService>;

  /**
   * IMPORTANT:
   * - On configure authSpy.hasRole() AVANT d'injecter la façade
   * - On reset le TestBed pour permettre des retours différents selon le test
   */
  function createFacade(hasRoleResult$: Observable<boolean>): AuthContextFacade {
    TestBed.resetTestingModule();

    authSpy = jasmine.createSpyObj<AuthenticationService>('AuthenticationService', [
      'hasRole',
      'load',
      'refresh',
    ]);

    // ✅ CRITIQUE : returnValue défini AVANT l'injection de la façade
    authSpy.hasRole.and.returnValue(hasRoleResult$);

    TestBed.configureTestingModule({
      imports: [
        // ✅ évite NGXS_OPTIONS / Store manquant si BaseFacade utilise NGXS
        NgxsModule.forRoot([]),
      ],
      providers: [
        AuthContextFacade,
        { provide: AuthenticationService, useValue: authSpy },
      ],
    });

    return TestBed.inject(AuthContextFacade);
  }

  it('doit se créer', () => {
    const facade = createFacade(of(false));
    expect(facade).toBeTruthy();
  });

  it('isPaie$ appelle hasRole avec PAIE_FULL', (done) => {
    const facade = createFacade(of(true));

    facade.isPaie$.pipe(take(1)).subscribe((value) => {
      expect(value).toBeTrue();
      expect(authSpy.hasRole).toHaveBeenCalledWith(Role.PAIE_FULL);
      done();
    });
  });

  it('isSaci$ appelle hasRole avec SACI_FULL', (done) => {
    const facade = createFacade(of(false));

    facade.isSaci$.pipe(take(1)).subscribe((value) => {
      expect(value).toBeFalse();
      expect(authSpy.hasRole).toHaveBeenCalledWith(Role.SACI_FULL);
      done();
    });
  });

  it('shareReplay : 2 abonnements sur isPaie$ ne relancent pas hasRole', (done) => {
    let executions = 0;

    const facade = createFacade(
      defer(() => {
        executions++;
        return of(true);
      })
    );

    facade.isPaie$.pipe(take(1)).subscribe(() => {
      facade.isPaie$.pipe(take(1)).subscribe(() => {
        expect(executions).toBe(1);
        expect(authSpy.hasRole).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });
});
