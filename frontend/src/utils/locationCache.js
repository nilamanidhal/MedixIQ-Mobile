import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';

export const cacheCurrentLocation = async () => {
    try {
        const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false, // Save battery for background checks
            timeout: 10000
        });

        const locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            speed: position.coords.speed, // Speed in m/s
            timestamp: new Date().toISOString()
        };

        await Preferences.set({
            key: 'last_known_location',
            value: JSON.stringify(locationData)
        });

        return locationData;
    } catch (error) {
        console.error("Failed to cache location", error);
        return null;
    }
};

export const getLastKnownLocation = async () => {
    const { value } = await Preferences.get({ key: 'last_known_location' });
    return value ? JSON.parse(value) : null;
};