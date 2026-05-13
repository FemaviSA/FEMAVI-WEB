import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { QuoteRequest } from '../types/product';

type RealtimeEvent =
  | { type: 'INSERT'; quote: QuoteRequest }
  | { type: 'UPDATE'; quote: QuoteRequest; old: QuoteRequest | null }
  | { type: 'DELETE'; old: QuoteRequest };

/**
 * Subscribe to realtime changes on quote_requests.
 * RLS ya restringe los cambios al admin (allowlist por email), así que esto solo
 * funciona cuando el admin está logueado.
 *
 * Nota importante: Supabase Realtime usa una conexión websocket persistente.
 * El channel name debe ser único por suscripción para evitar colisiones cuando
 * varios componentes se suscriben al mismo tiempo.
 */
export function useQuotesRealtime(onEvent: (event: RealtimeEvent) => void, channelKey?: string) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const channelName = `quote_requests:${channelKey ?? 'default'}:${Math.random().toString(36).slice(2, 8)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'quote_requests' },
        (payload: any) => {
          const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          if (eventType === 'INSERT') {
            onEventRef.current({ type: 'INSERT', quote: payload.new as QuoteRequest });
          } else if (eventType === 'UPDATE') {
            onEventRef.current({
              type: 'UPDATE',
              quote: payload.new as QuoteRequest,
              old: (payload.old as QuoteRequest) ?? null,
            });
          } else if (eventType === 'DELETE') {
            onEventRef.current({ type: 'DELETE', old: payload.old as QuoteRequest });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelKey]);
}
