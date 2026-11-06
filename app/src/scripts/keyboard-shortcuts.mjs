// Pass browser platform data; no network or fingerprint storage is needed.
export function shortcutLabels(platform = '') {
  const mac = /mac|iphone|ipad|ipod/i.test(platform);
  return {
    modifier: mac ? '⌘' : 'Ctrl',
    shift: mac ? '⇧' : 'Shift',
    send: mac ? 'Command + Return to send' : 'Ctrl + Enter to send',
    newline: mac ? 'Shift + Return for a new line' : 'Shift + Enter for a new line',
  };
}
