import type { DemoState, DiaryBlock, Lesson, SlotSelection } from './model';

// These utilities power a single-browser DEMO. Production slot reservations require
// server-side exclusion constraints and transactional holds across all users.
export const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const UK_ZONE = 'Europe/London';
export const STEP_MINUTES = 30;
export const MIN_NOTICE_MINUTES = 30;
export const TRAVEL_BUFFER_MINUTES = 15;

export function timeMinutes(value: string): number {
  const matched = /^(\d{2}):(\d{2})$/.exec(value);
  if (!matched) return NaN;
  const h=Number(matched[1]), m=Number(matched[2]);
  return h>=0 && h<=24 && m>=0 && m<60 && (h!==24 || m===0) ? h*60+m : NaN;
}
export function minuteTime(value: number): string {
  return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
}
export function validWindow(start:string,end:string):boolean {
  const a=timeMinutes(start),b=timeMinutes(end);
  return Number.isFinite(a) && Number.isFinite(b) && a<b && b<=1440;
}
export function isoDay(date:string,add=0):string {
  const d=new Date(date+'T12:00:00Z');
  if(Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate()+add);
  return d.toISOString().slice(0,10);
}
export function weekday(date:string):number {
  return new Date(date+'T12:00:00Z').getUTCDay();
}
export function ukClock(now=new Date()):{date:string;minutes:number} {
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:UK_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(now);
  const obj=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return {date:`${obj.year}-${obj.month}-${obj.day}`, minutes:Number(obj.hour)*60+Number(obj.minute)};
}
/** Suggested short-notice opening in the UK, with 30-minute notice and a full hour. */
export function suggestedOpening(now=new Date()):{date:string;start:string;end:string} {
  const clock=ukClock(now);
  const next=Math.ceil((clock.minutes+MIN_NOTICE_MINUTES)/STEP_MINUTES)*STEP_MINUTES;
  if(next+60<1440)return {date:clock.date,start:minuteTime(next),end:minuteTime(next+60)};
  return {date:isoDay(clock.date,1),start:'09:00',end:'10:00'};
}
export function formatDay(date:string):string {
  return new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short'});
}
export function slotsForDate(instructorId:string,date:string,duration:number,state:DemoState,now=new Date()):SlotSelection[] {
  if(![60,90,120].includes(duration)) return [];
  const windows=[
    ...state.weeklyWindows.filter(w=>w.instructorId===instructorId && w.weekday===weekday(date)),
    ...(state.oneOffWindows??[]).filter(w=>w.instructorId===instructorId && w.date===date)
  ];
  const results:SlotSelection[]=[];
  const unique=new Set<string>();
  for(const window of windows) {
    const start=timeMinutes(window.start), end=timeMinutes(window.end);
    if(!validWindow(window.start,window.end))continue;
    for(let candidate=Math.ceil(start/STEP_MINUTES)*STEP_MINUTES; candidate+duration<=end;candidate+=STEP_MINUTES) {
      const slot={date,time:minuteTime(candidate),duration};
      if(!unique.has(slot.time)&&isSlotOpen(instructorId,slot,state,now)){
        results.push(slot);
        unique.add(slot.time);
      }
    }
  }
  return results.sort((a,b)=>a.time.localeCompare(b.time));
}
function overlaps(a:number,b:number,x:number,y:number):boolean {
  return a<y && x<b;
}
function blocksSlot(block:DiaryBlock,slot:SlotSelection):boolean {
  if(block.date!==slot.date)return false;
  return overlaps(timeMinutes(slot.time),timeMinutes(slot.time)+slot.duration,timeMinutes(block.start),timeMinutes(block.end));
}
function lessonOverlaps(lesson:Lesson,slot:SlotSelection):boolean {
  if(lesson.date!==slot.date||lesson.status==='cancelled'||lesson.status==='declined')return false;
  const start=timeMinutes(lesson.time);
  if(!Number.isFinite(start))return false;
  // A 15-minute turnaround is required between different booked lessons.
  return overlaps(timeMinutes(slot.time)-TRAVEL_BUFFER_MINUTES,timeMinutes(slot.time)+slot.duration+TRAVEL_BUFFER_MINUTES,start,start+lesson.duration);
}
export function isSlotOpen(instructorId:string,slot:SlotSelection,state:DemoState,now=new Date()):boolean {
  const start=timeMinutes(slot.time);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(slot.date)||!Number.isFinite(start)||!validWindow(slot.time,minuteTime(start+slot.duration))) return false;
  const clock=ukClock(now);
  // Compare London calendar days and local minutes, including a lead time
  // that crosses midnight. This is scheduling logic, not UTC booking storage.
  const dayOffset=Math.round((Date.parse(slot.date+'T00:00:00Z')-Date.parse(clock.date+'T00:00:00Z'))/86400000);
  if(dayOffset*1440+start<clock.minutes+MIN_NOTICE_MINUTES)return false;
  const regular=state.weeklyWindows.some(w=>w.instructorId===instructorId && w.weekday===weekday(slot.date) &&
    validWindow(w.start,w.end) && start>=timeMinutes(w.start) && start+slot.duration<=timeMinutes(w.end));
  const oneOff=(state.oneOffWindows??[]).some(w=>w.instructorId===instructorId && w.date===slot.date &&
    validWindow(w.start,w.end) && start>=timeMinutes(w.start) && start+slot.duration<=timeMinutes(w.end));
  if(!regular&&!oneOff)return false;
  if(state.diaryBlocks.some(b=>b.instructorId===instructorId && blocksSlot(b,slot)))return false;
  if(state.lessons.some(l=>l.instructorId===instructorId && lessonOverlaps(l,slot)))return false;
  return true;
}
export function seriesAvailable(instructorId:string,slots:SlotSelection[],state:DemoState,now=new Date()):boolean {
  if(!slots.length)return false;
  if(!slots.every(s=>isSlotOpen(instructorId,s,state,now)))return false;
  // Prevent overlapping sessions within the proposed series, too.
  return slots.every((slot,i)=>slots.every((other,j)=>
    i===j||slot.date!==other.date||
    !overlaps(timeMinutes(slot.time)-TRAVEL_BUFFER_MINUTES,timeMinutes(slot.time)+slot.duration+TRAVEL_BUFFER_MINUTES,
      timeMinutes(other.time),timeMinutes(other.time)+other.duration)));
}
export function recurringSeries(first:SlotSelection,count:number):SlotSelection[] {
  return Array.from({length:count},(_,i)=>({...first,date:isoDay(first.date,i*7)}));
}
export function availableRecurringSeries(instructorId:string,firstDate:string,duration:number,count:number,state:DemoState,now=new Date()):SlotSelection[][] {
  return slotsForDate(instructorId,firstDate,duration,state,now)
    .map(first=>recurringSeries(first,count))
    .filter(series=>seriesAvailable(instructorId,series,state,now));
}
