// One Reminder - Main Application

class ReminderApp {
    constructor() {
        this.reminders = [];
        this.nextId = 1;
        this.audioContext = null;
        this.notificationPermission = Notification.permission;

        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.setDefaultDateTime();
        this.loadReminders();
        this.updateNotificationButton();
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
        this.alarmSound = document.getElementById('alarmSound');
        this.tabBtns = document.querySelectorAll('.tab-btn');
    }

    bindEvents() {
        this.addDatetimeBtn.addEventListener('click', () => this.addDatetimeReminder());
        this.addCountdownBtn.addEventListener('click', () => this.addCountdownReminder());
        this.notificationBtn.addEventListener('click', () => this.requestNotificationPermission());

        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Enter key support
        this.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const activeTab = document.querySelector('.tab-content.active').id;
                if (activeTab === 'datetime-tab') {
                    this.addDatetimeReminder();
                } else {
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
            triggered: false
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

        const targetTime = Date.now() + totalSeconds * 1000;

        const reminder = {
            id: this.nextId++,
            task,
            targetTime,
            type: 'countdown',
            triggered: false
        };

        this.reminders.push(reminder);
        this.saveReminders();
        this.renderReminders();
        this.taskInput.value = '';
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

            return `
                <div class="reminder-card ${alertingClass}" data-id="${reminder.id}">
                    <div class="reminder-info">
                        <div class="reminder-task">${this.escapeHtml(reminder.task)}</div>
                        <div class="reminder-time">
                            ${reminder.type === 'datetime' ? this.formatDateTime(reminder.targetTime) : 'Countdown Timer'}
                        </div>
                    </div>
                    <div class="reminder-countdown ${countdownClass}">
                        ${this.formatTimeRemaining(remaining)}
                    </div>
                    <button class="delete-btn" onclick="app.deleteReminder(${reminder.id})">×</button>
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
        // Play sound
        this.playAlarmSound();

        // Send notification
        this.sendNotification(reminder.task);

        // Auto-delete after 10 seconds
        setTimeout(() => {
            this.deleteReminder(reminder.id);
        }, 10000);
    }

    playAlarmSound() {
        // Create audio context for better alarm
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Play a beep sequence
        const playBeep = (time, frequency) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, time);
            gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

            oscillator.start(time);
            oscillator.stop(time + 0.3);
        };

        const now = this.audioContext.currentTime;
        // Play 3 beeps
        playBeep(now, 880);
        playBeep(now + 0.4, 880);
        playBeep(now + 0.8, 1100);

        // Repeat after 2 seconds
        setTimeout(() => {
            if (this.audioContext) {
                const t = this.audioContext.currentTime;
                playBeep(t, 880);
                playBeep(t + 0.4, 880);
                playBeep(t + 0.8, 1100);
            }
        }, 2000);
    }

    sendNotification(task) {
        if (Notification.permission === 'granted') {
            const notification = new Notification('One Reminder', {
                body: `Time's up: ${task}`,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>',
                requireInteraction: true,
                tag: 'one-reminder-' + Date.now()
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

    loadReminders() {
        try {
            const saved = localStorage.getItem('oneReminder_reminders');
            const savedId = localStorage.getItem('oneReminder_nextId');

            if (saved) {
                this.reminders = JSON.parse(saved);
                // Filter out expired reminders that were triggered
                this.reminders = this.reminders.filter(r => !r.triggered);
            }

            if (savedId) {
                this.nextId = parseInt(savedId);
            }

            this.renderReminders();
        } catch (e) {
            console.error('Failed to load reminders:', e);
        }
    }
}

// Initialize app
const app = new ReminderApp();
