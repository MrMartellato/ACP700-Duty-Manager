/**
 * ACP700 Duty Manager - Main Application
 * Transport Canada CAR 700 Compliant Duty Calculator
 * 
 * This is the main entry point that wires together all modules
 * and handles UI interactions.
 */

(function() {
    'use strict';

    /**
     * Application State
     */
    const state = {
        currentDuty: null,
        preferences: null,
        initialized: false,
        dutyTimerInterval: null
    };

    /**
     * DOM Element References
     */
    const elements = {
        // Header
        currentTime: document.getElementById('currentTime'),
        zuluTime: document.getElementById('zuluTime'),
        overallStatus: document.getElementById('overallStatus'),
        
        // Compliance Cards
        fdpCard: document.getElementById('fdpCard'),
        fdpCurrent: document.getElementById('fdpCurrent'),
        fdpMax: document.getElementById('fdpMax'),
        fdpProgress: document.getElementById('fdpProgress'),
        fdpRemaining: document.getElementById('fdpRemaining'),
        fdpStatus: document.getElementById('fdpStatus'),
        
        // Duty Tracking Controls
        btnStartDuty: document.getElementById('btnStartDuty'),
        btnEndDuty: document.getElementById('btnEndDuty'),
        dutyInfo: document.getElementById('dutyInfo'),
        dutyStartTime: document.getElementById('dutyStartTime'),
        activeDutySectors: document.getElementById('activeDutySectors'),
        
        flightTimeCard: document.getElementById('flightTimeCard'),
        flightCurrent: document.getElementById('flightCurrent'),
        flightMax: document.getElementById('flightMax'),
        flightProgress: document.getElementById('flightProgress'),
        flightRemaining: document.getElementById('flightRemaining'),
        
        duty7Card: document.getElementById('duty7Card'),
        duty7Current: document.getElementById('duty7Current'),
        duty7Progress: document.getElementById('duty7Progress'),
        duty7Remaining: document.getElementById('duty7Remaining'),
        
        duty28Card: document.getElementById('duty28Card'),
        duty28Current: document.getElementById('duty28Current'),
        duty28Progress: document.getElementById('duty28Progress'),
        duty28Remaining: document.getElementById('duty28Remaining'),
        
        // FDP Calculator
        fdpForm: document.getElementById('fdpForm'),
        reportTime: document.getElementById('reportTime'),
        sectors: document.getElementById('sectors'),
        acclimatized: document.getElementById('acclimatized'),
        maxFdpResult: document.getElementById('maxFdpResult'),
        endDutyResult: document.getElementById('endDutyResult'),
        woclResult: document.getElementById('woclResult'),
        
        // Rest Calculator
        restForm: document.getElementById('restForm'),
        dutyEndTime: document.getElementById('dutyEndTime'),
        dutyLength: document.getElementById('dutyLength'),
        timezonesCrossed: document.getElementById('timezonesCrossed'),
        minRestResult: document.getElementById('minRestResult'),
        nextReportResult: document.getElementById('nextReportResult'),
        recommendedRestResult: document.getElementById('recommendedRestResult'),
        
        // Duty Logger
        loggerForm: document.getElementById('loggerForm'),
        logDate: document.getElementById('logDate'),
        logReportTime: document.getElementById('logReportTime'),
        logReleaseTime: document.getElementById('logReleaseTime'),
        logFlightTime: document.getElementById('logFlightTime'),
        historyBody: document.getElementById('historyBody'),
        clearHistory: document.getElementById('clearHistory')
    };

    /**
     * Initialize the application
     */
    function init() {
        if (state.initialized) return;
        
        // Load preferences
        state.preferences = StorageManager.getPreferences();
        
        // Set default date to today
        elements.logDate.valueAsDate = new Date();
        
        // Start clock updates
        updateClock();
        setInterval(updateClock, 1000);
        
        // Bind event listeners
        bindEvents();
        
        // Load and display duty history
        loadHistory();
        
        // Update compliance dashboard
        updateComplianceDashboard();
        
        // Check for active duty and restore if exists
        restoreActiveDuty();
        
        state.initialized = true;
        console.log('ACP700 Duty Manager initialized');
    }

    /**
     * Bind all event listeners
     */
    function bindEvents() {
        // FDP Calculator form
        elements.fdpForm.addEventListener('submit', handleFDPCalculation);
        
        // Rest Calculator form
        elements.restForm.addEventListener('submit', handleRestCalculation);
        
        // Duty Logger form
        elements.loggerForm.addEventListener('submit', handleLogDuty);
        
        // Clear history button
        elements.clearHistory.addEventListener('click', handleClearHistory);
        
        // Real-time FDP preview on input change
        elements.reportTime.addEventListener('change', previewFDP);
        elements.sectors.addEventListener('change', previewFDP);
        elements.acclimatized.addEventListener('change', previewFDP);
        
        // Duty tracking controls
        elements.btnStartDuty.addEventListener('click', handleStartDuty);
        elements.btnEndDuty.addEventListener('click', handleEndDuty);
        elements.activeDutySectors.addEventListener('change', handleSectorsChange);
    }

    /**
     * Update the clock displays
     */
    function updateClock() {
        const now = new Date();
        
        // Local time
        const localTime = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        elements.currentTime.textContent = localTime;
        
        // Zulu (UTC) time
        const zuluTime = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'UTC'
        });
        elements.zuluTime.textContent = zuluTime + ' Z';
    }

    /**
     * Handle FDP calculation form submission
     */
    function handleFDPCalculation(e) {
        e.preventDefault();
        
        const reportTime = elements.reportTime.value;
        const sectors = elements.sectors.value;
        const acclimatization = elements.acclimatized.value;
        
        if (!reportTime) {
            showToast('Please enter a report time', 'warning');
            return;
        }
        
        const result = FDPCalculator.calculate(reportTime, sectors, acclimatization);
        
        if (result.success) {
            elements.maxFdpResult.textContent = result.maxFDPReadable;
            elements.endDutyResult.textContent = result.endOfDutyFormatted;
            elements.woclResult.textContent = result.woclInfo;
            
            // Highlight result panel
            const resultPanel = document.getElementById('fdpResult');
            resultPanel.style.animation = 'none';
            resultPanel.offsetHeight; // Trigger reflow
            resultPanel.style.animation = 'fadeIn 0.3s ease-out';
            
            showToast('FDP calculated successfully', 'success');
        } else {
            showToast(result.error, 'error');
        }
    }

    /**
     * Preview FDP as user changes inputs
     */
    function previewFDP() {
        const reportTime = elements.reportTime.value;
        const sectors = elements.sectors.value;
        const acclimatization = elements.acclimatized.value;
        
        if (!reportTime) return;
        
        const result = FDPCalculator.calculate(reportTime, sectors, acclimatization);
        
        if (result.success) {
            elements.maxFdpResult.textContent = result.maxFDPReadable;
            elements.endDutyResult.textContent = result.endOfDutyFormatted;
            elements.woclResult.textContent = result.woclInfo;
        }
    }

    /**
     * Handle Rest calculation form submission
     */
    function handleRestCalculation(e) {
        e.preventDefault();
        
        const dutyEndTime = elements.dutyEndTime.value;
        const dutyLength = elements.dutyLength.value;
        const timezonesCrossed = elements.timezonesCrossed.value;
        
        if (!dutyEndTime || !dutyLength) {
            showToast('Please fill in all required fields', 'warning');
            return;
        }
        
        const result = RestCalculator.calculate(dutyEndTime, dutyLength, timezonesCrossed);
        
        if (result.success) {
            elements.minRestResult.textContent = result.minRestReadable;
            elements.nextReportResult.textContent = result.nextReportFormatted;
            elements.recommendedRestResult.textContent = result.recommendedRestReadable;
            
            // Highlight result panel
            const resultPanel = document.getElementById('restResult');
            resultPanel.style.animation = 'none';
            resultPanel.offsetHeight; // Trigger reflow
            resultPanel.style.animation = 'fadeIn 0.3s ease-out';
            
            showToast('Rest requirements calculated', 'success');
        } else {
            showToast(result.error, 'error');
        }
    }

    /**
     * Handle duty log form submission
     */
    function handleLogDuty(e) {
        e.preventDefault();
        
        const date = elements.logDate.value;
        const reportTime = elements.logReportTime.value;
        const releaseTime = elements.logReleaseTime.value;
        const flightTime = elements.logFlightTime.value;
        
        if (!date || !reportTime || !releaseTime || !flightTime) {
            showToast('Please fill in all fields', 'warning');
            return;
        }
        
        const result = StorageManager.addDutyRecord({
            date: date,
            reportTime: reportTime,
            releaseTime: releaseTime,
            flightTime: flightTime
        });
        
        if (result.success) {
            // Clear form
            elements.logReportTime.value = '';
            elements.logReleaseTime.value = '';
            elements.logFlightTime.value = '';
            
            // Refresh displays
            loadHistory();
            updateComplianceDashboard();
            
            showToast('Duty period logged successfully', 'success');
        } else {
            showToast(result.error, 'error');
        }
    }

    /**
     * Load and display duty history
     */
    function loadHistory() {
        const records = StorageManager.getDutyRecords();
        
        if (records.length === 0) {
            elements.historyBody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="6">No duty periods logged. Add your first entry above.</td>
                </tr>
            `;
            return;
        }
        
        // Display last 10 records
        const displayRecords = records.slice(0, 10);
        
        elements.historyBody.innerHTML = displayRecords.map(record => {
            const dutyHours = Math.floor(record.dutyMinutes / 60);
            const dutyMins = record.dutyMinutes % 60;
            const flightHours = (record.flightMinutes / 60).toFixed(1);
            
            return `
                <tr data-id="${record.id}">
                    <td>${formatDate(record.date)}</td>
                    <td>${record.reportTime}</td>
                    <td>${record.releaseTime}</td>
                    <td>${dutyHours}:${dutyMins.toString().padStart(2, '0')}</td>
                    <td>${flightHours}h</td>
                    <td>
                        <button class="btn-delete" onclick="window.deleteDutyRecord('${record.id}')">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Format date for display
     */
    function formatDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    /**
     * Delete a duty record (exposed globally for onclick)
     */
    window.deleteDutyRecord = function(id) {
        if (!confirm('Are you sure you want to delete this duty record?')) {
            return;
        }
        
        const result = StorageManager.deleteDutyRecord(id);
        
        if (result.success) {
            loadHistory();
            updateComplianceDashboard();
            showToast('Record deleted', 'success');
        } else {
            showToast('Failed to delete record', 'error');
        }
    };

    /**
     * Handle clear history button
     */
    function handleClearHistory() {
        if (!confirm('Are you sure you want to clear ALL duty records? This cannot be undone.')) {
            return;
        }
        
        if (StorageManager.clearAllRecords()) {
            loadHistory();
            updateComplianceDashboard();
            showToast('All records cleared', 'success');
        } else {
            showToast('Failed to clear records', 'error');
        }
    }

    /**
     * Update the compliance dashboard with current totals
     */
    function updateComplianceDashboard() {
        const records = StorageManager.getDutyRecords();
        const checks = ComplianceChecker.runAllChecks(records);
        
        // Update 7-day duty card
        updateComplianceCard(
            elements.duty7Card,
            elements.duty7Current,
            elements.duty7Progress,
            elements.duty7Remaining,
            checks.duty7Day
        );
        
        // Update 28-day duty card
        updateComplianceCard(
            elements.duty28Card,
            elements.duty28Current,
            elements.duty28Progress,
            elements.duty28Remaining,
            checks.duty28Day
        );
        
        // Update FDP card (show daily FDP limit info)
        updateFDPCard();
        
        // Update flight time card
        updateFlightTimeCard(checks.flightTime28Day);
        
        // Update overall status
        updateOverallStatus(checks);
    }

    /**
     * Update a compliance card
     */
    function updateComplianceCard(card, currentEl, progressEl, remainingEl, check) {
        currentEl.textContent = check.currentFormatted;
        progressEl.style.width = `${check.percentage}%`;
        remainingEl.textContent = `${check.remainingFormatted} remaining`;
        
        // Update card status
        card.classList.remove('warning', 'danger');
        const statusEl = card.querySelector('.card-status');
        
        if (check.status === 'danger' || check.status === 'exceeded') {
            card.classList.add('danger');
            statusEl.className = 'card-status status-danger';
            statusEl.textContent = check.status === 'exceeded' ? 'EXCEEDED' : 'LOW';
        } else if (check.status === 'warning') {
            card.classList.add('warning');
            statusEl.className = 'card-status status-warning';
            statusEl.textContent = 'CAUTION';
        } else {
            statusEl.className = 'card-status status-good';
            statusEl.textContent = 'OK';
        }
    }

    /**
     * Update FDP card (shows max FDP for reference)
     */
    function updateFDPCard() {
        // Don't update if we have an active duty (handled by timer)
        if (state.currentDuty) {
            return;
        }
        
        // FDP card shows static values when not on duty
        elements.fdpCurrent.textContent = '0:00';
        elements.fdpMax.textContent = '14:00';
        elements.fdpProgress.style.width = '0%';
        elements.fdpRemaining.textContent = 'Not on duty';
    }

    /**
     * Update flight time card
     */
    function updateFlightTimeCard(check) {
        elements.flightCurrent.textContent = check.currentFormatted;
        elements.flightMax.textContent = check.limitFormatted;
        elements.flightProgress.style.width = `${check.percentage}%`;
        elements.flightRemaining.textContent = `${check.remainingFormatted} remaining`;
        
        // Update card status
        const card = elements.flightTimeCard;
        card.classList.remove('warning', 'danger');
        const statusEl = card.querySelector('.card-status');
        
        if (check.status === 'danger' || check.status === 'exceeded') {
            card.classList.add('danger');
            statusEl.className = 'card-status status-danger';
            statusEl.textContent = check.status === 'exceeded' ? 'EXCEEDED' : 'LOW';
        } else if (check.status === 'warning') {
            card.classList.add('warning');
            statusEl.className = 'card-status status-warning';
            statusEl.textContent = 'CAUTION';
        } else {
            statusEl.className = 'card-status status-good';
            statusEl.textContent = 'OK';
        }
    }

    /**
     * Update overall status indicator
     */
    function updateOverallStatus(checks) {
        const indicator = elements.overallStatus;
        const textEl = indicator.querySelector('.status-text');
        
        indicator.classList.remove('warning', 'danger');
        
        if (checks.overallStatus === 'exceeded' || checks.overallStatus === 'danger') {
            indicator.classList.add('danger');
            textEl.textContent = checks.overallStatus === 'exceeded' ? 'Limit Exceeded' : 'Approaching Limits';
        } else if (checks.overallStatus === 'warning') {
            indicator.classList.add('warning');
            textEl.textContent = 'Caution - Check Limits';
        } else {
            textEl.textContent = 'All Clear';
        }
    }

    /**
     * Handle Start Duty button click
     */
    function handleStartDuty() {
        const now = new Date();
        const reportTime = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
        });
        
        // Get sectors from the selector
        const sectors = elements.activeDutySectors.value;
        
        // Calculate max FDP based on report time and sectors
        const fdpResult = FDPCalculator.calculate(reportTime, sectors, 'acclimatized');
        const maxFdpMinutes = fdpResult.success ? fdpResult.maxFDP : 840;
        
        const result = StorageManager.startDuty({
            reportTime: reportTime,
            sectors: parseInt(sectors),
            maxFdpMinutes: maxFdpMinutes,
            acclimatized: true
        });
        
        if (result.success) {
            state.currentDuty = result.duty;
            
            // Update UI
            elements.btnStartDuty.style.display = 'none';
            elements.btnEndDuty.style.display = 'flex';
            elements.dutyInfo.style.display = 'flex';
            elements.dutyStartTime.textContent = reportTime;
            elements.fdpCard.classList.add('active-duty');
            
            // Update max FDP display
            elements.fdpMax.textContent = fdpResult.success ? fdpResult.maxFDPReadable : '14h';
            
            // Start the timer
            startDutyTimer();
            
            showToast('Duty period started at ' + reportTime, 'success');
        } else {
            showToast(result.error, 'error');
        }
    }

    /**
     * Handle End Duty button click
     */
    function handleEndDuty() {
        if (!state.currentDuty) {
            showToast('No active duty to end', 'warning');
            return;
        }
        
        const shouldLog = confirm('Do you want to log this duty period?\n\nClick OK to log, Cancel to discard.');
        
        // Prompt for flight time if logging
        let flightTime = 0;
        if (shouldLog) {
            const flightTimeStr = prompt('Enter total flight time (hours):', '0');
            if (flightTimeStr !== null) {
                flightTime = parseFloat(flightTimeStr) || 0;
            }
        }
        
        const result = StorageManager.endDuty({
            flightTime: flightTime,
            logDuty: shouldLog
        });
        
        if (result.success) {
            // Stop the timer
            stopDutyTimer();
            
            // Log the duty if requested
            if (shouldLog && result.record) {
                const logResult = StorageManager.addDutyRecord(result.record);
                if (logResult.success) {
                    loadHistory();
                    showToast('Duty period ended and logged', 'success');
                } else {
                    showToast('Duty ended but failed to log: ' + logResult.error, 'warning');
                }
            } else {
                showToast('Duty period ended (not logged)', 'success');
            }
            
            // Reset UI
            resetDutyUI();
            updateComplianceDashboard();
        } else {
            showToast(result.error, 'error');
        }
    }

    /**
     * Handle sectors change during active duty
     */
    function handleSectorsChange() {
        if (!state.currentDuty) return;
        
        const sectors = elements.activeDutySectors.value;
        
        // Recalculate max FDP
        const fdpResult = FDPCalculator.calculate(
            state.currentDuty.reportTime, 
            sectors, 
            state.currentDuty.acclimatized ? 'acclimatized' : 'unacclimatized'
        );
        
        const maxFdpMinutes = fdpResult.success ? fdpResult.maxFDP : 840;
        
        // Update active duty
        StorageManager.updateActiveDuty({
            sectors: parseInt(sectors),
            maxFdpMinutes: maxFdpMinutes
        });
        
        // Update state
        state.currentDuty.sectors = parseInt(sectors);
        state.currentDuty.maxFdpMinutes = maxFdpMinutes;
        
        // Update display
        elements.fdpMax.textContent = fdpResult.success ? fdpResult.maxFDPReadable : '14h';
        
        // Immediately update the FDP card
        updateDutyDisplay();
    }

    /**
     * Restore active duty from storage on page load
     */
    function restoreActiveDuty() {
        const activeDuty = StorageManager.getActiveDuty();
        
        if (activeDuty) {
            state.currentDuty = activeDuty;
            
            // Update UI
            elements.btnStartDuty.style.display = 'none';
            elements.btnEndDuty.style.display = 'flex';
            elements.dutyInfo.style.display = 'flex';
            elements.dutyStartTime.textContent = activeDuty.reportTime;
            elements.activeDutySectors.value = activeDuty.sectors;
            elements.fdpCard.classList.add('active-duty');
            
            // Calculate and display max FDP
            const fdpResult = FDPCalculator.calculate(
                activeDuty.reportTime, 
                activeDuty.sectors.toString(), 
                activeDuty.acclimatized ? 'acclimatized' : 'unacclimatized'
            );
            elements.fdpMax.textContent = fdpResult.success ? fdpResult.maxFDPReadable : '14h';
            
            // Start the timer
            startDutyTimer();
            
            console.log('Restored active duty from', activeDuty.reportTime);
        }
    }

    /**
     * Start the duty timer
     */
    function startDutyTimer() {
        // Clear any existing timer
        if (state.dutyTimerInterval) {
            clearInterval(state.dutyTimerInterval);
        }
        
        // Update immediately
        updateDutyDisplay();
        
        // Update every second
        state.dutyTimerInterval = setInterval(updateDutyDisplay, 1000);
    }

    /**
     * Stop the duty timer
     */
    function stopDutyTimer() {
        if (state.dutyTimerInterval) {
            clearInterval(state.dutyTimerInterval);
            state.dutyTimerInterval = null;
        }
        state.currentDuty = null;
    }

    /**
     * Update the duty display with current elapsed time
     */
    function updateDutyDisplay() {
        if (!state.currentDuty) return;
        
        const startTime = new Date(state.currentDuty.startTime);
        const now = new Date();
        const elapsedMs = now - startTime;
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        
        const hours = Math.floor(elapsedMinutes / 60);
        const minutes = elapsedMinutes % 60;
        const maxMinutes = state.currentDuty.maxFdpMinutes || 840;
        
        // Update current time
        elements.fdpCurrent.textContent = `${hours}:${minutes.toString().padStart(2, '0')}`;
        
        // Update progress bar
        const percentage = Math.min((elapsedMinutes / maxMinutes) * 100, 100);
        elements.fdpProgress.style.width = `${percentage}%`;
        
        // Update remaining time
        const remainingMinutes = Math.max(maxMinutes - elapsedMinutes, 0);
        const remainingHours = Math.floor(remainingMinutes / 60);
        const remainingMins = remainingMinutes % 60;
        elements.fdpRemaining.textContent = `${remainingHours}h ${remainingMins}m remaining`;
        
        // Update status based on percentage
        const statusEl = elements.fdpStatus;
        const card = elements.fdpCard;
        
        card.classList.remove('warning', 'danger');
        
        if (percentage >= 100) {
            card.classList.add('danger');
            statusEl.className = 'card-status status-danger';
            statusEl.textContent = 'EXCEEDED';
            elements.fdpRemaining.textContent = 'FDP LIMIT EXCEEDED!';
        } else if (percentage >= 90) {
            card.classList.add('danger');
            statusEl.className = 'card-status status-danger';
            statusEl.textContent = 'CRITICAL';
        } else if (percentage >= 75) {
            card.classList.add('warning');
            statusEl.className = 'card-status status-warning';
            statusEl.textContent = 'CAUTION';
        } else {
            statusEl.className = 'card-status status-good';
            statusEl.textContent = 'OK';
        }
    }

    /**
     * Reset duty tracking UI to initial state
     */
    function resetDutyUI() {
        elements.btnStartDuty.style.display = 'flex';
        elements.btnEndDuty.style.display = 'none';
        elements.dutyInfo.style.display = 'none';
        elements.fdpCard.classList.remove('active-duty', 'warning', 'danger');
        elements.fdpCurrent.textContent = '0:00';
        elements.fdpMax.textContent = '14:00';
        elements.fdpProgress.style.width = '0%';
        elements.fdpRemaining.textContent = 'Not on duty';
        elements.fdpStatus.className = 'card-status status-good';
        elements.fdpStatus.textContent = 'OK';
        elements.activeDutySectors.value = '2';
    }

    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        // Remove any existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create new toast
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
