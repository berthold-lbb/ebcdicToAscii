1) Template du MenuComponent (avec conteneur 100%)

Tu gardes ton em-tab-group et tu mets un wrapper pour le contenu :

<em-tab-group (emTabsChange)="onTabsChange($event)" remove-container="true"
              background-color="em-color-background-page">
  <div slot="tabs" id="em-tab-group-main-menu-tabs">
    <em-tab panel="tab1" [active]="activeTab() === 'tab1'">
      {{ 'ONGLETS.CONCILIATION_LABEL' | translate }}
    </em-tab>
    <em-tab panel="tab2" [active]="activeTab() === 'tab2'">
      {{ 'ONGLETS.RECHERCHE_LABEL' | translate }}
    </em-tab>
    <em-tab panel="tab3" [active]="activeTab() === 'tab3'">
      {{ 'ONGLETS.RAPPORTS_LABEL' | translate }}
    </em-tab>
    <em-tab panel="tab4" [active]="activeTab() === 'tab4'">
      {{ 'ONGLETS.UTILITAIRES_LABEL' | translate }}
    </em-tab>
    <em-tab panel="tab5" [active]="activeTab() === 'tab5'">
      {{ 'ONGLETS.PARAMETRES_LABEL' | translate }}
    </em-tab>
  </div>
</em-tab-group>

<!-- Contenu principal -->
<div class="main-content">
  <router-outlet></router-outlet>
</div>

CSS (simple et efficace)
:host {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0; // important pour flex + scroll
}

.main-content {
  flex: 1 1 auto;
  min-height: 0;         // important : permet au contenu de scroller
  overflow: auto;        // scroll uniquement sur la zone content
  padding: 16px;         // optionnel
}

2) TS du MenuComponent : routing 1 outlet + “last route per tab”

Tu m’as montré que tu reçois evt.detail.activeItemIndex.
Donc ton mapping index → tab → url est direct.

Mapping

tab1 = conciliation

tab2 = recherche

tab3 = rapports

tab4 = utilitaires

tab5 = parametres

Code complet
import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';

type TabKey = 'tab1' | 'tab2' | 'tab3' | 'tab4' | 'tab5';

const INDEX_TO_TAB: Record<number, TabKey> = {
  0: 'tab1',
  1: 'tab2',
  2: 'tab3',
  3: 'tab4',
  4: 'tab5',
};

const TAB_TO_ROOT_URL: Record<TabKey, string> = {
  tab1: '/conciliation',
  tab2: '/recherche',
  tab3: '/rapports',
  tab4: '/utilitaires',
  tab5: '/parametres',
};

function tabFromUrl(url: string): TabKey {
  if (url.startsWith('/parametres')) return 'tab5';
  if (url.startsWith('/utilitaires')) return 'tab4';
  if (url.startsWith('/rapports')) return 'tab3';
  if (url.startsWith('/recherche')) return 'tab2';
  return 'tab1';
}

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
})
export class MenuComponent implements OnInit, OnDestroy {
  activeTab = signal<TabKey>('tab1');

  /** mémorise la dernière page visitée pour chaque tab */
  private lastUrlByTab: Partial<Record<TabKey, string>> = {};
  private sub?: Subscription;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    // initial sync (au refresh / deep-link)
    this.syncFromUrl(this.router.url);

    // keep in sync on navigation
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.syncFromUrl(e.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onTabsChange(evt: any): void {
    const idx: number = evt?.detail?.activeItemIndex ?? 0;
    const tab = INDEX_TO_TAB[idx] ?? 'tab1';

    // "last route per tab" : si je reviens sur Paramètres, je retourne là où j'étais
    const target = this.lastUrlByTab[tab] ?? TAB_TO_ROOT_URL[tab];

    // évite de re-naviguer si déjà dessus
    if (this.router.url !== target) {
      this.router.navigateByUrl(target);
    }
  }

  private syncFromUrl(url: string) {
    const tab = tabFromUrl(url);
    this.activeTab.set(tab);

    // on enregistre la dernière route pour ce tab
    // (permet de revenir sur /parametres/regles-conciliation automatiquement)
    this.lastUrlByTab[tab] = url;
  }
}


✅ Résultat :

Si tu es sur /parametres/regles-conciliation, puis tu vas sur Rapports, puis tu reviens sur Paramètres : tu reviens sur la même page interne.

Back/Forward fonctionne naturellement.

Refresh aussi.

Si tu veux reset Paramètres à chaque retour, il suffit de supprimer la logique lastUrlByTab et toujours naviguer vers TAB_TO_ROOT_URL[tab].

3) Routes : Shell + Paramètres (avec ParamètresNav + 4 pages)

Tu voulais intégrer ParamètresNav + les 4 pages.

app.routes.ts (routing top-level)
import { Routes } from '@angular/router';
import { MenuComponent } from './core/layout/menu.component';

export const APP_ROUTES: Routes = [
  {
    path: '',
    component: MenuComponent, // contient tabs + router-outlet
    children: [
      {
        path: 'conciliation',
        loadChildren: () =>
          import('./features/conciliation/conciliation.routes')
            .then(m => m.CONCILIATION_ROUTES),
      },
      {
        path: 'recherche',
        loadChildren: () =>
          import('./features/recherche/recherche.routes')
            .then(m => m.RECHERCHE_ROUTES),
      },
      {
        path: 'rapports',
        loadChildren: () =>
          import('./features/rapports/rapports.routes')
            .then(m => m.RAPPORTS_ROUTES),
      },
      {
        path: 'utilitaires',
        loadChildren: () =>
          import('./features/utilitaires/utilitaires.routes')
            .then(m => m.UTILITAIRES_ROUTES),
      },
      {
        path: 'parametres',
        loadChildren: () =>
          import('./features/parametres/parametres.routes')
            .then(m => m.PARAMETRES_ROUTES),
      },
      { path: '', redirectTo: 'conciliation', pathMatch: 'full' },
    ],
  },
];

4) features/parametres/parametres.routes.ts

Ici on applique le pattern “Paramètres = feature avec sous-pages”.

import { Routes } from '@angular/router';
import { ParametresNavPage } from './ui/pages/parametres-nav.page';
import { ComptesPage } from './ui/pages/comptes.page';
import { Folio13eopPage } from './ui/pages/folio13eop.page';
import { ReglesConciliationPage } from './ui/pages/regles-conciliation.page';
import { AliasEntreprisesPage } from './ui/pages/alias-entreprises.page';

// Optionnel: providers par page (facade/store/repository) si tu les scopes par route
export const PARAMETRES_ROUTES: Routes = [
  // /parametres
  { path: '', component: ParametresNavPage },

  // /parametres/comptes
  {
    path: 'comptes',
    component: ComptesPage,
    // providers: [...]
  },

  // /parametres/folio-13eop
  {
    path: 'folio-13eop',
    component: Folio13eopPage,
    // providers: [...]
  },

  // /parametres/regles-conciliation
  {
    path: 'regles-conciliation',
    component: ReglesConciliationPage,
    // providers: [...]
  },

  // /parametres/alias-entreprises
  {
    path: 'alias-entreprises',
    component: AliasEntreprisesPage,
    // providers: [...]
  },
];
