/* =====================================================================
   Roblox Forge · Jouer — a Luau interpreter in JavaScript.
   Runs the Luau code saved in Roblox places: full Lua 5.1 semantics plus
   Luau syntax (type annotations, `type`/`export type`, `::` casts,
   compound assignment `+= -= *= /= //= %= ^= ..=`, `continue`,
   if-then-else expressions, string interpolation `{x}`, generalized
   `for k, v in t do`, integer division `//`), metatables, varargs,
   multiple returns, closures, and the standard libraries (math, string
   with Lua patterns, table, bit32, utf8, os, task, coroutine basics).
   Values: nil = undefined, tables = LuaTable, functions = JS functions
   taking an array of arguments and returning an array of results,
   userdata = JS objects that implement $index / $newindex / $call / $op.
   ===================================================================== */

/* ---------------------------------------------------------------- lexer */
const KW = new Set(['and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while']);
const OPS = ['...', '//=', '..=', '==', '~=', '<=', '>=', '//', '..', '::', '->', '+=', '-=', '*=', '/=', '%=', '^=', '+', '-', '*', '/', '%', '^', '#', '<', '>', '=', '(', ')', '{', '}', '[', ']', ';', ':', ',', '.', '?', '&', '|', '@'];
export class LuaError extends Error { constructor(value, trace) { super(typeof value === 'string' ? value : tostr(value)); this.value = value; this.luaTrace = trace; } }

