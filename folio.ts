import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Subject,
  Observable,
  combineLatest,
  merge,
  of,
} from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  startWith,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs/operators';

/**
 * NOTE IMPORTANT (Ken)
 * - 2e sélection = JAMAIS d'appel API.
 *   -> On appelle l'API uniquement quand le "filtre primaire" change (ENTITE: entiteId, COMPTE: compteId)
 *      ou lors d'un refresh / initFromCtx.
 * - Le 2e filtre (COMPTE en mode ENTITE, ENTITE en mode COMPTE) filtre localement sur les rows déjà chargées.
 * - Pas de patchState: on garde 1 seule source de vérité = criteriaSubject.
 */

// -----------------------------------------------------------------------------
// TYPES (ne PAS changer ConciliationTask)
// -----------------------------------------------------------------------------

export type Affichage = 'GESTION_TACHES' | 'TOUS_COMPTES';
export type ModeTravail = 'ENTITE' | 'COMPTE';

export interface GestionTachesCriteria {
  affichage: Affichage;
  modeTravail: ModeTravail;
  entiteId: string; // value = identifiantTransit
  compteId: string; // value = identifiantCompteGL
}

/**
 * ⚠️ On conserve ConciliationTask tel quel (avec ctx dedans)
 * ctx: le contexte technique caché
 */
export interface ConciliationTask {
  entite: string;
  compte: string;
  typeDeCompte: string;
  ctx: GestionTachesCriteria;
}

// -----------------------------------------------------------------------------
// DTOs (exemples - adapte si tes vrais noms diffèrent)
// -----------------------------------------------------------------------------

export interface TransitBffDto {
  identifiantTransit: string;
  transitEntite?: string | null;
  numeroInstitution?: string | null;
}

export interface InformationCompteGlBffDto {
  identifiantCompteGL: string;

  // Pour affichage (selon tes DTO réels)
  numeroCompteGL?: string | null;
  numeroInstitution?: string | null;
  libelleCompte?: string | null;

  // Valeurs possibles (certains projets utilisent string plutôt que boolean)
  compteGLOracle?: string | null;
  folioEop?: string | null;

  // Flags (si ton backend renvoie des booleans)
  compteGL?: boolean;
  compteGLOracleFlag?: boolean;
  folioEopFlag?: boolean;
}

export interface UiAlert {
  variant: 'error' | 'confirmation' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
}

