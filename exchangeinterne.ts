






// app-has-role.directive.spec.ts
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

// ⚠️ adapte le chemin selon ton projet
import { AppHasRoleDirective } from './app-has-role.directive';
import { AuthentificationService } from '../core/services/authentification/authentification.service';

type RoleKey = 'PAIE' | 'SACI' | 'OSCA';

@Component({
  // On met plusieurs cas dans le template pour tester facilement
  template: `
    <div id="paieOnly" *appHasRole="['PAIE']">PAIE</div>
    <div id="saciOnly" *appHasRole="['SACI']">SACI</div>
    <div id="oscaOnly" *appHasRole="['OSCA']">OSCA</div>

    <div id="paieOrSaci" *appHasRole="['PAIE','SACI']">PAIE_OR_SACI</div>
    <div id="allThree" *appHasRole="['PAIE','SACI','OSCA']">ALL</div>

    <!-- cas limite -->
    <div id="emptyRoles" *appHasRole="[]">EMPTY</div>
    <div id="unknownRole" *appHasRole="['UNKNOWN' as any]">UNKNOWN</div>

    <!-- pour tester les changements dynamiques -->
    <div id="dynamic" *appHasRole="dynamicRoles">DYNAMIC</div>
  `,
  standalone: true,
  imports: [AppHasRoleDirective],
})
class HostComponent {
  dynamicRoles: RoleKey[] = ['PAIE'];
}

describe('AppHasRoleDirective (spy + BehaviorSubject)', () => {
  let fixture: ComponentFixture<HostComponent>;

  // streams contrôlables
  let isPaieBS: BehaviorSubject<boolean>;
  let isSaciBS: BehaviorSubject<boolean>;
  let isOscaBS: BehaviorSubject<boolean>;

  let authSpy: jasmine.SpyObj<AuthentificationService>;

  function el(id: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`#${id}`);
  }

  function detect() {
    fixture.detectChanges();
  }

  beforeEach(async () => {
    isPaieBS = new BehaviorSubject<boolean>(false);
    isSaciBS = new BehaviorSubject<boolean>(false);
    isOscaBS = new BehaviorSubject<boolean>(false);

    authSpy = jasmine.createSpyObj<AuthentificationService>('AuthentificationService', [
      'isPaie$',
      'isSaci$',
      'isOsca$',
    ]);

    authSpy.isPaie$.and.returnValue(isPaieBS.asObservable());
    authSpy.isSaci$.and.returnValue(isSaciBS.asObservable());
    authSpy.isOsca$.and.returnValue(isOscaBS.asObservable());

    await TestBed.configureTestingModule({
      imports: [HostComponent], // standalone host
      providers: [{ provide: AuthentificationService, useValue: authSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
  });

  it('ne doit rien afficher quand aucun rôle n’est vrai', () => {
    detect();
    expect(el('paieOnly')).toBeNull();
    expect(el('saciOnly')).toBeNull();
    expect(el('oscaOnly')).toBeNull();
    expect(el('paieOrSaci')).toBeNull();
    expect(el('allThree')).toBeNull();
  });

  it('doit afficher PAIE seulement quand isPaie=true', () => {
    isPaieBS.next(true);
    detect();

    expect(el('paieOnly')).not.toBeNull();
    expect(el('saciOnly')).toBeNull();
    expect(el('oscaOnly')).toBeNull();
  });

  it('doit afficher SACI seulement quand isSaci=true', () => {
    isSaciBS.next(true);
    detect();

    expect(el('paieOnly')).toBeNull();
    expect(el('saciOnly')).not.toBeNull();
    expect(el('oscaOnly')).toBeNull();
  });

  it('doit afficher OSCA seulement quand isOsca=true', () => {
    isOscaBS.next(true);
    detect();

    expect(el('paieOnly')).toBeNull();
    expect(el('saciOnly')).toBeNull();
    expect(el('oscaOnly')).not.toBeNull();
  });

  it('doit faire un OR: affiche si PAIE ou SACI est vrai', () => {
    // aucun
    detect();
    expect(el('paieOrSaci')).toBeNull();

    // PAIE
    isPaieBS.next(true);
    detect();
    expect(el('paieOrSaci')).not.toBeNull();

    // PAIE -> false, SACI -> true
    isPaieBS.next(false);
    isSaciBS.next(true);
    detect();
    expect(el('paieOrSaci')).not.toBeNull();

    // les deux false
    isSaciBS.next(false);
    detect();
    expect(el('paieOrSaci')).toBeNull();
  });

  it('doit afficher ALL si au moins un des 3 rôles est vrai (OR)', () => {
    detect();
    expect(el('allThree')).toBeNull();

    isOscaBS.next(true);
    detect();
    expect(el('allThree')).not.toBeNull();

    isOscaBS.next(false);
    isSaciBS.next(true);
    detect();
    expect(el('allThree')).not.toBeNull();

    isSaciBS.next(false);
    isPaieBS.next(true);
    detect();
    expect(el('allThree')).not.toBeNull();

    // tous faux
    isPaieBS.next(false);
    detect();
    expect(el('allThree')).toBeNull();
  });

  it('cas limite: [] doit cacher (recommandé)', () => {
    detect();
    expect(el('emptyRoles')).toBeNull();
  });

  it('cas limite: rôle inconnu => caché', () => {
    detect();
    expect(el('unknownRole')).toBeNull();
  });

  it('doit réagir aux changements dynamiques de roles input (dynamicRoles)', () => {
    // dynamicRoles = ['PAIE'] au départ
    isPaieBS.next(true);
    detect();
    expect(el('dynamic')).not.toBeNull();

    // on change l’input pour exiger SACI
    fixture.componentInstance.dynamicRoles = ['SACI'];
    detect();
    // isSaci = false => doit cacher
    expect(el('dynamic')).toBeNull();

    // maintenant SACI devient true => doit afficher
    isSaciBS.next(true);
    detect();
    expect(el('dynamic')).not.toBeNull();

    // SACI redevient false => doit cacher
    isSaciBS.next(false);
    detect();
    expect(el('dynamic')).toBeNull();
  });

  it('doit appeler les méthodes du service au moins une fois (wire-up)', () => {
    detect();
    expect(authSpy.isPaie$).toHaveBeenCalled();
    expect(authSpy.isSaci$).toHaveBeenCalled();
    expect(authSpy.isOsca$).toHaveBeenCalled();
  });

  it('ne doit pas planter si on toggles plusieurs fois (stabilité)', () => {
    detect();

    isPaieBS.next(true);
    detect();
    expect(el('paieOnly')).not.toBeNull();

    isPaieBS.next(false);
    detect();
    expect(el('paieOnly')).toBeNull();

    isPaieBS.next(true);
    detect();
    expect(el('paieOnly')).not.toBeNull();
  });
});
