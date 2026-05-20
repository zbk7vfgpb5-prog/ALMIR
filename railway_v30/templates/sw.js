/* Cyber Messenger — Service Worker */
const CACHE = 'cm-v1';
let userId = null;
let origin = '';
let pollInterval = null;
let lastMsgTs = {};

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });

// Receive messages from the page
self.addEventListener('message', e => {
    if (!e.data) return;
    if (e.data.type === 'SET_USER') {
        userId = e.data.userId;
        origin = e.data.origin || self.location.origin;
        startBackgroundPoll();
    }
    if (e.data.type === 'SHOW_NOTIF') {
        showNotif(e.data.title, e.data.body);
    }
    if (e.data.type === 'STOP') {
        stopBackgroundPoll();
    }
});

function startBackgroundPoll() {
    if (pollInterval) return;
    pollInterval = setInterval(backgroundPoll, 4000);
}

function stopBackgroundPoll() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

async function backgroundPoll() {
    if (!userId) return;
    // Check if any page is visible — if so, skip (page handles it)
    const allClients = await clients.matchAll({ type: 'window' });
    const hasVisible = allClients.some(c => c.visibilityState === 'visible');
    if (hasVisible) return;

    try {
        const r = await fetch(`${origin}/push/poll?user_id=${encodeURIComponent(userId)}&sw=1`);
        if (!r.ok) return;
        const data = await r.json();
        if (data.notifications && data.notifications.length) {
            for (const n of data.notifications) {
                await showNotif(n.title || 'Сообщение', n.body || '', n.icon);
            }
        }
    } catch(e) {}
}

async function showNotif(title, body, icon) {
    const opts = {
        body: body,
        icon: '/static/icon.png',
        badge: '/static/icon.png',
        tag: 'cm-' + Date.now(),
        vibrate: [200, 100, 200],
        data: { url: origin + '/' }
    };
    await self.registration.showNotification(title, opts);
}

self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = (e.notification.data && e.notification.data.url) || origin + '/';
    e.waitUntil(
        clients.matchAll({ type: 'window' }).then(cs => {
            for (const c of cs) {
                if (c.url === url && 'focus' in c) return c.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
