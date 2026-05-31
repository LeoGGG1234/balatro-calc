import { describe, it, expect } from 'vitest';
import { Rank, Suit, CardEnhancement } from '../src/engine/types';
import {
  applyTarot, applyPlanet, applyConsumable,
  canApplyConsumable, getTarotTargetSuggestions,
} from '../src/engine/consumables';
import type { HeldConsumable } from '../src/engine/types';
import { defaultState, card } from './helpers';

describe('Consumables Engine', () => {
  describe('canApplyConsumable', () => {
    it('returns true for applicable tarot cards', () => {
      expect(canApplyConsumable('strength', 'tarot')).toBe(true);
      expect(canApplyConsumable('death', 'tarot')).toBe(true);
      expect(canApplyConsumable('the_hanged_man', 'tarot')).toBe(true);
      expect(canApplyConsumable('the_star', 'tarot')).toBe(true);
      expect(canApplyConsumable('the_lovers', 'tarot')).toBe(true);
    });

    it('returns false for non-scoring tarot cards', () => {
      expect(canApplyConsumable('the_hermit', 'tarot')).toBe(false);
      expect(canApplyConsumable('temperance', 'tarot')).toBe(false);
      expect(canApplyConsumable('the_fool', 'tarot')).toBe(false);
      expect(canApplyConsumable('wheel_of_fortune', 'tarot')).toBe(false);
    });

    it('returns true for planet cards', () => {
      expect(canApplyConsumable('jupiter', 'planet')).toBe(true);
      expect(canApplyConsumable('saturn', 'planet')).toBe(true);
      expect(canApplyConsumable('mercury', 'planet')).toBe(true);
    });

    it('returns false for spectral cards', () => {
      expect(canApplyConsumable('grim', 'spectral')).toBe(false);
    });
  });

  describe('applyTarot - Strength', () => {
    it('increases rank of target card by 1', () => {
      const handCards = [card(Rank.Five, Suit.Hearts)];
      const state = defaultState(handCards, []);

      const result = applyTarot('strength', state, [0]);

      expect(result.newState.handCards[0].rank).toBe(Rank.Six);
      expect(result.descriptionZh).toContain('点数');
      expect(result.descriptionZh).toContain('升');
    });

    it('does not increase Ace rank', () => {
      const handCards = [card(Rank.Ace, Suit.Hearts)];
      const state = defaultState(handCards, []);

      const result = applyTarot('strength', state, [0]);

      // Ace stays Ace (no rank above Ace)
      expect(result.newState.handCards[0].rank).toBe(Rank.Ace);
    });

    it('does not mutate original state', () => {
      const handCards = [card(Rank.Five, Suit.Hearts)];
      const state = defaultState(handCards, []);

      applyTarot('strength', state, [0]);

      // Original state unchanged
      expect(state.handCards[0].rank).toBe(Rank.Five);
    });
  });

  describe('applyTarot - Death', () => {
    it('copies donor card onto target card', () => {
      const handCards = [
        card(Rank.Two, Suit.Clubs),
        card(Rank.Ace, Suit.Hearts, CardEnhancement.Steel),
      ];
      const state = defaultState(handCards, []);

      // Copy card #1 (Ace with Steel) onto card #0 (Two Clubs)
      const result = applyTarot('death', state, [0, 1]);

      expect(result.newState.handCards[0].rank).toBe(Rank.Ace);
      expect(result.newState.handCards[0].suit).toBe(Suit.Hearts);
      expect(result.newState.handCards[0].enhancement).toBe(CardEnhancement.Steel);
      // Original ID preserved
      expect(result.newState.handCards[0].id).toBe(handCards[0].id);
      // Donor unchanged
      expect(result.newState.handCards[1].rank).toBe(Rank.Ace);
    });
  });

  describe('applyTarot - Hanged Man', () => {
    it('removes target card from hand', () => {
      const handCards = [
        card(Rank.Two, Suit.Clubs),
        card(Rank.Ace, Suit.Hearts),
      ];
      const state = defaultState(handCards, []);

      const result = applyTarot('the_hanged_man', state, [0]);

      expect(result.newState.handCards.length).toBe(1);
      expect(result.newState.handCards[0].rank).toBe(Rank.Ace);
    });
  });

  describe('applyTarot - Suit Changers', () => {
    it('converts card to target suit', () => {
      const handCards = [card(Rank.King, Suit.Spades)];
      const state = defaultState(handCards, []);

      const result = applyTarot('the_sun', state, [0]); // Sun → Hearts

      expect(result.newState.handCards[0].suit).toBe(Suit.Hearts);
    });

    it('Star converts to Diamonds', () => {
      const handCards = [card(Rank.Queen, Suit.Clubs)];
      const state = defaultState(handCards, []);

      const result = applyTarot('the_star', state, [0]);

      expect(result.newState.handCards[0].suit).toBe(Suit.Diamonds);
    });
  });

  describe('applyTarot - Enhancement Cards', () => {
    it('adds Glass enhancement', () => {
      const handCards = [card(Rank.Ace, Suit.Spades)];
      const state = defaultState(handCards, []);

      const result = applyTarot('justice', state, [0]);

      expect(result.newState.handCards[0].enhancement).toBe(CardEnhancement.Glass);
    });

    it('adds Steel enhancement', () => {
      const handCards = [card(Rank.Queen, Suit.Hearts)];
      const state = defaultState(handCards, []);

      const result = applyTarot('the_chariot', state, [0]);

      expect(result.newState.handCards[0].enhancement).toBe(CardEnhancement.Steel);
    });

    it('adds Wild enhancement', () => {
      const handCards = [card(Rank.Seven, Suit.Spades)];
      const state = defaultState(handCards, []);

      const result = applyTarot('the_lovers', state, [0]);

      expect(result.newState.handCards[0].enhancement).toBe(CardEnhancement.Wild);
    });
  });

  describe('applyTarot - Emperor/Hierophant', () => {
    it('increases hand size by 2', () => {
      const handCards = [card(Rank.Ace, Suit.Spades)];
      const state = defaultState(handCards, []);
      const originalSize = state.roundState.handSize;

      const result = applyTarot('the_emperor', state, []);

      expect(result.newState.roundState.handSize).toBe(originalSize + 2);
    });
  });

  describe('applyPlanet', () => {
    it('levels up the correct hand type', () => {
      const handCards = [card(Rank.Ace, Suit.Spades)];
      const state = defaultState(handCards, []);
      const originalLevel = state.handLevels.flush;

      const result = applyPlanet('jupiter', state);

      expect(result.newState.handLevels.flush).toBe(originalLevel + 1);
      // Other hand types unchanged
      expect(result.newState.handLevels.pair).toBe(state.handLevels.pair);
    });

    it('returns unchanged state for unknown planets', () => {
      const handCards = [card(Rank.Ace, Suit.Spades)];
      const state = defaultState(handCards, []);

      const result = applyPlanet('unknown_planet', state);

      expect(result.newState).toBe(state);
    });
  });

  describe('applyConsumable', () => {
    it('dispatches to applyPlanet for planet type', () => {
      const handCards = [card(Rank.Ace, Suit.Spades)];
      const state = defaultState(handCards, []);
      const consumable: HeldConsumable = { id: 'saturn', type: 'planet' };

      const result = applyConsumable(consumable, state);

      expect(result.newState.handLevels.straight).toBe(state.handLevels.straight + 1);
    });

    it('dispatches to applyTarot for tarot type', () => {
      const handCards = [card(Rank.Five, Suit.Hearts)];
      const state = defaultState(handCards, []);
      const consumable: HeldConsumable = { id: 'strength', type: 'tarot' };

      const result = applyConsumable(consumable, state, [0]);

      expect(result.newState.handCards[0].rank).toBe(Rank.Six);
    });

    it('handles unknown types gracefully', () => {
      const handCards = [card(Rank.Ace, Suit.Spades)];
      const state = defaultState(handCards, []);
      const consumable: HeldConsumable = { id: 'ouija', type: 'spectral' };

      const result = applyConsumable(consumable, state);

      expect(result.newState).toBe(state);
    });
  });

  describe('getTarotTargetSuggestions', () => {
    it('returns non-target-suit cards for suit changers', () => {
      const handCards = [
        card(Rank.Ace, Suit.Spades),
        card(Rank.King, Suit.Hearts),
        card(Rank.Queen, Suit.Hearts),
      ];
      const state = defaultState(handCards, []);

      const suggestions = getTarotTargetSuggestions('the_sun', state, 3);

      // Sun → Hearts. Should target non-Hearts cards
      expect(suggestions.length).toBeGreaterThan(0);
      for (const s of suggestions) {
        const targetCard = handCards[s[0]];
        expect(targetCard.suit).not.toBe(Suit.Hearts);
      }
    });

    it('returns unenhanced cards for enhancement tarots', () => {
      const handCards = [
        card(Rank.Ace, Suit.Spades),
        card(Rank.King, Suit.Hearts, CardEnhancement.Glass),
        card(Rank.Queen, Suit.Diamonds),
      ];
      const state = defaultState(handCards, []);

      const suggestions = getTarotTargetSuggestions('justice', state, 3);

      for (const s of suggestions) {
        const targetCard = handCards[s[0]];
        expect(targetCard.enhancement).toBe(CardEnhancement.None);
      }
    });

    it('returns non-Ace cards for Strength', () => {
      const handCards = [
        card(Rank.Ace, Suit.Spades),
        card(Rank.Five, Suit.Hearts),
        card(Rank.Ten, Suit.Clubs),
      ];
      const state = defaultState(handCards, []);

      const suggestions = getTarotTargetSuggestions('strength', state, 3);

      for (const s of suggestions) {
        const targetCard = handCards[s[0]];
        expect(targetCard.rank).not.toBe(Rank.Ace);
      }
    });
  });
});
