// visualization.js (replace file)
// relies on storage.js functions: loadTimetable(), loadAttendance(), START_DATE, startOfWeek(), isoDate(), weekNumberForDate(), weekLabelFromStartIso(), weekKeyFromDate()

(function(){
  let timetable = loadTimetable() || {subjects:[], slots:[]};
  let attendance = loadAttendance();

  const weekSelector = document.getElementById('weekSelector');
  const includeODChk = document.getElementById('includeOD');
  const cumulativeChk = document.getElementById('cumulative');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportBtn = document.getElementById('exportBtn');

  const totalVal = document.getElementById('totalVal'), presentVal = document.getElementById('presentVal'), absentVal = document.getElementById('absentVal'), odVal = document.getElementById('odVal');
  const pieCanvas = document.getElementById('pieChart');
  const barCanvas = document.getElementById('barChart');
  const subjectList = document.getElementById('subjectList');

  // make sure canvases' parents have an explicit height so Chart.js can render responsively
  pieCanvas.parentElement.style.minHeight = '220px';
  barCanvas.parentElement.style.minHeight = '220px';

  let pieChart = null, barChart = null;

  function buildWeekOptions(){
    weekSelector.innerHTML = '';
    // build a reasonable window of week starts from START_DATE for next 52 weeks
    const start = startOfWeek(START_DATE);
    const isoList = [];
    for(let i=0;i<52;i++){
      const d = new Date(start); d.setDate(start.getDate() + 7*i);
      isoList.push(isoDate(d));
    }
    // union with recorded weeks
    const recorded = Object.keys(attendance || {});
    const uniq = Array.from(new Set([...isoList, ...recorded])).sort();
    uniq.forEach(iso=>{
      const opt = document.createElement('option');
      opt.value = iso;
      opt.textContent = `Week ${weekNumberForDate(new Date(iso))} • ${weekLabelFromStartIso(iso)}`;
      weekSelector.appendChild(opt);
    });
    // default to current week if available else first
    const cw = weekKeyFromDate(new Date());
    if([...weekSelector.options].some(o=>o.value === cw)) weekSelector.value = cw;
    else if(weekSelector.options.length) weekSelector.selectedIndex = 0;
  }

  function collectWeeksToUse(selectedIso, cumulative){
    if(!cumulative) return [selectedIso];
    // accumulate weeks from START_DATE up to selectedIso inclusive
    const arr = [];
    let cur = startOfWeek(START_DATE);
    const end = startOfWeek(new Date(selectedIso));
    while(cur <= end){
      arr.push(isoDate(cur));
      cur = new Date(cur.getTime() + 7*24*60*60*1000);
    }
    return arr;
  }

  function computeDataForWeeks(weekIsos, includeOD){
    const totals = { total:0, present:0, absent:0, od:0 };
    const perSub = {}; // code -> {total,present,absent,od}
    for(const wk of weekIsos){
      const recs = attendance[wk] || {};
      for(const k in recs){
        const r = recs[k];
        if(!r || !r.subject) continue;
        if(r.status === 'H') continue; // skip holiday
        totals.total++;
        if(!perSub[r.subject]) perSub[r.subject] = { total:0, present:0, absent:0, od:0 };
        perSub[r.subject].total++;
        if(r.status === 'P'){ totals.present++; perSub[r.subject].present++; }
        else if(r.status === 'A'){ totals.absent++; perSub[r.subject].absent++; }
        else if(r.status === 'OD'){ totals.od++; perSub[r.subject].od++; }
      }
    }

    // for pie calculation: includeOD determines whether OD counts as present or absent
    const piePresent = totals.present + (includeOD ? totals.od : 0);
    const pieAbsent = totals.absent + (includeOD ? 0 : totals.od);

    return { totals, perSub, piePresent, pieAbsent };
  }

  function renderTotals(totals){
    totalVal.textContent = totals.total;
    presentVal.textContent = totals.present;
    absentVal.textContent = totals.absent;
    odVal.textContent = totals.od;
  }

  function renderPie(presentCount, absentCount){
    const ctx = pieCanvas.getContext('2d');
    if(pieChart) pieChart.destroy();
    pieChart = new Chart(ctx, {
      type:'doughnut',
      data:{ labels:['Present','Absent'], datasets:[{ data:[presentCount, absentCount], backgroundColor:['#10b981','#ef4444'] }] },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom' } }
      }
    });
  }

  function renderBarAndProgress(perSub, includeOD){
    const codes = Object.keys(perSub);
    const labels = codes.map(c=>{
      const s = timetable.subjects.find(x=>x.code===c);
      return s ? (s.short || s.code) : c;
    });
    const values = codes.map(c=>{
      const s = perSub[c];
      const presentCount = includeOD ? s.present + s.od : s.present;
      return s.total ? Math.round((presentCount / s.total) * 100) : 0;
    });

    // bar chart
    const ctxB = barCanvas.getContext('2d');
    if(barChart) barChart.destroy();
    barChart = new Chart(ctxB, {
      type:'bar',
      data:{
        labels,
        datasets:[{ label:'Attendance %', data: values, backgroundColor: labels.map((_,i)=> palette(i)) }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{ legend:{ display:false } },
        scales:{ y:{ beginAtZero:true, max:100, ticks:{ callback: v => v + '%' } } }
      }
    });

    // progress rows - responsive
    subjectList.innerHTML = '';
    codes.forEach((c,i)=>{
      const s = perSub[c];
      const presentCount = includeOD ? s.present + s.od : s.present;
      const pct = s.total ? Math.round((presentCount / s.total) * 100) : 0;
      const sMeta = timetable.subjects.find(x=>x.code===c) || {short:c, name:c};

      const row = document.createElement('div');
      row.className = 'subject-row';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '12px';
      row.style.marginBottom = '10px';
      row.style.flexWrap = 'wrap';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '12px';
      left.style.minWidth = '0'; // allow shrinking

      const pill = document.createElement('div');
      pill.className = 'short-pill';
      pill.textContent = sMeta.short || c;

      const meta = document.createElement('div');
      meta.innerHTML = `<div style="font-weight:800">${escapeHtml(sMeta.name || c)}</div><div class="small" style="color:#556">${presentCount}/${s.total} • ${pct}%</div>`;

      left.appendChild(pill);
      left.appendChild(meta);

      const right = document.createElement('div');
      right.style.flex = '1 1 200px'; // flexible and shrinkable
      right.style.minWidth = '0';

      const progWrap = document.createElement('div');
      progWrap.style.width = '100%';
      progWrap.style.background = '#eef6ff';
      progWrap.style.borderRadius = '999px';
      progWrap.style.overflow = 'hidden';
      progWrap.style.height = '12px';

      const fill = document.createElement('div');
      fill.style.width = pct + '%';
      fill.style.height = '100%';
      fill.style.background = paletteColor(pct);
      fill.style.transition = 'width 0.4s ease';

      progWrap.appendChild(fill);
      right.appendChild(progWrap);

      row.appendChild(left);
      row.appendChild(right);
      subjectList.appendChild(row);
    });
  }

  function palette(i){
    const arr = ['#7c3aed','#06b6d4','#f97316','#ef4444','#10b981','#c026d3','#0ea5a4','#f59e0b'];
    return arr[i % arr.length];
  }
  function paletteColor(pct){
    if(pct >= 75) return '#10b981';
    if(pct >= 50) return '#0f6ff5';
    return '#ef4444';
  }
  function escapeHtml(s){ if(!s && s!==0) return ''; return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }

  function renderAll(){
    attendance = loadAttendance();
    timetable = loadTimetable() || {subjects:[], slots:[]};
    const selectedIso = weekSelector.value || weekKeyFromDate(new Date());
    const cumulative = !!cumulativeChk.checked;
    const includeOD = !!includeODChk.checked;
    const weeksToUse = collectWeeksToUse(selectedIso, cumulative);
    const { totals, perSub, piePresent, pieAbsent } = computeDataForWeeks(weeksToUse, includeOD);

    renderTotals(totals);
    renderPie(piePresent, pieAbsent);
    renderBarAndProgress(perSub, includeOD);
  }

  exportBtn.addEventListener('click', ()=>{
    const payload = { version:'v2', timetable, attendance: loadAttendance() };
    const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'attendance_export_v2.json'; a.click();
    URL.revokeObjectURL(url);
  });

  refreshBtn.addEventListener('click', renderAll);
  includeODChk.addEventListener('change', renderAll);
  cumulativeChk.addEventListener('change', renderAll);
  weekSelector.addEventListener('change', renderAll);

  function init(){
    buildWeekOptions();
    renderAll();
  }
  init();
})();
