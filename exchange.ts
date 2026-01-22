import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorMapper } from './api-error-mapper';

import type { ProblemeRest } from '../api/models/probleme-rest';
import type { ErreurRest } from '../api/models/erreur-rest';

describe('ApiErrorMapper', () => {
  let mapper: ApiErrorMapper;

  beforeEach(() => {
    mapper = new ApiErrorMapper();
  });

  it('CLIENT: map() doit mapper une erreur non HTTP', () => {
    const err = new Error('boom');
    const out = mapper.map(err);

    expect(out.source).toBe('CLIENT');
    expect(out.kind).toBe('UNKNOWN');
    expect(out.message).toBe('boom');
    expect(out.messages).toEqual(['boom']);
    expect(out.original).toBe(err);
  });

  it('NETWORK: map() doit mapper status=0', () => {
    const httpErr = new HttpErrorResponse({
      status: 0,
      statusText: 'Unknown Error',
      url: '/api/test',
    });

    const out = mapper.map(httpErr);

    expect(out.source).toBe('NETWORK');
    expect(out.kind).toBe('UNKNOWN');
    expect(out.httpStatus).toBe(0);
    expect(out.endpoint).toBe('/api/test');
    expect(out.messages).toEqual(['Impossible de joindre le serveur.']);
  });

  it('HTTP+ProblemeRest: doit parser "403 FORBIDDEN" => 403 + kind FORBIDDEN', () => {
    const errors: ErreurRest[] = [
      {
        type: 'S',
        code: 123,
        message: '  Accès refusé  ',
        detail: 'Accès refusé',
        exception: 'Accès refusé',
        url: '/api/secure',
        systemId: 'SYS1',
        systemName: 'System 1',
        time: '2026-01-01T00:00:00',
      },
    ];

    const body: ProblemeRest = {
      status: 'FORBIDDEN',
      httpStatus: '403 FORBIDDEN',
      errors,
    };

    const httpErr = new HttpErrorResponse({
      status: 403,
      statusText: 'Forbidden',
      url: '/api/secure',
      error: body,
    });

    const out = mapper.map(httpErr);

    expect(out.source).toBe('HTTP');
    expect(out.httpStatusKey).toBe('403 FORBIDDEN');
    expect(out.httpStatus).toBe(403);          // ✅ parse string -> number
    expect(out.kind).toBe('FORBIDDEN');        // ✅ priorité HTTP
    expect(out.endpoint).toBe('/api/secure');

    expect(out.message).toBe('Accès refusé');  // ✅ trim + dedup
    expect(out.messages).toEqual(['Accès refusé']);

    expect(out.code).toBe(123);
    expect(out.errorType).toBe('S');
    expect(out.systemId).toBe('SYS1');
    expect(out.systemName).toBe('System 1');
    expect(out.time).toBe('2026-01-01T00:00:00');

    expect(out.problemeRest).toBe(body);
    expect(out.errors).toBe(errors);
  });

  it('HTTP+ProblemeRest: si httpStatus invalide, fallback sur err.status', () => {
    const body: ProblemeRest = {
      status: 'NOT_FOUND',
      httpStatus: 'XYZ',
      errors: [{ message: 'Introuvable', url: '/api/x' }],
    };

    const httpErr = new HttpErrorResponse({
      status: 404,
      statusText: 'Not Found',
      url: '/api/x',
      error: body,
    });

    const out = mapper.map(httpErr);

    expect(out.httpStatus).toBe(404);      // ✅ fallback
    expect(out.kind).toBe('NOT_FOUND');    // ✅ via HTTP
    expect(out.message).toBe('Introuvable');
  });

  it('HTTP sans ProblemeRest: kind via status', () => {
    const httpErr = new HttpErrorResponse({
      status: 500,
      statusText: 'Server Error',
      url: '/api/y',
      error: 'plain text',
    });

    const out = mapper.map(httpErr);

    expect(out.source).toBe('HTTP');
    expect(out.httpStatus).toBe(500);
    expect(out.kind).toBe('SERVER');
    expect(out.endpoint).toBe('/api/y');
    expect(out.messages.length).toBe(1);
  });

  it('collectMessages: trim + ignore empty + dedup', () => {
    const fn = (mapper as any).collectMessages.bind(mapper) as (e: ErreurRest[]) => string[];

    const out = fn([
      { message: ' A ' },
      { detail: 'A' },
      { exception: '   ' },
      { message: 'B' },
      { detail: '' },
    ]);

    expect(out).toEqual(['A', 'B']);
  });

  it('parseHttpStatus: doit parser "403 FORBIDDEN"', () => {
    const fn = (mapper as any).parseHttpStatus.bind(mapper) as (s?: string) => number | undefined;

    expect(fn('403 FORBIDDEN')).toBe(403);
    expect(fn('  404 NOT_FOUND')).toBe(404);
    expect(fn('XYZ')).toBeUndefined();
    expect(fn(undefined)).toBeUndefined();
  });

  it('isProblemeRest: doit valider (httpStatus string + errors array)', () => {
    const fn = (mapper as any).isProblemeRest.bind(mapper) as (x: any) => boolean;

    expect(fn({ httpStatus: '400 BAD_REQUEST', errors: [] })).toBeTrue();
    expect(fn({ status: 'X', errors: [] })).toBeFalse();
    expect(fn(null)).toBeFalse();
  });
});



