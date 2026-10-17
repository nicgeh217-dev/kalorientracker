// Aktion, mit der die App gestartet wurde: Kurzbefehle auf dem App-Icon (scan, weight) oder "Teilen in die App" (shared).
const ACTIONS = ['scan', 'weight', 'shared'];

export function parseLaunchAction(search) {
  const action = new URLSearchParams(search).get('action');
  return ACTIONS.includes(action) ? action : null;
}
