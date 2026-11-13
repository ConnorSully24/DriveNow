import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, BellOff, Check, RefreshCw, ShieldAlert, Zap } from 'lucide-react';
import { supabase } from './auth';
import { formatDay, ukClock } from './scheduling';

type Transmission='Manual'|'Automatic';
type Listing={user_id:string;display_name:string;transmission:'Manual'|'Automatic'|'Both';published:boolean};
type Pref={learner_id:string;instructor_id:string|null;transmission:Transmission;lesson_minutes:number};
type Alert={id:string;opening_id:string;created_at:string;read_at:string|null};
type Opening={id:string;instructor_id:string;opening_date:string;start_time:string;end_time:string;source:string};

function shortTime(time:string){return time.slice(0,5);}
function localStatus(opening:Opening){
  const london=ukClock(),day=opening.opening_date;
  if(day<london.date || (day===london.date && Number(shortTime(opening.end_time).slice(0,2))*60+Number(shortTime(opening.end_time).slice(3,5)) <= london.minutes))return 'Time has passed';
  return 'View availability';
}

export default function CancellationAlerts({onBack,onOpenAccount,onViewAvailability}:{
  onBack:()=>void;onOpenAccount:()=>void;onViewAvailability:(instructorId:string,date:string)=>void;
}){
  const [userId,setUserId]=useState<string|null>(null);
  const [sessionChecked,setSessionChecked]=useState(!supabase);
  const [learner,setLearner]=useState(false);
  const [listings,setListings]=useState<Listing[]>([]);
  const [pref,setPref]=useState<Pref|null>(null);
  const [alerts,setAlerts]=useState<Alert[]>([]);
  const [openings,setOpenings]=useState<Opening[]>([]);
  const [transmission,setTransmission]=useState<Transmission>('Manual');
  const [lessonMinutes,setLessonMinutes]=useState(60);
  const [instructorId,setInstructorId]=useState('all');
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const populated=useRef<string|null>(null);

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
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{populated.current=null;setPref(null);setAlerts([]);setOpenings([]);setLearner(false);},[userId]);

  useEffect(()=>{
    if(!userId)return;
    const timer=window.setInterval(()=>setRefresh(n=>n+1),30000);
    return ()=>window.clearInterval(timer);
  },[userId]);

  useEffect(()=>{
    const client=supabase;
    if(!client||!userId)return;
    let active=true;
    async function load(){
      if(!client||!userId)return;
      setLoading(true);setError('');
      try{
        const [roleResult,listResult,prefResult,alertResult]=await Promise.all([
          client.from('learner_profiles').select('user_id').eq('user_id',userId).maybeSingle(),
          client.from('instructor_live_listings').select('user_id,display_name,transmission,published').eq('published',true).order('display_name'),
          client.from('cancellation_alert_preferences').select('learner_id,instructor_id,transmission,lesson_minutes').eq('learner_id',userId).maybeSingle(),
          client.from('cancellation_alerts').select('id,opening_id,created_at,read_at').eq('learner_id',userId).order('created_at',{ascending:false}).limit(60)
        ]);
        for(const result of [roleResult,listResult,prefResult,alertResult])if(result.error)throw result.error;
        const pending=(alertResult.data??[]) as Alert[];
        const ids=pending.map(a=>a.opening_id);
        const openResult=ids.length
          ?await client.from('instructor_live_openings').select('id,instructor_id,opening_date,start_time,end_time,source').in('id',ids)
          :null;
        if(openResult?.error)throw openResult.error;
        if(!active)return;
        const existing=(prefResult.data??null) as Pref|null;
        setLearner(Boolean(roleResult.data));
        setListings((listResult.data??[]) as Listing[]);
        setPref(existing);setAlerts(pending);setOpenings((openResult?.data??[]) as Opening[]);
        if(populated.current!==userId){
          setTransmission(existing?.transmission??'Manual');
          setLessonMinutes(existing?.lesson_minutes??60);
          setInstructorId(existing?.instructor_id??'all');
          populated.current=userId;
        }
      }catch(e){if(active)setError(e instanceof Error?e.message:'Unable to load your alerts. Try Refresh.');}
      finally{if(active)setLoading(false);}
    }
    void load();
    return()=>{active=false;};
  },[userId,refresh]);

  async function savePreference(){
    const client=supabase;
    if(!client||!userId||saving||!learner)return;
    setSaving(true);setError('');setMessage('');
    try{
      const {error:saveError}=await client.from('cancellation_alert_preferences').upsert({
        learner_id:userId,instructor_id:instructorId==='all'?null:instructorId,
        transmission,lesson_minutes:lessonMinutes
      },{onConflict:'learner_id'});
      if(saveError)throw saveError;
      setMessage('Cancellation alerts turned on. New matching openings will appear in this inbox.');
      setRefresh(x=>x+1);
    }catch(e){setError(e instanceof Error?e.message:'Could not save alert preferences.');}
    finally{setSaving(false);}
  }
  async function unsubscribe(){
    const client=supabase;
    if(!client||!userId||saving)return;
    setSaving(true);setError('');setMessage('');
    try{
      const {error:deleteError}=await client.from('cancellation_alert_preferences').delete().eq('learner_id',userId);
      if(deleteError)throw deleteError;
      setPref(null);setMessage('Cancellation alerts switched off. Your existing inbox is still available.');
      setRefresh(x=>x+1);
    }catch(e){setError(e instanceof Error?e.message:'Could not turn alerts off.');}
    finally{setSaving(false);}
  }
  async function markRead(alert:Alert){
    const client=supabase;
    if(!client||!userId||alert.read_at)return;
    const {error:updateError}=await client.from('cancellation_alerts').update({read_at:new Date().toISOString()}).eq('id',alert.id).eq('learner_id',userId);
    if(updateError){setError(updateError.message);return;}
    setAlerts(current=>current.map(item=>item.id===alert.id?{...item,read_at:new Date().toISOString()}:item));
  }
  const unread=alerts.filter(a=>!a.read_at).length;
  const option=listings.find(l=>l.user_id===instructorId);
  return <section className="live-panel cancellation-alerts-shell">
    <div className="live-head"><div><button type="button" className="back-link" onClick={onBack}><ArrowLeft size={16}/> Back</button><span className="eyebrow">SUPABASE · OPT-IN TEST ALERTS</span><h1><Bell size={25}/> Cancellation alerts</h1><p>Choose which last-minute cancellations matter to you. We'll save matching alerts in your DriveNow account, even when you're signed out.</p></div><button type="button" className="live-refresh" onClick={()=>setRefresh(x=>x+1)} disabled={loading||saving}><RefreshCw size={17}/>{loading?'Loading…':'Refresh'}</button></div>
    <div className="live-warning"><ShieldAlert size={20}/><span><strong>In-app alerts only.</strong> Alerts are created for new matching cancellation openings starting within 48 hours. Your inbox refreshes every 30 seconds while DriveNow is open. No phone push, email, lesson reservation or payment is sent.</span></div>
    {error&&<p role="alert" className="booking-error">{error}</p>}
    {message&&<p role="status" className="diary-feedback"><Check size={17}/>{message}</p>}
    {!sessionChecked&&<p>Checking account…</p>}
    {sessionChecked&&!userId&&<div className="live-card"><h2>Sign in to receive cancellation alerts</h2><p>Use a real DriveNow learner test account so your alerts are saved privately across devices.</p><button type="button" className="booking-continue" onClick={onOpenAccount}>Sign in / Sign up <ArrowRight size={18}/></button></div>}
    {sessionChecked&&userId&&!loading&&!learner&&<div className="live-card"><h2>Learner account required</h2><p>Cancellation alerts are only available for registered learners. Instructor accounts manage availability in their diary.</p></div>}
    {userId&&learner&&<>
      <div className="live-card"><div className="alert-section-heading"><div><span className="eyebrow">YOUR WATCH SETTINGS</span><h2><Zap size={19}/> Watch for new cancellations</h2><p>No notifications are created until you opt in. You can change your watch or turn it off whenever you like.</p></div><span className={'alert-watch-status '+(pref?'enabled':'')}>{pref?'Alerts enabled':'Alerts off'}</span></div>
        <div className="live-search-fields"><label>Transmission<select value={transmission} onChange={e=>setTransmission(e.target.value as Transmission)}><option>Manual</option><option>Automatic</option></select></label><label>Lesson length<select value={lessonMinutes} onChange={e=>setLessonMinutes(Number(e.target.value))}>{[60,90,120].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label><label>Instructor<select value={instructorId} onChange={e=>setInstructorId(e.target.value)}><option value="all">All published instructors</option>{listings.map(l=><option value={l.user_id} key={l.user_id}>{l.display_name}</option>)}{instructorId!=='all'&&!option&&<option value={instructorId}>Previously selected instructor</option>}</select></label></div>
        <div className="alert-actions"><button type="button" className="live-oneoff-submit" onClick={()=>void savePreference()} disabled={saving}>{pref?'Save alert preferences':'Turn on cancellation alerts'} <Bell size={17}/></button>{pref&&<button type="button" className="alert-unsubscribe" disabled={saving} onClick={()=>void unsubscribe()}><BellOff size={17}/> Turn alerts off</button>}</div>
        <p className="live-oneoff-note">You'll receive one inbox alert for each new matching cancellation opening, including those published after being added privately. Your watch does not reserve a lesson. {pref?'Your current watch is active.':'Choose your preferences and opt in to start watching.'}</p>
      </div>
      <div className="live-card"><div className="alert-section-heading"><div><span className="eyebrow">PERSONAL INBOX</span><h2><Bell size={19}/> Cancellation notifications {unread>0&&<span className="alert-count">{unread} new</span>}</h2><p>New matches are saved in Supabase and appear here after you return to DriveNow.</p></div></div>
      {!alerts.length?<div className="alert-empty"><Bell size={30}/><strong>No cancellation alerts yet</strong><p>Once you're watching, new matching cancellations will appear here.</p></div>:<div className="alert-list">{alerts.map(item=>{
        const opening=openings.find(o=>o.id===item.opening_id);
        const listed=opening?listings.find(l=>l.user_id===opening.instructor_id):null;
        const status=opening?localStatus(opening):'No longer available';
        const available=Boolean(opening&&listed&&status==='View availability');
        return <div key={item.id} className={'alert-item '+(!item.read_at?'alert-unread':'')}>
          <div className="alert-item-content"><span className="alert-type"><Zap size={14}/> Cancellation gap {item.read_at?'':'· New'}</span><strong>{listed?.display_name??'Instructor unavailable'}</strong><span>{opening?formatDay(opening.opening_date)+' · '+shortTime(opening.start_time)+'–'+shortTime(opening.end_time):'This opening is no longer visible'}</span><small>Alert created {new Date(item.created_at).toLocaleString('en-GB')} · {status}</small></div>
          <div className="alert-item-actions">{!item.read_at&&<button type="button" className="alert-unsubscribe" onClick={()=>void markRead(item)}><Check size={16}/> Mark read</button>}{available&&opening&&<button type="button" className="alert-view" onClick={()=>{
            void markRead(item);onViewAvailability(opening.instructor_id,opening.opening_date);
          }}>View slots <ArrowRight size={15}/></button>}</div>
        </div>;
      })}</div>}
      </div>
    </>}
  </section>;
}