import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

// ✅ tes modèles (ng-openapi-gen)
import type { ProblemeRest } from '../api/models/probleme-rest';
import type { ErreurRest } from '../api/models/erreur-rest';

// ✅ ton modèle front
import type { AppError, AppErrorKind } from '../models/app-error';

@Injectable({ providedIn: 'root' })
export class ApiErrorMapper {

  map(err: unknown): AppError {
    // -------------------------
    // HTTP errors
    // -------------------------
    if (err instanceof HttpErrorResponse) {

      // Réseau / CORS / offline
      if (err.status === 0) {
        return {
          source: 'NETWORK',
          kind: 'UNKNOWN',
          httpStatus: 0,
          message: 'Impossible de joindre le serveur.',
          messages: ['Impossible de joindre le serveur.'],
          endpoint: err.url ?? undefined,
          original: err,
        };
      }

      const body = err.error as unknown;

      // Backend a renvoyé un ProblemeRest
      if (this.isProblemeRest(body)) {
        const httpStatus = this.parseHttpStatus(body.httpStatus) ?? err.status;
        const errors = body.errors ?? [];

        const messages = this.collectMessages(errors);
        const message = messages[0] ?? 'Une erreur est survenue.';

        const first = errors[0];
        const endpoint = first?.url ?? err.url ?? undefined;

        // ✅ règle ta confusion : on priorise d'abord HTTP (401/403/404/5xx),
        // ensuite on utilise le type backend (B/S/V/R) si le statut ne dit pas déjà quoi faire.
        const kind = this.kindFromBackendOrHttp(first?.type, httpStatus);

        return {
          source: 'HTTP',
          kind,
          httpStatus,
          httpStatusKey: body.httpStatus,
          status: body.status,
          message,
          messages,

          code: first?.code,
          errorType: first?.type,
          endpoint,
          systemId: first?.systemId,
          systemName: first?.systemName,
          time: first?.time,

          problemeRest: body,
          errors: errors,
          original: err,
        };
      }

      // HTTP sans ProblemeRest (texte, blob, etc.)
      const msg = (err.message || '').trim() || 'Erreur HTTP.';
      return {
        source: 'HTTP',
        kind: this.kindFromHttpStatus(err.status),
        httpStatus: err.status,
        message: msg,
        messages: [msg],
        endpoint: err.url ?? undefined,
        original: err,
      };
    }

    // -------------------------
    // Non-HTTP (client)
    // -------------------------
    const msg =
      err instanceof Error && err.message
        ? err.message
        : 'Erreur inconnue (client).';

    return {
      source: 'CLIENT',
      kind: 'UNKNOWN',
      message: msg,
      messages: [msg],
      original: err,
    };
  }

  // ---------------------------------------
  // Guards / utils (privés)
  // ---------------------------------------

  private isProblemeRest(x: any): x is ProblemeRest {
    // D'après tes screens : httpStatus?: string, errors?: ErreurRest[]
    return !!(
      x &&
      typeof x === 'object' &&
      typeof x.httpStatus === 'string' &&
      Array.isArray(x.errors)
    );
  }

