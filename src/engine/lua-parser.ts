/**
 * Lightweight Lua Table to JSON Parser (Zero-Dependency).
 *
 * Converts Balatro's Lua-serialized table text (e.g. `return { ... }`)
 * into plain JavaScript objects via a pure-TypeScript recursive descent parser.
 * No third-party Lua runtime required.
 *
 * Supported value types: string, number, boolean (true/false), nil → null, nested tables.
 * Supported key formats: ["string"], [number], bareword = value, implicit array index.
 */

// ─── Error types ──────────────────────────────────────────────────

export class LuaParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LuaParseError';
  }
}

// ─── Token types ──────────────────────────────────────────────────

type LuaToken =
  | { type: 'RETURN' }
  | { type: 'LBRACE' }
  | { type: 'RBRACE' }
  | { type: 'LBRACKET' }
  | { type: 'RBRACKET' }
  | { type: 'EQUALS' }
  | { type: 'COMMA' }
  | { type: 'STRING'; value: string }
  | { type: 'NUMBER'; value: number }
  | { type: 'IDENTIFIER'; value: string };

// ─── Convenience API ──────────────────────────────────────────────

export function parseLuaTableToJSON(luaText: string): any {
  const parser = new LuaParser(luaText);
  return parser.parseRoot();
}

// ─── Parser ───────────────────────────────────────────────────────

export class LuaParser {
  private pos = 0;
  private tokens: LuaToken[];

  constructor(input: string) {
    this.tokens = this.tokenize(input);
  }

  // ── Tokenizer ──────────────────────────────────────────────────

  private tokenize(input: string): LuaToken[] {
    const tokens: LuaToken[] = [];
    let i = 0;

    while (i < input.length) {
      const ch = input[i];

      // Whitespace
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
        i++;
        continue;
      }

      // String literals
      if (ch === '"' || ch === "'") {
        const quote = ch;
        let str = '';
        i++; // skip opening quote
        while (i < input.length) {
          if (input[i] === '\\' && i + 1 < input.length) {
            i++;
            const escaped = input[i];
            switch (escaped) {
              case 'n': str += '\n'; break;
              case 't': str += '\t'; break;
              case 'r': str += '\r'; break;
              case '\\': str += '\\'; break;
              case '"': str += '"'; break;
              case "'": str += "'"; break;
              default: str += escaped; break;
            }
            i++;
          } else if (input[i] === quote) {
            i++; // skip closing quote
            break;
          } else {
            str += input[i];
            i++;
          }
        }
        tokens.push({ type: 'STRING', value: str });
        continue;
      }

      // Numbers (including floats and negatives)
      if (
        ch === '-' && i + 1 < input.length && isDigit(input[i + 1]) ||
        isDigit(ch)
      ) {
        let numStr = '';
        if (ch === '-') { numStr += '-'; i++; }
        while (i < input.length && isDigit(input[i])) {
          numStr += input[i++];
        }
        if (i < input.length && input[i] === '.') {
          numStr += '.';
          i++;
          while (i < input.length && isDigit(input[i])) {
            numStr += input[i++];
          }
        }
        if (i < input.length && (input[i] === 'e' || input[i] === 'E')) {
          numStr += input[i++];
          if (input[i] === '+' || input[i] === '-') numStr += input[i++];
          while (i < input.length && isDigit(input[i])) numStr += input[i++];
        }
        tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
        continue;
      }

      // Single-character tokens
      if (ch === '{') { tokens.push({ type: 'LBRACE' }); i++; continue; }
      if (ch === '}') { tokens.push({ type: 'RBRACE' }); i++; continue; }
      if (ch === '[') { tokens.push({ type: 'LBRACKET' }); i++; continue; }
      if (ch === ']') { tokens.push({ type: 'RBRACKET' }); i++; continue; }
      if (ch === '=') { tokens.push({ type: 'EQUALS' }); i++; continue; }
      if (ch === ',') { tokens.push({ type: 'COMMA' }); i++; continue; }

      // Identifiers (return, true, false, nil, bare words)
      if (isAlpha(ch) || ch === '_') {
        let word = '';
        while (i < input.length && (isAlphaNum(input[i]) || input[i] === '_')) {
          word += input[i++];
        }
        if (word === 'return') {
          tokens.push({ type: 'RETURN' });
        } else {
          tokens.push({ type: 'IDENTIFIER', value: word });
        }
        continue;
      }

      // Unknown character → skip
      i++;
    }