function lex(src, chunk) {
  const toks = []; let i = 0, line = 1; const n = src.length;
  const err = (m) => { throw new LuaError(`${chunk}:${line}: ${m}`); };
  const longBracket = () => { let j = i + 1, lvl = 0; while (src[j] === '=') { lvl++; j++; } if (src[j] !== '[') return null; const close = ']' + '='.repeat(lvl) + ']', end = src.indexOf(close, j + 1); if (end < 0) err('unfinished long string');
    let s = src.slice(j + 1, end); if (s[0] === '\r') s = s.slice(1); if (s[0] === '\n') s = s.slice(1); for (let k = i; k < end; k++) if (src[k] === '\n') line++; i = end + close.length; return s; };
  const readEscape = (q) => { // i at the backslash
    const c = src[i + 1]; i += 2;
    switch (c) {
      case 'n': return '\n'; case 't': return '\t'; case 'r': return '\r'; case 'a': return '\x07'; case 'b': return '\b'; case 'f': return '\f'; case 'v': return '\v';
      case '\\': return '\\'; case '"': return '"'; case "'": return "'"; case '`': return '`'; case '{': return '{'; case '}': return '}'; case '\n': line++; return '\n';
      case 'x': { const h = src.substr(i, 2); i += 2; return String.fromCharCode(parseInt(h, 16)); }
      case 'z': { while (/\s/.test(src[i])) { if (src[i] === '\n') line++; i++; } return ''; }
      case 'u': { const m = src.slice(i).match(/^\{([0-9a-fA-F]+)\}/); i += m[0].length; return String.fromCodePoint(parseInt(m[1], 16)); }
      default: if (/\d/.test(c)) { let d = c; while (d.length < 3 && /\d/.test(src[i])) d += src[i++]; return String.fromCharCode(+d); } void q; return c;
    }
  };
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '-' && src[i + 1] === '-') { i += 2; if (src[i] === '[') { const s = longBracket(); if (s !== null) continue; } while (i < n && src[i] !== '\n') i++; continue; }
    const L = line;
    if (/[A-Za-z_]/.test(c)) { let j = i + 1; while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++; const w = src.slice(i, j); i = j; toks.push({ t: KW.has(w) ? w : 'name', v: w, l: L }); continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
      let m = src.slice(i, i + 80).match(/^0[xX][0-9a-fA-F_]+/) || src.slice(i, i + 80).match(/^0[bB][01_]+/) || src.slice(i, i + 80).match(/^(\d[\d_]*)?(\.[\d_]*)?([eE][+-]?\d+)?/);
      const raw = m[0]; i += raw.length; const clean = raw.replace(/_/g, ''); let v;
      if (/^0[xX]/.test(clean)) v = parseInt(clean.slice(2), 16); else if (/^0[bB]/.test(clean)) v = parseInt(clean.slice(2), 2); else v = parseFloat(clean);
      toks.push({ t: 'number', v, l: L }); continue;
    }
    if (c === '"' || c === "'") { let s = ''; i++; while (i < n && src[i] !== c) { if (src[i] === '\\') s += readEscape(c); else { if (src[i] === '\n') err('unfinished string'); s += src[i++]; } } i++; toks.push({ t: 'string', v: s, l: L }); continue; }
    if (c === '[' && (src[i + 1] === '[' || src[i + 1] === '=')) { const s = longBracket(); if (s !== null) { toks.push({ t: 'string', v: s, l: L }); continue; } }
    if (c === '`') { // interpolated string → parts
      i++; const parts = []; let s = '';
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') { s += readEscape('`'); continue; }
        if (src[i] === '{') { parts.push(s); s = ''; let depth = 1, j = i + 1; while (j < n && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; else if (src[j] === '"' || src[j] === "'") { const q = src[j]; j++; while (j < n && src[j] !== q) { if (src[j] === '\\') j++; j++; } } if (depth) j++; }
          parts.push({ code: src.slice(i + 1, j), line }); i = j + 1; continue; }
        if (src[i] === '\n') line++; s += src[i++];
      }
      i++; parts.push(s); toks.push({ t: 'interp', v: parts, l: L }); continue;
    }
    let op = null; for (const o of OPS) if (src.startsWith(o, i)) { op = o; break; }
    if (!op) err(`unexpected symbol '${c}'`);
    i += op.length; toks.push({ t: op, l: L });
  }
  toks.push({ t: 'eof', l: line }); return toks;
}

/* ---------------------------------------------------------------- parser */
const BIN = { or: [1, 1], and: [2, 2], '<': [3, 3], '>': [3, 3], '<=': [3, 3], '>=': [3, 3], '~=': [3, 3], '==': [3, 3], '..': [5, 4], '+': [6, 6], '-': [6, 6], '*': [7, 7], '/': [7, 7], '//': [7, 7], '%': [7, 7], '^': [10, 9] };
const UNARY = 8;
class Parser {
  constructor(src, chunk) { this.chunk = chunk; this.toks = lex(src, chunk); this.p = 0; }
  get tk() { return this.toks[this.p]; }
  peek(k = 1) { return this.toks[this.p + k]; }
  next() { return this.toks[this.p++]; }
  is(t) { return this.tk.t === t; }
  isName(v) { return this.tk.t === 'name' && this.tk.v === v; }
  accept(t) { if (this.tk.t === t) { this.p++; return true; } return false; }
  err(m) { throw new LuaError(`${this.chunk}:${this.tk.l}: ${m} near '${this.tk.v ?? this.tk.t}'`); }
  expect(t, what) { if (this.tk.t !== t) this.err(`'${t}' expected${what ? ' ' + what : ''}`); return this.next(); }
  name() { if (this.tk.t !== 'name') this.err('<name> expected'); return this.next().v; }

  /* ---- types are parsed and dropped ---- */
  skipType() { this.skipSimpleType(); for (;;) { if (this.accept('?')) continue; if (this.accept('|') || this.accept('&')) { this.skipSimpleType(); continue; } break; } }
  skipSimpleType() {
    const t = this.tk.t;
    if (t === '|' || t === '&') { this.next(); return this.skipSimpleType(); } // leading | in unions
    if (t === 'nil' || t === 'string' || t === 'true' || t === 'false' || t === 'number') { this.next(); return; }
    if (t === '...') { this.next(); if (this.tk.t === 'name' || this.tk.t === '(' || this.tk.t === '{') this.skipSimpleType(); return; }
    if (t === 'name' && this.tk.v === 'typeof') { this.next(); this.skipBalanced('(', ')'); return; }
    if (t === 'name') { this.next(); while (this.accept('.')) this.name(); if (this.is('<')) this.skipBalanced('<', '>'); return; }
    if (t === '{') { this.skipBalanced('{', '}'); return; }
    if (t === '<') { this.skipBalanced('<', '>'); return this.skipSimpleType(); } // generic function type
    if (t === '(') { this.skipBalanced('(', ')'); if (this.accept('->')) this.skipType(); return; }
    if (t === 'function') { this.next(); return this.skipSimpleType(); }
    this.err('type expected');
  }
  skipBalanced(o, c) { this.expect(o); let d = 1; while (d > 0) { const t = this.next().t; if (t === 'eof') this.err('unbalanced ' + o); if (t === o) d++; else if (t === c) d--; else if (o === '<' && t === '>=') d--; } }
  optType() { if (this.accept(':')) this.skipType(); }

  /* ---- statements ---- */
  chunkAst() { const b = this.block(); if (!this.is('eof')) this.err("'<eof>' expected"); return b; }
  block() {
    const body = [];
    for (;;) {
      const t = this.tk.t; if (t === 'eof' || t === 'end' || t === 'else' || t === 'elseif' || t === 'until') break;
      if (t === 'return') { const l = this.next().l; const e = this.blockEnds() || this.is(';') ? [] : this.exprList(); this.accept(';'); body.push({ k: 'return', e, l }); break; }
      const s = this.stat(); if (s) body.push(s);
    }
    return body;
  }
  blockEnds() { const t = this.tk.t; return t === 'eof' || t === 'end' || t === 'else' || t === 'elseif' || t === 'until'; }
  stat() {
    const tk = this.tk, l = tk.l;
    switch (tk.t) {
      case ';': this.next(); return null;
      case '@': this.next(); this.name(); if (this.is('[')) this.skipBalanced('[', ']'); return null; // @native / @checked attributes
      case 'if': { this.next(); const cl = []; let c = this.expr(); this.expect('then'); cl.push([c, this.block()]); let els = null;
        for (;;) { if (this.accept('elseif')) { c = this.expr(); this.expect('then'); cl.push([c, this.block()]); } else if (this.accept('else')) { els = this.block(); this.expect('end', 'to close if'); break; } else { this.expect('end', 'to close if'); break; } }
        return { k: 'if', cl, els, l }; }
      case 'while': { this.next(); const c = this.expr(); this.expect('do'); const b = this.block(); this.expect('end'); return { k: 'while', c, b, l }; }
      case 'do': { this.next(); const b = this.block(); this.expect('end'); return { k: 'do', b, l }; }
      case 'repeat': { this.next(); const b = this.block(); this.expect('until'); const c = this.expr(); return { k: 'repeat', b, c, l }; }
      case 'for': { this.next(); const n1 = this.name(); this.optType();
        if (this.accept('=')) { const a = this.expr(); this.expect(','); const b = this.expr(); const s = this.accept(',') ? this.expr() : null; this.expect('do'); const body = this.block(); this.expect('end'); return { k: 'fornum', v: n1, a, b, s, body, l }; }
        const names = [n1]; while (this.accept(',')) { names.push(this.name()); this.optType(); } this.expect('in'); const e = this.exprList(); this.expect('do'); const body = this.block(); this.expect('end'); return { k: 'forin', names, e, body, l }; }
      case 'function': { this.next(); const path = [this.name()]; let method = null; while (this.accept('.')) path.push(this.name()); if (this.accept(':')) method = this.name();
        const f = this.funcBody(!!method, path.join('.') + (method ? ':' + method : '')); return { k: 'funcdecl', path, method, f, l }; }
      case 'local': { this.next();
        if (this.accept('function')) { const n = this.name(); const f = this.funcBody(false, n); return { k: 'localfunc', n, f, l }; }
        const names = []; do { names.push(this.name()); if (this.accept('<')) { this.name(); this.expect('>'); } this.optType(); } while (this.accept(','));
        const e = this.accept('=') ? this.exprList() : []; return { k: 'local', names, e, l }; }
      case 'break': this.next(); return { k: 'break', l };
      case 'name':
        if (tk.v === 'continue' && !this.continuesExpr()) { this.next(); return { k: 'continue', l }; }
        if ((tk.v === 'type' && this.peek().t === 'name') || (tk.v === 'export' && this.peek().t === 'name' && this.peek().v === 'type')) { if (tk.v === 'export') this.next(); this.next(); this.typeDecl(); return null; }
        break;
      default: break;
    }
    // expression statement / assignment
    const e = this.suffixedExpr();
    if (this.is('=') || this.is(',')) { const targets = [e]; while (this.accept(',')) targets.push(this.suffixedExpr()); this.expect('='); const vals = this.exprList(); for (const t of targets) if (t.k !== 'name' && t.k !== 'index') this.err('cannot assign'); return { k: 'assign', targets, vals, l }; }
    const cop = { '+=': '+', '-=': '-', '*=': '*', '/=': '/', '//=': '//', '%=': '%', '^=': '^', '..=': '..' }[this.tk.t];
    if (cop) { this.next(); const v = this.expr(); return { k: 'compound', target: e, op: cop, v, l }; }
    if (e.k !== 'call' && e.k !== 'method') this.err('syntax error');
    return { k: 'exprstat', e, l };
  }
  continuesExpr() { const n = this.peek().t; return n === '(' || n === '=' || n === '.' || n === ':' || n === '[' || n === ',' || n === 'string' || n === '{' || n === '+=' || n === '-='; }
  typeDecl() { this.name(); if (this.is('<')) this.skipBalanced('<', '>'); this.expect('='); this.skipType(); }
  funcBody(isMethod, name) {
    if (this.is('<')) this.skipBalanced('<', '>');
    this.expect('('); const params = isMethod ? ['self'] : []; let vararg = false;
    if (!this.is(')')) { do { if (this.accept('...')) { vararg = true; if (this.accept(':')) this.skipType(); break; } params.push(this.name()); this.optType(); } while (this.accept(',')); }
    this.expect(')'); this.optType(); const body = this.block(); this.expect('end', 'to close function'); return { k: 'function', params, vararg, body, name };
  }
  /* ---- expressions ---- */
  exprList() { const l = [this.expr()]; while (this.accept(',')) l.push(this.expr()); return l; }
  expr(limit = 0) {
    let left;
    const t = this.tk.t;
    if (t === 'not' || t === '-' || t === '#') { const l = this.next().l; const e = this.expr(UNARY); left = { k: 'unop', op: t, e, l }; }
    else left = this.simpleExpr();
    for (;;) { const op = this.tk.t, pr = BIN[op]; if (!pr || pr[0] <= limit) break; const l = this.next().l; const right = this.expr(pr[1]); left = { k: 'binop', op, a: left, b: right, l }; }
    return left;
  }
  simpleExpr() {
    const tk = this.tk, l = tk.l; let e;
    switch (tk.t) {
      case 'number': this.next(); e = { k: 'const', v: tk.v }; break;
      case 'string': this.next(); e = { k: 'const', v: tk.v }; break;
      case 'interp': this.next(); e = { k: 'interp', parts: tk.v.map((p) => (typeof p === 'string' ? p : new Parser(p.code, this.chunk).exprOnly())), l }; break;
      case 'nil': this.next(); e = { k: 'const', v: undefined }; break;
      case 'true': this.next(); e = { k: 'const', v: true }; break;
      case 'false': this.next(); e = { k: 'const', v: false }; break;
      case '...': this.next(); e = { k: 'vararg', l }; break;
      case '{': e = this.table(); break;
      case 'function': this.next(); e = this.funcBody(false, '<anonymous>'); break;
      case 'if': { this.next(); const cl = []; let c = this.expr(); this.expect('then'); cl.push([c, this.expr()]);
        while (this.accept('elseif')) { c = this.expr(); this.expect('then'); cl.push([c, this.expr()]); } this.expect('else'); e = { k: 'ifexpr', cl, els: this.expr(), l }; break; }
      default: e = this.suffixedExpr(); break;
    }
    while (this.accept('::')) this.skipType();
    return e;
  }
  exprOnly() { const e = this.expr(); return e; }
  primaryExpr() { const tk = this.tk; if (tk.t === 'name') { this.next(); return { k: 'name', n: tk.v, l: tk.l }; } if (this.accept('(')) { const e = this.expr(); this.expect(')'); return { k: 'paren', e }; } this.err('unexpected symbol'); }
  suffixedExpr() {
    let e = this.primaryExpr();
    for (;;) {
      const t = this.tk.t, l = this.tk.l;
      if (t === '.') { this.next(); e = { k: 'index', o: e, key: { k: 'const', v: this.name() }, l }; }
      else if (t === '[') { this.next(); const key = this.expr(); this.expect(']'); e = { k: 'index', o: e, key, l }; }
      else if (t === ':') { this.next(); const m = this.name(); e = { k: 'method', o: e, m, args: this.args(), l }; }
      else if (t === '(' || t === 'string' || t === '{' || t === 'interp') e = { k: 'call', f: e, args: this.args(), l };
      else if (t === '::') { this.next(); this.skipType(); }
      else return e;
    }
  }
  args() { const t = this.tk.t;
    if (t === 'string') return [{ k: 'const', v: this.next().v }];
    if (t === 'interp') return [this.simpleExpr()];
    if (t === '{') return [this.table()];
    this.expect('('); if (this.accept(')')) return []; const a = this.exprList(); this.expect(')'); return a; }
  table() {
    this.expect('{'); const items = [];
    while (!this.is('}')) {
      if (this.is('[')) { this.next(); const key = this.expr(); this.expect(']'); this.expect('='); items.push({ key, v: this.expr() }); }
      else if (this.tk.t === 'name' && this.peek().t === '=') { const k = this.next().v; this.next(); items.push({ key: { k: 'const', v: k }, v: this.expr() }); }
      else items.push({ v: this.expr() });
      if (!this.accept(',') && !this.accept(';')) break;
    }
    this.expect('}'); return { k: 'table', items };
  }
}
export function parse(src, chunk = 'chunk') { return new Parser(src, chunk).chunkAst(); }

/* ---------------------------------------------------------------- values */
export class LuaTable {
  constructor() { this.hash = new Map(); this.arr = []; this.mt = null; }
  get(k) { if (typeof k === 'number') { if (k > 0 && Number.isInteger(k) && k <= this.arr.length) return this.arr[k - 1]; } return this.hash.get(k); }
  set(k, v) {
    if (typeof k === 'number' && Number.isInteger(k) && k > 0) {
      const n = this.arr.length;
      if (k <= n) { if (v === undefined && k === n) { this.arr.pop(); while (this.arr.length && this.arr[this.arr.length - 1] === undefined) this.arr.pop(); } else this.arr[k - 1] = v; return; }
      if (k === n + 1) { if (v === undefined) { this.hash.delete(k); return; } this.arr.push(v); this.hash.delete(k); // migrate the following keys
        let nx = k + 1; while (this.hash.has(nx)) { this.arr.push(this.hash.get(nx)); this.hash.delete(nx); nx++; } return; }
    }
    if (k === undefined) throw new LuaError('table index is nil'); if (typeof k === 'number' && isNaN(k)) throw new LuaError('table index is NaN');
    if (v === undefined) this.hash.delete(k); else this.hash.set(k, v);
  }
  length() { return this.arr.length; }
  next(k) { // iteration order: array part then hash
    let i = 0;
    if (k !== undefined) { if (typeof k === 'number' && Number.isInteger(k) && k > 0 && k <= this.arr.length) i = k; else { const keys = this._keys(); const j = keys.indexOf(k); if (j < 0) return undefined; const nk = keys[j + 1]; return nk === undefined ? undefined : [nk, this.hash.get(nk)]; } }
    for (; i < this.arr.length; i++) if (this.arr[i] !== undefined) return [i + 1, this.arr[i]];
    const keys = this._keys(); return keys.length ? [keys[0], this.hash.get(keys[0])] : undefined;
  }
  _keys() { return [...this.hash.keys()]; }
  static from(o) { const t = new LuaTable(); if (Array.isArray(o)) o.forEach((v, i) => t.set(i + 1, v)); else for (const [k, v] of Object.entries(o)) t.set(k, v); return t; }
}
export const isFn = (v) => typeof v === 'function';
export function type(v) {
  if (v === undefined || v === null) return 'nil'; const t = typeof v;
  if (t === 'boolean') return 'boolean'; if (t === 'number') return 'number'; if (t === 'string') return 'string'; if (t === 'function') return 'function';
  if (v instanceof LuaTable) return 'table'; if (v.$thread) return 'thread'; return 'userdata';
}
export function typeOf(v) { const t = type(v); if (t === 'userdata' && v.$type) return v.$type; return t; }
export function fmtNum(n) {
  if (Number.isInteger(n)) return Math.abs(n) < 1e16 ? String(n) : n.toExponential().replace(/e\+?/, 'e+').replace(/e\+-/, 'e-');
  if (n === Infinity) return 'inf'; if (n === -Infinity) return '-inf'; if (isNaN(n)) return 'nan';
  let s = n.toPrecision(14); if (s.includes('e')) { let [m, e] = s.split('e'); if (m.includes('.')) m = m.replace(/0+$/, '').replace(/\.$/, ''); const en = +e; return m + 'e' + (en < 0 ? '-' : '+') + String(Math.abs(en)).padStart(2, '0'); }
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s;
}
let addrN = 0; const addr = new WeakMap(); const hexAddr = (o) => { if (!addr.has(o)) addr.set(o, (0x10000000 + (addrN++) * 64).toString(16)); return addr.get(o); };
export function tostr(v) {
  const t = type(v);
  if (t === 'nil') return 'nil'; if (t === 'boolean') return String(v); if (t === 'number') return fmtNum(v); if (t === 'string') return v;
  const mt = getmt(v); if (mt) { const f = mt.get('__tostring'); if (f) return tostr(call(f, [v])[0]); const nm = mt.get('__name'); if (typeof nm === 'string') return nm + ': 0x' + hexAddr(v); }
  if (t === 'table') return 'table: 0x' + hexAddr(v); if (t === 'function') return 'function: 0x' + hexAddr(v);
  if (v.$tostring) return v.$tostring(); return 'userdata: 0x' + hexAddr(v);
}
let stringMeta = null;
export function getmt(v) { if (v instanceof LuaTable) return v.mt; if (typeof v === 'string') return stringMeta; return null; }
const truthy = (v) => v !== undefined && v !== null && v !== false;
export function tonum(v) { if (typeof v === 'number') return v; if (typeof v === 'string') { const s = v.trim(); if (/^-?0[xX][0-9a-fA-F]+$/.test(s)) return parseInt(s, 16); if (s !== '' && /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return parseFloat(s); if (/^[-+]?(inf|nan)$/i.test(s)) return undefined; } return undefined; }

/* indexing with metatables and userdata */
export function index(o, k) {
  if (o instanceof LuaTable) {
    const v = o.get(k); if (v !== undefined || !o.mt) return v;
    const h = o.mt.get('__index'); if (h === undefined) return undefined; if (isFn(h)) return call(h, [o, k])[0]; return index(h, k);
  }
  if (typeof o === 'string') return stringMeta.get('__index').get(k);
  if (o && o.$index) return o.$index(k);
  throw new LuaError(`attempt to index ${type(o)} with ${typeof k === 'string' ? "'" + k + "'" : type(k)}`);
}
export function setindex(o, k, v) {
  if (o instanceof LuaTable) {
    if (o.mt && o.get(k) === undefined) { const h = o.mt.get('__newindex'); if (h !== undefined) { if (isFn(h)) { call(h, [o, k, v]); return; } setindex(h, k, v); return; } }
    if (o.frozen) throw new LuaError('attempt to modify a readonly table'); o.set(k, v); return;
  }
  if (o && o.$newindex) { o.$newindex(k, v); return; }
  throw new LuaError(`attempt to index ${type(o)} with ${typeof k === 'string' ? "'" + k + "'" : type(k)}`);
}
export function call(f, args) {
  if (isFn(f)) return f(args);
  const mt = getmt(f); if (mt) { const h = mt.get('__call'); if (h) return call(h, [f, ...args]); }
  if (f && f.$call) return f.$call(args);
  throw new LuaError(`attempt to call a ${type(f)} value`);
}
const META = { '+': '__add', '-': '__sub', '*': '__mul', '/': '__div', '//': '__idiv', '%': '__mod', '^': '__pow', '..': '__concat' };
function arithMeta(op, a, b) {
  const ev = META[op]; let h = (getmt(a) && getmt(a).get(ev)) || (getmt(b) && getmt(b).get(ev)); if (h) return call(h, [a, b])[0];
  if (a && a.$op) { const r = a.$op(op, b, false); if (r !== undefined) return r; } if (b && b.$op) { const r = b.$op(op, a, true); if (r !== undefined) return r; }
  const bad = typeof tonum(a) === 'number' ? b : a; throw new LuaError(`attempt to perform arithmetic (${ev.slice(2)}) on ${typeOf(bad)}${typeof tonum(a) !== 'number' && typeof tonum(b) !== 'number' ? ' and ' + typeOf(b) : ''}`);
}
export function arith(op, a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    switch (op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b; case '%': { if (b === 0) return NaN; const r = a % b; return r !== 0 && (r ^ b) < 0 && (r < 0) !== (b < 0) ? r + b : r; }
      case '^': return Math.pow(a, b); case '//': return Math.floor(a / b); }
  }
  if (op === '..') { const ta = typeof a, tb = typeof b; if ((ta === 'string' || ta === 'number') && (tb === 'string' || tb === 'number')) return (ta === 'number' ? fmtNum(a) : a) + (tb === 'number' ? fmtNum(b) : b);
    const h = (getmt(a) && getmt(a).get('__concat')) || (getmt(b) && getmt(b).get('__concat')); if (h) return call(h, [a, b])[0]; throw new LuaError(`attempt to concatenate ${typeOf(ta === 'string' || ta === 'number' ? b : a)} with ${typeOf(tb === 'string' || tb === 'number' ? a : b)}`); }
  if (typeof a !== 'object' && typeof b !== 'object') { const x = tonum(a), y = tonum(b); if (x !== undefined && y !== undefined) return arith(op, x, y); }
  return arithMeta(op, a, b);
}
export function eq(a, b) {
  if (a === b) return true; const ta = type(a); if (ta !== type(b)) return false;
  if (ta === 'table') { const h = (a.mt && a.mt.get('__eq')) || (b.mt && b.mt.get('__eq')); if (h) return truthy(call(h, [a, b])[0]); return false; }
  if (ta === 'userdata' && a.$eq) return a.$eq(b); return false;
}
export function lt(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a < b; if (typeof a === 'string' && typeof b === 'string') return a < b;
  const h = (getmt(a) && getmt(a).get('__lt')) || (getmt(b) && getmt(b).get('__lt')); if (h) return truthy(call(h, [a, b])[0]);
  throw new LuaError(`attempt to compare ${typeOf(a)} < ${typeOf(b)}`);
}
export function le(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a <= b; if (typeof a === 'string' && typeof b === 'string') return a <= b;
  const h = (getmt(a) && getmt(a).get('__le')) || (getmt(b) && getmt(b).get('__le')); if (h) return truthy(call(h, [a, b])[0]);
  const h2 = (getmt(a) && getmt(a).get('__lt')) || (getmt(b) && getmt(b).get('__lt')); if (h2) return !truthy(call(h2, [b, a])[0]);
  throw new LuaError(`attempt to compare ${typeOf(a)} <= ${typeOf(b)}`);
}
export function len(v) {
  if (typeof v === 'string') return v.length;
  if (v instanceof LuaTable) { if (v.mt) { const h = v.mt.get('__len'); if (h) return call(h, [v])[0]; } return v.length(); }
  if (v && v.$len) return v.$len(); throw new LuaError(`attempt to get length of ${typeOf(v)}`);
}

/* ---------------------------------------------------------------- interpreter */
/* calls anywhere under a node: such nodes run as generators (they may yield); the rest runs on a fast synchronous path */
function mark(n) {
  if (!n || typeof n !== 'object') return false;
  if (Array.isArray(n)) { let c = false; for (const x of n) if (mark(x)) c = true; return c; }
  if (n.k === 'function') { mark(n.body); n.y = false; return false; }
  let c = n.k === 'call' || n.k === 'method';
  for (const key of Object.keys(n)) { if (key === 'y' || key === 'l') continue; const v = n[key]; if (v && typeof v === 'object' && mark(v)) c = true; }
  if (n.k === 'if' || n.k === 'ifexpr') for (const [a, b] of n.cl) { if (mark(a)) c = true; if (mark(b)) c = true; }
  if (n.k === 'table') for (const it of n.items) { if (mark(it.key)) c = true; if (mark(it.v)) c = true; }
  if (n.k === 'interp') for (const p of n.parts) if (typeof p !== 'string' && mark(p)) c = true;
  n.y = c; return c;
}
export function prepare(ast) { mark(ast); return ast; }
const BREAK = { s: 'break' }, CONTINUE = { s: 'continue' };
class Scope { constructor(parent) { this.vars = new Map(); this.parent = parent; } }
function lookup(sc, n) { while (sc) { if (sc.vars.has(n)) return sc; sc = sc.parent; } return null; }
export const YIELD = Symbol('yield');
/* a call from a context that cannot be suspended (metamethods, sort comparators…): run the generator to its end;
   if the code yields there, the rest is handed to the scheduler as its own thread (like task.spawn) */
export function drive(it, interp) {
  let r = it.next();
  if (r.done) return r.value || [];
  if (interp && interp.onDetach) { interp.onDetach(it, r.value); return []; }
  while (!r.done) r = it.next([]);
  return r.value || [];
}
function driveRaw(it, interp) { let r = it.next(); if (r.done) return r.value; if (interp && interp.onDetach) { interp.onDetach(it, r.value); return undefined; } while (!r.done) r = it.next([]); return r.value; }
export function* callGen(f, args) {
  if (typeof f === 'function') { if (f.gen) return yield* f.gen(args); if (f.ygen) return yield* f.ygen(args); return f(args); }
  return call(f, args);
}

export class Interpreter {
  constructor(globals) { this.G = globals; this.steps = 0; this.budget = 5e6; this.maxSteps = 4e8; this.depth = 0; this.side = 'server'; }
  run(ast, chunk, env = {}) { const f = this.load(ast, chunk, env); return f([]); }
  load(ast, chunk, env = {}) {
    if (!ast.prepared) { prepare(ast); ast.prepared = true; }
    const sc = new Scope(null); for (const [k, v] of Object.entries(env)) sc.vars.set(k, v);
    return this.makeFunction({ params: [], vararg: true, body: ast, name: chunk }, sc, chunk);
  }
  getVar(sc, n) { const s = lookup(sc, n); if (s) return s.vars.get(n); return this.G.get(n); }
  setVar(sc, n, v) { const s = lookup(sc, n); if (s) s.vars.set(n, v); else this.G.set(n, v); }
  tick() { if (++this.steps > this.budget) { this.steps = 0; throw new LuaError('Script timeout: exhausted allowed execution time'); } }
  makeFunction(f, closure, chunk) {
    const self = this;
    const gen = function* (args) {
      if (++self.depth > 190) { self.depth--; throw new LuaError('stack overflow'); }
      const sc = new Scope(closure); const ps = f.params;
      for (let i = 0; i < ps.length; i++) sc.vars.set(ps[i], args[i]);
      if (f.vararg) sc.vars.set('...', args.slice(ps.length));
      try { const r = yield* self.execBlock(f.body, sc, chunk); return r && r.s === 'return' ? r.v : []; }
      finally { self.depth--; }
    };
    const fn = function luaFunction(args) { return drive(gen(args), self); };
    fn.gen = gen; fn.luaName = f.name; fn.side = self.side; return fn;
  }
  /* ---------- generator path ---------- */
  *execBlock(body, sc, chunk) { for (let i = 0; i < body.length; i++) { const s = body[i]; const r = s.y ? yield* this.exec(s, sc, chunk) : this.execS(s, sc, chunk); if (r) return r; } return undefined; }
  *exec(s, sc, chunk) {
    this.tick();
    try {
      switch (s.k) {
        case 'local': { const vals = yield* this.evalList(s.e, sc, chunk); for (let i = 0; i < s.names.length; i++) sc.vars.set(s.names[i], vals[i]); return; }
        case 'assign': {
          if (s.targets.length === 1 && s.vals.length === 1) { const t = s.targets[0]; if (t.k === 'name') { this.setVar(sc, t.n, yield* this.eval(s.vals[0], sc, chunk)); return; }
            const o = yield* this.eval(t.o, sc, chunk), k = yield* this.eval(t.key, sc, chunk); setindex(o, k, yield* this.eval(s.vals[0], sc, chunk)); return; }
          const refs = []; for (const t of s.targets) refs.push(t.k === 'index' ? [yield* this.eval(t.o, sc, chunk), yield* this.eval(t.key, sc, chunk)] : null);
          const vals = yield* this.evalList(s.vals, sc, chunk);
          s.targets.forEach((t, i) => { if (refs[i]) setindex(refs[i][0], refs[i][1], vals[i]); else this.setVar(sc, t.n, vals[i]); }); return; }
        case 'compound': { const t = s.target; if (t.k === 'name') { const v = yield* this.eval(s.v, sc, chunk); this.setVar(sc, t.n, arith(s.op, this.getVar(sc, t.n), v)); return; }
          const o = yield* this.eval(t.o, sc, chunk), k = yield* this.eval(t.key, sc, chunk), v = yield* this.eval(s.v, sc, chunk); setindex(o, k, arith(s.op, index(o, k), v)); return; }
        case 'exprstat': yield* this.evalMulti(s.e, sc, chunk); return;
        case 'return': { if (s.e.length === 1 && (s.e[0].k === 'call' || s.e[0].k === 'method')) return { s: 'return', v: yield* this.evalMulti(s.e[0], sc, chunk) }; return { s: 'return', v: yield* this.evalList(s.e, sc, chunk) }; }
        case 'if': { for (const [c, b] of s.cl) if (truthy(yield* this.eval(c, sc, chunk))) return yield* this.execBlock(b, new Scope(sc), chunk); if (s.els) return yield* this.execBlock(s.els, new Scope(sc), chunk); return; }
        case 'while': { while (truthy(yield* this.eval(s.c, sc, chunk))) { this.tick(); const r = yield* this.execBlock(s.b, new Scope(sc), chunk); if (r === BREAK) break; if (r === CONTINUE) continue; if (r) return r; } return; }
        case 'repeat': { for (;;) { this.tick(); const inner = new Scope(sc); const r = yield* this.execBlock(s.b, inner, chunk); if (r === BREAK) break; if (r && r !== CONTINUE) return r; if (truthy(yield* this.eval(s.c, inner, chunk))) break; } return; }
        case 'do': return yield* this.execBlock(s.b, new Scope(sc), chunk);
        case 'fornum': {
          const a = tonum(yield* this.eval(s.a, sc, chunk)), b = tonum(yield* this.eval(s.b, sc, chunk)), st = s.s ? tonum(yield* this.eval(s.s, sc, chunk)) : 1;
          if (a === undefined || b === undefined || st === undefined) throw new LuaError("'for' initial value must be a number"); if (st === 0) throw new LuaError("'for' step is zero");
          for (let i = a; st > 0 ? i <= b : i >= b; i += st) { this.tick(); const inner = new Scope(sc); inner.vars.set(s.v, i); const r = yield* this.execBlock(s.body, inner, chunk); if (r === BREAK) break; if (r === CONTINUE) continue; if (r) return r; }
          return; }
        case 'forin': {
          let [f, st, ctl] = yield* this.evalList(s.e, sc, chunk);
          if ((f && f.isNext && st instanceof LuaTable && ctl === undefined) || (f instanceof LuaTable && !(f.mt && (f.mt.get('__iter') || f.mt.get('__call'))))) {
            const t = f instanceof LuaTable ? f : st, ents = []; t.arr.forEach((v, i) => { if (v !== undefined) ents.push([i + 1, v]); }); for (const e of t.hash) ents.push(e);
            for (const [k] of ents) { const v = t.get(k); if (v === undefined) continue; this.tick(); const inner = new Scope(sc); inner.vars.set(s.names[0], k); if (s.names[1]) inner.vars.set(s.names[1], v);
              const r = yield* this.execBlock(s.body, inner, chunk); if (r === BREAK) break; if (r === CONTINUE) continue; if (r) return r; }
            return; }
          if (!isFn(f) && !(f && getmt(f) && getmt(f).get('__call'))) {
            const mt = getmt(f), it = mt && mt.get('__iter');
            if (it) [f, st, ctl] = call(it, [f]); else if (f && f.$iter) { const arr = f.$iter(); let i = 0; f = () => (i < arr.length ? arr[i++] : [undefined]); }
            else throw new LuaError(`attempt to iterate over a ${typeOf(f)} value`); }
          for (;;) { this.tick(); const vals = yield* callGen(f, [st, ctl]); if (vals[0] === undefined || vals[0] === null) break; ctl = vals[0];
            const inner = new Scope(sc); for (let i = 0; i < s.names.length; i++) inner.vars.set(s.names[i], vals[i]);
            const r = yield* this.execBlock(s.body, inner, chunk); if (r === BREAK) break; if (r === CONTINUE) continue; if (r) return r; }
          return; }
        case 'localfunc': case 'funcdecl': case 'break': case 'continue': return this.execS(s, sc, chunk);
        default: throw new LuaError('bad statement ' + s.k);
      }
    } catch (e) { throw this.locate(e, s, chunk); }
  }
  locate(e, s, chunk) { if (e instanceof LuaError && !e.located && typeof e.value === 'string' && s.l) { e.located = true; if (!/^[^:\s]+:\d+:/.test(e.value)) { e.value = `${chunk}:${s.l}: ${e.value}`; e.message = e.value; } } return e; }
  *evalList(list, sc, chunk) {
    if (!list.length) return [];
    const out = []; for (let i = 0; i < list.length - 1; i++) out.push(list[i].y ? yield* this.eval(list[i], sc, chunk) : this.evalS(list[i], sc, chunk));
    const last = list[list.length - 1]; if (last.k === 'call' || last.k === 'method' || last.k === 'vararg') out.push(...(yield* this.evalMulti(last, sc, chunk))); else out.push(last.y ? yield* this.eval(last, sc, chunk) : this.evalS(last, sc, chunk));
    return out;
  }
  *evalMulti(e, sc, chunk) {
    if (e.k === 'call') { const f = yield* this.eval(e.f, sc, chunk), args = yield* this.evalList(e.args, sc, chunk);
      if (f === undefined || f === null) throw new LuaError(`attempt to call a nil value${e.f.k === 'name' ? " (global '" + e.f.n + "')" : e.f.k === 'index' && e.f.key.k === 'const' ? " (field '" + e.f.key.v + "')" : ''}`);
      return yield* callGen(f, args); }
    if (e.k === 'method') { const o = yield* this.eval(e.o, sc, chunk), f = index(o, e.m); if (f === undefined || f === null) throw new LuaError(`attempt to call a nil value (method '${e.m}')`); const args = yield* this.evalList(e.args, sc, chunk); return yield* callGen(f, [o, ...args]); }
    if (e.k === 'vararg') return this.getVar(sc, '...') || [];
    return [yield* this.eval(e, sc, chunk)];
  }
  *eval(e, sc, chunk) {
    if (!e.y) return this.evalS(e, sc, chunk);
    switch (e.k) {
      case 'index': { const o = yield* this.eval(e.o, sc, chunk); return index(o, yield* this.eval(e.key, sc, chunk)); }
      case 'call': case 'method': return (yield* this.evalMulti(e, sc, chunk))[0];
      case 'paren': return yield* this.eval(e.e, sc, chunk);
      case 'binop': { const op = e.op;
        if (op === 'and') { const a = yield* this.eval(e.a, sc, chunk); return truthy(a) ? yield* this.eval(e.b, sc, chunk) : a; }
        if (op === 'or') { const a = yield* this.eval(e.a, sc, chunk); return truthy(a) ? a : yield* this.eval(e.b, sc, chunk); }
        const a = yield* this.eval(e.a, sc, chunk), b = yield* this.eval(e.b, sc, chunk);
        switch (op) { case '==': return eq(a, b); case '~=': return !eq(a, b); case '<': return lt(a, b); case '>': return lt(b, a); case '<=': return le(a, b); case '>=': return le(b, a); default: return arith(op, a, b); } }
      case 'unop': { const v = yield* this.eval(e.e, sc, chunk); return unop(e.op, v); }
      case 'table': { const t = new LuaTable(); let n = 1;
        for (let i = 0; i < e.items.length; i++) { const it = e.items[i];
          if (it.key) { const k = yield* this.eval(it.key, sc, chunk); if (k === undefined) throw new LuaError('table index is nil'); t.set(k, yield* this.eval(it.v, sc, chunk)); }
          else if (i === e.items.length - 1 && (it.v.k === 'call' || it.v.k === 'method' || it.v.k === 'vararg')) { for (const v of yield* this.evalMulti(it.v, sc, chunk)) t.set(n++, v); }
          else t.set(n++, yield* this.eval(it.v, sc, chunk)); }
        return t; }
      case 'ifexpr': { for (const [c, v] of e.cl) if (truthy(yield* this.eval(c, sc, chunk))) return yield* this.eval(v, sc, chunk); return yield* this.eval(e.els, sc, chunk); }
      case 'interp': { let s = ''; for (const p of e.parts) s += typeof p === 'string' ? p : tostr(yield* this.eval(p, sc, chunk)); return s; }
      default: return this.evalS(e, sc, chunk);
    }
  }
  /* ---------- synchronous path (no call inside) ---------- */
  execBlockS(body, sc, chunk) { for (let i = 0; i < body.length; i++) { const r = this.execS(body[i], sc, chunk); if (r) return r; } return undefined; }
  execS(s, sc, chunk) {
    this.tick();
    try {
      switch (s.k) {
        case 'local': { if (s.e.length === 1 && s.names.length === 1 && s.e[0].k !== 'vararg') { sc.vars.set(s.names[0], this.evalS(s.e[0], sc, chunk)); return; } const vals = this.evalListS(s.e, sc, chunk); for (let i = 0; i < s.names.length; i++) sc.vars.set(s.names[i], vals[i]); return; }
        case 'assign': {
          if (s.targets.length === 1 && s.vals.length === 1) { const t = s.targets[0], v = this.evalS(s.vals[0], sc, chunk); if (t.k === 'name') this.setVar(sc, t.n, v); else setindex(this.evalS(t.o, sc, chunk), this.evalS(t.key, sc, chunk), v); return; }
          const refs = s.targets.map((t) => (t.k === 'index' ? [this.evalS(t.o, sc, chunk), this.evalS(t.key, sc, chunk)] : null)); const vals = this.evalListS(s.vals, sc, chunk);
          s.targets.forEach((t, i) => { if (refs[i]) setindex(refs[i][0], refs[i][1], vals[i]); else this.setVar(sc, t.n, vals[i]); }); return; }
        case 'compound': { const t = s.target; if (t.k === 'name') { this.setVar(sc, t.n, arith(s.op, this.getVar(sc, t.n), this.evalS(s.v, sc, chunk))); return; }
          const o = this.evalS(t.o, sc, chunk), k = this.evalS(t.key, sc, chunk); setindex(o, k, arith(s.op, index(o, k), this.evalS(s.v, sc, chunk))); return; }
        case 'localfunc': { sc.vars.set(s.n, undefined); sc.vars.set(s.n, this.makeFunction(s.f, sc, chunk)); return; }
        case 'funcdecl': { const f = this.makeFunction(s.f, sc, chunk);
          if (s.path.length === 1 && !s.method) { this.setVar(sc, s.path[0], f); return; }
          let o = this.getVar(sc, s.path[0]); for (let i = 1; i < s.path.length - (s.method ? 0 : 1); i++) o = index(o, s.path[i]);
          setindex(o, s.method || s.path[s.path.length - 1], f); return; }
        case 'return': return { s: 'return', v: this.evalListS(s.e, sc, chunk) };
        case 'if': { for (const [c, b] of s.cl) if (truthy(this.evalS(c, sc, chunk))) return this.execBlockS(b, new Scope(sc), chunk); if (s.els) return this.execBlockS(s.els, new Scope(sc), chunk); return; }
        case 'while': { while (truthy(this.evalS(s.c, sc, chunk))) { this.tick(); const r = this.execBlockS(s.b, new Scope(sc), chunk); if (r === BREAK) break; if (r === CONTINUE) continue; if (r) return r; } return; }
        case 'repeat': { for (;;) { this.tick(); const inner = new Scope(sc); const r = this.execBlockS(s.b, inner, chunk); if (r === BREAK) break; if (r && r !== CONTINUE) return r; if (truthy(this.evalS(s.c, inner, chunk))) break; } return; }
        case 'do': return this.execBlockS(s.b, new Scope(sc), chunk);
        case 'fornum': { const a = tonum(this.evalS(s.a, sc, chunk)), b = tonum(this.evalS(s.b, sc, chunk)), st = s.s ? tonum(this.evalS(s.s, sc, chunk)) : 1;
          if (a === undefined || b === undefined || st === undefined) throw new LuaError("'for' initial value must be a number"); if (st === 0) throw new LuaError("'for' step is zero");
          for (let i = a; st > 0 ? i <= b : i >= b; i += st) { this.tick(); const inner = new Scope(sc); inner.vars.set(s.v, i); const r = this.execBlockS(s.body, inner, chunk); if (r === BREAK) break; if (r === CONTINUE) continue; if (r) return r; } return; }
        case 'forin': case 'exprstat': return driveRaw(this.exec(s, sc, chunk), this);
        case 'break': return BREAK;
        case 'continue': return CONTINUE;
        default: throw new LuaError('bad statement ' + s.k);
      }
    } catch (e) { throw this.locate(e, s, chunk); }
  }
  evalListS(list, sc, chunk) {
    const out = []; for (let i = 0; i < list.length; i++) { const e = list[i]; if (i === list.length - 1 && e.k === 'vararg') out.push(...(this.getVar(sc, '...') || [])); else out.push(this.evalS(e, sc, chunk)); } return out;
  }
  evalS(e, sc, chunk) {
    switch (e.k) {
      case 'const': return e.v;
      case 'name': return this.getVar(sc, e.n);
      case 'index': return index(this.evalS(e.o, sc, chunk), this.evalS(e.key, sc, chunk));
      case 'vararg': return (this.getVar(sc, '...') || [])[0];
      case 'paren': return this.evalS(e.e, sc, chunk);
      case 'function': return this.makeFunction(e, sc, chunk);
      case 'binop': { const op = e.op;
        if (op === 'and') { const a = this.evalS(e.a, sc, chunk); return truthy(a) ? this.evalS(e.b, sc, chunk) : a; }
        if (op === 'or') { const a = this.evalS(e.a, sc, chunk); return truthy(a) ? a : this.evalS(e.b, sc, chunk); }
        const a = this.evalS(e.a, sc, chunk), b = this.evalS(e.b, sc, chunk);
        if (typeof a === 'number' && typeof b === 'number') switch (op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b; case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b; case '==': return a === b; case '~=': return a !== b; }
        switch (op) { case '==': return eq(a, b); case '~=': return !eq(a, b); case '<': return lt(a, b); case '>': return lt(b, a); case '<=': return le(a, b); case '>=': return le(b, a); default: return arith(op, a, b); } }
      case 'unop': return unop(e.op, this.evalS(e.e, sc, chunk));
      case 'table': { const t = new LuaTable(); let n = 1;
        for (let i = 0; i < e.items.length; i++) { const it = e.items[i];
          if (it.key) { const k = this.evalS(it.key, sc, chunk); if (k === undefined) throw new LuaError('table index is nil'); t.set(k, this.evalS(it.v, sc, chunk)); }
          else if (i === e.items.length - 1 && it.v.k === 'vararg') { for (const v of this.getVar(sc, '...') || []) t.set(n++, v); }
          else t.set(n++, this.evalS(it.v, sc, chunk)); }
        return t; }
      case 'ifexpr': { for (const [c, v] of e.cl) if (truthy(this.evalS(c, sc, chunk))) return this.evalS(v, sc, chunk); return this.evalS(e.els, sc, chunk); }
      case 'interp': return e.parts.map((p) => (typeof p === 'string' ? p : tostr(this.evalS(p, sc, chunk)))).join('');
      case 'call': case 'method': return drive(this.eval(e, sc, chunk), this);
      default: throw new LuaError('bad expression ' + e.k);
    }
  }
}
function unop(op, v) {
  if (op === 'not') return !truthy(v); if (op === '#') return len(v);
  if (typeof v === 'number') return -v; const n = tonum(v); if (n !== undefined && typeof v === 'string') return -n;
  const h = getmt(v) && getmt(v).get('__unm'); if (h) return call(h, [v])[0]; if (v && v.$op) return v.$op('unm'); throw new LuaError(`attempt to perform arithmetic (unm) on ${typeOf(v)}`);
}

/* ---------------------------------------------------------------- Lua patterns */
const L_ESC = '%';
function classMatch(c, cl) {
  const code = c.charCodeAt(0); let r;
  switch (cl.toLowerCase()) {
    case 'a': r = /[A-Za-z]/.test(c); break; case 'd': r = code >= 48 && code <= 57; break; case 'l': r = code >= 97 && code <= 122; break; case 's': r = /[ \t\n\r\f\v]/.test(c); break;
    case 'u': r = code >= 65 && code <= 90; break; case 'w': r = /[A-Za-z0-9]/.test(c); break; case 'x': r = /[0-9A-Fa-f]/.test(c); break; case 'p': r = /[!-\/:-@\[-`{-~]/.test(c); break;
    case 'c': r = code < 32 || code === 127; break; case 'g': r = code > 32 && code < 127; break; default: return cl === c;
  }
  return cl === cl.toUpperCase() && /[a-z]/i.test(cl) ? !r : r;
}
function matchClass(ms, c, p, ep) { // p points at the start of the item (single char / %x / [set] / .)
  const pc = ms.pat[p];
  if (pc === '.') return true;
  if (pc === L_ESC) return classMatch(c, ms.pat[p + 1]);
  if (pc === '[') return matchBracket(ms, c, p, ep - 1);
  return pc === c;
}
function matchBracket(ms, c, p, ec) { let sig = true; p++; if (ms.pat[p] === '^') { sig = false; p++; }
  while (p < ec) { if (ms.pat[p] === L_ESC) { p++; if (classMatch(c, ms.pat[p])) return sig; p++; }
    else if (ms.pat[p + 1] === '-' && p + 2 < ec) { if (ms.pat[p] <= c && c <= ms.pat[p + 2]) return sig; p += 3; }
    else { if (ms.pat[p] === c) return sig; p++; } }
  return !sig; }
