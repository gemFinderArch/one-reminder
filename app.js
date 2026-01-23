// One Reminder - Main Application

class ReminderApp {
    constructor() {
        this.reminders = [];
        this.nextId = 1;
        this.audioContext = null;
        this.notificationPermission = Notification.permission;
        this.activeAlarm = null;
        this.alarmInterval = null;
        this.alarmTimeout = null;
        this.currentAlarmReminder = null;

        // Settings
        this.settings = {
            soundType: 'strong',
            snoozeEnabled: true,
            snoozeInterval: 5,
            maxSnoozes: 3,
            overrideAudio: true
        };

        // Recent timers (last 8)
        this.recentTimers = [];

        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.setDefaultDateTime();
        this.loadData();
        this.updateNotificationButton();
        this.renderRecentTimers();
        this.startUpdateLoop();
    }

    bindElements() {
        this.taskInput = document.getElementById('taskInput');
        this.dateInput = document.getElementById('dateInput');
        this.timeInput = document.getElementById('timeInput');
        this.hoursInput = document.getElementById('hoursInput');
        this.minutesInput = document.getElementById('minutesInput');
        this.secondsInput = document.getElementById('secondsInput');
        this.addDatetimeBtn = document.getElementById('addDatetimeReminder');
        this.addCountdownBtn = document.getElementById('addCountdownReminder');
        this.remindersList = document.getElementById('remindersList');
        this.reminderCount = document.getElementById('reminderCount');
        this.notificationBtn = document.getElementById('enableNotifications');
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.soundBtns = document.querySelectorAll('.sound-btn');
        this.testSoundBtn = document.getElementById('testSound');
        this.snoozeEnabledCheckbox = document.getElementById('snoozeEnabled');
        this.snoozeIntervalSelect = document.getElementById('snoozeInterval');
        this.maxSnoozesSelect = document.getElementById('maxSnoozes');
        this.overrideAudioCheckbox = document.getElementById('overrideAudio');
        this.snoozeOptions = document.getElementById('snoozeOptions');
        this.recentTimersList = document.getElementById('recentTimersList');

        // Modal elements
        this.alarmModal = document.getElementById('alarmModal');
        this.alarmTask = document.getElementById('alarmTask');
        this.dismissBtn = document.getElementById('dismissAlarm');
        this.snoozeBtn = document.getElementById('snoozeAlarm');
        this.snoozeTime = document.getElementById('snoozeTime');
        this.snoozeCountDisplay = document.getElementById('snoozeCount');
    }

