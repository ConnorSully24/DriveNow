import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Plus, RefreshCw, ShieldAlert, Trash2, UserRound } from 'lucide-react';
import { supabase } from './auth';
import type { DemoState, DiaryBlock, SlotSelection, Transmission, WeeklyWindow } from './model';
import { availableRecurringSeries, DAYS, formatDay, isoDay, seriesAvailable, slotsForDate, timeMinutes, ukClock, validWindow } from './scheduling';

type View = 'instructor' | 'learner';
type Listing = {user_id:string;display_name:string;transmission:'Manual'|'Automatic'|'Both';published:boolean};
type WindowRow = {id:string;instructor_id:string;weekday:number;start_time:string;end_time:string};
type BlockRow = {id:string;instructor_id:string;block_date:string;start_time:string;end_time:string};

function normalTime(value:string):string{return value.slice(0,5);}
function publicTransmission(t:Listing['transmission'], wanted:Transmission):boolean{return t==='Both'||t===wanted;}
function createEmptyState(windows:WindowRow[],blocks:BlockRow[]):DemoState{
  const weeklyWindows:WeeklyWindow[]=windows.map(w=>({id:w.id,instructorId:w.instructor_id,weekday:w.weekday,start:normalTime(w.start_time),end:normalTime(w.end_time)}));
  const diaryBlocks:DiaryBlock[]=blocks.map(b=>({id:b.id,instructorId:b.instructor_id,date:b.block_date,start:normalTime(b.start_time),end:normalTime(b.end_time),note:'Unavailable'}));
  return {weeklyWindows,diaryBlocks,lessons:[],instructorOnline:false,learnerSelfSkill:5};
}
const emptyState=createEmptyState([],[]);
const maxDate=isoDay(ukClock().date,90);

