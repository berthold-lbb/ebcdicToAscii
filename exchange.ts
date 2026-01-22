import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { of, Subject } from 'rxjs';

import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

import {
  TranslateLoader,
  TranslateModule,
  TranslateService,
  TranslateStore,
} from '@ngx-translate/core';

import { HttpClientTestingModule } from '@angular/common/http/testing';

import { Store } from '@ngxs/store';

// ⚠️ adapte le chemin selon ton projet
import { AppComponent } from './app.component';

// Si tu as un vrai composant Spinner utilisé par ComponentPortal(Spinner)
import { Spinner } from './shared/components/spinner/spinner'; // <-- adapte

// ---- Fake loader ngx-translate (évite HttpClient + fichiers i18n) ----
class FakeTranslateLoader implements TranslateLoader {
  getTranslation(_lang: string) {
    return of({}); // aucune traduction nécessaire pour ces tests
  }
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;

  // Router mock
  const routerMock = jasmine.createSpyObj<Router>('Router', ['navigate'], {
    url: '/conciliation',
  });

  // Store mock
  const storeMock = jasmine.createSpyObj<Store>('Store', ['select', 'dispatch']);

  // Overlay mock (avec chain overlay.position().global().left().top())
  const overlayRefMock = jasmine.createSpyObj('OverlayRef', ['attach', 'dispose']);

  const globalPositionStrategyMock = jasmine.createSpyObj('GlobalPositionStrategy', [
    'left',
    'top',
  ]);
  globalPositionStrategyMock.left.and.returnValue(globalPositionStrategyMock);
  globalPositionStrategyMock.top.and.returnValue(globalPositionStrategyMock);

  const positionStrategyBuilderMock = jasmine.createSpyObj('OverlayPositionBuilder', [
    'global',
  ]);
  positionStrategyBuilderMock.global.and.returnValue(globalPositionStrategyMock);

  const overlayMock = jasmine.createSpyObj<Overlay>('Overlay', ['create', 'position']);
  overlayMock.position.and.returnValue(positionStrategyBuilderMock as any);
  overlayMock.create.and.returnValue(overlayRefMock as any);

  // TranslateStore mock (clé pour enlever "No provider for TranslateStore")
  const translateStoreMock = {
    onTranslationChange: new Subject<any>(),
    onLangChange: new Subject<any>(),
    onDefaultLangChange: new Subject<any>(),
    translations: {},
  };

  beforeEach(async () => {
    // select() doit renvoyer un Observable<number> pour ton spinner$
    storeMock.select.and.returnValue(of(0));

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        HttpClientTestingModule,

        // ✅ IMPORTANT : on utilise TranslateModule (pas de MockTranslatePipe)
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: FakeTranslateLoader },
        }),
      ],
      declarations: [
        AppComponent,
        // ⚠️ N'ajoute pas TranslatePipe / MockTranslatePipe ici
        // Si AppComponent référence Spinner via ComponentPortal, le déclarer aide parfois :
        Spinner,
      ],
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: Store, useValue: storeMock },
        { provide: Overlay, useValue: overlayMock },

        // ✅ Clé : TranslateStore doit exister si TranslateService existe
        { provide: TranslateStore, useValue: translateStoreMock },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA], // ✅ pour <app-header> ou web components
    }).compileComponents();

    // nettoyer le body si overlay/backdrop laisse des traces
    document.body.className = '';
  });

  function createComponent() {
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;

    // Optionnel : si ton ngOnInit fait setDefaultLang / use()
    const translate = TestBed.inject(TranslateService);
    spyOn(translate, 'setDefaultLang').and.callThrough();
    spyOn(translate, 'use').and.callThrough();

    fixture.detectChanges(); // déclenche ngOnInit
    return { translate };
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('should set window title', () => {
    createComponent();
    expect(window.document.title).toBe('La vue de conciliation');
  });

  it('should open spinner when activeCalls != 0 and initialized', () => {
    createComponent();

    // Simule "déjà initialisé"
    (component as any).isInitialised = true;

    // activeCalls != 0
    (component as any).openSpinner(); // ou si tu testes via subscription, pousse la valeur via storeMock.select

    expect(overlayMock.create).toHaveBeenCalled();
    expect(overlayRefMock.attach).toHaveBeenCalled();
  });

  it('should close spinner when open', () => {
    createComponent();

    // ouvre une fois
    (component as any).openSpinner();
    // ferme
    (component as any).closeSpinner();

    expect(overlayRefMock.dispose).toHaveBeenCalled();
  });

  it('onTabsChange should navigate to selected key', () => {
    createComponent();

    // Adapte selon tes tabs (idx->key)
    (component as any).tabs = [
      { key: 'conciliation' },
      { key: 'recherche' },
      { key: 'rapports' },
    ];

    (component as any).onTabsChange({ detail: { activeItemIndex: 1 } });
    expect(routerMock.navigate).toHaveBeenCalledWith(['/', 'recherche']);
  });
});
