import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Clock3, RefreshCw, ShieldAlert, UserRound, X } from 'lucide-react';
import { supabase } from './auth';
import { formatDay } from './scheduling';

export type TestBooking = {
  id:string;learner_id:string;instructor_id:string;
  learner_display_name:string;instructor_display_name:string;
  lesson_date:string;lesson_time:string;duration_minutes:number;
  transmission:'Manual'|'Automatic';
  start_at:string;status:'requested'|'confirmed'|'declined'|'cancelled';
  requested_at:string;updated_at:string;
};
const statusLabels:Record<TestBooking['status'],string>={
  requested:'Awaiting instructor',confirmed:'Confirmed · test',
  declined:'Declined',cancelled:'Cancelled'
};
const actionLabels={accept:'Accept request',decline:'Decline request'};

export default function LiveBookings({view,refreshKey,onChanged,onOpenAccount}:{
  view:'learner'|'instructor';refreshKey:number;onChanged:()=>void;onOpenAccount:()=>void;
}){
  const [userId,setUserId]=useState<string|null>(null);
  const [sessionChecked,setSessionChecked]=useState(!supabase);
  const [bookings,setBookings]=useState<TestBooking[]>([]);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [refresh,setRefresh]=useState(0);

  useEffect(()=>{
    const client=supabase;
    if(!client){setSessionChecked(true);return;}
    let active=true;
    void client.auth.getUser().then(({data})=>{
      if(active){setUserId(data.user?.id??null);setSessionChecked(true);}
    }).catch(()=>{if(active){setUserId(null);setSessionChecked(true);}});
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
      if(active){setUserId(session?.user.id??null);setSessionChecked(true);}
    });
    return()=>{active=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{
    if(!userId){setBookings([]);return;}
    const interval=window.setInterval(()=>setRefresh(v=>v+1),30000);
    return()=>window.clearInterval(interval);
  },[userId]);

  useEffect(()=>{
    const client=supabase;
    if(!client||!userId){setBookings([]);return;}
    let active=true;
    async function load(){
      if(!client||!userId)return;
      setLoading(true);
      try{
        const {data,error:loadError}=await client.from('test_lesson_bookings')
          .select('id,learner_id,instructor_id,learner_display_name,instructor_display_name,lesson_date,lesson_time,duration_minutes,transmission,start_at,status,requested_at,updated_at')
          .order('start_at',{ascending:true}).limit(150);
        if(loadError)throw loadError;
        if(active){setBookings((data??[]) as TestBooking[]);setError('');}
      }catch(e){if(active){setBookings([]);setError(e instanceof Error?e.message:'Could not load your test bookings.');}}
      finally{if(active)setLoading(false);}
    }
    void load();
    return()=>{active=false;};
  },[userId,view,refresh,refreshKey]);

  async function respond(id:string,action:'accept'|'decline'){
    const client=supabase;
    if(!client||saving)return;
    setSaving(id);setNotice('');setError('');
    try{
      const {error:actionError}=await client.rpc('respond_single_test_lesson',{p_booking_id:id,p_action:action});
      if(actionError)throw actionError;
      setNotice(action==='accept'?'Test lesson accepted. Both accounts now see it as confirmed.':'Test lesson declined. The time is available again.');
      setRefresh(v=>v+1);onChanged();
    }catch(e){setError(e instanceof Error?e.message:'The instructor response failed.');}
    finally{setSaving(null);}
  }

  async function cancel(id:string){
    const client=supabase;
    if(!client||saving||!window.confirm('Cancel this TEST lesson and release the reserved time?'))return;
    setSaving(id);setNotice('');setError('');
    try{
      const {error:actionError}=await client.rpc('cancel_single_test_lesson',{p_booking_id:id});
      if(actionError)throw actionError;
      setNotice('Test lesson cancelled. The slot has been released.');
      setRefresh(v=>v+1);onChanged();
    }catch(e){setError(e instanceof Error?e.message:'The test lesson could not be cancelled.');}
    finally{setSaving(null);}
  }

  const own=bookings.filter(b=>view==='learner'?b.learner_id===userId:b.instructor_id===userId);
  const pending=own.filter(b=>b.status==='requested');
  const active=own.filter(b=>b.status==='requested'||b.status==='confirmed');
  const history=own.filter(b=>b.status==='cancelled'||b.status==='declined');

  function row(b:TestBooking){
    const future=new Date(b.start_at).getTime()>Date.now();
    return <div className={'test-booking-row '+(b.status==='requested'?'test-booking-requested':'')} key={b.id}>
      <div className="test-booking-summary">
        <span className={'test-booking-status status-'+b.status}>{statusLabels[b.status]}</span>
        <strong>{formatDay(b.lesson_date)} · {b.lesson_time.slice(0,5)}</strong>
        <span><Clock3 size={14}/>{b.duration_minutes} minutes · {b.transmission}</span>
        <small>{view==='learner'?'Instructor: '+b.instructor_display_name:'Learner: '+b.learner_display_name}</small>
      </div>
      <div className="test-booking-actions">
        {view==='instructor'&&b.status==='requested'&&<><button type="button" className="test-booking-accept" disabled={!!saving} onClick={()=>void respond(b.id,'accept')}><Check size={15}/>{actionLabels.accept}</button><button type="button" className="test-booking-decline" disabled={!!saving} onClick={()=>void respond(b.id,'decline')}><X size={15}/>{actionLabels.decline}</button></>}
        {(b.status==='requested'||b.status==='confirmed')&&future&&<button type="button" className="test-booking-cancel" disabled={!!saving} onClick={()=>void cancel(b.id)}>Cancel test lesson</button>}
      </div>
    </div>;
  }

  return <section className="live-card test-bookings-panel">
    <div className="test-bookings-heading"><div><span className="eyebrow">SHARED SUPABASE · NO PAYMENTS</span><h2><CalendarDays size={20}/>{view==='learner'?'My live test lessons':'Test lesson requests & diary'}{view==='instructor'&&pending.length>0&&<span className="test-booking-count">{pending.length} pending</span>}</h2><p>{view==='learner'?'Your requests and confirmations are shared with the instructor.':'Accept or decline requests from learners. Decisions update both calendars.'}</p></div><button type="button" className="live-refresh" disabled={loading||!!saving} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={16}/>{loading?'Loading…':'Refresh'}</button></div>
    <div className="test-bookings-caveat"><ShieldAlert size={17}/> All entries are TEST reservations only. No driving lesson, payment or instructor verification is provided.</div>
    {error&&<p role="alert" className="booking-error">{error}</p>}
    {notice&&<p role="status" className="diary-feedback"><Check size={16}/>{notice}</p>}
    {sessionChecked&&!userId&&<div className="test-bookings-empty"><UserRound size={24}/><p>Sign in to see shared test bookings.</p><button className="test-booking-accept" onClick={onOpenAccount}>Open sign-in <ArrowRight size={16}/></button></div>}
    {userId&&!loading&&!own.length&&<div className="test-bookings-empty"><CalendarDays size={25}/><p>{view==='instructor'?'No test lesson requests yet. Published slots can be requested by signed-in learners.':'No shared test bookings yet. Choose a published time below and request it.'}</p></div>}
    {userId&&active.length>0&&<><h3>Upcoming / active test requests</h3><div className="test-booking-list">{active.map(row)}</div></>}
    {userId&&history.length>0&&<><h3>Previous test requests</h3><div className="test-booking-list">{history.slice(-20).map(row)}</div></>}
  </section>;
}
