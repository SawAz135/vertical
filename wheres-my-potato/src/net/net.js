import { Emitter, storage } from '../core/util.js';

// =====================================================================================
// NETWORKING — co-op sessions (1-4 players).
// Transports: Supabase Realtime (Internet: broadcast + presence) or BroadcastChannel
// (several tabs on the same device — also used for automated tests).
// Model: every client simulates its own world; gameplay events are broadcast, and the
// HOST (oldest member, migrates automatically) periodically broadcasts an authoritative
// snapshot (money, upgrades, jar, clock, taken field potatoes) that everybody adopts.
// =====================================================================================
export const SUPABASE_URL = 'https://myfywmjifxurhwfnihdx.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_p2V8Jp5Wyeq9RknJkxBS6g__BIoTsQ9';
const MAX = 4;
const uid = () => Math.random().toString(36).slice(2, 10);
export const makeCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

class LocalTransport {
  constructor() { this.kind = 'local'; }
  async open(room, me, on) {
    this.bc = new BroadcastChannel('wmp-room-' + room); this.me = me; this.on = on; this.peers = new Map();
    this.bc.onmessage = e => {
      const m = e.data; if (!m || m.from === me.id) return;
      if (m.t === '__hb') { const fresh = !this.peers.has(m.from); this.peers.set(m.from, { ...m.meta, last: performance.now() }); if (fresh) this._presence(); return; }
      if (m.t === '__bye') { this.peers.delete(m.from); this._presence(); return; }
      on.message(m.t, m.d, m.from);
    };
    this.hb = setInterval(() => { this.bc.postMessage({ t: '__hb', from: me.id, meta: this.meta }); let ch = false; for (const [k, v] of this.peers) if (performance.now() - v.last > 4000) { this.peers.delete(k); ch = true; } if (ch) this._presence(); }, 700);
    this.meta = me.meta; this.bc.postMessage({ t: '__hb', from: me.id, meta: this.meta });
    setTimeout(() => this._presence(), 50);
    return true;
  }
  _presence() { const list = [{ id: this.me.id, ...this.meta }, ...[...this.peers].map(([id, m]) => ({ id, ...m }))]; this.on.presence(list); }
  track(meta) { this.meta = meta; }
  send(t, d) { this.bc?.postMessage({ t, d, from: this.me.id }); }
  async close() { this.bc?.postMessage({ t: '__bye', from: this.me.id }); clearInterval(this.hb); this.bc?.close(); this.bc = null; }
  // public lobby (same device)
  async lobby(onList) {
    this.lb = new BroadcastChannel('wmp-lobby'); const rooms = new Map();
    this.lb.onmessage = e => { const m = e.data; if (m?.room) { rooms.set(m.room.code, { ...m.room, last: performance.now() }); } };
    this.lbT = setInterval(() => { for (const [k, v] of rooms) if (performance.now() - v.last > 4000) rooms.delete(k); onList([...rooms.values()]); if (this.advert) this.lb.postMessage({ room: this.advert }); }, 1000);
  }
  advertise(room) { this.advert = room; }
  stopLobby() { clearInterval(this.lbT); this.lb?.close(); this.lb = null; }
}

