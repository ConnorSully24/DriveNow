import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, CircleHelp, ExternalLink, KeyRound, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { friendlyVerificationStatus, supabase, type LearnerVerification } from './auth';

interface Props { onBack: () => void; }

type FormData = {
  firstName: string;
  lastName: string;
  dob: string;
  postcode: string;
  licenceIssuer: 'GB' | 'NI';
  hasProvisional: boolean;
  meetsEyesight: boolean;
  email: string;
  password: string;
  repeatPassword: string;
  acknowledge: boolean;
};

const EMPTY: FormData = {
  firstName: '', lastName: '', dob: '', postcode: '', licenceIssuer: 'GB',
  hasProvisional: false, meetsEyesight: false, email: '', password: '', repeatPassword: '', acknowledge: false
};

function isAtLeast17(dob: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const date = new Date(`${dob}T12:00:00`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dob) return false;
  const today = new Date();
  const threshold = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
  return date <= threshold;
}

function validPostcode(value: string) {
  return /^(GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))$/i.test(value.trim());
}

export default function LearnerAccount({ onBack }: Props) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [form, setForm] = useState<FormData>(EMPTY);
  const [user, setUser] = useState<User | null>(null);
  const [verification, setVerification] = useState<LearnerVerification>('not_submitted');
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase));
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  function change<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(previous => ({ ...previous, [key]: value }));
    setError('');
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) { setUser(data.user); setCheckingSession(false); }
    }).catch(() => { if (active) setCheckingSession(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !user) { setVerification('not_submitted'); return; }
    let active = true;
    supabase.from('learner_verifications').select('status').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (active && data?.status && data.status in friendlyVerificationStatus) {
          setVerification(data.status as LearnerVerification);
        }
      });
    return () => { active = false; };
  }, [user]);

  function next() {
    if (step === 0) {
      if (form.firstName.trim().length < 2 || form.lastName.trim().length < 2) {
        setError('Enter your first and last name as shown on your driving licence.'); return;
      }
      if (!isAtLeast17(form.dob)) {
        setError('The DriveNow pilot currently supports learners aged 17 or over. Special age-16 eligibility will need manual review when available.'); return;
      }
      if (!validPostcode(form.postcode)) { setError('Enter a valid UK postcode.'); return; }
    }
    if (step === 1 && (!form.hasProvisional || !form.meetsEyesight)) {
      setError('Confirm you hold a current provisional licence and meet the eyesight requirement to continue.'); return;
    }
    setError(''); setStep(previous => Math.min(2, previous + 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice('');
    if (!supabase) {
      setError('Account creation is not connected yet. This is a sign-up preview. No personal details have been submitted or saved.'); return;
    }
    const email = form.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Enter a valid email address.'); return; }
    if (mode === 'signup') {
      if (form.password.length < 12) { setError('Choose a password with at least 12 characters.'); return; }
      if (form.password !== form.repeatPassword) { setError('Your passwords do not match.'); return; }
      if (!form.acknowledge) { setError('Please read and acknowledge the account and verification information.'); return; }
    }
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password: form.password });
        if (authError) throw authError;
        setNotice('Signed in. Your licence verification status is shown below.');
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email, password: form.password,
          options: {
            emailRedirectTo: window.location.origin + window.location.pathname,
            data: {
              role: 'learner', first_name: form.firstName.trim(), last_name: form.lastName.trim(),
              date_of_birth: form.dob, postcode: form.postcode.trim().toUpperCase(),
              licence_issuer: form.licenceIssuer,
              provisional_declared: form.hasProvisional, eyesight_declared: form.meetsEyesight
            }
          }
        });
        if (authError) throw authError;
        if (data.user && data.session) setUser(data.user);
        setNotice('Account request received. Check your inbox for the confirmation email. Your provisional licence has NOT been verified.');
        // Credentials never go into localStorage, URLs, log messages or demo state.
        setForm(previous => ({ ...EMPTY, email: previous.email }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally { setSubmitting(false); }
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null); setVerification('not_submitted'); setMode('signin'); setStep(2);
    setNotice('Signed out.'); setError('');
  }

  const isConfigured = Boolean(supabase);
  const labels = ['About you', 'Your licence', 'Create account'];

  return <section className="account-page">
    <div className="account-heading"><button className="back-link" onClick={onBack}><ArrowLeft size={17}/> Back to DriveNow</button>
      <span className="eyebrow">DRIVENOW · LEARNER ACCOUNT</span>
      <h1>{user ? 'Your learner account' : mode === 'signin' ? 'Welcome back.' : 'Let’s get you road-ready.'}</h1>
      <p>{user ? 'Your details and verification progress in one place.' : 'Create your account, confirm your driving eligibility and prepare for a secure provisional licence check.'}</p>
    </div>

    {!isConfigured && <div className="account-banner"><CircleHelp size={20}/><div><strong>Preview mode — no accounts are being created</strong><span>We’re building the sign-up experience. A secure authentication backend must be connected before using real personal information.</span></div></div>}
    {notice && <div className="account-message account-success" role="status"><CheckCircle2 size={19}/>{notice}</div>}
    {error && <div className="account-message account-error" role="alert"><CircleHelp size={19}/>{error}</div>}

    {checkingSession ? <div className="account-card"><p>Checking your account…</p></div> : user ? <div className="account-layout">
      <div className="account-card">
        <div className="account-card-head"><span className="account-symbol"><UserRound size={24}/></span><div><h2>{user.user_metadata?.first_name ? `Hello, ${String(user.user_metadata.first_name)}!` : 'Your account'}</h2><p>{user.email}</p></div></div>
        <div className="account-status"><ShieldCheck size={22}/><div><strong>{friendlyVerificationStatus[verification]}</strong><span>{verification === 'verified' ? 'A trusted check has been recorded by DriveNow.' : 'Self-declaration is not licence verification. A secure DVLA or identity-provider check will be required before live lessons.'}</span></div></div>
        <div className="account-status account-status-neutral"><Mail size={22}/><div><strong>Email confirmation</strong><span>{user.email_confirmed_at ? 'Confirmed' : 'Please confirm your email using the link we sent.'}</span></div></div>
        <button className="btn btn-secondary account-signout" onClick={logout}>Sign out</button>
      </div>
      <aside className="account-aside"><h3>Verification comes next</h3><p>In the production app, learners will complete a secure licence check before a real booking can be confirmed.</p><a href="https://www.gov.uk/view-driving-licence" target="_blank" rel="noopener noreferrer">Learn about DVLA check codes <ExternalLink size={15}/></a><small>Do not send licence photos or numbers to us yet.</small></aside>
    </div> : <div className="account-layout">
      <div className="account-card">
        {mode === 'signup' && <div className="account-progress" aria-label={`Account creation step ${step+1} of 3`}>{labels.map((label,i)=><div key={label} className={`account-progress-step ${i <= step ? 'current' : ''}`}><span>{i < step ? <CheckCircle2 size={17}/> : i + 1}</span><small>{label}</small></div>)}</div>}
        {mode === 'signin' ? <>
          <div className="account-card-head"><span className="account-symbol"><KeyRound size={22}/></span><div><h2>Sign in</h2><p>Access your learner account.</p></div></div>
          <form className="account-form" onSubmit={submit}>
            <label>Email<input type="email" autoComplete="email" required value={form.email} onChange={e=>change('email',e.target.value)} placeholder="you@example.com"/></label>
            <label>Password<input type="password" autoComplete="current-password" required value={form.password} onChange={e=>change('password',e.target.value)}/></label>
            <button className="btn btn-primary full" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'} <ArrowRight size={18}/></button>
          </form>
          <button className="account-text-button" onClick={()=>{setMode('signup');setStep(0);setError('');setNotice('');}}>New to DriveNow? Create an account</button>
        </> : <>
          {step === 0 && <><div className="account-card-head"><span className="account-symbol"><UserRound size={23}/></span><div><h2>First, the basics</h2><p>Use the name shown on your provisional licence.</p></div></div>
            <div className="account-form"><div className="account-two-fields"><label>First name<input autoComplete="given-name" maxLength={70} value={form.firstName} onChange={e=>change('firstName',e.target.value)} placeholder="First name"/></label><label>Last name<input autoComplete="family-name" maxLength={70} value={form.lastName} onChange={e=>change('lastName',e.target.value)} placeholder="Surname"/></label></div>
              <label>Date of birth<input type="date" autoComplete="bday" max={new Date().toISOString().slice(0,10)} value={form.dob} onChange={e=>change('dob',e.target.value)}/><small>Most people can learn to drive a car from age 17. Special age-16 eligibility will need separate review.</small></label>
              <label>Home postcode<input autoComplete="postal-code" maxLength={10} value={form.postcode} onChange={e=>change('postcode',e.target.value)} placeholder="LS1 1AA"/></label></div>
            <button className="btn btn-primary full" onClick={next}>Continue <ArrowRight size={18}/></button>
          </>}
          {step === 1 && <><div className="account-card-head"><span className="account-symbol"><ShieldCheck size={23}/></span><div><h2>Your driving eligibility</h2><p>Before your first lesson, we must confirm your provisional licence.</p></div></div>
            <div className="account-form"><fieldset className="account-fieldset"><legend>Where was your provisional licence issued?</legend><div className="account-switch"><button type="button" className={form.licenceIssuer==='GB'?'selected':''} onClick={()=>change('licenceIssuer','GB')}>Great Britain</button><button type="button" className={form.licenceIssuer==='NI'?'selected':''} onClick={()=>change('licenceIssuer','NI')}>Northern Ireland</button></div></fieldset>
              <label className="account-check"><input type="checkbox" checked={form.hasProvisional} onChange={e=>change('hasProvisional',e.target.checked)}/><span>I hold a valid provisional driving licence for the UK.</span></label>
              <label className="account-check"><input type="checkbox" checked={form.meetsEyesight} onChange={e=>change('meetsEyesight',e.target.checked)}/><span>I meet the legal eyesight requirements for driving, with glasses or contacts if needed.</span></label>
              <div className="account-tip"><LockKeyhole size={20}/><div><strong>We won't ask you to upload your licence yet.</strong><p>A secure verification provider or authorised manual check must be connected before any photos, licence numbers or DVLA check codes are collected. This declaration alone does not verify you.</p></div></div>
            </div><div className="account-buttons"><button className="btn btn-secondary" onClick={()=>setStep(0)}>Back</button><button className="btn btn-primary" onClick={next}>Continue <ArrowRight size={18}/></button></div>
          </>}
          {step === 2 && <><div className="account-card-head"><span className="account-symbol"><Mail size={23}/></span><div><h2>Create your login</h2><p>Your email will need confirming before you use a live account.</p></div></div>
            <form className="account-form" onSubmit={submit}>
              <label>Email address<input type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" value={form.email} onChange={e=>change('email',e.target.value)}/></label>
              <label>Password<input type="password" autoComplete="new-password" minLength={12} required value={form.password} onChange={e=>change('password',e.target.value)} placeholder="At least 12 characters"/></label>
              <label>Confirm password<input type="password" autoComplete="new-password" minLength={12} required value={form.repeatPassword} onChange={e=>change('repeatPassword',e.target.value)}/></label>
              <label className="account-check"><input type="checkbox" checked={form.acknowledge} onChange={e=>change('acknowledge',e.target.checked)}/><span>I understand that this is an account application, not proof that my licence is verified. My details will be used for account and eligibility checks once the service launches.</span></label>
              <div className="account-tip"><LockKeyhole size={20}/><div><strong>Your licence stays private.</strong><p>Never upload or email your driving licence to this prototype. A full privacy notice, secure review process and deletion controls are required before public sign-up launches.</p></div></div>
              <div className="account-buttons"><button type="button" className="btn btn-secondary" onClick={()=>setStep(1)}>Back</button><button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? 'Creating account…' : isConfigured ? 'Create account' : 'Preview account creation'} <ArrowRight size={17}/></button></div>
            </form>
          </>}
          <button className="account-text-button" onClick={()=>{setMode('signin');setStep(2);setError('');setNotice('');}}>Already have an account? Sign in</button>
        </>}
      </div>
      <aside className="account-aside"><span className="account-aside-icon"><BadgeCheck size={27}/></span><h3>Safe lessons start with verified learners</h3><p>Your driving licence needs checking before you can book a real lesson. We’re building that process securely, rather than relying on an uploaded picture.</p>
        <div className="account-aside-item"><CalendarDays size={18}/><span>Usually aged 17 or over for car lessons</span></div>
        <div className="account-aside-item"><ShieldCheck size={18}/><span>Valid provisional licence required</span></div>
        <div className="account-aside-item"><Mail size={18}/><span>Email confirmation and account security</span></div>
        <a href="https://www.gov.uk/driving-lessons-learning-to-drive" target="_blank" rel="noopener noreferrer">UK learner driver requirements <ExternalLink size={15}/></a>
      </aside>
    </div>}
  </section>;
}
