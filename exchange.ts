// src/app/features/parametres/regles-conciliation/facade/regles-conciliation.facade.ts
import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Subject,
  combineLatest,
  defer,
  merge,
  map,
  shareReplay,
  switchMap,
  startWith,
} from 'rxjs';

import { CompteGLRepository } from '../data/repositories/compte-gl.repository';
import { ReglesConciliationRepository } from '../data/repositories/regles-conciliation.repository';

import { InformationCompteGlBffDto } from '.../api/models/information-compte-gl-bff-dto';
import { ReglesParGlBffDto } from '.../api/models/regles-par-gl-bff-dto';
import { GetReglesParGl$Params } from '.../api/fn/conciliation-automatique/get-regles-par-gl';

type Vm = {
  comptes: InformationCompteGlBffDto[];
  reglesDto: ReglesParGlBffDto;
  selectedCompteId: string;
  comboOptions: string[][];
};

@Injectable({ providedIn: 'root' })
export class ReglesConciliationFacade {
  private readonly selectedCompteId$ = new BehaviorSubject<string>('tous');
  private readonly refreshRegles$ = new Subject<void>();

  // 1) Comptes -> chargés une seule fois (cache)
  readonly comptes$ = defer(() => this.compteRepo.loadComptesGL$({})).pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // 2) Trigger regles : sélection + refresh explicite
  private readonly reglesTrigger$ = merge(
    this.selectedCompteId$,
    this.refreshRegles$.pipe(
      switchMap(() => this.selectedCompteId$) // récupère le dernier id
    )
  ).pipe(startWith(this.selectedCompteId$.value));

  // 3) Règles -> rechargées selon sélection
  readonly reglesDto$ = this.reglesTrigger$.pipe(
    switchMap((id) => {
      const params: GetReglesParGl$Params =
        id === 'tous'
          ? { inclureTousLesGL: true }
          : { idCompteGL: id };

      return this.reglesRepo.loadRegles$(params);
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // 4) VM final pour le composant
  readonly vm$ = combineLatest([
    this.comptes$,
    this.reglesDto$,
    this.selectedCompteId$,
  ]).pipe(
    map(([comptes, reglesDto, selectedCompteId]): Vm => {
      const comboOptions: string[][] = [
        ['tous', 'Tous'],
        ...comptes.map((c) => [
          c.identifiantCompteGL ?? '',
          c.numeroCompteGL ?? c.identifiantCompteGL ?? '',
        ]),
      ];

      return { comptes, reglesDto, selectedCompteId, comboOptions };
    })
  );

  constructor(
    private readonly compteRepo: CompteGLRepository,
    private readonly reglesRepo: ReglesConciliationRepository
  ) {}

  setCompteSelection(id: string) {
    this.selectedCompteId$.next(id);
  }

  reloadRegles() {
    this.refreshRegles$.next();
  }

  // CRUD (exemples) : la façade orchestre et refresh
  // addRegle(payload: CreateRegleDto) {
  //   return this.reglesRepo.addRegle$(payload).pipe(tap(() => this.reloadRegles()));
  // }
}








 constructor(private readonly facade: ReglesConciliationFacade) {}
 
ngOnInit(): void {
    // 1) On s’abonne au VM
    this.facade.vm$
      .pipe(takeUntil(this.destroy$))
      .subscribe((vm) => {
        // options combobox
        this.comboBoxOptions = vm.comboOptions;
        this.valueCombobox = vm.selectedCompteId;

        // regles -> convert en liste pour AG Grid (selon ton DTO réel)
        this.regleList = this.extractRows(vm.reglesDto);

        // refresh grid si déjà initialisée
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.regleList);
        }
      });
  }