import React, { useState, useEffect, useCallback, useRef } from 'react';

/* ─────────────────────────────────────────────
   Deck construction
   ───────────────────────────────────────────── */
const SUITS = [
  { name: 'Spades', sym: '♠', color: 'black' },
  { name: 'Clubs', sym: '♣', color: 'black' },
  { name: 'Hearts', sym: '♥', color: 'red' },
  { name: 'Diamonds', sym: '♦', color: 'red' },
];

const RANKS = [
  { val: 2, display: '2' },
  { val: 3, display: '3' },
  { val: 4, display: '4' },
  { val: 5, display: '5' },
  { val: 6, display: '6' },
  { val: 7, display: '7' },
  { val: 8, display: '8' },
  { val: 9, display: '9' },
  { val: 10, display: '10' },
  { val: 11, display: 'J' },
  { val: 12, display: 'Q' },
  { val: 13, display: 'K' },
  { val: 14, display: 'A' },
];

const RANK_NAMES = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
const FULL_DECK = SUITS.flatMap(suit => RANKS.map(rank => ({ ...rank, ...suit })));

const RULESETS = {
  WELLY: 'welly',
  AUCKLAND: 'auckland',
};

const PENALTIES = [
  { label: '1 Sip 😬', sips: 1 },
  { label: '2 Sips 😅', sips: 2 },
  { label: '3 Sips 😰', sips: 3 },
  { label: 'Half Your Drink 🍺', sips: 4 },
  { label: 'Finish Your Drink 💀', sips: 8 },
];

const SIPS_PER_DRINK = 8;
const LS_KEY = 'the-bus-lifetime-sips';

