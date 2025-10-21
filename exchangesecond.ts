private applySelection(next: string[]) {
  this._selected.set(next);
  this.onChange(next.length ? next : null);
}

toggle(value: string, reopen?: MatAutocompleteTrigger) {
  const cur = this.selected();            // snapshot
  const adding = !cur.includes(value);
  const next   = adding ? [...cur, value] : cur.filter(v => v !== value);

  this.applySelection(next);
  if (adding) this.pushToRecents(value);

  if (reopen) setTimeout(() => reopen.openPanel());
}

remove(value: string) {
  const cur  = this.selected();
  const next = cur.filter(v => v !== value);
  this.applySelection(next);
}