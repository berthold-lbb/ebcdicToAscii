// app-error.ts
import { ErreurRest } from '.../api/models/erreur-rest';
import { ProblemeRest } from '.../api/models/probleme-rest';

export type AppErrorSource = 'HTTP' | 'NETWORK' | 'CLIENT';

export type AppErrorKind =
  | 'VALIDATION'   // type V
  | 'BUSINESS'     // type B
  | 'SYSTEM'       // type S
  | 'RELEVE'       // type R (si c’est bien ça chez vous)
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SERVER'
  | 'UNKNOWN';

export interface AppError {
  source: AppErrorSource;
  kind: AppErrorKind;

  /** status HTTP numérique */
  httpStatus?: number;

  /** httpStatus enum (ProblemeRest.httpStatus) */
  httpStatusKey?: string;

  /** status texte (ProblemeRest.status) */
  status?: string;

  /** message UI principal */
  message: string;

  /** messages UI (dérivés de errors[].message / detail / exception.message) */
  messages: string[];

  /** code erreur backend (errors[0].code) */
  code?: number;

  /** type erreur backend (B/S/V/R) */
  errorType?: 'B' | 'S' | 'V' | 'R';

  /** endpoint le plus fiable : errors[0].url ou exception.url ou HttpErrorResponse.url */
  endpoint?: string;

  /** système */
  systemId?: string;
  systemName?: string;

  /** timestamp si fourni */
  time?: string;

  /** payload backend brut (utile debug) */
  problemeRest?: ProblemeRest;

  /** liste complète (utile debug / écran support) */
  errors?: ErreurRest[];

  /** l’erreur originale */
  original?: unknown;
}



// api-error-mapper.ts
// api-error-mapper.ts
import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AppError, AppErrorKind } from './app-error';
import { ProblemeRest } from '.../api/models/probleme-rest';
import { ErreurRest } from '.../api/models/erreur-rest';

@Injectable({ providedIn: 'root' })
export class ApiErrorMapper {
  map(err: unknown): AppError {
    if (err instanceof HttpErrorResponse) {
      // status 0 => réseau / CORS / offline
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

      const body = err.error as ProblemeRest | undefined;

      // Si backend ne renvoie pas ProblemeRest
      if (!this.isProblemeRest(body)) {
        return {
          source: 'HTTP',
          kind: this.kindFromHttpStatus(err.status),
          httpStatus: err.status,
          message: err.message || 'Une erreur est survenue.',
          messages: [err.message || 'Une erreur est survenue.'],
          endpoint: err.url ?? undefined,
          original: err,
        };
      }

      const errors = body.errors ?? [];
      const first = errors[0];

      // endpoint : priorité ErreurRest.url puis ErreurRest.exception.url puis HttpErrorResponse.url
      const endpoint =
        first?.url ??
        first?.exception?.url ??
        err.url ??
        undefined;

      // messages UI (on prend le plus parlant)
      const messages = this.collectMessages(errors);
      const message = messages[0] ?? 'Une erreur est survenue.';

      // type B/S/V/R => kind
      const kind = this.kindFromErreurType(first?.type, err.status);

      return {
        source: 'HTTP',
        kind,
        httpStatus: err.status,
        httpStatusKey: body.httpStatus,
        status: body.status,
        message,
        messages,
        code: first?.code,
        errorType: first?.type,
        endpoint,
        systemId: first?.systemId ?? first?.exception?.systemId,
        systemName: first?.systemName ?? first?.exception?.systemName,
        time: first?.time ?? first?.exception?.time,
        problemeRest: body,
        errors,
        original: err,
      };
    }

    // Erreurs non HTTP (frontend)
    const msg = err instanceof Error ? err.message : 'Erreur inconnue.';
    return {
      source: 'CLIENT',
      kind: 'UNKNOWN',
      message: msg,
      messages: [msg],
      original: err,
    };
  }

  private isProblemeRest(x: any): x is ProblemeRest {
    return (
      x &&
      typeof x === 'object' &&
      typeof x.status === 'string' &&
      typeof x.httpStatus === 'string' &&
      Array.isArray(x.errors)
    );
  }

  private collectMessages(errors: ErreurRest[]): string[] {
    const out: string[] = [];
    for (const e of errors) {
      // ordre de préférence: message -> detail -> exception.message
      if (e?.message) out.push(e.message);
      if (e?.detail) out.push(e.detail);
      if (e?.exception?.message) out.push(e.exception.message);
    }

    // dédoublonner
    return [...new Set(out.map(s => s.trim()).filter(Boolean))];
  }

  private kindFromErreurType(
    t: 'B' | 'S' | 'V' | 'R' | undefined,
    httpStatus: number
  ): AppErrorKind {
    if (t === 'V') return 'VALIDATION';
    if (t === 'B') return 'BUSINESS';
    if (t === 'S') return 'SYSTEM';
    if (t === 'R') return 'RELEVE';

    // fallback via HTTP
    return this.kindFromHttpStatus(httpStatus);
  }

  private kindFromHttpStatus(status: number): AppErrorKind {
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status >= 500) return 'SERVER';
    return 'UNKNOWN';
  }
}
