// Progressive enhancement: the native select remains the form's source of truth.
// Without Popover API support or JavaScript, the ordinary select stays usable.
if ('showPopover' in HTMLElement.prototype) {
  document.querySelectorAll<HTMLSelectElement>('select[data-af-popover-select]').forEach(select => {
    if (select.dataset.afEnhanced) return;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'af-select-trigger';
    trigger.id = select.id + '-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const text = document.createElement('span');
    const arrow = document.createElement('span');
    arrow.className = 'af-select-chevron';
    arrow.setAttribute('aria-hidden', 'true');
    // The chevron is drawn in CSS so it stays consistent across platforms.
    trigger.append(text, arrow);
    const popup = document.createElement('div');
    popup.id = select.id + '-options';
    popup.className = 'af-select-popover';
    popup.setAttribute('popover', 'auto');
    popup.setAttribute('role', 'listbox');
    trigger.setAttribute('aria-controls', popup.id);
    const labels = [...select.labels || []];
    const labelledBy = labels.map((label, i) => {
      label.id ||= select.id + '-label-' + i;
      label.htmlFor = trigger.id;
      return label.id;
    }).join(' ');
    if (labelledBy) {trigger.setAttribute('aria-labelledby', labelledBy); popup.setAttribute('aria-labelledby', labelledBy)}
    else trigger.setAttribute('aria-label', select.getAttribute('aria-label') || select.name || 'Choose an option');
    const description = select.getAttribute('aria-describedby');
    if (description) trigger.setAttribute('aria-describedby', description);
    select.after(trigger, popup);
    const options = [...select.options];
    const items = options.map((option, i) => {
      const item = document.createElement('div');
      item.id = popup.id + '-' + i;
      item.className = 'af-select-option';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-disabled', String(option.disabled));
      const label = document.createElement('span');
      label.textContent = option.label;
      const check = document.createElement('span');
      check.className = 'af-select-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';
      item.append(label, check);
      item.addEventListener('pointerdown', event => event.preventDefault());
      item.addEventListener('pointermove', () => {if (!option.disabled) activate(i)});
      item.addEventListener('click', () => {if (!option.disabled) commit(i)});
      popup.append(item);
      return item;
    });
    let active = select.selectedIndex;
    let buffer = '', typedAt = 0;
    const isOpen = () => popup.matches(':popover-open');
    const enabled = () => options.map((option, i) => option.disabled ? -1 : i).filter(i => i >= 0);
    function activate(index: number) {
      active = index;
      items.forEach((item, i) => item.toggleAttribute('data-active', i === index));
      if (items[index]) {
        trigger.setAttribute('aria-activedescendant', items[index].id);
        items[index].scrollIntoView({block:'nearest'});
      }
    }
    function sync() {
      text.textContent = select.selectedOptions[0]?.label || 'Choose an option';
      trigger.disabled = select.disabled;
      items.forEach((item, i) => item.setAttribute('aria-selected', String(i === select.selectedIndex)));
    }
    function position() {
      const rect = trigger.getBoundingClientRect();
      if (!rect.width || trigger.closest('[inert]')) {close(); return}
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
      const below = Math.max(0, top + height - rect.bottom - 12);
      const above = Math.max(0, rect.top - top - 12);
      const up = below < Math.min(popup.scrollHeight, 200) && above > below;
      popup.style.width = Math.min(rect.width, width - 16) + 'px';
      popup.style.maxHeight = Math.min(280, up ? above : below) + 'px';
      popup.style.left = Math.max(left + 8, Math.min(rect.left, left + width - popup.offsetWidth - 8)) + 'px';
      popup.style.top = (up ? rect.top - popup.offsetHeight - 6 : rect.bottom + 6) + 'px';
    }
    function open(index = select.selectedIndex) {
      if (select.disabled) return;
      sync();
      popup.showPopover();
      position();
      trigger.setAttribute('aria-expanded', 'true');
      activate(options[index] && !options[index].disabled ? index : enabled()[0]);
    }
    function close() {if (isOpen()) popup.hidePopover()}
    function commit(index: number) {
      select.selectedIndex = index;
      select.dispatchEvent(new Event('input', {bubbles:true}));
      select.dispatchEvent(new Event('change', {bubbles:true}));
      sync(); close(); trigger.focus();
    }
    trigger.addEventListener('click', () => isOpen() ? close() : open());
    trigger.addEventListener('keydown', event => {
      const key = event.key;
      if (key === 'Escape' && isOpen()) {event.preventDefault(); event.stopPropagation(); close(); return}
      if (key === 'Tab') {close(); return}
      if (['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(key)) {
        event.preventDefault();
        const indices = enabled();
        if (!isOpen()) {open(key === 'Home' ? indices[0] : key === 'End' ? indices.at(-1) : select.selectedIndex); return}
        if (key === 'Enter' || key === ' ') {if (active >= 0) commit(active); return}
        const current = indices.indexOf(active);
        const next = key === 'Home' ? 0 : key === 'End' ? indices.length - 1 : Math.max(0, Math.min(indices.length - 1, current + (key === 'ArrowDown' ? 1 : -1)));
        activate(indices[next]);
      } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        buffer = performance.now() - typedAt > 700 ? key : buffer + key;
        typedAt = performance.now();
        if (!isOpen()) open();
        const indices = enabled();
        const ordered = [...indices.filter(i => i > active), ...indices.filter(i => i <= active)];
        const match = ordered.find(i => options[i].label.toLocaleLowerCase().startsWith(buffer.toLocaleLowerCase()));
        if (match !== undefined) activate(match);
      }
    });
    popup.addEventListener('toggle', () => {
      trigger.setAttribute('aria-expanded', String(isOpen()));
      if (!isOpen()) trigger.removeAttribute('aria-activedescendant');
    });
    trigger.addEventListener('blur', close);
    select.addEventListener('change', sync);
    select.form?.addEventListener('reset', () => queueMicrotask(sync));
    document.addEventListener('scroll', event => {
      if (isOpen() && !popup.contains(event.target as Node)) close();
    }, true);
    window.addEventListener('resize', () => {if (isOpen()) position()});
    window.visualViewport?.addEventListener('resize', () => {if (isOpen()) position()});
    // Closing/hiding a panel must not strand a popup in the top layer.
    document.addEventListener('click', () => {if (isOpen() && (!trigger.getClientRects().length || trigger.closest('[inert]'))) close()});
    sync();
    select.hidden = true;
    select.dataset.afEnhanced = 'true';
  });
}
