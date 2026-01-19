// app-error.ts
export type AppErrorKind =
  | 'NETWORK'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'BUSINESS'
  | 'SERVER'
  | 'UNKNOWN';

export interface AppError {
  kind: AppErrorKind;
  httpStatus?: number;
  code?: number | string;
  message: string;           // message prêt pour UI (ou clé i18n)
  details?: string[];
  original?: unknown;        // pour debug/log
  endpoint?: string;         // optionnel
}


// api-error-mapper.ts
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AppError } from './app-error';
import { ProblemeRest } from '.../api/models/probleme-rest'; // adapte ton path

@Injectable({ providedIn: 'root' })
export class ApiErrorMapper {
  map(err: unknown, endpoint?: string): AppError {
    // HttpErrorResponse (Angular)
    if (err instanceof HttpErrorResponse) {
      const status = err.status;

      // Réseau / CORS / offline
      if (status === 0) {
        return { kind: 'NETWORK', httpStatus: 0, message: 'Réseau indisponible.', original: err, endpoint };
      }

      // Le backend renvoie parfois un body typé ProblemeRest
      const body = err.error as ProblemeRest | undefined;

      // 401/403/404
      if (status === 401) return { kind: 'UNAUTHORIZED', httpStatus: 401, message: 'Session expirée.', original: err, endpoint };
      if (status === 403) return { kind: 'FORBIDDEN', httpStatus: 403, message: 'Accès refusé.', original: err, endpoint };
      if (status === 404) return { kind: 'NOT_FOUND', httpStatus: 404, message: 'Ressource introuvable.', original: err, endpoint };

      // Validation / business
      if (body?.errors?.length) {
        const details = body.errors
          .map(e => e?.detail ?? e?.message ?? '')
          .filter(Boolean);

        // tu peux décider "VALIDATION" si 400, "BUSINESS" si 422, etc.
        const kind = status === 400 ? 'VALIDATION' : 'BUSINESS';
        return {
          kind,
          httpStatus: status,
          message: details[0] ?? 'Une erreur est survenue.',
          details,
          original: err,
          endpoint,
        };
      }

      // Server
      if (status >= 500) {
        return { kind: 'SERVER', httpStatus: status, message: 'Erreur serveur.', original: err, endpoint };
      }

      return { kind: 'UNKNOWN', httpStatus: status, message: err.message || 'Erreur inconnue.', original: err, endpoint };
    }

    // Fallback non-HTTP
    return { kind: 'UNKNOWN', message: 'Erreur inconnue.', original: err, endpoint };
  }
}
