// A unique name for your cache
const CACHE_NAME = 'medimind-v2'; // Tip: Increment this version number when you update the service worker

// A list of all the essential files your app needs to work offline
const urlsToCache = [
  '/',
  '/manifest.json'
  // Add paths to other critical assets like your main CSS file, JS file, and logo
  // Example: '/css/style.css', '/js/main.js', '/images/logo.png'
];

// --- INSTALL EVENT ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching essential files.');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// --- ACTIVATE EVENT ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- FETCH EVENT ---
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

// --- PUSH NOTIFICATION EVENT ---
self.addEventListener('push', (event) => {
  let notificationTitle = 'MediMind Reminder';
  let notificationOptions = {
    body: 'Time for your medicine!',
    icon: '/images/medicine.png',
    badge: '/images/MedMindLogoBlank.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '2'
    }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationTitle = data.title || notificationTitle;
      notificationOptions.body = data.body || notificationOptions.body;
      notificationOptions.icon = data.icon || notificationOptions.icon;
      notificationOptions.badge = data.badge || notificationOptions.badge;
    } catch (e) {
      notificationOptions.body = event.data.text();
    }
  }

  // === START: MODIFIED SECTION ===
  // This promise chain will first send a message to the app to play the alarm,
  // and then it will show the visual notification.
  const promiseChain = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(clients => {
    if (clients && clients.length) {
      console.log('SW: Found active client, posting PLAY_ALARM message.');
      clients.forEach(client => {
        // The message your Dashboard is listening for
        client.postMessage({ type: 'PLAY_ALARM' });
      });
    }else {
      // --- ADD THIS LOG ---
      console.log('❌ SW: No active client found to send message to.');
    }
    // After messaging, show the notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
  });

  event.waitUntil(promiseChain);
  // === END: MODIFIED SECTION ===
});

// --- NOTIFICATION CLICK EVENT ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});







// // A unique name for your cache
// const CACHE_NAME = 'medimind-v2'; // Tip: Increment this version number when you update the service worker

// // A list of all the essential files your app needs to work offline
// const urlsToCache = [
//   '/',
//   '/manifest.json'
//   // Add paths to other critical assets like your main CSS file, JS file, and logo
//   // Example: '/css/style.css', '/js/main.js', '/images/logo.png'
// ];

// // --- INSTALL EVENT ---
// // This event runs when a new service worker is installed.
// self.addEventListener('install', (event) => {
//   event.waitUntil(
//     caches.open(CACHE_NAME)
//       .then((cache) => {
//         console.log('Opened cache and caching essential files.');
//         return cache.addAll(urlsToCache);
//       })
//       .then(() => self.skipWaiting()) // This forces the new service worker to become active immediately
//   );
// });

// // --- ACTIVATE EVENT ---
// // This event runs after the new worker is installed and has become active.
// self.addEventListener('activate', (event) => {
//   event.waitUntil(
//     caches.keys().then((cacheNames) => {
//       return Promise.all(
//         // Find all old caches and delete them to save space
//         cacheNames.map((cacheName) => {
//           if (cacheName !== CACHE_NAME) {
//             console.log('Deleting old cache:', cacheName);
//             return caches.delete(cacheName);
//           }
//         })
//       );
//     }).then(() => self.clients.claim()) // This makes the worker take control of open pages right away
//   );
// });

// // --- FETCH EVENT ---
// // This event intercepts network requests and serves cached files when offline.
// self.addEventListener('fetch', (event) => {
//   event.respondWith(
//     caches.match(event.request)
//       .then((response) => {
//         // If the requested file is in the cache, return it. Otherwise, fetch it from the network.
//         return response || fetch(event.request);
//       })
//   );
// });

