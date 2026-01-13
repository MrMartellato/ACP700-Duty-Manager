/**
 * Rest Calculator - Minimum Rest Requirements Calculation Engine
 * Based on Transport Canada CAR 700 Subpart 7 (2021 Amendments)
 * 
 * This module calculates minimum rest periods based on:
 * - Preceding duty period length
 * - Time zones crossed
 * - Acclimatization requirements
 */

const RestCalculator = (function() {
    'use strict';

    /**
     * Standard rest requirements based on CAR 700.28
     * All values in minutes
     */
    const REST_REQUIREMENTS = {
        // Standard minimum rest period
        STANDARD_MIN: 600,           // 10 hours
        
        // After extended duty (12+ hours FDP)
        EXTENDED_DUTY_MIN: 720,      // 12 hours
        EXTENDED_DUTY_THRESHOLD: 720, // 12 hours FDP triggers extended rest
        
        // After very long duty (14+ hours)
        VERY_LONG_DUTY_MIN: 840,     // 14 hours
        VERY_LONG_DUTY_THRESHOLD: 840, // 14 hours FDP
        
        // Minimum sleep opportunity within rest period
        MIN_SLEEP_OPPORTUNITY: 480,   // 8 hours
        
        // Recommended rest (for fatigue management)
        RECOMMENDED_MULTIPLIER: 1.25  // 25% more than minimum
    };

    /**
     * Time zone crossing adjustments
     * Additional rest required based on zones crossed
     */
    const TIMEZONE_ADJUSTMENTS = {
        '0-2': 0,      // No additional rest
        '3-4': 60,     // +1 hour
        '5+': 120      // +2 hours
    };

    /**
     * Acclimatization periods required based on time zones crossed
     * Time needed to become acclimatized (in hours)
     */
    const ACCLIMATIZATION_PERIODS = {
        '0-2': 0,
        '3-4': 48,     // 2 days
        '5+': 72       // 3 days
    };

    /**
     * Convert time string (HH:MM) to minutes since midnight
     */
    function timeToMinutes(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return null;
        
        const parts = timeStr.split(':');
        if (parts.length !== 2) return null;
        
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        
        if (isNaN(hours) || isNaN(minutes)) return null;
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
        
        return hours * 60 + minutes;
    }

    /**
     * Convert minutes to time string (HH:MM)
     */
    function minutesToTime(totalMinutes) {
        if (totalMinutes === null || totalMinutes === undefined) return '--:--';
        
        // Handle values that go into the next day(s)
        const days = Math.floor(totalMinutes / 1440);
        totalMinutes = totalMinutes % 1440;
        
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        let timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        if (days > 0) {
            timeStr += ` (+${days})`;
        }
        
        return timeStr;
    }

    /**
     * Format duration in minutes to readable string
     */
    function formatDuration(totalMinutes) {
        if (totalMinutes === null || totalMinutes === undefined) return '--';
        
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        if (hours === 0) return `${minutes}m`;
        if (minutes === 0) return `${hours}h`;
        return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }

    /**
     * Get timezone adjustment category
     */
    function getTimezoneCategory(zonesCrossed) {
        const zones = parseInt(zonesCrossed, 10) || 0;
        if (zones <= 2) return '0-2';
        if (zones <= 4) return '3-4';
        return '5+';
    }

    /**
     * Calculate minimum rest period based on preceding duty
     * 
     * @param {string} dutyEndTime - Duty end time in HH:MM format
     * @param {number} dutyLengthHours - Preceding duty period in hours
     * @param {number|string} timezonesCrossed - Number of time zones crossed
     * @returns {Object} Calculation results
     */
    function calculate(dutyEndTime, dutyLengthHours, timezonesCrossed = 0) {
        const result = {
            success: false,
            minRest: null,
            minRestFormatted: '--:--',
            minRestReadable: '--',
            nextReport: null,
            nextReportFormatted: '--:--',
            recommendedRest: null,
            recommendedRestFormatted: '--:--',
            recommendedRestReadable: '--',
            components: [],
            error: null
        };

        // Validate duty end time
        const dutyEndMinutes = timeToMinutes(dutyEndTime);
        if (dutyEndMinutes === null) {
            result.error = 'Invalid duty end time format. Please use HH:MM.';
            return result;
        }

        // Validate duty length
        const dutyMinutes = parseFloat(dutyLengthHours) * 60;
        if (isNaN(dutyMinutes) || dutyMinutes < 0 || dutyMinutes > 1440) {
            result.error = 'Invalid duty period length. Please enter 0-24 hours.';
            return result;
        }

        // Determine base rest requirement based on duty length
        let minRest = REST_REQUIREMENTS.STANDARD_MIN;
        
        if (dutyMinutes >= REST_REQUIREMENTS.VERY_LONG_DUTY_THRESHOLD) {
            minRest = REST_REQUIREMENTS.VERY_LONG_DUTY_MIN;
            result.components.push({
                reason: 'Very long duty (14h+)',
                amount: REST_REQUIREMENTS.VERY_LONG_DUTY_MIN,
                type: 'base'
            });
        } else if (dutyMinutes >= REST_REQUIREMENTS.EXTENDED_DUTY_THRESHOLD) {
            minRest = REST_REQUIREMENTS.EXTENDED_DUTY_MIN;
            result.components.push({
                reason: 'Extended duty (12h+)',
                amount: REST_REQUIREMENTS.EXTENDED_DUTY_MIN,
                type: 'base'
            });
        } else {
            result.components.push({
                reason: 'Standard rest requirement',
                amount: REST_REQUIREMENTS.STANDARD_MIN,
                type: 'base'
            });
        }

        // Add timezone adjustment
        const tzCategory = getTimezoneCategory(timezonesCrossed);
        const tzAdjustment = TIMEZONE_ADJUSTMENTS[tzCategory];
        
        if (tzAdjustment > 0) {
            minRest += tzAdjustment;
            result.components.push({
                reason: `Time zone crossing (${tzCategory})`,
                amount: tzAdjustment,
                type: 'adjustment'
            });
        }

        // Ensure minimum sleep opportunity
        // Rest period should allow for at least 8 hours of sleep opportunity
        // Account for travel to/from accommodations (~1 hour each way)
        const sleepOpportunityPadding = 120; // 2 hours for travel/transition
        const minRestWithSleep = REST_REQUIREMENTS.MIN_SLEEP_OPPORTUNITY + sleepOpportunityPadding;
        
        if (minRest < minRestWithSleep) {
            minRest = minRestWithSleep;
            result.components.push({
                reason: 'Minimum sleep opportunity adjustment',
                amount: minRestWithSleep - minRest,
                type: 'adjustment'
            });
        }

        // Calculate recommended rest (25% more than minimum)
        const recommendedRest = Math.ceil(minRest * REST_REQUIREMENTS.RECOMMENDED_MULTIPLIER);

        // Calculate next earliest report time
        const nextReportMinutes = dutyEndMinutes + minRest;
        const recommendedNextReport = dutyEndMinutes + recommendedRest;

        // Populate successful result
        result.success = true;
        result.minRest = minRest;
        result.minRestFormatted = formatDuration(minRest);
        result.minRestReadable = formatDuration(minRest);
        result.nextReport = nextReportMinutes % 1440;
        result.nextReportFormatted = minutesToTime(nextReportMinutes);
        result.recommendedRest = recommendedRest;
        result.recommendedRestFormatted = formatDuration(recommendedRest);
        result.recommendedRestReadable = formatDuration(recommendedRest);
        result.recommendedNextReport = minutesToTime(recommendedNextReport);
        result.dutyEndMinutes = dutyEndMinutes;
        result.acclimatizationRequired = ACCLIMATIZATION_PERIODS[tzCategory];

        // Add day indicator
        if (nextReportMinutes >= 1440) {
            result.crossesMidnight = true;
            result.daysLater = Math.floor(nextReportMinutes / 1440);
        }

        return result;
    }

    /**
     * Calculate if a proposed rest period is compliant
     * 
     * @param {number} proposedRestMinutes - Proposed rest period in minutes
     * @param {number} dutyLengthMinutes - Preceding duty period in minutes
     * @param {number} timezonesCrossed - Number of time zones crossed
     * @returns {Object} Compliance check result
     */
    function checkCompliance(proposedRestMinutes, dutyLengthMinutes, timezonesCrossed = 0) {
        // Calculate required minimum
        const requiredResult = calculate('00:00', dutyLengthMinutes / 60, timezonesCrossed);
        
        if (!requiredResult.success) {
            return {
                compliant: false,
                deficit: null,
                message: 'Unable to calculate requirements'
            };
        }

        const deficit = requiredResult.minRest - proposedRestMinutes;
        
        if (deficit > 0) {
            return {
                compliant: false,
                deficit: deficit,
                deficitFormatted: formatDuration(deficit),
                required: requiredResult.minRest,
                message: `Rest period is ${formatDuration(deficit)} short of minimum requirement`
            };
        }

        return {
            compliant: true,
            surplus: Math.abs(deficit),
            surplusFormatted: formatDuration(Math.abs(deficit)),
            message: 'Rest period meets minimum requirements'
        };
    }

    /**
     * Calculate consecutive duty day limits
     * Maximum consecutive days of duty before required time off
     */
    function calculateConsecutiveDutyLimit(currentConsecutiveDays) {
        const MAX_CONSECUTIVE_DAYS = 7;
        const REQUIRED_TIME_OFF = 36 * 60; // 36 hours (in minutes)
        
        const daysRemaining = MAX_CONSECUTIVE_DAYS - currentConsecutiveDays;
        
        return {
            maxDays: MAX_CONSECUTIVE_DAYS,
            currentDays: currentConsecutiveDays,
            daysRemaining: Math.max(0, daysRemaining),
            requiredTimeOff: REQUIRED_TIME_OFF,
            requiredTimeOffFormatted: formatDuration(REQUIRED_TIME_OFF),
            needsTimeOff: daysRemaining <= 0
        };
    }

    /**
     * Get rest requirement constants for reference
     */
    function getConstants() {
        return {
            ...REST_REQUIREMENTS,
            TIMEZONE_ADJUSTMENTS,
            ACCLIMATIZATION_PERIODS
        };
    }

    // Public API
    return {
        calculate,
        checkCompliance,
        calculateConsecutiveDutyLimit,
        getConstants,
        timeToMinutes,
        minutesToTime,
        formatDuration
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RestCalculator;
}
