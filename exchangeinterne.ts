import {
  Directive,
  Input,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

import { AuthenticationService } from '../../../core/services/authentication.service';
import { Role } from '../../../core/model/enums';

type RoleInput = Role | readonly Role[] | null | undefined;

@Directive({
  selector: '[appHasAnyRole],[appHasNoRole]',
  standalone: true,
})
export class AppHasRoleDirective implements OnDestroy {
  private readonly auth = inject(AuthenticationService);
  private readonly tpl = inject(TemplateRef<any>);
  private readonly vcr = inject(ViewContainerRef);

  private readonly destroy$ = new Subject<void>();
  private hasView = false;

  private roles: Role[] = [];
  private mode: 'ANY' | 'NONE' = 'ANY';

  @Input('appHasAnyRole')
  set appHasAnyRole(value: RoleInput) {
    this.mode = 'ANY';
    this.roles = this.normalize(value);
    this.bind();
  }

  @Input('appHasNoRole')
  set appHasNoRole(value: RoleInput) {
    this.mode = 'NONE';
    this.roles = this.normalize(value);
    this.bind();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private bind(): void {
    // stop l'abonnement précédent (rebinding)
    this.destroy$.next();

    // liste vide => règle explicite
    // ANY  -> n'affiche pas
    // NONE -> affiche
    if (this.roles.length === 0) {
      this.updateView(this.mode === 'NONE');
      return;
    }

    this.auth
      .hasRole(...this.roles)
      .pipe(takeUntil(this.destroy$))
      .subscribe((allowed) => {
        const shouldShow = this.mode === 'ANY' ? allowed : !allowed;
        this.updateView(shouldShow);
      });
  }

  private updateView(show: boolean): void {
    if (show && !this.hasView) {
      this.vcr.createEmbeddedView(this.tpl);
      this.hasView = true;
      return;
    }
    if (!show && this.hasView) {
      this.vcr.clear();
      this.hasView = false;
    }
  }

  private normalize(value: RoleInput): Role[] {
    if (value == null) return [];
    if (this.isRoleArray(value)) return [...value];
    return [value]; // ici value est bien Role grâce au type guard
  }

  private isRoleArray(value: Role | readonly Role[]): value is readonly Role[] {
    return Array.isArray(value);
  }
}