export default function LiveSchedule({view,onOpenAccount}:{view:View;onOpenAccount:()=>void}) {
  const [userId,setUserId]=useState<string|null>(null);
  const [sessionChecked,setSessionChecked]=useState(!supabase);
  const [listings,setListings]=useState<Listing[]>([]);
  const [windows,setWindows]=useState<WindowRow[]>([]);
  const [blocks,setBlocks]=useState<BlockRow[]>([]);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [reload,setReload]=useState(0);
  const [weekday,setWeekday]=useState(1);
  const [start,setStart]=useState('09:00');
  const [end,setEnd]=useState('12:00');
  const [blockDate,setBlockDate]=useState(ukClock().date);
  const [blockAllDay,setBlockAllDay]=useState(true);
  const [blockStart,setBlockStart]=useState('09:00');
  const [blockEnd,setBlockEnd]=useState('17:00');
  const [selectedInstructor,setSelectedInstructor]=useState('');
  const [date,setDate]=useState(ukClock().date);
  const [duration,setDuration]=useState(60);
  const [transmission,setTransmission]=useState<Transmission>('Manual');
  const [mode,setMode]=useState<'now'|'ahead'|'block'>('ahead');
  const [count,setCount]=useState(5);
  const [pattern,setPattern]=useState<'weekly'|'custom'>('weekly');
  const [customSlots,setCustomSlots]=useState<SlotSelection[]>([]);

  useEffect(()=>{
    const client=supabase;
    if(!client){setSessionChecked(true);return;}
    let active=true;
    void client.auth.getUser().then(({data,error:authError})=>{
      if(active){setUserId(authError?null:data.user?.id??null);setSessionChecked(true);}
    }).catch(()=>{if(active){setUserId(null);setSessionChecked(true);}});
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
      if(active){setUserId(session?.user.id??null);setSessionChecked(true);}
    });
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{
    const client=supabase;
    if(!client||!userId){setListings([]);setWindows([]);setBlocks([]);setError('');return;}
    let active=true;
    async function load(){
      if(!client||!userId)return;
      setLoading(true);setError('');
      try{
        const listingQuery=view==='instructor'
          ?client.from('instructor_live_listings').select('user_id,display_name,transmission,published').eq('user_id',userId)
          :client.from('instructor_live_listings').select('user_id,display_name,transmission,published').eq('published',true).order('display_name');
        const listingResult=await listingQuery;
        if(listingResult.error)throw listingResult.error;
        const list=(listingResult.data??[]) as Listing[];
        const ids=list.map(x=>x.user_id);
        if(!ids.length){
          if(active){setListings([]);setWindows([]);setBlocks([]);}
          return;
        }
        const [windowResult,blockResult]=await Promise.all([
          client.from('instructor_live_windows').select('id,instructor_id,weekday,start_time,end_time').in('instructor_id',ids),
          client.from('instructor_live_blocks').select('id,instructor_id,block_date,start_time,end_time').in('instructor_id',ids)
        ]);
        if(windowResult.error)throw windowResult.error;
        if(blockResult.error)throw blockResult.error;
        if(active){
          setListings(list);
          setWindows((windowResult.data??[]) as WindowRow[]);
          setBlocks((blockResult.data??[]) as BlockRow[]);
        }
      }catch(e){
        if(active){
          setListings([]);setWindows([]);setBlocks([]);
          setError(e instanceof Error?e.message:'Could not load live availability. Try refreshing.');
        }
      }finally{if(active)setLoading(false);}
    }
    void load();
    return ()=>{active=false;};
  },[userId,view,reload]);

  // Poll published test schedules so changes from other devices appear without a reload.
  // Manual Refresh is also available. This is not a booking or reservation lock.
  useEffect(()=>{
    if(!userId)return;
    const timer=window.setInterval(()=>setReload(value=>value+1),30000);
    return ()=>window.clearInterval(timer);
  },[userId,view]);

  const own=listings.find(l=>l.user_id===userId);
  const visible=listings.filter(l=>l.published&&publicTransmission(l.transmission,transmission));
  const activeId=visible.some(x=>x.user_id===selectedInstructor)?selectedInstructor:(visible[0]?.user_id??'');
  const active=visible.find(l=>l.user_id===activeId);
  const liveState=useMemo(()=>createEmptyState(windows,blocks),[windows,blocks]);
  const daySlots=active?slotsForDate(activeId,date,duration,liveState):[];
  const soon=active?slotsForDate(activeId,ukClock().date,duration,liveState)
    .filter(s=>timeMinutes(s.time)<=ukClock().minutes+360):[];
  const recurring=active?availableRecurringSeries(activeId,date,duration,count,liveState):[];
  const relevantSlots=mode==='now'?soon:daySlots;
  const ownWindows=windows.filter(w=>w.instructor_id===userId).sort((a,b)=>a.weekday-b.weekday||a.start_time.localeCompare(b.start_time));
  const ownBlocks=blocks.filter(b=>b.instructor_id===userId).sort((a,b)=>a.block_date.localeCompare(b.block_date));
  const ownState=own?liveState:emptyState;
  const previewDate=isoDay(ukClock().date,7);
  const ownPreview=own?slotsForDate(own.user_id,previewDate,60,ownState):[];
  const customValid=Boolean(active&&customSlots.length===count&&seriesAvailable(activeId,customSlots,liveState));

  function reloadNow(){setNotice('');setReload(x=>x+1);}
  async function apply(action:()=>PromiseLike<{error:{message:string}|null}>,success:string){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try {
      const result=await action();
      if(result.error)throw Error(result.error.message);
      setNotice(success);setReload(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:'Could not save your schedule.');}
    finally{setBusy(false);}
  }
  function addWindow(){
    const client=supabase;
    if(!client||!userId||!own)return;
    if(!validWindow(start,end)){setError('Start must be before finish.');return;}
    const overlap=ownWindows.some(w=>w.weekday===weekday&&timeMinutes(start)<timeMinutes(normalTime(w.end_time))&&timeMinutes(normalTime(w.start_time))<timeMinutes(end));
    if(overlap){setError('This window overlaps existing hours. Remove or change an existing window first.');return;}
    void apply(()=>client.from('instructor_live_windows').insert({instructor_id:userId,weekday,start_time:start,end_time:end}),'Weekly hours saved to Supabase.');
  }
  function addBlock(){
    const client=supabase;
    if(!client||!userId||!own)return;
    if(blockDate<ukClock().date||blockDate>maxDate){setError('Choose a date within the next 90 days.');return;}
    const from=blockAllDay?'00:00':blockStart,to=blockAllDay?'23:59':blockEnd;
    if(!validWindow(from,to)){setError('Choose a valid time-off range.');return;}
    void apply(()=>client.from('instructor_live_blocks').insert({instructor_id:userId,block_date:blockDate,start_time:from,end_time:to}),'Time off saved to Supabase.');
  }
  function toggleCustom(slot:SlotSelection) {
    setCustomSlots(old=>{
      const exists=old.some(x=>x.date===slot.date&&x.time===slot.time);
      if(exists)return old.filter(x=>x.date!==slot.date||x.time!==slot.time);
      if(old.length>=count||!seriesAvailable(activeId,[...old,slot],liveState))return old;
      return [...old,slot];
    });
  }
  if(!supabase)return <div className="live-panel"><h2>Supabase isn't configured</h2><p>This feature needs the project's public Supabase URL and key.</p></div>;
  if(!sessionChecked)return <div className="live-panel"><p>Checking sign-in…</p></div>;
  if(!userId)return <section className="live-panel"><span className="eyebrow">LIVE DATABASE · TEST MODE</span><h1>Sign in to use live availability</h1><p>Real account sign-in is required to publish a calendar or see published test slots. The fictional instructor demo remains available without an account.</p><button className="booking-continue" type="button" onClick={onOpenAccount}><UserRound size={18}/> Sign in or create an account</button></section>;

  return <section className="live-panel">
    <div className="live-head"><div><span className="eyebrow">SUPABASE · CONNECTED TEST MODE</span><h1>{view==='instructor'?'My live availability':'Explore live availability'}</h1><p>{view==='instructor'?'Manage your own real Supabase calendar. This is not authorisation to teach or accept bookings.':'See real instructor-entered test availability across devices. Slots are read-only and cannot be reserved yet.'}</p></div><button className="live-refresh" type="button" disabled={loading||busy} onClick={reloadNow}><RefreshCw size={17}/>{loading?'Loading…':'Refresh'}</button></div>
    <div className="live-warning"><ShieldAlert size={21}/><span><strong>Test only — nobody is approved or bookable here.</strong> Instructor credentials and insurance have not been verified. No lesson requests, payments or holds can be created through this section.</span></div>
    {error&&<p role="alert" className="booking-error">{error}</p>}
    {notice&&<p role="status" className="diary-feedback"><CheckCircle2 size={16}/> {notice}</p>}
    {loading&&!listings.length&&<p>Loading saved schedules…</p>}

    {view==='instructor'&&!loading&&!own&&<div className="live-card"><h2>Instructor account needed</h2><p>This account is not registered as an instructor. Create a separate instructor test account using a different email address to manage a calendar.</p><button type="button" className="booking-continue" onClick={onOpenAccount}>Open account page <ArrowRight size={17}/></button></div>}
    {view==='instructor'&&own&&<>
      <div className="live-card live-publish"><div><span className="eyebrow">DISCOVERY VISIBILITY</span><h2>{own.display_name}</h2><p>Transmission: {own.transmission}. Your calendar is <strong>{own.published?'visible to signed-in test learners':'private'}</strong>.</p><small>Publishing does not verify your instructor credentials or enable lessons.</small></div><label className="live-toggle"><input type="checkbox" checked={own.published} disabled={busy} onChange={e=>{
        const client=supabase;
        if(client&&userId)void apply(()=>client.from('instructor_live_listings').update({published:e.target.checked}).eq('user_id',userId),'Listing visibility updated.');
      }}/> Publish test availability</label></div>
      <div className="live-two-col">
        <div className="live-card">
          <h2><CalendarDays size={19}/> Weekly working hours</h2><p>Hours repeat each week in Europe/London local time. Add one or more windows per day.</p>
          <div className="diary-weekly-list">{DAYS.map((d,i)=><div className="diary-weekday" key={d}><strong>{d}</strong><div>{ownWindows.filter(w=>w.weekday===i).map(w=><span className="diary-window" key={w.id}>{normalTime(w.start_time)}–{normalTime(w.end_time)}<button type="button" disabled={busy} aria-label={'Remove '+d+' window'} onClick={()=>{
            const client=supabase;if(client)void apply(()=>client.from('instructor_live_windows').delete().eq('id',w.id),'Weekly hours removed.');
          }}><Trash2 size={14}/></button></span>)}{!ownWindows.some(w=>w.weekday===i)&&<span className="diary-dayoff">No hours</span>}</div></div>)}</div>
          <div className="diary-add-form"><label>Day<select value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>{DAYS.map((d,i)=><option value={i} key={d}>{d}</option>)}</select></label><label>From<input type="time" value={start} onChange={e=>setStart(e.target.value)}/></label><label>To<input type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label><button type="button" disabled={busy} onClick={addWindow}><Plus size={16}/> Add working hours</button></div>
        </div>
        <div className="live-card">
          <h2><Clock3 size={19}/> Time off</h2><p>Block a whole date or a period within it. Your reason for time off is not collected or made public.</p>
          <div className="diary-block-form"><label>Date<input type="date" min={ukClock().date} max={maxDate} value={blockDate} onChange={e=>setBlockDate(e.target.value)}/></label><label className="diary-inline-check"><input type="checkbox" checked={blockAllDay} onChange={e=>setBlockAllDay(e.target.checked)}/> All day</label>{!blockAllDay&&<div className="diary-timepair"><label>From<input type="time" value={blockStart} onChange={e=>setBlockStart(e.target.value)}/></label><label>To<input type="time" value={blockEnd} onChange={e=>setBlockEnd(e.target.value)}/></label></div>}<button type="button" disabled={busy} onClick={addBlock}><Plus size={16}/> Block date/time</button></div>
          <h3>Blocked dates</h3>{ownBlocks.filter(b=>b.block_date>=ukClock().date).length?<div className="diary-block-list">{ownBlocks.filter(b=>b.block_date>=ukClock().date).slice(0,30).map(b=><div key={b.id}><span><strong>{formatDay(b.block_date)}</strong><small>{normalTime(b.start_time)}–{normalTime(b.end_time)}</small></span><button type="button" disabled={busy} aria-label={'Remove block '+b.block_date} onClick={()=>{
            const client=supabase;if(client)void apply(()=>client.from('instructor_live_blocks').delete().eq('id',b.id),'Time-off block removed.');
          }}><Trash2 size={17}/></button></div>)}</div>:<p className="diary-empty">Nothing blocked yet.</p>}
        </div>
      </div>
      <div className="live-card"><h2>Example open slots · {formatDay(previewDate)}</h2><p>Upcoming one-hour starts generated from your saved weekly hours and blocks. Not reservable.</p><div className="diary-calendar-slots">{ownPreview.map(s=><span key={s.time} className="diary-free-slot">{s.time} <small>Test</small></span>)}{!ownPreview.length&&<span className="diary-empty">No availability that day.</span>}</div></div>
    </>}

    {view==='learner'&&<>
      <div className="live-card"><h2>Search published instructor test diaries</h2><div className="booking-mode-tabs" role="group" aria-label="Search type"><button type="button" className={mode==='now'?'active':''} onClick={()=>setMode('now')}>Book now preview</button><button type="button" className={mode==='ahead'?'active':''} onClick={()=>setMode('ahead')}>Book ahead preview</button><button type="button" className={mode==='block'?'active':''} onClick={()=>setMode('block')}>Block availability</button></div>
        <div className="live-search-fields"><label>Transmission<select value={transmission} onChange={e=>{setTransmission(e.target.value as Transmission);setCustomSlots([]);}}><option>Manual</option><option>Automatic</option></select></label><label>Instructor<select value={activeId} onChange={e=>{setSelectedInstructor(e.target.value);setCustomSlots([]);}} disabled={!visible.length}>{visible.length?visible.map(l=><option key={l.user_id} value={l.user_id}>{l.display_name}</option>):<option value="">No published test instructors</option>}</select></label><label>Duration<select value={duration} onChange={e=>{setDuration(Number(e.target.value));setCustomSlots([]);}}>{[60,90,120].map(min=><option value={min} key={min}>{min} minutes</option>)}</select></label>{mode!=='now'&&<label>Find on<input type="date" min={ukClock().date} max={maxDate} value={date} onChange={e=>setDate(e.target.value)}/></label>}</div>
        {mode==='block'&&<div className="live-search-fields"><label>Lessons<select value={count} onChange={e=>{setCount(Number(e.target.value));setCustomSlots([]);}}><option value={5}>5</option><option value={10}>10</option></select></label><label>Schedule pattern<select value={pattern} onChange={e=>{setPattern(e.target.value as 'weekly'|'custom');setCustomSlots([]);}}><option value="weekly">Same time each week</option><option value="custom">Pick individual dates</option></select></label></div>}
      </div>
      {!loading&&listings.filter(x=>x.published).length===0&&<div className="booking-empty">No instructors have published test availability yet. An instructor must register, add hours and opt in to publishing before anything appears here.</div>}
      {active&&<div className="live-card"><div className="live-result-header"><div><span className="eyebrow">PUBLISHED TEST LISTING · NOT VERIFIED</span><h2>{active.display_name} · {active.transmission}</h2><p>{mode==='now'?'Open starts in the next six hours':mode==='ahead'?'Available starts on '+formatDay(date):pattern==='weekly'?'Complete '+count+'-week series beginning '+formatDay(date):'Select '+count+' individual available times'}</p></div><span className="live-nobook">No booking available</span></div>
        {mode==='block'&&pattern==='weekly'?<div className="live-slot-grid">{recurring.length?recurring.map(series=><div className="live-available-option" key={series[0].time}><strong>{series[0].time}</strong><span>{series.length} matching weekly dates</span><small>{series.map(x=>formatDay(x.date)).join(' · ')}</small></div>):<p className="booking-empty">No complete {count}-week pattern available here. Try another date, instructor or duration.</p>}</div>:<div className="live-slot-grid">{relevantSlots.length?relevantSlots.map(slot=>pattern==='custom'&&mode==='block'?<button className={'live-slot-choice '+(customSlots.some(s=>s.date===slot.date&&s.time===slot.time)?'selected':'')} type="button" key={slot.date+slot.time} onClick={()=>toggleCustom(slot)}>{slot.time}<small>{formatDay(slot.date)}</small></button>:<span className="live-available-option" key={slot.date+slot.time}><strong>{slot.time}</strong><small>{formatDay(slot.date)} · Available to view only</small></span>):<p className="booking-empty">No available starts for this selection. Try another date or instructor.</p>}</div>}
        {mode==='block'&&pattern==='custom'&&<div className="live-selected"><h3>Previewed sessions · {customSlots.length}/{count}</h3><p>Change the date above to find more sessions. Your selections remain visible but do not reserve anything.</p><div>{customSlots.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).map(x=><span key={x.date+x.time}>{formatDay(x.date)} · {x.time}</span>)}</div>{customValid&&<p className="diary-feedback">All selected test slots are currently open. No hold or booking has been created.</p>}</div>}
      </div>}
    </>}
    <p className="diary-caveat"><ShieldAlert size={16}/> Browser-local demo bookings are NOT linked to these live schedules. Real paid booking requires identity verification, cross-user conflict protection, and a server reservation transaction.</p>
  </section>;
}
