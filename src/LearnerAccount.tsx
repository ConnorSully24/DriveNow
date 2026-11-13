import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, CarFront, CheckCircle2, CircleHelp,
  ExternalLink, GraduationCap, KeyRound, LockKeyhole, Mail, ShieldCheck, UserRound
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { friendlyVerificationStatus, supabase, type LearnerVerification } from './auth';

type AccountRole = 'learner' | 'instructor';
type InstructorRegistration = 'adi' | 'trainee' | 'ni';
interface Props {
  onBack: () => void;
  onDemo: (role: AccountRole) => void;
}

type FormData = {
  firstName: string;
  lastName: string;
  dob: string;
  postcode: string;
  licenceIssuer: 'GB' | 'NI';
  hasProvisional: boolean;
  meetsEyesight: boolean;
  instructorRegistration: InstructorRegistration;
  fullLicence3Years: boolean;
  insuredVehicle: boolean;
  transmission: 'Manual' | 'Automatic' | 'Both';
  email: string;
  password: string;
  repeatPassword: string;
  acknowledge: boolean;
};

const EMPTY: FormData = {
  firstName: '', lastName: '', dob: '', postcode: '', licenceIssuer: 'GB',
  hasProvisional: false, meetsEyesight: false,
  instructorRegistration: 'adi', fullLicence3Years: false,
  insuredVehicle: false, transmission: 'Manual', email: '', password: '',
  repeatPassword: '', acknowledge: false
};

const DEMO_AVAILABLE = !supabase || import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';

function atLeastAge(dob: string, age: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const [year, month, day] = dob.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return false;
  const today = new Date();
  const birthday = new Date(today.getFullYear() - age, today.getMonth(), today.getDate());
  return new Date(year, month - 1, day) <= birthday;
}

function validPostcode(value: string): boolean {
  return /^(GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))$/i.test(value.trim());
}

