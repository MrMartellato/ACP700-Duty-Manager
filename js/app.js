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
        initialized: false
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
        // FDP card shows static max values for reference
        elements.fdpCurrent.textContent = '0:00';
        elements.fdpMax.textContent = '14:00';
        elements.fdpProgress.style.width = '0%';
        elements.fdpRemaining.textContent = 'Max FDP varies by report time';
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