export interface AppError {
  message?: string;
  status?: number;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface GestionTachesViewState {
  // critères
  affichage: Affichage;
  modeTravail: ModeTravail;
  selectedEntiteId: string;
  selectedCompteId: string;

  // options
  entiteOptions: SelectOption[];
  compteOptions: SelectOption[];

  // enable/disable
  isEntiteDisabled: boolean;
  isCompteDisabled: boolean;

  // data grid
  gridRows: ConciliationTask[];

  // alert
  alert: UiAlert | null;
}

export const initialCriteria: GestionTachesCriteria = {
  affichage: 'GESTION_TACHES',
  modeTravail: 'ENTITE',
  entiteId: '',
  compteId: '',
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function shallowCriteriaEqual(a: GestionTachesCriteria, b: GestionTachesCriteria): boolean {
  return (
    a.affichage === b.affichage &&
    a.modeTravail === b.modeTravail &&
    a.entiteId === b.entiteId &&
    a.compteId === b.compteId
  );
}

function primaryKey(c: GestionTachesCriteria): string {
  // Ce qui déclenche l'API
  return c.modeTravail === 'ENTITE' ? c.entiteId : c.compteId;
}

function hasValue(v: string | null | undefined): v is string {
  return !!v && v.trim().length > 0;
}

export function calcTypeDeCompte(c: InformationCompteGlBffDto): string {
  if (c.compteGL) return 'compteGL';
  if (c.compteGLOracle) return 'compteGLOracle';
  if (c.folioEop) return 'folioEop';
  return 'inconnu';
}

function toEntiteOption(t: TransitBffDto): SelectOption {
  const label = `${t.numeroInstitution ?? ''} ${t.transitEntite ?? ''}`.trim();
  return { value: t.identifiantTransit, label: label || t.identifiantTransit };
}

function toCompteOption(c: InformationCompteGlBffDto): SelectOption {
  const type = calcTypeDeCompte(c);
  const label = `${c.numeroInstitution ?? ''} ${c.numeroCompteGL ?? ''}`.trim();
  return {
    value: c.identifiantCompteGL,
    label: label || c.identifiantCompteGL,
  };
}

// -----------------------------------------------------------------------------
// Repo / Context (stubs - adapte aux signatures réelles)
// -----------------------------------------------------------------------------

export abstract class TacheConciliationAutomatiqueRepository {
  // Initial lists
  abstract obtenirTransitsAvecTacheNonTerminee$(): Observable<TransitBffDto[]>;
  abstract obtenirComptesGlAvecTacheNonTerminee$(): Observable<InformationCompteGlBffDto[]>;

  // Primary calls
  // Mode ENTITE: entiteId => retourne (rows + comptes dépendants)
  abstract obtenirComptesGlqvecTachesNonterminees$(idTransit: string): Observable<{
    rows: Array<{ transit: TransitBffDto; compte: InformationCompteGlBffDto }>; // adapte si besoin
    comptes: InformationCompteGlBffDto[];
  }>;

  // Mode COMPTE: compteId => retourne (rows + entités dépendantes)
  abstract obtenirTransitsAvectacheNonTerminee$(idCompteGl: string): Observable<{
    rows: Array<{ transit: TransitBffDto; compte: InformationCompteGlBffDto }>; // adapte si besoin
    entites: TransitBffDto[];
  }>;
}

export abstract class AuthContextFacade {
  abstract readonly isPaie$: Observable<boolean>;
  abstract readonly isSacis$: Observable<boolean>;
}

// -----------------------------------------------------------------------------
// BaseFacade minimal (on garde runEffect / runAction existants dans ton vrai code)
// -----------------------------------------------------------------------------

abstract class BaseFacade {
  protected readonly destroyRef = inject((null as unknown) as any);

  // On garde ton style (runEffect/runAction) — ici juste placeholders
  protected runEffect<T>(
    work$: Observable<T>,
    mapError: (err: unknown) => AppError,
    _opts?: {
      fallbackValue: T;
      useGlobalSpinner?: boolean;
      clearAlertOnStart?: boolean;
      error?: { title: string; fallbackMessage?: string };
    },
  ): Observable<T> {
    return work$.pipe(
      catchError((err) => {
        // dans ton vrai BaseFacade, tu poses alert + spinner
        void mapError(err);
        return of(_opts?.fallbackValue as T);
      }),
    );
  }

  protected clearAlert(): void {
    // noop
  }
}

// -----------------------------------------------------------------------------
// FACADE
// -----------------------------------------------------------------------------

@Injectable()
export class GestionTachesFacade extends BaseFacade {
  private readonly tacheConciliationAutoRepo = inject(TacheConciliationAutomatiqueRepository);
  private readonly authContext = inject(AuthContextFacade);

  /** source de vérité */
  private readonly criteriaSubject = new BehaviorSubject<GestionTachesCriteria>(initialCriteria);
  readonly criteria$ = this.criteriaSubject.asObservable().pipe(
    distinctUntilChanged(shallowCriteriaEqual),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** refresh: re-déclenche les flux même si critères identiques */
  private readonly refreshSubject = new Subject<void>();
  readonly refresh$ = this.refreshSubject.asObservable();

  // ---------------------------------------------------------------------------
  // 1) LOAD INITIAL LISTS (2 appels runEffect comme tu l'as dit)
  // ---------------------------------------------------------------------------

  private readonly entitesInitial$ = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() =>
      this.runEffect(
        this.tacheConciliationAutoRepo.obtenirTransitsAvecTacheNonTerminee$(),
        (err) => err as AppError,
        {
          fallbackValue: [],
          useGlobalSpinner: true,
          clearAlertOnStart: true,
          error: { title: 'Changement impossible', fallbackMessage: 'Impossible de charger les transits.' },
        },
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private readonly comptesInitial$ = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() =>
      this.runEffect(
        this.tacheConciliationAutoRepo.obtenirComptesGlAvecTacheNonTerminee$(),
        (err) => err as AppError,
        {
          fallbackValue: [],
          useGlobalSpinner: true,
          clearAlertOnStart: true,
          error: { title: 'Changement impossible', fallbackMessage: 'Impossible de charger les comptes.' },
        },
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private readonly initialLists$ = combineLatest([this.entitesInitial$, this.comptesInitial$]).pipe(
    map(([entites, comptes]) => ({ entites, comptes })),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------------------------------------------------------------------------
  // 2) LOAD DEPENDENT DATA (API uniquement sur filtre primaire)
  // ---------------------------------------------------------------------------

  /**
   * On déclenche l'API:
   * - quand (modeTravail + primaryKey) change
   * - OU quand refreshSubject émet (même si critères identiques)
   */
  private readonly primaryTrigger$ = merge(
    // changement primaire
    this.criteria$.pipe(
      map((c) => ({ c, k: `${c.modeTravail}|${primaryKey(c)}` })),
      distinctUntilChanged((a, b) => a.k === b.k),
      map(({ c }) => c),
    ),
    // refresh force
    this.refresh$.pipe(withLatestFrom(this.criteria$), map(([, c]) => c)),
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  private readonly selectionResults$ = this.primaryTrigger$.pipe(
    // On a besoin des listes initiales pour construire les labels (entité/compte)
    withLatestFrom(this.initialLists$),

    switchMap(([c, initial]) => {
      const pk = primaryKey(c);

      // si pas de filtre primaire, aucun appel (0 rows) + pas de dépendants
      if (!hasValue(pk)) {
        return of({
          baseRows: [] as ConciliationTask[],
          dependentEntites: [] as TransitBffDto[],
          dependentComptes: [] as InformationCompteGlBffDto[],
          c,
        });
      }

      // MODE ENTITE => API entiteId (on récupère la liste des comptes)
      if (c.modeTravail === 'ENTITE') {
        return this.runEffect(
          this.tacheConciliationAutoRepo.obtenirComptesGlqvecTachesNonterminees$(c.entiteId),
          (err) => err as AppError,
          {
            fallbackValue: { rows: [], comptes: [] },
            useGlobalSpinner: true,
            clearAlertOnStart: true,
            error: { title: 'Changement impossible', fallbackMessage: 'Impossible de charger les comptes.' },
          },
        ).pipe(
          map((res) => ({
            baseRows: this.mapRowsFromEntiteMode(c.entiteId, res.comptes, initial.entites, c),
            dependentEntites: [] as TransitBffDto[],
            dependentComptes: res.comptes,
            c,
          })),
        );
      }

      // MODE COMPTE => API compteId (on récupère la liste des entités)
      return this.runEffect(
        this.tacheConciliationAutoRepo.obtenirTransitsAvectacheNonTerminee$(c.compteId),
        (err) => err as AppError,
        {
          fallbackValue: { rows: [], entites: [] },
          useGlobalSpinner: true,
          clearAlertOnStart: true,
          error: { title: 'Changement impossible', fallbackMessage: 'Impossible de charger les transits.' },
        },
      ).pipe(
        map((res) => ({
          baseRows: this.mapRowsFromCompteMode(c.compteId, res.entites, initial.comptes, c),
          dependentEntites: res.entites,
          dependentComptes: [] as InformationCompteGlBffDto[],
          c,
        })),
      );
    }),

    /**
     * VALIDATION secondaire sur résultat API (au refresh / initFromCtx notamment)
     * - ENTITE: si compteId n'existe pas dans dependentComptes => on le retire (SANS rappeler l'API)
     * - COMPTE: si entiteId n'existe pas dans dependentEntites => on le retire (SANS rappeler l'API)
     */
    tap(({ c, dependentComptes, dependentEntites }) => {
      const cur = this.criteriaSubject.value;

      // si entre-temps on a changé de critères, on ne touche pas
      if (!shallowCriteriaEqual(cur, c)) return;

      if (c.modeTravail === 'ENTITE' && hasValue(c.compteId)) {
        const exists = dependentComptes.some((x) => x.identifiantCompteGL === c.compteId);
        if (!exists) {
          this.criteriaSubject.next({ ...c, compteId: '' });
        }
      }

      if (c.modeTravail === 'COMPTE' && hasValue(c.entiteId)) {
        const exists = dependentEntites.some((x) => x.identifiantTransit === c.entiteId);
        if (!exists) {
          this.criteriaSubject.next({ ...c, entiteId: '' });
        }
      }
    }),

    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------------------------------------------------------------------------
  // 3) VIEWSTATE (options + disabled + rows filtrées localement)
  // ---------------------------------------------------------------------------

  readonly viewState$: Observable<GestionTachesViewState> = combineLatest([
    this.criteria$,
    this.initialLists$,
    this.selectionResults$,
    this.authContext.isPaie$,
    this.authContext.isSacis$,
  ]).pipe(
    map(([c, initial, sel, isPaie, isSacis]) => {
      // options init
      const entitesInitOptions = initial.entites.map(toEntiteOption);
      const comptesInitOptions = initial.comptes.map(toCompteOption);

      // options dépendantes (selon mode)
      const entitesDependent = sel.dependentEntites.map(toEntiteOption);
      const comptesDependent = sel.dependentComptes.map(toCompteOption);

      // règles disabled
      const isModeEntite = c.modeTravail === 'ENTITE';
      const isModeCompte = c.modeTravail === 'COMPTE';

      const isEntiteDisabled = isModeCompte && !hasValue(c.compteId); // en mode COMPTE, entité disabled tant que compte pas choisi
      const isCompteDisabled = isModeEntite && !hasValue(c.entiteId); // en mode ENTITE, compte disabled tant que entité pas choisie

      // options finales affichées (symétriques)
      const entiteOptions = isModeCompte && hasValue(c.compteId) ? entitesDependent : entitesInitOptions;
      const compteOptions = isModeEntite && hasValue(c.entiteId) ? comptesDependent : comptesInitOptions;

      // 2e sélection = FILTRE LOCAL UNIQUEMENT
      const gridRows = this.applySecondFilterLocal(sel.baseRows, c);

      return {
        affichage: c.affichage,
        modeTravail: c.modeTravail,
        selectedEntiteId: c.entiteId,
        selectedCompteId: c.compteId,
        entiteOptions,
        compteOptions,
        isEntiteDisabled,
        isCompteDisabled,
        gridRows,
        alert: null,
      } satisfies GestionTachesViewState;
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------------------------------------------------------------------------
  // API PUBLIC (appelés par UI)
  // ---------------------------------------------------------------------------

  /**
   * Appelé quand on revient de l'écran traitement et qu'on reçoit un ctx complet.
   * -> On applique le ctx, puis on refresh (reload initialLists + validation).
   * (Pas dans le constructor)
   */
  initFromCtx(ctx?: Partial<GestionTachesCriteria> | null): void {
    if (!ctx) {
      this.refresh();
      return;
    }

    const next: GestionTachesCriteria = {
      ...this.criteriaSubject.value,
      ...ctx,
      // sécurité: jamais undefined
      entiteId: ctx.entiteId ?? this.criteriaSubject.value.entiteId,
      compteId: ctx.compteId ?? this.criteriaSubject.value.compteId,
      affichage: ctx.affichage ?? this.criteriaSubject.value.affichage,
      modeTravail: ctx.modeTravail ?? this.criteriaSubject.value.modeTravail,
    };

    this.criteriaSubject.next(next);
    this.refresh();
  }

  refresh(): void {
    this.refreshSubject.next();

    // Validation "forte" demandée :
    // Après reload initialLists, si primaire n'existe plus -> reset primaire + secondaire.
    // Sinon, on laisse l'API primaire se déclencher par refresh() et la validation secondaire se fait dans selectionResults$.
    this.initialLists$
      .pipe(takeOne(), withLatestFrom(this.criteria$))
      .subscribe(([initial, c]) => {
        if (c.modeTravail === 'ENTITE') {
          if (hasValue(c.entiteId)) {
            const exists = initial.entites.some((x) => x.identifiantTransit === c.entiteId);
            if (!exists) {
              this.criteriaSubject.next({ ...c, entiteId: '', compteId: '' });
            }
          }
        } else {
          if (hasValue(c.compteId)) {
            const exists = initial.comptes.some((x) => x.identifiantCompteGL === c.compteId);
            if (!exists) {
              this.criteriaSubject.next({ ...c, compteId: '', entiteId: '' });
            }
          }
        }
      });
  }

  setAffichage(affichage: Affichage): void {
    const c = this.criteriaSubject.value;
    if (c.affichage === affichage) return;

    // on garde le modeTravail, mais on reset les sélections pour rester propre
    this.criteriaSubject.next({
      ...c,
      affichage,
      entiteId: '',
      compteId: '',
    });

    // reload initialLists
    this.refresh();
  }

  setModeTravail(modeTravail: ModeTravail): void {
    const c = this.criteriaSubject.value;
    if (c.modeTravail === modeTravail) return;

    // switch mode = on reset les 2 ids (car primaire change)
    this.criteriaSubject.next({
      ...c,
      modeTravail,
      entiteId: '',
      compteId: '',
    });

    // pour remettre options cohérentes
    this.refresh();
  }

  /**
   * ENTITE choisie:
   * - en mode ENTITE => c'est le primaire => API (via criteria change)
   * - en mode COMPTE => c'est le secondaire => filtre local uniquement
   */
  setEntiteId(entiteId: string): void {
    const c = this.criteriaSubject.value;
    if (c.entiteId === entiteId) return;

    if (c.modeTravail === 'ENTITE') {
      // primaire => reset compteId
      this.criteriaSubject.next({ ...c, entiteId, compteId: '' });
      return;
    }

    // secondaire en mode COMPTE => aucun API
    this.criteriaSubject.next({ ...c, entiteId });
  }

  /**
   * COMPTE choisi:
   * - en mode COMPTE => primaire => API (via criteria change)
   * - en mode ENTITE => secondaire => filtre local uniquement
   */
  setCompteId(compteId: string): void {
    const c = this.criteriaSubject.value;
    if (c.compteId === compteId) return;

    if (c.modeTravail === 'COMPTE') {
      // primaire => reset entiteId
      this.criteriaSubject.next({ ...c, compteId, entiteId: '' });
      return;
    }

    // secondaire en mode ENTITE => aucun API
    this.criteriaSubject.next({ ...c, compteId });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  // ----------------------------------------------------------------------------
  // Mapping rows (⚠️ on garde ctx + typeDeCompte)
  // ----------------------------------------------------------------------------

  private mapRowsFromEntiteMode(
    entiteId: string,
    comptes: InformationCompteGlBffDto[],
    entitesInit: TransitBffDto[],
    c: GestionTachesCriteria,
  ): ConciliationTask[] {
    const entiteObject = entitesInit.find((t) => t.identifiantTransit === entiteId);
    const entiteLabel = `${entiteObject?.numeroInstitution ?? ''}${entiteObject?.transitEntite ?? ''}`.trim() || entiteId;

    return comptes.map((compte) => {
      // ⚠️ on privilégie les valeurs disponibles (selon tes DTO)
      const compteLabel =
        compte.numeroCompteGL ??
        compte.compteGLOracle ??
        compte.folioEop ??
        compte.identifiantCompteGL;

      return {
        entite: entiteLabel,
        compte: compteLabel,
        typeDeCompte: calcTypeDeCompte(compte),
        ctx: {
          affichage: c.affichage,
          modeTravail: 'ENTITE',
          entiteId,
          compteId: compte.identifiantCompteGL,
        },
      };
    });
  }

  private mapRowsFromCompteMode(
    compteId: string,
    entites: TransitBffDto[],
    comptesInit: InformationCompteGlBffDto[],
    c: GestionTachesCriteria,
  ): ConciliationTask[] {
    const selectedCompte = comptesInit.find((x) => x.identifiantCompteGL === compteId);

    const compteLabel =
      selectedCompte?.numeroCompteGL ??
      selectedCompte?.compteGLOracle ??
      selectedCompte?.folioEop ??
      compteId;

    const typeDeCompte = selectedCompte ? calcTypeDeCompte(selectedCompte) : 'inconnu';

    return entites.map((t) => {
      const entiteLabel = `${t.numeroInstitution ?? ''}${t.transitEntite ?? ''}`.trim() || t.identifiantTransit;
      return {
        entite: entiteLabel,
        compte: compteLabel,
        typeDeCompte,
        ctx: {
          affichage: c.affichage,
          modeTravail: 'COMPTE',
          entiteId: t.identifiantTransit,
          compteId,
        },
      };
    });
  }

  /**
   * Filtre local (2e sélection) — AUCUN appel API.
   * - Mode ENTITE: on a déjà des rows par entité (API primaire). Si compteId choisi => filtre local.
   * - Mode COMPTE: on a déjà des rows par compte (API primaire). Si entiteId choisi => filtre local.
   */
  private applySecondFilterLocal(baseRows: ConciliationTask[], c: GestionTachesCriteria): ConciliationTask[] {
    if (c.modeTravail === 'ENTITE') {
      if (!hasValue(c.compteId)) return baseRows;
      return baseRows.filter((r) => r.ctx.compteId === c.compteId);
    }

    if (!hasValue(c.entiteId)) return baseRows;
    return baseRows.filter((r) => r.ctx.entiteId === c.entiteId);
  }
}

// -----------------------------------------------------------------------------
// rx helper
// -----------------------------------------------------------------------------

function takeOne<T>() {
  return (src: Observable<T>) => src.pipe(take(1));
}

// local import to avoid clutter in the facade section
import { take } from 'rxjs/operators';


function shouldResetSecondary(
  c: GestionTachesCriteria,
  initial: { entites: { identifiantTransit: string }[]; comptes: { identifiantCompteGL: string }[] }
): Partial<GestionTachesCriteria> | null {
  if (c.modeTravail === 'ENTITE') {
    if (!hasValue(c.entiteId)) return null;
    const exists = initial.entites.some(x => x.identifiantTransit === c.entiteId);
    return exists ? null : { entiteId: '' };
  }

  // mode COMPTE
  if (!hasValue(c.compteId)) return null;
  const exists = initial.comptes.some(x => x.identifiantCompteGL === c.compteId);
  return exists ? null : { compteId: '' };
}

// --- dans ta façade ---
// Après reload initialLists, si primary n’existe plus => reset primary + secondaire
this.initialLists$
  .pipe(withLatestFrom(this.criteria$), take(1))
  .subscribe(([initial, c]) => {
    const patch = shouldResetSecondary(c, initial);
    if (!patch) return; // rien à faire

    this.criteriaSubject.next({ ...c, ...patch });
  });