import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, Event } from '@angular/router';
import { filter, map, shareReplay } from 'rxjs/operators';
import { Observable, combineLatest, of } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';
import { Overlay } from '@angular/cdk/overlay';
import { Store } from '@ngxs/store';

import { AuthenticationService } from '.../core/services/authentication.service';
import { Role } from '.../core/model/enums';
import { RapportsNav } from './rapports-nav';

// adapte si tu extends BaseComponent
export type TabKey = 'conciliation' | 'recherche' | 'rapports' | 'utilitaires' | 'parametres';

type TabRule = {
  anyOf?: readonly Role[];   // doit avoir au moins 1 rôle de la liste
  noneOf?: readonly Role[];  // ne doit avoir aucun rôle de la liste
};

type TabDef = {
  key: TabKey;
  labelKey: string;
  rule?: TabRule;
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  // ---------- Tabs ----------
  readonly allTabs: readonly TabDef[] = [
    { key: 'conciliation', labelKey: 'ONGLETS.CONCILIATION_LABEL' },
    { key: 'recherche', labelKey: 'ONGLETS.RECHERCHE_LABEL' },

    // ✅ visible si ANY rôle
    { key: 'rapports', labelKey: 'ONGLETS.RAPPORTS_LABEL', rule: { anyOf: RapportsNav.RAPPORTS_VIEW_ROLES } },

    { key: 'utilitaires', labelKey: 'ONGLETS.UTILITAIRES_LABEL', rule: { anyOf: RapportsNav.UTILITAIRES_VIEW_ROLES } },

    // ✅ caché si l'user a un rôle de blocage
    { key: 'parametres', labelKey: 'ONGLETS.PARAMETRES_LABEL', rule: { noneOf: RapportsNav.PARAMETRES_BLOCK_ROLES } },
  ] as const;

  readonly visibleTabs$: Observable<readonly TabDef[]> = combineLatest(
    this.allTabs.map(tab =>
      this.isTabAllowed$(tab).pipe(map(allowed => ({ tab, allowed })))
    )
  ).pipe(
    map(results => results.filter(x => x.allowed).map(x => x.tab)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private visibleTabsSnapshot: readonly TabDef[] = [];

  activePanel: TabKey = 'conciliation';

  constructor(
    private readonly translateService: TranslateService,
    protected readonly router: Router,
    private readonly overlay: Overlay,
    private readonly store: Store,
    private readonly auth: AuthenticationService
  ) {
    this.translateService.setTranslation('fr-CA', {}, true);
    this.translateService.setDefaultLang('fr-CA');

    document.body.className += ' dsd-mode-compact';
  }

  ngOnInit(): void {
    // snapshot des tabs visibles pour onTabsChange (index)
    this.visibleTabs$.subscribe(tabs => (this.visibleTabsSnapshot = tabs));

    // sync panel depuis l'URL
    this.router.events
      .pipe(filter((e: Event): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.syncPanelFromUrl());

    this.syncPanelFromUrl();
  }

  onTabsChange(evt: any): void {
    const idx = Number(evt?.detail?.activeItemIndex ?? 0);
    const key = this.visibleTabsSnapshot[idx]?.key ?? 'conciliation';
    this.router.navigate(['/', key]);
  }

  isActive(key: TabKey): boolean {
    return this.activePanel === key;
  }

  private syncPanelFromUrl(): void {
    const urlPath = this.router.url.split('?')[0].split('#')[0];
    const firstSeg = urlPath.split('/')[1] as TabKey | undefined;

    // ⚠️ important : on se base sur les tabs visibles (pas allTabs)
    const found = this.visibleTabsSnapshot.some(t => t.key === firstSeg);
    this.activePanel = found ? (firstSeg as TabKey) : (this.visibleTabsSnapshot[0]?.key ?? 'conciliation');
  }

  private isTabAllowed$(tab: TabDef): Observable<boolean> {
    const rule = tab.rule;
    if (!rule) return of(true);

    if (rule.anyOf && rule.anyOf.length > 0) {
      return this.auth.hasRole(...rule.anyOf);
    }

    if (rule.noneOf && rule.noneOf.length > 0) {
      return this.auth.hasRole(...rule.noneOf).pipe(map(has => !has));
    }

    return of(true);
  }
}


<app-header></app-header>

<div class="onglets">
  <div class="libelle-app">
    <h4 class="dsd-color-font-brand dsd-m-0 dsd-p-0">
      {{ 'GLOBAL.LABELS.TITRE_APPLICATION' | translate }}
    </h4>
  </div>

  <dsd-tab-group
    (dsdTabsChange)="onTabsChange($event)"
    remove-container="true"
    background-color="dsd-color-background-page"
    class="dsd-w-100">

    <div slot="tabs" id="dsd-tab-group-main-menu-tabs">
      @for (t of (visibleTabs$ | async) ?? []; track t.key) {
        <dsd-tab [panel]="t.key">
          {{ t.labelKey | translate }}
        </dsd-tab>
      }
    </div>

    <div slot="panels">
      @for (t of (visibleTabs$ | async) ?? []; track t.key) {
        <dsd-tab-panel [name]="t.key">
          @if (isActive(t.key)) {
            <router-outlet></router-outlet>
          }
        </dsd-tab-panel>
      }
    </div>

  </dsd-tab-group>
</div>
