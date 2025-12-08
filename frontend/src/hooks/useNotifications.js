// fully working code on local & hosted webpage //till minor project
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

console.log('[useNotifications] Hook file loaded');

export const useNotifications = () => {
  const [loading, setLoading] = useState(true);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscription, setSubscription] = useState(null);
  const { token, API_BASE_URL } = useAuth();

  console.log('[useNotifications] Hook initializing...', { isSupported, permission, loading });

  useEffect(() => {
    console.log('[useNotifications] useEffect running...');
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    setPermission(Notification.permission);
    console.log('[useNotifications] Support checked:', { supported, permission: Notification.permission });

    if (supported) {
      registerServiceWorker();
    }
    
    setLoading(false);
    console.log('[useNotifications] Initial loading finished.');
  }, []); // This empty array is correct, it only runs once.

  const registerServiceWorker = async () => {
    try {
      const swPath =
        window.location.hostname === 'localhost'
          ? '/medmind-sw.js' // local
          : '/medmind-sw.js'; // deployed
      
      const registration = await navigator.serviceWorker.register(swPath);
      console.log('✅ Service Worker registered from:', swPath);
      return registration;
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  };

  const requestPermission = useCallback(async () => {
    console.log('[useNotifications] requestPermission called...');
    if (!isSupported) {
      console.log('[useNotifications] Notifications not supported.');
      return false;
    }
    const permissionResult = await Notification.requestPermission();
    setPermission(permissionResult);
    console.log('[useNotifications] Permission result:', permissionResult);
    return permissionResult === 'granted';
  }, [isSupported]);

  const subscribeToNotifications = useCallback(async () => {
    console.log('🔔 Starting subscription flow...');
    try {
      if (!isSupported) throw new Error('Notifications not supported');
      if (permission !== 'granted') throw new Error('Permission not granted');
      if (!token) throw new Error('User not logged in (no token)');

      console.log('[useNotifications] subscribeToNotifications: All checks passed.');
      
      const registration = await navigator.serviceWorker.ready;
      console.log('🧩 Service worker ready:', registration);

      const publicVapidKey = 'BOqxWCt8W5cVuYlcXXH2ilIgge3KqAcDf6w1S9MmW2qz4i0MPjKV5FrX0aDMP9Eu7b7IuMtxANS0YjIKk-iLCyo';
      
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        console.log('✅ Already subscribed, reusing:', subscription);
      } else {
        console.log('[useNotifications] No subscription found, creating new one...');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        });
        console.log('📡 New subscription generated:', subscription);
      }

      console.log(`[useNotifications] Sending subscription to backend: ${API_BASE_URL}/notifications/subscribe`);
      const response = await axios.post(`${API_BASE_URL}/notifications/subscribe`, { 
        subscription: subscription.toJSON() 
      });

      if (response.status === 200 || response.status === 201) {
        setSubscription(subscription);
        console.log('✅ Subscription saved successfully');
        return true;
      } else {
        throw new Error(`Failed to save subscription, backend status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error subscribing to notifications:', error.message);
      return false;
    }
  }, [isSupported, permission, token, API_BASE_URL]);

  const sendTestNotification = useCallback(async () => {
    console.log(`[useNotifications] Sending test notification to: ${API_BASE_URL}/notifications/test`);
    try {
      const response = await axios.post(`${API_BASE_URL}/notifications/test`);

      if (response.status === 200) {
        console.log('✅ Test notification sent');
        return true;
      } else {
        throw new Error('Failed to send test notification');
      }
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      return false;
    }
  }, [API_BASE_URL]);

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  return {
    loading,
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribeToNotifications,
    sendTestNotification,
  };
};






// // frontend/src/hooks/useNotifications.js
// import { useState, useEffect, useCallback } from 'react';
// import { useAuth } from '../contexts/AuthContext';
// import axios from 'axios';

// console.log('[useNotifications] Hook file loaded');

// export const useNotifications = () => {
//   const [loading, setLoading] = useState(true);
//   const [isSupported, setIsSupported] = useState(false);
//   const [permission, setPermission] = useState('default');
//   const [subscription, setSubscription] = useState(null);

//   // from your Auth context
//   const { token, API_BASE_URL } = useAuth();

//   useEffect(() => {
//     console.log('[useNotifications] initializing...');
//     // Guard Notification access — prevents ReferenceError in WebView/native contexts
//     const hasNotification = typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
//     const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

//     const supported = hasNotification && hasServiceWorker;
//     setIsSupported(supported);

//     try {
//       setPermission(hasNotification ? Notification.permission : 'default');
//     } catch (e) {
//       console.warn('[useNotifications] Notification.permission read failed', e);
//       setPermission('default');
//     }

//     if (hasServiceWorker) {
//       // register service worker asynchronously, but do not block
//       registerServiceWorker().catch((err) => {
//         console.warn('[useNotifications] SW register failed (non-fatal):', err);
//       });
//     } else {
//       console.log('[useNotifications] Service Worker not available in this environment.');
//     }

//     setLoading(false);
//     console.log('[useNotifications] init done', { supported, permission: hasNotification ? Notification.permission : 'undefined' });
//     // run once
//   }, []);

//   const registerServiceWorker = async () => {
//     if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
//       throw new Error('Service worker not supported');
//     }
//     try {
//       const swPath = '/medmind-sw.js';
//       const registration = await navigator.serviceWorker.register(swPath);
//       console.log('[useNotifications] Service Worker registered at', swPath);
//       return registration;
//     } catch (err) {
//       console.error('[useNotifications] registerServiceWorker error:', err);
//       throw err;
//     }
//   };

//   // Request browser permission (guarded)
//   const requestPermission = useCallback(async () => {
//     console.log('[useNotifications] requestPermission called');
//     if (typeof window === 'undefined' || typeof window.Notification === 'undefined') {
//       console.warn('[useNotifications] Notification API not available in this environment');
//       return false;
//     }
//     try {
//       const result = await Notification.requestPermission();
//       setPermission(result);
//       console.log('[useNotifications] Permission result:', result);
//       return result === 'granted';
//     } catch (err) {
//       console.error('[useNotifications] requestPermission error:', err);
//       return false;
//     }
//   }, []);

//   // helper to convert VAPID key
//   const urlBase64ToUint8Array = (base64String) => {
//     const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
//     const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
//     const rawData = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
//     const outputArray = new Uint8Array(rawData.length);
//     for (let i = 0; i < rawData.length; ++i) {
//       outputArray[i] = rawData.charCodeAt(i);
//     }
//     return outputArray;
//   };

//   // Subscribe to push notifications (web push) — guarded and sends auth header
//   const subscribeToNotifications = useCallback(async () => {
//     console.log('[useNotifications] subscribeToNotifications start');
//     if (!isSupported) {
//       console.warn('[useNotifications] Not supported in this environment');
//       return false;
//     }
//     if (permission !== 'granted') {
//       console.warn('[useNotifications] Permission not granted, current:', permission);
//       return false;
//     }
//     if (!token) {
//       console.warn('[useNotifications] No auth token available — user probably not logged in');
//       return false;
//     }

//     try {
//       const registration = await navigator.serviceWorker.ready;
//       console.log('[useNotifications] serviceWorker.ready:', registration);

//       const publicVapidKey = import.meta.env.VITE_PUBLIC_VAPID_KEY || 'BOqxWCt8W5cVuYlcXXH2ilIgge3KqAcDf6w1S9MmW2qz4i0MPjKV5FrX0aDMP9Eu7b7IuMtxANS0YjIKk-iLCyo';
//       let sub = await registration.pushManager.getSubscription();

//       if (!sub) {
//         console.log('[useNotifications] creating new subscription');
//         sub = await registration.pushManager.subscribe({
//           userVisibleOnly: true,
//           applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
//         });
//       } else {
//         console.log('[useNotifications] existing subscription found');
//       }

//       const subJson = typeof sub.toJSON === 'function' ? sub.toJSON() : sub;
//       console.log('[useNotifications] subscription payload prepared');

//       const res = await axios.post(
//         `${API_BASE_URL}/notifications/subscribe`,
//         { subscription: subJson },
//         { headers: { Authorization: token ? `Bearer ${token}` : '' } }
//       );

//       if (res.status === 200 || res.status === 201) {
//         setSubscription(sub);
//         console.log('[useNotifications] subscription saved on backend');
//         return true;
//       } else {
//         console.warn('[useNotifications] backend returned non-OK status', res.status);
//         return false;
//       }
//     } catch (err) {
//       console.error('[useNotifications] subscribeToNotifications error:', err);
//       return false;
//     }
//   }, [isSupported, permission, token, API_BASE_URL]);

//   // Call backend test endpoint (include auth header)
//   const sendTestNotification = useCallback(async () => {
//     console.log('[useNotifications] sendTestNotification');
//     try {
//       const res = await axios.post(
//         `${API_BASE_URL}/notifications/test`,
//         {},
//         { headers: { Authorization: token ? `Bearer ${token}` : '' } }
//       );
//       if (res.status === 200) {
//         console.log('[useNotifications] test notification request sent');
//         return true;
//       } else {
//         console.warn('[useNotifications] test notification endpoint returned', res.status);
//         return false;
//       }
//     } catch (err) {
//       console.error('[useNotifications] sendTestNotification error:', err);
//       return false;
//     }
//   }, [API_BASE_URL, token]);

//   return {
//     loading,
//     isSupported,
//     permission,
//     subscription,
//     requestPermission,
//     subscribeToNotifications,
//     sendTestNotification,
//   };
// };

