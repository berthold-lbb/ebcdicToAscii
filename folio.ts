import { TestBed } from '@angular/core/testing';
import { of, defer } from 'rxjs';
import { take } from 'rxjs/operators';

import { AuthContextFacade } from './auth-context.facade';
import { AuthenticationService } from '../services/authentication.service';
import { Role } from '../models/role';

describe('AuthContextFacade', () => {
  let facade: AuthContextFacade;
  let authSpy: jasmine.SpyObj<AuthenticationService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['hasRole']
    );

    TestBed.configureTestingModule({
      providers: [
        AuthContextFacade,
        { provide: AuthenticationService, useValue: authSpy },
      ],
    });

    facade = TestBed.inject(AuthContextFacade);
  });

  it('doit être créé', () => {
    expect(facade).toBeTruthy();
  });

  it('isPaie$ doit appeler hasRole avec PAIE_FULL', (done) => {
    authSpy.hasRole.and.returnValue(of(true));

    facade.isPaie$.pipe(take(1)).subscribe((value) => {
      expect(value).toBeTrue();
      expect(authSpy.hasRole).toHaveBeenCalledTimes(1);
      expect(authSpy.hasRole).toHaveBeenCalledWith(
        Role.PAIE_FULL
      );
      done();
    });
  });

  it('isSaci$ doit appeler hasRole avec SACI_FULL', (done) => {
    authSpy.hasRole.and.returnValue(of(false));

    facade.isSaci$.pipe(take(1)).subscribe((value) => {
      expect(value).toBeFalse();
      expect(authSpy.hasRole).toHaveBeenCalledTimes(1);
      expect(authSpy.hasRole).toHaveBeenCalledWith(
        Role.SACI_FULL
      );
      done();
    });
  });

  it('shareReplay: plusieurs abonnements sur isPaie$ ne relancent pas hasRole', (done) => {
    let executions = 0;

    authSpy.hasRole.and.returnValue(
      defer(() => {
        executions++;
        return of(true);
      })
    );

    facade.isPaie$.pipe(take(1)).subscribe((v1) => {
      expect(v1).toBeTrue();

      facade.isPaie$.pipe(take(1)).subscribe((v2) => {
        expect(v2).toBeTrue();
        expect(executions).toBe(1); // 🔥 preuve du cache
        expect(authSpy.hasRole).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });
});
