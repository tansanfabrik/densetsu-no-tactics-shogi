/*
 * engine.js — 伝説のタクティクス将棋: 本将棋ルールエンジン + 簡易CPU
 * DOM 非依存。ブラウザでは window.ShogiEngine、Node では module.exports。
 *
 * 座標: x = 0..8 (先手から見て左→右。筋 = 9 - x)、y = 0..8 (上→下。段 = y + 1)
 * 先手 (side 0) は下側で y が減る方向へ進む。後手 (side 1) は上側。
 * 盤の駒コード: 先手は正、後手は負。絶対値 1..15
 *   1歩 2香 3桂 4銀 5金 6角 7飛 8玉 9と 10成香 11成桂 12成銀 14馬 15龍
 */
(function (root, factory) {
  var api = factory();
  // Web Worker を blob: URL で作るため、ファクトリのソースを公開する
  api.factorySource = '(' + factory.toString() + ')';
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShogiEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var P = 1, L = 2, N = 3, S = 4, G = 5, B = 6, R = 7, K = 8;
  var TYPE_STR = ['', 'P', 'L', 'N', 'S', 'G', 'B', 'R', 'K', '+P', '+L', '+N', '+S', '', '+B', '+R'];
  var STR_TYPE = {};
  for (var ti = 1; ti < 16; ti++) if (TYPE_STR[ti]) STR_TYPE[TYPE_STR[ti]] = ti;
  var SFEN_CH = { 1: 'p', 2: 'l', 3: 'n', 4: 's', 5: 'g', 6: 'b', 7: 'r', 8: 'k' };
  var CH_SFEN = { p: 1, l: 2, n: 3, s: 4, g: 5, b: 6, r: 7, k: 8 };
  var INITIAL_SFEN = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

  function unpromote(t) { return t > 8 ? t - 8 : t; }
  function promotable(t) { return t >= 1 && t <= 7 && t !== G; }

  // 方向 (先手基準): 0:左上 1:上 2:右上 3:左 4:右 5:左下 6:下 7:右下
  // 後手の実方向は 7 - d
  var DX = [-1, 0, 1, -1, 1, -1, 0, 1];
  var DY = [-1, -1, -1, 0, 0, 1, 1, 1];
  function bits(a) { var m = 0; for (var i = 0; i < a.length; i++) m |= 1 << a[i]; return m; }
  var STEP = new Int32Array(16), SLIDE = new Int32Array(16), ATT1 = new Int32Array(16);
  var GOLDM = bits([0, 1, 2, 3, 4, 6]);
  STEP[P] = bits([1]);
  SLIDE[L] = bits([1]);
  STEP[S] = bits([0, 1, 2, 5, 7]);
  STEP[G] = GOLDM;
  STEP[K] = 255;
  SLIDE[B] = bits([0, 2, 5, 7]);
  SLIDE[R] = bits([1, 3, 4, 6]);
  STEP[9] = STEP[10] = STEP[11] = STEP[12] = GOLDM;
  SLIDE[14] = SLIDE[B]; STEP[14] = bits([1, 3, 4, 6]);
  SLIDE[15] = SLIDE[R]; STEP[15] = bits([0, 2, 5, 7]);
  for (ti = 0; ti < 16; ti++) ATT1[ti] = STEP[ti] | SLIDE[ti];

  var X = new Int8Array(81), Y = new Int8Array(81);
  var NB = new Int16Array(81 * 8);
  var KNT = [new Int16Array(162), new Int16Array(162)];
  (function () {
    for (var sq = 0; sq < 81; sq++) {
      var x = sq % 9, y = (sq / 9) | 0;
      X[sq] = x; Y[sq] = y;
      for (var d = 0; d < 8; d++) {
        var nx = x + DX[d], ny = y + DY[d];
        NB[sq * 8 + d] = (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) ? ny * 9 + nx : -1;
      }
      for (var s = 0; s < 2; s++) {
        var dy = s === 0 ? -2 : 2;
        for (var i = 0; i < 2; i++) {
          var kx = x + (i === 0 ? -1 : 1), ky = y + dy;
          KNT[s][sq * 2 + i] = (kx >= 0 && kx < 9 && ky >= 0 && ky < 9) ? ky * 9 + kx : -1;
        }
      }
    }
  })();

  // ---- Zobrist (固定シード: メインスレッドと Worker で同じ値になる) ----
  var seed = 0x2545F491 | 0;
  function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
  var ZB1 = new Int32Array(32 * 81), ZB2 = new Int32Array(32 * 81);
  var ZH1 = new Int32Array(16 * 20), ZH2 = new Int32Array(16 * 20);
  for (var zi = 0; zi < ZB1.length; zi++) { ZB1[zi] = rnd(); ZB2[zi] = rnd(); }
  for (zi = 0; zi < ZH1.length; zi++) { ZH1[zi] = rnd(); ZH2[zi] = rnd(); }
  var ZS1 = rnd(), ZS2 = rnd();
  function keyOf(h1, h2) { return (h1 >>> 0) * 2097152 + (h2 >>> 11); }

  // ---- 評価値 ----
  var VAL = [0, 100, 310, 360, 500, 560, 820, 960, 0, 540, 540, 540, 550, 0, 1060, 1260];
  var HVAL = [0, 115, 340, 390, 550, 610, 930, 1080];
  var ATKT = [0, 1, 2, 3, 6, 6, 3, 3, 0, 7, 7, 7, 7, 0, 7, 8];
  var DEFT = [0, 0, 0, 0, 5, 7, 0, 0, 0, 2, 2, 2, 2, 0, 3, 1];
  var ATKD = [0, 56, 40, 22, 9, 3, 0, 0, 0];
  var DEFD = [0, 26, 16, 5, 0, 0, 0, 0, 0];

  var MAXM = 1024;
  var MATE = 30000, INF = 32000, MATE_BOUND = 29000;

  function Pos(maxPly) {
    this.maxPly = maxPly || 24;
    this.b = new Int8Array(81);
    this.hand = new Int8Array(17);
    this.side = 0;
    this.king = new Int16Array([-1, -1]);
    this.h1 = 0; this.h2 = 0;
    this.ply = 0;
    var mp = this.maxPly + 2;
    this.uMove = new Int32Array(mp);
    this.uCap = new Int8Array(mp);
    this.uH1 = new Int32Array(mp);
    this.uH2 = new Int32Array(mp);
    this.moves = new Int32Array(mp * MAXM);
  }

  Pos.prototype.computeHash = function () {
    var h1 = 0, h2 = 0, b = this.b;
    this.king[0] = -1; this.king[1] = -1;
    for (var sq = 0; sq < 81; sq++) {
      var c = b[sq];
      if (c) {
        h1 ^= ZB1[(c + 16) * 81 + sq]; h2 ^= ZB2[(c + 16) * 81 + sq];
        if (c === K) this.king[0] = sq; else if (c === -K) this.king[1] = sq;
      }
    }
    for (var s = 0; s < 2; s++) for (var t = 1; t <= 7; t++) {
      var hi = s * 8 + t, n = this.hand[hi];
      h1 ^= ZH1[hi * 20 + n]; h2 ^= ZH2[hi * 20 + n];
    }
    if (this.side) { h1 ^= ZS1; h2 ^= ZS2; }
    this.h1 = h1; this.h2 = h2;
  };

  Pos.prototype.key = function () { return keyOf(this.h1, this.h2); };

  // by 側の駒が sq に利いているか
  Pos.prototype.attacked = function (sq, by) {
    var b = this.b, sign = by === 0 ? 1 : -1;
    for (var d = 0; d < 8; d++) {
      var t = NB[sq * 8 + d];
      if (t < 0) continue;
      var pc = b[t];
      var rd = by === 0 ? 7 - d : d;
      if (pc !== 0) {
        if (pc * sign > 0 && ((ATT1[pc < 0 ? -pc : pc] >> rd) & 1)) return true;
        continue;
      }
      for (;;) {
        t = NB[t * 8 + d];
        if (t < 0) break;
        pc = b[t];
        if (pc !== 0) {
          if (pc * sign > 0 && ((SLIDE[pc < 0 ? -pc : pc] >> rd) & 1)) return true;
          break;
        }
      }
    }
    // 桂: by の桂が sq に跳ぶ元の升 = 相手側の桂の跳び先と同じ形
    var kn = KNT[by ^ 1];
    for (var i = 0; i < 2; i++) {
      var f = kn[sq * 2 + i];
      if (f >= 0 && b[f] === sign * N) return true;
    }
    return false;
  };

  // sq に利いている by 側の駒の升を列挙
  Pos.prototype.attackers = function (sq, by) {
    var res = [], b = this.b, sign = by === 0 ? 1 : -1;
    for (var d = 0; d < 8; d++) {
      var t = NB[sq * 8 + d];
      if (t < 0) continue;
      var pc = b[t];
      var rd = by === 0 ? 7 - d : d;
      if (pc !== 0) {
        if (pc * sign > 0 && ((ATT1[pc < 0 ? -pc : pc] >> rd) & 1)) res.push(t);
        continue;
      }
      for (;;) {
        t = NB[t * 8 + d];
        if (t < 0) break;
        pc = b[t];
        if (pc !== 0) {
          if (pc * sign > 0 && ((SLIDE[pc < 0 ? -pc : pc] >> rd) & 1)) res.push(t);
          break;
        }
      }
    }
    var kn = KNT[by ^ 1];
    for (var i = 0; i < 2; i++) {
      var f = kn[sq * 2 + i];
      if (f >= 0 && b[f] === sign * N) res.push(f);
    }
    return res;
  };

  Pos.prototype.inCheck = function (s) {
    var k = this.king[s];
    return k >= 0 && this.attacked(k, s ^ 1);
  };

  // 指し手コード: to | from<<7 | promote<<14 | dropType<<15
  function enc(from, to, pro, dt) { return to | (from << 7) | (pro ? 16384 : 0) | (dt << 15); }

  Pos.prototype.addMove = function (n, from, to, t, s) {
    var mv = this.moves;
    if (t <= 7 && t !== G) {
      var fy = Y[from], ty = Y[to];
      var inz = s === 0 ? (fy <= 2 || ty <= 2) : (fy >= 6 || ty >= 6);
      if (inz) {
        mv[n++] = to | (from << 7) | 16384;
        var must = (t === P || t === L) ? (s === 0 ? ty === 0 : ty === 8)
          : (t === N ? (s === 0 ? ty <= 1 : ty >= 7) : false);
        if (!must) mv[n++] = to | (from << 7);
        return n;
      }
    }
    mv[n++] = to | (from << 7);
    return n;
  };

  // 疑似合法手を moves[base..] に書き込み、個数を返す
  Pos.prototype.gen = function (base, capsOnly) {
    var b = this.b, s = this.side, sign = s === 0 ? 1 : -1, n = base, mv = this.moves;
    for (var sq = 0; sq < 81; sq++) {
      var pc = b[sq];
      if (pc * sign <= 0) continue;
      var t = pc < 0 ? -pc : pc;
      var st = STEP[t], sl = SLIDE[t], all = st | sl;
      for (var d = 0; d < 8; d++) {
        var bit = 1 << d;
        if (!(all & bit)) continue;
        var rd = s === 0 ? d : 7 - d;
        var to, c;
        if (st & bit) {
          to = NB[sq * 8 + rd];
          if (to >= 0) {
            c = b[to];
            if (c * sign <= 0 && (!capsOnly || c !== 0)) n = this.addMove(n, sq, to, t, s);
          }
        } else {
          to = sq;
          for (;;) {
            to = NB[to * 8 + rd];
            if (to < 0) break;
            c = b[to];
            if (c * sign > 0) break;
            if (!capsOnly || c !== 0) n = this.addMove(n, sq, to, t, s);
            if (c !== 0) break;
          }
        }
      }
      if (t === N) {
        var kn = KNT[s];
        for (var i = 0; i < 2; i++) {
          var kt = kn[sq * 2 + i];
          if (kt >= 0) {
            var kc = b[kt];
            if (kc * sign <= 0 && (!capsOnly || kc !== 0)) n = this.addMove(n, sq, kt, N, s);
          }
        }
      }
    }
    if (!capsOnly) {
      var hb = s * 8, pawnFiles = 0, own = sign * P;
      for (sq = 0; sq < 81; sq++) if (b[sq] === own) pawnFiles |= 1 << X[sq];
      for (var dt = 1; dt <= 7; dt++) {
        if (!this.hand[hb + dt]) continue;
        for (sq = 0; sq < 81; sq++) {
          if (b[sq] !== 0) continue;
          var y = Y[sq];
          if (dt === P || dt === L) { if (s === 0 ? y === 0 : y === 8) continue; }
          else if (dt === N) { if (s === 0 ? y <= 1 : y >= 7) continue; }
          if (dt === P && ((pawnFiles >> X[sq]) & 1)) continue;
          mv[n++] = sq | (dt << 15);
        }
      }
    }
    return n - base;
  };

  Pos.prototype.make = function (m) {
    var p = this.ply, s = this.side, sign = s === 0 ? 1 : -1, b = this.b;
    this.uMove[p] = m; this.uH1[p] = this.h1; this.uH2[p] = this.h2;
    var to = m & 127, from = (m >> 7) & 127, pro = (m >> 14) & 1, dt = m >>> 15;
    var h1 = this.h1, h2 = this.h2, hi, c, code;
    if (dt) {
      hi = s * 8 + dt; c = this.hand[hi];
      h1 ^= ZH1[hi * 20 + c] ^ ZH1[hi * 20 + c - 1];
      h2 ^= ZH2[hi * 20 + c] ^ ZH2[hi * 20 + c - 1];
      this.hand[hi] = c - 1;
      code = sign * dt; b[to] = code;
      h1 ^= ZB1[(code + 16) * 81 + to]; h2 ^= ZB2[(code + 16) * 81 + to];
      this.uCap[p] = 0;
    } else {
      var pc = b[from], cap = b[to];
      this.uCap[p] = cap;
      h1 ^= ZB1[(pc + 16) * 81 + from]; h2 ^= ZB2[(pc + 16) * 81 + from];
      b[from] = 0;
      if (cap) {
        h1 ^= ZB1[(cap + 16) * 81 + to]; h2 ^= ZB2[(cap + 16) * 81 + to];
        var ct = unpromote(cap < 0 ? -cap : cap);
        if (ct <= 7) {
          hi = s * 8 + ct; c = this.hand[hi];
          h1 ^= ZH1[hi * 20 + c] ^ ZH1[hi * 20 + c + 1];
          h2 ^= ZH2[hi * 20 + c] ^ ZH2[hi * 20 + c + 1];
          this.hand[hi] = c + 1;
        } else if (ct === K) {
          this.king[s ^ 1] = -1;
        }
      }
      var np = pro ? pc + sign * 8 : pc;
      b[to] = np;
      h1 ^= ZB1[(np + 16) * 81 + to]; h2 ^= ZB2[(np + 16) * 81 + to];
      if (pc === sign * K) this.king[s] = to;
    }
    this.h1 = h1 ^ ZS1; this.h2 = h2 ^ ZS2;
    this.side = s ^ 1;
    this.ply = p + 1;
  };

  Pos.prototype.unmake = function () {
    var p = --this.ply, m = this.uMove[p];
    var s = this.side ^ 1, sign = s === 0 ? 1 : -1, b = this.b;
    this.side = s;
    this.h1 = this.uH1[p]; this.h2 = this.uH2[p];
    if (m < 0) return; // null move
    var to = m & 127, from = (m >> 7) & 127, pro = (m >> 14) & 1, dt = m >>> 15;
    if (dt) {
      b[to] = 0;
      this.hand[s * 8 + dt]++;
    } else {
      var np = b[to];
      var pc = pro ? np - sign * 8 : np;
      b[from] = pc;
      var cap = this.uCap[p];
      b[to] = cap;
      if (cap) {
        var ct = unpromote(cap < 0 ? -cap : cap);
        if (ct <= 7) this.hand[s * 8 + ct]--;
        else if (ct === K) this.king[s ^ 1] = to;
      }
      if (pc === sign * K) this.king[s] = from;
    }
  };

  Pos.prototype.makeNull = function () {
    var p = this.ply;
    this.uMove[p] = -1; this.uH1[p] = this.h1; this.uH2[p] = this.h2;
    this.h1 ^= ZS1; this.h2 ^= ZS2;
    this.side ^= 1;
    this.ply = p + 1;
  };

  // 打ち歩で王手になっているか (直前の手が m のとき)
  function pawnDropCheck(pos, m, mover) {
    if ((m >>> 15) !== P) return false;
    var ek = pos.king[mover ^ 1], to = m & 127;
    if (ek < 0) return false;
    return mover === 0 ? to === ek + 9 : to === ek - 9;
  }

  // 指して合法なら true (局面は指した後のまま)。非合法なら戻して false
  Pos.prototype.makeLegal = function (m) {
    this.make(m);
    var mover = this.side ^ 1;
    if (this.king[mover] >= 0 && this.attacked(this.king[mover], this.side)) { this.unmake(); return false; }
    if (pawnDropCheck(this, m, mover) && this.ply < this.maxPly - 1) {
      if (!this.hasLegal()) { this.unmake(); return false; } // 打ち歩詰め
    }
    return true;
  };

  Pos.prototype.hasLegal = function () {
    var base = this.ply * MAXM, n = this.gen(base, false), mv = this.moves;
    for (var i = 0; i < n; i++) {
      if (this.makeLegal(mv[base + i])) { this.unmake(); return true; }
    }
    return false;
  };

  Pos.prototype.legalCodes = function () {
    var base = this.ply * MAXM, n = this.gen(base, false), mv = this.moves, out = [];
    for (var i = 0; i < n; i++) {
      var m = mv[base + i];
      if (this.makeLegal(m)) { this.unmake(); out.push(m); }
    }
    return out;
  };

  Pos.prototype.perft = function (depth) {
    if (depth === 0) return 1;
    var base = this.ply * MAXM, n = this.gen(base, false), mv = this.moves, cnt = 0;
    for (var i = 0; i < n; i++) {
      if (this.makeLegal(mv[base + i])) {
        cnt += depth === 1 ? 1 : this.perft(depth - 1);
        this.unmake();
      }
    }
    return cnt;
  };

  Pos.prototype.evaluate = function () {
    var b = this.b, sc = 0;
    var k0 = this.king[0], k1 = this.king[1];
    var k0x = k0 >= 0 ? X[k0] : 4, k0y = k0 >= 0 ? Y[k0] : 8;
    var k1x = k1 >= 0 ? X[k1] : 4, k1y = k1 >= 0 ? Y[k1] : 0;
    for (var sq = 0; sq < 81; sq++) {
      var pc = b[sq];
      if (!pc) continue;
      var x = X[sq], y = Y[sq], t, dE, dO, ax, ay;
      if (pc > 0) {
        t = pc;
        sc += VAL[t];
        if (t === K) { if (y < 6) sc -= (6 - y) * 14; continue; }
        ax = x - k1x; ay = y - k1y; if (ax < 0) ax = -ax; if (ay < 0) ay = -ay; dE = ax > ay ? ax : ay;
        ax = x - k0x; ay = y - k0y; if (ax < 0) ax = -ax; if (ay < 0) ay = -ay; dO = ax > ay ? ax : ay;
        sc += (ATKT[t] * ATKD[dE] + DEFT[t] * DEFD[dO]) >> 3;
        if (t === P) sc += (6 - y) * 2;
      } else {
        t = -pc;
        sc -= VAL[t];
        if (t === K) { if (y > 2) sc += (y - 2) * 14; continue; }
        ax = x - k0x; ay = y - k0y; if (ax < 0) ax = -ax; if (ay < 0) ay = -ay; dE = ax > ay ? ax : ay;
        ax = x - k1x; ay = y - k1y; if (ax < 0) ax = -ax; if (ay < 0) ay = -ay; dO = ax > ay ? ax : ay;
        sc -= (ATKT[t] * ATKD[dE] + DEFT[t] * DEFD[dO]) >> 3;
        if (t === P) sc -= (y - 2) * 2;
      }
    }
    for (var h = 1; h <= 7; h++) sc += HVAL[h] * (this.hand[h] - this.hand[8 + h]);
    return this.side === 0 ? sc : -sc;
  };

  // ---------------- 公開 state ----------------
  function posFromState(state, maxPly) {
    var p = new Pos(maxPly);
    for (var i = 0; i < 81; i++) p.b[i] = state.board[i];
    for (var t = 1; t <= 7; t++) { p.hand[t] = state.hands[0][t] || 0; p.hand[8 + t] = state.hands[1][t] || 0; }
    p.side = state.turn;
    p.computeHash();
    return p;
  }

  function codeToMove(pos, m) {
    var to = m & 127, from = (m >> 7) & 127, pro = !!((m >> 14) & 1), dt = m >>> 15;
    var mv = {
      from: dt ? null : { x: X[from], y: Y[from] },
      to: { x: X[to], y: Y[to] },
      piece: dt ? TYPE_STR[dt] : TYPE_STR[Math.abs(pos.b[from])],
      promote: pro,
      drop: !!dt,
      captured: (!dt && pos.b[to]) ? TYPE_STR[Math.abs(pos.b[to])] : null,
      side: pos.side,
      code: m
    };
    return mv;
  }

  function moveToCode(move) {
    if (move.drop) {
      var dt = STR_TYPE[move.piece];
      return enc(0, move.to.y * 9 + move.to.x, false, unpromote(dt));
    }
    return enc(move.from.y * 9 + move.from.x, move.to.y * 9 + move.to.x, !!move.promote, 0);
  }

  function emptyHands() { return [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]]; }

  function stateFromPos(pos, extra) {
    var board = new Array(81);
    for (var i = 0; i < 81; i++) board[i] = pos.b[i];
    var hands = emptyHands();
    for (var t = 1; t <= 7; t++) { hands[0][t] = pos.hand[t]; hands[1][t] = pos.hand[8 + t]; }
    return {
      board: board, hands: hands, turn: pos.side,
      ply: extra.ply, history: extra.history, checks: extra.checks,
      resigned: extra.resigned === undefined ? null : extra.resigned,
      declared: extra.declared === undefined ? null : extra.declared,
      foul: extra.foul || null,
      lastMove: extra.lastMove || null
    };
  }

  function fromSfen(str) {
    var parts = String(str).trim().split(/\s+/);
    if (parts.length < 3) throw new Error('bad sfen: ' + str);
    var pos = new Pos(24);
    var rows = parts[0].split('/');
    if (rows.length !== 9) throw new Error('bad sfen board');
    for (var y = 0; y < 9; y++) {
      var x = 0, row = rows[y], promo = false;
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (ch === '+') { promo = true; continue; }
        if (ch >= '1' && ch <= '9') { x += ch.charCodeAt(0) - 48; promo = false; continue; }
        var lo = ch.toLowerCase(), t = CH_SFEN[lo];
        if (!t || x > 8) throw new Error('bad sfen piece ' + ch);
        if (promo) { if (!promotable(t)) throw new Error('bad promotion'); t += 8; }
        pos.b[y * 9 + x] = ch === lo ? -t : t;
        x++; promo = false;
      }
      if (x !== 9) throw new Error('bad sfen row ' + row);
    }
    if (parts[1] !== 'b' && parts[1] !== 'w') throw new Error('bad sfen side');
    pos.side = parts[1] === 'b' ? 0 : 1;
    if (parts[2] !== '-') {
      var num = 0, h = parts[2];
      for (i = 0; i < h.length; i++) {
        var c = h[i];
        if (c >= '0' && c <= '9') { num = num * 10 + (c.charCodeAt(0) - 48); continue; }
        var lc = c.toLowerCase(), ht = CH_SFEN[lc];
        if (!ht || ht === K) throw new Error('bad sfen hand');
        pos.hand[(c === lc ? 8 : 0) + ht] += num || 1;
        num = 0;
      }
    }
    var moveNo = parts[3] ? parseInt(parts[3], 10) : 1;
    if (!(moveNo >= 1)) moveNo = 1;
    pos.computeHash();
    return stateFromPos(pos, {
      ply: moveNo - 1, history: [pos.key()], checks: [pos.inCheck(pos.side)], resigned: null
    });
  }

  function toSfen(state) {
    var rows = [];
    for (var y = 0; y < 9; y++) {
      var row = '', empty = 0;
      for (var x = 0; x < 9; x++) {
        var c = state.board[y * 9 + x];
        if (!c) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        var t = c < 0 ? -c : c, s = '';
        if (t > 8) { s = '+'; t -= 8; }
        s += SFEN_CH[t];
        row += c > 0 ? s.toUpperCase() : s;
      }
      if (empty) row += empty;
      rows.push(row);
    }
    var hand = '', order = [R, B, G, S, N, L, P];
    for (var side = 0; side < 2; side++) {
      for (var i = 0; i < order.length; i++) {
        var n = state.hands[side][order[i]];
        if (!n) continue;
        var ch = SFEN_CH[order[i]];
        hand += (n > 1 ? n : '') + (side === 0 ? ch.toUpperCase() : ch);
      }
    }
    return rows.join('/') + ' ' + (state.turn === 0 ? 'b' : 'w') + ' ' + (hand || '-') + ' ' + (state.ply + 1);
  }

  function newGame() { return fromSfen(INITIAL_SFEN); }

  // 投了・入玉宣言・千日手で終わった局面か (詰みは合法手なしで自然に表れる)
  function endedByEvent(state) {
    return state.resigned === 0 || state.resigned === 1 || state.declared === 0 || state.declared === 1 || !!state.foul || !!repetitionResult(state);
  }
  function isOver(state) { return !!result(state); }

  function legalMoves(state) {
    if (endedByEvent(state)) return [];
    var pos = posFromState(state);
    var codes = pos.legalCodes();
    var out = new Array(codes.length);
    for (var i = 0; i < codes.length; i++) out[i] = codeToMove(pos, codes[i]);
    return out;
  }

  function applyMove(state, move) {
    if (endedByEvent(state)) throw new Error('game over');
    var pos = posFromState(state);
    var code = (move && typeof move.code === 'number') ? move.code : moveToCode(move);
    var codes = pos.legalCodes();
    if (codes.indexOf(code) < 0) {
      // code が古い等の場合に備え、フィールドから再計算
      code = moveToCode(move);
      if (codes.indexOf(code) < 0) throw new Error('illegal move');
    }
    var mvObj = codeToMove(pos, code);
    pos.make(code);
    var check = pos.inCheck(pos.side);
    mvObj.check = check;
    return stateFromPos(pos, {
      ply: state.ply + 1,
      history: state.history.concat([pos.key()]),
      checks: state.checks.concat([check]),
      resigned: null,
      declared: null,
      lastMove: mvObj
    });
  }

  // ---- 反則手 (二歩) ----
  // 二歩の歩打ちを「指したもの」として盤に置き、その手番側の反則負けにする。
  // 二歩以外の理由で指せない手 (持ち歩なし・駒がある升・行き所のない升・終局後) は受け付けない
  function applyFoul(state, move) {
    if (endedByEvent(state) || isOver(state)) throw new Error('game over');
    if (!move || !move.drop || move.piece !== 'P') throw new Error('not a foul move');
    if (whyIllegal(state, move) !== 'nifu') throw new Error('not nifu');
    var pos = posFromState(state), s = pos.side, to = move.to.y * 9 + move.to.x;
    var code = enc(0, to, false, P);
    var mvObj = codeToMove(pos, code);
    pos.make(code);
    var check = pos.inCheck(pos.side);
    mvObj.check = check; mvObj.foul = 'nifu';
    return stateFromPos(pos, {
      ply: state.ply + 1, history: state.history.concat([pos.key()]), checks: state.checks.concat([check]),
      resigned: null, declared: null, foul: { side: s, type: 'nifu' }, lastMove: mvObj
    });
  }

  // ---- 入玉宣言 (27点法。持ち時間の条件は扱わない) ----
  // 宣言する側 = 手番側。条件: 玉が敵陣三段目以内 / 敵陣内の自駒(玉を除く)10枚以上 /
  // 敵陣内の自駒+持ち駒の点 (大駒5点・小駒1点) が先手28点以上・後手27点以上 / 王手がかかっていない
  function declarationInfo(state) {
    var side = state.turn, sign = side === 0 ? 1 : -1, b = state.board;
    function inZone(y) { return side === 0 ? y <= 2 : y >= 6; }
    var kingIn = false, count = 0, points = 0;
    for (var sq = 0; sq < 81; sq++) {
      var c = b[sq];
      if (c * sign <= 0) continue;
      var t = c < 0 ? -c : c;
      if (!inZone(Y[sq])) continue;
      if (t === K) { kingIn = true; continue; }
      count++;
      var u = unpromote(t);
      points += (u === B || u === R) ? 5 : 1;
    }
    var h = state.hands[side];
    for (var ht = 1; ht <= 7; ht++) points += (h[ht] || 0) * ((ht === B || ht === R) ? 5 : 1);
    var need = side === 0 ? 28 : 27;
    var checked = isCheck(state, side);
    return { side: side, kingInZone: kingIn, pieces: count, points: points, need: need, inCheck: checked,
      ok: kingIn && count >= 10 && points >= need && !checked };
  }
  function canDeclare(state) {
    if (isOver(state)) return false;
    return declarationInfo(state).ok;
  }
  function declare(state) {
    if (!canDeclare(state)) throw new Error('cannot declare');
    var ns = {};
    for (var k in state) ns[k] = state[k];
    ns.declared = state.turn;
    return ns;
  }

  // sq に by 側の駒が利いているか
  function attackedBy(state, p, by) {
    var pos = posFromState(state);
    return pos.attacked(p.y * 9 + p.x, by);
  }
  // by 側の利きがある升 (81要素の真偽値配列)
  function attackMap(state, by) {
    var pos = posFromState(state), out = new Array(81);
    for (var sq = 0; sq < 81; sq++) out[sq] = pos.attacked(sq, by);
    return out;
  }

  function resign(state, side) {
    if (isOver(state)) throw new Error('game over');
    var s = side === undefined ? state.turn : side;
    var ns = {};
    for (var k in state) ns[k] = state[k];
    ns.resigned = s;
    return ns;
  }

  function isCheck(state, side) {
    var pos = posFromState(state);
    return pos.inCheck(side === undefined ? state.turn : side);
  }

  function checkers(state, side) {
    var pos = posFromState(state);
    var s = side === undefined ? state.turn : side;
    var k = pos.king[s];
    if (k < 0) return [];
    return pos.attackers(k, s ^ 1).map(function (sq) { return { x: X[sq], y: Y[sq] }; });
  }

  function kingSquare(state, side) {
    var target = side === 0 ? K : -K;
    for (var i = 0; i < 81; i++) if (state.board[i] === target) return { x: X[i], y: Y[i] };
    return null;
  }

  // 千日手判定。null / {winner, reason}
  function repetitionResult(state) {
    var h = state.history, n = h.length - 1;
    if (n < 0) return null;
    var key = h[n], cnt = 0, first = -1;
    for (var i = 0; i <= n; i++) if (h[i] === key) { cnt++; if (first < 0) first = i; }
    if (cnt < 4) return null;
    var sAny = false, sAll = true, gAny = false, gAll = true;
    for (i = first + 1; i <= n; i++) {
      var stm = state.turn ^ ((n - i) & 1);
      var mover = stm ^ 1;
      var chk = !!state.checks[i];
      if (mover === 0) { sAny = true; if (!chk) sAll = false; }
      else { gAny = true; if (!chk) gAll = false; }
    }
    if (sAny && sAll) return { winner: 1, reason: 'perpetual', loser: 0 };
    if (gAny && gAll) return { winner: 0, reason: 'perpetual', loser: 1 };
    return { winner: null, reason: 'sennichite' };
  }

  function result(state) {
    if (state.resigned === 0 || state.resigned === 1) return { winner: state.resigned ^ 1, reason: 'resign', loser: state.resigned };
    if (state.declared === 0 || state.declared === 1) return { winner: state.declared, reason: 'declaration', loser: state.declared ^ 1 };
    if (state.foul) return { winner: state.foul.side ^ 1, reason: 'foul', foul: state.foul.type, loser: state.foul.side };
    var rep = repetitionResult(state);
    if (rep) return rep;
    var pos = posFromState(state);
    if (!pos.hasLegal()) {
      return { winner: state.turn ^ 1, reason: pos.inCheck(state.turn) ? 'checkmate' : 'nomoves', loser: state.turn };
    }
    return null;
  }

  // 非合法な手の理由: null(合法) | 'nifu' | 'uchifuzume' | 'deaddrop' | 'selfcheck' | 'occupied' | 'nopiece' | 'unreachable' | 'nohand' | 'gameover'
  function whyIllegal(state, move) {
    if (isOver(state)) return 'gameover';
    var pos = posFromState(state);
    var s = pos.side, sign = s === 0 ? 1 : -1;
    var tx = move.to.x, ty = move.to.y, to = ty * 9 + tx;
    if (move.drop) {
      var dt = unpromote(STR_TYPE[move.piece] || 0);
      if (!dt || dt > 7 || !pos.hand[s * 8 + dt]) return 'nohand';
      if (pos.b[to] !== 0) return 'occupied';
      if ((dt === P || dt === L) && (s === 0 ? ty === 0 : ty === 8)) return 'deaddrop';
      if (dt === N && (s === 0 ? ty <= 1 : ty >= 7)) return 'deaddrop';
      var code = enc(0, to, false, dt);
      pos.make(code);
      var self = pos.king[s] >= 0 && pos.attacked(pos.king[s], s ^ 1);
      if (self) { pos.unmake(); return 'selfcheck'; }
      if (pawnDropCheck(pos, code, s) && !pos.hasLegal()) { pos.unmake(); return 'uchifuzume'; }
      pos.unmake();
      // ほかの禁止条件に当たらないときだけ二歩 (反則手として指せる)
      if (dt === P) {
        for (var y = 0; y < 9; y++) if (pos.b[y * 9 + tx] === sign * P) return 'nifu';
      }
      return null;
    }
    var from = move.from.y * 9 + move.from.x, pc = pos.b[from];
    if (pc * sign <= 0) return 'nopiece';
    var base = pos.ply * MAXM, n = pos.gen(base, false), found = false, legal = false;
    for (var i = 0; i < n; i++) {
      var m = pos.moves[base + i];
      if (((m >> 7) & 127) !== from || (m & 127) !== to || (m >>> 15)) continue;
      found = true;
      if (pos.makeLegal(m)) { pos.unmake(); legal = true; }
    }
    if (!found) return 'unreachable';
    return legal ? null : 'selfcheck';
  }

  // 日本語の棋譜表記 (簡易。右/左などの区別は省く)
  var ZEN = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９'];
  var KAN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var KIF_NAME = { P: '歩', L: '香', N: '桂', S: '銀', G: '金', B: '角', R: '飛', K: '玉', '+P': 'と', '+L': '成香', '+N': '成桂', '+S': '成銀', '+B': '馬', '+R': '龍' };
  function moveToKif(move, prev) {
    var mark = move.side === 0 ? '▲' : '△';
    var same = prev && prev.to && prev.to.x === move.to.x && prev.to.y === move.to.y;
    var dest = same ? '同' : ZEN[9 - move.to.x] + KAN[move.to.y + 1];
    var name = KIF_NAME[move.piece] || '?';
    if (move.piece === 'K') name = move.side === 0 ? '王' : '玉';
    var suf = '';
    if (move.drop) suf = '打';
    else if (move.promote) suf = '成';
    else {
      var t = STR_TYPE[move.piece];
      if (promotable(t)) {
        var inz = move.side === 0 ? (move.from.y <= 2 || move.to.y <= 2) : (move.from.y >= 6 || move.to.y >= 6);
        if (inz) suf = '不成';
      }
    }
    return mark + dest + name + suf;
  }

  function pieceAt(state, x, y) {
    var c = state.board[y * 9 + x];
    if (!c) return null;
    var t = c < 0 ? -c : c;
    return { side: c > 0 ? 0 : 1, type: TYPE_STR[t], base: TYPE_STR[unpromote(t)], promoted: t > 8, code: c };
  }

  // ---------------- 探索 ----------------
  var LEVELS = [
    { name: '弱', maxDepth: 1, time: 350, noise: 150, exactRoot: true, nullMove: false, lmr: false },
    { name: '中', maxDepth: 3, time: 900, noise: 18, exactRoot: false, nullMove: false, lmr: false },
    { name: '強', maxDepth: 32, time: 1500, noise: 0, exactRoot: false, nullMove: true, lmr: true }
  ];
  var TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  var EXACT = 1, LOWER = 2, UPPER = 3;
  var MAXSP = 60, QMAX = 8;
  var sharedTT = null;
  function getTT() {
    if (!sharedTT) {
      sharedTT = {
        k: new Int32Array(TT_SIZE), m: new Int32Array(TT_SIZE), s: new Int16Array(TT_SIZE),
        d: new Int8Array(TT_SIZE), f: new Int8Array(TT_SIZE)
      };
    }
    return sharedTT;
  }
  function nowMs() { return Date.now(); }

  function Searcher(state, level, opts) {
    opts = opts || {};
    var cfg = LEVELS[level === undefined ? 1 : Math.max(0, Math.min(2, level | 0))];
    this.cfg = cfg;
    this.maxDepth = opts.maxDepth || cfg.maxDepth;
    this.timeLimit = opts.timeMs || cfg.time;
    this.random = typeof opts.random === 'function' ? opts.random : Math.random;
    this.state = state;
    this.pos = posFromState(state, MAXSP + QMAX + 16);
    this.tt = getTT();
    this.killers = new Int32Array((MAXSP + 4) * 2);
    this.hist = new Int32Array(88 * 81);
    this.gameKeys = {};
    var h = state.history || [];
    for (var i = 0; i < h.length - 1; i++) this.gameKeys[h[i]] = true;
    this.nodes = 0;
    this.stop = false;
    this.depth = 0;
    this.done = false;
    this.rootBest = 0;
    this.rootScore = 0;
    this.bestMoveCode = 0;
    this.bestScore = 0;
    this.startTime = nowMs();
    this.deadline = this.startTime + this.timeLimit;
    this.order = new Int32Array((MAXSP + QMAX + 16) * MAXM);
    this.rootMoves = endedByEvent(state) ? [] : this.pos.legalCodes();
    this.rootFixed = {};
    if (this.rootMoves.length === 0) { this.done = true; return; }
    // 千日手が成立してしまう手は結果を固定値で扱う
    var counts = {};
    for (i = 0; i < h.length; i++) counts[h[i]] = (counts[h[i]] || 0) + 1;
    var me = this.pos.side;
    for (i = 0; i < this.rootMoves.length; i++) {
      var m = this.rootMoves[i];
      this.pos.make(m);
      var k = this.pos.key();
      this.pos.unmake();
      if ((counts[k] || 0) >= 3) {
        var ns = applyMove(state, codeToMove(this.pos, m));
        var r = result(ns);
        if (r) this.rootFixed[m] = r.winner === null ? 0 : (r.winner === me ? MATE - 1 : -MATE + 1);
      }
    }
    if (this.rootMoves.length === 1) { this.bestMoveCode = this.rootMoves[0]; this.done = true; }
  }

  Searcher.prototype.checkTime = function () {
    if (this.depth > 1 && nowMs() > this.deadline) this.stop = true;
  };

  Searcher.prototype.isRep = function () {
    var pos = this.pos, p = pos.ply, h1 = pos.h1, h2 = pos.h2;
    for (var i = p - 2; i >= 0; i -= 2) {
      if (pos.uH1[i] === h1 && pos.uH2[i] === h2) return true;
    }
    return !!this.gameKeys[keyOf(h1, h2)];
  };

  Searcher.prototype.scoreMoves = function (base, n, ttm, ply) {
    var pos = this.pos, b = pos.b, mv = pos.moves, ord = this.order;
    var k1 = this.killers[ply * 2], k2 = this.killers[ply * 2 + 1];
    for (var i = 0; i < n; i++) {
      var m = mv[base + i], sc;
      if (m === ttm) sc = 1 << 30;
      else {
        var to = m & 127, dt = m >>> 15;
        if (dt) sc = this.hist[(81 + dt) * 81 + to];
        else {
          var from = (m >> 7) & 127, cap = b[to], t = b[from]; if (t < 0) t = -t;
          if (cap) { if (cap < 0) cap = -cap; sc = 2000000 + VAL[cap] * 16 - VAL[t]; }
          else if ((m >> 14) & 1) sc = 1500000 + VAL[t + 8] - VAL[t];
          else if (m === k1) sc = 1200000;
          else if (m === k2) sc = 1199999;
          else sc = this.hist[from * 81 + to];
        }
        if (sc > 1100000 && sc < 1199999 && !(m === k1 || m === k2)) sc = 1100000;
      }
      ord[base + i] = sc;
    }
  };

  Searcher.prototype.pick = function (base, i, n) {
    var mv = this.pos.moves, ord = this.order, bi = i, bs = ord[base + i];
    for (var j = i + 1; j < n; j++) if (ord[base + j] > bs) { bs = ord[base + j]; bi = j; }
    if (bi !== i) {
      var tm = mv[base + i]; mv[base + i] = mv[base + bi]; mv[base + bi] = tm;
      var ts = ord[base + i]; ord[base + i] = ord[base + bi]; ord[base + bi] = ts;
    }
    return mv[base + i];
  };

  function toTT(sc, ply) { return sc > MATE_BOUND ? sc + ply : (sc < -MATE_BOUND ? sc - ply : sc); }
  function fromTT(sc, ply) { return sc > MATE_BOUND ? sc - ply : (sc < -MATE_BOUND ? sc + ply : sc); }

  Searcher.prototype.qs = function (alpha, beta, ply, qd) {
    if ((++this.nodes & 1023) === 0) this.checkTime();
    if (this.stop) return 0;
    var pos = this.pos;
    if (ply >= MAXSP + QMAX) return pos.evaluate();
    var inChk = pos.inCheck(pos.side), best, stand = 0, n;
    var base = pos.ply * MAXM;
    if (!inChk) {
      stand = pos.evaluate();
      if (stand >= beta) return stand;
      if (qd >= QMAX) return stand;
      if (stand > alpha) alpha = stand;
      best = stand;
      n = pos.gen(base, true);
    } else {
      if (qd >= 3) return pos.evaluate();
      best = -INF;
      n = pos.gen(base, false);
    }
    this.scoreMoves(base, n, 0, Math.min(ply, MAXSP));
    var legal = 0;
    for (var i = 0; i < n; i++) {
      var m = this.pick(base, i, n);
      if (!pos.makeLegal(m)) continue;
      legal++;
      var v = -this.qs(-beta, -alpha, ply + 1, qd + 1);
      pos.unmake();
      if (this.stop) return 0;
      if (v > best) {
        best = v;
        if (v > alpha) { alpha = v; if (alpha >= beta) break; }
      }
    }
    if (inChk && legal === 0) return -MATE + ply;
    return best;
  };

  Searcher.prototype.search = function (depth, alpha, beta, ply, allowNull) {
    if ((++this.nodes & 1023) === 0) this.checkTime();
    if (this.stop) return 0;
    var pos = this.pos;
    if (ply > 0 && this.isRep()) return 0;
    if (ply >= MAXSP) return pos.evaluate();
    var inChk = pos.inCheck(pos.side);
    if (inChk && ply < MAXSP - 4) depth++;
    if (depth <= 0) return this.qs(alpha, beta, ply, 0);

    var tt = this.tt, idx = pos.h1 & TT_MASK, ttm = 0;
    if (tt.k[idx] === pos.h2 && tt.f[idx]) {
      ttm = tt.m[idx];
      if (ply > 0 && tt.d[idx] >= depth) {
        var ts = fromTT(tt.s[idx], ply), tf = tt.f[idx];
        if (tf === EXACT) return ts;
        if (tf === LOWER && ts >= beta) return ts;
        if (tf === UPPER && ts <= alpha) return ts;
      }
    }
    if (ply === 0 && this.rootBest) ttm = this.rootBest;

    if (allowNull && this.cfg.nullMove && !inChk && depth >= 3 && ply > 0 && beta < MATE_BOUND && beta > -MATE_BOUND) {
      pos.makeNull();
      var nv = -this.search(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmake();
      if (this.stop) return 0;
      if (nv >= beta) return beta;
    }

    var base = pos.ply * MAXM, n = pos.gen(base, false);
    this.scoreMoves(base, n, ttm, ply);
    var legal = 0, best = -INF, bestM = 0, origAlpha = alpha, b = pos.b;
    var noiseRoot = ply === 0 && this.cfg.exactRoot;
    for (var i = 0; i < n; i++) {
      var m = this.pick(base, i, n);
      var to = m & 127, dt = m >>> 15;
      var quiet = dt !== 0 || (b[to] === 0 && !((m >> 14) & 1));
      if (!pos.makeLegal(m)) continue;
      legal++;
      var v;
      if (ply === 0 && this.rootFixed.hasOwnProperty(m)) {
        v = this.rootFixed[m];
      } else if (noiseRoot) {
        v = -this.search(depth - 1, -INF, INF, ply + 1, true);
      } else if (legal === 1) {
        v = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
      } else {
        var red = (this.cfg.lmr && depth >= 3 && legal > 4 && quiet && !inChk && ply > 0) ? 1 : 0;
        v = -this.search(depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (!this.stop && v > alpha && (red || v < beta)) v = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (this.stop) return 0;
      if (noiseRoot && v > -MATE_BOUND && v < MATE_BOUND) v += Math.round((this.random() * 2 - 1) * this.cfg.noise);
      if (v > best) {
        best = v; bestM = m;
        if (ply === 0) { this.rootBest = m; this.rootScore = v; }
        if (v > alpha) {
          alpha = v;
          if (alpha >= beta) {
            if (quiet && ply < MAXSP) {
              if (this.killers[ply * 2] !== m) { this.killers[ply * 2 + 1] = this.killers[ply * 2]; this.killers[ply * 2] = m; }
              var hi = dt ? (81 + dt) * 81 + to : ((m >> 7) & 127) * 81 + to;
              var hv = this.hist[hi] + depth * depth;
              this.hist[hi] = hv > 1000000 ? 1000000 : hv;
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return -MATE + ply;
    if (!noiseRoot) {
      tt.k[idx] = pos.h2; tt.m[idx] = bestM; tt.s[idx] = toTT(best, ply);
      tt.d[idx] = depth > 127 ? 127 : depth;
      tt.f[idx] = best <= origAlpha ? UPPER : (best >= beta ? LOWER : EXACT);
    }
    return best;
  };

  // 協調的な探索: 一定時間 (sliceEnd) を過ぎたら yield して制御を返す。
  // 時間の確認は searchG と qsG で同じノード数カウンタを使う
  Searcher.prototype.tick = function () {
    if ((++this.nodes & 31) !== 0) return false;
    this.checkTime();
    return !this.stop && nowMs() > this.sliceEnd;
  };
  Searcher.prototype.qsG = function* (alpha, beta, ply, qd) {
    if (this.tick()) yield 0;
    if (this.stop) return 0;
    var pos = this.pos;
    if (ply >= MAXSP + QMAX) return pos.evaluate();
    var inChk = pos.inCheck(pos.side), best, stand = 0, n;
    var base = pos.ply * MAXM;
    if (!inChk) {
      stand = pos.evaluate();
      if (stand >= beta) return stand;
      if (qd >= QMAX) return stand;
      if (stand > alpha) alpha = stand;
      best = stand;
      n = pos.gen(base, true);
    } else {
      if (qd >= 3) return pos.evaluate();
      best = -INF;
      n = pos.gen(base, false);
    }
    this.scoreMoves(base, n, 0, Math.min(ply, MAXSP));
    var legal = 0;
    for (var i = 0; i < n; i++) {
      var m = this.pick(base, i, n);
      if (!pos.makeLegal(m)) continue;
      legal++;
      var v = -(yield* this.qsG(-beta, -alpha, ply + 1, qd + 1));
      pos.unmake();
      if (this.stop) return 0;
      if (v > best) {
        best = v;
        if (v > alpha) { alpha = v; if (alpha >= beta) break; }
      }
    }
    if (inChk && legal === 0) return -MATE + ply;
    return best;
  };
  Searcher.prototype.searchG = function* (depth, alpha, beta, ply, allowNull) {
    if (this.tick()) yield 0;
    if (this.stop) return 0;
    var pos = this.pos;
    if (ply > 0 && this.isRep()) return 0;
    if (ply >= MAXSP) return pos.evaluate();
    var inChk = pos.inCheck(pos.side);
    if (inChk && ply < MAXSP - 4) depth++;
    if (depth <= 0) return yield* this.qsG(alpha, beta, ply, 0);
    var tt = this.tt, idx = pos.h1 & TT_MASK, ttm = 0;
    if (tt.k[idx] === pos.h2 && tt.f[idx]) {
      ttm = tt.m[idx];
      if (ply > 0 && tt.d[idx] >= depth) {
        var ts = fromTT(tt.s[idx], ply), tf = tt.f[idx];
        if (tf === EXACT) return ts;
        if (tf === LOWER && ts >= beta) return ts;
        if (tf === UPPER && ts <= alpha) return ts;
      }
    }
    if (ply === 0 && this.rootBest) ttm = this.rootBest;
    if (allowNull && this.cfg.nullMove && !inChk && depth >= 3 && ply > 0 && beta < MATE_BOUND && beta > -MATE_BOUND) {
      pos.makeNull();
      var nv = -(yield* this.searchG(depth - 3, -beta, -beta + 1, ply + 1, false));
      pos.unmake();
      if (this.stop) return 0;
      if (nv >= beta) return beta;
    }
    var base = pos.ply * MAXM, n = pos.gen(base, false);
    this.scoreMoves(base, n, ttm, ply);
    var legal = 0, best = -INF, bestM = 0, origAlpha = alpha, b = pos.b;
    var noiseRoot = ply === 0 && this.cfg.exactRoot;
    for (var i = 0; i < n; i++) {
      var m = this.pick(base, i, n);
      var to = m & 127, dt = m >>> 15;
      var quiet = dt !== 0 || (b[to] === 0 && !((m >> 14) & 1));
      if (!pos.makeLegal(m)) continue;
      legal++;
      var v;
      if (ply === 0 && this.rootFixed.hasOwnProperty(m)) v = this.rootFixed[m];
      else if (noiseRoot) v = -(yield* this.searchG(depth - 1, -INF, INF, ply + 1, true));
      else if (legal === 1) v = -(yield* this.searchG(depth - 1, -beta, -alpha, ply + 1, true));
      else {
        var red = (this.cfg.lmr && depth >= 3 && legal > 4 && quiet && !inChk && ply > 0) ? 1 : 0;
        v = -(yield* this.searchG(depth - 1 - red, -alpha - 1, -alpha, ply + 1, true));
        if (!this.stop && v > alpha && (red || v < beta)) v = -(yield* this.searchG(depth - 1, -beta, -alpha, ply + 1, true));
      }
      pos.unmake();
      if (this.stop) return 0;
      if (noiseRoot && v > -MATE_BOUND && v < MATE_BOUND) v += Math.round((this.random() * 2 - 1) * this.cfg.noise);
      if (v > best) {
        best = v; bestM = m;
        if (ply === 0) { this.rootBest = m; this.rootScore = v; }
        if (v > alpha) {
          alpha = v;
          if (alpha >= beta) {
            if (quiet && ply < MAXSP) {
              if (this.killers[ply * 2] !== m) { this.killers[ply * 2 + 1] = this.killers[ply * 2]; this.killers[ply * 2] = m; }
              var hi = dt ? (81 + dt) * 81 + to : ((m >> 7) & 127) * 81 + to;
              var hv = this.hist[hi] + depth * depth;
              this.hist[hi] = hv > 1000000 ? 1000000 : hv;
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return -MATE + ply;
    if (!noiseRoot) {
      tt.k[idx] = pos.h2; tt.m[idx] = bestM; tt.s[idx] = toTT(best, ply);
      tt.d[idx] = depth > 127 ? 127 : depth;
      tt.f[idx] = best <= origAlpha ? UPPER : (best >= beta ? LOWER : EXACT);
    }
    return best;
  };

  Searcher.prototype.afterIteration = function (d, sc) {
    if (!this.stop || !this.bestMoveCode) {
      if (this.rootBest) { this.bestMoveCode = this.rootBest; this.bestScore = this.stop ? this.rootScore : sc; }
    } else if (this.rootBest) {
      this.bestMoveCode = this.rootBest; this.bestScore = this.rootScore;
    }
    if (this.stop || d >= this.maxDepth || nowMs() > this.deadline ||
        Math.abs(this.bestScore) > MATE_BOUND) this.done = true;
    if (this.cfg.exactRoot) this.rootBest = 0;
  };
  Searcher.prototype.run = function* () {
    while (!this.done) {
      var d = ++this.depth;
      this.stop = false;
      var sc = yield* this.searchG(d, -INF, INF, 0, false);
      this.afterIteration(d, sc);
    }
  };
  // 分割実行: budgetMs (既定16ms) だけ探索して制御を返す。終わったら true
  Searcher.prototype.step = function (budgetMs) {
    if (this.done) return true;
    if (!this.iter) this.iter = this.run();
    this.sliceEnd = nowMs() + (budgetMs > 0 ? budgetMs : 16);
    var r = this.iter.next();
    if (r.done) this.done = true;
    return this.done;
  };

  // 反復深化を1段だけ進める (同期版。Worker / Node 用)
  Searcher.prototype.iterate = function () {
    if (this.done) return true;
    var d = ++this.depth;
    this.stop = false;
    var sc = this.search(d, -INF, INF, 0, false);
    if (!this.stop || !this.bestMoveCode) {
      if (this.rootBest) { this.bestMoveCode = this.rootBest; this.bestScore = this.stop ? this.rootScore : sc; }
    } else if (this.rootBest) {
      this.bestMoveCode = this.rootBest; this.bestScore = this.rootScore;
    }
    if (this.stop || d >= this.maxDepth || nowMs() > this.deadline ||
        Math.abs(this.bestScore) > MATE_BOUND) this.done = true;
    if (this.cfg.exactRoot) this.rootBest = 0; // 揺らぎ用: 毎回並べ直す
    return this.done;
  };

  Searcher.prototype.result = function () {
    if (!this.rootMoves.length) return null;
    var m = this.bestMoveCode || this.rootMoves[0];
    if (!m) return null;
    var mv = codeToMove(this.pos, m);
    mv.score = this.bestScore;
    mv.depth = this.depth;
    mv.nodes = this.nodes;
    return mv;
  };

  function createSearch(state, level, opts) { return new Searcher(state, level, opts); }

  function bestMove(state, level, opts) {
    if (isOver(state)) return null;
    var s = new Searcher(state, level, opts);
    while (!s.iterate()) { /* iterate */ }
    return s.result();
  }

  function perft(state, depth) {
    var pos = posFromState(state, depth + 16);
    return pos.perft(depth);
  }

  return {
    INITIAL_SFEN: INITIAL_SFEN,
    TYPES: TYPE_STR.slice(),
    LEVELS: LEVELS.map(function (l) { return l.name; }),
    newGame: newGame,
    fromSfen: fromSfen,
    toSfen: toSfen,
    legalMoves: legalMoves,
    applyMove: applyMove,
    isCheck: isCheck,
    checkers: checkers,
    kingSquare: kingSquare,
    result: result,
    isOver: isOver,
    resign: resign,
    canDeclare: canDeclare,
    applyFoul: applyFoul,
    declare: declare,
    declarationInfo: declarationInfo,
    attackedBy: attackedBy,
    attackMap: attackMap,
    whyIllegal: whyIllegal,
    bestMove: bestMove,
    createSearch: createSearch,
    perft: perft,
    pieceAt: pieceAt,
    moveToKif: moveToKif,
    unpromoteType: function (t) { return TYPE_STR[unpromote(STR_TYPE[t] || 0)] || t; },
    promoteType: function (t) { var n = STR_TYPE[t]; return promotable(n) ? TYPE_STR[n + 8] : t; }
  };
});
