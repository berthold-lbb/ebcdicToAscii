<!-- ===== TOOLBAR ===== -->
<div class="dt-toolbar">
  <!-- Titre optionnel -->
  <div class="dt-toolbar-left">
    <span class="dt-title">{{ tableTitle || 'Data Table' }}</span>
  </div>

  <!-- Partie droite -->
  <div class="dt-toolbar-right">
    <!-- Barre de recherche -->
    @if (searchable) {
      <mat-form-field appearance="outline" class="dt-search-field">
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [placeholder]="filterPlaceholder" [formControl]="searchCtrl">
      </mat-form-field>
    }

    <!-- Séparateur -->
    <span class="dt-separator">|</span>

    <!-- Boutons d’action -->
    <button mat-icon-button matTooltip="Refresh" (click)="refresh?.emit()">
      <mat-icon>refresh</mat-icon>
    </button>

    <button mat-icon-button matTooltip="Colonnes" (click)="toggleColumnsMenu?.emit()">
      <mat-icon>view_column</mat-icon>
    </button>

    <button mat-icon-button matTooltip="Exporter" (click)="export?.emit()">
      <mat-icon>download</mat-icon>
    </button>

    <!-- Séparateur -->
    <span class="dt-separator">|</span>

    <!-- Bouton principal personnalisable -->
    <button mat-flat-button color="primary" (click)="mainAction?.emit()">
      <mat-icon>add</mat-icon>
      {{ mainActionLabel || 'Add' }}
    </button>
  </div>
</div>

------------------------------------------------

private isDetail = (row: unknown): row is DetailRow<T> =>
  !!row && typeof row === 'object' && '__detail' in row && (row as any).__detail === true;

// Predicates MatTable
isDetailRow = (_: number, row: T | DetailRow<T>) => this.isDetail(row);
isDataRow   = (_: number, row: T | DetailRow<T>) => !this.isDetail(row);


.dt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background-color: #fafafa;
  border-bottom: 1px solid #e0e0e0;
}

.dt-toolbar-left {
  font-weight: 600;
  font-size: 1.1rem;
  color: #333;
}

.dt-toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dt-search-field {
  width: 220px;
  margin-right: 8px;

  input {
    font-size: 0.9rem;
  }

  .mat-mdc-form-field-outline {
    background-color: #fff;
  }
}

.dt-separator {
  margin: 0 6px;
  color: #bbb;
  font-weight: 300;
}

button[mat-flat-button] {
  text-transform: none;
  font-weight: 500;
  letter-spacing: 0.2px;
}

button[mat-icon-button] {
  color: #555;
  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
}
-----------
<lib-data-table
  [data]="rows"
  [columns]="columns"
  [tableTitle]="'Clients'"
  [mainActionLabel]="'Add Contact'"
  (mainAction)="onAddContact()"
  (refresh)="onRefresh()"
  (toggleColumnsMenu)="onToggleColumns()"
  (export)="onExport()">
</lib-data-table>
