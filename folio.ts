2) Active la sélection au clic + highlight
Ts
Copier le code
gridOptions: GridOptions = {
  rowSelection: 'single',          // ou 'multiple'
  suppressRowClickSelection: false, // important: le clic sélectionne
};
✅ Résultat : clic sur la ligne = selected = surligné.
✅ Si tu veux multi-sélection (Ctrl/Shift)
Ts
Copier le code
gridOptions: GridOptions = {
  rowSelection: 'multiple',
  rowMultiSelectWithClick: true,    // clic simple ajoute/enlève
  suppressRowClickSelection: false,
};