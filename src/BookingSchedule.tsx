import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Layers3, MapPin, ShieldCheck, Zap } from 'lucide-react';
import type { BookingMode, DemoState, Instructor, SearchPreferences, SlotSelection, Transmission } from './model';
import { formatGBP } from './model';
import { availableRecurringSeries, formatDay, isoDay, isSlotOpen, seriesAvailable, slotsForDate, timeMinutes, ukClock } from './scheduling';

interface Props {
  initialMode: BookingMode;
  prefs: SearchPreferences;
  onPrefs: (prefs:SearchPreferences)=>void;
  instructorId:string;
  onInstructor: (id:string)=>void;
  instructors:Instructor[];
  state:DemoState;
  onProceed:(slots:SlotSelection[],instructorId:string)=>void;
  onBack:()=>void;
}
const DURATIONS=[60,90,120];
export default function BookingSchedule({initialMode,prefs,onPrefs,instructorId,onInstructor,instructors,state,onProceed,onBack}:Props) {
  const [mode,setMode]=useState<BookingMode>(initialMode);
  const [date,setDate]=useState(ukClock().date);
  const [blockCount,setBlockCount]=useState(5);
  const [pattern,setPattern]=useState<'weekly'|'custom'>('weekly');
  const [chosen,setChosen]=useState<SlotSelection[]>([]);
  const [error,setError]=useState('');
  const availableInstructors=instructors.filter(i=>i.transmission.includes(prefs.transmission));
  const instructor=availableInstructors.find(i=>i.id===instructorId) ?? availableInstructors[0];
  const chosenId=instructor?.id ?? '';
  const clock=ukClock();
  const todaySlots=instructor?slotsForDate(chosenId,clock.date,prefs.duration,state).filter(s=>timeMinutes(s.time)<=clock.minutes+360):[];
  const options=instructor?slotsForDate(chosenId,date,prefs.duration,state):[];
  const firstDateRecurring=instructor?availableRecurringSeries(chosenId,date,prefs.duration,blockCount,state):[];
  const blockProposals=mode==='block' && pattern==='weekly'?firstDateRecurring:[];
  const chosenValid=instructor && chosen.length>0 && seriesAvailable(chosenId,chosen,state);
  const ready=mode==='block'?chosen.length===blockCount && Boolean(chosenValid):chosen.length===1 && Boolean(chosenValid);
  useEffect(()=>{setChosen([]);setError('')},[mode,date,blockCount,pattern,prefs.duration,prefs.transmission,instructorId]);
  function go(){
    if(prefs.location.trim().length<3){setError('Enter a pick-up postcode or area.');return;}
    if(!ready||!instructor){setError('Select available lesson times before continuing.');return;}
    onProceed(chosen.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)),instructor.id);
  }
  function chooseSingle(slot:SlotSelection){setChosen([slot]);setError('');}
  function chooseWeekly(series:SlotSelection[]){setChosen(series);setError('');}
  function toggleCustom(slot:SlotSelection){
    if(chosen.some(s=>s.date===slot.date&&s.time===slot.time)){setChosen(old=>old.filter(s=>s.date!==slot.date||s.time!==slot.time));return;}
    if(chosen.length>=blockCount){setError('Remove a selected session before adding another.');return;}
    const next=[...chosen,slot];
    if(!instructor||!seriesAvailable(instructor.id,next,state)){setError('That session overlaps another selected slot or is no longer available.');return;}
    setChosen(next);setError('');
  }
  const pageTitle=mode==='now'?'Book a lesson soon':mode==='ahead'?'Choose an available lesson':'Book a block of lessons';
  const price=instructor?Math.round(instructor.price*prefs.duration/60)*chosen.length:0;

  return <section className="booking-schedule">
    <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16}/> Back to Discover</button>
    <span className="eyebrow">AVAILABILITY SEARCH · INTERACTIVE DEMO</span><h1>{pageTitle}</h1>
    <p className="booking-schedule-intro">See available sessions from the instructor diary. All profiles and calendar entries are examples from this browser, not live driving lesson inventory.</p>
    <div className="booking-mode-tabs" role="group" aria-label="Booking type">
      <button type="button" className={mode==='now'?'active':''} aria-pressed={mode==='now'} onClick={()=>setMode('now')}><Zap size={18}/> Book now</button>
      <button type="button" className={mode==='ahead'?'active':''} aria-pressed={mode==='ahead'} onClick={()=>setMode('ahead')}><CalendarDays size={18}/> Book ahead</button>
      <button type="button" className={mode==='block'?'active':''} aria-pressed={mode==='block'} onClick={()=>setMode('block')}><Layers3 size={18}/> Block booking</button>
    </div>
    <div className="booking-discovery-grid">
      <div className="booking-search-card">
        <h2>Find the right availability</h2>
        <div className="booking-fields">
          <label><MapPin size={16}/> Pick-up location<input value={prefs.location} placeholder="Leeds or UK postcode" onChange={e=>onPrefs({...prefs,location:e.target.value})}/></label>
          <label>Transmission<select value={prefs.transmission} onChange={e=>onPrefs({...prefs,transmission:e.target.value as Transmission})}><option>Manual</option><option>Automatic</option></select></label>
          <label>Lesson length<select value={prefs.duration} onChange={e=>onPrefs({...prefs,duration:Number(e.target.value)})}>{DURATIONS.map(d=><option value={d} key={d}>{d} minutes</option>)}</select></label>
        </div>
        <label className="booking-select-instructor">Instructor<select value={chosenId} onChange={e=>onInstructor(e.target.value)}>{availableInstructors.map(i=><option value={i.id} key={i.id}>{i.name} · {formatGBP(i.price)}/hour · {i.car}</option>)}</select></label>
        {mode==='block'&&<>
          <div className="booking-block-options"><label>Number of lessons<select value={blockCount} onChange={e=>setBlockCount(Number(e.target.value))}><option value={5}>5 lessons</option><option value={10}>10 lessons</option></select></label><label>Booking pattern<select value={pattern} onChange={e=>setPattern(e.target.value as 'weekly'|'custom')}><option value="weekly">Same day & time weekly</option><option value="custom">Choose dates individually</option></select></label></div>
        </>}
        {mode!=='now'&&<label className="booking-date-label"><CalendarDays size={16}/> {mode==='block'&&pattern==='weekly'?'First lesson date':'Find slots on'}<input type="date" min={clock.date} max={isoDay(clock.date,90)} value={date} onChange={e=>setDate(e.target.value)}/></label>}
        <div className="booking-available-heading"><h3>{mode==='now'?'Available in the next 6 hours':pattern==='weekly'&&mode==='block'?'Complete weekly series':'Available start times'}</h3><span>{mode==='now'?todaySlots.length:mode==='block'&&pattern==='weekly'?blockProposals.length:options.length} options</span></div>
        {!instructor&&<p className="booking-empty">No sample instructors offer that transmission.</p>}
        {mode==='now'&&<>{todaySlots.length?<div className="booking-slot-grid">{todaySlots.map(s=><button type="button" className={chosen.some(x=>x.date===s.date&&x.time===s.time)?'selected':''} key={s.time} onClick={()=>chooseSingle(s)}>{s.time}<small>Today · {formatGBP(instructor.price*prefs.duration/60)}</small></button>)}</div>:<div className="booking-empty">No short-notice starts are available. Try Book ahead instead.</div>}</>}
        {mode==='ahead'&&<>{options.length?<div className="booking-slot-grid">{options.map(s=><button type="button" className={chosen.some(x=>x.date===s.date&&x.time===s.time)?'selected':''} key={s.time} onClick={()=>chooseSingle(s)}>{s.time}<small>{formatDay(s.date)}</small></button>)}</div>:<p className="booking-empty">No suitable starts on this date. Choose another day or instructor.</p>}</>}
        {mode==='block'&&pattern==='weekly'&&<>{blockProposals.length?<div className="booking-slot-grid">{blockProposals.map(series=><button type="button" className={chosen[0]?.time===series[0].time&&chosen[0]?.date===series[0].date?'selected':''} key={series[0].time} onClick={()=>chooseWeekly(series)}>{series[0].time}<small>{blockCount} weeks available</small></button>)}</div>:<p className="booking-empty">This instructor does not have {blockCount} matching weekly slots starting on {formatDay(date)}. Try another first date, duration or instructor.</p>}</>}
        {mode==='block'&&pattern==='custom'&&<>
          <p className="booking-helper">Choose {blockCount} separate dates and times. Change the date above as you add sessions. {chosen.length} of {blockCount} selected.</p>
          {options.length?<div className="booking-slot-grid">{options.map(s=><button type="button" className={chosen.some(x=>x.date===s.date&&x.time===s.time)?'selected':''} key={s.time} onClick={()=>toggleCustom(s)}>{s.time}<small>{formatDay(s.date)}</small></button>)}</div>:<p className="booking-empty">No available starts on {formatDay(date)}. Try another date.</p>}
        </>}
        {error&&<p className="booking-error" role="alert">{error}</p>}
      </div>
      <aside className="booking-summary-card">
        <span className="eyebrow">YOUR RESERVATION · DEMO</span><h2>{mode==='block'?'Block booking overview':'Lesson overview'}</h2>
        <p>Instructor: <strong>{instructor?.name??'Choose an instructor'}</strong></p><p>Lesson duration: <strong>{prefs.duration} minutes</strong></p>
        <div className="booking-selection-list">{chosen.length?chosen.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map((s,i)=><div key={s.date+s.time}><span><strong>{formatDay(s.date)}</strong><small>{s.time} – {String(Math.floor((timeMinutes(s.time)+s.duration)/60)).padStart(2,'0')}:{String((timeMinutes(s.time)+s.duration)%60).padStart(2,'0')}</small></span>{mode==='block'&&<small>#{i+1}</small>}</div>):<div className="booking-no-selection">Choose {mode==='block'?'a full series of lessons':'an available time'} to see your booking here.</div>}</div>
        <div className="booking-total"><span>Demo total · no discount applied</span><strong>{formatGBP(price)}</strong></div>
        {mode==='block'&&<p className="booking-small-print">All {blockCount} lessons are grouped together. Each lesson appears separately in the instructor diary. No real payment or booking occurs.</p>}
        <button type="button" className="booking-continue" disabled={!ready} onClick={go}>Review {mode==='block'?'block booking':'lesson'} <ArrowRight size={18}/></button>
        <p className="booking-safety"><ShieldCheck size={16}/> Time slots can be reserved only in this browser demo. Live bookings will require a server-side hold to prevent clashes between devices.</p>
      </aside>
    </div>
  </section>;
}
