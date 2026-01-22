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
