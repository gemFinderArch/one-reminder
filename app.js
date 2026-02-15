// NOAA Solar Calculator for precise sunrise/sunset times
const SunCalc = (() => {
    const toRad = d => d * Math.PI / 180;
    const toDeg = r => r * 180 / Math.PI;

    function julianDay(y, m, d) {
        if (m <= 2) { y--; m += 12; }
        const A = Math.floor(y / 100);
        const B = 2 - A + Math.floor(A / 4);
        return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
    }

    function solarParams(T) {
        const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
        const M = 357.52911 + T * (35999.05029 - T * 0.0001537);
        const e = 0.016708634 - T * (0.000042037 + T * 0.0000001267);
        const Mrad = toRad(M);
        const C = (1.914602 - T * (0.004817 + T * 0.000014)) * Math.sin(Mrad)
            + (0.019993 - T * 0.000101) * Math.sin(2 * Mrad)
            + 0.000289 * Math.sin(3 * Mrad);
        const sunTrueLong = L0 + C;
        const omega = 125.04 - 1934.136 * T;
        const sunApparentLong = sunTrueLong - 0.00569 - 0.00478 * Math.sin(toRad(omega));
        const meanObliq = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
        const obliqCorr = meanObliq + 0.00256 * Math.cos(toRad(omega));
        const dec = Math.asin(Math.sin(toRad(obliqCorr)) * Math.sin(toRad(sunApparentLong)));
        const y = Math.tan(toRad(obliqCorr) / 2) ** 2;
        const L0rad = toRad(L0);
        const eqTime = 4 * toDeg(
            y * Math.sin(2 * L0rad) - 2 * e * Math.sin(Mrad)
            + 4 * e * y * Math.sin(Mrad) * Math.cos(2 * L0rad)
            - 0.5 * y * y * Math.sin(4 * L0rad)
            - 1.25 * e * e * Math.sin(2 * Mrad)
        );
        return { dec, eqTime };
    }

    function calcTimeUTC(JD, lat, lng, isSunrise) {
        const zenith = 90.833;
        const latRad = toRad(lat);
        const T0 = (JD - 2451545.0) / 36525.0;
        const { dec: dec0, eqTime: eqTime0 } = solarParams(T0);
        let cosHA = (Math.cos(toRad(zenith)) / (Math.cos(latRad) * Math.cos(dec0))) - Math.tan(latRad) * Math.tan(dec0);
        if (cosHA > 1 || cosHA < -1) return null;
        const HA0 = toDeg(Math.acos(cosHA));
        const time0 = 720 - 4 * (lng + (isSunrise ? HA0 : -HA0)) - eqTime0;
        const JDtime = JD + time0 / 1440.0;
        const T1 = (JDtime - 2451545.0) / 36525.0;
        const { dec: dec1, eqTime: eqTime1 } = solarParams(T1);
        cosHA = (Math.cos(toRad(zenith)) / (Math.cos(latRad) * Math.cos(dec1))) - Math.tan(latRad) * Math.tan(dec1);
        if (cosHA > 1 || cosHA < -1) return null;
        const HA1 = toDeg(Math.acos(cosHA));
        return 720 - 4 * (lng + (isSunrise ? HA1 : -HA1)) - eqTime1;
    }

    function getTime(date, lat, lng, isSunrise) {
        const JD = julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
        const utcMin = calcTimeUTC(JD, lat, lng, isSunrise);
        if (utcMin === null) return null;
        const result = new Date(date);
        result.setUTCHours(0, 0, 0, 0);
        result.setTime(result.getTime() + utcMin * 60 * 1000);
        return result;
    }

    return {
        getSunrise: (date, lat, lng) => getTime(date, lat, lng, true),
        getSunset: (date, lat, lng) => getTime(date, lat, lng, false),
    };
})();

// Daily times system — each time independently shows next occurrence
const DailyTimes = {
    // Derive lat/lng from timezone offset
    // Latitude: ~48.85°N (Central European default), Longitude: offset * 15
    DEFAULT_LAT: 48.85,

    getCoords(tzOffset) {
        return { lat: this.DEFAULT_LAT, lng: tzOffset * 15 };
    },

    // Get sunrise/sunset for multiple days, return all as array
    getSunTimes(lat, lng, days) {
        const results = [];
        for (let i = -1; i <= days; i++) {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + i);
            const rise = SunCalc.getSunrise(d, lat, lng);
            const set = SunCalc.getSunset(d, lat, lng);
            results.push({ date: new Date(d), sunrise: rise, sunset: set });
        }
        return results;
    },

    // Find the next occurrence of each time that's still in the future
    calculate(tzOffset, bmMin, gkMin, pkMin) {
        const { lat, lng } = this.getCoords(tzOffset);
        const now = new Date();
        const sunDays = this.getSunTimes(lat, lng, 3); // yesterday through 3 days ahead

        // Collect all sunrises and sunsets
        const allSunrises = sunDays.map(d => d.sunrise).filter(Boolean);
        const allSunsets = sunDays.map(d => d.sunset).filter(Boolean);

        // Next sunrise & sunset
        const nextSunrise = allSunrises.find(t => t > now) || null;
        const nextSunset = allSunsets.find(t => t > now) || null;

        // For BM/GK/PK: calculate from every sunrise, find next future occurrence
        const allBM = allSunrises.map(sr => new Date(sr.getTime() - bmMin * 60000));
        const allGK = allBM.map(bm => new Date(bm.getTime() - gkMin * 60000));
        const allPK = allBM.map(bm => new Date(bm.getTime() - pkMin * 60000));

        const nextBM = allBM.find(t => t > now) || null;
        const nextGK = allGK.find(t => t > now) || null;
        const nextPK = allPK.find(t => t > now) || null;

        return { nextSunrise, nextSunset, nextBM, nextGK, nextPK };
    },

    formatTime(date) {
        if (!date) return '--:--';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    formatDate(date) {
        if (!date) return '--';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
    }
};

// One Reminder - Main Application

class ReminderApp {
    constructor() {
        this.sessions = [];
        this.history = [];
        this.nextId = 1;
        this.audioContext = null;
        this.notificationPermission = Notification.permission;
        this.currentAlarmSession = null;
        this.alarmAudioSource = null;
        this.alarmTimeout = null;
        this.customAudioBuffer = null;
        this.customAudioData = null;
        this.currentEventType = 'timer';

        this.recentTimers = [];
        this.customSounds = {};

        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.setDefaultDateTime();
        this.loadData();
        this.updateNotificationButton();
        this.renderRecentTimers();
        this.renderSessions();
        this.renderHistory();
        this.startUpdateLoop();
        this.initDailyTimes();
    }