  /**
   * Ex: "403 FORBIDDEN" -> 403
   */
  private parseHttpStatus(httpStatus?: string): number | undefined {
    if (!httpStatus) return undefined;
    const m = String(httpStatus).match(/^\s*(\d{3})\b/);
    return m ? Number(m[1]) : undefined;
  }

  /**
   * Ordre: message -> detail -> exception
   * + trim + remove empty + dedup
   */
  private collectMessages(errors: ErreurRest[]): string[] {
    const out: string[] = [];

    for (const e of errors) {
      if (e?.message) out.push(e.message);
      if (e?.detail) out.push(e.detail);
      if (e?.exception) out.push(e.exception);
    }

    const cleaned = out
      .map((s) => (s ?? '').trim())
      .filter((s): s is string => !!s);

    return Array.from(new Set(cleaned));
  }

  private kindFromBackendOrHttp(
    t: 'B' | 'S' | 'V' | 'R' | undefined,
    httpStatus: number
  ): AppErrorKind {
    // Priorité "UX / sécurité"
    if (httpStatus === 401) return 'UNAUTHORIZED';
    if (httpStatus === 403) return 'FORBIDDEN';
    if (httpStatus === 404) return 'NOT_FOUND';
    if (httpStatus >= 500) return 'SERVER';

    // Sinon, backend type si fourni
    if (t === 'V') return 'VALIDATION';
    if (t === 'B') return 'BUSINESS';
    if (t === 'S') return 'SYSTEM';
    if (t === 'R') return 'RELEVE';

    // fallback
    return 'UNKNOWN';
  }

  private kindFromHttpStatus(status: number): AppErrorKind {
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status >= 500) return 'SERVER';
    return 'UNKNOWN';
  }
}


export function normalizeRole(raw?: string | null): string {
  if (!raw) return '';

  // 1) normaliser en underscores
  let s = raw.trim().toUpperCase();

  // remplace espaces/tirets par underscore (regex simple, safe)
  s = s.replace(/[\s-]+/g, '_');

  // collapse underscores multiples (regex simple, safe)
  s = s.replace(/_+/g, '_');

  // 2) trim "_" au début/fin sans regex
  let start = 0;
  let end = s.length;

  while (start < end && s[start] === '_') start++;
  while (end > start && s[end - 1] === '_') end--;

  return s.slice(start, end);
}

export function normalizeRole(raw?: string | null): string {
  if (!raw) return '';

  let s = raw.trim().toUpperCase();

  // remplacer les séparateurs courants par _
  s = s.replaceAll(' ', '_').replaceAll('-', '_');

  // collapse underscores multiples (sans regex)
  while (s.includes('__')) s = s.replaceAll('__', '_');

  // trim underscore sans regex
  while (s.startsWith('_')) s = s.slice(1);
  while (s.endsWith('_')) s = s.slice(0, -1);

  return s;
}


import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Overlay } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';
import { Store } from '@ngxs/store';
import { TranslateService } from '@ngx-translate/core';

import { AppComponent } from './app.component';

class TranslatePipeMock {
  transform(value: any): any {
    return value;
  }
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;

  // Router
  let routerEvents$: Subject<any>;
  let routerMock: jasmine.SpyObj<Router>;

  // Store (NGXS)
  let activeCalls$: Subject<number>;
  let storeMock: jasmine.SpyObj<Store>;

  // Overlay
  let overlayMock: jasmine.SpyObj<Overlay>;
  let overlayRefMock: any;
  let positionStrategyBuilderMock: any;
  let globalPositionStrategyMock: any;

  // TranslateService
  let translateMock: jasmine.SpyObj<TranslateService>;

