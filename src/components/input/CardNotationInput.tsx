import { useState, useCallback } from 'react';
import { useI18n } from '../../i18n/context';
import { parseCardNotations, getNotationCheatSheet } from '../../engine/card-parser';
import type { Card } from '../../engine/types';

interface CardNotationInputProps {
  onParse: (cards: Card[]) => void;
}

export function CardNotationInput({ onParse }: CardNotationInputProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleParse = useCallback(() => {
    const cards = parseCardNotations(text);
    if (cards.length > 0) {
      onParse(cards);
      setErrors([]);
    } else if (text.trim()) {
      setErrors([t.notation.errors.invalidFormat]);
    }
  }, [text, onParse, t]);

  const cheatSheet = getNotationCheatSheet();

  return (
    <div className="card-notation">
      <textarea
        className="card-notation__input"
        value={text}
        onChange={e => { setText(e.target.value); setErrors([]); }}
        placeholder={t.notation.placeholder}
        rows={6}
        spellCheck={false}
      />

      {errors.length > 0 && (
        <div className="card-notation__errors">
          {errors.map((e, i) => <span key={i}>{e}</span>)}
        </div>
      )}

      <div className="card-notation__actions">
        <button className="card-notation__parse-btn" onClick={handleParse}>
          {t.notation.parse}
        </button>
        <span className="card-notation__mult-hint">{t.notation.multiplierHint}</span>
      </div>

      <button
        className="card-notation__cheat-toggle"
        onClick={() => setShowCheatSheet(!showCheatSheet)}
      >
        {showCheatSheet ? '▼' : '▶'} {t.notation.cheatSheet}
      </button>

      {showCheatSheet && (
        <div className="notation-cheat-sheet">
          <p className="notation-cheat-sheet__desc">{t.notation.cheatSheetDesc}</p>

          <div className="notation-cheat-sheet__grid">
            {/* Ranks */}
            <div className="notation-cheat-sheet__col">
              <h4>{t.notation.rankLabel}</h4>
              <table className="notation-cheat-sheet__table">
                <tbody>
                  {cheatSheet.ranks.map(r => (
                    <tr key={r.code}>
                      <td className="notation-code">{r.code}</td>
                      <td className="notation-label">{r.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Suits */}
            <div className="notation-cheat-sheet__col">
              <h4>{t.notation.suitLabel}</h4>
              <table className="notation-cheat-sheet__table">
                <tbody>
                  {cheatSheet.suits.map(s => (
                    <tr key={s.code}>
                      <td className="notation-code">{s.code}</td>
                      <td className="notation-label">{s.symbol} {s.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Enhancements */}
            <div className="notation-cheat-sheet__col">
              <h4>{t.notation.enhLabel}</h4>
              <table className="notation-cheat-sheet__table">
                <tbody>
                  {cheatSheet.enhancements.map(e => (
                    <tr key={e.code}>
                      <td className="notation-code">{e.code}</td>
                      <td className="notation-label">{e.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Editions */}
            <div className="notation-cheat-sheet__col">
              <h4>{t.notation.ediLabel}</h4>
              <table className="notation-cheat-sheet__table">
                <tbody>
                  {cheatSheet.editions.map(e => (
                    <tr key={e.code}>
                      <td className="notation-code">{e.code}</td>
                      <td className="notation-label">{e.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Seals */}
            <div className="notation-cheat-sheet__col">
              <h4>{t.notation.sealLabel}</h4>
              <table className="notation-cheat-sheet__table">
                <tbody>
                  {cheatSheet.seals.map(s => (
                    <tr key={s.code}>
                      <td className="notation-code">{s.code}</td>
                      <td className="notation-label">{s.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Examples */}
            <div className="notation-cheat-sheet__col">
              <h4>{t.notation.exampleColumn}</h4>
              <table className="notation-cheat-sheet__table">
                <tbody>
                  <tr><td className="notation-code">ah</td><td className="notation-label">Ace of Hearts</td></tr>
                  <tr><td className="notation-code">10s</td><td className="notation-label">10 of Spades</td></tr>
                  <tr><td className="notation-code">kd.g</td><td className="notation-label">King Diamonds + Glass</td></tr>
                  <tr><td className="notation-code">jh..f</td><td className="notation-label">Jack Hearts + Foil</td></tr>
                  <tr><td className="notation-code">qc...r</td><td className="notation-label">Queen Clubs + Red seal</td></tr>
                  <tr><td className="notation-code">as.b.f.r</td><td className="notation-label">All three modifiers</td></tr>
                  <tr><td className="notation-code">3*ah</td><td className="notation-label">3 copies</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
