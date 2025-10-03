🔹 1. Loader dans le bouton « Enregistrer »

Tu gardes le bouton actif mais tu remplaces le texte par un mat-progress-spinner ou mat-spinner mini :

<button
  mat-raised-button
  color="primary"
  (click)="saveComment()"
  [disabled]="form.invalid || isSaving"
>
  @if (isSaving) {
    <mat-progress-spinner
      diameter="20"
      mode="indeterminate"
      color="accent"
    ></mat-progress-spinner>
  } @else {
    Enregistrer
  }
</button>


👉 Ici, quand isSaving = true, le spinner remplace le texte.

🔹 2. Loader global au milieu du dialog

Si tu veux bloquer tout le contenu du MatDialog pendant le traitement :

<mat-dialog-content>
  <form [formGroup]="form">
    <!-- tes champs -->
  </form>

  @if (isSaving) {
    <div class="dialog-overlay">
      <mat-progress-spinner mode="indeterminate"></mat-progress-spinner>
    </div>
  }
</mat-dialog-content>


Et dans ton CSS du composant :

.dialog-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.6); /* effet gris semi-transparent */
  z-index: 1000;
}


👉 Ça affiche un overlay semi-transparent avec un spinner au centre du dialog.

🔹 3. Loader linéaire (progress bar en haut du dialog)
<mat-dialog-content>
  @if (isSaving) {
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  }

  <form [formGroup]="form">
    <!-- tes champs -->
  </form>
</mat-dialog-content>


👉 Ça affiche une barre de progression horizontale en haut du contenu.

⚡ Recommandation :

Si tu veux montrer à l’utilisateur que le clic « Enregistrer » est en cours, → Option 1 (dans le bouton).

Si tu veux bloquer complètement l’écran le temps du traitement, → Option 2 (overlay global).




----------------------------------------------------------------

<mat-toolbar class="toolbar">
  <span>Modifier le commentaire</span>
</mat-toolbar>

<mat-dialog-content [formGroup]="form" class="dialog-body" [attr.aria-busy]="isSaving">
  <!-- Barre linéaire optionnelle quand ça sauvegarde -->
  @if (isSaving) {
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  }

  <mat-form-field appearance="fill" class="w-100">
    <mat-label>Commentaire</mat-label>
    <textarea matInput formControlName="comments" rows="4"></textarea>

    @if (form.get('comments')?.hasError('required')) {
      <mat-error>Le commentaire est requis</mat-error>
    }
    @if (form.get('comments')?.hasError('maxlength')) {
      <mat-error>Maximum 500 caractères</mat-error>
    }
  </mat-form-field>

  <!-- Overlay global qui bloque le contenu -->
  @if (isSaving) {
    <div class="dialog-overlay">
      <mat-progress-spinner mode="indeterminate" diameter="48"></mat-progress-spinner>
    </div>
  }
</mat-dialog-content>

<mat-dialog-actions align="end">
  <button mat-button (click)="cancel()" [disabled]="isSaving">Annuler</button>

  <button
    mat-raised-button
    color="primary"
    (click)="saveComment()"
    [disabled]="form.invalid || isSaving"
  >
    @if (isSaving) {
      <span class="btn-loading">
        <mat-progress-spinner diameter="18" mode="indeterminate" strokeWidth="3"></mat-progress-spinner>
        <span>Enregistrement…</span>
      </span>
    } @else {
      Enregistrer
    }
  </button>
</mat-dialog-actions>


-------------------
.dialog-body {
  position: relative; // nécessaire pour positionner l’overlay
}

.dialog-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.6); // voile
  z-index: 2;
  pointer-events: all; // bloque toute interaction
}

.btn-loading {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
}

/* S’assurer que les champs prennent toute la largeur de la colonne */
.mat-mdc-form-field, .w-100 { width: 100%; }
