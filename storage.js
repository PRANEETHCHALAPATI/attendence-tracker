// storage.js - small wrapper
const TT_KEY = 'timetable_v2';
const ATT_KEY = 'attendance_v2';

// START_DATE: anchor July 14 of current year (Week 1)
const START_DATE = (() => {
  const y = new Date().getFullYear();
  return new Date(y, 6, 14); // month 6 -> July
})();

function loadTimetable(){
  const s = localStorage.getItem(TT_KEY);
  if(!s) return null;
  try{ return JSON.parse(s); }catch(e){ return null; }
}
function saveTimetable(obj){ localStorage.setItem(TT_KEY, JSON.stringify(obj)); }

function loadAttendance(){ try{ return JSON.parse(localStorage.getItem(ATT_KEY) || '{}'); }catch(e){ return {}; } }
function saveAttendance(obj){ localStorage.setItem(ATT_KEY, JSON.stringify(obj)); }

// week helpers
function startOfWeek(date){ const d = new Date(date); const day = d.getDay(); const diff = (day + 6) % 7; d.setDate(d.getDate() - diff); d.setHours(0,0,0,0); return d; }
function isoDate(d){ const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString().slice(0,10); }
function weekKeyFromDate(date){
  const s = startOfWeek(date);
  return isoDate(s); // use week-start ISO as key
}
function weekNumberForDate(date){
  const start = startOfWeek(START_DATE);
  const target = startOfWeek(date);
  const diffDays = Math.round((target - start) / (1000*60*60*24));
  const n = Math.floor(diffDays / 7) + 1;
  return n >= 1 ? n : 1;
}
function weekLabelFromStartIso(iso){
  const s = new Date(iso); const e = new Date(s); e.setDate(s.getDate()+6);
  return s.toLocaleDateString() + ' — ' + e.toLocaleDateString();
}
