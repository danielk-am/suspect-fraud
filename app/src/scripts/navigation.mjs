const sections = new Set(['start', 'new-case', 'unlock', 'evidence', 'infrastructure', 'reporting', 'learning']);

// Resolve prerequisites before trying to focus content hidden by authentication.
export function resolveNavigation(section, authenticated, hasCase) {
  if (!sections.has(section)) return null;
  if (!authenticated) return {target: 'unlock', message: 'Unlock the workspace first. Then create or open a case to continue.'};
  if (['start', 'new-case', 'unlock'].includes(section)) return {target: 'new-case', message: 'Create a private case, or open an existing case from the navigation.'};
  if (!hasCase) return {target: 'new-case', message: 'Create or open a case first. Your requested section will open afterwards.'};
  return {target: section, message: ''};
}
