// row-detail-card.component.ts
@Component({
  selector: 'app-row-detail-card',
  template: `
  @if (loading) {
    <div class="detail-card"><mat-icon class="spin">autorenew</mat-icon> Loading…</div>
  } @else if (error) {
    <div class="detail-card error">
      <mat-icon color="warn">error</mat-icon> {{error}}
      <button mat-stroked-button (click)="reload()">Retry</button>
    </div>
  } @else if (data) {
    <mat-card class="detail-card">
      <mat-card-title>Client Details</mat-card-title>
      <mat-card-content class="detail-grid">
        <div><b>ID:</b> {{ data.id }}</div>
        <div><b>Account:</b> {{ data.account }}</div>
        <div><b>Currency:</b> {{ data.currency }}</div>
        <div><b>Amount:</b> {{ data.amount | number:'1.0-2' }}</div>
      </mat-card-content>
      <mat-card-actions>
        <button mat-icon-button (click)="reload()" matTooltip="Reload"><mat-icon>refresh</mat-icon></button>
      </mat-card-actions>
    </mat-card>
  }
  `,
  styles: [/* réutilise les styles ci-dessus */]
})
export class RowDetailCardComponent implements OnInit {
  @Input() row!: any;
  loading = false;
  error: string | null = null;
  data: any = null;
  constructor(private api: MyApiService) {}
  ngOnInit() { this.reload(); }
  reload() {
    this.loading = true; this.error = null;
    this.api.getTxDetail(this.row.id).pipe(
      finalize(() => this.loading = false),
      catchError(err => { this.error = err?.message ?? 'Erreur'; return of(null); })
    ).subscribe(res => this.data = res);
  }
}



<lib-data-table
  [data]="dataSource"
  [columns]="columns"
  [enableRowDetail]="true"
  [rowDetailTemplate]="detailTpl">
</lib-data-table>

<ng-template #detailTpl let-row>
  <app-row-detail-card [row]="row"></app-row-detail-card>
</ng-template>
-----------------------------------------------------------------------
<!-- Ligne de détail -->
<ng-container matRowDef
              *matRowDef="let row; when: isDetailRow"
              [columns]="['detail']">
</ng-container>

<ng-container matColumnDef="detail">
  <td mat-cell class="detail-cell" [attr.colspan]="displayedColumns.length">
    <div class="detail-wrapper">
      @if (rowDetailTemplate) {
        <div class="detail-card">
          <ng-container
            *ngTemplateOutlet="rowDetailTemplate; context: {$implicit: row.host, row: row.host}">
          </ng-container>
        </div>
      } @else {
        <div class="detail-card">
          <strong>Détails :</strong> {{ row.host | json }}
        </div>
      }
    </div>
  </td>
</ng-container>
-----------------------------------------------------------------------
<ng-container *ngFor="let col of visibleColumnDefs; trackBy: trackByCol" [matColumnDef]="col.nom">
  <th mat-header-cell *matHeaderCellDef> {{ col.label }} </th>
  <td mat-cell
      *matCellDef="let row"
      [class.expanded]="expandedId === _rowId(row)"
      (dblclick)="onRowDblClick(row)">
    {{ row[col.nom] }}
  </td>
</ng-container>
-----------------------------------------------------------------------
/* === Ligne parent sélectionnée === */
.mat-mdc-row.expanded {
  border-left: 4px solid #008c53; /* ton vert */
  background-color: #f6fff9;      /* léger fond vert pâle */
}

/* === Ligne de détail === */
.detail-cell {
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
}

.detail-wrapper {
  padding-left: 24px;  /* décalage pour l’effet hiérarchie */
  background: #fafafa; /* léger contraste avec la table */
}

.detail-card {
  margin: 8px 0;
  padding: 12px 16px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  border-left: 3px solid #008c53; /* petit accent sur la carte aussi */
}

/* Texte du détail */
.detail-card b {
  color: #333;
}

/* Grille de détail (comme ton screenshot précédent) */
.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px 16px;
}

/* Effet de transition douce quand la ligne s'ouvre */
.detail-card, .mat-mdc-row.expanded {
  transition: all 0.25s ease-in-out;
}


------

.detail-wrapper {
  position: relative;
  padding-left: 32px;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 16px;
    width: 2px;
    height: 100%;
    background: #008c53;
    opacity: 0.3;
  }
}

-----------------------------------------------Animation--------------------------------

// + imports animations
import { animate, state, style, transition, trigger } from '@angular/animations';

@Component({
  // ...
  animations: [
    // carte de détail qui se déplie
    trigger('detailToggle', [
      state('void', style({ height: 0, opacity: 0, transform: 'translateY(-4px)' })),
      state('*',    style({ height: '*', opacity: 1, transform: 'translateY(0)' })),
      transition('void <=> *', animate('180ms ease'))
    ]),

    // léger glow sur la ligne parente ouverte
    trigger('rowGlow', [
      state('off', style({ boxShadow: 'none' })),
      state('on',  style({ boxShadow: 'inset 0 0 0 9999px rgba(0,140,83,0.05)' })),
      transition('off <=> on', animate('150ms ease-in-out'))
    ])
  ]
})
export class DataTableComponent<...> { /* rien d’autre à changer ici */ }


-----
<!-- cellules "data" (exemple) -->
<td mat-cell
    *matCellDef="let row"
    (dblclick)="onRowDblClick(row)"
    [class.expanded]="expandedId === _rowId(row)"
    [@rowGlow]="expandedId === _rowId(row) ? 'on' : 'off'">
  {{ row[col.nom] }}
</td>
----
<!-- colonne 'detail' déjà en place -->
<ng-container matColumnDef="detail">
  <td mat-cell class="detail-cell" [attr.colspan]="displayedColumns.length">
    <div class="detail-wrapper">
      @if (rowDetailTemplate) {
        <div class="detail-card" @detailToggle>
          <ng-container
            *ngTemplateOutlet="rowDetailTemplate; context: {$implicit: row.host, row: row.host}">
          </ng-container>
        </div>
      } @else {
        <div class="detail-card" @detailToggle>
          <strong>Détails :</strong> {{ row.host | json }}
        </div>
      }
    </div>
  </td>
</ng-container>
----------------
.mat-mdc-row.expanded {
  border-left: 4px solid #008c53;
  background-color: #f6fff9;
}

.detail-cell { padding: 0 !important; background: transparent !important; border: none !important; }

.detail-wrapper {
  position: relative;
  padding-left: 24px;         /* décale vers la droite */
  background: #fafafa;        /* fond léger */
}

.detail-wrapper::before {     /* petit trait vertical optionnel */
  content: '';
  position: absolute;
  top: 0; left: 12px;
  width: 2px; height: 100%;
  background: #008c53; opacity: .25;
}

.detail-card {
  margin: 8px 0;
  padding: 12px 16px;
  border-radius: 8px;
  background: #fff;
  border-left: 3px solid #008c53;
  /* pas de transition ici : gérée par @detailToggle */
}