function classEnd(ms, p) { const pat = ms.pat; if (pat[p] === L_ESC) { if (p + 1 >= pat.length) throw new LuaError('malformed pattern (ends with %)'); return p + 2; }
  if (pat[p] === '[') { p++; if (pat[p] === '^') p++; do { if (p >= pat.length) throw new LuaError('malformed pattern (missing ])'); if (pat[p++] === L_ESC && p < pat.length) p++; } while (pat[p] !== ']'); return p + 1; }
  return p + 1; }
function doMatch(ms, s, p) {
  const pat = ms.pat;
  for (;;) {
    if (p >= pat.length) return s;
    const pc = pat[p];
    if (pc === '(') { if (pat[p + 1] === ')') return startCap(ms, s, p + 2, -2); return startCap(ms, s, p + 1, -1); }
    if (pc === ')') return endCap(ms, s, p + 1);
    if (pc === '$' && p + 1 === pat.length) return s === ms.src.length ? s : -1;
    if (pc === L_ESC && pat[p + 1] === 'b') { if (s >= ms.src.length || ms.src[s] !== pat[p + 2]) return -1; const b = pat[p + 2], e = pat[p + 3]; let cont = 1, i = s + 1;
      while (i < ms.src.length) { const c = ms.src[i]; if (c === e) { if (--cont === 0) { s = i + 1; p += 4; break; } } else if (c === b) cont++; i++; } if (cont !== 0) return -1; continue; }
    if (pc === L_ESC && pat[p + 1] === 'f') { p += 2; const ep = classEnd(ms, p); const prev = s === 0 ? '\0' : ms.src[s - 1], cur = s < ms.src.length ? ms.src[s] : '\0';
      if (!matchBracket(ms, prev, p, ep - 1) && matchBracket(ms, cur, p, ep - 1)) { p = ep; continue; } return -1; }
    if (pc === L_ESC && /\d/.test(pat[p + 1])) { const l = +pat[p + 1] - 1; const cap = ms.cap[l]; const str = ms.src.substr(cap.s, cap.l); if (ms.src.startsWith(str, s)) { s += str.length; p += 2; continue; } return -1; }
    const ep = classEnd(ms, p), m = s < ms.src.length && matchClass(ms, ms.src[s], p, ep), q = pat[ep];
    if (q === '?') { if (m) { const r = doMatch(ms, s + 1, ep + 1); if (r !== -1) return r; } p = ep + 1; continue; }
    if (q === '+') return m ? maxExpand(ms, s + 1, p, ep) : -1;
    if (q === '*') return maxExpand(ms, s, p, ep);
    if (q === '-') { for (;;) { const r = doMatch(ms, s, ep + 1); if (r !== -1) return r; if (s < ms.src.length && matchClass(ms, ms.src[s], p, ep)) s++; else return -1; } }
    if (!m) return -1; s++; p = ep;
  }
}
function maxExpand(ms, s, p, ep) { let i = 0; while (s + i < ms.src.length && matchClass(ms, ms.src[s + i], p, ep)) i++; while (i >= 0) { const r = doMatch(ms, s + i, ep + 1); if (r !== -1) return r; i--; } return -1; }
function startCap(ms, s, p, what) { ms.cap.push({ s, l: what }); const r = doMatch(ms, s, p); if (r === -1) ms.cap.pop(); return r; }
function endCap(ms, s, p) { let l = -1; for (let i = ms.cap.length - 1; i >= 0; i--) if (ms.cap[i].l === -1) { l = i; break; } ms.cap[l].l = s - ms.cap[l].s; const r = doMatch(ms, s, p); if (r === -1) ms.cap[l].l = -1; return r; }
function getCaps(ms, s, e, whole) { if (!ms.cap.length) return whole ? [ms.src.slice(s, e)] : []; return ms.cap.map((c) => (c.l === -2 ? c.s + 1 : ms.src.substr(c.s, c.l))); }
function patFind(src, pat, init, plain, find) {
  init = init == null ? 1 : init < 0 ? Math.max(1, src.length + init + 1) : init === 0 ? 1 : init; if (init > src.length + 1) return [undefined];
  if (find && (plain || !/[\^$*+?.()[\]%-]/.test(pat))) { const i = src.indexOf(pat, init - 1); return i < 0 ? [undefined] : [i + 1, i + pat.length]; }
  const anchor = pat[0] === '^'; const ms = { src, pat: anchor ? pat.slice(1) : pat, cap: [] }; let s = init - 1;
  do { ms.cap = []; const e = doMatch(ms, s, 0); if (e !== -1) return find ? [s + 1, e, ...getCaps(ms, s, e, false)] : getCaps(ms, s, e, true); s++; } while (s <= src.length && !anchor);
  return [undefined];
}

