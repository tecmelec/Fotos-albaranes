const CACHE_NAME = 'disparo-cache-v2';
const SHELL_FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests for the app shell; let everything
  // else (like Supabase uploads) go straight to the network untouched.
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  // Network-first: always try to get the freshest version of the app shell
  // when online, so future updates show up immediately. Falls back to the
  // cached copy only when offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Best-effort reminder check for Android/Chrome installs that grant
// periodic background sync. Not supported on iOS Safari; the app also
// checks the schedule every minute while open, which covers most cases.
const REMINDER_MESSAGE = '📸 ¡No te olvides! Envía las fotos de los albaranes recibidos hoy y déjalo todo al día. 😊 ¡Gracias!';
const REMINDER_SCHEDULE = [
  { days:[1,2,3,4], hour:16, minute:0 },
  { days:[5], hour:12, minute:0 }
];

self.addEventListener('periodicsync', (event) => {
  if(event.tag === 'albaranes-reminder'){
    event.waitUntil(checkAndNotify());
  }
});

async function checkAndNotify(){
  const now = new Date();
  const day = now.getDay();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const match = REMINDER_SCHEDULE.find(r => r.days.includes(day) && minutesNow >= (r.hour * 60 + r.minute));
  if(!match) return;

  const cache = await caches.open(CACHE_NAME);
  const key = `sw-reminder-${now.toDateString()}`;
  const already = await cache.match(key);
  if(already) return;
  await cache.put(key, new Response('sent'));

  await self.registration.showNotification('Alb. Tecmelec', {
    body: REMINDER_MESSAGE,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'albaranes-reminder'
  });
}
