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
    }

    bindElements() {
        this.eventName = document.getElementById('eventName');
        this.eventType = document.getElementById('eventType');
        this.timerOptions = document.getElementById('timerOptions');
        this.reminderOptions = document.getElementById('reminderOptions');
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

        this.alarmModal = document.getElementById('alarmModal');
        this.alarmTask = document.getElementById('alarmTask');
        this.dismissBtn = document.getElementById('dismissAlarm');
        this.snoozeBtn = document.getElementById('snoozeAlarm');
        this.snoozeMinutes = document.getElementById('snoozeMinutes');
    }

    bindEvents() {
        this.eventType.addEventListener('change', () => this.toggleEventType());
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

    toggleEventType() {
        const isTimer = this.eventType.value === 'timer';
        this.timerOptions.classList.toggle('hidden', !isTimer);
        this.reminderOptions.classList.toggle('hidden', isTimer);
        this.addEventBtn.textContent = isTimer ? 'Start Timer' : 'Set Reminder';
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
        const name = this.eventName.value.trim() || (this.eventType.value === 'timer' ? 'Timer' : 'Reminder');
        const type = this.eventType.value;
        const soundSettings = this.getCurrentSoundSettings();

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
        this.soundType.value = 'school';
        this.customSoundUpload.classList.add('hidden');
        this.volumeSlider.value = 25;
        this.volumeDisplay.textContent = '25%';
        this.customAudioData = null;
        this.customAudioBuffer = null;
        this.fileName.textContent = 'No file selected';
        this.soundFile.value = '';
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
        const soundSettings = this.getCurrentSoundSettings();

        const session = {
            id: this.nextId++,
            name,
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

        this.addRecentTimer(hours, minutes, seconds);
    }

    repeatSession(id) {
        const session = this.sessions.find(s => s.id === id);
        if (!session || !session.originalDuration) return;

        const newSession = {
            id: this.nextId++,
            name: session.name,
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
        // Only add reminders to history, not timers
        if (session.type !== 'reminder') return;

        const historyItem = {
            id: session.id,
            name: session.name,
            type: session.type,
            setTime: session.targetTime,
            completedAt: Date.now()
        };

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
            const countdownClass = remaining <= 60000 ? 'critical' : remaining <= 300000 ? 'warning' : '';
            const typeClass = session.type;

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
                        <div class="session-countdown ${countdownClass}">
                            ${this.formatTimeRemaining(remaining)}
                        </div>
                        <button class="delete-btn" onclick="app.deleteSession(${session.id})">×</button>
                    </div>
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
            return `
                <div class="history-card reminder">
                    <div class="history-info">
                        <div class="history-name">${this.escapeHtml(item.name)}</div>
                        <div class="history-meta">
                            ${this.formatDateTime(item.setTime)} · ${this.formatTimeAgo(item.completedAt)}
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
        }, 1000);
    }

    checkSessions() {
        const now = Date.now();

        this.sessions.forEach(session => {
            if (!session.triggered && now >= session.targetTime) {
                session.triggered = true;
                this.triggerAlarm(session);
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

    showAlarmModal(session) {
        this.alarmTask.textContent = session.name;
        this.alarmModal.classList.add('active');
        document.title = '⏰ ALARM! - ' + session.name;
    }

    hideAlarmModal() {
        this.alarmModal.classList.remove('active');
        document.title = 'One Reminder';
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
        if (!this.alarmModal.classList.contains('active')) return;

        const volume = session.volume || 0.5;

        if (session.soundType === 'custom' && this.customAudioBuffer) {
            this.playCustomSoundLoop(volume);
        } else {
            this.playBuiltInSoundLoop(session.soundType, volume);
        }
    }

    playCustomSoundLoop(volume) {
        if (!this.customAudioBuffer || !this.alarmModal.classList.contains('active')) return;

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
        if (!this.alarmModal.classList.contains('active')) return;

        const playOnce = () => {
            if (!this.alarmModal.classList.contains('active')) return;

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
    if (document.visibilityState === 'visible' && app.alarmModal.classList.contains('active') && app.currentAlarmSession) {
        app.startAlarmSound(app.currentAlarmSession);
    }
});
