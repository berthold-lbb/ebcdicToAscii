export type Affichage = 'GESTION_TACHES' | 'TOUS_COMPTES';
export type ModeTravail = 'ENTITE' | 'COMPTE';

export interface GestionTachesCriteria {
  affichage: Affichage;
  modeTravail: ModeTravail;
  entiteId: string | null; // valeur du combo entité (ex: transitEntite / numeroTransit)
  compteId: string | null; // value = identifiantCompteGL
}

export interface GridRowVm {
  entite: string;
  compte: string;
  typeDeCompte: string;
}

export interface GestionTachesViewState {
  // critères
  affichage: Affichage;
  modeTravail: ModeTravail;
  selectedEntiteId: string | null;
  selectedCompteId: string | null;

  // options UI
  entiteOptions: string[][]; // [[value,label], ...]
  compteOptions: string[][];

  // enabled/disabled
  isEntiteDisabled: boolean;
  isCompteDisabled: boolean;

  // grid
  rows: GridRowVm[];
}

export const initialCriteria: GestionTachesCriteria = {
  affichage: 'GESTION_TACHES',
  modeTravail: 'ENTITE',
  entiteId: null,
  compteId: null,
};

export const initialViewState: GestionTachesViewState = {
  affichage: initialCriteria.affichage,
  modeTravail: initialCriteria.modeTravail,
  selectedEntiteId: null,
  selectedCompteId: null,

  entiteOptions: [],
  compteOptions: [],

  isEntiteDisabled: false,
  isCompteDisabled: true,

  rows: [],
};



export function calcTypeDeCompte(c: InformationCompteGLBffDto): string {
  if (c.compteGL) return 'compteGL';
  if (c.compteGLOracle) return 'compteGLOracle';
  if (c.folioEop) return 'folioEop';
  if (c.fractionnable) return 'fractionnable';
  return 'inconnu';
}

export function toCompteOption(c: InformationCompteGLBffDto): string[] {
  // value = identifiant, label = numero
  return [c.identifiantCompteGL ?? '', c.numeroCompteGL ?? ''];
}

export function toEntiteOption(t: TransitBffDto): string[] {
  const value = t.transitEntite ?? t.numeroTransit ?? '';
  const label = t.nomTransit ?? value;
  return [value, label];
}




import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, switchMap } from 'rxjs/operators';
import {
  Affichage,
  ModeTravail,
  GestionTachesCriteria,
  GestionTachesViewState,
  initialCriteria,
  initialViewState,
  GridRowVm,
} from '../domain/gestion-taches.models';
import { TacheConciliationAutomatiqueRepository } from '../data/tache-conciliation-automatique.repository';
import { InformationCompteGLBffDto, TransitBffDto } from '../domain/dtos';
import { calcTypeDeCompte, toCompteOption, toEntiteOption } from '../domain/mappers';

@Injectable()
export class GestionTachesFacade {
  private readonly repo = inject(TacheConciliationAutomatiqueRepository);