  beforeEach(async () => {
    // Router mock
    routerEvents$ = new Subject<any>();
    routerMock = jasmine.createSpyObj<Router>('Router', ['navigate'], {
      url: '/conciliation',
      events: routerEvents$.asObservable(),
    } as any);

    // Store mock (✅ IMPORTANT: Subject pilotable)
    activeCalls$ = new Subject<number>();
    storeMock = jasmine.createSpyObj<Store>('Store', ['select', 'dispatch']);
    storeMock.select.and.returnValue(activeCalls$.asObservable());

    // Overlay mocks
    overlayRefMock = jasmine.createSpyObj('OverlayRef', ['attach', 'dispose']);

    globalPositionStrategyMock = jasmine.createSpyObj('GlobalPositionStrategy', ['left', 'top']);
    globalPositionStrategyMock.left.and.returnValue(globalPositionStrategyMock);
    globalPositionStrategyMock.top.and.returnValue(globalPositionStrategyMock);

    positionStrategyBuilderMock = jasmine.createSpyObj('OverlayPositionBuilder', ['global']);
    positionStrategyBuilderMock.global.and.returnValue(globalPositionStrategyMock);

    overlayMock = jasmine.createSpyObj<Overlay>('Overlay', ['create'], {
      position: positionStrategyBuilderMock,
    } as any);
    overlayMock.create.and.returnValue(overlayRefMock);

    // TranslateService mock
    translateMock = jasmine.createSpyObj<TranslateService>(
      'TranslateService',
      ['setTranslation', 'setDefaultLang', 'use', 'instant', 'get']
    );
    translateMock.get.and.returnValue({}); // si tu as un get()
    translateMock.instant.and.callFake((k: string) => k);

    await TestBed.configureTestingModule({
      declarations: [AppComponent, TranslatePipeMock],
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: Store, useValue: storeMock },
        { provide: Overlay, useValue: overlayMock },
        { provide: TranslateService, useValue: translateMock },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  afterEach(() => {
    routerEvents$.complete();
    activeCalls$.complete();
    // optionnel: si ton compos modifie document.body.className
    document.body.className = '';
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // déclenche constructor + ngOnInit
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('should set default lang and translation in constructor', () => {
    createComponent();
    expect(translateMock.setDefaultLang).toHaveBeenCalled();
    expect(translateMock.setTranslation).toHaveBeenCalled();
  });

  it('should subscribe to router NavigationEnd and call syncPanelFromUrl()', fakeAsync(() => {
    // ✅ espionne la méthode
    const spy = spyOn(component as any, 'syncPanelFromUrl').and.callThrough();

    createComponent();

    routerEvents$.next(new NavigationEnd(1, '/conciliation', '/conciliation'));
    tick();

    expect(spy).toHaveBeenCalled();
  }));

  // =========================
  // ✅ Tests Spinner (branches)
  // =========================

  it('should call openSpinner when activeCalls != 0', fakeAsync(() => {
    createComponent();

    // si openSpinner existe chez toi, on spy
    const openSpy = (component as any).openSpinner
      ? spyOn(component as any, 'openSpinner').and.callThrough()
      : null;

    activeCalls$.next(2);
    tick();

    // Deux façons de valider selon ton implémentation :
    // 1) openSpinner() appelée
    if (openSpy) {
      expect(openSpy).toHaveBeenCalled();
    }

    // 2) ou overlay.create/attach appelé (ou les deux)
    expect(overlayMock.create).toHaveBeenCalled();
    expect(overlayRefMock.attach).toHaveBeenCalled();
  }));

  it('should call closeSpinner when activeCalls == 0 after having opened', fakeAsync(() => {
    createComponent();

    const closeSpy = (component as any).closeSpinner
      ? spyOn(component as any, 'closeSpinner').and.callThrough()
      : null;

    // 1) ouvre
    activeCalls$.next(1);
    tick();
    expect(overlayRefMock.attach).toHaveBeenCalled();

    // 2) ferme
    activeCalls$.next(0);
    tick();

    if (closeSpy) {
      expect(closeSpy).toHaveBeenCalled();
    }

    // en général closeSpinner -> overlayRef.dispose
    expect(overlayRefMock.dispose).toHaveBeenCalled();
  }));

  it('should not crash if openSpinner/closeSpinner do not exist', fakeAsync(() => {
    // Ce test te protège si ces méthodes n’existent pas dans certains écrans
    createComponent();

    activeCalls$.next(1);
    activeCalls$.next(0);
    tick();

    expect(true).toBeTrue();
  }));
});
