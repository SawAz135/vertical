/* =====================================================================
   Roblox Forge · Jouer — online services (Supabase).
   - accounts with a username + password (no e-mail asked: the address is
     derived from the username), profile with the avatar look;
   - games published by players: everyone with the link sees them, with
     the real number of visits and of players online right now;
   - friends: requests, accept / decline, see what friends are playing,
     join them in their server;
   - servers: players of a game are grouped in servers (up to 12); inside a
     server, avatars, moves, animations and chat are shared live.
   Realtime presence gives the live counts; nothing is simulated.
   ===================================================================== */
export const SUPABASE_URL = 'https://myfywmjifxurhwfnihdx.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_p2V8Jp5Wyeq9RknJkxBS6g__BIoTsQ9';
const MAX_PER_SERVER = 12;
const mail = (u) => `${String(u).toLowerCase()}@joueurs.local`; // never receives mail: accounts are only a username + password

class Online {
  constructor() { this.sb = null; this.user = null; this.profile = null; this.lobby = null; this.presence = new Map(); this.listeners = new Set(); this.server = null; }
  get ok() { return !!this.sb; }
  init() {
    if (this.sb || !window.supabase) return !!this.sb;
    this.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'forgeplay.auth' }, realtime: { params: { eventsPerSecond: 20 } } });
    this.sb.auth.onAuthStateChange((_e, session) => { const u = session ? session.user : null; if ((u && u.id) !== (this.user && this.user.id)) { this.user = u; this.loadProfile().then(() => { this.joinLobby(); this.emit('auth'); }); } });
    return true;
  }
  on(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  emit(what) { for (const f of this.listeners) try { f(what); } catch (e) { console.warn(e); } }
  async session() { if (!this.init()) return null; const { data } = await this.sb.auth.getSession(); this.user = data.session ? data.session.user : null; if (this.user && !this.profile) { await this.loadProfile(); this.joinLobby(); } return this.user; }
  async loadProfile() { if (!this.user) { this.profile = null; return null; } const { data } = await this.sb.from('profiles').select('*').eq('id', this.user.id).maybeSingle(); this.profile = data; return data; }
  /* ---- accounts ---- */
  async signUp(username, password, look) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new Error('Pseudo : 3 à 20 lettres, chiffres ou _');
    if (String(password).length < 6) throw new Error('Mot de passe : au moins 6 caractères');
    const taken = await this.sb.from('profiles').select('id').ilike('username', username).maybeSingle(); if (taken.data) throw new Error('Ce pseudo est déjà pris');
    const { data, error } = await this.sb.auth.signUp({ email: mail(username), password, options: { data: { username } } });
    if (error) throw new Error(frErr(error.message));
    if (!data.session) throw new Error('Compte créé, mais Supabase demande une confirmation par e-mail : désactive « Confirm email » dans Authentication → Sign In / Providers → Email.');
    this.user = data.user; await this.loadProfile(); if (look) await this.saveLook(look); this.joinLobby(); this.emit('auth'); return this.profile;
  }
  async signIn(username, password) { const { data, error } = await this.sb.auth.signInWithPassword({ email: mail(username), password }); if (error) throw new Error(frErr(error.message)); this.user = data.user; await this.loadProfile(); this.joinLobby(); this.emit('auth'); return this.profile; }
  async signOut() { await this.leaveServer(); if (this.lobby) { await this.sb.removeChannel(this.lobby); this.lobby = null; } await this.sb.auth.signOut(); this.user = null; this.profile = null; this.presence.clear(); this.emit('auth'); }
  async saveLook(look) { if (!this.user) return; await this.sb.from('profiles').update({ look, display_name: look.name || this.profile?.username }).eq('id', this.user.id); if (this.profile) this.profile.look = look; }
  /* ---- lobby presence: who is online, in which game and server ---- */
  joinLobby() {
    if (!this.user || this.lobby) return; const ch = this.sb.channel('lobby', { config: { presence: { key: this.user.id } } }); this.lobby = ch;
    ch.on('presence', { event: 'sync' }, () => { const st = ch.presenceState(); this.presence = new Map(Object.entries(st).map(([k, v]) => [k, v[v.length - 1]])); this.emit('presence'); });
    ch.subscribe(async (s) => { if (s === 'SUBSCRIBED') await this.track(); });
    clearInterval(this.seenT); this.seenT = setInterval(() => this.sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', this.user.id).then(() => {}), 60000);
  }
  async track(extra = {}) { this.where = { ...(this.where || {}), ...extra }; if (this.lobby && this.profile) await this.lobby.track({ username: this.profile.username, gameId: this.where.gameId || null, serverId: this.where.serverId || null, title: this.where.title || null, at: Date.now() }); }
  playersIn(gameId) { let n = 0; for (const p of this.presence.values()) if (p.gameId === gameId) n++; return n; }
  online() { return this.presence.size; }
  /* ---- games ---- */
  async listGames({ limit = 60 } = {}) { const { data, error } = await this.sb.from('games').select('id,owner,title,description,genre,kind,file_path,size_bytes,thumb,visits,likes,created_at,profiles(username)').order('visits', { ascending: false }).limit(limit); if (error) throw new Error(frErr(error.message)); return data || []; }
  async myGames() { if (!this.user) return []; const { data } = await this.sb.from('games').select('id,title,visits,created_at,thumb').eq('owner', this.user.id).order('created_at', { ascending: false }); return data || []; }
  async publish({ title, description = '', genre = 'jeu', kind = 'rbxl', bytes, thumb }) {
    if (!this.user) throw new Error('Connecte-toi pour publier'); const id = crypto.randomUUID(); const path = `${this.user.id}/${id}.${kind === 'rbxl' ? 'rbxl' : 'json'}`;
    const up = await this.sb.storage.from('games').upload(path, new Blob([bytes], { type: 'application/octet-stream' }), { upsert: false, contentType: 'application/octet-stream' }); if (up.error) throw new Error(frErr(up.error.message));
    const { data, error } = await this.sb.from('games').insert({ id, owner: this.user.id, title: String(title).slice(0, 60), description, genre, kind, file_path: path, size_bytes: bytes.byteLength, thumb: thumb || null }).select().single();
    if (error) { await this.sb.storage.from('games').remove([path]); throw new Error(frErr(error.message)); } return data;
  }
  async remove(game) { await this.sb.from('games').delete().eq('id', game.id); await this.sb.storage.from('games').remove([game.file_path]); }
  async download(game) { const { data, error } = await this.sb.storage.from('games').download(game.file_path); if (error) throw new Error(frErr(error.message)); return new Uint8Array(await data.arrayBuffer()); }
  async visit(gameId) { const { data } = await this.sb.rpc('record_visit', { gid: gameId }); return data; }
  /* ---- friends ---- */
  async findPlayer(username) { const { data } = await this.sb.from('profiles').select('id,username,look,last_seen').ilike('username', username).maybeSingle(); return data; }
  async searchPlayers(q) { const { data } = await this.sb.from('profiles').select('id,username,look').ilike('username', `%${q}%`).limit(12); return (data || []).filter((p) => p.id !== this.user?.id); }
  async friendships() { if (!this.user) return { friends: [], incoming: [], outgoing: [] };
    const { data } = await this.sb.from('friendships').select('requester,addressee,status,created_at'); const rows = data || []; const ids = [...new Set(rows.flatMap((r) => [r.requester, r.addressee]))].filter((i) => i !== this.user.id);
    const { data: ps } = ids.length ? await this.sb.from('profiles').select('id,username,look,last_seen').in('id', ids) : { data: [] }; const P = new Map((ps || []).map((p) => [p.id, p])); const me = this.user.id;
    return { friends: rows.filter((r) => r.status === 'accepted').map((r) => P.get(r.requester === me ? r.addressee : r.requester)).filter(Boolean),
      incoming: rows.filter((r) => r.status === 'pending' && r.addressee === me).map((r) => P.get(r.requester)).filter(Boolean),
      outgoing: rows.filter((r) => r.status === 'pending' && r.requester === me).map((r) => P.get(r.addressee)).filter(Boolean) }; }
  async requestFriend(id) { const back = await this.sb.from('friendships').select('*').eq('requester', id).eq('addressee', this.user.id).maybeSingle(); if (back.data) return this.acceptFriend(id);
    const { error } = await this.sb.from('friendships').insert({ requester: this.user.id, addressee: id }); if (error && !/duplicate/i.test(error.message)) throw new Error(frErr(error.message)); this.ping(id, 'friend-request'); }
  async acceptFriend(id) { const { error } = await this.sb.from('friendships').update({ status: 'accepted' }).eq('requester', id).eq('addressee', this.user.id); if (error) throw new Error(frErr(error.message)); this.ping(id, 'friend-accepted'); }
  async removeFriend(id) { await this.sb.from('friendships').delete().or(`and(requester.eq.${this.user.id},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${this.user.id})`); }
  ping(to, kind) { this.lobby?.send({ type: 'broadcast', event: 'ping', payload: { to, kind, from: this.profile?.username } }); }
  onPing(f) { this.lobby?.on('broadcast', { event: 'ping' }, ({ payload }) => { if (payload.to === this.user?.id) f(payload); }); }
  /* ---- servers ---- */
  pickServer(gameId, wanted) {
    if (wanted) return wanted; const count = new Map(); for (const p of this.presence.values()) if (p.gameId === gameId && p.serverId) count.set(p.serverId, (count.get(p.serverId) || 0) + 1);
    let best = null, n = -1; for (const [s, c] of count) if (c < MAX_PER_SERVER && c > n) { best = s; n = c; } return best || crypto.randomUUID().slice(0, 8);
  }
  async joinServer(gameId, title, serverId, handlers) {
    await this.leaveServer(); if (!this.user) return null; const sid = this.pickServer(gameId, serverId);
    const ch = this.sb.channel(`srv:${gameId}:${sid}`, { config: { presence: { key: this.user.id }, broadcast: { self: false } } }); this.server = { ch, gameId, sid, handlers };
    ch.on('broadcast', { event: 'st' }, ({ payload }) => handlers.state?.(payload));
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => handlers.chat?.(payload));
    ch.on('broadcast', { event: 'ev' }, ({ payload }) => handlers.event?.(payload));
    ch.on('presence', { event: 'sync' }, () => handlers.players?.(Object.entries(ch.presenceState()).map(([k, v]) => ({ id: k, ...v[v.length - 1] }))));
    ch.on('presence', { event: 'leave' }, ({ key }) => handlers.left?.(key));
    await new Promise((res) => ch.subscribe(async (s) => { if (s === 'SUBSCRIBED') { await ch.track({ username: this.profile?.username, look: this.profile?.look || {}, at: Date.now() }); res(); } }));
    await this.track({ gameId, serverId: sid, title }); return sid;
  }
  send(event, payload) { this.server?.ch.send({ type: 'broadcast', event, payload: { from: this.user?.id, ...payload } }); }
  async leaveServer() { if (this.server) { const ch = this.server.ch; this.server = null; await this.sb.removeChannel(ch); } if (this.lobby) await this.track({ gameId: null, serverId: null, title: null }); }
}
function frErr(m) { const s = String(m || ''); if (/Invalid login/i.test(s)) return 'Pseudo ou mot de passe incorrect'; if (/already registered/i.test(s)) return 'Ce pseudo est déjà pris'; if (/rate limit/i.test(s)) return 'Trop d’essais, réessaie dans une minute'; if (/Email not confirmed/i.test(s)) return 'Compte pas encore confirmé (désactive « Confirm email » dans Supabase)'; if (/relation .* does not exist|schema cache/i.test(s)) return 'La base n’est pas encore installée : lance online/schema.sql dans Supabase'; return s; }
export const online = new Online();
