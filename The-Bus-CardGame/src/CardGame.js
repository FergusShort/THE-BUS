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
const FULL_DECK = SUITS.flatMap(suit => RANKS.map(rank => ({ ...rank, ...suit })));

const RULESETS = {
  WELLY: 'welly',
  AUCKLAND: 'auckland',
};

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

function rankLabel(card) {
  return RANK_NAMES[card.val] || card.display;
}

function isOdd(card) {
  return card.val % 2 === 1;
}

function getInsideOutsideResult(card, a, b) {
  const low = Math.min(a.val, b.val);
  const high = Math.max(a.val, b.val);

  if (card.val === low || card.val === high) {
    return 'even';
  }

  if (card.val > low && card.val < high) {
    return 'inside';
  }

  return 'outside';
}

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
   CardSlot
   ───────────────────────────────────────────── */
const PEEK_PX = 'clamp(18px, 4.6vw, 34px)';

const CardSlot = ({ current, history, revealed, isActive, animKey }) => {
  const prevCard = history.length > 0 ? history[history.length - 1] : null;
  const totalHeight = prevCard
    ? `calc(${S.cardFront.height} + ${PEEK_PX})`
    : S.cardFront.height;

  return (
    <div style={{ position: 'relative', width: S.cardFront.width, height: totalHeight }}>
      {isActive && <div style={S.arrow}>▼</div>}

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

      <div
        key={animKey}
        style={{
          position: 'absolute',
          top: prevCard ? PEEK_PX : 0,
          left: 0,
          zIndex: 2,
          borderRadius: 9,
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
  const [ruleset, setRuleset]             = useState(RULESETS.WELLY);
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

  const resetBoardForRuleset = useCallback((nextRuleset) => {
    clearTimeout(penaltyTimer.current);

    const pool = shuffle(FULL_DECK);

    setDeckPool(pool);
    setDeckPtr(5);
    setPositions(pool.slice(0, 5));
    setHistory([[],[],[],[],[]]);
    setRevealed(
      nextRuleset === RULESETS.AUCKLAND
        ? [false, false, false, false, false]
        : [true, false, false, false, true]
    );
    setActiveIdx(0);
    setPenalty(null);
    setWinner(false);
    setGameOver(false);
    setShakeSlot(null);
    setAnimKey(0);
  }, []);

  const startGame = useCallback(() => {
    resetBoardForRuleset(ruleset);
  }, [resetBoardForRuleset, ruleset]);

  useEffect(() => {
    resetBoardForRuleset(RULESETS.WELLY);
  }, [resetBoardForRuleset]);

  const switchRuleset = (nextRuleset) => {
    if (ruleset === nextRuleset) return;

    setRuleset(nextRuleset);
    resetBoardForRuleset(nextRuleset);
  };

  const addPenaltyToTally = (idx) => {
    const penaltyObj = PENALTIES[idx] ?? PENALTIES[PENALTIES.length - 1];

    setPenalty(penaltyObj.label);

    setLifetimeSips(prev => {
      const newTotal = prev + penaltyObj.sips;
      saveLifetimeSips(newTotal);
      return newTotal;
    });
  };

  const failCurrentCard = () => {
    setShakeSlot(activeIdx);
    setTimeout(() => setShakeSlot(null), 500);

    addPenaltyToTally(activeIdx);
  };

  const handleWellyGuess = (type) => {
    const current = positions[activeIdx];
    const { card: next, newPool, newPtr } = drawCard(deckPool, deckPtr);

    setDeckPool(newPool);
    setDeckPtr(newPtr);

    const correct =
      (type === 'higher' && next.val > current.val) ||
      (type === 'lower'  && next.val < current.val) ||
      (type === 'even'   && next.val === current.val);

    const newHistory = history.map(h => [...h]);
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

      return;
    }

    failCurrentCard();

    penaltyTimer.current = setTimeout(() => {
      setPenalty(null);
      setActiveIdx(0);
    }, 2300);
  };

  const handleAucklandGuess = (type) => {
    const current = positions[activeIdx];
    const previous = activeIdx > 0 ? positions[activeIdx - 1] : null;

    let correct = false;

    if (activeIdx === 0) {
      correct = type === current.color;
    }

    if (activeIdx === 1) {
      correct =
        (type === 'even' && !isOdd(current)) ||
        (type === 'odd'  && isOdd(current));
    }

    if (activeIdx === 2) {
      const result = getInsideOutsideResult(current, positions[0], positions[1]);
      correct = type === result;
    }

    if (activeIdx === 3) {
      correct =
        (type === 'higher' && current.val > previous.val) ||
        (type === 'lower'  && current.val < previous.val) ||
        (type === 'even'   && current.val === previous.val);
    }

    if (activeIdx === 4) {
      correct = type === current.name.toLowerCase();
    }

    const newRevealed = [...revealed];
    newRevealed[activeIdx] = true;

    setRevealed(newRevealed);
    setAnimKey(k => k + 1);

    if (correct) {
      if (activeIdx === 4) {
        setGameOver(true);
        setTimeout(() => setWinner(true), 400);
      } else {
        setActiveIdx(activeIdx + 1);
      }

      return;
    }

    failCurrentCard();

    penaltyTimer.current = setTimeout(() => {
      resetBoardForRuleset(RULESETS.AUCKLAND);
    }, 2300);
  };

  const handleGuess = (type) => {
    if (gameOver || winner || penalty) return;

    if (ruleset === RULESETS.AUCKLAND) {
      handleAucklandGuess(type);
    } else {
      handleWellyGuess(type);
    }
  };

  const getBannerText = () => {
    if (winner) {
      return <span style={{ opacity: 0, userSelect: 'none' }}>placeholder</span>;
    }

    if (ruleset === RULESETS.WELLY) {
      const currentCard = positions[activeIdx];

      if (!currentCard) {
        return <span style={{ opacity: 0, userSelect: 'none' }}>placeholder</span>;
      }

      return (
        <span style={S.bannerLine}>
          Higher, lower, or even than the{' '}
          <strong style={{ color: '#f0d080' }}>
            {rankLabel(currentCard)} of {currentCard.name}
          </strong>
          ?
        </span>
      );
    }

    if (activeIdx === 0) {
      return <span style={S.bannerLine}>Pick the colour of the first card.</span>;
    }

    if (activeIdx === 1) {
      return <span style={S.bannerLine}>Will the next card be even or odd?</span>;
    }

    if (activeIdx === 2) {
      const first = positions[0];
      const second = positions[1];

      return (
        <span style={S.bannerLine}>
          Inside, outside, or even{' '}
          <strong style={{ color: '#f0d080' }}>
            {rankLabel(first)} and {rankLabel(second)}
          </strong>
          ?
        </span>
      );
    }

    if (activeIdx === 3) {
      const previous = positions[2];

      return (
        <span style={S.bannerLine}>
          Higher, lower, or even than the{' '}
          <strong style={{ color: '#f0d080' }}>
            {rankLabel(previous)} of {previous.name}
          </strong>
          ?
        </span>
      );
    }

    return <span style={S.bannerLine}>Guess the suit of the final card.</span>;
  };

  const getControls = () => {
    if (ruleset === RULESETS.WELLY) {
      return [
        { type: 'higher', label: '↑ Higher', style: S.btnHigher },
        { type: 'lower',  label: '↓ Lower',  style: S.btnLower },
        { type: 'even',   label: '= Even',   style: S.btnEven },
      ];
    }

    if (activeIdx === 0) {
      return [
        { type: 'red',   label: '♥ Red',   style: S.btnRed },
        { type: 'black', label: '♠ Black', style: S.btnBlack },
      ];
    }

    if (activeIdx === 1) {
      return [
        { type: 'even', label: '= Even', style: S.btnEven },
        { type: 'odd',  label: 'Odd',    style: S.btnOdd },
      ];
    }

    if (activeIdx === 2) {
      return [
        { type: 'inside',  label: 'Inside',  style: S.btnHigher },
        { type: 'outside', label: 'Outside', style: S.btnLower },
        { type: 'even',    label: '= Even',  style: S.btnEven },
      ];
    }

    if (activeIdx === 3) {
      return [
        { type: 'higher', label: '↑ Higher', style: S.btnHigher },
        { type: 'lower',  label: '↓ Lower',  style: S.btnLower },
        { type: 'even',   label: '= Even',   style: S.btnEven },
      ];
    }

    return [
      { type: 'spades',   label: '♠ Spades',   style: S.btnBlack },
      { type: 'clubs',    label: '♣ Clubs',    style: S.btnBlack },
      { type: 'hearts',   label: '♥ Hearts',   style: S.btnRed },
      { type: 'diamonds', label: '♦ Diamonds', style: S.btnRed },
    ];
  };

  const disabled = !!penalty || winner || gameOver;
  const controls = getControls();

  return (
    <div style={S.wrap}>
      <style>{CSS_KEYFRAMES}</style>

      <h1 style={S.title}>🚌 The Bus</h1>

      {/* Rules toggle */}
      <div style={S.rulesToggle}>
        <button
          style={{
            ...S.rulesToggleBtn,
            ...(ruleset === RULESETS.WELLY ? S.rulesToggleBtnActive : {}),
          }}
          onClick={() => switchRuleset(RULESETS.WELLY)}
          disabled={ruleset === RULESETS.WELLY}
        >
          Welly Rules
        </button>

        <button
          style={{
            ...S.rulesToggleBtn,
            ...(ruleset === RULESETS.AUCKLAND ? S.rulesToggleBtnActive : {}),
          }}
          onClick={() => switchRuleset(RULESETS.AUCKLAND)}
          disabled={ruleset === RULESETS.AUCKLAND}
        >
          Auckland Rules
        </button>
      </div>

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
        >
          ↺ reset
        </button>
      </div>

      {/* Banner */}
      <div style={S.banner}>
        {getBannerText()}
      </div>

      {/* Card row */}
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
        {controls.map(control => (
          <button
            key={control.type}
            style={{ ...S.btn, ...control.style }}
            onClick={() => handleGuess(control.type)}
            disabled={disabled}
          >
            {control.label}
          </button>
        ))}

        <button style={{ ...S.btn, ...S.btnRestart }} onClick={startGame}>
          ↺ Restart
        </button>
      </div>

      {/* Penalty toast */}
      {penalty && (
        <div style={S.penaltyToast}>
          <div style={S.penaltyMsg}>{penalty}</div>
          <div style={S.penaltySub}>
            {ruleset === RULESETS.AUCKLAND ? 'Board reset!' : 'Back to card 1!'}
          </div>
        </div>
      )}

      {/* Winner overlay */}
      {winner && (
        <div style={S.winnerOverlay}>
          <div style={S.winnerBox}>
            <div style={{ fontSize: 62, marginBottom: 8 }}>🏆</div>
            <div style={S.winnerText}>WINNER!</div>
            <div style={S.winnerSub}>You rode the bus!</div>

            <button
              style={{ ...S.btn, ...S.btnRestart, marginTop: 18 }}
              onClick={startGame}
            >
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
    margin: 0;
    padding: 0;
    width: 100%;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  #root {
    width: 100%;
    height: 100%;
    min-width: 0;
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
    50%      { transform: translateX(-50%) translateY(-6px); }
  }

  @keyframes toastIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  @keyframes toastOut {
    to { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  button {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  button:disabled {
    opacity: 0.75;
  }
`;

/* ─────────────────────────────────────────────
   Styles
   ───────────────────────────────────────────── */
const S = {
  wrap: {
    width: '100%',
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'clamp(10px, 2.2vh, 18px)',
    padding: 'clamp(10px, 2.5vw, 22px)',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    background: 'transparent',
    overflow: 'hidden',
    minWidth: 0,
  },
  title: {
    color: '#f0d080',
    fontSize: 'clamp(28px, 8vw, 42px)',
    fontWeight: 800,
    letterSpacing: 'clamp(3px, 1.2vw, 5px)',
    textTransform: 'uppercase',
    textShadow: '0 2px 12px rgba(0,0,0,0.6)',
    margin: 0,
    lineHeight: 1,
  },
  rulesToggle: {
    display: 'flex',
    gap: 'clamp(5px, 1.5vw, 8px)',
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(240,208,128,0.35)',
    borderRadius: 13,
    padding: 'clamp(4px, 1.2vw, 6px)',
    maxWidth: 'calc(100vw - 24px)',
  },
  rulesToggleBtn: {
    border: '1px solid transparent',
    borderRadius: 9,
    padding: 'clamp(8px, 2.4vw, 11px) clamp(12px, 3vw, 20px)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 'clamp(15px, 4vw, 22px)',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  rulesToggleBtnActive: {
    background: '#f0d080',
    color: '#143d22',
    borderColor: '#f0d080',
    cursor: 'default',
  },
  banner: {
    background: 'rgba(0,0,0,0.45)',
    border: '2px solid #f0d080',
    borderRadius: 12,
    padding: 'clamp(10px, 2.6vw, 14px) clamp(10px, 3vw, 26px)',
    color: '#fff',
    fontSize: 'clamp(11px, 3.35vw, 22px)',
    textAlign: 'center',
    minHeight: 'clamp(48px, 12vw, 64px)',
    width: '100%',
    maxWidth: 760,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1.15,
    overflow: 'hidden',
  },
  bannerLine: {
    display: 'block',
    width: '100%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'clip',
  },
  cardRow: {
    width: '100%',
    maxWidth: 660,
    display: 'flex',
    gap: 'clamp(4px, 1.6vw, 20px)',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 'clamp(34px, 9vw, 66px)',
    overflow: 'visible',
    minWidth: 0,
  },
  cardFront: {
    width: 'clamp(54px, 16vw, 90px)',
    height: 'clamp(76px, 22.4vw, 126px)',
    background: '#fff',
    borderRadius: 'clamp(7px, 2vw, 9px)',
    border: '2px solid #bbb',
    overflow: 'hidden',
    position: 'relative',
  },
  cardBack: {
    width: 'clamp(54px, 16vw, 90px)',
    height: 'clamp(76px, 22.4vw, 126px)',
    borderRadius: 'clamp(7px, 2vw, 9px)',
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
    padding: 'clamp(4px, 1.4vw, 7px)',
  },
  cardCornerTL: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%',
    lineHeight: 1.05,
  },
  cardCornerBR: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    width: '100%',
    lineHeight: 1.05,
    transform: 'rotate(180deg)',
    alignSelf: 'flex-end',
  },
  cardRank: {
    fontSize: 'clamp(12px, 3.5vw, 17px)',
    fontWeight: 800,
  },
  cardSuit: {
    fontSize: 'clamp(10px, 3vw, 15px)',
  },
  cardCenter: {
    fontSize: 'clamp(22px, 7vw, 34px)',
  },
  arrow: {
    position: 'absolute',
    top: 'calc(clamp(24px, 7vw, 38px) * -1)',
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#f0d080',
    fontSize: 'clamp(20px, 6vw, 28px)',
    animation: 'bounce 0.9s ease-in-out infinite',
    zIndex: 20,
    pointerEvents: 'none',
  },
  controls: {
    display: 'flex',
    gap: 'clamp(8px, 2vw, 12px)',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 720,
    width: '100%',
  },
  btn: {
    padding: 'clamp(11px, 3vw, 17px) clamp(16px, 4vw, 28px)',
    fontSize: 'clamp(16px, 4.5vw, 21px)',
    fontWeight: 800,
    borderRadius: 12,
    border: '2px solid transparent',
    cursor: 'pointer',
    letterSpacing: 0.5,
    transition: 'opacity 0.15s, transform 0.1s',
    touchAction: 'manipulation',
    whiteSpace: 'nowrap',
  },
  btnHigher:  { background: '#2a9d4e', color: '#fff', borderColor: '#1d7038' },
  btnLower:   { background: '#c0392b', color: '#fff', borderColor: '#922b21' },
  btnEven:    { background: '#2471a3', color: '#fff', borderColor: '#1a5276' },
  btnOdd:     { background: '#8e44ad', color: '#fff', borderColor: '#633076' },
  btnRed:     { background: '#c0392b', color: '#fff', borderColor: '#922b21' },
  btnBlack:   { background: '#222', color: '#fff', borderColor: '#000' },
  btnRestart: { background: 'rgba(255,255,255,0.15)', color: '#f0d080', borderColor: '#f0d080' },
  penaltyToast: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(160,20,20,0.97)',
    border: '2px solid #ff7070',
    borderRadius: 18,
    padding: '24px 48px',
    textAlign: 'center',
    zIndex: 100,
    animation: 'toastIn 0.3s ease, toastOut 0.35s ease 1.9s forwards',
    pointerEvents: 'none',
    maxWidth: '80vw',
  },
  penaltyMsg: {
    color: '#fff',
    fontSize: 'clamp(26px,6vw,40px)',
    fontWeight: 800,
  },
  penaltySub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    marginTop: 5,
  },
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
    borderRadius: 22,
    padding: 'clamp(34px,6vw,52px) clamp(40px,8vw,76px)',
    textAlign: 'center',
  },
  winnerText: {
    color: '#f0d080',
    fontSize: 'clamp(32px,7vw,46px)',
    fontWeight: 800,
    letterSpacing: 4,
  },
  winnerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18,
    marginTop: 8,
  },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(10px, 3vw, 16px)',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(240,208,128,0.35)',
    borderRadius: 12,
    padding: 'clamp(9px, 2.6vw, 13px) clamp(14px, 4vw, 24px)',
    maxWidth: 'calc(100vw - 24px)',
  },
  statBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  statNum: {
    color: '#f0d080',
    fontSize: 'clamp(24px, 8vw, 36px)',
    fontWeight: 800,
    lineHeight: 1,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 'clamp(10px, 3vw, 15px)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  statDivider: {
    width: 1,
    height: 'clamp(32px, 8vw, 42px)',
    background: 'rgba(240,208,128,0.25)',
  },
  resetStatsBtn: {
    marginLeft: 4,
    background: 'none',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 7,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 'clamp(11px, 3vw, 14px)',
    padding: 'clamp(4px, 1.5vw, 7px) clamp(7px, 2vw, 10px)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};

export default CardGame;