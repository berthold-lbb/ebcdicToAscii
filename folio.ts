import { TestBed } from '@angular/core/testing';
import { NgxsModule } from '@ngxs/store';
import { defer, of } from 'rxjs';
import { take } from 'rxjs/operators';

import { AuthContextFacade } from './auth-context.facade';
import { AuthenticationService } from '../services/authentication.service';
import { Role } from '../models/role';

describe('AuthContextFacade', () => {
  let facade: AuthContextFacade;
  let authSpy: jasmine.SpyObj<AuthenticationService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj<AuthenticationService>('AuthenticationService', [
      'hasRole',
      'refresh',
      'load',
    ]);

    TestBed.configureTestingModule({
      imports: [
        // ✅ IMPORTANT : fournit NGXS_OPTIONS / Store / InternalStateOperations etc.
        NgxsModule.forRoot([]),
      ],
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

  it('isPaie$ -> appelle hasRole avec PAIE_FULL', (done) => {
    authSpy.hasRole.and.returnValue(of(true));

    facade.isPaie$.pipe(take(1)).subscribe((value) => {
      expect(value).toBeTrue();
      expect(authSpy.hasRole).toHaveBeenCalledWith(Role.PAIE_FULL);
      done();
    });
  });

  it('isSaci$ -> appelle hasRole avec SACI_FULL', (done) => {
    authSpy.hasRole.and.returnValue(of(false));

    facade.isSaci$.pipe(take(1)).subscribe((value) => {
      expect(value).toBeFalse();
      expect(authSpy.hasRole).toHaveBeenCalledWith(Role.SACI_FULL);
      done();
    });
  });

  it('shareReplay -> 2 abonnements sur isPaie$ ne relancent pas hasRole', (done) => {
    let executions = 0;

    authSpy.hasRole.and.returnValue(
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
