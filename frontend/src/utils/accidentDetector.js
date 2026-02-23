export class AccidentDetector {
    constructor() {
        this.readings = [];
        this.G_FORCE_THRESHOLD = 2.5; // 2.5G impact
        this.TIME_WINDOW = 2000; // Keep 2 seconds of history
    }

    // Call this every time the accelerometer updates
    processReading(accelData) {
        const { x, y, z } = accelData.accelerationIncludingGravity;
        
        // Calculate total G-force magnitude (Gravity is 9.81 m/s^2)
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const gForce = magnitude / 9.81;

        const now = Date.now();
        this.readings.push({ gForce, time: now });

        // Remove old readings outside the 2-second window
        this.readings = this.readings.filter(r => now - r.time <= this.TIME_WINDOW);

        return this.checkForAccident();
    }

    checkForAccident() {
        if (this.readings.length < 5) return false;

        // 1. Find the peak impact in the current window
        let maxG = 0;
        let peakIndex = -1;
        
        this.readings.forEach((r, idx) => {
            if (r.gForce > maxG) {
                maxG = r.gForce;
                peakIndex = idx;
            }
        });

        // 2. Condition A: Was there a > 2.5G spike?
        if (maxG < this.G_FORCE_THRESHOLD) return false;

        // 3. Condition B: After the spike, did movement drop significantly? (Stillness)
        // We look at the readings *after* the peak
        const postPeakReadings = this.readings.slice(peakIndex + 1);
        
        // Need at least 500ms of data after the peak to confirm stillness
        if (postPeakReadings.length > 0) {
            const timeSincePeak = postPeakReadings[postPeakReadings.length - 1].time - this.readings[peakIndex].time;
            if (timeSincePeak > 500) {
                // Calculate average G-force after impact (should return close to 1G - just gravity)
                const avgPostG = postPeakReadings.reduce((sum, r) => sum + r.gForce, 0) / postPeakReadings.length;
                
                // If average G-force is stable (between 0.8G and 1.2G), they have stopped moving
                if (avgPostG > 0.8 && avgPostG < 1.2) {
                    this.readings = []; // Reset to prevent double-triggering
                    return true; // 🚨 ACCIDENT DETECTED!
                }
            }
        }
        return false;
    }
}