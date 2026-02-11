function setDsdButtonSlotText(btn: HTMLElement, text: string): void {
  const value = (text ?? '').toString();

  // AG-Grid recycle parfois : on reset d'abord le contenu
  btn.textContent = '';

  // ✅ slot default = contenu entre <dsd-button>...</dsd-button>
  btn.textContent = value;

  // fallback accessibilité/tooltip
  btn.setAttribute('title', value);
}

export function buildActionCellRenderer<T>(buttons: ButtonSpec<T>[]) {
  return (params: ICellRendererParams): Node => {
    const frag = document.createDocumentFragment();
    if (!Array.isArray(buttons) || buttons.length === 0) return frag;

    for (const spec of buttons) {
      const btn = document.createElement('dsd-button') as any;

      // props DSD
      btn.variant = spec.variant ?? 'compact';
      btn.size = spec.size ?? 'small';
      btn.iconName = spec.iconName;
      btn.iconPosition = spec.iconPosition ?? 'start'; // ⚠️ pas "standalone" si tu veux voir le texte

      // ✅ TEXTE DANS LE SLOT (entre les balises)
      setDsdButtonSlotText(btn, spec.title);

      // attrs optionnels
      if (spec.attrs) {
        for (const [k, v] of Object.entries(spec.attrs)) btn.setAttribute(k, v);
      }

      // style optionnel
      if (spec.styles) Object.assign((btn as HTMLElement).style, spec.styles);

      btn.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        spec.onClick(params.data as T, params);
      });

      frag.appendChild(btn);
    }

    return frag;
  };
}
