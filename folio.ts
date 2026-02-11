import { Directive, ElementRef, forwardRef, HostListener } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Directive({
  // adapte selon ton tag exact si besoin
  selector: 'dsd-radio-group[formControlName],dsd-radio-group[formControl],dsd-radio-group[ngModel]',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DsdRadioGroupValueAccessorDirective),
      multi: true,
    },
  ],
})
export class DsdRadioGroupValueAccessorDirective implements ControlValueAccessor {
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private host: ElementRef<HTMLElement>) {}

  // ⚠️ adapte le nom de l’event DSD EXACT
  // Dans ton code je vois (dsdRadioGroupChange)
  @HostListener('dsdRadioGroupChange', ['$event'])
  handleChange(event: any) {
    const value = event?.detail?.value ?? event?.target?.value ?? event;
    this.onChange(value);
  }

  @HostListener('blur')
  handleBlur() {
    this.onTouched();
  }

  writeValue(value: any): void {
    // ⚠️ adapte si DSD attend une prop "value" ou une méthode
    (this.host.nativeElement as any).value = value ?? null;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // ⚠️ adapte si DSD attend "disabled" property
    (this.host.nativeElement as any).disabled = isDisabled;
  }
}

dsd-radio-group.value-accessor.ts