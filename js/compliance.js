/**
 * Compliance Checker - Duty and Flight Time Compliance Monitoring
 * Based on Transport Canada CAR 700 Subpart 7 (2021 Amendments)
 * 
 * This module tracks and validates:
 * - Rolling 7-day duty totals
 * - Rolling 28-day duty totals
 * - Rolling 28-day flight time totals
 * - Rolling 365-day (annual) flight time
 */

const ComplianceChecker = (function() {
    'use strict';

    /**
     * Regulatory limits based on CAR 700.16/700.19
     * All values in minutes unless otherwise noted
     */
    const LIMITS = {
        // Flight Duty Period limits
        FDP_SINGLE_DAY_MAX: 840,        // 14 hours max FDP
        FDP_SINGLE_DAY_MIN: 540,        // 9 hours min (for night ops)
        
        // Flight Time limits
        FLIGHT_TIME_SINGLE_DUTY: 480,   // 8 hours (single pilot)
        FLIGHT_TIME_AUGMENTED: 780,     // 13 hours (augmented crew)
        FLIGHT_TIME_28_DAY: 6720,       // 112 hours
        FLIGHT_TIME_365_DAY: 60000,     // 1000 hours
        
        // Duty Time limits
        DUTY_7_DAY: 3600,               // 60 hours
        DUTY_28_DAY: 11400,             // 190 hours
        DUTY_365_DAY: 96000,            // 1600 hours (annual limit)
        
        // Rest requirements
        REST_WEEKLY: 2160,              // 36 consecutive hours in 7 days
        REST_MONTHLY: 5760,             // 96 hours in any 28 consecutive days
        
        // Warning thresholds (percentage of limit)
        WARNING_THRESHOLD: 0.85,        // 85% = warning
        DANGER_THRESHOLD: 0.95          // 95% = danger
    };

    /**
     * Status types for compliance indicators
     */
    const STATUS = {
        GOOD: 'good',
        WARNING: 'warning',
        DANGER: 'danger',
        EXCEEDED: 'exceeded'
    };

    /**
     * Calculate status based on current value and limit
     */
    function getStatus(current, limit) {
        const ratio = current / limit;
        
        if (ratio >= 1) return STATUS.EXCEEDED;
        if (ratio >= LIMITS.DANGER_THRESHOLD) return STATUS.DANGER;
        if (ratio >= LIMITS.WARNING_THRESHOLD) return STATUS.WARNING;
        return STATUS.GOOD;
    }

    /**
     * Format minutes to HH:MM string
     */
    function minutesToTime(totalMinutes) {
        if (totalMinutes === null || totalMinutes === undefined) return '--:--';
        
        const hours = Math.floor(Math.abs(totalMinutes) / 60);
        const minutes = Math.abs(totalMinutes) % 60;
        const sign = totalMinutes < 0 ? '-' : '';
        
        return `${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
    }

    /**
     * Format minutes to readable duration
     */
    function formatDuration(totalMinutes) {
        if (totalMinutes === null || totalMinutes === undefined) return '--';
        
        const hours = Math.floor(Math.abs(totalMinutes) / 60);
        const minutes = Math.abs(totalMinutes) % 60;
        
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }

    /**
     * Filter duty records to a specific date range
     */
    function filterByDateRange(records, days) {
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
     * Calculate total duty time from records
     */
    function sumDutyTime(records) {
        return records.reduce((total, record) => {
            return total + (record.dutyMinutes || 0);
        }, 0);
    }

    /**
     * Calculate total flight time from records
     */
    function sumFlightTime(records) {
        return records.reduce((total, record) => {
            return total + (record.flightMinutes || 0);
        }, 0);
    }

    /**
     * Check 7-day duty compliance
     * 
     * @param {Array} dutyRecords - Array of duty record objects
     * @returns {Object} Compliance status for 7-day duty
     */
    function check7DayDuty(dutyRecords) {
        const records = filterByDateRange(dutyRecords, 7);
        const totalMinutes = sumDutyTime(records);
        const limit = LIMITS.DUTY_7_DAY;
        const remaining = limit - totalMinutes;
        const status = getStatus(totalMinutes, limit);
        
        return {
            current: totalMinutes,
            currentFormatted: minutesToTime(totalMinutes),
            limit: limit,
            limitFormatted: minutesToTime(limit),
            remaining: remaining,
            remainingFormatted: formatDuration(remaining),
            percentage: Math.min(100, (totalMinutes / limit) * 100),
            status: status,
            compliant: totalMinutes <= limit,
            periodDays: 7,
            recordCount: records.length
        };
    }

    /**
     * Check 28-day duty compliance
     * 
     * @param {Array} dutyRecords - Array of duty record objects
     * @returns {Object} Compliance status for 28-day duty
     */
    function check28DayDuty(dutyRecords) {
        const records = filterByDateRange(dutyRecords, 28);
        const totalMinutes = sumDutyTime(records);
        const limit = LIMITS.DUTY_28_DAY;
        const remaining = limit - totalMinutes;
        const status = getStatus(totalMinutes, limit);
        
        return {
            current: totalMinutes,
            currentFormatted: minutesToTime(totalMinutes),
            limit: limit,
            limitFormatted: minutesToTime(limit),
            remaining: remaining,
            remainingFormatted: formatDuration(remaining),
            percentage: Math.min(100, (totalMinutes / limit) * 100),
            status: status,
            compliant: totalMinutes <= limit,
            periodDays: 28,
            recordCount: records.length
        };
    }

    /**
     * Check 28-day flight time compliance
     * 
     * @param {Array} dutyRecords - Array of duty record objects
     * @returns {Object} Compliance status for 28-day flight time
     */
    function check28DayFlightTime(dutyRecords) {
        const records = filterByDateRange(dutyRecords, 28);
        const totalMinutes = sumFlightTime(records);
        const limit = LIMITS.FLIGHT_TIME_28_DAY;
        const remaining = limit - totalMinutes;
        const status = getStatus(totalMinutes, limit);
        
        return {
            current: totalMinutes,
            currentFormatted: minutesToTime(totalMinutes),
            limit: limit,
            limitFormatted: minutesToTime(limit),
            remaining: remaining,
            remainingFormatted: formatDuration(remaining),
            percentage: Math.min(100, (totalMinutes / limit) * 100),
            status: status,
            compliant: totalMinutes <= limit,
            periodDays: 28,
            recordCount: records.length
        };
    }

    /**
     * Check 365-day (annual) flight time compliance
     * 
     * @param {Array} dutyRecords - Array of duty record objects
     * @returns {Object} Compliance status for annual flight time
     */
    function check365DayFlightTime(dutyRecords) {
        const records = filterByDateRange(dutyRecords, 365);
        const totalMinutes = sumFlightTime(records);
        const limit = LIMITS.FLIGHT_TIME_365_DAY;
        const remaining = limit - totalMinutes;
        const status = getStatus(totalMinutes, limit);
        
        return {
            current: totalMinutes,
            currentFormatted: minutesToTime(totalMinutes),
            limit: limit,
            limitFormatted: minutesToTime(limit),
            remaining: remaining,
            remainingFormatted: formatDuration(remaining),
            percentage: Math.min(100, (totalMinutes / limit) * 100),
            status: status,
            compliant: totalMinutes <= limit,
            periodDays: 365,
            recordCount: records.length
        };
    }

    /**
     * Check current FDP compliance
     * 
     * @param {number} currentFDPMinutes - Current elapsed FDP in minutes
     * @param {number} maxFDPMinutes - Maximum allowed FDP for this duty period
     * @returns {Object} Current FDP compliance status
     */
    function checkCurrentFDP(currentFDPMinutes, maxFDPMinutes) {
        const remaining = maxFDPMinutes - currentFDPMinutes;
        const status = getStatus(currentFDPMinutes, maxFDPMinutes);
        
        return {
            current: currentFDPMinutes,
            currentFormatted: minutesToTime(currentFDPMinutes),
            limit: maxFDPMinutes,
            limitFormatted: minutesToTime(maxFDPMinutes),
            remaining: remaining,
            remainingFormatted: formatDuration(remaining),
            percentage: Math.min(100, (currentFDPMinutes / maxFDPMinutes) * 100),
            status: status,
            compliant: currentFDPMinutes <= maxFDPMinutes
        };
    }

    /**
     * Check current flight time compliance for single duty
     * 
     * @param {number} currentFlightMinutes - Current elapsed flight time in minutes
     * @param {boolean} isAugmented - Whether crew is augmented
     * @returns {Object} Current flight time compliance status
     */
    function checkCurrentFlightTime(currentFlightMinutes, isAugmented = false) {
        const limit = isAugmented ? LIMITS.FLIGHT_TIME_AUGMENTED : LIMITS.FLIGHT_TIME_SINGLE_DUTY;
        const remaining = limit - currentFlightMinutes;
        const status = getStatus(currentFlightMinutes, limit);
        
        return {
            current: currentFlightMinutes,
            currentFormatted: minutesToTime(currentFlightMinutes),
            limit: limit,
            limitFormatted: minutesToTime(limit),
            remaining: remaining,
            remainingFormatted: formatDuration(remaining),
            percentage: Math.min(100, (currentFlightMinutes / limit) * 100),
            status: status,
            compliant: currentFlightMinutes <= limit,
            crewType: isAugmented ? 'augmented' : 'single'
        };
    }

    /**
     * Run all compliance checks
     * 
     * @param {Array} dutyRecords - Array of duty record objects
     * @param {Object} currentDuty - Current duty period info (optional)
     * @returns {Object} Complete compliance report
     */
    function runAllChecks(dutyRecords = [], currentDuty = null) {
        const checks = {
            duty7Day: check7DayDuty(dutyRecords),
            duty28Day: check28DayDuty(dutyRecords),
            flightTime28Day: check28DayFlightTime(dutyRecords),
            flightTime365Day: check365DayFlightTime(dutyRecords),
            currentFDP: null,
            currentFlightTime: null,
            overallStatus: STATUS.GOOD,
            allCompliant: true,
            warnings: [],
            violations: []
        };

        // Check current duty if provided
        if (currentDuty) {
            if (currentDuty.elapsedFDP !== undefined && currentDuty.maxFDP !== undefined) {
                checks.currentFDP = checkCurrentFDP(currentDuty.elapsedFDP, currentDuty.maxFDP);
            }
            if (currentDuty.elapsedFlightTime !== undefined) {
                checks.currentFlightTime = checkCurrentFlightTime(
                    currentDuty.elapsedFlightTime,
                    currentDuty.isAugmented || false
                );
            }
        }

        // Aggregate status
        const allChecks = [
            checks.duty7Day,
            checks.duty28Day,
            checks.flightTime28Day,
            checks.currentFDP,
            checks.currentFlightTime
        ].filter(c => c !== null);

        for (const check of allChecks) {
            if (!check.compliant) {
                checks.allCompliant = false;
                checks.violations.push({
                    type: getCheckName(check),
                    current: check.currentFormatted,
                    limit: check.limitFormatted
                });
            }
            
            if (check.status === STATUS.WARNING) {
                checks.warnings.push({
                    type: getCheckName(check),
                    remaining: check.remainingFormatted,
                    percentage: check.percentage.toFixed(1)
                });
            }
        }

        // Determine overall status
        if (!checks.allCompliant) {
            checks.overallStatus = STATUS.EXCEEDED;
        } else if (checks.warnings.length > 0 || allChecks.some(c => c.status === STATUS.DANGER)) {
            checks.overallStatus = allChecks.some(c => c.status === STATUS.DANGER) 
                ? STATUS.DANGER 
                : STATUS.WARNING;
        }

        return checks;
    }

    /**
     * Get human-readable name for a check result
     */
    function getCheckName(check) {
        if (check.periodDays === 7) return '7-Day Duty';
        if (check.periodDays === 28 && check.limit === LIMITS.DUTY_28_DAY) return '28-Day Duty';
        if (check.periodDays === 28 && check.limit === LIMITS.FLIGHT_TIME_28_DAY) return '28-Day Flight Time';
        if (check.periodDays === 365) return 'Annual Flight Time';
        if (check.crewType) return 'Current Flight Time';
        return 'FDP';
    }

    /**
     * Calculate how much duty/flight time can be added while staying compliant
     */
    function calculateAvailability(dutyRecords) {
        const checks = runAllChecks(dutyRecords);
        
        // Find the most restrictive limit
        const availabilities = [
            { type: '7-Day Duty', available: checks.duty7Day.remaining },
            { type: '28-Day Duty', available: checks.duty28Day.remaining },
            { type: '28-Day Flight Time', available: checks.flightTime28Day.remaining }
        ];
        
        const mostRestrictive = availabilities.reduce((min, curr) => 
            curr.available < min.available ? curr : min
        );
        
        return {
            maxAdditionalDuty: Math.max(0, mostRestrictive.available),
            maxAdditionalDutyFormatted: formatDuration(Math.max(0, mostRestrictive.available)),
            limitingFactor: mostRestrictive.type,
            breakdown: availabilities
        };
    }

    /**
     * Get regulatory limits for reference
     */
    function getLimits() {
        return { ...LIMITS };
    }

    /**
     * Get status type constants
     */
    function getStatusTypes() {
        return { ...STATUS };
    }

    // Public API
    return {
        check7DayDuty,
        check28DayDuty,
        check28DayFlightTime,
        check365DayFlightTime,
        checkCurrentFDP,
        checkCurrentFlightTime,
        runAllChecks,
        calculateAvailability,
        getLimits,
        getStatusTypes,
        minutesToTime,
        formatDuration,
        STATUS
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComplianceChecker;
}
