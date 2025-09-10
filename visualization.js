// visualization.js (updated)
// Uses storage.js helpers: loadTimetable(), loadAttendance(), START_DATE, weekKeyFromDate(), weekNumberForDate(), weekLabelFromStartIso(), isoDate(), startOfWeek()

(function(){
  let timetable = loadTimetable() || {subjects:[], slots:[]};
  let attendance = loadAttendance();

  // DOM
  const weekSelector = document.getElementById('weekSelector');
  const includeODChk = document.getElementById('includeOD');
  const cumulativeChk = document.getElementById('cumulative');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportBtn = document.getElementById('exportBtn');

  const totalVal = document.getElementById('totalVal'), presentVal = document.getElementById('presentVal'), absentVal = document.getElementById('absentVal'), odVal = document.getElementById('odVal');
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  const barCtx = document.getElementById('barChart').getContext('2d');
  const subjectList = document.getElementById('subjectList');

  let pieChart = null, barChart = null;

  function buildWeekOptions(){
    weekSelector.innerHTML = '';
    // weeks window from START_DATE (26 weeks)
    const start = startOfWeek(START_DATE);
    const opts = [];
    for(let i=1;i<53;i++){
      const s = new Date(start); s.setDate(start.getDate() + 7*i);
      const iso = isoDate(s);
      opts.push(iso);
    }
    // add any recorded weeks as well
    const recorded = Object.keys(attendance || {});
    const uniq = Array.from(new Set([...opts, ...recorded])).sort();
    uniq.forEach(iso=>{
      const opt = document.createElement('option');
      opt.value = iso;
      opt.textContent = `Week ${weekNumberForDate(new Date(iso))} • ${weekLabelFromStartIso(iso)}`;
      weekSelector.appendChild(opt);
    });
    // default to current week start
    const cw = weekKeyFromDate(new Date());
    if(Array.from(weekSelector.options).some(o=>o.value === cw)) weekSelector.value = cw;
    else if(weekSelector.options.length) weekSelector.selectedIndex = 0;
  }

  function collectWeeksToUse(selectedIso, cumulative){
    if(!cumulative) return [selectedIso];
    // cumulative: all week starts from START_DATE up to selectedIso
    const arr = [];
    // iterate weeks from START_DATE until selectedIso inclusive
    let cur = startOfWeek(START_DATE);
    const end = new Date(selectedIso);
    while(cur <= end){
      arr.push(isoDate(cur));
      cur = new Date(cur.getTime() + 7*24*60*60*1000);
    }
    // include only those with any attendance or keep them (we can include even if no data)
    return arr;
  }

  function computeDataForWeeks(weekIsos, includeOD){
    // weekIsos: array of week ISO start strings
    // includeOD: boolean -> treat OD as Present (true) or Absent (false)
    const totals = { total:0, present:0, absent:0, od:0 };
    const perSub = {}; // code -> {total,present,absent,od}

    for(const wk of weekIsos){
      const recs = attendance[wk] || {};
      for(const key in recs){
        const r = recs[key];
        if(!r || !r.subject) continue;
        if(r.status === 'H') continue; // skip holidays from totals
        totals.total++;
        if(!perSub[r.subject]) perSub[r.subject] = { total:0, present:0, absent:0, od:0 };
        perSub[r.subject].total++;

        if(r.status === 'P'){ totals.present++; perSub[r.subject].present++; }
        else if(r.status === 'A'){ totals.absent++; perSub[r.subject].absent++; }
        else if(r.status === 'OD'){ totals.od++; perSub[r.subject].od++; }
      }
    }

    // Construct pie values according to includeOD
    let piePresent = totals.present;
    let pieAbsent = totals.absent;
    if(includeOD){
      piePresent += totals.od;
    } else {
      pieAbsent += totals.od;
    }

    return { totals, perSub, piePresent, pieAbsent };
  }

  function renderTotals(totals){
    totalVal.textContent = totals.total;
    presentVal.textContent = totals.present;
    absentVal.textContent = totals.absent;
    odVal.textContent = totals.od;
  }

  function renderPie(presentCount, absentCount){
    if(pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type:'doughnut',
      data:{
        labels:['Present','Absent'],
        datasets:[{ data:[presentCount, absentCount], backgroundColor:['#10b981','#ef4444'] }]
      },
      options:{ plugins:{ legend:{ position:'bottom' } }, maintainAspectRatio: false }
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
      return s.total ? Math.round((presentCount / s.total)*100) : 0;
    });

    if(barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type:'bar',
      data:{
        labels,
        datasets:[{
          label: 'Attendance %',
          data: values,
          backgroundColor: labels.map((_,i)=> palette(i))
        }]
      },
      options:{
        plugins:{ legend:{ display:false } },
        scales:{ y:{ beginAtZero:true, max:100, ticks:{ callback: v => v + '%' } } },
        maintainAspectRatio: false
      }
    });

    // progress bars
    subjectList.innerHTML = '';
    codes.forEach((c, i)=>{
      const s = perSub[c];
      const presentCount = includeOD ? s.present + s.od : s.present;
      const pct = s.total ? Math.round((presentCount / s.total)*100) : 0;
      const sMeta = timetable.subjects.find(x=>x.code===c) || {short:c, name:c};
      const row = document.createElement('div');
      row.style.display='flex'; row.style.alignItems='center'; row.style.justifyContent='space-between';
      row.style.marginBottom='8px';
      row.innerHTML = `
        <div style="display:flex;gap:10px;align-items:center">
          <div style="width:56px;height:36px;border-radius:8px;background:linear-gradient(90deg, rgba(124,58,237,0.10), rgba(6,182,212,0.06));display:flex;align-items:center;justify-content:center;font-weight:400">${escapeHtml(sMeta.short || c)}</div>
          <div>
            <div style="font-weight:400;letter-spacing:1px">${escapeHtml(sMeta.name || c)}</div>
            <div class="small" style="color:#556">${presentCount}/${s.total} • ${pct}%</div>
          </div>
        </div>
        <div style="flex-basis:260px;max-width:260px">
          <div style="height:12px;background:#eef6ff;border-radius:999px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${paletteColor(pct)}"></div>
          </div>
        </div>
      `;
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

  // main render
  function renderAll(){
    attendance = loadAttendance();
    timetable = loadTimetable() || {subjects:[], slots:[]};
    const selectedIso = weekSelector.value || weekKeyFromDate(new Date());
    const cumulative = !!cumulativeChk.checked;
    const includeOD = !!includeODChk.checked;
    const weeksToUse = collectWeeksToUse(selectedIso, cumulative);
    const { totals, perSub, piePresent, pieAbsent } = computeDataForWeeks(weeksToUse, includeOD);

    // Totals for cards should reflect raw totals (not the pie adjustments)
    renderTotals(totals);

    // Pie uses piePresent/pieAbsent
    renderPie(piePresent, pieAbsent);

    // Bar chart & progress use perSub + includeOD
    renderBarAndProgress(perSub, includeOD);
  }

  // Export
  exportBtn.addEventListener('click', ()=>{
    const payload = {version:'v2', timetable, attendance: loadAttendance()};
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'attendance_export_v2.json'; a.click();
    URL.revokeObjectURL(url);
  });

  refreshBtn.addEventListener('click', renderAll);
  includeODChk.addEventListener('change', renderAll);
  cumulativeChk.addEventListener('change', renderAll);
  weekSelector.addEventListener('change', renderAll);

  // init
  function init(){
    buildWeekOptions();
    renderAll();
  }
  init();
})();
