import { useState } from 'react';
import { CalendarDays, Clock3, Ban, Plus, Trash2, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DemoState, DiaryBlock, Instructor, WeeklyWindow } from './model';
import { DAYS, formatDay, isoDay, minuteTime, slotsForDate, timeMinutes, ukClock, validWindow } from './scheduling';

interface Props {
  instructor: Instructor;
  demo: DemoState;
  onAddWindow: (window:WeeklyWindow) => void;
  onRemoveWindow: (id:string) => void;
  onAddBlock: (block:DiaryBlock) => void;
  onRemoveBlock: (id:string) => void;
}
const makeId=()=>typeof crypto!=='undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'demo-'+Date.now();
export default function InstructorDiary({instructor,demo,onAddWindow,onRemoveWindow,onAddBlock,onRemoveBlock}:Props) {
  const [weekday,setWeekday]=useState(1);
  const [from,setFrom]=useState('09:00');
  const [to,setTo]=useState('12:00');
  const [blockedDate,setBlockedDate]=useState(ukClock().date);
  const [allDay,setAllDay]=useState(true);
  const [blockedFrom,setBlockedFrom]=useState('09:00');
  const [blockedTo,setBlockedTo]=useState('17:00');
  const [note,setNote]=useState('Personal time');
  const [selectedDay,setSelectedDay]=useState(ukClock().date);
  const [offset,setOffset]=useState(0);
  const [message,setMessage]=useState('');

  const windows=demo.weeklyWindows.filter(w=>w.instructorId===instructor.id);
  const blocks=demo.diaryBlocks.filter(b=>b.instructorId===instructor.id).sort((a,b)=>a.date.localeCompare(b.date));
  const activeLessons=demo.lessons.filter(l=>l.instructorId===instructor.id && l.date===selectedDay && l.status!=='cancelled' && l.status!=='declined');
  const daySlots=slotsForDate(instructor.id,selectedDay,60,demo);
  const dates=Array.from({length:7},(_,i)=>isoDay(ukClock().date,offset*7+i));

  function addWindow(){
    setMessage('');
    if(!validWindow(from,to)){setMessage('Choose a valid start and finish time.');return;}
    const conflict=windows.some(w=>w.weekday===weekday && timeMinutes(from)<timeMinutes(w.end) && timeMinutes(w.start)<timeMinutes(to));
    if(conflict){setMessage('That time overlaps another weekly availability window.');return;}
    onAddWindow({id:makeId(),instructorId:instructor.id,weekday,start:from,end:to});
    setMessage('Weekly availability added.');
  }
  function addBlock(){
    setMessage('');
    const start=allDay?'00:00':blockedFrom,end=allDay?'24:00':blockedTo;
    if(blockedDate<ukClock().date || !validWindow(start,end)){setMessage('Choose a future date and a valid time range.');return;}
    const conflicts=demo.lessons.some(l=>l.instructorId===instructor.id && l.date===blockedDate &&
      !['declined','cancelled'].includes(l.status) &&
      timeMinutes(start)<timeMinutes(l.time)+l.duration && timeMinutes(l.time)<timeMinutes(end));
    if(conflicts){setMessage('A lesson is already booked during that period. Reschedule or cancel it before blocking.');return;}
    onAddBlock({id:makeId(),instructorId:instructor.id,date:blockedDate,start,end,note:note.trim().slice(0,70)||'Unavailable'});
    setMessage('Time blocked in your demo diary.');
  }
  return <section className="diary-shell">
    <div className="diary-heading"><div><span className="eyebrow">INSTRUCTOR DIARY · DEMO</span><h2>Manage availability</h2><p>Set repeat working hours, block personal time and see the lessons already in your calendar.</p></div><span className="diary-timezone"><Clock3 size={15}/> Europe/London</span></div>
    <div className="diary-columns">
      <div className="diary-card">
        <div className="diary-section-head"><CalendarDays size={19}/><h3>Weekly working hours</h3></div>
        <p className="diary-help">Add multiple windows for a day, such as 9am–12pm and 1pm–5pm. Remove a window to make those times unavailable.</p>
        <div className="diary-weekly-list">{DAYS.map((day,index)=><div className="diary-weekday" key={day}>
          <strong>{day}</strong>
          <div>{windows.filter(w=>w.weekday===index).sort((a,b)=>a.start.localeCompare(b.start)).map(w=><span className="diary-window" key={w.id}>{w.start}–{w.end}<button type="button" aria-label={'Remove '+day+' '+w.start+' to '+w.end} onClick={()=>onRemoveWindow(w.id)}><Trash2 size={13}/></button></span>)}{!windows.some(w=>w.weekday===index)&&<span className="diary-dayoff">Not working</span>}</div>
        </div>)}</div>
        <div className="diary-add-form">
          <label>Day<select value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>{DAYS.map((d,i)=><option value={i} key={d}>{d}</option>)}</select></label>
          <label>From<input type="time" step="1800" value={from} onChange={e=>setFrom(e.target.value)}/></label>
          <label>To<input type="time" step="1800" value={to} onChange={e=>setTo(e.target.value)}/></label>
          <button type="button" onClick={addWindow}><Plus size={15}/> Add hours</button>
        </div>
      </div>
      <div className="diary-card">
        <div className="diary-section-head"><Ban size={19}/><h3>Time off & exceptions</h3></div>
        <p className="diary-help">Block a full day or a part of it. Existing lesson bookings are protected.</p>
        <div className="diary-block-form">
          <label>Unavailable date<input type="date" min={ukClock().date} value={blockedDate} onChange={e=>setBlockedDate(e.target.value)}/></label>
          <label className="diary-inline-check"><input type="checkbox" checked={allDay} onChange={e=>setAllDay(e.target.checked)}/> All day</label>
          {!allDay&&<div className="diary-timepair"><label>From<input type="time" value={blockedFrom} onChange={e=>setBlockedFrom(e.target.value)}/></label><label>To<input type="time" value={blockedTo} onChange={e=>setBlockedTo(e.target.value)}/></label></div>}
          <label>Reason (only shown to you)<input maxLength={70} value={note} onChange={e=>setNote(e.target.value)}/></label>
          <button type="button" onClick={addBlock}><Plus size={16}/> Block this time</button>
        </div>
        <h4>Upcoming blocks</h4>
        {blocks.filter(b=>b.date>=ukClock().date).length ? <div className="diary-block-list">{blocks.filter(b=>b.date>=ukClock().date).slice(0,12).map(b=><div key={b.id}><span><strong>{formatDay(b.date)}</strong><small>{b.start==='00:00'&&b.end==='24:00'?'All day':b.start+'–'+b.end} · {b.note}</small></span><button type="button" aria-label={'Unblock '+b.date} onClick={()=>onRemoveBlock(b.id)}><Trash2 size={17}/></button></div>)}</div>:<p className="diary-empty">No time off blocked yet.</p>}
      </div>
    </div>
    {message&&<p className="diary-feedback" role="status">{message}</p>}
    <div className="diary-card diary-calendar">
      <div className="diary-section-head"><CalendarDays size={19}/><h3>Calendar preview</h3><div className="diary-week-nav"><button type="button" disabled={offset===0} aria-label="Previous week" onClick={()=>{setOffset(x=>Math.max(0,x-1));setSelectedDay(isoDay(ukClock().date,(offset-1)*7));}}><ChevronLeft size={18}/></button><button type="button" aria-label="Next week" onClick={()=>{setOffset(x=>x+1);setSelectedDay(isoDay(ukClock().date,(offset+1)*7));}}><ChevronRight size={18}/></button></div></div>
      <div className="diary-date-strip">{dates.map(date=><button type="button" key={date} aria-pressed={selectedDay===date} className={selectedDay===date?'selected':''} onClick={()=>setSelectedDay(date)}><span>{formatDay(date)}</span><small>{demo.lessons.filter(l=>l.instructorId===instructor.id&&l.date===date&&!['cancelled','declined'].includes(l.status)).length} booked</small></button>)}</div>
      <h4>{formatDay(selectedDay)} · {daySlots.length} available one-hour starts</h4>
      <div className="diary-calendar-slots">{daySlots.length ? daySlots.slice(0,24).map(s=><span className="diary-free-slot" key={s.time}>{s.time} <small>Free</small></span>):<p className="diary-empty">No one-hour starts available on this day.</p>}</div>
      {activeLessons.length>0&&<><h4>Booked or requested</h4><div className="diary-booked-list">{activeLessons.map(l=><div key={l.id}><strong>{l.time}–{minuteTime(timeMinutes(l.time)+l.duration)}</strong><span>{l.customer} · {l.status} · {l.duration} min{l.blockBookingId?' · Block booking':''}</span></div>)}</div></>}
      <p className="diary-caveat"><ShieldCheck size={16}/> This calendar is stored only in this browser. Real cross-user slots and bookings will need a server-side database and collision-safe reservations.</p>
    </div>
  </section>;
}