  // source of truth
  private readonly criteriaSubject = new BehaviorSubject<GestionTachesCriteria>(initialCriteria);
  readonly criteria$ = this.criteriaSubject.asObservable().pipe(
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  // 1) initial lists (reload quand affichage change)
  private readonly initialLists$ = this.criteria$.pipe(
    map(c => c.affichage),
    distinctUntilChanged(),
    switchMap((affichage: Affichage) =>
      combineLatest({
        entites: this.repo.obtenirEntitesInitiales(affichage),
        comptes: this.repo.obtenirComptesInitiaux(affichage),
      })
    ),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  // 2) dependent selection (API + mapping rows)
  private readonly selectionResults$ = combineLatest([this.criteria$, this.initialLists$]).pipe(
    switchMap(([c, init]) => {
      // reset si rien sélectionné "actif"
      if (c.modeTravail === 'ENTITE' && !c.entiteId) {
        return of({
          dependentEntites: [] as TransitBffDto[],
          dependentComptes: [] as InformationCompteGLBffDto[],
          rows: [] as GridRowVm[],
        });
      }

      if (c.modeTravail === 'COMPTE' && !c.compteId) {
        return of({
          dependentEntites: [] as TransitBffDto[],
          dependentComptes: [] as InformationCompteGLBffDto[],
          rows: [] as GridRowVm[],
        });
      }

      // MODE ENTITE : entité -> API comptes
      if (c.modeTravail === 'ENTITE' && c.entiteId) {
        return this.repo.getComptesByEntite(c.entiteId).pipe(
          map((comptes: InformationCompteGLBffDto[]) => {
            const baseRows: GridRowVm[] = comptes.map(compte => ({
              entite: c.entiteId!, // fixe
              compte: compte.numeroCompteGL ?? '',
              typeDeCompte: calcTypeDeCompte(compte),
            }));

            // si compte choisi ensuite -> filtre grid (entite + compte)
            const filtered = c.compteId
              ? baseRows.filter(r => {
                  // on filtre via l'ID, donc on retrouve le DTO correspondant
                  const dto = comptes.find(x => x.identifiantCompteGL === c.compteId);
                  const label = dto?.numeroCompteGL ?? '';
                  return r.compte === label;
                })
              : baseRows;

            return {
              dependentEntites: [] as TransitBffDto[],
              dependentComptes: comptes, // combo compte dépendant
              rows: filtered,
            };
          })
        );
      }

      // MODE COMPTE : compte -> API entités
      if (c.modeTravail === 'COMPTE' && c.compteId) {
        return this.repo.getEntitesByCompte(c.compteId).pipe(
          map((entites: TransitBffDto[]) => {
            // compte sélectionné vient des comptes initiaux (pour type + label)
            const selectedCompte = init.comptes.find(x => x.identifiantCompteGL === c.compteId);
            const compteLabel = selectedCompte?.numeroCompteGL ?? '';
            const typeCompte = selectedCompte ? calcTypeDeCompte(selectedCompte) : 'inconnu';

            const baseRows: GridRowVm[] = entites.map(t => {
              const entiteValue = t.transitEntite ?? t.numeroTransit ?? '';
              return {
                entite: entiteValue,
                compte: compteLabel,   // fixe
                typeDeCompte: typeCompte, // fixe
              };
            });

            // si entité choisie ensuite -> filtre
            const filtered = c.entiteId
              ? baseRows.filter(r => r.entite === c.entiteId)
              : baseRows;

            return {
              dependentEntites: entites, // combo entité dépendant
              dependentComptes: [] as InformationCompteGLBffDto[],
              rows: filtered,
            };
          })
        );
      }

      return of({
        dependentEntites: [] as TransitBffDto[],
        dependentComptes: [] as InformationCompteGLBffDto[],
        rows: [] as GridRowVm[],
      });
    }),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  // 3) viewState unique
  readonly viewState$: Observable<GestionTachesViewState> = combineLatest([
    this.criteria$,
    this.initialLists$,
    this.selectionResults$,
  ]).pipe(
    map(([c, init, sel]) => {
      // options de base
      const entitesInitOptions = init.entites.map(toEntiteOption);
      const comptesInitOptions = init.comptes.map(toCompteOption);

      // rules disabled + options
      const isModeEntite = c.modeTravail === 'ENTITE';
      const isModeCompte = c.modeTravail === 'COMPTE';

      const entiteOptions = isModeCompte && c.compteId
        ? sel.dependentEntites.map(toEntiteOption) // entités par compte
        : entitesInitOptions;

      const compteOptions = isModeEntite && c.entiteId
        ? sel.dependentComptes.map(toCompteOption) // comptes par entité
        : comptesInitOptions;

      const isEntiteDisabled = isModeCompte && !c.compteId; // en mode compte: entité disabled tant que compte pas choisi
      const isCompteDisabled = isModeEntite && !c.entiteId; // en mode entité: compte disabled tant que entité pas choisie

      return {
        ...initialViewState,

        affichage: c.affichage,
        modeTravail: c.modeTravail,
        selectedEntiteId: c.entiteId,
        selectedCompteId: c.compteId,

        entiteOptions,
        compteOptions,

        isEntiteDisabled,
        isCompteDisabled,

        rows: sel.rows,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  // --------------------
  // SETTERS (appelés par UI)
  // --------------------

  setAffichage(affichage: Affichage) {
    const c = this.criteriaSubject.value;
    if (c.affichage === affichage) return;

    // reset complet + reload initial lists via affichage
    this.criteriaSubject.next({
      affichage,
      modeTravail: 'ENTITE',
      entiteId: null,
      compteId: null,
    });
  }

  setModeTravail(modeTravail: ModeTravail) {
    const c = this.criteriaSubject.value;
    if (c.modeTravail === modeTravail) return;

    // switch => reset sélections + grid/dépendants via selectionResults$
    this.criteriaSubject.next({
      ...c,
      modeTravail,
      entiteId: null,
      compteId: null,
    });
  }

  // on ne change PAS le mode ici (le mode est géré par radio)
  setEntiteId(entiteId: string | null) {
    const c = this.criteriaSubject.value;
    if (c.modeTravail !== 'ENTITE' && c.modeTravail !== 'COMPTE') return;
    if (c.entiteId === entiteId) return;

    // Quand on choisit l'entité en mode ENTITE -> on garde compteId (pour filtrer si l'user a choisi après)
    // Quand on choisit l'entité en mode COMPTE -> c'est le 2e filtre, donc on garde compteId
    this.criteriaSubject.next({
      ...c,
      entiteId,
    });
  }

  setCompteId(compteId: string | null) {
    const c = this.criteriaSubject.value;
    if (c.compteId === compteId) return;

    // Quand compte choisi en mode COMPTE -> on garde entiteId (2e filtre possible)
    // Quand compte choisi en mode ENTITE -> c'est le 2e filtre, on garde entiteId
    this.criteriaSubject.next({
      ...c,
      compteId,
    });
  }

  clearSelections() {
    const c = this.criteriaSubject.value;
    this.criteriaSubject.next({ ...c, entiteId: null, compteId: null });
  }
}
