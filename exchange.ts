Service API (si tu ne l’as pas encore)
// services/filters-api.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs';

export type MatchingMode = 'No matched yet' | 'Matched';

export interface SearchFormValue {
  startDate: string;  endDate: string;
  matchAccount: string | null;
  matchTag?: string | null;
  matchMode: MatchingMode;
  limit: number; offset: number;
}
export type FiltersMap = Record<string, SearchFormValue>;

export interface ConcilUserDto {
  idUser?: number | null;
  username: string;
  metadata: string | null; // JSON string côté API: { "filtres": { [name]: SearchFormValue } }
}

@Injectable({ providedIn: 'root' })
export class FiltersApiService {
  constructor(private http: HttpClient) {}

  getFilters(username: string): Observable<FiltersMap> {
    return this.http.get<ConcilUserDto>(`/api/details/${encodeURIComponent(username)}`)
      .pipe(map(dto => this.parse(dto?.metadata)));
  }

  private postFilters(username: string, filters: FiltersMap): Observable<void> {
    const body: ConcilUserDto = {
      username,
      metadata: JSON.stringify({ filtres: filters })
    };
    return this.http.post<void>(`/api/details`, body);
  }

  saveCurrent(username: string, current: FiltersMap, payload: SearchFormValue): Observable<FiltersMap> {
    const name = this.autoName();
    const merged: FiltersMap = { ...current, [name]: payload };
    return this.postFilters(username, merged).pipe(
      switchMap(() => this.getFilters(username))
    );
  }

  deleteByName(username: string, current: FiltersMap, name: string): Observable<FiltersMap> {
    const { [name]: _drop, ...rest } = current;
    return this.postFilters(username, rest).pipe(
      switchMap(() => this.getFilters(username))
    );
  }

  private parse(metadata: string | null | undefined): FiltersMap {
    if (!metadata) return {};
    try { return (JSON.parse(metadata)?.filtres ?? {}) as FiltersMap; }
    catch { return {}; }
  }

