@switch (notificationStatut) {

  @case (statutDefaut.SUCCESS) {
    <section class="success-card mat-elevation-z0">
      <div class="section-icon">
        <mat-icon color="primary">info</mat-icon>
      </div>

      <div>
        {{ message }}&nbsp;
        @if (link) {
          <a class="success-card-lien" [routerLink]="link">
            {{ linkMessage }}
          </a>
        }
      </div>

      <div class="section-icon bouton-fermer">
        <a class="close-button" (click)="supprimerNotification()">
          <mat-icon color="primary">highlight_off</mat-icon>
        </a>
      </div>
    </section>
  }

  @case (statutDefaut.ERROR) {
    <section class="error-card mat-elevation-z0">
      <div class="section-icon">
        <mat-icon color="warn">error</mat-icon>
      </div>

      <div>
        {{ message }}
        @if (errors?.length > 0) {
          <ul>
            @for (error of errors; track $index) {
              <li class="error-card-erreur">{{ error }}</li>
            }
          </ul>
        }
      </div>

      <div class="section-icon bouton-fermer">
        <a class="close-button" (click)="supprimerNotification()">
          <mat-icon color="warn">highlight_off</mat-icon>
        </a>
      </div>
    </section>
  }

  @case (statutDefaut.WARNING) {
    <section class="warning-card mat-elevation-z0">
      <div class="section-icon">
        <mat-icon color="warn">warning</mat-icon>
      </div>

      <div>
        {{ message }}
        @if (errors?.length > 0) {
          <ul>
            @for (error of errors; track $index) {
              <li class="warning-card-erreur">{{ error }}</li>
            }
          </ul>
        }
      </div>

      <div class="section-icon bouton-fermer">
        <a class="close-button" (click)="supprimerNotification()">
          <mat-icon color="warn">highlight_off</mat-icon>
        </a>
      </div>
    </section>
  }

  @default {
    <!-- État par défaut (optionnel) -->
    <section class="mat-elevation-z0">
      <div>{{ message }}</div>
    </section>
  }
}


-----------
<mat-toolbar class="toolbar">
  <span>Modifier le commentaire</span>
</mat-toolbar>

<mat-dialog-content [formGroup]="form">
  <mat-form-field appearance="fill" class="full-width">
    <mat-label>Commentaire</mat-label>
    <textarea
      matInput
      formControlName="comments"
      rows="4">
    </textarea>

    @if (form.get('comments')?.hasError('required')) {
      <mat-error>Le commentaire est requis</mat-error>
    }

    @if (form.get('comments')?.hasError('maxlength')) {
      <mat-error>Maximum 500 caractères</mat-error>
    }
  </mat-form-field>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-button (click)="cancel()">Annuler</button>
  <button
    mat-raised-button
    color="primary"
    (click)="saveComment()"
    [disabled]="form.invalid || isSaving">
    @if (isSaving) {
      Enregistrement...
    } @else {
      Enregistrer
    }
  </button>
</mat-dialog-actions>

@if (saveSuccess) {
  <div class="success-message">
    Commentaire enregistré avec succès
  </div>
}

@if (saveError) {
  <div class="error-message">
    Erreur lors de l'enregistrement du commentaire
  </div>
}
