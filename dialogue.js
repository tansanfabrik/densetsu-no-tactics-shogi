/*
 * dialogue.js — 伝説のタクティクス将棋 のセリフデータと選択ロジック
 * ブラウザでは window.ShogiDialogue、Node では module.exports。
 * 先手 = 暁の解放軍(王将・暁王レオニス)、後手 = 黄昏の帝国(玉将・黄昏帝ヴァルドラ)。
 * 演出専用。ルールには一切関与しない。
 */
(function (root, factory) {
  var api = factory();
  // 追加の台詞ファイル dialogue_more.js (無くても動く)
  var more = null;
  try {
    if (typeof module === 'object' && module.exports && typeof require === 'function') more = require('./dialogue_more.js');
    else if (root && root.ShogiDialogueMore) more = root.ShogiDialogueMore;
  } catch (e) { more = null; }
  if (more) { try { api.mergeMore(more); } catch (e) { api.MORE_REPORT.error = String(e && e.message || e); } }
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShogiDialogue = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 駒の基本情報 ----
  var KIND_OF = { K: 'K', R: 'R', '+R': 'DR', B: 'B', '+B': 'HO', G: 'G', S: 'S', N: 'N', L: 'L', P: 'P', '+P': 'TO', '+S': 'NS', '+N': 'NN', '+L': 'NL' };
  var NAME = { R: '飛車', DR: '龍王', B: '角行', HO: '龍馬', G: '金将', S: '銀将', N: '桂馬', L: '香車', P: '歩兵', TO: 'と金', NS: '成銀', NN: '成桂', NL: '成香' };
  var CHAR = { R: '飛', DR: '龍', B: '角', HO: '馬', G: '金', S: '銀', N: '桂', L: '香', P: '歩', TO: 'と', NS: '全', NN: '圭', NL: '杏' };
  // 情報窓に小さく出す二つ名 (20章)
  var CLASS = {
    R: '猛将', DR: '龍王', B: '術師', HO: '天馬術師', G: '近衛', S: '忍び',
    N: '騎兵', L: '槍兵', P: '新兵', TO: '古参兵', NS: '上忍', NN: '重騎兵', NL: '重槍兵'
  };
  var TITLE = '伝説のタクティクス将棋';
  var ARMY = ['暁の解放軍', '黄昏の帝国'];
  var LEADER = ['暁王', '黄昏帝'];            // セリフ・名札での呼び名
  var LEADER_FULL = ['暁王レオニス', '黄昏帝ヴァルドラ']; // 序章・結末の要所だけで使う
  var SIDE = ['先手', '後手'];

  function kindOf(type) { return KIND_OF[type] || 'P'; }
  // 表示用のレベル (ルールには関与しない)。成駒は Lv.2
  function levelOf(type) { return type && type.charAt(0) === '+' ? 2 : 1; }
  function isPromoted(type) { return type && type.charAt(0) === '+'; }
  function nameOf(type, side) {
    var k = kindOf(type);
    if (k === 'K') return side === 0 ? '王将' : '玉将';
    return NAME[k];
  }
  function charOf(type, side) {
    var k = kindOf(type);
    if (k === 'K') return side === 0 ? '王' : '玉';
    return CHAR[k];
  }
  function classOf(type, side) {
    var k = kindOf(type);
    if (k === 'K') return side === 0 ? '暁王' : '黄昏帝';
    return CLASS[k];
  }
  // 会話窓に出す名前 (将棋の正式名。王は呼び名を添える)
  function labelOf(type, side) {
    if (kindOf(type) === 'K') return SIDE[side] + ' ' + nameOf(type, side) + '(' + LEADER[side] + ')';
    return SIDE[side] + ' ' + nameOf(type, side);
  }

  // ---- 口調の差し替え ----
  var VARS = [
    { '軍': '解放軍', '敵軍': '帝国', '敵': '帝国兵', '主': '暁王様', '光': '暁の光', '旗': '暁の旗' },
    { '軍': '帝国軍', '敵軍': '解放軍', '敵': '反逆者', '主': '陛下', '光': '宝玉の光', '旗': '黄昏の旗' }
  ];
  function fill(text, side) {
    var v = VARS[side] || VARS[0];
    return text.replace(/\{(軍|敵軍|敵|主|光|旗)\}/g, function (_, k) { return v[k]; });
  }

  // 行データ: 文字列 | {t, f} | {s, g, f}  (s=先手用, g=後手用, f=表情)
  // 表情: normal / angry / smug / hurt / joy
  var DEF_FACE = {
    attack: 'angry', counter: 'angry', finish: 'smug', defeat: 'hurt', defect: 'joy', check: 'smug', checked: 'angry',
    drop: 'normal', prePromote: 'normal', postPromote: 'joy', stay: 'normal', forced: 'joy', mercy: 'smug', surrender: 'hurt',
    win: 'joy', lose: 'hurt', draw: 'normal'
  };
  // 表情 (顔グラは駒そのもの。UI は動き・色味・漫符で表す): normal / angry / smug / hurt / joy / surprise

  var LINES = {
    K: {
      attack: [
        { s: '私が自ら剣を取ろう。民の前では抜かないと決めていたが、ここは戦場だ。', g: '余の前に立つか。身の程を知れ。' },
        { s: '下がれ。私の兵には指一本触れさせない。', g: '王の間合いに踏み込んだな、愚か者め。' },
        { s: '皆が戦っている。私だけが見ているわけにはいかない!', g: '宝玉を見よ。見たが最後、目は離せぬ。' }
      ],
      finish: [
        { s: '許せ。だが、この一歩は退けない。', g: '跪け。それが敗れた者の作法だ。' },
        { s: '夜明けのために!', g: '黄昏に沈め。' },
        { s: 'すまない。君の名は、忘れない。', g: '余に討たれることを誇るがいい。' }
      ],
      checked: [
        { s: 'まだだ……まだ私は膝をつかない!', g: '余に刃を向けるか……面白い。', f: 'surprise' },
        { s: '皆、慌てるな。王はここにいる!', g: '小賢しい。近衛はどこだ!' },
        { s: '父上、見ていてください。ここで退けば暁は来ない。', g: '三十年、余をここまで追い詰めた者はおらぬ。' },
        { s: '刃が届くか。……それでも、前を向く。', g: '宝玉よ、囁け。余はまだ終わらぬ。' }
      ],
      win: [
        { s: '終わった……。みんな、よく戦ってくれた。', g: '見たか。余は正しかった。' },
        { s: '夜が明ける。私たちの朝だ。', g: '宝玉の光は、まだ消えぬ。' }
      ],
      lose: [
        { s: 'すまない……父上、私は……。', g: '……そうか。余の黄昏も、ここまでか。' },
        { s: 'ここまでか。だが暁は、いつか必ず来る。', g: '重い……この光は、ずっと重かった。' }
      ],
      draw: [
        { s: '決着はつかなかった。だが、言葉なら交わせる。', g: '千日の夜か……天も意地が悪い。' }
      ],
      resign: [
        { s: '……旗を降ろそう。これ以上、兵を失いたくない。', g: '……白旗を掲げよ。余の兵を、これ以上散らせぬ。' }
      ]
    },
    R: {
      attack: ['道を開けろ! この飛車が通る!', 'まっすぐ行って、まっすぐ叩く。それだけだ!', '縦も横も俺の庭よ! {敵}、覚悟しな!', { s: '暁の先陣、飛車参る!', g: '帝国の大車輪、飛車が通る!' }],
      counter: ['ほう、俺に挑むか。その度胸だけは褒めてやる!', '小細工はいらん、かかってこい!', 'この程度で俺が止まると思うな!'],
      finish: ['うおおおっ! 吹き飛べ!', '今日は力で押し通す!', 'でかい一撃、いくぞ!'],
      defeat: ['ぐっ……俺としたことが……!', '豪快に散るのも、また一興……!', 'ちくしょう、まっすぐしか見てなかった……!'],
      defect: [{ s: '負けは負けだ。暁の旗の下で、もう一暴れさせてもらう!', g: '宝玉から目が離せん……頭に響く……いいだろう、帝国のために暴れてやる!' }, '細かいことは気にせん! 次は{軍}の飛車として戦うまでだ!', 'どこに呼ばれても、俺は一直線に突っ込むぞ!'],
      check: ['王の首筋が見えたぞ! 王手だ!', '{敵}の大将、逃げ道はまっすぐ塞いだ!', 'どうした、縦の利きが怖いか!'],
      drop: ['呼んだか! ここからまっすぐ行くぞ!', '飛車、着陣! 盤の端まで俺の間合いだ!', '待たせたな!'],
      prePromote: ['敵の奥地で暴れた。……体の奥で、龍の血が騒ぎやがる。', '修羅場をくぐった分だけ、腕が上がった気がするぜ。', '龍になるか、人のままか。……考えるのは苦手なんだがな!'],
      postPromote: ['グオオオ! 龍王となって還ってきたぞ!', '見ろ、この翼! 斜めにも爪が届く!', '龍の血よ、燃えろ! 龍王、推参!'],
      stay: ['龍にならずとも、俺は俺だ!', 'まだ人のまま戦いたい。……深い理由はない!']
    },
    DR: {
      attack: ['龍王の爪から逃れられると思うな!', '縦横無尽、そして斜めにも一歩。龍の間合いだ!', 'グルルル……獲物の匂いがする。'],
      counter: ['龍に牙を剥くか、小さき兵よ。', 'その刃、鱗一枚も通らんぞ!', '龍の巣に踏み込んだな。'],
      finish: ['龍の炎で灰になれ!', '我が咆哮を聞け!', '翼の一撃、受けてみろ!'],
      defeat: ['グオォ……龍の血が……冷えていく……!', '翼が……折れた……!', '龍が……地に落ちるとは……!'],
      check: ['龍王の影が王を覆ったぞ!', '逃げても、龍の目からは逃れられん!', '天から王手だ!']
    },
    B: {
      attack: ['まっすぐ来る者は、斜めから見れば隙だらけでね。', '正面? 興味ないね。物事は斜めから見るものだ。', 'おやおや、私の対角線上に立つとは。勉強不足だね。', { s: '暁の魔導、少しばかり見せてあげよう。', g: '帝国魔導院の首席に、その程度の陣で挑むとは。' }],
      counter: ['私を狙う? 発想は悪くない。ただし結果は別だ。', 'ふん、真正面から来るなんて、品がないね。', '斜めの理屈もわからない者に、私が負けるとでも?'],
      finish: ['魔導の基礎、その一。対角線は裏切らない。', '講義はここまで。おやすみ。', '光よ、斜めに走れ!'],
      defeat: ['……計算外だ。いや、計算はしていたんだが。', 'まさか……正面から来るとは……品がない……!', '斜めばかり見ていたら……足元が……。'],
      defect: [{ s: '寝返り? 違うね、より合理的な側に移っただけさ。', g: '宝玉の光か……なるほど、これは抗えない理屈だ。' }, 'どちらの軍でも、魔導は魔導だ。好きに使いたまえ。', '捕虜の身で講義するのも悪くない。'],
      check: ['王手。斜めの理屈、わかってもらえたかな?', 'ほら、王様。対角線の先に私がいるよ。', '逃げ道を数えてごらん。斜めにはもうないはずだ。'],
      drop: ['斜めの道は、どこにでも開いている。', '天馬に乗って、ちょっと寄り道をね。', 'ここからの景色は……ふむ、悪くない対角線だ。'],
      prePromote: ['ここまで来たか。さて、どうしたものか。', '天馬が嘶いている。成るべきか、迷うね。'],
      postPromote: ['天馬よ、翼を広げろ! 龍馬となった今、前後左右も見えるとも。', '斜め以外も見えるようになってしまった。視野が広いのも、案外疲れるね。', '龍馬、顕現。講義の続きは空の上で。'],
      stay: ['力に溺れるのは三流のすることさ。私はこのままでいい。', '斜めだけで十分。余計な景色は思考を濁す。']
    },
    HO: {
      attack: ['天馬の蹄は、四方にも届くのさ。', '龍馬の講義は少々手荒いよ。', '空から見れば、君の陣はまる見えだ。'],
      counter: ['天馬に刃を向けるとは、勇敢というより無謀だね。', 'おや、届くと思ったのかい?'],
      finish: ['天馬よ、駆けろ!', '高く、斜めに、そして容赦なく。'],
      defeat: ['天馬が……墜ちる……。', '空にいても、足元はすくわれるものだね……。'],
      check: ['天馬の影が王に落ちたよ。王手だ。', '空からの王手、逃げ場はあるかな?']
    },
    G: {
      attack: ['{主}に近づく者は、この金将が許さん!', '近衛の務め、果たさせてもらう!', '{主}のおそばを離れたくはないが……一歩だけだ!'],
      counter: ['この守り、そう易々とは崩れんぞ!', '王の盾を侮るな!', '私が退けば{主}が危うい。退かぬ!'],
      finish: ['忠義の一撃、受けてみよ!', 'すぐ戻ります、{主}!', '近衛の剣は王のためにある!'],
      defeat: ['{主}……お守りできず……申し訳ありません……!', '盾が……砕けた……!', '斜め後ろが……がら空きだったか……!'],
      defect: [{ s: '暁の王よ。今度こそ守り抜くと誓おう。', g: '宝玉の光が……胸に染みる……。今より、陛下の盾となろう。' }, '忠義を捧げる相手が変わっただけだ。働きは変わらん。', 'どこに呼ばれても構わん。ただ、王のそばに置いてくれ。'],
      check: ['王手! ……{主}、少しだけ前に出ます!', '近衛の手で王を追い詰める。これも忠義の形だ。', '観念されよ、王よ。'],
      drop: ['王の盾、ここに参上!', '呼ばれたからには、守ってみせる。', '{主}、ご無事ですか!']
    },
    S: {
      attack: ['ふぉっふぉ、影から失礼するよ。', '忍びの間合いじゃ。気づいた時にはもう遅い。', '老いぼれと侮ったな?'],
      counter: ['ほう、このじじいを狙うか。', '真横からとは、若いのう。', '退き際を知らぬ者に、わしは捕まらんぞ。'],
      finish: ['影縫いの術、とくと味わえ。', '御免!', '斜めの影から、ひと突きじゃ。'],
      defeat: ['ふぉ……退き際を……誤ったわい……。', '斜め後ろに逃げる暇も……なかったか……。', '年寄りの冷や水、じゃったかの……。'],
      defect: [{ s: '長生きはするもんじゃ。暁の陣で、もう一働きしようかの。', g: '宝玉の光か……年寄りの目には眩しすぎるのう。まあ、仕えるとしよう。' }, '忍びは主を選ばん。……というのは建前じゃがな。', '捕まったのも修行のうちよ。'],
      check: ['王手じゃ。忍びの足音は聞こえなんだろう?', 'ふぉっふぉ、大将の首元まで来てしもうたわい。'],
      drop: ['……いつの間にか、ここにおるのが忍びよ。', '音もなく参上。', '呼ばれれば、どこへなりと。'],
      prePromote: ['成れば、斜め後ろには退けなくなる。ちと惜しいのう。', 'この年で、まだ腕が上がるとはの。さて、どうするかの。'],
      postPromote: ['ほっほ、横にも歩けるとは、若返った気分じゃわい。', '成った以上、見合う働きをせねばな。'],
      stay: ['退き際こそ忍びの誇り。このままでよい。', '成れるのは承知じゃ。だが、わしには銀の身軽さが合っとる。']
    },
    N: {
      attack: ['よっと! 頭の上から失礼!', '跳ねて、跳ねて、ほら目の前だ!', '壁があっても関係ないね、飛び越えるから!'],
      counter: ['げっ、こっち来るの!? 俺、後ろに逃げられないんだって!', 'ちょ、待って、まだ跳ぶ準備が!', '狙うなら他にもいるでしょ!?'],
      finish: ['とうっ! 騎兵の一番槍!', '跳躍突き! 決まった!', '着地と同時に、ひと突き!'],
      defeat: ['あ~、だから後ろに戻れたらって言ってたのに……!', '跳ねすぎた……着地点が悪かった……!', '高く跳んだ騎兵ほど、狙われやすいってことか……。'],
      defect: [{ s: 'へへ、暁の陣もいいね! 前向きなとこが俺と合う!', g: '宝玉の光……うわ、なんか頭がぼーっとする……はい、帝国の騎兵です……。' }, '乗り換え完了! 次はどこに跳ぶ?', '捕虜っていうより、移籍だよね、これ。'],
      check: ['王手! 跳んで来るとは思わなかったでしょ!', '大将の斜め前に着地!'],
      drop: ['はい到着! ……で、ここからどっちに跳ぶんだっけ?', '空から騎兵!', '呼ばれて飛び出て、ってね!'],
      prePromote: ['なんか強くなった気がする! 昇格すれば後ろにも戻れるんだよな……?', 'このまま跳ね続けるか、成るか……迷うなあ。'],
      postPromote: ['やった! 後ろに歩ける! 歩けるぞ!', '成れたけど……もう跳べないのか。うーん、複雑!'],
      stay: ['跳べなくなるのは嫌だ! 俺は跳ねてナンボ!', 'まだ跳びたい場所があるんだ。このままでいく!'],
      forced: ['跳ぶ先がもう無い……ここで一段上になるしかないってことか!', 'これ以上は前に跳べない……よし、昇格だ!']
    },
    L: {
      attack: ['前へ。ただ前へ。', '槍は曲がらん。お前を貫く。', '後ろは見ない。見る必要がない。'],
      counter: ['……正面から来い。', '横から来るとは、卑怯な。', '俺の前に立ったなら、覚悟はできているな。'],
      finish: ['突き抜けろ!', '一直線!', '槍の先が道だ。'],
      defeat: ['……前しか……見ていなかった……。', '槍が……届かなかった……。', '横は……見ていなかった……。'],
      defect: [{ s: '暁の方角が前なら、俺はそっちへ進むだけだ。', g: '宝玉から目が離せぬ。……ならば、進むのみ。' }, '向きが変わっただけだ。前に進むのは同じ。', '持ち場をくれ。前に何がいても突く。'],
      check: ['王手。槍の先を見ろ。', '一直線に、王まで。'],
      drop: ['前を向いて、着陣。', 'ここから、まっすぐ。', '槍を構えた。'],
      prePromote: ['敵陣の奥で戦った。……変わる、のか。……私が、か。', '前だけを見てきた。この先も前だけでいいのか?'],
      postPromote: ['横にも歩ける……落ち着かない……。', '後ろに一歩、下がれる。……下がる日が来るとは思わなかった。'],
      stay: ['槍兵は前を向いてこそだ。このままでいい。', 'まだ突き進む道が残っている。'],
      forced: ['もう前がない。……ならば、一段上の兵になろう。', '突き当たりだ。行くしかない。']
    },
    P: {
      attack: ['う、うわああ! 行きます! 行きますっ!', '新兵だからって、なめないでください!', '一歩ずつでも前へ! それが歩兵です!', { s: '暁の旗に誓って!', g: '宝玉の光のために!' }],
      counter: ['ひっ……で、でも逃げません!', '新兵にだって意地はあるんです!', '僕なんか狙っても得はないですよ!?'],
      finish: ['え、えいっ! やった、当たった!', '一歩、踏み込む!', '訓練どおりに……今だっ!'],
      defeat: ['うう……母さん……。', 'まだ……一歩しか……進んでないのに……。', '新兵の……意地……見せられたかな……。'],
      defect: [{ s: '解放軍……! ずっと、こっちに入りたかったんです!', g: '宝玉の光……きれい……。はい、帝国の兵になります……。' }, '捕虜……ってことは、また戦えるんですね!', 'どこに呼ばれても、一歩ずつ前に進みます!'],
      check: ['お、王手です! 僕が、王手を!?', '一歩前は、王様でした!'],
      drop: ['し、新兵、着任しました!', 'ここですか? がんばります!', '一歩目、ここから!'],
      prePromote: ['て、敵の奥地まで来ました……! なんだか体が軽い……。', '僕なんかが、昇格……? どうしよう。'],
      postPromote: ['と金になった! 昇格です! もう新兵じゃないぞ!', 'ふっふっふ、今日から僕は"と金"様だ!', '出世した! 母さん、僕、古参兵だよ!'],
      stay: ['まだ、僕には早いです。歩兵のままで!', '……一歩ずつがいいんです。'],
      forced: ['前がもう無い……! う、うわ、体が勝手に強く……!', 'これ以上は進めない……でも、戦った分だけ強くなれた……!']
    },
    TO: {
      attack: ['どけどけ~! と金様のお通りだ!', '昨日まで新兵? 知らないなあ、そんな人!', '古参兵の腕前、見せてやる!'],
      counter: ['と金様に逆らうのか!? 生意気な!', 'ちょっと待って、まだ技に慣れてなくて……いや、余裕だし!'],
      finish: ['と金ちょ~っぷ!', '出世の力、思い知れ!'],
      defeat: ['え、うそ……覚えた技が……抜けていく……! 新兵に戻っちゃう……!', '調子に……乗りすぎました……。'],
      check: ['王手! と金様の王手だぞ!', 'へっへ~ん、元新兵が王様の前に!']
    },
    NS: {
      attack: ['金将の技……案外使いやすいのう。', '金将の技を覚えた忍び、前代未聞じゃ。'],
      counter: ['斜め後ろに退けんと、退き際がのう……。', '派手になってしもうて、隠れられんわい。'],
      finish: ['上級の影縫い!', '金将仕込みの、ひと突きじゃ!'],
      defeat: ['やはり……年寄りに新しい技は……荷が重かった……。', '目立ちすぎたかのう……。'],
      check: ['上級の忍びが王手じゃ。目立って仕方ないわい。', '技が増えても、忍びの足は忘れておらんよ。']
    },
    NN: {
      attack: ['後ろに歩ける騎兵、新しいでしょ!', '跳べないけど、歩ける! 歩けるって素晴らしい!'],
      counter: ['えっ、跳んで逃げ……られないんだった!', '上級になったから平気……たぶん!'],
      finish: ['重騎兵の体当たり!', '歩いて、突く! 地道に!'],
      defeat: ['やっぱり……跳べた頃が……よかった……。', '上級って、楽じゃないなあ……。'],
      check: ['跳ばずに王手! 成長したでしょ?', '歩いて来たよ、王様の前まで!']
    },
    NL: {
      attack: ['横に……動ける……。……突く。', '慣れない技だが、槍の腕は変わらん。'],
      counter: ['横から来られても、今は横に動ける。', '……後ろにも下がれる。下がらんがな。'],
      finish: ['上級の槍!', 'まっすぐ、貫く!'],
      defeat: ['前だけ……見ていれば……よかった……。', '横を覚えたのが……仇になったか……。'],
      check: ['技が増えても、王手は一直線だ。', '横から回り込んだ。……慣れない手だ。']
    },
    // 足りない場面の予備
    GENERIC: {
      attack: ['覚悟しろ!', '{軍}の名にかけて!', '{旗}の下に!'],
      counter: ['来るなら来い!', 'そう簡単にはやられん!'],
      finish: ['これで終わりだ!', 'もらった!'],
      defeat: ['ぐっ……無念……!', 'ここまで、か……。'],
      defect: ['{軍}の兵として、戦わせてもらう。', '新しい旗の下で、もう一度。'],
      check: ['王手だ!', '{敵}の大将、覚悟!'],
      drop: ['援軍、着陣!', 'ここに参上!'],
      prePromote: ['何かをつかんだ気がする……。', '一段上へ行けるか……。'],
      postPromote: ['昇格だ!', '一段上の兵になった!'],
      stay: ['このままでいい。'],
      forced: ['ここで、一段上の兵になる!']
    }
  };

  // 取る側の選択肢2(情け)と、取られる側の返し
  var MERCY = [
    { s: '降れ。暁の軍は、捕虜を粗末にはしない。', g: '剣を置け。帝国は降った者を飢えさせぬ。' },
    '剣を置け。命までは取らない。',
    '……もう十分だ。こちらへ来い。'
  ];
  var SURRENDER = ['……参った。好きにしろ。', 'くっ……情けをかけられるとはな。', '……わかった。剣を置こう。'];
  // 成駒が捕虜になったとき、寝返りの前に言う
  var LOST_PROMO = ['すべて振り出しか……。また一から出直しだ。', '多くを失った。だが、この身は残っている。', '元に戻ってしまったか……。また鍛え直しだ。'];

  // 特定の組み合わせ専用 (取る側>取られる側)。4行: 攻撃/応戦/とどめ/やられ
  var COMBO_CAPTURE = {
    'P>R': ['ひ、飛車様!? 僕が、飛車様を相手に……!?', '新兵か。かかってこい、遠慮はいらん!', 'う、うおおおお! 一歩!!', 'ぐはっ……歩の一歩、侮った……!'],
    'P>DR': ['りゅ、龍!? 無理です……でも、行きます!', '小さき兵が、龍の顎に飛び込むか。', '新兵の一突き、鱗の隙間!', 'グオ……こんな小さな刃に……!'],
    'G>G': ['同じ近衛同士……主が違えば、刃を交えるしかない。', '貴殿の忠義、見事。だが私の忠義も負けん!', '許せ、同胞よ。', '主よ……先に……ゆきます……。'],
    'L>L': ['……正面に、槍。', '……正面に、槍。', '先に突いた方が勝つ。', '……一瞬、遅れた。'],
    'B>B': ['おや、同業者か。斜めの理屈で勝負といこう。', '君の対角線は、私の対角線でもある。', '先に動いた方が正しい理屈さ。', '……交換、というやつか。悪くない取引だね。'],
    'R>R': ['飛車同士、まっすぐぶつかるしかねえよなあ!', '望むところだ! 縦一本、真っ向勝負!', '力比べは俺の勝ちだ!', 'くそっ、俺より豪快な奴がいるとは……!'],
    'P>P': ['同じ新兵どうし……ごめん!', 'き、君も新兵? ……負けないよ!', 'えいっ!', 'う……次は、味方になれるといいね……。'],
    'S>G': ['近衛殿、王のそばを離れすぎではないかの?', '忍びめ、斜めから忍び寄るとは!', '忍びに正面などない。御免!', '王よ……盾が……欠けました……。'],
    'TO>G': ['本物の金将さん? ふふん、こっちも金だもんね!', '成り上がりが、金を名乗るか!', '元新兵の意地、見せてやる!', 'まさか……と金に……討たれるとは……。'],
    'N>G': ['金将さん、頭上注意~! 跳んできたよ!', '桂か! 跳ねる者は防ぎにくい……!', '騎兵の一番槍、いただき!', 'ぬかった……頭の上が……!'],
    'L>R': ['……飛車。槍の先にいるのが、悪い。', '香ごときが、この飛車の正面に立つとはな!', '一直線。曲がらぬ者同士だ。', '俺より……まっすぐな奴がいたか……!'],
    'DR>DR': ['龍と龍……天が二つに裂ける!', '貴様の炎、我が炎で呑み込んでくれる!', '龍の座はひとつで十分だ!', 'グオオ……龍が……堕ちる……!'],
    'N>N': ['お、騎兵仲間! ……ごめん、跳ぶね!', 'うそ、そっちが先に跳ぶの!?', '早い者勝ち!', '跳び合いで負けた……悔しい……!'],
    'B>R': ['斜めから見れば、猛将も隙だらけだね。', '魔導士風情が、正面に来い!', '正面? 興味ないと言ったろう。', 'くっ……斜めは……見てなかった……!'],
    'HO>HO': ['天馬が二頭。空は狭いね。', '同じ空を飛ぶなら、高い方が勝つ。', '私の方が、少しだけ高かった。', '……空からも、落ちるものだね。']
  };
  // 王手の専用。[王手をかけた駒, 王]
  var COMBO_CHECK = {
    N: ['王手! 跳んで来るとは思わなかったでしょ!', { s: '桂の跳躍か……! 足元を見ていなかった。', g: '跳ねる小兵ごときが、余の前に……!' }],
    L: ['一直線、王まで。……槍の先を見ろ。', { s: 'まっすぐな槍だ……だが私も退かない!', g: '槍一本で余を止める気か。' }],
    P: ['お、王手です! 僕が、王手を!?', { s: '新兵の一歩か……油断はできないな。', g: '新兵ごときが……宝玉の前に立つな!' }],
    DR: ['龍王の影が王を覆ったぞ!', { s: '龍の爪か……! みんな、守りを固めろ!', g: '龍か……宝玉の光は、龍をも従えるはずだったが。' }],
    TO: ['王手! と金様の王手だぞ! ……あ、王様の前だと緊張する……。', { s: '古参兵か……。侮れないな。', g: '元は新兵だと? 宝玉の光も地に落ちたか。' }]
  };

  // ---- 選択ロジック ----
  var lastPick = {}, usedText = {}, useSeq = 0;
  var rng = Math.random;
  function setRandom(fn) { rng = typeof fn === 'function' ? fn : Math.random; lastPick = {}; usedText = {}; }
  // 1局ごとの使用済みセリフを消す
  function resetGame() { lastPick = {}; hitoUsed = {}; usedText = {}; useSeq = 0; }
  function entryKey(e) { return typeof e === 'string' ? e : JSON.stringify(e); }
  // 同じ台詞を1局で2回出さない。候補が尽きたときだけ、いちばん前に使ったものを使う
  function pickFrom(arr, key) {
    if (!arr || !arr.length) return null;
    var fresh = arr.filter(function (e) { return !usedText[entryKey(e)]; });
    var e = fresh.length ? fresh[Math.floor(rng() * fresh.length)]
      : arr.slice().sort(function (a, b) { return usedText[entryKey(a)] - usedText[entryKey(b)]; })[0];
    usedText[entryKey(e)] = ++useSeq;
    lastPick[key] = arr.indexOf(e);
    return e;
  }
  function resolve(entry, side) {
    if (entry == null) return '';
    if (typeof entry === 'string') return fill(entry, side);
    var t = entry.t != null ? entry.t : (side === 0 ? entry.s : entry.g);
    return fill(t || '', side);
  }
  function faceOf(entry, cat) { return (entry && typeof entry === 'object' && entry.f) || DEF_FACE[cat] || 'normal'; }
  function linesFor(kind, cat) {
    var k = LINES[kind];
    if (k && k[cat] && k[cat].length) return k[cat];
    // 成駒は元の駒の行を借りる
    var base = { DR: 'R', HO: 'B', TO: 'P', NS: 'S', NN: 'N', NL: 'L' }[kind];
    if (base && LINES[base][cat] && cat !== 'prePromote' && cat !== 'postPromote' && cat !== 'stay' && cat !== 'forced') return LINES[base][cat];
    return LINES.GENERIC[cat] || [];
  }
  // S5: 家名 (北の車家など) を名乗る台詞か。打ち直された駒の台詞から外すのに使う
  var HOUSE_WORD = /[車馬]家/;
  function rawText(e, side) { return typeof e === 'string' ? e : (e && (e.t != null ? e.t : (side === 0 ? e.s : e.g))) || ''; }
  // orig = 駒の元の陣営 (0/1)。捕らえられて打ち直された駒 (orig !== side) は、いまの陣営の家を名乗る台詞を使わない
  function line(role, type, side, cat, faceOverride, orig) {
    var kind = kindOf(type), arr = linesFor(kind, cat);
    if ((orig === 0 || orig === 1) && orig !== side) { var f = arr.filter(function (e) { return !HOUSE_WORD.test(rawText(e, side)); }); if (f.length) arr = f; }
    var e = pickFrom(arr, kind + ':' + cat + ':' + side);
    return mk(role, type, side, faceOverride || faceOf(e, cat), resolve(e, side));
  }
  function mk(role, type, side, face, text) {
    return { role: role, type: type, side: side, face: face, name: labelOf(type, side), text: text };
  }

  /*
   * 駒取り。ctx = {attacker:{type,side}, victim:{type,side}, chooser:boolean}
   * 戻り値: {pre:[攻撃, 応戦], choice:null|{options:[{label, finish, defeat}]}, finish:line, defeat:line}
   *   choice があるときは options[i].finish / defeat を使う(どちらを選んでも結果は同じ)
   */
  function capture(ctx) {
    var a = ctx.attacker, v = ctx.victim;
    var ak = kindOf(a.type), vk = kindOf(v.type);
    var combo = COMBO_CAPTURE[ak + '>' + vk] ? pickFrom(COMBO_CAPTURE[ak + '>' + vk], 'cc:' + ak + '>' + vk) : null;
    var pre, fin, def;
    if (combo) {
      pre = [mk('a', a.type, a.side, 'angry', fill(combo[0], a.side)), mk('v', v.type, v.side, 'angry', fill(combo[1], v.side))];
      fin = mk('a', a.type, a.side, 'smug', fill(combo[2], a.side));
      def = mk('v', v.type, v.side, 'hurt', fill(combo[3], v.side));
    } else {
      pre = [line('a', a.type, a.side, 'attack', null, a.orig), line('v', v.type, v.side, 'counter', null, v.orig)];
      fin = line('a', a.type, a.side, 'finish', null, a.orig);
      def = line('v', v.type, v.side, 'defeat', null, v.orig);
    }
    // 説得の選択 (プレイヤーが取るときだけ UI が出す。CPU は auto で1つ選んで使う)
    var persuade = persuasion(a, v);
    return { pre: pre, persuade: persuade, finish: fin, defeat: def };
  }

  // ---- 説得の選択肢 (16章) ----
  // 説得の点: 人格で光/和を出し分ける。降伏勧告=和、問答無用=影
  var PERSUADE_PATH = { P: 'light', N: 'light', S: 'light', L: 'harmony', G: 'harmony', R: 'harmony', B: 'harmony' };
  var PERSUADE_LABEL = ['こちらへ来い。悪いようにはしない。', '降伏しろ。', '……覚悟!'];
  // 相手の反応 [説得への反応, 降伏勧告への反応]
  var REACT = {
    P: [['……ほ、本当に? ……考えさせてください。', 'hurt'], ['こ、降伏なんて……しません!', 'angry']],
    L: [['断る。', 'angry'], ['……断る。', 'angry']],
    N: [['えっ、勧誘? ……ちょっと揺れるなあ。', 'surprise'], ['やだね! 跳んで逃げ……られないけど!', 'angry']],
    S: [['ふぉっふぉ、この年で口説かれるとはのう。……考えておこう。', 'smug'], ['降伏はせんが、捕まるのは仕方ないのう。', 'smug']],
    G: [[{ s: '解放軍を裏切れるか!', g: '帝国を裏切れるか!' }, 'angry'], ['近衛に降伏の二文字はない!', 'angry']],
    B: [['勧誘の文句としては、三流だね。', 'smug'], ['降伏? 君の理屈では、そうなるのかね。', 'smug']],
    R: [['ふざけるな! 俺を口説くなら拳で来い!', 'angry'], ['降伏なんざ知らねえ!', 'angry']]
  };
  function persuasion(a, v) {
    var vb = baseKind(kindOf(v.type));
    var r = REACT[vb] || REACT.P;
    return {
      options: [
        { kind: 'persuade', path: PERSUADE_PATH[vb] || 'light', label: PERSUADE_LABEL[0], speak: mk('a', a.type, a.side, 'normal', PERSUADE_LABEL[0]), reaction: mk('v', v.type, v.side, r[0][1], resolve(r[0][0], v.side)) },
        { kind: 'surrender', path: 'harmony', label: PERSUADE_LABEL[1], speak: mk('a', a.type, a.side, 'smug', PERSUADE_LABEL[1]), reaction: mk('v', v.type, v.side, r[1][1], resolve(r[1][0], v.side)) },
        { kind: 'nomercy', path: 'shadow', label: PERSUADE_LABEL[2], speak: mk('a', a.type, a.side, 'angry', PERSUADE_LABEL[2]), reaction: null }
      ]
    };
  }
  function baseKind(k) { return { DR: 'R', HO: 'B', TO: 'P', NS: 'S', NN: 'N', NL: 'L' }[k] || k; }


  // 捕虜の寝返り。ctx = {captured: 取られた駒の型(成駒可), newSide}
  var DEFECT_BY = {
    persuade: ['お前の言葉を信じてみよう。', '……あの言葉、嘘ではないと信じる。', '悪いようにはしない、か。その言葉、覚えておくぞ。'],
    surrender: ['降れと言われて降ったのではない。……己で決めたことだ。', '……わかった。今は従おう。', '降伏、か。剣を置くのは初めてだ。'],
    nomercy: ['負けは負けだ。従おう。', '問答無用か。……それも戦だ。従う。', '……強い者に従う。それが戦の習いだ。']
  };
  // 捕虜の寝返り。ctx = {captured: 取られた駒の型(成駒可), newSide, approach: 'persuade'|'surrender'|'nomercy'|undefined}
  function defect(ctx) {
    var base = { '+P': 'P', '+L': 'L', '+N': 'N', '+S': 'S', '+B': 'B', '+R': 'R' }[ctx.captured] || ctx.captured;
    var out = [];
    if (isPromoted(ctx.captured)) out.push(mk('c', base, ctx.newSide, 'hurt', fill(pickFrom(LOST_PROMO, 'lost'), ctx.newSide)));
    if (ctx.approach === 'message') out.push(mk('c', base, ctx.newSide, 'normal', fill(pickFrom(MESSAGE_DEFECT, 'defmsg'), ctx.newSide)));
    else if (ctx.approach && DEFECT_BY[ctx.approach]) out.push(mk('c', base, ctx.newSide, ctx.approach === 'nomercy' ? 'normal' : 'joy', fill(pickFrom(DEFECT_BY[ctx.approach], 'defby:' + ctx.approach), ctx.newSide)));
    else out.push(line('c', base, ctx.newSide, 'defect', null, ctx.orig));
    return out;
  }

  // 成り相談 (プレイヤー)。選択肢の文言は仕様どおり固定
  var PROMOTE_OPTIONS = ['昇格する。', '…今のままでいい。'];
  function promote(ctx) {
    var t = ctx.type, s = ctx.side;
    var promoted = '+' + t;
    return {
      pre: line('m', t, s, 'prePromote', null, ctx.orig),
      options: PROMOTE_OPTIONS.slice(),
      yes: line('m', promoted, s, 'postPromote', null, ctx.orig),
      no: line('m', t, s, 'stay', null, ctx.orig)
    };
  }
  function postPromote(ctx) { return line('m', '+' + ctx.type, ctx.side, ctx.forced ? 'forced' : 'postPromote', null, ctx.orig); }
  function stay(ctx) { return line('m', ctx.type, ctx.side, 'stay', null, ctx.orig); }
  function forcedPromote(ctx) {
    return [line('m', ctx.type, ctx.side, 'forced', null, ctx.orig), line('m', '+' + ctx.type, ctx.side, 'postPromote', null, ctx.orig)];
  }

  // 王手。ctx = {checker:{type,side}, kingSide}
  function check(ctx) {
    var c = ctx.checker, ks = ctx.kingSide;
    var combo = COMBO_CHECK[kindOf(c.type)] ? pickFrom(COMBO_CHECK[kindOf(c.type)], 'ck:' + kindOf(c.type)) : null;
    if (combo && rng() < 0.7) {
      return [mk('a', c.type, c.side, 'smug', resolve(combo[0], c.side)), mk('k', 'K', ks, 'angry', resolve(combo[1], ks))];
    }
    return [line('a', c.type, c.side, 'check', null, c.orig), line('k', 'K', ks, 'checked')];
  }

  function drop(ctx) { return line('m', ctx.type, ctx.side, 'drop', null, ctx.orig); }

  // ---- 物語 ----
  // 宝玉の段落 (STORY.md 序章の冒頭)
  var JEWEL_PROLOGUE = [
    ['始まりの王の冠には一点の宝玉がはめ込まれていた。', 'その一点を戴く者の名は、「王」に点を加えて「玉」と書く。', '玉を名乗る者が九路の大陸の主となる。', '',
      '三十年前、その宝玉は奪われた。', '奪った男は、いま黄昏帝と呼ばれている。', '宝玉の光を見つめるうちに、帝国の兵は主を疑うことを忘れた。', '',
      '北に残った若き王の名には点がない。', ''],
    ['始まりの王の冠には一点の宝玉がはめ込まれていた。', 'その一点を戴く者が大陸の主となる。', '',
      '三十年前、余はそれを手に取った。', '以来、余の名は「王」ではなく「玉」と書かれる。', '宝玉は夜ごと、余に何かを囁く。', '']
  ];
  // 序章を飛ばしたときに語りの窓で出す2行 (記録画面の物語メモの先頭にも置く)
  var JEWEL_LINES = ['始まりの王の冠には一点の宝玉がはめ込まれていた。', '三十年前、それを奪った男が、いま黄昏帝と呼ばれている。'];
  var PROLOGUE = [
    [
      '三十二年前、暁の中興は成った。だが勝利は、勝った者たちを分けた。',
      '',
      '九路の大陸、暦一〇二四年。',
      '黄昏の帝国が北の最後の砦を囲んで、ちょうど千日が過ぎた。',
      '',
      '砦に残った兵は、わずか二十。',
      '歩兵が九人、香車と桂馬と銀と金がそれぞれ二人、飛車と角がひとりずつ。',
      'そして、まだ若い王がひとり。',
      '',
      '対する帝国軍も、同じく二十。',
      '',
      '父王は湊の戦いで討たれる前に、こう言い残した。',
      '「私が倒れれば、世は黄昏のものになる。それでも、義を失うな。」',
      '',
      '夜明けの鐘が鳴る。',
      '暁王レオニスは最初の一手を命じた。'
    ],
    [
      '三十年、余は勝ち続けた。',
      '宝玉の光は、余の兵を一度も裏切らなかった。',
      '',
      '余は、報われなかった兵たちの声に担がれただけだ。',
      '勝った日から、勝利は重かった。',
      '',
      '北の小僧が最後の兵を集めたという。',
      '二十対二十。小僧には、ちょうどよい数だ。',
      '',
      'よかろう。',
      '公平な戦で、余が正しかったと証明してやる。'
    ]
  ];
  // 3章: 序章の後半は戦場で変わる (共通の一文のあと、戦場ごとに一文)
  var FIELD_OPEN = {
    snow: '帝国の陣は、砦の目の前の雪原に構えていた。',
    rock: '山へ逃れようとした暁の軍を、帝国軍は岩場で待ち構えていた。',
    river: '南へ下る暁の軍と、北へ上る帝国軍は、白河の大橋で出会った。',
    wheat: '両軍は、焼け残った麦の里で向かい合った。',
    gate: '暁の軍は、包囲の手薄な夜を選んで南へ駆け、都の城門に迫った。'
  };
  var FIELD_MEET = { snow: '砦の目の前の雪原', rock: '九峰の岩場', river: '白河の大橋', wheat: '焼け残った麦の里', gate: '都の城門の前' };
  function prologue(side, field) {
    var k = side === 1 ? 1 : 0, body = PROLOGUE[k].slice();
    if (field && FIELD_OPEN[field]) {
      if (k === 0) body.splice(body.indexOf('夜明けの鐘が鳴る。'), 1, '夜明け、暁の軍は千日の包囲を破って砦を出た。', FIELD_OPEN[field]);
      else body.splice(body.indexOf('よかろう。'), 0, '小僧は砦を出たという。余はそれを' + FIELD_MEET[field] + 'で迎える。', '');
    }
    return JEWEL_PROLOGUE[k].concat(body);
  }

  // 開戦前の掛け合い (王将=レオニス 先手 / 玉将=ヴァルドラ 後手)
  var PRELUDE = [
    [0, 'normal', '黄昏帝。千日の包囲も、今日で終わりにする。'],
    [1, 'smug', '北の小僧か。千日も籠もって、まだ牙が残っていたとはな。'],
    [0, 'angry', 'その宝玉は、ここで終わりにする。民の上に立つための光ではないはずだ。'],
    [1, 'smug', '返す? これは余が三十年手放さなかったものだ。点ひとつの重さ、お前にわかるまい。'],
    [0, 'angry', '点ひとつで民の上に立てるものか。'],
    [1, 'normal', 'ならば盤の上で示してみよ。二十対二十だ。'],
    [0, 'normal', '勝ったら、まず戦った者に土地を分ける。その約束は、ここで果たす。'],
    [0, 'joy', '暁の解放軍、前へ!'],
    [1, 'angry', '黄昏の帝国よ、余に続け。']
  ];
  function prelude() {
    return PRELUDE.map(function (p) { return mk('k' + p[0], 'K', p[0], p[1], p[2]); });
  }

  // 語り・章回の節目 (43章: 5/15/30/45/60手目)。旧の節目 10/30/60/90/120 の名前 (narr10 など・CHAPTERS のキー) は新しい節目に対応づける
  var MILESTONES = [5, 15, 30, 45, 60];
  var OLD_MILESTONE = { 5: 10, 15: 30, 30: 60, 45: 90, 60: 120 }, NEW_MILESTONE = { 10: 5, 30: 15, 60: 30, 90: 45, 120: 60 };
  function narrTrigger(ply) { return OLD_MILESTONE[ply] ? 'narr' + OLD_MILESTONE[ply] : null; }
  var NARRATION = { 5: '朝霧が晴れた。両軍の陣形が見えてくる', 15: '日が高い。最初の血が流れた戦場に、捕虜の旗が揺れる', 30: '黄昏。帝国の旗が赤く染まる', 45: '夜。松明の灯りだけが盤を照らす', 60: '二日目の夜明け。兵たちの鎧はもう泥だらけだ' };
  // 9章: 15手目の語りは、それまでに駒取りがあったかで分ける
  var NARRATION_15_QUIET = '日が高い。両軍はまだ睨み合っている';
  function narration(ply, ctx) { if (ply === 15 && ctx && !ctx.captures) return NARRATION_15_QUIET; return NARRATION[ply] || null; }

  // 時間帯 (演出のみ)
  function timeOfDay(ply) { var p = phaseOf(ply); return { key: p.key, label: p.label }; }

  // 禁じ手は理由を物語で説明しない (33章)。二歩は反則負けの場面になるのでここでは扱わない
  var CANNOT = 'その手は指せません';
  function lore(reason) {
    if (reason === 'uchifuzume' || reason === 'deaddrop' || reason === 'selfcheck') return { title: '', text: CANNOT };
    return null;
  }

  // ---- 物語の道 (光・影・和) ----
  var PATHS = ['light', 'shadow', 'harmony'];
  var PATH_NAME = { light: '光の道', shadow: '影の道', harmony: '和の道' };
  // 同点は 光 → 和 → 影 の順。点がなければ光
  function decidePath(points) {
    points = points || {};
    var order = ['light', 'harmony', 'shadow'], best = 'light', bv = -1;
    for (var i = 0; i < order.length; i++) {
      var v = points[order[i]] || 0;
      if (v > bv) { bv = v; best = order[i]; }
    }
    return bv <= 0 ? 'light' : best;
  }

  // 選択肢の共通形: {lead: 行, options: [{path, label, reply: 行|null}]}
  function opt(path, label, reply) { return { path: path, label: label, reply: reply || null }; }

  // 1. 開戦前の会話の最後 (プレイヤーの王が選ぶ)
  function preludeChoice(side) {
    var o = side ^ 1;
    if (side === 0) {
      return {
        lead: mk('k0', 'K', 0, 'normal', '……私は、この戦で何を取り戻すのだろう。'),
        options: [
          opt('shadow', '宝玉を取り戻す。', mk('k1', 'K', 1, 'smug', '取り戻す、か。ならばお前も、いずれ点を欲しがる。')),
          opt('light', '宝玉など、あってはならない。', mk('k1', 'K', 1, 'angry', 'あってはならぬだと? 三十年、余を離さなかったものをか。')),
          opt('harmony', '話がしたい。', mk('k1', 'K', 1, 'normal', '……話、だと。盤の上で、まだそんなことを言うか。'))
        ]
      };
    }
    return {
      lead: mk('k1', 'K', 1, 'normal', '……余は、この戦の先に何を見るのか。'),
      options: [
        opt('shadow', '宝玉の光で、すべてを従える。', mk('k0', 'K', 0, 'angry', 'その光が、どれだけの民を縛ってきたと思う!')),
        opt('light', '宝玉を……手放す時が来たのかもしれぬ。', mk('k0', 'K', 0, 'normal', '……今、何と言った?')),
        opt('harmony', '小僧と、話がしたい。', mk('k0', 'K', 0, 'normal', '話なら、盤の上でしよう。私も聞きたいことがある。'))
      ]
    };
    void o;
  }

  // 2. 駒取りの選択は persuasion() (16章)

  // 3. 捕虜が寝返る場面 (指揮する王が答える)
  function defectChoice(ctx) {
    var s = ctx.newSide, base = ctx.captured;
    var kingLead = s === 0 ? '新しく加わった兵だ。どう迎えよう。' : '捕虜か。……さて、どう扱う。';
    return {
      lead: mk('k' + s, 'K', s, 'normal', kingLead),
      options: [
        opt('light', '歓迎する。', mk('c', base, s, 'joy', s === 0 ? '……温かい軍だな。この腕、存分に使ってくれ。' : '……陛下が、お声を? 光栄にございます。')),
        opt('shadow', '見張りをつけろ。', mk('c', base, s, 'hurt', '……信用されていないのは、わかっている。働きで返すさ。')),
        opt('harmony', '故郷へ帰す日を約束しよう。', mk('c', base, s, 'normal', '故郷へ……? その日のために、生き延びてみせる。'))
      ]
    };
  }

  // 5. 密使 (40手目以降に1回。敵の銀将が休戦を持ちかける)
  function envoy(ctx) {
    var me = ctx.side, en = me ^ 1;
    var pitch = en === 1
      ? ['解放軍の陣へ、帝国の使いとして参った。……陛下からの申し出じゃ。', '戦のあと、話し合いの席を設けること。勝っても負けても、じゃ。']
      : ['帝国の陣へ、解放軍の使いとして来た。暁王からの申し出だ。', '戦のあと、話し合いの席を設けること。勝っても負けても、だ。'];
    return {
      lines: [mk('e', 'S', en, 'normal', pitch[0]), mk('e', 'S', en, 'smug', pitch[1])],
      lead: mk('k' + me, 'K', me, 'normal', me === 0 ? '……密使か。答えねばならないな。' : '……密使とな。どう答えたものか。'),
      options: [
        opt('harmony', '受け入れる。', mk('e', 'S', en, 'joy', 'ありがたい。……その言葉、必ず届けよう。')),
        opt('shadow', '罠だ、追い返せ。', mk('e', 'S', en, 'angry', 'ふん。疑われるのも、密使の務めのうちよ。')),
        opt('light', '民には手を出さぬと、先に約束させよ。', mk('e', 'S', en, 'normal', '民か。……それだけは、わしも同じ思いじゃ。'))
      ],
      farewell: mk('e', 'S', en, 'smug', '返事は、この戦の終わりに聞こう。')
    };
  }

  // 6. 王が初めて王手をかけられたときの独白
  function kingMonologue(side) {
    return {
      lead: mk('k' + side, 'K', side, 'hurt', side === 0 ? '刃が、ここまで届いた……。' : '余の喉元に、刃が……。'),
      options: [
        opt('light', 'まだ倒れるわけにはいかない。', mk('k' + side, 'K', side, 'angry', side === 0 ? '民が待っている。ここで膝はつかない。' : '余を信じて飢えを越えた民がいる。倒れてはならぬ。')),
        opt('shadow', '誰を犠牲にしても生き延びる。', mk('k' + side, 'K', side, 'smug', side === 0 ? '……生き延びる。どんな手を使っても。' : '盾はいくらでもある。余が生きれば、帝国は続く。')),
        opt('harmony', 'この戦の意味を、相手に問いたい。', mk('k' + side, 'K', side, 'normal', side === 0 ? '黄昏帝。あなたは、この戦の先に何を見ている?' : '小僧。お前は、この戦の先に何を見ている。'))
      ]
    };
  }

  // ---- 盤上の出来事 ----
  var HERO_NAME = ['小吉', '与作'];
  function heroName(side) { return HERO_NAME[side === 1 ? 1 : 0]; }
  var TESTAMENT = {
    R: '俺の分まで、まっすぐ進め……。若い奴らに、そう伝えてくれ……。',
    B: '斜めの理屈は……君たちに預けるよ。答えは、自分の目で見つけたまえ……。'
  };
  function testament(ctx) {
    var base = { '+R': 'R', '+B': 'B' }[ctx.type] || ctx.type;
    var text = TESTAMENT[base] || TESTAMENT.R;
    return { line: mk('v', ctx.type, ctx.side, 'hurt', text), base: base, text: text };
  }
  var TURNCOAT = [
    { s: 'かつての仲間を討った。……これで、暁の兵だと胸を張れる。', g: 'かつての仲間を討った。……宝玉の光が、少し遠く感じられる。' },
    '旗が変わっても、腕は変わらない。見てくれたか!',
    '……許せ。今の俺には、守るものがこっちにある。'
  ];
  function turncoat(ctx) { return mk('m', ctx.type, ctx.side, 'smug', resolve(pickFrom(TURNCOAT, 'turncoat'), ctx.side)); }
  function heroLine(ctx) {
    return mk('m', '+P', ctx.side, 'joy', ctx.side === 0
      ? '名を覚えておいてください! 歩兵の' + heroName(0) + '、と金になりました!'
      : '歩兵の' + heroName(1) + '、昇格いたしました! 妹に知らせてやりたい!');
  }

  // ---- 打つ場面 (援軍の召喚) ----
  var CUTIN = {
    P: ['新兵、ただいま参上!', '一歩目、ここから!'],
    L: ['槍兵、着陣。', '前を向いて、参上。'],
    N: ['騎兵、跳んで参上!', '空から失礼!'],
    S: ['忍び、参上。', '音もなく、ここに。'],
    G: ['近衛騎士、参上!', '王の盾、ここに!'],
    B: ['魔導士、参上。', '天馬に乗って、ご到着だ。'],
    R: ['猛将、参上!', '待たせたな、飛車のお出ましだ!']
  };
  var FIRST_SUMMON = [
    { s: 'かつての仲間よ……。今日からは、暁の旗の下で戦う。', g: 'かつての仲間よ……。宝玉の光が、もう俺を離さない。' },
    'かつての仲間よ……許せ。',
    '昨日までの味方に、刃を向けることになるとはな……。'
  ];
  var RETORT = ['裏切り者め! 恥を知れ!', '……お前か。盤の上で会うとはな。', 'その旗、よく似合っているじゃないか。皮肉だぞ。'];
  var REPEAT_SUMMON = ['また呼ばれたか。もう迷いはない。', '慣れたものだ。どこへでも行こう。', '覚悟は決めた。この旗のために戦う。'];
  var SURPRISE = ['奇襲だ! 王の懐に飛び込んだぞ!', '不意打ち、御免!', '気づいた時には、もう遅い!'];
  var SURPRISED_KING = [
    { s: 'な……どこから現れた!?', g: '何だと……いつの間に!?' },
    { s: '予備兵の召喚か……! 油断した!', g: '召喚の奇襲だと……小賢しい!' }
  ];
  var MATE_SUMMON = ['これが、決着の召喚だ。', '最後の一手は、この身で決める。', '逃げ道は、もうどこにもない。'];
  var DEFEND = ['王を守れ! ここは通さない!', '王の盾、ここに立つ!', '{主}には、指一本触れさせない!'];
  var KING_THANKS = [
    { s: 'ありがとう。君がいてくれて心強い。', g: '……よく来た。そこを動くな。' },
    { s: '助かった。頼りにしている。', g: '褒めてつかわす。余を守れ。' }
  ];
  function summon(ctx) {
    // ctx = {type, side, first, check, mate, defend, retort:{type}|null}
    var t = ctx.type, s = ctx.side, k = kindOf(t);
    var cut = mk('m', t, s, 'angry', resolve(pickFrom(CUTIN[k] || CUTIN.P, 'cut:' + k), s));
    var after = [];
    var pawn = t === 'P';
    if (ctx.mate) after.push(mk('m', t, s, 'smug', resolve(pickFrom(MATE_SUMMON, 'mate'), s)));
    else if (ctx.check) {
      after.push(mk('m', t, s, 'smug', resolve(pickFrom(SURPRISE, 'surprise'), s)));
      after.push(mk('k', 'K', s ^ 1, 'surprise', resolve(pickFrom(SURPRISED_KING, 'surk'), s ^ 1)));
    } else if (ctx.first) {
      after.push(mk('m', t, s, 'hurt', resolve(pickFrom(FIRST_SUMMON, 'first'), s)));
      if (ctx.retort && !pawn) after.push(mk('r', ctx.retort.type, s ^ 1, 'angry', resolve(pickFrom(RETORT, 'retort'), s ^ 1)));
    } else if (ctx.defend) {
      after.push(mk('m', t, s, 'angry', resolve(pickFrom(DEFEND, 'defend'), s)));
      if (!pawn) after.push(mk('k', 'K', s, 'joy', resolve(pickFrom(KING_THANKS, 'thanks'), s)));
    } else if (ctx.repeat) {
      after.push(mk('m', t, s, 'normal', resolve(pickFrom(REPEAT_SUMMON, 'repeat'), s)));
    } else {
      after.push(line('m', t, s, 'drop', null, ctx.origSide));
    }
    if (pawn && after.length > 1) after = after.slice(0, 1);
    return { cutin: cut, after: after, band: ctx.mate ? '決着の召喚' : (ctx.check ? '奇襲!' : null) };
  }

  // ---- ひとこと (進行を止めない短い独り言) ----
  var HITO = {
    idle: ['まだ出番はないのか。', '腕がなまってしまうな。', '{主}、そろそろ命令を。', '……待つのも仕事のうち、か。', '前線の様子はどうなっている?', 'じっとしていると、鎧が重く感じる。'],
    idleLong: ['いつまで待たせる!', '一度も動いていないぞ!', '{主}、私をお忘れでは……?', 'このまま戦が終わったら、故郷で笑われる。', '足に根が生えてしまいそうだ。', 'せめて一歩、前へ!'],
    guard: ['{主}のおそばは、私が守る。', 'ここを離れるわけにはいかない。', '{主}、お疲れではありませんか。', '敵の刃は、まず私が受ける。', { s: '暁王様はまだお若い。我らが支えねば。', g: '陛下のお顔色が優れぬ……。' }, '王のそばが一番落ち着く。'],
    threatened: ['む……狙われているな。', '敵の刃がこっちを向いている……!', '来るなら来い。ただでは倒れん。', 'だ、誰か援護を……!', '震えてなどいない。武者震いだ。', '{主}、ここは危ないかもしれません。'],
    nearZone: ['敵陣が近い……ここで戦えば、一段上へ行ける。', 'あと少しで、昇格に手が届く。', '手柄を立てるなら今だ。', 'この先へ進ませてくれ!', '敵の奥地まで、もう一息。'],
    inHand: [{ s: '暁の軍の飯は、帝国より温かいな。', g: '宝玉の光……まだ慣れない。' }, '新しい旗の色に、まだ目が慣れない。', '呼ばれたら、すぐに出られる。', 'かつての仲間と戦うことになるのか……。', '予備兵の天幕は狭いな。早く呼んでくれ。', { s: '解放軍の兵は、捕虜にも笑いかける。不思議な軍だ。', g: '帝国の兵は皆、同じ目をしている。宝玉の目だ。' }],
    promoted: ['昇格した腕前、見てくれ!', '敵陣で積んだ経験は伊達じゃない。', '一段上の兵になった。体が覚えている。', 'もう昔の俺とは違うぞ。'],
    behind: ['押されているな……。', 'まだだ、まだ終わっていない!', '{主}を信じろ。流れは必ず変わる。', '数では負けても、心では負けない。', { s: '夜明け前が一番暗い。耐えろ!', g: '宝玉の光が……揺らいでいる……?' }],
    ahead: ['押している! この勢いで行こう!', '油断するな。勝ちかけた時が一番危ない。', '敵の陣が崩れてきたぞ。', { s: '暁は近い!', g: '宝玉の威光だ。当然の結果よ。' }, '浮かれるな。最後まで気を抜くな。']
  };
  var HITO_KIND = {
    'P:idleLong': ['新兵だって、戦えるんですけど……!', '僕の出番、まだですか……?'],
    'P:nearZone': ['あと少しで……僕も"と金"に……!'],
    'P:threatened': ['ひっ……狙われてる……!'],
    'N:idleLong': ['跳びたい! 跳ばせて!'],
    'N:threatened': ['後ろに逃げられないんだって……!'],
    'L:idleLong': ['……前に、進みたい。'],
    'L:nearZone': ['突き当たりまで、まっすぐだ。'],
    'R:idleLong': ['飛車をいつまで寝かせておく気だ!'],
    'R:nearZone': ['龍の血が騒ぐ……!'],
    'B:idleLong': ['斜めの道が、まだ開かないね。'],
    'B:threatened': ['おや、狙われているのは私か。光栄だね。'],
    'G:guard': ['近衛の務め。王から一歩も離れぬ。'],
    'S:guard': ['わしが王の盾じゃ。退き際は心得ておる。'],
    'TO:promoted': ['と金様、古参兵ですから!'],
    'K:behind': [{ s: '皆、すまない。もう少しだけ耐えてくれ。', g: '……余が、押されているだと?' }],
    'K:ahead': [{ s: '皆のおかげだ。だが、まだ気を抜くな。', g: 'それでよい。宝玉の光に従え。' }],
    'K:threatened': [{ s: '刃が近い……だが、怯まない。', g: '余に刃を向ける者がいるとはな。' }]
  };
  // ---- 情景 (23章・43章): 朝(0〜)→昼(8〜)→夕方(23〜)→夜(33〜)→夜明け(48〜)→昼(63〜)… 55手で巡る ----
  var PHASES = { morning: '朝', day: '昼', evening: '夕', night: '夜', dawn: '暁' };
  function phaseOf(ply) {
    if (ply < 8) return { key: 'morning', label: PHASES.morning, start: 0 };
    var t = (ply - 8) % 55, base = ply - t;
    if (t < 15) return { key: 'day', label: PHASES.day, start: base };
    if (t < 25) return { key: 'evening', label: PHASES.evening, start: base + 15 };
    if (t < 40) return { key: 'night', label: PHASES.night, start: base + 25 };
    return { key: 'dawn', label: PHASES.dawn, start: base + 40 };
  }
  // 雨の予定: 0〜2回、4〜8手続く。重ならない
  function rainSchedule(rand) {
    rand = typeof rand === 'function' ? rand : rng;
    var r = rand(), n = r < 0.3 ? 0 : (r < 0.8 ? 1 : 2), out = [], guard = 0;
    while (out.length < n && guard++ < 50) {
      var len = 4 + Math.floor(rand() * 5), start = 4 + Math.floor(rand() * 70), end = start + len;
      if (out.some(function (o) { return start <= o.end + 2 && end >= o.start - 2; })) continue;
      out.push({ start: start, end: end });
    }
    out.sort(function (a, b) { return a.start - b.start; });
    return out;
  }
  function rainAt(schedule, ply) {
    for (var i = 0; i < (schedule || []).length; i++) if (ply >= schedule[i].start && ply < schedule[i].end) return schedule[i];
    return null;
  }
  var RAIN_NARR = { start: '雨が降りだした。', end: '雨が上がった。' };
  HITO.rain = ['足元がぬかるむ……。', '雨で槍が滑る。気をつけろ。', '鎧の中まで濡れてきた。', '雨の音で、敵の足音が聞こえん。', '{主}、お体が冷えませんか。'];
  HITO.night = ['暗くて敵が見えん。', '松明の火を絶やすな。', '夜目の利く者はいるか?', '星が出ている。……故郷でも同じ星が見えるだろうか。', '夜の戦は、音だけが頼りだ。'];

  // ---- 駒取りの場面の型 (24章) ----
  var CAPTURE_TYPES = ['persuade', 'duel', 'oneblow', 'yield', 'flee', 'reunion', 'bravado', 'kabuki', 'silent', 'message'];
  // 説得の型を出してよい上限: これまでの駒取り n 回 (今回を含む) のうち ceil(n×0.3) 回まで
  function persuadeAllowed(persuadeCount, totalSoFar) { return persuadeCount + 1 <= Math.ceil((totalSoFar + 1) * 0.3); }
  // 型を選ぶ。直前と同じ型は選ばない。説得はプレイヤーが取るときだけ、上限まで
  function pickCaptureType(st, human, rand) {
    rand = typeof rand === 'function' ? rand : rng;
    st = st || { prev: null, persuade: 0, total: 0 };
    var cands = CAPTURE_TYPES.filter(function (t) {
      if (t === st.prev) return false;
      if (t === 'persuade') return !!human && persuadeAllowed(st.persuade, st.total);
      return true;
    });
    var weights = cands.map(function (t) { return t === 'persuade' ? 2.2 : 1; });
    var tot = weights.reduce(function (a, b) { return a + b; }, 0), r = rand() * tot, pick = cands[0];
    for (var i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) { pick = cands[i]; break; } }
    return pick;
  }
  function nextCaptureState(st, type) {
    st = st || { prev: null, persuade: 0, total: 0 };
    return { prev: type, persuade: st.persuade + (type === 'persuade' ? 1 : 0), total: st.total + 1 };
  }
  // 駒の人格で変える行。{名} は話し手の二つ名つきの名前に UI が置き換える
  var CT = {
    duel: {
      a: { P: ['ぼ、僕は{名}! い、いきます!'], L: ['{名}。……参る。'], B: ['名乗っておこう。{名}だ。覚えなくていいよ。'], R: ['我こそは{名}! 正面から来い!'], K: [{ s: '{名}。剣を抜く。', g: '余は{名}。跪くがよい。' }], _: ['{軍}の{名}、参る!', '名乗れ。わたしは{名}だ。'] },
      v: { P: ['ぼ、僕だって{名}です!'], L: ['……{名}。受ける。'], B: ['{名}。……名乗り合いとは古風だね。'], R: ['{名}だ! 望むところ!'], _: ['{名}、受けて立つ!', '{名}だ。来い!'] },
      a2: ['いい名だ。だが、ここまでだ。', '名は覚えた。……いくぞ!'],
      v2: ['こちらも、覚えたぞ。', '来い!']
    },
    oneblow: { a: { P: ['え、えいっ!'], L: ['突く。'], N: ['跳んで、ひと突き!'], S: ['御免。'], G: ['退け!'], B: ['対角線上、一閃。'], R: ['吹き飛べ!'], K: [{ s: '……許せ。', g: '去れ。' }], _: ['一撃で十分だ。', 'はっ!'] } },
    yield: {
      v: { P: ['……もう、十分戦いました。'], L: ['……前に進めぬなら、ここまでだ。'], N: ['跳ぶのも疲れたよ。……降参!'], S: ['年寄りの退き際じゃ。好きにせい。'], G: ['……主よ、すまぬ。もう十分戦った。'], B: ['理屈の上では、ここで降るのが正しいね。'], R: ['……ちっ。もう十分暴れた。連れていけ。'], _: ['……もう十分戦った。連れていけ。'] },
      a: ['よく戦った。', '剣を収めよう。']
    },
    flee: {
      v: { P: ['ひ、ひいっ! 今日は帰らせてもらいます!'], L: ['……う、後ろに下がれない……!'], N: ['後ろに跳べないんだった……!'], S: ['ふぉ、退き際じゃ……あっ、そっちは味方の陣じゃない!'], G: ['主のもとへ戻らねば……あっ。'], B: ['ここは斜めに逃げて……あ、塞がれている。'], R: ['な、なんだ、横に逃げ……行き止まりか!'], _: ['こ、ここは一旦退く!'] },
      a: ['待て!', '逃がすか!'],
      v2: ['あ、足がもつれ……!', 'つ、捕まった……!']
    },
    reunion: {
      v: ['お前……あの村の……!', 'まさか、お前か。訓練所で一緒だった……!', 'その声……幼なじみの……!'],
      a: ['久しぶりだな。こんな形で会いたくはなかった。', '……覚えていてくれたか。', '話は後だ。今は、すまない。'],
      v2: ['……手加減はいらん。', '後で、酒でも飲もう。']
    },
    bravado: { v: { P: ['お、覚えてろ! 次は味方として、もっと活躍してやる!'], R: ['俺を取ったくらいで勝ったと思うなよ!'], B: ['ふん。私を取った君の理屈に、穴がなければいいがね。'], _: ['ふん、これで終わりと思うな!', '覚えてろ!'] } },
    kabuki: { a: { P: ['新兵の一歩、とくと見よ!'], L: ['一直線の槍、ここにあり!'], N: ['天を跳ぶ騎兵、見参!'], S: ['影より出でて、影に消ゆ!'], G: ['王の盾、ここにあり!'], B: ['斜めの理、ここに極まれり!'], R: ['天下の猛将、ここにあり!'], K: [{ s: '暁の剣、ここに!', g: '黄昏の威光、思い知れ!' }], _: ['見よ、この一手!'] } },
    message: {
      v: [{ s: '頼みがある。……帝国にいる弟に、まだ生きていると伝えてくれ。', g: '頼みがある。……北の村の母に、無事だと伝えてくれ。' }, '頼む……隊の仲間に、すまなかったと伝えてくれ。'],
      a: ['……わかった。必ず。', '約束しよう。']
    }
  };
  var MESSAGE_DEFECT = ['伝言のこと、頼んだぞ。……いや、今は俺も、こちらの兵か。', '伝言が届く日まで、ここで戦おう。'];
  function ctLine(table, kind, side) {
    var arr = (table && (table[baseKind(kind)] || table._)) || table || [];
    return resolve(pickFrom(Array.isArray(arr) ? arr : [arr], 'ct:' + JSON.stringify(arr).length), side);
  }
  /*
   * 型ごとの台本。戻り値: {type, pre:[行], last:行|null, band:'……'|null, effect:'kabuki'|null, approach}
   *   pre は斬る前、last は斬った後の取られる駒の一言。lvl: 1 少ない / 2 ふつう / 3 多い
   */
  function captureScript(type, a, v, lvl) {
    var ak = kindOf(a.type), vk = kindOf(v.type), out = { type: type, pre: [], last: null, band: null, effect: null, approach: 'nomercy' };
    function A(face, text) { return mk('a', a.type, a.side, face, text); }
    function V(face, text) { return mk('v', v.type, v.side, face, text); }
    var c = CT[type];
    switch (type) {
      case 'duel':
        out.pre = [A('angry', ctLine(c.a, ak, a.side)), V('angry', ctLine(c.v, vk, v.side))];
        if (lvl >= 3) out.pre.push(A('smug', resolve(pickFrom(c.a2, 'd2'), a.side)), V('angry', resolve(pickFrom(c.v2, 'dv2'), v.side)));
        out.last = line('v', v.type, v.side, 'defeat', null, v.orig);
        break;
      case 'oneblow':
        out.pre = [A('angry', ctLine(c.a, ak, a.side))];
        if (lvl >= 3) out.last = line('v', v.type, v.side, 'defeat', null, v.orig);
        break;
      case 'yield':
        out.pre = [V('hurt', ctLine(c.v, vk, v.side))];
        if (lvl >= 3) out.pre.push(A('normal', resolve(pickFrom(c.a, 'ya'), a.side)));
        out.approach = 'surrender';
        break;
      case 'flee':
        out.pre = [V('surprise', ctLine(c.v, vk, v.side))];
        if (lvl >= 3) out.pre.push(A('angry', resolve(pickFrom(c.a, 'fa'), a.side)));
        if (lvl >= 2) out.pre.push(V('hurt', resolve(pickFrom(c.v2, 'fv2'), v.side)));
        break;
      case 'reunion':
        out.pre = [V('surprise', resolve(pickFrom(c.v, 'rv'), v.side))];
        if (lvl >= 2) out.pre.push(A('hurt', resolve(pickFrom(c.a, 'ra'), a.side)));
        if (lvl >= 3) out.pre.push(V('normal', resolve(pickFrom(c.v2, 'rv2'), v.side)));
        out.approach = 'persuade';
        break;
      case 'bravado':
        out.pre = lvl >= 2 ? [line('a', a.type, a.side, 'attack', null, a.orig)] : [];
        out.last = V('angry', ctLine(c.v, vk, v.side));
        break;
      case 'kabuki':
        out.pre = [A('smug', ctLine(c.a, ak, a.side))];
        out.effect = 'kabuki';
        if (lvl >= 3) out.last = line('v', v.type, v.side, 'defeat', null, v.orig);
        break;
      case 'silent':
        out.band = '……';
        break;
      case 'message':
        out.pre = [V('hurt', resolve(pickFrom(c.v, 'mv'), v.side))];
        if (lvl >= 2) out.pre.push(A('normal', resolve(pickFrom(c.a, 'ma'), a.side)));
        out.approach = 'message';
        break;
      default: // persuade は UI が従来どおり進める
        out.pre = [line('a', a.type, a.side, 'attack', null, a.orig), line('v', v.type, v.side, 'counter', null, v.orig)];
        out.last = line('v', v.type, v.side, 'defeat', null, v.orig);
    }
    if (lvl <= 1 && type !== 'persuade') { out.pre = out.pre.slice(0, 1); if (type !== 'bravado') out.last = null; }
    return out;
  }

  // ---- 世界地図 (25章) ----
  // 画像座標の割合 (%)。ラベルの y は別に持てる
  var PLACES = [
    { name: '暁の砦', x: 22.8, y: 13.7 }, { name: '九峰山脈', x: 44.3, y: 24 }, { name: '鏡の内海', x: 22, y: 63 }, { name: '白河の大橋', x: 64.5, y: 44 },
    { name: '麦の里', x: 34, y: 70 }, { name: '東の宿場', x: 80, y: 52 }, { name: '黄昏の都', x: 68.4, y: 77, ly: 91 }
  ];
  // 61章: 選んだ戦場 (おまかせ = 'random' はこれまでどおりランダム)。知らない値もおまかせ扱い
  function pickField(choice, rand) {
    var f = FIELDS.filter(function (x) { return x.id === choice; })[0];
    if (f) return f;
    rand = typeof rand === 'function' ? rand : rng;
    return FIELDS[Math.floor(rand() * FIELDS.length) % FIELDS.length];
  }
  var FIELDS = [
    { id: 'snow', name: '暁の砦の前', terrain: 'snow', x: 25, y: 21 },
    { id: 'rock', name: '九峰山脈のふもと', terrain: 'rock', x: 44.3, y: 32 },
    { id: 'river', name: '白河の大橋', terrain: 'grass', x: 64.5, y: 44 },
    { id: 'wheat', name: '麦の里', terrain: 'wheat', x: 34, y: 70 },
    { id: 'gate', name: '黄昏の都の城門前', terrain: 'stone', x: 68.4, y: 70 }
  ];
  var CAPITALS = [{ x: 22.8, y: 13.7 }, { x: 68.4, y: 77 }]; // 0=暁の砦 (解放軍), 1=黄昏の都 (帝国)

  var hitoUsed = {};
  function hitokoto(cat, type, side) {
    var k = kindOf(type);
    var pool = (HITO_KIND[k + ':' + cat] && rng() < 0.6) ? HITO_KIND[k + ':' + cat] : (HITO[cat] || HITO.idle);
    var cand = [];
    for (var i = 0; i < pool.length; i++) if (!hitoUsed[resolve(pool[i], side)]) cand.push(pool[i]);
    if (!cand.length && pool !== HITO[cat] && HITO[cat]) { pool = HITO[cat]; for (i = 0; i < pool.length; i++) if (!hitoUsed[resolve(pool[i], side)]) cand.push(pool[i]); }
    if (!cand.length) return null; // 同じ台詞は1局で2回出さない (候補が尽きたら出さない)
    var e = cand[Math.floor(rng() * cand.length)];
    var text = resolve(e, side);
    hitoUsed[text] = true;
    return mk('h', type, side, cat === 'threatened' || cat === 'behind' ? 'hurt' : (cat === 'promoted' || cat === 'ahead' ? 'joy' : 'normal'), text);
  }

  // ---- 群像会話 ----
  // roles: 'P' / 'G|S' / 'K' / 'any' / 'G|any' / 'drop'(直前に打った駒)。行: [役, 表情, 文] または {choice:...}
  var ENSEMBLE = [
    { id: 's-cap1', trigger: 'firstCapture', side: 0, roles: { a: 'P', b: 'G|S|any' }, lines: [['a', 'joy', '見ましたか! 最初の捕虜です!'], ['b', 'smug', '浮かれるな。捕虜にも帰る家がある。丁重に扱え。'], ['a', 'normal', 'は、はい! 温かい飯を用意します!']] },
    { id: 's-cap2', trigger: 'firstCapture', side: 0, roles: { a: 'N', b: 'L|any' }, lines: [['a', 'joy', '一番手柄だ! ……あ、取ったのは俺じゃないか。'], ['b', 'normal', '……誰が取っても、手柄は軍のものだ。']] },
    { id: 's-lost', trigger: 'lostMajor', side: 0, roles: { a: 'G|S', b: 'P|any' }, lines: [['a', 'hurt', '大駒を奪われた……。帝国はあれを使ってくるぞ。'], ['b', 'hurt', 'ぼ、僕たちだけで大丈夫なんでしょうか……。'], ['a', 'angry', '大丈夫にするのが、我らの仕事だ。持ち場を固めろ。']] },
    { id: 's-pro', trigger: 'firstPromote', side: 0, roles: { a: 'promoted', b: 'S|G|any' }, lines: [['a', 'joy', '見ましたか、昇格です! 自分でも驚いてます!'], ['b', 'smug', '若いのは浮かれるのも早いのう。'], ['a', 'smug', 'いつか全員で一段上の兵になって、凱旋しましょう!']] },
    { id: 's-chk', trigger: 'checked', side: 0, roles: { a: 'G|any', b: 'S|any', c: 'K' }, lines: [['a', 'angry', '王手だ! 陣を固めろ!'], ['b', 'normal', '慌てるでない。退き道はまだある。'], ['c', 'normal', '皆、落ち着いてくれ。私はここにいる。']] },
    { id: 's-n10', trigger: 'narr10', side: 0, roles: { a: 'P', b: 'P|any' }, lines: [['a', 'normal', '霧が晴れたね。……帝国の旗、思ったより近い。'], ['b', 'normal', '怖い? 僕は怖い。でも、ここまで来たんだ。'], ['a', 'joy', 'うん。一歩ずつ、だね。']] },
    { id: 's-n30', trigger: 'narr30', side: 0, roles: { a: 'S', b: 'N|any' }, lines: [['a', 'normal', '昔、わしは帝国に仕えておった。宝玉が来る前の帝国にな。'], ['b', 'normal', 'えっ、元帝国兵!? どんな国だったの?'], ['a', 'normal', '飢えた村に麦を配る、まっとうな国じゃった。……人は変わるものよ。']] },
    { id: 's-n60', trigger: 'narr60', side: 0, roles: { a: 'L|any', b: 'G|any' }, lines: [['a', 'normal', '……日が傾いてきた。'], ['b', 'normal', '帝国の旗が赤い。黄昏の名のとおりだな。'], ['a', 'normal', '黄昏の次は夜だ。夜の次は、暁だ。']] },
    { id: 's-n90', trigger: 'narr90', side: 0, roles: { a: 'P|any', b: 'K' }, lines: [
      ['a', 'hurt', '……暁王様。僕、帝国に家族がいるんです。兄が帝国の兵になって。'],
      { choice: 'b', lead: '……そうか。', options: [['light', '戦が終われば会える。', '……はい! その日まで、生き延びます!'], ['shadow', '今は忘れろ。', '……わかりました。今は、前だけを見ます。'], ['harmony', '家族のためにも、早く終わらせよう。', 'はい……! 兄さんと戦わずに済むように。']] }
    ] },
    { id: 's-drop', trigger: 'firstDrop', side: 0, roles: { a: 'drop', b: 'G|S|any' }, lines: [['a', 'normal', '……本当に、ここに立っていいのか? 昨日まで帝国の兵だった。'], ['b', 'normal', 'ここに立った以上、今日からは暁の兵だ。'], ['a', 'joy', '……温かい軍だな。わかった、背中は任せろ。']] },
    { id: 'g-cap1', trigger: 'firstCapture', side: 1, roles: { a: 'P|any', b: 'G|any' }, lines: [['a', 'smug', '捕虜だ! 宝玉の光を浴びせてやれ!'], ['b', 'normal', '……宝玉の光、か。あの光を浴びた者は、皆同じ目になる。'], ['a', 'normal', 'え? それが帝国の兵ってものでしょう?']] },
    { id: 'g-lost', trigger: 'lostMajor', side: 1, roles: { a: 'G|S', b: 'P|any' }, lines: [['a', 'hurt', '大駒を奪われるとは……陛下に何と申し上げればよいか。'], ['b', 'hurt', '陛下は……お怒りになるでしょうか。'], ['a', 'normal', '陛下は怒鳴らぬ。ただ、宝玉を見つめて黙られる。それが一番恐ろしい。']] },
    { id: 'g-pro', trigger: 'firstPromote', side: 1, roles: { a: 'promoted', b: 'S|any' }, lines: [['a', 'joy', '昇格だ! これで宝玉の光にも負けん!'], ['b', 'normal', '……お主、今、宝玉に負けんと言うたか?'], ['a', 'hurt', 'い、いえ! 宝玉の光のおかげです!']] },
    { id: 'g-chk', trigger: 'checked', side: 1, roles: { a: 'G|any', b: 'any', c: 'K' }, lines: [['a', 'angry', '陛下の御前に刃だと!? 近衛、集え!'], ['b', 'hurt', '解放軍め、ここまで来るとは……!'], ['c', 'smug', '騒ぐな。余はまだ一歩も退いておらぬ。']] },
    { id: 'g-n10', trigger: 'narr10', side: 1, roles: { a: 'P', b: 'P|any' }, lines: [['a', 'normal', '霧の向こうに、北の砦が見える。千日も落ちなかった砦だ。'], ['b', 'normal', '……あの中の兵も、僕らと同じくらいの歳なのかな。'], ['a', 'angry', '考えるな。宝玉の光だけを見ていろ。']] },
    { id: 'g-n30', trigger: 'narr30', side: 1, roles: { a: 'S|any', b: 'G|any' }, lines: [['a', 'normal', '近衛殿。陛下は宝玉を手にされる前のことを覚えておいでかの。'], ['b', 'angry', '口を慎め。……覚えておられる。だから、夜ごと宝玉を見つめておられるのだ。']] },
    { id: 'g-n60', trigger: 'narr60', side: 1, roles: { a: 'R|DR|any', b: 'B|HO|any' }, lines: [['a', 'normal', '黄昏か。俺たちの旗の色だ。'], ['b', 'smug', '黄昏の次に何が来るか、帝国の暦には書いていないね。'], ['a', 'angry', '……縁起でもないことを言うな。']] },
    { id: 'g-n90', trigger: 'narr90', side: 1, roles: { a: 'P|any', b: 'K' }, lines: [
      ['a', 'hurt', '……陛下。故郷に妹がいるのです。帝国の兵になれば麦がもらえると聞いて。'],
      { choice: 'b', lead: '……麦は、届いているのか。', options: [['light', '余が必ず届けさせる。', '……陛下が? ありがとうございます……!'], ['shadow', '今は忘れよ。', '……はっ。今は、戦うことだけを。'], ['harmony', 'この戦を終わらせれば、届く。', 'はい……。早く、終わればいいのに。']] }
    ] },
    // 52章: 暁王の土地の約束 (群像会話に一行)
    { id: 's-land', trigger: 'quiet', side: 0, roles: { a: 'R|L', b: 'B|N' }, houses: ['北の車家', '北の馬家'], lines: [['a', 'normal', '王は言った。勝ったら、まず戦った者に土地を分けると。'], ['b', 'smug', 'その約束に、うちの家も賭けている。中興のときのようには、もうならない。']] },
    { id: 'g-drop', trigger: 'firstDrop', side: 1, roles: { a: 'drop', b: 'G|any' }, lines: [['a', 'hurt', '……宝玉の光が、頭の中でずっと鳴っている。'], ['b', 'normal', 'じきに慣れる。慣れたくなくてもな。'], ['a', 'normal', '……あなたも、元は向こうの兵だったのですか。'], ['b', 'normal', '昔の話だ。前を向け。']] }
  ];
  function ensembleFor(trigger, side, used) {
    used = used || {};
    var list = ENSEMBLE.filter(function (e) { return e.trigger === trigger && e.side === side && !used[e.id]; });
    if (!list.length) return null;
    return list[Math.floor(rng() * list.length)];
  }
  // 台本の1行を行オブジェクトにする (type は UI が実在の駒から決める)
  function ensembleLine(entry, type, side) { return mk(entry[0], type, side, entry[1], fill(entry[2], side)); }

  // ---- 説得が一度で終わらない (16章補足) ----
  // 追加で「まだだ」と返す回数 (0〜2)。香車は即決、角行は長い屁理屈、歩兵はすぐ揺らぐが決めきれない
  function persuadeExtraRounds(vType) {
    var k = baseKind(kindOf(vType)), r = rng();
    if (k === 'L') return 0;
    if (k === 'B') return r < 0.7 ? 2 : 1;
    if (k === 'P') return r < 0.5 ? 2 : 1;
    if (k === 'S' || k === 'N') return r < 0.5 ? 1 : 0;
    return r < 0.35 ? 1 : 0;
  }
  var ROUND_LABEL = {
    persuade: ['こちらへ来い。悪いようにはしない。', '本当にいいのか。こちらへ来い。', '頼む、聞いてくれ。'],
    surrender: ['降伏しろ。', 'もう一度言う。降伏しろ。', '……もう一度だけ言う。降伏しろ。']
  };
  var RETORT_P = {
    B: ['まだだ。そもそも「悪いようにはしない」の「悪い」とは何かね。定義から聞こうか。', '話にならん。君の勧誘は、前提と結論が斜めにずれている。……いや、斜めは好きだが。'],
    P: ['え、えっと……ちょっと待ってください、まだ決められなくて……!', 'う……行きたい気もするけど……やっぱり……いや、でも……!'],
    N: ['まだだね! 跳ねる前にもうちょっと考えさせて!'],
    S: ['まだじゃ。年寄りは返事が遅いものよ。'],
    G: ['まだだ! 近衛の忠義を甘く見るな!'],
    R: ['まだだ! 口じゃなく拳で来い!'],
    L: ['断る。']
  };
  function persuadeRound(a, v, round) {
    var base = persuasion(a, v);
    if (!round) return base;
    base.options.forEach(function (o) {
      if (ROUND_LABEL[o.kind]) { o.label = ROUND_LABEL[o.kind][Math.min(round, 2)]; o.speak = mk('a', a.type, a.side, o.speak.face, o.label); }
    });
    return base;
  }
  function persuadeRetort(v) {
    var k = baseKind(kindOf(v.type));
    var pool = RETORT_P[k] || ['まだだ。話にならん。'];
    return mk('v', v.type, v.side, k === 'P' ? 'hurt' : (k === 'B' ? 'smug' : 'angry'), resolve(pickFrom(pool, 'retort:' + k), v.side));
  }

  // ---- 囲い (17章)。盤の駒コード (正=先手、負=後手、1歩…8玉) だけで判定する ----
  var PCODE = { P: 1, L: 2, N: 3, S: 4, G: 5, B: 6, R: 7, K: 8 };
  var CASTLES = [
    { id: 'funa', name: '舟囲い', story: '舟の陣', pieces: [['K', 7, 8], ['G', 6, 9], ['G', 5, 8], ['S', 7, 9]] },
    { id: 'mino', name: '美濃囲い', story: '美濃の砦', pieces: [['K', 2, 8], ['S', 3, 8], ['G', 4, 9], ['G', 5, 8]] },
    { id: 'takamino', name: '高美濃', story: '高き砦', pieces: [['K', 2, 8], ['S', 3, 8], ['G', 4, 9], ['G', 4, 7]] },
    { id: 'ginkan', name: '銀冠', story: '銀の冠', pieces: [['K', 2, 8], ['S', 2, 7], ['G', 3, 8], ['G', 4, 7]] },
    { id: 'hidarimino', name: '左美濃', story: '左の砦', pieces: [['K', 8, 8], ['S', 7, 8], ['G', 6, 9], ['G', 5, 8]] },
    { id: 'yagura', name: '金矢倉', story: '矢倉城', pieces: [['K', 8, 8], ['G', 7, 8], ['S', 7, 7], ['G', 6, 7]] },
    { id: 'ianaguma', name: '居飛車穴熊', story: '穴熊の洞', pieces: [['K', 9, 9], ['L', 9, 8], ['S', 8, 8], ['G', 7, 9]] },
    { id: 'fanaguma', name: '振り飛車穴熊', story: '西の穴熊', pieces: [['K', 1, 9], ['L', 1, 8], ['S', 2, 8], ['G', 3, 9]] }
  ];
  var CASTLE_BY_ID = {};
  CASTLES.forEach(function (c) { CASTLE_BY_ID[c.id] = c; });
  var CASTLE_CHAIN = { mino: 1, takamino: 2, ginkan: 3 };
  // 筋 f・段 r (先手基準) → 盤の升。後手は 180度回す (f→10-f, r→10-r)
  function castleSquares(c, side) {
    return c.pieces.map(function (p) {
      var f = p[1], r = p[2];
      if (side === 1) { f = 10 - f; r = 10 - r; }
      return { t: p[0], sq: (r - 1) * 9 + (9 - f) };
    });
  }
  function detectCastle(board, side) {
    var sign = side === 0 ? 1 : -1, found = null;
    for (var i = 0; i < CASTLES.length; i++) {
      var sqs = castleSquares(CASTLES[i], side), ok = true;
      for (var j = 0; j < sqs.length; j++) if (board[sqs[j].sq] !== sign * PCODE[sqs[j].t]) { ok = false; break; }
      if (ok) found = CASTLES[i]; // 後の行 (発展形) を優先
    }
    return found ? { id: found.id, name: found.name, story: found.story, squares: castleSquares(found, side) } : null;
  }
  // 前の囲い → 今の囲い の変化。戻り値: イベントの配列
  function castleTransition(prevId, curId) {
    if (prevId === curId) return [];
    if (prevId && curId && CASTLE_CHAIN[prevId] && CASTLE_CHAIN[curId] && CASTLE_CHAIN[curId] > CASTLE_CHAIN[prevId]) return [{ type: 'develop', from: prevId, id: curId }];
    var ev = [];
    if (prevId) ev.push({ type: 'collapse', id: prevId });
    if (curId) ev.push({ type: 'complete', id: curId });
    return ev;
  }
  // 1手ごとの囲いの状態更新 (猶予つき)。
  // st = {last: 直近に完成した囲い, brokenAt: 崩れた手数|null}。崩れてから CASTLE_GRACE 手以内に
  // 同じ系列の発展形 (美濃→高美濃→銀冠) が完成したら「発展」、猶予を過ぎたら「崩壊」
  var CASTLE_GRACE = 6;
  function castleStep(st, curId, ply) {
    st = st ? { last: st.last || null, brokenAt: st.brokenAt == null ? null : st.brokenAt } : { last: null, brokenAt: null };
    var ev = [], last = st.last;
    if (curId) {
      if (curId === last) { st.brokenAt = null; }
      else if (last && CASTLE_CHAIN[last] && CASTLE_CHAIN[curId] && CASTLE_CHAIN[curId] > CASTLE_CHAIN[last]) {
        ev.push({ type: 'develop', from: last, id: curId }); st.last = curId; st.brokenAt = null;
      } else {
        if (last) ev.push({ type: 'collapse', id: last });
        ev.push({ type: 'complete', id: curId }); st.last = curId; st.brokenAt = null;
      }
    } else if (last) {
      if (st.brokenAt == null) st.brokenAt = ply;
      else if (ply - st.brokenAt >= CASTLE_GRACE) { ev.push({ type: 'collapse', id: last }); st.last = null; st.brokenAt = null; }
    }
    return { state: st, events: ev };
  }

  // 会話の役: k=玉 / g=金 / s=銀 / l=香 (囲いの駒) / any=自軍の駒
  var CASTLE_TALK = {
    funa: [['g', 'smug', '舟の陣、組み上がりました! この舟、沈めはしません!'], ['k', 'normal', { s: '小さな舟だが、よく揺れに耐えそうだ。ありがとう。', g: '舟か。余を乗せるには小さいが、まあよい。' }]],
    mino: [['s', 'smug', '美濃の砦、ここに成る。'], ['g', 'joy', '{主}、こちらは堅いですぞ。'], ['k', 'normal', { s: 'ありがとう。心強い。', g: 'うむ。よき砦だ。' }]],
    takamino: [['g', 'joy', '砦を一段高く積みました!'], ['k', 'normal', { s: '高き砦か。見晴らしがいいな。', g: '高き砦か。よい眺めだ。' }]],
    ginkan: [['s', 'smug', '銀の冠、戴きましたぞ。'], ['k', 'joy', { s: '冠をかぶるのは、私ではなく君たちだな。', g: '冠か。宝玉より、よほど軽い。' }]],
    hidarimino: [['s', 'normal', '左の砦、組み上がりました。'], ['g', 'smug', '右から来る敵には、我らが壁となる。'], ['k', 'normal', { s: '頼りにしている。', g: 'よかろう。壁であれ。' }]],
    yagura: [['g', 'smug', '矢倉城、完成! 正面からは崩させません。'], ['s', 'normal', '石垣は、わしが積んだようなものじゃ。'], ['k', 'joy', { s: '見事な城だ。皆、ありがとう。', g: '見事な城だ。褒めてつかわす。' }]],
    ianaguma: [['l', 'normal', '……穴熊の洞。ここから動かない。'], ['k', 'normal', { s: '狭いが、落ち着くな。', g: '暗いが……悪くない。' }], ['g', 'smug', '洞の入口は、私が塞ぐ。']],
    fanaguma: [['l', 'normal', '西の穴熊。……奥に籠もった。'], ['s', 'smug', 'ここなら王の首は遠いのう。'], ['k', 'normal', { s: '籠もるのは性に合わないが……頼む。', g: '籠もるのは好かぬが、任せる。' }]]
  };
  // 発展の会話: 組み替えごとに別の台詞 (2〜3通りから選ぶ)
  var CASTLE_DEVELOP = {
    'mino>takamino': [
      [['g', 'joy', '金を一枚、上へ。砦を一段高く積みました!'], ['k', 'joy', { s: '高くなった分、遠くまで見渡せる。ありがとう。', g: '一段上がったか。悪くない眺めだ。' }]],
      [['g', 'smug', '四七の金、ここに立つ。美濃の砦が高き砦へ!'], ['s', 'smug', '高い城壁は、年寄りにはありがたいのう。']],
      [['g', 'normal', '{主}、上の守りも固めておきました。'], ['k', 'normal', { s: '頭上の守りまで……頼もしいな。', g: '気が利くな。褒めてつかわす。' }]]
    ],
    'takamino>ginkan': [
      [['s', 'smug', 'わしが上へ出て、金が下を守る。これぞ銀の冠よ。'], ['g', 'joy', '一度崩したのは、冠を戴くためでしたか!'], ['k', 'joy', { s: '組み替えの間は冷や汗をかいたよ。', g: '崩れたと思わせて冠か。小癪だが見事だ。' }]],
      [['s', 'normal', '高き砦の上に、銀の冠を載せた。'], ['g', 'smug', 'これで上からの攻めも怖くない。']],
      [['g', 'normal', '冠の下に入りました。ここが一番堅い。'], ['s', 'smug', '冠は重いが、わしの頭には合うようじゃ。']]
    ],
    'mino>ginkan': [
      [['s', 'smug', '美濃からまっすぐ冠まで、一気に組み上げたわい。'], ['k', 'joy', { s: '一足飛びだな。皆、見事だ。', g: '一気に冠とはな。急いた割には堅い。' }]],
      [['g', 'joy', '砦を飛ばして、いきなり冠です!'], ['s', 'normal', '若いのは手が早いのう。だが、悪くない。']]
    ]
  };
  var CASTLE_COLLAPSE = [['k', 'hurt', { s: '砦が……! 皆、持ちこたえてくれ!', g: '砦が崩れたか……うろたえるな!' }], ['any', 'angry', '{主}、まだです! 我らがいます!']];
  var CASTLE_COLLAPSE_SETS = [CASTLE_COLLAPSE];
  function castleLines(list, side) {
    return list.map(function (e) {
      var type = { k: 'K', g: 'G', s: 'S', l: 'L', any: null }[e[0]];
      return { role: e[0], type: type, side: side, face: e[1], text: resolve(e[2], side) };
    });
  }
  function castleTalk(kind, id, side, from) {
    if (kind === 'develop') {
      var key = (from || 'mino') + '>' + id;
      var variants = CASTLE_DEVELOP[key] || CASTLE_DEVELOP['mino>takamino'];
      return castleLines(pickFrom(variants, 'dev:' + key), side);
    }
    if (kind === 'collapse') return castleLines(pickFrom(CASTLE_COLLAPSE_SETS, 'ccol'), side);
    return castleLines(pickFrom(CASTLE_TALK[id] || CASTLE_TALK.mino, 'ct:' + id), side);
  }
  // 相手の囲いへの反応 (反応する側 side の駒が言う)
  function castleReaction(kind, id, side) {
    var c = CASTLE_BY_ID[id] || CASTLES[0];
    var text = kind === 'collapse'
      ? resolve(pickFrom(['敵の' + c.story + 'を崩したぞ!', '砦は破った! 今だ、押し込め!', '{敵}の砦が崩れた! 続け!'], 'crc'), side)
      : resolve(pickFrom(['敵は' + c.story + 'に籠もったぞ……。手強い。', '{敵}め、' + c.story + 'を築いたか。', 'あの' + c.story + '、どう崩す……?'], 'cre'), side);
    return { role: 'any', type: null, side: side, face: kind === 'collapse' ? 'joy' : 'hurt', text: text };
  }
  function igyokuWarning(side) {
    return { role: 'g', type: 'G', side: side, face: 'angry', text: side === 0 ? '王よ、せめて囲いの中へ!' : '陛下、せめて囲いの中へ!' };
  }
  function castleInfo(id) { var c = CASTLE_BY_ID[id]; return c ? { id: c.id, name: c.name, story: c.story } : null; }

  // ---- 二歩の禁 (反則負けの場面。STORY.md「禁忌を破ったとき」) ----
  // 戻り値: 場面の配列。{kind:'talk'|'narr'|'unbind', line|text}
  // 4.5 二歩の場面: 神や世界の決まりには触れない。兵が命令に迷う
  function nifuScene(side) {
    var o = side ^ 1;
    return [
      { kind: 'silence' },
      { kind: 'talk', line: mk('old', 'P', side, 'surprise', '……お前も、ここへ行けと言われたのか。') },
      { kind: 'talk', line: mk('new', 'P', side, 'hurt', 'ああ。同じ道を。') },
      { kind: 'narr', text: '二人の歩兵は、動けなくなった。' },
      { kind: 'unbind' },
      { kind: 'talk', line: mk('near', 'G', side, 'surprise', '王は、同じ道に二人を送った。') },
      { kind: 'talk', line: mk('near', 'S', side, 'hurt', '命令が、おかしい。') },
      { kind: 'talk', line: mk('k' + side, 'K', side, 'hurt', side === 0 ? '私の命令が、兵を迷わせたのか。' : '余の命令が、兵を迷わせたのか。') },
      { kind: 'talk', line: mk('k' + o, 'K', o, 'angry', '兵に迷う命令を出す王に、この戦は預けられぬ。') }
    ];
  }

  // ---- 駒1枚ずつの二つ名 (27章): 「出自・前の暮らし・持ち場」+「の」+兵種名。出自は一生変わらない ----
  // 先手 (解放軍) は村や暮らしの場所、後手 (帝国) は軍や宮廷の持ち場
  var NICKS = [
    {
      P: ['渡し船', '粉屋', '羊飼い小屋', '炭焼き窯', '渡り鳥の沼', '北の牧場の柵', '樵の小屋', '漁師町', '祭り囃子', '井戸端', '麦踏み', '寺子屋',
        '宿場の馬小屋', '川向こうの村', '雪かき当番', '野鍛冶', '染物屋', '炊き出し', '蕎麦畑', '峠の地蔵'],
      L: ['粉挽き小屋', '杭打ち場', '火の見櫓', '薪割り場', '川漁の簗', '物見の丘', '渡し場', '石切り場', '葦原'],
      N: ['峠の茶屋', '馬喰町', '早飛脚', '蹄鉄屋', '宿場の厩', '牧草地', '流鏑馬の祭り', '隣村の牧場', '街道の木戸'],
      S: ['古井戸', '隠れ里', '抜け道', '炭焼き小屋の裏', '囲炉裏端', '夜回り', '山寺の床下', '薬草摘み', '古道'],
      G: ['鍛冶場', '砦の門番', '村の自警団', '鐘つき堂', '庄屋の屋敷', '番小屋', '石垣積み', '水車小屋', '見張り台'],
      B: ['写本院', '星読みの庵', '村の学び舎', '天馬の厩舎', '古書庫'],
      R: ['北の牧場', '熊撃ちの谷', '力比べの土俵', '峠越えの運び屋', '砕石場'],
      K: ['北の辺境', '湊の焼け跡', '雪の砦', '父王の城']
    },
    {
      P: ['第三兵舎', '第五兵舎', '南方隊', '閲兵場', '夜番詰所', '旗持ち隊', '帳簿部屋', '衛兵見習い所', '伝令所', '兵糧庫', '練兵場の隅', '城壁当番',
        '新兵訓練所', '南の砦', '点呼係', '行進隊', '銀釦隊', '鼓笛隊', '馬糧小屋', '宿営地'],
      L: ['宮廷厨房', '槍衾隊', '城門の脇', '突撃隊', '鉄槍工房', '近衛予備隊', '直進隊', '黒槍隊', '城壁の上'],
      N: ['関所番', '伝騎隊', '竜騎隊', '儀仗隊', '帝都の厩', '白馬隊', '騎兵学校', '斥候隊', '国境の砦'],
      S: ['密書係', '宮廷の影', '毒見役', '宝物庫番', '回廊の見張り', '黒衣衆', '鍵番', '帳の陰', '地下牢番'],
      G: ['玉座の間', '近衛隊長付き', '金章隊', '宮殿の大扉', '勅使護衛', '儀礼係', '双璧の間', '王宮の階段', '勅命係'],
      B: ['星見の塔', '宮廷魔導院', '秘儀の間', '首席書記室', '星図室'],
      R: ['西方軍', '南征軍', '帝国の大車輪隊', '鉄血連隊', '凱旋門の守り'],
      K: ['南の王都', '宝玉の間', '三十年の玉座', '黄昏の宮殿']
    }
  ];
  // 表示: 出自 + 「の」 + いまの兵種名 (成ると兵種名だけ昇格後の名に替わる)
  // V1: 家名と出自で語が重なる (北の車家の北の牧場・南の馬家の白馬隊・騎兵学校の騎兵 など) ときは、出自を外して「家名の兵種」にする
  function nickRepeats(origin, houseName, cls) {
    if (!origin || !houseName) return false;
    var dir = houseName.charAt(0), kin = houseName.charAt(2); // 北の車家 → 北・車
    if (origin.indexOf(dir) >= 0 || origin.indexOf(kin) >= 0) return true;
    for (var i = 0; i + 1 < origin.length; i++) { var bg = origin.substr(i, 2); if (bg.indexOf('の') < 0 && cls.indexOf(bg) >= 0) return true; }
    return false;
  }
  function nickLabel(origin, type, side, houseName) {
    var cls = classOf(type, side);
    if (nickRepeats(origin, houseName, cls)) origin = '';
    return (houseName ? houseName + 'の' : '') + (origin ? origin + 'の' + cls : cls);
  }
  var CODE_BASE = ['', 'P', 'L', 'N', 'S', 'G', 'B', 'R', 'K', 'P', 'L', 'N', 'S', '', 'B', 'R'];
  var HAND_TYPES = ['P', 'L', 'N', 'S', 'G', 'B', 'R'];
  function baseOfType(t) { return t && t.charAt(0) === '+' ? t.slice(1) : t; }
  /*
   * 駒の同一性を追う (DOM・エンジンに依存しない)。
   * init = {board:[81 駒コード], hands:[[0,歩,香,桂,銀,金,角,飛], [...]]}、moves = エンジンの指し手の配列。
   * 打つときは、その駒種の持ち駒のうち先に捕虜になった駒から呼ぶ。
   * 戻り値: {board: 升→駒ID (-1=空), hands: [{P:[ID...]...}, {...}], meta: [{id, side(元の陣営), base}]}
   */
  function trackIdentities(init, moves, onStep) {
    var board = new Array(81), hands = [{}, {}], meta = [], id = 0, sq, k;
    for (sq = 0; sq < 81; sq++) {
      var c = init.board[sq];
      if (!c) { board[sq] = -1; continue; }
      meta.push({ id: id, side: c > 0 ? 0 : 1, base: CODE_BASE[c < 0 ? -c : c] });
      board[sq] = id++;
    }
    [0, 1].forEach(function (s) {
      HAND_TYPES.forEach(function (t, i) {
        hands[s][t] = [];
        var n = (init.hands[s] && init.hands[s][i + 1]) || 0;
        for (k = 0; k < n; k++) { meta.push({ id: id, side: s, base: t }); hands[s][t].push(id++); }
      });
    });
    (moves || []).forEach(function (m) {
      var to = m.to.y * 9 + m.to.x;
      if (m.drop) {
        var arr = hands[m.side][baseOfType(m.piece)] || [];
        var did = arr.length ? arr.shift() : -1;
        board[to] = did;
        if (onStep) onStep(m, { id: did, capturedId: -1 });
        return;
      }
      var from = m.from.y * 9 + m.from.x, mid = board[from], cid = -1;
      board[from] = -1;
      if (m.captured) { cid = board[to]; hands[m.side][baseOfType(m.captured)].push(cid); }
      board[to] = mid;
      if (onStep) onStep(m, { id: mid, capturedId: cid });
    });
    return { board: board, hands: hands, meta: meta };
  }
  // 二つ名を割り当てる (陣営・駒種ごとの候補から重複なく)。戻り値: ID → 二つ名
  function assignNicknames(meta, rand) {
    rand = typeof rand === 'function' ? rand : rng;
    var pools = {}, out = {};
    meta.forEach(function (p) {
      var key = p.side + p.base;
      if (!pools[key]) {
        var src = ((NICKS[p.side] || NICKS[0])[p.base] || NICKS[p.side].P).slice();
        for (var i = src.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var tmp = src[i]; src[i] = src[j]; src[j] = tmp; }
        pools[key] = { list: src, n: 0 };
      }
      var pl = pools[key], idx = pl.n % pl.list.length, base = pl.list[idx], round = Math.floor(pl.n / pl.list.length);
      // V1: 家名と重なる出自は「家名の兵種」になる。同じ家・同じ駒種で2つ目が重なったら、重ならない出自と入れ替える (同じ呼び名を2人にしない)
      var hh = HOUSES.filter(function (x) { return x.side === p.side && x.pieces.indexOf(p.base) >= 0; })[0], hcls = classOf(p.base, p.side);
      if (hh && !round && nickRepeats(base, hh.name, hcls)) {
        if (pl.rep) { for (var k = idx + 1; k < pl.list.length; k++) if (!nickRepeats(pl.list[k], hh.name, hcls)) { var t2 = pl.list[k]; pl.list[k] = base; pl.list[idx] = t2; base = t2; break; } }
        else pl.rep = true;
      }
      out[p.id] = round ? base + '其の' + (round + 1) : base; // 候補を使い切ったとき (検討用の局面だけ)
      pl.n++;
    });
    return out;
  }

  // ---- 下敷きの物語 (四条畷 / 三国志 序) から取り入れた場面 ----
  var MIDNIGHT_LINE = '三更を過ぎた。父なら、寝ろと叱るところだ。';
  function isMidnight(hour) { return hour >= 0 && hour < 4; }


  // 1局ごとの回数の上限
  var EVENT_CAPS = { shirakawa: 1, charge: 1, decoy: 1, archery: 2, rebuke: 1 };
  function eventAllowed(name, counts) { return ((counts || {})[name] || 0) < (EVENT_CAPS[name] || 0); }
  function zoneOf(side, y) { return side === 0 ? y <= 2 : y >= 6; }
  // 一直線の突撃: 飛車・龍・香車が敵陣三段目に入った
  function isCharge(m) {
    if (!m || m.drop || !m.from) return false;
    var t = m.piece;
    if (t !== 'R' && t !== '+R' && t !== 'L') return false;
    return !zoneOf(m.side, m.from.y) && zoneOf(m.side, m.to.y);
  }
  // 強弓: 角行・龍馬・香車が3升以上離れた駒を取った
  function isArchery(m) {
    if (!m || m.drop || !m.captured || !m.from) return false;
    var t = m.piece;
    if (t !== 'B' && t !== '+B' && t !== 'L') return false;
    return Math.max(Math.abs(m.from.x - m.to.x), Math.abs(m.from.y - m.to.y)) >= 3;
  }
  // 身代わり: 王手を受けた側が、王以外の駒で (合駒、または王手した駒を取って) 防いだ
  function isDecoy(wasInCheck, m) { return !!wasInCheck && !!m && m.piece !== 'K'; }
  // 竜馬の諫め: 角行が龍馬に昇格した
  function isRebuke(m) { return !!m && !m.drop && m.piece === 'B' && !!m.promote; }

  var CHARGE_LINES = {
    R: ['{名}、敵の本陣へ一直線!', '道を開けろ! {名}が本陣へ駆ける!'],
    '+R': ['{名}、天を裂いて本陣へ!', '龍の翼で、敵の奥まで一直線!'],
    L: ['……{名}。本陣まで、まっすぐ。', '{名}、ただ前へ。本陣へ。']
  };
  function chargeLine(type, side) { return mk('m', type, side, 'angry', resolve(pickFrom(CHARGE_LINES[type] || CHARGE_LINES.R, 'charge'), side)); }
  var ARCHER_LINES = {
    B: ['斜めの彼方まで、わが矢は届く。{名}、弓の名手と覚えておきたまえ。', '{名}の一矢。遠いほど、よく当たる。'],
    '+B': ['天馬の背から射る矢は外れない。{名}、ここにあり。', '{名}、空より射抜く。'],
    L: ['……{名}。槍を弓に持ち替えた。届いたな。', '{名}の強弓、一直線に。']
  };
  function archerLine(type, side) { return mk('a', type, side, 'smug', resolve(pickFrom(ARCHER_LINES[type] || ARCHER_LINES.B, 'archer'), side)); }
  function decoyLine(type, side) { return mk('m', type, side, 'angry', side === 1 ? '陛下の身代わりは、この私が。' : '暁王様の身代わりは、この私が。'); }
  function decoyFallLine(type, side) { return mk('v', type, side, 'hurt', '身代わりは、果たした……。'); }
  function rebukeLines(speakerType, side) {
    return [
      mk('r', speakerType, side, 'normal', '龍馬が出たのは、太平のしるしではない。乱の知らせだ。'),
      mk('r', speakerType, side, 'hurt', speakerType === 'S' ? '……年寄りの小言と思って、聞き流してくれてよい。' : '浮かれるな。戦は、まだ終わっておらぬ。')
    ];
  }
  // 白河の救出 (白河の大橋の戦場のみ)
  function shirakawa(side) {
    return {
      narr: '橋の上の戦いで、敵の兵たちが川へ落ちた。盤の外の、名もない兵たちだった。',
      lead: mk('k' + side, 'K', side, 'normal', side === 0 ? '川に落ちた兵たちがいる。……どうする。' : '川に落ちた敵兵どもか。……どう扱う。'),
      options: [
        opt('light', '引き上げて、着物と薬をやれ。', mk('k' + side, 'K', side, 'normal', side === 0 ? '敵も味方も、冷えれば同じように震える。' : '……濡れた兵を見捨てる帝にはなるまい。')),
        opt('shadow', '放っておけ。', mk('k' + side, 'K', side, 'smug', side === 0 ? '……今は、前だけを見る。' : '川が決めることだ。')),
        opt('harmony', '岸まで運び、故郷への道を教えてやれ。', mk('k' + side, 'K', side, 'joy', side === 0 ? '帰る家があるなら、そこへ帰ればいい。' : '帰してやれ。いずれ盤の外で会うこともあろう。'))
      ]
    };
  }
  var SHIRAKAWA_DEBT = '白河で救われた恩を、ここで返す。';
  // 5章: 盤上の駒に「恩を返す」台詞は出さない (白河で救ったのは盤外の兵)。呼んでも何も返さない
  function shirakawaDebtLine() { return null; }

  // ---- 章回 (節目の語りを「第○回」の対句の題にする) ----
  // 廃止 (56章): 章回の題札・題・視点人物は表示しない。CHAPTER_NO・CHAPTERS・PAIR_TITLE・chapterTitle・pickViewpoint は
  // 使われない記録として残す (物語の文章データベースでは「廃止」の印。RETIRED_ROOTS)
  var RETIRED_ROOTS = ['CHAPTER_NO', 'CHAPTERS', 'PAIR_TITLE', 'STORY_NOTES'];
  // 56章: 陣中日誌から再開したときの短い語り (題札の代わり)
  var RESUME_NARR = '戦は続いている。';
  var CHAPTER_NO = { 5: '第一回', 15: '第二回', 30: '第三回', 45: '第四回', 60: '第五回' };
  // ctx = {captures, majorLost, castle, rain, promotions, checks}
  var CHAPTERS = {
    10: [
      { when: function (c) { return c.rain; }, lines: ['雨に煙る九路の野に', '槍の穂先は濡れて光る'] },
      { when: function (c) { return c.castle; }, lines: ['早くも砦を築く一軍あり', '王は囲いの奥に息を整え'] },
      { when: function (c) { return c.captures > 0; }, lines: ['初めの一合に捕虜を得て', '寝返る兵は新しき旗を仰ぐ'] },
      { when: function (c) { return c.checks > 0; }, lines: ['早き王手に陣は揺れ', '王はなお一歩も退かず'] },
      { when: null, lines: ['朝霧晴れて両軍相見え', '新兵は敵旗の近きに驚く'] }
    ],
    30: [
      { when: function (c) { return c.majorLost; }, lines: ['大駒ひとつ敵に落ち', '兵らは主の顔を窺う'] },
      { when: function (c) { return c.promotions > 0; }, lines: ['敵陣深く踏み入りて', '一兵ついに位を進む'] },
      { when: function (c) { return c.castle; }, lines: ['砦の石は日に白く', '近衛は王の傍らを守る'] },
      { when: function (c) { return c.rain; }, lines: ['昼の雨は泥を深くし', '騎兵の蹄も重くなる'] },
      { when: null, lines: ['日は高く刃は交わり', '捕虜の旗は風に鳴る'] }
    ],
    60: [
      { when: function (c) { return !!c.pair; }, linesFor: function (c) { return PAIR_TITLE[c.pair]; }, lines: ['構え違えし両軍の', '黄昏に陣を張り合う'] },
      { when: function (c) { return c.captures >= 10; }, lines: ['討ちつ討たれつ数を知らず', '寝返りし者の名は数え切れず'] },
      { when: function (c) { return c.checks >= 2; }, lines: ['黄昏の王手は影を長くし', '近衛は身を盾として立つ'] },
      { when: function (c) { return c.rain; }, lines: ['夕立は旗を重くし', '両の王はなお動かず'] },
      { when: null, lines: ['黄昏は旗を赤く染め', '両の王はなお盤を睨む'] }
    ],
    90: [
      { when: function (c) { return c.majorLost; }, lines: ['大駒を失いし陣の夜は長く', '残る兵は松明を囲む'] },
      { when: function (c) { return c.promotions >= 3; }, lines: ['位を得し兵ら闇を照らし', '新兵は古参の背を追う'] },
      { when: function (c) { return c.rain; }, lines: ['夜の雨は火を細くし', '見張りは闇に耳を澄ます'] },
      { when: null, lines: ['夜は深く松明は揺れ', '眠らぬ兵は故郷を語る'] }
    ],
    120: [
      { when: function (c) { return c.captures >= 15; }, lines: ['捕虜と味方の見分けもつかず', '盤上は一つの軍に似る'] },
      { when: function (c) { return c.castle; }, lines: ['砦はなお崩れずして', '二度目の朝を迎う'] },
      { when: null, lines: ['二度目の暁は泥を照らし', '長き戦はなお決せず'] }
    ]
  };
  // 43章: 旧キー (10/30/60/90/120) を新しい節目へ
  (function () { var old = {}; Object.keys(CHAPTERS).forEach(function (k) { old[k] = CHAPTERS[k]; delete CHAPTERS[k]; }); Object.keys(old).forEach(function (k) { CHAPTERS[NEW_MILESTONE[k] || k] = old[k]; }); })();
  var PAIR_TITLE = {
    taikou: ['構え違えし両軍の', '黄昏に陣を張り合う'],
    aifuri: ['飛車を左に回せし両軍', '鏡に映るがごとく戦う'],
    aiibisha: ['本陣を動かさぬ二つの軍', '正面より力を比べ合う']
  };
  // 節目の出来事に合う題を選ぶ (当てはまるものから1つ。なければ既定の題)
  function chapterTitle(ply, ctx, rand) {
    var list = CHAPTERS[ply];
    if (!list) return null;
    rand = typeof rand === 'function' ? rand : rng;
    ctx = ctx || {};
    var hits = list.filter(function (c) { return c.when && c.when(ctx); });
    if (!hits.length) hits = list.filter(function (c) { return !c.when; });
    var pick = hits[Math.floor(rand() * hits.length)];
    return { no: CHAPTER_NO[ply], lines: (pick.linesFor ? pick.linesFor(ctx) : pick.lines).slice() };
  }

  // ---- 結末の二行詩 (結末ごと。道で変わる結末は道ごと) ----
  var POEMS = {
    '1-light': ['手を触れずして玉は谷へ', '夜ごと底より声は呼ぶ'],
    '1-harmony': ['剣を置きし二人の王', '一つの卓に朝を分かつ'],
    '1-shadow': ['包まれし玉は奥に眠り', '王の手はなおそれを知る'],
    '2-light': ['麦の袋を背に北へ帰る', '黄昏の色は少し明るし'],
    '2-shadow': ['光は北の空まで届き', '答えなき問いは盤に残る'],
    '2-harmony': ['夜ごとの盤に二人は座し', '宝玉の囁きは遠のきゆく'],
    '3-light': ['名もなき新兵の金の背に', '凱旋の列は長く続く'], '3-shadow': ['位を得し兵は数を誇り', '凱旋の鐘は遠くまで鳴る'], '3-harmony': ['位を得し兵は剣を収め', '凱旋の道に花を拾う'],
    '4-light': ['縫い合わせし二つの旗の', '継ぎ目に新しき国が立つ'], '4-shadow': ['敵の兵を数に加えて', '勝ちし軍はなお大きくなる'], '4-harmony': ['敵も味方も同じ旗の下', '故郷の歌を二つ歌う'],
    '5-light': ['三日の戦の果てに見し', '朝日は敵も味方も照らす'], '5-shadow': ['嗄れし声で勝ちを名乗り', '長き戦の重さを知る'], '5-harmony': ['座り込みし兵らの背に', '同じ朝日が等しく落ちる'],
    '6-light': ['四たび巡りし盤の上', '天は戦を静かに止む'], '6-shadow': ['勝ちも負けもなき千日に', '剣は鞘の中で錆びる'], '6-harmony': ['千日の夜の明けし朝', '二人の王は言葉を交わす'],
    '7-light': ['追い回せし王の背に', '雷は帥旗を焼く'], '7-shadow': ['勝ちを焦りし一手ごと', '天の怒りは近くなる'], '7-harmony': ['戦を止められし兵らは', '故郷へ続く道を歩む'],
    '8-light': ['十三の兵はそばを離れず', '戻らぬ名は夜に読み上げらる'],
    '8-shadow': ['宝玉へ伸ばしかけし手を', '下ろせし時に夜は明けず'],
    '8-harmony': ['剣を置きて言葉を残す', '罰せられぬ兵の夜は静か'],
    '9-light': ['遠ざかる荷に頭を垂れ', '名君の名を遅れて継ぐ'],
    '9-shadow': ['囁きの絶えし夜を聞き', '帝は重荷を初めて下ろす'],
    '9-harmony': ['遠ざける前に交わせし言葉', '夜明けまで盤の上に続く'],
    '10-light': ['掲げし白旗は兵を救い', '敗れし王は名を残す'], '10-shadow': ['白旗は風に重くはためき', '王は一人で帰り道を行く'], '10-harmony': ['白き旗の下に剣を置き', '両の兵は同じ火に当たる'],
    '11-shadow': ['冠に玉をはめし王の', '目の色を知る者はなし'],
    '12-harmony': ['一枚の盤を挟みて座し', '指すは駒ならず国の行く末'],
    '15-harmony': ['夜明けの卓に宝玉を伏せ', '二人の王は手を膝に置く'], '16-harmony': ['黄昏の卓に布を掛け', '帝はなお囁きに耳を塞ぐ'],
    '13-light': ['三十年の玉を外して', '帝は素顔を民にさらす'],
    '14-light': ['一筋に二人並びし新兵の', 'いずれも動けず今に至る'], '14-shadow': ['一筋に並びし二人の兵', '命じし王の声は届かず'], '14-harmony': ['同じ道に並びし二人は', '譲り合いて動けずにある']
  };
  function poemOf(key) { return POEMS[key] ? POEMS[key].slice() : null; }

  // 戦記の巻物 (記録画面)
  var SCROLL_CLOSING = '盤上の人々は、今もどこかで生きている。あなたの隣の誰かに、よく似た顔をして。';
  // 廃止 (59章): 物語メモは記録画面に出さない。下敷きの2作の情報はゲームの画面に出さない (設計書 STORY_v1.md の記録は残す)
  var STORY_NOTES = {
    title: '物語メモ',
    lines: [
      JEWEL_LINES[0],
      JEWEL_LINES[1],
      '暁の中興 ― 旧帝を倒した功の分け前は宮廷が独り占めし、兵は報われなかった。',
      '黄昏帝 ― 報われぬ兵に担がれ、宝玉を奪って帝国を興した男。いまは宝玉に呑まれつつある。勝利の重さを最も知る。',
      '父王の遺訓 ―「私が倒れれば、世は黄昏のものになる。それでも、義を失うな。」',
      '白河の恩・一直線の突撃・身代わり・強弓・龍馬の諫め は、下敷きの物語の場面を盤上に置き換えたもの。',
      '下敷きの物語: 菊池寛『四条畷の戦』、吉川英治『三国志』序(いずれも青空文庫)',
      '三更の一言 (午前0〜4時の語り部の一言) は、吉川英治『三国志』序の、夜更けまで読んで父に叱られた思い出からの翻案。'
    ],
    // 8章: 出典欄 (青空文庫の公認や関与を示す書き方はしない)
    sources: [
      { work: '四条畷の戦', author: '菊池寛', base: '『日本合戦譚』(文春文庫)', url: 'https://www.aozora.gr.jp/cards/000083/card1369.html',
        used: '中興の崩壊と恩賞の不満、竜馬諫奏、父子の遺訓、橋から落ちた敵兵の救出、一直線の突撃・身代わり・強弓、伝承に少し嘘が混じることへの語り手の考え方(いずれも筋立てや考え方だけを取り入れ、文は引いていない)', changed: '人物と地名を架空のものに置き換え、将棋の盤上の場面に移した' },
      { work: '三国志 序', author: '吉川英治', base: '『三国志(一)』(講談社 吉川英治歴史時代文庫)', url: 'https://www.aozora.gr.jp/cards/001562/card52409.html',
        used: '正史ではないという断り、詩のある戦記、人物は今も生きているという考え、夜更けに読んで叱られた思い出 (翻案)', changed: '語り部の言葉として短く書き直した' }
    ]
  };

  // ---- 戦法 (29章)。局面と指し手の履歴だけで判定する。座標は先手基準、後手は180度回す ----
  var STRATS = {
    naka: { name: '中飛車', story: '中央突破の陣', hero: 'R', group: 'furi', lines: [['h', 'angry', '真ん中を割って進む。{名}、ここに陣取る!'], ['k', 'normal', { s: '正面からか。君らしいな。', g: '正面とは、余の好みだ。' }]], react: '敵は飛車を真ん中に据えたぞ。正面から来る!' },
    shiken: { name: '四間飛車', story: '四の道の陣', hero: 'R', group: 'furi', lines: [['h', 'smug', '左へ回る。本陣は銀と金に任せた。'], ['p', 'normal', '任された。ここは一歩も通さぬ。']], react: '敵は飛車を振ったぞ。持久戦になる。' },
    sanken: { name: '三間飛車', story: '三の道の陣', hero: 'R', group: 'furi', lines: [['h', 'smug', '三の道に構えた。いつでも石を投げ込めるぞ。'], ['p', 'smug', '身軽な構えじゃのう。']], react: '敵の飛車が三の道へ。動きが速いぞ。' },
    ishida: { name: '石田流', story: '石田の構え', hero: 'R', group: 'furi', lines: [['h', 'angry', '石田の構え、整った。ここから一気に崩す!'], ['p', 'surprise', 'ぼ、僕が先頭ですか!?']], react: '石田の構えだ……。あの飛車は浮いて来るぞ。' },
    mukai: { name: '向かい飛車', story: '向かい討ちの陣', hero: 'R', group: 'furi', lines: [['h', 'angry', '敵の飛車の正面へ。向かい討ちだ!'], ['k', 'normal', { s: '真っ向勝負か。頼む。', g: '向かい討ちとは、気が強い。' }]], react: '敵は飛車をこちらの飛車にぶつけてきた!' },
    ibisha: { name: '居飛車', story: '本陣構え', hero: 'R', group: 'ibi', lines: [['h', 'normal', '飛車は本陣を動かず。腰を据えて行く。'], ['k', 'normal', { s: '焦らず行こう。', g: 'それでよい。' }]], react: '敵の飛車は動かない。本陣構えだ。' },
    migishiken: { name: '右四間飛車', story: '右の四の道', hero: 'R', group: 'ibi', lines: [['h', 'angry', '右の四の道へ。一点を破る!'], ['p', 'joy', '跳んで加勢するよ!']], react: '敵が右の四の道に飛車を回した。一点狙いだ!' },
    bougin: { name: '棒銀', story: '一本槍の銀', hero: 'S', group: 'ibi', lines: [['h', 'angry', '一本槍、まっすぐ行くぞ。'], ['p', 'normal', '後ろは任せろ!']], react: '敵の銀がまっすぐ来る。棒銀だ!' },
    hayakuri: { name: '早繰り銀', story: '早駆けの銀', hero: 'S', group: 'ibi', lines: [['h', 'smug', '年寄りの早駆けじゃ。遅れるでないぞ。'], ['p', 'surprise', '無茶すんなよ!']], react: '敵の銀が早足で出てきた!' },
    koshikake: { name: '腰掛け銀', story: '腰掛けの銀', hero: 'S', group: 'ibi', lines: [['h', 'normal', 'ここに腰を下ろす。動くのは、相手が動いてからじゃ。'], ['p', 'normal', '中央は任せた。']], react: '敵の銀が真ん中に腰を下ろしたぞ。' },
    kakugawari: { name: '角換わり', story: '術師の交換', hero: 'B', group: 'ibi', lines: [['h', 'smug', '術師同士、手札を交換したね。さて、どこで使うか。'], ['k', 'normal', { s: '使いどころが大事だな。', g: '切り札は最後まで取っておけ。' }]], react: '角を持ち合った。打ち込みに気をつけろ。' },
    yokofu: { name: '横歩取り', story: '横取りの奇策', hero: 'R', group: 'ibi', lines: [['h', 'smug', '横の歩、いただき! 奇策は嫌いじゃないだろう?'], ['p', 'normal', '品はないが、理屈には合っている。']], react: '敵の飛車が横から歩をさらった! 乱戦になるぞ。' }
  };
  var PAIR_TEXT = {
    taikou: { name: '対抗形', text: '北と南、構えの違う軍が向かい合った。' },
    aifuri: { name: '相振り飛車', text: '両軍とも飛車を左に回した。鏡を見るような戦になった。' },
    aiibisha: { name: '相居飛車', text: '両軍とも本陣を動かさない。正面からの力比べだ。' }
  };
  var FURI_FILE = { 5: 'naka', 6: 'shiken', 7: 'sanken', 8: 'mukai', 4: 'migishiken' };
  function sqFor(side, f, r) { if (side === 1) { f = 10 - f; r = 10 - r; } return (r - 1) * 9 + (9 - f); }
  // その陣営から見た筋 (先手基準の番号)
  function fileFor(side, x) { return side === 0 ? 9 - x : x + 1; }
  function rookFileOf(board, side, withPromoted) {
    var sign = side === 0 ? 1 : -1;
    for (var q = 0; q < 81; q++) if (board[q] === sign * 7 || (withPromoted && board[q] === sign * 15)) return fileFor(side, q % 9);
    return null;
  }
  /*
   * positions: 対局開始からの局面の配列 [{board, hands, ply, lastMove}, ...] (エンジンの state をそのまま渡せる)
   * 戻り値: {events: [{type:'strategy', ply, side, id, name, story} | {type:'pair', ply, id, name, text}], main: [先手の主戦法, 後手の主戦法], mainFile}
   */
  function detectStrategies(positions, maxPly) {
    maxPly = maxPly || 40;
    function blank() { return { fired: {}, furiDone: false, file: 2, stay: 0, leftFile2: false, ibiChecked: false, cls: null, main: null, mainFile: null }; }
    var st = [blank(), blank()], events = [], pairDone = false, kakuDone = false;
    for (var i = 1; i < (positions || []).length; i++) {
      var P = positions[i], m = P.lastMove;
      if (!m || P.ply > maxPly) continue;
      var ply = P.ply, mover = m.side, b = P.board;
      var fire = function (s, id, file) {
        if (st[s].fired[id]) return;
        st[s].fired[id] = true;
        var d = STRATS[id];
        events.push({ type: 'strategy', ply: ply, side: s, id: id, name: d.name, story: d.story });
        if (!st[s].cls) { st[s].cls = d.group; st[s].main = id; st[s].mainFile = file != null ? file : (d.group === 'ibi' ? 2 : null); }
      };
      for (var s = 0; s < 2; s++) {
        var S = st[s], f = rookFileOf(b, s, false), sign = s === 0 ? 1 : -1;
        if (f !== 2) S.leftFile2 = true;
        if (s === mover) { if (f !== S.file) { S.file = f; S.stay = 0; } else S.stay++; }
        // 飛車を振る戦法: 落ち着いた筋 (2手以上とどまった筋) で1回だけ
        if (s === mover && f != null && FURI_FILE[f] && S.stay >= 2) {
          var fid = FURI_FILE[f];
          if (fid === 'migishiken') fire(s, fid, 4);
          else if (!S.furiDone) { S.furiDone = true; fire(s, fid, f); }
        }
        if (S.fired.sanken && f === 7 && b[sqFor(s, 7, 6)] === sign * 7 && b[sqFor(s, 7, 5)] === sign * 1) fire(s, 'ishida', 7);
        // 居飛車: 20手目の時点で飛車が一度も2筋を離れていない
        if (ply >= 20 && !S.ibiChecked) { S.ibiChecked = true; if (!S.leftFile2) fire(s, 'ibisha', 2); }
        // 銀の戦法 (飛車が2筋)
        if (f === 2) {
          var sv = sign * 4;
          if (b[sqFor(s, 2, 6)] === sv || b[sqFor(s, 2, 5)] === sv) fire(s, 'bougin', 2);
          if (ply <= 25 && (b[sqFor(s, 4, 6)] === sv || b[sqFor(s, 3, 5)] === sv)) fire(s, 'hayakuri', 2);
          if (b[sqFor(s, 5, 6)] === sv) fire(s, 'koshikake', 2);
        }
        // 横歩取り: 飛車が3四 (後手なら7六) の歩を取る
        if (s === mover && ply <= 30 && m.piece === 'R' && m.captured === 'P' && !m.drop && m.to.y * 9 + m.to.x === sqFor(s, 3, 4)) fire(s, 'yokofu', 3);
      }
      // 角換わり: 20手目までに両軍が角を持ち駒にしている
      if (!kakuDone && ply <= 20 && P.hands && P.hands[0][6] >= 1 && P.hands[1][6] >= 1) { kakuDone = true; fire(0, 'kakugawari', 2); fire(1, 'kakugawari', 2); }
      if (!pairDone && st[0].cls && st[1].cls) {
        pairDone = true;
        var pid = st[0].cls === 'furi' && st[1].cls === 'furi' ? 'aifuri' : (st[0].cls === 'ibi' && st[1].cls === 'ibi' ? 'aiibisha' : 'taikou');
        events.push({ type: 'pair', ply: ply, id: pid, name: PAIR_TEXT[pid].name, text: PAIR_TEXT[pid].text });
      }
    }
    return { events: events, main: [st[0].main, st[1].main], mainFile: [st[0].mainFile, st[1].mainFile] };
  }
  // 主戦法が最後まで続いたか (飛車・龍が主戦法の筋にいる。角換わり・横歩取りは成立していれば続いたとみなす)
  function strategyHeld(board, side, id, file) {
    if (!id) return false;
    if (id === 'kakugawari' || id === 'yokofu') return true;
    return rookFileOf(board, side, true) === file;
  }
  function strategyReact(id, side) { var d = STRATS[id]; return resolve(pickFrom(d.reacts || [d.react], 'sr:' + id), side); }
  function strategyLines(id, side) {
    var d = STRATS[id];
    return pickFrom(d.linesAlt || [d.lines], 'sl:' + id).map(function (e) {
      var type = e[0] === 'h' ? d.hero : (e[0] === 'k' ? 'K' : null);
      return { role: e[0], type: type, side: side, face: e[1], text: resolve(e[2], side) };
    });
  }

  // ---- 振り飛車の幕間 (55章)。飛車は車家の当主なので、飛車を振ることは「車家の当主の決断」として描く ----
  // 役: h = 振った側の飛車 / g = 金将 / k = 王 / l = 香車 / n = 桂馬 / b = 角行 / p = 歩兵 / e = 相手の飛車
  var FURI_ROLE = { h: 'R', g: 'G', k: 'K', l: 'L', n: 'N', b: 'B', p: 'P', p2: 'P', e: 'R' };
  var FURI_SCENES = {
    shiken: {
      lines: [['h', 'smug', '車家の当主として決めた。俺は左の四の道へ回る。右の砦は任せたぞ。'],
        ['g', 'normal', { s: '任された。王のおそばは、この古参が固めます。', g: '任された。陛下のおそばは、この老骨が固めよう。' }],
        ['k', 'normal', { s: '飛車がいなくなると、ずいぶん静かだな。', g: '飛車の背が遠い。……余の前が、広くなった。' }],
        ['g', 'normal', '静かなうちに、砦を組みましょう。石は低く、横へ長く積むのがよいかと。']],
      cpu: [['h', 'smug', '左の四の道へ回る。守りは固めておけ。'], ['g', 'normal', '承知。……当主どのの背が、遠くなりますな。']]
    },
    sanken: {
      lines: [['h', 'angry', '三の道に陣を取る。ここから先は、待たずに攻めるぞ。'],
        ['l', 'normal', '当主の背中を追います。前が空いたら、一番に走ります。'],
        ['h', 'normal', '走るのはいい。だが、まっすぐ死ぬなよ。'],
        ['l', 'smug', '車家の者は、まっすぐしか知りません。']],
      cpu: [['h', 'angry', '三の道から行く。遅れるな。'], ['l', 'normal', '当主の背中、見失いません。']]
    },
    ishida: {
      lines: [['h', 'smug', '高く構えた。ここからなら、敵の陣がよく見える。'],
        ['n', 'joy', '当主どの、跳ぶ足なら貸しますよ。馬家の者ですけどね。'],
        ['b', 'smug', '車家と馬家が並ぶとは。……今日だけだよ。家に帰れば、また言い争う。'],
        ['h', 'joy', '今日だけで十分だ。行くぞ。']],
      cpu: [['h', 'smug', '高く構えた。馬家の足を借りるぞ。'], ['n', 'normal', '貸すだけですよ。返してくださいね。']]
    },
    naka: {
      lines: [['h', 'angry', 'まっすぐ、敵の真ん中へ。道を開けろ!'],
        ['p', 'surprise', 'は、はい! 右へ寄ります!'],
        ['p2', 'normal', '左へ寄ります! ……当主さまの通り道、広いなあ。'],
        ['h', 'smug', '広くしておけ。帰り道も、ここを通る。']],
      cpu: [['h', 'angry', '真ん中を割る。道を開けろ。'], ['p', 'surprise', 'は、はい!']]
    },
    gokigen: {
      lines: [['h', 'joy', 'はっはっは! 真ん中だ、真ん中! 今日は気分がいい!'],
        ['b', 'normal', '斜めの道を開けたまま、もう振るのかい。せっかちだね。'],
        ['h', 'joy', '開いているなら、そのままでいい! 斜めはお前が見ておけ!'],
        ['b', 'smug', '……まったく。こういう日の車家は、止めても無駄だ。']],
      cpu: [['h', 'joy', 'はっはっは! 真ん中だ!'], ['b', 'smug', '……今日の当主は、手がつけられないね。']]
    },
    // 向かい飛車: 北の車家と南の車家の当主どうしが盤をはさんで向かい合う (どちらが振っても1局1回)
    mukai: {
      lines: [['e', 'normal', '同じ筋に立ったか。……車輪の音で、すぐにわかった。'],
        ['h', 'normal', '向かい合うのは、中興の夜以来だな。']],
      lead: ['h', 'normal', '……'],
      options: [['light', '言葉をかける。', '……言葉は届いた。だが、退けぬ。互いにな。'],
        ['shadow', '構わず討つ。', 'それでいい。手加減されるほうが、家の恥だ。'],
        ['harmony', '家の昔の話をする。', '鍛冶場の煤の匂いか。……覚えている。忘れたことはない。']]
    }
  };
  var FURI_IDS = { shiken: 1, sanken: 1, ishida: 1, naka: 1, mukai: 1 };
  // ごきげん中飛車: 10手目までに中飛車に振り、その時点で両軍の角が盤上にあり、自軍の角道 (先手なら7七の歩) が開いている
  function isGokigen(board, side, ply) {
    if (ply > 10) return false;
    var bish = [false, false];
    for (var q = 0; q < 81; q++) { var c = board[q], a = c < 0 ? -c : c; if (a === 6 || a === 14) bish[c > 0 ? 0 : 1] = true; }
    if (!bish[0] || !bish[1]) return false;
    var sign = side === 0 ? 1 : -1;
    return board[sqFor(side, 7, 7)] !== sign * 1;
  }
  // 向かい飛車の幕間: 自軍の飛車 (未成) と相手の飛車 (未成) が同じ筋にいる
  function rooksFace(board, side) {
    var mine = -1, theirs = -1, sign = side === 0 ? 1 : -1;
    for (var q = 0; q < 81; q++) { if (board[q] === sign * 7) mine = q % 9; if (board[q] === -sign * 7) theirs = q % 9; }
    return mine >= 0 && mine === theirs;
  }
  function furiKey(id) { return id === 'gokigen' ? 'naka' : id; }
  // S6: 飛車がいまの筋 (file) へ移った局面。そこから今まで同じ筋に留まっている並びの最初 (戦法の確定は2手留まってからなので、判定はこの局面で)
  function swingPos(positions, side, file) {
    var k = positions.length - 1;
    while (k > 0 && rookFileOf(positions[k - 1].board, side, false) === file) k--;
    return positions[k];
  }
  /*
   * positions: 対局開始からの局面の配列。mem: {done: {種類: true}, last: 最後に幕間を出した手数, pending: [候補]}
   * 戻り値 {pick: {id, side, ply} | null, mem: 次の mem}。幕間は振り飛車の種類ごとに1局1回 (中飛車とごきげん中飛車は同じ枠)。
   * 幕間どうしは2手以上空ける (三間→石田流など)。出せなかった候補は6手まで待つ
   */
  function furiInterlude(positions, mem) {
    mem = mem ? JSON.parse(JSON.stringify(mem)) : { done: {}, last: -99, pending: [] };
    mem.done = mem.done || {}; mem.pending = mem.pending || []; if (mem.last == null) mem.last = -99;
    var P = positions && positions[positions.length - 1];
    if (!P) return { pick: null, mem: mem };
    var ply = P.ply, r = detectStrategies(positions);
    r.events.forEach(function (e) {
      if (e.type !== 'strategy' || e.ply !== ply || !FURI_IDS[e.id]) return;
      var id = e.id;
      if (id === 'naka') { var sw = swingPos(positions, e.side, 5); if (isGokigen(sw.board, e.side, sw.ply)) id = 'gokigen'; } // S6: 振った時点の手数・角・歩で分類
      if (id === 'mukai' && !rooksFace(P.board, e.side)) return; // 向かい合っていなければ帯とひとことだけ
      if (mem.pending.some(function (c) { return furiKey(c.id) === furiKey(id); })) return;
      mem.pending.push({ id: id, side: e.side, ply: ply });
    });
    var pick = null, keep = [];
    mem.pending.forEach(function (c) {
      if (mem.done[furiKey(c.id)] || ply - c.ply > 6) return;
      if (c.id === 'mukai' && !rooksFace(P.board, c.side)) return; // S7: 延期した向かい飛車は、出す時点でも両軍の飛車 (未成) が同じ筋にいるときだけ
      if (!pick && ply - mem.last >= 2) { pick = c; return; }
      keep.push(c);
    });
    mem.pending = keep;
    if (pick) { mem.done[furiKey(pick.id)] = true; mem.prev = mem.last; mem.last = ply; }
    return { pick: pick, mem: mem };
  }
  // 出せなかった (会話の予算がない) 幕間を候補に戻す
  function furiDefer(mem, pick) {
    mem = JSON.parse(JSON.stringify(mem));
    delete mem.done[furiKey(pick.id)];
    mem.last = mem.prev != null ? mem.prev : -99;
    mem.pending.unshift(pick);
    return mem;
  }
  // 幕間の台詞。side = 話す側 (向かい飛車では h の側。e は相手の飛車)、cpu = 相手側の短い幕間
  function furiLines(id, side, cpu) {
    var d = FURI_SCENES[id]; if (!d) return [];
    return ((cpu && d.cpu) || d.lines).map(function (e) {
      var sd = e[0] === 'e' ? side ^ 1 : side;
      return { role: e[0], type: FURI_ROLE[e[0]], side: sd, face: e[1], name: labelOf(FURI_ROLE[e[0]], sd), text: resolve(e[2], sd) };
    });
  }
  function furiChoice(side) {
    var d = FURI_SCENES.mukai;
    return { lead: mk(d.lead[0], 'R', side, d.lead[1], d.lead[2]),
      options: d.options.map(function (o) { return { path: o[0], label: o[1], reply: mk('e', 'R', side ^ 1, 'normal', o[2]) }; }) };
  }

  // ---- 打つ升の段による型 (30章) ----
  // 打つ側から見て: 自陣(三段) / 中間 / 敵陣
  function dropZone(side, y) { var rank = side === 0 ? y : 8 - y; return rank >= 6 ? 'home' : (rank <= 2 ? 'enemy' : 'mid'); }
  // 裏切り: 元の所属 (origSide) の陣に、いまの持ち主 (dropSide) が敵陣として打った
  function isBetrayal(origSide, dropSide, zone) { return zone === 'enemy' && origSide !== dropSide; }
  // 捨て駒: 敵陣に打った升に相手の利きがある
  function isSacrifice(zone, attackedByOpponent) { return zone === 'enemy' && !!attackedByOpponent; }
  /*
   * ctx = {type, side, zone, origSide, origin(出自), check, mate, sacrifice, defend, lvl}
   * 戻り値: {style:'home'|'mid'|'enemy', kind, cutin, after:[行], band}
   *   行の役: m=打った駒 / k=自軍の王 / e=近くの敵の駒 / x=近くの自軍の駒 (大駒優先)
   */
  function summonByZone(ctx) {
    var t = ctx.type, s = ctx.side, pawn = t === 'P', lvl = ctx.lvl || 2, zone = ctx.zone;
    var M = function (face, text) { return mk('m', t, s, face, fill(text, s)); };
    var cut = mk('m', t, s, 'angry', resolve(pickFrom(CUTIN[kindOf(t)] || CUTIN.P, 'cut2:' + t), s));
    var after = [], kind = zone, band = null;
    var returning = ctx.origSide === s;
    if (zone === 'home') {
      kind = ctx.defend ? 'defend' : (returning ? 'return' : 'welcome');
      if (kind === 'defend') { after.push(M('angry', pickFrom(DEFEND, 'defend2'))); after.push(mk('k', 'K', s, 'joy', resolve(pickFrom(KING_THANKS, 'thanks2'), s))); }
      else if (returning) { after.push(mk('k', 'K', s, 'joy', s === 0 ? 'よく戻った。' : 'よく戻った。席はそのままだ。')); after.push(M('normal', '……戻りました。もう離れません。')); }
      else { after.push(mk('k', 'K', s, 'normal', s === 0 ? '今日からお前も、暁の軍だ。' : '今日からお前も、帝国の兵だ。')); after.push(M('hurt', '……この恩は忘れない。')); }
      if (lvl >= 3 && !pawn) after.push(mk('x', null, s, 'joy', pickFrom(['新しい顔だ。よろしく頼む。', '歓迎するぞ。背中は預けた。'], 'welc')));
    } else if (zone === 'mid') {
      kind = 'front';
      after.push(M('angry', pickFrom(['前線へ。ここから押し返す!', '援軍、参上。持ち場はここだ。', '前に出る。後ろは頼んだ。'], 'front')));
      if (!pawn) after.push(mk('x', null, s, 'normal', pickFrom(['援軍か、助かる。', '待っていたぞ。', 'よく来てくれた。'], 'frontx')));
    } else {
      band = '奇襲';
      if (ctx.betray) {
        kind = 'betray';
        after.push(mk('e', null, s ^ 1, 'surprise', 'お前……' + (ctx.origin || 'あの隊') + 'の……!'));
        after.push(M('smug', 'この陣の抜け道は、全部知っている。'));
      } else if (ctx.sacrifice) {
        kind = 'sacrifice';
        after.push(M('angry', 'ここで討たれても構わない。道は開く。'));
        if (!pawn) after.push(mk('x', null, s, 'hurt', '……その覚悟、無駄にはしない。'));
      } else {
        kind = 'surprise';
        after.push(M('smug', '誰も、ここに来るとは思わなかっただろう。'));
      }
    }
    if (ctx.mate) { band = '決着の召喚'; after.unshift(M('smug', pickFrom(MATE_SUMMON, 'mate2'))); }
    else if (ctx.check) { band = '奇襲!'; after.push(mk('k2', 'K', s ^ 1, 'surprise', resolve(pickFrom(SURPRISED_KING, 'surk2'), s ^ 1))); }
    if (pawn || lvl <= 1) after = after.slice(0, 1);
    else if (lvl === 2) after = after.slice(0, 3);
    return { style: zone, kind: kind, cutin: cut, after: after, band: band };
  }

  // ---- 囲いの助言 (31章) ----
  var ADVICE = {
    ibi: ['funa', 'yagura', 'hidarimino', 'ianaguma'],
    furi: ['mino', 'takamino', 'ginkan', 'fanaguma'],
    label: { funa: '舟囲いで、早く備えよう。', yagura: '矢倉で、腰を据えよう。', hidarimino: '左美濃で、硬く広く。', ianaguma: '穴熊に籠もろう。',
      mino: '美濃で備えよう。', takamino: '高美濃まで組もう。', ginkan: '銀冠まで組もう。', fanaguma: '穴熊に籠もろう。', attack: '今は攻めだ。囲いは後でよい。' },
    reply: { funa: '承知しました。舟囲いは早さが命です。', yagura: '承知。矢倉は時がかかりますが、崩れにくい城です。', hidarimino: '左美濃。広く構えて、上からの攻めにも備えましょう。',
      ianaguma: '穴熊……。籠もる覚悟、しかと受け取りました。', mino: '美濃の砦。手早く、しかも堅く。', takamino: '高美濃まで。一段高い砦にいたしましょう。',
      ginkan: '銀冠まで組めば、上からの攻めにも崩れません。', fanaguma: '西の穴熊へ。奥深く籠もりましょう。', attack: '……承知。囲いは後回しに。ご武運を。' },
    near: ['あと少しで整います。', 'よい形になってきました。', 'その調子です。砦が見えてきました。'],
    giveup: '……まあ、攻めを優先するのも一つの道でしょう。',
    done: { s: 'お見事。これで暁王様も安心です。', g: 'お見事。これで陛下も安心です。' }
  };
  // 囲いまでの遠さ: 囲いの駒それぞれについて、同じ種類の自軍の駒からの最短距離 (チェビシェフ) の和
  function castleDistance(board, side, castleId) {
    var c = CASTLE_BY_ID[castleId]; if (!c) return 99;
    var sign = side === 0 ? 1 : -1, used = {}, total = 0;
    castleSquares(c, side).forEach(function (q) {
      var best = 99, bsq = -1;
      for (var s2 = 0; s2 < 81; s2++) {
        if (used[s2] || board[s2] !== sign * PCODE[q.t]) continue;
        var d = Math.max(Math.abs(s2 % 9 - q.sq % 9), Math.abs(((s2 / 9) | 0) - ((q.sq / 9) | 0)));
        if (d < best) { best = d; bsq = s2; }
      }
      if (bsq >= 0) used[bsq] = true;
      total += best;
    });
    return total;
  }
  // 飛車の位置で候補を出し分け、組みやすい順に3つ + 「今は攻めだ」
  function adviceOptions(board, side) {
    var f = rookFileOf(board, side, false);
    var group = f === 2 || f === null ? 'ibi' : 'furi';
    var ids = ADVICE[group].slice().sort(function (a, b) { return castleDistance(board, side, a) - castleDistance(board, side, b); }).slice(0, 3);
    return { group: group, options: ids.map(function (id) { return { id: id, label: ADVICE.label[id] }; }).concat([{ id: 'attack', label: ADVICE.label.attack }]) };
  }
  // 次の一手の目印: 合法手のうち、囲いまでの遠さを最も減らす手 (囲いの駒の種類だけ)
  function adviceNextMove(board, side, castleId, legalMoves) {
    var c = CASTLE_BY_ID[castleId]; if (!c) return null;
    var want = {}; c.pieces.forEach(function (p) { want[p[0]] = true; });
    var base = castleDistance(board, side, castleId), best = null, bestD = base;
    (legalMoves || []).forEach(function (m) {
      if (m.drop || !want[m.piece] || m.captured || m.promote) return;
      var b2 = board.slice(), from = m.from.y * 9 + m.from.x, to = m.to.y * 9 + m.to.x;
      b2[to] = b2[from]; b2[from] = 0;
      var d = castleDistance(b2, side, castleId);
      if (d < bestD) { bestD = d; best = m; }
    });
    return best;
  }
  // 助言の進み: closer=囲いに近づいたか。2〜3手に1回だけ反応、3手続けて外れたら一度だけ言って打ち切り
  function adviceStep(st, closer) {
    st = Object.assign({ miss: 0, sinceReact: 9, active: true }, st || {});
    if (!st.active) return { state: st, action: null };
    if (closer) {
      st.miss = 0; st.sinceReact++;
      if (st.sinceReact >= 2) { st.sinceReact = 0; return { state: st, action: 'react' }; }
      return { state: st, action: null };
    }
    st.miss++; st.sinceReact++;
    if (st.miss >= 3) { st.active = false; return { state: st, action: 'giveup' }; }
    return { state: st, action: null };
  }
  // 攻撃を受けている: 王手、または王の周り2升に相手の利き
  function kingUnderAttack(attackMap, kingSq, inCheck) {
    if (inCheck) return true;
    if (kingSq == null || kingSq < 0) return false;
    var kx = kingSq % 9, ky = (kingSq / 9) | 0;
    for (var s2 = 0; s2 < 81; s2++) if (attackMap[s2] && Math.max(Math.abs(s2 % 9 - kx), Math.abs(((s2 / 9) | 0) - ky)) <= 2) return true;
    return false;
  }

  // ---- 名家 (54章、STORY_v1.md 10章): 名家を率いるのは大駒だけ。家の名は駒の字から (車 = 飛車・香車、馬 = 角行(龍馬)・桂馬) ----
  // 車家と馬家は中興のあと北と南に分かれ、同じ家の者が両軍に分かれて戦っている。当主は飛車・角行、家臣は香車・桂馬。金将・銀将・歩兵・王は家なし
  var HOUSES = [
    { id: 'kuruma_n', side: 0, kin: 'kuruma', name: '北の車家', crest: '雲を割って走る戦車の車輪', motto: 'まっすぐ、果てまで', pieces: ['R', 'L'], head: 'R', stance: '鍛冶と兵の家。武勲で成り上がった。貴族を嫌い、南に分かれた同族の不満にも理解がある。' },
    { id: 'uma_n', side: 0, kin: 'uma', name: '北の馬家', crest: '翼のある馬', motto: '斜めにも道はある', pieces: ['B', 'N'], head: 'B', stance: '川沿いの商いの家。中興のとき恩賞を奪われた側で、南の馬家と縁が切れていない。寝返りの噂が絶えない。' },
    { id: 'kuruma_s', side: 1, kin: 'kuruma', name: '南の車家', crest: '冠を戴く車輪', motto: '触れれば轢く', pieces: ['R', 'L'], head: 'R', stance: '帝の武勇を支えた武門。帝への忠誠は本物だが、民に恐れられている。北の車家を裏切り者と呼ぶ。' },
    { id: 'uma_s', side: 1, kin: 'uma', name: '南の馬家', crest: '天秤を背負う馬', motto: 'すべては釣り合う', pieces: ['B', 'N'], head: 'B', stance: '帝国の宰相家。帝が宝玉に呑まれていくのを冷たく見つめ、宝玉を狙う。' }
  ];
  var HOUSE_BY_ID = {}; HOUSES.forEach(function (h) { HOUSE_BY_ID[h.id] = h; });
  // 駒ID → 家ID。飛車・香車 = 車家、角行・桂馬 = 馬家 (陣営で北・南)。金将・銀将・歩兵・王は家なし
  function assignHouses(meta) {
    var out = {};
    meta.forEach(function (p) {
      var h = HOUSES.filter(function (x) { return x.side === p.side && x.pieces.indexOf(p.base) >= 0; })[0];
      if (h) out[p.id] = h.id;
    });
    return out;
  }
  function houseOf(id) { return HOUSE_BY_ID[id] || null; }
  // 家の中の立場: 'head' = 当主 (飛車・角行) / 'retainer' = 家臣 (香車・桂馬) / null = 家なし
  function houseRole(houseId, base) { var h = HOUSE_BY_ID[houseId]; if (!h || h.pieces.indexOf(base) < 0) return null; return base === h.head ? 'head' : 'retainer'; }
  // 同族 (北と南に分かれた同じ家) か
  function isKin(a, b) { var x = HOUSE_BY_ID[a], y = HOUSE_BY_ID[b]; return !!(x && y && x.kin === y.kin && x.side !== y.side); }
  // 家どうしの対立 (自軍の名家の駒が取られたとき、同じ軍のもう一つの家の者が言う)。もう一組の対立 (北と南の同族) は KIN_CAPTURE
  var HOUSE_RIVAL = {
    uma_n: { by: 'kuruma_n', text: '北の馬家の者はもとから南の馬家と通じていた。' },
    kuruma_n: { by: 'uma_n', text: '北の車家の連中はまた突っ込みすぎた。' },
    kuruma_s: { by: 'uma_s', text: '南の車家の失態……陛下に申し上げるべきか。いや、まだ黙っておこう。' },
    uma_s: { by: 'kuruma_s', text: '南の馬家の者が捕らわれた。……宝玉の話を、敵に漏らさねばよいが。' }
  };
  // 54章: 同族どうしの駒取り (北の車家と南の車家、北の馬家と南の馬家)。a = 取る側、v = 取られる側
  var KIN_CAPTURE = {
    kuruma: [
      { a: '同じ車輪の紋を背負って、なぜそちらに立つ。', v: '轍が分かれた日に、聞くべきだったな。' },
      { a: 'まっすぐ来たな。昔と同じ走り方だ。', v: '同じ鍛冶場で覚えた走り方だ。止まれなかった。' },
      { a: '紋は同じでも、行く先は違ったか。', v: '果てまで行けば、また会えると思っていた。' }
    ],
    uma: [
      { a: '同じ馬の紋だ。……斜めに逃げてもよかったのだぞ。', v: '逃げ道を数えるのは、昔からそちらの役目だった。' },
      { a: '馬家の者どうし、天秤はどちらに傾いた。', v: '釣り合わぬから、こうなった。' },
      { a: '文は届いていた。返事を書けなかった。', v: '……読まずに燃やしたと思っていた。' }
    ]
  };
  function kinCapture(attHouse, vicHouse) {
    if (!isKin(attHouse, vicHouse)) return null;
    var k = HOUSE_BY_ID[attHouse].kin;
    return pickFrom(KIN_CAPTURE[k], 'kin:' + k);
  }
  function houseRival(houseId) { return HOUSE_RIVAL[houseId] || null; }
  // 帝国の内紛 (南の馬家の宰相が宝玉を狙っている) — 帝国側の群像会話
  ENSEMBLE.push(
    { id: 'g-intrigue1', trigger: 'intrigue', side: 1, roles: { a: 'B|N', b: 'G' }, lines: [['a', 'smug', '陛下は近ごろ、宝玉ばかりご覧になる。……重荷を、誰かが代わりに持てばよいのだが。'], ['b', 'angry', '宰相家の。その言葉、私は聞かなかったことにする。'], ['a', 'normal', 'すべては釣り合う。今は、それだけだ。']] },
    { id: 'g-intrigue2', trigger: 'intrigue', side: 1, roles: { a: 'R|L', b: 'B|N' }, lines: [['a', 'angry', '南の馬家の者が北へ使いを出したと聞いた。何の使いだ。'], ['b', 'smug', '和平の打診、とでも言っておこうか。車家には関わりのないことだ。'], ['a', 'angry', '……触れれば轢く。覚えておけ。']] },
    { id: 's-houses1', trigger: 'intrigue', side: 0, roles: { a: 'G|S', b: 'B|N' }, lines: [['a', 'normal', '北の馬家の。南にいる縁者とは、まだ文を交わしているのか。'], ['b', 'hurt', '……斜めにも道はある、と家では言う。いつか同じ家の者と並べればと思っているだけだ。'], ['a', 'normal', '先代に従った身だ。私は王から離れない。それだけは覚えておけ。']] }
  );
  // 伝令の鴉 (章回の切り替わりに、盤の外の知らせ)。1局で重複させない
  var RAVEN_NEWS = [
    { text: '麦の里が焼かれた。', place: '麦の里' },
    { text: '南の馬家の使いが、ひそかに北へ向かった。', place: '九峰山脈' },
    { text: '東の宿場で、兵が逃げ出した。', place: '東の宿場' },
    { text: '鏡の内海に、見慣れぬ船団が現れた。', place: '鏡の内海' },
    { text: '白河の大橋の番小屋が、夜のうちに空になった。', place: '白河の大橋' },
    { text: '黄昏の都で、宝玉の間の扉が三日閉ざされている。', place: '黄昏の都' },
    { text: '暁の砦に、北の馬家の荷車が届いた。中身は誰も知らない。', place: '暁の砦' },
    { text: '九峰の雪が、例年より早く解け始めた。', place: '九峰山脈' },
    { text: '東の宿場の宿の主が、両軍に同じ値で麦を売っている。', place: '東の宿場' }
  ];
  function pickRaven(used, rand) {
    rand = typeof rand === 'function' ? rand : rng;
    var cand = RAVEN_NEWS.map(function (n, i) { return i; }).filter(function (i) { return !(used || {})[i]; });
    if (!cand.length) return null;
    var i = cand[Math.floor(rand() * cand.length)];
    return { index: i, text: RAVEN_NEWS[i].text, place: RAVEN_NEWS[i].place };
  }
  // 勝利の代償 (取られたまま終局した、自軍の名家の駒)
  var HOUSE_LOSS = {
    uma_n: '北の馬家の者は戻らなかった。川沿いの店はその年から戸を閉ざした。',
    kuruma_n: '北の車家の車輪は主を失って鍛冶場の壁に掛けられた。',
    uma_s: '南の馬家の天秤は片方に傾いたまま、宰相の机に置かれていた。',
    kuruma_s: '南の車家の冠は持ち主のないまま武具庫の奥に眠った。'
  };
  var EMPIRE_AFTER = '南の馬家の宰相は宝玉に魅入られ、その夜から宝玉の間に足しげく通うようになった。';
  function victoryCost(lostHouseIds) { var h = (lostHouseIds || []).filter(function (x) { return HOUSE_LOSS[x]; })[0]; return h ? HOUSE_LOSS[h] : null; }
  // 家々のその後 (結果 × 道)
  var HOUSE_AFTER = {
    uma_n: { s: '北の馬家は川の商いを取り戻し、両岸に店を開いた。', g: '北の馬家は南の馬家の縁者を頼り、川の向こうへ渡った。', d: '北の馬家の舟は両軍の兵を分け隔てなく運んだ。' },
    kuruma_n: { s: '北の車家は剣を打つのをやめ、鍬を打ち始めた。', g: '北の車家の鍛冶場は帝国の命で閉じられた。鉄を打つ音は夜にだけ響いた。', d: '北の車家は両軍の折れた剣を集め、一本の鐘に打ち直した。' },
    uma_s: { s: '南の馬家は宮廷を去り、帳簿だけを抱えて南へ消えた。', g: '南の馬家は宰相の座を守り、帝のそばで天秤を傾け続けた。', d: '南の馬家は和議の文書を書き、その写しを両方の都に納めた。' },
    kuruma_s: { s: '南の車家は武具を差し出し、冠を墓に埋めた。', g: '南の車家は都の守りを任され、民はなおその名を恐れた。', d: '南の車家の若い者たちは初めて剣を持たずに市場を歩いた。' }
  };
  var HOUSE_PATH = { light: 'その名は民の側で語られた。', shadow: 'その名は恐れとともに語られた。', harmony: 'その名は和議の席で語られた。' };
  function houseAftermath(result, path) {
    var key = result.winner === 0 ? 's' : (result.winner === 1 ? 'g' : 'd');
    return HOUSES.map(function (h) { return { house: h.id, name: h.name, text: HOUSE_AFTER[h.id][key] + HOUSE_PATH[path || 'light'] }; });
  }
  // 廃止 (56章): 章回の視点人物 (直前に動いた駒 → 取られそうな駒 → 成った駒 の順に候補)。表示しない
  function pickViewpoint(cands) { for (var i = 0; i < (cands || []).length; i++) if (cands[i] != null && cands[i] >= 0) return cands[i]; return -1; }

  // ---- 追加の台詞ファイル (dialogue_more.js) ----
  // 形: { lines: {既存と同じキー: [追加候補]}, ensembles: [群像会話], newTriggers: [判定名 または {id}] }
  // キーの読み方: LINES の駒種 ({P:{attack:[..]}} または 'P.attack')、'HITO.rain' や HITO のカテゴリ名、HITO_KIND の 'P:idleLong'、
  //   名前つきの表 (MERCY など)、駒取りの型 'duel.a' / 'CT.duel.a'、CUTIN の駒種
  var MORE_REPORT = { loaded: false, merged: 0, ensembles: 0, unknownKeys: [], badEnsembles: [], triggers: [], unknownTriggers: [], skipped: [] };
  var NAMED = { MERCY: MERCY, SURRENDER: SURRENDER, LOST_PROMO: LOST_PROMO, FIRST_SUMMON: FIRST_SUMMON, RETORT: RETORT, REPEAT_SUMMON: REPEAT_SUMMON,
    SURPRISE: SURPRISE, SURPRISED_KING: SURPRISED_KING, MATE_SUMMON: MATE_SUMMON, DEFEND: DEFEND, KING_THANKS: KING_THANKS, TURNCOAT: TURNCOAT,
    MESSAGE_DEFECT: MESSAGE_DEFECT };
  // 1組だけの表を「候補の組の配列」にそろえる (dialogue_more.js が候補を足せるように)
  Object.keys(COMBO_CAPTURE).forEach(function (k) { if (typeof COMBO_CAPTURE[k][0] === 'string') COMBO_CAPTURE[k] = [COMBO_CAPTURE[k]]; });
  Object.keys(COMBO_CHECK).forEach(function (k) { if (!Array.isArray(COMBO_CHECK[k][0])) COMBO_CHECK[k] = [COMBO_CHECK[k]]; });
  Object.keys(CASTLE_TALK).forEach(function (k) { if (typeof CASTLE_TALK[k][0][0] === 'string') CASTLE_TALK[k] = [CASTLE_TALK[k]]; });
  Object.keys(STRATS).forEach(function (k) { var d = STRATS[k]; d.linesAlt = [d.lines]; d.reacts = [d.react]; });
  function appendTo(arr, extra) { if (!Array.isArray(arr) || !Array.isArray(extra)) return 0; extra.forEach(function (x) { if (x) arr.push(x); }); return extra.length; }
  // キーは dialogue_more.js 冒頭の一覧どおり (内部変数のパス)。旧形式 ('P.attack' など) も受ける
  var WHEN_FN = {
    rain: function (c) { return !!c.rain; }, castle: function (c) { return !!c.castle; }, captures: function (c) { return c.captures > 0; },
    checks: function (c) { return c.checks > 0; }, majorLost: function (c) { return !!c.majorLost; }, promotions: function (c) { return c.promotions > 0; },
    pair: function (c) { return !!c.pair; }
  };
  // 囲いの完成・発展の台詞は、囲いどうしで同じ行を使わない (重なる組は取り込まずに報告する。短い返事は除く)
  function castleTexts(set) { var out = []; set.forEach(function (e) { var t = e[2]; if (typeof t === 'string') out.push(t); else if (t) { out.push(t.s); out.push(t.g); } }); return out; }
  function castleUnique(v, k) {
    var seen = {};
    [CASTLE_TALK, CASTLE_DEVELOP].forEach(function (tbl) { Object.keys(tbl).forEach(function (id) { tbl[id].forEach(function (set) { castleTexts(set).forEach(function (t) { seen[t] = true; }); }); }); });
    return v.filter(function (set) {
      if (!Array.isArray(set)) return false;
      var ts = castleTexts(set).filter(function (t) { return t && t.length > 8; }); // 「見事だ。」程度の短い返事は重なってよい
      if (ts.some(function (t) { return seen[t]; })) { MORE_REPORT.skipped.push(k + ': ' + ts.join(' / ')); return false; }
      ts.forEach(function (t) { seen[t] = true; });
      return true;
    });
  }
  function addTo(obj, key, v) { obj[key] = obj[key] || []; return appendTo(obj[key], v); }
  function mergeKey(k, v) {
    if (!Array.isArray(v) && !(v && typeof v === 'object')) return -1;
    var p = k.split('.'), head = p[0], rest = p.slice(1).join('.');
    if (head === 'LINES' && p.length === 3) return LINES[p[1]] ? addTo(LINES[p[1]], p[2], v) : -1;
    if (head === 'HITO' && p.length === 2) return addTo(HITO, p[1], v);
    if (head === 'HITO_KIND' && p.length === 2) return addTo(HITO_KIND, p[1], v);
    if (NAMED[head] && p.length === 1) return appendTo(NAMED[head], v);
    if (head === 'DEFECT_BY' && DEFECT_BY[rest]) return appendTo(DEFECT_BY[rest], v);
    if (head === 'CUTIN' && rest) return addTo(CUTIN, rest, v);
    if (head === 'RETORT_P' && rest) return addTo(RETORT_P, rest, v);
    if (head === 'CHARGE_LINES' && rest) return addTo(CHARGE_LINES, rest, v);
    if (head === 'ARCHER_LINES' && rest) return addTo(ARCHER_LINES, rest, v);
    if (head === 'COMBO_CAPTURE' && /^[A-Z]+>[A-Z]+$/.test(rest)) return addTo(COMBO_CAPTURE, rest, v.filter(function (x) { return Array.isArray(x) && x.length === 4; }));
    if (head === 'COMBO_CHECK' && rest) return addTo(COMBO_CHECK, rest, v.filter(function (x) { return Array.isArray(x) && x.length === 2; }));
    if (head === 'CASTLE_TALK' && CASTLE_TALK[rest]) return appendTo(CASTLE_TALK[rest], castleUnique(v, k));
    if (head === 'CASTLE_COLLAPSE' && p.length === 1) return appendTo(CASTLE_COLLAPSE_SETS, v.filter(Array.isArray));
    if (head === 'CASTLE_DEVELOP' && CASTLE_DEVELOP[rest]) return appendTo(CASTLE_DEVELOP[rest], castleUnique(v, k));
    if (head === 'STRATS' && p.length === 3 && STRATS[p[1]]) {
      if (p[2] === 'react') return appendTo(STRATS[p[1]].reacts, v.filter(function (x) { return typeof x === 'string'; }));
      if (p[2] === 'lines') return appendTo(STRATS[p[1]].linesAlt, v.filter(Array.isArray));
      return -1;
    }
    if (head === 'CHAPTERS' && CHAPTERS[NEW_MILESTONE[rest] || rest]) {
      var n = 0, list = CHAPTERS[NEW_MILESTONE[rest] || rest];
      v.forEach(function (c) {
        if (!c || !Array.isArray(c.lines) || c.lines.length !== 2) return;
        if (c.when != null && !WHEN_FN[c.when]) return;
        list.push({ when: c.when == null ? null : WHEN_FN[c.when], lines: c.lines.slice() }); n++;
      });
      return n;
    }
    if (head === 'CT' && CT[p[1]]) {
      var tbl = CT[p[1]];
      if (p.length === 3) return Array.isArray(tbl[p[2]]) || !tbl[p[2]] ? addTo(tbl, p[2], v) : -1;
      if (p.length === 4) { tbl[p[2]] = tbl[p[2]] || {}; return Array.isArray(tbl[p[2]]) ? -1 : addTo(tbl[p[2]], p[3], v); }
      return -1;
    }
    // 旧形式
    if (LINES[head] && p.length === 2) return addTo(LINES[head], p[1], v);
    if (LINES[head] && p.length === 1 && !Array.isArray(v)) { var m0 = 0; Object.keys(v).forEach(function (cat) { m0 += addTo(LINES[head], cat, v[cat]); }); return m0; }
    if (HITO[k]) return appendTo(HITO[k], v);
    if (/^[A-Z]{1,2}:[a-zA-Z]+$/.test(k)) return addTo(HITO_KIND, k, v);
    if (CT[head] && p.length === 2) { var t2 = CT[head][p[1]]; if (Array.isArray(t2)) return appendTo(t2, v); }
    return -1;
  }
  var FIELD_TRIGGER = { snow: 'fieldSnow', rock: 'fieldRock', river: 'fieldRiver', wheat: 'fieldWheat', gate: 'fieldGate' };
  var KNOWN_TRIGGERS = ['houseLost', 'ply20', 'ply45', 'behind', 'ahead', 'rain', 'fieldSnow', 'fieldRock', 'fieldRiver', 'fieldWheat', 'fieldGate',
    'firstCapture', 'lostMajor', 'firstPromote', 'checked', 'firstDrop', 'narr10', 'narr30', 'narr60', 'narr90', 'intrigue',
    'rainStart', 'rainEnd', 'night', 'dawn', 'castleComplete', 'strategy', 'houseLoss', 'heroBorn', 'captureStreak', 'quiet', 'kingWalk', 'promoteAny', 'turncoat', 'envoy',
    'field:snow', 'field:rock', 'field:river', 'field:wheat', 'field:gate'];
  function mergeMore(more) {
    if (!more || typeof more !== 'object') return MORE_REPORT;
    MORE_REPORT.loaded = true;
    Object.keys(more.lines || {}).forEach(function (k) {
      var n = mergeKey(k, more.lines[k]);
      if (n < 0) MORE_REPORT.unknownKeys.push(k); else MORE_REPORT.merged += n;
    });
    (more.ensembles || []).forEach(function (e, i) {
      var ok = e && typeof e.id === 'string' && typeof e.trigger === 'string' && (e.side === 0 || e.side === 1) && e.roles && Array.isArray(e.lines) && e.lines.length;
      if (!ok || ENSEMBLE.some(function (x) { return x.id === e.id; })) { MORE_REPORT.badEnsembles.push(e && e.id || ('#' + i)); return; }
      ENSEMBLE.push(e); MORE_REPORT.ensembles++;
    });
    (more.newTriggers || []).forEach(function (t) {
      var id = typeof t === 'string' ? t : (t && (t.name || t.id));
      if (!id) return;
      MORE_REPORT.triggers.push(id);
      if (KNOWN_TRIGGERS.indexOf(id) < 0) MORE_REPORT.unknownTriggers.push(id);
    });
    return MORE_REPORT;
  }
  // 新しい判定: 1手ごとの出来事から、この手で起きた trigger 名を返す (UI が群像会話に使う)
  function triggersFor(ev) {
    var out = [];
    if (!ev) return out;
    if (ev.rainStart) out.push('rainStart');
    if (ev.rainEnd) out.push('rainEnd');
    if (ev.phase === 'night' && ev.prevPhase !== 'night') out.push('night');
    if (ev.phase === 'dawn' && ev.prevPhase !== 'dawn') out.push('dawn');
    if (ev.castleComplete) out.push('castleComplete');
    if (ev.strategy) out.push('strategy');
    if (ev.houseLoss) out.push('houseLoss');
    if (ev.heroBorn) out.push('heroBorn');
    if (ev.captureStreak >= 3) out.push('captureStreak');
    if (ev.quiet >= 8) out.push('quiet');
    if (ev.kingWalk) out.push('kingWalk');
    if (ev.promote) out.push('promoteAny');
    if (ev.turncoat) out.push('turncoat');
    if (ev.envoy) out.push('envoy');
    if (ev.field && ev.ply === 2) out.push('field:' + ev.field);
    // dialogue_more.js の判定名 (newTriggers)
    if (ev.quiet >= 8) out.push('quiet');
    if (ev.houseLoss) out.push('houseLost');
    if (ev.ply === 10) out.push('ply20'); // 43章: 名前は旧のまま、手数は半分
    if (ev.ply === 23) out.push('ply45');
    if (ev.pieceDiff != null && ev.pieceDiff <= -3) out.push('behind');
    if (ev.pieceDiff != null && ev.pieceDiff >= 3) out.push('ahead');
    if (ev.rainStart) out.push('rain');
    if (ev.fieldFirst && ev.field && FIELD_TRIGGER[ev.field]) out.push(FIELD_TRIGGER[ev.field]);
    return out.filter(function (t, i) { return out.indexOf(t) === i; });
  }

  // ---- エンディング ----
  // 9章: 旧版の結末本文。v1.0 では本編の型 (MAIN_TITLE・JEWEL_FATE ほか) で組み立てる。表示しない本文は RETIRED_ENDING_KEYS で「廃止」と印を付ける
  var RETIRED_ENDING_KEYS = ['1-light', '1-shadow', '1-harmony', '2-light', '2-shadow', '2-harmony', '3', '4', '5', '8-light', '8-shadow', '8-harmony', '9-light', '9-shadow', '9-harmony', '10-harmony', '11', '12', '13'];
  var ENDINGS = [
    { no: 1, title: '暁の凱旋', body: {
      light: '暁王は宝玉に手を伸ばさなかった。「こんなものが、この世にあってはならない」。宝玉は誰の目にも触れぬよう布に幾重にも包まれ、九峰の深い谷へ沈められた。それでも夜になると、谷の底から誰かを呼ぶ声がするという。「王はもう要らない。この大地の主は、ここに住む者たちだ。」',
      shadow: '暁王は宝玉を布に包み、誰にも見せずに砦の奥へしまった。夜ごと、奥から誰かを呼ぶ声がする。「これは二度と、誰の冠にもはめさせない。」その言葉が守られたかどうかを、民はまだ知らない。',
      harmony: '暁王は黄昏帝を捕らえなかった。二人は砦の広間で、夜が明けるまで話し続けた。宝玉は二人の間の卓に置かれたまま、どちらも手を伸ばさなかった。朝の光の中で、それは静かに二人を待っていた。' } },
    { no: 2, title: '黄昏は終わらない', body: {
      light: '勝った帝は、捕虜となった若き王に麦の袋を持たせて北へ帰した。「民を飢えさせるな。それだけは、余も昔から変わらぬ。」黄昏はまだ続く。だが、その色は少しだけ明るかった。',
      shadow: '宝玉の光は北の空まで届いた。勝利の知らせに都は沸いたが、帝だけは笑わなかった。帝国はさらに三十年続く。ある晩、ヴァルドラは捕虜となった若き王と盤を挟み、こう尋ねた。「余は、正しかったのか。」答えは記されていない。',
      harmony: '勝った帝は、捕虜となった若き王を牢に入れなかった。二人は毎晩盤を挟み、互いの国の話をした。話すほどに、宝玉の囁きは少しずつ遠のいていった。' } },
    { no: 3, title: '金の軍勢', body: '敵陣で経験を積み、昇格した兵たちが、凱旋の列をなした。その列の先頭を歩いたのは、もとは名もなき新兵だった「と金」である。' },
    { no: 4, title: '捕虜の旗', body: '戦が終わったとき、勝った軍の半分はかつての敵兵だった。彼らは故郷の旗を降ろさなかった。新しい国の旗は二つの旗を縫い合わせて作られた。' },
    { no: 5, title: '長き戦の果てに', body: '三日三晩の戦だった。勝ち名乗りを上げる声も、もう嗄れていた。兵たちは敵味方なく盤の上に座り込み、同じ朝日を見た。' },
    { no: 6, title: '千日の夜明け', body: '天が戦を止めた。両軍は同じ盤面を四度巡り、誰も前に進めなかった。翌朝、二人の王は初めて剣を置き、言葉を交わした。' },
    { no: 7, title: '兵の離散', body: '王を追い回すだけの戦に、兵たちは疲れ果てた。その夜、多くの兵が武器を置いて故郷へ帰っていった。雷が帥旗を焼いたのを、残った者だけが見た。' },
    { no: 8, title: '暁は来なかった', body: {
      light: '夕暮れ、野の果てに、暁の軍は三十余りしか残っていなかった。追うべき帝はもう見えない。暁王は弟と目を交わし、「我が事、終われり」とだけ言った。十三の兵が、最後までそばを離れなかった。北の砦では、その夜、戻らなかった者たちの名が一つずつ読み上げられた。',
      shadow: '最後の砦が落ちた。暁王は、宝玉へ伸ばしかけた手をゆっくりと下ろした。「勝つためなら、と思った。それが帝国と同じ道だとも知らずに。」',
      harmony: '最後の砦が落ちた。暁王は剣を置き、黄昏帝に語りかけた。「次は、戦ではなく言葉で会いたい。」帝は答えなかったが、その夜、砦の兵は一人も罰せられなかった。' } },
    { no: 9, title: '黄昏の果て', body: {
      light: '宝玉は誰の手にも触れぬまま、布に包まれて遠い谷へ運ばれた。ヴァルドラは去りゆく荷に、民の前で頭を下げた。「余は、名君に戻れなかった。だが、戻ろうとはした。」',
      shadow: '宝玉が帝の手から離れたとき、ヴァルドラはなぜか安堵したように笑った。「重かったのだ、ずっと。」',
      harmony: '戦のあと、ヴァルドラは若き王にひとつだけ頼みごとをした。「宝玉が遠ざけられる前に、少しだけ話をさせてくれ。」二人の話は、夜が明けるまで続いた。' } },
    { no: 10, title: '白き旗', body: '王はみずから白旗を掲げた。兵をこれ以上失わないための決断だった。その名は、敗者としてではなく、兵を救った王として語り継がれた。' },
    { no: 11, title: '覇王の暁', body: '暁王は宝玉を受け取り、自らの冠にはめた。民は新しい王を讃え、誰もその目の色が変わったことに気づかなかった。' },
    { no: 12, title: '二人の王の盤', body: '戦のあと、二人の王は一枚の盤を挟んで向かい合った。指すのは駒ではなく、国の行く末だった。',
      // 45章: 和の道にいる側の王が投了した。self = 視点の側が投了 / other = 相手 (CPU) が投了。s/g は投了した側
      resign: {
        self: { s: '暁王は、まだ戦える兵を背に、自ら白い旗を掲げた。「これ以上、兵の名を弔いの列に加えたくない」。黄昏帝は剣を収め、その夜、二人の王は一枚の盤を挟んで向かい合った。',
          g: '黄昏帝は、まだ戦える兵を背に、自ら旗を降ろした。「これ以上、兵の名を石に刻ませたくはない」。暁王は剣を収め、その夜、二人の王は一枚の盤を挟んで向かい合った。' },
        other: { g: '黄昏帝は、最後の近衛が倒れる前に旗を降ろした。「勝てぬ戦で兵を失うのは、もう十分だ」。暁王は帝を捕らえず、その夜、二人の王は一枚の盤を挟んで向かい合った。',
          s: '暁王は、最後の近衛が倒れる前に白い旗を掲げた。「勝てぬ戦で、これ以上誰も失いたくない」。黄昏帝は王を捕らえず、その夜、二人の王は一枚の盤を挟んで向かい合った。' }
      } },
    { no: 13, title: '黄昏の贖い', body: '勝った帝は、自ら宝玉を外した。三十年ぶりに、民の前で素顔をさらした。' },
    { no: 14, title: '二歩の禁', special: true, body: 'その日から、兵たちは王の命令を信じなくなった。軍は戦わずに散った。同じ筋に並んだ二人の歩兵は、どちらが先に進むかを決められないまま、今もそこに立っているという。人々はこの戦を戒めにした。「歩は、一筋にひとり」' },
  ];
  // 判定順: 14(二歩の反則負け) → 11 → 12 → 13 → 7 → 6 → 10 → 3 → 4 → 5 → 1 → 2 → 8 → 9 (p はプレイヤー視点)
  var ENDING_RULES = [
    { no: 14, test: function (p) { return p.lose && p.reason === 'foul'; } },
    { no: 12, test: function (p) { return p.reason === 'resign' && p.resignerPath === 'harmony'; } },
    { no: 11, test: function (p) { return p.win && p.side === 0 && p.path === 'shadow'; } },
    { no: 13, test: function (p) { return p.win && p.side === 1 && p.path === 'light'; } },
    { no: 7, test: function (p) { return p.lose && p.reason === 'perpetual'; } },
    { no: 6, test: function (p) { return p.draw; } },
    { no: 10, test: function (p) { return p.lose && p.reason === 'resign'; } },
    { no: 3, test: function (p) { return p.win && p.promotions >= 5; } },
    { no: 4, test: function (p) { return p.win && p.captures >= 15; } },
    { no: 5, test: function (p) { return p.win && p.plies >= 120; } },
    { no: 1, test: function (p) { return p.win && p.side === 0; } },
    { no: 2, test: function (p) { return p.win && p.side === 1; } },
    { no: 8, test: function (p) { return p.lose && p.side === 0; } },
    { no: 9, test: function (p) { return p.lose && p.side === 1; } }
  ];
  var ENDING_ORDER_LEGACY = ENDING_RULES.map(function (r) { return r.no; });
  var REGRET = { s: '本当は、旗を降ろすこともできた。暁王は、そのことを誰にも言わなかった。', g: '本当は、旗を降ろすこともできた。黄昏帝は、そのことを誰にも言わなかった。' };

  // エピローグの断片
  var FRAGMENTS = {
    hero: { title: 'と金の英雄', text: { s: 'と金の英雄、{英雄}は、戦のあと故郷の村へ帰った。村の子どもたちは今も、歩の駒をいちばん前に並べて遊ぶ。', g: '帝国の{英雄}は、戦のあと妹の待つ村へ帰った。と金の駒は村の倉で、今も麦の袋の下に眠っている。' } },
    testament: { title: '遺言', text: { s: '{遺言の主}の遺言は守られた。「{遺言}」——その言葉は、軍の天幕の柱に刻まれて残っている。', g: '{遺言の主}の遺言は、帝国の兵たちの間でひそかに語り継がれた。「{遺言}」' } },
    unmoved: { title: '動かざる王', text: { s: '暁王はついに一歩も動かなかった。兵たちはのちに語った。「王が動かなかったから、俺たちは前だけを見ていられた。」', g: '黄昏帝は玉座から一歩も降りなかった。それが威厳だったのか、恐れだったのかを知る者はいない。' } },
    turncoat: { title: '寝返った兵の手柄', text: { s: '寝返った{寝返り}が立てた手柄は、両軍の兵の間で長く語られた。「旗が変わっても、腕は変わらない。」', g: '寝返った{寝返り}の手柄は帝国の記録には残らなかった。だが兵たちは、その名を忘れなかった。' } },
    shirakawa: { title: '白河の恩', text: { s: '白河の大橋で川から引き上げられた兵たちは、着物と薬の恩を忘れなかった。彼らは最後まで、暁の軍とともに戦った。', g: '白河の大橋で川から引き上げられた兵たちは、帝の情けを忘れなかった。彼らは最後まで、帝国の旗の下で戦った。' } },
    decoy: { title: '身代わりの忠臣', text: { s: '王の身代わりを名乗った{身代わり}は、その言葉どおりに倒れた。敵も味方もその名を忠臣として語り継いだ。', g: '王の身代わりを名乗った{身代わり}は、その言葉どおりに倒れた。帝国の記録はその名だけを丁寧に書き残した。' } },
    strategy: { title: '戦い抜いた陣', text: { s: '暁の軍は最後まで「{戦法}」で戦い抜いた。陣を組んだ駒たちはのちに茶飲み話でその形を盤に並べてみせた。', g: '帝国軍は最後まで「{戦法}」で戦い抜いた。帝はその陣立てを、軍学の書に書き加えさせたという。' } },
    castle: { title: '守り抜いた砦', text: { s: '暁の軍は最後まで{陣}を守り抜いた。砦を組んだ駒たちはのちに「あの囲いの中は温かかった」と笑った。', g: '帝国軍は最後まで{陣}を守り抜いた。黄昏帝はその砦の駒たちにだけ礼を言ったという。' } },
    warDead: { title: '戦死した者たち', text: { s: '{戦死}', g: '{戦死}' } },
    raised: { title: '蘇らされた者', text: { s: '{蘇り}', g: '{蘇り}' } },
    fallen: { title: '戻らなかった兵たち', text: { s: '戻らなかった兵たちの名は、砦の石にひとつずつ刻まれた。勝った者も負けた者も、その前では黙って頭を下げた。', g: '帝国に戻らなかった兵たちの名は、どの記録にも残っていない。ヴァルドラだけが、その数を覚えていた。' } }
  };
  var FRAGMENT_IDS = ['hero', 'testament', 'unmoved', 'turncoat', 'shirakawa', 'decoy', 'strategy', 'castle', 'fallen', 'warDead', 'raised'];
  function fragmentText(id, side, vars) {
    var f = FRAGMENTS[id];
    if (!f) return '';
    var t = side === 1 ? f.text.g : f.text.s;
    vars = vars || {};
    return t.replace(/\{(英雄|遺言の主|遺言|陣|寝返り|身代わり|戦法|戦死|蘇り)\}/g, function (_, k) { return vars[k] || ''; });
  }

  /*
   * ctx = {result:{winner, reason}, plies, playerSide: 0|1|null(2人対戦),
   *        promotions:[先手,後手], captures:[先手,後手],
   *        path:{0:'light'|..., 1:...} または文字列, envoyAccepted:{0:bool,1:bool} または bool,
   *        events:{hero:{name}, testament:{who, text}, unmoved, turncoat, fallen} (視点側のもの)}
   */
  function perspectiveOf(ctx) {
    var r = ctx.result;
    if (ctx.playerSide === 0 || ctx.playerSide === 1) return ctx.playerSide;
    if (r.reason === 'foul' && (r.winner === 0 || r.winner === 1)) return r.winner ^ 1; // 2人対戦の反則: 反則した側
    if (r.winner === 0 || r.winner === 1) return r.winner; // 2人対戦: 勝った陣営
    return 0;
  }
  function pick2(v, side) { return (v && typeof v === 'object') ? v[side] : v; }
  // 廃止: 旧版の結末の判定 (v0.x)。到達しない本文の記録として残す
  function endingLegacy(ctx) {
    var r = ctx.result, side = perspectiveOf(ctx);
    var path = pick2(ctx.path, side) || 'light';
    var p = {
      side: side,
      win: r.winner === side,
      lose: r.winner === (side ^ 1),
      draw: r.winner === null || r.winner === undefined,
      reason: r.reason,
      plies: ctx.plies,
      promotions: (ctx.promotions || [0, 0])[side] || 0,
      captures: (ctx.captures || [0, 0])[side] || 0,
      path: path,
      envoyAccepted: !!pick2(ctx.envoyAccepted, side)
    };
    // 投了した側とその道 (45章)
    p.resigner = r.reason === 'resign' && (r.winner === 0 || r.winner === 1) ? r.winner ^ 1 : null;
    p.resignerPath = p.resigner == null ? null : (pick2(ctx.path, p.resigner) || 'light');
    var no = 0;
    for (var i = 0; i < ENDING_RULES.length; i++) if (ENDING_RULES[i].test(p)) { no = ENDING_RULES[i].no; break; }
    if (!no) throw new Error('no ending matched: ' + JSON.stringify(p)); // 規則上起こらない (テストで確認)
    var e = ENDINGS[no - 1];
    var hasPath = typeof e.body === 'object';
    if (no === 12) path = 'harmony';
    var body = hasPath ? e.body[path] : e.body;
    if (no === 12 && e.resign) body = e.resign[p.resigner === side ? 'self' : 'other'][p.resigner === 1 ? 'g' : 's'];
    // 詰みで決着した和の本文には、悔いを一行
    if (path === 'harmony' && r.reason === 'checkmate' && [1, 2, 8, 9].indexOf(no) >= 0) body += REGRET[side === 1 ? 'g' : 's'];
    var ev = (no === 14) ? {} : ((ctx.events || {})[side] || {}), frags = []; // 14 は断片を付けない
    FRAGMENT_IDS.forEach(function (id) {
      if (!ev[id]) return;
      var vars = {};
      if (id === 'hero') vars['英雄'] = ev.hero.name;
      if (id === 'testament') { vars['遺言の主'] = ev.testament.who; vars['遺言'] = ev.testament.text; }
      if (id === 'castle') vars['陣'] = ev.castle.story;
      if (id === 'turncoat') vars['寝返り'] = (ev.turncoat && ev.turncoat.name) || '兵';
      if (id === 'decoy') vars['身代わり'] = (ev.decoy && ev.decoy.name) || '兵';
      if (id === 'strategy') vars['戦法'] = (ev.strategy && ev.strategy.story) || '';
      if (id === 'warDead') vars['戦死'] = warDeadText(ev.warDead.names || []);
      if (id === 'raised') vars['蘇り'] = raisedText(ev.raised.name, ev.raised.n);
      frags.push({ id: id, title: FRAGMENTS[id].title, text: fragmentText(id, side, vars) });
    });
    return {
      no: e.no, title: e.title, path: path, pathName: PATH_NAME[path],
      body: body,
      key: e.no + '-' + path,
      heading: '第' + e.no + 'の結末',
      cost: p.win ? victoryCost(ctx.lostHouses && ctx.lostHouses[side]) : null,
      empireNote: (no === 2 || no === 13) ? EMPIRE_AFTER : null,
      darkNote: (p.win && path === 'shadow' && ev.darkArts) ? DARK_NOTE[side === 1 ? 'g' : 's'] : null,
      houses: no === 14 ? [] : houseAftermath(r, path),
      poem: poemOf(e.no + '-' + path),
      outcome: p.draw ? 'draw' : (p.win ? 'win' : 'lose'),
      perspective: side,
      fragments: frags
    };
  }
  // 到達できる (番号, 道) の組み合わせを判定規則から列挙する
  function reachableKeysLegacy() {
    var keys = {};
    var reasons = ['checkmate', 'resign', 'perpetual', 'declaration', 'sennichite', 'foul', 'nomoves'];
    [0, 1].forEach(function (side) {
      [0, 1, null].forEach(function (w) {
        reasons.forEach(function (r) {
          if ((w === null) !== (r === 'sennichite')) return;
          [0, 120].forEach(function (plies) {
            [0, 5].forEach(function (pr) {
              [0, 15].forEach(function (ca) {
                PATHS.forEach(function (pth) {
                  PATHS.forEach(function (opp) {
                    var paths = {}; paths[side] = pth; paths[side ^ 1] = opp;
                    var e = endingLegacy({ result: { winner: w, reason: r }, plies: plies, playerSide: side, promotions: [pr, pr], captures: [ca, ca], path: paths });
                    keys[e.key] = { no: e.no, path: e.path };
                  });
                });
              });
            });
          });
        });
      });
    });
    return keys;
  }
  // 記録画面の一覧 (到達できる組み合わせだけ)
  var catalogCache = null;
  function recordCatalogLegacy() {
    if (catalogCache) return catalogCache;
    var keys = reachableKeysLegacy(), list = [], special = [];
    ENDINGS.forEach(function (e) {
      PATHS.forEach(function (pth) {
        var k = e.no + '-' + pth;
        if (!keys[k]) return;
        var item = { key: k, no: e.no, title: e.title, path: pth, pathName: PATH_NAME[pth], legacyKey: typeof e.body === 'object' ? null : String(e.no) };
        (e.special ? special : list).push(item);
      });
    });
    catalogCache = { endings: list, special: special, fragments: FRAGMENT_IDS.map(function (id) { return { id: id, title: FRAGMENTS[id].title }; }) };
    return catalogCache;
  }


  // ======== 52章: 結末の組み立て (物語の正典 v1.0、STORY_v1.md 4〜6章) ========
  // 本編 (決着 + 宝玉の行方 + 負けた王の行く末 + 戦後の約束) + 戦功の段 + エピローグ断片 + 家々のその後
  var MAIN_TITLE = { 1: '暁の凱旋', 11: '覇王の暁', 15: '夜明けの卓', 13: '黄昏の贖い', 2: '黄昏は終わらない', 16: '黄昏の卓', 6: '千日の夜明け', 7: '兵の離散', 12: '二人の王の盤', 10: '白き旗', 14: '二歩の禁', 8: '暁は来なかった', 9: '黄昏の果て' };
  // 4.1 宝玉の行方 (両軍で共通の事実)。key: light / shadow0 / shadow1 / harmony / release (黄昏帝の勝ち・光) / draw
  var JEWEL_FATE = {
    light: '勝った王は宝玉に触れなかった。布で幾重にも包み、九峰の深い谷へ沈めた。',
    shadow0: '暁王は宝玉を手にし、自らの冠にはめた。',
    shadow1: '黄昏帝は宝玉を手放さなかった。宝玉は、帝をさらに深く呑んだ。',
    harmony: '二人の王は布で覆った宝玉を卓に置き、互いに手を出さないと誓った。宝玉は二人の立ち会いのもとで谷へ運ばれた。',
    release: '黄昏帝は自ら宝玉を外した。外す手は震え、帝は三日のあいだ眠れなかった。宝玉は谷へ沈められた。',
    draw: '宝玉は帝の手に残ったままだった。二人の王は剣を置いて言葉を交わしたが、宝玉の話になると帝は黙った。'
  };
  function jewelFateKey(result, paths) {
    var w = result.winner;
    if (result.reason === 'foul') return 'foul';
    if (w !== 0 && w !== 1) return 'draw';
    var p = paths[w] || 'light';
    if (p === 'shadow') return 'shadow' + w;
    if (p === 'light' && w === 1) return 'release';
    return p;
  }
  // 負けた側の王の行く末 (負けた側の道で変わる。王は死なない)
  var LOSER_FATE = {
    0: { light: '暁王は捕らえられても、宝玉の方を見ようとしなかった。', shadow: '暁王は、宝玉に伸ばしかけた手を、最後に下ろした。', harmony: '暁王は剣を置き、「次は言葉で会いたい」と言った。' },
    1: { light: '黄昏帝は宝玉が離れていくのを見送り、民の前で頭を下げた。', shadow: '宝玉が手から離れたとき、黄昏帝はなぜか安堵したように笑った。「重かったのだ、ずっと」', harmony: '黄昏帝は夜明けまで若き王と話してから、宝玉を手放した。' }
  };
  // 宝玉を手にしたのが負けた帝のままのとき (勝者が影の暁王なら帝の手から離れる) は、行く末の文と矛盾しない組み合わせだけを使う
  // 戦後の約束 (恩賞の回収。勝者の道で変わる)
  var PROMISE = {
    s_light: '戦った者に土地が分けられ、宮廷の古い恩賞の帳面は焼かれた。「王はもう、民の上に立つためにいるのではない」',
    s_shadow: '土地は分けられたが、分けたのは宝玉の囁きを聞く王だった。',
    harmony: '両軍の兵に同じだけの土地が分けられた。',
    g: '南の村々には麦が届く。北の村々には届かない。'
  };
  function promiseKey(w, p) { return p === 'harmony' ? 'harmony' : (w === 0 ? 's_' + p : 'g'); }
  // 決着の一文
  var DECIDE = {
    0: '黄昏帝の陣は崩れた。帝国の旗は、戦場から一本ずつ降ろされた。',
    1: '暁の軍は散った。守る者のいない北の砦に、帝国の旗が立った。',
    resign: { 0: '暁王は自ら旗を降ろした。', 1: '黄昏帝は自ら旗を降ろした。' }
  };
  var WHITE_FLAG = '王はみずから白旗を掲げた。兵をこれ以上失わないための決断だった。その名は、敗者としてではなく、兵を救った王として語り継がれた。';
  var DRAW_BODY = '同じ盤面が四度巡り、誰も前に進めなかった。翌朝、二人の王は初めて剣を置き、言葉を交わした。';
  // 4.4 兵の離散 / 4.5 二歩の禁 (神や世界の決まりには触れない)
  var SCATTER = '王を追い回すだけの戦に、兵たちは疲れ果てた。その夜、多くの兵が武器を置いて故郷へ帰っていった。雷が帥旗を焼いたのを、残った者だけが見た。';
  var NIFU_END = 'その日から、兵たちは王の命令を信じなくなった。軍は戦わずに散った。同じ筋に並んだ二人の歩兵は、どちらが先に進むかを決められないまま、今もそこに立っているという。人々はこの戦を戒めにした。「歩は、一筋にひとり」';
  // 4.3 和の道の投了: 投了した王の意図 (残っている兵で変わる) と、勝った王の応じ方 (勝者の道)
  var RESIGN_INTENT = {
    guard: { 0: '暁王は、最後の近衛が倒れる前に旗を降ろした。兵をこれ以上失わないためだった。', 1: '黄昏帝は、最後の近衛が倒れる前に旗を降ろした。兵をこれ以上失わないためだった。' },
    noguard: { 0: '暁王は、もう誰も守る者のいない陣で旗を降ろした。兵をこれ以上失わないためだった。', 1: '黄昏帝は、もう誰も守る者のいない陣で旗を降ろした。兵をこれ以上失わないためだった。' },
    alone: { 0: '王はひとりで旗を降ろした。暁の陣には、もう誰も残っていなかった。', 1: '王はひとりで旗を降ろした。帝国の陣には、もう誰も残っていなかった。' }
  };
  var RESIGN_ANSWER = {
    light: { 0: '暁王は投了を受け入れた。宝玉は谷へ運ばれ、二人の王は盤を挟んで向かい合った。', 1: '黄昏帝は投了を受け入れた。宝玉は谷へ運ばれ、二人の王は盤を挟んで向かい合った。' },
    harmony: '戦のあと、二人の王は一枚の盤を挟んで向かい合った。指すのは駒ではなく、国の行く末だった。',
    shadow: { 0: '暁王は旗を受け取ったが、和を拒んだ。宝玉を手にし、黄昏帝を捕らえた。', 1: '黄昏帝は旗を受け取ったが、和を拒んだ。宝玉を手にし、暁王を捕らえた。' },
    dark: '勝った軍が死者を呼び戻したことも、この日の記録には残っている。'
  };
  var ENVOY_LINE = '密使と交わした約束どおり、戦のあと話し合いの席が設けられた。';
  // 記録番号: 勝った視点は勝者と勝者の道、負けた視点は 8・9 (連続王手の千日手は 7、和以外の投了は 10)
  function mainNo(result, paths, side) {
    var w = result.winner;
    if (result.reason === 'foul') return 14;
    if (w !== 0 && w !== 1) return 6;
    var l = w ^ 1;
    if (result.reason === 'resign' && paths[l] === 'harmony') return 12;
    if (side === l) { if (result.reason === 'perpetual') return 7; if (result.reason === 'resign') return 10; return l === 0 ? 8 : 9; }
    var p = paths[w] || 'light';
    return w === 0 ? { light: 1, shadow: 11, harmony: 15 }[p] : { light: 13, shadow: 2, harmony: 16 }[p];
  }
  function mainBody(no, result, paths, ctx) {
    var w = result.winner, l = (w === 0 || w === 1) ? w ^ 1 : null, out = [];
    if (no === 14) return NIFU_END;
    var jk = jewelFateKey(result, paths);
    if (no === 6) { out.push(DRAW_BODY, JEWEL_FATE.draw); }
    else if (no === 12) {
      var rs = ctx.resignTroops || {}, tk = rs[l] || 'guard';
      out.push(RESIGN_INTENT[tk][l]);
      var wp = paths[w] || 'light';
      if (wp === 'harmony') { out.push(RESIGN_ANSWER.harmony); out.push(JEWEL_FATE.harmony); }
      else if (wp === 'shadow') { out.push(RESIGN_ANSWER.shadow[w]); if (ctx.darkArts && ctx.darkArts[w]) out.push(RESIGN_ANSWER.dark); }
      else out.push(RESIGN_ANSWER.light[w]);
      out.push(PROMISE[promiseKey(w, wp)]);
    } else {
      if (result.reason === 'perpetual') out.push(SCATTER); // 連続王手の千日手: どちらの視点でも兵の離散を書く
      else if (result.reason === 'resign') out.push(DECIDE.resign[l] + WHITE_FLAG); // 和以外の投了: どちらの視点でも同じ文
      else out.push(DECIDE[w]);
      out.push(JEWEL_FATE[jk]);
      // 宝玉を勝者が手にした (影) ときに、負けた王の行く末で「宝玉を見送る/手放す」と書くと矛盾しない。帝の手に残る組み合わせはない
      out.push(LOSER_FATE[l][paths[l] || 'light']);
      out.push(PROMISE[promiseKey(w, paths[w] || 'light')]);
    }
    if (ctx.envoyAccepted === true || (ctx.envoyAccepted && (ctx.envoyAccepted[0] || ctx.envoyAccepted[1]))) out.push(ENVOY_LINE);
    return out.join('\n');
  }
  // 4.6 戦功の段 (勝った視点のときだけ)
  var FEAT = {
    gold: '敵の奥地まで攻め込み、昇格した兵たちが凱旋の列をなした。',
    goldHead: 'その列の先頭を歩いたのは、もとは名もなき新兵だった「{名}」である。',
    prisonHalf: '勝った軍の半分は、かつての敵兵だった。新しい旗は二つの旗を縫い合わせて作られた。',
    prison: '多くの捕虜が出た戦だった。捕虜たちは、戦が終わるまで丁重に扱われた。',
    long: '長い戦だった。勝ち名乗りを上げる声も、もう嗄れていた。',
    sky: { morning: '兵たちは敵味方なく座り込み、同じ朝日を見た。', dawn: '兵たちは敵味方なく座り込み、同じ朝日を見た。', day: '兵たちは敵味方なく座り込み、同じ空を見上げた。', evening: '兵たちは敵味方なく座り込み、同じ夕日を見た。', night: '兵たちは敵味方なく座り込み、同じ星を見た。' }
  };
  function feats(ctx, side) {
    var out = [], f = (ctx.feats || {})[side] || {};
    if (((ctx.promotions || [0, 0])[side] || 0) >= 5) out.push({ id: 'gold', title: '金の軍勢', text: FEAT.gold + (f.tokinName ? FEAT.goldHead.replace('{名}', f.tokinName) : '') });
    if (((ctx.captures || [0, 0])[side] || 0) >= 15) out.push({ id: 'prisoners', title: '捕虜の旗', text: (f.ownCount && f.exEnemy * 2 >= f.ownCount) ? FEAT.prisonHalf : FEAT.prison });
    if ((ctx.plies || 0) >= 120) out.push({ id: 'long', title: '長き戦', text: FEAT.long + FEAT.sky[phaseOf(ctx.plies || 0).key] });
    return out;
  }
  // 5章: 駒ごとの終局時の状態からエピローグを選ぶ (alive / enemy / dead / undead)
  var HERO_BY_STATE = {
    alive: 'と金の英雄、{英雄}は、村へ帰り、と金の旗を家の戸口に掲げた。',
    enemy: 'と金の英雄、{英雄}は、捕らわれたまま戦が終わった。帰ってきたのは翌年の春だった。',
    dead: 'と金の英雄、{英雄}の村には、と金の旗だけが帰った。',
    undead: 'と金の英雄、{英雄}は、何度も呼び戻され、最後には村の名も忘れた。',
    undeadOnce: 'と金の英雄、{英雄}は、一度だけ呼び戻され、村の名を最後まで覚えていた。'
  };
  var MESSAGE_FRAG = {
    retaken: '{主}は取り返され、預けるはずだった言葉を自分の口で届けた。「{言葉}」',
    kept: '{主}の言葉は、敵の陣で語り継がれた。「{言葉}」'
  };
  var SHIRAKAWA_FRAG = { s: '白河で救われた兵たちは、戦のあと暁の軍の荷を運んだ。', g: '白河で救われた兵たちは、戦のあと帝国の荷を運んだ。' };
  FRAGMENTS.message = { title: '伝言', text: { s: '', g: '' } };
  // 6章: 伝令の鴉の知らせごとの後日談 (good = 勝者が光か和 / bad = 影。南の馬家の知らせは勝った側で変わる)
  var RAVEN_AFTER = [
    { good: '焼けた麦の里には、翌年、両軍の兵が種をまいた。', bad: '麦の里は焼けたまま捨てられた。' },
    { s: '南の馬家の使いは、谷の場所を探していたという。', g: '宰相は宝玉に近づく機をうかがい続けた。' },
    { good: '逃げた兵たちは、戦のあと宿場で畑を借りて暮らした。', bad: '逃げた兵たちは、二度と名を名乗らなかった。' },
    { good: '船団は商いの船だった。翌年から、内海に市が立った。', bad: '船団は、宝玉の噂を聞きつけた者たちだった。内海は荒れた。' },
    { good: '番小屋の番人は、戦のあと何事もなかったように戻ってきた。', bad: '番小屋は空のまま朽ちた。' },
    { good: '扉の向こうで帝が何を見たのかは、誰も知らない。', bad: '扉は、それからも時おり三日閉ざされた。' },
    { good: '荷車の中身は、戦のあと北の村々に配られた麦の種だった。', bad: '荷車の中身は、最後まで誰にも明かされなかった。' },
    { good: 'その年、九峰のふもとは早い春を迎えた。', bad: '雪解けの水は、谷を深く削った。' },
    { good: '宿の主は、戦のあと両方の都から礼状を受け取った。', bad: '宿の主は、戦のあとどちらの軍からも咎められた。' }
  ];
  function ravenAfter(index, result, paths) {
    var r = RAVEN_AFTER[index]; if (!r) return null;
    var w = result.winner;
    if (r.s) return w === 0 ? r.s : r.g;
    var p = (w === 0 || w === 1) ? (paths[w] || 'light') : 'harmony';
    return p === 'shadow' ? r.bad : r.good;
  }
  // 家々のその後 (5章): 当主の状態 (ok / retainer = 家臣を失った / lost = 当主を失った) と戦後の政体から一つ選ぶ
  var HOUSE_RETAINER = '家臣の何人かは戻らなかった。';
  // 戦後の共通の状態 (どちらの視点でも同じ)。家々のその後・詩はこれを参照する。記録番号は表示の分類だけ
  function postWar(result, paths) {
    var w = result.winner, decided = w === 0 || w === 1, wp = decided ? (paths[w] || 'light') : 'harmony', l = decided ? w ^ 1 : null;
    var harmonyResign = decided && result.reason === 'resign' && paths[l] === 'harmony';
    // 和議: 勝者が和の道、または和の投了を勝者が拒まなかった (光・和)。引き分けも和議の側
    var accord = !decided || wp === 'harmony' || (harmonyResign && wp !== 'shadow');
    var poem;
    if (result.reason === 'foul') poem = null;
    else if (!decided) poem = '6-harmony';
    else if (harmonyResign && wp !== 'shadow') poem = '12-harmony';
    else if (result.reason === 'perpetual') poem = '7-' + wp;
    else if (result.reason === 'resign') poem = '10-' + (paths[l] || 'light');
    else poem = (w === 0 ? { light: 1, shadow: 11, harmony: 15 } : { light: 13, shadow: 2, harmony: 16 })[wp] + '-' + wp;
    return { winner: decided ? w : null, wpath: wp, accord: accord, poem: poem, key: accord ? 'd' : (w === 0 ? 's' : 'g') };
  }
  function houseAftermath2(result, paths, houseState) {
    if (typeof paths === 'string' || !paths) paths = { 0: paths || 'light', 1: paths || 'light' };
    var pw = postWar(result, paths);
    return HOUSES.map(function (h) {
      var st = (houseState || {})[h.id] || 'ok', text;
      if (st === 'lost') text = HOUSE_LOSS[h.id];
      else {
        text = HOUSE_AFTER[h.id][pw.key];
        if (st === 'retainer') text += HOUSE_RETAINER;
      }
      return { house: h.id, name: h.name, state: st, text: text + HOUSE_PATH[pw.accord ? 'harmony' : pw.wpath] };
    });
  }
  /*
   * ctx = {result, plies, playerSide, paths|path, promotions, captures, envoyAccepted,
   *        events: {side: {hero:{name,state}, testament:{who,text,state:'dead'|'retaken'|'kept'}, fallenCount, warDead:{names}, raised:{name,n}, darkArts, shirakawa:'light'|.., castle, strategy, turncoat, decoy, unmoved}},
   *        feats: {side: {tokinName, exEnemy, ownCount}}, houseState: {side: {houseId: state}}, ravens: [index], resignTroops: {side: 'guard'|'noguard'|'alone'}, darkArts: [n, n]}
   */
  function ending(ctx) {
    var r = ctx.result, side = perspectiveOf(ctx);
    var paths = { 0: pick2(ctx.paths || ctx.path, 0) || 'light', 1: pick2(ctx.paths || ctx.path, 1) || 'light' };
    var no = mainNo(r, paths, side), path = no === 12 ? 'harmony' : paths[side];
    var body = mainBody(no, r, paths, ctx);
    var win = r.winner === side, lose = r.winner === (side ^ 1), draw = !(r.winner === 0 || r.winner === 1);
    var ev = (no === 14) ? {} : ((ctx.events || {})[side] || {}), frags = [];
    function add(id, text, title) { frags.push({ id: id, title: title || FRAGMENTS[id].title, text: text }); }
    var S = side === 1 ? 'g' : 's';
    var sameRaised = ev.hero && ev.raised && ev.hero.id != null && ev.raised.id === ev.hero.id;
    if (ev.hero && ev.hero.name) {
      var hk = ev.hero.state || 'alive';
      if (hk === 'undead' && ((ev.hero.raised || (sameRaised ? ev.raised.n : 2)) < 2)) hk = 'undeadOnce';
      add('hero', HERO_BY_STATE[hk].replace('{英雄}', ev.hero.name));
    }
    if (ev.testament && ev.testament.who) {
      if (ev.testament.state === 'dead') add('testament', fragmentText('testament', side, { '遺言の主': ev.testament.who, '遺言': ev.testament.text }));
      else add('message', MESSAGE_FRAG[ev.testament.state === 'retaken' ? 'retaken' : 'kept'].replace('{主}', ev.testament.who).replace('{言葉}', ev.testament.text));
    }
    if (ev.unmoved) add('unmoved', fragmentText('unmoved', side));
    if (ev.turncoat) add('turncoat', fragmentText('turncoat', side, { '寝返り': ev.turncoat.name || '兵' }));
    if (ev.shirakawa === 'light' || ev.shirakawa === true) add('shirakawa', SHIRAKAWA_FRAG[S]);
    if (ev.decoy) add('decoy', fragmentText('decoy', side, { '身代わり': ev.decoy.name || '兵' }));
    if (ev.strategy) add('strategy', fragmentText('strategy', side, { '戦法': ev.strategy.story || '' }));
    if (ev.castle) add('castle', fragmentText('castle', side, { '陣': ev.castle.story }));
    if ((ev.fallenCount || 0) >= 5 || ev.fallen === true) add('fallen', fragmentText('fallen', side));
    if (ev.warDead && ev.warDead.names && ev.warDead.names.length) add('warDead', warDeadText(ev.warDead.names));
    if (ev.raised && ev.raised.name && !sameRaised) add('raised', raisedText(ev.raised.name, ev.raised.n)); // 同じ駒の英雄の断片があれば一つにまとめる
    var hs = (ctx.houseState || {})[side], lostHeads = [];
    if (hs) Object.keys(hs).forEach(function (k) { if (hs[k] === 'lost') lostHeads.push(k); });
    else if (ctx.lostHouses) lostHeads = (ctx.lostHouses[side] || []).slice();
    var ravens = (ctx.ravens || []).map(function (i) { return ravenAfter(i, r, paths); }).filter(Boolean);
    return {
      no: no, title: MAIN_TITLE[no], path: path, pathName: PATH_NAME[path], body: body,
      key: no + '-' + path, heading: '第' + no + 'の結末', jewel: jewelFateKey(r, paths),
      feats: win ? feats(ctx, side) : [],
      cost: win ? victoryCost(lostHeads) : null,
      empireNote: (no === 2 || no === 16) ? EMPIRE_AFTER : null,
      darkNote: (win && path === 'shadow' && ev.darkArts && no !== 12) ? DARK_NOTE[S] : null,
      houses: no === 14 ? [] : houseAftermath2(r, paths, (ctx.houseState || {})[side]),
      ravens: ravens,
      poem: poemOf(no === 14 ? no + '-' + path : (postWar(r, paths).poem || no + '-' + path)),
      post: postWar(r, paths),
      outcome: draw ? 'draw' : (win ? 'win' : 'lose'),
      perspective: side,
      fragments: frags
    };
  }
  var ENDING_ORDER = [14, 12, 6, 7, 10, 1, 11, 15, 13, 2, 16, 8, 9];
  function reachableKeys() {
    var keys = {};
    var reasons = ['checkmate', 'resign', 'perpetual', 'declaration', 'sennichite', 'foul', 'nomoves'];
    [0, 1].forEach(function (side) { [0, 1, null].forEach(function (w) { reasons.forEach(function (rr) {
      if ((w === null) !== (rr === 'sennichite')) return;
      PATHS.forEach(function (p0) { PATHS.forEach(function (p1) {
        var e = ending({ result: { winner: w, reason: rr }, plies: 80, playerSide: side, paths: { 0: p0, 1: p1 } });
        keys[e.key] = { no: e.no, path: e.path };
      }); });
    }); }); });
    return keys;
  }
  function recordCatalog() {
    if (catalogCache) return catalogCache;
    var keys = reachableKeys(), list = [], special = [];
    ENDING_ORDER.forEach(function (no) {
      PATHS.forEach(function (pth) {
        var k = no + '-' + pth; if (!keys[k]) return;
        var item = { key: k, no: no, title: MAIN_TITLE[no], path: pth, pathName: PATH_NAME[pth], legacyKey: null };
        (no === 14 ? special : list).push(item);
      });
    });
    catalogCache = { endings: list, special: special, fragments: FRAGMENT_IDS.concat(['message']).map(function (id) { return { id: id, title: FRAGMENTS[id].title }; }) };
    return catalogCache;
  }

  // 終局時の王の一言。winner: 0|1|null
  function endingTalk(ctx) {
    var r = ctx.result, out = [];
    if (r.winner === null || r.winner === undefined) {
      out.push(line('k0', 'K', 0, 'draw'));
      out.push(line('k1', 'K', 1, 'draw'));
      return out;
    }
    var w = r.winner, l = w ^ 1;
    if (r.reason === 'resign') out.push(line('k' + l, 'K', l, 'resign', 'hurt'));
    out.push(line('k' + w, 'K', w, 'win'));
    if (r.reason !== 'resign') out.push(line('k' + l, 'K', l, 'lose'));
    return out;
  }

  // 件数の確認用 (テスト・デバッグ)
  function stats() {
    var cats = {}, n = 0;
    Object.keys(LINES).forEach(function (k) {
      Object.keys(LINES[k]).forEach(function (c) { cats[k + '.' + c] = LINES[k][c].length; n += LINES[k][c].length; });
    });
    return { lines: n, captureCombos: Object.keys(COMBO_CAPTURE).length, checkCombos: Object.keys(COMBO_CHECK).length, categories: cats };
  }



  // ---- 帰還・戦死・黒魔術の蘇り (38章)。ルールには関わらない ----
  // 駒ごとの物語上の状態: alive (生者) / returned (帰還者) / dead (死者) / undead (蘇った死人)
  var FATE_DEATH = 1 / 3;
  // 対局の種・手数・駒の ID から決まる乱数 (待ってやり直しても同じ結果)
  function fateRoll(seed, ply, id) {
    var h = (seed | 0) ^ Math.imul(ply + 1, 0x9e3779b1) ^ Math.imul(id + 7, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  // 指し手の履歴から状態を組み立てる。戻り値 {fate: {id: {state, caught, raised}}, events: [{ply, type, id, side, base}], ident}
  // type: 'return' 帰還 / 'death' 戦死 / 'raise' 蘇り / 'fall' 死人が再び倒れる
  function trackFates(init, moves, seed) {
    var fate = {}, events = [], ply = (init && init.ply) || 0;
    var meta = trackIdentities(init, []).meta;
    function F(id) { return fate[id] || (fate[id] = { state: 'alive', caught: 0, raised: 0 }); }
    var ident = trackIdentities(init, moves, function (m, ev) {
      ply++;
      if (m.drop) {
        var d = F(ev.id);
        if (d.state === 'dead') { d.state = 'undead'; d.raised++; events.push({ ply: ply, type: 'raise', id: ev.id, side: m.side, base: baseOfType(m.piece), raised: d.raised }); }
        return;
      }
      if (!m.captured || ev.capturedId < 0) return;
      var base = baseOfType(m.captured);
      if (base === 'K') return; // 王・玉は死なない
      var f = F(ev.capturedId), before = f.caught;
      f.caught++;
      if (f.state === 'undead') { f.state = 'dead'; events.push({ ply: ply, type: 'fall', id: ev.capturedId, side: m.side, base: base, raised: f.raised }); return; }
      if (f.state === 'dead') return;
      if (before >= 1 && fateRoll(seed, ply, ev.capturedId) < FATE_DEATH) { f.state = 'dead'; events.push({ ply: ply, type: 'death', id: ev.capturedId, side: m.side, base: base }); return; }
      // 帰還: 元の軍が取り返した (取った側 = 元の陣営)
      var mt = meta[ev.capturedId];
      if (mt && mt.side === m.side) { f.state = 'returned'; events.push({ ply: ply, type: 'return', id: ev.capturedId, side: m.side, base: base }); }
    });
    return { fate: fate, events: events, ident: ident };
  }
  // 自我の段階: 蘇った回数 1 → 残る / 2 → 薄れ / 3 → かすか / 4以上 → 空ろ
  var EGO = ['', '残る', '薄れ', 'かすか', '空ろ'];
  function egoStage(raised) { return raised <= 0 ? 0 : Math.min(4, raised); }
  function egoLabel(raised) { return EGO[egoStage(raised)]; }
  function isHollow(f) { return !!f && f.state === 'undead' && egoStage(f.raised) >= 4; }
  // 情報窓の名前: 死者・死人は「亡き」を付け、死人は自我の段階を添える
  function fateName(nick, f) {
    if (!f || (f.state !== 'dead' && f.state !== 'undead')) return nick;
    return '亡き' + nick + (f.state === 'undead' ? ' ・ 自我 ' + egoLabel(f.raised) : '');
  }

  // 出自にちなむ最期の言葉 ({出自} は二つ名の出自)
  var LAST_BY_ORIGIN = [
    { re: /川|渡し|漁|簗|葦|沼|水車|湊|井戸/, lines: ['川の音が、聞こえる……。', '水の匂いだ。……{出自}に、帰るのか。', '流れに、乗せてくれ……。', '舟を、出してくれ。向こう岸へ……。'] },
    { re: /麦|畑|蕎麦|牧|羊|粉|炊き出し|馬糧|兵糧/, lines: ['麦が、揺れている……。刈り入れに、間に合わなかった。', '{出自}の土の匂いが、する……。', '腹いっぱい、食わせて……やりたかった。', '春の畑を、もう一度……。'] },
    { re: /山|峠|石|炭|樵|薪|熊|砕石|地蔵|丘/, lines: ['峠の向こうが、見える……。', '{出自}の煙が、まだ上がっている……。', '山は、黙って待っているだろう……。', '石を積むように、ひとつずつ……ここまで来た。'] },
    { re: /鍛冶|蹄鉄|工房|鉄|鐘/, lines: ['車輪の音が……止んだ。', '{出自}の火を、絶やすな……。', '鉄は、冷めると……固くなる。俺も、そうだ。', 'いい刃を、打ちたかった……。'] },
    { re: /寺|学び|写本|書|星|塔|魔導|秘儀|記室/, lines: ['書きかけの頁が……残っている。', '星の名を、まだ……全部は覚えていない。', '{出自}の灯りを、消さないでくれ……。', '答えは……君たちが、見つけたまえ……。'] },
    { re: /兵舎|隊|練兵|宿営|詰所|閲兵|訓練|点呼|伝令|当番|夜番|旗持ち|騎兵学校/, lines: ['点呼に……もう、答えられない。', '{出自}の寝台は、空いたままだ……。', '名を、呼ばれたら……返事を、頼む。', '列に……戻れなかった。'] },
    { re: /宮|玉座|城|門|砦|王都|階段|大扉|勅|回廊|牢|宝/, lines: ['あの扉の向こうに……帰れない。', '{出自}の灯が、遠い……。', '陛下に……お伝えを……。', '守るはずの門を、……守れなかった。'] }
  ];
  var LAST_GENERIC = {
    P: ['母さん……ごめん。', 'まだ、一歩しか……。', '怖くは、なかった……ほんとうだ。', '次の春を、見たかった……。', 'みんなの背中が、見える……。'],
    L: ['……まっすぐ、ここまでだ。', '槍は、折れなかった。', '前だけを、見てきた……。', '……悔いは、ない。', '道の先を、頼む。'],
    N: ['跳ぶのも……ここまでか。', '空が、近い……。', '蹄の音が……遠くなる。', 'もう一度、駆けたかった……。', '先に、行ってるよ……。'],
    S: ['年寄りが、先に逝くのが……筋じゃ。', '影は、影に還るだけじゃ……。', 'よう、生きた……。', '若い者を、頼んだぞ……。', 'ふぉ……少し、眠くなった……。'],
    G: ['王を……頼む……。', '盾が、割れたか……。', '最後まで、そばに……いたかった。', '持ち場を……離れて、すまぬ。', '守り、きれなかった……。'],
    B: ['理屈では……割り切れないね……。', '斜めの先に、何が……あったのだろう。', '答えは、……君たちに預ける。', '……論は、ここで閉じよう。', '面白い戦だった……。'],
    R: ['まだ……暴れ足りねえ……。', '倒れるときも、前のめりだ……。', '豪快に、散ったろ……?', '後は、任せたぜ……。', '……悪くねえ、最期だ。']
  };
  function lastWords(base, origin, side, rand) {
    rand = typeof rand === 'function' ? rand : rng;
    var g = null;
    for (var i = 0; i < LAST_BY_ORIGIN.length && !g; i++) if (origin && LAST_BY_ORIGIN[i].re.test(origin)) g = LAST_BY_ORIGIN[i];
    var pool = g && rand() < 0.7 ? g.lines : (LAST_GENERIC[base] || LAST_GENERIC.P);
    var t = pickFrom(pool, 'last:' + (g ? LAST_BY_ORIGIN.indexOf(g) : base));
    return mk('v', base, side, 'hurt', fill(t.replace(/\{出自\}/g, origin || '故郷'), side));
  }
  // 味方の悼み ({名} は倒れた駒の二つ名)
  var MOURN = {
    s: ['{名}……。お前の分まで、前へ出る。', '{名}が倒れた。……顔を上げろ、皆。', '戻ってきたばかりだったのに……。', '{名}の名は、忘れない。必ずだ。', '泣くのは、戦が終わってからだ。', '……あいつ、笑っていたな。最後まで。', '{名}、ゆっくり休め。', '一人、また一人……。それでも、行く。'],
    g: ['{名}が倒れたか。……数えるな、進め。', '陛下には、私から申し上げる。', '{名}……。帝国の記録に、名を残そう。', '……二度捕らわれ、二度目は戻らなかったか。', '黙って祈れ。それが、帝国の弔いだ。', '惜しい兵を、失った。', '{名}。宝玉の光が、お前を迎えますように。', '倒れた者の盾は、私が拾う。']
  };
  function mournLine(type, side, name) { return mk('m', type, side, 'hurt', fill(pickFrom(side === 0 ? MOURN.s : MOURN.g, 'mourn' + side).replace(/\{名\}/g, name || '兵'), side)); }
  // 帰還の場面
  var RETURN_WELCOME = {
    s: ['{名}! 生きていたのか!', 'よく戻った、{名}。温かい飯がある。', '帰ってきたか。……顔を見せろ。', '{名}が戻ったぞ! 皆、場所を空けろ!', '無事でよかった。本当に、よかった。', 'おかえり。……待っていた。'],
    g: ['{名}、戻ったか。陛下もお喜びだろう。', '生きていたとは。帝国の兵はしぶとい。', '{名}。よく、戻った。', '帰還、ご苦労。……顔色が悪いな。休め。', '取り返したぞ。二度と渡すな。', '戻ったか。報告は後でいい。']
  };
  var RETURN_REPLY = ['……ただいま、戻りました。', '向こうの飯はまずかった。', '帰ってこられるとは、思わなかった。', '……また、ここに立てるのか。', '敵の陣の様子なら、話せます。', '鎖の跡が、まだ痛む。でも、戦える。'];
  var RETURN_DOUBT = {
    guard: ['敵の陣で、何を吹き込まれた。', '戻ったのはいい。だが、目を離すなよ。', '捕虜の間に、何を話した。……言えぬか。'],
    _: ['……本当に、こちらの者のままか?', '向こうで寝返りの話を聞かされなかったか。', '疑うのは、生き延びるためだ。悪く思うな。']
  };
  var RETURN_KING = {
    s: ['よく戻ってくれた。……もう、どこへも行かせない。', '君の顔をまた見られるとは。', '帰還を心から喜ぶ。'],
    g: ['戻ったか。余の盤に、再び立て。', 'よく帰った。……余は、お前を忘れていなかった。', '帰還を許す。いや、……よく戻った。']
  };
  // 帰還者のひとこと (捕虜の日々を語る)
  HITO.returned = ['向こうの陣でも、夜は寒かった。', '捕虜の間、ずっと仲間の声を思い出していた。', '鎖の跡が、雨の日に痛む。', '向こうの兵も、腹を空かせていた。', '二度と、あの天幕には戻りたくない。', '帰ってこられた。それだけで、十分だ。'];
  // 黒魔術の蘇り (自我の段階 1〜3。4以上は空ろで無言)
  var RAISE_LINES = {
    1: ['……なぜ、起こした。{出自}には、もう帰ったはずだ。', '眠っていたかった……。', '……寒い。土の中より、寒い。', 'この体はもう俺のものじゃない。', '誰の声だ。……呼ぶな。', '{出自}の夢を、見ていたのに。'],
    2: ['{出自}……。どこ、だった……。', '誰の、軍だ……。', '名前……呼ばれた、気が……。', '寒い……。いや、何も……感じない。', '前……前へ……。', '……ここは、どこだ。'],
    3: ['命令を。', '……進む。', '敵は、どこだ。', '……。命令を、待つ。', '動く。', '……はい。']
  };
  var RAISE_BAND = { 1: '黒魔術 ― 死者が呼び戻される', 2: '黒魔術 ― 呼び戻される度に、何かが消える', 3: '黒魔術 ― 名を失いかけた兵', 4: '空ろの兵' };
  var RAISE_CASTER = {
    s: ['……すまない。もう一度だけ、力を貸してくれ。', '眠りを妨げるのは、私の罪だ。', '起きよ。……許しは、後で乞う。'],
    g: ['南の馬家の術、とくと見よ。……起きよ。', '死者も兵の数。宰相閣下の仰せだ。', '起きよ。帝国は、休むことを許さぬ。']
  };
  var RAISE_DISGUST = ['死者まで、戦わせるのか……。', 'あれは、もう……。見ていられない。', '眠らせてやってくれ。頼む。', '{主}、これは……正しいのですか。', '勝つためなら、何でもするのか。', '……あいつの目を、見たか。誰もいなかった。'];
  // 死人が再び倒れるときの言葉 (段階3以上は無言)
  var FALL_LINES = { 1: ['……やっと、眠れる。', 'ありがとう。……今度は、起こさないでくれ。', '{出自}へ……帰る。'], 2: ['……ああ……。', '静かに……なる……。', '……帰る、場所……。'] };
  // 死人についてのひとこと (周りの駒が話す)
  HITO.undeadNear = ['あれは、もう誰でもない。', '目を合わせるな。……向こうは、もう見ていない。', '昨日まで、名前を呼べたのに。', '足音がしない。……気味が悪い。', '死人と並んで戦う日が来るとはな。', 'あいつにも、帰る村があったはずだ。'];
  HITO.undead = ['……。', '寒い……。', '命令を……待つ。', '前へ……。', '……ここは、どこだ。'];

  function raiseScene(base, side, origin, raised) {
    var stage = egoStage(raised), out = { stage: stage, band: RAISE_BAND[stage], caster: null, line: null, disgust: null };
    out.caster = mk('c', side === 0 ? 'B' : 'B', side, 'hurt', fill(pickFrom(side === 0 ? RAISE_CASTER.s : RAISE_CASTER.g, 'rc' + side), side));
    if (stage <= 3) out.line = mk('u', base, side, stage === 1 ? 'hurt' : 'normal', fill(pickFrom(RAISE_LINES[stage], 'raise' + stage).replace(/\{出自\}/g, origin || '故郷'), side));
    out.disgust = mk('d', null, side, 'hurt', fill(pickFrom(RAISE_DISGUST, 'disgust'), side));
    return out;
  }
  function fallLine(base, side, origin, raised) {
    var stage = egoStage(raised);
    if (stage >= 3) return null; // 無言で崩れる
    return mk('u', base, side, 'normal', fill(pickFrom(FALL_LINES[stage] || FALL_LINES[1], 'fall' + stage).replace(/\{出自\}/g, origin || '故郷'), side));
  }
  function returnScene(base, side, name, houseId) {
    var w = RETURN_WELCOME[side === 0 ? 's' : 'g'];
    var out = { welcome: mk('w', null, side, 'joy', fill(pickFrom(w, 'rw' + side).replace(/\{名\}/g, name || '兵'), side)), reply: mk('r', base, side, 'normal', fill(pickFrom(RETURN_REPLY, 'rr'), side)), doubt: null };
    // 金将 (古参の近衛) が戻ったときは、同じ近衛の疑いが必ず出る (54章: 金将は家なし)
    if (base === 'G' || rng() < 0.3) out.doubt = mk('d', 'G', side, 'angry', fill(pickFrom(RETURN_DOUBT[base === 'G' ? 'guard' : '_'], 'rd'), side));
    return out;
  }
  function returnKingLine(side) { return mk('k', 'K', side, 'joy', fill(pickFrom(RETURN_KING[side === 0 ? 's' : 'g'], 'rk' + side), side)); }
  // エピローグの断片: 戦死した者たち (名家の駒を優先して5つまで) / 蘇らされた者 (最も多く蘇った駒について一行)
  function warDeadText(names) { return '戦に倒れ、二度と戻らなかった者たち。' + names.join('、') + '。その名は、北の砦の石に刻まれている。'; }
  var KANSUJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  function raisedText(name, n) {
    var k = KANSUJI[Math.min(n, 10)] || String(n);
    if (n >= 3) return '亡き' + name + 'は、' + k + '度呼び戻され、最後には自分の名も忘れた。';
    if (n === 2) return '亡き' + name + 'は、二度呼び戻された。二度目にはもう故郷の名を言えなかった。';
    return '亡き' + name + 'は、一度だけ呼び戻された。「なぜ起こした」と問うた声を、術者は忘れられなかった。';
  }
  var DARK_NOTE = { s: '勝利の陰で、暁の軍が死者を呼び戻したことは、誰も口にしなかった。その夜のことを語る者は、いまもいない。', g: '帝国は勝った。だが、死者を戦わせた南の馬家の術のことは、宮廷の誰もが知っていて、誰も語らなかった。' };


  // ---- 禁じ手は登場人物が止める (40章)。決まりを説明せず、人物の判断・気持ちとして断る ----
  var FORBID = {
    guard: {
      G: [{ s: 'お待ちを! そちらは敵の刃の下です!', g: 'お待ちを、陛下! そちらは敵の刃の下にございます!' }, '今、背を向けてはなりません!', '{主}、その道は通せません。私が前に立ちます。', 'なりませぬ。敵の槍がこちらを向いております!', '退いてください。ここで倒れては、皆が路頭に迷う!', '盾の役目を、果たさせてください!'],
      S: ['お待ちなされ。そこは敵の目の前じゃ。', 'ふぉ、年寄りの目はごまかせんぞ。そこは危ない。', '影から見ておった。その先に刃が光っておる。', '{主}、足元をよう見なされ。', '退き道を先に作りなされ。それからじゃ。', 'その一歩はわしが許さん。']
    },
    king: {
      s: ['……いや、それは無謀だな。', '踏み出せば、皆を置いていくことになる。やめておこう。', '待て。刃の届く所へ、自分から行くことはない。', '……落ち着け。今は動く時ではない。', '危ういな。別の道を探そう。'],
      g: ['……ふん。そこへ出るほど、余は愚かではない。', '余が刃の前に出ると思うたか。', '待て。……今の一歩は、取り消す。', '軽々しく動くな、と昔の余なら言ったろう。', '危ういな。退くのも王の務めよ。']
    },
    shy: ['呼ばれた途端に王の首を狙う奇襲なんて……できません。', '降り立ったその場で、とどめの不意打ち? 足がすくむ……。', 'む、無理です! 着いたばかりで、いきなり王を討つなんて……!', 'さっき呼ばれたばかりの僕が、奇襲で王の前に? ……できません。', '空から降りて、そのまま王の首を……? 足が、動かない……。', '呼ばれてすぐの奇襲で決着なんて、重すぎます……。'],
    elder: ['降ってきたばかりの奇襲で、王を討たせるわけにはいかん。', '呼んだその場でとどめは刺させん。歩いて来た者に任せろ。', '焦るな。不意打ちで王の首は取らせん。歩いて詰め寄れ。', '着いたばかりのお前に、奇襲のとどめは背負わせん。', '新兵でも、歩いて来たなら邪魔はせん。だが降ってすぐは早い。'],
    refuse: {
      P: ['そこに降りたら、二度と前に出られません。', 'その先には、もう一歩も進めません……。', '行き止まりに立つのは、ちょっと……。', '前に進めない場所は怖いです。', 'そこでは、何の役にも立てません!'],
      L: ['その先に道はない。槍が泣く。', '……前がない場所には、立たない。', '槍は前へ進むためのものだ。そこでは錆びる。', '断る。そこは、行き止まりだ。', '……まっすぐ進めない所へは、行かない。'],
      N: ['跳ぶ先がない場所には行けないね。', 'そこじゃ、もう跳べないよ!', '着地はできても、次がないなあ。', '騎兵に、跳ぶなって言うの?', 'うーん、そこは勘弁して!']
    },
    band: { guard: '近衛が立ちふさがった', king: '王が思いとどまった', shy: '新兵が尻込みした', refuse: '兵が断った' }
  };
  /*
   * 禁じ手を止める台詞。reason: 'selfcheck' | 'uchifuzume' | 'deaddrop'
   * ctx = {side, piece (動かす/打つ駒), guard: 'G'|'S'|null (王の近くの近衛), kingMove: bool, rand}
   * 戻り値 {band, lines: [{role: 'guard'|'king'|'piece'|'elder', type, side, face, text}]}
   */
  function forbid(reason, ctx) {
    ctx = ctx || {};
    var side = ctx.side || 0, rand = typeof ctx.rand === 'function' ? ctx.rand : rng, out = { band: '', lines: [] };
    if (reason === 'selfcheck') {
      var kingSelf = !ctx.guard || (ctx.kingMove && rand() < 0.4);
      if (kingSelf) { out.band = FORBID.band.king; out.lines.push(mk('king', 'K', side, 'hurt', resolve(pickFrom(FORBID.king[side === 0 ? 's' : 'g'], 'fbk' + side), side))); }
      else { out.band = FORBID.band.guard; out.lines.push(mk('guard', ctx.guard, side, 'angry', resolve(pickFrom(FORBID.guard[ctx.guard], 'fbg' + ctx.guard), side))); }
    } else if (reason === 'uchifuzume') {
      out.band = FORBID.band.shy;
      out.lines.push(mk('piece', 'P', side, 'hurt', resolve(pickFrom(FORBID.shy, 'fbs'), side)));
      out.lines.push(mk('elder', ctx.elder || 'G', side, 'normal', resolve(pickFrom(FORBID.elder, 'fbe'), side)));
    } else if (reason === 'deaddrop') {
      var b = FORBID.refuse[ctx.piece] ? ctx.piece : 'P';
      out.band = FORBID.band.refuse;
      out.lines.push(mk('piece', b, side, 'surprise', resolve(pickFrom(FORBID.refuse[b], 'fbr' + b), side)));
    } else return null;
    return out;
  }


  // ---- 道の状態の表示 (44章) と、敵軍の道・自ら投了する和の軍 (45章) ----
  var PATH_MARK = { light: '光', shadow: '影', harmony: '和' };
  // 先頭の道 (同点は 光→和→影)。点がまだなければ null
  function leadPath(points) {
    points = points || {};
    if (!(points.light || points.shadow || points.harmony)) return null;
    return decidePath(points);
  }
  var TILT = {
    light: { s: ['軍は慈悲の色を帯びはじめた', '暁の兵の顔に、やわらかな光が差した', '軍の中に、誰も見捨てないという声が満ちてきた'], g: ['帝国の陣に、思いがけず温かな風が吹いた', '帝国の兵が敵にも礼を尽くしはじめた', '黄昏の軍に、かすかな慈悲の色が差した'] },
    shadow: { s: ['軍に冷たい風が吹きはじめた', '暁の兵の目から、迷いが消えた。代わりに、何かも消えた', '勝つためなら、と口にする者が増えた'], g: ['帝国の陣に、いっそう冷たい風が吹いた', '兵の目が宝玉の光から離れなくなった', '黄昏の軍は勝つことだけを数えはじめた'] },
    harmony: { s: ['軍の中に、和を望む声が増えた', '暁の兵が敵の兵の名を尋ねるようになった', '戦の終わらせ方を話す者が増えた'], g: ['帝国の陣から、戦をやめたいという声が漏れ聞こえる', '帝国の兵が敵の旗を憎まなくなった', '黄昏の軍に、和を望む声が広がった'] }
  };
  // 先頭の道が入れ替わったときだけ新しい先頭を返す (それ以外は null)
  function pathChange(before, after) { var a = leadPath(before), b = leadPath(after); return b && a !== b ? b : null; }
  function tiltBand(side, path) { var t = TILT[path]; return t ? pickFrom(t[side === 1 ? 'g' : 's'], 'tilt' + side + path) + '(' + PATH_MARK[path] + ')' : ''; }
  // いまの傾きを一文で。log = [{k: 出来事の種類, p: 道}] (選んだ選択の記録)
  var LOG_PHRASE = {
    'cap-persuade': function (n) { return '捕虜を' + kan(n) + '人迎え入れ'; },
    'cap-surrender': function (n) { return '降伏を' + kan(n) + '度受け入れ'; },
    'cap-nomercy': function (n) { return '問答無用で' + kan(n) + '人を討ち'; },
    welcome: function (n) { return '寝返った兵に' + kan(n) + '度声をかけ'; },
    envoy: function () { return '密使には民の安全を約束させた'; },
    shirakawa: function () { return '白河で溺れる兵を救い'; },
    monologue: function () { return '王手の下で胸の内を明かし'; },
    ensemble: function (n) { return '兵たちの声に' + kan(n) + '度答え'; },
    dark: function (n) { return '死者を' + kan(n) + '度呼び戻し'; }
  };
  function kan(n) { return n <= 10 ? (['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n] || String(n)) : String(n); }
  function armySummary(side, points, log) {
    var lead = leadPath(points), army = ARMY[side] || ARMY[0];
    var head = lead ? army + 'は、' + PATH_NAME[lead] + 'を歩んでいる。' : army + 'は、まだどの道とも決めていない。';
    var cnt = {}, order = [];
    (log || []).forEach(function (e) { if (!LOG_PHRASE[e.k]) return; if (!cnt[e.k]) order.push(e.k); cnt[e.k] = (cnt[e.k] || 0) + 1; });
    order.sort(function (a, b) { return cnt[b] - cnt[a]; });
    var parts = order.slice(0, 3).map(function (k) { return LOG_PHRASE[k](cnt[k]); });
    if (!parts.length) return head;
    var tail = parts.join('、');
    if (!/た$/.test(tail)) tail += 'た';
    return head + tail.replace(/し$/, 'した').replace(/げ$/, 'げた').replace(/れ$/, 'れた').replace(/ち$/, 'った').replace(/え$/, 'えた') + '。';
  }
  // 敵軍の様子 (点数は見せず、言葉だけ)
  var ENEMY_MOOD = {
    light: { s: ['暁の陣から、捕虜をいたわる声が聞こえる。', '解放軍の兵は敵にも水を分けているらしい。'], g: ['帝国の陣で、捕虜に毛布が配られたという。', '帝国の兵が倒れた敵兵に礼を尽くしていた。'] },
    shadow: { s: ['暁の陣は勝つことだけを見ている。', '解放軍の兵の目が冷たくなった。'], g: ['帝国の陣から、冷たい号令ばかりが聞こえる。', '帝国の兵は宝玉の光に魅入られている。'] },
    harmony: { s: ['暁の陣から、戦をやめたいという声が漏れ聞こえる。', '解放軍の兵がこちらの兵の名を尋ねていたという。'], g: ['帝国の陣から、戦をやめたいという声が漏れ聞こえる。', '帝国の兵が旗を降ろす日の話をしていたという。'] },
    none: { s: ['暁の陣の様子はまだ読めない。'], g: ['帝国の陣の様子はまだ読めない。'] }
  };
  function enemyMood(side, points) { var l = leadPath(points) || 'none'; var a = ENEMY_MOOD[l][side === 1 ? 'g' : 's']; return a[(points && (points.light + points.shadow + points.harmony)) % a.length || 0]; }
  // CPU の隠れた気質 (対局の種から。ほぼ均等)
  function cpuTemper(seed) { return PATHS[Math.floor(fateRoll(seed, -1, 4242) * 3) % 3]; }
  // 駒取りの型 → 道 (CPU の点)
  var CAPTURE_PATH = { persuade: 'harmony', yield: 'harmony', reunion: 'harmony', message: 'harmony', duel: 'light', kabuki: 'light', bravado: 'light', oneblow: 'shadow', silent: 'shadow', flee: null };
  function capturePath(type) { return CAPTURE_PATH[type] || null; }
  // 気質に寄せて型を選ぶ (気質と同じ道の型を3倍出やすく)
  function pickCaptureTypeBiased(st, temper, rand, pool) {
    rand = typeof rand === 'function' ? rand : rng;
    pool = (pool || CAPTURE_TYPES).filter(function (t) { return t !== 'persuade' && (!st || t !== st.prev); });
    var w = pool.map(function (t) { return CAPTURE_PATH[t] === temper ? 3 : 1; }), tot = w.reduce(function (a, b) { return a + b; }, 0), r = rand() * tot;
    for (var i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  // CPU が自ら投了するか: 先頭が和で和3点以上、30手目以降、評価値が2手番続けて飛車1枚分以上の劣勢か、自玉の詰みを読み切った
  var RESIGN_EVAL = -960, RESIGN_MATE = -29000;
  function cpuShouldResign(c) {
    c = c || {};
    var pts = c.points || {};
    if (leadPath(pts) !== 'harmony' || (pts.harmony || 0) < 3) return false;
    if ((c.ply || 0) < 30) return false;
    var ev = c.evals || [];
    if (ev.length && ev[ev.length - 1] <= RESIGN_MATE) return true;
    return ev.length >= 2 && ev[ev.length - 1] <= RESIGN_EVAL && ev[ev.length - 2] <= RESIGN_EVAL;
  }
  var RESIGN_TALK = {
    guard: { s: ['王よ、まだ戦えます!', '私が盾になります。どうか、まだ……!', 'お待ちを。兵はまだ残っております!'], g: ['陛下、まだ戦えます!', '近衛はまだ倒れておりませぬ!', '陛下、どうか剣を……!'] },
    king: { s: ['いや、もう十分だ。……旗を。', '君たちの名を、これ以上弔いの列に加えたくない。', 'ありがとう。だから、ここで終わらせる。'], g: ['いや、もう十分だ。旗を降ろせ。', '勝てぬ戦で兵を失うのは、もう十分だ。', '……よい。余が決めたことだ。'] }
  };
  function resignTalk(side) { var k = side === 1 ? 'g' : 's'; return [mk('g', 'G', side, 'hurt', pickFrom(RESIGN_TALK.guard[k], 'rsg' + k)), mk('k', 'K', side, 'normal', pickFrom(RESIGN_TALK.king[k], 'rsk' + k))]; }


  // ---- 陣中日誌 (41章: 対局の保存と再開) ----
  // 保存するのは 設定・乱数の種・初期局面・指し手・物語の状態。盤面・持ち駒・駒の状態は指し手から作り直す (待ったと同じ)
  var JOURNAL_VERSION = 1;
  function seededRandom(seed) {
    var a = (seed | 0) || 1;
    return function () { a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function moveCode(m) { return (m.drop ? '*' + m.piece : String(m.from.y * 9 + m.from.x)) + '-' + (m.to.y * 9 + m.to.x) + (m.promote ? '+' : ''); }
  function journalMake(o) {
    return { v: JOURNAL_VERSION, at: o.at || Date.now(), settings: o.settings, field: o.field, seed: o.seed, init: o.init, moves: (o.moves || []).map(moveCode), story: o.story, storyAt: o.storyAt || null,
      label: { field: o.fieldName || '', ply: o.ply || 0, phase: phaseOf(o.ply || 0).label } };
  }
  // 指し手から局面の列を作り直す。合わない手があれば null
  function journalRebuild(E, data) {
    var st = E.fromSfen(data.init), stack = [st];
    for (var i = 0; i < data.moves.length; i++) {
      var code = data.moves[i], lm = E.legalMoves(st), hit = null;
      for (var j = 0; j < lm.length && !hit; j++) if (moveCode(lm[j]) === code) hit = lm[j];
      if (!hit) return null;
      st = E.applyMove(st, hit); stack.push(st);
    }
    return stack;
  }
  // ---- 再レビュー修正 (S11): 日誌の物語の状態 (story・storyAt の各局面) を型と範囲で確かめ、再開に使える形にそろえる ----
  // 欠けているキーは新しい対局の値 (UI の newStory と同じ) で埋め、あるのに型・範囲が合わないキーがあれば日誌ごと読まない (null)。
  // 知らないキーは捨てる (物語の状態として読むのは J_STORY のキーだけ)。'__proto__' などの名前はどの階層でも受け付けない
  var J_NUM_MAX = 1000000; // 点・回数・手数の範囲 (正常な対局はこれよりずっと小さい)
  function jInt(v, lo, hi) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= lo && v <= hi; }
  function jCount(v) { return jInt(v, 0, J_NUM_MAX); }
  function jPly(v) { return jInt(v, -J_NUM_MAX, J_NUM_MAX); }
  function jNum(v) { return typeof v === 'number' && isFinite(v) && Math.abs(v) <= 1e9; }
  function jBool(v) { return v === true || v === false; }
  function jStr(v) { return typeof v === 'string' && v.length <= 64; }
  function jId(v) { return v === null || jPly(v) || jStr(v); }
  function jSide(v) { return v === 0 || v === 1; }
  function jPlain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype; }
  function jBadKey(k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; } // (オブジェクトの書き方の '__proto__' は名前にならないので関数で比べる)
  // 名前 → 値 の表 (val で値を確かめる)
  function jMap(v, val) {
    if (!jPlain(v)) return false;
    var ks = Object.keys(v);
    for (var i = 0; i < ks.length; i++) if (jBadKey(ks[i]) || ks[i].length > 64 || !val(v[ks[i]])) return false;
    return true;
  }
  function jFlags(v) { return jMap(v, jBool); }
  function jPair(v, val) { return Array.isArray(v) && v.length === 2 && val(v[0]) && val(v[1]); }
  function jList(v, val) { return Array.isArray(v) && v.every(val); }
  // spec: 名前 → [なくてはならないか, 確かめる関数]。spec にない名前があれば不可
  function jObj(v, spec) {
    if (!jPlain(v)) return false;
    var ks = Object.keys(v);
    for (var i = 0; i < ks.length; i++) if (jBadKey(ks[i]) || !Object.prototype.hasOwnProperty.call(spec, ks[i])) return false;
    for (var k in spec) if (spec.hasOwnProperty(k)) { if (!Object.prototype.hasOwnProperty.call(v, k)) { if (spec[k][0]) return false; continue; } if (!spec[k][1](v[k])) return false; }
    return true;
  }
  function jNullOr(f) { return function (x) { return x === null || f(x); }; }
  function jPoints(v) { return jObj(v, { light: [true, jCount], shadow: [true, jCount], harmony: [true, jCount] }); }
  function jTempo(v) {
    return jObj(v, { log: [true, function (l) { return jList(l, function (e) { return jObj(e, { ply: [true, jPly], kind: [false, jStr], ms: [true, jNum] }); }); }],
      ens: [true, function (l) { return jList(l, jPly); }], captures: [true, jCount] });
  }
  function jCastle(v) { return v === null || jObj(v, { last: [false, jNullOr(jStr)], brokenAt: [false, jNullOr(jPly)] }); }
  function jCapType(v) { return v === null || jObj(v, { prev: [false, jNullOr(jStr)], persuade: [true, jCount], total: [true, jCount] }); }
  function jRain(v) { return jList(v, function (r) { return jObj(r, { start: [true, jPly], end: [true, jPly] }) && r.start <= r.end; }) && v.length <= 16; }
  function jPending(v) { return v === null || jObj(v, { trigger: [true, jStr], side: [true, jSide], ply: [true, jPly] }); }
  function jLogEntry(e) { return jObj(e, { k: [true, jStr], p: [true, jStr] }); }
  function jAdvice(v) {
    return jObj(v, { decided: [false, jBool], active: [false, jBool], id: [false, jNullOr(jStr)], advisor: [false, jId],
      st: [false, jNullOr(function (x) { return jObj(x, { miss: [false, jCount], sinceReact: [false, jCount], active: [false, jBool] }); })] });
  }
  function jFuri(v) {
    return jObj(v, { done: [false, jFlags], last: [false, jNullOr(jPly)], prev: [false, jNullOr(jPly)],
      pending: [false, function (l) { return jList(l, function (c) { return jObj(c, { id: [true, jStr], side: [true, jSide], ply: [true, jPly] }); }); }] });
  }
  // キー: [新しい対局の値を返す関数 (null = 対局の途中で加わるキー。なければ置かない), 確かめる関数]
  var J_STORY = {
    points: [function () { return [{ light: 0, shadow: 0, harmony: 0 }, { light: 0, shadow: 0, harmony: 0 }]; }, function (v) { return jPair(v, jPoints); }],
    envoyAccepted: [function () { return [false, false]; }, function (v) { return jPair(v, jBool); }],
    envoyDone: [function () { return false; }, jBool],
    choices: [function () { return 0; }, jCount], capChoices: [function () { return 0; }, jCount], defChoices: [function () { return 0; }, jCount],
    seenEns: [function () { return {}; }, jFlags], ensCount: [function () { return 0; }, jCount],
    monologue: [function () { return [false, false]; }, function (v) { return jPair(v, jBool); }],
    hitoCounter: [function () { return 0; }, jCount], castleSeen: [function () { return {}; }, jFlags],
    igyoku: [function () { return [false, false]; }, function (v) { return jPair(v, jBool); }],
    narrated: [function () { return {}; }, jFlags], castle: [function () { return [null, null]; }, function (v) { return jPair(v, jCastle); }],
    capType: [function () { return null; }, jCapType], rain: [function () { return []; }, jRain], rainSaid: [function () { return {}; }, jFlags],
    tempo: [function () { return newTempo(); }, jTempo], pendingEns: [function () { return null; }, jPending],
    log: [null, function (v) { return jPair(v, function (l) { return jList(l, jLogEntry); }); }],
    advice: [null, jNullOr(jAdvice)], adviceSoon: [null, jBool],
    cpuEvals: [null, function (v) { return jList(v, jNum) && v.length <= 16; }], cpuTemper: [null, function (v) { return v === null || PATHS.indexOf(v) >= 0; }],
    darkArts: [null, function (v) { return jPair(v, jCount); }],
    decoyFallen: [null, function (v) { return v === null || v === false || jObj(v, { id: [false, jId], type: [false, jStr] }); }], decoyId: [null, jId],
    events: [null, function (v) { return jMap(v, jCount); }], fieldDone: [null, jBool], furi: [null, jNullOr(jFuri)],
    hitoLast: [null, function (v) { return jMap(v, jPly); }], pair: [null, jId], ravenMarks: [null, function (v) { return jList(v, jStr) && v.length <= 64; }],
    ravenUsed: [null, jFlags], rescued: [null, function (v) { return v === null || jSide(v); }], reunited: [null, jFlags], stratSeen: [null, jFlags]
  };
  // 戻り値: そろえた物語の状態 (新しいオブジェクト) / 読めなければ null
  function journalStory(sty) {
    if (!jPlain(sty)) return null;
    var out = {};
    for (var k in J_STORY) {
      if (!J_STORY.hasOwnProperty(k)) continue;
      var def = J_STORY[k][0], val = J_STORY[k][1];
      if (!Object.prototype.hasOwnProperty.call(sty, k) || sty[k] === undefined) { if (def) out[k] = def(); continue; }
      if (!val(sty[k])) return null;
      out[k] = JSON.parse(JSON.stringify(sty[k]));
    }
    // 読み込んだあと最初に使う処理を通しておく (ここで例外が出る形は読まない)
    tempoCan(out.tempo, 0, 0); tempoUsed(out.tempo, 0); ensembleOk(out.tempo, 0, {}); rainAt(out.rain, 0); leadPath(out.points[0]); leadPath(out.points[1]);
    return out;
  }
  // 再レビュー修正 (S12): 日誌の上限 (決め方は decodeJournal の上の説明)
  //   J_MAX_MOVES = 指し手の数、J_MAX_TEXT = 文字列の長さ (空白を除く)、J_MAX_RAW = 展開したあとの長さ (UTF-8 のバイト数)
  var J_MAX_MOVES = 2000, J_MAX_TEXT = 4000000, J_MAX_RAW = 24000000;
  // 41章・S9: 日誌の検証。設定・物語・初期局面 (両方の王がいるか)・指し手を確かめ、作り直しの例外も読み込みの失敗として扱う
  // 再レビュー修正 (S11): 物語の状態 (story) と各局面の物語 (storyAt) も型と範囲で確かめてそろえ、戻り値に入れる。
  //   {ok: true, stack, story, storyAt (stack と同じ長さ。各要素はそろえた物語か null), seed, field}。UI はこれで再開の状態を作る
  // 実装レビューの直し (T2): 日誌の初期局面 (SFEN) の数を確かめる。手数は 1 から J_NUM_MAX までの整数 (0 で始まらない数字だけ)。
  // 持ち駒は各軍・各種類が 0 以上で、その種類の総数以内。盤上 (成った駒は元の種類) と両軍の持ち駒を合わせた枚数が、種類ごとの総数を超えない。
  // 形が合わなければ null。合えば { moveNo, hand: [[0, 歩, 香, 桂, 銀, 金, 角, 飛], [...]] } (種類の番号はエンジンと同じ 1〜7)
  var J_SFEN_TYPE = { p: 1, l: 2, n: 3, s: 4, g: 5, b: 6, r: 7, k: 8 };
  var J_SFEN_TOTAL = [0, 18, 4, 4, 4, 4, 2, 2, 2];
  function journalSfenCounts(str) {
    if (typeof str !== 'string') return null;
    var parts = str.trim().split(/\s+/);
    if (parts.length < 3 || parts.length > 4) return null;
    var rows = parts[0].split('/'), used = [0, 0, 0, 0, 0, 0, 0, 0, 0], hand = [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]], i, t;
    if (rows.length !== 9) return null;
    for (var y = 0; y < 9; y++) for (i = 0; i < rows[y].length; i++) {
      var ch = rows[y][i];
      if (ch === '+' || (ch >= '1' && ch <= '9')) continue;
      t = J_SFEN_TYPE[ch.toLowerCase()];
      if (!t) return null;
      used[t]++;
    }
    if (parts[2] !== '-') {
      if (!/^(?:(?:[1-9][0-9]?)?[PLNSGBRplnsgbr])+$/.test(parts[2])) return null;
      var re = /([1-9][0-9]?)?([PLNSGBRplnsgbr])/g, m;
      while ((m = re.exec(parts[2]))) {
        var n = m[1] ? parseInt(m[1], 10) : 1, c = m[2], side = c === c.toLowerCase() ? 1 : 0;
        t = J_SFEN_TYPE[c.toLowerCase()];
        hand[side][t] += n;
        if (hand[side][t] > J_SFEN_TOTAL[t]) return null;
      }
    }
    for (t = 1; t <= 8; t++) if (used[t] + (t <= 7 ? hand[0][t] + hand[1][t] : 0) > J_SFEN_TOTAL[t]) return null;
    var moveNo = 1;
    if (parts.length === 4) {
      if (!/^[1-9][0-9]{0,6}$/.test(parts[3])) return null;
      moveNo = parseInt(parts[3], 10);
      if (moveNo > J_NUM_MAX) return null;
    }
    return { moveNo: moveNo, hand: hand };
  }
  function journalValidate(E, data) {
    try {
      if (!jPlain(data) || data.v !== JOURNAL_VERSION) return { ok: false, reason: data && typeof data.v === 'number' && data.v < JOURNAL_VERSION ? 'old' : 'broken' };
      var st = data.settings || {};
      if (['cpu', 'pvp'].indexOf(st.mode) < 0 || [0, 1].indexOf(st.side) < 0 || [0, 1, 2].indexOf(st.level) < 0 || [1, 2].indexOf(st.talk) < 0) return { ok: false, reason: 'broken' };
      if (typeof data.init !== 'string' || data.init.length > 200 || !Array.isArray(data.moves) || data.moves.length > J_MAX_MOVES || data.moves.some(function (m) { return typeof m !== 'string' || m.length > 8; })) return { ok: false, reason: 'broken' };
      if (data.seed != null && !jInt(data.seed, -2147483648, 2147483647)) return { ok: false, reason: 'broken' };
      if (data.field != null && !jStr(data.field)) return { ok: false, reason: 'broken' };
      var story = journalStory(data.story);
      if (!story) return { ok: false, reason: 'broken' };
      if (data.storyAt != null && (!Array.isArray(data.storyAt) || data.storyAt.length > data.moves.length + 1)) return { ok: false, reason: 'broken' };
      var storyAt = [];
      for (var a = 0; a < data.moves.length + 1; a++) {
        var x = data.storyAt ? data.storyAt[a] : null;
        if (x == null) { storyAt.push(null); continue; }
        var nx = journalStory(x);
        if (!nx) return { ok: false, reason: 'broken' };
        storyAt.push(nx);
      }
      // 実装レビューの直し (T2): 初期局面の SFEN の手数と持ち駒の枚数を、エンジンへ渡す前に確かめる (変換したあとも同じ値か確かめる)
      var sf = journalSfenCounts(data.init);
      if (!sf) return { ok: false, reason: 'broken' };
      var init = E.fromSfen(data.init), kings = [0, 0];
      if (init.ply !== sf.moveNo - 1) return { ok: false, reason: 'broken' };
      for (var hs = 0; hs < 2; hs++) for (var ht = 1; ht <= 7; ht++) if (init.hands[hs][ht] !== sf.hand[hs][ht]) return { ok: false, reason: 'broken' };
      for (var i = 0; i < 81; i++) { if (init.board[i] === 8) kings[0]++; if (init.board[i] === -8) kings[1]++; }
      if (kings[0] !== 1 || kings[1] !== 1) return { ok: false, reason: 'broken' };
      var stack = journalRebuild(E, data);
      if (!stack) return { ok: false, reason: 'broken' };
      if (E.isOver(stack[stack.length - 1])) return { ok: false, reason: 'over' };
      return { ok: true, stack: stack, story: story, storyAt: storyAt, seed: data.seed || 1, field: data.field == null ? null : data.field };
    } catch (e) { return { ok: false, reason: 'broken' }; }
  }
  // S5/S6: 駒の終局時の状態。base = 基準の軍 (英雄 = 成った側、家・出身の兵 = 元の軍)
  function endStateOf(o) {
    if (o.fate === 'dead') return 'dead';
    if (o.fate === 'undead') return 'undead';
    return o.owner === o.base ? 'alive' : 'enemy';
  }
  // 凱旋の先頭に立つ「と金」: 終局時に自軍の盤上にいて、実際に +P の駒だけ
  function tokinOnBoard(pieces, heroId, side) { return (pieces || []).some(function (p) { return p.id === heroId && p.side === side && p.type === '+P'; }); }
  function journalHeading(data) {
    // 再レビュー修正 (S11): 見出しは読み込み前の一覧でも出すので、label が欠けた・壊れた日誌でも例外にしない
    var lb = data && data.label && typeof data.label === 'object' ? data.label : {};
    var d = new Date(data && data.at), z = function (n) { return (n < 10 ? '0' : '') + n; };
    return (typeof lb.field === 'string' && lb.field ? lb.field : '戦場') + ' ・ 第' + ((lb.ply | 0) + 1) + '手 ・ ' + (typeof lb.phase === 'string' ? lb.phase : '') + ' ・ ' + d.getFullYear() + '/' + z(d.getMonth() + 1) + '/' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  // 書き写し用の短い文字列: LZW で縮めて base64url。先頭に版
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function lzwPack(str) {
    var dict = {}, size = 256, w = '', out = [], i, c;
    for (i = 0; i < 256; i++) dict[String.fromCharCode(i)] = i;
    for (i = 0; i < str.length; i++) {
      c = str.charAt(i);
      if (dict[w + c] != null) { w += c; continue; }
      out.push(dict[w]); dict[w + c] = size++; w = c;
    }
    if (w) out.push(dict[w]);
    // 可変長のビット列 → 6ビットずつ
    var bits = 9, lim = 512, acc = 0, nb = 0, res = '', cnt = 256;
    for (i = 0; i < out.length; i++) {
      acc = acc * Math.pow(2, bits) + out[i]; nb += bits;
      while (nb >= 6) { nb -= 6; var v = Math.floor(acc / Math.pow(2, nb)); res += B64[v & 63]; acc -= v * Math.pow(2, nb); }
      cnt++; if (cnt >= lim) { bits++; lim *= 2; }
    }
    if (nb > 0) res += B64[(acc * Math.pow(2, 6 - nb)) & 63];
    return res;
  }
  // maxOut: 展開したあとの長さの上限。展開の途中で超えたら止める (再レビュー修正 S12)
  function lzwUnpack(s, count, maxOut) {
    var bits = 9, lim = 512, acc = 0, nb = 0, codes = [], cnt = 256, i;
    if (maxOut == null) maxOut = J_MAX_RAW;
    // 符号の数は、文字列の長さから決まる上限 (1文字 6 ビット、符号は 9 ビット以上) を超えない
    if (!(count >= 1) || count > Math.floor(s.length * 6 / 9) + 1) throw new Error('bad count');
    for (i = 0; i < s.length && codes.length < count; i++) {
      var v = B64.indexOf(s.charAt(i)); if (v < 0) throw new Error('bad char');
      acc = acc * 64 + v; nb += 6;
      if (nb >= bits) { nb -= bits; var code = Math.floor(acc / Math.pow(2, nb)); acc -= code * Math.pow(2, nb); codes.push(code); cnt++; if (cnt >= lim) { bits++; lim *= 2; } }
    }
    if (codes.length < count) throw new Error('short');
    var dict = [], size = 256, w, out, entry;
    for (i = 0; i < 256; i++) dict[i] = String.fromCharCode(i);
    w = dict[codes[0]]; if (w == null) throw new Error('bad code'); out = w;
    for (i = 1; i < codes.length; i++) {
      var k = codes[i];
      if (dict[k] != null) entry = dict[k]; else if (k === size) entry = w + w.charAt(0); else throw new Error('bad code');
      if (out.length + entry.length > maxOut) throw new Error('too long'); // S12: 展開の途中で上限を超えたら止める
      out += entry; dict[size++] = w + entry.charAt(0); w = entry;
    }
    return out;
  }
  function utf8(s) { return unescape(encodeURIComponent(s)); }
  function unutf8(s) { return decodeURIComponent(escape(s)); }
  function encodeJournal(data) {
    var raw = utf8(JSON.stringify(data)), n = 0;
    // 符号の数を先頭に (復元で末尾の余りを捨てるため)
    var dict = {}, size = 256, w = '', i, c;
    for (i = 0; i < 256; i++) dict[String.fromCharCode(i)] = i;
    for (i = 0; i < raw.length; i++) { c = raw.charAt(i); if (dict[w + c] != null) { w += c; continue; } n++; dict[w + c] = size++; w = c; }
    if (w) n++;
    return '日誌' + JOURNAL_VERSION + '.' + n.toString(36) + '.' + lzwPack(raw);
  }
  // 戻り値 {ok: true, data} / {ok: false, reason: 'broken' | 'old'}
  // 再レビュー修正 (S12): 上限を超える日誌は展開せずに 'broken' (読めません) とする。上限と決め方:
  //   正常な日誌は、各局面の物語の写し (storyAt) を含めて 1 手あたり展開 約 2 KB (物語の写し 1 つは 約 1〜2.6 KB で、手数とともに少しずつ増える)。
  //   実測 (2人対戦・会話ふつう・でたらめな手): 200 手で 展開 約 300,000 バイト・文字列 約 65,000 字、425 手で 展開 約 830,000 バイト・文字列 約 134,000 字。
  //   規則に手数の上限はないので、指し手は J_MAX_MOVES = 2,000 手 (プロの公式戦の最長記録 400 手あまりの約 5 倍) まで。
  //   すべてのキーを持つ 約 3 KB の写しを 2,000 手ぶん並べた試算 (test/regateA.check.mjs) で 展開 約 6,160,000 バイト・文字列 約 970,000 字。
  //   その約 4 倍として、文字列 J_MAX_TEXT = 4,000,000 字 (空白を除く。除く前は 8,000,000 字まで)、展開 J_MAX_RAW = 24,000,000 バイト。
  //   符号の数は文字列の長さから決まる上限を超えない。LZW は 2,760 字が 約 1,000,000 字に広がり、約 14,000 字で 24,000,000 字を超えるので、展開の途中で上限を超えたらそこで止める
  function decodeJournal(str) {
    str = String(str || '');
    if (str.length > 2 * J_MAX_TEXT) return { ok: false, reason: 'broken' };
    str = str.replace(/\s+/g, '');
    if (str.length > J_MAX_TEXT) return { ok: false, reason: 'broken' };
    var m = /^日誌(\d+)\.([0-9a-z]+)\.([A-Za-z0-9_-]+)$/.exec(str);
    if (!m) return { ok: false, reason: 'broken' };
    if (+m[1] !== JOURNAL_VERSION) return { ok: false, reason: +m[1] < JOURNAL_VERSION ? 'old' : 'broken' };
    try {
      var data = JSON.parse(unutf8(lzwUnpack(m[3], parseInt(m[2], 36), J_MAX_RAW)));
      if (!data || data.v !== JOURNAL_VERSION || typeof data.init !== 'string' || !Array.isArray(data.moves)) return { ok: false, reason: data && data.v && data.v < JOURNAL_VERSION ? 'old' : 'broken' };
      if (data.moves.length > J_MAX_MOVES) return { ok: false, reason: 'broken' };
      return { ok: true, data: data };
    } catch (e) { return { ok: false, reason: 'broken' }; }
  }
  var JOURNAL_MSG = { broken: 'この日誌は読めません', old: '古い日誌のため読めません', over: 'この日誌の対局は、すでに終わっています', nostore: 'この端末では日誌を残せません。下の文字列を控えておけば、あとで続きから遊べます' };
  // 保存領域 (localStorage) を安全に使う。例外を投げる環境でも止まらない
  function journalStore(storage, prefix) {
    prefix = prefix || 'tacticsshogi.journal.';
    return {
      save: function (slot, data) { try { storage.setItem(prefix + slot, encodeJournal(data)); return { ok: true }; } catch (e) { return { ok: false, reason: 'nostore', text: encodeJournal(data) }; } },
      load: function (slot) { var s; try { s = storage.getItem(prefix + slot); } catch (e) { return { ok: false, reason: 'nostore' }; } if (!s) return { ok: false, reason: 'empty' }; return decodeJournal(s); },
      remove: function (slot) { try { storage.removeItem(prefix + slot); return true; } catch (e) { return false; } },
      list: function (slots) { var self = this; return slots.map(function (sl) { var r = self.load(sl); return { slot: sl, ok: r.ok, data: r.ok ? r.data : null, reason: r.reason }; }); }
    };
  }

  // ---- 会話量とテンポ (37章) ----
  // 止める会話 (選択肢・駒取り・群像会話・二歩など) の量と長さを抑える。止めない会話 (ひとこと・語り・帯) はここで数えない
  var TEMPO = { window: 10, budgetMs: 30000, ensGap: 4, earlyPly: 10, earlyMax: 2, ensMax: 20, fullCaptures: 3, lineBase: 1200, perChar: 60, choiceMs: 3000 };
  // 1行の見積もり: 文字送り 20ms/字 + 全文表示から 1.2秒 + 40ms/字 (自動送りの式と同じ)
  function lineMs(t) { var s = typeof t === 'string' ? t : (t && t.text) || ''; return s ? TEMPO.lineBase + TEMPO.perChar * s.length : 0; }
  function estimateMs(lines, choices) { return (lines || []).reduce(function (a, l) { return a + lineMs(l); }, 0) + (choices || 0) * TEMPO.choiceMs; }
  function newTempo() { return { log: [], ens: [], captures: 0 }; }
  // 直近10手 (ply-9 〜 ply) に止めた時間の合計
  function tempoUsed(t, ply) { return t.log.reduce(function (a, e) { return e.ply > ply - TEMPO.window && e.ply <= ply ? a + e.ms : a; }, 0); }
  function tempoBlocked(t, ply) { return t.log.some(function (e) { return e.ply === ply; }); }
  // この手番にもう1つ止める会話を出してよいか (1手番に1つまで + 10手あたり30秒)
  function tempoCan(t, ply, ms) { return !tempoBlocked(t, ply) && tempoUsed(t, ply) + (ms || 0) <= TEMPO.budgetMs; }
  function tempoSpend(t, ply, kind, ms) {
    t.log.push({ ply: ply, kind: kind, ms: Math.round(ms || 0) });
    t.log = t.log.filter(function (e) { return e.ply > ply - 2 * TEMPO.window; });
    if (kind === 'ensemble') t.ens.push(ply);
    if (kind === 'capture') t.captures++;
  }
  // 群像会話を出してよいか。opts = {cpuSide: CPU の手の後か, chapter: 章回の切り替わりか}
  function ensembleOk(t, ply, opts) {
    opts = opts || {};
    if (t.ens.length >= TEMPO.ensMax) return false;
    if (opts.cpuSide && !opts.chapter) return false;
    var last = t.ens.length ? t.ens[t.ens.length - 1] : null;
    if (last != null && ply - last < TEMPO.ensGap) return false;
    if (ply <= TEMPO.earlyPly && t.ens.filter(function (p) { return p <= TEMPO.earlyPly; }).length >= TEMPO.earlyMax) return false;
    return true;
  }
  // 駒取りの長さ: 'full' (通常) / 'short' (一撃・無言・捨て台詞で1〜2往復)。info = {important, cpu}
  function captureForm(t, info) {
    info = info || {};
    if (info.important || t.captures < TEMPO.fullCaptures) return 'full';
    return 'short';
  }
  var SHORT_TYPES = ['oneblow', 'silent', 'bravado'];
  function pickShortType(st, rand) {
    rand = typeof rand === 'function' ? rand : rng;
    var c = SHORT_TYPES.filter(function (x) { return !st || x !== st.prev; });
    return c[Math.floor(rand() * c.length)];
  }
  // 駒取りの場面の見積もり (台本 + 寝返りの一言など。選択肢は1回3秒)
  function captureEstimate(sc, extraLines, choices) {
    var ls = (sc.pre || []).concat(sc.last ? [sc.last] : []);
    return estimateMs(ls, (choices || 0) + (sc.type === 'persuade' ? 1 : 0)) + (sc.band ? 700 : 0) + (extraLines || 0) * (TEMPO.lineBase + TEMPO.perChar * 18);
  }
  // 駒取りの型と長さを決める。予算に収まらなければ短い型へ、それでも無理なら無言。戻り値 {type, lvl, script, ms, form}
  function planCapture(t, ply, cs, a, v, opts) {
    opts = opts || {};
    var lvl = opts.lvl || 3, form = opts.forceSilent ? 'silent' : captureForm(t, opts);
    var cpuLvl = opts.cpu ? Math.min(lvl, 2) : lvl, type, sc, ms;
    if (form === 'full') {
      type = opts.cpu && opts.temper ? pickCaptureTypeBiased(cs, opts.temper, opts.rand) : pickCaptureType(cs, !!opts.human, opts.rand);
      sc = captureScript(type, a, v, cpuLvl);
      ms = captureEstimate(sc, opts.cpu ? 1 : 2, 0);
      if (tempoCan(t, ply, ms + (opts.reserve || 0))) return { type: type, lvl: cpuLvl, script: sc, ms: ms, form: 'full', extra: opts.cpu ? 1 : 2 };
      form = 'short';
    }
    if (form === 'short') {
      type = opts.cpu && opts.temper ? pickCaptureTypeBiased(cs, opts.temper, opts.rand, SHORT_TYPES) : pickShortType(cs, opts.rand);
      sc = captureScript(type, a, v, 1);
      ms = captureEstimate(sc, 1, 0);
      if (tempoCan(t, ply, ms + (opts.reserve || 0))) return { type: type, lvl: 1, script: sc, ms: ms, form: 'short', extra: 1 };
    }
    sc = captureScript('silent', a, v, 1);
    return { type: 'silent', lvl: 1, script: sc, ms: 0, form: 'silent', extra: 0 };
  }
  function ensembleEstimate(sc) {
    var ls = [], ch = 0;
    (sc.lines || []).forEach(function (e) { if (Array.isArray(e)) ls.push(e[2] && e[2].s ? e[2].s : e[2]); else { ch++; ls.push(e.lead); ls.push(e.options[0][2]); } });
    return estimateMs(ls.map(function (x) { return typeof x === 'string' ? x : ''; }), ch);
  }
  return {
    TITLE: TITLE, ARMY: ARMY, LEADER: LEADER, LEADER_FULL: LEADER_FULL, CASTLES: CASTLES, SIDE: SIDE, ENDINGS: ENDINGS, ENDING_ORDER: ENDING_ORDER, PROMOTE_OPTIONS: PROMOTE_OPTIONS,
    PATHS: PATHS, PATH_NAME: PATH_NAME, FRAGMENT_IDS: FRAGMENT_IDS, ENSEMBLE: ENSEMBLE, HITO_CATS: Object.keys(HITO),
    kindOf: kindOf, levelOf: levelOf, nameOf: nameOf, charOf: charOf, classOf: classOf, labelOf: labelOf, isPromoted: isPromoted,
    capture: capture, defect: defect, defectChoice: defectChoice, promote: promote, postPromote: postPromote, stay: stay, forcedPromote: forcedPromote,
    check: check, drop: drop, summon: summon, prologue: prologue, prelude: prelude, preludeChoice: preludeChoice, envoy: envoy, kingMonologue: kingMonologue,
    narration: narration, timeOfDay: timeOfDay, lore: lore, ending: ending, endingTalk: endingTalk, decidePath: decidePath, recordCatalog: recordCatalog,
    hitokoto: hitokoto, nifuScene: nifuScene, ensembleFor: ensembleFor, ensembleLine: ensembleLine, heroName: heroName, heroLine: heroLine, testament: testament, turncoat: turncoat,
    line: function (role, type, side, face, text) { return mk(role, type, side, face, fill(text, side)); },
    persuadeExtraRounds: persuadeExtraRounds, persuadeRound: persuadeRound, persuadeRetort: persuadeRetort,
    CASTLE_TALK: CASTLE_TALK, CASTLE_DEVELOP: CASTLE_DEVELOP,
    detectCastle: detectCastle, castleTransition: castleTransition, castleStep: castleStep, CASTLE_GRACE: CASTLE_GRACE, reachableKeys: reachableKeys, castleTalk: castleTalk, castleReaction: castleReaction, igyokuWarning: igyokuWarning, castleInfo: castleInfo,
    NICKS: NICKS, nickLabel: nickLabel, trackIdentities: trackIdentities, assignNicknames: assignNicknames,
    phaseOf: phaseOf, rainSchedule: rainSchedule, rainAt: rainAt, RAIN_NARR: RAIN_NARR,
    CAPTURE_TYPES: CAPTURE_TYPES, pickCaptureType: pickCaptureType, nextCaptureState: nextCaptureState, persuadeAllowed: persuadeAllowed, captureScript: captureScript,
    PLACES: PLACES, FIELDS: FIELDS, CAPITALS: CAPITALS,
    MIDNIGHT_LINE: MIDNIGHT_LINE, isMidnight: isMidnight, EVENT_CAPS: EVENT_CAPS, eventAllowed: eventAllowed,
    isCharge: isCharge, isArchery: isArchery, isDecoy: isDecoy, isRebuke: isRebuke, chargeLine: chargeLine, archerLine: archerLine, decoyLine: decoyLine,
    decoyFallLine: decoyFallLine, rebukeLines: rebukeLines, shirakawa: shirakawa, shirakawaDebtLine: shirakawaDebtLine,
    chapterTitle: chapterTitle, CHAPTERS: CHAPTERS, RETIRED_ROOTS: RETIRED_ROOTS, RESUME_NARR: RESUME_NARR, POEMS: POEMS, poemOf: poemOf, SCROLL_CLOSING: SCROLL_CLOSING, STORY_NOTES: STORY_NOTES,
    STRATS: STRATS, PAIR_TEXT: PAIR_TEXT, detectStrategies: detectStrategies, FURI_SCENES: FURI_SCENES, furiInterlude: furiInterlude, furiDefer: furiDefer, furiLines: furiLines, furiChoice: furiChoice, isGokigen: isGokigen, rooksFace: rooksFace, strategyHeld: strategyHeld, strategyLines: strategyLines,
    dropZone: dropZone, isBetrayal: isBetrayal, isSacrifice: isSacrifice, summonByZone: summonByZone,
    ADVICE: ADVICE, castleDistance: castleDistance, adviceOptions: adviceOptions, adviceNextMove: adviceNextMove, adviceStep: adviceStep, kingUnderAttack: kingUnderAttack,
    HOUSES: HOUSES, pickField: pickField, assignHouses: assignHouses, houseOf: houseOf, houseRole: houseRole, isKin: isKin, KIN_CAPTURE: KIN_CAPTURE, kinCapture: kinCapture, houseRival: houseRival, RAVEN_NEWS: RAVEN_NEWS, pickRaven: pickRaven, victoryCost: victoryCost,
    houseAftermath: houseAftermath, pickViewpoint: pickViewpoint,
    mergeMore: mergeMore, LINES: LINES, postWar: postWar, houseAftermath2: houseAftermath2, RETIRED_ENDING_KEYS: RETIRED_ENDING_KEYS, MAIN_TITLE: MAIN_TITLE, JEWEL_FATE: JEWEL_FATE, jewelFateKey: jewelFateKey, mainNo: mainNo, LOSER_FATE: LOSER_FATE, RAVEN_AFTER: RAVEN_AFTER, ravenAfter: ravenAfter, HERO_BY_STATE: HERO_BY_STATE, FIELD_OPEN: FIELD_OPEN, endingLegacy: endingLegacy, JEWEL_LINES: JEWEL_LINES, JEWEL_PROLOGUE: JEWEL_PROLOGUE, JOURNAL_VERSION: JOURNAL_VERSION, seededRandom: seededRandom, moveCode: moveCode, journalMake: journalMake, journalRebuild: journalRebuild, journalValidate: journalValidate, journalSfenCounts: journalSfenCounts, journalStory: journalStory, JOURNAL_LIMITS: { moves: J_MAX_MOVES, text: J_MAX_TEXT, raw: J_MAX_RAW }, endStateOf: endStateOf, tokinOnBoard: tokinOnBoard, journalHeading: journalHeading, encodeJournal: encodeJournal, decodeJournal: decodeJournal, JOURNAL_MSG: JOURNAL_MSG, journalStore: journalStore, PATH_MARK: PATH_MARK, leadPath: leadPath, pathChange: pathChange, TILT: TILT, tiltBand: tiltBand, armySummary: armySummary, enemyMood: enemyMood, cpuTemper: cpuTemper, CAPTURE_PATH: CAPTURE_PATH, capturePath: capturePath, pickCaptureTypeBiased: pickCaptureTypeBiased, cpuShouldResign: cpuShouldResign, RESIGN_EVAL: RESIGN_EVAL, resignTalk: resignTalk, REGRET: REGRET, FORBID: FORBID, forbid: forbid,
    FATE_DEATH: FATE_DEATH, fateRoll: fateRoll, trackFates: trackFates, egoStage: egoStage, egoLabel: egoLabel, isHollow: isHollow, fateName: fateName, lastWords: lastWords, mournLine: mournLine,
    raiseScene: raiseScene, fallLine: fallLine, returnScene: returnScene, returnKingLine: returnKingLine, warDeadText: warDeadText, raisedText: raisedText, DARK_NOTE: DARK_NOTE, LAST_GENERIC: LAST_GENERIC, LAST_BY_ORIGIN: LAST_BY_ORIGIN, RAISE_LINES: RAISE_LINES, MOURN: MOURN,
    TEMPO: TEMPO, lineMs: lineMs, estimateMs: estimateMs, newTempo: newTempo, tempoUsed: tempoUsed, tempoBlocked: tempoBlocked, tempoCan: tempoCan, tempoSpend: tempoSpend,
    ensembleOk: ensembleOk, captureForm: captureForm, pickShortType: pickShortType, captureEstimate: captureEstimate, planCapture: planCapture, ensembleEstimate: ensembleEstimate, MORE_REPORT: MORE_REPORT, triggersFor: triggersFor, strategyReact: strategyReact, MILESTONES: MILESTONES, narrTrigger: narrTrigger, KNOWN_TRIGGERS: KNOWN_TRIGGERS, CANNOT: CANNOT,
    setRandom: setRandom, resetGame: resetGame, stats: stats
  };
});
