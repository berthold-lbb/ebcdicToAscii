✅ Voici le layout HTML/CSS corrigé
🧱 HTML
<mat-card class="search-card">
  <form [formGroup]="form" (ngSubmit)="onSubmit()" [class.is-disabled]="disabled">
    <!-- Ligne 1 -->
    <div class="toolbar-row top-row">
      <app-date-time-picker class="field" formControlName="startDate" label="Start Date"
        [withTimeOnPick]="true" [injectNowOnFocus]="true" [required]="true">
      </app-date-time-picker>

      <app-date-time-picker class="field" formControlName="endDate" label="End Date"
        [withTimeOnPick]="true" [injectNowOnFocus]="true" [required]="true">
      </app-date-time-picker>

      <mat-form-field appearance="fill" class="field">
        <mat-label>Match Account</mat-label>
        <input matInput formControlName="matchAccount">
      </mat-form-field>

      <mat-form-field appearance="fill" class="field narrow">
        <mat-label>Limit</mat-label>
        <input matInput type="number" formControlName="limit" min="1">
      </mat-form-field>

      <mat-form-field appearance="fill" class="field narrow">
        <mat-label>Offset</mat-label>
        <input matInput type="number" formControlName="offset" min="0">
      </mat-form-field>
    </div>

    <!-- Ligne 2 -->
    <div class="toolbar-row bottom-row">
      <div class="toggle-wrap">
        <span class="toggle-label">Matching:</span>
        <mat-button-toggle-group formControlName="matchMode" aria-label="Matching status">
          <mat-button-toggle value="NoMatched">No matched yet</mat-button-toggle>
          <mat-button-toggle value="Matched">Matched</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <div class="btn">
        <button mat-raised-button color="primary" type="submit" [disabled]="disabled || form.invalid">
          Search
        </button>

        <button mat-stroked-button color="accent" type="button" (click)="saveFilter()">
          <mat-icon>save</mat-icon> Save Filter
        </button>

        <button mat-stroked-button color="accent" [matMenuTriggerFor]="filterMenu">
          <mat-icon>list</mat-icon> My Filters
        </button>

        <mat-menu #filterMenu="matMenu">
          <button mat-menu-item *ngFor="let f of filters">
            {{ f.name }}
            <button mat-icon-button color="warn" (click)="deleteFilter(f)">
              <mat-icon>delete</mat-icon>
            </button>
          </button>
        </mat-menu>
      </div>
    </div>
  </form>
</mat-card>

🎨 CSS (Angular styles)
.search-card {
  padding: 12px;
}

.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding-bottom: 8px;
}

.top-row {
  justify-content: flex-start;
}

.bottom-row {
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.field {
  width: 280px;
}

.field.narrow {
  width: 120px;
}

.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
}

.btn {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

💡 Résultat attendu

📸 L’interface aura deux bandes horizontales :

En haut → le formulaire principal avec les date pickers + inputs alignés.

En bas → le toggle “Matching” à gauche et les boutons Search, Save Filter, My Filters alignés à droite.