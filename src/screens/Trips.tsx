import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { dayKey, elapsedMs, estimate, fuelSpend, monthKey, totals, type Trip } from '../core/trips';
import { useStore, editTrip, deleteTrip } from '../services/store';
import { exportTrips } from '../services/sharing';
import { DayBars, RouteTrace } from '../ui/instruments';
import { Button, Eyebrow, Field, Icon, Metric, Notice, Screen, Title } from '../ui/primitives';
import { Sheet } from '../ui/dialogs';
import { dateLabel, duration, km, money, number } from '../ui/format';
type Props = { run: (work: () => Promise<void>) => void; confirm: (title: string, message: string, action: () => Promise<void>) => void; navigate: (tab: string) => void };
export function Trips({ run, confirm, navigate }: Props) {
  const { trips, active, prefs, fuel } = useStore();
  const today = dayKey(Date.now(), prefs.timeZone);
  const [month, setMonth] = useState(monthKey(Date.now(), prefs.timeZone));
  const [selected, setSelected] = useState<Trip | null>(null);
  const [title, setTitle] = useState('');
  const [limit, setLimit] = useState(40);
  const [showDays, setShowDays] = useState(false);
  const all = active ? [...trips, active] : trips;
  const summary = totals(all, month);
  const days = [...new Set(all.flatMap(t => Object.keys(t.slices)))].filter(d => d.startsWith(month)).sort().reverse();
  const daily = totals(all, today);
  const filtered = trips.filter(t => Object.keys(t.slices).some(k => k.startsWith(month)) || dayKey(t.startedAt, t.timeZone).startsWith(month));
  const end = month === today.slice(0, 7) ? new Date(today + 'T12:00:00Z') : new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0, 12));
  const bars = Array.from({ length: 7 }, (_, i) => { const date = new Date(end); date.setUTCDate(date.getUTCDate() - (6 - i)); const day = date.toISOString().slice(0, 10); return { day, cost: totals(all, day).cost }; });
  const moveMonth = (delta: number) => { const date = new Date(month + '-15T12:00:00Z'); date.setUTCMonth(date.getUTCMonth() + delta); setMonth(date.toISOString().slice(0, 7)); setLimit(40); };
  const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-15T12:00:00Z'));
  return <Screen>
    <View className="flex-row justify-between items-start"><View className="flex-1 pr-3"><Title title="Every drive, accounted for." subtitle="Local trip history. Honest estimates." /></View><Pressable accessibilityRole="button" accessibilityLabel="Export month as CSV" onPress={() => run(() => exportTrips(filtered))} className="p-3 -mr-2"><Icon name="share-outline" color="#FF8735" /></Pressable></View>
    <View className="flex-row items-center justify-between mb-7"><Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => moveMonth(-1)} className="p-3 -ml-3"><Icon name="chevron-back" /></Pressable><Text className="text-ink text-sm font-semibold">{monthLabel}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => moveMonth(1)} className="p-3 -mr-3"><Icon name="chevron-forward" /></Pressable></View>
    <Eyebrow>ESTIMATED FUEL / RECORDED DRIVING</Eyebrow>
    <Text className="text-ink text-[48px] leading-[58px] tracking-[-2px] font-semibold mt-2">{summary.unpricedMetres ? '\u2014' : number(summary.cost, 2)}<Text className="text-muted text-lg tracking-normal"> kr</Text></Text>
    <View className="flex-row gap-6 mt-5"><Metric label="Distance" value={km(summary.metres)} unit="km" /><Metric label="Drives" value={String(summary.trips)} /><Metric label="Fuel estimate" value={summary.unpricedMetres ? '\u2014' : number(summary.litres, 1)} unit="L" /></View>
    <DayBars data={bars} />
    <Text className="text-muted text-[10px] mt-3">Last 7 days in this period / estimates, not receipts</Text>
    {summary.unpricedMetres > 0 && <Notice accent>{km(summary.unpricedMetres)} km has no fuel rate recorded. The chart includes only priced trips; the complete cost is unknown.</Notice>}
    {prefs.monthlyBudget && <View className="mt-6"><View className="flex-row justify-between mb-2"><Text className="text-muted text-xs">Recorded driving budget</Text><Text className="text-ink text-xs">{money(prefs.monthlyBudget, 0)}</Text></View><View className="h-1 bg-line rounded-full"><View style={{ width: `${Math.min(100, summary.cost / prefs.monthlyBudget * 100)}%`, height: 4, backgroundColor: '#FF8735', borderRadius: 4 }} /></View></View>}
    <View className="flex-row border-y border-line py-5 mt-6 gap-7"><Metric label="Today / estimated" value={money(daily.unpricedMetres ? null : daily.cost)} /><Metric label="Pump spending / month" value={money(fuelSpend(fuel, month, prefs.timeZone))} /></View>
    <Text className="text-muted text-[10px] leading-4 mt-3">Pump spending comes from your fill-up log. It is separate from, and not added to, estimated trip costs.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Daily totals" onPress={() => setShowDays(v => !v)} className="flex-row items-center justify-between py-5 border-b border-line"><Text className="text-ink text-sm font-medium">Daily totals</Text><Icon name={showDays ? 'chevron-up' : 'chevron-down'} color="#FF8735" size={17} /></Pressable>
    {showDays && (days.length ? days.map(day => { const sum = totals(all, day); return <View key={day} className="flex-row items-center justify-between py-4 border-b border-line"><View><Text className="text-ink text-sm">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', weekday: 'short', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'))}</Text><Text className="text-muted text-[11px] mt-1">{km(sum.metres)} km / {sum.trips} drive(s)</Text></View><Text className="text-ink text-sm">{money(sum.unpricedMetres ? null : sum.cost)}<Text className="text-muted text-[10px]"> est.</Text></Text></View>; }) : <Text className="text-muted text-xs py-5">No recorded driving days in this month.</Text>)}
    <View className="flex-row justify-between items-center mt-7 mb-2"><Eyebrow>DRIVING LOG</Eyebrow><Text className="text-muted text-xs">{filtered.length} saved</Text></View>
    {active && <Pressable onPress={() => navigate('drive')} className="flex-row items-center justify-between py-4 border-b border-line"><Text className="text-accent text-sm">Your open drive</Text><Icon name="arrow-forward" color="#FF8735" size={16} /></Pressable>}
    {!filtered.length && <View className="py-10 items-center"><Icon name="trail-sign-outline" size={28} /><Text className="text-ink text-sm mt-4">Your first drive starts the story.</Text><Text className="text-muted text-xs text-center leading-5 mt-2">Finish a GPS trip to see its distance, trace and estimated fuel cost here.</Text></View>}
    {filtered.slice(0, limit).map(t => <Pressable key={t.id} accessibilityRole="button" onPress={() => { setSelected(t); setTitle(t.title); }} className="flex-row items-center gap-3 py-5 border-b border-line"><View className="w-9 h-9 rounded-full border border-line items-center justify-center"><Icon name="navigate-outline" size={15} color="#FF8735" /></View><View className="flex-1"><Text className="text-ink text-sm font-medium" numberOfLines={1}>{t.title}</Text><Text className="text-muted text-[11px] mt-1">{dateLabel(t.startedAt, t.timeZone)}</Text></View><View className="items-end"><Text className="text-ink text-sm">{money(estimate(t.metres, t.rates)?.cost ?? null)}</Text><Text className="text-muted text-[11px] mt-1">{km(t.metres)} km / est.</Text></View></Pressable>)}
    {filtered.length > limit && <View className="mt-4"><Button secondary title="Show more drives" onPress={() => setLimit(n => n + 40)} /></View>}
    {selected && <Sheet title="Drive details" onClose={() => setSelected(null)}>
      <Text className="text-muted text-xs mb-5">{dateLabel(selected.startedAt, selected.timeZone)}</Text>
      <RouteTrace route={selected.route} />
      <View className="flex-row gap-5 my-6"><Metric label="Distance" value={km(selected.metres)} unit="km" /><Metric label="Duration" value={duration(elapsedMs(selected, selected.endedAt ?? Date.now()))} /><Metric label="Estimated cost" value={money(estimate(selected.metres, selected.rates)?.cost ?? null, 1)} /></View>
      <Field label="Trip name" value={title} onChangeText={setTitle} maxLength={80} placeholder="Evening drive" />
      <Button title="Save name" onPress={() => run(async () => { await editTrip(selected.id, title); setSelected(null); })} />
      <Notice>Rates saved with this trip: {selected.rates.litresPer100Km ?? '\u2014'} L/100 km and {selected.rates.pricePerLitre ?? '\u2014'} DKK/L. Later setting changes do not rewrite history. {selected.gaps} GPS gaps; {selected.rejected} rejected fixes.</Notice>
      <View className="gap-3"><Button secondary title="Export this drive" icon="share-outline" onPress={() => run(() => exportTrips([selected]))} /><Button secondary title="Delete drive" icon="trash-outline" onPress={() => confirm('Delete this drive?', 'This removes its local history and GPS trace. It cannot be undone.', async () => { await deleteTrip(selected.id); setSelected(null); })} /></View>
    </Sheet>}
  </Screen>;
}
