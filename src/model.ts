export type Transmission = 'Manual' | 'Automatic';
export type LessonStatus = 'requested' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'declined' | 'cancelled';
export type Timing = 'ASAP' | 'Later today' | 'Choose a date';
export type Page = 'home' | 'details' | 'instructors' | 'checkout' | 'lesson' | 'my-lessons' | 'instructor' | 'signup' | 'schedule' | 'diary' | 'live-diary' | 'live-slots';
export type BookingMode = 'now' | 'ahead' | 'block';
export interface SlotSelection { date: string; time: string; duration: number; }
export interface WeeklyWindow { id: string; instructorId: string; weekday: number; start: string; end: string; }
export interface DiaryBlock { id: string; instructorId: string; date: string; start: string; end: string; note: string; }
export interface OneOffWindow { id: string; instructorId: string; date: string; start: string; end: string; source: 'cancellation' | 'extra'; }

export interface Instructor {
  id: string;
  name: string;
  initials: string;
  hue: string;
  rating: number;
  reviews: number;
  price: number;
  eta: number;
  transmission: Transmission[];
  car: string;
  description: string;
}

export interface SearchPreferences {
  location: string;
  transmission: Transmission;
  duration: number;
  timing: Timing;
  date: string;
  time: string;
}

export interface Lesson {
  id: string;
  instructorId: string;
  customer: string;
  bookedAt: string;
  location: string;
  transmission: Transmission;
  duration: number;
  timing: Timing;
  date: string;
  time: string;
  price: number;
  status: LessonStatus;
  startedAt?: string;
  blockBookingId?: string;
  completedAt?: string;
  /** Learner rates instructor out of five after completion. */
  learnerInstructorRating?: number;
  /** Instructor rates learner skill out of ten after completion. */
  instructorLearnerSkill?: number;
}

export interface DemoState {
  lessons: Lesson[];
  instructorOnline: boolean;
  weeklyWindows: WeeklyWindow[];
  diaryBlocks: DiaryBlock[];
  oneOffWindows: OneOffWindow[];
  learnerSelfSkill: number;
}

export const INSTRUCTORS: Instructor[] = [
  { id: 'james', name: 'James R.', initials: 'JR', hue: '#c9d8f5', rating: 4.9, reviews: 112, price: 38, eta: 8, transmission: ['Manual'], car: 'Ford Fiesta', description: 'Patient, confidence-building lessons for learners at every level.' },
  { id: 'emma', name: 'Emma T.', initials: 'ET', hue: '#eecada', rating: 4.8, reviews: 87, price: 40, eta: 12, transmission: ['Automatic', 'Manual'], car: 'Toyota Yaris', description: 'Friendly, structured lessons, including nervous first-time drivers.' },
  { id: 'mark', name: 'Mark D.', initials: 'MD', hue: '#cbdfd3', rating: 4.9, reviews: 203, price: 37, eta: 15, transmission: ['Automatic'], car: 'Volkswagen Polo', description: 'Learn at your own pace with practical, easy-to-follow coaching.' }
];

export const DEFAULT_PREFS: SearchPreferences = {
  location: 'Leeds, LS7',
  transmission: 'Manual',
  duration: 60,
  timing: 'ASAP',
  date: new Date().toLocaleDateString('en-CA'),
  time: '14:00'
};

export const INITIAL_WEEKLY_WINDOWS: WeeklyWindow[] = INSTRUCTORS.flatMap(instructor =>
  [1, 2, 3, 4, 5].flatMap(day => [
    { id: `${instructor.id}-${day}-morning`, instructorId: instructor.id, weekday: day, start: '09:00', end: '12:00' },
    { id: `${instructor.id}-${day}-afternoon`, instructorId: instructor.id, weekday: day, start: '13:00', end: '17:00' }
  ]).concat([
    { id: `${instructor.id}-6-weekend`, instructorId: instructor.id, weekday: 6, start: '10:00', end: '14:00' }
  ])
);
export const INITIAL_STATE: DemoState = { lessons: [], instructorOnline: true, learnerSelfSkill: 5, weeklyWindows: INITIAL_WEEKLY_WINDOWS, diaryBlocks: [], oneOffWindows: [] };
export const STATE_KEY = 'drivenow-demo-v1';

export function loadDemoState(): DemoState {
  try {
    const value = localStorage.getItem(STATE_KEY);
    if (!value) return INITIAL_STATE;
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && 'lessons' in parsed && Array.isArray(parsed.lessons)) {
      const input = parsed as DemoState;
      return { lessons: input.lessons, instructorOnline: input.instructorOnline !== false,
        weeklyWindows: Array.isArray(input.weeklyWindows) ? input.weeklyWindows : INITIAL_WEEKLY_WINDOWS,
        diaryBlocks: Array.isArray(input.diaryBlocks) ? input.diaryBlocks : [],
        oneOffWindows: Array.isArray(input.oneOffWindows) ? input.oneOffWindows : [],
        learnerSelfSkill: Number.isInteger(input.learnerSelfSkill) && input.learnerSelfSkill >= 1 && input.learnerSelfSkill <= 10 ? input.learnerSelfSkill : 5 };
    }
  } catch { /* damaged storage falls back to a clean demo */ }
  return INITIAL_STATE;
}

export function formatGBP(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
}

export function prettyDate(date: string) {
  if (!date) return 'Choose a date';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function prettyStatus(status: LessonStatus) {
  const names: Record<LessonStatus, string> = {
    requested: 'Awaiting instructor', confirmed: 'Confirmed', arrived: 'Instructor arrived',
    in_progress: 'Lesson in progress', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled'
  };
  return names[status];
}

/** Instructor assessments supersede the one-time signup estimate. */
export function getDisplaySkill(state: DemoState): { score: number; source: 'self' | 'instructors'; count: number } {
  const scores = state.lessons.filter(l => l.status === 'completed').map(l => l.instructorLearnerSkill)
    .filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 10);
  if (!scores.length) return { score: state.learnerSelfSkill, source: 'self', count: 0 };
  return { score: Math.round(scores.reduce((a,b)=>a+b,0) / scores.length * 10) / 10, source: 'instructors', count: scores.length };
}
