const API_BASE_URL = 'http://exam-api-courses.std-900.ist.mospolytech.ru';
const API_KEY = '8b8b0be4-34a2-4417-86d7-a5a56306b218';

let allCourses = [];
let allTutors = [];
let allRequests = [];
let currentCourse = null;
let scheduleSlots = [];
let selectedStartDate = null;
let currentCoursePage = 1;

let courseFilterName = '';
let courseFilterLevel = '';

// Вспомогательные функции
function showNotification(message, type='info') {
  const container = document.getElementById('notifications');
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert alert-' + (type==='error'?'danger':type) + ' alert-dismissible fade show';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Закрыть"></button>`;
  container.appendChild(alertDiv);
  setTimeout(() => alertDiv.remove(), 4000);
}

function apiRequest(method, endpoint, data=null) {
  const url = API_BASE_URL + endpoint + '?api_key=' + encodeURIComponent(API_KEY);
  const options = {
    method: method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (data) options.body = JSON.stringify(data);
  return fetch(url, options).then(res => {
    if (!res.ok) {
      return res.json().then(err => {
        showNotification('Ошибка API: ' + (err.error || res.statusText), 'error');
        throw new Error('API error');
      });
    }
    return res.json();
  }).catch(err => {
    if (err.message.includes('Failed to fetch')) {
      showNotification('Ошибка соединения с API', 'error');
    }
    throw err;
  });
}
//Загрузка данных 
function loadCourses() {
  apiRequest('GET', '/api/courses')
    .then(courses => {
      allCourses = courses;
      renderCourses();
    })
    .catch(() => {
      allCourses = [];
      renderCourses();
    });
}

function loadTutors() {
  apiRequest('GET', '/api/tutors')
    .then(tutors => {
      allTutors = tutors;
      renderTutors();
    })
    .catch(() => {
      allTutors = [];
      renderTutors();
    });
}

function loadRequests() {
  apiRequest('GET', '/api/orders')
    .then(data => {
      allRequests = Array.isArray(data) ? data : [];
      currentRequestPage = 1;
      renderRequests();
    })
    .catch(() => {
      allRequests = [];
      renderRequests();
    });
}
//Рендеринг
function renderCourses() {
  const tbody = document.querySelector('#coursesTable tbody');
  tbody.innerHTML = '';

  const filtered = allCourses.filter(c => {
    const nameMatch = !courseFilterName || c.name.toLowerCase().includes(courseFilterName);
    const levelMatch = !courseFilterLevel || c.level === courseFilterLevel;
    return nameMatch && levelMatch;
  });

  const perPage = 5;
  const totalPages = Math.ceil(filtered.length / perPage);
  if (currentCoursePage > totalPages) currentCoursePage = totalPages || 1;
  const startIdx = (currentCoursePage - 1) * perPage;
  const pageItems = filtered.slice(startIdx, startIdx + perPage);

  for (const c of pageItems) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.description}</td>
      <td>${c.teacher}</td>
      <td>${c.level}</td>
      <td>${c.total_length}</td>
      <td>${c.course_fee_per_hour}</td>
      <td><button class="btn btn-sm btn-success" onclick="openApplyModal(${c.id})">Подать заявку</button></td>
    `;
    tbody.appendChild(tr);
  }

  renderPagination('coursesPagination', totalPages, currentCoursePage, (page) => {
    currentCoursePage = page;
    renderCourses();
  });
}

function renderTutors() {
  const tbody = document.querySelector('#tutorsTable tbody');
  tbody.innerHTML = '';

  const langFilter = document.getElementById('tutorLanguage').value;
  const levelFilter = document.getElementById('tutorLevel').value;

  const filtered = allTutors.filter(t => {
    const langMatch = !langFilter || t.languages_offered.includes(langFilter);
    const levelMatch = !levelFilter || t.language_level === levelFilter;
    return langMatch && levelMatch;
  });

  for (const t of filtered) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="logo.png" alt="Фото" width="50" height="50" /></td>
      <td>${t.name}</td>
      <td>${t.work_experience}</td>
      <td>${t.languages_spoken.join(', ')}</td>
      <td>${t.language_level}</td>
      <td>${t.price_per_hour}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary toggleSelectBtn">Выбрать</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
  attachChooseButtonsHandlers();
}

function attachChooseButtonsHandlers() {
  document.querySelectorAll('.toggleSelectBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('btn-success');
      btn.classList.toggle('btn-outline-primary');
      if (btn.classList.contains('btn-success')) {
        btn.textContent = 'Выбрано';
      } else {
        btn.textContent = 'Выбрать';
      }
    });
  });
}

function renderRequests() {
  const tbody = document.querySelector('#requestsTable tbody');
  tbody.innerHTML = '';

  for (const r of allRequests) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>Курс ID: ${r.course_id}</td>
      <td>Репетитор ID: ${r.tutor_id}</td>
      <td>${r.date_start}</td>
      <td>${r.time_start}</td>
      <td>${r.persons}</td>
      <td>${r.price}</td>
      <td>
        <button class="btn btn-sm btn-warning" onclick="editRequest(${r.id})">Редактировать</button>
        <button class="btn btn-sm btn-danger" onclick="deleteRequest(${r.id})">Удалить</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

// Модальное окно составления заявки

async function fetchCourseDetails(courseId) {
  return apiRequest('GET', `/api/courses/${courseId}`);
}

async function openApplyModal(courseId) {
  try {
    const course = await fetchCourseDetails(courseId);
    if (!course) {
      showNotification('Курс не найден', 'error');
      return;
    }
    currentCourse = course;

    document.getElementById('courseName').value = course.name;
    document.getElementById('teacherName').value = course.teacher;
    document.getElementById('durationWeeks').value = course.total_length;

    // Расчет даты начала
    const uniqueDates = Array.from(new Set(course.start_dates.map(d => d.slice(0,10))));
    const startSelect = document.getElementById('startDate');
    startSelect.innerHTML = '';
    uniqueDates.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      startSelect.appendChild(opt);
    });
    if (uniqueDates.length > 0) {
      startSelect.value = uniqueDates[0];
      await onStartDateChange();
    }
    updateEndDate()
    // сброс чекбоксов
    document.querySelectorAll('#applicationForm input[type=checkbox]').forEach(cb => cb.checked = false);
    document.getElementById('totalCost').value = '';

    new bootstrap.Modal(document.getElementById('applyModal')).show();
  } catch (err) {
    showNotification('Ошибка при загрузке курса', 'error');
  }
}
// Обновление даты окончания
function updateEndDate() {
  const startStr= document.getElementById('startDate').value;
  if (!startStr || !currentCourse) return;
  const startDate=new Date(startStr);
  const totalWeeks= currentCourse.total_length;
  const endDate= new Date(startDate);
  endDate.setDate(startDate.getDate()+ totalWeeks*7);
  document.getElementById('endDate').value= endDate.toISOString().slice(0,10);
}
async function onStartDateChange() {
  updateEndDate();
  selectedStartDate = document.getElementById('startDate').value;
  if (!currentCourse || !currentCourse.id) return;

  try {
    const scheduleData = await fetchCourseDetails(currentCourse.id);
    if (!scheduleData || !scheduleData.start_dates) {
      showNotification('Нет расписания для курса', 'error');
      return;
    }

    scheduleSlots = scheduleData.start_dates
      .filter(d => d.slice(0,10) === selectedStartDate)
      .map(d => ({ time: d.slice(11,16), duration_hours: scheduleData.week_length }));
  } catch {
    showNotification('Ошибка при получении расписания', 'error');
    return;
  }

  const lessonSelect = document.getElementById('lessonTime');
  lessonSelect.innerHTML = '';
  scheduleSlots.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.time;
    opt.textContent = s.time + ' - ' + addHoursToTime(s.time, s.duration_hours);
    opt.addEventListener('change', calculateTotalCost);
    lessonSelect.appendChild(opt);
  });
  if (scheduleSlots.length > 0) {
    document.getElementById('lessonTime').value = scheduleSlots[0].time;
    calculateTotalCost();
  }
}

function addHoursToTime(timeStr, hours) {
  const [h, m] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m);
  date.setHours(date.getHours() + hours);
  const hh = date.getHours().toString().padStart(2,'0');
  const mm = date.getMinutes().toString().padStart(2,'0');
  return hh + ':' + mm;
}

function calculateTotalCost() {
  if (!currentCourse || !selectedStartDate || !document.getElementById('lessonTime').value) return;

  const feePerHour = currentCourse.course_fee_per_hour;
  const totalWeeks = currentCourse.total_length;
  const weekLength = currentCourse.week_length;
  const totalHours = totalWeeks * weekLength;

  let totalCost = feePerHour * totalHours;
  const dateObj = new Date(selectedStartDate);
  const day = dateObj.getDay();
  const isWeekendOrHoliday = (day === 0 || day === 6) ? 1.5 : 1;

  const lessonTime = document.getElementById('lessonTime').value;
  const h = parseInt(lessonTime.slice(0,2));
  let surchargeMorning = 0;
  let surchargeEvening = 0;
  if (h >= 9 && h < 12) surchargeMorning = 400;
  if (h >= 18 && h < 20) surchargeEvening = 1000;

  totalCost = totalCost * isWeekendOrHoliday + surchargeMorning + surchargeEvening;

  const groupSize = parseInt(document.getElementById('groupSize').value);
  totalCost *= groupSize;

  if (document.getElementById('earlyRegistration').checked) {
    const now = new Date();
    const diffDays = (new Date(selectedStartDate) - now) / (1000*60*60*24);
    if (diffDays >= 30) totalCost *= 0.9;
  }
  if (document.getElementById('groupEnrollment').checked && groupSize >= 5) {
    totalCost *= 0.85;
  }
  if (document.getElementById('intensiveCourse').checked) {
    totalCost *= 1.2;
  }
  if (document.getElementById('supplementary').checked) {
    totalCost += 2000 * groupSize;
  }
  if (document.getElementById('personalized').checked) {
    totalCost += 1500 * currentCourse.total_length;
  }
  if (document.getElementById('excursions').checked) {
    totalCost *= 1.25;
  }
  if (document.getElementById('assessment').checked) {
    totalCost += 300;
  }
  if (document.getElementById('interactive').checked) {
    totalCost *= 1.5;
  }

  document.getElementById('totalCost').value = Math.round(totalCost) + ' руб.';
}
// Обработчики 
document.querySelectorAll('#applicationForm input[type=checkbox], #applicationForm select').forEach(el => {
  el.addEventListener('change', calculateTotalCost);
});

document.getElementById('startDate').addEventListener('change', onStartDateChange);

// Обработка формы заявки
document.getElementById('applicationForm').addEventListener('submit', e => {
  e.preventDefault();
  submitApplication();
});

// Кнопка "Запрос на занятие"
document.getElementById('bottomRequestBtnContainer').innerHTML = `<button class="btn btn-primary" id="openRequestTutorBtn">Запрос на занятие</button>`;
document.getElementById('openRequestTutorBtn').addEventListener('click', () => {
  const modalEl = document.getElementById('requestTutorModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
});

// Инициализация
document.getElementById('applyCourseFilters').addEventListener('click', () => {
  courseFilterName = document.getElementById('filterName').value.toLowerCase();
  courseFilterLevel = document.getElementById('filterLevel').value;
  currentCoursePage = 1;
  renderCourses();
});

// Пагинация
function renderPagination(id, totalPages, currentPage, onPageChange) {
  const container = document.getElementById(id);
  container.innerHTML = '';
  if (totalPages <= 1) return; // не показывать пагинацию если страниц нет или одна
  const ul = document.createElement('ul');
  ul.className='pagination justify-content-center';

  for (let i=1; i<=totalPages; i++) {
    const li = document.createElement('li');
    li.className='page-item' + (i===currentPage?' active':'');
    li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
    li.querySelector('a').addEventListener('click', (e) => {
      e.preventDefault();
      onPageChange(i);
    });
    ul.appendChild(li);
  }
  container.appendChild(ul);
}

// загрузка данных
window.onload = () => {
  loadCourses();
  loadTutors();
  loadRequests();
  document.getElementById('filterTutorsBtn').addEventListener('click', () => {
    renderTutors();
  });
};

// Функция отправки заявки
async function submitApplication() {
  if (!currentCourse) {
    showNotification('Нет выбранного курса', 'error');
    return;
  }

  const groupSize = parseInt(document.getElementById('groupSize').value);
  const totalCostStr = document.getElementById('totalCost').value;
  const totalCost = parseInt(totalCostStr.replace(/\D/g, ''));

  const startDate = document.getElementById('startDate').value;
  const lessonTime = document.getElementById('lessonTime').value;
  const data = {
    tutor_id: null,
    course_id: currentCourse.id,
    date_start: startDate,
    time_start: lessonTime,
    duration: currentCourse.week_length,
    persons: groupSize,
    price: totalCost,
    early_registration: document.getElementById('earlyRegistration').checked,
    group_enrollment: document.getElementById('groupEnrollment').checked,
    intensive_course: document.getElementById('intensiveCourse').checked,
    supplementary: document.getElementById('supplementary').checked,
    personalized: document.getElementById('personalized').checked,
    excursions: document.getElementById('excursions').checked,
    assessment: document.getElementById('assessment').checked,
    interactive: document.getElementById('interactive').checked
  };

  try {
    const response = await fetch(API_BASE_URL + '/api/orders?api_key=' + encodeURIComponent(API_KEY), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json();
      showNotification('Ошибка при создании заявки: ' + (err.error || response.statusText), 'error');
      return;
    }
    const result = await response.json();
    showNotification('Заявка успешно отправлена!', 'success');
    const modalEl = document.getElementById('applyModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    loadRequests();
  } catch (err) {
    showNotification('Ошибка соединения с сервером', 'error');
  }
}