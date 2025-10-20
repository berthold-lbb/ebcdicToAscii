Tu peux parfaitement faire ceci :

✅ HTML simplifié
<div class="dt-root">
  <div class="dt-toolbar">
    <!-- Toolbar fixe -->
  </div>

  @if (loading && showTopBarWhileLoading) {
    <mat-progress-bar class="dt-topbar" mode="indeterminate"></mat-progress-bar>
  }

  <!-- Centre scrollable directement -->
  <div class="dt-center dt-scroll">
    @if (loading) {
      <div class="dt-overlay"></div>
    }

    <table
      mat-table
      [dataSource]="rowsForRender"
      matSort
      class="mat-elevation-z2 dt-table">
      <!-- Colonnes dynamiques -->
      <ng-content select="[columns]"></ng-content>
    </table>
  </div>

  <mat-paginator
    class="dt-paginator"
    [length]="serverSide ? total : autoLength"
    [pageSize]="pageSize"
    [pageSizeOptions]="pageSizeOptions"
    [showFirstLastButtons]="true">
  </mat-paginator>
</div>

✅ SCSS adapté
.dt-root {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dt-toolbar,
.dt-paginator {
  flex: 0 0 auto;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  z-index: 2;
}

.dt-center.dt-scroll {
  flex: 1 1 auto;
  overflow-x: auto;
  overflow-y: hidden;
  position: relative;
  background: #fafafa;
}

.dt-table {
  min-width: 100%;
  width: max-content;
  background: #fff;
}

.dt-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.45);
  z-index: 4;
  pointer-events: none;
}
