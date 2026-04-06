/**
 * FDP Calculator - Flight Duty Period Calculation Engine
 * Based on Transport Canada CAR 700 Subpart 7 (2021 Amendments)
 *
 * Implements CAR 700.28(2), (3), (4), and (9) directly.
 *
 * Table lookup uses:
 *  - Start time of FDP:
 *      acclimatized   → local time at current location      (CAR 700.19(2)(a))
 *      unacclimatized → local time at last acclimatized loc (CAR 700.19(2)(b))
 *  - Average scheduled flight duration  (selects which sub-table to use)
 *  - Number of scheduled flights        (selects the column within that sub-table)
 *
 * NOTE: Positioning is NOT counted as a flight per CAR 700.28(6).
 */

const FDPCalculator = (function() {
    'use strict';

    // ─── Time bands (same nine rows for all four tables) ─────────────────────
    //  Each entry: { key, startH (inclusive), endH (exclusive) }
    const TIME_BANDS = [
        { key: '0000-0359', startH: 0,  endH: 4  },
        { key: '0400-0459', startH: 4,  endH: 5  },
        { key: '0500-0559', startH: 5,  endH: 6  },
        { key: '0600-0659', startH: 6,  endH: 7  },
        { key: '0700-1259', startH: 7,  endH: 13 },
        { key: '1300-1659', startH: 13, endH: 17 },
        { key: '1700-2159', startH: 17, endH: 22 },
        { key: '2200-2259', startH: 22, endH: 23 },
        { key: '2300-2359', startH: 23, endH: 24 },
    ];

    // ─── FDP values (minutes) shared by 700.28(2), (3), (4) ──────────────────
    //  All three subsection tables produce the same FDP values for a given
    //  time band; only the flight-count thresholds that select col1/col2/col3
    //  differ between subsections.
    //  Columns: [col1 (low flight count), col2 (mid), col3 (high)]
    const FDP_VALUES = {
        '0000-0359': [540,  540,  540],   // 9h   / 9h   / 9h
        '0400-0459': [600,  540,  540],   // 10h  / 9h   / 9h
        '0500-0559': [660,  600,  540],   // 11h  / 10h  / 9h
        '0600-0659': [720,  660,  600],   // 12h  / 11h  / 10h
        '0700-1259': [780,  720,  660],   // 13h  / 12h  / 11h
        '1300-1659': [750,  690,  630],   // 12.5h / 11.5h / 10.5h
        '1700-2159': [720,  660,  600],   // 12h  / 11h  / 10h
        '2200-2259': [660,  600,  540],   // 11h  / 10h  / 9h
        '2300-2359': [600,  540,  540],   // 10h  / 9h   / 9h
    };

    // ─── Column selection per avg flight duration ─────────────────────────────
    //  Returns column index 0 / 1 / 2 given the number of scheduled flights.
    //  'dayvfr' always returns 0 (single-column table per 700.28(9)).
    function getColumnIndex(avgDuration, numFlights) {
        switch (avgDuration) {
            case 'lt30':    // CAR 700.28(2): 1-11 / 12-17 / 18+
                return numFlights <= 11 ? 0 : numFlights <= 17 ? 1 : 2;
            case '30to49':  // CAR 700.28(3): 1-7 / 8-11 / 12+
                return numFlights <= 7  ? 0 : numFlights <= 11 ? 1 : 2;
            case 'gte50':   // CAR 700.28(4): 1-4 / 5-6 / 7+
                return numFlights <= 4  ? 0 : numFlights <= 6  ? 1 : 2;
            case 'dayvfr':  // CAR 700.28(9): single column
                return 0;
            default:        // Fallback: treat as gte50
                return numFlights <= 4  ? 0 : numFlights <= 6  ? 1 : 2;
        }
    }

    // ─── WOCL ─────────────────────────────────────────────────────────────────
    const WOCL_START = 2 * 60;   // 02:00 local
    const WOCL_END   = 6 * 60;   // 06:00 local (exclusive)

    // ─── Utility functions ────────────────────────────────────────────────────

    function timeToMinutes(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return null;
        const parts = timeStr.split(':');
        if (parts.length !== 2) return null;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m)) return null;
        if (h < 0 || h > 23 || m < 0 || m > 59) return null;
        return h * 60 + m;
    }

    function minutesToTime(totalMinutes) {
        if (totalMinutes === null || totalMinutes === undefined) return '--:--';
        while (totalMinutes < 0) totalMinutes += 1440;
        totalMinutes = totalMinutes % 1440;
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    function formatDuration(totalMinutes) {
        if (totalMinutes === null || totalMinutes === undefined) return '--';
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${String(m).padStart(2, '0')}m`;
    }

    // ─── Core lookup helpers ──────────────────────────────────────────────────

    function getTimeBandKey(minutes) {
        const hour = Math.floor(minutes / 60);
        for (const band of TIME_BANDS) {
            if (hour >= band.startH && hour < band.endH) return band.key;
        }
        return '0000-0359'; // safety fallback
    }

    function isInWOCL(timeMinutes) {
        return timeMinutes >= WOCL_START && timeMinutes < WOCL_END;
    }

    /**
     * Returns true if the duty period [startMin, startMin+durationMin) overlaps
     * the WOCL window, accounting for midnight wrap-around.
     */
    function encroachesWOCL(startMin, durationMin) {
        const endMin = startMin + durationMin;
        // Generate WOCL minute-set and check overlap
        // Simple approach: check if any WOCL boundary falls inside the duty period
        const woclPoints = [WOCL_START, WOCL_END];
        for (const wp of woclPoints) {
            // Also check the next-day equivalent
            for (const offset of [0, 1440]) {
                const t = wp + offset;
                if (t > startMin && t <= endMin) return true;
            }
        }
        // Also check if duty entirely contains WOCL
        if (startMin <= WOCL_START && endMin >= WOCL_END) return true;
        return false;
    }

    // ─── Main calculation ─────────────────────────────────────────────────────

    /**
     * Calculate maximum FDP per CAR 700.28.
     *
     * @param {string}        reportTime          - HH:MM local report time
     * @param {number|string} flights             - Number of scheduled flights
     *                                              (ignored for 'dayvfr')
     * @param {string}        avgFlightDuration   - 'lt30' | '30to49' | 'gte50' | 'dayvfr'
     * @param {string}        acclimatizationStatus - 'acclimatized' | 'unacclimatized'
     * @param {string}        [refTime]           - HH:MM local time at last acclimatized
     *                                              location; required when unacclimatized
     * @returns {Object} Calculation result
     */
    function calculate(reportTime, flights, avgFlightDuration, acclimatizationStatus, refTime) {
        const result = {
            success: false,
            maxFDP: null,
            maxFDPFormatted: '--:--',
            maxFDPReadable: '--',
            endOfDuty: null,
            endOfDutyFormatted: '--:--',
            woclEncroachment: false,
            woclInfo: 'No WOCL encroachment',
            timeBand: null,
            columnIndex: null,
            acclimatized: acclimatizationStatus === 'acclimatized',
            error: null
        };

        // -- Validate report time --
        const reportMinutes = timeToMinutes(reportTime);
        if (reportMinutes === null) {
            result.error = 'Invalid report time. Use HH:MM format.';
            return result;
        }

        // -- Validate flight count (not required for Day VFR) --
        const numFlights = parseInt(flights, 10);
        if (avgFlightDuration !== 'dayvfr') {
            if (isNaN(numFlights) || numFlights < 1 || numFlights > 999) {
                result.error = 'Invalid number of flights. Enter 1 or more.';
                return result;
            }
        }

        // -- Determine lookup time per CAR 700.19(2) --
        //    Acclimatized   → local time at current location
        //    Unacclimatized → local time at last acclimatized location
        let lookupMinutes = reportMinutes;
        if (acclimatizationStatus === 'unacclimatized' && refTime) {
            const refMin = timeToMinutes(refTime);
            if (refMin === null) {
                result.error = 'Invalid reference time for acclimatized location. Use HH:MM format.';
                return result;
            }
            lookupMinutes = refMin;
        }

        // -- Lookup FDP from table --
        const timeBandKey = getTimeBandKey(lookupMinutes);
        const colIndex    = getColumnIndex(avgFlightDuration, isNaN(numFlights) ? 1 : numFlights);
        const maxFDP      = FDP_VALUES[timeBandKey][colIndex];

        result.timeBand    = timeBandKey;
        result.columnIndex = colIndex;

        // -- WOCL check (always based on actual report time, not ref time) --
        if (isInWOCL(reportMinutes)) {
            result.woclInfo        = 'Report time is within WOCL (02:00\u201305:59)';
            result.woclEncroachment = true;
        } else if (encroachesWOCL(reportMinutes, maxFDP)) {
            result.woclInfo        = 'Duty encroaches WOCL (02:00\u201305:59)';
            result.woclEncroachment = true;
        }

        // -- End of duty time --
        const endOfDutyTotal = reportMinutes + maxFDP;

        result.success            = true;
        result.maxFDP             = maxFDP;
        result.maxFDPFormatted    = minutesToTime(maxFDP);
        result.maxFDPReadable     = formatDuration(maxFDP);
        result.endOfDuty          = endOfDutyTotal % 1440;
        result.endOfDutyFormatted = minutesToTime(endOfDutyTotal % 1440);
        result.reportMinutes      = reportMinutes;

        if (endOfDutyTotal >= 1440) {
            result.endOfDutyFormatted += ' (+1)';
        }

        return result;
    }

    /**
     * Calculate remaining FDP given elapsed minutes since report time.
     *
     * @param {string}        reportTime
     * @param {number}        elapsedMinutes
     * @param {number|string} flights
     * @param {string}        avgFlightDuration
     * @param {string}        acclimatizationStatus
     * @param {string}        [refTime]
     */
    function calculateRemaining(reportTime, elapsedMinutes, flights, avgFlightDuration, acclimatizationStatus, refTime) {
        const fdpResult = calculate(reportTime, flights, avgFlightDuration, acclimatizationStatus, refTime);

        if (!fdpResult.success) {
            return { remaining: null, remainingFormatted: '--', percentage: 0, status: 'unknown' };
        }

        const remaining  = fdpResult.maxFDP - elapsedMinutes;
        const percentage = Math.min(100, Math.max(0, (elapsedMinutes / fdpResult.maxFDP) * 100));

        let status = 'good';
        if (remaining <= 0)    status = 'exceeded';
        else if (remaining <= 60)  status = 'danger';
        else if (remaining <= 120) status = 'warning';

        return {
            remaining: Math.max(0, remaining),
            remainingFormatted: formatDuration(Math.max(0, remaining)),
            percentage,
            status,
            maxFDP: fdpResult.maxFDP
        };
    }

    function getTable()      { return { FDP_VALUES, TIME_BANDS }; }
    function getTimeRanges() { return TIME_BANDS.map(b => b.key); }

    // ─── Public API ───────────────────────────────────────────────────────────
    return {
        calculate,
        calculateRemaining,
        getTable,
        getTimeRanges,
        timeToMinutes,
        minutesToTime,
        formatDuration,
        WOCL_START,
        WOCL_END
    };
})();

// Export for Node.js environments (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FDPCalculator;
}