class SupabaseTransport {
  constructor() { this.kind = 'online'; }
  _client() {
    if (this.sb) return this.sb;
    if (!window.supabase) throw new Error('supabase non chargé');
    this.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 30 } } });
    return this.sb;
  }
  async open(room, me, on) {
    const sb = this._client(); this.me = me;
    const ch = sb.channel('wmp:' + room, { config: { broadcast: { self: false, ack: false }, presence: { key: me.id } } });
    this.ch = ch;
    ch.on('broadcast', { event: 'm' }, ({ payload }) => { if (payload && payload.from !== me.id) on.message(payload.t, payload.d, payload.from); });
    ch.on('presence', { event: 'sync' }, () => { const st = ch.presenceState(); on.presence(Object.entries(st).map(([id, arr]) => ({ id, ...(arr[0] || {}) }))); });
    const ok = await new Promise(res => { const to = setTimeout(() => res(false), 9000); ch.subscribe(s => { if (s === 'SUBSCRIBED') { clearTimeout(to); res(true); } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') { clearTimeout(to); res(false); } }); });
    if (!ok) { try { await sb.removeChannel(ch); } catch { /* ignore */ } this.ch = null; return false; }
    await ch.track(me.meta);
    return true;
  }
  track(meta) { this.ch?.track(meta); }
  send(t, d) { this.ch?.send({ type: 'broadcast', event: 'm', payload: { t, d, from: this.me.id } }); }
  async close() { if (this.ch) { try { await this.ch.untrack(); await this.sb.removeChannel(this.ch); } catch { /* ignore */ } } this.ch = null; }
  async lobby(onList) {
    const sb = this._client(); this.lb = sb.channel('wmp-lobby', { config: { presence: { key: 'l-' + uid() } } });
    this.lb.on('presence', { event: 'sync' }, () => { const st = this.lb.presenceState(); onList(Object.values(st).map(a => a[0]).filter(r => r && r.code)); });
    await new Promise(res => { const to = setTimeout(res, 8000); this.lb.subscribe(s => { if (s === 'SUBSCRIBED') { clearTimeout(to); res(); } }); });
    if (this.advert) this.lb.track(this.advert);
  }
  advertise(room) { this.advert = room; this.lb?.track(room || {}); }
  stopLobby() { if (this.lb) { this.sb.removeChannel(this.lb); this.lb = null; } }
}

export class Net extends Emitter {
  constructor() {
    super(); this.active = false; this.id = storage.get('wmp.netid') || uid(); storage.set('wmp.netid', this.id);
    this.members = []; this.isHost = false; this.room = null; this.since = Date.now();
  }
  transport(kind) { return kind === 'local' ? new LocalTransport() : new SupabaseTransport(); }
  async join(room, { name, color, kind = 'online', visibility = 'private', create = false }) {
    if (this.active) await this.leave();
    this.t = this.transport(kind); this.room = room; this.kind = kind; this.visibility = visibility; this.name = name; this.color = color;
    this.since = create ? Date.now() - 1e6 : Date.now(); // the creator is always the oldest → host
    const meta = { name, color, since: this.since, vis: visibility };
    const ok = await this.t.open(room, { id: this.id, meta }, {
      message: (t, d, from) => this.emit('msg', t, d, from),
      presence: list => this._presence(list),
    });
    if (!ok) { this.t = null; this.room = null; return false; }
    this.active = true; storage.set('wmp.lastRoom', { room, kind, at: Date.now() });
    if (visibility === 'public') { try { await this.t.lobby(() => {}); } catch { /* lobby optional */ } this.advertise(); }
    return true;
  }
  _presence(list) {
    const prev = new Set(this.members.map(m => m.id));
    list.sort((a, b) => (a.since || 0) - (b.since || 0) || (a.id < b.id ? -1 : 1));
    this.members = list.slice(0, MAX);
    const wasHost = this.isHost; this.isHost = this.members[0]?.id === this.id; this.hostId = this.members[0]?.id;
    for (const m of this.members) if (!prev.has(m.id) && m.id !== this.id) this.emit('joined', m);
    for (const id of prev) if (!this.members.some(m => m.id === id)) this.emit('left', id);
    if (this.isHost && !wasHost && prev.size) this.emit('host');
    if (list.length > MAX && list.slice(MAX).some(m => m.id === this.id)) { this.emit('full'); this.leave(); }
    this.emit('members', this.members);
    if (this.isHost && this.visibility === 'public') this.advertise();
  }
  advertise() { this.t?.advertise?.({ code: this.room, host: this.name, players: this.members.length, at: Date.now() }); }
  send(t, d) { if (this.active) this.t.send(t, d); }
  async leave() { if (!this.t) return; this.t.advertise?.(null); this.t.stopLobby?.(); await this.t.close(); this.t = null; this.active = false; this.members = []; this.isHost = false; this.room = null; this.emit('members', []); }
  async listPublic(kind, onList) { this.lobbyT?.stopLobby(); this.lobbyT = this.transport(kind); try { await this.lobbyT.lobby(onList); } catch (e) { onList(null, e); } }
  stopList() { this.lobbyT?.stopLobby(); this.lobbyT = null; }
}
export const net = new Net();
