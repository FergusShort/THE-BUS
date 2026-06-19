import React, { useState, useEffect, useCallback, useRef } from 'react';

/* ─────────────────────────────────────────────
   Deck construction
   ───────────────────────────────────────────── */
const SUITS = [
  { name: 'Spades',   sym: '♠', color: 'black' },
  { name: 'Clubs',    sym: '♣', color: 'black' },
  { name: 'Hearts',   sym: '♥', color: 'red'   },
  { name: 'Diamonds', sym: '♦', color: 'red'   },
];

const RANKS = [
  { val: 2,  display: '2'  },
  { val: 3,  display: '3'  },
  { val: 4,  display: '4'  },
  { val: 5,  display: '5'  },
  { val: 6,  display: '6'  },
  { val: 7,  display: '7'  },
  { val: 8,  display: '8'  },
  { val: 9,  display: '9'  },
  { val: 10, display: '10' },
  { val: 11, display: 'J'  },
  { val: 12, display: 'Q'  },
  { val: 13, display: 'K'  },
  { val: 14, display: 'A'  },
];

const RANK_NAMES = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
const FULL_DECK  = SUITS.flatMap(suit => RANKS.map(rank => ({ ...rank, ...suit })));

const PENALTIES = [
  { label: '1 Sip 😬',             sips: 1 },
  { label: '2 Sips 😅',            sips: 2 },
  { label: '3 Sips 😰',            sips: 3 },
  { label: 'Half Your Drink 🍺',   sips: 4 },
  { label: 'Finish Your Drink 💀', sips: 8 },
];

const SIPS_PER_DRINK = 8;
const LS_KEY = 'the-bus-lifetime-sips';

