import { useEffect, useState } from 'react';
import { AvailabilityService, fetchRoomCalendar, type RoomAvailability, type RoomCalendar } from '../services/availability';
import { STAY_META, key, type SearchState } from '../lib/booking';

// Module level caches so moving between home, room and checkout does not refetch.
const calendarCache: Record<number, RoomCalendar> = {};
const availCache: Record<string, RoomAvailability[]> = {};

export function useCalendars(ids: number[] = STAY_META.map(s => s.id)) {
  const [calendars, setCalendars] = useState<Record<number, RoomCalendar | undefined>>(() => ({ ...calendarCache }));
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const missing = ids.filter(id => !calendarCache[id]);
    if (!missing.length) return;
    let alive = true; setLoading(true);
    Promise.all(missing.map(async id => { calendarCache[id] = await fetchRoomCalendar(id); }))
      .finally(() => { if (alive) { setCalendars({ ...calendarCache }); setLoading(false); } });
    return () => { alive = false; };
  }, [ids.join(',')]);
  return { calendars, loading };
}

export function useAvailability(s: SearchState) {
  const k = `${key(s.checkIn)}|${key(s.checkOut)}|${s.guests}`;
  const [rooms, setRooms] = useState<RoomAvailability[] | null>(() => availCache[k] || null);
  const [loading, setLoading] = useState(!availCache[k]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (availCache[k]) { setRooms(availCache[k]); setLoading(false); return; }
    let alive = true; setLoading(true); setError(null);
    AvailabilityService.checkAvailability({ checkIn: key(s.checkIn), checkOut: key(s.checkOut), guests: s.guests })
      .then(r => { if (!alive) return; if (r.success) { availCache[k] = r.rooms; setRooms(r.rooms); } else setError(r.error || 'Could not load prices'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [k]);
  return { rooms, loading, error };
}
