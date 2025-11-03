document.addEventListener('DOMContentLoaded', () => {
    // --- Defensive Element References ---
    const getEl = (id) => document.getElementById(id);

    const menuBtn = getEl('menu-btn');
    const closeMenuBtn = getEl('close-menu-btn');
    const mottoInput = getEl('motto-input');
    const taskList = getEl('task-list');
    const emptyState = getEl('empty-state');
    const addTaskBtn = getEl('add-task-btn');
    const openSettingsBtn = getEl('open-settings-btn');
    const openAnalysisBtn = getEl('open-analysis-btn');
    const searchBar = getEl('search-bar');
    const loginView = getEl('login-view');
    const usernameInput = getEl('username-input');
    const passwordInput = getEl('password-input');
    const authTitle = getEl('auth-title');
    const authBtn = getEl('auth-btn');
    const authToggleLink = getEl('auth-toggle-link');
    const profileView = getEl('profile-view');
    const currentUserDisplay = getEl('current-user-display');
    const logoutBtn = getEl('logout-btn');
    const mainApp = getEl('main-app');
    const body = document.body;

    const monthYearHeader = getEl('month-year-header');
    const calendarDaysGrid = getEl('calendar-days-grid');
    const prevMonthBtn = getEl('prev-month-btn');
    const nextMonthBtn = getEl('next-month-btn');
    const todayBtn = getEl('today-btn');
    const jumpToDateBtn = getEl('jump-to-date-btn');
    const toggleCalendarBtn = getEl('toggle-calendar-btn');
    const calendarBody = getEl('calendar-body');
    const selectedDateDisplay = getEl('selected-date-display');
    const datePicker = getEl('date-picker');

    const taskModal = getEl('task-modal');
    const modalTitle = getEl('modal-title');
    const taskForm = getEl('task-form');
    const cancelBtn = getEl('cancel-btn');
    const editTaskDateContainer = getEl('edit-task-date-container');
    const editTaskDateInput = getEl('edit-task-date');
    const deleteConfirmModal = getEl('delete-confirm-modal');
    const cancelDeleteBtn = getEl('cancel-delete-btn');
    const confirmDeleteBtn = getEl('confirm-delete-btn');
    const completeConfirmModal = getEl('complete-confirm-modal');
    const cancelCompleteBtn = getEl('cancel-complete-btn');
    const confirmCompleteBtn = getEl('confirm-complete-btn');
    const jumpToDateModal = getEl('jump-to-date-modal');
    const jumpMonthSelect = getEl('jump-month');
    const jumpDaySelect = getEl('jump-day');
    const jumpYearInput = getEl('jump-year');
    const cancelJumpBtn = getEl('cancel-jump-btn');
    const goToDateBtn = getEl('go-to-date-btn');
    const settingsModal = getEl('settings-modal');
    const closeSettingsBtn = getEl('close-settings-btn');
    const enableNotificationsToggle = getEl('enable-notifications');
    const hourlyReminderToggle = getEl('hourly-reminder');
    const dailySummaryToggle = getEl('daily-summary');
    const dailySummaryTimeContainer = getEl('daily-summary-time-container');
    const dailySummaryTimeInput = getEl('daily-summary-time');
    const themeSelector = getEl('theme-selector');
    const accentColorSelector = getEl('accent-color-selector');
    const fontSizeSelector = getEl('font-size-selector');
    const deleteAllDataBtn = getEl('delete-all-data-btn');
    const deleteDataConfirmModal = getEl('delete-data-confirm-modal');
    const cancelDeleteDataBtn = getEl('cancel-delete-data-btn');
    const confirmDeleteDataBtn = getEl('confirm-delete-data-btn');
    const deleteConfirmInput = getEl('delete-confirm-input');
    const analysisModal = getEl('analysis-modal');
    const closeAnalysisBtn = getEl('close-analysis-btn');
    const completedCountEl = getEl('completed-count');
    const overdueCountEl = getEl('overdue-count');
    const totalCountEl = getEl('total-count');
    const completionRateEl = getEl('completion-rate');
    const productivityChartCanvas = getEl('productivity-chart');
    const themeToggle = getEl('theme-toggle');

    // --- State Management ---
    let tasks = {};
    let currentDate = new Date();
    let currentTaskId = null;
    let taskIdToDelete = null;
    let taskIdToComplete = null;
    let originalTaskDate = null;
    let productivityChart = null;
    let currentUser = null;
    let isLoginMode = true;
    let settings = {};

    const defaultSettings = {
        notificationsEnabled: true,
        dailySummaryEnabled: false,
        dailySummaryTime: "08:00",
        hourlyReminderEnabled: false,
        theme: "system",
        accentColor: "blue",
        fontSize: "medium",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    // --- User & API Functions ---
    const handleAuth = async () => {
        if (!usernameInput || !passwordInput) return;
        const username = usernameInput.value.trim().toLowerCase();
        const password = passwordInput.value;
        if (!username || !password) return alert('Please enter both a username and password.');
        const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'An error occurred.');
            if (isLoginMode) {
                await login(data.username);
            } else {
                alert(data.message);
                toggleAuthMode();
            }
        } catch (error) {
            alert(error.message);
        }
    };

    const login = async (username) => {
        if (!username) return;
        currentUser = username;
        localStorage.setItem('nextlyUser', currentUser);

        if (body) body.classList.add('logged-in');
        if (currentUserDisplay) currentUserDisplay.textContent = currentUser;
        if (loginView) loginView.classList.add('hidden');
        if (profileView) profileView.classList.remove('hidden');

        if (typeof Android !== "undefined" && Android.registerFCMToken) {
            Android.registerFCMToken(currentUser);
        }

        await loadAllUserData();
        await saveSettingsToServer(); // Crucial to send timezone on first login
        closeMenu();
    };

    const logout = () => {
        currentUser = null;
        localStorage.clear();
        tasks = {};

        if (body) body.classList.remove('logged-in');
        if (currentUserDisplay) currentUserDisplay.textContent = '';
        if (loginView) loginView.classList.remove('hidden');
        if (profileView) profileView.classList.add('hidden');
        if (!isLoginMode) toggleAuthMode();

        loadAllUserData();
    };

    const loadAllUserData = async () => {
        await loadSettings();
        loadMotto();
        await loadTasksForCurrentUser();
        updateUIForNewDate();
    };

    const loadTasksForCurrentUser = async () => {
        if (!currentUser) {
            tasks = {};
            return;
        }
        try {
            const response = await fetch(`/api/tasks/${currentUser}`);
            const serverTasks = await response.json();
            tasks = {};
            serverTasks.forEach(task => {
                const taskDate = task.date;
                if (!tasks[taskDate]) tasks[taskDate] = [];
                tasks[taskDate].push({ ...task, id: task._id });
            });
        } catch (error) {
            console.error('Failed to load tasks:', error);
            tasks = {};
        }
    };

    const toggleAuthMode = () => {
        isLoginMode = !isLoginMode;
        if (authTitle) authTitle.textContent = isLoginMode ? 'Login' : 'Sign Up';
        if (authBtn) authBtn.textContent = isLoginMode ? 'Login' : 'Sign Up';
        if (authToggleLink) authToggleLink.textContent = isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Login";
        if (passwordInput) passwordInput.value = '';
        if (usernameInput) usernameInput.value = '';
    };

    const formatDate = (d) => d.toISOString().split('T')[0];
    const saveMotto = () => { if (currentUser && mottoInput) localStorage.setItem(`userMotto_${currentUser}`, mottoInput.value); };
    const loadMotto = () => { if (mottoInput) mottoInput.value = currentUser ? localStorage.getItem(`userMotto_${currentUser}`) || "Your daily focus motto" : "Your daily focus motto"; };

    // --- Settings Functions ---
    const saveSettingsToServer = async () => {
        if (!currentUser) return;
        const settingsPayload = { ...settings, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        try {
            await fetch(`/api/user/${currentUser}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingsPayload)
            });
            console.log("Settings saved to server.");
        } catch (error) {
            console.error("Failed to save settings to server:", error);
        }
    };

    const loadSettings = async () => {
        if (currentUser) {
            try {
                const response = await fetch(`/api/user/${currentUser}/settings`);
                if (!response.ok) throw new Error('Failed to fetch settings');
                const serverSettings = await response.json();
                settings = { ...defaultSettings, ...serverSettings };
            } catch (error) {
                console.warn("Could not fetch settings from server, falling back to local.", error);
                const savedSettings = JSON.parse(localStorage.getItem(`nextlySettings_${currentUser}`));
                settings = { ...defaultSettings, ...savedSettings };
            }
        } else {
            settings = { ...defaultSettings };
        }
        if (currentUser) localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
        updateSettingsUI();
    };

    const updateSettingsUI = () => {
        if (!settings) return;

        if (enableNotificationsToggle) enableNotificationsToggle.checked = settings.notificationsEnabled;
        if (dailySummaryToggle) dailySummaryToggle.checked = settings.dailySummaryEnabled;
        if (dailySummaryTimeInput) dailySummaryTimeInput.value = settings.dailySummaryTime;
        if (dailySummaryTimeContainer) dailySummaryTimeContainer.classList.toggle('hidden', !settings.dailySummaryEnabled);
        if (hourlyReminderToggle) hourlyReminderToggle.checked = settings.hourlyReminderEnabled;

        if (themeSelector) {
            themeSelector.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
            const activeBtn = themeSelector.querySelector(`button[value="${settings.theme}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }
        if (accentColorSelector) {
            accentColorSelector.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
            const activeSwatch = accentColorSelector.querySelector(`.color-swatch[data-color="${settings.accentColor}"]`);
            if (activeSwatch) activeSwatch.classList.add('active');
        }
        if (fontSizeSelector) {
            fontSizeSelector.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
            const activeBtn = fontSizeSelector.querySelector(`button[value="${settings.fontSize}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }

        applyTheme(settings.theme);
        applyAccentColor(settings.accentColor);
        applyFontSize(settings.fontSize);
    };

    const applyTheme = (theme) => {
        if (!body) return;
        body.dataset.theme = theme;
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            body.classList.toggle('dark-theme', prefersDark);
            if (themeToggle) themeToggle.checked = prefersDark;
        } else {
            body.classList.toggle('dark-theme', theme === 'dark');
            if (themeToggle) themeToggle.checked = theme === 'dark';
        }
    };
    const applyAccentColor = (color) => { if (body) body.dataset.accentColor = color; };
    const applyFontSize = (size) => { if (body) body.dataset.fontSize = size; };

    // --- Analysis & Charting Functions ---
    const calculateAndDisplayStats = () => {
        if (!completedCountEl || !overdueCountEl || !totalCountEl || !completionRateEl) return;
        let totalTasks = 0, completedTasks = 0, overdueTasks = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        Object.keys(tasks).forEach(dateKey => {
            tasks[dateKey].forEach(task => {
                totalTasks++;
                const taskDate = new Date(dateKey + 'T00:00:00');
                if (task.completed) {
                    completedTasks++;
                } else if (taskDate < today) {
                    overdueTasks++;
                }
            });
        });
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        completedCountEl.textContent = completedTasks;
        overdueCountEl.textContent = overdueTasks;
        totalCountEl.textContent = totalTasks;
        completionRateEl.textContent = `${completionRate}%`;
        const last7DaysLabels = [], last7DaysData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const formattedDate = formatDate(date);
            last7DaysLabels.push(date.toLocaleDateString('default', { weekday: 'short' }));
            last7DaysData.push((tasks[formattedDate] || []).filter(task => task.completed).length);
        }
        renderProductivityChart(last7DaysLabels, last7DaysData);
    };
    const renderProductivityChart = (labels, data) => {
        if (!productivityChartCanvas) return;
        if (productivityChart) productivityChart.destroy();
        const accentColor = getComputedStyle(document.body).getPropertyValue('--primary-color');
        productivityChart = new Chart(productivityChartCanvas, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Tasks Completed', data, backgroundColor: accentColor + '80', borderColor: accentColor, borderWidth: 1, borderRadius: 5 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
        });
    };

    // --- Calendar & Task Functions ---
    const generateCalendar = (date) => {
        if (!calendarDaysGrid || !monthYearHeader) return;
        calendarDaysGrid.innerHTML = '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const month = date.getMonth(), year = date.getFullYear();
        monthYearHeader.textContent = `${date.toLocaleString('default', { month: 'long' })} ${year}`;
        const firstDayOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startingDayOfWeek = firstDayOfMonth.getDay();
        for (let i = 0; i < startingDayOfWeek; i++) calendarDaysGrid.insertAdjacentHTML('beforeend', `<div class="calendar-day not-current-month"></div>`);
        for (let i = 1; i <= daysInMonth; i++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            dayCell.textContent = i;
            const cellDate = new Date(year, month, i);
            const formattedCellDate = formatDate(cellDate);
            dayCell.dataset.date = formattedCellDate;
            if (today.getTime() === cellDate.getTime()) dayCell.classList.add('current-day');
            if (tasks[formattedCellDate]?.some(t => !t.completed)) dayCell.classList.add('day-with-task');
            if (formatDate(currentDate) === formattedCellDate) dayCell.classList.add('selected-day');
            calendarDaysGrid.appendChild(dayCell);
        }
    };
    const updateUIForNewDate = () => {
        currentDate.setHours(0, 0, 0, 0);
        if (datePicker) datePicker.value = formatDate(currentDate);
        if (selectedDateDisplay) selectedDateDisplay.textContent = currentDate.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (searchBar) searchBar.value = '';
        if (selectedDateDisplay) selectedDateDisplay.classList.remove('hidden');
        const calContainer = document.querySelector('.calendar-container');
        if (calContainer) calContainer.classList.remove('hidden');
        generateCalendar(currentDate);
        renderTasks();
    };
    const renderTasks = () => {
        if (!taskList || !emptyState || !datePicker) return;
        const selectedDate = datePicker.value;
        const tasksForDay = tasks[selectedDate] || [];
        taskList.innerHTML = '';
        const emptyStateP = emptyState.querySelector('p');
        const emptyStateSpan = emptyState.querySelector('span');
        if (emptyStateP) emptyStateP.textContent = 'All clear! Enjoy your day.';
        if (emptyStateSpan) emptyStateSpan.innerHTML = 'Add a new task to get started.';

        const uncompletedTasks = tasksForDay.filter(t => !t.completed);
        const completedTasks = tasksForDay.filter(t => t.completed);
        emptyState.classList.toggle('hidden', uncompletedTasks.length > 0);

        [...uncompletedTasks, ...completedTasks].forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'task-item';
            if (task.completed) taskElement.classList.add('completed');
            taskElement.setAttribute('data-id', task.id);
            taskElement.setAttribute('data-priority', task.priority);
            taskElement.setAttribute('draggable', !task.completed);
            taskElement.innerHTML = `<div class="task-content"><h3>${task.title}</h3><p>${task.description}</p></div>`;
            const taskContent = taskElement.querySelector('.task-content');
            if (taskContent) taskContent.addEventListener('click', () => openTaskModal(task));
            if (!task.completed) addSwipeAndDragListeners(taskElement);
            taskList.appendChild(taskElement);
        });
    };
    const renderSearchResults = (results, query) => {
        if (!taskList || !emptyState) return;
        taskList.innerHTML = '';
        const emptyStateP = emptyState.querySelector('p');
        const emptyStateSpan = emptyState.querySelector('span');
        if (results.length === 0) {
            emptyState.classList.remove('hidden');
            if (emptyStateP) emptyStateP.textContent = 'No results found';
            if (emptyStateSpan) emptyStateSpan.textContent = `No tasks match your search for "${query}".`;
        } else {
            emptyState.classList.add('hidden');
            results.forEach(task => {
                const taskElement = document.createElement('div');
                taskElement.className = 'task-item search-result';
                if (task.completed) taskElement.classList.add('completed');
                taskElement.setAttribute('data-id', task.id);
                taskElement.setAttribute('data-priority', task.priority);
                const taskDate = new Date(task.date + 'T00:00:00');
                const dateString = taskDate.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
                taskElement.innerHTML = `<div class="task-content"><h3>${task.title}</h3><p>${task.description}</p></div><div class="task-date-display">${dateString}</div>`;
                taskElement.addEventListener('click', () => {
                    currentDate = new Date(task.date + 'T00:00:00');
                    updateUIForNewDate();
                    const taskToOpen = tasks[task.date]?.find(t => t.id === task.id);
                    if (taskToOpen) openTaskModal(taskToOpen);
                    closeMenu();
                });
                taskList.appendChild(taskElement);
            });
        }
    };

    // --- Modal Management ---
    const openMenu = () => { if (body) body.classList.add('side-menu-active'); };
    const closeMenu = () => {
        if (body) body.classList.remove('side-menu-active');
        if (searchBar && searchBar.value !== '') {
            searchBar.value = '';
            updateUIForNewDate();
        }
    };
    const openTaskModal = (task = null) => {
        if (!taskForm || !modalTitle || !editTaskDateContainer || !taskModal) return;
        taskForm.reset();
        if (task) {
            modalTitle.textContent = 'Edit Task';
            currentTaskId = task.id;
            originalTaskDate = task.date;
            getEl('task-id').value = task.id;
            getEl('task-title').value = task.title;
            getEl('task-description').value = task.description;
            getEl('task-priority').value = task.priority;
            if (editTaskDateInput) editTaskDateInput.value = originalTaskDate;
            editTaskDateContainer.classList.remove('hidden');
        } else {
            modalTitle.textContent = 'Add New Task';
            currentTaskId = null;
            originalTaskDate = null;
            editTaskDateContainer.classList.add('hidden');
        }
        taskModal.classList.remove('hidden');
    };
    const closeTaskModal = () => { if (taskModal) taskModal.classList.add('hidden'); originalTaskDate = null; };
    const showDeleteConfirmModal = (taskId) => { taskIdToDelete = taskId; if (deleteConfirmModal) deleteConfirmModal.classList.remove('hidden'); };
    const hideDeleteConfirmModal = () => { if (deleteConfirmModal) deleteConfirmModal.classList.add('hidden'); taskIdToDelete = null; };
    const showCompleteConfirmModal = (taskId) => { taskIdToComplete = taskId; if (completeConfirmModal) completeConfirmModal.classList.remove('hidden'); };
    const hideCompleteConfirmModal = () => { if (completeConfirmModal) completeConfirmModal.classList.add('hidden'); taskIdToComplete = null; };
    const openSettingsModal = () => { if (settingsModal) settingsModal.classList.remove('hidden'); };
    const closeSettingsModal = () => { if (settingsModal) settingsModal.classList.add('hidden'); };
    const openAnalysisModal = () => { calculateAndDisplayStats(); if (analysisModal) analysisModal.classList.remove('hidden'); };
    const closeAnalysisModal = () => { if (analysisModal) analysisModal.classList.add('hidden'); };
    const openDeleteDataModal = () => { if (deleteDataConfirmModal) deleteDataConfirmModal.classList.remove('hidden'); };
    const closeDeleteDataModal = () => { if (deleteConfirmInput) deleteConfirmInput.value = ''; if (confirmDeleteDataBtn) confirmDeleteDataBtn.disabled = true; if (deleteDataConfirmModal) deleteDataConfirmModal.classList.add('hidden'); };
    const openJumpToDateModal = () => {
        if (!jumpMonthSelect || !jumpDaySelect || !jumpYearInput || !jumpToDateModal) return;
        if (jumpMonthSelect.children.length === 0) {
            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            months.forEach((month, index) => jumpMonthSelect.insertAdjacentHTML('beforeend', `<option value="${index}">${month}</option>`));
        }
        if (jumpDaySelect.children.length === 0) {
            for (let i = 1; i <= 31; i++) jumpDaySelect.insertAdjacentHTML('beforeend', `<option value="${i}">${i}</option>`);
        }
        jumpMonthSelect.value = currentDate.getMonth();
        jumpDaySelect.value = currentDate.getDate();
        jumpYearInput.value = currentDate.getFullYear();
        jumpToDateModal.classList.remove('hidden');
    };
    const closeJumpToDateModal = () => { if (jumpToDateModal) jumpToDateModal.classList.add('hidden'); };

    // --- Event Handlers (with safety checks) ---
    if (menuBtn) menuBtn.addEventListener('click', (e) => { e.stopPropagation(); openMenu(); });
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeMenu);
    if (mainApp) mainApp.addEventListener('click', () => { if (body && body.classList.contains('side-menu-active')) closeMenu(); });
    if (authBtn) authBtn.addEventListener('click', handleAuth);
    if (authToggleLink) authToggleLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode(); });
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (searchBar) searchBar.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query === '') {
            updateUIForNewDate();
            return;
        }
        if (selectedDateDisplay) selectedDateDisplay.classList.add('hidden');
        const calContainer = document.querySelector('.calendar-container');
        if (calContainer) calContainer.classList.add('hidden');

        const allTasks = [];
        for (const dateKey in tasks) { tasks[dateKey].forEach(task => allTasks.push({ ...task, date: dateKey })); }
        const results = allTasks.filter(task => task.title.toLowerCase().includes(query) || task.description.toLowerCase().includes(query));
        renderSearchResults(results, query);
    });
    if (themeToggle) themeToggle.addEventListener('click', () => {
        settings.theme = themeToggle.checked ? 'dark' : 'light';
        applyTheme(settings.theme);
        if (currentUser) localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
        saveSettingsToServer();
        if (themeSelector) {
            themeSelector.querySelector('.active')?.classList.remove('active');
            const activeBtn = themeSelector.querySelector(`button[value="${settings.theme}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }
    });
    if (mottoInput) mottoInput.addEventListener('change', saveMotto);
    if (addTaskBtn) addTaskBtn.addEventListener('click', () => { if (!currentUser) { alert('Please log in to add tasks.'); return; } openTaskModal(); });
    if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettingsModal);
    if (openAnalysisBtn) openAnalysisBtn.addEventListener('click', openAnalysisModal);
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updateUIForNewDate(); });
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updateUIForNewDate(); });
    if (todayBtn) todayBtn.addEventListener('click', () => { currentDate = new Date(); updateUIForNewDate(); });
    if (toggleCalendarBtn) toggleCalendarBtn.addEventListener('click', () => {
        if (calendarBody) calendarBody.classList.toggle('collapsed');
        const icon = toggleCalendarBtn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-chevron-up');
            icon.classList.toggle('fa-chevron-down');
        }
    });
    if (calendarDaysGrid) calendarDaysGrid.addEventListener('click', (e) => {
        const target = e.target.closest('.calendar-day');
        if (target && !target.classList.contains('not-current-month')) {
            currentDate.setDate(parseInt(target.textContent, 10));
            updateUIForNewDate();
        }
    });
    if (jumpToDateBtn) jumpToDateBtn.addEventListener('click', openJumpToDateModal);
    if (cancelJumpBtn) cancelJumpBtn.addEventListener('click', closeJumpToDateModal);
    if (goToDateBtn) goToDateBtn.addEventListener('click', () => {
        if (!jumpYearInput || !jumpMonthSelect || !jumpDaySelect) return;
        const year = parseInt(jumpYearInput.value, 10);
        if (!isNaN(year) && year > 1000 && year < 9999) {
            currentDate = new Date(year, parseInt(jumpMonthSelect.value, 10), parseInt(jumpDaySelect.value, 10));
            updateUIForNewDate();
            closeJumpToDateModal();
        } else {
            alert("Please enter a valid year.");
        }
    });
    if (cancelBtn) cancelBtn.addEventListener('click', closeTaskModal);
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', hideDeleteConfirmModal);
    if (cancelCompleteBtn) cancelCompleteBtn.addEventListener('click', hideCompleteConfirmModal);
    if (taskForm) taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return alert('Please log in to save tasks.');

        const taskData = {
            title: getEl('task-title').value,
            description: getEl('task-description').value,
            priority: getEl('task-priority').value
        };

        if (currentTaskId) {
            const newDate = getEl('edit-task-date').value;
            await fetch(`/api/tasks/${currentUser}/${currentTaskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...taskData, date: newDate })
            });
        } else {
            const selectedDate = getEl('date-picker').value;
            await fetch(`/api/tasks/${currentUser}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...taskData, date: selectedDate })
            });
        }
        await loadTasksForCurrentUser();
        closeTaskModal();
        updateUIForNewDate();
    });
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', async () => {
        if (!currentUser || !taskIdToDelete) return;
        await fetch(`/api/tasks/${currentUser}/${taskIdToDelete}`, { method: 'DELETE' });
        await loadTasksForCurrentUser();
        hideDeleteConfirmModal();
        updateUIForNewDate();
    });
    if (confirmCompleteBtn) confirmCompleteBtn.addEventListener('click', async () => {
        if (!currentUser || !taskIdToComplete) return;
        await fetch(`/api/tasks/${currentUser}/${taskIdToComplete}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: true })
        });
        await loadTasksForCurrentUser();
        hideCompleteConfirmModal();
        updateUIForNewDate();
    });
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettingsModal);
    if (closeAnalysisBtn) closeAnalysisBtn.addEventListener('click', closeAnalysisModal);
    if (enableNotificationsToggle) enableNotificationsToggle.addEventListener('change', (e) => {
        settings.notificationsEnabled = e.target.checked;
        if (currentUser) localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
        saveSettingsToServer();
    });
    if (dailySummaryToggle) dailySummaryToggle.addEventListener('change', (e) => {
        settings.dailySummaryEnabled = e.target.checked;
        if (dailySummaryTimeContainer) dailySummaryTimeContainer.classList.toggle('hidden', !e.target.checked);
        if (currentUser) localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
        saveSettingsToServer();
    });
    if (dailySummaryTimeInput) dailySummaryTimeInput.addEventListener('change', (e) => {
        settings.dailySummaryTime = e.target.value;
        if (currentUser) localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
        saveSettingsToServer();
    });
    if (hourlyReminderToggle) hourlyReminderToggle.addEventListener('change', (e) => {
        settings.hourlyReminderEnabled = e.target.checked;
        if (currentUser) localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
        saveSettingsToServer();
    });
    if (themeSelector) themeSelector.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button) {
            const activeBtn = themeSelector.querySelector('.active');
            if(activeBtn) activeBtn.classList.remove('active');
            button.classList.add('active');
            settings.theme = button.value;
            applyTheme(settings.theme);
            if (currentUser) localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
            saveSettingsToServer();
        }
    });
    if (accentColorSelector) accentColorSelector.addEventListener('click', (e) => {
        const swatch = e.target.closest('.color-swatch');
        if (swatch) {
            const activeSwatch = accentColorSelector.querySelector('.active');
            if (activeSwatch) activeSwatch.classList.remove('active');
            swatch.classList.add('active');
            settings.accentColor = swatch.dataset.color;
            applyAccentColor(settings.accentColor);
            if (currentUser) localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
            saveSettingsToServer();
        }
    });
    if (fontSizeSelector) fontSizeSelector.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button) {
            const activeBtn = fontSizeSelector.querySelector('.active');
            if (activeBtn) activeBtn.classList.remove('active');
            button.classList.add('active');
            settings.fontSize = button.value;
            applyFontSize(settings.fontSize);
            if (currentUser) localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
            saveSettingsToServer();
        }
    });
    if (deleteAllDataBtn) deleteAllDataBtn.addEventListener('click', openDeleteDataModal);
    if (cancelDeleteDataBtn) cancelDeleteDataBtn.addEventListener('click', closeDeleteDataModal);
    if (deleteConfirmInput) deleteConfirmInput.addEventListener('input', (e) => { if (confirmDeleteDataBtn) confirmDeleteDataBtn.disabled = e.target.value !== 'DELETE'; });
    if (confirmDeleteDataBtn) confirmDeleteDataBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        // In a real app, we'd send one request to a new route like /api/tasks/:username/all
        // This is a placeholder for that functionality
        console.log("Deleting all data...");
        // This should be replaced with a single API call to the backend
        const allTaskIds = [];
        for (const date in tasks) {
            tasks[date].forEach(task => allTaskIds.push(task.id));
        }
        await Promise.all(allTaskIds.map(id => 
            fetch(`/api/tasks/${currentUser}/${id}`, { method: 'DELETE' })
        ));
        tasks = {};
        closeDeleteDataModal();
        updateUIForNewDate();
    });
    
    // --- Drag/Drop & Swipe Handlers ---
    function addSwipeAndDragListeners(element) {
        let isDragging = false, startX, currentX, diff = 0;
        const getClientX = (e) => e.touches ? e.touches[0].clientX : e.clientX;
        const dragStart = (e) => { startX = getClientX(e); isDragging = true; element.style.transition = ''; };
        const dragMove = (e) => { 
            if (!isDragging || element.classList.contains('dragging')) return;
            currentX = getClientX(e);
            diff = currentX - startX;
            if (Math.abs(diff) > 10) element.style.transform = `translateX(${diff}px)`;
        };
        const dragEnd = () => {
            if (!isDragging) return; isDragging = false; element.style.transition = 'transform 0.3s ease';
            if (diff > 100) showCompleteConfirmModal(element.dataset.id);
            else if (diff < -100) showDeleteConfirmModal(element.dataset.id);
            element.style.transform = 'translateX(0)'; diff = 0;
        };
        element.addEventListener('touchstart', dragStart);
        element.addEventListener('touchmove', dragMove);
        element.addEventListener('touchend', dragEnd);
        element.addEventListener('mousedown', dragStart);
        element.addEventListener('mousemove', dragMove);
        element.addEventListener('mouseup', dragEnd);
        element.addEventListener('mouseleave', () => { if (isDragging) dragEnd(); });
    }

    // --- Initial App Setup ---
    const initializeApp = async () => {
        console.log("Nextly App Initializing...");
        const savedUser = localStorage.getItem('nextlyUser');
        if (savedUser) {
            await login(savedUser);
        } else {
            if (body) body.classList.remove('logged-in');
            await loadAllUserData();
        }
        console.log("Initialization Complete.");
    };

    initializeApp();
});