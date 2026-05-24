import type { Card } from '../../engine/types';
import {
  CardEnhancement, Seal, Suit, rankToChips,
} from '../../engine/types';

const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Spades]: '♠',
  [Suit.Hearts]: '♥',
  [Suit.Clubs]: '♣',
  [Suit.Diamonds]: '♦',
};

const SUIT_COLORS: Record<Suit, string> = {
  [Suit.Spades]: '#4a5568',
  [Suit.Hearts]: '#e53e3e',
  [Suit.Clubs]: '#38a169',
  [Suit.Diamonds]: '#dd6b20',
};

const ENHANCEMENT_COLORS: Partial<Record<CardEnhancement, string>> = {
  [CardEnhancement.Bonus]: '#f6e05e',
  [CardEnhancement.Mult]: '#9f7aea',
  [CardEnhancement.Wild]: '#68d391',
  [CardEnhancement.Glass]: '#90cdf4',
  [CardEnhancement.Steel]: '#a0aec0',
  [CardEnhancement.Stone]: '#718096',
  [CardEnhancement.Gold]: '#f6ad55',
  [CardEnhancement.Lucky]: '#fc8181',
};

const SEAL_COLORS: Partial<Record<Seal, string>> = {
  [Seal.Red]: '#fc8181',
  [Seal.Blue]: '#63b3ed',
  [Seal.Gold]: '#f6ad55',
  [Seal.Purple]: '#b794f4',
};

interface CardComponentProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
}

const SIZE_DIMS: Record<string, string> = { sm: '60px', md: '80px', lg: '100px' };
const SIZE_FONT: Record<string, string> = { sm: '0.7rem', md: '0.85rem', lg: '1rem' };

export function CardComponent({ card, size = 'md', onClick, selected, disabled }: CardComponentProps) {
  const isStone = card.enhancement === CardEnhancement.Stone;
  const isRed = [Suit.Hearts, Suit.Diamonds].includes(card.suit);

  const width = SIZE_DIMS[size];
  const fontSize = SIZE_FONT[size];

  const bgColor = isStone ? '#718096' : '#1a202c';
  const borderColor = selected ? '#48bb78' : isRed ? '#e53e3e' : '#4a5568';
  const textColor = isStone ? '#e2e8f0' : isRed ? '#fc8181' : '#e2e8f0';
  const sealColor = card.seal !== Seal.None ? SEAL_COLORS[card.seal] : undefined;
  const enhColor = card.enhancement !== CardEnhancement.None ? ENHANCEMENT_COLORS[card.enhancement] : undefined;

  const chipStr = isStone ? '50' : rankToChips(card.rank).toString();

  const classes = [
    'card',
    `card--${size}`,
    isStone ? 'card--stone' : '',
    selected ? 'card--selected' : '',
    disabled ? 'card--disabled' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      onClick={disabled ? undefined : onClick}
      style={{
        width,
        height: `calc(${width} * 1.4)`,
        backgroundColor: bgColor,
        border: `2px solid ${borderColor}`,
        color: textColor,
        fontSize,
        cursor: onClick && !disabled ? 'pointer' : 'default',
        opacity: disabled ? 0.4 : 1,
        boxShadow: selected ? '0 0 10px rgba(72, 187, 120, 0.5)' : 'none',
        outline: sealColor ? `2px solid ${sealColor}` : undefined,
        outlineOffset: sealColor ? '2px' : undefined,
      }}
    >
      {!isStone && (
        <>
          <span className="card__suit" style={{ color: SUIT_COLORS[card.suit] }}>
            {SUIT_SYMBOLS[card.suit]}
          </span>
          <span>{card.rank}</span>
        </>
      )}
      {isStone && <span style={{ fontSize: '1.2em' }}>{'■'}</span>}
      <span className="card__chips">{chipStr}</span>
      {enhColor && (
        <div
          className="card__enhancement-bar"
          style={{ backgroundColor: enhColor }}
        />
      )}
    </div>
  );
}