    return tokens;
  }

  // ── Recursive Descent Parser ────────────────────────────────────

  parseRoot(): unknown {
    const ret = this.consume('RETURN');
    if (!ret) throw new LuaParseError("LuaParseError: Expected 'return' at start of input");
    return this.parseValue();
  }

  private parseValue(): unknown {
    const tok = this.peek();
    if (!tok) throw new LuaParseError('LuaParseError: Unexpected end of input');

    switch (tok.type) {
      case 'STRING':
        this.advance();
        return tok.value;
      case 'NUMBER':
        this.advance();
        return tok.value;
      case 'IDENTIFIER': {
        const val = tok.value;
        this.advance();
        if (val === 'true') return true;
        if (val === 'false') return false;
        if (val === 'nil') return null;
        return val; // bare identifier → string
      }
      case 'LBRACE':
        return this.parseTable();
      default:
        throw new LuaParseError(`LuaParseError: Unexpected token '${tok.type}'`);
    }
  }

  private parseTable(): Record<string | number, unknown> {
    this.consume('LBRACE');
    const result: Record<string | number, unknown> = {};

    // Empty table
    if (this.peek()?.type === 'RBRACE') {
      this.advance();
      return result;
    }

    let nextArrayIndex = 1;

    while (true) {
      const tok = this.peek();
      if (!tok) throw new LuaParseError('LuaParseError: Unterminated table (missing "}")');
      if (tok.type === 'RBRACE') break;

      // Parse key
      let key: string | number;
      const explicitKey = this.tryParseKey();
      if (explicitKey !== undefined) {
        key = explicitKey;
        this.consume('EQUALS');
      } else {
        // Implicit numeric key (array-style)
        key = nextArrayIndex;
      }

      // Parse value
      const value = this.parseValue();
      result[key] = value;

      // Track next implicit index
      if (typeof key === 'number' && key >= nextArrayIndex) {
        nextArrayIndex = key + 1;
      }

      // Optional comma or semicolon
      if (this.peek()?.type === 'COMMA') {
        this.advance();
      }
      // Trailing comma/semicolon before '}' is allowed
    }

    this.consume('RBRACE');
    return result;
  }

  /**
   * Try to parse an explicit key: ["str"] or [num] or identifier.
   * Returns undefined if no explicit key present (implicit array index).
   */
  private tryParseKey(): string | number | undefined {
    const tok = this.peek();
    if (!tok) return undefined;

    // Bracket key: ["str"] or [num]
    if (tok.type === 'LBRACKET') {
      this.advance();
      const inner = this.peek();
      if (!inner) throw new LuaParseError('LuaParseError: Expected key inside brackets');

      let key: string | number;
      if (inner.type === 'STRING') {
        key = inner.value;
        this.advance();
      } else if (inner.type === 'NUMBER') {
        key = inner.value;
        this.advance();
      } else {
        throw new LuaParseError(`LuaParseError: Unexpected token inside brackets: ${inner.type}`);
      }

      this.consume('RBRACKET');
      return key;
    }

    // Identifier key: bareword = value
    if (tok.type === 'IDENTIFIER') {
      const next = this.peekAhead(1);
      if (next?.type === 'EQUALS') {
        const val = tok.value;
        this.advance();
        return val;
      }
    }

    return undefined;
  }

  // ── Token stream helpers ───────────────────────────────────────

  private peek(): LuaToken | undefined {
    return this.tokens[this.pos];
  }

  private peekAhead(offset: number): LuaToken | undefined {
    return this.tokens[this.pos + offset];
  }

  private advance(): LuaToken {
    const tok = this.tokens[this.pos++];
    if (!tok) throw new LuaParseError('LuaParseError: Unexpected end of input');
    return tok;
  }

  private consume(type: LuaToken['type']): LuaToken | null {
    const tok = this.peek();
    if (tok?.type === type) {
      this.advance();
      return tok;
    }
    return null;
  }
}

// ─── Character classifiers ───────────────────────────────────────

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isAlpha(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

function isAlphaNum(ch: string): boolean {
  return isAlpha(ch) || isDigit(ch);
}
