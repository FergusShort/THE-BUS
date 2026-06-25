import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib/supabaseClient";

const SUITS = [
  { name: "Spades", sym: "♠", color: "black" },
  { name: "Clubs", sym: "♣", color: "black" },
  { name: "Hearts", sym: "♥", color: "red" },
  { name: "Diamonds", sym: "♦", color: "red" },
];

const RANKS = [
  { val: 2, display: "2" },
  { val: 3, display: "3" },
  { val: 4, display: "4" },
  { val: 5, display: "5" },
  { val: 6, display: "6" },
  { val: 7, display: "7" },
  { val: 8, display: "8" },
  { val: 9, display: "9" },
  { val: 10, display: "10" },
  { val: 11, display: "J" },
  { val: 12, display: "Q" },
  { val: 13, display: "K" },
  { val: 14, display: "A" },
];

const RANK_NAMES = { 11: "Jack", 12: "Queen", 13: "King", 14: "Ace" };
const FULL_DECK = SUITS.flatMap((suit) =>
  RANKS.map((rank) => ({ ...rank, ...suit })),
);

const RULESETS = {
  WELLY: "welly",
  AUCKLAND: "auckland",
};

const PENALTIES = [
  { label: "1 Sip 😬", sips: 1 },
  { label: "2 Sips 😅", sips: 2 },
  { label: "3 Sips 😰", sips: 3 },
  { label: "Half Your Drink 🍺", sips: 4 },
  { label: "Finish Your Drink 💀", sips: 8 },
];

const SIPS_PER_DRINK = 8;
const LS_KEY = "the-bus-lifetime-sips";
const PLAYER_NAME_COOKIE = "the_bus_player_name";

const CRASH_BEFORE_POPUP_MS = 1000;
const POPUP_VISIBLE_MS = 2300;
const WIN_ANIMATION_MS = 1600;
const WIN_POPUP_AFTER_ANIMATION_MS = 500;
const BUS_ENTER_MS = 850;

function getCookie(name) {
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));

  if (!cookie) return "";

  try {
    return decodeURIComponent(cookie.split("=").slice(1).join("=") || "");
  } catch {
    return "";
  }
}

function setCookie(name, value, days = 365) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

