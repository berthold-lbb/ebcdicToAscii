import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';

/** Ton enum Role (reprend ton screenshot) */
export enum Role {
  SUPERVISEUR_SACT = 'SUPERVISEUR_SACT',
  SUPER_SACT = 'SUPER_USER_SACT',
  SACT = 'AGENT_SACT',
  SACT_LECTURE = 'AGENT_SACT_LECTURE',
  SACT_SUPPORT = 'SUPPORT_SACT',

  SUPER_OCSA = 'SUPER_USER_OCSA',
  OCSA = 'AGENT_OCSA',
  OCSA_LECTURE = 'AGENT_OCSA_LECTURE',
  OCSA_SUPPORT = 'SUPPORT_OCSA',

  SUPER_PAIE = 'SUPER_USER_PAIE',
  PAIE = 'AGENT_PAIE',
  PAIE_LECTURE = 'AGENT_PAIE_LECTURE',
  PAIE_SUPPORT = 'SUPPORT_PAIE',

  FISCALITE = 'FISCALITE',
  UNKNOWN = 'unknown'
}

/** DTO minimal selon ton interface */
export interface InformationUtilisateurBffDto {
  identifiantMouvement: string;
  numeroInstitution: string;
  numeroTransit: string;
  numeroPointService: string;
  typeTransit: string;
  role: Role;
  instanceAssignee: string;
}

/** Dépendances à adapter à ton projet */
export interface ConfigService {
  getUrlApi(app: string): string;
}
export interface ErrorHandlerService {
  handleError(err: any): void;
}

@Injectable({ providedIn: 'root' })
export class AuthentificationService {
  /**
   * Trigger de rechargement.
   * - Une émission => relance l'appel
   * - Par défaut on émet une fois au boot via load()
   */
  private readonly refreshSubject = new BehaviorSubject<void>(undefined);

  /** Cache de l'utilisateur complet */
  readonly currentUser$: Observable<InformationUtilisateurBffDto | null> =
    this.refreshSubject.pipe(
      switchMap(() => this.fetchUser$()),
      shareReplay({ bufferSize: 1, refCount: false })
    );

  /** Cache du rôle (dérivé) */
  readonly currentUserRole$: Observable<Role> = this.currentUser$.pipe(
    map(u => u?.role ?? Role.UNKNOWN),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService,
    private readonly errorHandlerService: ErrorHandlerService
  ) {}

  /**
   * À appeler au démarrage (APP_INITIALIZER ou app bootstrap).
   * Déclenche le 1er fetch (et met en cache).
   */
  load(): void {
    this.refreshSubject.next();
  }

  /**
   * Optionnel : force un refresh manuel (ex: changement session/droits).
   * Tu peux juste réutiliser load() aussi.
   */
  refresh(): void {
    this.refreshSubject.next();
  }

  /** Utilitaire générique pour les façades : "est-ce que l'user a un des rôles ?" */
  hasRole(...roles: Role[]): Observable<boolean> {
    return this.currentUserRole$.pipe(
      map(role => roles.includes(role))
    );
  }

  /** Helpers pratiques (optionnels) */
  isPaie$(): Observable<boolean> {
    return this.hasRole(Role.PAIE, Role.SUPER_PAIE, Role.PAIE_SUPPORT, Role.PAIE_LECTURE);
  }

  isSaci$(): Observable<boolean> {
    return this.hasRole(Role.SACT, Role.SUPER_SACT, Role.SACT_SUPPORT, Role.SACT_LECTURE, Role.SUPERVISEUR_SACT);
  }

  isOcsa$(): Observable<boolean> {
    return this.hasRole(Role.OCSA, Role.SUPER_OCSA, Role.OCSA_SUPPORT, Role.OCSA_LECTURE);
  }

  /** --- Private --- */

  private fetchUser$(): Observable<InformationUtilisateurBffDto | null> {
    // ✅ adapte à ton URL et tes constantes
    const baseUrl = this.configService.getUrlApi('INITIALISATION_UTILISATEUR');
    const url = `${baseUrl}/user/role`; // <-- à adapter

    return this.http.get<InformationUtilisateurBffDto>(url).pipe(
      map(user => user ?? null),
      catchError(err => {
        this.errorHandlerService.handleError(err);
        // fallback: UNKNOWN
        return of({
          identifiantMouvement: '',
          numeroInstitution: '',
          numeroTransit: '',
          numeroPointService: '',
          typeTransit: '',
          role: Role.UNKNOWN,
          instanceAssignee: ''
        } satisfies InformationUtilisateurBffDto);
      })
    );
  }
}
