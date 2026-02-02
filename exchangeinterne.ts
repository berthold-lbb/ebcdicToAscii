import {
  Directive,
  Input,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AuthenticationService } from './authentication.service';
import { Role } from './role';

type RoleInput = Role | readonly Role[] | null | undefined;

@Directive({
  selector: '[appHasAnyRole],[appHasNoRole]',
  standalone: true,
})
export class AppHasRoleDirective implements OnDestroy {
  private readonly auth = inject(AuthenticationService);
  private readonly tpl = inject(TemplateRef<unknown>);
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

  private normalize(value: RoleInput): Role[] {
    if (!value) return [];
    return Array.isArray(value) ? Array.from(value) : [value];
  }

  private bind(): void {
    // Reset précédent abonnement
    this.destroy$.next();

    // Liste vide = règle explicite
    // ANY  → n'affiche pas
    // NONE → affiche
    if (!this.roles.length) {
      this.updateView(this.mode === 'NONE');
      return;
    }

    this.auth
      .hasRole(...this.roles)
      .pipe(takeUntil(this.destroy$))
      .subscribe((allowed) => {
        const shouldShow =
          this.mode === 'ANY'
            ? allowed
            : !allowed;

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
}
