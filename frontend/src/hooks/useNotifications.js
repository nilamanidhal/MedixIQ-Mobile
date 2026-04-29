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
