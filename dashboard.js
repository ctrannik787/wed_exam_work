const API_URL='http://exam-api-courses.std-900.ist.mospolytech.ru';
const API_KEY='8b8b0be4-34a2-4417-86d7-a5a56306b218';

let allCourses=[]; // все курсы
let allOrders=[]; // заявки
let currentCourse={};
let currentOrderId=null; // для редактирования
let deleteOrderId=null; // для удаления

window.onload=()=>{
    loadCourses();
    loadOrders();
}

async function loadCourses() {
    try {
    const resp= await fetch(`${API_URL}/api/courses?api_key=${API_KEY}`);
    allCourses= await resp.json();
    } catch(e){ allCourses=[]; }
}

async function loadOrders() {
    try {
    const resp= await fetch(`${API_URL}/api/orders?api_key=${API_KEY}`);
    const data= await resp.json();
    allOrders=Array.isArray(data)?data:[];
    renderOrders();
    } catch(e){ allOrders=[]; renderOrders(); }
}

function renderOrders() {
    const tbody=document.querySelector('#ordersTable tbody');
    tbody.innerHTML='';
    allOrders.forEach((order,idx)=>{
        getCourseName(order.course_id).then(cName => {
            const tr=document.createElement('tr');
            tr.innerHTML=`
            <td>${idx+1}</td>
            <td>${cName}</td>
            <td>${order.date_start}</td>
            <td>${order.price} ₽</td>
            <td>
            <button class="btn btn-sm btn-info me-1" onclick="openEditOrderModal(${order.id})">Редактировать</button>
            <button class="btn btn-sm btn-danger me-1" onclick="confirmDelete(${order.id})">Удалить</button>
            <button class="btn btn-sm btn-secondary" onclick="showOrderDetails(${order.id})">Подробнее</button>
            </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

async function getCourseName(course_id){
    const c= allCourses.find(c=>c.id===course_id);
    return c?c.name:'';
}

async function getCourseById(id) {
    try{
        const resp= await fetch(`${API_URL}/api/courses/${id}?api_key=${API_KEY}`);
        return await resp.json();
    } catch(e){ return null; }
}

// Открытие окна редактирования
async function openEditOrderModal(orderId) {
    try {
        const resp= await fetch(`${API_URL}/api/orders/${orderId}?api_key=${API_KEY}`);
        const order= await resp.json();
        const course= await getCourseById(order.course_id);
        currentCourse=course;
        currentOrderId=order.id;
        document.getElementById('orderId').value=order.id;
        document.getElementById('courseId').value=course.id;
        document.getElementById('courseName').value=course.name;
        document.getElementById('teacherName').value=course.teacher;
        document.getElementById('durationWeeks').value=course.total_length;
        fillStartDates(course.start_dates, order.date_start);
        fillLessonTimes(order.date_start, course.week_length);
        document.getElementById('startDate').value= order.date_start;
        updateEndDate();
        calculateTotalCost();
        // чекбоксы
        document.getElementById('earlyRegistration').checked=order.early_registration;
        document.getElementById('groupEnrollment').checked=order.group_enrollment;
        document.getElementById('intensiveCourse').checked=order.intensive_course;
        document.getElementById('supplementary').checked=order.supplementary;
        document.getElementById('personalized').checked=order.personalized;
        document.getElementById('excursions').checked=order.excursions;
        document.getElementById('assessment').checked=order.assessment;
        document.getElementById('interactive').checked=order.interactive;
        new bootstrap.Modal(document.getElementById('applyModal')).show();
    } catch(e){
        showNotification('danger','Ошибка загрузки заявки: '+e.message);
    }
}

// Заполнение дат
function fillStartDates(startDates, selectedDate='') {
    const select=document.getElementById('startDate');
    select.innerHTML='';
    const uniqueDates=new Set(startDates.map(d=>d.slice(0,10)));
    uniqueDates.forEach(d => {
        const option=document.createElement('option');
        option.value=d;
        option.textContent=d;
        if (d===selectedDate) option.selected=true;
        select.appendChild(option);
    });
}

// Заполнение времени
function fillLessonTimes(selectedDate, weekLength) {
    if (!currentCourse.start_dates) return;
    const filtered= currentCourse.start_dates.filter(d=>d.startsWith(selectedDate));
    const select=document.getElementById('lessonTime');
    select.innerHTML='';
    filtered.forEach(d => {
        const dateObj= new Date(d);
        const h= dateObj.getHours();
        const m= dateObj.getMinutes();
        const timeStr= `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
        const endTime= addHoursToTime(timeStr, currentCourse.week_length);
        const option= document.createElement('option');
        option.value= timeStr;
        option.textContent= `${timeStr} - ${endTime}`;
        select.appendChild(option);
    });
    if (select.options.length>0){
        select.value= select.options[0].value;
    }
    calculateTotalCost();
}

function addHoursToTime(timeStr, hours) {
    const [h,m]= timeStr.split(':').map(Number);
    const date= new Date();
    date.setHours(h,m);
    date.setHours(date.getHours()+ hours);
    const hh= date.getHours().toString().padStart(2,'0');
    const mm= date.getMinutes().toString().padStart(2,'0');
    return `${hh}:${mm}`;
}

function updateEndDate() {
    const startStr= document.getElementById('startDate').value;
    if (!startStr || !currentCourse) return;
    const startDate=new Date(startStr);
    const totalWeeks= currentCourse.total_length;
    const endDate= new Date(startDate);
    endDate.setDate(startDate.getDate()+ totalWeeks*7);
    document.getElementById('endDate').value= endDate.toISOString().slice(0,10);
}

function calculateTotalCost() {
    if (!currentCourse || !currentCourse.course_fee_per_hour) return;
    const courseFeePerHour= currentCourse.course_fee_per_hour;
    const totalWeeks= currentCourse.total_length;
    const weekLength= currentCourse.week_length;
    const startDateStr= document.getElementById('startDate').value;
    const lessonTime= document.getElementById('lessonTime').value;
    const persons= parseInt(document.getElementById('groupSize').value)||1;
    if (!startDateStr || !lessonTime) {
        document.getElementById('totalCost').value= '';
        return;
    }
    const totalHours= totalWeeks * weekLength;
    const startDate=new Date(startDateStr);
    const day= startDate.getDay();
    const isWeekendOrHoliday= (day===0 || day===6)?1.5:1;
    const h= parseInt(lessonTime.slice(0,2));
    let morningSurcharge=0;
    let eveningSurcharge=0;
    if (h>=9 && h<12) morningSurcharge=400;
    if (h>=18 && h<20) eveningSurcharge=1000;
    let total= (courseFeePerHour * totalHours * isWeekendOrHoliday) + (morningSurcharge + eveningSurcharge);
    const now= new Date();
    const diffDays= (startDate - now)/(1000*60*60*24);
    if (document.getElementById('earlyRegistration').checked && diffDays>=30) {
        total= total*0.9; 
    }
    if (document.getElementById('groupEnrollment').checked && persons>=5) {
        total= total*0.85;
    }
    if (document.getElementById('intensiveCourse').checked) {
        total= total*1.2;
    }
    if (document.getElementById('supplementary').checked) {
        total= total+2000*persons;
    }
    if (document.getElementById('personalized').checked) {
        total= total+1500*totalWeeks;
    }
    if (document.getElementById('excursions').checked) {
        total= total*1.25;
    }
    if (document.getElementById('assessment').checked) {
        total= total+300;
    }
    if (document.getElementById('interactive').checked) {
        total= total*1.5;
    }
    document.getElementById('totalCost').value= Math.round(total)+ ' руб.';
}

// Обработчики для чекбоксов и элементов
document.querySelectorAll('#applicationForm input[type=checkbox], #applicationForm input[type=date], #applicationForm select, #applicationForm input[type=number]').forEach(el=>{
    el.addEventListener('change', ()=> {calculateTotalCost();});
});
document.getElementById('startDate').addEventListener('change', ()=> {
    fillLessonTimes(document.getElementById('startDate').value, currentCourse.week_length);
    updateEndDate();
    calculateTotalCost();
});
document.getElementById('lessonTime').addEventListener('change', ()=> {
    calculateTotalCost();
});
// Обработка отправки формы заявки
document.getElementById('applicationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('orderId').value;
    const course_id = parseInt(document.getElementById('courseId').value);
    const date_start = document.getElementById('startDate').value; // формат YYYY-MM-DD
    const time_start = document.getElementById('lessonTime').value; // формат HH:MM
    const persons = parseInt(document.getElementById('groupSize').value);
    const totalCostStr = document.getElementById('totalCost').value;
    const price = parseFloat(totalCostStr.replace(/\s?руб./, '').replace(/\s/g, ''));
    const data = {
        course_id,
        date_start,
        time_start,
        duration: currentCourse.total_length,
        persons,
        price,
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
        const resp = await fetch(`${API_URL}/api/orders/${id}?api_key=${API_KEY}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const respData = await resp.json();
        if (!resp.ok) {
            console.error('Ответ сервера:', respData);
            throw new Error('Ошибка при обновлении заявки: ' + (respData.error || resp.statusText));
        }
        const updatedOrder = respData;
        // Обновляем локальный массив
        const index = allOrders.findIndex(o => o.id == id);
        if (index !== -1) {
            allOrders[index] = updatedOrder;
        } 
        else {
            allOrders.push(updatedOrder);
        }
        showNotification('success', 'Заявка успешно изменена');
        // Обновляем таблицу
        renderOrders();
        // закрываем модальное окно
        bootstrap.Modal.getInstance(document.getElementById('applyModal')).hide();
    } catch (e) {
        console.error('Ошибка при сохранении заявки:', e);
        showNotification('danger', e.message || 'Ошибка при изменении заявки');
    }
});
// Уведомления
function showNotification(type, message) {
    const area=document.getElementById('notification-area');
    area.innerHTML= `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(()=>{area.innerHTML='';}, 5000);
}

// Всплывающее подтверждение удаления
function confirmDelete(id) {
    deleteOrderId=id;
    new bootstrap.Modal(document.getElementById('deleteConfirmModal')).show();
}

// Удаление по подтверждению
document.getElementById('confirmDeleteBtn').addEventListener('click', ()=>{
    if (deleteOrderId) {
        fetch(`${API_URL}/api/orders/${deleteOrderId}?api_key=${API_KEY}`, {
            method:'DELETE'
        }).then(res=>res.json())
        .then(data => {
            if(data.id) {
                showNotification('success','Заявка успешно удалена');
                allOrders=allOrders.filter(o=>o.id!==deleteOrderId);
                renderOrders();
            } else {
                showNotification('danger','Ошибка при удалении заявки');
            }
            deleteOrderId=null;
            bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal')).hide();
        })
        .catch(()=> {
            showNotification('danger','Ошибка при удалении заявки');
            deleteOrderId=null;
            bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal')).hide();
        });
    }
});

// Показать детали заявки
async function showOrderDetails(orderId) {
    try {
        const resp= await fetch(`${API_URL}/api/orders/${orderId}?api_key=${API_KEY}`);
        const order= await resp.json();
        const course= await getCourseById(order.course_id);
        document.getElementById('detailCourseName').textContent=course.name;
        document.getElementById('detailDescription').textContent=course.description;
        document.getElementById('detailTeacher').textContent=course.teacher;
        document.getElementById('detailStartDate').textContent=order.date_start;
        document.getElementById('detailLessonTime').textContent=order.time_start;
        document.getElementById('detailDuration').textContent=course.total_length;
        document.getElementById('detailPrice').textContent=order.price+' ₽';
        document.getElementById('detailEarly').textContent=order.early_registration?'Да':'Нет';
        document.getElementById('detailGroup').textContent=order.group_enrollment?'Да':'Нет';
        document.getElementById('detailIntensive').textContent=order.intensive_course?'Да':'Нет';
        document.getElementById('detailSupplementary').textContent=order.supplementary?'Да':'Нет';
        document.getElementById('detailPersonalized').textContent=order.personalized?'Да':'Нет';
        document.getElementById('detailExcursions').textContent=order.excursions?'Да':'Нет';
        document.getElementById('detailAssessment').textContent=order.assessment?'Да':'Нет';
        document.getElementById('detailInteractive').textContent=order.interactive?'Да':'Нет';
        new bootstrap.Modal(document.getElementById('detailsModal')).show();
    } catch(e){
        showNotification('danger','Ошибка загрузки деталей заявки: '+e.message);
    }
}