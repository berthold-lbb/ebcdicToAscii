// base-component.spec.ts
import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Location } from '@angular/common';

import { BaseComponent } from './base-component'; // <-- ajuste le path si besoin

@Component({
  standalone: true,
  template: '',
})
class HostBaseComponent extends BaseComponent {
  // On expose la méthode protected pour pouvoir la tester proprement
  public goBack(): void {
    this.retourPagePrecedente();
  }

  // Optionnel: exposer destroyRef pour l’assert
  public getDestroyRef(): unknown {
    return this.destroyRef;
  }
}

describe('BaseComponent', () => {
  let fixture: ComponentFixture<HostBaseComponent>;
  let component: HostBaseComponent;

  let locationSpy: jasmine.SpyObj<Location>;

  beforeEach(async () => {
    locationSpy = jasmine.createSpyObj<Location>('Location', ['back']);

    await TestBed.configureTestingModule({
      imports: [HostBaseComponent],
      providers: [{ provide: Location, useValue: locationSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(HostBaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the host component (BaseComponent is constructed)', () => {
    expect(component).toBeTruthy();
  });

  it('should inject DestroyRef (destroyRef is defined)', () => {
    expect(component.getDestroyRef()).toBeTruthy();
  });

  it('retourPagePrecedente() should call Location.back()', () => {
    component.goBack();
    expect(locationSpy.back).toHaveBeenCalledTimes(1);
  });

  it('retourPagePrecedente() should call Location.back() each time', () => {
    component.goBack();
    component.goBack();
    expect(locationSpy.back).toHaveBeenCalledTimes(2);
  });
});
