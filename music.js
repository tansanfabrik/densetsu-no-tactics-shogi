/*
 * music.js — 形勢に合わせた BGM (57章)。曲はすべてこのゲームのための書き下ろし (矩形波・三角波・ノイズで鳴らす SFC 風)
 * ここには音を鳴らさない部分だけを置く (node でテストできる):
 *   - 曲データ (小節ごとの音符の並び) と、その読み取り
 *   - 形勢の判定 (しきい値・2手番続いたときだけ切り替え・戻りのしきい値)
 *   - 音符の予約 (先読み)。実際に鳴らす関数は外から渡す (index.html の WebAudio)
 * 記法: 1小節 = 8刻み (8分音符)。音は「音名+オクターブ*長さ」(例: "E4*2")、休みは "r"、打楽器は k(大太鼓) s(小太鼓) h(鈴)
 */
(function (root, factory) {
  var M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.ShogiMusic = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var STEPS_PER_BAR = 8;
  var NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  // "C#4" → 61 (C4 = 60)
  function midiOf(tok) {
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
    if (!m) return null;
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  // 1声部 (小節の配列) → [{step, len, midi | drum}] と全体の刻み数
  function parseVoice(bars, drum) {
    var out = [], t = 0, bad = [];
    bars.forEach(function (bar, bi) {
      var start = t;
      String(bar).trim().split(/\s+/).forEach(function (tk) {
        if (!tk) return;
        var p = tk.split('*'), len = p[1] ? +p[1] : 1, n = p[0];
        if (!(len > 0)) { bad.push(bi + ':' + tk); return; }
        if (n !== 'r') {
          if (drum) { if ('ksh'.indexOf(n) < 0) bad.push(bi + ':' + tk); else out.push({ step: t, len: len, drum: n }); }
          else { var mi = midiOf(n); if (mi == null) bad.push(bi + ':' + tk); else out.push({ step: t, len: len, midi: mi }); }
        }
        t += len;
      });
      if (t - start !== STEPS_PER_BAR) bad.push('小節' + (bi + 1) + 'の長さ ' + (t - start));
    });
    return { events: out, steps: t, bad: bad };
  }
  // 和音の名前から、低音の型 (1小節) を作る
  function bassBars(chords, pattern) {
    var ROOT = { Dm: ['D2', 'A2'], Bb: ['Bb1', 'F2'], C: ['C2', 'G2'], A: ['A1', 'E2'], F: ['F2', 'C3'], G: ['G2', 'D3'], Em: ['E2', 'B2'], Am: ['A1', 'E2'], B: ['B1', 'F#2'], D: ['D2', 'A2'] };
    return chords.map(function (c) { var r = ROOT[c]; return pattern.replace(/R/g, r[0]).replace(/V/g, r[1]).replace(/O/g, r[0].replace(/\d$/, function (d) { return String(+d + 1); })); });
  }
  function rep(arr, n) { var o = []; for (var i = 0; i < n; i++) o = o.concat(arr); return o; }

  // ---------------- 曲 ----------------
  // voices: [{wave: 'square'|'triangle'|'noise', vol, bars}]。どの声部も同じ小節数 (ループの長さ)
  var SONGS = {
    // 序章: 静かで重い。低い持続音に、ゆっくりした旋律
    prologue: { bpm: 70, voices: [
      { wave: 'triangle', vol: 0.16, bars: ['A2*8', 'A2*8', 'F2*8', 'F2*8', 'C3*8', 'C3*8', 'G2*8', 'G2*8', 'A2*8', 'A2*8', 'F2*8', 'F2*8', 'D3*8', 'D3*8', 'E2*8', 'E2*8'] },
      { wave: 'square', vol: 0.035, bars: ['r*4 E4*2 D4*2', 'C4*4 A3*4', 'r*2 C4*2 D4*2 E4*2', 'F4*6 E4*2', 'G4*4 E4*4', 'D4*2 C4*2 D4*4', 'B3*4 D4*2 G4*2', 'E4*8',
        'r*4 A4*2 G4*2', 'E4*4 C4*4', 'D4*2 E4*2 F4*4', 'A4*4 G4*2 F4*2', 'F4*4 D4*2 E4*2', 'F4*2 E4*2 D4*4', 'E4*4 G#3*4', 'A3*8'] },
      { wave: 'noise', vol: 0.05, bars: rep(['k*8', 'r*8'], 8) }
    ] },
    // 互角: 中くらいの速さの行進。緊張感はあるが落ち着いている
    even: { bpm: 108, voices: [
      { wave: 'triangle', vol: 0.18, bars: bassBars(['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A', 'F', 'F', 'C', 'C', 'Bb', 'Bb', 'A', 'A'], 'R*2 V*2 R*2 V*2') },
      { wave: 'square', vol: 0.04, bars: ['D4*2 r D4 F4*2 A4*2', 'G4*2 F4 E4 D4*4', 'F4*2 r F4 Bb4*2 A4*2', 'G4*3 F4 E4*4', 'D4*2 r D4 F4*2 A4*2', 'D5*2 C5 A4 G4*4', 'F4*2 G4*2 A4*2 Bb4*2', 'A4*6 r*2',
        'C5*2 r C5 A4*2 F4*2', 'C5*2 Bb4 A4 G4*4', 'G4*2 r G4 E4*2 C4*2', 'E4*2 F4 G4 E4*4', 'D4*2 F4*2 Bb4*2 A4*2', 'G4*2 F4*2 D4*4', 'E4*2 F4*2 G4*2 E4*2', 'A4*4 C#5*4'] },
      { wave: 'noise', vol: 0.06, bars: rep(['k r s r k k s r'], 16) }
    ] },
    // 優勢: 明るく力強い長調の行進。少し速い
    ahead: { bpm: 126, voices: [
      { wave: 'triangle', vol: 0.18, bars: bassBars(['G', 'G', 'C', 'D', 'G', 'G', 'C', 'D', 'Em', 'Em', 'C', 'C', 'G', 'D', 'G', 'G'], 'R*2 V*2 R*2 V*2') },
      { wave: 'square', vol: 0.042, bars: ['G4*2 B4*2 D5*3 B4', 'C5*2 B4 A4 G4*4', 'E5*2 D5*2 C5*2 E5*2', 'D5*6 r*2', 'G4*2 B4*2 D5*3 G5', 'F#5*2 E5 D5 B4*4', 'C5*2 E5*2 G5*2 E5*2', 'D5*4 A4*4',
        'B4*2 G4*2 E4*2 G4*2', 'B4*3 C5 B4*4', 'C5*2 E5*2 G5*2 E5*2', 'D5*4 r*2 D5 E5', 'D5*2 B4*2 G4*2 B4*2', 'A4*2 F#4*2 A4*2 D5*2', 'G5*4 D5*2 B4*2', 'G4*6 r*2'] },
      { wave: 'noise', vol: 0.06, bars: rep(['k h s h k k s h'], 16) }
    ] },
    // 劣勢: 短調で張りつめた曲。低音が刻む
    behind: { bpm: 116, voices: [
      { wave: 'triangle', vol: 0.2, bars: bassBars(['Em', 'Em', 'C', 'C', 'Am', 'Am', 'B', 'B', 'Em', 'Em', 'C', 'C', 'Am', 'B', 'Em', 'Em'], 'R R O R R O R O') },
      { wave: 'square', vol: 0.038, bars: ['r*2 E4 F#4 G4*2 F#4 E4', 'B4*4 r*2 A4 G4', 'E4*2 G4*2 C5*2 B4 A4', 'G4*6 r*2', 'A4*2 C5*2 E5*2 D5 C5', 'B4*4 r*2 C5 B4', 'A4*2 F#4*2 D#4*2 F#4*2', 'B3*6 r*2',
        'r*2 E5 D5 B4*2 A4 G4', 'F#4*4 r*2 G4 A4', 'G4*2 E4*2 C5*2 B4 A4', 'G4*4 F#4*2 E4*2', 'A4*2 C5*2 E5*2 C5*2', 'D#5*4 B4*4', 'E5*2 D5 B4 G4*2 F#4*2', 'E4*6 r*2'] },
      { wave: 'noise', vol: 0.055, bars: rep(['k r h r s r h k'], 16) }
    ] },
    // 決戦: 速く激しい。太鼓を強く
    climax: { bpm: 152, voices: [
      { wave: 'triangle', vol: 0.2, bars: bassBars(['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A', 'Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A', 'Bb', 'Bb', 'C', 'C', 'Dm', 'Dm', 'A', 'A'], 'R O R O R O R O') },
      { wave: 'square', vol: 0.042, bars: rep(['D5*2 A4*2 D5 E5 F5*2', 'E5*2 D5*2 A4*4', 'Bb4*2 D5*2 F5*2 D5*2', 'E5*2 G5*2 E5*2 C5*2', 'D5*2 A4*2 D5 E5 F5*2', 'G5*2 F5*2 E5*2 D5*2', 'D5*2 Bb4*2 G4*2 Bb4*2', 'A4*4 C#5*4'], 2).concat(
        ['F5*2 D5*2 Bb4*2 D5*2', 'F5*3 G5 F5*2 D5*2', 'E5*2 C5*2 G4*2 C5*2', 'E5*3 F5 G5*4', 'A5*2 F5*2 D5*2 F5*2', 'A5*4 G5*2 F5*2', 'E5*2 C#5*2 A4*2 C#5*2', 'E5*4 A4*4']) },
      { wave: 'noise', vol: 0.1, bars: rep(['k h s h k k s s'], 24) }
    ] },
    // 結末: 勝ち
    end_win: { bpm: 96, voices: [
      { wave: 'triangle', vol: 0.16, bars: bassBars(['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'G', 'C', 'F', 'G', 'Am', 'F', 'G', 'C', 'C'], 'O*4 V*4') },
      { wave: 'square', vol: 0.04, bars: ['E4*2 G4*2 C5*4', 'A4*2 C5*2 F5*4', 'D5*2 B4*2 G4*4', 'E5*6 r*2', 'C5*2 E5*2 A5*4', 'F5*2 E5*2 C5*4', 'D5*3 E5 D5*2 B4*2', 'G4*6 r*2',
        'E4*2 G4*2 C5*2 E5*2', 'F5*2 E5*2 C5*2 A4*2', 'B4*2 D5*2 G5*4', 'E5*2 C5*2 A4*4', 'F4*2 A4*2 C5*2 F5*2', 'E5*2 D5*2 B4*2 G4*2', 'C5*8', 'r*8'] },
      { wave: 'noise', vol: 0.045, bars: rep(['k r h r s r h r'], 16) }
    ] },
    // 結末: 負け
    end_lose: { bpm: 66, voices: [
      { wave: 'triangle', vol: 0.17, bars: ['A2*8', 'A2*8', 'D2*8', 'D2*8', 'F2*8', 'F2*8', 'E2*8', 'E2*8', 'A2*8', 'D2*8', 'E2*8', 'A2*8'] },
      { wave: 'square', vol: 0.034, bars: ['E4*4 C4*2 B3*2', 'A3*8', 'D4*4 F4*2 E4*2', 'D4*6 r*2', 'C4*4 A3*2 C4*2', 'F4*6 E4*2', 'E4*4 D4*2 B3*2', 'G#3*6 r*2', 'A3*2 C4*2 E4*4', 'F4*4 D4*4', 'B3*4 G#3*4', 'A3*8'] },
      { wave: 'noise', vol: 0.04, bars: rep(['k*8'], 12) }
    ] },
    // 結末: 和 (引き分け・和議)
    end_draw: { bpm: 84, voices: [
      { wave: 'triangle', vol: 0.15, bars: bassBars(['F', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'C', 'F', 'Bb', 'F', 'C', 'Dm', 'C', 'F', 'F'], 'O*4 V*4') },
      { wave: 'square', vol: 0.034, bars: ['C5*4 A4*2 G4*2', 'F4*4 D4*4', 'F4*2 G4*2 A4*4', 'G4*6 r*2', 'A4*2 C5*2 D5*4', 'C5*2 A4*2 F4*4', 'G4*3 A4 G4*2 F4*2', 'D4*6 r*2',
        'C5*4 D5*2 C5*2', 'A4*4 F4*4', 'G4*2 A4*2 C5*4', 'D5*6 r*2', 'C5*2 A4*2 G4*2 F4*2', 'G4*4 E4*4', 'F4*8', 'r*8'] },
      { wave: 'noise', vol: 0.035, bars: rep(['h*4 h*4'], 16) }
    ] }
  };
  // 曲の読み取り結果 (ループ全体の音符を刻み順に)
  var CACHE = {};
  function song(name) {
    if (CACHE[name]) return CACHE[name];
    var s = SONGS[name]; if (!s) return null;
    var evs = [], steps = -1, bad = [];
    s.voices.forEach(function (v, vi) {
      var p = parseVoice(v.bars, v.wave === 'noise');
      p.bad.forEach(function (b) { bad.push('声部' + vi + ' ' + b); });
      if (steps < 0) steps = p.steps; else if (steps !== p.steps) bad.push('声部' + vi + ' の長さ ' + p.steps + ' ≠ ' + steps);
      p.events.forEach(function (e) { e.voice = vi; e.wave = v.wave; e.vol = v.vol; evs.push(e); });
    });
    evs.sort(function (a, b) { return a.step - b.step || a.voice - b.voice; });
    var stepSec = 60 / s.bpm / 2;
    return (CACHE[name] = { name: name, bpm: s.bpm, stepSec: stepSec, steps: steps, seconds: steps * stepSec, events: evs, bad: bad });
  }

  // ---------------- 形勢の判定 ----------------
  // info = {score: プレイヤー側から見た評価値, checkStreak: 同じ側の王手が続いた手番数, mate: どちらかの詰みを読み切った}
  var MOOD = { up: 600, down: -600, upBack: 450, downBack: -450, checks: 2, persist: 2 };
  function newMood() { return { mood: 'even', cand: null, count: 0 }; }
  function rawMood(cur, info) {
    if (info.mate || (info.checkStreak || 0) >= MOOD.checks) return 'climax';
    var s = +info.score || 0;
    if (cur === 'ahead') return s >= MOOD.upBack ? 'ahead' : (s <= MOOD.down ? 'behind' : 'even');
    if (cur === 'behind') return s <= MOOD.downBack ? 'behind' : (s >= MOOD.up ? 'ahead' : 'even');
    return s >= MOOD.up ? 'ahead' : (s <= MOOD.down ? 'behind' : 'even');
  }
  // 1手番ぶん進める。同じ判定が2手番続いたときだけ切り替える
  function moodStep(st, info) {
    st = st ? { mood: st.mood, cand: st.cand, count: st.count } : newMood();
    var r = rawMood(st.mood, info);
    if (r === st.mood) { st.cand = null; st.count = 0; return st; }
    if (st.cand === r) st.count++; else { st.cand = r; st.count = 1; }
    if (st.count >= MOOD.persist) { st.mood = r; st.cand = null; st.count = 0; }
    return st;
  }
  // 局面の並びから、同じ側の王手が何手番続いているか (直近の手から数える)
  function checkStreak(positions) {
    var best = 0;
    for (var side = 0; side < 2; side++) {
      var n = 0;
      for (var i = positions.length - 1; i >= 1; i--) {
        var lm = positions[i].lastMove; if (!lm || positions[i].ply <= positions[i - 1].ply) break;
        if (lm.side !== side) continue;
        if (lm.check) n++; else break;
      }
      best = Math.max(best, n);
    }
    return best;
  }
  // 結末の曲: 和の道・引き分け → 和、勝ち・負け
  function endingSong(outcome, path) {
    if (outcome === 'draw' || path === 'harmony') return 'end_draw';
    return outcome === 'lose' ? 'end_lose' : 'end_win';
  }

  // ---------------- 音符の予約 (先読み) ----------------
  // out(ev, when, track): 1音を鳴らす (外から渡す)。enabled(): 音楽が「あり」か
  function Scheduler(out, enabled) { this.out = out; this.enabled = enabled || function () { return true; }; this.tracks = []; this.count = 0; }
  // 曲を時刻 at から鳴らし始める。返り値: 曲の track
  Scheduler.prototype.start = function (name, at, extra) {
    var s = song(name); if (!s || !s.events.length) return null;
    var tr = { name: name, song: s, t0: at, i: 0, loop: 0, ending: false, extra: extra || null };
    this.tracks.push(tr);
    return tr;
  };
  Scheduler.prototype.stop = function (tr) { this.tracks = this.tracks.filter(function (t) { return t !== tr; }); };
  // now から now + ahead 秒までの音を予約する。遅れた音 (画面が隠れていた間など) は鳴らさずに飛ばす。返り値: 予約した数
  Scheduler.prototype.tick = function (now, ahead) {
    if (!this.enabled()) return 0;
    var n = 0, self = this;
    this.tracks.forEach(function (tr) {
      var s = tr.song, guard = 0;
      for (;;) {
        var ev = s.events[tr.i], when = tr.t0 + (tr.loop * s.steps + ev.step) * s.stepSec;
        if (when >= now + ahead || guard++ > 2000) break;
        if (when >= now - 0.03) { self.out(ev, when, tr, s.stepSec); n++; }
        tr.i++; if (tr.i >= s.events.length) { tr.i = 0; tr.loop++; }
      }
    });
    this.count += n;
    return n;
  };
  // 一時停止のあと: 止まっていた時間だけ曲の時刻をずらす (続きから鳴らす)
  Scheduler.prototype.shift = function (sec) { this.tracks.forEach(function (tr) { tr.t0 += sec; }); };

  return { SONGS: SONGS, song: song, parseVoice: parseVoice, midiOf: midiOf, hz: hz, MOOD: MOOD, newMood: newMood, rawMood: rawMood, moodStep: moodStep, checkStreak: checkStreak, endingSong: endingSong, Scheduler: Scheduler, STEPS_PER_BAR: STEPS_PER_BAR };
});
