// app-has-role.directive.ts
import { Directive, Input, OnDestroy, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthenticationService } from 'src/app/core/services/authentication/authentication.service';
import { Role } from 'src/app/core/auth/role.enum';

@Directive({
  selector: '[appHasRole]',
  standalone: true,
})
export class AppHasRoleDirective implements OnDestroy {
  private readonly auth = inject(AuthenticationService);
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);

  private readonly destroy$ = new Subject<void>();

  private hasView = false;
  private roles: readonly Role[] = [];
  private negate = false;

  @Input('appHasRole')
  set appHasRole(value: Role | readonly Role[] | Role[] | null | undefined) {
    this.roles = this.normalize(value);
    this.bind();
  }

  @Input()
  set appHasRoleNot(value: boolean | '' | null | undefined) {
    this.negate = value === '' ? true : !!value;
    this.bind();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private bind(): void {
    // stop ancien bind
    this.destroy$.next();

    // rien demandé => on masque (sécuritaire)
    if (!this.roles.length) {
      this.updateView(false);
      return;
    }

    this.auth.hasAnyRole$(this.roles)
      .pipe(takeUntil(this.destroy$))
      .subscribe((allowed) => {
        const finalAllowed = this.negate ? !allowed : allowed;
        this.updateView(finalAllowed);
      });
  }

  private updateView(allowed: boolean): void {
    if (allowed && !this.hasView) {
      this.vcr.createEmbeddedView(this.tpl);
      this.hasView = true;
      return;
    }
    if (!allowed && this.hasView) {
      this.vcr.clear();
      this.hasView = false;
    }
  }

  private normalize(value: Role | readonly Role[] | Role[] | null | undefined): readonly Role[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }
}


// src/app/core/auth/permissions/reddition.permissions.ts
import { Role } from '../role.enum';
import { PAIE_ROLES, SACI_ROLES } from '../role-groups';

// Reddition visible pour tous les rôles PAIE + tous les rôles SACI
export const REDDITION_VIEW_ROLES: readonly Role[] = [
  ...PAIE_ROLES,
  ...SACI_ROLES,
];

// si tu as des actions spécifiques :
export const REDDITION_EXPORT_ROLES: readonly Role[] = [
  Role.SUPER_PAIE,
  Role.SUPER_SACI,
  // ou + support si besoin
];

export const REDDITION_EDIT_ROLES: readonly Role[] = [
  Role.PAIE,
  Role.SACI,
  Role.PAIE_SUPPORT,
  Role.SACI_SUPPORT,
];


// src/app/core/auth/role-groups.ts
import { Role } from './role.enum';

export const PAIE_ROLES: readonly Role[] = [
  Role.PAIE,
  Role.SUPER_PAIE,
  Role.PAIE_LECTURE,
  Role.PAIE_SUPPORT,
];

export const SACI_ROLES: readonly Role[] = [
  Role.SACI,
  Role.SUPER_SACI,
  Role.SACI_LECTURE,
  Role.SACI_SUPPORT,
];

export const OCSA_ROLES: readonly Role[] = [
  Role.OCSA,
  Role.SUPER_OCSA,
  Role.OCSA_LECTURE,
  Role.OCSA_SUPPORT,
];

// Optionnel: groupes “super” uniquement
export const SUPER_PAIE_ROLES: readonly Role[] = [Role.SUPER_PAIE];
export const SUPER_SACI_ROLES: readonly Role[] = [Role.SUPER_SACI];
export const SUPER_OCSA_ROLES: readonly Role[] = [Role.SUPER_OCSA];








//////////////////////////////////
// dsd-datepicker-bind.directive.ts
//////////////////////////////////

1) role-groups.ts : groupes “famille” + groupes “niveau”

Tu as dit : Reddition ne doit PAS être visible pour Lecture/Support.
Donc on sépare :

PAIE_ANY = tout paie (agent + super + lecture + support) → pour isPaie$() (compat)

PAIE_FULL = agent + super → pour écrans sensibles

idem SACI/OCSA

// src/app/core/auth/role-groups.ts
import { Role } from './role.enum';

// ------- PAIE -------
export const PAIE_FULL: readonly Role[] = [Role.PAIE, Role.SUPER_PAIE] as const;
export const PAIE_READONLY: readonly Role[] = [Role.PAIE_LECTURE] as const;
export const PAIE_SUPPORT: readonly Role[] = [Role.PAIE_SUPPORT] as const;

export const PAIE_ANY: readonly Role[] = [
  ...PAIE_FULL,
  ...PAIE_READONLY,
  ...PAIE_SUPPORT,
] as const;

// ------- SACI -------
export const SACI_FULL: readonly Role[] = [Role.SACI, Role.SUPER_SACI] as const;
export const SACI_READONLY: readonly Role[] = [Role.SACI_LECTURE] as const;
export const SACI_SUPPORT: readonly Role[] = [Role.SACI_SUPPORT] as const;

