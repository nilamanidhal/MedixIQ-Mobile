import { useState, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL;

export const useDrugInteraction = () => {
    const [loading, setLoading] = useState(false);
    // Simple cache — same medicine not checked twice in same session
    const cacheRef = useRef({});

    const checkInteractions = async (newMedName, existingMedicinesList) => {
        if (!newMedName?.trim()) return null;

        // Offline check
        if (!navigator.onLine) {
            return { 
                status: 'ERROR', 
                message: 'You are offline. Drug safety check skipped.' 
            };
        }

        // Cache check — same medicine name returns cached result
        const cacheKey = `${newMedName.toLowerCase()}_${existingMedicinesList
            .filter(m => m.isActive && !m.isPaused)
            .map(m => m.name.toLowerCase())
            .sort()
            .join('_')}`;

        if (cacheRef.current[cacheKey]) {
            return cacheRef.current[cacheKey];
        }

        setLoading(true);

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(`${API_BASE_URL}/drug/check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    newMedName: newMedName.trim(),
                    existingMedicines: existingMedicinesList
                })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            // Cache the result
            cacheRef.current[cacheKey] = data;

            return data;

        } catch (error) {
            console.error('Drug interaction check failed:', error);

            // Retry once automatically
            try {
                await new Promise(r => setTimeout(r, 1500)); // wait 1.5s
                const token = localStorage.getItem('token');
                const retry = await fetch(`${API_BASE_URL}/drug/check`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        newMedName: newMedName.trim(),
                        existingMedicines: existingMedicinesList
                    })
                });
                if (retry.ok) {
                    const retryData = await retry.json();
                    cacheRef.current[cacheKey] = retryData;
                    return retryData;
                }
            } catch {
                // retry also failed
            }

            return { 
                status: 'ERROR', 
                message: 'Drug interaction service temporarily unavailable. Please consult your doctor.' 
            };

        } finally {
            setLoading(false);
        }
    };

    // Clear cache when needed (call after medicine added)
    const clearCache = () => {
        cacheRef.current = {};
    };

    return { checkInteractions, loading, clearCache };
};

