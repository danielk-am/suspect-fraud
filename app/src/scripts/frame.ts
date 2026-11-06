const frame = document.querySelector<HTMLElement>('[data-app-frame]');
if (frame) {
  const narrow = matchMedia('(max-width:1199px)');
  const panels = {left: frame.querySelector<HTMLElement>('.af-left')!, right: frame.querySelector<HTMLElement>('.af-right')!};
  const main = frame.querySelector<HTMLElement>('main')!;
  const backdrop = frame.querySelector<HTMLButtonElement>('[data-af-backdrop]')!;
  const key = frame.dataset.storageKey!;
  let drawer: 'left' | 'right' | null = null;
  let returnFocus: HTMLElement | null = null;
  const read = (suffix: string) => {try {return localStorage.getItem(key + suffix)} catch {return null}};
  const write = (suffix: string, value: string) => {try {localStorage.setItem(key + suffix, value)} catch {}};
  document.documentElement.dataset.theme = read(':theme') === 'dark' ? 'dark' : 'light';
  const hidden = {left: read(':hidden:left') === 'true', right: read(':hidden:right') === 'true'};
  function sync() {
    for (const side of ['left','right'] as const) {
      frame!.toggleAttribute('data-hide-' + side, !narrow.matches && hidden[side]);
      const open = narrow.matches ? drawer === side : !hidden[side];
      frame!.querySelectorAll(`[data-af-toggle="${side}"]`).forEach(button => button.setAttribute('aria-expanded', String(open)));
      if (narrow.matches && drawer === side) {panels[side].setAttribute('role','dialog'); panels[side].setAttribute('aria-modal','true')}
      else {panels[side].removeAttribute('role'); panels[side].removeAttribute('aria-modal')}
      panels[side].inert = narrow.matches && !!drawer && drawer !== side;
    }
    if (drawer) frame!.dataset.drawer = drawer; else delete frame!.dataset.drawer;
    backdrop.hidden = !drawer;
    main.inert = !!drawer;
  }
  function closeDrawer(restore = true) {drawer = null; sync(); if (restore) returnFocus?.focus(); returnFocus = null}
  // Product actions can hand focus back to a task after resolving prerequisites.
  frame.addEventListener('af:focus-task', () => { if (drawer) closeDrawer(false); });
  frame.querySelectorAll<HTMLButtonElement>('[data-af-toggle]').forEach(button => button.addEventListener('click', () => {
    const side = button.dataset.afToggle as 'left' | 'right';
    if (narrow.matches) {
      if (drawer === side) closeDrawer();
      else {returnFocus = button; drawer = side; sync(); panels[side].querySelector<HTMLElement>('button,a,input,select,textarea')?.focus()}
    } else {
      hidden[side] = !hidden[side]; write(':hidden:' + side, String(hidden[side])); sync();
      if (hidden[side]) main.querySelector<HTMLElement>(`[data-af-toggle="${side}"]`)?.focus();
    }
  }));
  // Let same-page navigation leave the drawer and move focus to the task.
  panels.left.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!drawer || !link) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
    let destination: HTMLElement | null = null;
    try {destination = document.getElementById(decodeURIComponent(url.hash.slice(1)))} catch {}
    if (!destination) return;
    event.preventDefault();
    closeDrawer(false);
    destination.setAttribute('tabindex', '-1');
    destination.focus();
    destination.scrollIntoView({block:'start'});
    history.replaceState(null, '', url.hash);
  });
  backdrop.addEventListener('click', () => closeDrawer());
  document.addEventListener('keydown', event => {
    if (!drawer) return;
    if (event.key === 'Escape') {event.preventDefault(); closeDrawer()}
    if (event.key === 'Tab') {
      const focusable = [...panels[drawer].querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus()}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus()}
    }
  });
  narrow.addEventListener('change', () => {const active = document.activeElement; closeDrawer(false); if (active instanceof HTMLElement && !active.getClientRects().length) main.querySelector<HTMLElement>('[data-af-toggle]')?.focus()});
  for (const side of ['left','right'] as const) {
    const separator = frame.querySelector<HTMLElement>(`[data-af-resize="${side}"]`)!;
    const min = Number(separator.getAttribute('aria-valuemin')), max = Number(separator.getAttribute('aria-valuemax'));
    let width = Number(read(':width:' + side)) || Number(separator.getAttribute('aria-valuenow'));
    const set = (value: number) => {width = Math.max(min,Math.min(max,value)); frame!.style.setProperty('--af-' + side,width+'px'); separator.setAttribute('aria-valuenow',String(width))};
    const save = () => write(':width:' + side,String(width));
    set(width);
    separator.addEventListener('keydown', event => {
      const sign = side === 'left' ? 1 : -1;
      if (event.key === 'Home' || event.key === 'End') {event.preventDefault(); set(event.key === 'Home' ? min : max); save()}
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); set(width + (event.key === 'ArrowRight' ? 10 : -10) * sign); save()}
    });
    separator.addEventListener('pointerdown', event => {
      if (event.button !== 0 || separator.hasAttribute('data-dragging')) return;
      // Avoid native pointer focus rings; keyboard focus retains its own indicator.
      event.preventDefault();
      separator.setPointerCapture(event.pointerId);
      separator.setAttribute('data-dragging', '');
      const start = event.clientX, initial = width;
      const move = (e: PointerEvent) => set(initial+(e.clientX-start)*(side === 'left' ? 1 : -1));
      const stop = () => {separator.removeAttribute('data-dragging'); separator.removeEventListener('pointermove',move); separator.removeEventListener('pointerup',stop); separator.removeEventListener('pointercancel',stop); separator.removeEventListener('lostpointercapture',stop); save()};
      separator.addEventListener('pointermove',move); separator.addEventListener('pointerup',stop); separator.addEventListener('pointercancel',stop); separator.addEventListener('lostpointercapture',stop);
    });
  }
  const themeButton = frame.querySelector<HTMLButtonElement>('[data-af-theme]')!;
  const labelTheme = () => themeButton.setAttribute('aria-label', 'Switch to ' + (document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark') + ' appearance');
  themeButton.addEventListener('click', () => {const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; try {localStorage.setItem(key + ':theme',theme)} catch {} labelTheme()});
  frame.querySelector<HTMLSelectElement>('[data-af-layout]')?.addEventListener('change', event => {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'framed' || value === 'tall') frame.dataset.layout = value;
  });
  sync(); labelTheme();
}
