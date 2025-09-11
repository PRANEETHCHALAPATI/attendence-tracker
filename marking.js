// marking.js (final) — Week 1 locked to 14/07/2025
// Relies on storage.js helpers

(function(){
  let timetable = loadTimetable() || {subjects:[], slots:[]};
  let attendance = loadAttendance();

  const tbody = document.getElementById('tbody');
  const weekLabel = document.getElementById('weekLabel');
  const prevWeek = document.getElementById('prevWeek'),
        nextWeek = document.getElementById('nextWeek');
  const clearWeekBtn = document.getElementById('clearWeek'),
        todayBtn = document.getElementById('todayBtn');
  const modalRoot = document.getElementById('modalRoot');

  // Week 1 starts here
  const FIRST_WEEK_START = new Date("2025-07-14"); // Mon, Jul 14 2025
  let currentWeekStart = FIRST_WEEK_START;

  // --- Helpers ---
  function weekNumberForDate(date){
    const diff = date - FIRST_WEEK_START;
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  }

  function weekLabelRange(startDate){
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return `${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}`;
  }

  function render(){
    tbody.innerHTML = '';
    for(const slot of timetable.slots){
      const tr = document.createElement('tr');
      const tdLabel = document.createElement('td');
      tdLabel.textContent = slot.label;
      tdLabel.className='slot-label';
      tr.appendChild(tdLabel);

      ['mon','tue','wed','thu','fri','sat'].forEach(day=>{
        const td = document.createElement('td');
        td.dataset.slot = slot.id; td.dataset.day = day;
        const wkKey = weekKeyFromDate(currentWeekStart);
        const key = `${slot.id}_${day}`;
        const subCode = slot.map[day] || '';
        if(!subCode){ 
          td.innerHTML = '<div class="small">—</div>'; 
        } else {
          const subj = timetable.subjects.find(s => s.code === subCode) || {short: subCode};
          const rec = attendance[wkKey] && attendance[wkKey][key];
          let statusHtml = '<span class="small">Not marked</span>';
          if(rec){
            const status = rec.status || '';
            if(status === 'OD'){
              const reason = rec.odReason ? ` (${escapeHtml(rec.odReason)})` : '';
              statusHtml = `<span class="status OD">OD${reason}</span>`;
            } else {
              statusHtml = `<span class="status ${status}">${status}</span>`;
            }
          }
          td.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px">
                            <div style="font-weight:800">${escapeHtml(subj.short)}</div>
                            <div>${statusHtml}</div>
                          </div>`;
          td.style.cursor = 'pointer';
          td.addEventListener('click', ()=> openModal(wkKey, slot.id, day, subCode));
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }

    weekLabel.textContent = `Week ${weekNumberForDate(currentWeekStart)} • ${weekLabelRange(currentWeekStart)}`;
  }

  function openModal(weekIso, slotId, day, subjectCode){
    modalRoot.innerHTML = '';
    const bd = document.createElement('div'); bd.className='modal-backdrop';
    const box = document.createElement('div'); box.className='modal';
    const subj = timetable.subjects.find(s=>s.code===subjectCode) || {short:subjectCode};
    box.innerHTML = `<h3>${escapeHtml(subj.short)} • ${day.toUpperCase()}</h3>
      <div class="small">Slot: ${escapeHtml(slotId)}</div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-act="P">Present</button>
        <button class="btn ghost" data-act="A">Absent</button>
        <button class="btn" data-act="OD">OD</button>
        <button class="btn ghost" data-act="H">Holiday</button>
      </div>
      <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px">
        <button class="btn ghost" data-act="clear">Clear</button>
        <button class="btn ghost" data-act="close">Close</button>
      </div>`;
    bd.appendChild(box); modalRoot.appendChild(bd);

    box.querySelectorAll('button[data-act]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const a = btn.dataset.act;
        if(a === 'close'){ modalRoot.innerHTML=''; return; }
        const key = `${slotId}_${day}`;
        if(a === 'clear'){
          if(attendance[weekIso]){
            delete attendance[weekIso][key];
            if(Object.keys(attendance[weekIso]).length===0) delete attendance[weekIso];
            saveAttendance(attendance);
            render();
          }
          modalRoot.innerHTML='';
          return;
        }
        if(a === 'OD'){
          const existing = attendance[weekIso] && attendance[weekIso][key];
          const reason = prompt('Reason for OD (short)', existing && existing.odReason ? existing.odReason : '') || '';
          if(!attendance[weekIso]) attendance[weekIso] = {};
          attendance[weekIso][key] = {subject:subjectCode, status:'OD', odReason:reason};
        } else {
          if(!attendance[weekIso]) attendance[weekIso] = {};
          attendance[weekIso][key] = {subject:subjectCode, status:a, odReason:''};
        }
        saveAttendance(attendance);
        render();
        modalRoot.innerHTML='';
      });
    });

    bd.addEventListener('click', (ev)=>{ if(ev.target === bd) modalRoot.innerHTML=''; });
  }

  // navigation with bounds
  prevWeek.addEventListener('click', ()=>{
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    if(newDate >= FIRST_WEEK_START){
      currentWeekStart = newDate;
      render();
    }
  });

  nextWeek.addEventListener('click', ()=>{
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    const thisWeekStart = startOfWeek(new Date());
    if(newDate <= thisWeekStart){
      currentWeekStart = newDate;
      render();
    }
  });

  clearWeekBtn.addEventListener('click', ()=>{
    const wk = weekKeyFromDate(currentWeekStart);
    if(confirm('Clear attendance for this week?')){
      delete attendance[wk];
      saveAttendance(attendance);
      render();
    }
  });

  todayBtn.addEventListener('click', ()=>{
    let todayStart = startOfWeek(new Date());
    if(todayStart < FIRST_WEEK_START) todayStart = FIRST_WEEK_START;
    currentWeekStart = todayStart;
    render();
  });

  function escapeHtml(s){ 
    if(!s && s!==0) return ''; 
    return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); 
  }

  render();
})();
