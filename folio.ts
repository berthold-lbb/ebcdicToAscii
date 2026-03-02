import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef,
  ColGroupDef,
  GridApi,
  GridReadyEvent,
  ValueFormatterParams,
  ICellEditorParams,
} from 'ag-grid-community';
import { combineLatest, distinctUntilChanged, map, startWith } from 'rxjs';

// ====== Types utilitaires
type AccountType = 'GL_ORACLE' | 'GL' | 'FOLIO' | 'ENCAISSE' | 'UNKNOWN';
type GridVariant = 'SASI_GL' | 'SASI_FOLIO' | 'PAIE_GL' | 'PAIE_GL_ORACLE' | 'DEFAULT';

// ====== Editables (screen 7)
const EDITABLE_FIELDS = new Set([
  // ⚠️ adapte aux fields réels
  'ch',
  'date',
  'ps',
  'csr',
  'description',
  's',
  'c',
  'esc',
  'suivi',
  'swat',
  'commentaireConciliation',
  'commentaireAnalyse',
]);

function isEditableField(field?: string): boolean {
  return !!field && EDITABLE_FIELDS.has(field);
}

function defaultTextFormatter(p: ValueFormatterParams) {
  return p.value ?? '';
}

function mkCol(
  field: string,
  headerName: string,
  extra?: Partial<ColDef>
): ColDef {
  return {
    field,
    headerName,
    valueFormatter: defaultTextFormatter,
    sortable: true,
    filter: true,
    resizable: true,
    editable: (params) => isEditableField(params.colDef.field),
    cellEditor: 'agTextCellEditor',
    cellEditorParams: (_p: ICellEditorParams) => ({ maxLength: 255 }),
    ...extra,
  };
}

function mkNumberCol(
  field: string,
  headerName: string,
  extra?: Partial<ColDef>
): ColDef {
  return mkCol(field, headerName, {
    filter: 'agNumberColumnFilter',
    valueFormatter: (p) => (p.value == null ? '' : String(p.value)),
    ...extra,
  });
}

function mkActionCol(onProcess: (row: any) => void): ColDef {
  return {
    colId: 'actions',
    headerName: 'Actions',
    pinned: 'right',
    width: 105,
    suppressSizeToFit: true,
    sortable: false,
    filter: false,
    resizable: false,
    editable: false,
    cellRenderer: (params: any) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Traiter';
      btn.addEventListener('click', () => onProcess(params.data));
      btn.className = 'dsd-btn dsd-btn--secondary';
      return btn;
    },
  };
}

// ====== Colonnes par variant (screens 3-6)
function columnsForVariant(
  variant: GridVariant,
  onProcess: (row: any) => void
): (ColDef | ColGroupDef)[] {
  // Commun
  const common: ColDef[] = [
    mkCol('date', 'Date'),
    mkCol('ps', 'PS'),
    mkCol('csr', 'Csr'),
    mkCol('description', 'Description', { width: 200, wrapText: true }),
    mkCol('selection', 'Sélection'),
    mkCol('classement', 'Classement'),
    mkNumberCol('debit', 'Débit ($)'),
    mkNumberCol('credit', 'Crédit ($)'),
    mkCol('escalade', 'Escalade'),
    mkCol('suivi', 'Suivi'),
    mkCol('swat', 'Swat'),
    mkCol('jumelage', 'Jumelage'),
    mkCol('commentaireConciliation', 'Commentaire conciliation', { width: 220 }),
    mkCol('commentaireAnalyse', 'Commentaire analyse', { width: 220 }),
    mkActionCol(onProcess),
    mkCol('fractions', 'Fractions'),
    mkCol('deconcilie', 'Déconcilié'),
  ];

  // Screen 3 : SASI + GL (+ chèque + fusions + oracle)
  const sasiGl: ColDef[] = [
    mkCol('cheque', 'Chèque', { width: 70 }),
    ...common,
    mkCol('fusions', 'Fusions'),
    mkCol('oracle', 'Oracle'),
  ];

  // Screen 4 : SASI + FOLIO (heure/origine/usager/desc/mnémo/solde...)
  const sasiFolio: ColDef[] = [
    mkCol('date', 'Date'),
    mkCol('heure', 'Heure'),
    mkCol('origine', 'Origine'),
    mkCol('ps', 'PS'),
    mkCol('csr', 'Csr'),
    mkCol('usagerDescription', 'Usager / Description', { width: 240, wrapText: true }),
    mkCol('selection', 'Sélection'),
    mkCol('classement', 'Classement'),
    mkCol('mnemonique', 'Mnémonique'),
    mkNumberCol('debit', 'Débit ($)'),
    mkNumberCol('credit', 'Crédit ($)'),
    mkNumberCol('solde', 'Solde'),
    mkCol('escalade', 'Escalade'),
    mkCol('suivi', 'Suivi'),
    mkCol('swat', 'Swat'),
    mkCol('jumelage', 'Jumelage'),
    mkCol('commentaireConciliation', 'Commentaire conciliation', { width: 220 }),
    mkCol('commentaireAnalyse', 'Commentaire analyse', { width: 220 }),
    mkActionCol(onProcess),
    mkCol('fractions', 'Fractions'),
    mkCol('deconcilie', 'Déconcilié'),
  ];

  // Screen 5 : PAIE + GL (souvent comme common + fusions/oracle)
  const paieGl: ColDef[] = [...common, mkCol('fusions', 'Fusions'), mkCol('oracle', 'Oracle')];

  // Screen 6 : PAIE + GL_ORACLE (date/cumulateur/commentaire CSP/source/fusion)
  const paieGlOracle: ColDef[] = [
    mkCol('date', 'Date'),
    mkCol('cumulateur', 'Cumulateur'),
    mkCol('description', 'Description', { width: 220, wrapText: true }),
    mkCol('selection', 'Sélection'),
    mkCol('classement', 'Classement'),
    mkNumberCol('debit', 'Débit ($)'),
    mkNumberCol('credit', 'Crédit ($)'),
    mkCol('escalade', 'Escalade'),
    mkCol('suivi', 'Suivi'),
    mkCol('swat', 'Swat'),
    mkCol('jumelage', 'Jumelage'),
    mkCol('commentaireCsp', 'Commentaire CSP', { width: 220 }),
    mkCol('source', 'Source'),
    mkActionCol(onProcess),
    mkCol('fractions', 'Fractions'),
    mkCol('deconcilie', 'Déconcilié'),
    mkCol('fusion', 'Fusion'),
  ];

  switch (variant) {
    case 'SASI_GL':
      return sasiGl;
    case 'SASI_FOLIO':
      return sasiFolio;
    case 'PAIE_GL':
      return paieGl;
    case 'PAIE_GL_ORACLE':
      return paieGlOracle;
    default:
      return common;
  }
}


