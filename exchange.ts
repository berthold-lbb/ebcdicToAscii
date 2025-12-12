🎯 Objectif du test

Simuler :

2 tabs (Tab A / Tab B)

chaque tab a son propre router-outlet nommé

navigation rapide + lazy + resize

observer :

logs de lifecycle

tailles incorrectes

parfois erreurs DSD

parfois rendu cassé

1️⃣ Template : tabs + router-outlets nommés (SANS ngIf)
<dsd-tab-group (dsdTabsChange)="onTabsChange($event)">
  <div slot="tabs">
    <dsd-tab panel="tabA">Tab A</dsd-tab>
    <dsd-tab panel="tabB">Tab B</dsd-tab>
  </div>

  <div slot="panels">
    <dsd-tab-panel name="tabA">
      <!-- Outlet A -->
      <router-outlet name="tabA"></router-outlet>
    </dsd-tab-panel>

    <dsd-tab-panel name="tabB">
      <!-- Outlet B -->
      <router-outlet name="tabB"></router-outlet>
    </dsd-tab-panel>
  </div>
</dsd-tab-group>


👉 Important :

les panels ne sont jamais détruits

les outlets sont toujours présents

on respecte le contrat DSD

2️⃣ Routes avec outlets nommés + lazy
export const routes: Routes = [
  {
    path: '',
    component: TabsHostComponent,
    children: [
      {
        path: 'a',
        outlet: 'tabA',
        loadComponent: () =>
          import('./pages/page-a.component').then(m => m.PageAComponent),
      },
      {
        path: 'b',
        outlet: 'tabA',
        loadComponent: () =>
          import('./pages/page-b.component').then(m => m.PageBComponent),
      },
      {
        path: 'c',
        outlet: 'tabB',
        loadComponent: () =>
          import('./pages/page-c.component').then(m => m.PageCComponent),
      },
      {
        path: 'd',
        outlet: 'tabB',
        loadComponent: () =>
          import('./pages/page-d.component').then(m => m.PageDComponent),
      },
    ],
  },
];

3️⃣ Navigation tabs → router
onTabsChange(evt: any) {
  const panel = evt?.detail?.activeTab?.panel;

  if (panel === 'tabA') {
    this.router.navigate([{ outlets: { tabA: ['a'] } }]);
  }

  if (panel === 'tabB') {
    this.router.navigate([{ outlets: { tabB: ['c'] } }]);
  }
}

4️⃣ Composant de test “probe” (clé pour voir le problème)

👉 Ce composant mesure sa taille au montage
👉 S’il est monté dans un panel caché → largeur = 0

@Component({
  standalone: true,
  template: `
    <div class="probe">
      <h3>{{ name }}</h3>
      <p>Width: {{ width }}</p>
      <button (click)="spam()">Spam navigation</button>
    </div>
  `,
  styles: [`
    .probe {
      border: 2px solid red;
      padding: 16px;
    }
  `]
})
export class ProbeComponent implements AfterViewInit, OnDestroy {
  @Input() name = '';
  width = 0;

  constructor(private el: ElementRef, private router: Router) {}

  ngAfterViewInit() {
    this.width = this.el.nativeElement.getBoundingClientRect().width;
    console.log(`[${this.name}] AfterViewInit width =`, this.width);
  }

  ngOnDestroy() {
    console.log(`[${this.name}] destroyed`);
  }

  spam() {
    // navigation rapide + microtasks
    for (let i = 0; i < 10; i++) {
      queueMicrotask(() => {
        this.router.navigate([{ outlets: { tabA: ['a'], tabB: ['c'] } }]);
      });
    }

    // forcer recalcul DSD
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }
}

5️⃣ Pages de test
@Component({
  standalone: true,
  imports: [ProbeComponent],
  template: `<app-probe name="Page A"></app-probe>`
})
export class PageAComponent {}

@Component({
  standalone: true,
  imports: [ProbeComponent],
  template: `<app-probe name="Page B"></app-probe>`
})
export class PageBComponent {}

@Component({
  standalone: true,
  imports: [ProbeComponent],
  template: `<app-probe name="Page C"></app-probe>`
})
export class PageCComponent {}

@Component({
  standalone: true,
  imports: [ProbeComponent],
  template: `<app-probe name="Page D"></app-probe>`
})
export class PageDComponent {}

6️⃣ Comment provoquer le problème (pas à pas)

Lance l’app

Clique Tab A

Clique Tab B

Alterne rapidement Tab A / Tab B

Dans une page, clique “Spam navigation”

Observe :

logs console

tailles affichées

rendu

7️⃣ Ce que tu DEVRAIS observer
🔴 Cas 1 — largeur = 0

Dans la console :

[Page C] AfterViewInit width = 0


➡️ composant monté dans un panel caché
➡️ AG-Grid / charts / tables casseront ici

🔴 Cas 2 — composants vivants mais invisibles

Tu verras :

[Page A] destroyed
[Page C] AfterViewInit
[Page A] AfterViewInit


➡️ deux outlets vivent en parallèle
➡️ pages “fantômes”

🔴 Cas 3 — comportement aléatoire

parfois tout marche

parfois rendu cassé

parfois DSD loggue une erreur (selon impl)

en prod → plus fréquent

👉 signature classique d’une race condition DOM