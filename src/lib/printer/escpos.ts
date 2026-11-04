/**
 * ESC/POS Thermal Printer Protocol Encoder
 * Supports 80mm (48/42 columns) and 58mm (32 columns) thermal receipt printers.
 * Emits raw binary Uint8Array commands compatible with Epson, TVS, Star, Rongta, Xprinter, NGX.
 */

export type PaperWidth = '80mm' | '58mm';

export interface EscPosOptions {
  width?: PaperWidth;
  characterSet?: 'PC437' | 'WPC1252';
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private textBuffer: string = '';
  private currentAlignment: 'left' | 'center' | 'right' = 'left';
  private cols: number;

  constructor(options: EscPosOptions = {}) {
    this.cols = options.width === '58mm' ? 32 : 48;
    this.init();
  }

  /** Initialize printer to default settings */
  init(): this {
    this.buffer.push(0x1b, 0x40); // ESC @
    this.currentAlignment = 'left';
    return this;
  }

  /** Set text alignment: 'left' | 'center' | 'right' */
  align(alignment: 'left' | 'center' | 'right'): this {
    this.currentAlignment = alignment;
    const val = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, val); // ESC a n
    return this;
  }

  /** Set bold text */
  bold(enable: boolean = true): this {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0); // ESC E n
    return this;
  }

  /** Set text size: 1 = normal, 2 = double, 3 = triple */
  size(widthMultiplier: 1 | 2 | 3 = 1, heightMultiplier: 1 | 2 | 3 = 1): this {
    const w = Math.max(0, Math.min(2, widthMultiplier - 1));
    const h = Math.max(0, Math.min(2, heightMultiplier - 1));
    const val = (w << 4) | h;
    this.buffer.push(0x1d, 0x21, val); // GS ! n
    return this;
  }

  /** Inverted text (white on black) */
  invert(enable: boolean = true): this {
    this.buffer.push(0x1d, 0x42, enable ? 1 : 0); // GS B n
    return this;
  }

  /** Underline text */
  underline(enable: boolean = true): this {
    this.buffer.push(0x1b, 0x2d, enable ? 1 : 0); // ESC - n
    return this;
  }

  /** Append text */
  text(str: string): this {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 128) {
        this.buffer.push(code);
      } else if (code === 8377) {
        // Indian Rupee symbol ₹ -> fallback to 'Rs.'
        this.buffer.push(82, 115, 46); // 'Rs.'
      } else {
        this.buffer.push(0x3f); // '?'
      }
    }
    return this;
  }

  /** Append a line of text formatted with alignment */
  line(str: string = ''): this {
    if (str) {
      this.text(str);
      // Plain text representation formatted according to alignment
      if (this.currentAlignment === 'center') {
        const pad = Math.max(0, Math.floor((this.cols - str.length) / 2));
        this.textBuffer += ' '.repeat(pad) + str + '\n';
      } else if (this.currentAlignment === 'right') {
        const pad = Math.max(0, this.cols - str.length);
        this.textBuffer += ' '.repeat(pad) + str + '\n';
      } else {
        this.textBuffer += str + '\n';
      }
    } else {
      this.textBuffer += '\n';
    }
    this.buffer.push(0x0a); // LF
    return this;
  }

  /** Feed N blank lines */
  feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
      this.textBuffer += '\n';
    }
    return this;
  }

  /** Print a horizontal divider rule */
  divider(char: string = '-'): this {
    const fill = char.charAt(0).repeat(this.cols);
    this.text(fill);
    this.buffer.push(0x0a);
    this.textBuffer += fill + '\n';
    return this;
  }

  /** Print two columns spaced to edges: Left and Right aligned */
  row(left: string, right: string): this {
    const maxChars = this.cols;
    const spaceNeeded = maxChars - (left.length + right.length);
    let lineStr = '';
    if (spaceNeeded <= 0) {
      lineStr = `${left}\n${' '.repeat(Math.max(0, maxChars - right.length))}${right}`;
    } else {
      lineStr = left + ' '.repeat(spaceNeeded) + right;
    }

    this.text(lineStr);
    this.buffer.push(0x0a);
    this.textBuffer += lineStr + '\n';
    return this;
  }

  /** Print 3 columns: Item, Qty, Price */
  itemRow(name: string, qty: string, price: string): this {
    let lineStr = '';
    if (this.cols === 32) {
      // 58mm: Name (18 chars), Qty (4 chars), Price (10 chars)
      const n = name.padEnd(18).slice(0, 18);
      const q = qty.padStart(4).slice(-4);
      const p = price.padStart(10).slice(-10);
      lineStr = `${n}${q}${p}`;
    } else {
      // 80mm: Name (28 chars), Qty (6 chars), Price (14 chars)
      const n = name.padEnd(28).slice(0, 28);
      const q = qty.padStart(6).slice(-6);
      const p = price.padStart(14).slice(-14);
      lineStr = `${n}${q}${p}`;
    }

    this.text(lineStr);
    this.buffer.push(0x0a);
    this.textBuffer += lineStr + '\n';
    return this;
  }

  /** Kick open cash drawer (standard RJ11 pin 2 pulse) */
  cashDrawer(): this {
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa); // ESC p 0 25 250
    return this;
  }

  /** Print a native ESC/POS QR code */
  qrCode(data: string, moduleSize: number = 4): this {
    // Model 2
    this.buffer.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // Size
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.min(8, Math.max(1, moduleSize)));
    // Error correction Level L
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30);
    // Store data
    const len = data.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);
    this.buffer.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data.charCodeAt(i));
    }
    // Print symbol
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    this.feed(1);
    return this;
  }

  /** Cut paper (partial or full) */
  cut(full: boolean = false): this {
    this.feed(2);
    this.buffer.push(0x1d, 0x56, full ? 0x00 : 0x01); // GS V n
    return this;
  }

  /** Return the raw Uint8Array buffer ready for USB / LAN transport */
  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /** Return the clean, human-readable plain text preview without any control chars */
  toPlainText(): string {
    return this.textBuffer.trimEnd() + '\n';
  }
}
