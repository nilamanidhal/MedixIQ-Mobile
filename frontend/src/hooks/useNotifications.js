import { useState, useCallback, useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export const useNotifications = () => {
  const [permission, setPermission] = useState('default');
  
  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.checkPermissions();
      setPermission(status.display);
    } else {
      // Fallback for web testing
      setPermission(Notification.permission);
    }
  };

  const requestPermission = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      // Mobile Permission Request
      const result = await LocalNotifications.requestPermissions();
      setPermission(result.display);
      return result.display === 'granted';
    } else {
      // Web Permission Request (Fallback)
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    }
  }, []);

  // We keep this function to avoid breaking your UI if it calls it,
  // but logically, the alarms are set in useMedicines now.
  const subscribeToNotifications = async () => {
    console.log("Mobile App: Subscription is handled via LocalNotifications automatically.");
    return true;
  };

  return {
    permission,
    requestPermission,
    subscribeToNotifications
  };
};



// // fully working code on local & hosted webpage //till minor project
// import { useState, useEffect, useCallback } from 'react';
// import { useAuth } from '../contexts/AuthContext';
// import axios from 'axios';

// console.log('[useNotifications] Hook file loaded');

// export const useNotifications = () => {
//   const [loading, setLoading] = useState(true);
//   const [isSupported, setIsSupported] = useState(false);
//   const [permission, setPermission] = useState('default');
//   const [subscription, setSubscription] = useState(null);
//   const { token, API_BASE_URL } = useAuth();

//   console.log('[useNotifications] Hook initializing...', { isSupported, permission, loading });

//   useEffect(() => {
//     console.log('[useNotifications] useEffect running...');
//     const supported = 'Notification' in window && 'serviceWorker' in navigator;
//     setIsSupported(supported);
//     setPermission(Notification.permission);
//     console.log('[useNotifications] Support checked:', { supported, permission: Notification.permission });

//     if (supported) {
//       registerServiceWorker();
//     }
    
//     setLoading(false);
//     console.log('[useNotifications] Initial loading finished.');
//   }, []); // This empty array is correct, it only runs once.

//   const registerServiceWorker = async () => {
//     try {
//       const swPath =
//         window.location.hostname === 'localhost'
//           ? '/medmind-sw.js' // local
//           : '/medmind-sw.js'; // deployed
      
//       const registration = await navigator.serviceWorker.register(swPath);
//       console.log('✅ Service Worker registered from:', swPath);
//       return registration;
//     } catch (error) {
//       console.error('❌ Service Worker registration failed:', error);
//     }
//   };

//   const requestPermission = useCallback(async () => {
//     console.log('[useNotifications] requestPermission called...');
//     if (!isSupported) {
//       console.log('[useNotifications] Notifications not supported.');
//       return false;
//     }
//     const permissionResult = await Notification.requestPermission();
//     setPermission(permissionResult);
//     console.log('[useNotifications] Permission result:', permissionResult);
//     return permissionResult === 'granted';
//   }, [isSupported]);

//   const subscribeToNotifications = useCallback(async () => {
//     console.log('🔔 Starting subscription flow...');
//     try {
//       if (!isSupported) throw new Error('Notifications not supported');
//       if (permission !== 'granted') throw new Error('Permission not granted');
//       if (!token) throw new Error('User not logged in (no token)');

//       console.log('[useNotifications] subscribeToNotifications: All checks passed.');
      
//       const registration = await navigator.serviceWorker.ready;
//       console.log('🧩 Service worker ready:', registration);

//       const publicVapidKey = 'BOqxWCt8W5cVuYlcXXH2ilIgge3KqAcDf6w1S9MmW2qz4i0MPjKV5FrX0aDMP9Eu7b7IuMtxANS0YjIKk-iLCyo';
      
//       let subscription = await registration.pushManager.getSubscription();
//       if (subscription) {
//         console.log('✅ Already subscribed, reusing:', subscription);
//       } else {
//         console.log('[useNotifications] No subscription found, creating new one...');
//         subscription = await registration.pushManager.subscribe({
//           userVisibleOnly: true,
//           applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
//         });
//         console.log('📡 New subscription generated:', subscription);
//       }

//       console.log(`[useNotifications] Sending subscription to backend: ${API_BASE_URL}/notifications/subscribe`);
//       const response = await axios.post(`${API_BASE_URL}/notifications/subscribe`, { 
//         subscription: subscription.toJSON() 
//       });

//       if (response.status === 200 || response.status === 201) {
//         setSubscription(subscription);
//         console.log('✅ Subscription saved successfully');
//         return true;
//       } else {
//         throw new Error(`Failed to save subscription, backend status: ${response.status}`);
//       }
//     } catch (error) {
//       console.error('❌ Error subscribing to notifications:', error.message);
//       return false;
//     }
//   }, [isSupported, permission, token, API_BASE_URL]);

//   const sendTestNotification = useCallback(async () => {
//     console.log(`[useNotifications] Sending test notification to: ${API_BASE_URL}/notifications/test`);
//     try {
//       const response = await axios.post(`${API_BASE_URL}/notifications/test`);

//       if (response.status === 200) {
//         console.log('✅ Test notification sent');
//         return true;
//       } else {
//         throw new Error('Failed to send test notification');
//       }
//     } catch (error) {
//       console.error('❌ Error sending test notification:', error);
//       return false;
//     }
//   }, [API_BASE_URL]);

//   const urlBase64ToUint8Array = (base64String) => {
//     const padding = '='.repeat((4 - base64String.length % 4) % 4);
//     const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
//     const rawData = window.atob(base64);
//     const outputArray = new Uint8Array(rawData.length);
//     for (let i = 0; i < rawData.length; ++i) {
//       outputArray[i] = rawData.charCodeAt(i);
//     }
//     return outputArray;
//   };

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
