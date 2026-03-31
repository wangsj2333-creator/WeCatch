# Sprint 2 QA Report
Date: 2026-03-31

## Summary

- Total criteria: 13
- Passed: 11
- Failed: 0
- Partial: 2
- Overall: PASS (with minor issues)

---

## Build Check

Result: PASS -- zero warnings, zero errors.

Command: cd extension && npm run build

Output: webpack 5.105.4 compiled successfully in 1991 ms

No deprecation warnings. No TypeScript errors. No missing module errors.

---

## Visual Inspection Note

Playwright file:// protocol access is blocked in this browser environment.
Visual and layout inspection was performed via CSS source review.
All pass/fail verdicts are backed by static analysis of source files.

---

## Test Results

### Alarm Management

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Install/startup creates wecatch-poll alarm with 5-min default | PASS | service-worker.js L35-43: both onInstalled and onStartup call ensureAlarm(), which reads wecatch_interval (defaulting to DEFAULT_INTERVAL=5) and calls chrome.alarms.create with periodInMinutes: interval |
| Switching to 2-min clears old alarm creates new 2-min alarm | PASS | resetAlarm() L24-29: calls chrome.alarms.clear(ALARM_NAME) then chrome.alarms.create with new period; SET_INTERVAL handler at L82-87 calls resetAlarm(msg.interval) |
| Switching to 10-min updates alarm correctly | PASS | Same resetAlarm() path; interval value is taken directly from msg.interval |
| wecatch_interval written to chrome.storage.local | PASS | resetAlarm() L25: chrome.storage.local.set runs before clearing the old alarm |
| SW sleep/recovery auto-rebuilds alarm | PARTIAL | onStartup handles browser-restart recovery. onAlarm handler calls ensureAlarm() as a safety net (L53). However if SW is evicted mid-session and the alarm is also lost there is no rebuild mechanism until next browser start. This is an inherent Alarms API constraint not a code defect. Contract requirements for the specified scenarios are met. |

### GET_STATUS Message

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Response contains lastRun, newCount, nextAlarmTime | PASS | handleGetStatus() L104-117 returns all three fields; nextAlarmTime is null when no alarm exists |
| nextAlarmTime matches chrome.alarms.get().scheduledTime | PASS | L110-115: alarm.scheduledTime is passed through directly with no transformation |

### Interval Selector UI

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Initializes with correct highlight on current interval (default 5-min) | PASS | useStatus.js L55: useState(DEFAULT_INTERVAL) sets initial value to 5; refreshStatus() reads wecatch_interval from storage on mount and calls setIntervalValue (L67-69); ControlCard.jsx L38 applies interval-capsule--selected when interval === value |
| Clicking interval buttons correctly switches highlight | PASS | ControlCard.jsx L22-30: handleIntervalClick calls onChangeInterval(value) with loading guard; changeInterval in useStatus.js sends SET_INTERVAL to SW and updates state on ok:true response |
| Switching interval resets countdown to new interval value | PASS | changeInterval() L114-121: after SW confirms success calls refreshStatus() which re-fetches nextAlarmTime; new alarm scheduledTime is approx one new interval ahead; countdown resets via useEffect watching nextAlarmTime at L73-89 |

### Status Panel

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Before any capture: shows correct null-state text | PASS | formatRelativeTime(null) returns the no-capture text (useStatus.js L22); StatusCard.jsx L16: newCount === null produces dash |
| Countdown updates every second in mm:ss format | PASS | useStatus.js L87: setInterval(tick, 1000); formatCountdown() L38-44 produces zero-padded mm:ss |
| wecatch_last_run has value: shows correct relative time | PASS | formatRelativeTime() L21-31 handles four tiers: just now (<60s), N minutes ago (<60min), N hours ago (<24h), N days ago |
| Receiving POLL_DONE broadcast auto-refreshes panel | PASS | useStatus.js L100-108: chrome.runtime.onMessage listener calls refreshStatus() on POLL_DONE; SW broadcasts via chrome.runtime.sendMessage which reaches all extension pages |

---

## Critical Issues

None.

---

## Medium Issues

### 1. content-script.js violates the 200-line file size rule

**File**: extension/src/content/content-script.js
**Line count**: 277 lines (rule: max 200)
**Rule source**: CLAUDE.md -- single file must not exceed 200 lines

The file contains at least four separable responsibilities:
- API helpers and URL construction (L19-37)
- Article list fetching (L54-111)
- Comment capture, reply pagination, and normalisation (L116-232)
- Message listener entry point (L236-277)

This file predates Sprint 2 but was not fixed. Sprint 3 will extend it further, making the split more expensive the longer it is deferred.

---

## Minor Issues

### 2. useStatus.js L68: falsy guard on interval value is semantically weak

**File**: extension/src/sidepanel/useStatus.js, line 68

