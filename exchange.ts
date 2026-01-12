Option A — DSD panels multiples, 1 seul RouterOutlet “vivant”
1) app.component.ts (Shell = AppComponent)
import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';

type TabKey = 'conciliation' | 'recherche' | 'rapports' | 'utilitaires' | 'parametres';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private readonly router = inject(Router);

  // ✅ Source unique: le mapping tab<->panel<->route
  readonly tabs = [
    { key: 'conciliation' as const, labelKey: 'ONGLETS.CONCILIATION_LABEL' },
    { key: 'recherche' as const, labelKey: 'ONGLETS.RECHERCHE_LABEL' },
    { key: 'rapports' as const, labelKey: 'ONGLETS.RAPPORTS_LABEL' },
    { key: 'utilitaires' as const, labelKey: 'ONGLETS.UTILITAIRES_LABEL' },
    { key: 'parametres' as const, labelKey: 'ONGLETS.PARAMETRES_LABEL' },
  ] as const;

  activePanel: TabKey = 'conciliation';

  constructor() {
    // ✅ URL = source de vérité (back/forward)
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.syncPanelFromUrl());

    this.syncPanelFromUrl();
  }

  onTabsChange(evt: any): void {
    // DSD te donne activeItemIndex (d’après ton screenshot)
    const idx = Number(evt?.detail?.activeItemIndex ?? 0);
    const key = this.tabs[idx]?.key ?? 'conciliation';

    // ✅ clic tab -> URL
    this.router.navigate(['/', key]);
  }

  isActive(key: TabKey): boolean {
    return this.activePanel === key;
  }

  private syncPanelFromUrl(): void {
    const urlPath = this.router.url.split('?')[0].split('#')[0];
    const firstSeg = urlPath.split('/')[1] as TabKey | undefined;

    const found = this.tabs.some(t => t.key === firstSeg);
    this.activePanel = found ? (firstSeg as TabKey) : 'conciliation';
  }
}

2) app.component.html (Angular 20 @for + @if)

👉 Ici on laisse la DSD faire son job (tab.panel ↔ tab-panel.name).
Mais le router-outlet n’existe que dans le panel actif.

<dsd-tab-group
  remove-container="true"
  background-color="dsd-color-background-page"
  (dsdTabChange)="onTabsChange($event)"
>
  <!-- Tabs -->
  <div slot="tabs" id="dsd-tab-group-main-menu-tabs">
    @for (t of tabs; track t.key) {
      <dsd-tab [attr.panel]="t.key">
        {{ t.labelKey | translate }}
      </dsd-tab>
    }
  </div>

  <!-- Panels (DSD a besoin du name qui match le panel) -->
  <div slot="panels">
    @for (t of tabs; track t.key) {
      <dsd-tab-panel [attr.name]="t.key">
        @if (isActive(t.key)) {
          <router-outlet></router-outlet>
        }
      </dsd-tab-panel>
    }
  </div>
</dsd-tab-group>

Équivalent *ngFor/*ngIf
<dsd-tab-group (dsdTabChange)="onTabsChange($event)" remove-container="true">
  <div slot="tabs">
    <dsd-tab *ngFor="let t of tabs" [attr.panel]="t.key">
      {{ t.labelKey | translate }}
    </dsd-tab>
  </div>

  <div slot="panels">
    <dsd-tab-panel *ngFor="let t of tabs" [attr.name]="t.key">
      <router-outlet *ngIf="activePanel === t.key"></router-outlet>
    </dsd-tab-panel>
  </div>
</dsd-tab-group>

Pourquoi c’est robuste ?

✅ DSD : tu respectes panel ↔ name

✅ Angular : 1 seul router-outlet vivant (grâce au @if)

✅ Maintenance : l’ordre / labels / clés sont dans un seul tableau

✅ Back/Forward : activePanel vient de l’URL (pas d’état caché)











import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'conciliation' },

  {
    path: 'conciliation',
    loadChildren: () =>
      import('./processus/conciliation/conciliation.routes').then(m => m.CONCILIATION_ROUTES),
  },
  {
    path: 'recherche',
    loadChildren: () =>
      import('./processus/recherche/recherche.routes').then(m => m.RECHERCHE_ROUTES),
  },
  {
    path: 'rapports',
    loadChildren: () =>
      import('./processus/rapports/rapports.routes').then(m => m.RAPPORTS_ROUTES),
  },
  {
    path: 'utilitaires',
    loadChildren: () =>
      import('./processus/utilitaires/utilitaires.routes').then(m => m.UTILITAIRES_ROUTES),
  },
  {
    path: 'parametres',
    loadChildren: () =>
      import('./processus/parametres/parametres.routes').then(m => m.PARAMETRES_ROUTES),
  },

  { path: '**', redirectTo: 'conciliation' },
];
