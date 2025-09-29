// storage.js (replace your file with this)
// small storage / date helpers used across pages

// Fixed START DATE (Week 1 anchor)
const START_DATE = new Date(2025, 6, 14); // month=6 -> July (0-indexed)

// Keys
const TT_KEY = 'timetable_v2';
const ATT_KEY = 'attendance_v2';

function defaultTimetable() {
  return {
    subjects: [
      { code: 'CSE407', name: 'Cloud Computing', short: 'CC' },
      { code: 'CSE409', name: 'Parallel & Distributed', short: 'PDS' },
      { code: 'CSE411', name: 'PDS Lab', short: 'PDS-L' },
      { code: 'CSE415', name: 'Internet of Things', short: 'IoT' }
    ],
    slots: [
      { id: 's1', label: '08:45-09:45', map:{ mon:'CSE409', tue:'CSE407', wed:'CSE411', thu:'CSE415', fri:'CSE407', sat:'' } },
      { id: 's2', label: '09:45-10:45', map:{ mon:'CSE411', tue:'', wed:'CSE411', thu:'CSE407', fri:'CSE409', sat:'' } }
    ]
  };
}

function loadTimetable(){
  try{
    const raw = localStorage.getItem(TT_KEY);
    if(!raw){
      const def = defaultTimetable();
      saveTimetable(def);
      return def;
    }
    return JSON.parse(raw);
  }catch(e){
    const def = defaultTimetable();
    saveTimetable(def);
    return def;
  }
}
function saveTimetable(obj){ localStorage.setItem(TT_KEY, JSON.stringify(obj)); }

function loadAttendance(){
  try{ return JSON.parse(localStorage.getItem(ATT_KEY) || '{}'); }catch(e){ return {}; }
}
function saveAttendance(obj){ localStorage.setItem(ATT_KEY, JSON.stringify(obj)); }

// Date / week helpers
function startOfWeek(date){
  const d = new Date(date);
  const day = d.getDay();
  // treat Monday as start: compute Monday of that week
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0,0,0,0);
  return d;
}
function isoDate(d){
  const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString().slice(0,10);
}
function weekKeyFromDate(date){ return isoDate(startOfWeek(date)); }

// week number relative to START_DATE
function weekNumberForDate(date){
  const a = startOfWeek(new Date(date));
  const b = startOfWeek(START_DATE);
  const diffDays = Math.round((a - b) / (1000*60*60*24));
  const n = Math.floor(diffDays / 7) + 1;
  return n >= 1 ? n : 1;
}
function weekLabelFromStartIso(iso){
  const s = new Date(iso);
  const e = new Date(s); e.setDate(s.getDate()+6);
  return s.toLocaleDateString() + ' — ' + e.toLocaleDateString();
}
