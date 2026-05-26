// ─── Import all joker categories to trigger registration ──────
import './chips';
import './plus-mult';
import './xmult';
import './retrigger';
import './effect';
import './economy';

// ─── Re-export registry functions ──────────────────────────────
export {
  getJoker,
  getAllJokers,
  getJokersByCategory,
  registerJoker,
} from './registry';

export function initJokerRegistry(): void {
  // All jokers are registered via side-effect imports above when this module loads.
}
