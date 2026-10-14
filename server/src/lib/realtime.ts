import type { Response } from 'express';

/** Gestisce i client SSE collegati e invia loro le variazioni di revision. */
export class RealtimeHub {
  private clients = new Set<Response>();

  get size(): number {
    return this.clients.size;
  }

  add(res: Response): void {
    this.clients.add(res);
  }

  remove(res: Response): void {
    this.clients.delete(res);
  }

  broadcast(revision: number): void {
    const payload = `event: changed\ndata: ${JSON.stringify({ revision })}\n\n`;
    for (const res of this.clients) {
      try {
        res.write(payload);
      } catch {
        this.clients.delete(res);
      }
    }
  }

  heartbeat(): void {
    for (const res of this.clients) {
      try {
        res.write(': ping\n\n');
      } catch {
        this.clients.delete(res);
      }
    }
  }

  closeAll(): void {
    for (const res of this.clients) {
      try {
        res.end();
      } catch {
        // ignora
      }
    }
    this.clients.clear();
  }
}
