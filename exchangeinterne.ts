import { HttpErrorResponse } from '@angular/common/http';
import { from, Observable, throwError } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

function isBlob(x: unknown): x is Blob {
  return typeof Blob !== 'undefined' && x instanceof Blob;
}

function isJsonBlob(b: Blob): boolean {
  const t = (b.type || '').toLowerCase();
  return t.includes('application/json') || t.includes('application/problem+json');
}

/**
 * Si err.error est un Blob JSON, on le parse et on re-crée un HttpErrorResponse
 * où error = objet (ProblemeRest)
 */
export function normalizeHttpError(err: unknown): Observable<never> {
  if (!(err instanceof HttpErrorResponse)) {
    return throwError(() => err);
  }

  const payload = err.error;

  // cas "download" => Blob mais en fait JSON d'erreur
  if (isBlob(payload) && isJsonBlob(payload)) {
    return from(payload.text()).pipe(
      mergeMap((txt) => {
        try {
          const parsed = JSON.parse(txt);

          const normalized = new HttpErrorResponse({
            error: parsed,
            headers: err.headers,
            status: err.status,
            statusText: err.statusText,
            url: err.url ?? undefined,
          });

          return throwError(() => normalized);
        } catch {
          return throwError(() => err);
        }
      })
    );
  }

  // sinon on rethrow tel quel
  return throwError(() => err);
}


catchError → normalize → map → throw AppError
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiErrorMapper } from './api-error-mapper';
import { normalizeHttpError } from '../http/http-error-normalizer';

export function appErrorify(mapper: ApiErrorMapper) {
  return <T>(source$: Observable<T>): Observable<T> =>
    source$.pipe(
      catchError((err) =>
        normalizeHttpError(err).pipe(
          catchError((normalizedErr) => {
            const appErr = mapper.map(normalizedErr);
            return throwError(() => appErr);
          })
        )
      )
    );
}


import { inject, Injectable } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { ApiErrorMapper } from 'src/app/core/errors/api-error-mapper';
import { normalizeHttpError } from 'src/app/core/http/http-error-normalizer';

@Injectable({ providedIn: 'root' })
export class ConciliationRepository {
  private readonly errorMapper = inject(ApiErrorMapper);
  private readonly api = inject(ConciliationApi); // ng-openapi

  obtenirExtractionCourrielFinAnnee$(params: ExtractionCourrielFinAnneeParams) {
    return this.api.extractionCourrielFinAnnee$Response(params).pipe(
      catchError((err) =>
        normalizeHttpError(err).pipe(
          catchError((normalizedErr) => {
            const appErr = this.errorMapper.map(normalizedErr);
            return throwError(() => appErr);
          })
        )
      )
    );
  }
}



private isProblemeRest(x: any): x is ProblemeRest {
  if (!x || typeof x !== 'object') return false;

  const hasErrors = Array.isArray(x.errors);
  const hasStatus = typeof x.status === 'string';
  const hasHttpStatus = typeof x.httpStatus === 'string';

  // ton contrat backend semble parfois renvoyer "status" au lieu de "httpStatus"
  return hasErrors && (hasStatus || hasHttpStatus);
}
