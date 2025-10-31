
html
Copier le code
<!-- ✅ référence stable -->
<app-transaction-details-card [row]="row"></app-transaction-details-card>
Dans le child, ne relancer que si les IDs ont réellement changé :

ts
Copier le code
@Input({required: true}) row!: { transactions: number[] };

ngOnChanges(ch: SimpleChanges) {
  if (ch['row']) {
    const prev = (ch['row'].previousValue?.transactions ?? []).join(',');
    const curr = (ch['row'].currentValue?.transactions ?? []).join(',');
    if (prev !== curr && curr) this.reload();   // ✅ sinon ne rien faire
  }
}
Activer OnPush sur le child pour limiter les re-rendus :

ts
Copier le code
@Component({ /* ... */, changeDetection: ChangeDetectionStrategy.OnPush })
export class TransactionDetailsCard { /* ... */ }