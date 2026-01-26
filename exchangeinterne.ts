// app/shared/directives/has-role/app-has-role.directive.ts
import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  OnDestroy,
  inject,
} from '@angular/core';
import { combineLatest, Observable, of, Subject } from 'rxjs';
import { map, takeUntil, distinctUntilChanged, startWith } from 'rxjs/operators';
import { AuthentificationService } from 'src/app/core/services/authentification/authentification.service';
import { RoleKey } from './roles.model';

type RoleMapper = Partial<Record<RoleKey, () => Observable<boolean>>>;

@Directive({
  selector: '[appHasRole]',
  standalone: true,
})
export class AppHasRoleDirective implements OnDestroy {
  private readonly auth = inject(AuthentificationService);
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);

  private readonly destroy$ = new Subject<void>();

  private hasView = false;
  private roles: RoleKey[] = [];
  private negate = false;

  /**
   * Map centralisé : ici tu relies un "RoleKey" à son observable.
   * => pour ajouter un rôle : tu ajoutes une entrée ici + dans RoleKey.
   */
  private readonly roleMappers: RoleMapper = {
    PAIE: () => this.auth.isPaie$(),
    SACI: () => this.auth.isSaci$(),
    OSCA: () => this.auth.isOsca$(),

    // Exemples si tu les as (sinon enlève)
    SUPER_PAIE: () => this.auth.isSuperPaie$?.() ?? of(false),
    SUPER_SACI: () => this.auth.isSuperSaci$?.() ?? of(false),
    PAIE_SUPPORT: () => this.auth.isPaieSupport$?.() ?? of(false),
    SACI_SUPPORT: () => this.auth.isSaciSupport$?.() ?? of(false),
    OSCA_SUPPORT: () => this.auth.isOscaSupport$?.() ?? of(false),
    OSCA_LECTURE: () => this.auth.isOscaLecture$?.() ?? of(false),
  };

  /**
   * Utilisation:
   *   *appHasRole="'SACI'"
   *   *appHasRole="['SACI','PAIE']"
   */
  @Input('appHasRole')
  set appHasRole(value: RoleKey | RoleKey[] | null | undefined) {
    this.roles = this.normalize(value);
    this.bind();
  }

  /**
   * Optionnel:
   *   *appHasRole="['SACI']"; appHasRoleNot
   * -> inverse la condition
   */
  @Input()
  set appHasRoleNot(value: boolean | '' | null | undefined) {
    this.negate = value === '' ? true : !!value;
    this.bind();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ------------------------
  // Internal
  // ------------------------

  private bind(): void {
    // stop l'ancien bind
    this.destroy$.next();

    // si rien demandé => par défaut on masque
    if (!this.roles.length) {
      this.updateView(false);
      return;
    }

    const streams = this.roles.map((r) => {
      const fn = this.roleMappers[r];
      // rôle non mappé => false (sécuritaire)
      return fn ? fn().pipe(startWith(false)) : of(false);
    });

    combineLatest(streams)
      .pipe(
        map((values) => values.some(Boolean)), // OR
        map((allowed) => (this.negate ? !allowed : allowed)),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((allowed) => this.updateView(allowed));
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

  private normalize(value: RoleKey | RoleKey[] | null | undefined): RoleKey[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }
}


// app/whatever/roles.model.ts
export type RoleKey =
  | 'PAIE'
  | 'SACI'
  | 'OSCA'
  // futur : ajoute ici
  | 'SUPER_PAIE'
  | 'SUPER_SACI'
  | 'SACI_SUPPORT'
  | 'PAIE_SUPPORT'
  | 'OSCA_SUPPORT'
  | 'OSCA_LECTURE';