export const SACI_ANY: readonly Role[] = [
  ...SACI_FULL,
  ...SACI_READONLY,
  ...SACI_SUPPORT,
] as const;

// ------- OCSA -------
export const OCSA_FULL: readonly Role[] = [Role.OCSA, Role.SUPER_OCSA] as const;
export const OCSA_READONLY: readonly Role[] = [Role.OCSA_LECTURE] as const;
export const OCSA_SUPPORT: readonly Role[] = [Role.OCSA_SUPPORT] as const;

export const OCSA_ANY: readonly Role[] = [
  ...OCSA_FULL,
  ...OCSA_READONLY,
  ...OCSA_SUPPORT,
] as const;

2) permissions/reddition.permissions.ts : ta règle “FULL uniquement”

C’est là qu’on exprime la règle métier :

// src/app/core/auth/permissions/reddition.permissions.ts
import { Role } from '../role.enum';
import { PAIE_FULL, SACI_FULL } from '../role-groups';

// ✅ Reddition visible uniquement pour PAIE FULL + SACI FULL
export const REDDITION_VIEW_ROLES: readonly Role[] = [
  ...PAIE_FULL,
  ...SACI_FULL,
] as const;


Tu peux aussi prévoir des permissions d’action :

// Exemple: exporter seulement les SUPER
export const REDDITION_EXPORT_ROLES: readonly Role[] = [
  Role.SUPER_PAIE,
  Role.SUPER_SACI,
] as const;

3) AuthentificationService : compat + générique hasAnyRole$

Tu gardes isPaie$() / isSaci$() comme avant, mais basés sur *_ANY.

// src/app/core/auth/authentication.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { Role } from './role.enum';
import { PAIE_ANY, SACI_ANY, OCSA_ANY } from './role-groups';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  // Tu as déjà un Observable du rôle courant (mappé du backend)
  readonly currentUserRole$: Observable<Role> = /* ton observable */ null as any;

  hasAnyRole$(roles: readonly Role[]): Observable<boolean> {
    return this.currentUserRole$.pipe(
      map((r) => roles.includes(r)),
      distinctUntilChanged()
    );
  }

  // ✅ Compat: “famille”
  isPaie$(): Observable<boolean> {
    return this.hasAnyRole$(PAIE_ANY);
  }

  isSaci$(): Observable<boolean> {
    return this.hasAnyRole$(SACI_ANY);
  }

  isOcsa$(): Observable<boolean> {
    return this.hasAnyRole$(OCSA_ANY);
  }
}


Tu peux garder tes signatures EXACTES (isPaies() etc.). L’important c’est le contenu.

4) Directive appHasRole : elle prend directement Role[]

Aucun RoleKey, aucun mapper.

// src/app/shared/directives/app-has-role.directive.ts
import { Directive, Input, OnDestroy, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthenticationService } from 'src/app/core/auth/authentication.service';
import { Role } from 'src/app/core/auth/role.enum';

@Directive({
  selector: '[appHasRole]',
  standalone: true,
})
export class AppHasRoleDirective implements OnDestroy {
  private readonly auth = inject(AuthenticationService);
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);

  private readonly destroy$ = new Subject<void>();
  private hasView = false;

  private roles: readonly Role[] = [];
  private negate = false;

  @Input('appHasRole')
  set appHasRole(value: Role | readonly Role[] | null | undefined) {
    this.roles = !value ? [] : Array.isArray(value) ? value : [value];
    this.bind();
  }

  @Input()
  set appHasRoleNot(value: boolean | '' | null | undefined) {
    this.negate = value === '' ? true : !!value;
    this.bind();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private bind(): void {
    this.destroy$.next();

    if (!this.roles.length) {
      this.updateView(false);
      return;
    }

    this.auth.hasAnyRole$(this.roles)
      .pipe(takeUntil(this.destroy$))
      .subscribe((allowed) => this.updateView(this.negate ? !allowed : allowed));
  }

  private updateView(allowed: boolean): void {
    if (allowed && !this.hasView) {
      this.vcr.createEmbeddedView(this.tpl);
      this.hasView = true;
    } else if (!allowed && this.hasView) {
      this.vcr.clear();
      this.hasView = false;
    }
  }
}

5) Utilisation dans le composant / HTML

Dans ton TS :

import { REDDITION_VIEW_ROLES } from 'src/app/core/auth/permissions/reddition.permissions';
readonly REDDITION_VIEW_ROLES = REDDITION_VIEW_ROLES;


Dans ton HTML :

<dsd-tile *appHasRole="REDDITION_VIEW_ROLES">
  Reddition
</dsd-tile>