function loadLifetimeSips() {
  try {
    return parseInt(localStorage.getItem(LS_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveLifetimeSips(n) {
  try {
    localStorage.setItem(LS_KEY, String(n));
  } catch {}
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

function cardValueForRuleset(card, currentRuleset) {
  if (currentRuleset === RULESETS.AUCKLAND && card.val === 14) {
    return 1;
  }

  return card.val;
}

function cardKey(card) {
  if (!card) return '';
  return `${card.name}-${card.val}`;
}

function isOdd(card, currentRuleset) {
  return cardValueForRuleset(card, currentRuleset) % 2 === 1;
}

function getInsideOutsideResult(card, a, b, currentRuleset) {
  const cardValue = cardValueForRuleset(card, currentRuleset);
  const aValue = cardValueForRuleset(a, currentRuleset);
  const bValue = cardValueForRuleset(b, currentRuleset);

  const low = Math.min(aValue, bValue);
  const high = Math.max(aValue, bValue);

  if (cardValue === low || cardValue === high) {
    return 'even';
  }

  if (cardValue > low && cardValue < high) {
    return 'inside';
  }

  return 'outside';
}

function getVisibleCardKeys(positions, history) {
  const keys = new Set();

  positions.forEach(card => {
    if (card) keys.add(cardKey(card));
  });

  history.forEach(slotHistory => {
    const visiblePreviousCard = slotHistory.length > 0
      ? slotHistory[slotHistory.length - 1]
      : null;

    if (visiblePreviousCard) {
      keys.add(cardKey(visiblePreviousCard));
    }
  });

  return keys;
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
const PEEK_PX = 'var(--peek-px)';

const CardSlot = ({ current, history, revealed, isActive, animKey }) => {
  const prevCard = history.length > 0 ? history[history.length - 1] : null;
  const totalHeight = prevCard
    ? `calc(${S.cardFront.height} + ${PEEK_PX})`
    : S.cardFront.height;

  return (
    <div style={{ position: 'relative', width: S.cardFront.width, height: totalHeight, flexShrink: 0 }}>
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
          borderRadius: 'var(--card-radius)',
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
  const [ruleset, setRuleset] = useState(RULESETS.WELLY);
  const [positions, setPositions] = useState([null, null, null, null, null]);
  const [history, setHistory] = useState([[], [], [], [], []]);
  const [revealed, setRevealed] = useState([true, false, false, false, true]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [deckPool, setDeckPool] = useState([]);
  const [deckPtr, setDeckPtr] = useState(0);
  const [penalty, setPenalty] = useState(null);
  const [winner, setWinner] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [shakeSlot, setShakeSlot] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [lifetimeSips, setLifetimeSips] = useState(() => loadLifetimeSips());

  const penaltyTimer = useRef(null);

  const drawCard = useCallback((pool, ptr, excludedKeys = new Set()) => {
    const activePool = pool.length > 0 ? pool : FULL_DECK;
    let nextPtr = ptr % activePool.length;

    for (let i = 0; i < activePool.length; i++) {
      const card = activePool[nextPtr];
      nextPtr = (nextPtr + 1) % activePool.length;

      if (!excludedKeys.has(cardKey(card))) {
        return { card, newPool: activePool, newPtr: nextPtr };
      }
    }

    const fallbackCard = activePool[nextPtr];

    return {
      card: fallbackCard,
      newPool: activePool,
      newPtr: (nextPtr + 1) % activePool.length,
    };
  }, []);

  const resetBoardForRuleset = useCallback((nextRuleset) => {
    clearTimeout(penaltyTimer.current);

    const pool = shuffle(FULL_DECK);

    setDeckPool(pool);
    setDeckPtr(5);
    setPositions(pool.slice(0, 5));
    setHistory([[], [], [], [], []]);
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
    const excludedKeys = getVisibleCardKeys(positions, history);
    const { card: next, newPool, newPtr } = drawCard(deckPool, deckPtr, excludedKeys);

    setDeckPool(newPool);
    setDeckPtr(newPtr);

    const correct =
      (type === 'higher' && next.val > current.val) ||
      (type === 'lower' && next.val < current.val) ||
      (type === 'even' && next.val === current.val);

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
        (type === 'even' && !isOdd(current, RULESETS.AUCKLAND)) ||
        (type === 'odd' && isOdd(current, RULESETS.AUCKLAND));
    }

    if (activeIdx === 2) {
      const result = getInsideOutsideResult(current, positions[0], positions[1], RULESETS.AUCKLAND);
      correct = type === result;
    }

    if (activeIdx === 3) {
      const currentValue = cardValueForRuleset(current, RULESETS.AUCKLAND);
      const previousValue = cardValueForRuleset(previous, RULESETS.AUCKLAND);

      correct =
        (type === 'higher' && currentValue > previousValue) ||
        (type === 'lower' && currentValue < previousValue) ||
        (type === 'even' && currentValue === previousValue);
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

  const getRulesContent = () => {
    if (ruleset === RULESETS.WELLY) {
      return {
        title: 'Welly Rules',
        lines: [
          'Five cards are dealt. The first and last card start face up.',
          'Guess whether the next card is higher, lower, or even than the current card.',
          'Ace is high.',
          'If you guess right, move to the next card.',
          'If you guess wrong, drink the card penalty and go back to card 1.',
          'The deck keeps cycling in order during the round. It only reshuffles when the game restarts.',
          'Penalties are: 1 sip, 2 sips, 3 sips, half drink, full drink.',
        ],
      };
    }

    return {
      title: 'Auckland Rules',
      lines: [
        'Five cards are dealt face down.',
        'Card 1: guess red or black.',
        'Card 2: guess even or odd. Ace counts as 1.',
        'Card 3: guess inside, outside, or even against the first two cards. Inside is strictly between. Even means hitting either boundary.',
        'Card 4: guess higher, lower, or even than the previous card. Ace counts as 1.',
        'Card 5: guess the suit.',
        'If you guess wrong, drink the card penalty and the whole board resets.',
        'The deck keeps cycling in order during the round. It only reshuffles when the game restarts.',
        'Penalties are: 1 sip, 2 sips, 3 sips, half drink, full drink.',
      ],
    };
  };

  const getControls = () => {
    if (ruleset === RULESETS.WELLY) {
      return [
        { type: 'higher', label: '↑ Higher', style: S.btnHigher },
        { type: 'lower', label: '↓ Lower', style: S.btnLower },
        { type: 'even', label: '= Even', style: S.btnEven },
      ];
    }

    if (activeIdx === 0) {
      return [
        { type: 'red', label: '♥ Red', style: S.btnRed },
        { type: 'black', label: '♠ Black', style: S.btnBlack },
      ];
    }

    if (activeIdx === 1) {
      return [
        { type: 'even', label: '= Even', style: S.btnEven },
        { type: 'odd', label: 'Odd', style: S.btnOdd },
      ];
    }

    if (activeIdx === 2) {
      return [
        { type: 'inside', label: 'Inside', style: S.btnHigher },
        { type: 'outside', label: 'Outside', style: S.btnLower },
        { type: 'even', label: '= Even', style: S.btnEven },
      ];
    }

    if (activeIdx === 3) {
      return [
        { type: 'higher', label: '↑ Higher', style: S.btnHigher },
        { type: 'lower', label: '↓ Lower', style: S.btnLower },
        { type: 'even', label: '= Even', style: S.btnEven },
      ];
    }

    return [
      { type: 'spades', label: '♠ Spades', style: S.btnBlack },
      { type: 'clubs', label: '♣ Clubs', style: S.btnBlack },
      { type: 'hearts', label: '♥ Hearts', style: S.btnRed },
      { type: 'diamonds', label: '♦ Diamonds', style: S.btnRed },
    ];
  };

  const disabled = !!penalty || winner || gameOver;
  const controls = getControls();
  const rulesContent = getRulesContent();

  return (
    <div style={S.wrap}>
      <style>{CSS_KEYFRAMES}</style>

      <button style={S.cornerRulesBtn} onClick={() => setShowRules(true)}>
        ? Rules
      </button>

      <h1 style={S.title}>🚌 The Bus</h1>

      <div style={S.topMetaRow}>
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
            onClick={() => {
              setLifetimeSips(0);
              saveLifetimeSips(0);
            }}
          >
            ↺ reset
          </button>
        </div>
      </div>

      <div style={S.banner}>
        {getBannerText()}
      </div>

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

      {showRules && (
        <div style={S.rulesOverlay} onClick={() => setShowRules(false)}>
          <div style={S.rulesBox} onClick={(e) => e.stopPropagation()}>
            <div style={S.rulesTitle}>{rulesContent.title}</div>

            <div style={S.rulesList}>
              {rulesContent.lines.map((line, i) => (
                <div key={i} style={S.rulesLine}>
                  <span style={S.rulesBullet}>•</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>

            <button
              style={{ ...S.btn, ...S.btnRestart, ...S.rulesCloseBtn }}
              onClick={() => setShowRules(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {penalty && (
        <div style={S.penaltyToast}>
          <div style={S.penaltyMsg}>{penalty}</div>
          <div style={S.penaltySub}>
            {ruleset === RULESETS.AUCKLAND ? 'Board reset!' : 'Back to card 1!'}
          </div>
        </div>
      )}

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

  :root {
    --app-padding: clamp(10px, 2.5vw, 22px);
    --layout-gap: clamp(10px, 2.2vh, 18px);

    --title-size: clamp(28px, 8vw, 42px);
    --title-letter-spacing: clamp(3px, 1.2vw, 5px);

    --top-row-gap: clamp(5px, 1.2vw, 16px);

    --rules-gap: clamp(3px, 0.8vw, 8px);
    --rules-pad: clamp(3px, 0.8vw, 6px);
    --rules-btn-pad-y: clamp(6px, 1.2vw, 11px);
    --rules-btn-pad-x: clamp(5px, 1.8vw, 20px);
    --rules-font: clamp(8px, 2.4vw, 22px);

    --stats-gap: clamp(5px, 1.6vw, 16px);
    --stats-pad-y: clamp(6px, 1.4vw, 13px);
    --stats-pad-x: clamp(6px, 1.8vw, 24px);
    --stat-num-size: clamp(15px, 4.4vw, 36px);
    --stat-label-size: clamp(7px, 1.8vw, 15px);
    --stat-divider-height: clamp(24px, 6vw, 42px);
    --reset-font: clamp(9px, 1.8vw, 14px);
    --reset-pad-y: clamp(3px, 1vw, 7px);
    --reset-pad-x: clamp(5px, 1.3vw, 10px);

    --banner-font: clamp(11px, 3.35vw, 22px);
    --banner-min-height: clamp(48px, 12vw, 64px);
    --banner-pad-y: clamp(10px, 2.6vw, 14px);
    --banner-pad-x: clamp(10px, 3vw, 26px);
    --banner-max-width: 760px;

    --card-w: clamp(44px, 14.2vw, 90px);
    --card-h: clamp(62px, 19.9vw, 126px);
    --card-gap: clamp(8px, 2vw, 20px);
    --card-radius: clamp(7px, 2vw, 9px);
    --card-row-pad-top: clamp(34px, 9vw, 66px);
    --card-row-side-pad: clamp(8px, 2vw, 14px);
    --card-inner-pad: clamp(4px, 1.4vw, 7px);
    --card-rank-size: clamp(11px, 3.3vw, 17px);
    --card-suit-size: clamp(9px, 2.9vw, 15px);
    --card-center-size: clamp(20px, 6.6vw, 34px);
    --peek-px: clamp(18px, 4.6vw, 34px);
    --arrow-top: calc(clamp(24px, 7vw, 38px) * -1);
    --arrow-size: clamp(20px, 6vw, 28px);

    --btn-gap: clamp(8px, 2vw, 12px);
    --btn-pad-y: clamp(11px, 3vw, 17px);
    --btn-pad-x: clamp(16px, 4vw, 28px);
    --btn-font: clamp(16px, 4.5vw, 21px);
  }

  @media (orientation: landscape) and (max-height: 560px) {
    :root {
      --app-padding: 7px;
      --layout-gap: 6px;

      --title-size: clamp(22px, 7vh, 34px);
      --title-letter-spacing: clamp(2px, 0.8vw, 4px);

      --top-row-gap: 8px;

      --rules-gap: 4px;
      --rules-pad: 4px;
      --rules-btn-pad-y: 6px;
      --rules-btn-pad-x: clamp(8px, 1.5vw, 14px);
      --rules-font: clamp(11px, 3.4vh, 16px);

      --stats-gap: clamp(6px, 1.2vw, 12px);
      --stats-pad-y: 6px;
      --stats-pad-x: clamp(8px, 1.5vw, 14px);
      --stat-num-size: clamp(17px, 5.8vh, 26px);
      --stat-label-size: clamp(8px, 2.4vh, 11px);
      --stat-divider-height: clamp(24px, 7vh, 34px);
      --reset-font: clamp(9px, 2.5vh, 12px);
      --reset-pad-y: 4px;
      --reset-pad-x: 7px;

      --banner-font: clamp(13px, 4vh, 18px);
      --banner-min-height: 36px;
      --banner-pad-y: 7px;
      --banner-pad-x: 16px;
      --banner-max-width: 620px;

      --card-w: clamp(42px, 8.3vw, 72px);
      --card-h: clamp(59px, 11.6vw, 101px);
      --card-gap: clamp(8px, 1.4vw, 14px);
      --card-radius: 7px;
      --card-row-pad-top: 28px;
      --card-row-side-pad: 8px;
      --card-inner-pad: 4px;
      --card-rank-size: clamp(10px, 3vh, 14px);
      --card-suit-size: clamp(8px, 2.6vh, 12px);
      --card-center-size: clamp(18px, 5vh, 28px);
      --peek-px: 22px;
      --arrow-top: -26px;
      --arrow-size: 20px;

      --btn-gap: 7px;
      --btn-pad-y: 8px;
      --btn-pad-x: clamp(12px, 2vw, 20px);
      --btn-font: clamp(13px, 4vh, 18px);
    }
  }

  @media (orientation: landscape) and (max-height: 410px) {
    :root {
      --app-padding: 5px;
      --layout-gap: 4px;

      --title-size: clamp(20px, 7vh, 28px);

      --rules-btn-pad-y: 5px;
      --rules-btn-pad-x: 8px;
      --rules-font: clamp(10px, 3.3vh, 14px);

      --stats-pad-y: 5px;
      --stats-pad-x: 8px;
      --stat-num-size: clamp(15px, 5.4vh, 22px);
      --stat-label-size: clamp(7px, 2.2vh, 10px);
      --stat-divider-height: 25px;

      --banner-font: clamp(12px, 3.8vh, 16px);
      --banner-min-height: 32px;
      --banner-pad-y: 6px;
      --banner-pad-x: 14px;
      --banner-max-width: 520px;

      --card-w: clamp(38px, 7.5vw, 62px);
      --card-h: clamp(54px, 10.5vw, 87px);
      --card-gap: clamp(7px, 1.2vw, 11px);
      --card-row-pad-top: 24px;
      --peek-px: 18px;
      --arrow-top: -23px;
      --arrow-size: 18px;

      --btn-pad-y: 7px;
      --btn-pad-x: 12px;
      --btn-font: clamp(12px, 3.8vh, 16px);
    }
  }

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
      repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.045) 4px, rgba(0,0,0,0.045) 5px),
      repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.045) 4px, rgba(0,0,0,0.045) 5px),
      radial-gradient(ellipse at center, #226b3a 0%, #0e3d1c 100%);
  }

  @keyframes flipIn {
    0% { transform: rotateY(-90deg) scale(0.9); opacity: 0; }
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
    50% { transform: translateX(-50%) translateY(-6px); }
  }

  @keyframes toastIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  @keyframes toastOut {
    to { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
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
    gap: 'var(--layout-gap)',
    padding: 'var(--app-padding)',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    background: 'transparent',
    overflowX: 'hidden',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    minWidth: 0,
  },
  cornerRulesBtn: {
    position: 'fixed',
    top: 'clamp(8px, 2vw, 16px)',
    right: 'clamp(8px, 2vw, 16px)',
    zIndex: 80,
    background: 'rgba(0,0,0,0.42)',
    border: '1.5px solid rgba(240,208,128,0.65)',
    borderRadius: 999,
    color: '#f0d080',
    fontSize: 'clamp(12px, 3vw, 15px)',
    fontWeight: 800,
    padding: 'clamp(6px, 1.5vw, 9px) clamp(9px, 2.4vw, 14px)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
  },
  title: {
    color: '#f0d080',
    fontSize: 'var(--title-size)',
    fontWeight: 800,
    letterSpacing: 'var(--title-letter-spacing)',
    textTransform: 'uppercase',
    textShadow: '0 2px 12px rgba(0,0,0,0.6)',
    margin: 0,
    lineHeight: 1,
    flexShrink: 0,
  },
  topMetaRow: {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 'var(--top-row-gap)',
    flexWrap: 'nowrap',
    width: '100%',
    maxWidth: 1180,
    minWidth: 0,
    flexShrink: 0,
  },
  rulesToggle: {
    display: 'flex',
    gap: 'var(--rules-gap)',
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(240,208,128,0.35)',
    borderRadius: 13,
    padding: 'var(--rules-pad)',
    minWidth: 0,
    flexShrink: 1,
  },
  rulesToggleBtn: {
    border: '1px solid transparent',
    borderRadius: 9,
    padding: 'var(--rules-btn-pad-y) var(--rules-btn-pad-x)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 'var(--rules-font)',
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
    padding: 'var(--banner-pad-y) var(--banner-pad-x)',
    color: '#fff',
    fontSize: 'var(--banner-font)',
    textAlign: 'center',
    minHeight: 'var(--banner-min-height)',
    width: '100%',
    maxWidth: 'min(var(--banner-max-width), calc(100vw - 14px))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1.15,
    overflow: 'hidden',
    flexShrink: 0,
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
    maxWidth: 'calc(100vw - 14px)',
    display: 'flex',
    gap: 'var(--card-gap)',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 'var(--card-row-pad-top)',
    paddingLeft: 'var(--card-row-side-pad)',
    paddingRight: 'var(--card-row-side-pad)',
    overflow: 'visible',
    minWidth: 0,
    flexShrink: 0,
  },
  cardFront: {
    width: 'var(--card-w)',
    height: 'var(--card-h)',
    background: '#fff',
    borderRadius: 'var(--card-radius)',
    border: '2px solid #bbb',
    overflow: 'hidden',
    position: 'relative',
  },
  cardBack: {
    width: 'var(--card-w)',
    height: 'var(--card-h)',
    borderRadius: 'var(--card-radius)',
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
    padding: 'var(--card-inner-pad)',
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
    fontSize: 'var(--card-rank-size)',
    fontWeight: 800,
  },
  cardSuit: {
    fontSize: 'var(--card-suit-size)',
  },
  cardCenter: {
    fontSize: 'var(--card-center-size)',
  },
  arrow: {
    position: 'absolute',
    top: 'var(--arrow-top)',
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#f0d080',
    fontSize: 'var(--arrow-size)',
    animation: 'bounce 0.9s ease-in-out infinite',
    zIndex: 20,
    pointerEvents: 'none',
  },
  controls: {
    display: 'flex',
    gap: 'var(--btn-gap)',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 720,
    width: '100%',
    flexShrink: 0,
  },
  btn: {
    padding: 'var(--btn-pad-y) var(--btn-pad-x)',
    fontSize: 'var(--btn-font)',
    fontWeight: 800,
    borderRadius: 12,
    border: '2px solid transparent',
    cursor: 'pointer',
    letterSpacing: 0.5,
    transition: 'opacity 0.15s, transform 0.1s',
    touchAction: 'manipulation',
    whiteSpace: 'nowrap',
  },
  btnHigher: { background: '#2a9d4e', color: '#fff', borderColor: '#1d7038' },
  btnLower: { background: '#c0392b', color: '#fff', borderColor: '#922b21' },
  btnEven: { background: '#2471a3', color: '#fff', borderColor: '#1a5276' },
  btnOdd: { background: '#8e44ad', color: '#fff', borderColor: '#633076' },
  btnRed: { background: '#c0392b', color: '#fff', borderColor: '#922b21' },
  btnBlack: { background: '#222', color: '#fff', borderColor: '#000' },
  btnRestart: { background: 'rgba(255,255,255,0.15)', color: '#f0d080', borderColor: '#f0d080' },
  rulesOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    zIndex: 300,
    animation: 'fadeIn 0.2s ease',
  },
  rulesBox: {
    width: 'min(560px, 92vw)',
    maxHeight: '82dvh',
    overflowY: 'auto',
    background: '#123d24',
    border: '3px solid #f0d080',
    borderRadius: 20,
    padding: 'clamp(18px, 4vw, 28px)',
    boxShadow: '0 16px 50px rgba(0,0,0,0.5)',
  },
  rulesTitle: {
    color: '#f0d080',
    fontSize: 'clamp(24px, 6vw, 34px)',
    fontWeight: 900,
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: 1,
  },
  rulesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  rulesLine: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 9,
    color: '#fff',
    fontSize: 'clamp(14px, 3.6vw, 17px)',
    lineHeight: 1.35,
  },
  rulesBullet: {
    color: '#f0d080',
    fontWeight: 900,
    flexShrink: 0,
  },
  rulesCloseBtn: {
    display: 'block',
    margin: '20px auto 0',
  },
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
    gap: 'var(--stats-gap)',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(240,208,128,0.35)',
    borderRadius: 12,
    padding: 'var(--stats-pad-y) var(--stats-pad-x)',
    minWidth: 0,
    flexShrink: 1,
  },
  statBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
  },
  statNum: {
    color: '#f0d080',
    fontSize: 'var(--stat-num-size)',
    fontWeight: 800,
    lineHeight: 1,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 'var(--stat-label-size)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  statDivider: {
    width: 1,
    height: 'var(--stat-divider-height)',
    background: 'rgba(240,208,128,0.25)',
    flexShrink: 0,
  },
  resetStatsBtn: {
    marginLeft: 0,
    background: 'none',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 7,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 'var(--reset-font)',
    padding: 'var(--reset-pad-y) var(--reset-pad-x)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};

export default CardGame;