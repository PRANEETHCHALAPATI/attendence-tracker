// timetable.js
(function(){
  let timetable = loadTimetable();
  if(!timetable){
    // initial sample
    timetable = {
      subjects: [
        {code:'CSE407', name:'Cloud Computing', short:'CC'},
        {code:'CSE409', name:'Parallel & Distributed', short:'PDS'},
        {code:'CSE411', name:'PDS Lab', short:'PDS-L'},
        {code:'CSE415', name:'Internet of Things', short:'IoT'},
        {code:'CSE431', name:'IOT Lab', short:'IoT-L'},
        {code:'INT404', name:'Big Data Analytics', short:'BDA'},
        {code:'INT405', name:'Machine Learning Techniques', short:'MLT'}
      ],
      slots: [
        {id:'s1', label:'08:45-09:45', map:{mon:'CSE409',tue:'',wed:'',thu:'CSE415',fri:'CSE407',sat:''}},
        {id:'s2', label:'09:45-10:45', map:{mon:'INT405',tue:'CSE407',wed:'CSE415',thu:'CSE407',fri:'INT404',sat:''}},
        {id:'s3', label:'11:00-12:00', map:{mon:'CSE431',tue:'CSE409',wed:'INT405',thu:'INT404',fri:'CSE409',sat:''}},
        {id:'s4', label:'12:00-01:00', map:{mon:'CSE431',tue:'CSE415',wed:'',thu:'',fri:'',sat:''}},
        {id:'s5', label:'01:00-02:00', map:{mon:'',tue:'',wed:'CSE409',thu:'',fri:'INT405',sat:''}},
        {id:'s6', label:'02:00-03:00', map:{mon:'',tue:'INT404',wed:'CSE407',thu:'',fri:'CSE415',sat:''}},
        {id:'s7', label:'03:15-04:15', map:{mon:'',tue:'INT405',wed:'CSE411',thu:'',fri:'',sat:''}},
        {id:'s8', label:'04:15-05:15', map:{mon:'',tue:'',wed:'CSE411',thu:'',fri:'',sat:''}}
      ]
    };
    saveTimetable(timetable);
  }

  const slotsContainer = document.getElementById('slotsContainer');
  const addSlotBtn = document.getElementById('addSlot');
  const newSlotLabel = document.getElementById('newSlotLabel');
  const addSubjectBtn = document.getElementById('addSubjectBtn');
  const subCode = document.getElementById('subCode'), subName = document.getElementById('subName'), subShort = document.getElementById('subShort');
  const subjectListEditor = document.getElementById('subjectListEditor');
  const resetBtn = document.getElementById('resetTimetable');

  function saveAndRender(){ saveTimetable(timetable); render(); }

  addSlotBtn.addEventListener('click', ()=>{
    const label = newSlotLabel.value.trim();
    if(!label) return alert('Enter slot label');
    const id = 's' + Date.now().toString(36);
    timetable.slots.push({id, label, map:{mon:'',tue:'',wed:'',thu:'',fri:'',sat:''}});
    newSlotLabel.value='';
    saveAndRender();
  });

  addSubjectBtn.addEventListener('click', ()=>{
    const code = subCode.value.trim();
    if(!code) return alert('Enter code');
    timetable.subjects.push({code, name: subName.value.trim() || code, short: subShort.value.trim() || code});
    subCode.value=''; subName.value=''; subShort.value='';
    saveAndRender();
  });

  resetBtn.addEventListener('click', ()=>{ if(confirm('Clear timetable and subjects?')){ timetable = {subjects:[], slots:[]}; saveAndRender(); }});

  function renderSubjects(){
    subjectListEditor.innerHTML = '';
    timetable.subjects.forEach((s, idx)=>{
      const el = document.createElement('div'); el.className='day-card';
      el.style.display='flex'; el.style.alignItems='center'; el.style.gap='8px';
      el.innerHTML = `<div style="font-weight:800">${s.short}</div><div class="small">${s.code}</div><div style="margin-left:auto;display:flex;gap:6px">
        <button class="btn ghost edit-sub" data-i="${idx}">Edit</button><button class="btn ghost del-sub" data-i="${idx}">Delete</button></div>`;
      subjectListEditor.appendChild(el);
    });
    subjectListEditor.querySelectorAll('.edit-sub').forEach(b=>{
      b.addEventListener('click', ()=> {
        const i = +b.dataset.i; const s = timetable.subjects[i];
        const c = prompt('Code', s.code); if(c===null) return;
        const n = prompt('Name', s.name) || s.name;
        const sh = prompt('Short', s.short) || s.short;
        timetable.subjects[i] = {code:c.trim(), name:n.trim(), short:sh.trim()};
        saveAndRender();
      });
    });
    subjectListEditor.querySelectorAll('.del-sub').forEach(b=>{
      b.addEventListener('click', ()=> {
        const i = +b.dataset.i;
        if(!confirm('Delete subject?')) return;
        const code = timetable.subjects[i].code;
        timetable.subjects.splice(i,1);
        // remove from slots
        timetable.slots.forEach(sl => { for(const d in sl.map) if(sl.map[d] === code) sl.map[d] = ''; });
        saveAndRender();
      });
    });
  }

  function openChooser(slotIdx, day, btn){
    // show prompt menu
    let menu = `Choose subject for ${day.toUpperCase()} (${timetable.slots[slotIdx].label})\n\n`;
    timetable.subjects.forEach((s,i)=> menu += `${i+1}. ${s.code} • ${s.short}\n`);
    menu += '\n0. Clear\nEnter number:';
    const ch = prompt(menu);
    if(ch === null) return;
    const n = parseInt(ch);
    if(isNaN(n)) return alert('Invalid');
    if(n === 0){ timetable.slots[slotIdx].map[day] = ''; saveAndRender(); return; }
    if(n >= 1 && n <= timetable.subjects.length){ timetable.slots[slotIdx].map[day] = timetable.subjects[n-1].code; saveAndRender(); return; }
    alert('Invalid');
  }

  function renderSlots(){
    slotsContainer.innerHTML = '';
    timetable.slots.forEach((slot, idx)=>{
      const sc = document.createElement('div'); sc.className='slot-card';
      const header = document.createElement('div'); header.style.display='flex'; header.style.justifyContent='space-between'; header.innerHTML = `<div style="font-weight:800">${slot.label}</div><div style="display:flex;gap:8px"><button class="btn ghost" data-idx="${idx}" data-act="edit">Edit</button><button class="btn ghost" data-idx="${idx}" data-act="del">Delete</button></div>`;
      sc.appendChild(header);
      const daysRow = document.createElement('div'); daysRow.style.display='flex'; daysRow.style.gap='8px'; daysRow.style.marginTop='10px';
      ['mon','tue','wed','thu','fri','sat'].forEach(day=>{
        const col = document.createElement('div'); col.style.flex='1';
        col.innerHTML = `<div class="day-card"><div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:700">${day.toUpperCase()}</div><div style="font-size:12px">${timetable.subjects.find(s=>s.code===slot.map[day])?.short || '—'}</div></div></div>`;
        const btn = document.createElement('button'); btn.className='btn ghost'; btn.textContent = 'Assign';
        btn.style.marginTop='8px'; btn.addEventListener('click', ()=> openChooser(idx, day, btn));
        col.appendChild(btn); daysRow.appendChild(col);
      });
      sc.appendChild(daysRow);
      slotsContainer.appendChild(sc);
    });
    // slot actions
    slotsContainer.querySelectorAll('button[data-act]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const idx = +b.dataset.idx;
        if(b.dataset.act === 'del'){ if(confirm('Delete slot?')){ timetable.slots.splice(idx,1); saveAndRender(); } }
        if(b.dataset.act === 'edit'){ const v = prompt('Label', timetable.slots[idx].label); if(v !== null){ timetable.slots[idx].label = v.trim(); saveAndRender(); } }
      });
    });
  }

  function render(){ renderSubjects(); renderSlots(); }
  render();
})();
