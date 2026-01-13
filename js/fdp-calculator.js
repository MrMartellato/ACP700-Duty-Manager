/**
 * FDP Calculator - Flight Duty Period Calculation Engine
 * Based on Transport Canada CAR 700 Subpart 7 (2021 Amendments)
 * 
 * This module calculates maximum Flight Duty Periods based on:
 * - Report time (local time)
 * - Number of flight sectors
 * - Acclimatization status
 */

const FDPCalculator = (function() {
    'use strict';

    /**
     * FDP Limits Table based on CAR 700.27
     * Structure: reportTimeRange -> sectorRange -> maxFDP (in minutes)
     * 
     * Report times are in 24-hour format (local time)
     * Sector ranges: 1-2, 3-4, 5+
     */
    const FDP_TABLE = {
        // 0600-0659 Local
        '0600-0659': {
            '1-2': 780,   // 13:00
            '3-4': 750,   // 12:30
            '5+': 720     // 12:00
        },
        // 0700-1159 Local (optimal window)
        '0700-1159': {
            '1-2': 840,   // 14:00
            '3-4': 810,   // 13:30
            '5+': 780     // 13:00
        },
        // 1200-1359 Local
        '1200-1359': {
            '1-2': 780,   // 13:00
            '3-4': 750,   // 12:30
            '5+': 720     // 12:00
        },
        // 1400-1759 Local
        '1400-1759': {
            '1-2': 720,   // 12:00
            '3-4': 690,   // 11:30
            '5+': 660     // 11:00
        },
        // 1800-2159 Local
        '1800-2159': {
            '1-2': 660,   // 11:00
            '3-4': 630,   // 10:30
            '5+': 600     // 10:00
        },
        // 2200-0559 Local (WOCL - Window of Circadian Low)
        '2200-0559': {
            '1-2': 600,   // 10:00
            '3-4': 570,   // 9:30
            '5+': 540     // 9:00
        }
    };

    /**
     * Reduction for unacclimatized crew members (in minutes)
     * Applied when crew is not acclimatized to local time
     */
    const UNACCLIMATIZED_REDUCTION = 60; // 1 hour reduction

    /**
     * Maximum absolute FDP limits
     */
    const MAX_FDP_ABSOLUTE = 840;  // 14 hours
    const MIN_FDP_ABSOLUTE = 540;  // 9 hours

    /**
     * Window of Circadian Low (WOCL) definition
     * 0200-0559 local time at place of departure
     */
    const WOCL_START = 2 * 60;    // 0200
    const WOCL_END = 6 * 60;      // 0600

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
        
        // Handle negative or overflow values
        while (totalMinutes < 0) totalMinutes += 1440;
        totalMinutes = totalMinutes % 1440;
        
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    /**
     * Format duration in minutes to readable string (Xh XXm)
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
     * Determine the report time range based on the hour
     */
    function getReportTimeRange(reportMinutes) {
        const hour = Math.floor(reportMinutes / 60);
        
        if (hour >= 6 && hour < 7) return '0600-0659';
        if (hour >= 7 && hour < 12) return '0700-1159';
        if (hour >= 12 && hour < 14) return '1200-1359';
        if (hour >= 14 && hour < 18) return '1400-1759';
        if (hour >= 18 && hour < 22) return '1800-2159';
        // 2200-0559 (covers 22, 23, 0, 1, 2, 3, 4, 5)
        return '2200-0559';
    }

    /**
     * Determine sector range category
     */
    function getSectorRange(sectors) {
        const numSectors = parseInt(sectors, 10);
        if (numSectors <= 2) return '1-2';
        if (numSectors <= 4) return '3-4';
        return '5+';
    }

    /**
     * Check if a time falls within WOCL (Window of Circadian Low)
     * WOCL is defined as 0200-0559 local time
     */
    function isInWOCL(timeMinutes) {
        return timeMinutes >= WOCL_START && timeMinutes < WOCL_END;
    }

    /**
     * Check if duty period encroaches on WOCL
     */
    function encroachesWOCL(startMinutes, endMinutes) {
        // Handle overnight duty
        if (endMinutes < startMinutes) {
            // Duty goes past midnight
            // Check if WOCL period overlaps
            return (startMinutes < WOCL_END) || (endMinutes > WOCL_START) || 
                   (startMinutes <= WOCL_END && endMinutes >= WOCL_START);
        }
        
        // Check if duty period overlaps with WOCL
        return (startMinutes < WOCL_END && endMinutes > WOCL_START);
    }

    /**
     * Calculate maximum FDP based on input parameters
     * 
     * @param {string} reportTime - Report time in HH:MM format
     * @param {number|string} sectors - Number of flight sectors
     * @param {string} acclimatizationStatus - 'acclimatized' or 'unacclimatized'
     * @returns {Object} Calculation results
     */
    function calculate(reportTime, sectors, acclimatizationStatus) {
        const result = {
            success: false,
            maxFDP: null,
            maxFDPFormatted: '--:--',
            endOfDuty: null,
            endOfDutyFormatted: '--:--',
            woclEncroachment: false,
            woclInfo: 'No encroachment',
            reportTimeRange: null,
            sectorRange: null,
            reductions: [],
            error: null
        };

        // Validate report time
        const reportMinutes = timeToMinutes(reportTime);
        if (reportMinutes === null) {
            result.error = 'Invalid report time format. Please use HH:MM.';
            return result;
        }

        // Validate sectors
        const numSectors = parseInt(sectors, 10);
        if (isNaN(numSectors) || numSectors < 1 || numSectors > 10) {
            result.error = 'Invalid number of sectors. Please enter 1-10.';
            return result;
        }

        // Get table lookup values
        const reportTimeRange = getReportTimeRange(reportMinutes);
        const sectorRange = getSectorRange(numSectors);
        
        result.reportTimeRange = reportTimeRange;
        result.sectorRange = sectorRange;

        // Look up base FDP
        let maxFDP = FDP_TABLE[reportTimeRange][sectorRange];

        // Apply unacclimatized reduction if applicable
        if (acclimatizationStatus === 'unacclimatized') {
            maxFDP -= UNACCLIMATIZED_REDUCTION;
            result.reductions.push({
                reason: 'Unacclimatized crew',
                amount: UNACCLIMATIZED_REDUCTION
            });
        }

        // Ensure FDP is within absolute limits
        maxFDP = Math.max(MIN_FDP_ABSOLUTE, Math.min(MAX_FDP_ABSOLUTE, maxFDP));

        // Calculate end of duty time
        let endOfDuty = reportMinutes + maxFDP;
        
        // Check for WOCL encroachment
        const woclEncroachment = encroachesWOCL(reportMinutes, endOfDuty % 1440);
        result.woclEncroachment = woclEncroachment;
        
        if (woclEncroachment) {
            result.woclInfo = 'Duty encroaches WOCL (0200-0559)';
        } else if (isInWOCL(reportMinutes)) {
            result.woclInfo = 'Report time is within WOCL';
        }

        // Populate successful result
        result.success = true;
        result.maxFDP = maxFDP;
        result.maxFDPFormatted = minutesToTime(maxFDP);
        result.maxFDPReadable = formatDuration(maxFDP);
        result.endOfDuty = endOfDuty % 1440;
        result.endOfDutyFormatted = minutesToTime(endOfDuty % 1440);
        result.reportMinutes = reportMinutes;
        
        // Add next day indicator if duty extends past midnight
        if (endOfDuty >= 1440) {
            result.endOfDutyFormatted += ' (+1)';
        }

        return result;
    }

    /**
     * Calculate remaining FDP given current elapsed time
     */
    function calculateRemaining(reportTime, elapsedMinutes, sectors, acclimatizationStatus) {
        const fdpResult = calculate(reportTime, sectors, acclimatizationStatus);
        
        if (!fdpResult.success) {
            return {
                remaining: null,
                remainingFormatted: '--:--',
                percentage: 0,
                status: 'unknown'
            };
        }

        const remaining = fdpResult.maxFDP - elapsedMinutes;
        const percentage = Math.min(100, Math.max(0, (elapsedMinutes / fdpResult.maxFDP) * 100));
        
        let status = 'good';
        if (remaining <= 60) status = 'danger';
        else if (remaining <= 120) status = 'warning';

        return {
            remaining: Math.max(0, remaining),
            remainingFormatted: formatDuration(Math.max(0, remaining)),
            percentage: percentage,
            status: status,
            maxFDP: fdpResult.maxFDP
        };
    }

    /**
     * Get FDP table for reference display
     */
    function getTable() {
        return FDP_TABLE;
    }

    /**
     * Get all time range options for dropdown
     */
    function getTimeRanges() {
        return Object.keys(FDP_TABLE);
    }

    // Public API
    return {
        calculate,
        calculateRemaining,
        getTable,
        getTimeRanges,
        timeToMinutes,
        minutesToTime,
        formatDuration,
        WOCL_START,
        WOCL_END,
        MAX_FDP_ABSOLUTE,
        MIN_FDP_ABSOLUTE
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FDPCalculator;
}
