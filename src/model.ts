export type Transmission = 'Manual' | 'Automatic';
export type LessonStatus = 'requested' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'declined' | 'cancelled';
export type Timing = 'ASAP' | 'Later today' | 'Choose a date';
export type Page = 'home' | 'details' | 'instructors' | 'checkout' | 'lesson' | 'my-lessons' | 'instructor' | 'signup';

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
  completedAt?: string;
  /** Learner rates instructor out of five after completion. */
  learnerInstructorRating?: number;
  /** Instructor rates learner skill out of ten after completion. */
  instructorLearnerSkill?: number;
}

export interface DemoState {
  lessons: Lesson[];
  instructorOnline: boolean;
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

export const INITIAL_STATE: DemoState = { lessons: [], instructorOnline: true, learnerSelfSkill: 5 };
export const STATE_KEY = 'drivenow-demo-v1';

export function loadDemoState(): DemoState {
  try {
    const value = localStorage.getItem(STATE_KEY);
    if (!value) return INITIAL_STATE;
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && 'lessons' in parsed && Array.isArray(parsed.lessons)) {
      const input = parsed as DemoState;
      return { lessons: input.lessons, instructorOnline: input.instructorOnline !== false,
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
