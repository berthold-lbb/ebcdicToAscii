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
