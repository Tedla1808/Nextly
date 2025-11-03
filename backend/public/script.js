document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const menuBtn = document.getElementById('menu-btn');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const mottoInput = document.getElementById('motto-input');
    const taskList = document.getElementById('task-list');
    const emptyState = document.getElementById('empty-state');
    const addTaskBtn = document.getElementById('add-task-btn');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const openAnalysisBtn = document.getElementById('open-analysis-btn');
    const searchBar = document.getElementById('search-bar');
    const loginView = document.getElementById('login-view');
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const authTitle = document.getElementById('auth-title');
    const authBtn = document.getElementById('auth-btn');
    const authToggleLink = document.getElementById('auth-toggle-link');
    const profileView = document.getElementById('profile-view');
    const currentUserDisplay = document.getElementById('current-user-display');
    const logoutBtn = document.getElementById('logout-btn');
    const body = document.body;

    // Calendar References
    const monthYearHeader = document.getElementById('month-year-header');
    const calendarDaysGrid = document.getElementById('calendar-days-grid');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const todayBtn = document.getElementById('today-btn');
    const jumpToDateBtn = document.getElementById('jump-to-date-btn');
    const toggleCalendarBtn = document.getElementById('toggle-calendar-btn');
    const calendarBody = document.getElementById('calendar-body');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const datePicker = document.getElementById('date-picker');

    // Modal References
    const taskModal = document.getElementById('task-modal');
    const modalTitle = document.getElementById('modal-title');
    const taskForm = document.getElementById('task-form');
    const cancelBtn = document.getElementById('cancel-btn');
    const editTaskDateContainer = document.getElementById('edit-task-date-container');
    const editTaskDateInput = document.getElementById('edit-task-date');
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const completeConfirmModal = document.getElementById('complete-confirm-modal');
    const cancelCompleteBtn = document.getElementById('cancel-complete-btn');
    const confirmCompleteBtn = document.getElementById('confirm-complete-btn');
    const jumpToDateModal = document.getElementById('jump-to-date-modal');
    const jumpMonthSelect = document.getElementById('jump-month');
    const jumpDaySelect = document.getElementById('jump-day');
    const jumpYearInput = document.getElementById('jump-year');
    const cancelJumpBtn = document.getElementById('cancel-jump-btn');
    const goToDateBtn = document.getElementById('go-to-date-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const enableNotificationsToggle = document.getElementById('enable-notifications');
    const hourlyReminderToggle = document.getElementById('hourly-reminder');
    const dailySummaryToggle = document.getElementById('daily-summary');
    const dailySummaryTimeContainer = document.getElementById('daily-summary-time-container');
    const dailySummaryTimeInput = document.getElementById('daily-summary-time');
    const themeSelector = document.getElementById('theme-selector');
    const accentColorSelector = document.getElementById('accent-color-selector');
    const fontSizeSelector = document.getElementById('font-size-selector');
    const deleteAllDataBtn = document.getElementById('delete-all-data-btn');
    const deleteDataConfirmModal = document.getElementById('delete-data-confirm-modal');
    const cancelDeleteDataBtn = document.getElementById('cancel-delete-data-btn');
    const confirmDeleteDataBtn = document.getElementById('confirm-delete-data-btn');
    const deleteConfirmInput = document.getElementById('delete-confirm-input');
    const analysisModal = document.getElementById('analysis-modal');
    const closeAnalysisBtn = document.getElementById('close-analysis-btn');
    const completedCountEl = document.getElementById('completed-count');
    const overdueCountEl = document.getElementById('overdue-count');
    const totalCountEl = document.getElementById('total-count');
    const completionRateEl = document.getElementById('completion-rate');
    const productivityChartCanvas = document.getElementById('productivity-chart');

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
    let settings = {}; // Start with an empty object

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
        
        body.classList.add('logged-in'); 
        currentUserDisplay.textContent = currentUser;
        loginView.classList.add('hidden');
        profileView.classList.remove('hidden');

        if (typeof Android !== "undefined" && Android.registerFCMToken) {
            Android.registerFCMToken(currentUser);
        }
        
        await loadAllUserData();
        
        // This is now crucial to ensure timezone is sent on first login
        await saveSettingsToServer(); 
        
        closeMenu();
    };

    const logout = () => {
        currentUser = null;
        localStorage.clear(); // Clear all local storage for this app
        tasks = {};

        body.classList.remove('logged-in');
        currentUserDisplay.textContent = '';
        loginView.classList.remove('hidden');
        profileView.classList.add('hidden');
        if (!isLoginMode) toggleAuthMode();

        loadAllUserData();
    };

    const loadAllUserData = async () => {
        await loadSettings(); // Now fetches from server
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
        authTitle.textContent = isLoginMode ? 'Login' : 'Sign Up';
        authBtn.textContent = isLoginMode ? 'Login' : 'Sign Up';
        authToggleLink.textContent = isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Login";
        passwordInput.value = '';
        usernameInput.value = '';
    };

    const formatDate = (d) => d.toISOString().split('T')[0];
    const saveMotto = () => { if (currentUser) localStorage.setItem(`userMotto_${currentUser}`, mottoInput.value); };
    const loadMotto = () => { mottoInput.value = currentUser ? localStorage.getItem(`userMotto_${currentUser}`) || "Your daily focus motto" : "Your daily focus motto"; };

    // --- Settings Functions (REWRITTEN) ---
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
                // SERVER is the source of truth
                const response = await fetch(`/api/user/${currentUser}/settings`);
                const serverSettings = await response.json();
                settings = { ...defaultSettings, ...serverSettings };
            } catch (error) {
                console.warn("Could not fetch settings from server, falling back to local.", error);
                // FALLBACK to localStorage if offline
                const savedSettings = JSON.parse(localStorage.getItem(`nextlySettings_${currentUser}`));
                settings = { ...defaultSettings, ...savedSettings };
            }
        } else {
            // No user logged in, use defaults
            settings = { ...defaultSettings };
        }
        
        // Save the potentially new settings to local storage for caching
        if(currentUser) localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));

        // Update the UI with the loaded settings
        updateSettingsUI();
    };

    const updateSettingsUI = () => {
        enableNotificationsToggle.checked = settings.notificationsEnabled;
        dailySummaryToggle.checked = settings.dailySummaryEnabled;
        dailySummaryTimeInput.value = settings.dailySummaryTime;
        dailySummaryTimeContainer.classList.toggle('hidden', !settings.dailySummaryEnabled);
        hourlyReminderToggle.checked = settings.hourlyReminderEnabled;
        
        themeSelector.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
        accentColorSelector.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
        fontSizeSelector.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
        
        document.querySelector(`#theme-selector button[value="${settings.theme}"]`)?.classList.add('active');
        document.querySelector(`#accent-color-selector .color-swatch[data-color="${settings.accentColor}"]`)?.classList.add('active');
        document.querySelector(`#font-size-selector button[value="${settings.fontSize}"]`)?.classList.add('active');
        
        applyTheme(settings.theme);
        applyAccentColor(settings.accentColor);
        applyFontSize(settings.fontSize);
    };

    const applyTheme = (theme) => {
        document.body.dataset.theme = theme;
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.toggle('dark-theme', prefersDark);
            themeToggle.checked = prefersDark;
        } else {
            document.body.classList.toggle('dark-theme', theme === 'dark');
            themeToggle.checked = theme === 'dark';
        }
    };
    const applyAccentColor = (color) => document.body.dataset.accentColor = color;
    const applyFontSize = (size) => document.body.dataset.fontSize = size;
    
    // ... (All other functions like calculateAndDisplayStats, generateCalendar, renderTasks, etc., remain the same)
    
    // --- Analysis & Charting Functions ---
    const calculateAndDisplayStats = () => {
        let totalTasks = 0, completedTasks = 0, overdueTasks = 0;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        Object.keys(tasks).forEach(dateKey => {
            tasks[dateKey].forEach(task => {
                totalTasks++;
                const taskDate = new Date(dateKey + 'T00:00:00');
                if (task.completed) { completedTasks++; }
                else if (taskDate < today) { overdueTasks++; }
            });
        });
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        completedCountEl.textContent = completedTasks;
        overdueCountEl.textContent = overdueTasks;
        totalCountEl.textContent = totalTasks;
        completionRateEl.textContent = `${completionRate}%`;
        const last7DaysLabels = [], last7DaysData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(); date.setDate(date.getDate() - i);
            const formattedDate = formatDate(date);
            last7DaysLabels.push(date.toLocaleDateString('default', { weekday: 'short' }));
            last7DaysData.push((tasks[formattedDate] || []).filter(task => task.completed).length);
        }
        renderProductivityChart(last7DaysLabels, last7DaysData);
    };
    const renderProductivityChart = (labels, data) => {
        if (productivityChart) productivityChart.destroy();
        const accentColor = getComputedStyle(document.body).getPropertyValue('--primary-color');
        productivityChart = new Chart(productivityChartCanvas, {
            type: 'bar', data: { labels, datasets: [{ label: 'Tasks Completed', data, backgroundColor: accentColor + '80', borderColor: accentColor, borderWidth: 1, borderRadius: 5 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
        });
    };
    
    // --- Calendar & Task Functions ---
    const generateCalendar = (date) => {
        calendarDaysGrid.innerHTML = '';
        const today = new Date(); today.setHours(0, 0, 0, 0);
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
        datePicker.value = formatDate(currentDate);
        selectedDateDisplay.textContent = currentDate.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        searchBar.value = '';
        document.getElementById('selected-date-display').classList.remove('hidden');
        document.querySelector('.calendar-container').classList.remove('hidden');
        generateCalendar(currentDate);
        renderTasks();
    };
    const renderTasks = () => {
        const selectedDate = datePicker.value;
        const tasksForDay = tasks[selectedDate] || [];
        taskList.innerHTML = '';
        emptyState.querySelector('p').textContent = 'All clear! Enjoy your day.';
        emptyState.querySelector('span').innerHTML = 'Add a new task to get started.';
        
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
            taskElement.querySelector('.task-content').addEventListener('click', () => openTaskModal(task));
            if (!task.completed) addSwipeAndDragListeners(taskElement);
            taskList.appendChild(taskElement);
        });
    };
    const renderSearchResults = (results, query) => {
        taskList.innerHTML = '';
        if (results.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = 'No results found';
            emptyState.querySelector('span').textContent = `No tasks match your search for "${query}".`;
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
                    const taskToOpen = tasks[task.date].find(t => t.id === task.id);
                    if (taskToOpen) openTaskModal(taskToOpen);
                    closeMenu();
                });
                taskList.appendChild(taskElement);
            });
        }
    };
    
    // --- Modal Management ---
    const openMenu = () => document.body.classList.add('side-menu-active');
    const closeMenu = () => {
        document.body.classList.remove('side-menu-active');
        if (searchBar.value !== '') {
            searchBar.value = '';
            updateUIForNewDate();
        }
    };
    const openTaskModal = (task = null) => {
        taskForm.reset();
        if (task) {
            modalTitle.textContent = 'Edit Task';
            currentTaskId = task.id;
            originalTaskDate = task.date;
            document.getElementById('task-id').value = task.id;
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-description').value = task.description;
            document.getElementById('task-priority').value = task.priority;
            editTaskDateInput.value = originalTaskDate;
            editTaskDateContainer.classList.remove('hidden');
        } else {
            modalTitle.textContent = 'Add New Task';
            currentTaskId = null;
            originalTaskDate = null;
            editTaskDateContainer.classList.add('hidden');
        }
        taskModal.classList.remove('hidden');
    };
    const closeTaskModal = () => { taskModal.classList.add('hidden'); originalTaskDate = null; };
    const showDeleteConfirmModal = (taskId) => { taskIdToDelete = taskId; deleteConfirmModal.classList.remove('hidden'); };
    const hideDeleteConfirmModal = () => { deleteConfirmModal.classList.add('hidden'); taskIdToDelete = null; };
    const showCompleteConfirmModal = (taskId) => { taskIdToComplete = taskId; completeConfirmModal.classList.remove('hidden'); };
    const hideCompleteConfirmModal = () => { completeConfirmModal.classList.add('hidden'); taskIdToComplete = null; };
    const openSettingsModal = () => settingsModal.classList.remove('hidden');
    const closeSettingsModal = () => settingsModal.classList.add('hidden');
    const openAnalysisModal = () => { calculateAndDisplayStats(); analysisModal.classList.remove('hidden'); };
    const closeAnalysisModal = () => analysisModal.classList.add('hidden');
    const openDeleteDataModal = () => deleteDataConfirmModal.classList.remove('hidden');
    const closeDeleteDataModal = () => { deleteConfirmInput.value = ''; confirmDeleteDataBtn.disabled = true; deleteDataConfirmModal.classList.add('hidden'); };
    const openJumpToDateModal = () => {
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
    const closeJumpToDateModal = () => jumpToDateModal.classList.add('hidden');

    // --- Event Handlers ---
    authBtn.addEventListener('click', handleAuth);
    authToggleLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode(); });
    logoutBtn.addEventListener('click', logout);
    mainApp.addEventListener('click', () => { if (document.body.classList.contains('side-menu-active')) closeMenu(); });
    closeMenuBtn.addEventListener('click', closeMenu);
    menuBtn.addEventListener('click', (e) => { e.stopPropagation(); openMenu(); });
    searchBar.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query === '') {
            updateUIForNewDate();
            return;
        }
        document.getElementById('selected-date-display').classList.add('hidden');
        document.querySelector('.calendar-container').classList.add('hidden');
        const allTasks = [];
        for (const dateKey in tasks) {
            tasks[dateKey].forEach(task => allTasks.push({ ...task, date: dateKey }));
        }
        const results = allTasks.filter(task => task.title.toLowerCase().includes(query) || task.description.toLowerCase().includes(query));
        renderSearchResults(results, query);
    });
    themeToggle.addEventListener('click', () => {
        settings.theme = themeToggle.checked ? 'dark' : 'light';
        applyTheme(settings.theme); 
        localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
        saveSettingsToServer();
        themeSelector.querySelector('.active')?.classList.remove('active');
        document.querySelector(`#theme-selector button[value="${settings.theme}"]`)?.classList.add('active');
    });
    mottoInput.addEventListener('change', saveMotto);
    addTaskBtn.addEventListener('click', () => {
        if (!currentUser) return alert('Please log in to add tasks.');
        openTaskModal();
    });
    openSettingsBtn.addEventListener('click', openSettingsModal);
    openAnalysisBtn.addEventListener('click', openAnalysisModal);
    prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updateUIForNewDate(); });
    nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updateUIForNewDate(); });
    todayBtn.addEventListener('click', () => { currentDate = new Date(); updateUIForNewDate(); });
    toggleCalendarBtn.addEventListener('click', () => {
        calendarBody.classList.toggle('collapsed');
        toggleCalendarBtn.querySelector('i').classList.toggle('fa-chevron-up');
        toggleCalendarBtn.querySelector('i').classList.toggle('fa-chevron-down');
    });
    calendarDaysGrid.addEventListener('click', (e) => {
        const target = e.target.closest('.calendar-day');
        if (target && !target.classList.contains('not-current-month')) {
            currentDate.setDate(parseInt(target.textContent, 10));
            updateUIForNewDate();
        }
    });
    jumpToDateBtn.addEventListener('click', openJumpToDateModal);
    cancelJumpBtn.addEventListener('click', closeJumpToDateModal);
    goToDateBtn.addEventListener('click', () => {
        const year = parseInt(jumpYearInput.value, 10);
        if (!isNaN(year) && year > 1000 && year < 9999) {
            currentDate = new Date(year, parseInt(jumpMonthSelect.value, 10), parseInt(jumpDaySelect.value, 10));
            updateUIForNewDate(); closeJumpToDateModal();
        } else { alert("Please enter a valid year."); }
    });
    cancelBtn.addEventListener('click', closeTaskModal);
    cancelDeleteBtn.addEventListener('click', hideDeleteConfirmModal);
    cancelCompleteBtn.addEventListener('click', hideCompleteConfirmModal);
    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return alert('Please log in to save tasks.');

        const taskData = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-description').value,
            priority: document.getElementById('task-priority').value
        };

        if (currentTaskId) {
            const newDate = editTaskDateInput.value;
            await fetch(`/api/tasks/${currentUser}/${currentTaskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...taskData, date: newDate })
            });
        } else {
            const selectedDate = datePicker.value;
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
    confirmDeleteBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        await fetch(`/api/tasks/${currentUser}/${taskIdToDelete}`, { method: 'DELETE' });
        await loadTasksForCurrentUser();
        hideDeleteConfirmModal();
        updateUIForNewDate();
    });
    confirmCompleteBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        await fetch(`/api/tasks/${currentUser}/${taskIdToComplete}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: true })
        });
        await loadTasksForCurrentUser();
        hideCompleteConfirmModal();
        updateUIForNewDate();
    });
    closeSettingsBtn.addEventListener('click', closeSettingsModal);
    closeAnalysisBtn.addEventListener('click', closeAnalysisModal);

    // --- REVISED SETTINGS EVENT LISTENERS ---
    enableNotificationsToggle.addEventListener('change', (e) => { 
        settings.notificationsEnabled = e.target.checked; 
        localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
        saveSettingsToServer();
    });
    dailySummaryToggle.addEventListener('change', (e) => { 
        settings.dailySummaryEnabled = e.target.checked; 
        dailySummaryTimeContainer.classList.toggle('hidden', !e.target.checked); 
        localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
        saveSettingsToServer();
    });
    dailySummaryTimeInput.addEventListener('change', (e) => { 
        settings.dailySummaryTime = e.target.value; 
        localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
        saveSettingsToServer();
    });
    hourlyReminderToggle.addEventListener('change', (e) => { 
        settings.hourlyReminderEnabled = e.target.checked; 
        localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
        saveSettingsToServer();
    });
    themeSelector.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            themeSelector.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            settings.theme = e.target.value;
            applyTheme(settings.theme); 
            localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
            saveSettingsToServer();
        }
    });
    accentColorSelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('color-swatch')) {
            accentColorSelector.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            settings.accentColor = e.target.dataset.color;
            applyAccentColor(settings.accentColor); 
            localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
            saveSettingsToServer();
        }
    });
    fontSizeSelector.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            fontSizeSelector.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            settings.fontSize = e.target.value;
            applyFontSize(settings.fontSize); 
            localStorage.setItem(`nextlySettings_${currentUser}`, JSON.stringify(settings));
            saveSettingsToServer();
        }
    });

    deleteAllDataBtn.addEventListener('click', openDeleteDataModal);
    cancelDeleteDataBtn.addEventListener('click', closeDeleteDataModal);
    deleteConfirmInput.addEventListener('input', (e) => { confirmDeleteDataBtn.disabled = e.target.value !== 'DELETE'; });
    confirmDeleteDataBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        await fetch(`/api/tasks/${currentUser}/all`, { method: 'DELETE' }); // Assumes a route to delete all tasks exists
        tasks = {};
        closeDeleteDataModal();
        updateUIForNewDate();
    });

    // --- Drag/Drop & Swipe Handlers ---
    let draggedItem = null;
    taskList.addEventListener('dragstart', (e) => { if (e.target.classList.contains('task-item')) { draggedItem = e.target; setTimeout(() => e.target.classList.add('dragging'), 0); } });
    taskList.addEventListener('dragend', () => { if (draggedItem) { draggedItem.classList.remove('dragging'); draggedItem = null; } });
    taskList.addEventListener('dragover', (e) => { e.preventDefault(); const afterElement = getDragAfterElement(taskList, e.clientY); if (draggedItem) { if (afterElement == null) taskList.appendChild(draggedItem); else taskList.insertBefore(draggedItem, afterElement); } });
    function getDragAfterElement(container, y) { const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')]; return draggableElements.reduce((closest, child) => { const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2; if (offset < 0 && offset > closest.offset) return { offset: offset, element: child }; else return closest; }, { offset: Number.NEGATIVE_INFINITY }).element; }
    function addSwipeAndDragListeners(element) {
        let isDragging = false, startX, diff = 0;
        const getClientX = (e) => e.touches ? e.touches[0].clientX : e.clientX;
        const dragStart = (e) => { startX = getClientX(e); isDragging = true; element.style.transition = ''; };
        const dragMove = (e) => { if (!isDragging || element.classList.contains('dragging')) return; diff = currentX - startX; element.style.transform = `translateX(${diff}px)`; };
        const dragEnd = () => {
            if (!isDragging) return; isDragging = false; element.style.transition = 'transform 0.3s ease';
            if (diff > 100) showCompleteConfirmModal(element.dataset.id);
            else if (diff < -100) showDeleteConfirmModal(element.dataset.id);
            element.style.transform = 'translateX(0)'; diff = 0;
        };
        element.addEventListener('touchstart', dragStart); element.addEventListener('touchmove', dragMove); element.addEventListener('touchend', dragEnd);
        element.addEventListener('mousedown', dragStart); element.addEventListener('mousemove', dragMove); element.addEventListener('mouseup', dragEnd);
        element.addEventListener('mouseleave', () => { if(isDragging) dragEnd(); });
    }

    // --- Initial App Setup ---
    const initializeApp = async () => {
        const savedUser = localStorage.getItem('nextlyUser');
        if (savedUser) {
            await login(savedUser);
        } else {
            body.classList.remove('logged-in');
            await loadAllUserData(); // Load default view
        }
    };

    initializeApp();
});