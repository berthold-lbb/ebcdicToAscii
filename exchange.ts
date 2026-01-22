import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';

// ✅ adapte le chemin
import { BaseComponent } from './base.component';
import { NotificationsService } from '../core/services/notification.service';
import { LoggerService } from '../core/services/logger.service';

class TestHostComponent extends BaseComponent {
  constructor(
    notificationService: NotificationsService,
    loggerService: LoggerService
  ) {
    super(notificationService, loggerService);
  }

  // expose les protected pour tester
  public callRetour(): void {
    this.retourPagePrecedente();
  }

  public getUnsubscribe$(): Subject<void> {
    return this.unsubscribe$;
  }
}

describe('BaseComponent (simplifié)', () => {
  let locationMock: jasmine.SpyObj<Location>;
  let notificationServiceMock: jasmine.SpyObj<NotificationsService>;
  let loggerServiceMock: jasmine.SpyObj<LoggerService>;

  const createSut = (): TestHostComponent =>
    TestBed.runInInjectionContext(
      () => new TestHostComponent(notificationServiceMock, loggerServiceMock)
    );

  beforeEach(() => {
    locationMock = jasmine.createSpyObj<Location>('Location', ['back']);
    notificationServiceMock = jasmine.createSpyObj<NotificationsService>(
      'NotificationsService',
      []
    );
    loggerServiceMock = jasmine.createSpyObj<LoggerService>(
      'LoggerService',
      []
    );

    TestBed.configureTestingModule({
      providers: [
        { provide: Location, useValue: locationMock },
        { provide: NotificationsService, useValue: notificationServiceMock },
        { provide: LoggerService, useValue: loggerServiceMock },
      ],
    });
  });

  it('retourPagePrecedente() doit appeler Location.back()', () => {
    const sut = createSut();

    sut.callRetour();

    expect(locationMock.back).toHaveBeenCalledTimes(1);
  });

  it('ngOnDestroy() doit next() puis complete() unsubscribe$', () => {
    const sut = createSut();
    const unsub$ = sut.getUnsubscribe$();

    const nextSpy = spyOn(unsub$, 'next').and.callThrough();
    const completeSpy = spyOn(unsub$, 'complete').and.callThrough();

    sut.ngOnDestroy();

    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(completeSpy).toHaveBeenCalledTimes(1);
  });

  it("ngOnDestroy() ne doit pas throw (même si on l'appelle 2 fois)", () => {
    const sut = createSut();

    expect(() => {
      sut.ngOnDestroy();
      sut.ngOnDestroy();
    }).not.toThrow();
  });
});
