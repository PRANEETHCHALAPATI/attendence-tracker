/* remoteStorage.js — minimal drop-in API (loadTimetable, saveTimetable, loadAttendance, saveAttendance, week helpers)
   It uses global `supabase` (supabase-js). If user isn't signed in, falls back to localStorage.
*/

const TT_KEY = 'timetable_v2';
const ATT_KEY = 'attendance_v2';
const START_DATE = new Date(2025, 6, 14); // Jul 14 2025 (month index 6)

// -------------------- helpers --------------------
function isoDate(d){ const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString().slice(0,10); }
function startOfWeek(date){
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday as start
  d.setDate(d.getDate() - diff);
  d.setHours(0,0,0,0);
  return d;
}
function weekKeyFromDate(date){ return isoDate(startOfWeek(date)); }
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

// -------------------- auth helpers --------------------
async function getUserId(){
  const user = supabase.auth.user();
  return user ? user.id : null;
}

// -------------------- Timetable --------------------
async function loadTimetable(){
  const uid = await getUserId();
  if(!uid){
    // fallback to localStorage
    try{ return JSON.parse(localStorage.getItem(TT_KEY)); }catch(e){ return null; }
  }
  // fetch subjects and timetable for user
  const { data: subs } = await supabase.from('subjects').select('id,code,name,short').eq('user_id', uid);
  // fetch timetable rows
  const { data: ttRows } = await supabase.from('timetable').select('day_of_week,slot_label,slot_order,subject_id').eq('user_id', uid).order('slot_order', { ascending: true });
  // build slots keyed by label preserving slot_order
  const slotsMap = {};
  ttRows.forEach(r=>{
    if(!slotsMap[r.slot_label]) slotsMap[r.slot_label] = { id: 'slot_'+r.slot_label.replace(/\s+/g,'_'), label: r.slot_label, map: { mon:'',tue:'',wed:'',thu:'',fri:'',sat:'' } };
    const dayKey = ['mon','tue','wed','thu','fri','sat'][r.day_of_week-1];
    // resolve subject code
    const subj = subs.find(s=>s.id === r.subject_id);
    slotsMap[r.slot_label].map[dayKey] = subj ? subj.code : '';
  });
  return { subjects: subs.map(s=>({code:s.code,name:s.name,short:s.short})), slots: Object.values(slotsMap) };
}

async function saveTimetable(obj){
  const uid = await getUserId();
  if(!uid){
    localStorage.setItem(TT_KEY, JSON.stringify(obj));
    return true;
  }
  // upsert subjects
  const subjectsToUpsert = (obj.subjects||[]).map(s => ({ user_id: uid, code: s.code, name: s.name, short: s.short }));
  await supabase.from('subjects').upsert(subjectsToUpsert, { onConflict: ['user_id','code'] });

  // fetch subject ids map
  const { data: subs } = await supabase.from('subjects').select('id,code').eq('user_id', uid);
  const codeToId = {}; subs.forEach(s => codeToId[s.code] = s.id);

  // delete existing timetable for user then insert fresh rows (simple approach)
  await supabase.from('timetable').delete().eq('user_id', uid);
  const rows = [];
  (obj.slots||[]).forEach((slot, idx) => {
    ['mon','tue','wed','thu','fri','sat'].forEach((day, i) => {
      const code = slot.map[day] || null;
      rows.push({ user_id: uid, day_of_week: i+1, slot_label: slot.label, slot_order: idx, subject_id: code ? codeToId[code] : null });
    });
  });
  if(rows.length) await supabase.from('timetable').insert(rows);
  return true;
}

// -------------------- Attendance --------------------
/*
Our client app stores attendance as:
 attendance[weekIso][key] = { subject: 'CSE409', status:'P'/'A'/'OD'/'H', odReason: '...' }
where key is `${slotId}_${day}` (slotId corresponds to timetable slot.id).
For saving into DB we map weekIso + day -> real date and use slot_label to store.
*/
async function loadAttendance(){
  const uid = await getUserId();
  if(!uid){
    try{ return JSON.parse(localStorage.getItem(ATT_KEY) || '{}'); }catch(e){ return {}; }
  }
  const { data } = await supabase.from('attendance').select('date,slot_label,subjects(code),status,od_reason').eq('user_id', uid).order('date', { ascending: true });
  const out = {};
  (data||[]).forEach(r=>{
    const wk = weekKeyFromDate(new Date(r.date));
    if(!out[wk]) out[wk] = {};
    // create key: use slot_label + '_' + weekday name (client expects slotId_day but we don't have slotId; we use label_)
    const dateObj = new Date(r.date);
    const dayIndex = (dateObj.getDay() + 6) % 7; // 0..5 for mon..sat
    const dayName = ['mon','tue','wed','thu','fri','sat'][dayIndex];
    const key = `${r.slot_label.replace(/\s+/g,'_')}_${dayName}`;
    out[wk][key] = { subject: r.subjects?.code || null, status: r.status, odReason: r.od_reason || '' };
  });
  return out;
}

/*
Save attendance object to DB — BUT this is complex if we only have week-keyed object.
We provide a helper saveAttendanceForDate() which you can call per marking action.
*/
async function saveAttendanceForDate(dateStr, slotLabel, subjectCode, status, odReason){
  const uid = await getUserId();
  if(!uid){
    // local fallback store into local structure keyed by weekIso (client already does)
    const raw = JSON.parse(localStorage.getItem(ATT_KEY) || '{}');
    const wk = weekKeyFromDate(new Date(dateStr));
    if(!raw[wk]) raw[wk] = {};
    const d = new Date(dateStr);
    const dayIndex = (d.getDay() + 6) % 7;
    const dayName = ['mon','tue','wed','thu','fri','sat'][dayIndex];
    const key = `${slotLabel.replace(/\s+/g,'_')}_${dayName}`;
    raw[wk][key] = { subject: subjectCode, status, odReason: odReason || '' };
    localStorage.setItem(ATT_KEY, JSON.stringify(raw));
    return true;
  }

  // resolve subject id if subjectCode provided
  let subject_id = null;
  if(subjectCode){
    const { data: sdata } = await supabase.from('subjects').select('id').eq('user_id', uid).eq('code', subjectCode).limit(1);
    if(sdata && sdata[0]) subject_id = sdata[0].id;
  }

  // upsert by unique constraint (user_id,date,slot_label)
  const payload = {
    user_id: uid,
    date: dateStr,
    slot_label: slotLabel,
    subject_id,
    status,
    od_reason: odReason || null
  };
  const { error } = await supabase.from('attendance').upsert([payload], { onConflict: ['user_id','date','slot_label'] });
  if(error) { console.error('saveAttendanceForDate error', error); return false; }
  return true;
}

/* simple sign-in/out helpers (caller should show UI) */
async function signIn(email, password){ return supabase.auth.signIn({ email, password }); }
async function signUp(email, password, fullName){
  const { user, error } = await supabase.auth.signUp({ email, password });
  if(error) throw error;
  if(user) await supabase.from('profiles').insert([{ id: user.id, full_name: fullName }]);
  return user;
}
async function signOut(){ return supabase.auth.signOut(); }
