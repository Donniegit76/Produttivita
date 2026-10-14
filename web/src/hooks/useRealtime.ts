import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * Canale realtime: SSE con riconnessione automatica del browser, più un
 * polling leggero ogni 30 s come rete di sicurezza per i telefoni che
 * sospendono la connessione in background.
 */
export function useRealtime(revision: number, onRevision: (revision: number) => void): boolean {
  const [connected, setConnected] = useState(true);
  const revisionRef = useRef(revision);
  const handlerRef = useRef(onRevision);

  revisionRef.current = revision;
  handlerRef.current = onRevision;

  useEffect(() => {
    const source = new EventSource('/api/events', { withCredentials: true });

    source.addEventListener('changed', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { revision?: number };
        if (typeof data.revision === 'number') {
          handlerRef.current(data.revision);
        }
      } catch {
        // evento non valido: ignora
      }
    });
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    const poll = window.setInterval(() => {
      api
        .revision()
        .then(({ revision: remote }) => {
          setConnected(true);
          if (remote !== revisionRef.current) handlerRef.current(remote);
        })
        .catch(() => setConnected(false));
    }, 30_000);

    return () => {
      source.close();
      window.clearInterval(poll);
    };
  }, []);

  return connected;
}
