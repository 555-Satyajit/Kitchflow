'use client';

/**
 * Universal Hardware Printer Service
 * Connects directly to ESC/POS thermal printers via:
 * 1. WebUSB (zero-dialog, instant <200ms printing on Chrome/Edge/Android)
 * 2. Web Bluetooth (mobile wireless thermal printers)
 * 3. Network / LAN / Local Bridge (TCP port 9100 relay)
 * 4. High-Fidelity Browser Thermal CSS Fallback
 */

import type { PaperWidth } from './escpos';
export type { PaperWidth };

export type PrinterTransport = 'webusb' | 'bluetooth' | 'network' | 'browser';

export interface PrinterDeviceConfig {
  transport: PrinterTransport;
  networkIp?: string;
  networkPort?: number;
  paperWidth?: '80mm' | '58mm';
}

class PrinterService {
  private activeUsbDevice: any | null = null;
  private activeUsbEndpoint: number | null = null;
  private printQueue: Promise<boolean> = Promise.resolve(true);
  private config: PrinterDeviceConfig = {
    transport: 'browser',
    paperWidth: '80mm',
  };

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('kitchenos_printer_config');
        if (stored) {
          this.config = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Failed to parse stored printer configuration', e);
      }
    }
  }

  public getConfig(): PrinterDeviceConfig {
    return { ...this.config };
  }

  public setConfig(newConfig: Partial<PrinterDeviceConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (typeof window !== 'undefined') {
      localStorage.setItem('kitchenos_printer_config', JSON.stringify(this.config));
    }
  }

  /**
   * Request WebUSB device pairing from user
   */
  public async requestUsbDevice(): Promise<boolean> {
    if (typeof window === 'undefined' || !(navigator as any).usb) {
      throw new Error('WebUSB is not supported in this browser. Please use Google Chrome or Edge.');
    }

    try {
      // Prompt user to pick USB printer
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      await device.open();
      await device.selectConfiguration(1);

      // Find bulk OUT endpoint for raw print commands
      let outEndpoint = null;
      for (const iface of device.configuration.interfaces) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.direction === 'out' && ep.type === 'bulk') {
              await device.claimInterface(iface.interfaceNumber);
              outEndpoint = ep.endpointNumber;
              break;
            }
          }
          if (outEndpoint !== null) break;
        }
        if (outEndpoint !== null) break;
      }

      this.activeUsbDevice = device;
      this.activeUsbEndpoint = outEndpoint;
      this.setConfig({ transport: 'webusb' });
      return true;
    } catch (err) {
      console.error('WebUSB pairing failed:', err);
      throw err;
    }
  }

  /**
   * Sequential Thermal Print Queue wrapper
   * Guarantees tickets fire one after another with an exact 150ms paper-feed delay,
   * completely preventing buffer choke when multiple orders sync simultaneously.
   */
  public enqueuePrint(job: () => Promise<boolean>): Promise<boolean> {
    return new Promise((resolve) => {
      this.printQueue = this.printQueue.then(async () => {
        try {
          const success = await job();
          // 150ms buffer to allow thermal printer cutter and buffer to settle
          await new Promise((r) => setTimeout(r, 150));
          resolve(success);
          return success;
        } catch (err) {
          console.error('[Printer Queue] Hardware transfer failed:', err);
          resolve(false);
          return false;
        }
      });
    });
  }

  /**
   * Send raw binary ESC/POS bytes directly to printer, or render high-fidelity HTML print
   * Automatically executes through the sequential hardware buffer queue.
   */
  public printRaw(
    bytes: Uint8Array, 
    fallbackPlainText: string,
    htmlContent?: string
  ): Promise<boolean> {
    return this.enqueuePrint(() => this.executeHardwareTransfer(bytes, fallbackPlainText, htmlContent));
  }

  private async executeHardwareTransfer(
    bytes: Uint8Array, 
    fallbackPlainText: string,
    htmlContent?: string
  ): Promise<boolean> {
    const transport = this.config.transport;

    // 1. Try WebUSB
    if (transport === 'webusb' && this.activeUsbDevice && this.activeUsbEndpoint !== null) {
      try {
        await this.activeUsbDevice.transferOut(this.activeUsbEndpoint, bytes);
        return true;
      } catch (err) {
        console.warn('WebUSB transfer failed, falling back to browser print:', err);
      }
    }

    // 2. Try Network Relay (e.g. localhost:9100 print daemon)
    if (transport === 'network' && this.config.networkIp) {
      try {
        const port = this.config.networkPort || 9100;
        const res = await fetch(`http://${this.config.networkIp}:${port}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: new Blob([bytes.buffer as ArrayBuffer]),
        });
        if (res.ok) return true;
      } catch (err) {
        console.warn('Network print relay failed:', err);
      }
    }

    // 3. High-Fidelity Browser Thermal Print Fallback
    if (htmlContent) {
      return this.printHtml(htmlContent, this.config.paperWidth || '80mm');
    }
    return this.printViaBrowserThermal(fallbackPlainText, this.config.paperWidth || '80mm');
  }

  /**
   * Print high-fidelity HTML receipt with custom fonts, clean tables, and embedded QR code
   */
  public printHtml(htmlBody: string, width: '80mm' | '58mm' = '80mm'): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        resolve(false);
        return;
      }

      const paperWidthVal = width === '58mm' ? '58mm' : '80mm';
      const bodyWidthVal = width === '58mm' ? '54mm' : '74mm';

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt Print</title>
            <style>
              @page {
                size: ${paperWidthVal} auto;
                margin: 2mm 0mm;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              body {
                width: ${bodyWidthVal};
                margin: 0 auto;
                padding: 4mm 2mm;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: ${width === '58mm' ? '10px' : '11px'};
                line-height: 1.35;
                color: #000;
                background: #fff;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .uppercase { text-transform: uppercase; }
              .font-black { font-weight: 900; }
              .font-bold { font-weight: 700; }
              .font-semibold { font-weight: 600; }
              .font-medium { font-weight: 500; }
              .font-mono { font-family: monospace, -apple-system, sans-serif; }
              
              .flex { display: flex; }
              .flex-col { display: flex; flex-direction: column; }
              .items-center { align-items: center; }
              .items-baseline { align-items: baseline; }
              .justify-between { justify-content: space-between; }
              .justify-center { justify-content: center; }
              
              .border-b { border-bottom: 1px dashed #555; }
              .border-t { border-top: 1px dashed #555; }
              .border-b-2 { border-bottom: 2px solid #000; }
              .border-dashed { border-style: dashed; }
              .border { border: none !important; } /* Eliminate box frames on paper */
              .border-zinc-300, .border-zinc-200 { border-color: #555; }
              
              .space-y-0\\.5 > * + * { margin-top: 2px; }
              .space-y-1 > * + * { margin-top: 3px; }
              .space-y-1\\.5 > * + * { margin-top: 4px; }
              .space-y-2 > * + * { margin-top: 6px; }
              .space-y-3 > * + * { margin-top: 8px; }
              
              .pb-2 { padding-bottom: 5px; }
              .pb-3 { padding-bottom: 8px; }
              .pt-1 { padding-top: 3px; }
              .pt-2 { padding-top: 6px; }
              .my-3 { margin-top: 8px; margin-bottom: 8px; }
              .mt-1 { margin-top: 3px; }
              .ml-2 { margin-left: 6px; }
              
              .gap-2 { gap: 6px; }
              .gap-4 { gap: 12px; }
              .w-6 { width: 22px; text-align: center; }
              .w-14 { width: 55px; text-align: right; }
              .w-24 { width: 90px; }
              .h-24 { height: 90px; }
              .truncate { white-space: normal; }
              
              .rounded { border-radius: 3px; }
              .bg-zinc-100 { background: #eee; padding: 1px 4px; }
              .bg-emerald-100 { background: #eee; color: #000; padding: 2px 6px; border-radius: 3px; }
              .bg-orange-100 { background: #eee; color: #000; padding: 2px 6px; border-radius: 3px; }
              
              img {
                display: block;
                margin: 0 auto;
                width: 90px;
                height: 90px;
              }
              
              @media print {
                body {
                  margin: 0 auto;
                  padding: 2mm 1mm;
                }
              }
            </style>
          </head>
          <body>${htmlBody}</body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          resolve(true);
        }, 1000);
      }, 250);
    });
  }

  /**
   * Browser Thermal Print fallback using a dynamic print iframe
   * Formatted to exact 80mm / 58mm width with mono-spaced receipt styling
   */
  public printViaBrowserThermal(plainText: string, width: '80mm' | '58mm' = '80mm'): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        resolve(false);
        return;
      }

      const paperPx = width === '58mm' ? '58mm' : '80mm';

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Kitchen Receipt</title>
            <style>
              @page {
                size: ${paperPx} auto;
                margin: 0mm;
              }
              body {
                margin: 0;
                padding: 4mm;
                font-family: 'Courier New', Courier, monospace;
                font-size: ${width === '58mm' ? '11px' : '12px'};
                font-weight: 700;
                line-height: 1.25;
                color: #000;
                background: #fff;
                white-space: pre-wrap;
                word-break: break-all;
              }
              @media print {
                body {
                  margin: 0;
                  padding: 2mm;
                }
              }
            </style>
          </head>
          <body>${plainText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          resolve(true);
        }, 1000);
      }, 250);
    });
  }
}

export const printerService = new PrinterService();
