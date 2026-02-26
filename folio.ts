H CAD, [Feb 26, 2026 at 12:49:18 PM]:
<div class="gestion-taches-wrapper">
  @if (rows.length > 0) {
    <dsd-container>
      <div class="ag-theme-dsd grid-container dsd-fw-bold">
        <ag-grid-angular
          class="taille-grid-gestion-taches"
          [gridOptions]="gridOptions"
          [rowData]="rows"
          [columnDefs]="columDefs" />
      </div>
    </dsd-container>
  } @else {
    <div class="empty-state">
      <dsd-icon size="xl" icon-name="contenus_contour_dossier"></dsd-icon>
      <div class="empty-text">Aucune donnée à afficher</div>
      <p class="empty-text-description">Vérifiez les critères sélectionnés</p>
    </div>
  }
</div>


.gestion-taches-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%; // important si le parent a déjà une hauteur
  min-height: 520px; // ajuste selon ton layout (ou 60vh)
}

.grid-container {
  flex: 1 1 auto; // la grille prend l’espace
  min-height: 0;  // évite certains bugs de flex + overflow
}

.empty-state {
  flex: 1 1 auto;              // prend l’espace restant
  display: flex;
  flex-direction: column;
  align-items: center;          // centre horizontalement
  justify-content: center;      // centre verticalement
  text-align: center;
  gap: 8px;
}

.empty-text {
  margin-top: 8px;
  font-weight: 600;
}

.empty-text-description {
  margin: 0;
}