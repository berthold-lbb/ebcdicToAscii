// role.mapper.ts
import { Role } from '../model/enums'; // ⚠️ ajuste le chemin chez toi

/**
 * Normalise un rôle backend (string) vers une clé stable :
 * - trim
 * - uppercase
 * - espaces / tirets / slash => underscore
 * - underscores multiples => 1 seul
 * - enlève underscores au début/fin
 *
 * Ex:
 *  " paie lecture " => "PAIE_LECTURE"
 *  "paie-lecture"   => "PAIE_LECTURE"
 *  "PAIE/LECTURE"   => "PAIE_LECTURE"
 */
export function normalizeRole(raw?: string | null): string {
  return (raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-\/]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Mapping des rôles normalisés -> Enum Role.
 * Ajoute ici TOUTES les valeurs attendues.
 */
export const ROLE_MAP: Record<string, Role> = {
  // --- OCSA
  OCSA: Role.OCSA,
  SUPER_OCSA: Role.SUPER_OCSA,
  OCSA_SUPPORT: Role.OCSA_SUPPORT,
  OCSA_LECTURE: Role.OCSA_LECTURE,

  // --- SACI
  SACI: Role.SACI,
  SUPER_SACI: Role.SUPER_SACI,
  SACI_SUPPORT: Role.SACI_SUPPORT,
  SACI_LECTURE: Role.SACI_LECTURE,
  SUPERVISEUR_SACI: Role.SUPERVISEUR_SACI,

  // --- PAIE
  PAIE: Role.PAIE,
  SUPER_PAIE: Role.SUPER_PAIE,
  PAIE_SUPPORT: Role.PAIE_SUPPORT,
  PAIE_LECTURE: Role.PAIE_LECTURE,

  // fallback connus éventuels
  NONE: Role.NONE,
  UNKNOWN: Role.NONE,
};

export function mapRole(raw?: string | null): Role {
  const key = normalizeRole(raw);
  return ROLE_MAP[key] ?? Role.NONE;
}


// role.mapper.spec.ts
import { mapRole, normalizeRole, ROLE_MAP } from './role.mapper';
import { Role } from '../model/enums'; // ⚠️ ajuste le chemin chez toi

describe('role.mapper', () => {
  describe('normalizeRole', () => {
    const cases: Array<{ raw: any; expected: string }> = [
      { raw: undefined, expected: '' },
      { raw: null, expected: '' },
      { raw: '', expected: '' },
      { raw: '   ', expected: '' },

      { raw: 'paie', expected: 'PAIE' },
      { raw: ' PAIE ', expected: 'PAIE' },
      { raw: 'paie lecture', expected: 'PAIE_LECTURE' },
      { raw: 'PaIe   LeCtUrE', expected: 'PAIE_LECTURE' },
      { raw: 'paie-lecture', expected: 'PAIE_LECTURE' },
      { raw: 'paie/lecture', expected: 'PAIE_LECTURE' },

      { raw: '__paie__lecture__', expected: 'PAIE_LECTURE' },
      { raw: '  - paie  /  lecture - ', expected: 'PAIE_LECTURE' },
      { raw: '_PAIE__LECTURE_', expected: 'PAIE_LECTURE' },
    ];

    cases.forEach(({ raw, expected }) => {
      it(`should normalize "${String(raw)}" -> "${expected}"`, () => {
        expect(normalizeRole(raw)).toBe(expected);
      });
    });
  });

  describe('mapRole', () => {
    it('should return Role.NONE for unknown / empty values', () => {
      expect(mapRole(undefined)).toBe(Role.NONE);
      expect(mapRole(null)).toBe(Role.NONE);
      expect(mapRole('')).toBe(Role.NONE);
      expect(mapRole('   ')).toBe(Role.NONE);
      expect(mapRole('un-role-inconnu')).toBe(Role.NONE);
    });

    it('should map known roles ignoring case/separators', () => {
      // adapte si tu n'as pas ces rôles dans ton enum
      expect(mapRole('paie')).toBe(Role.PAIE);
      expect(mapRole('PAIE LECTURE')).toBe(Role.PAIE_LECTURE);
      expect(mapRole('paie-lecture')).toBe(Role.PAIE_LECTURE);
      expect(mapRole('paie/lecture')).toBe(Role.PAIE_LECTURE);
    });

    it('should map every ROLE_MAP key (sanity)', () => {
      // garantit que chaque clé mappée renvoie bien une valeur valide
      Object.keys(ROLE_MAP).forEach((key) => {
        const expected = ROLE_MAP[key];
        expect(mapRole(key)).toBe(expected);
      });
    });

    it('should accept variants for each ROLE_MAP key (normalize-driven)', () => {
      // Pour chaque clé "FOO_BAR", on teste :
      // - "foo bar"
      // - "foo-bar"
      // - "foo/bar"
      Object.keys(ROLE_MAP).forEach((key) => {
        const expected = ROLE_MAP[key];

        const spaced = key.toLowerCase().replace(/_/g, ' ');
        const dashed = key.toLowerCase().replace(/_/g, '-');
        const slashed = key.toLowerCase().replace(/_/g, '/');

        expect(mapRole(spaced)).toBe(expected);
        expect(mapRole(dashed)).toBe(expected);
        expect(mapRole(slashed)).toBe(expected);
      });
    });
  });
});




import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';

import { AuthentificationRepository } from '../repositories/authentification.repository';
import { Role } from '../model/enums';
import { InformationUtilisateurBffDto } from '../model/utilisateur'; // ng-openapi
import { mapRole } from './role.mapper';

@Injectable({ providedIn: 'root' })
export class AuthentificationService {
  private readonly refreshSubject = new BehaviorSubject<void>(undefined);

  readonly currentUser$: Observable<InformationUtilisateurBffDto | null> =
    this.refreshSubject.pipe(
      switchMap(() => this.fetchUsers$()),
      shareReplay({ bufferSize: 1, refCount: false })
    );

  readonly currentUserRole$: Observable<Role> = this.currentUser$.pipe(
    map((u) => (u ? (u.role as unknown as Role) : Role.NONE)), // <- on va corriger juste après
    // ✅ mieux: map(u => u ? u.role : Role.NONE) si tu transformes le DTO en modèle front
    // (je te laisse la version DTO ci-dessous, corrigée dans fetchUsers$)
    shareReplay({ bufferSize: 1, refCount: false })
  );

  constructor(private readonly authentificationRepository: AuthentificationRepository) {}

  load(): void {
    this.refreshSubject.next();
  }

  refresh(): void {
    this.refreshSubject.next();
  }

  /** Helpers */
  hasRole(...roles: Role[]): Observable<boolean> {
    return this.currentUserRole$.pipe(map((r) => roles.includes(r)));
  }

  isSaci$(): Observable<boolean> {
    return this.hasRole(
      Role.SACI,
      Role.SUPER_SACI,
      Role.SACI_SUPPORT,
      Role.SACI_LECTURE,
      Role.SUPERVISEUR_SACI
    );
  }

  isOcsa$(): Observable<boolean> {
    return this.hasRole(Role.OCSA, Role.SUPER_OCSA, Role.OCSA_SUPPORT, Role.OCSA_LECTURE);
  }

  isPaie$(): Observable<boolean> {
    return this.hasRole(Role.PAIE, Role.SUPER_PAIE, Role.PAIE_SUPPORT, Role.PAIE_LECTURE);
  }

  /** 🔥 Ici on fait la conversion DTO -> DTO enrichi (role typé Role) */
  private fetchUsers$(): Observable<InformationUtilisateurBffDto | null> {
    return this.authentificationRepository.getInformationUtilisateurs().pipe(
      map((user) => {
        if (!user) return null;

        // IMPORTANT: on remplace le role string par le Role enum
        return {
          ...user,
          role: mapRole((user as any).role) as any, // garde compat si dto est typé string
        };
      }),
      catchError(() => of(null))
    );
  }
}



import { TestBed } from '@angular/core/testing';
import { of, throwError, firstValueFrom } from 'rxjs';

import { AuthentificationService } from './authentification.service';
import { AuthentificationRepository } from '../repositories/authentification.repository';
import { Role } from '../model/enums';
import { ROLE_MAP, mapRole } from './role.mapper';

// Mini DTO (si ton import DTO est lourd, sinon importe ton vrai type)
type InformationUtilisateurBffDto = {
  identifiantNouvement: string;
  numeroInstitution: string;
  numeroTransit: string;
  numeroPointService: string;
  typeTransit: string;
  role: any; // string backend -> devient Role après mapping
  instanceAssignee: string;
};

describe('AuthentificationService', () => {
  let service: AuthentificationService;

  let repoSpy: jasmine.SpyObj<AuthentificationRepository>;

  const makeDto = (roleRaw: string): InformationUtilisateurBffDto => ({
    identifiantNouvement: 'id',
    numeroInstitution: '123',
    numeroTransit: '456',
    numeroPointService: '789',
    typeTransit: 'T',
    role: roleRaw,
    instanceAssignee: 'assignee',
  });

  beforeEach(() => {
    repoSpy = jasmine.createSpyObj<AuthentificationRepository>('AuthentificationRepository', [
      'getInformationUtilisateurs',
    ]);

    TestBed.configureTestingModule({
      providers: [
        AuthentificationService,
        { provide: AuthentificationRepository, useValue: repoSpy },
      ],
    });

    service = TestBed.inject(AuthentificationService);
  });

  describe('role.mapper', () => {
    it('mapRole retourne Role.NONE si unknown / vide', () => {
      expect(mapRole(undefined)).toBe(Role.NONE);
      expect(mapRole(null)).toBe(Role.NONE);
      expect(mapRole('')).toBe(Role.NONE);
      expect(mapRole('___nope___')).toBe(Role.NONE);
    });

    it('mapRole couvre toutes les clés ROLE_MAP', () => {
      for (const [raw, expected] of Object.entries(ROLE_MAP)) {
        expect(mapRole(raw)).toBe(expected, `raw=${raw}`);
      }
    });

    it('mapRole normalise (espaces, casse)', () => {
      expect(mapRole('  saci_support  ')).toBe(Role.SACI_SUPPORT);
      expect(mapRole('Super Ocsa')).toBe(Role.SUPER_OCSA);
      expect(mapRole('paie lecture')).toBe(Role.PAIE_LECTURE);
    });
  });

  describe('load/refresh + currentUser$', () => {
    it('load() déclenche un fetch et map le role', async () => {
      repoSpy.getInformationUtilisateurs.and.returnValue(of(makeDto('SACI_SUPPORT') as any));

      service.load();

      const u = await firstValueFrom(service.currentUser$);
      expect(repoSpy.getInformationUtilisateurs).toHaveBeenCalled();
      expect(u).toBeTruthy();
      expect((u as any).role).toBe(Role.SACI_SUPPORT);
    });

    it('si repo renvoie null => currentUser$ émet null', async () => {
      repoSpy.getInformationUtilisateurs.and.returnValue(of(null));

      service.load();

      const u = await firstValueFrom(service.currentUser$);
      expect(u).toBeNull();
    });

    it('si repo throw => currentUser$ émet null (catchError)', async () => {
      repoSpy.getInformationUtilisateurs.and.returnValue(throwError(() => new Error('boom')));

      service.load();

      const u = await firstValueFrom(service.currentUser$);
      expect(u).toBeNull();
    });

    it('refresh() déclenche un nouveau fetch', async () => {
      repoSpy.getInformationUtilisateurs.and.returnValues(
        of(makeDto('OCSA') as any),
        of(makeDto('PAIE') as any)
      );

      service.load();
      const u1 = await firstValueFrom(service.currentUser$);
      expect((u1 as any).role).toBe(Role.OCSA);

      service.refresh();
      const u2 = await firstValueFrom(service.currentUser$);
      expect((u2 as any).role).toBe(Role.PAIE);

      expect(repoSpy.getInformationUtilisateurs).toHaveBeenCalledTimes(2);
    });
  });

  describe('currentUserRole$', () => {
    it('retourne Role.NONE si user null', async () => {
      repoSpy.getInformationUtilisateurs.and.returnValue(of(null));
      service.load();

      const r = await firstValueFrom(service.currentUserRole$);
      expect(r).toBe(Role.NONE);
    });

    it('retourne le Role mappé si user existe', async () => {
      repoSpy.getInformationUtilisateurs.and.returnValue(of(makeDto('SUPER_SACI') as any));
      service.load();

      const r = await firstValueFrom(service.currentUserRole$);
      expect(r).toBe(Role.SUPER_SACI);
    });
  });

  describe('hasRole / isX helpers', () => {
    it('hasRole retourne true si role match', async () => {
      repoSpy.getInformationUtilisateurs.and.returnValue(of(makeDto('PAIE_SUPPORT') as any));
      service.load();

      const ok = await firstValueFrom(service.hasRole(Role.PAIE_SUPPORT, Role.SACI));
      expect(ok).toBeTrue();
    });

    it('hasRole retourne false si role ne match pas', async () => {
      repoSpy.getInformationUtilisateurs.and.returnValue(of(makeDto('OCSA') as any));
      service.load();

      const ok = await firstValueFrom(service.hasRole(Role.PAIE, Role.SACI));
      expect(ok).toBeFalse();
    });

    it('isSaci$ true pour un rôle SACI*', async () => {
      repoSpy.getInformationUtilisateurs.and.returnValue(of(makeDto('SUPERVISEUR_SACI') as any));
      service.load();

      const ok = await firstValueFrom(service.isSaci$());
      expect(ok).toBeTrue();
    });

    it('isSaci$ false si pas SACI', async () => {
      repoSpy.getInformationUtilisateurs.and.returnValue(of(makeDto('PAIE') as any));
      service.load();

      const ok = await firstValueFrom(service.isSaci$());
      expect(ok).toBeFalse();
    });

    it('isOcsa$ true pour OCSA*', async () => {
      repoSpy.getInformationUtilisateurs.and.returnValue(of(makeDto('SUPER_OCSA') as any));
      service.load();

      const ok = await firstValueFrom(service.isOcsa$());
      expect(ok).toBeTrue();
    });

    it('isPaie$ true pour PAIE*', async () => {
      repoSpy.getInformationUtilisateurs.and.returnValue(of(makeDto('PAIE_LECTURE') as any));
      service.load();

      const ok = await firstValueFrom(service.isPaie$());
      expect(ok).toBeTrue();
    });
  });
});
