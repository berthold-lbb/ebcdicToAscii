import { Component, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
import { ColDef, GridApi, createGrid } from 'ag-grid-community';
import { Subject, takeUntil } from 'rxjs';

import { ReglesConciliationFacade } from '../application/regles-conciliation.facade';
import { buildActionCellRenderer } from '../ui/ag-grid/action-cell-renderer.factory';
import { createDefaultGridOptions } from '../ui/ag-grid/grid-defaults';
import { RegleGLBff } from 'src/app/api';

@Component({
  selector: 'app-regles-conciliation',
  templateUrl: './regles-conciliation.page.html',
  styleUrls: ['./regles-conciliation.page.scss'],
})
export class ReglesConciliationPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  gridApi!: GridApi;

  valueCombobox = 'tous';
  comboBoxOptions: string[][] = [];
  gridOptions: GridOptions = createDefaultGridOptions();

  columnDefs: ColDef[] = [
    { field: 'numeroRegle', headerName: 'Numéro', width: 130 },
    { field: 'descriptionRegle', headerName: 'Description', width: 350, tooltipField: 'descriptionRegle' },
    {
      colId: 'actions',
      headerName: 'Actions',
      width: 110,
      sortable: false,
      cellRenderer: buildActionCellRenderer<RegleGLBff>({
        onEdit: (row) => this.onEdit(row),
        onDelete: (row) => this.onDelete(row),
      }),
    },
  ];

  constructor(public readonly facade: ReglesConciliationFacade) {}

  ngOnInit(): void {
    this.facade.comptesGL$
      .pipe(takeUntil(this.destroy$))
      .subscribe((response) => {
        this.comboBoxOptions = [['tous', 'Tous'], ...response.map(c => [c.identifiantCompteGL!, c.numeroCompteGL!])];
      });
  }

  ngAfterViewInit(): void {
    const gridDiv = document.querySelector('#myGrid') as HTMLElement;

    this.gridApi = createGrid(gridDiv, {
      ...createDefaultGridOptions(),
      columnDefs: this.columnDefs,
      rowData: [],
    });

    this.facade.regles$
      .pipe(takeUntil(this.destroy$))
      .subscribe((dto) => {
        this.gridApi.setGridOption('rowData', dto.regles ?? []);
      });
  }

  onComboboxChange(evt: CustomEvent) {
    const newValue: any = (evt.detail ?? evt)['value'] ?? evt.detail;
    this.valueCombobox = Array.isArray(newValue) ? newValue[0] : newValue;
    this.facade.setFiltreGL(this.valueCombobox);
  }

  onAjouter(): void { /* ouvrir modal add */ }
  onEdit(row: RegleGLBff): void { /* ouvrir modal edit */ }
  onDelete(row: RegleGLBff): void { /* ouvrir modal delete */ }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}



/////////facade.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, switchMap } from 'rxjs';
import { ReglesConciliationRepository } from '../data/regles-conciliation.repository';
import { GetReglesParGL$Params, RegleGLBff } from 'src/app/api';

@Injectable({ providedIn: 'root' })
export class ReglesConciliationFacade {
  private readonly filtreGL$ = new BehaviorSubject<string>('tous');

  readonly comptesGL$ = this.repo.loadComptesGL$();

  readonly regles$ = this.filtreGL$.pipe(
    switchMap((gl) => {
      const params: GetReglesParGL$Params = gl === 'tous'
        ? { inclureTousLesGL: true }
        : { idCompteGL: gl };

      return this.repo.loadRegles$(params);
    })
  );

  constructor(private readonly repo: ReglesConciliationRepository) {}

  setFiltreGL(value: string) {
    this.filtreGL$.next(value);
  }

  // add/update/delete plus tard ici (orchestration)
}



////////////

import { Component, OnDestroy, OnInit, AfterViewInit } from '@angular/core';
import { ColDef, GridApi, GridOptions, createGrid } from 'ag-grid-community';
import { Subject, takeUntil } from 'rxjs';

import { ReglesConciliationRepository } from '../data/regles-conciliation.repository';
import { buildActionCellRenderer } from '../ui/ag-grid/action-cell-renderer.factory';
import { createDefaultGridOptions } from '../ui/ag-grid/grid-defaults';

import { RegleGLBff, GetReglesParGL$Params } from 'src/app/api';

@Component({
  selector: 'app-regles-conciliation',
  templateUrl: './regles-conciliation.page.html',
  styleUrls: ['./regles-conciliation.page.scss'],
})
export class ReglesConciliationPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  gridApi!: GridApi;
  gridOptions: GridOptions = createDefaultGridOptions();

  regleList: RegleGLBff[] = [];

  valueCombobox: string = 'tous';
  comptesGL: any[] = [];
  comboBoxOptions: string[][] = [];

  columnDefs: ColDef[] = [
    { field: 'numeroRegle', headerName: 'Numéro', width: 130 },
    { field: 'descriptionRegle', headerName: 'Description', width: 350, tooltipField: 'descriptionRegle' },
    {
      colId: 'actions',
      headerName: 'Actions',
      width: 110,
      sortable: false,
      cellRenderer: buildActionCellRenderer<RegleGLBff>({
        onEdit: (row) => this.onEdit(row),
        onDelete: (row) => this.onDelete(row),
      }),
    },
  ];

  constructor(private readonly repo: ReglesConciliationRepository) {}

  ngOnInit(): void {
    this.refreshComptesGL();
    this.refreshRegles();
  }

  ngAfterViewInit(): void {
    const gridDiv = document.querySelector('#myGrid') as HTMLElement;
    this.gridApi = createGrid(gridDiv, {
      ...this.gridOptions,
      columnDefs: this.columnDefs,
      rowData: this.regleList,
    });
  }

  onComboboxChange(evt: CustomEvent) {
    const newValue: any = (evt.detail ?? evt)['value'] ?? evt.detail;
    this.valueCombobox = Array.isArray(newValue) ? newValue[0] : newValue;
    this.refreshRegles();
  }

  onAjouter(): void {
    // ouvre modal add
  }

  onEdit(row: RegleGLBff): void {
    // ouvre modal edit
  }

  onDelete(row: RegleGLBff): void {
    // ouvre modal delete
  }

  private refreshRegles(): void {
    const params: GetReglesParGL$Params = {};

    if (this.valueCombobox === 'tous') {
      params.inclureTousLesGL = true;
    } else {
      params.idCompteGL = this.valueCombobox;
    }

    this.repo.loadRegles$(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dto) => {
          this.regleList = dto.regles ?? [];
          this.gridApi?.setGridOption('rowData', this.regleList);
        },
        error: () => {
          // notification
        },
      });
  }

  private refreshComptesGL(): void {
    this.repo.loadComptesGL$()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.comptesGL = response;
          this.comboBoxOptions = [['tous', 'Tous'], ...response.map(c => [c.identifiantCompteGL!, c.numeroCompteGL!])];
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
