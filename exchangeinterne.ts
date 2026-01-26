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
