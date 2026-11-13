import test from 'node:test';
import assert from 'node:assert/strict';
import { isSlotOpen, slotsForDate, recurringSeries, seriesAvailable, availableRecurringSeries, isoDay, ukClock } from '../src/scheduling.ts';

const NOW = new Date('2026-11-13T08:00:00Z'); // Friday, 08:00 UK
const date = '2026-11-13';
const state = () => ({
  lessons: [], learnerSelfSkill: 5, instructorOnline: true, diaryBlocks: [],
  weeklyWindows: [{
    id: 'friday', instructorId: 'sample', weekday: 5, start: '09:00', end: '17:00'
  }]
});
const slot = (time = '10:00', day = date, duration = 60) => ({ date: day, time, duration });

test('UK calendar uses London time, not the tester device time zone', () => {
  assert.deepEqual(ukClock(NOW), { date: '2026-11-13', minutes: 480 });
  assert.equal(ukClock(new Date('2026-06-01T11:00:00Z')).minutes, 720); // BST
  assert.equal(isoDay('2026-10-24', 7), '2026-10-31'); // over clock change
});

test('weekly windows expose future one-hour slots but no outside-hours slots', () => {
  const s=state();
  const slots=slotsForDate('sample',date,60,s,NOW);
  assert.ok(slots.some(x=>x.time==='09:00'));
  assert.ok(slots.some(x=>x.time==='15:30'));
  assert.ok(!slots.some(x=>x.time==='08:30'));
  assert.ok(!slots.some(x=>x.time==='16:30'));
  assert.equal(isSlotOpen('sample',slot('09:00','2026-11-12'),s,NOW),false);
});

test('full-day and partial-day blocks suppress matching starts', () => {
  const s=state();
  s.diaryBlocks=[{id:'break',instructorId:'sample',date,start:'11:30',end:'13:30',note:'Break'}];
  assert.equal(isSlotOpen('sample',slot('12:00'),s,NOW),false);
  assert.equal(isSlotOpen('sample',slot('10:00'),s,NOW),true);
  s.diaryBlocks=[{id:'dayoff',instructorId:'sample',date,start:'00:00',end:'24:00',note:'Off'}];
  assert.equal(slotsForDate('sample',date,60,s,NOW).length,0);
});

test('requested and completed bookings block overlaps with travel buffer', () => {
  const s=state();
  s.lessons=[{id:'1',instructorId:'sample',status:'requested',time:'10:00',date,duration:60}];
  assert.equal(isSlotOpen('sample',slot('10:00'),s,NOW),false);
  assert.equal(isSlotOpen('sample',slot('11:00'),s,NOW),false);
  assert.equal(isSlotOpen('sample',slot('11:30'),s,NOW),true);
  s.lessons[0].status='completed';
  assert.equal(isSlotOpen('sample',slot('10:00'),s,NOW),false);
  s.lessons[0].status='cancelled';
  assert.equal(isSlotOpen('sample',slot('10:00'),s,NOW),true);
});

test('five-lesson recurring blocks are all-or-nothing', () => {
  const s=state();
  const series=recurringSeries(slot('10:00'),5);
  assert.equal(series.length,5);
  assert.equal(series[4].date,'2026-12-11');
  assert.equal(seriesAvailable('sample',series,s,NOW),true);
  const options=availableRecurringSeries('sample',date,60,5,s,NOW);
  assert.ok(options.some(x=>x[0].time==='10:00'));
  s.diaryBlocks=[{id:'holiday',instructorId:'sample',date:series[2].date,start:'00:00',end:'24:00',note:'Holiday'}];
  assert.equal(seriesAvailable('sample',series,s,NOW),false);
  assert.ok(!availableRecurringSeries('sample',date,60,5,s,NOW).some(x=>x[0].time==='10:00'));
});

test('custom blocks may not overlap one another', () => {
  const s=state();
  assert.equal(seriesAvailable('sample',[slot('10:00'),slot('11:00')],s,NOW),false);
  assert.equal(seriesAvailable('sample',[slot('10:00'),slot('11:30')],s,NOW),true);
});

test('minimum notice still applies when a booking crosses UK midnight', () => {
  const s=state();
  s.weeklyWindows=[{id:'sat',instructorId:'sample',weekday:6,start:'00:00',end:'03:00'}];
  const late=new Date('2026-11-13T23:50:00Z'); // Friday, 23:50 UK
  assert.equal(isSlotOpen('sample',slot('00:00','2026-11-14'),s,late),false);
  assert.equal(isSlotOpen('sample',slot('00:30','2026-11-14'),s,late),true);
});