/* ---------------------------------------------------------------- string.format */
function format(fmt, args) {
  let ai = 0; return fmt.replace(/%([-+ #0]*)(\d*)(?:\.(\d+))?([diouxXeEfgGqscaA%])/g, (m, flags, width, prec, conv) => {
    if (conv === '%') return '%'; const v = args[ai++]; let s;
    switch (conv) {
      case 'd': case 'i': { const n = tonum(v); if (n === undefined) throw new LuaError(`bad argument #${ai} to 'format' (number expected, got ${typeOf(v)})`); s = String(Math.trunc(n)); if (flags.includes('+') && n >= 0) s = '+' + s; break; }
      case 'u': s = String(Math.trunc(Math.abs(tonum(v)))); break;
      case 'o': s = Math.trunc(tonum(v)).toString(8); break;
      case 'x': s = (Math.trunc(tonum(v)) >>> 0).toString(16); break; case 'X': s = (Math.trunc(tonum(v)) >>> 0).toString(16).toUpperCase(); break;
      case 'f': case 'F': { const n = tonum(v); s = n.toFixed(prec === undefined ? 6 : +prec); if (flags.includes('+') && n >= 0) s = '+' + s; break; }
      case 'e': case 'E': { s = tonum(v).toExponential(prec === undefined ? 6 : +prec).replace(/e([+-])(\d)$/, 'e$10$2'); if (conv === 'E') s = s.toUpperCase(); break; }
      case 'g': case 'G': { const n = tonum(v); s = n.toPrecision(prec === undefined ? 6 : Math.max(1, +prec)); if (!flags.includes('#')) s = s.includes('e') ? s.replace(/\.?0+e/, 'e') : s.includes('.') ? s.replace(/\.?0+$/, '') : s; s = s.replace(/e([+-])(\d)$/, 'e$10$2'); break; }
      case 'c': s = String.fromCharCode(tonum(v)); break;
      case 'q': s = '"' + tostr(v).replace(/[\\"\n]/g, (c) => (c === '\n' ? '\\n' : '\\' + c)) + '"'; break;
      case 's': s = tostr(v); if (prec !== undefined) s = s.slice(0, +prec); break;
      default: s = tostr(v);
    }
    if (width && s.length < +width) s = flags.includes('-') ? s.padEnd(+width) : flags.includes('0') && /[dfeEgGxX]/.test(conv) ? (s[0] === '-' ? '-' + s.slice(1).padStart(+width - 1, '0') : s.padStart(+width, '0')) : s.padStart(+width);
    return s;
  });
}

/* ---------------------------------------------------------------- standard library */
const ret = (...v) => v;
const arg = (a, i, name, fn) => { const v = a[i]; if (typeof v !== 'number') { const n = tonum(v); if (n === undefined) throw new LuaError(`invalid argument #${i + 1} to '${fn}' (number expected, got ${typeOf(v)})`); return n; } void name; return v; };
const errVal = (e) => (e instanceof LuaError ? e.value : e instanceof RangeError ? 'stack overflow' : String((e && e.message) || e));
function* PCALL(a) { try { return [true, ...(yield* callGen(a[0], a.slice(1)))]; } catch (e) { return [false, errVal(e)]; } }
function* XPCALL(a) { try { return [true, ...(yield* callGen(a[0], a.slice(2)))]; } catch (e) { return [false, ...call(a[1], [errVal(e)])]; } }
export function createGlobals(io = {}) {
  const G = new LuaTable(); const lib = (o) => LuaTable.from(o);
  const print = io.print || ((...s) => console.log(...s)), warn = io.warn || ((...s) => console.warn(...s));
  // math
  const PERM = (() => { const p = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180]; return [...p, ...p]; })();
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10), lerp = (t, a, b) => a + t * (b - a), grad = (h, x, y, z) => { const u = (h & 15) < 8 ? x : y, v = (h & 15) < 4 ? y : (h & 15) === 12 || (h & 15) === 14 ? x : z; return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v); };
  const noise = (x, y = 0, z = 0) => { const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255; x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z); const u = fade(x), v = fade(y), w = fade(z), P = PERM;
    const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    return lerp(w, lerp(v, lerp(u, grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z)), lerp(u, grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z))), lerp(v, lerp(u, grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1)), lerp(u, grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1)))); };
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  G.set('math', lib({
    abs: (a) => ret(Math.abs(arg(a, 0, 'x', 'abs'))), ceil: (a) => ret(Math.ceil(arg(a, 0, 'x', 'ceil'))), floor: (a) => ret(Math.floor(arg(a, 0, 'x', 'floor'))), sqrt: (a) => ret(Math.sqrt(arg(a, 0, 'x', 'sqrt'))),
    sin: (a) => ret(Math.sin(a[0])), cos: (a) => ret(Math.cos(a[0])), tan: (a) => ret(Math.tan(a[0])), asin: (a) => ret(Math.asin(a[0])), acos: (a) => ret(Math.acos(a[0])),
    atan: (a) => ret(a[1] === undefined ? Math.atan(a[0]) : Math.atan2(a[0], a[1])), atan2: (a) => ret(Math.atan2(a[0], a[1])), exp: (a) => ret(Math.exp(a[0])),
    log: (a) => ret(a[1] === undefined ? Math.log(a[0]) : Math.log(a[0]) / Math.log(a[1])), log10: (a) => ret(Math.log10(a[0])), pow: (a) => ret(Math.pow(a[0], a[1])),
    fmod: (a) => ret(a[0] % a[1]), modf: (a) => { const i = Math.trunc(a[0]); return [i, a[0] - i]; }, frexp: (a) => { const x = a[0]; if (!x) return [0, 0]; const e = Math.ceil(Math.log2(Math.abs(x)) + 1e-12); return [x / 2 ** e, e]; }, ldexp: (a) => ret(a[0] * 2 ** a[1]),
    min: (a) => { let m = arg(a, 0, 'x', 'min'); for (let i = 1; i < a.length; i++) m = Math.min(m, arg(a, i, 'x', 'min')); return [m]; },
    max: (a) => { let m = arg(a, 0, 'x', 'max'); for (let i = 1; i < a.length; i++) m = Math.max(m, arg(a, i, 'x', 'max')); return [m]; },
    clamp: (a) => { const x = arg(a, 0, 'x', 'clamp'), lo = arg(a, 1, 'min', 'clamp'), hi = arg(a, 2, 'max', 'clamp'); if (lo > hi) throw new LuaError("invalid argument #3 to 'clamp' (max must be greater than or equal to min)"); return [Math.min(hi, Math.max(lo, x))]; },
    sign: (a) => ret(Math.sign(a[0])), round: (a) => ret(a[0] >= 0 ? Math.floor(a[0] + 0.5) : -Math.floor(-a[0] + 0.5)), noise: (a) => ret(noise(a[0] || 0, a[1] || 0, a[2] || 0)),
    lerp: (a) => ret(a[0] + (a[1] - a[0]) * a[2]), map: (a) => ret(a[3] + (a[0] - a[1]) * (a[4] - a[3]) / (a[2] - a[1])),
    random: (a) => { const r = rnd(); if (a[0] === undefined) return [r]; if (a[1] === undefined) return [1 + Math.floor(r * a[0])]; return [a[0] + Math.floor(r * (a[1] - a[0] + 1))]; }, randomseed: (a) => { seed = Math.abs(Math.floor(a[0] || 0)) % 2147483648; return []; },
    rad: (a) => ret(a[0] * Math.PI / 180), deg: (a) => ret(a[0] * 180 / Math.PI), pi: Math.PI, huge: Infinity,
  }));
  // string
  const S = lib({
    len: (a) => ret(len(String(a[0]))), sub: (a) => { const s = tostr(a[0]); let i = a[1] === undefined ? 1 : arg(a, 1, 'i', 'sub'), j = a[2] === undefined ? -1 : arg(a, 2, 'j', 'sub'); const n = s.length;
      if (i < 0) i = Math.max(1, n + i + 1); else if (i === 0) i = 1; if (j < 0) j = n + j + 1; else if (j > n) j = n; return [i > j ? '' : s.slice(i - 1, j)]; },
    upper: (a) => ret(tostr(a[0]).toUpperCase()), lower: (a) => ret(tostr(a[0]).toLowerCase()), rep: (a) => { const n = Math.max(0, Math.floor(a[1])); return [a[2] ? Array(n).fill(tostr(a[0])).join(tostr(a[2])) : tostr(a[0]).repeat(n)]; },
    reverse: (a) => ret([...tostr(a[0])].reverse().join('')), byte: (a) => { const s = tostr(a[0]), i = a[1] === undefined ? 1 : a[1], j = a[2] === undefined ? i : a[2]; const out = []; for (let k = i; k <= j; k++) { const c = s.charCodeAt((k < 0 ? s.length + k + 1 : k) - 1); if (!isNaN(c)) out.push(c); } return out; },
    char: (a) => ret(String.fromCharCode(...a.map((x) => tonum(x)))), format: (a) => ret(format(tostr(a[0]), a.slice(1))),
    find: (a) => patFind(tostr(a[0]), tostr(a[1]), a[2], truthy(a[3]), true), match: (a) => patFind(tostr(a[0]), tostr(a[1]), a[2], false, false),
    gmatch: (a) => { const s = tostr(a[0]), pat = tostr(a[1]); let pos = 0; return [() => { while (pos <= s.length) { const ms = { src: s, pat, cap: [] }; const e = doMatch(ms, pos, 0); if (e !== -1) { const r = getCaps(ms, pos, e, true); pos = e > pos ? e : pos + 1; return r; } pos++; } return [undefined]; }]; },
    gsub: (a) => { const s = tostr(a[0]), pat0 = tostr(a[1]), repl = a[2], maxN = a[3] === undefined ? Infinity : a[3]; const anchor = pat0[0] === '^', pat = anchor ? pat0.slice(1) : pat0; let out = '', pos = 0, n = 0;
      while (n < maxN) { const ms = { src: s, pat, cap: [] }; const e = doMatch(ms, pos, 0);
        if (e !== -1) { n++; const whole = s.slice(pos, e), caps = getCaps(ms, pos, e, true); let r;
          if (typeof repl === 'string' || typeof repl === 'number') r = tostr(repl).replace(/%([%\d])/g, (m, d) => (d === '%' ? '%' : d === '0' ? whole : tostr(caps[+d - 1])));
          else if (repl instanceof LuaTable) r = index(repl, caps[0]); else r = call(repl, caps)[0];
          out += r === undefined || r === false ? whole : tostr(r); }
        if (e !== -1 && e > pos) pos = e; else { if (pos < s.length) out += s[pos]; pos++; }
        if (pos > s.length || anchor) break; }
      if (pos < s.length) out += s.slice(pos); return [out, n]; },
    split: (a) => { const s = tostr(a[0]), sep = a[1] === undefined ? ',' : tostr(a[1]); return [LuaTable.from(sep === '' ? [...s] : s.split(sep))]; },
  });
  stringMeta = new LuaTable(); stringMeta.set('__index', S); G.set('string', S);
  // table
  const T = lib({
    insert: (a) => { const t = a[0]; if (a.length === 2) t.set(len(t) + 1, a[1]); else { const n = len(t), pos = a[1]; for (let i = n; i >= pos; i--) t.set(i + 1, t.get(i)); t.set(pos, a[2]); } return []; },
    remove: (a) => { const t = a[0], n = len(t); if (!n) return [undefined]; const pos = a[1] === undefined ? n : a[1]; const v = t.get(pos); for (let i = pos; i < n; i++) t.set(i, t.get(i + 1)); t.set(n, undefined); return [v]; },
    concat: (a) => { const t = a[0], sep = a[1] === undefined ? '' : tostr(a[1]), i = a[2] || 1, j = a[3] === undefined ? len(t) : a[3]; const out = []; for (let k = i; k <= j; k++) { const v = t.get(k); if (typeof v !== 'string' && typeof v !== 'number') throw new LuaError(`invalid value (at index ${k}) in table for 'concat'`); out.push(tostr(v)); } return [out.join(sep)]; },
    sort: (a) => { const t = a[0], f = a[1], n = len(t), arr = []; for (let i = 1; i <= n; i++) arr.push(t.get(i)); arr.sort((x, y) => (f ? (truthy(call(f, [x, y])[0]) ? -1 : truthy(call(f, [y, x])[0]) ? 1 : 0) : lt(x, y) ? -1 : lt(y, x) ? 1 : 0)); arr.forEach((v, i) => t.set(i + 1, v)); return []; },
    unpack: (a) => { const t = a[0], i = a[1] || 1, j = a[2] === undefined ? len(t) : a[2]; const out = []; for (let k = i; k <= j; k++) out.push(t.get(k)); return out; },
    pack: (a) => { const t = LuaTable.from(a); t.set('n', a.length); return [t]; },
    clone: (a) => { const t = new LuaTable(); t.arr = a[0].arr.slice(); t.hash = new Map(a[0].hash); t.mt = a[0].mt; return [t]; },
    clear: (a) => { a[0].arr = []; a[0].hash = new Map(); return []; },
    find: (a) => { const t = a[0], n = len(t); for (let i = a[2] || 1; i <= n; i++) if (eq(t.get(i), a[1])) return [i]; return [undefined]; },
    create: (a) => { const t = new LuaTable(); for (let i = 0; i < a[0]; i++) t.arr.push(a[1]); return [t]; },
    freeze: (a) => { a[0].frozen = true; return [a[0]]; }, isfrozen: (a) => ret(!!a[0].frozen), maxn: (a) => ret(len(a[0])),
    move: (a) => { const [src, f, e, t, dst0] = a, dst = dst0 || src; for (let i = 0; i <= e - f; i++) dst.set(t + i, src.get(f + i)); return [dst]; },
    getn: (a) => ret(len(a[0])), foreach: (a) => { let k = undefined; for (;;) { const r = a[0].next(k); if (!r) break; k = r[0]; call(a[1], r); } return []; },
  });
  G.set('table', T);
  // base
  const ipairsIter = (a) => { const i = a[1] + 1, v = index(a[0], i); return v === undefined ? [undefined] : [i, v]; };
  const nextFn = (a) => { const t = a[0]; if (!(t instanceof LuaTable)) throw new LuaError(`invalid argument #1 to 'next' (table expected, got ${typeOf(t)})`); return t.next(a[1]) || [undefined]; }; nextFn.isNext = true;
  Object.entries({
    print: (a) => { print(a.map(tostr).join('\t')); return []; }, warn: (a) => { warn(a.map(tostr).join(' ')); return []; },
    type: (a) => ret(type(a[0])), typeof: (a) => ret(typeOf(a[0])), tostring: (a) => ret(tostr(a[0])),
    tonumber: (a) => { if (a[1] !== undefined) { const n = parseInt(tostr(a[0]).trim(), a[1]); return [isNaN(n) ? undefined : n]; } return [tonum(a[0])]; },
    pairs: (a) => { const t = a[0]; const mt = getmt(t), h = mt && mt.get('__pairs'); if (h) return call(h, [t]); if (!(t instanceof LuaTable)) throw new LuaError(`invalid argument #1 to 'pairs' (table expected, got ${typeOf(t)})`); return [nextFn, t, undefined]; },
    ipairs: (a) => { if (a[0] === undefined) throw new LuaError("invalid argument #1 to 'ipairs' (table expected, got nil)"); return [ipairsIter, a[0], 0]; }, next: nextFn,
    select: (a) => { if (a[0] === '#') return [a.length - 1]; const n = tonum(a[0]); return n < 0 ? a.slice(a.length + n) : a.slice(n); },
    rawget: (a) => ret(a[0].get(a[1])), rawset: (a) => { a[0].set(a[1], a[2]); return [a[0]]; }, rawequal: (a) => ret(a[0] === a[1]), rawlen: (a) => ret(a[0] instanceof LuaTable ? a[0].length() : a[0].length),
    setmetatable: (a) => { if (!(a[0] instanceof LuaTable)) throw new LuaError("invalid argument #1 to 'setmetatable' (table expected)"); if (a[0].mt && a[0].mt.get('__metatable') !== undefined) throw new LuaError('cannot change a protected metatable'); a[0].mt = a[1] || null; return [a[0]]; },
    getmetatable: (a) => { const mt = getmt(a[0]); if (!mt) return [a[0] && a[0].$metatable ? a[0].$metatable : undefined]; const p = mt.get('__metatable'); return [p !== undefined ? p : mt]; },
    assert: (a) => { if (!truthy(a[0])) throw new LuaError(a.length > 1 ? a[1] : 'assertion failed!'); return a; },
    error: (a) => { const v = a[0]; throw new LuaError(v); },
    pcall: Object.assign((a) => drive(PCALL(a)), { ygen: (a) => PCALL(a) }),
    xpcall: Object.assign((a) => drive(XPCALL(a)), { ygen: (a) => XPCALL(a) }),
    unpack: T.get('unpack'), newproxy: () => [new LuaTable()], gcinfo: () => [1024], collectgarbage: () => [0],
    loadstring: (a) => { try { const ast = parse(tostr(a[0]), a[1] || 'loadstring'); return [io.interp.load(ast, 'loadstring')]; } catch (e) { return [undefined, e.value || String(e)]; } },
  }).forEach(([k, v]) => G.set(k, v));
  G.set('_G', G); G.set('_VERSION', 'Luau');
  // bit32
  const u = (x) => x >>> 0;
  G.set('bit32', lib({ band: (a) => ret(u(a.reduce((x, y) => x & y, -1))), bor: (a) => ret(u(a.reduce((x, y) => x | y, 0))), bxor: (a) => ret(u(a.reduce((x, y) => x ^ y, 0))), bnot: (a) => ret(u(~a[0])),
    lshift: (a) => ret(a[1] >= 32 ? 0 : u(a[0] << a[1])), rshift: (a) => ret(a[1] >= 32 ? 0 : u(a[0]) >>> a[1]), arshift: (a) => ret(u(a[0] >> a[1])), btest: (a) => ret(u(a.reduce((x, y) => x & y, -1)) !== 0),
    extract: (a) => ret((u(a[0]) >>> a[1]) & ((2 ** (a[2] || 1)) - 1)), replace: (a) => { const w = a[3] || 1, m = ((2 ** w) - 1) * 2 ** a[2]; return [u((a[0] & ~m) | ((a[1] * 2 ** a[2]) & m))]; },
    lrotate: (a) => ret(u((a[0] << a[1]) | (u(a[0]) >>> (32 - a[1])))), rrotate: (a) => ret(u((u(a[0]) >>> a[1]) | (a[0] << (32 - a[1])))), countlz: (a) => ret(Math.clz32(a[0])), countrz: (a) => { const x = u(a[0]); return [x === 0 ? 32 : 31 - Math.clz32(x & -x)]; } }));
  G.set('utf8', lib({ char: (a) => ret(String.fromCodePoint(...a)), charpattern: '[\0-\x7F\xC2-\xFD][\x80-\xBF]*', len: (a) => ret([...tostr(a[0])].length), codepoint: (a) => { const s = tostr(a[0]); return [s.codePointAt((a[1] || 1) - 1)]; },
    codes: (a) => { const cps = [...tostr(a[0])]; let i = 0, pos = 1; return [() => { if (i >= cps.length) return [undefined]; const c = cps[i++], p = pos; pos += new TextEncoder().encode(c).length; return [p, c.codePointAt(0)]; }]; },
    offset: (a) => ret(a[1]), graphemes: (a) => { const cps = [...tostr(a[0])]; let i = 0; return [() => (i < cps.length ? [++i, i] : [undefined])]; } }));
  const t0 = performance.now();
  G.set('os', lib({ clock: () => ret((performance.now() - t0) / 1000), time: (a) => ret(a[0] instanceof LuaTable ? Math.floor(new Date(a[0].get('year'), (a[0].get('month') || 1) - 1, a[0].get('day') || 1, a[0].get('hour') || 12, a[0].get('min') || 0, a[0].get('sec') || 0).getTime() / 1000) : Math.floor(Date.now() / 1000)),
    date: (a) => { const d = a[1] ? new Date(a[1] * 1000) : new Date(); if (a[0] && tostr(a[0]).includes('*t')) return [LuaTable.from({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), min: d.getMinutes(), sec: d.getSeconds(), wday: d.getDay() + 1, yday: 1, isdst: false })]; return [d.toISOString()]; },
    difftime: (a) => ret(a[0] - (a[1] || 0)) }));
  G.set('debug', lib({ traceback: (a) => ret(a[0] === undefined ? 'stack traceback' : tostr(a[0])), info: () => ret('?'), profilebegin: () => [], profileend: () => [], setmemorycategory: () => [], resetmemorycategory: () => [] }));
  return G;
}
export const isTruthy = truthy;
