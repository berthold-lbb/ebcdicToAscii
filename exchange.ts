import { Directive, ElementRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';

type DsdDatepickerEl = HTMLElement & { value?: string; max?: string };

@Directive({
  selector: 'dsd-datepicker[bindMax], dsd-datepicker[bindValue]',
  standalone: true,
})
export class DsdDatePickerBindDirective implements OnChanges {
  private host = inject(ElementRef<DsdDatepickerEl>);

  @Input('bindMax') maxDateLabel: string | null = null;
  @Input() bindValue: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    const el = this.host.nativeElement;

    if ('maxDateLabel' in changes) {
      const v = this.maxDateLabel ?? '';
      (el as any).max = v;
      if (v) el.setAttribute('max', v);
      else el.removeAttribute('max');
    }

    if ('bindValue' in changes) {
      const v = this.bindValue ?? '';
      (el as any).value = v;
      if (v) el.setAttribute('value', v);
      else el.removeAttribute('value');
    }

    // optionnel mais très utile pour certains WC
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