The guard evaluates wecatch_interval as a boolean. This is falsy for 0. While 0 is not a valid interval in the current design, the semantically correct guard is != null. This avoids unexpected silent failures if storage ever contains a 0 value.

### 3. The capture button is permanently disabled with no explanation

**File**: extension/src/sidepanel/ControlCard.jsx, line 46

The button is unconditionally disabled with no tooltip, label, or visual hint explaining why or when it will be enabled. A first-time tester will be confused. A brief title attribute or inline label would improve interim UX.

### 4. formatRelativeTime does not guard against NaN from malformed timestamps

**File**: extension/src/sidepanel/useStatus.js, lines 23-30

If wecatch_last_run contains a malformed ISO string, new Date(isoString).getTime() returns NaN. All arithmetic produces NaN, comparisons fail, and the function returns NaN-days-ago text. Adding an isNaN guard after line 23 would handle this edge case.

### 5. broadcastMessage catch block discards all errors silently

**File**: extension/src/background/service-worker.js, lines 123-127

The empty catch block discards all errors including unexpected runtime errors unrelated to the side panel being closed. Adding a console.warn call inside the catch would preserve debuggability without breaking the intended behavior.

---

## Design System Compliance

| Check | Result | Notes |
|-------|--------|-------|
| Title font: Plus Jakarta Sans | PASS | sidepanel.css L39; status-card.css L24, L46 |
| Body font: Manrope | PASS | sidepanel.css L8; control-card.css L17, L44 |
| Forbidden fonts absent (Inter, Arial, system-ui) | PASS | Not present in any CSS file |
| Primary color #006d48 | PASS | Used in title, accent values, button gradient start |
| Background #effcf7 | PASS | sidepanel.css L9: linear-gradient(160deg, #effcf7, #ddf2ec) |
| Text color #1f3731 | PASS | status-card.css L19; control-card.css L19 |
| Card rgba(255,255,255,0.70) + backdrop-filter blur(12px) | PASS | sidepanel.css L50-52 |
| Card border-radius 24px | PASS | sidepanel.css L53 |
| Button border-radius 16px | PASS | control-card.css L39; sidepanel.css L65 |
| No generic AI template patterns | PASS | No purple gradients, no flat white cards, no Inter font |

---

## Regression Check (Sprint 1 features)

| Feature | Status | Evidence |
|---------|--------|----------|
| setPanelBehavior on install/startup | PASS | service-worker.js L36, L42 -- preserved |
| START_CAPTURE / handleCapture handler | PASS | L96-101, L133-167 -- preserved |
| WeChat tab detection in SidePanel | PASS | SidePanel.jsx unchanged; detectWxTab and tab event listeners intact |
| GuideView shown when no WX tab | PASS | Conditional render at SidePanel.jsx L75 |
| alarms permission in manifest | PASS | dist/manifest.json L6 |

---

## Scoring

| Dimension | Score | Reasoning |
|-----------|-------|----------|
| Functional Completeness | 9/10 | All 13 criteria met (11 PASS, 2 PARTIAL where PARTIAL reflects inherent API constraints); no stubs, no fake data in Sprint 2 scope |
| Visual Design | 9/10 | Full Ethereal Greenhouse compliance; only gap is permanently disabled button with no UX affordance |
| Usability | 7/10 | Interval selector and status panel are clear; disabled button with no explanation is a usability gap; first-install race condition may briefly show countdown placeholder |
| Regression | 10/10 | Sprint 1 features fully preserved; manifest permissions correct |
| Code Quality | 7/10 | Build is clean; all Sprint 2 files are under 200 lines; pre-existing content-script.js is 277 lines and violates the rule; minor defensive programming gaps noted |

### Overall: PASS

All Sprint 2 acceptance criteria are implemented and verified via code review.
The carry-over violation (content-script.js line count) must be addressed before Sprint 3 extends that file further.

---

## Fix Checklist for Generator

- [ ] [Medium] Split extension/src/content/content-script.js (277 lines) into at least two files by responsibility. Target: each file under 200 lines. Suggested split: api-helpers.js (URL construction + apiFetch) + comment-capture.js (article fetching, comment pagination, normalisation) + content-script.js (message listener entry point only).
- [ ] [Minor] extension/src/sidepanel/useStatus.js line 68: change the truthy guard on wecatch_interval to a null check (wecatch_interval != null).
- [ ] [Minor] extension/src/sidepanel/useStatus.js after line 23: add isNaN guard on diffMs so malformed stored timestamps do not produce NaN text in the UI.
- [ ] [Minor] extension/src/sidepanel/ControlCard.jsx line 46: add a title attribute or inline label to the disabled capture button explaining it is a Sprint 4 feature.
- [ ] [Minor] extension/src/background/service-worker.js line 126: replace empty catch block in broadcastMessage with a console.warn call to preserve debuggability.