// ====== Détection type de compte
// ✅ Règle: GL_ORACLE = oracle === true ET compteGL === true
function resolveAccountTypeFromCompte(compte: any | null | undefined): AccountType {
  if (!compte) return 'UNKNOWN';

  const isGl = compte.compteGL === true || compte.compteGl === true;
  const isOracle = compte.oracle === true;

  if (isGl && isOracle) return 'GL_ORACLE';
  if (isGl) return 'GL';
  if (compte.folioEop === true) return 'FOLIO';
  if (compte.encaisse === true) return 'ENCAISSE';

  return 'UNKNOWN';
}

function resolveVariant(isSasi: boolean, isPaie: boolean, accountType: AccountType): GridVariant {
  if (isSasi && accountType === 'GL') return 'SASI_GL';
  if (isSasi && accountType === 'FOLIO') return 'SASI_FOLIO';
  if (isPaie && accountType === 'GL') return 'PAIE_GL';
  if (isPaie && accountType === 'GL_ORACLE') return 'PAIE_GL_ORACLE';
  return 'DEFAULT';
}

// ====== Composant
@Component({
  selector: 'app-conciliation-grid',
  standalone: true,
  imports: [AgGridAngular],
  templateUrl: './conciliation-grid.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConciliationGridComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  // ✅ Remplace par tes vraies facades
  private readonly facade = inject<any>(null as any);      // ConciliationFacade
  private readonly authContext = inject<any>(null as any); // AuthContextFacade

  @Input({ required: true }) rows: any[] = [];

  gridApi?: GridApi;

  // ✅ C’est CETTE propriété qui est bind dans le HTML
  columnDefs: (ColDef | ColGroupDef)[] =
    columnsForVariant('DEFAULT', (row) => this.onProcessTask(row));

  // options sans columnDefs (puisqu’on les passe via [columnDefs])
  gridOptions = {
    suppressRowTransform: true,
    domLayout: 'normal',
    rowSelection: {
      mode: 'multiRow',
      checkboxes: true,
      headerCheckbox: true,
      enableClickSelection: false,
    },
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
    },
    onCellValueChanged: (e: any) => {
      // Exemple: pousser le changement à la façade
      // this.facade.updateRow(e.data)
    },
  };

    
    ngOnInit(): void {
    const isSasi$ = this.authContext.isSasi$.pipe(startWith(false));
    const isPaie$ = this.authContext.isPaie$.pipe(startWith(false));

    // ✅ Le compte vient de la façade (viewState$)
    const selectedCompte$ = this.facade.viewState$.pipe(
      map((s: any) => s?.selectedCompte ?? null),
      startWith(null)
    );

    combineLatest([isSasi$, isPaie$, selectedCompte$])
      .pipe(
        map(([isSasi, isPaie, compte]) => {
          const accountType = resolveAccountTypeFromCompte(compte);
          return resolveVariant(!!isSasi, !!isPaie, accountType);
        }),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((variant) => {
        const defs = columnsForVariant(variant, (row) => this.onProcessTask(row));

        // 1) On met à jour la propriété bindée au template
        this.columnDefs = defs;

        // 2) Et pour être 100% safe selon version AG Grid
        //    on force aussi côté API si la grid est déjà prête
        if (this.gridApi) {
          this.gridApi.setColumnDefs(defs as any);
          this.gridApi.refreshHeader();
        }
      });
  }

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;

    // applique les defs déjà calculées (si abonnement a déjà tourné)
    if (this.columnDefs?.length) {
      this.gridApi.setColumnDefs(this.columnDefs as any);
      this.gridApi.refreshHeader();
    }
  }

  private onProcessTask(row: any): void {
    console.log('Action clicked for row:', row);
    // ex: this.facade.goToTraitement(row)
  }
}