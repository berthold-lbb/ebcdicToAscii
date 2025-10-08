<!-- LIGNE NORMALE -->
<tr mat-row
    *matRowDef="let row; columns: displayedColumns"
    class="clickable-row"
    (dblclick)="onRowDblClick(row)"
    (click)="selectable && toggleRow(row)"
    [class.row-selected]="isSelected(row) && highlightSelection"
    [ngStyle]="(isSelected(row) && highlightSelection)
               ? {'--sel-bg': highlightColor, '--sel-bar': highlightBarColor} : null">
</tr>

<!-- LIGNE DE DÉTAIL (affichée seulement quand isDetailRow === true) -->
<tr mat-row
    *matRowDef="let row; columns: ['detail']; when: isDetailRow"
    class="detail-row">
</tr>

<!-- Colonne technique « detail » (pas incluse dans displayedColumns) -->
<ng-container matColumnDef="detail">
  <td mat-cell *matCellDef="let row" class="detail-cell"
      [attr.colspan]="displayedColumns.length">
    <div class="detail-wrapper">
      <div class="detail-card">
        @if (detailTpl) {
          <ng-container *ngTemplateOutlet="detailTpl; context: {$implicit: row, row: row}"></ng-container>
        } @else {
          <div class="detail-fallback">
            <strong>ID:</strong> {{ row['id'] }}<br>
            <!-- …fallback minimal… -->
          </div>
        }
      </div>
    </div>
  </td>
</ng-container>
----------------------------------------------------------------------------------

// champ d’état
expandedRow: T | null = null;

// row predicate : vraie uniquement pour la ligne « détail » de la row expandée
readonly isDetailRow = (_: number, row: T) => this.expandedRow === row;

// double-clic pour ouvrir/fermer
onRowDblClick(row: T) {
  this.expandedRow = (this.expandedRow === row) ? null : row;
}
