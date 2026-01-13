# ACP700 Duty Manager

A web-based Flight Duty Period (FDP) calculator and compliance tracker for Canadian pilots, based on **Transport Canada CAR 700 Subpart 7** (2021 Amendments).

![ACP700 Duty Manager Screenshot](https://raw.githubusercontent.com/MrMartellato/ACP700-Duty-Manager/main/screenshot.png)

## Features

### FDP Calculator
- Calculate maximum Flight Duty Period based on report time
- Accounts for number of flight sectors (1-2, 3-4, 5+)
- Acclimatization status adjustments
- Window of Circadian Low (WOCL) encroachment warnings

### Rest Calculator
- Calculate minimum rest requirements based on preceding duty
- Time zone crossing adjustments
- Recommended rest periods (25% buffer over minimum)
- Next earliest report time calculation

### Compliance Dashboard
- Real-time 7-day duty tracking (60-hour limit)
- Real-time 28-day duty tracking (190-hour limit)
- 28-day flight time tracking (112-hour limit)
- Visual progress bars with status indicators (OK/Caution/Exceeded)

### Duty Logger
- Log duty periods with date, report time, release time, and flight time
- Automatic duty time calculation
- History table with delete functionality
- Data persists in browser LocalStorage

### Quick Reference
- FDP lookup table by report time and sectors
- Key regulatory limits at a glance

## Regulatory Limits (CAR 700 Subpart 7)

| Parameter | Limit |
|-----------|-------|
| Maximum Flight Duty Period | 9-14 hours (varies by report time and sectors) |
| Maximum Flight Time (Single Pilot) | 8 hours |
| Maximum Flight Time (Augmented) | 13 hours |
| Minimum Rest Period | 10-14 hours (based on duty length) |
| Maximum Duty in 7 Days | 60 hours |
| Maximum Duty in 28 Days | 190 hours |
| Maximum Flight Time in 28 Days | 112 hours |
| Maximum Flight Time in 365 Days | 1000 hours |

## Installation

### Option 1: Run Locally
1. Clone this repository:
   ```bash
   git clone https://github.com/MrMartellato/ACP700-Duty-Manager.git
   cd ACP700-Duty-Manager
   ```

2. Start a local web server:
   ```bash
   # Using Python
   python -m http.server 8080
   
   # Or using Node.js
   npx serve
   ```

3. Open `http://localhost:8080` in your browser

### Option 2: Open Directly
Simply open `index.html` in your web browser. Note: Some browsers may require a local server for full functionality.

## Project Structure

```
ACP700 Duty Manager/
├── index.html              # Main application page
├── css/
│   └── styles.css          # Aviation-themed dark UI styling
├── js/
│   ├── app.js              # Main application logic
│   ├── fdp-calculator.js   # FDP calculation engine
│   ├── rest-calculator.js  # Rest requirements engine
│   ├── compliance.js       # Compliance monitoring
│   └── storage.js          # LocalStorage management
└── README.md               # This file
```

## Technology Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (no frameworks)
- **Storage**: Browser LocalStorage
- **Design**: Dark aviation-themed UI with responsive layout
- **Fonts**: Outfit (UI) + JetBrains Mono (data display)

## Usage

### Calculate FDP
1. Enter your report time (local time)
2. Select the number of flight sectors
3. Choose your acclimatization status
4. Click "Calculate FDP" to see your maximum FDP and end-of-duty time

### Calculate Rest
1. Enter your duty end time
2. Enter the preceding duty period length in hours
3. Select time zones crossed (if any)
4. Click "Calculate Rest" to see minimum and recommended rest periods

### Log Duty
1. Enter the date, report time, release time, and flight time
2. Click "Log Duty" to add the entry
3. The compliance dashboard updates automatically

## Disclaimer

**This tool is for reference only.** Always verify calculations with:
- Official Transport Canada regulations (CAR 700 Subpart 7)
- Your operator's Operations Manual
- Your company's flight operations department

The developer assumes no responsibility for scheduling decisions made using this tool.

## License

MIT License - feel free to use, modify, and distribute.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## References

- [Transport Canada CAR 700 - Commercial Air Services](https://tc.canada.ca/en/corporate-services/acts-regulations/list-regulations/canadian-aviation-regulations-sor-96-433)
- [CAR 700 Subpart 7 - Flight Crew Member Fatigue Management](https://laws-lois.justice.gc.ca/eng/regulations/SOR-96-433/page-78.html)
