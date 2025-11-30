document.addEventListener('DOMContentLoaded', () => {
    const calendarGrid = document.getElementById('calendarGrid');

    // Mock Data for November 2025
    // Nov 1, 2025 is Saturday.
    // We start from Oct 27 (Monday) to fill the first row.

    const daysData = [
        { day: 27, lunar: '初七', otherMonth: true },
        { day: 28, lunar: '初八', otherMonth: true },
        { day: 29, lunar: '重阳节', otherMonth: true, special: true },
        { day: 30, lunar: '初十', otherMonth: true },
        { day: 31, lunar: '万圣夜', otherMonth: true, special: true },
        { day: 1, lunar: '十二' },
        { day: 2, lunar: '十三' },

        { day: 3, lunar: '十四' },
        { day: 4, lunar: '十五' },
        { day: 5, lunar: '十六' },
        { day: 6, lunar: '十七' },
        { day: 7, lunar: '立冬', special: true },
        { day: 8, lunar: '十九' },
        { day: 9, lunar: '二十' },

        { day: 10, lunar: '廿一' },
        { day: 11, lunar: '廿二' },
        { day: 12, lunar: '廿三' },
        { day: 13, lunar: '廿四' },
        { day: 14, lunar: '廿五' },
        { day: 15, lunar: '廿六' },
        { day: 16, lunar: '廿七' },

        { day: 17, lunar: '廿八' },
        { day: 18, lunar: '廿九' },
        { day: 19, lunar: '三十' },
        { day: 20, lunar: '十月', special: true }, // Assuming start of 10th lunar month
        { day: 21, lunar: '初二' },
        { day: 22, lunar: '小雪', special: true },
        { day: 23, lunar: '初四' },

        { day: 24, lunar: '初五' },
        { day: 25, lunar: '初六' },
        { day: 26, lunar: '初七' },
        { day: 27, lunar: '感恩节', special: true },
        { day: 28, lunar: '初九' },
        { day: 29, lunar: '初十' },
        { day: 30, lunar: '十一', selected: true }, // Selected date
    ];

    function renderCalendar() {
        calendarGrid.innerHTML = '';
        daysData.forEach(data => {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            if (data.otherMonth) dayEl.classList.add('other-month');
            if (data.selected) dayEl.classList.add('selected');
            if (data.special) dayEl.classList.add('special');

            const dayNum = document.createElement('span');
            dayNum.className = 'day-number';
            dayNum.textContent = data.day;

            const lunar = document.createElement('span');
            lunar.className = 'lunar-date';
            lunar.textContent = data.lunar;

            dayEl.appendChild(dayNum);
            dayEl.appendChild(lunar);

            calendarGrid.appendChild(dayEl);
        });
    }

    renderCalendar();

    // Tab Switching Logic
    const tabs = document.querySelectorAll('.view-tab');
    const yearView = document.getElementById('yearView');
    const calendarSection = document.getElementById('calendarSection');

    const monthEvents = document.getElementById('monthEvents');
    const dayTimeline = document.getElementById('dayTimeline');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab visual
            document.querySelector('.view-tab.active').classList.remove('active');
            tab.classList.add('active');

            const view = tab.getAttribute('data-view');

            // Reset all views first
            yearView.style.display = 'none';
            calendarSection.style.display = 'block'; // Default show
            calendarGrid.classList.remove('week-mode');
            monthEvents.style.display = 'none';
            dayTimeline.style.display = 'none';

            // Show all days by default (remove hidden class)
            document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('hidden'));

            if (view === 'year') {
                calendarSection.style.display = 'none';
                yearView.style.display = 'block';
            }
            else if (view === 'month') {
                monthEvents.style.display = 'block';
            }
            else if (view === 'week' || view === 'day') {
                dayTimeline.style.display = 'block';

                // Week Mode: Show only the row with the selected date (or last row for now as Nov 30 is selected)
                // In a real app, we would calculate the week. 
                // For this prototype, let's just hide the first 4 rows to simulate "Week View" for Nov 30.
                const days = document.querySelectorAll('.calendar-day');
                days.forEach((day, index) => {
                    if (index < 28) { // Hide first 4 weeks (28 days)
                        day.classList.add('hidden');
                    }
                });
            }
            else if (view === 'schedule') {
                calendarSection.style.display = 'none';
                monthEvents.style.display = 'block';
            }
        });
    });

    // Bottom Nav Logic
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            document.querySelector('.nav-item.active').classList.remove('active');
            item.classList.add('active');
        });
    });
});