    bindEvents() {
        this.addDatetimeBtn.addEventListener('click', () => this.addDatetimeReminder());
        this.addCountdownBtn.addEventListener('click', () => this.addCountdownReminder());
        this.notificationBtn.addEventListener('click', () => this.requestNotificationPermission());
        this.testSoundBtn.addEventListener('click', () => this.testSound());
        this.dismissBtn.addEventListener('click', () => this.dismissAlarm());
        this.snoozeBtn.addEventListener('click', () => this.snoozeAlarm());

        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        this.soundBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectSound(btn.dataset.sound));
        });

        // Settings changes
        this.snoozeEnabledCheckbox.addEventListener('change', () => {
            this.settings.snoozeEnabled = this.snoozeEnabledCheckbox.checked;
            this.snoozeOptions.style.display = this.settings.snoozeEnabled ? 'block' : 'none';
            this.saveSettings();
        });

        this.snoozeIntervalSelect.addEventListener('change', () => {
            this.settings.snoozeInterval = parseInt(this.snoozeIntervalSelect.value);
            this.saveSettings();
        });

        this.maxSnoozesSelect.addEventListener('change', () => {
            this.settings.maxSnoozes = parseInt(this.maxSnoozesSelect.value);
            this.saveSettings();
        });

        this.overrideAudioCheckbox.addEventListener('change', () => {
            this.settings.overrideAudio = this.overrideAudioCheckbox.checked;
            this.saveSettings();
        });

        // Enter key support
        this.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const activeTab = document.querySelector('.tab-content.active').id;
                if (activeTab === 'datetime-tab') {
                    this.addDatetimeReminder();
                } else if (activeTab === 'countdown-tab') {
                    this.addCountdownReminder();
                }
            }
        });
    }

    switchTab(tabName) {
        this.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    }

    selectSound(soundType) {
        this.settings.soundType = soundType;
        this.soundBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sound === soundType);
        });
        this.saveSettings();
    }

    setDefaultDateTime() {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().slice(0, 5);

        this.dateInput.value = date;
        this.dateInput.min = date;
        this.timeInput.value = time;
    }

    addDatetimeReminder() {
        const task = this.taskInput.value.trim() || 'Reminder';
        const date = this.dateInput.value;
        const time = this.timeInput.value;

        if (!date || !time) {
            alert('Please select both date and time');
            return;
        }

        const targetTime = new Date(`${date}T${time}`);
        if (targetTime <= new Date()) {
            alert('Please select a future date and time');
            return;
        }

        const reminder = {
            id: this.nextId++,
            task,
            targetTime: targetTime.getTime(),
            type: 'datetime',
            triggered: false,
            snoozeCount: 0
        };

        this.reminders.push(reminder);
        this.saveReminders();
        this.renderReminders();
        this.taskInput.value = '';
        this.setDefaultDateTime();
    }

    addCountdownReminder() {
        const task = this.taskInput.value.trim() || 'Timer';
        const hours = parseInt(this.hoursInput.value) || 0;
        const minutes = parseInt(this.minutesInput.value) || 0;
        const seconds = parseInt(this.secondsInput.value) || 0;

        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        if (totalSeconds <= 0) {
            alert('Please set a countdown time');
            return;
        }

        // Save to recent timers
        this.addRecentTimer(hours, minutes, seconds);

        const targetTime = Date.now() + totalSeconds * 1000;

        const reminder = {
            id: this.nextId++,
            task,
            targetTime,
            type: 'countdown',
            originalDuration: totalSeconds * 1000,
            triggered: false,
            snoozeCount: 0
        };

        this.reminders.push(reminder);
        this.saveReminders();
        this.renderReminders();
        this.taskInput.value = '';
    }

    addRecentTimer(hours, minutes, seconds) {
        const timerKey = `${hours}:${minutes}:${seconds}`;

        // Remove if already exists
        this.recentTimers = this.recentTimers.filter(t =>
            !(t.hours === hours && t.minutes === minutes && t.seconds === seconds)
        );

        // Add to front
        this.recentTimers.unshift({ hours, minutes, seconds });

        // Keep only last 8
        this.recentTimers = this.recentTimers.slice(0, 8);

        this.saveRecentTimers();
        this.renderRecentTimers();
    }

    renderRecentTimers() {
        if (this.recentTimers.length === 0) {
            this.recentTimersList.innerHTML = '<span style="color:#555">No recent timers</span>';
            return;
        }

        this.recentTimersList.innerHTML = this.recentTimers.map(timer => {
            const label = this.formatTimerLabel(timer.hours, timer.minutes, timer.seconds);
            return `<button class="recent-timer-btn" onclick="app.useRecentTimer(${timer.hours}, ${timer.minutes}, ${timer.seconds})">${label}</button>`;
        }).join('');
    }

    formatTimerLabel(hours, minutes, seconds) {
        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
        return parts.join(' ');
    }

    useRecentTimer(hours, minutes, seconds) {
        this.hoursInput.value = hours;
        this.minutesInput.value = minutes;
        this.secondsInput.value = seconds;
    }

    repeatReminder(id) {
        const reminder = this.reminders.find(r => r.id === id);
        if (!reminder || reminder.type !== 'countdown' || !reminder.originalDuration) return;

        const newReminder = {
            id: this.nextId++,
            task: reminder.task,
            targetTime: Date.now() + reminder.originalDuration,
            type: 'countdown',
            originalDuration: reminder.originalDuration,
            triggered: false,
            snoozeCount: 0
        };

        this.reminders.push(newReminder);
        this.saveReminders();
        this.renderReminders();
    }

    deleteReminder(id) {
        this.reminders = this.reminders.filter(r => r.id !== id);
        this.saveReminders();
        this.renderReminders();
    }

    formatTimeRemaining(ms) {
        if (ms <= 0) return '00:00:00';

        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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

    renderReminders() {
        this.reminderCount.textContent = `(${this.reminders.length})`;

        if (this.reminders.length === 0) {
            this.remindersList.innerHTML = '<div class="empty-state">No active reminders</div>';
            return;
        }

        // Sort by target time
        const sorted = [...this.reminders].sort((a, b) => a.targetTime - b.targetTime);

        this.remindersList.innerHTML = sorted.map(reminder => {
            const remaining = reminder.targetTime - Date.now();
            const countdownClass = remaining <= 60000 ? 'critical' : remaining <= 300000 ? 'warning' : '';
            const alertingClass = reminder.triggered ? 'alerting' : '';
            const repeatBtn = reminder.type === 'countdown' && reminder.originalDuration
                ? `<button class="repeat-btn" onclick="app.repeatReminder(${reminder.id})" title="Repeat">↻</button>`
                : '';

            return `
                <div class="reminder-card ${alertingClass}" data-id="${reminder.id}">
                    <div class="reminder-info">
                        <div class="reminder-task">${this.escapeHtml(reminder.task)}</div>
                        <div class="reminder-time">
                            ${reminder.type === 'datetime' ? this.formatDateTime(reminder.targetTime) : 'Countdown Timer'}
                            ${reminder.snoozeCount > 0 ? ` (Snoozed ${reminder.snoozeCount}x)` : ''}
                        </div>
                    </div>
                    <div class="reminder-actions">
                        <div class="reminder-countdown ${countdownClass}">
                            ${this.formatTimeRemaining(remaining)}
                        </div>
                        ${repeatBtn}
                        <button class="delete-btn" onclick="app.deleteReminder(${reminder.id})">×</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    startUpdateLoop() {
        setInterval(() => {
            this.checkReminders();
            this.renderReminders();
        }, 1000);
    }

    checkReminders() {
        const now = Date.now();

        this.reminders.forEach(reminder => {
            if (!reminder.triggered && now >= reminder.targetTime) {
                reminder.triggered = true;
                this.triggerAlert(reminder);
            }
        });
    }

    triggerAlert(reminder) {
        this.currentAlarmReminder = reminder;

        // Show modal
        this.showAlarmModal(reminder);

        // Start continuous alarm sound (60 minutes max)
        this.startAlarmSound();

        // Send notification
        this.sendNotification(reminder.task);

        // Auto-stop after 60 minutes
        this.alarmTimeout = setTimeout(() => {
            this.dismissAlarm();
        }, 60 * 60 * 1000);
    }

    showAlarmModal(reminder) {
        this.alarmTask.textContent = reminder.task;
        this.snoozeTime.textContent = this.settings.snoozeInterval;

        const canSnooze = this.settings.snoozeEnabled &&
            reminder.snoozeCount < this.settings.maxSnoozes;

        this.snoozeBtn.disabled = !canSnooze;
        this.snoozeBtn.style.display = this.settings.snoozeEnabled ? 'block' : 'none';

        if (this.settings.snoozeEnabled && this.settings.maxSnoozes < 999) {
            const remaining = this.settings.maxSnoozes - reminder.snoozeCount;
            this.snoozeCountDisplay.textContent = `${remaining} snooze${remaining !== 1 ? 's' : ''} remaining`;
        } else {
            this.snoozeCountDisplay.textContent = '';
        }

        this.alarmModal.classList.add('active');
        document.title = '⏰ ALARM! - One Reminder';
    }

    hideAlarmModal() {
        this.alarmModal.classList.remove('active');
        document.title = 'One Reminder';
    }

    startAlarmSound() {
        this.stopAlarmSound();

        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Play alarm based on sound type
        const playAlarm = () => {
            if (!this.alarmModal.classList.contains('active')) return;

            switch (this.settings.soundType) {
                case 'light':
                    this.playLightAlarm();
                    break;
                case 'strong':
                    this.playStrongAlarm();
                    break;
                case 'school':
                    this.playSchoolBell();
                    break;
                case 'siren':
                    this.playSiren();
                    break;
            }
        };

        // Play immediately and repeat
        playAlarm();
        this.alarmInterval = setInterval(playAlarm, 3000);
    }

    stopAlarmSound() {
        if (this.alarmInterval) {
            clearInterval(this.alarmInterval);
            this.alarmInterval = null;
        }
        if (this.alarmTimeout) {
            clearTimeout(this.alarmTimeout);
            this.alarmTimeout = null;
        }
    }

    playLightAlarm() {
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const volume = 0.3;

        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.setValueAtTime(volume, now + i * 0.3);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.3 + 0.2);
            osc.start(now + i * 0.3);
            osc.stop(now + i * 0.3 + 0.25);
        }
    }

    playStrongAlarm() {
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const volume = 0.8;

        for (let i = 0; i < 6; i++) {
            const osc = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = i % 2 === 0 ? 800 : 1000;
            osc2.frequency.value = i % 2 === 0 ? 802 : 1003; // Slight detune for loudness
            osc.type = 'square';
            osc2.type = 'square';

            const t = now + i * 0.2;
            gain.gain.setValueAtTime(volume, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

            osc.start(t);
            osc.stop(t + 0.18);
            osc2.start(t);
            osc2.stop(t + 0.18);
        }
    }

    playSchoolBell() {
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const volume = 1.0;

        // School bell - loud metallic ring
        for (let ring = 0; ring < 4; ring++) {
            const baseTime = now + ring * 0.5;

            // Multiple harmonics for bell sound
            const frequencies = [523, 659, 784, 1047, 1319];

            frequencies.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.frequency.value = freq;
                osc.type = 'sine';

                const harmonicVolume = volume / (i + 1);
                gain.gain.setValueAtTime(harmonicVolume, baseTime);
                gain.gain.exponentialRampToValueAtTime(0.01, baseTime + 0.4);

                osc.start(baseTime);
                osc.stop(baseTime + 0.45);
            });

            // Add sharp attack
            const noise = ctx.createOscillator();
            const noiseGain = ctx.createGain();
            noise.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.frequency.value = 2000;
            noise.type = 'triangle';
            noiseGain.gain.setValueAtTime(0.5, baseTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, baseTime + 0.05);
            noise.start(baseTime);
            noise.stop(baseTime + 0.06);
        }
    }

    playSiren() {
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const duration = 2.5;
        const volume = 0.9;

        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc2.type = 'sawtooth';

        // Wailing siren effect
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.5);
        osc.frequency.linearRampToValueAtTime(400, now + 1);
        osc.frequency.linearRampToValueAtTime(800, now + 1.5);
        osc.frequency.linearRampToValueAtTime(400, now + 2);
        osc.frequency.linearRampToValueAtTime(800, now + 2.5);

        osc2.frequency.setValueAtTime(402, now);
        osc2.frequency.linearRampToValueAtTime(804, now + 0.5);
        osc2.frequency.linearRampToValueAtTime(402, now + 1);
        osc2.frequency.linearRampToValueAtTime(804, now + 1.5);
        osc2.frequency.linearRampToValueAtTime(402, now + 2);
        osc2.frequency.linearRampToValueAtTime(804, now + 2.5);

        gain.gain.setValueAtTime(volume, now);
        gain.gain.setValueAtTime(volume, now + duration - 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

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

        switch (this.settings.soundType) {
            case 'light':
                this.playLightAlarm();
                break;
            case 'strong':
                this.playStrongAlarm();
                break;
            case 'school':
                this.playSchoolBell();
                break;
            case 'siren':
                this.playSiren();
                break;
        }
    }

    dismissAlarm() {
        this.stopAlarmSound();
        this.hideAlarmModal();

        if (this.currentAlarmReminder) {
            this.deleteReminder(this.currentAlarmReminder.id);
            this.currentAlarmReminder = null;
        }
    }

    snoozeAlarm() {
        if (!this.currentAlarmReminder) return;
        if (!this.settings.snoozeEnabled) return;
        if (this.currentAlarmReminder.snoozeCount >= this.settings.maxSnoozes) return;

        this.stopAlarmSound();
        this.hideAlarmModal();

        // Update reminder with new target time
        const reminder = this.reminders.find(r => r.id === this.currentAlarmReminder.id);
        if (reminder) {
            reminder.triggered = false;
            reminder.snoozeCount++;
            reminder.targetTime = Date.now() + this.settings.snoozeInterval * 60 * 1000;
            this.saveReminders();
            this.renderReminders();
        }

        this.currentAlarmReminder = null;
    }

    sendNotification(task) {
        if (Notification.permission === 'granted') {
            const notification = new Notification('⏰ One Reminder - ALARM!', {
                body: `Time's up: ${task}`,
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
            alert('Notifications are not supported in this browser');
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

    saveReminders() {
        localStorage.setItem('oneReminder_reminders', JSON.stringify(this.reminders));
        localStorage.setItem('oneReminder_nextId', this.nextId.toString());
    }

    saveSettings() {
        localStorage.setItem('oneReminder_settings', JSON.stringify(this.settings));
    }

    saveRecentTimers() {
        localStorage.setItem('oneReminder_recentTimers', JSON.stringify(this.recentTimers));
    }

    loadData() {
        try {
            // Load reminders
            const savedReminders = localStorage.getItem('oneReminder_reminders');
            const savedId = localStorage.getItem('oneReminder_nextId');

            if (savedReminders) {
                this.reminders = JSON.parse(savedReminders);
                this.reminders = this.reminders.filter(r => !r.triggered);
            }

            if (savedId) {
                this.nextId = parseInt(savedId);
            }

            // Load settings
            const savedSettings = localStorage.getItem('oneReminder_settings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
            }

            // Load recent timers
            const savedTimers = localStorage.getItem('oneReminder_recentTimers');
            if (savedTimers) {
                this.recentTimers = JSON.parse(savedTimers);
            }

            // Apply settings to UI
            this.applySettingsToUI();
            this.renderReminders();
        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }

    applySettingsToUI() {
        // Sound type
        this.soundBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sound === this.settings.soundType);
        });

        // Snooze settings
        this.snoozeEnabledCheckbox.checked = this.settings.snoozeEnabled;
        this.snoozeIntervalSelect.value = this.settings.snoozeInterval;
        this.maxSnoozesSelect.value = this.settings.maxSnoozes;
        this.snoozeOptions.style.display = this.settings.snoozeEnabled ? 'block' : 'none';

        // Override audio
        this.overrideAudioCheckbox.checked = this.settings.overrideAudio;
    }
}

// Initialize app
const app = new ReminderApp();

// Keep page alive and prevent sleep when alarm is active
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && app.alarmModal.classList.contains('active')) {
        // Re-trigger sound when page becomes visible
        app.startAlarmSound();
    }
});