  private autoName(): string {
    const p = (n:number)=>n<10?`0${n}`:`${n}`;
    const d = new Date();
    return `Filtre ${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}

Composant transactions-search (TS)
// components/transactions-search/transactions-search.component.ts
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, map, startWith, Subject, takeUntil } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FiltersApiService, FiltersMap, MatchingMode, SearchFormValue } from '../../services/filters-api.service';

@Component({
  selector: 'app-transactions-search',
  templateUrl: './transactions-search.component.html',
  styleUrls: ['./transactions-search.component.scss']
})
export class TransactionsSearchComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private api = inject(FiltersApiService);
  private snack = inject(MatSnackBar);
  private destroy$ = new Subject<void>();

  /** utilisateur pour /api/details/{username} */
  @Input() username = 'test';

  /** options de comptes si besoin */
  @Input() accountOptions: string[] = [];

  /** hook facultatif : si tu veux que le parent prenne la main sur la recherche */
  @Input() onSearch: (payload: SearchFormValue) => void = () => {};

  /** Filtres chargés depuis l'API (et rafraîchis après save/delete) */
  filters: FiltersMap = {};

  /** états UI */
  saving = false;
  deleting = false;
  loadingFilters = false;

  // ===== Form =====
  form: FormGroup<{
    startDate: FormControl<Date | null>;
    endDate:   FormControl<Date | null>;
    matchMode: FormControl<MatchingMode>;
    matchAccount: FormControl<string | null>;
    matchTag: FormControl<string | null>;
    limit: FormControl<number>;
    offset: FormControl<number>;
  }> = this.fb.group({
    startDate:   this.fb.control<Date | null>(null, { validators: [Validators.required] }),
    endDate:     this.fb.control<Date | null>(null, { validators: [Validators.required] }),
    matchMode:   this.fb.control<MatchingMode>('No matched yet', { nonNullable: true }),
    matchAccount:this.fb.control<string | null>(null),
    matchTag:    this.fb.control<string | null>(null),
    limit:       this.fb.control<number>(50, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    offset:      this.fb.control<number>(0,  { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
  });

  private get modeCtrl(): AbstractControl<MatchingMode | null> { return this.form.get('matchMode')!; }
  private get tagCtrl():  AbstractControl<string | null>       { return this.form.get('matchTag')!; }
  private get startCtrl():AbstractControl<Date | null>         { return this.form.get('startDate')!; }
  private get endCtrl():  AbstractControl<Date | null>         { return this.form.get('endDate')!; }

  ngOnInit(): void {
    this.loadFilters();

    // matchTag requis seulement en "No matched yet"
    this.modeCtrl.valueChanges.pipe(startWith(this.modeCtrl.value), takeUntil(this.destroy$))
      .subscribe(mode => {
        if (mode === 'No matched yet') {
          this.tagCtrl.addValidators([Validators.required]);
        } else {
          this.tagCtrl.clearValidators();
          this.tagCtrl.setValue(null, { emitEvent: false });
        }
        this.tagCtrl.updateValueAndValidity({ emitEvent: false });
      });

    // auto-search après 700ms si le form est valide
    this.form.valueChanges.pipe(
      debounceTime(700),
      map(() => this.form.valid),
      filter(Boolean),
      map(() => this.serialize(this.form.getRawValue())),
      takeUntil(this.destroy$)
    ).subscribe(payload => this.fireSearch(payload));
  }

  ngOnDestroy(): void {
    this.destroy$.next(); this.destroy$.complete();
  }

  // ======== Actions UI ========

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.fireSearch(this.serialize(this.form.getRawValue()));
  }

  saveCurrentFilter(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const payload = this.serialize(this.form.getRawValue());
    this.saving = true;
    this.api.saveCurrent(this.username, this.filters, payload).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: f => { this.filters = f; this.snack.open('Filtre enregistré', 'OK', { duration: 1600 }); },
        error: () => this.snack.open('Erreur: enregistrement filtre', 'Fermer', { duration: 2500 }),
        complete: () => this.saving = false
      });
    // active tout de suite
    this.fireSearch(payload);
  }

  applyFilter(name: string): void {
    const f = this.filters[name];
    if (!f) return;
    this.patchFromSaved(f);
    if (this.form.valid) this.fireSearch(this.serialize(this.form.getRawValue()));
  }

  deleteFilter(name: string): void {
    this.deleting = true;
    this.api.deleteByName(this.username, this.filters, name).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: f => { this.filters = f; this.snack.open('Filtre supprimé', 'OK', { duration: 1600 }); },
        error: () => this.snack.open('Erreur: suppression filtre', 'Fermer', { duration: 2500 }),
        complete: () => this.deleting = false
      });
  }

  // ======== API Filtres ========

  private loadFilters(): void {
    this.loadingFilters = true;
    this.api.getFilters(this.username).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: f => this.filters = f,
        error: () => this.snack.open('Erreur: chargement filtres', 'Fermer', { duration: 2500 }),
        complete: () => this.loadingFilters = false
      });
  }

  // ======== Recherche (interne ou déléguée) ========

  private fireSearch(payload: SearchFormValue): void {
    // Ici tu peux appeler ton vrai service de recherche si tu veux tout faire dans ce composant.
    // Exemple :
    // this.transactionsService.search(payload).subscribe(...)

    // Ou bien déléguer au parent via la fonction Input:
    try { this.onSearch(payload); } catch {}
    // À défaut, on logge :
    // console.log('SEARCH payload', payload);
  }

  // ======== Utils ========

  private serialize(raw: any): SearchFormValue {
    const toIso = (v: any) => v ? new Date(v).toISOString() : '';
    return {
      startDate: toIso(raw.startDate),
      endDate:   toIso(raw.endDate),
      matchAccount: raw.matchAccount ?? null,
      matchTag: raw.matchTag ?? null,
      matchMode: raw.matchMode,
      limit: Number(raw.limit ?? 50),
      offset: Number(raw.offset ?? 0),
    };
  }

  private patchFromSaved(p: SearchFormValue): void {
    this.form.patchValue({
      startDate: p.startDate ? new Date(p.startDate) : null,
      endDate:   p.endDate   ? new Date(p.endDate)   : null,
      matchAccount: p.matchAccount ?? null,
      matchTag: p.matchTag ?? null,
      matchMode: p.matchMode,
      limit: p.limit,
      offset: p.offset
    }, { emitEvent: true });
  }
}

Template (HTML)
<!-- transactions-search.component.html -->
<mat-card class="search-card" [class.is-disabled]="form.invalid">
  <!-- LIGNE 1 : critères principaux -->
  <div class="toolbar-row">
    <app-date-time-picker class="field" formControlName="startDate" label="Start Date" [required]="true" [withTimeOnPick]="true" [injectNowOnFocus]="true"></app-date-time-picker>
    <app-date-time-picker class="field" formControlName="endDate"   label="End Date"   [required]="true" [withTimeOnPick]="true" [injectNowOnFocus]="true"></app-date-time-picker>

    <mat-form-field class="field" appearance="fill">
      <mat-label>Compte</mat-label>
      <input matInput formControlName="matchAccount" [matAutocomplete]="autoAcc">
    </mat-form-field>
    <mat-autocomplete #autoAcc="matAutocomplete">
      <mat-option *ngFor="let a of accountOptions" [value]="a">{{ a }}</mat-option>
    </mat-autocomplete>

    <mat-form-field class="field narrow" appearance="fill">
      <mat-label>Limit*</mat-label>
      <input matInput type="number" min="1" formControlName="limit">
    </mat-form-field>

    <mat-form-field class="field narrow" appearance="fill">
      <mat-label>Offset*</mat-label>
      <input matInput type="number" min="0" formControlName="offset">
    </mat-form-field>
  </div>

  <!-- LIGNE 2 : switch + matchTag + actions -->
  <div class="toolbar-row two">
    <!-- Switch Matching -->
    <div class="toggle-wrap">
      <span class="toggle-label">Matching:</span>
      <mat-button-toggle-group formControlName="matchMode" aria-label="Matching status">
        <mat-button-toggle value="No matched yet">No matched yet</mat-button-toggle>
        <mat-button-toggle value="Matched">Matched</mat-button-toggle>
      </mat-button-toggle-group>
    </div>

    <!-- Match Tag (visible seulement si No matched yet) -->
    <ng-container *ngIf="form.get('matchMode')!.value === 'No matched yet'">
      <mat-form-field class="field tag" appearance="fill">
        <mat-label>Match Tag</mat-label>
        <input matInput formControlName="matchTag" placeholder="ex: TAG_ABC_2025">
      </mat-form-field>
    </ng-container>

    <!-- Boutons -->
    <div class="btn">
      <button mat-raised-button color="primary" type="button" (click)="submit()" [disabled]="form.invalid">Recherche</button>

      <button mat-stroked-button color="accent" type="button" (click)="saveCurrentFilter()" [disabled]="form.invalid || saving">
        <mat-icon>save</mat-icon> Enregistrer mon filtre
      </button>

      <button mat-stroked-button color="accent" [matMenuTriggerFor]="filterMenu" type="button">
        <mat-icon>list</mat-icon> Mes filtres
      </button>
      <mat-menu #filterMenu="matMenu" xPosition="after">
        <ng-container *ngIf="loadingFilters">
          <button mat-menu-item disabled><mat-icon>hourglass_top</mat-icon> Chargement…</button>
        </ng-container>

        <ng-container *ngIf="!loadingFilters && (filters | keyvalue).length === 0">
          <button mat-menu-item disabled><mat-icon>info</mat-icon> Aucun filtre</button>
        </ng-container>

        <ng-container *ngFor="let kv of filters | keyvalue">
          <button mat-menu-item (click)="applyFilter(kv.key)">
            <mat-icon>check_circle</mat-icon>
            <span>{{ kv.key }}</span>
          </button>
          <button mat-menu-item (click)="deleteFilter(kv.key)" [disabled]="deleting">
            <mat-icon color="warn">delete</mat-icon>
            <span>Supprimer "{{ kv.key }}"</span>
          </button>
          <mat-divider></mat-divider>
        </ng-container>
      </mat-menu>
    </div>
  </div>
</mat-card>

Styles (SCSS)
/* transactions-search.component.scss */
.search-card { padding: 12px; }
.is-disabled { opacity: .6; pointer-events: none; }

.toolbar-row {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding-bottom: 6px;
  &.two { padding-top: 6px; }
}
.field { width: 280px; }
.field.narrow { width: 120px; }
.field.tag { width: 260px; }

.toggle-wrap { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.toggle-label { font-size: 12px; color: rgba(0,0,0,.6); }
.btn { display: flex; gap: 8px; margin-left: auto; }

Ce que ça fait exactement

Chargement initial : loadFilters() appelle GET /api/details/{username} et alimente filters.

Recherche automatique : 700 ms après tout changement du formulaire valide → fireSearch(payload).

Bouton “Recherche” : lance fireSearch immédiatement.

Bouton “Enregistrer mon filtre” :

vérifie la validité,

envoie payload à saveCurrent(), qui POST le metadata (merge + stringify) puis recharge la liste,

active le filtre immédiatement (appel fireSearch).

“Mes filtres” : menu listant les noms (clé du map).

Cliquer applique: patch form + recherche.

Supprimer enlève la clé côté API, recharge la liste.

Tu peux brancher ta vraie recherche côté page en passant une fonction :

<app-transactions-search [username]="user.name" [onSearch]="handleSearch"></app-transactions-search>

handleSearch = (payload: SearchFormValue) => {
  // ici ton appel REST principal…
};


Sinon, laisse tel quel : fireSearch peut directement appeler ton service de transactions depuis ce composant.

Vous avez dit :

\*ngIf\="

trop de ngif dans ta solution
ChatGPT a dit :
Réflexion durant 22s

Tu as raison — on peut supprimer tous les *ngIf et garder un seul *ngFor (pour la liste des filtres).
Idée : on ne “cache” plus les éléments, on les désactive / grise via des bindings ([disabled], [style.visibility], [style.display]).
Pour le menu, on construit une vue plate en TS (menuView) qui contient “loading / empty / item / divider”, et on la rend avec un unique *ngFor.

Voici uniquement les morceaux à remplacer (TS + HTML). Tu gardes le reste tel quel.

TS — vue du menu sans *ngIf
// …imports et classe comme avant…

type MenuRow =
  | { kind: 'loading'; label: string }
  | { kind: 'empty';   label: string }
  | { kind: 'item';    name: string }
  | { kind: 'divider' };

get menuView(): MenuRow[] {
  if (this.loadingFilters) return [{ kind: 'loading', label: 'Chargement…' }];
  const names = Object.keys(this.filters ?? {});
  if (names.length === 0) return [{ kind: 'empty', label: 'Aucun filtre' }];
  // items + dividers alternés
  const rows: MenuRow[] = [];
  names.forEach((name, idx) => {
    rows.push({ kind: 'item', name });
    if (idx < names.length - 1) rows.push({ kind: 'divider' });
  });
  return rows;
}

// visibilité/état du champ matchTag (sans ngIf)
get isNoMatched(): boolean {
  return this.form.get('matchMode')!.value === 'No matched yet';
}

HTML — plus de *ngIf (un seul *ngFor)
<mat-card class="search-card" [class.is-disabled]="form.invalid">
  <!-- LIGNE 1 -->
  <div class="toolbar-row">
    <app-date-time-picker class="field" formControlName="startDate"
      label="Start Date" [required]="true" [withTimeOnPick]="true" [injectNowOnFocus]="true">
    </app-date-time-picker>

    <app-date-time-picker class="field" formControlName="endDate"
      label="End Date" [required]="true" [withTimeOnPick]="true" [injectNowOnFocus]="true">
    </app-date-time-picker>

    <mat-form-field class="field" appearance="fill">
      <mat-label>Compte</mat-label>
      <input matInput formControlName="matchAccount" [matAutocomplete]="autoAcc">
    </mat-form-field>
    <mat-autocomplete #autoAcc="matAutocomplete">
      <mat-option *ngFor="let a of accountOptions" [value]="a">{{ a }}</mat-option>
    </mat-autocomplete>

    <mat-form-field class="field narrow" appearance="fill">
      <mat-label>Limit*</mat-label>
      <input matInput type="number" min="1" formControlName="limit">
    </mat-form-field>

    <mat-form-field class="field narrow" appearance="fill">
      <mat-label>Offset*</mat-label>
      <input matInput type="number" min="0" formControlName="offset">
    </mat-form-field>
  </div>

  <!-- LIGNE 2 -->
  <div class="toolbar-row two">
    <div class="toggle-wrap">
      <span class="toggle-label">Matching:</span>
      <mat-button-toggle-group formControlName="matchMode" aria-label="Matching status">
        <mat-button-toggle value="No matched yet">No matched yet</mat-button-toggle>
        <mat-button-toggle value="Matched">Matched</mat-button-toggle>
      </mat-button-toggle-group>
    </div>

    <!-- Match Tag : même champ, jamais supprimé du DOM.
         On gère visibilité + disable sans *ngIf -->
    <mat-form-field class="field tag" appearance="fill"
      [style.visibility]="isNoMatched ? 'visible' : 'hidden'"
      [style.width.px]="isNoMatched ? 260 : 0">
      <mat-label>Match Tag</mat-label>
      <input matInput formControlName="matchTag" placeholder="ex: TAG_ABC_2025"
             [disabled]="!isNoMatched">
    </mat-form-field>

    <div class="btn">
      <button mat-raised-button color="primary" type="button"
              (click)="submit()" [disabled]="form.invalid">
        Recherche
      </button>

      <button mat-stroked-button color="accent" type="button"
              (click)="saveCurrentFilter()" [disabled]="form.invalid || saving">
        <mat-icon>save</mat-icon> Enregistrer mon filtre
      </button>

      <button mat-stroked-button color="accent" [matMenuTriggerFor]="filterMenu" type="button">
        <mat-icon>list</mat-icon> Mes filtres
      </button>

      <!-- Menu : un seul *ngFor -->
      <mat-menu #filterMenu="matMenu" xPosition="after">
        <ng-container *ngFor="let row of menuView">
          <button mat-menu-item
                  [disabled]="row.kind !== 'item' || deleting"
                  (click)="row.kind === 'item' && applyFilter(row.name)">
            <mat-icon *ngIf="row.kind==='item'">check_circle</mat-icon>
            <mat-icon *ngIf="row.kind==='loading'">hourglass_top</mat-icon>
            <mat-icon *ngIf="row.kind==='empty'">info</mat-icon>
            <span>
              {{ row.kind === 'item' ? row.name : (row.kind === 'loading' ? 'Chargement…' : 'Aucun filtre') }}
            </span>
          </button>

          <button mat-menu-item
                  [style.display]="row.kind==='item' ? '' : 'none'"
                  (click)="deleteFilter((row as any).name)"
                  [disabled]="deleting">
            <mat-icon color="warn">delete</mat-icon>
            <span>Supprimer "{{ (row as any).name }}"</span>
          </button>

          <mat-divider [style.display]="row.kind==='divider' ? '' : 'none'"></mat-divider>
        </ng-container>
      </mat-menu>
    </div>
  </div>
</mat-card>