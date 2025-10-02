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
