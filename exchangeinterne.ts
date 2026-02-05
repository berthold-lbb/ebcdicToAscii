// app-navigation.service.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, combineLatest, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

import { AuthenticationService } from '.../core/services/authentication.service';
import { Role } from '.../core/model/enums';
import { RapportsNav } from './rapports-nav';

export type TabKey = 'conciliation' | 'recherche' | 'rapports' | 'utilitaires' | 'parametres';

export type TabRule = {
  anyOf?: readonly Role[];   // visible si l'user a au moins 1 rôle
  noneOf?: readonly Role[];  // visible si l'user n'a aucun rôle
};

export type TabDef = {
  key: TabKey;
  labelKey: string;
  rule?: TabRule;
};

@Injectable({ providedIn: 'root' })
export class AppNavigationService {
  // 1) Déclaration unique des onglets
  readonly allTabs: readonly TabDef[] = [
    { key: 'conciliation', labelKey: 'ONGLETS.CONCILIATION_LABEL' },
    { key: 'recherche', labelKey: 'ONGLETS.RECHERCHE_LABEL' },

    { key: 'rapports', labelKey: 'ONGLETS.RAPPORTS_LABEL', rule: { anyOf: RapportsNav.RAPPORTS_VIEW_ROLES } },
    { key: 'utilitaires', labelKey: 'ONGLETS.UTILITAIRES_LABEL', rule: { anyOf: RapportsNav.UTILITAIRES_VIEW_ROLES } },
    { key: 'parametres', labelKey: 'ONGLETS.PARAMETRES_LABEL', rule: { anyOf: RapportsNav.PARAMETRES_VIEW_ROLES } },
  ] as const;

  // 2) Tabs visibles selon rôles
  readonly visibleTabs$: Observable<readonly TabDef[]> = combineLatest(
    this.allTabs.map(t => this.isAllowed$(t).pipe(map(allowed => ({ t, allowed }))))
  ).pipe(
    map(xs => xs.filter(x => x.allowed).map(x => x.t)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(
    private readonly auth: AuthenticationService,
    private readonly router: Router
  ) {}

  navigateTo(key: TabKey): void {
    this.router.navigate(['/', key]);
  }

  private isAllowed$(tab: TabDef): Observable<boolean> {
    const rule = tab.rule;
    if (!rule) return of(true);

    if (rule.anyOf?.length) {
      return this.auth.hasRole(...rule.anyOf);
    }

    if (rule.noneOf?.length) {
      return this.auth.hasRole(...rule.noneOf).pipe(map(has => !has));
    }

    return of(true);
  }
}



// app-navigation.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AppNavigationService, TabKey, TabDef } from './app-navigation.service';

@Component({
  selector: 'app-navigation',
  templateUrl: './app-navigation.component.html',
})
export class AppNavigationComponent implements OnInit, OnDestroy {
  readonly tabs$ = this.nav.visibleTabs$;

  private sub = new Subscription();
  private tabsSnapshot: readonly TabDef[] = [];

  activePanel: TabKey = 'conciliation';

  constructor(
    private readonly nav: AppNavigationService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    // snapshot pour gérer l'index du dsdTabsChange
    this.sub.add(this.tabs$.subscribe(t => (this.tabsSnapshot = t)));

    // sync avec l'URL
    this.sub.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(() => this.syncActiveFromUrl())
    );

    this.syncActiveFromUrl();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  onTabsChange(evt: any): void {
    const idx = Number(evt?.detail?.activeItemIndex ?? 0);
    const key = this.tabsSnapshot[idx]?.key ?? this.tabsSnapshot[0]?.key ?? 'conciliation';
    this.nav.navigateTo(key);
  }

  isActive(key: TabKey): boolean {
    return this.activePanel === key;
  }

  private syncActiveFromUrl(): void {
    const urlPath = this.router.url.split('?')[0].split('#')[0];
    const firstSeg = urlPath.split('/')[1] as TabKey | undefined;

    const found = !!firstSeg && this.tabsSnapshot.some(t => t.key === firstSeg);
    this.activePanel = found
      ? (firstSeg as TabKey)
      : (this.tabsSnapshot[0]?.key ?? 'conciliation');
  }
}


<dsd-tab-group (dsdTabsChange)="onTabsChange($event)" remove-container="true">

  <div slot="tabs">
    @for (t of (tabs$ | async) ?? []; track t.key) {
      <dsd-tab [panel]="t.key">
        {{ t.labelKey | translate }}
      </dsd-tab>
    }
  </div>

  <div slot="panels">
    @for (t of (tabs$ | async) ?? []; track t.key) {
      <dsd-tab-panel [name]="t.key">
        @if (isActive(t.key)) {
          <router-outlet></router-outlet>
        }
      </dsd-tab-panel>
    }
  </div>

</dsd-tab-group>


<app-navigation></app-navigation>
