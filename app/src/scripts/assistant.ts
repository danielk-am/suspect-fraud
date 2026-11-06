// UI only. A real provider adapter owns sending, cancellation and tool effects.
import {shortcutLabels} from './keyboard-shortcuts.mjs';
const panel = document.querySelector<HTMLElement>('#af-assistant');
if (panel) {
  const platform = (navigator as Navigator & {userAgentData?: {platform?: string}}).userAgentData?.platform || navigator.platform;
  const shortcuts = shortcutLabels(platform);
  panel.querySelector<HTMLElement>('[data-af-send-modifier]')!.textContent = shortcuts.modifier;
  panel.querySelector<HTMLElement>('[data-af-shift-key]')!.textContent = shortcuts.shift;
  panel.querySelector<HTMLElement>('[data-af-shortcut="send"]')!.setAttribute('aria-label', shortcuts.send);
  panel.querySelector<HTMLElement>('[data-af-shortcut="newline"]')!.setAttribute('aria-label', shortcuts.newline);
  const options = panel.querySelector<HTMLElement>('#af-assistant-options')!;
  const toggles = [...panel.querySelectorAll<HTMLButtonElement>('[data-af-options-toggle]')];
  const prompt = panel.querySelector<HTMLTextAreaElement>('#af-prompt')!;
  const status = panel.querySelector<HTMLElement>('#af-chat-status')!;
  let opener: HTMLButtonElement | null = null;
  const closeOptions = (restore = false) => {
    options.hidden = true;
    toggles.forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (restore) opener?.focus();
  };
  toggles.forEach(button => button.addEventListener('click', () => {
    if (!options.hidden) {closeOptions(true); return}
    opener = button;
    options.hidden = false;
    toggles.forEach(toggle => toggle.setAttribute('aria-expanded', 'true'));
    options.querySelector<HTMLElement>('.af-select-trigger, select:not([hidden])')?.focus();
  }));
  panel.querySelector('[data-af-options-close]')?.addEventListener('click', () => closeOptions(true));
  document.addEventListener('click', event => {
    const target = event.target as Node;
    if (!options.hidden && !options.contains(target) && !toggles.some(toggle => toggle.contains(target))) closeOptions();
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !options.hidden) {event.preventDefault(); event.stopPropagation(); closeOptions(true)}
  });
  panel.querySelector('[data-af-toggle="right"]')?.addEventListener('click', () => closeOptions());
  panel.querySelectorAll<HTMLButtonElement>('[data-af-prompt]').forEach(button => button.addEventListener('click', () => {
    prompt.value = (button.dataset.afPrompt || '').slice(0, prompt.maxLength);
    prompt.dispatchEvent(new Event('input', {bubbles:true}));
    prompt.focus();
    status.textContent = 'Draft ready. Connect an assistant before sending.';
  }));
  panel.querySelector('[data-af-new-chat]')?.addEventListener('click', () => {
    // Connected apps intercept this event to cancel active work before resetting.
    if (!panel.dispatchEvent(new CustomEvent('af:new-conversation', {bubbles:true, cancelable:true}))) return;
    closeOptions();
    prompt.value = '';
    panel.querySelector('[data-af-messages]')?.replaceChildren();
    panel.querySelector<HTMLElement>('[data-af-welcome]')!.hidden = false;
    status.textContent = 'New conversation. Connect an assistant before sending.';
    prompt.focus();
  });
  panel.querySelector('[data-af-composer]')?.addEventListener('submit', event => {
    event.preventDefault();
    status.textContent = 'Disconnected. Your draft has not been sent.';
  });
  prompt.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      status.textContent = 'Disconnected. Your draft has not been sent.';
    }
  });
}
