HTML recommandé (rappel)
<div class="dt-root">
  <div class="dt-toolbar">
    <!-- toolbar -->
  </div>

  @if (loading && showTopBarWhileLoading) {
    <mat-progress-bar class="dt-topbar" mode="indeterminate"></mat-progress-bar>
  }

  <div class="dt-center">
    <div class="dt-table-wrap">
      <div class="dt-scroll">
        @if (loading) { <div class="dt-overlay"></div> }

        <table mat-table [dataSource]="rowsForRender" matSort class="mat-elevation-z2 dt-table">
          <ng-content select="[columns]"></ng-content>
        </table>
      </div>
    </div>
  </div>

  <mat-paginator
    class="dt-paginator"
    [length]="serverSide ? total : autoLength"
    [pageSize]="pageSize"
    [pageSizeOptions]="pageSizeOptions"
    [showFirstLastButtons]="true">
  </mat-paginator>
</div>

SCSS minimal qui fonctionne
:host { display:block; height:100%; min-height:0; }

/* Layout colonne */
.dt-root { display:flex; flex-direction:column; height:100%; min-height:0; }

/* Toolbar top */
.dt-toolbar {
  flex:0 0 auto; padding:8px 12px; background:#fff;
  border-bottom:1px solid #e0e0e0; z-index:2;
}

/* Fine barre de loading */
.dt-topbar { flex:0 0 auto; z-index:3; }

/* Centre (zone scroll horizontale) */
.dt-center { flex:1 1 auto; min-height:0; position:relative; background:#fafafa; }

.dt-table-wrap { display:flex; flex-direction:column; height:100%; }

/* ⚠️ corriger le sélecteur ici */
.dt-center .dt-scroll {
  flex:1 1 auto;
  overflow-x:auto;
  overflow-y:hidden;
  position:relative;
  height:100%;
}

/* Overlay */
.dt-overlay { position:absolute; inset:0; background:rgba(255,255,255,.45); z-index:4; pointer-events:none; }

/* Table */
.dt-table { min-width:100%; width:max-content; background:#fff; }
.dt-table .mat-header-row { position:sticky; top:0; z-index:5; background:#fff; }

/* Paginator bottom (typo fixée) */
.dt-paginator {
  flex:0 0 auto;
  background:#fff;
  border-top:1px solid #e0e0e0;
  z-index:2;
}