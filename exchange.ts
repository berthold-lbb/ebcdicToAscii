import { TestBed } from '@angular/core/testing';
import { Router, NavigationEnd, Event } from '@angular/router';
import { Subject, of } from 'rxjs';
import { Overlay, OverlayConfig, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';

import { AppComponent } from './app.component';
import { NotificationsService } from '../core/services/notifications.service'; // adapte
import { LoggerService } from '../core/services/logger.service'; // adapte

describe('AppComponent', () => {
  let component: AppComponent;

  // Router mock
  let routerEvents$: Subject<Event>;
  let routerMock: jasmine.SpyObj<Router>;

  // Translate mock
  let translateMock: jasmine.SpyObj<TranslateService>;

  // Overlay mocks
  let overlayMock: jasmine.SpyObj<Overlay>;
  let overlayRefMock: jasmine.SpyObj<OverlayRef>;
  let positionBuilderMock: any;
  let globalPositionStrategyMock: any;

  // Store mock
  let storeMock: jasmine.SpyObj<Store>;

  beforeEach(async () => {
    routerEvents$ = new Subject<Event>();

    routerMock = jasmine.createSpyObj<Router>('Router', ['navigate'], {
      events: routerEvents$.asObservable(),
      url: '/conciliation',
    });

    translateMock = jasmine.createSpyObj<TranslateService>('TranslateService', [
      'setTranslation',
      'setDefaultLang',
    ]);

    // Overlay positioning chain mock: overlay.position().global().left().top()
    globalPositionStrategyMock = {
      left: jasmine.createSpy('left').and.returnValue(globalPositionStrategyMock),
      top: jasmine.createSpy('top').and.returnValue(globalPositionStrategyMock),
    };
    positionBuilderMock = {
      global: jasmine.createSpy('global').and.returnValue(globalPositionStrategyMock),
    };

    overlayRefMock = jasmine.createSpyObj<OverlayRef>('OverlayRef', ['attach', 'dispose']);

    overlayMock = jasmine.createSpyObj<Overlay>('Overlay', ['create', 'position']);
    overlayMock.position.and.returnValue(positionBuilderMock);
    overlayMock.create.and.returnValue(overlayRefMock);

    storeMock = jasmine.createSpyObj<Store>('Store', ['select', 'dispatch']);
    // ngOnInit: spinner$ = store.select(...)
    storeMock.select.and.returnValue(of(0));

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: TranslateService, useValue: translateMock },
        { provide: Overlay, useValue: overlayMock },
        { provide: Store, useValue: storeMock },
        { provide: NotificationsService, useValue: {} },
        { provide: LoggerService, useValue: {} },
      ],
    }).compileComponents();

    document.body.className = '';
  });

  afterEach(() => {
    routerEvents$.complete();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('should set default lang to fr-CA', () => {
    createComponent();
    expect(translateMock.setDefaultLang).toHaveBeenCalledWith('fr-CA');
  });

  it('should call syncPanelFromUrl on NavigationEnd and once initially', () => {
    createComponent();
    const spy = spyOn<any>(component, 'syncPanelFromUrl').and.callThrough();

    // Le constructor appelle déjà syncPanelFromUrl() une fois
    expect(spy).toHaveBeenCalledTimes(1);

    routerEvents$.next(new NavigationEnd(1, '/rapports', '/rapports'));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  describe('syncPanelFromUrl()', () => {
    it('should set activePanel from first segment if matches tabs', () => {
      createComponent();
      Object.defineProperty(routerMock, 'url', { value: '/rapports/details', configurable: true });

      (component as any).syncPanelFromUrl();
      expect((component as any).activePanel).toBe('rapports');
    });

    it('should fallback to conciliation if unknown segment', () => {
      createComponent();
      Object.defineProperty(routerMock, 'url', { value: '/unknown', configurable: true });

      (component as any).syncPanelFromUrl();
      expect((component as any).activePanel).toBe('conciliation');
    });

    it('should ignore query params', () => {
      createComponent();
      Object.defineProperty(routerMock, 'url', { value: '/recherche?x=1', configurable: true });

      (component as any).syncPanelFromUrl();
      expect((component as any).activePanel).toBe('recherche');
    });
  });

  describe('ngOnInit spinner subscription', () => {
    it('should set window title', () => {
      createComponent();
      expect(window.document.title).toBe('La vue de conciliation');
    });

    it('should close spinner and set isInitialised=true when activeCalls becomes 0 (first emission)', () => {
      // on force store.select => 0
      storeMock.select.and.returnValue(of(0));
      createComponent();

      const closeSpy = spyOn(component, 'closeSpinner').and.callThrough();
      const openSpy = spyOn(component, 'openSpinner').and.callThrough();

      component.ngOnInit();

      // emission 0 => else branch => closeSpinner() + isInitialised=true
      expect(openSpy).not.toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
      expect((component as any).isInitialised).toBeTrue();
    });

    it('should open spinner when activeCalls != 0 and isInitialised=true', () => {
      // on simule : 0 puis 2
      const stream$ = new Subject<number>();
      storeMock.select.and.returnValue(stream$.asObservable());
      createComponent();

      const openSpy = spyOn(component, 'openSpinner').and.callThrough();
      const closeSpy = spyOn(component, 'closeSpinner').and.callThrough();

      component.ngOnInit();

      // 1ère emission: 0 => close + initialised true
      stream$.next(0);
      expect(closeSpy).toHaveBeenCalled();
      expect((component as any).isInitialised).toBeTrue();

      // 2e emission: 2 => open
      stream$.next(2);
      expect(openSpy).toHaveBeenCalled();
    });
  });

  describe('openSpinner/createOverlay/closeSpinner', () => {
    it('openSpinner should call createOverlay if spinner is not open', () => {
      createComponent();
      (component as any).isSpinnerOpen = false;

      const spy = spyOn(component, 'createOverlay').and.callThrough();
      component.openSpinner();

      expect(spy).toHaveBeenCalled();
    });

    it('openSpinner should not call createOverlay if spinner already open', () => {
      createComponent();
      (component as any).isSpinnerOpen = true;

      const spy = spyOn(component, 'createOverlay').and.callThrough();
      component.openSpinner();

      expect(spy).not.toHaveBeenCalled();
    });

    it('createOverlay should create overlay, attach portal and set isSpinnerOpen=true', () => {
      createComponent();

      component.createOverlay();

      expect(overlayMock.position).toHaveBeenCalled();
      expect(positionBuilderMock.global).toHaveBeenCalled();
      expect(globalPositionStrategyMock.left).toHaveBeenCalled();
      expect(globalPositionStrategyMock.top).toHaveBeenCalled();

      expect(overlayMock.create).toHaveBeenCalled();
      expect(overlayRefMock.attach).toHaveBeenCalled();
      expect((component as any).isSpinnerOpen).toBeTrue();
    });

    it('closeSpinner should dispose overlay and set isSpinnerOpen=false if open', () => {
      createComponent();

      // on simule qu’il est déjà open avec un overlayRef
      (component as any).overlayRef = overlayRefMock;
      (component as any).isSpinnerOpen = true;

      component.closeSpinner();

      expect(overlayRefMock.dispose).toHaveBeenCalled();
      expect((component as any).isSpinnerOpen).toBeFalse();
    });

    it('closeSpinner should do nothing if spinner is not open', () => {
      createComponent();
      (component as any).isSpinnerOpen = false;

      component.closeSpinner();
      expect(overlayRefMock.dispose).not.toHaveBeenCalled();
    });
  });

  describe('tabs', () => {
    it('isActive should return true when activePanel equals key', () => {
      createComponent();
      (component as any).activePanel = 'rapports';

      expect(component.isActive('rapports' as any)).toBeTrue();
      expect(component.isActive('conciliation' as any)).toBeFalse();
    });

    it('onTabsChange should navigate to correct tab key (using activeItemIndex)', () => {
      createComponent();

      // Exemple: index 2 => tabs[2].key = 'rapports' (selon ton tableau)
      component.onTabsChange({ detail: { activeItemIndex: 2 } });

      expect(routerMock.navigate).toHaveBeenCalledWith(['/', 'rapports']);
    });

    it('onTabsChange should default to index 0 when evt is undefined', () => {
      createComponent();

      component.onTabsChange(undefined as any);

      // index=0 => 'conciliation'
      expect(routerMock.navigate).toHaveBeenCalledWith(['/', 'conciliation']);
    });
  });
});