function loadLifetimeSips() {
  try {
    return parseInt(localStorage.getItem(LS_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

function saveLifetimeSips(n) {
  try {
    localStorage.setItem(LS_KEY, String(n));
  } catch {}
}

function loadPlayerName() {
  return getCookie(PLAYER_NAME_COOKIE);
}

function savePlayerName(name) {
  setCookie(PLAYER_NAME_COOKIE, name);
}

function clearPlayerName() {
  setCookie(PLAYER_NAME_COOKIE, "", -1);
}

function cleanPlayerName(name) {
  return name.trim().replace(/\s+/g, " ").slice(0, 20);
}

function nameKey(name) {
  return cleanPlayerName(name).toLowerCase();
}

function drinksLabelFromSips(sips) {
  const drinks = Number(sips || 0) / SIPS_PER_DRINK;
  return `${drinks.toFixed(1)} drinks`;
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
  if (!card) return "";
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
    return "even";
  }

  if (cardValue > low && cardValue < high) {
    return "inside";
  }

  return "outside";
}

function getVisibleCardKeys(positions, history) {
  const keys = new Set();

  positions.forEach((card) => {
    if (card) keys.add(cardKey(card));
  });

  history.forEach((slotHistory) => {
    const visiblePreviousCard =
      slotHistory.length > 0 ? slotHistory[slotHistory.length - 1] : null;

    if (visiblePreviousCard) {
      keys.add(cardKey(visiblePreviousCard));
    }
  });

  return keys;
}

async function findLeaderboardPlayer(name) {
  if (!supabase) return null;

  const cleanName = cleanPlayerName(name);
  if (!cleanName) return null;

  const { data, error } = await supabase
    .from("sip_leaderboard")
    .select("name, sips")
    .eq("name_key", cleanName.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function ensureOnlinePlayer(name) {
  if (!supabase) return;

  const cleanName = cleanPlayerName(name);
  if (!cleanName) return;

  const { error } = await supabase.rpc("ensure_leaderboard_player", {
    p_name: cleanName,
  });

  if (error) throw error;
}

async function addOnlineSips(name, sips) {
  if (!supabase) return;

  const cleanName = cleanPlayerName(name);
  if (!cleanName) return;

  const { error } = await supabase.rpc("add_sips_to_leaderboard", {
    p_name: cleanName,
    p_sips: sips,
  });

  if (error) throw error;
}

async function resetOnlineSips(name) {
  if (!supabase) return;

  const cleanName = cleanPlayerName(name);
  if (!cleanName) return;

  const { error } = await supabase.rpc("reset_sips_for_leaderboard", {
    p_name: cleanName,
  });

  if (error) throw error;
}

async function fetchLeaderboard() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("sip_leaderboard")
    .select("name, sips, updated_at")
    .order("sips", { ascending: false })
    .limit(20);

  if (error) throw error;

  return data || [];
}

const CSS = `
  *, *::before, *::after {
    box-sizing: border-box;
  }

  html, body, #root {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
  }

  body {
    overflow: hidden;
    user-select: none;
    touch-action: manipulation;
    background-color: #1a5c32;
    background-image:
      repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.045) 4px, rgba(0,0,0,0.045) 5px),
      repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.045) 4px, rgba(0,0,0,0.045) 5px),
      radial-gradient(ellipse at center, #226b3a 0%, #0e3d1c 100%);
  }

  button {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  button:disabled:not(.rulesToggleBtn) {
    opacity: 0.65;
  }

  .rulesToggleBtn:disabled {
    opacity: 1;
  }

  .game {
    width: 100%;
    height: 100dvh;
    padding: clamp(10px, 2.5vw, 22px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 1.8vh, 16px);
    font-family: "Segoe UI", system-ui, sans-serif;
    color: white;
    overflow: hidden;
  }

  .topLeftButtons {
    position: fixed;
    top: clamp(8px, 2vw, 16px);
    left: clamp(8px, 2vw, 16px);
    z-index: 80;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .cornerBtn {
    background: rgba(0,0,0,0.42);
    border: 1.5px solid rgba(240,208,128,0.65);
    border-radius: 999px;
    color: #f0d080;
    font-size: clamp(12px, 3vw, 15px);
    font-weight: 800;
    padding: clamp(6px, 1.5vw, 9px) clamp(9px, 2.4vw, 14px);
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rulesBtn {
    position: fixed;
    top: clamp(8px, 2vw, 16px);
    right: clamp(8px, 2vw, 16px);
    z-index: 80;
  }

  .title {
    color: #f0d080;
    font-size: clamp(28px, 8vw, 42px);
    font-weight: 900;
    letter-spacing: clamp(3px, 1.2vw, 5px);
    text-transform: uppercase;
    text-shadow: 0 2px 12px rgba(0,0,0,0.6);
    margin: 0;
    line-height: 1;
  }

  .topMetaRow {
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: clamp(5px, 1.2vw, 16px);
    flex-wrap: nowrap;
    width: 100%;
    max-width: 1180px;
    min-width: 0;
  }

  .rulesToggle {
    display: flex;
    gap: clamp(3px, 0.8vw, 8px);
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(240,208,128,0.35);
    border-radius: 13px;
    padding: clamp(3px, 0.8vw, 6px);
    min-width: 0;
    flex-shrink: 1;
  }

  .rulesToggleBtn {
    border: 1px solid transparent;
    border-radius: 9px;
    padding: clamp(6px, 1.2vw, 11px) clamp(5px, 1.8vw, 20px);
    background: transparent;
    color: rgba(240,208,128,0.75);
    font-size: clamp(8px, 2.4vw, 22px);
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
  }

  .rulesToggleBtn.active {
    background: #f0d080;
    color: #143d22;
    border-color: #f0d080;
    cursor: default;
  }

  .statsBar {
    display: flex;
    align-items: center;
    gap: clamp(5px, 1.6vw, 16px);
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(240,208,128,0.35);
    border-radius: 12px;
    padding: clamp(6px, 1.4vw, 13px) clamp(6px, 1.8vw, 24px);
    min-width: 0;
    flex-shrink: 1;
  }

  .statBlock {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }

  .statNum {
    color: #f0d080;
    font-size: clamp(15px, 4.4vw, 36px);
    font-weight: 900;
    line-height: 1;
  }

  .statLabel {
    color: rgba(255,255,255,0.55);
    font-size: clamp(7px, 1.8vw, 15px);
    letter-spacing: 0.5px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .statDivider {
    width: 1px;
    height: clamp(24px, 6vw, 42px);
    background: rgba(240,208,128,0.25);
    flex-shrink: 0;
  }

  .resetStatsBtn {
    background: none;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 7px;
    color: rgba(255,255,255,0.55);
    font-size: clamp(9px, 1.8vw, 14px);
    padding: clamp(3px, 1vw, 7px) clamp(5px, 1.3vw, 10px);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .banner {
    position: relative;
    z-index: 20;
    background: rgba(0,0,0,0.45);
    border: 2px solid #f0d080;
    border-radius: 12px;
    padding: clamp(10px, 2.6vw, 14px) clamp(10px, 3vw, 26px);
    color: #fff;
    font-size: clamp(11px, 3.35vw, 22px);
    text-align: center;
    min-height: clamp(48px, 12vw, 64px);
    width: 100%;
    max-width: min(760px, calc(100vw - 14px));
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1.15;
    overflow: hidden;
    flex-shrink: 0;
  }

  .bannerLine {
    display: block;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
  }

  .cardStage {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: calc(100vw - 14px);
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }

  .busTrack {
    position: relative;
    width: min(100%, 620px);
    height: clamp(34px, 8vw, 52px);
    margin-top: clamp(14px, 2vh, 24px);
    margin-bottom: clamp(-14px, -2vw, -6px);
    pointer-events: none;
    overflow: visible;
  }

  .busGlow {
    position: absolute;
    left: 7%;
    right: 7%;
    bottom: 0;
    height: clamp(12px, 2vw, 18px);
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(240,208,128,0.35), transparent 70%);
    animation: busGlowPulse 1.1s ease-in-out infinite;
  }

  .busRoad {
    position: absolute;
    left: 7%;
    right: 7%;
    bottom: clamp(6px, 1.6vw, 10px);
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, transparent, rgba(240,208,128,0.75), transparent);
    box-shadow: 0 0 14px rgba(240,208,128,0.38);
    overflow: hidden;
  }

  .busRoadLine {
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.85) 0 18px, transparent 18px 34px);
    opacity: 0.5;
    animation: roadMove 0.8s linear infinite;
  }

  .busVehicle {
    position: absolute;
    bottom: clamp(8px, 2vw, 13px);
    transform: translateX(-50%);
    transition: left 0.55s cubic-bezier(.2, .9, .25, 1.25);
    filter: drop-shadow(0 8px 8px rgba(0,0,0,0.45));
    z-index: 5;
  }

  .busVehicle.enteringLeft {
    animation: busEnterVehicle 0.85s cubic-bezier(.18,.9,.2,1.15) forwards;
  }

  .busVehicle.enteringRight {
    animation: busEnterRightVehicle 0.85s cubic-bezier(.18,.9,.2,1.15) forwards;
  }

  .busVehicle.winning {
    animation: busDriveOff 1.6s ease-in forwards;
  }

  .busEmoji {
    font-size: clamp(28px, 7vw, 44px);
    animation: busBob 0.42s ease-in-out infinite;
  }

  .busEmoji.crashing {
    animation: busCrash 0.75s ease-in-out forwards;
  }

  .busEmoji.winning {
    animation: busWinBob 0.28s ease-in-out infinite;
  }

  .busTrail {
    position: absolute;
    right: 68%;
    top: 35%;
    display: flex;
    align-items: center;
    gap: 1px;
    opacity: 0.85;
  }

  .smokePuff {
    font-size: clamp(13px, 3.2vw, 18px);
    animation: smokeDrift 0.75s ease-in-out infinite;
  }

  .sparkle {
    font-size: clamp(10px, 2.5vw, 15px);
    animation: sparklePop 0.9s ease-in-out infinite;
  }

  .crashBlock {
    position: absolute;
    bottom: clamp(8px, 2vw, 13px);
    transform: translateX(-50%);
    font-size: clamp(18px, 4.8vw, 28px);
    z-index: 6;
    animation: crashBlockShake 0.65s ease-in-out forwards;
    filter: drop-shadow(0 5px 7px rgba(0,0,0,0.45));
  }

  .crashBurst {
    position: absolute;
    bottom: clamp(18px, 4vw, 30px);
    transform: translateX(-50%);
    font-size: clamp(24px, 6vw, 38px);
    z-index: 8;
    animation: crashBurst 0.75s ease-out forwards;
    filter: drop-shadow(0 5px 8px rgba(0,0,0,0.4));
  }

  .raceFlag {
    position: absolute;
    right: clamp(6px, 2vw, 16px);
    bottom: clamp(8px, 2vw, 13px);
    font-size: clamp(22px, 5.8vw, 36px);
    z-index: 7;
    animation: raceFlagSpawn 1.6s ease-out forwards;
    filter: drop-shadow(0 5px 7px rgba(0,0,0,0.45));
  }

  .winBurst {
    position: absolute;
    right: clamp(18px, 4vw, 36px);
    bottom: clamp(18px, 4vw, 30px);
    font-size: clamp(28px, 7vw, 44px);
    z-index: 8;
    animation: winBurst 1.2s ease-out forwards;
  }

  .confettiLeft {
    position: absolute;
    right: clamp(36px, 8vw, 70px);
    bottom: clamp(24px, 5vw, 38px);
    font-size: clamp(18px, 4vw, 26px);
    z-index: 9;
    animation: winConfettiLeft 1.25s ease-out forwards;
  }

  .confettiRight {
    position: absolute;
    right: clamp(24px, 6vw, 48px);
    bottom: clamp(24px, 5vw, 38px);
    font-size: clamp(18px, 4vw, 26px);
    z-index: 9;
    animation: winConfettiRight 1.25s ease-out forwards;
  }

  .cardRow {
    width: 100%;
    max-width: calc(100vw - 14px);
    display: flex;
    gap: clamp(8px, 2vw, 20px);
    align-items: flex-end;
    justify-content: center;
    padding-top: clamp(30px, 7.5vw, 54px);
    padding-left: clamp(8px, 2vw, 14px);
    padding-right: clamp(8px, 2vw, 14px);
    overflow: visible;
    min-width: 0;
    flex-shrink: 0;
  }

  .slotShell {
    position: relative;
    width: clamp(44px, 14.2vw, 90px);
    flex-shrink: 0;
  }

  .card {
    width: clamp(44px, 14.2vw, 90px);
    height: clamp(62px, 19.9vw, 126px);
    border-radius: clamp(7px, 2vw, 9px);
    overflow: hidden;
    position: relative;
  }

  .cardFront {
    background: #fff;
    border: 2px solid #bbb;
  }

  .cardBack {
    border: 2px solid #0a2244;
    background: #1a3a6b;
  }

  .cardBackPattern {
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 2px, transparent 2px, transparent 9px);
  }

  .cardInner {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: clamp(4px, 1.4vw, 7px);
  }

  .corner {
    display: flex;
    flex-direction: column;
    width: 100%;
    line-height: 1.05;
  }

  .corner.br {
    align-items: flex-end;
    transform: rotate(180deg);
  }

  .rank {
    font-size: clamp(11px, 3.3vw, 17px);
    font-weight: 900;
  }

  .suit {
    font-size: clamp(9px, 2.9vw, 15px);
  }

  .centerSuit {
    font-size: clamp(20px, 6.6vw, 34px);
  }

  .activeCard {
    box-shadow: 0 0 0 3px #f0d080, 0 8px 28px rgba(0,0,0,0.55);
  }

  .inactiveCard {
    box-shadow: 0 4px 14px rgba(0,0,0,0.45);
  }

  .cardTop {
    position: absolute;
    left: 0;
    z-index: 2;
    border-radius: clamp(7px, 2vw, 9px);
  }

  .prevCard {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    filter: brightness(0.7);
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  }

  .arrow {
    position: absolute;
    top: calc(clamp(24px, 7vw, 38px) * -1);
    left: 50%;
    transform: translateX(-50%);
    color: #f0d080;
    font-size: clamp(20px, 6vw, 28px);
    animation: bounce 0.9s ease-in-out infinite;
    z-index: 20;
    pointer-events: none;
  }

  .flipIn {
    animation: flipIn 0.35s ease forwards;
  }

  .shake {
    animation: shake 0.4s ease;
  }

  .controls {
    display: flex;
    gap: clamp(8px, 2vw, 12px);
    flex-wrap: wrap;
    justify-content: center;
    max-width: 720px;
    width: 100%;
    flex-shrink: 0;
  }

  .btn {
    padding: clamp(11px, 3vw, 17px) clamp(16px, 4vw, 28px);
    font-size: clamp(16px, 4.5vw, 21px);
    font-weight: 900;
    border-radius: 12px;
    border: 2px solid transparent;
    cursor: pointer;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .btnHigher { background: #2a9d4e; color: #fff; border-color: #1d7038; }
  .btnLower { background: #c0392b; color: #fff; border-color: #922b21; }
  .btnEven { background: #2471a3; color: #fff; border-color: #1a5276; }
  .btnOdd { background: #8e44ad; color: #fff; border-color: #633076; }
  .btnRed { background: #c0392b; color: #fff; border-color: #922b21; }
  .btnBlack { background: #222; color: #fff; border-color: #000; }
  .btnRestart { background: rgba(255,255,255,0.15); color: #f0d080; border-color: #f0d080; }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    z-index: 300;
    animation: fadeIn 0.2s ease;
  }

  .modal {
    width: min(560px, 92vw);
    max-height: 82dvh;
    overflow-y: auto;
    background: #123d24;
    border: 3px solid #f0d080;
    border-radius: 20px;
    padding: clamp(18px, 4vw, 28px);
    box-shadow: 0 16px 50px rgba(0,0,0,0.5);
  }

  .modalTitle {
    color: #f0d080;
    font-size: clamp(24px, 6vw, 34px);
    font-weight: 900;
    text-align: center;
    margin-bottom: 14px;
    letter-spacing: 1px;
  }

  .modalSub {
    color: rgba(255,255,255,0.75);
    text-align: center;
    font-size: clamp(13px, 3.5vw, 16px);
    margin-bottom: 14px;
    line-height: 1.35;
  }

  .loginModalRow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 10px;
  }

  .loginInput {
    width: min(280px, 70vw);
    background: rgba(0,0,0,0.35);
    border: 1.5px solid rgba(240,208,128,0.55);
    border-radius: 999px;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    outline: none;
    padding: 11px 15px;
  }

  .smallBtn {
    background: rgba(240,208,128,0.95);
    color: #143d22;
    border: 1px solid #f0d080;
    border-radius: 999px;
    padding: 11px 15px;
    font-weight: 900;
    cursor: pointer;
  }

  .rulesList {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .rulesLine {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    color: #fff;
    font-size: clamp(14px, 3.6vw, 17px);
    line-height: 1.35;
  }

  .rulesBullet {
    color: #f0d080;
    font-weight: 900;
    flex-shrink: 0;
  }

  .modalActions {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 18px;
    flex-wrap: wrap;
  }

  .leaderboardList {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .leaderboardRow {
    display: grid;
    grid-template-columns: 38px 1fr auto;
    gap: 10px;
    align-items: center;
    background: rgba(0,0,0,0.28);
    border: 1px solid rgba(240,208,128,0.25);
    border-radius: 12px;
    padding: 10px 12px;
    color: #fff;
  }

  .leaderboardRank {
    color: #f0d080;
    font-weight: 900;
    font-size: 16px;
  }

  .leaderboardName {
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .leaderboardSips {
    color: #f0d080;
    font-weight: 900;
    white-space: nowrap;
  }

  .status {
    color: rgba(255,255,255,0.75);
    text-align: center;
    padding: 16px;
    font-weight: 700;
  }

  .penaltyToast {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(160,20,20,0.97);
    border: 2px solid #ff7070;
    border-radius: 18px;
    padding: 24px 48px;
    text-align: center;
    z-index: 100;
    animation: toastIn 0.3s ease, toastOut 0.35s ease 1.9s forwards;
    pointer-events: none;
    max-width: 80vw;
  }

  .penaltyMsg {
    color: #fff;
    font-size: clamp(26px,6vw,40px);
    font-weight: 900;
  }

  .penaltySub {
    color: rgba(255,255,255,0.75);
    font-size: 16px;
    margin-top: 5px;
  }

  .winnerOverlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    animation: fadeIn 0.4s ease;
    padding: 20px;
  }

  .winnerBox {
    background: #1a6b3a;
    border: 3px solid #f0d080;
    border-radius: 22px;
    padding: clamp(34px,6vw,52px) clamp(40px,8vw,76px);
    text-align: center;
  }

  .winnerText {
    color: #f0d080;
    font-size: clamp(32px,7vw,46px);
    font-weight: 900;
    letter-spacing: 4px;
  }

  .winnerSub {
    color: rgba(255,255,255,0.8);
    font-size: 18px;
    margin-top: 8px;
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

  @keyframes busEnterVehicle {
    0% { transform: translateX(calc(-50% - 120vw)); opacity: 0; }
    15% { opacity: 1; }
    72% { transform: translateX(calc(-50% + 8px)); opacity: 1; }
    100% { transform: translateX(-50%); opacity: 1; }
  }

  @keyframes busEnterRightVehicle {
    0% { transform: translateX(calc(-50% + 120vw)); opacity: 0; }
    15% { opacity: 1; }
    72% { transform: translateX(calc(-50% - 8px)); opacity: 1; }
    100% { transform: translateX(-50%); opacity: 1; }
  }

  @keyframes busDriveOff {
    0% { transform: translateX(-50%); opacity: 1; }
    18% { transform: translateX(calc(-50% + 22px)); opacity: 1; }
    45% { transform: translateX(calc(-50% + 120px)); opacity: 1; }
    100% { transform: translateX(calc(-50% + 120vw)); opacity: 0; }
  }

  @keyframes busBob {
    0%, 100% { transform: scaleX(-1) translateY(0) rotate(-1deg); }
    50% { transform: scaleX(-1) translateY(-4px) rotate(1deg); }
  }

  @keyframes busWinBob {
    0%, 100% { transform: scaleX(-1) translateY(0) rotate(-2deg) scale(1.05); }
    50% { transform: scaleX(-1) translateY(-7px) rotate(3deg) scale(1.16); }
  }

  @keyframes busCrash {
    0% { transform: scaleX(-1) translateX(0) translateY(0) rotate(-1deg); }
    18% { transform: scaleX(-1) translateX(10px) translateY(0) rotate(2deg); }
    35% { transform: scaleX(-1) translateX(15px) translateY(-3px) rotate(-9deg); }
    55% { transform: scaleX(-1) translateX(9px) translateY(2px) rotate(8deg); }
    75% { transform: scaleX(-1) translateX(4px) translateY(0) rotate(-4deg); }
    100% { transform: scaleX(-1) translateX(0) translateY(0) rotate(0deg); }
  }

  @keyframes smokeDrift {
    0% { transform: translateX(8px) scale(0.75); opacity: 0; }
    35% { opacity: 0.85; }
    100% { transform: translateX(-14px) scale(1.25); opacity: 0; }
  }

  @keyframes sparklePop {
    0%, 100% { transform: scale(0.7) rotate(0deg); opacity: 0.25; }
    50% { transform: scale(1.2) rotate(18deg); opacity: 1; }
  }

  @keyframes roadMove {
    from { transform: translateX(0); }
    to { transform: translateX(-34px); }
  }

  @keyframes busGlowPulse {
    0%, 100% { opacity: 0.2; transform: scaleX(0.85); }
    50% { opacity: 0.45; transform: scaleX(1); }
  }

  @keyframes crashBurst {
    0% { transform: translateX(-50%) scale(0.2) rotate(0deg); opacity: 0; }
    25% { transform: translateX(-50%) scale(1.25) rotate(12deg); opacity: 1; }
    100% { transform: translateX(-50%) scale(0.8) rotate(-10deg); opacity: 0; }
  }

  @keyframes crashBlockShake {
    0%, 100% { transform: translateX(-50%) rotate(0deg); }
    25% { transform: translateX(-50%) rotate(-12deg); }
    50% { transform: translateX(-50%) rotate(10deg); }
    75% { transform: translateX(-50%) rotate(-6deg); }
  }

  @keyframes raceFlagSpawn {
    0% { transform: translateY(12px) rotate(-18deg) scale(0.1); opacity: 0; }
    22% { transform: translateY(-6px) rotate(8deg) scale(1.25); opacity: 1; }
    45% { transform: translateY(0) rotate(-6deg) scale(1); opacity: 1; }
    100% { transform: translateY(0) rotate(7deg) scale(1.08); opacity: 1; }
  }

  @keyframes winBurst {
    0% { transform: translateX(-50%) scale(0.1) rotate(0deg); opacity: 0; }
    20% { transform: translateX(-50%) scale(1.25) rotate(12deg); opacity: 1; }
    100% { transform: translateX(-50%) scale(1.8) rotate(25deg); opacity: 0; }
  }

  @keyframes winConfettiLeft {
    0% { transform: translate(0, 0) rotate(0deg) scale(0.8); opacity: 0; }
    15% { opacity: 1; }
    100% { transform: translate(-70px, -36px) rotate(-130deg) scale(1.2); opacity: 0; }
  }

  @keyframes winConfettiRight {
    0% { transform: translate(0, 0) rotate(0deg) scale(0.8); opacity: 0; }
    15% { opacity: 1; }
    100% { transform: translate(70px, -40px) rotate(140deg) scale(1.2); opacity: 0; }
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

  @media (orientation: landscape) and (max-height: 560px) {
    .game {
      padding: 7px;
      gap: 6px;
    }

    .title {
      font-size: clamp(22px, 7vh, 34px);
    }

    .banner {
      min-height: 36px;
      padding: 7px 16px;
      font-size: clamp(13px, 4vh, 18px);
      max-width: min(620px, calc(100vw - 14px));
    }

    .card {
      width: clamp(42px, 8.3vw, 72px);
      height: clamp(59px, 11.6vw, 101px);
    }

    .slotShell {
      width: clamp(42px, 8.3vw, 72px);
    }

    .cardRow {
      gap: clamp(8px, 1.4vw, 14px);
      padding-top: 24px;
    }

    .btn {
      padding: 8px clamp(12px, 2vw, 20px);
      font-size: clamp(13px, 4vh, 18px);
    }
  }
`;

const CardBack = ({ extraClass = "" }) => (
  <div className={`card cardBack ${extraClass}`}>
    <div className="cardBackPattern" />
  </div>
);

const CardFace = ({ card, extraClass = "" }) => {
  if (!card) return <CardBack extraClass={extraClass} />;

  const col = card.color === "red" ? "#cc2200" : "#111";

  return (
    <div className={`card cardFront ${extraClass}`}>
      <div className="cardInner">
        <div className="corner">
          <span className="rank" style={{ color: col }}>
            {card.display}
          </span>
          <span className="suit" style={{ color: col }}>
            {card.sym}
          </span>
        </div>

        <div className="centerSuit" style={{ color: col }}>
          {card.sym}
        </div>

        <div className="corner br">
          <span className="rank" style={{ color: col }}>
            {card.display}
          </span>
          <span className="suit" style={{ color: col }}>
            {card.sym}
          </span>
        </div>
      </div>
    </div>
  );
};

const CardSlot = ({ current, history, revealed, isActive, animKey }) => {
  const prevCard = history.length > 0 ? history[history.length - 1] : null;
  const totalHeight = prevCard
    ? "calc(clamp(62px, 19.9vw, 126px) + clamp(18px, 4.6vw, 34px))"
    : "clamp(62px, 19.9vw, 126px)";

  return (
    <div className="slotShell" style={{ height: totalHeight }}>
      {isActive && <div className="arrow">▼</div>}

      {prevCard && (
        <div className="prevCard">
          <CardFace card={prevCard} />
        </div>
      )}

      <div
        key={animKey}
        className={`cardTop ${isActive ? "activeCard" : "inactiveCard"} ${animKey ? "flipIn" : ""}`}
        style={{ top: prevCard ? "clamp(18px, 4.6vw, 34px)" : 0 }}
      >
        {revealed ? <CardFace card={current} /> : <CardBack />}
      </div>
    </div>
  );
};

const BusRunner = ({
  activeIdx,
  crashing,
  winning,
  entering,
  enterDirection,
}) => {
  const safeIdx = Math.max(0, Math.min(4, activeIdx));
  const leftPercent = `${10 + safeIdx * 20}%`;

  const enteringClass = entering
    ? enterDirection === "right"
      ? "enteringRight"
      : "enteringLeft"
    : "";

  return (
    <div className="busTrack">
      <div className="busGlow" />

      <div className="busRoad">
        <div className="busRoadLine" />
      </div>

      {crashing && (
        <div
          className="crashBlock"
          style={{ left: `calc(${leftPercent} + clamp(20px, 5vw, 32px))` }}
        >
          🚧
        </div>
      )}

      {crashing && (
        <div
          className="crashBurst"
          style={{ left: `calc(${leftPercent} + clamp(12px, 3vw, 22px))` }}
        >
          💥
        </div>
      )}

      {winning && <div className="raceFlag">🏁</div>}

      {winning && (
        <>
          <div className="winBurst">🏆</div>
          <div className="confettiLeft">🎉</div>
          <div className="confettiRight">✨</div>
        </>
      )}

      <div
        className={`busVehicle ${enteringClass} ${winning ? "winning" : ""}`}
        style={{ left: leftPercent }}
      >
        <div className="busTrail">
          <span className="smokePuff">💨</span>
          <span className="sparkle">✨</span>
        </div>

        <div
          className={`busEmoji ${crashing ? "crashing" : ""} ${winning ? "winning" : ""}`}
        >
          🚌
        </div>
      </div>
    </div>
  );
};

const CardGame = () => {
  const savedName = cleanPlayerName(loadPlayerName());

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
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [playerNameDraft, setPlayerNameDraft] = useState(savedName);
  const [activePlayerName, setActivePlayerName] = useState(savedName);
  const [loginMessage, setLoginMessage] = useState(
    savedName ? `Logged in as ${savedName}` : "",
  );
  const [loginLoading, setLoginLoading] = useState(false);
  const [takenName, setTakenName] = useState(null);
  const [busCrash, setBusCrash] = useState(false);
  const [busWin, setBusWin] = useState(false);
  const [busEntering, setBusEntering] = useState(false);
  const [busEnterDirection, setBusEnterDirection] = useState("left");
  const [failPending, setFailPending] = useState(false);
  const [lifetimeSips, setLifetimeSips] = useState(() => loadLifetimeSips());

  const penaltyTimer = useRef(null);
  const busCrashTimer = useRef(null);
  const busEnterTimer = useRef(null);
  const winTimer = useRef(null);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError("");

    try {
      const data = await fetchLeaderboard();
      setLeaderboard(data);
    } catch (err) {
      setLeaderboardError(err?.message || "Could not load leaderboard.");
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const openLeaderboard = () => {
    setShowLeaderboard(true);
    loadLeaderboard();
  };

  const openLogin = () => {
    setTakenName(null);
    setLoginMessage(activePlayerName ? `Logged in as ${activePlayerName}` : "");
    setShowLogin(true);
  };

  const completeLogin = async (name) => {
    const cleanName = cleanPlayerName(name);

    await ensureOnlinePlayer(cleanName);

    savePlayerName(cleanName);
    setActivePlayerName(cleanName);
    setPlayerNameDraft(cleanName);
    setLoginMessage(`Logged in as ${cleanName}`);
    setTakenName(null);
    setShowLogin(false);

    if (showLeaderboard) {
      loadLeaderboard();
    }
  };

  const handleLogin = async () => {
    const cleanName = cleanPlayerName(playerNameDraft);

    if (!cleanName) {
      setLoginMessage("Enter a name first.");
      return;
    }

    setLoginLoading(true);
    setLoginMessage("");

    try {
      const existing = await findLeaderboardPlayer(cleanName);
      const cookieName = cleanPlayerName(loadPlayerName());
      const sameAsCookie = nameKey(cookieName) === nameKey(cleanName);
      const sameAsActive = nameKey(activePlayerName) === nameKey(cleanName);

      if (existing && !sameAsCookie && !sameAsActive) {
        setTakenName({
          name: cleanName,
          sips: existing.sips,
        });
        setLoginMessage("");
        return;
      }

      await completeLogin(cleanName);
    } catch (err) {
      setLoginMessage(err?.message || "Could not log in.");
    } finally {
      setLoginLoading(false);
    }
  };

  const confirmTakenNameLogin = async () => {
    if (!takenName?.name) return;

    setLoginLoading(true);

    try {
      await completeLogin(takenName.name);
    } catch (err) {
      setLoginMessage(err?.message || "Could not log in.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handlePlayerNameChange = (e) => {
    setPlayerNameDraft(e.target.value.slice(0, 20));
    setTakenName(null);
  };

  const handleLogout = () => {
    clearPlayerName();
    setActivePlayerName("");
    setPlayerNameDraft("");
    setTakenName(null);
    setLoginMessage("Logged out.");
  };

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

  const resetBoardForRuleset = useCallback(
    (nextRuleset, enterFrom = "left") => {
      clearTimeout(penaltyTimer.current);
      clearTimeout(busCrashTimer.current);
      clearTimeout(busEnterTimer.current);
      clearTimeout(winTimer.current);

      setBusCrash(false);
      setBusWin(false);
      setFailPending(false);
      setBusEnterDirection(enterFrom);

      if (enterFrom === "none") {
        setBusEntering(false);
      } else {
        setBusEntering(true);

        busEnterTimer.current = setTimeout(() => {
          setBusEntering(false);
        }, BUS_ENTER_MS);
      }

      const pool = shuffle(FULL_DECK);

      setDeckPool(pool);
      setDeckPtr(5);
      setPositions(pool.slice(0, 5));
      setHistory([[], [], [], [], []]);
      setRevealed(
        nextRuleset === RULESETS.AUCKLAND
          ? [false, false, false, false, false]
          : [true, false, false, false, true],
      );
      setActiveIdx(0);
      setPenalty(null);
      setWinner(false);
      setGameOver(false);
      setShakeSlot(null);
      setAnimKey(0);
    },
    [],
  );

  const startGame = useCallback(() => {
    resetBoardForRuleset(ruleset, "left");
  }, [resetBoardForRuleset, ruleset]);

  useEffect(() => {
    resetBoardForRuleset(RULESETS.WELLY, "left");
  }, [resetBoardForRuleset]);

  const switchRuleset = (nextRuleset) => {
    if (ruleset === nextRuleset) return;

    setRuleset(nextRuleset);
    resetBoardForRuleset(nextRuleset, "left");
  };

  const resetPlayerSipCount = async () => {
    setLifetimeSips(0);
    saveLifetimeSips(0);

    if (!activePlayerName) return;

    try {
      await resetOnlineSips(activePlayerName);

      if (showLeaderboard) {
        loadLeaderboard();
      }
    } catch (err) {
      setLeaderboardError(err?.message || "Could not reset leaderboard.");
    }
  };

  const addPenaltyToTally = (idx) => {
    const penaltyObj = PENALTIES[idx] ?? PENALTIES[PENALTIES.length - 1];

    setPenalty(penaltyObj.label);

    setLifetimeSips((prev) => {
      const newTotal = prev + penaltyObj.sips;
      saveLifetimeSips(newTotal);
      return newTotal;
    });

    if (!activePlayerName) {
      setLoginMessage("Log in with a name to save online.");
      return;
    }

    addOnlineSips(activePlayerName, penaltyObj.sips)
      .then(() => {
        if (showLeaderboard) {
          loadLeaderboard();
        }
      })
      .catch((err) => {
        setLeaderboardError(err?.message || "Could not sync leaderboard.");
      });
  };

  const triggerWin = () => {
    clearTimeout(winTimer.current);
    clearTimeout(busCrashTimer.current);
    clearTimeout(penaltyTimer.current);
    clearTimeout(busEnterTimer.current);

    setGameOver(true);
    setBusCrash(false);
    setBusEntering(false);
    setBusWin(true);
    setPenalty(null);
    setFailPending(false);

    winTimer.current = setTimeout(() => {
      setWinner(true);
    }, WIN_ANIMATION_MS + WIN_POPUP_AFTER_ANIMATION_MS);
  };

  const failCurrentCard = (afterPenaltyPopup, penaltyIdx = activeIdx) => {
    setFailPending(true);
    setShakeSlot(activeIdx);
    setTimeout(() => setShakeSlot(null), 500);

    clearTimeout(busCrashTimer.current);
    clearTimeout(penaltyTimer.current);

    setPenalty(null);
    setBusCrash(false);

    setTimeout(() => {
      setBusCrash(true);
    }, 20);

    busCrashTimer.current = setTimeout(() => {
      setBusCrash(false);
    }, 850);

    penaltyTimer.current = setTimeout(() => {
      addPenaltyToTally(penaltyIdx);

      penaltyTimer.current = setTimeout(() => {
        setPenalty(null);
        setFailPending(false);

        if (afterPenaltyPopup) {
          afterPenaltyPopup();
        }
      }, POPUP_VISIBLE_MS);
    }, CRASH_BEFORE_POPUP_MS);
  };

  const handleWellyGuess = (type) => {
    const current = positions[activeIdx];
    const excludedKeys = getVisibleCardKeys(positions, history);
    const {
      card: next,
      newPool,
      newPtr,
    } = drawCard(deckPool, deckPtr, excludedKeys);

    setDeckPool(newPool);
    setDeckPtr(newPtr);

    const correct =
      (type === "higher" && next.val > current.val) ||
      (type === "lower" && next.val < current.val) ||
      (type === "even" && next.val === current.val);

    const newHistory = history.map((h) => [...h]);
    newHistory[activeIdx] = [...history[activeIdx], current];

    const newPositions = [...positions];
    newPositions[activeIdx] = next;

    const newRevealed = [...revealed];
    newRevealed[activeIdx] = true;

    setHistory(newHistory);
    setPositions(newPositions);
    setRevealed(newRevealed);
    setAnimKey((k) => k + 1);

    if (correct) {
      if (activeIdx === 4) {
        triggerWin();
      } else {
        const nextRevealed = [...newRevealed];
        nextRevealed[activeIdx + 1] = true;

        setRevealed(nextRevealed);
        setActiveIdx(activeIdx + 1);
      }

      return;
    }

    failCurrentCard(() => {
      setActiveIdx(0);
    });
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
        (type === "even" && !isOdd(current, RULESETS.AUCKLAND)) ||
        (type === "odd" && isOdd(current, RULESETS.AUCKLAND));
    }

    if (activeIdx === 2) {
      const result = getInsideOutsideResult(
        current,
        positions[0],
        positions[1],
        RULESETS.AUCKLAND,
      );
      correct = type === result;
    }

    if (activeIdx === 3) {
      const currentValue = cardValueForRuleset(current, RULESETS.AUCKLAND);
      const previousValue = cardValueForRuleset(previous, RULESETS.AUCKLAND);

      correct =
        (type === "higher" && currentValue > previousValue) ||
        (type === "lower" && currentValue < previousValue) ||
        (type === "even" && currentValue === previousValue);
    }

    if (activeIdx === 4) {
      correct = type === current.name.toLowerCase();
    }

    const newRevealed = [...revealed];
    newRevealed[activeIdx] = true;

    setRevealed(newRevealed);
    setAnimKey((k) => k + 1);

    if (correct) {
      if (activeIdx === 4) {
        triggerWin();
      } else {
        setActiveIdx(activeIdx + 1);
      }

      return;
    }

    failCurrentCard(() => {
      resetBoardForRuleset(RULESETS.AUCKLAND, "none");
    }, 0);
  };

  const handleGuess = (type) => {
    if (gameOver || winner || penalty || failPending || busWin) return;

    if (ruleset === RULESETS.AUCKLAND) {
      handleAucklandGuess(type);
    } else {
      handleWellyGuess(type);
    }
  };

  const getBannerText = () => {
    if (winner) {
      return (
        <span style={{ opacity: 0, userSelect: "none" }}>placeholder</span>
      );
    }

    if (ruleset === RULESETS.WELLY) {
      const currentCard = positions[activeIdx];

      if (!currentCard) {
        return (
          <span style={{ opacity: 0, userSelect: "none" }}>placeholder</span>
        );
      }

      return (
        <span className="bannerLine">
          Higher, lower, or even than the{" "}
          <strong style={{ color: "#f0d080" }}>
            {rankLabel(currentCard)} of {currentCard.name}
          </strong>
          ?
        </span>
      );
    }

    if (activeIdx === 0) {
      return (
        <span className="bannerLine">Pick the colour of the first card.</span>
      );
    }

    if (activeIdx === 1) {
      return (
        <span className="bannerLine">Will the next card be even or odd?</span>
      );
    }

    if (activeIdx === 2) {
      const first = positions[0];
      const second = positions[1];

      return (
        <span className="bannerLine">
          Inside, outside, or even{" "}
          <strong style={{ color: "#f0d080" }}>
            {rankLabel(first)} and {rankLabel(second)}
          </strong>
          ?
        </span>
      );
    }

    if (activeIdx === 3) {
      const previous = positions[2];

      return (
        <span className="bannerLine">
          Higher, lower, or even than the{" "}
          <strong style={{ color: "#f0d080" }}>
            {rankLabel(previous)} of {previous.name}
          </strong>
          ?
        </span>
      );
    }

    return (
      <span className="bannerLine">Guess the suit of the final card.</span>
    );
  };

  const getRulesContent = () => {
    if (ruleset === RULESETS.WELLY) {
      return {
        title: "Welly Rules",
        lines: [
          "Five cards are dealt. The first and last card start face up.",
          "Guess whether the next card is higher, lower, or even than the current card.",
          "Ace is high.",
          "If you guess right, move to the next card.",
          "If you guess wrong, drink the card penalty and go back to card 1.",
          "The deck keeps cycling in order during the round. It only reshuffles when the game restarts.",
          "Penalties are: 1 sip, 2 sips, 3 sips, half drink, full drink.",
        ],
      };
    }

    return {
      title: "Auckland Rules",
      lines: [
        "Five cards are dealt face down.",
        "Card 1: guess red or black.",
        "Card 2: guess even or odd. Ace counts as 1.",
        "Card 3: guess inside, outside, or even against the first two cards. Inside is strictly between. Even means hitting either boundary.",
        "Card 4: guess higher, lower, or even than the previous card. Ace counts as 1.",
        "Card 5: guess the suit.",
        "If you guess wrong, drink 1 sip and the whole board resets.",
        "The deck keeps cycling in order during the round. It only reshuffles when the game restarts.",
        "Auckland wrong guesses are always 1 sip.",
      ],
    };
  };

  const getControls = () => {
    if (ruleset === RULESETS.WELLY) {
      return [
        { type: "higher", label: "↑ Higher", className: "btnHigher" },
        { type: "lower", label: "↓ Lower", className: "btnLower" },
        { type: "even", label: "= Even", className: "btnEven" },
      ];
    }

    if (activeIdx === 0) {
      return [
        { type: "red", label: "♥ Red", className: "btnRed" },
        { type: "black", label: "♠ Black", className: "btnBlack" },
      ];
    }

    if (activeIdx === 1) {
      return [
        { type: "even", label: "= Even", className: "btnEven" },
        { type: "odd", label: "Odd", className: "btnOdd" },
      ];
    }

    if (activeIdx === 2) {
      return [
        { type: "inside", label: "Inside", className: "btnHigher" },
        { type: "outside", label: "Outside", className: "btnLower" },
        { type: "even", label: "= Even", className: "btnEven" },
      ];
    }

    if (activeIdx === 3) {
      return [
        { type: "higher", label: "↑ Higher", className: "btnHigher" },
        { type: "lower", label: "↓ Lower", className: "btnLower" },
        { type: "even", label: "= Even", className: "btnEven" },
      ];
    }

    return [
      { type: "spades", label: "♠ Spades", className: "btnBlack" },
      { type: "clubs", label: "♣ Clubs", className: "btnBlack" },
      { type: "hearts", label: "♥ Hearts", className: "btnRed" },
      { type: "diamonds", label: "♦ Diamonds", className: "btnRed" },
    ];
  };

  const disabled = !!penalty || winner || gameOver || failPending || busWin;
  const controls = getControls();
  const rulesContent = getRulesContent();

  return (
    <div className="game">
      <style>{CSS}</style>

      <div className="topLeftButtons">
        <button className="cornerBtn" onClick={openLeaderboard}>
          🏆 Leaderboard
        </button>

        <button className="cornerBtn" onClick={openLogin}>
          👤 {activePlayerName || "Login"}
        </button>
      </div>

      <button className="cornerBtn rulesBtn" onClick={() => setShowRules(true)}>
        ? Rules
      </button>

      <h1 className="title">🚌 The Bus</h1>

      <div className="topMetaRow">
        <div className="rulesToggle">
          <button
            className={`rulesToggleBtn ${ruleset === RULESETS.WELLY ? "active" : ""}`}
            onClick={() => switchRuleset(RULESETS.WELLY)}
            disabled={ruleset === RULESETS.WELLY}
          >
            Welly Rules
          </button>

          <button
            className={`rulesToggleBtn ${ruleset === RULESETS.AUCKLAND ? "active" : ""}`}
            onClick={() => switchRuleset(RULESETS.AUCKLAND)}
            disabled={ruleset === RULESETS.AUCKLAND}
          >
            Auckland Rules
          </button>
        </div>

        <div className="statsBar">
          <div className="statBlock">
            <span className="statNum">{lifetimeSips}</span>
            <span className="statLabel">sips</span>
          </div>

          <div className="statDivider" />

          <div className="statBlock">
            <span className="statNum">
              {(lifetimeSips / SIPS_PER_DRINK).toFixed(1)}
            </span>
            <span className="statLabel">drinks consumed</span>
          </div>

          <button className="resetStatsBtn" onClick={resetPlayerSipCount}>
            ↺ reset
          </button>
        </div>
      </div>

      <div className="banner">{getBannerText()}</div>

      <div className="cardStage">
        <BusRunner
          activeIdx={activeIdx}
          crashing={busCrash}
          winning={busWin}
          entering={busEntering}
          enterDirection={busEnterDirection}
        />

        <div className="cardRow">
          {positions.map((card, i) => (
            <div key={i} className={shakeSlot === i ? "shake" : ""}>
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
      </div>

      <div className="controls">
        {controls.map((control) => (
          <button
            key={control.type}
            className={`btn ${control.className}`}
            onClick={() => handleGuess(control.type)}
            disabled={disabled}
          >
            {control.label}
          </button>
        ))}

        <button className="btn btnRestart" onClick={startGame}>
          ↺ Restart
        </button>
      </div>

      {showLogin && (
        <div className="overlay" onClick={() => setShowLogin(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalTitle">Login</div>

            {!takenName && (
              <>
                <div className="modalSub">
                  Enter a username to save your score online.
                </div>

                <div className="loginModalRow">
                  <input
                    className="loginInput"
                    value={playerNameDraft}
                    onChange={handlePlayerNameChange}
                    placeholder="Enter username"
                    maxLength={20}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleLogin();
                      }
                    }}
                  />

                  <button
                    className="smallBtn"
                    onClick={handleLogin}
                    disabled={loginLoading}
                  >
                    {loginLoading ? "Checking..." : "Login"}
                  </button>
                </div>

                <div className="status">
                  {loginMessage ||
                    (activePlayerName
                      ? `Currently logged in as ${activePlayerName}`
                      : "Not logged in")}
                </div>

                <div className="modalActions">
                  {activePlayerName && (
                    <button className="btn btnLower" onClick={handleLogout}>
                      Log out
                    </button>
                  )}

                  <button
                    className="btn btnRestart"
                    onClick={() => setShowLogin(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {takenName && (
              <>
                <div className="modalSub">
                  <strong style={{ color: "#f0d080" }}>{takenName.name}</strong>{" "}
                  is already on the leaderboard with{" "}
                  <strong style={{ color: "#f0d080" }}>
                    {drinksLabelFromSips(takenName.sips)}
                  </strong>
                  .
                  <br />
                  Is this you?
                </div>

                <div className="modalActions">
                  <button
                    className="btn btnHigher"
                    onClick={confirmTakenNameLogin}
                    disabled={loginLoading}
                  >
                    Yes, log me in
                  </button>

                  <button
                    className="btn btnLower"
                    onClick={() => {
                      setTakenName(null);
                      setLoginMessage("Choose another username.");
                    }}
                  >
                    No, choose another
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalTitle">{rulesContent.title}</div>

            <div className="rulesList">
              {rulesContent.lines.map((line, i) => (
                <div key={i} className="rulesLine">
                  <span className="rulesBullet">•</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>

            <div className="modalActions">
              <button
                className="btn btnRestart"
                onClick={() => setShowRules(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaderboard && (
        <div className="overlay" onClick={() => setShowLeaderboard(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalTitle">Drink Leaderboard</div>

            <div className="modalSub">
              Logged in as{" "}
              <strong style={{ color: "#f0d080" }}>
                {activePlayerName || "nobody"}
              </strong>
              . Wrong guesses add to your drink total.
            </div>

            {leaderboardLoading && (
              <div className="status">Loading leaderboard...</div>
            )}

            {!leaderboardLoading && leaderboardError && (
              <div className="status">{leaderboardError}</div>
            )}

            {!leaderboardLoading &&
              !leaderboardError &&
              leaderboard.length === 0 && (
                <div className="status">No scores yet.</div>
              )}

            {!leaderboardLoading &&
              !leaderboardError &&
              leaderboard.length > 0 && (
                <div className="leaderboardList">
                  {leaderboard.map((row, i) => (
                    <div key={`${row.name}-${i}`} className="leaderboardRow">
                      <span className="leaderboardRank">#{i + 1}</span>
                      <span className="leaderboardName">{row.name}</span>
                      <span className="leaderboardSips">
                        {drinksLabelFromSips(row.sips)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

            <div className="modalActions">
              <button
                className="btn btnEven"
                onClick={loadLeaderboard}
                disabled={leaderboardLoading}
              >
                Refresh
              </button>

              <button
                className="btn btnRestart"
                onClick={() => setShowLeaderboard(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {penalty && (
        <div className="penaltyToast">
          <div className="penaltyMsg">{penalty}</div>
          <div className="penaltySub">
            {ruleset === RULESETS.AUCKLAND ? "Board reset!" : "Back to card 1!"}
          </div>
        </div>
      )}

      {winner && (
        <div className="winnerOverlay">
          <div className="winnerBox">
            <div style={{ fontSize: 62, marginBottom: 8 }}>🏆</div>
            <div className="winnerText">WINNER!</div>
            <div className="winnerSub">You rode the bus!</div>

            <button
              className="btn btnRestart"
              style={{ marginTop: 18 }}
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

export default CardGame;