export default function LearnerAccount({ onBack, onDemo }: Props) {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [role, setRole] = useState<AccountRole>('learner');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [user, setUser] = useState<User | null>(null);
  const [accountRole, setAccountRole] = useState<AccountRole | null>(null);
  const [verification, setVerification] = useState<LearnerVerification>('not_submitted');
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase));
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  function change<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(old => ({ ...old, [key]: value }));
    setError('');
  }

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    client.auth.getUser().then(({ data }) => {
      if (active) { setUser(data.user); setCheckingSession(false); }
    }).catch(() => { if (active) setCheckingSession(false); });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        if (event === 'PASSWORD_RECOVERY') setRecoveringPassword(true);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !user) {
      setAccountRole(null);
      setVerification('not_submitted');
      return;
    }
    let active = true;
    async function loadProfile() {
      if (!client || !user) return;
      // Role comes from read-only database profiles, never editable user metadata.
      const [learner, instructor] = await Promise.all([
        client.from('learner_profiles').select('user_id').eq('user_id', user.id).maybeSingle(),
        client.from('instructor_profiles').select('user_id').eq('user_id', user.id).maybeSingle()
      ]);
      if (!active) return;
      const realRole: AccountRole | null = instructor.data ? 'instructor' : learner.data ? 'learner' : null;
      setAccountRole(realRole);
      if (!realRole) { setVerification('not_submitted'); return; }
      const table = realRole === 'instructor' ? 'instructor_verifications' : 'learner_verifications';
      const { data } = await client.from(table).select('status').eq('user_id', user.id).maybeSingle();
      if (active) setVerification(data?.status && data.status in friendlyVerificationStatus
        ? data.status as LearnerVerification : 'not_submitted');
    }
    void loadProfile();
    return () => { active = false; };
  }, [user]);

  function next() {
    if (step === 1) {
      if (form.firstName.trim().length < 2 || form.lastName.trim().length < 2) {
        setError('Enter your legal first and last name.'); return;
      }
      if (!atLeastAge(form.dob, role === 'instructor' ? 21 : 17)) {
        setError(role === 'instructor' ? 'Instructor applicants must be at least 21 years old.' : 'The pilot currently supports learners aged 17 or over.');
        return;
      }
      if (!validPostcode(form.postcode)) { setError('Enter a valid UK postcode.'); return; }
    }
    if (step === 2) {
      if (role === 'learner' && (!form.hasProvisional || !form.meetsEyesight)) {
        setError('Confirm your current provisional licence and eyesight eligibility.'); return;
      }
      if (role === 'instructor' && (!form.fullLicence3Years || !form.insuredVehicle)) {
        setError('Confirm your full-licence history and suitable insured teaching vehicle.'); return;
      }
      if (role === 'instructor' && form.licenceIssuer === 'NI' && form.instructorRegistration !== 'ni') {
        setError('Select the Northern Ireland instructor authorisation option for an NI registration.'); return;
      }
      if (role === 'instructor' && form.licenceIssuer === 'GB' && form.instructorRegistration === 'ni') {
        setError('Select an ADI or trainee licence for a Great Britain registration.'); return;
      }
    }
    setError('');
    setStep(n => Math.min(n + 1, 3));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice('');
    const client = supabase;
    if (!client) {
      setError('Live account creation is not connected yet. Use the demo shortcut below without entering any real personal details.');
      return;
    }
    const email = form.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Enter a valid email address.'); return; }
    if (mode === 'signup') {
      if (form.password.length < 12) { setError('Use at least 12 characters for your password.'); return; }
      if (form.password !== form.repeatPassword) { setError('Your passwords do not match.'); return; }
      if (!form.acknowledge) { setError('Please acknowledge the verification information.'); return; }
      if (!atLeastAge(form.dob, role === 'instructor' ? 21 : 17) || !validPostcode(form.postcode)) {
        setError('Check your name, date of birth and postcode before submitting.'); return;
      }
      if (role === 'learner' && (!form.hasProvisional || !form.meetsEyesight)) {
        setError('You must confirm your learner eligibility.'); return;
      }
      if (role === 'instructor' && (!form.fullLicence3Years || !form.insuredVehicle)) {
        setError('You must confirm your instructor eligibility.'); return;
      }
    }
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const { error: authError } = await client.auth.signInWithPassword({ email, password: form.password });
        if (authError) throw authError;
        setNotice('Welcome back. Your account status appears below.');
      } else {
        const { data, error: authError } = await client.auth.signUp({
          email,
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin + window.location.pathname,
            data: {
              role, first_name: form.firstName.trim(), last_name: form.lastName.trim(),
              date_of_birth: form.dob, postcode: form.postcode.trim().toUpperCase(),
              licence_issuer: form.licenceIssuer,
              ...(role === 'learner' ? {
                provisional_declared: form.hasProvisional,
                eyesight_declared: form.meetsEyesight
              } : {
                registration_type: form.instructorRegistration,
                full_licence_three_years_declared: form.fullLicence3Years,
                insured_teaching_vehicle_declared: form.insuredVehicle,
                transmission: form.transmission
              })
            }
          }
        });
        if (authError) throw authError;
        if (data.session?.user) setUser(data.session.user);
        setNotice('Check your email for a confirmation link. Your ' + (role === 'instructor' ? 'instructor credentials' : 'provisional licence') + ' have NOT been verified.');
        setForm({ ...EMPTY, email });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword() {
    const client = supabase;
    if (!client) { setError('Connect Supabase to enable password resets.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError('Enter your email address first.'); return;
    }
    setSubmitting(true); setError('');
    const { error: resetError } = await client.auth.resetPasswordForEmail(form.email.trim().toLowerCase(), {
      redirectTo: window.location.origin + window.location.pathname
    });
    setSubmitting(false);
    if (resetError) setError(resetError.message);
    else setNotice('If an account exists for that email, a reset link will be sent.');
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    if (form.password.length < 12 || form.password !== form.repeatPassword) {
      setError('Choose a matching new password with at least 12 characters.'); return;
    }
    setSubmitting(true); setError('');
    const { error: updateError } = await client.auth.updateUser({ password: form.password });
    setSubmitting(false);
    if (updateError) { setError(updateError.message); return; }
    setRecoveringPassword(false);
    setForm(old => ({ ...old, password: '', repeatPassword: '' }));
    setNotice('Your password was updated successfully.');
  }

  async function logout() {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) { setError(signOutError.message); return; }
    setUser(null); setVerification('not_submitted'); setAccountRole(null);
    setMode('signin'); setStep(0);
    setNotice('Signed out.'); setError('');
  }

  function startDemo(demoRole: AccountRole) {
    if (!DEMO_AVAILABLE) return;
    setError(''); setNotice('');
    onDemo(demoRole);
  }

  const labels = ['Account type', 'About you', role === 'learner' ? 'Provisional licence' : 'Instructor eligibility', 'Create login'];
  const verifiedLabel = accountRole === 'instructor'
    ? ({ not_submitted: 'Instructor checks not submitted', pending: 'Instructor checks in review', verified: 'Instructor approved', rejected: 'Additional checks needed' } as const)[verification]
    : friendlyVerificationStatus[verification];

  return <section className="account-page">
    <div className="account-heading">
      <button className="back-link" onClick={onBack}><ArrowLeft size={17}/> Back to DriveNow</button>
      <span className="eyebrow">DRIVENOW · ACCOUNTS</span>
      <h1>{user ? 'Your DriveNow account' : mode === 'signin' ? 'Welcome back.' : 'Ready to get started?'}</h1>
      <p>{user ? 'Account and verification status, all in one place.' : 'Sign up as a learner driver or driving instructor. You can also explore the demo without entering any details.'}</p>
    </div>

    {!supabase && <div className="account-banner"><CircleHelp size={20}/><div>
      <strong>Demo preview — real account creation is not connected</strong>
      <span>Supabase needs configuring before we can safely register real accounts. Please do not enter personal details yet. Use “Skip sign-up” below.</span>
    </div></div>}
    {notice && <div className="account-message account-success" role="status"><CheckCircle2 size={19}/>{notice}</div>}
    {error && <div className="account-message account-error" role="alert"><CircleHelp size={19}/>{error}</div>}

    {checkingSession ? <div className="account-card">Checking your account…</div> : user && recoveringPassword ? <div className="account-layout"><div className="account-card">
      <div className="account-card-head"><span className="account-symbol"><KeyRound size={23}/></span><div><h2>Choose a new password</h2><p>You're securely resetting your account password.</p></div></div>
      <form className="account-form" onSubmit={updatePassword}>
        <label>New password<input type="password" autoComplete="new-password" required minLength={12} value={form.password} onChange={e => change('password', e.target.value)}/></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={12} value={form.repeatPassword} onChange={e => change('repeatPassword',e.target.value)}/></label>
        <button className="btn btn-primary full" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save new password'}</button>
      </form>
    </div></div> : user ? <div className="account-layout">
      <div className="account-card">
        <div className="account-card-head"><span className="account-symbol"><UserRound size={24}/></span><div><h2>Hi, {String(user.user_metadata?.first_name || 'there')}!</h2><p>{user.email}</p></div></div>
        <div className="account-status"><ShieldCheck size={22}/><div><strong>{verifiedLabel}</strong><span>{accountRole ? (accountRole === 'instructor' ? 'Your instructor authorisation must be independently checked before offering paid lessons.' : 'Your provisional entitlement must be independently checked before any paid booking.') : 'Your profile is not yet provisioned. Check that the database schema has been applied.'}</span></div></div>
        <div className="account-status account-status-neutral"><Mail size={22}/><div><strong>Email address</strong><span>{user.email_confirmed_at ? 'Confirmed' : 'Confirmation required — please check your inbox.'}</span></div></div>
        <button className="btn btn-secondary account-signout" onClick={logout}>Sign out</button>
      </div>
      <aside className="account-aside"><h3>{accountRole === 'instructor' ? 'Instructor approval is next' : 'Verification comes next'}</h3><p>Account creation and email verification do not grant permission to book or teach paid lessons. Authorised checks are still required.</p><a href="https://www.gov.uk/government/publications/whats-involved-in-being-a-driving-instructor/approved-driving-instructor-adi-register-guide" target="_blank" rel="noopener noreferrer">UK instructor requirements <ExternalLink size={15}/></a></aside>
    </div> : <div className="account-layout">
      <div className="account-card">
        {mode === 'signup' && <div className="account-progress" aria-label={'Account creation step ' + (step+1) + ' of 4'}>
          {labels.map((label, i) => <div key={label} className={'account-progress-step ' + (i <= step ? 'current' : '')}><span>{i < step ? <CheckCircle2 size={17}/> : i+1}</span><small>{label}</small></div>)}
        </div>}
        {mode === 'signin' ? <>
          <div className="account-card-head"><span className="account-symbol"><KeyRound size={23}/></span><div><h2>Sign in to DriveNow</h2><p>One login for learners and instructors.</p></div></div>
          <form className="account-form" onSubmit={submit}>
            <label>Email address<input type="email" autoComplete="email" required value={form.email} onChange={e => change('email', e.target.value)} placeholder="you@example.com"/></label>
            <label>Password<input type="password" autoComplete="current-password" required value={form.password} onChange={e => change('password', e.target.value)}/></label>
            <button type="submit" disabled={submitting || !supabase} className="btn btn-primary full">{submitting ? 'Signing in…' : 'Sign in'} <ArrowRight size={18}/></button>
          </form>
          <button className="account-text-button" onClick={() => { void resetPassword(); }} disabled={submitting}>Forgot password?</button>
          <button className="account-text-button" onClick={() => { setMode('signup'); setStep(0); setError(''); setNotice(''); }}>New to DriveNow? Create an account</button>
        </> : <>
          {step === 0 && <>
            <div className="account-card-head"><span className="account-symbol"><GraduationCap size={23}/></span><div><h2>How will you use DriveNow?</h2><p>Choose your account type to get the right sign-up journey.</p></div></div>
            <div className="account-role-grid">
              <button type="button" className={'account-role-card ' + (role === 'learner' ? 'account-role-selected' : '')} onClick={() => { setRole('learner'); setError(''); }}>
                <GraduationCap size={29}/><strong>I'm a learner</strong><small>Find an instructor, book a lesson and get on the road.</small><span>{role === 'learner' ? '✓ Selected' : 'Select learner'}</span>
              </button>
              <button type="button" className={'account-role-card ' + (role === 'instructor' ? 'account-role-selected' : '')} onClick={() => { setRole('instructor'); setError(''); }}>
                <CarFront size={29}/><strong>I'm an instructor</strong><small>Fill available lesson slots and manage incoming requests.</small><span>{role === 'instructor' ? '✓ Selected' : 'Select instructor'}</span>
              </button>
            </div>
            <button className="btn btn-primary full" onClick={next}>Continue as {role} <ArrowRight size={18}/></button>
          </>}
          {step === 1 && <>
            <div className="account-card-head"><span className="account-symbol"><UserRound size={23}/></span><div><h2>First, the basics</h2><p>Use your legal name. {role === 'instructor' ? 'Instructor applicants must be aged 21 or over.' : 'The initial learner pilot is for ages 17 and over.'}</p></div></div>
            <div className="account-form">
              <div className="account-two-fields"><label>First name<input autoComplete="given-name" maxLength={70} value={form.firstName} onChange={e => change('firstName', e.target.value)} placeholder="First name"/></label><label>Last name<input autoComplete="family-name" maxLength={70} value={form.lastName} onChange={e => change('lastName', e.target.value)} placeholder="Surname"/></label></div>
              <label>Date of birth<input type="date" autoComplete="bday" max={new Date().toISOString().slice(0,10)} value={form.dob} onChange={e => change('dob', e.target.value)}/></label>
              <label>UK postcode<input autoComplete="postal-code" maxLength={10} value={form.postcode} onChange={e => change('postcode', e.target.value)} placeholder="LS1 1AA"/></label>
            </div>
            <div className="account-buttons"><button className="btn btn-secondary" onClick={() => setStep(0)}>Back</button><button className="btn btn-primary" onClick={next}>Continue <ArrowRight size={18}/></button></div>
          </>}
          {step === 2 && <>
            <div className="account-card-head"><span className="account-symbol"><ShieldCheck size={23}/></span><div><h2>{role === 'learner' ? 'Your driving eligibility' : 'Your instructor eligibility'}</h2><p>These declarations help us prepare for real verification; they are not proof of a valid licence.</p></div></div>
            <div className="account-form">
              <fieldset className="account-fieldset"><legend>Where is your driving licence or instructor registration issued?</legend><div className="account-switch"><button type="button" className={form.licenceIssuer === 'GB' ? 'selected' : ''} onClick={() => { change('licenceIssuer','GB'); change('instructorRegistration','adi'); }}>Great Britain</button><button type="button" className={form.licenceIssuer === 'NI' ? 'selected' : ''} onClick={() => { change('licenceIssuer','NI'); change('instructorRegistration','ni'); }}>Northern Ireland</button></div></fieldset>
              {role === 'learner' ? <>
                <label className="account-check"><input type="checkbox" checked={form.hasProvisional} onChange={e => change('hasProvisional',e.target.checked)}/><span>I hold a current provisional driving licence.</span></label>
                <label className="account-check"><input type="checkbox" checked={form.meetsEyesight} onChange={e => change('meetsEyesight',e.target.checked)}/><span>I meet the legal driving eyesight requirement, with correction if needed.</span></label>
              </> : <>
                <label>Instructor registration type<select value={form.instructorRegistration} onChange={e => change('instructorRegistration', e.target.value as InstructorRegistration)}>
                  {form.licenceIssuer === 'GB' ? <><option value="adi">DVSA Approved Driving Instructor (ADI)</option><option value="trainee">DVSA trainee driving instructor (PDI)</option></> : <option value="ni">Northern Ireland authorised driving instructor</option>}
                </select></label>
                <label>Teaching car transmission<select value={form.transmission} onChange={e => change('transmission',e.target.value as FormData['transmission'])}><option>Manual</option><option>Automatic</option><option>Both</option></select></label>
                <label className="account-check"><input type="checkbox" checked={form.fullLicence3Years} onChange={e => change('fullLicence3Years',e.target.checked)}/><span>I am at least 21, hold the appropriate full driving licence for at least 3 years and hold the instructor authorisation selected above.</span></label>
                <label className="account-check"><input type="checkbox" checked={form.insuredVehicle} onChange={e => change('insuredVehicle',e.target.checked)}/><span>I will only provide lessons using a suitably insured and compliant training vehicle.</span></label>
              </>}
              <div className="account-tip"><LockKeyhole size={20}/><div><strong>Independent checks are required.</strong><p>We do not collect licence photos, driving licence numbers or DVLA check codes in this prototype. Registration does not automatically authorise lessons.</p></div></div>
            </div>
            <div className="account-buttons"><button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button><button className="btn btn-primary" onClick={next}>Continue <ArrowRight size={18}/></button></div>
          </>}
          {step === 3 && <>
            <div className="account-card-head"><span className="account-symbol"><Mail size={23}/></span><div><h2>Create your login</h2><p>We'll send you an email to confirm the account.</p></div></div>
            <form className="account-form" onSubmit={submit}>
              <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={e => change('email',e.target.value)} placeholder="you@example.com"/></label>
              <label>Password<input type="password" autoComplete="new-password" required minLength={12} value={form.password} onChange={e => change('password',e.target.value)} placeholder="At least 12 characters"/></label>
              <label>Confirm password<input type="password" autoComplete="new-password" required minLength={12} value={form.repeatPassword} onChange={e => change('repeatPassword',e.target.value)}/></label>
              <label className="account-check"><input type="checkbox" checked={form.acknowledge} onChange={e => change('acknowledge',e.target.checked)}/><span>I understand this creates a {role} account, not verified permission to {role === 'learner' ? 'book paid lessons' : 'teach paid lessons'}. Additional checks are required before launch.</span></label>
              <div className="account-buttons"><button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>Back</button><button type="submit" disabled={submitting || !supabase} className="btn btn-primary">{submitting ? 'Creating…' : 'Create account'} <ArrowRight size={18}/></button></div>
            </form>
          </>}
          <button className="account-text-button" onClick={() => { setMode('signin'); setError(''); setNotice(''); }}>Already have an account? Sign in</button>
        </>}
        {DEMO_AVAILABLE && <div className="account-demo-panel"><span className="account-demo-pill">TEST MODE · NO DETAILS NEEDED</span><h3>Skip sign-up and try the app</h3><p>No personal details or passwords needed. Demo accounts are simulated, and cannot book or offer real lessons.</p>
          <div className="account-demo-actions"><button type="button" onClick={() => startDemo('learner')}><GraduationCap size={18}/> Try learner demo <ArrowRight size={15}/></button><button type="button" onClick={() => startDemo('instructor')}><CarFront size={18}/> Try instructor demo <ArrowRight size={15}/></button></div>
        </div>}
      </div>
      <aside className="account-aside"><span className="account-aside-icon"><BadgeCheck size={27}/></span><h3>Two ways to drive forward</h3><p><strong>Learners</strong> find lessons after secure identity and provisional licence checks. <strong>Instructors</strong> list available slots after approved instructor and insurance checks.</p><div className="account-aside-item"><ShieldCheck size={18}/><span>Independent licence and eligibility checks</span></div><div className="account-aside-item"><Mail size={18}/><span>Verified email for real accounts</span></div><a href="https://www.gov.uk/government/publications/whats-involved-in-being-a-driving-instructor/approved-driving-instructor-adi-register-guide" target="_blank" rel="noopener noreferrer">UK instructor regulations <ExternalLink size={15}/></a></aside>
    </div>}
  </section>;
}