function loadLifetimeSips() {
  try { return parseInt(localStorage.getItem(LS_KEY) || '0', 10) || 0; }
  catch { return 0; }
}
function saveLifetimeSips(n) {
  try { localStorage.setItem(LS_KEY, String(n)); } catch {}
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function rankLabel(card) { return RANK_NAMES[card.val] || card.display; }

/* ─────────────────────────────────────────────
   Card components
   ───────────────────────────────────────────── */
const CardBack = ({ style: extra }) => (
  <div style={{ ...S.cardBack, ...extra }}>
    <div style={S.cardBackPattern} />
  </div>
);

const CardFace = ({ card, style: extra }) => {
  if (!card) return <CardBack style={extra} />;
  const col = card.color === 'red' ? '#cc2200' : '#111';
  return (
    <div style={{ ...S.cardFront, ...extra }}>
      <div style={S.cardInner}>
        <div style={S.cardCornerTL}>
          <span style={{ ...S.cardRank, color: col }}>{card.display}</span>
          <span style={{ ...S.cardSuit, color: col }}>{card.sym}</span>
        </div>
        <div style={{ ...S.cardCenter, color: col }}>{card.sym}</div>
        <div style={S.cardCornerBR}>
          <span style={{ ...S.cardRank, color: col }}>{card.display}</span>
          <span style={{ ...S.cardSuit, color: col }}>{card.sym}</span>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   CardSlot — shows only the most recent previous
   card peeking above the current card.
   PEEK_PX controls how many px of prev card show.
   ───────────────────────────────────────────── */
const PEEK_PX = 28; // px of the previous card visible above current

const CardSlot = ({ current, history, revealed, isActive, animKey }) => {
  const prevCard = history.length > 0 ? history[history.length - 1] : null;

  // Total height = card height + peek amount when a prev card exists
  const totalHeight = S.cardFront.height + (prevCard ? PEEK_PX : 0);

  return (
    <div style={{ position: 'relative', width: S.cardFront.width, height: totalHeight }}>

      {/* Arrow sits above the whole slot */}
      {isActive && <div style={S.arrow}>▼</div>}

      {/* Previous card — only top PEEK_PX visible, rest hidden under current */}
      {prevCard && (
        <CardFace
          card={prevCard}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1,
            filter: 'brightness(0.7)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}
        />
      )}

      {/* Current card — sits below the peek, covering the rest of prevCard */}
      <div
        key={animKey}
        style={{
          position: 'absolute',
          top: prevCard ? PEEK_PX : 0,
          left: 0,
          zIndex: 2,
          borderRadius: 8,
          boxShadow: isActive
            ? '0 0 0 3px #f0d080, 0 8px 28px rgba(0,0,0,0.55)'
            : '0 4px 14px rgba(0,0,0,0.45)',
          animation: animKey ? 'flipIn 0.35s ease forwards' : undefined,
        }}
      >
        <style>{CSS_KEYFRAMES}</style>
        {revealed ? <CardFace card={current} /> : <CardBack />}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main game
   ───────────────────────────────────────────── */
const CardGame = () => {
  const [positions, setPositions]         = useState([null,null,null,null,null]);
  const [history,   setHistory]           = useState([[],[],[],[],[]]);
  const [revealed,  setRevealed]          = useState([true,false,false,false,true]);
  const [activeIdx, setActiveIdx]         = useState(0);
  const [deckPool,  setDeckPool]          = useState([]);
  const [deckPtr,   setDeckPtr]           = useState(0);
  const [penalty,   setPenalty]           = useState(null);
  const [winner,    setWinner]            = useState(false);
  const [gameOver,  setGameOver]          = useState(false);
  const [shakeSlot, setShakeSlot]         = useState(null);
  const [animKey,   setAnimKey]           = useState(0);
  const [lifetimeSips, setLifetimeSips]   = useState(() => loadLifetimeSips());
  const penaltyTimer = useRef(null);

  const drawCard = useCallback((pool, ptr) => {
    if (ptr >= pool.length) {
      const np = shuffle(FULL_DECK);
      return { card: np[0], newPool: np, newPtr: 1 };
    }
    return { card: pool[ptr], newPool: pool, newPtr: ptr + 1 };
  }, []);

  const startGame = useCallback(() => {
    clearTimeout(penaltyTimer.current);
    const pool = shuffle(FULL_DECK);
    setDeckPool(pool);
    setDeckPtr(5);
    setPositions(pool.slice(0, 5));
    setHistory([[],[],[],[],[]]);
    setRevealed([true, false, false, false, true]);
    setActiveIdx(0);
    setPenalty(null);
    setWinner(false);
    setGameOver(false);
    setShakeSlot(null);
    setAnimKey(0);
  }, []);

  useEffect(() => { startGame(); }, [startGame]);

  const handleGuess = (type) => {
    if (gameOver || winner || penalty) return;

    const current = positions[activeIdx];
    const { card: next, newPool, newPtr } = drawCard(deckPool, deckPtr);
    setDeckPool(newPool);
    setDeckPtr(newPtr);

    const correct =
      (type === 'higher' && next.val > current.val) ||
      (type === 'lower'  && next.val < current.val) ||
      (type === 'even'   && next.val === current.val);

    const newHistory   = history.map(h => [...h]);
    newHistory[activeIdx] = [...history[activeIdx], current];
    const newPositions = [...positions];
    newPositions[activeIdx] = next;
    const newRevealed = [...revealed];
    newRevealed[activeIdx] = true;

    setHistory(newHistory);
    setPositions(newPositions);
    setRevealed(newRevealed);
    setAnimKey(k => k + 1);

    if (correct) {
      if (activeIdx === 4) {
        setGameOver(true);
        setTimeout(() => setWinner(true), 400);
      } else {
        const nextRevealed = [...newRevealed];
        nextRevealed[activeIdx + 1] = true;
        setRevealed(nextRevealed);
        setActiveIdx(activeIdx + 1);
      }
    } else {
      setShakeSlot(activeIdx);
      setTimeout(() => setShakeSlot(null), 500);
      const penaltyObj = PENALTIES[activeIdx] ?? PENALTIES[PENALTIES.length - 1];
      setPenalty(penaltyObj.label);
      const newTotal = lifetimeSips + penaltyObj.sips;
      setLifetimeSips(newTotal);
      saveLifetimeSips(newTotal);
      penaltyTimer.current = setTimeout(() => {
        setPenalty(null);
        setActiveIdx(0);
      }, 2300);
    }
  };

  const currentCard = positions[activeIdx];
  const disabled    = !!penalty || winner || gameOver;

  return (
    <div style={S.wrap}>
      <style>{CSS_KEYFRAMES}</style>

      <h1 style={S.title}>🚌 The Bus</h1>

      {/* Stats bar */}
      <div style={S.statsBar}>
        <div style={S.statBlock}>
          <span style={S.statNum}>{lifetimeSips}</span>
          <span style={S.statLabel}>lifetime sips</span>
        </div>
        <div style={S.statDivider} />
        <div style={S.statBlock}>
          <span style={S.statNum}>{(lifetimeSips / SIPS_PER_DRINK).toFixed(1)}</span>
          <span style={S.statLabel}>drinks consumed</span>
        </div>
        <button
          style={S.resetStatsBtn}
          onClick={() => { setLifetimeSips(0); saveLifetimeSips(0); }}
        >↺ reset</button>
      </div>

      {/* Banner — always rendered so layout stays stable */}
      <div style={S.banner}>
        {!winner && currentCard
          ? <>Higher, lower, or even than the&nbsp;
              <strong style={{ color: '#f0d080' }}>
                {rankLabel(currentCard)} of {currentCard.name}
              </strong>?
            </>
          : <span style={{ opacity: 0, userSelect: 'none' }}>placeholder</span>
        }
      </div>

      {/* Card row — extra paddingTop so peek-above arrows have room */}
      <div style={S.cardRow}>
        {positions.map((card, i) => (
          <div
            key={i}
            style={{ animation: shakeSlot === i ? 'shake 0.4s ease' : undefined }}
          >
            <CardSlot
              current={card}
              history={history[i]}
              revealed={revealed[i]}
              isActive={i === activeIdx && !gameOver}
              animKey={i === activeIdx ? animKey : 0}
            />
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={S.controls}>
        <button style={{ ...S.btn, ...S.btnHigher }} onClick={() => handleGuess('higher')} disabled={disabled}>
          ↑ Higher
        </button>
        <button style={{ ...S.btn, ...S.btnLower }} onClick={() => handleGuess('lower')} disabled={disabled}>
          ↓ Lower
        </button>
        <button style={{ ...S.btn, ...S.btnEven }} onClick={() => handleGuess('even')} disabled={disabled}>
          = Even
        </button>
        <button style={{ ...S.btn, ...S.btnRestart }} onClick={startGame}>
          ↺ Restart
        </button>
      </div>

      {/* Penalty toast */}
      {penalty && (
        <div style={S.penaltyToast}>
          <div style={S.penaltyMsg}>{penalty}</div>
          <div style={S.penaltySub}>Back to card 1!</div>
        </div>
      )}

      {/* Winner overlay */}
      {winner && (
        <div style={S.winnerOverlay}>
          <div style={S.winnerBox}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>🏆</div>
            <div style={S.winnerText}>WINNER!</div>
            <div style={S.winnerSub}>You rode the bus!</div>
            <button style={{ ...S.btn, ...S.btnRestart, marginTop: 16 }} onClick={startGame}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Keyframes + global
   ───────────────────────────────────────────── */
const CSS_KEYFRAMES = `
  *, *::before, *::after { box-sizing: border-box; }

  html, body {
    margin: 0; padding: 0;
    width: 100%; height: 100%;
    overflow: hidden;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  #root {
    width: 100%;
    height: 100%;
  }

  body {
    background-color: #1a5c32;
    background-image:
      repeating-linear-gradient(0deg,   transparent, transparent 4px, rgba(0,0,0,0.045) 4px, rgba(0,0,0,0.045) 5px),
      repeating-linear-gradient(90deg,  transparent, transparent 4px, rgba(0,0,0,0.045) 4px, rgba(0,0,0,0.045) 5px),
      radial-gradient(ellipse at center, #226b3a 0%, #0e3d1c 100%);
  }

  @keyframes flipIn {
    0%   { transform: rotateY(-90deg) scale(0.9); opacity: 0; }
    100% { transform: rotateY(0deg) scale(1); opacity: 1; }
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
  }
  @keyframes bounce {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    50%       { transform: translateX(-50%) translateY(-6px); }
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  @keyframes toastOut {
    to { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }

  button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
`;

/* ─────────────────────────────────────────────
   Styles
   ───────────────────────────────────────────── */
const S = {
  wrap: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: '12px 16px',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    background: 'transparent',
    overflow: 'hidden',
  },
  title: {
    color: '#f0d080',
    fontSize: 'clamp(20px, 5vw, 32px)',
    fontWeight: 800,
    letterSpacing: 4,
    textTransform: 'uppercase',
    textShadow: '0 2px 12px rgba(0,0,0,0.6)',
    margin: 0,
  },
  banner: {
    background: 'rgba(0,0,0,0.45)',
    border: '1.5px solid #f0d080',
    borderRadius: 10,
    padding: '8px 20px',
    color: '#fff',
    fontSize: 'clamp(13px, 3.5vw, 17px)',
    textAlign: 'center',
    minHeight: 42,
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Card row: extra paddingTop gives room for the peeking prev card + arrow */
  cardRow: {
    display: 'flex',
    gap: 'clamp(6px, 2vw, 14px)',
    alignItems: 'flex-end',
    paddingTop: 52,   /* space for PEEK_PX (28) + arrow (24) */
    overflow: 'visible',
  },
  /* Card dimensions — slightly smaller on narrow screens */
  cardFront: {
    width: 72,
    height: 100,
    background: '#fff',
    borderRadius: 7,
    border: '2px solid #bbb',
    overflow: 'hidden',
    position: 'relative',
  },
  cardBack: {
    width: 72,
    height: 100,
    borderRadius: 7,
    border: '2px solid #0a2244',
    background: '#1a3a6b',
    overflow: 'hidden',
    position: 'relative',
  },
  cardBackPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 2px, transparent 2px, transparent 9px)',
  },
  cardInner: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 5px',
  },
  cardCornerTL: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%',
    lineHeight: 1.1,
  },
  cardCornerBR: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    width: '100%',
    lineHeight: 1.1,
    transform: 'rotate(180deg)',
    alignSelf: 'flex-end',
  },
  cardRank:   { fontSize: 13, fontWeight: 700 },
  cardSuit:   { fontSize: 11 },
  cardCenter: { fontSize: 24 },
  arrow: {
    position: 'absolute',
    top: -28,
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#f0d080',
    fontSize: 18,
    animation: 'bounce 0.9s ease-in-out infinite',
    zIndex: 20,
    pointerEvents: 'none',
  },
  controls: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  btn: {
    padding: 'clamp(10px,2.5vw,13px) clamp(14px,4vw,22px)',
    fontSize: 'clamp(13px, 3.5vw, 15px)',
    fontWeight: 700,
    borderRadius: 10,
    border: '2px solid transparent',
    cursor: 'pointer',
    letterSpacing: 0.5,
    transition: 'opacity 0.15s, transform 0.1s',
    touchAction: 'manipulation',
  },
  btnHigher:  { background: '#2a9d4e', color: '#fff', borderColor: '#1d7038' },
  btnLower:   { background: '#c0392b', color: '#fff', borderColor: '#922b21' },
  btnEven:    { background: '#2471a3', color: '#fff', borderColor: '#1a5276' },
  btnRestart: { background: 'rgba(255,255,255,0.15)', color: '#f0d080', borderColor: '#f0d080' },
  penaltyToast: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(160,20,20,0.97)',
    border: '2px solid #ff7070',
    borderRadius: 16,
    padding: '20px 40px',
    textAlign: 'center',
    zIndex: 100,
    animation: 'toastIn 0.3s ease, toastOut 0.35s ease 1.9s forwards',
    pointerEvents: 'none',
    maxWidth: '80vw',
  },
  penaltyMsg: { color: '#fff', fontSize: 'clamp(22px,6vw,34px)', fontWeight: 800 },
  penaltySub: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 },
  winnerOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    animation: 'fadeIn 0.4s ease',
    padding: 20,
  },
  winnerBox: {
    background: '#1a6b3a',
    border: '3px solid #f0d080',
    borderRadius: 20,
    padding: 'clamp(28px,6vw,44px) clamp(32px,8vw,64px)',
    textAlign: 'center',
  },
  winnerText: { color: '#f0d080', fontSize: 'clamp(26px,7vw,38px)', fontWeight: 800, letterSpacing: 4 },
  winnerSub:  { color: 'rgba(255,255,255,0.8)', fontSize: 15, marginTop: 8 },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(240,208,128,0.35)',
    borderRadius: 10,
    padding: '8px 18px',
  },
  statBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  },
  statNum: {
    color: '#f0d080',
    fontSize: 'clamp(16px, 4vw, 22px)',
    fontWeight: 800,
    lineHeight: 1,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 28,
    background: 'rgba(240,208,128,0.25)',
  },
  resetStatsBtn: {
    marginLeft: 6,
    background: 'none',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    padding: '3px 7px',
    cursor: 'pointer',
  },
};

export default CardGame;