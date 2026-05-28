import { useState } from 'react';
import { formatScore } from '../../engine/search';

interface RoundHUDProps {
  handsRemaining: number;
  maxHands: number;
  discardsRemaining: number;
  maxDiscards: number;
  roundScore: number;
  blindChips: number;
  onNewRound?: () => void;
}

export function RoundHUD({
  handsRemaining,
  maxHands,
  discardsRemaining,
  maxDiscards,
  roundScore,
  blindChips,
  onNewRound,
}: RoundHUDProps) {
  const [confirming, setConfirming] = useState(false);
  const scorePercent = blindChips > 0 ? Math.min(100, Math.round((roundScore / blindChips) * 100)) : 0;

  return (
    <div className="round-hud">
      <div className="round-hud__stats">
        <div className="round-hud__stat">
          <span className="round-hud__label">Hands</span>
          <span className="round-hud__value">
            {handsRemaining}/{maxHands}
          </span>
          <div className="round-hud__bar">
            <div
              className="round-hud__bar-fill round-hud__bar-fill--hands"
              style={{ width: `${maxHands > 0 ? (handsRemaining / maxHands) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="round-hud__separator" />

        <div className="round-hud__stat">
          <span className="round-hud__label">Discards</span>
          <span className="round-hud__value">
            {discardsRemaining}/{maxDiscards}
          </span>
          <div className="round-hud__bar">
            <div
              className="round-hud__bar-fill round-hud__bar-fill--discards"
              style={{ width: `${maxDiscards > 0 ? (discardsRemaining / maxDiscards) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="round-hud__separator" />

        <div className="round-hud__stat round-hud__stat--wide">
          <span className="round-hud__label">Round Score</span>
          <span className="round-hud__value round-hud__value--score">
            {formatScore(roundScore)}
            <span className="round-hud__target"> / {formatScore(blindChips)}</span>
            <span className="round-hud__percent"> ({scorePercent}%)</span>
          </span>
          <div className="round-hud__bar">
            <div
              className={`round-hud__bar-fill ${scorePercent >= 100 ? 'round-hud__bar-fill--cleared' : 'round-hud__bar-fill--score'}`}
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>
      </div>

      {onNewRound && (
        <div className="round-hud__actions">
          {confirming ? (
            <>
              <button
                className="round-hud__btn round-hud__btn--confirm"
                onClick={() => { onNewRound(); setConfirming(false); }}
              >
                Confirm New Round
              </button>
              <button
                className="round-hud__btn round-hud__btn--cancel"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="round-hud__btn round-hud__btn--new"
              onClick={() => setConfirming(true)}
            >
              New Round
            </button>
          )}
        </div>
      )}
    </div>
  );
}
