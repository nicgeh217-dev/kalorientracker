// Pausenende als Benachrichtigung in der Android-App, damit es auch bei gesperrtem Handy ankommt.
// Im Browser (PWA) passiert nichts. Fehler bleiben hier: Eine Benachrichtigung darf nie das Training stören.
const ID = 7001;
const CHANNEL = 'pause';

export function restNotifier({ cap = globalThis.Capacitor, now = () => Date.now() } = {}) {
  const active = Boolean(cap?.isNativePlatform?.());
  const call = (method, options) => cap.nativePromise('LocalNotifications', method, options);
  let allowed = null; // null = noch nicht geprüft. Eine Ablehnung gilt, damit nicht jede Pause erneut fragt.
  let queue = Promise.resolve();

  const enqueue = (work) => {
    if (!active) return Promise.resolve();
    queue = queue.then(work).catch(() => {});
    return queue;
  };

  async function prepare() {
    if (allowed !== null) return allowed;
    let { display } = await call('checkPermissions');
    if (display !== 'granted' && display !== 'denied') ({ display } = await call('requestPermissions'));
    allowed = display === 'granted';
    if (allowed) await call('createChannel', { id: CHANNEL, name: 'Pausen-Timer', description: 'Meldet das Ende einer Trainingspause', importance: 4, vibration: true });
    return allowed;
  }

  return {
    schedule: (endAtMs) => enqueue(async () => {
      if (endAtMs <= now() || !(await prepare())) return;
      await call('schedule', {
        notifications: [{
          id: ID,
          title: 'Pause vorbei',
          body: 'Weiter mit dem nächsten Satz.',
          channelId: CHANNEL,
          smallIcon: 'ic_stat_pause',
          schedule: { at: new Date(endAtMs).toISOString(), allowWhileIdle: true },
        }],
      });
    }),
    cancel: () => enqueue(() => call('cancel', { notifications: [{ id: ID }] })),
  };
}
