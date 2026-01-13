/**
 * Storage Manager - LocalStorage Management for Duty Records
 * Handles persistence of duty history and user preferences
 */

const StorageManager = (function() {
    'use strict';

    /**
     * Storage keys
     */
    const KEYS = {
        DUTY_RECORDS: 'acp700_duty_records',
        PREFERENCES: 'acp700_preferences',
        LAST_SYNC: 'acp700_last_sync',
        ACTIVE_DUTY: 'acp700_active_duty'
    };

    /**
     * Default preferences
     */
    const DEFAULT_PREFERENCES = {
        defaultSectors: 2,
        defaultAcclimatization: 'acclimatized',
        showZuluTime: true,
        warningThreshold: 85,
        dangerThreshold: 95,
        theme: 'dark'
    };

    /**
     * Maximum records to store (prevent storage overflow)
     */
    const MAX_RECORDS = 500;

    /**
     * Check if localStorage is available
     */
    function isStorageAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Get all duty records from storage
     * 
     * @returns {Array} Array of duty record objects
     */
    function getDutyRecords() {
        if (!isStorageAvailable()) {
            console.warn('LocalStorage not available');
            return [];
        }

        try {
            const data = localStorage.getItem(KEYS.DUTY_RECORDS);
            if (!data) return [];
            
            const records = JSON.parse(data);
            
            // Validate that it's an array
            if (!Array.isArray(records)) {
                console.warn('Invalid duty records format, resetting');
                return [];
            }
            
            // Sort by date descending (most recent first)
            return records.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB - dateA;
            });
        } catch (e) {
            console.error('Error reading duty records:', e);
            return [];
        }
    }

    /**
     * Save duty records to storage
     * 
     * @param {Array} records - Array of duty record objects
     * @returns {boolean} Success status
     */
    function saveDutyRecords(records) {
        if (!isStorageAvailable()) {
            console.warn('LocalStorage not available');
            return false;
        }

        try {
            // Limit records to prevent storage overflow
            const trimmedRecords = records.slice(0, MAX_RECORDS);
            
            localStorage.setItem(KEYS.DUTY_RECORDS, JSON.stringify(trimmedRecords));
            localStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
            
            return true;
        } catch (e) {
            console.error('Error saving duty records:', e);
            
            // Check if it's a quota exceeded error
            if (e.name === 'QuotaExceededError') {
                // Try to remove oldest records and retry
                const trimmedRecords = records.slice(0, Math.floor(records.length / 2));
                try {
                    localStorage.setItem(KEYS.DUTY_RECORDS, JSON.stringify(trimmedRecords));
                    return true;
                } catch (e2) {
                    console.error('Still cannot save after trimming:', e2);
                }
            }
            
            return false;
        }
    }

    /**
     * Add a new duty record
     * 
     * @param {Object} record - Duty record object
     * @returns {Object} Result with success status and record ID
     */
    function addDutyRecord(record) {
        // Validate required fields
        if (!record.date || !record.reportTime || !record.releaseTime) {
            return {
                success: false,
                error: 'Missing required fields (date, reportTime, releaseTime)'
            };
        }

        // Generate unique ID
        const id = generateId();
        
        // Calculate duty time in minutes
        const reportMinutes = timeToMinutes(record.reportTime);
        const releaseMinutes = timeToMinutes(record.releaseTime);
        
        let dutyMinutes = releaseMinutes - reportMinutes;
        if (dutyMinutes < 0) dutyMinutes += 1440; // Handle overnight duty
        
        // Parse flight time
        const flightMinutes = Math.round((parseFloat(record.flightTime) || 0) * 60);
        
        // Create normalized record
        const normalizedRecord = {
            id: id,
            date: record.date,
            reportTime: record.reportTime,
            releaseTime: record.releaseTime,
            dutyMinutes: dutyMinutes,
            flightMinutes: flightMinutes,
            sectors: record.sectors || 1,
            notes: record.notes || '',
            createdAt: new Date().toISOString()
        };

        // Get existing records and add new one
        const records = getDutyRecords();
        records.unshift(normalizedRecord); // Add to beginning
        
        const success = saveDutyRecords(records);
        
        return {
            success: success,
            record: normalizedRecord,
            error: success ? null : 'Failed to save record'
        };
    }

    /**
     * Update an existing duty record
     * 
     * @param {string} id - Record ID to update
     * @param {Object} updates - Fields to update
     * @returns {Object} Result with success status
     */
    function updateDutyRecord(id, updates) {
        const records = getDutyRecords();
        const index = records.findIndex(r => r.id === id);
        
        if (index === -1) {
            return {
                success: false,
                error: 'Record not found'
            };
        }

        // Apply updates
        records[index] = {
            ...records[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Recalculate duty minutes if times changed
        if (updates.reportTime || updates.releaseTime) {
            const reportMinutes = timeToMinutes(records[index].reportTime);
            const releaseMinutes = timeToMinutes(records[index].releaseTime);
            
            let dutyMinutes = releaseMinutes - reportMinutes;
            if (dutyMinutes < 0) dutyMinutes += 1440;
            
            records[index].dutyMinutes = dutyMinutes;
        }

        // Recalculate flight minutes if flight time changed
        if (updates.flightTime !== undefined) {
            records[index].flightMinutes = Math.round((parseFloat(updates.flightTime) || 0) * 60);
        }

        const success = saveDutyRecords(records);
        
        return {
            success: success,
            record: records[index],
            error: success ? null : 'Failed to update record'
        };
    }

    /**
     * Delete a duty record
     * 
     * @param {string} id - Record ID to delete
     * @returns {Object} Result with success status
     */
    function deleteDutyRecord(id) {
        const records = getDutyRecords();
        const index = records.findIndex(r => r.id === id);
        
        if (index === -1) {
            return {
                success: false,
                error: 'Record not found'
            };
        }

        records.splice(index, 1);
        const success = saveDutyRecords(records);
        
        return {
            success: success,
            error: success ? null : 'Failed to delete record'
        };
    }

    /**
     * Clear all duty records
     * 
     * @returns {boolean} Success status
     */
    function clearAllRecords() {
        if (!isStorageAvailable()) return false;
        
        try {
            localStorage.removeItem(KEYS.DUTY_RECORDS);
            return true;
        } catch (e) {
            console.error('Error clearing records:', e);
            return false;
        }
    }

    /**
     * Get user preferences
     * 
     * @returns {Object} User preferences object
     */
    function getPreferences() {
        if (!isStorageAvailable()) {
            return { ...DEFAULT_PREFERENCES };
        }

        try {
            const data = localStorage.getItem(KEYS.PREFERENCES);
            if (!data) return { ...DEFAULT_PREFERENCES };
            
            const prefs = JSON.parse(data);
            return { ...DEFAULT_PREFERENCES, ...prefs };
        } catch (e) {
            console.error('Error reading preferences:', e);
            return { ...DEFAULT_PREFERENCES };
        }
    }

    /**
     * Save user preferences
     * 
     * @param {Object} preferences - Preferences to save
     * @returns {boolean} Success status
     */
    function savePreferences(preferences) {
        if (!isStorageAvailable()) return false;

        try {
            const currentPrefs = getPreferences();
            const newPrefs = { ...currentPrefs, ...preferences };
            
            localStorage.setItem(KEYS.PREFERENCES, JSON.stringify(newPrefs));
            return true;
        } catch (e) {
            console.error('Error saving preferences:', e);
            return false;
        }
    }

    /**
     * Get records for a specific date range
     * 
     * @param {number} days - Number of days to look back
     * @returns {Array} Filtered records
     */
    function getRecordsByRange(days) {
        const records = getDutyRecords();
        const now = new Date();
        const cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - days);
        cutoffDate.setHours(0, 0, 0, 0);
        
        return records.filter(record => {
            const recordDate = new Date(record.date);
            return recordDate >= cutoffDate && recordDate <= now;
        });
    }

    /**
     * Get summary statistics
     * 
     * @returns {Object} Summary stats
     */
    function getStats() {
        const allRecords = getDutyRecords();
        const records7Day = getRecordsByRange(7);
        const records28Day = getRecordsByRange(28);
        
        const sumDuty = (records) => records.reduce((sum, r) => sum + (r.dutyMinutes || 0), 0);
        const sumFlight = (records) => records.reduce((sum, r) => sum + (r.flightMinutes || 0), 0);
        
        return {
            totalRecords: allRecords.length,
            duty7Day: sumDuty(records7Day),
            duty28Day: sumDuty(records28Day),
            flight7Day: sumFlight(records7Day),
            flight28Day: sumFlight(records28Day),
            lastEntry: allRecords.length > 0 ? allRecords[0].date : null
        };
    }

    /**
     * Get active duty state
     * 
     * @returns {Object|null} Active duty object or null if not on duty
     */
    function getActiveDuty() {
        if (!isStorageAvailable()) return null;

        try {
            const data = localStorage.getItem(KEYS.ACTIVE_DUTY);
            if (!data) return null;
            
            return JSON.parse(data);
        } catch (e) {
            console.error('Error reading active duty:', e);
            return null;
        }
    }

    /**
     * Start a new duty period
     * 
     * @param {Object} dutyInfo - Duty information
     * @returns {Object} Result with success status
     */
    function startDuty(dutyInfo) {
        if (!isStorageAvailable()) {
            return { success: false, error: 'Storage not available' };
        }

        // Check if already on duty
        const currentDuty = getActiveDuty();
        if (currentDuty) {
            return { success: false, error: 'Already on duty. End current duty first.' };
        }

        const activeDuty = {
            startTime: dutyInfo.startTime || new Date().toISOString(),
            reportTime: dutyInfo.reportTime || new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
            }),
            sectors: dutyInfo.sectors || 2,
            acclimatized: dutyInfo.acclimatized !== false,
            maxFdpMinutes: dutyInfo.maxFdpMinutes || 840, // 14 hours default
            date: new Date().toISOString().split('T')[0]
        };

        try {
            localStorage.setItem(KEYS.ACTIVE_DUTY, JSON.stringify(activeDuty));
            return { success: true, duty: activeDuty };
        } catch (e) {
            console.error('Error starting duty:', e);
            return { success: false, error: 'Failed to save active duty' };
        }
    }

    /**
     * Update active duty (e.g., change sectors)
     * 
     * @param {Object} updates - Fields to update
     * @returns {Object} Result with success status
     */
    function updateActiveDuty(updates) {
        const currentDuty = getActiveDuty();
        if (!currentDuty) {
            return { success: false, error: 'Not currently on duty' };
        }

        const updatedDuty = { ...currentDuty, ...updates };

        try {
            localStorage.setItem(KEYS.ACTIVE_DUTY, JSON.stringify(updatedDuty));
            return { success: true, duty: updatedDuty };
        } catch (e) {
            console.error('Error updating duty:', e);
            return { success: false, error: 'Failed to update active duty' };
        }
    }

    /**
     * End the current duty period
     * 
     * @param {Object} endInfo - End of duty information
     * @returns {Object} Result with duty record
     */
    function endDuty(endInfo = {}) {
        const currentDuty = getActiveDuty();
        if (!currentDuty) {
            return { success: false, error: 'Not currently on duty' };
        }

        const endTime = endInfo.endTime || new Date();
        const releaseTime = endTime.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
        });

        // Create a duty record from the active duty
        const dutyRecord = {
            date: currentDuty.date,
            reportTime: currentDuty.reportTime,
            releaseTime: releaseTime,
            flightTime: endInfo.flightTime || 0,
            sectors: currentDuty.sectors
        };

        // Clear active duty
        try {
            localStorage.removeItem(KEYS.ACTIVE_DUTY);
        } catch (e) {
            console.error('Error clearing active duty:', e);
        }

        return {
            success: true,
            duty: currentDuty,
            record: dutyRecord,
            shouldLog: endInfo.logDuty !== false
        };
    }

    /**
     * Cancel active duty without logging
     * 
     * @returns {boolean} Success status
     */
    function cancelActiveDuty() {
        if (!isStorageAvailable()) return false;

        try {
            localStorage.removeItem(KEYS.ACTIVE_DUTY);
            return true;
        } catch (e) {
            console.error('Error canceling duty:', e);
            return false;
        }
    }

    /**
     * Export all data as JSON
     * 
     * @returns {string} JSON string of all data
     */
    function exportData() {
        return JSON.stringify({
            records: getDutyRecords(),
            preferences: getPreferences(),
            exportedAt: new Date().toISOString(),
            version: '1.0'
        }, null, 2);
    }

    /**
     * Import data from JSON
     * 
     * @param {string} jsonString - JSON data to import
     * @returns {Object} Import result
     */
    function importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (data.records && Array.isArray(data.records)) {
                saveDutyRecords(data.records);
            }
            
            if (data.preferences) {
                savePreferences(data.preferences);
            }
            
            return {
                success: true,
                recordsImported: data.records ? data.records.length : 0
            };
        } catch (e) {
            return {
                success: false,
                error: 'Invalid JSON format: ' + e.message
            };
        }
    }

    /**
     * Generate unique ID
     */
    function generateId() {
        return 'duty_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Convert time string to minutes
     */
    function timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }

    // Public API
    return {
        getDutyRecords,
        saveDutyRecords,
        addDutyRecord,
        updateDutyRecord,
        deleteDutyRecord,
        clearAllRecords,
        getPreferences,
        savePreferences,
        getRecordsByRange,
        getStats,
        exportData,
        importData,
        isStorageAvailable,
        // Active duty tracking
        getActiveDuty,
        startDuty,
        updateActiveDuty,
        endDuty,
        cancelActiveDuty,
        KEYS,
        DEFAULT_PREFERENCES
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