    initDailyTimes() {
        const tzSelect = document.getElementById('tzSelect');
        // Populate timezone dropdown UTC-12 to UTC+14
        for (let i = -12; i <= 14; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `UTC${i >= 0 ? '+' : ''}${i}`;
            tzSelect.appendChild(opt);
        }

        // Load saved settings or defaults
        const saved = JSON.parse(localStorage.getItem('oneReminder_dtSettings') || 'null');
        if (saved) {
            tzSelect.value = saved.tz ?? 1;
            document.getElementById('bmOffset').value = saved.bm ?? 96;
            document.getElementById('gkOffset').value = saved.gk ?? 720;
            document.getElementById('pkOffset').value = saved.pk ?? 510;
        } else {
            tzSelect.value = 1; // Default UTC+1
        }

        // Bind change events
        tzSelect.addEventListener('change', () => this.saveDTSettings());
        ['bmOffset', 'gkOffset', 'pkOffset'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.saveDTSettings());
        });

        this.updateDailyTimes();
        // Update every 10 seconds for responsive time flipping
        setInterval(() => this.updateDailyTimes(), 10000);
    }

    saveDTSettings() {
        const settings = {
            tz: parseInt(document.getElementById('tzSelect').value),
            bm: parseInt(document.getElementById('bmOffset').value) || 96,
            gk: parseInt(document.getElementById('gkOffset').value) || 720,
            pk: parseInt(document.getElementById('pkOffset').value) || 510,
        };
        localStorage.setItem('oneReminder_dtSettings', JSON.stringify(settings));
        this.updateDailyTimes();
    }

    updateDailyTimes() {
        const tz = parseInt(document.getElementById('tzSelect').value);
        const bmMin = parseInt(document.getElementById('bmOffset').value) || 96;
        const gkMin = parseInt(document.getElementById('gkOffset').value) || 720;
        const pkMin = parseInt(document.getElementById('pkOffset').value) || 510;

        const times = DailyTimes.calculate(tz, bmMin, gkMin, pkMin);

        // Update times and dates
        document.getElementById('bmTime').textContent = DailyTimes.formatTime(times.nextBM);
        document.getElementById('bmDate').textContent = DailyTimes.formatDate(times.nextBM);
        document.getElementById('gkTime').textContent = DailyTimes.formatTime(times.nextGK);
        document.getElementById('gkDate').textContent = DailyTimes.formatDate(times.nextGK);
        document.getElementById('pkTime').textContent = DailyTimes.formatTime(times.nextPK);
        document.getElementById('pkDate').textContent = DailyTimes.formatDate(times.nextPK);
        document.getElementById('sunriseTime').textContent = DailyTimes.formatTime(times.nextSunrise);
        document.getElementById('sunriseDate').textContent = DailyTimes.formatDate(times.nextSunrise);
        document.getElementById('sunsetTime').textContent = DailyTimes.formatTime(times.nextSunset);
        document.getElementById('sunsetDate').textContent = DailyTimes.formatDate(times.nextSunset);

        // Highlight upcoming: find the earliest future time among all 5
        const allTimes = [
            { el: 'bmRow', time: times.nextBM },
            { el: 'gkRow', time: times.nextGK },
            { el: 'pkRow', time: times.nextPK },
        ].filter(t => t.time);

        const sunTimes = [
            { el: 'sunriseItem', time: times.nextSunrise },
            { el: 'sunsetItem', time: times.nextSunset },
        ].filter(t => t.time);

        // Clear all highlights
        ['bmRow', 'gkRow', 'pkRow'].forEach(id => document.getElementById(id).classList.remove('upcoming'));
        ['sunriseItem', 'sunsetItem'].forEach(id => document.getElementById(id).classList.remove('upcoming'));

        // Highlight the single next upcoming among BM/GK/PK
        if (allTimes.length) {
            allTimes.sort((a, b) => a.time - b.time);
            document.getElementById(allTimes[0].el).classList.add('upcoming');
        }

        // Highlight the single next upcoming among sunrise/sunset
        if (sunTimes.length) {
            sunTimes.sort((a, b) => a.time - b.time);
            document.getElementById(sunTimes[0].el).classList.add('upcoming');
        }
    }

    bindElements() {
        this.eventName = document.getElementById('eventName');
        this.eventDescription = document.getElementById('eventDescription');
        this.timerOptions = document.getElementById('timerOptions');
        this.reminderOptions = document.getElementById('reminderOptions');
        this.pomodoroOptions = document.getElementById('pomodoroOptions');
        this.hoursInput = document.getElementById('hoursInput');
        this.minutesInput = document.getElementById('minutesInput');
        this.secondsInput = document.getElementById('secondsInput');
        this.dateInput = document.getElementById('dateInput');
        this.timeInput = document.getElementById('timeInput');
        this.soundType = document.getElementById('soundType');
        this.customSoundUpload = document.getElementById('customSoundUpload');
        this.soundFile = document.getElementById('soundFile');
        this.fileName = document.getElementById('fileName');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeDisplay = document.getElementById('volumeDisplay');
        this.testSoundBtn = document.getElementById('testSoundBtn');
        this.addEventBtn = document.getElementById('addEvent');
        this.sessionsList = document.getElementById('sessionsList');
        this.sessionCount = document.getElementById('sessionCount');
        this.historyList = document.getElementById('historyList');
        this.historyCount = document.getElementById('historyCount');
        this.recentTimersList = document.getElementById('recentTimersList');
        this.notificationBtn = document.getElementById('enableNotifications');
        this.sessionsSection = document.getElementById('sessionsSection');
        this.historySection = document.getElementById('historySection');

        this.alarmModal = document.getElementById('alarmModal');
        this.alarmTask = document.getElementById('alarmTask');
        this.dismissBtn = document.getElementById('dismissAlarm');
        this.snoozeBtn = document.getElementById('snoozeAlarm');
        this.snoozeMinutes = document.getElementById('snoozeMinutes');
    }

    bindEvents() {
        this.addEventBtn.addEventListener('click', () => this.addEvent());
        this.notificationBtn.addEventListener('click', () => this.requestNotificationPermission());
        this.testSoundBtn.addEventListener('click', () => this.testSound());
        this.dismissBtn.addEventListener('click', () => this.dismissAlarm());
        this.snoozeBtn.addEventListener('click', () => this.snoozeAlarm());

        this.soundType.addEventListener('change', () => {
            this.customSoundUpload.classList.toggle('hidden', this.soundType.value !== 'custom');
        });

        this.soundFile.addEventListener('change', (e) => this.handleFileUpload(e));

        this.volumeSlider.addEventListener('input', () => {
            this.volumeDisplay.textContent = this.volumeSlider.value + '%';
        });

        this.eventName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addEvent();
        });
    }

    setEventType(type) {
        this.currentEventType = type;

        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        this.timerOptions.classList.toggle('hidden', type !== 'timer');
        this.reminderOptions.classList.toggle('hidden', type !== 'reminder');
        this.pomodoroOptions.classList.toggle('hidden', type !== 'pomodoro');

        const labels = { timer: 'Start Timer', reminder: 'Set Reminder', pomodoro: 'Start Pomodoro' };
        this.addEventBtn.textContent = labels[type];
    }

    toggleSection(section) {
        const sessionsCollapsed = this.sessionsSection.classList.contains('collapsed');
        const historyCollapsed = this.historySection.classList.contains('collapsed');

        if (section === 'sessions') {
            if (sessionsCollapsed) {
                // Expand sessions, collapse history
                this.sessionsSection.classList.remove('collapsed');
                this.historySection.classList.add('collapsed');
            } else {
                // Collapse sessions, expand history
                this.sessionsSection.classList.add('collapsed');
                this.historySection.classList.remove('collapsed');
            }
        } else {
            if (historyCollapsed) {
                // Expand history, collapse sessions
                this.historySection.classList.remove('collapsed');
                this.sessionsSection.classList.add('collapsed');
            } else {
                // Collapse history, expand sessions
                this.historySection.classList.add('collapsed');
                this.sessionsSection.classList.remove('collapsed');
            }
        }
    }

    setDefaultDateTime() {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().slice(0, 5);

        this.dateInput.value = date;
        this.dateInput.min = date;
        this.timeInput.value = time;

        // Empty timer fields
        this.hoursInput.value = '';
        this.minutesInput.value = '';
        this.secondsInput.value = '';
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.fileName.textContent = file.name;

        const reader = new FileReader();
        reader.onload = async (event) => {
            this.customAudioData = event.target.result;

            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            try {
                const arrayBuffer = await file.arrayBuffer();
                this.customAudioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            } catch (err) {
                console.error('Failed to decode audio:', err);
                alert('Could not load audio file. Please try a different format.');
            }
        };
        reader.readAsDataURL(file);
    }

    getCurrentSoundSettings() {
        return {
            soundType: this.soundType.value,
            volume: parseInt(this.volumeSlider.value) / 100,
            customSound: this.soundType.value === 'custom' ? this.customAudioData : null,
            customSoundName: this.soundType.value === 'custom' ? this.fileName.textContent : null
        };
    }

    addEvent() {
        const type = this.currentEventType;
        const defaultNames = { timer: 'Timer', reminder: 'Reminder', pomodoro: 'Pomodoro' };
        const name = this.eventName.value.trim() || defaultNames[type];
        const description = this.eventDescription.value.trim();
        const soundSettings = this.getCurrentSoundSettings();

        if (type === 'pomodoro') {
            this.startPomodoro(name, soundSettings, description);
            this.eventName.value = '';
            this.eventDescription.value = '';
            this.resetSoundForm();
            return;
        }

        let targetTime;
        let originalDuration = null;

        if (type === 'timer') {
            const hours = parseInt(this.hoursInput.value) || 0;
            const minutes = parseInt(this.minutesInput.value) || 0;
            const seconds = parseInt(this.secondsInput.value) || 0;
            const totalSeconds = hours * 3600 + minutes * 60 + seconds;

            if (totalSeconds <= 0) {
                alert('Please set a countdown time');
                return;
            }

            this.addRecentTimer(hours, minutes, seconds);
            targetTime = Date.now() + totalSeconds * 1000;
            originalDuration = totalSeconds * 1000;
        } else {
            const date = this.dateInput.value;
            const time = this.timeInput.value;

            if (!date || !time) {
                alert('Please select both date and time');
                return;
            }

            targetTime = new Date(`${date}T${time}`).getTime();
            if (targetTime <= Date.now()) {
                alert('Please select a future date and time');
                return;
            }
        }

        const session = {
            id: this.nextId++,
            name,
            description,
            type,
            targetTime,
            originalDuration,
            ...soundSettings,
            triggered: false,
            snoozeCount: 0,
            createdAt: Date.now()
        };

        this.sessions.push(session);
        this.saveSessions();
        this.renderSessions();

        // Reset form
        this.eventName.value = '';
        this.eventDescription.value = '';
        this.resetSoundForm();
    }

    resetSoundForm() {
        this.soundType.value = 'school';
        this.customSoundUpload.classList.add('hidden');
        this.volumeSlider.value = 25;
        this.volumeDisplay.textContent = '25%';
        this.customAudioData = null;
        this.customAudioBuffer = null;
        this.fileName.textContent = 'No file selected';
        this.soundFile.value = '';
    }

    startPomodoro(name, soundSettings, description) {
        const workMin = parseInt(document.getElementById('pomoWork').value) || 25;
        const breakMin = parseInt(document.getElementById('pomoBreak').value) || 5;
        const sessionsPerCycle = parseInt(document.getElementById('pomoSessions').value) || 4;
        const longBreakMin = parseInt(document.getElementById('pomoLongBreak').value) || 15;
        const totalCycles = parseInt(document.getElementById('pomoCycles').value) || 1;

        const session = {
            id: this.nextId++,
            name,
            description,
            type: 'pomodoro',
            phase: 'work',
            workDuration: workMin * 60 * 1000,
            breakDuration: breakMin * 60 * 1000,
            longBreakDuration: longBreakMin * 60 * 1000,
            sessionsPerCycle,
            totalCycles,
            currentSession: 1,
            currentCycle: 1,
            completedSessions: 0,
            targetTime: Date.now() + workMin * 60 * 1000,
            originalDuration: workMin * 60 * 1000,
            ...soundSettings,
            triggered: false,
            snoozeCount: 0,
            createdAt: Date.now()
        };

        this.sessions.push(session);
        this.saveSessions();
        this.renderSessions();
    }

    advancePomodoroPhase(session) {
        if (session.phase === 'work') {
            session.completedSessions++;
            const isLastSessionInCycle = session.currentSession >= session.sessionsPerCycle;

            if (isLastSessionInCycle) {
                session.phase = 'longBreak';
                session.targetTime = Date.now() + session.longBreakDuration;
            } else {
                session.phase = 'break';
                session.targetTime = Date.now() + session.breakDuration;
            }
        } else if (session.phase === 'break') {
            session.currentSession++;
            session.phase = 'work';
            session.targetTime = Date.now() + session.workDuration;
        } else if (session.phase === 'longBreak') {
            session.currentCycle++;

            if (session.currentCycle > session.totalCycles) {
                this.addToHistory(session);
                this.deleteSession(session.id);
                return;
            }

            session.currentSession = 1;
            session.phase = 'work';
            session.targetTime = Date.now() + session.workDuration;
        }

        session.triggered = false;
        this.playBriefAlarm(session);
        const phaseText = session.phase === 'work' ? 'Work Session' : session.phase === 'break' ? 'Break' : 'Long Break';
        this.sendNotification(`${session.name} - Starting ${phaseText}`);
        this.showPhaseChangePopup(session, phaseText);
        this.saveSessions();
        this.renderSessions();
    }

    showPhaseChangePopup(session, phaseText) {
        const phaseColors = { work: '#ff4444', break: '#00ff88', longBreak: '#4488ff' };
        const phaseColor = phaseColors[session.phase] || '#00d9ff';
        const phaseIcons = { work: '💪', break: '☕', longBreak: '🌴' };
        const phaseIcon = phaseIcons[session.phase] || '⏰';

        const popupWidth = 360;
        const popupHeight = 240;
        const left = (screen.width - popupWidth) / 2;
        const top = (screen.height - popupHeight) / 2;

        const popupHtml = `<!DOCTYPE html>
<html><head><title>Pomodoro - ${phaseText}</title>
${this.getPopupFavicon()}
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}
.wrap{text-align:center;padding:24px;width:100%}
.icon{font-size:3rem;margin-bottom:10px}
h2{font-size:1.4rem;color:${phaseColor};margin-bottom:6px}
.name{font-size:.95rem;color:#888;margin-bottom:4px}
.detail{font-size:.85rem;color:#666;margin-bottom:20px}
.got-it{padding:12px 40px;border:none;border-radius:8px;background:${phaseColor};color:#fff;
font-size:1rem;font-weight:600;cursor:pointer;transition:all .2s}
.got-it:hover{transform:scale(1.05);filter:brightness(1.2)}
</style></head><body>
<div class="wrap">
<div class="icon">${phaseIcon}</div>
<h2>Starting ${this.escapeHtml(phaseText)}</h2>
<div class="name">${this.escapeHtml(session.name)}</div>
<div class="detail">Session ${session.currentSession}/${session.sessionsPerCycle} · Cycle ${session.currentCycle}/${session.totalCycles}</div>
<button class="got-it" onclick="window.close()">Got it</button>
</div></body></html>`;

        const popup = window.open('', 'pomo_phase_' + Date.now(),
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=no,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`);

        if (popup && !popup.closed) {
            popup.document.write(popupHtml);
            popup.document.close();
            popup.focus();
        }
    }

    async playBriefAlarm(session) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        const volume = session.volume || 0.5;

        if (session.soundType === 'custom' && session.customSound) {
            await this.loadCustomSound(session.customSound);
            if (this.customAudioBuffer) {
                const source = this.audioContext.createBufferSource();
                const gainNode = this.audioContext.createGain();
                source.buffer = this.customAudioBuffer;
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                gainNode.gain.value = volume;
                source.start(0);
                setTimeout(() => { try { source.stop(); } catch(e) {} }, 3000);
            }
        } else {
            switch (session.soundType) {
                case 'light': this.playLightAlarm(volume); break;
                case 'school': this.playSchoolBell(volume); break;
                case 'siren': this.playSiren(volume); break;
                case 'strong': default: this.playStrongAlarm(volume); break;
            }
        }
    }

    renderPomodoroCard(session, remaining) {
        const phaseLabels = { work: 'Work', break: 'Break', longBreak: 'Long Break' };
        const phaseLabel = phaseLabels[session.phase];
        const untilLongBreak = session.sessionsPerCycle - session.currentSession;
        const descriptionHtml = session.description ? `<div class="session-description">${this.escapeHtml(session.description)}</div>` : '';

        return `
            <div class="session-card pomodoro phase-${session.phase}" data-id="${session.id}">
                <div class="pomo-stats">
                    Session ${session.currentSession}/${session.sessionsPerCycle} · Cycle ${session.currentCycle}/${session.totalCycles} · ${session.completedSessions} done · ${untilLongBreak} until long break
                </div>
                <div class="pomo-main-row">
                    <div class="session-info">
                        <div class="session-name">${this.escapeHtml(session.name)}</div>
                        <div class="session-meta">
                            <span class="session-type pomodoro">POMODORO</span>
                            ${phaseLabel}
                        </div>
                    </div>
                    <div class="session-actions">
                        <div class="session-countdown">
                            ${this.formatTimeRemaining(remaining)}
                        </div>
                        <button class="popout-btn" onclick="app.popoutSession(${session.id})" title="Pop out">⧉</button>
                        <button class="delete-btn" onclick="app.deleteSession(${session.id})">×</button>
                    </div>
                </div>
                ${descriptionHtml}
            </div>
        `;
    }

    addRecentTimer(hours, minutes, seconds) {
        this.recentTimers = this.recentTimers.filter(t =>
            !(t.hours === hours && t.minutes === minutes && t.seconds === seconds)
        );

        this.recentTimers.unshift({ hours, minutes, seconds });
        this.recentTimers = this.recentTimers.slice(0, 8);

        this.saveRecentTimers();
        this.renderRecentTimers();
    }

    renderRecentTimers() {
        if (this.recentTimers.length === 0) {
            this.recentTimersList.innerHTML = '<span style="color:#555;font-size:0.75rem">None yet</span>';
            return;
        }

        this.recentTimersList.innerHTML = this.recentTimers.map(timer => {
            const label = this.formatTimerLabel(timer.hours, timer.minutes, timer.seconds);
            return `<button class="recent-timer-btn" onclick="app.startRecentTimer(${timer.hours}, ${timer.minutes}, ${timer.seconds})">${label}</button>`;
        }).join('');
    }

    formatTimerLabel(hours, minutes, seconds) {
        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
        return parts.join(' ');
    }

    startRecentTimer(hours, minutes, seconds) {
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        const name = this.eventName.value.trim() || 'Timer';
        const description = this.eventDescription.value.trim();
        const soundSettings = this.getCurrentSoundSettings();

        const session = {
            id: this.nextId++,
            name,
            description,
            type: 'timer',
            targetTime: Date.now() + totalSeconds * 1000,
            originalDuration: totalSeconds * 1000,
            ...soundSettings,
            triggered: false,
            snoozeCount: 0,
            createdAt: Date.now()
        };

        this.sessions.push(session);
        this.saveSessions();
        this.renderSessions();
        this.eventName.value = '';
        this.eventDescription.value = '';

        this.addRecentTimer(hours, minutes, seconds);
    }

    repeatSession(id) {
        const session = this.sessions.find(s => s.id === id);
        if (!session || !session.originalDuration) return;

        const newSession = {
            id: this.nextId++,
            name: session.name,
            description: session.description,
            type: session.type,
            targetTime: Date.now() + session.originalDuration,
            originalDuration: session.originalDuration,
            soundType: session.soundType,
            volume: session.volume,
            customSound: session.customSound,
            customSoundName: session.customSoundName,
            triggered: false,
            snoozeCount: 0,
            createdAt: Date.now()
        };

        this.sessions.push(newSession);
        this.saveSessions();
        this.renderSessions();
    }

    deleteSession(id) {
        this.sessions = this.sessions.filter(s => s.id !== id);
        this.saveSessions();
        this.renderSessions();
    }

    addToHistory(session) {
        // Only add reminders and pomodoros to history, not timers
        if (session.type !== 'reminder' && session.type !== 'pomodoro') return;

        const historyItem = {
            id: session.id,
            name: session.name,
            type: session.type,
            setTime: session.targetTime,
            completedAt: Date.now()
        };

        if (session.type === 'pomodoro') {
            historyItem.completedSessions = session.completedSessions;
            historyItem.totalCycles = session.totalCycles;
            historyItem.sessionsPerCycle = session.sessionsPerCycle;
        }

        this.history.unshift(historyItem);
        this.history = this.history.slice(0, 50); // Keep last 50
        this.saveHistory();
        this.renderHistory();
    }

    clearHistory() {
        this.history = [];
        this.saveHistory();
        this.renderHistory();
    }

    formatTimeRemaining(ms) {
        if (ms <= 0) return '00:00:00';

        const totalSeconds = Math.floor(ms / 1000);
        const seconds = totalSeconds % 60;
        const totalMinutes = Math.floor(totalSeconds / 60);
        const minutes = totalMinutes % 60;
        const totalHours = Math.floor(totalMinutes / 60);
        const hours = totalHours % 24;
        const totalDays = Math.floor(totalHours / 24);
        const days = totalDays % 7;
        const weeks = Math.floor(totalDays / 7);

        const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (weeks > 0) {
            return `${weeks}w ${days}d ${time}`;
        } else if (totalDays > 0) {
            return `${totalDays}d ${time}`;
        }
        return time;
    }

    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatTimeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    renderSessions() {
        this.sessionCount.textContent = `(${this.sessions.length})`;

        if (this.sessions.length === 0) {
            this.sessionsList.innerHTML = '<div class="empty-state">No active sessions</div>';
            return;
        }

        const sorted = [...this.sessions].sort((a, b) => a.targetTime - b.targetTime);

        this.sessionsList.innerHTML = sorted.map(session => {
            const remaining = session.targetTime - Date.now();

            if (session.type === 'pomodoro') {
                return this.renderPomodoroCard(session, remaining);
            }

            const typeClass = session.type;
            const descriptionHtml = session.description ? `<div class="session-description">${this.escapeHtml(session.description)}</div>` : '';

            return `
                <div class="session-card ${typeClass}" data-id="${session.id}">
                    <div class="session-info">
                        <div class="session-name">${this.escapeHtml(session.name)}</div>
                        <div class="session-meta">
                            <span class="session-type ${typeClass}">${session.type.toUpperCase()}</span>
                            ${session.type === 'reminder' ? this.formatDateTime(session.targetTime) : ''}
                            ${session.snoozeCount > 0 ? `(Snoozed ${session.snoozeCount}x)` : ''}
                        </div>
                    </div>
                    <div class="session-actions">
                        <div class="session-countdown">
                            ${this.formatTimeRemaining(remaining)}
                        </div>
                        <button class="popout-btn" onclick="app.popoutSession(${session.id})" title="Pop out">⧉</button>
                        <button class="delete-btn" onclick="app.deleteSession(${session.id})">×</button>
                    </div>
                    ${descriptionHtml}
                </div>
            `;
        }).join('');
    }

    renderHistory() {
        this.historyCount.textContent = `(${this.history.length})`;

        if (this.history.length === 0) {
            this.historyList.innerHTML = '<div class="empty-state">No history yet</div>';
            return;
        }

        const clearBtn = `<button class="clear-history-btn" onclick="app.clearHistory()">Clear All</button>`;

        this.historyList.innerHTML = this.history.map(item => {
            const pomoStats = item.type === 'pomodoro'
                ? ` · ${item.completedSessions} sessions · ${item.totalCycles} cycle${item.totalCycles > 1 ? 's' : ''}`
                : '';
            return `
                <div class="history-card ${item.type}">
                    <div class="history-info">
                        <div class="history-name">${this.escapeHtml(item.name)}</div>
                        <div class="history-meta">
                            ${this.formatDateTime(item.setTime)} · ${this.formatTimeAgo(item.completedAt)}${pomoStats}
                        </div>
                    </div>
                </div>
            `;
        }).join('') + `<div style="text-align:center;padding:5px;">${clearBtn}</div>`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    startUpdateLoop() {
        setInterval(() => {
            this.checkSessions();
            this.renderSessions();
            this.updateSessionPopups();
        }, 1000);
    }

    checkSessions() {
        const now = Date.now();

        this.sessions.forEach(session => {
            if (!session.triggered && now >= session.targetTime) {
                session.triggered = true;
                if (session.type === 'pomodoro') {
                    this.advancePomodoroPhase(session);
                } else {
                    this.triggerAlarm(session);
                }
            }
        });
    }

    triggerAlarm(session) {
        this.currentAlarmSession = session;

        this.pauseOtherMedia();
        this.showAlarmModal(session);
        this.startAlarmSound(session);
        this.sendNotification(session.name);

        this.alarmTimeout = setTimeout(() => {
            this.dismissAlarm();
        }, 60 * 60 * 1000);
    }

    pauseOtherMedia() {
        document.querySelectorAll('audio, video').forEach(el => {
            if (!el.paused) el.pause();
        });

        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.playbackState = 'playing';
            } catch (e) {}
        }
    }

    getPopupFavicon() {
        return '<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⏰</text></svg>">';
    }

    getPopupBaseStyles() {
        return `*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:12px;overflow-x:hidden}
.card{background:rgba(255,255,255,0.08);padding:12px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;border-left:4px solid #00d9ff;margin-bottom:8px}
.card.timer{border-left-color:#00ff88}
.card.reminder{border-left-color:#ff9500}
.card.pomodoro{border-left-color:#ff4444}
.card.phase-work{border-left-color:#ff4444}
.card.phase-break{border-left-color:#00ff88}
.card.phase-longBreak{border-left-color:#4488ff}
.name{font-weight:600;font-size:.95rem;margin-bottom:2px}
.meta{font-size:.75rem;color:#888}
.type{padding:2px 8px;border-radius:4px;font-size:.65rem;font-weight:700;text-transform:uppercase}
.type.timer{background:rgba(0,255,136,0.15);color:#00ff88}
.type.reminder{background:rgba(255,149,0,0.15);color:#ff9500}
.type.pomodoro{background:rgba(255,68,68,0.15);color:#ff4444}
.pomo-stats{font-size:.85rem;color:#666;flex:0 0 100%;text-align:center;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.08)}
.countdown{font-size:1.3rem;font-weight:700;color:#00d9ff;font-family:'Courier New',monospace;white-space:nowrap}
.session-description{width:100%;text-align:center;font-size:.85rem;color:#aaa;max-height:4em;overflow-y:auto;white-space:pre-wrap;word-break:break-word;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;margin-top:8px;line-height:1.35}
.empty{text-align:center;color:#555;padding:20px;font-style:italic}
h2{font-size:1rem;color:#aaa;margin-bottom:10px;display:flex;align-items:center;gap:6px}`;
    }

    buildSessionCardHtml(session) {
        const remaining = session.targetTime - Date.now();
        const descriptionHtml = session.description ? `<div class="session-description">${this.escapeHtml(session.description)}</div>` : '';

        if (session.type === 'pomodoro') {
            const phaseLabels = { work: 'Work', break: 'Break', longBreak: 'Long Break' };
            const phaseLabel = phaseLabels[session.phase];
            const untilLongBreak = session.sessionsPerCycle - session.currentSession;
            return `<div class="card pomodoro phase-${session.phase}">
<div class="pomo-stats">Session ${session.currentSession}/${session.sessionsPerCycle} · Cycle ${session.currentCycle}/${session.totalCycles} · ${session.completedSessions} done · ${untilLongBreak} until long break</div>
<div style="display:flex;justify-content:space-between;align-items:center;width:100%"><div><div class="name">${this.escapeHtml(session.name)}</div>
<div class="meta"><span class="type pomodoro">POMODORO</span> ${phaseLabel}</div></div>
<div class="countdown">${this.formatTimeRemaining(remaining)}</div></div>
${descriptionHtml}</div>`;
        }

        return `<div class="card ${session.type}">
<div><div class="name">${this.escapeHtml(session.name)}</div>
<div class="meta"><span class="type ${session.type}">${session.type.toUpperCase()}</span></div></div>
<div class="countdown">${this.formatTimeRemaining(remaining)}</div>
${descriptionHtml}</div>`;
    }

    popoutSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        const popup = window.open('', `session_${sessionId}`,
            'width=380,height=120,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no');
        if (!popup || popup.closed) return;

        popup.document.write(`<!DOCTYPE html><html><head><title>${this.escapeHtml(session.name)}</title>
${this.getPopupFavicon()}
<style>${this.getPopupBaseStyles()}body{display:flex;align-items:center;height:100vh;padding:12px}</style></head>
<body><div style="width:100%">${this.buildSessionCardHtml(session)}</div></body></html>`);
        popup.document.close();

        if (!this.sessionPopups) this.sessionPopups = new Map();
        this.sessionPopups.set(sessionId, popup);
    }

    popoutAllSessions() {
        const popup = window.open('', 'all_sessions',
            'width=420,height=350,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no');
        if (!popup || popup.closed) return;

        const html = this.sessions.length === 0
            ? '<div class="empty">No active sessions</div>'
            : [...this.sessions].sort((a, b) => a.targetTime - b.targetTime)
                .map(s => this.buildSessionCardHtml(s)).join('');

        popup.document.write(`<!DOCTYPE html><html><head><title>Active Sessions</title>
${this.getPopupFavicon()}
<style>${this.getPopupBaseStyles()}</style></head>
<body><h2>Active Sessions (${this.sessions.length})</h2>${html}</body></html>`);
        popup.document.close();

        this.allSessionsPopup = popup;
    }

    updateSessionPopups() {
        // Update individual session popups
        if (this.sessionPopups) {
            for (const [id, popup] of this.sessionPopups) {
                if (popup.closed) { this.sessionPopups.delete(id); continue; }
                const session = this.sessions.find(s => s.id === id);
                if (!session) { popup.close(); this.sessionPopups.delete(id); continue; }
                const container = popup.document.body.querySelector('div');
                if (container) container.innerHTML = this.buildSessionCardHtml(session);
            }
        }

        // Update all-sessions popup
        if (this.allSessionsPopup && !this.allSessionsPopup.closed) {
            const sorted = [...this.sessions].sort((a, b) => a.targetTime - b.targetTime);
            const html = this.sessions.length === 0
                ? '<div class="empty">No active sessions</div>'
                : sorted.map(s => this.buildSessionCardHtml(s)).join('');
            this.allSessionsPopup.document.body.innerHTML =
                `<h2>Active Sessions (${this.sessions.length})</h2>${html}`;
        }
    }

    showAlarmModal(session) {
        this.alarmActive = true;
        document.title = '⏰ ALARM! - ' + session.name;

        const popupWidth = 420;
        const popupHeight = 340;
        const left = (screen.width - popupWidth) / 2;
        const top = (screen.height - popupHeight) / 2;

        const popupHtml = `<!DOCTYPE html>
<html><head><title>ALARM!</title>
${this.getPopupFavicon()}
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}
.wrap{text-align:center;padding:24px;width:100%}
.icon{font-size:4rem;animation:bounce .4s infinite alternate}
@keyframes bounce{from{transform:scale(1)}to{transform:scale(1.15)}}
h2{font-size:1.8rem;color:#ff4444;margin:8px 0}
.name{font-size:1.1rem;margin-bottom:20px;word-break:break-word;color:#ccc}
.controls{display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap}
.dismiss{padding:12px 30px;border:none;border-radius:8px;background:#ff4444;color:#fff;
font-size:1rem;font-weight:600;cursor:pointer;transition:all .2s}
.dismiss:hover{background:#ff6666;transform:scale(1.05)}
.snooze-wrap{display:flex;align-items:center;gap:6px}
.snooze-wrap input{width:55px;padding:10px 6px;border:2px solid #00d9ff;border-radius:6px;
background:rgba(0,217,255,0.1);color:#fff;font-size:1rem;text-align:center}
.snooze-wrap input:focus{outline:none;background:rgba(0,217,255,0.2)}
.snooze{padding:12px 20px;border:2px solid #00d9ff;border-radius:8px;background:transparent;
color:#00d9ff;font-size:1rem;font-weight:600;cursor:pointer;transition:all .2s}
.snooze:hover{background:rgba(0,217,255,0.2)}
</style></head><body>
<div class="wrap">
<div class="icon">⏰</div>
<h2>Time's Up!</h2>
<div class="name">${this.escapeHtml(session.name)}</div>
<div class="controls">
<button class="dismiss" onclick="dismiss()">Dismiss</button>
<div class="snooze-wrap">
<input type="number" id="mins" min="1" max="999" value="5">
<button class="snooze" onclick="snooze()">Snooze</button>
</div></div></div>
<script>
function dismiss(){
  if(window.opener) window.opener.postMessage({action:'alarm-dismiss'},'*');
  window.close();
}
function snooze(){
  var m=parseInt(document.getElementById('mins').value)||5;
  if(window.opener) window.opener.postMessage({action:'alarm-snooze',minutes:m},'*');
  window.close();
}
</script></body></html>`;

        this.alarmPopup = window.open('', 'alarm_popup',
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=no,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`);

        if (this.alarmPopup && !this.alarmPopup.closed) {
            this.alarmPopup.document.write(popupHtml);
            this.alarmPopup.document.close();
            this.alarmPopup.focus();
        } else {
            // Fallback to in-page modal if popup blocked
            this.alarmTask.textContent = session.name;
            this.alarmModal.classList.add('active');
        }
    }

    hideAlarmModal() {
        this.alarmActive = false;
        this.alarmModal.classList.remove('active');
        if (this.alarmPopup && !this.alarmPopup.closed) {
            this.alarmPopup.close();
        }
        this.alarmPopup = null;
        document.title = 'ONE reminder';
    }

    async startAlarmSound(session) {
        this.stopAlarmSound();

        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        if (session.soundType === 'custom' && session.customSound) {
            await this.loadCustomSound(session.customSound);
        }

        this.playAlarmLoop(session);
    }

    async loadCustomSound(dataUrl) {
        try {
            const response = await fetch(dataUrl);
            const arrayBuffer = await response.arrayBuffer();
            this.customAudioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        } catch (err) {
            console.error('Failed to load custom sound:', err);
            this.customAudioBuffer = null;
        }
    }

    playAlarmLoop(session) {
        if (!this.alarmActive) return;

        const volume = session.volume || 0.5;

        if (session.soundType === 'custom' && this.customAudioBuffer) {
            this.playCustomSoundLoop(volume);
        } else {
            this.playBuiltInSoundLoop(session.soundType, volume);
        }
    }

    playCustomSoundLoop(volume) {
        if (!this.customAudioBuffer || !this.alarmActive) return;

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = this.customAudioBuffer;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        gainNode.gain.value = volume;

        source.loop = true;
        source.start(0);

        this.alarmAudioSource = source;
    }

    playBuiltInSoundLoop(soundType, volume) {
        if (!this.alarmActive) return;

        const playOnce = () => {
            if (!this.alarmActive) return;

            switch (soundType) {
                case 'light':
                    this.playLightAlarm(volume);
                    break;
                case 'strong':
                default:
                    this.playStrongAlarm(volume);
                    break;
                case 'school':
                    this.playSchoolBell(volume);
                    break;
                case 'siren':
                    this.playSiren(volume);
                    break;
            }
        };

        playOnce();

        const durations = { light: 1000, strong: 1200, school: 2000, siren: 2500 };
        const duration = durations[soundType] || 1200;

        this.alarmAudioSource = setInterval(playOnce, duration);
    }

    playLightAlarm(volume = 0.5) {
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3 * volume, now + i * 0.25);
            gain.gain.setValueAtTime(0.3 * volume, now + i * 0.25 + 0.2);
            gain.gain.linearRampToValueAtTime(0, now + i * 0.25 + 0.25);
            osc.start(now + i * 0.25);
            osc.stop(now + i * 0.25 + 0.25);
        }
    }

    playStrongAlarm(volume = 0.5) {
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        for (let i = 0; i < 6; i++) {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            const freq = i % 2 === 0 ? 800 : 1000;
            osc1.frequency.value = freq;
            osc2.frequency.value = freq + 3;
            osc1.type = 'square';
            osc2.type = 'square';

            const t = now + i * 0.2;
            gain.gain.setValueAtTime(0.7 * volume, t);
            gain.gain.setValueAtTime(0.7 * volume, t + 0.19);
            gain.gain.linearRampToValueAtTime(0, t + 0.2);

            osc1.start(t);
            osc1.stop(t + 0.2);
            osc2.start(t);
            osc2.stop(t + 0.2);
        }
    }

    playSchoolBell(volume = 0.5) {
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        for (let ring = 0; ring < 4; ring++) {
            const baseTime = now + ring * 0.5;
            const frequencies = [523, 659, 784, 1047, 1319];

            frequencies.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.frequency.value = freq;
                osc.type = 'sine';

                const harmonicVolume = (volume / (i + 1)) * 0.8;
                gain.gain.setValueAtTime(harmonicVolume, baseTime);
                gain.gain.exponentialRampToValueAtTime(0.01, baseTime + 0.45);

                osc.start(baseTime);
                osc.stop(baseTime + 0.5);
            });

            const noise = ctx.createOscillator();
            const noiseGain = ctx.createGain();
            noise.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.frequency.value = 2000;
            noise.type = 'triangle';
            noiseGain.gain.setValueAtTime(0.4 * volume, baseTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, baseTime + 0.05);
            noise.start(baseTime);
            noise.stop(baseTime + 0.06);
        }
    }

    playSiren(volume = 0.5) {
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const duration = 2.4;

        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc2.type = 'sawtooth';

        for (let i = 0; i < 5; i++) {
            const t = now + i * 0.5;
            osc.frequency.setValueAtTime(400, t);
            osc.frequency.linearRampToValueAtTime(800, t + 0.25);
            osc.frequency.linearRampToValueAtTime(400, t + 0.5);
            osc2.frequency.setValueAtTime(402, t);
            osc2.frequency.linearRampToValueAtTime(804, t + 0.25);
            osc2.frequency.linearRampToValueAtTime(402, t + 0.5);
        }

        gain.gain.setValueAtTime(0.8 * volume, now);
        gain.gain.setValueAtTime(0.8 * volume, now + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        osc.start(now);
        osc.stop(now + duration);
        osc2.start(now);
        osc2.stop(now + duration);
    }

    testSound() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const volume = parseInt(this.volumeSlider.value) / 100;
        const soundType = this.soundType.value;

        if (soundType === 'custom' && this.customAudioBuffer) {
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            source.buffer = this.customAudioBuffer;
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            gainNode.gain.value = volume;
            source.start(0);
            setTimeout(() => source.stop(), 3000);
        } else {
            switch (soundType) {
                case 'light':
                    this.playLightAlarm(volume);
                    break;
                case 'strong':
                default:
                    this.playStrongAlarm(volume);
                    break;
                case 'school':
                    this.playSchoolBell(volume);
                    break;
                case 'siren':
                    this.playSiren(volume);
                    break;
            }
        }
    }

    stopAlarmSound() {
        if (this.alarmAudioSource) {
            if (typeof this.alarmAudioSource === 'number') {
                clearInterval(this.alarmAudioSource);
            } else if (this.alarmAudioSource.stop) {
                try { this.alarmAudioSource.stop(); } catch (e) {}
            }
            this.alarmAudioSource = null;
        }
        if (this.alarmTimeout) {
            clearTimeout(this.alarmTimeout);
            this.alarmTimeout = null;
        }
    }

    dismissAlarm() {
        this.stopAlarmSound();
        this.hideAlarmModal();

        if (this.currentAlarmSession) {
            this.addToHistory(this.currentAlarmSession);
            this.deleteSession(this.currentAlarmSession.id);
            this.currentAlarmSession = null;
        }
    }

    snoozeAlarm() {
        if (!this.currentAlarmSession) return;

        const minutes = parseInt(this.snoozeMinutes.value) || 5;

        this.stopAlarmSound();
        this.hideAlarmModal();

        const session = this.sessions.find(s => s.id === this.currentAlarmSession.id);
        if (session) {
            session.triggered = false;
            session.snoozeCount++;
            session.targetTime = Date.now() + minutes * 60 * 1000;
            this.saveSessions();
            this.renderSessions();
        }

        this.currentAlarmSession = null;
    }

    sendNotification(name) {
        if (Notification.permission === 'granted') {
            const notification = new Notification('⏰ One Reminder', {
                body: `Time's up: ${name}`,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>',
                requireInteraction: true,
                tag: 'one-reminder-alarm',
                renotify: true
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }
    }

    requestNotificationPermission() {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                this.notificationPermission = permission;
                this.updateNotificationButton();
            });
        } else {
            alert('Notifications not supported');
        }
    }

    updateNotificationButton() {
        if (this.notificationPermission === 'granted') {
            this.notificationBtn.textContent = 'Notifications Enabled';
            this.notificationBtn.classList.add('enabled');
        } else if (this.notificationPermission === 'denied') {
            this.notificationBtn.textContent = 'Notifications Blocked';
            this.notificationBtn.style.opacity = '0.5';
        } else {
            this.notificationBtn.textContent = 'Enable Notifications';
        }
    }

    saveSessions() {
        const toSave = this.sessions.map(s => ({
            ...s,
            customSound: s.customSound ? 'stored' : null
        }));
        localStorage.setItem('oneReminder_sessions', JSON.stringify(toSave));
        localStorage.setItem('oneReminder_nextId', this.nextId.toString());

        const customSounds = {};
        this.sessions.forEach(s => {
            if (s.customSound && s.customSound !== 'stored') {
                customSounds[s.id] = { data: s.customSound, name: s.customSoundName };
            }
        });
        if (Object.keys(customSounds).length > 0) {
            try {
                localStorage.setItem('oneReminder_customSounds', JSON.stringify(customSounds));
            } catch (e) {
                console.warn('Custom sounds too large to store');
            }
        }
    }

    saveRecentTimers() {
        localStorage.setItem('oneReminder_recentTimers', JSON.stringify(this.recentTimers));
    }

    saveHistory() {
        localStorage.setItem('oneReminder_history', JSON.stringify(this.history));
    }

    loadData() {
        try {
            const savedSessions = localStorage.getItem('oneReminder_sessions');
            const savedId = localStorage.getItem('oneReminder_nextId');
            const savedTimers = localStorage.getItem('oneReminder_recentTimers');
            const savedCustomSounds = localStorage.getItem('oneReminder_customSounds');
            const savedHistory = localStorage.getItem('oneReminder_history');

            if (savedSessions) {
                this.sessions = JSON.parse(savedSessions);
                this.sessions = this.sessions.filter(s => !s.triggered);

                if (savedCustomSounds) {
                    const customSounds = JSON.parse(savedCustomSounds);
                    this.sessions.forEach(s => {
                        if (s.customSound === 'stored' && customSounds[s.id]) {
                            s.customSound = customSounds[s.id].data;
                            s.customSoundName = customSounds[s.id].name;
                        }
                    });
                }
            }

            if (savedId) {
                this.nextId = parseInt(savedId);
            }

            if (savedTimers) {
                this.recentTimers = JSON.parse(savedTimers);
            }

            if (savedHistory) {
                this.history = JSON.parse(savedHistory);
            }
        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }
}

const app = new ReminderApp();

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && app.alarmActive && app.currentAlarmSession) {
        app.startAlarmSound(app.currentAlarmSession);
    }
});

window.addEventListener('message', (e) => {
    if (!e.data || !e.data.action) return;
    if (e.data.action === 'alarm-dismiss') {
        app.dismissAlarm();
    } else if (e.data.action === 'alarm-snooze') {
        app.snoozeMinutes.value = e.data.minutes || 5;
        app.snoozeAlarm();
    }
});