// // --- PUSH NOTIFICATION EVENT ---
// // This event handles incoming push notifications from your server.
// self.addEventListener('push', (event) => {
//   // Set default values for the notification
//   let notificationTitle = 'MediMind Reminder';
//   let notificationOptions = {
//     body: 'Time for your medicine!',
//     icon: '/images/medicine.png', // Use relative paths for better reliability
//     badge: '/images/MedMindLogoBlank.png',
//     vibrate: [100, 50, 100],
//     data: {
//       dateOfArrival: Date.now(),
//       primaryKey: '2'
//     }
//   };

//   // Check if there's any data with the push event
//   if (event.data) {
//     try {
//       // Try to parse the data as JSON (for notifications from your backend)
//       const data = event.data.json();
//       notificationTitle = data.title || notificationTitle;
//       notificationOptions.body = data.body || notificationOptions.body;
//       notificationOptions.icon = data.icon || notificationOptions.icon;
//       notificationOptions.badge = data.badge || notificationOptions.badge;
//     } catch (e) {
//       // If JSON parsing fails, treat the data as plain text (for DevTools test pushes)
//       notificationOptions.body = event.data.text();
//     }
//   }

//   // Show the notification
//   event.waitUntil(
//     self.registration.showNotification(notificationTitle, notificationOptions)
//   );
// });

// // --- NOTIFICATION CLICK EVENT ---
// // This event handles what happens when a user clicks on the notification.
// self.addEventListener('notificationclick', (event) => {
//   // Close the notification pop-up
//   event.notification.close();
  
//   // Open the main application window/tab
//   event.waitUntil(
//     clients.openWindow('/')
//   );
// });








// // Service Worker for MediMind

// const CACHE_NAME = 'medimind-v1';
// const urlsToCache = [
//   '/',
//   '/manifest.json'
// ];
// //add this above '/static/js/bundle.js','/static/css/main.css',
// // Install service worker
// self.addEventListener('install', (event) => {
//   event.waitUntil(
//     caches.open(CACHE_NAME)
//       .then((cache) => {
//         return cache.addAll(urlsToCache);
//       })
//   );
// });

// // Fetch event
// self.addEventListener('fetch', (event) => {
//   event.respondWith(
//     caches.match(event.request)
//       .then((response) => {
//         // Return cached version or fetch from network
//         return response || fetch(event.request);
//       }
//     )
//   );
// });

// // Push notification event
// self.addEventListener('push', (event) => {
//   const options = {
//     body: 'Time for your medicine!',
//     icon: 'https://medmind-heathcare.netlify.app/images/medicine.png',
//     badge: 'https://medmind-heathcare.netlify.app/images/MedMindLogoBlank.png',
//     vibrate: [100, 50, 100],
//     data: {
//       dateOfArrival: Date.now(),
//       primaryKey: '2'
//     }
//   };

//   if (event.data) {
//     const data = event.data.json();
//     options.body = data.body || options.body;
//     options.title = data.title || 'MediMind Reminder';
//     options.icon = data.icon || options.icon;
//     options.badge = data.badge || options.badge;
//     options.data = data.data || options.data;
//   }

//   event.waitUntil(
//     self.registration.showNotification(options.title || 'MediMind Reminder', options)
//   );
// });

// // Notification click event
// self.addEventListener('notificationclick', (event) => {
//   event.notification.close();
  
//   event.waitUntil(
//     clients.openWindow('/')
//   );
// });







// Service Worker for MediMind (push notifications only)

// Push notification event
// self.addEventListener("push", (event) => {
//   let data = {};
//   if (event.data) {
//     data = event.data.json();
//   }

//   const title = data.title || "MediMind Reminder";
//   const options = {
//     body: data.body || "Time for your medicine!",
//     icon: data.icon || "/images/medicine.jpg",
//     badge: data.badge || "/images/notification.jpg",
//     vibrate: [100, 50, 100],
//     data: data.data || { dateOfArrival: Date.now(), primaryKey: "2" },
//   };

//   event.waitUntil(
//     self.registration.showNotification(title, options)
//   );
// });

// // Handle notification clicks
// self.addEventListener("notificationclick", (event) => {
//   event.notification.close();
//   event.waitUntil(clients.openWindow("/"));
// });
