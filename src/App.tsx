import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Bell, CalendarDays, CarFront, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Coins, CreditCard, Gauge, Home,
  LocateFixed, MapPin, Menu, Navigation2, Play, RotateCcw, Search, ShieldCheck,
  SlidersHorizontal, Sparkles, Star, Gauge as SteeringWheel, Timer, UserRound, Wallet, X,
  Zap, type LucideIcon
} from 'lucide-react';
import LearnerAccount from './LearnerAccount';
import BookingSchedule from './BookingSchedule';
import InstructorDiary from './InstructorDiary';
import LiveSchedule from './LiveSchedule';
import CancellationAlerts from './CancellationAlerts';
import { supabase } from './auth';
import { formatDay, seriesAvailable } from './scheduling';
import {
  DEFAULT_PREFS, INSTRUCTORS, INITIAL_STATE, STATE_KEY, formatGBP, loadDemoState,
  prettyDate, prettyStatus, getDisplaySkill, type BookingMode, type SlotSelection, type DiaryBlock, type OneOffWindow, type WeeklyWindow, type DemoState, type Instructor, type Lesson,
  type LessonStatus, type Page, type SearchPreferences, type Timing, type Transmission
} from './model';

type Role = 'learner' | 'instructor';
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

function Brand({ light = false }: { light?: boolean }) {
  return <div className={`brand ${light ? 'brand-light' : ''}`}>
    <span className="brand-icon"><CarFront size={22} strokeWidth={2.6} /></span>
    <span>Drive<span className="brand-now">Now</span></span>
    <small>DEMO</small>
  </div>;
}

function IconLabel({ icon: Icon, children, className = '' }: { icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return <span className={`icon-label ${className}`}><Icon size={16} strokeWidth={1.9}/>{children}</span>;
}

function Avatar({ instructor, size = 'md' }: { instructor: Instructor; size?: 'md' | 'lg' }) {
  return <div className={`avatar avatar-${size}`} style={{ background: instructor.hue }} aria-label={instructor.name}>
    <span className="avatar-face"><UserRound size={size === 'lg' ? 31 : 26} strokeWidth={1.5} /></span>
    <span className="avatar-initials">{instructor.initials}</span>
  </div>;
}

function StatusBadge({ status }: { status: LessonStatus }) {
  return <span className={`status status-${status}`}>{prettyStatus(status)}</span>;
}

function Button({ children, onClick, variant = 'primary', disabled = false, icon: Icon, className = '', type = 'button' }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary'|'secondary'|'ghost'|'danger'|'success';
  disabled?: boolean; icon?: LucideIcon; className?: string; type?: 'button'|'submit';
}) {
  return <button type={type} className={`btn btn-${variant} ${className}`} onClick={onClick} disabled={disabled}>
    {children}{Icon && <Icon size={18} />}
  </button>;
}

function SectionIntro({ eyebrow, title, copy, back }: { eyebrow?: string; title: string; copy?: string; back?: () => void }) {
  return <header className="section-intro">
    {back && <button className="back-link" onClick={back}><ArrowLeft size={17}/> Back</button>}
    {eyebrow && <span className="eyebrow">{eyebrow}</span>}
    <h1>{title}</h1>
    {copy && <p>{copy}</p>}
  </header>;
}

function DemoMap({ variant = 'large' }: { variant?: 'large'|'small' }) {
  return <div className={`demo-map demo-map-${variant}`} role="img" aria-label="Decorative map illustration of Leeds. Not live location data.">
    <div className="map-park park-a"/><div className="map-park park-b"/><div className="map-park park-c"/>
    <div className="map-road road-one"/><div className="map-road road-two"/><div className="map-road road-three"/><div className="map-road road-four"/><div className="map-road road-five"/>
    <div className="map-road road-six"/><div className="map-road road-seven"/><div className="map-road road-eight"/>
    <span className="map-label label-one">CHAPEL ALLERTON</span><span className="map-label label-two">LEEDS</span>
    <span className="map-label label-three">ROUNDHAY</span>
    <span className="map-radius"/><span className="map-point"><MapPin size={25} fill="currentColor" stroke="white" strokeWidth={1.5}/></span>
    <span className="map-note">Illustrative map · no live GPS</span>
  </div>;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (value: T) => void }) {
  return <div className="segmented" role="group">{options.map(option =>
    <button type="button" aria-pressed={value === option} className={value === option ? 'selected' : ''} key={option} onClick={() => onChange(option)}>{option}</button>
  )}</div>;
}

function Stepper({ current }: { current: number }) {
  return <div className="stepper" aria-label={`Step ${current} of 4`}>
    {['Your lesson', 'Availability', 'Review', 'Booked'].map((label, idx) =>
      <div key={label} className={`step ${idx + 1 <= current ? 'step-active' : ''}`}><span>{idx + 1 < current ? <Check size={13}/> : idx + 1}</span><small>{label}</small></div>
    )}
  </div>;
}

function InstructorCard({ instructor, chosen, select }: { instructor: Instructor; chosen: boolean; select: () => void }) {
  return <button className={`instructor-card ${chosen ? 'instructor-card-selected' : ''}`} onClick={select} aria-pressed={chosen}>
    <div className="instructor-upper"><Avatar instructor={instructor}/><div className="instructor-content">
      <div className="instructor-name">{instructor.name}<span className="sample-pill">Sample profile</span></div>
      <div className="rating"><Star size={14} fill="#f7a91a" stroke="#f7a91a"/> {instructor.rating} <span>({instructor.reviews} reviews)</span></div>
      <p>{instructor.car} · {instructor.transmission.join(' / ')}</p>
    </div><div className="instructor-price"><strong>{formatGBP(instructor.price)}</strong><span>/ hour</span></div></div>
    <div className="instructor-bottom"><span className="availability"><span className="live-dot"/> Sample availability</span><span><Clock3 size={14}/> ~{instructor.eta} min sample ETA</span></div>
    {chosen && <span className="chosen-marker"><Check size={15}/></span>}
  </button>;
}

