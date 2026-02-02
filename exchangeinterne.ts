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

  // (Optionnel) protège contre une mauvaise utilisation (deux inputs sur le même élément)
  private activeInput: 'ANY' | 'NONE' | null = null;

  @Input('appHasAnyRole')
  set appHasAnyRole(value: Role | readonly Role[] | null | undefined) {
    this.activeInput = this.assertOrSetActive('ANY');
    this.mode = 'ANY';
    this.roles = this.normalize(value);
    this.bind();
  }

  @Input('appHasNoRole')
  set appHasNoRole(value: Role | readonly Role[] | null | undefined) {
    this.activeInput = this.assertOrSetActive('NONE');
    this.mode = 'NONE';
    this.roles = this.normalize(value);
    this.bind();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private normalize(value: Role | readonly Role[] | null | undefined): Role[] {
    if (!value) return [];
    return Array.isArray(value) ? [...value] : [value];
  }

  private bind(): void {
    // Reset l'abonnement précédent
    this.destroy$.next();

    // Liste vide => comportement explicite
    // ANY : n'affiche pas
    // NONE: affiche
    if (!this.roles.length) {
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

  private assertOrSetActive(mode: 'ANY' | 'NONE'): 'ANY' | 'NONE' {
    if (this.activeInput === null) return mode;

    // Si quelqu’un essaye de poser les deux sur le même élément, on garde le dernier
    // (tu peux aussi throw ici si tu préfères)
    return mode;
  }
}