function LessonTile({ lesson, onOpen }: { lesson: Lesson; onOpen: () => void }) {
  const instructor = INSTRUCTORS.find(i => i.id === lesson.instructorId) ?? INSTRUCTORS[0];
  return <button className="lesson-tile" onClick={onOpen}>
    <div className="lesson-tile-top"><Avatar instructor={instructor}/><div className="lesson-tile-name"><strong>{instructor.name}</strong><span>{lesson.transmission} · {lesson.duration} min</span></div><ChevronRight size={18}/></div>
    <div className="lesson-tile-bottom"><StatusBadge status={lesson.status}/><strong>{formatGBP(lesson.price)}</strong></div>
  </button>;
}

function App() {
  const [role, setRole] = useState<Role>('learner');
  const [page, setPage] = useState<Page>('home');
  const [prefs, setPrefs] = useState<SearchPreferences>({ ...DEFAULT_PREFS, date: todayLocal() });
  const [selectedId, setSelectedId] = useState(INSTRUCTORS[0].id);
  const [bookingMode, setBookingMode] = useState<BookingMode>('ahead');
  const [selectedSlots, setSelectedSlots] = useState<SlotSelection[]>([]);
  const [instructorAccountId, setInstructorAccountId] = useState('james');
  const [demo, setDemo] = useState<DemoState>(loadDemoState);
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadAlerts,setUnreadAlerts] = useState(0);
  const [alertFocus,setAlertFocus] = useState<{instructorId:string;date:string}|null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, number>>({});
  const [skillDrafts, setSkillDrafts] = useState<Record<string, number>>({});

  useEffect(() => { try { localStorage.setItem(STATE_KEY, JSON.stringify(demo)); } catch { /* demo remains usable when storage is blocked */ } }, [demo]);
  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Cross-page unread count, restricted to the current signed-in learner by RLS.
  // Inbox notifications are DB-generated, but this badge refreshes only while
  // DriveNow is open; this does not use OS push or email delivery.
  useEffect(()=>{
    const client=supabase;
    if(!client)return;
    let active=true;
    async function loadUnread(){
      if(!client)return;
      try{
        const {data:{user}}=await client.auth.getUser();
        if(!active)return;
        if(!user){setUnreadAlerts(0);return;}
        const {count,error}=await client.from('cancellation_alerts').select('id',{count:'exact',head:true}).is('read_at',null);
        if(active&&!error)setUnreadAlerts(count??0);
      }catch{if(active)setUnreadAlerts(0);}
    }
    void loadUnread();
    // Supabase recommends deferring API calls from auth callbacks.
    const {data:{subscription}}=client.auth.onAuthStateChange(()=>{
      window.setTimeout(()=>{if(active)void loadUnread();},0);
    });
    const interval=window.setInterval(()=>void loadUnread(),30000);
    return()=>{active=false;subscription.unsubscribe();window.clearInterval(interval);};
  },[]);

  const selected = INSTRUCTORS.find(i => i.id === selectedId) ?? INSTRUCTORS[0];
  const activeInstructor = INSTRUCTORS.find(i => i.id === instructorAccountId) ?? INSTRUCTORS[0];
  const filteredInstructors = INSTRUCTORS.filter(i => i.transmission.includes(prefs.transmission));
  const durationHours = prefs.duration / 60;
  const unitAmount = Math.round(selected.price * durationHours);
  const amount = unitAmount * Math.max(1,selectedSlots.length);
  const openLesson = openLessonId ? demo.lessons.find(l => l.id === openLessonId) : undefined;
  const instructorLessons = demo.lessons.filter(l => l.instructorId === instructorAccountId);
  const activeRequests = instructorLessons.filter(l => l.status === 'requested');
  const activeLessons = instructorLessons.filter(l => ['confirmed', 'arrived', 'in_progress'].includes(l.status));
  const earnings = instructorLessons.filter(l => l.status === 'completed').reduce((sum, l) => sum + l.price, 0);
  const lessonCount = demo.lessons.filter(l => !['cancelled', 'declined'].includes(l.status)).length;
  const skillSummary = getDisplaySkill(demo);
  const pendingLearnerReviews = demo.lessons.filter(l=>l.status==='completed' && !l.learnerInstructorRating);
  const returnHome = () => { setPage(role === 'learner' ? 'home' : 'instructor'); setOpenLessonId(null); };

  function switchRole(newRole: Role) {
    setRole(newRole);
    setMenuOpen(false);
    setOpenLessonId(null);
    setPage(newRole === 'learner' ? 'home' : 'instructor');
    setToast(newRole === 'instructor' ? 'Instructor demo: switch profiles to see their requests.' : 'Learner demo activated.');
  }

  function updateLesson(id: string, status: LessonStatus) {
    setDemo(prev => ({ ...prev, lessons: prev.lessons.map(l => l.id === id ? {
      ...l, status,
      ...(status === 'in_progress' ? { startedAt: new Date().toISOString() } : {}),
      ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {})
    } : l) }));
    const messages: Partial<Record<LessonStatus, string>> = {
      confirmed: 'Request accepted. Switch to Learner to see the update.',
      arrived: 'Learner marked as picked up in the demo.', in_progress: 'Demo lesson timer started.',
      completed: 'Lesson completed. Instructor: assess learner skill; learner: review your instructor.', declined: 'Request declined.', cancelled: 'Demo booking cancelled.'
    };
    setToast(messages[status] || 'Booking updated.');
  }

  function submitLearnerReview(id: string) {
    const rating = reviewDrafts[id];
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) { setToast('Select a rating from 1 to 5 stars.'); return; }
    setDemo(prev=>({...prev,lessons:prev.lessons.map(l=>l.id===id && l.status==='completed' && !l.learnerInstructorRating ? {...l,learnerInstructorRating:rating} : l)}));
    setToast('Instructor rating saved in this demo.');
  }
  function submitInstructorSkill(id: string) {
    const rating = skillDrafts[id];
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) { setToast('Choose a skill level from 1 to 10.'); return; }
    setDemo(prev=>({...prev,lessons:prev.lessons.map(l=>l.id===id && l.status==='completed' && !l.instructorLearnerSkill ? {...l,instructorLearnerSkill:rating} : l)}));
    setToast('Skill assessment saved; the learner now sees the instructor average.');
  }

  function showSchedule(mode:BookingMode) {
    setBookingMode(mode);setSelectedSlots([]);setRole('learner');setPage('schedule');
  }
  function confirmSchedule(slots:SlotSelection[],instructorId:string) {
    if(!slots.length)return;
    setSelectedSlots(slots.slice());setSelectedId(instructorId);
    setPrefs(prev=>({...prev,timing:'Choose a date',date:slots[0].date,time:slots[0].time,duration:slots[0].duration}));
    setPage('checkout');
  }
  function createBooking() {
    if(!selectedSlots.length || !seriesAvailable(selected.id,selectedSlots,demo)){
      setToast('A selected time is no longer free. Please choose new slots.');setPage('schedule');return;
    }
    // Local single-browser demo only; real booking requires an atomic server hold.
    const groupId=selectedSlots.length>1?demoId():undefined;
    const lessons:Lesson[]=selectedSlots.map(slot=>({
      id:demoId(),instructorId:selected.id,customer:'Sophie M.',bookedAt:new Date().toISOString(),
      blockBookingId:groupId,location:prefs.location.trim(),transmission:prefs.transmission,
      duration:slot.duration,timing:'Choose a date',date:slot.date,time:slot.time,price:unitAmount,status:'requested'
    }));
    setDemo(prev=>seriesAvailable(selected.id,selectedSlots,prev)?{...prev,lessons:[...lessons,...prev.lessons]}:prev);
    setOpenLessonId(lessons[0].id);setPage(lessons.length>1?'my-lessons':'lesson');
    setSelectedSlots([]);
    setToast(lessons.length>1?lessons.length+' demo lessons requested as a block. No payment taken.':'Demo lesson requested. No payment taken.');
  }
  function demoId() { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'demo-'+Date.now()+'-'+Math.random().toString(36).slice(2); }

  function resetDemo() {
    if (!window.confirm('Clear all demo lessons and reset instructor availability?')) return;
    setDemo(INITIAL_STATE);
    setOpenLessonId(null);
    setSelectedSlots([]);
    setPage(role === 'learner' ? 'home' : 'instructor');
    setToast('Demo data reset.');
  }

  function openLessonPage(id: string) { setOpenLessonId(id); setPage('lesson'); }

  const canBook = prefs.location.trim().length >= 3 && (prefs.timing !== 'Choose a date' || (prefs.date >= todayLocal() && !!prefs.time));

  const navItems: Array<{ key: Page; label: string; icon: LucideIcon; role: Role }> = [
    { key: 'home', label: 'Discover', icon: Home, role: 'learner' },
    { key: 'my-lessons', label: 'My lessons', icon: CalendarDays, role: 'learner' },
    { key: 'alerts', label: 'Cancellation alerts', icon: Bell, role: 'learner' },
    { key: 'signup', label: 'Account / Sign up', icon: UserRound, role: 'learner' },
    { key: 'signup', label: 'Account / Sign up', icon: UserRound, role: 'instructor' },
    { key: 'instructor', label: 'Dashboard', icon: Gauge, role: 'instructor' },
    { key: 'diary', label: 'Availability diary', icon: CalendarDays, role: 'instructor' }
  ];

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top"><Brand light/><button className="sidebar-close icon-button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={20}/></button></div>
      <div className="sidebar-badge"><Sparkles size={15}/> CONCEPT PROTOTYPE</div>
      <p className="sidebar-copy">Driving lessons, at your fingertips.</p>
      <nav className="side-nav" aria-label="Main menu">
        {navItems.filter(item => item.role === role).map(item => <button key={item.key} className={`side-link ${page === item.key ? 'side-link-active' : ''}`} onClick={() => { setPage(item.key); setMenuOpen(false); }}><item.icon size={19}/>{item.label}</button>)}
        <button className={`side-link ${page==='live-slots'?'side-link-active':''}`} onClick={()=>{setPage('live-slots');setMenuOpen(false);}}><Search size={19}/> Live slots · test</button>
        <button className={`side-link ${page==='live-diary'?'side-link-active':''}`} onClick={()=>{setPage('live-diary');setMenuOpen(false);}}><CalendarDays size={19}/> My live diary · test</button>
      </nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-feature"><span><Zap size={17} fill="currentColor"/></span><strong>Built for the moment</strong><p>Find a lesson or fill an empty diary slot.</p></div>
      <div className="role-block"><span>DEMO VIEW</span><div className="role-switch"><button className={role === 'learner' ? 'active' : ''} onClick={() => switchRole('learner')}>Learner</button><button className={role === 'instructor' ? 'active' : ''} onClick={() => switchRole('instructor')}>Instructor</button></div></div>
      <button className="reset-link" onClick={resetDemo}><RotateCcw size={15}/> Reset demo</button>
    </aside>

    <div className="main-area">
      <header className="topbar">
        <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={23}/></button>
        <div className="topbar-mobile-brand"><Brand/></div>
        <div className="topbar-breadcrumb">UK launch concept <ChevronRight size={14}/> {role === 'learner' ? 'Learner experience' : 'Instructor experience'}</div>
        <div className="topbar-right"><button type="button" className="account-toplink alert-toplink" onClick={()=>{setRole('learner');setPage('alerts');}} aria-label={unreadAlerts>0?`Cancellation alerts, ${unreadAlerts} unread`:'Cancellation alerts'}><Bell size={17}/> Alerts{unreadAlerts>0&&<span className="alert-global-count">{unreadAlerts>99?'99+':unreadAlerts}</span>}</button>{<button className="account-toplink" onClick={() => setPage('signup')}><UserRound size={17}/> Sign in / Sign up</button>}<span className="demo-chip"><span/> {page==='live-diary'||page==='live-slots'||page==='alerts'?'LIVE DATA · TEST ONLY':'DEMO MODE'}</span><button className="icon-button help-button" title="Prototype only — no real bookings or charges" onClick={() => setToast('Demo bookings use browser storage. Supabase live schedules are read-only tests; paid bookings, licence checks and GPS are not connected.')}><CircleHelp size={19}/></button></div>
      </header>
      <main className="content">
        {page === 'alerts' && <CancellationAlerts onBack={()=>setPage('live-slots')} onOpenAccount={()=>setPage('signup')} onViewAvailability={(instructorId,date)=>{setAlertFocus({instructorId,date});setPage('live-slots');}}/>}
        {page === 'live-slots' && <LiveSchedule view="learner" onOpenAccount={()=>setPage('signup')} onOpenAlerts={()=>setPage('alerts')} focusInstructorId={alertFocus?.instructorId} focusDate={alertFocus?.date}/>}
        {page === 'live-diary' && <LiveSchedule view="instructor" onOpenAccount={()=>setPage('signup')}/>}
        {page === 'signup' && <LearnerAccount onBack={returnHome} onDemo={(demoRole, initialLearnerSkill) => { if (demoRole === 'learner' && initialLearnerSkill != null) setDemo(prev => ({...prev, learnerSelfSkill: initialLearnerSkill})); switchRole(demoRole); }} />}
        {role === 'learner' && page === 'home' && <>
          <section className="hero">
            <div className="hero-copy"><span className="hero-kicker"><Zap size={15} fill="currentColor"/> YOUR NEXT LESSON, SORTED</span>
              <h1>More driving.<br/><em>Less waiting.</em></h1>
              <p>Find a driving instructor who has a spare slot — today, tomorrow or whenever you're ready.</p>
              <Button icon={ArrowRight} onClick={() => showSchedule('ahead')}>Find a lesson</Button>
              <div className="hero-trust"><IconLabel icon={Clock3}>Short-notice slots</IconLabel><IconLabel icon={ShieldCheck}>Verified instructors planned</IconLabel></div>
            </div>
            <div className="hero-visual"><div className="hero-circle circle-a"/><div className="hero-circle circle-b"/><div className="floating-card floating-card-top"><span className="floating-icon"><Zap size={18}/></span><div><strong>Slot available</strong><span>Today · 2:30 PM</span></div></div><div className="hero-car"><CarFront size={125} strokeWidth={1.3}/></div><div className="floating-card floating-card-bottom"><span className="rating-star"><Star size={17} fill="currentColor"/></span><div><strong>4.9 out of 5</strong><span>Example instructor rating</span></div></div></div>
          </section>
          <div className="live-explore-callout"><div><span className="eyebrow">NEW · SUPABASE TEST</span><strong>Explore real instructor-entered availability</strong><p>See schedules synced across phones. No real reservations or payments.</p></div><button type="button" onClick={()=>setPage('live-slots')}>Browse live test slots <ArrowRight size={17}/></button></div>
           <div className="booking-entry-grid" aria-label="Choose how to book">
             <button type="button" onClick={()=>showSchedule('now')}><Zap size={27}/><strong>Book now</strong><span>Short-notice lesson slots</span><ArrowRight size={18}/></button>
             <button type="button" onClick={()=>showSchedule('ahead')}><CalendarDays size={27}/><strong>Book ahead</strong><span>Pick a day and time</span><ArrowRight size={18}/></button>
             <button type="button" onClick={()=>showSchedule('block')}><CalendarDays size={27}/><strong>Block booking</strong><span>5 or 10 lessons together</span><ArrowRight size={18}/></button>
           </div>
           <div className="dashboard-grid">
            <section className="card quick-card"><div className="card-heading"><div><span className="eyebrow">YOUR AREA</span><h2>Find your next lesson</h2></div><span className="round-icon"><LocateFixed size={20}/></span></div>
              <label className="field-label" htmlFor="home-location">Pick-up postcode or area</label><div className="input-icon"><MapPin size={19}/><input id="home-location" value={prefs.location} maxLength={100} onChange={event => setPrefs(prev => ({ ...prev, location: event.target.value }))} placeholder="e.g. Leeds, LS7"/></div>
              <label className="field-label">Car type</label><Segmented<Transmission> value={prefs.transmission} options={['Manual','Automatic']} onChange={val => setPrefs(prev => ({ ...prev, transmission: val }))}/>
              <Button icon={Search} onClick={() => showSchedule('ahead')} className="full">Search available instructors</Button>
            </section>
            <section className="card how-card"><div className="card-heading"><div><span className="eyebrow">HOW IT WORKS</span><h2>Three simple steps</h2></div></div>
              <div className="how-step"><div>01</div><span><strong>Choose your lesson</strong><small>Pick your location, time and car type.</small></span></div>
              <div className="how-step"><div>02</div><span><strong>Match with an instructor</strong><small>Compare nearby instructors and prices.</small></span></div>
              <div className="how-step"><div>03</div><span><strong>Get on the road</strong><small>Send a request and track its progress.</small></span></div>
            </section>
          </div>
          <div className="skill-summary-card"><div><span className="eyebrow">YOUR CURRENT DRIVING SKILL · DEMO</span><h3>{skillSummary.score.toFixed(1)} / 10</h3><p>{skillSummary.source === 'self' ? 'Your one-time self-estimate from signup. Instructor assessments replace this after your first lesson.' : 'Instructor average from '+skillSummary.count+' assessment'+(skillSummary.count===1?'':'s')+'. Your signup estimate is excluded.'}</p></div><ShieldCheck size={27}/></div>
           {pendingLearnerReviews.length > 0 && <button className="feedback-alert" onClick={()=>openLessonPage(pendingLearnerReviews[0].id)}><Star size={19}/> You have {pendingLearnerReviews.length} completed {pendingLearnerReviews.length===1?'lesson':'lessons'} to review. Rate your instructor <ArrowRight size={17}/></button>}
           <div className="account-cta"><div><strong>New to driving? Create your learner account</strong><p>Prepare for ID and provisional licence checks before real bookings go live.</p></div><Button variant="secondary" icon={ArrowRight} onClick={() => setPage('signup')}>Get started</Button></div>
          {lessonCount > 0 && <section className="existing-bookings"><div className="heading-row"><h2>Your recent lessons</h2><button className="text-action" onClick={() => setPage('my-lessons')}>View all <ArrowRight size={16}/></button></div><div className="lesson-list">{demo.lessons.slice(0,2).map(l => <LessonTile key={l.id} lesson={l} onOpen={() => openLessonPage(l.id)}/>)}</div></section>}
        </>}

        {role === 'learner' && page === 'details' && <>
          <Stepper current={1}/>
          <SectionIntro eyebrow="STEP 01 · PERSONALISE" title="Your lesson, your way." copy="Tell us what works for you. We'll show a few example instructors to explore the booking experience." back={returnHome}/>
          <div className="two-column">
            <section className="card form-card"><div className="field-group"><label htmlFor="pickup">Where should we pick you up?</label><div className="input-icon"><MapPin size={19}/><input id="pickup" placeholder="Postcode or neighbourhood" value={prefs.location} maxLength={100} onChange={event => setPrefs(prev => ({ ...prev, location: event.target.value }))}/></div><small className="field-hint">Demo coverage: Leeds area · enter any sample UK location</small></div>
              <div className="field-group"><label>What would you like to drive?</label><Segmented<Transmission> value={prefs.transmission} options={['Manual','Automatic']} onChange={val => setPrefs(prev => ({ ...prev, transmission: val }))}/></div>
              <div className="field-group"><label>Lesson duration</label><div className="duration-grid">{[60,90,120].map(mins => <button key={mins} className={`choice-card ${prefs.duration === mins ? 'choice-active' : ''}`} onClick={() => setPrefs(prev => ({ ...prev, duration: mins }))}><strong>{mins === 60 ? '1 hour' : mins === 90 ? '1.5 hours' : '2 hours'}</strong><small>{mins} minutes</small></button>)}</div></div>
              <div className="field-group"><label>When do you want a lesson?</label><div className="timing-options">{([{title:'ASAP',subtitle:'Find a free slot right now',icon:Zap}, {title:'Later today',subtitle:'Pick a time later today',icon:Clock3}, {title:'Choose a date',subtitle:'Book something in advance',icon:CalendarDays}] as Array<{title:Timing;subtitle:string;icon:LucideIcon}>).map(option => <button key={option.title} className={`timing-option ${prefs.timing === option.title ? 'timing-active' : ''}`} onClick={() => setPrefs(prev => ({ ...prev, timing: option.title }))}><span className="timing-icon"><option.icon size={21}/></span><span><strong>{option.title === 'ASAP' ? 'As soon as possible' : option.title}</strong><small>{option.subtitle}</small></span><span className="radio-dot"/></button>)}</div></div>
              {prefs.timing !== 'ASAP' && <div className="date-fields">{prefs.timing === 'Choose a date' && <label className="date-field">Date<input type="date" min={todayLocal()} value={prefs.date} onChange={e => setPrefs(prev => ({...prev, date:e.target.value}))}/></label>}<label className="date-field">Preferred start time<input type="time" value={prefs.time} onChange={e => setPrefs(prev => ({...prev, time:e.target.value}))}/></label></div>}
              <Button icon={ArrowRight} className="full" disabled={!canBook} onClick={() => { if (!filteredInstructors.some(i => i.id === selectedId)) setSelectedId(filteredInstructors[0]?.id ?? 'james'); showSchedule(prefs.timing==='ASAP'?'now':'ahead'); }}>Find an instructor</Button>
              {!canBook && <p className="validation-text">Please enter a location and a valid future date/time.</p>}
            </section>
            <aside className="aside-stack"><DemoMap/><div className="info-card"><ShieldCheck size={20}/><div><strong>Made for flexibility</strong><p>See how booking urgent lessons could work. Instructor profiles and availability shown here are fictional.</p></div></div></aside>
          </div>
        </>}

        {role === 'learner' && page === 'instructors' && <>
          <Stepper current={2}/>
          <SectionIntro eyebrow="STEP 02 · FIND YOUR FIT" title="Instructors near you." copy={`${filteredInstructors.length} example instructors for ${prefs.transmission.toLowerCase()} lessons. These are fictional profiles, not live availability.`} back={() => setPage('details')}/>
          <div className="two-column"><section className="card results-card"><div className="filter-bar"><IconLabel icon={MapPin}>{prefs.location}</IconLabel><IconLabel icon={Clock3}>{prefs.timing === 'ASAP' ? 'As soon as possible' : prefs.timing === 'Later today' ? `Today · ${prefs.time}` : `${prettyDate(prefs.date)} · ${prefs.time}`}</IconLabel><IconLabel icon={SlidersHorizontal}>{prefs.transmission} · {prefs.duration} min</IconLabel></div>
            <div className="instructors-list">{filteredInstructors.map(i => <InstructorCard key={i.id} instructor={i} chosen={selected.id === i.id} select={() => setSelectedId(i.id)}/>)}</div>
            <p className="disclaimer"><CircleHelp size={15}/> Ratings, arrival times, prices and availability are illustrative demo data.</p>
            <div className="sticky-action"><div><small>Selected lesson</small><strong>{formatGBP(amount)} <span>/ {prefs.duration} min</span></strong></div><Button icon={ArrowRight} onClick={() => showSchedule('ahead')}>Find free times</Button></div>
          </section><aside className="aside-stack"><DemoMap/><div className="info-card"><BadgeCheck size={20}/><div><strong>Qualifications checks before launch</strong><p>A production version would need instructor identity, DVSA status and appropriate insurance verified.</p></div></div></aside></div>
        </>}

        {role === 'learner' && page === 'schedule' && <BookingSchedule initialMode={bookingMode} prefs={prefs} onPrefs={setPrefs} instructorId={selectedId} onInstructor={setSelectedId} instructors={INSTRUCTORS} state={demo} onProceed={confirmSchedule} onBack={returnHome}/>}
        {role === 'learner' && page === 'checkout' && <>
          <Stepper current={3}/><SectionIntro eyebrow="STEP 03 · REVIEW" title="One more thing. Let's go." copy="Review the selected diary slots below. This demo does not process payment." back={() => setPage('schedule')}/>
          <div className="two-column checkout-grid"><section className="card checkout-card"><h2>Your chosen instructor</h2><div className="checkout-instructor"><Avatar instructor={selected} size="lg"/><div><strong>{selected.name}</strong><span className="rating"><Star size={14} fill="#f7a91a" stroke="#f7a91a"/> {selected.rating} <span>({selected.reviews} example reviews)</span></span><small>{selected.car} · {prefs.transmission}</small></div><div className="price-side"><strong>{formatGBP(selected.price)}</strong><small>/ hour</small></div></div>
            <h2 className="subheading">{selectedSlots.length>1?'Your block of '+selectedSlots.length+' lessons':'Lesson details'}</h2>
             {selectedSlots.length>1&&<div className="checkout-series">{selectedSlots.map((slot,i)=><div key={slot.date+slot.time}><span>{i+1}. {formatDay(slot.date)} at {slot.time} · {slot.duration} min</span><strong>{formatGBP(unitAmount)}</strong></div>)}</div>}<div className="detail-rows"><div><IconLabel icon={MapPin}>Pick-up</IconLabel><strong>{prefs.location}</strong></div><div><IconLabel icon={Clock3}>{selectedSlots.length>1?'First lesson':'Time'}</IconLabel><strong>{prefs.timing === 'ASAP' ? 'As soon as possible' : prefs.timing === 'Later today' ? `Today at ${prefs.time}` : `${prettyDate(prefs.date)} at ${prefs.time}`}</strong></div><div><IconLabel icon={Timer}>Duration</IconLabel><strong>{prefs.duration} minutes</strong></div><div><IconLabel icon={CarFront}>Transmission</IconLabel><strong>{prefs.transmission}</strong></div></div>
            <div className="total-row"><div><strong>Demo total{selectedSlots.length>1?' · '+selectedSlots.length+' lessons':''}</strong><small>Example price · no money taken</small></div><strong>{formatGBP(amount)}</strong></div>
            <Button icon={ArrowRight} className="full" disabled={!selectedSlots.length} onClick={createBooking}>{selectedSlots.length>1?'Request demo block booking':'Send demo lesson request'}</Button>
            <p className="secure-note"><ShieldCheck size={16}/> Demo only — real bookings will require a verified provisional licence and an account.</p><button className="account-text-button" onClick={() => setPage('signup')}>Start learner verification <ArrowRight size={16}/></button></section>
            <aside className="aside-stack"><div className="aside-callout"><CreditCard size={26}/><h3>Payments come later.</h3><p>We’ll add secure payments once the marketplace works with actual instructors. This screen simulates checkout only.</p></div><div className="info-card"><Bell size={20}/><div><strong>What happens next?</strong><p>Switch to Instructor view to accept the request, then return to Learner view to see the status update.</p></div></div></aside>
          </div>
        </>}

        {role === 'learner' && page === 'my-lessons' && <><SectionIntro eyebrow="YOUR ACTIVITY" title="My lessons." copy="All your demo requests, from the newest to the oldest."/>
          <div className="skill-summary-card"><div><span className="eyebrow">YOUR DRIVING SKILL · DEMO</span><h3>{skillSummary.score.toFixed(1)} / 10</h3><p>{skillSummary.source === 'self' ? 'Sign-up self-estimate, pending an instructor assessment.' : 'Average of '+skillSummary.count+' completed-lesson instructor assessment'+(skillSummary.count===1?'':'s')+'.'}</p></div><ShieldCheck size={25}/></div><section className="card list-card">{demo.lessons.length ? <div className="lesson-list">{demo.lessons.map(l => <LessonTile key={l.id} lesson={l} onOpen={() => openLessonPage(l.id)}/>)}</div> : <div className="empty-state"><CalendarDays size={37}/><h2>No lessons just yet</h2><p>Your bookings will appear here once you've submitted a demo request.</p><Button onClick={() => showSchedule('ahead')} icon={ArrowRight}>Find your first lesson</Button></div>}</section></>}

        {role === 'learner' && page === 'lesson' && <>
          <SectionIntro eyebrow="LESSON TRACKING" title={openLesson?.status === 'completed' ? 'Nice work behind the wheel!' : 'Your lesson.'} copy="Track your request below. Changes are saved in this browser and can be tested in Instructor view." back={() => setPage('my-lessons')}/>
          {openLesson ? <div className="two-column"><section className="card tracking-card"><div className="tracking-head"><StatusBadge status={openLesson.status}/><span>Reference #{openLesson.id.slice(0,8).toUpperCase()}</span></div>
            <div className="tracking-hero"><div className="tracking-symbol">{openLesson.status === 'completed' ? <CheckCircle2 size={51}/> : openLesson.status === 'cancelled' || openLesson.status === 'declined' ? <X size={49}/> : openLesson.status === 'in_progress' ? <SteeringWheel size={51}/> : <CarFront size={51}/>}</div>
              <h2>{openLesson.status === 'requested' ? 'Waiting for your instructor' : openLesson.status === 'confirmed' ? 'You’re all set!' : openLesson.status === 'arrived' ? 'Your instructor has arrived' : openLesson.status === 'in_progress' ? 'Lesson in progress' : openLesson.status === 'completed' ? 'Lesson complete!' : openLesson.status === 'declined' ? 'Instructor unavailable' : 'Booking cancelled'}</h2>
              <p>{openLesson.status === 'requested' ? 'In a live app your instructor would be notified. Switch to the instructor demo to accept it.' : openLesson.status === 'confirmed' ? 'Your request has been accepted. Get ready to hit the road.' : openLesson.status === 'arrived' ? 'Your instructor has marked themselves as arrived in the demo.' : openLesson.status === 'in_progress' ? 'Enjoy your lesson — the demo timer is running.' : openLesson.status === 'completed' ? 'Thanks for trying DriveNow. Your demo lesson has finished.' : 'You can search again for another instructor.'}</p>
              {openLesson.status === 'in_progress' && openLesson.startedAt && <div className="lesson-time">{Math.max(0,Math.ceil((openLesson.duration*60000-(clock-new Date(openLesson.startedAt).getTime()))/60000))} <small>minutes remaining (demo)</small></div>}
            </div>
            <div className="detail-rows"><div><IconLabel icon={UserRound}>Instructor</IconLabel><strong>{(INSTRUCTORS.find(i => i.id === openLesson.instructorId) ?? INSTRUCTORS[0]).name}</strong></div><div><IconLabel icon={MapPin}>Pick-up</IconLabel><strong>{openLesson.location}</strong></div><div><IconLabel icon={CalendarDays}>Start</IconLabel><strong>{openLesson.timing === 'ASAP' ? 'As soon as possible' : openLesson.timing === 'Later today' ? `Today ${openLesson.time}` : `${prettyDate(openLesson.date)} ${openLesson.time}`}</strong></div><div><IconLabel icon={Timer}>Lesson length</IconLabel><strong>{openLesson.duration} min</strong></div><div><IconLabel icon={Wallet}>Demo price</IconLabel><strong>{formatGBP(openLesson.price)}</strong></div></div>
            {openLesson.status === 'completed' && <div className="feedback-panel"><h3><Star size={19}/> Rate your instructor</h3><p>How was your lesson with {(INSTRUCTORS.find(i=>i.id===openLesson.instructorId)??INSTRUCTORS[0]).name}? Your skill level is assessed separately by your instructor. You won't be asked to rate yourself again.</p>{openLesson.learnerInstructorRating ? <div className="feedback-saved"><CheckCircle2 size={19}/> Your {openLesson.learnerInstructorRating}/5 review has been saved.</div> : <><div className="review-stars" role="group" aria-label="Rate your instructor out of five">{[1,2,3,4,5].map(star=><button type="button" key={star} aria-label={star+' star'+(star===1?'':'s')} aria-pressed={reviewDrafts[openLesson.id]===star} onClick={()=>setReviewDrafts(prev=>({...prev,[openLesson.id]:star}))}><Star size={28} fill={star <= (reviewDrafts[openLesson.id] || 0)?'#f6b42c':'none'} stroke="#d99c1f"/></button>)}</div><Button onClick={()=>submitLearnerReview(openLesson.id)} disabled={!reviewDrafts[openLesson.id]}>Submit instructor rating</Button></>}</div>}
             <div className="tracking-actions">{['requested','confirmed'].includes(openLesson.status) && <Button variant="secondary" onClick={() => updateLesson(openLesson.id,'cancelled')}>Cancel demo request</Button>}{['declined','cancelled','completed'].includes(openLesson.status) && <Button onClick={() => showSchedule('ahead')} icon={ArrowRight}>Find another lesson</Button>}</div>
          </section><aside className="aside-stack"><DemoMap variant="large"/><div className="info-card"><Bell size={19}/><div><strong>Testing the full flow?</strong><p>Use the Instructor demo, select this instructor, and accept the pending request. Then switch back to Learner.</p></div></div></aside></div> : <div className="empty-state"><p>That booking wasn't found in this browser.</p><Button onClick={() => setPage('my-lessons')}>View my lessons</Button></div>}
        </>}

        {role === 'instructor' && page === 'instructor' && <>
          <section className="instructor-welcome"><div><span className="eyebrow">INSTRUCTOR PORTAL · DEMO</span><h1>Good to see you, {activeInstructor.name.split(' ')[0]}. <span>👋</span></h1><p>Turn your unused availability into extra lessons.</p></div><label className="instructor-picker">Demo instructor profile <span><select aria-label="Choose instructor profile" value={instructorAccountId} onChange={event => setInstructorAccountId(event.target.value)}>{INSTRUCTORS.map(i => <option key={i.id} value={i.id}>{i.name} · {i.transmission.join('/')}</option>)}</select><ChevronDown size={16}/></span></label></section>
          <div className="stat-grid"><div className="stat-card stat-availability"><div className="stat-icon"><Zap size={19}/></div><span>AVAILABILITY</span><strong>{demo.instructorOnline ? 'Online' : 'Offline'}</strong><label className="toggle-row">{demo.instructorOnline ? 'Accepting requests' : 'Not accepting requests'}<input aria-label="Available for new bookings" type="checkbox" checked={demo.instructorOnline} onChange={e => setDemo(prev => ({...prev, instructorOnline: e.target.checked}))}/><span className="switch-track"/></label></div>
            <div className="stat-card"><div className="stat-icon icon-violet"><CalendarDays size={20}/></div><span>YOUR REQUESTS</span><strong>{activeRequests.length}</strong><small>Pending response</small></div>
            <div className="stat-card"><div className="stat-icon icon-gold"><Coins size={20}/></div><span>DEMO EARNINGS</span><strong>{formatGBP(earnings)}</strong><small>Completed lesson value</small></div></div>
          <button type="button" className="open-diary-button" onClick={()=>setPage('live-diary')}><CalendarDays size={20}/> Manage my Supabase availability <ArrowRight size={18}/></button>
           <button type="button" className="open-diary-button open-diary-secondary" onClick={()=>setPage('diary')}><CalendarDays size={20}/> Manage my availability diary <ArrowRight size={18}/></button>
           <div className="instructor-workgrid"><section className="card requests-card"><div className="heading-row"><div><span className="eyebrow">LIVE IN YOUR DEMO</span><h2>New lesson requests <span className="number-pill">{activeRequests.length}</span></h2></div><span className="round-icon"><Bell size={20}/></span></div>
            {!demo.instructorOnline && <div className="offline-note"><CircleHelp size={17}/> You're offline. Turn availability on to accept new requests.</div>}
            {activeRequests.length ? activeRequests.map(l => <div className="request-card" key={l.id}><div className="request-top"><span><Zap size={15}/> NEW REQUEST</span><strong>{formatGBP(l.price)}</strong></div><h3>Driving lesson in {l.location}</h3><div className="request-details"><IconLabel icon={Clock3}>{l.timing === 'ASAP' ? 'As soon as possible' : l.timing === 'Later today' ? `Today · ${l.time}` : `${prettyDate(l.date)} · ${l.time}`}</IconLabel><IconLabel icon={Timer}>{l.duration} minutes</IconLabel><IconLabel icon={CarFront}>{l.transmission}</IconLabel><IconLabel icon={UserRound}>Sophie M. (demo)</IconLabel></div><div className="request-actions"><Button variant="secondary" onClick={() => updateLesson(l.id,'declined')}>Decline</Button><Button variant="primary" disabled={!demo.instructorOnline} onClick={() => updateLesson(l.id,'confirmed')} icon={Check}>Accept request</Button></div></div>) : <div className="empty-state mini-empty"><Bell size={33}/><h3>All caught up</h3><p>New learner requests for this demo profile will appear here.</p></div>}
          </section><section className="card activity-card"><div className="heading-row"><h2>Active lessons</h2><span className="number-pill">{activeLessons.length}</span></div>{activeLessons.length ? activeLessons.map(l => <div className="active-lesson" key={l.id}><div className="active-lesson-head"><strong>{l.customer}</strong><StatusBadge status={l.status}/></div><p>{l.location} · {l.duration} min · {formatGBP(l.price)}</p>
            {l.status === 'confirmed' && <Button className="full" icon={Navigation2} onClick={() => updateLesson(l.id,'arrived')}>Mark as arrived</Button>}
            {l.status === 'arrived' && <Button className="full" icon={Play} onClick={() => updateLesson(l.id,'in_progress')}>Start demo lesson</Button>}
            {l.status === 'in_progress' && <><div className="inline-timer"><Timer size={18}/>{l.startedAt ? `${Math.max(0,Math.ceil((l.duration*60000-(clock-new Date(l.startedAt).getTime()))/60000))} min left` : 'Timer running'}</div><Button className="full" icon={CheckCircle2} onClick={() => updateLesson(l.id,'completed')}>Complete lesson</Button></>}
          </div>) : <div className="empty-state mini-empty"><SteeringWheel size={35}/><h3>No active lessons</h3><p>Accepted requests will move here.</p></div>}
          <div className="instructor-tip"><ShieldCheck size={20}/><p><strong>Prototype notice</strong><br/>Real sign-ups and test instructor diaries are connected. Driving instructor approval, insurance checks, paid bookings and payouts are not connected.</p></div></section></div>
          <section className="card feedback-list"><div className="heading-row"><div><span className="eyebrow">AFTER EACH COMPLETED LESSON</span><h2>Assess your learner’s skill</h2></div></div><p className="feedback-explainer">Rate the learner's driving skill from 1 (beginner) to 10 (very confident). Once an assessment exists, the learner sees the average of instructor scores, not their own sign-up estimate.</p>{instructorLessons.some(l=>l.status==='completed') ? instructorLessons.filter(l=>l.status==='completed').map(l=><div className="instructor-feedback-item" key={l.id}><strong>{l.customer} · {l.location}</strong>{l.instructorLearnerSkill ? <div className="feedback-saved"><CheckCircle2 size={17}/> Skill assessment saved: {l.instructorLearnerSkill}/10</div> : <><p>What is this learner's skill level after the lesson?</p><div className="skill-number-grid">{Array.from({length:10},(_,i)=>i+1).map(score=><button type="button" key={score} aria-pressed={skillDrafts[l.id]===score} className={skillDrafts[l.id]===score?'selected':''} onClick={()=>setSkillDrafts(prev=>({...prev,[l.id]:score}))}>{score}</button>)}</div><Button onClick={()=>submitInstructorSkill(l.id)} disabled={!skillDrafts[l.id]}>Submit learner assessment</Button></>}</div>) : <p className="history-empty">Completed demo lessons will appear here for assessment.</p>}</section>
           <section className="card history-card"><div className="heading-row"><h2>Lesson history</h2><small>{instructorLessons.length} total demo requests</small></div>{instructorLessons.length ? <div className="history-table">{instructorLessons.map(l => <div key={l.id} className="history-row"><span>{l.customer}<small>{l.location}</small></span><StatusBadge status={l.status}/><strong>{formatGBP(l.price)}</strong></div>)}</div> : <p className="history-empty">Complete a demo lesson to start building your history.</p>}</section>
        </>}
        {role === 'instructor' && page === 'diary' && <>
          <section className="instructor-welcome"><div><span className="eyebrow">INSTRUCTOR AVAILABILITY</span><h1>Your diary.</h1><p>Plan the slots learners can request in this demo.</p></div><label className="instructor-picker">Demo instructor profile <span><select aria-label="Choose instructor diary" value={instructorAccountId} onChange={e=>setInstructorAccountId(e.target.value)}>{INSTRUCTORS.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select><ChevronDown size={16}/></span></label></section>
          <InstructorDiary instructor={activeInstructor} demo={demo}
            onAddWindow={(w:WeeklyWindow)=>setDemo(prev=>({...prev,weeklyWindows:[...prev.weeklyWindows,w]}))}
            onRemoveWindow={(id:string)=>setDemo(prev=>({...prev,weeklyWindows:prev.weeklyWindows.filter(w=>w.id!==id)}))}
            onAddBlock={(b:DiaryBlock)=>setDemo(prev=>({...prev,diaryBlocks:[...prev.diaryBlocks,b]}))}
            onRemoveBlock={(id:string)=>setDemo(prev=>({...prev,diaryBlocks:prev.diaryBlocks.filter(b=>b.id!==id)}))}
            onAddOpening={(opening:OneOffWindow)=>setDemo(prev=>({...prev,oneOffWindows:[...prev.oneOffWindows,opening]}))}
            onRemoveOpening={(id:string)=>setDemo(prev=>({...prev,oneOffWindows:prev.oneOffWindows.filter(w=>w.id!==id)}))}
          />
        </>}
      </main>
      <footer className="footer"><span>© {new Date().getFullYear()} DriveNow concept</span><span>Prototype only · No real bookings or charges</span></footer>
    </div>
    <nav className="mobile-bottom" aria-label="Mobile navigation"><button className={role==='learner' && page==='home' ? 'active' : ''} onClick={() => {switchRole('learner');setPage('home');}}><Home size={21}/><span>Discover</span></button><button className={role==='learner' && page==='my-lessons' ? 'active' : ''} onClick={() => {setRole('learner');setPage('my-lessons');}}><CalendarDays size={21}/><span>Lessons</span></button><button className={page==='alerts'?'active':''} onClick={()=>{setRole('learner');setPage('alerts');}}><Bell size={21}/><span>Alerts{unreadAlerts>0?' · '+unreadAlerts:''}</span></button><button className={page==='signup' ? 'active' : ''} onClick={() => setPage('signup')}><UserRound size={21}/><span>Account</span></button><button className={role==='instructor' && page==='instructor' ? 'active' : ''} onClick={() => switchRole('instructor')}><SteeringWheel size={21}/><span>Instructor</span></button></nav>
    {menuOpen && <button className="sidebar-overlay" aria-label="Close sidebar" onClick={() => setMenuOpen(false)} />}
    {toast && <div className="toast" role="status"><CheckCircle2 size={18}/>{toast}<button aria-label="Dismiss notice" onClick={() => setToast('')}><X size={15}/></button></div>}
  </div>;
}

export default App;
