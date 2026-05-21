import { buildAuthHeaders, refreshStoredTokens } from './client';
import { buildApiUrl } from './config';
import type { SpaceEvent } from './types';

export type SpaceEventConnection = {
  close: () => void;
};

export type SpaceEventConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed';

type OpenSpaceEventStreamOptions = {
  onEvent: (event: SpaceEvent) => void;
  onError?: (error: Error) => void;
  onConnectionState?: (state: SpaceEventConnectionState) => void;
  initialRetryMs?: number;
  maxRetryMs?: number;
};

export function openSpaceEventStream(spaceId: string, options: OpenSpaceEventStreamOptions): SpaceEventConnection {
  const controller = new AbortController();
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let lastEventId = '';
  let retryMs = options.initialRetryMs ?? 3000;
  const maxRetryMs = options.maxRetryMs ?? 15000;

  const waitBeforeReconnect = () =>
    new Promise<void>((resolve) => {
      reconnectTimer = setTimeout(resolve, Math.min(retryMs, maxRetryMs));
    });

  const connectLoop = async () => {
    let reconnecting = false;
    while (!controller.signal.aborted) {
      options.onConnectionState?.(reconnecting ? 'reconnecting' : 'connecting');
      try {
        const result = await readSpaceEvents(spaceId, controller.signal, options, lastEventId);
        lastEventId = result.lastEventId || lastEventId;
        retryMs = result.retryMs ?? retryMs;
      } catch (error) {
        if (!controller.signal.aborted) {
          options.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      }

      if (controller.signal.aborted) {
        break;
      }
      reconnecting = true;
      await waitBeforeReconnect();
      retryMs = Math.min(Math.round(retryMs * 1.5), maxRetryMs);
    }
    options.onConnectionState?.('closed');
  };

  void connectLoop();

  return {
    close: () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      controller.abort();
    },
  };
}

async function readSpaceEvents(
  spaceId: string,
  signal: AbortSignal,
  options: OpenSpaceEventStreamOptions,
  lastEventId: string,
): Promise<{ lastEventId: string; retryMs?: number }> {
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    ...(await buildAuthHeaders()),
  };
  if (lastEventId) {
    headers['Last-Event-ID'] = lastEventId;
  }

  let response = await fetch(buildApiUrl(`/spaces/${spaceId}/events`), {
    headers,
    signal,
  });

  if (response.status === 401) {
    const refreshed = await refreshStoredTokens();
    if (refreshed) {
      response = await fetch(buildApiUrl(`/spaces/${spaceId}/events`), {
        headers: {
          ...headers,
          ...(await buildAuthHeaders()),
        },
        signal,
      });
    }
  }

  if (!response.ok) {
    throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
  }

  options.onConnectionState?.('open');
  let latestEventId = lastEventId;
  let latestRetryMs: number | undefined;
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Current runtime does not expose fetch streaming for SSE.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.rest;
    parsed.events.forEach((event) => {
      if (event.id) {
        latestEventId = event.id;
      }
      if (event.retryMs) {
        latestRetryMs = event.retryMs;
      }
      options.onEvent(event);
    });
  }
  return { lastEventId: latestEventId, retryMs: latestRetryMs };
}

type ParsedSpaceEvent = SpaceEvent & {
  retryMs?: number;
};

function parseSseBuffer(input: string): { events: ParsedSpaceEvent[]; rest: string } {
  const normalized = input.replace(/\r\n/g, '\n');
  const events: SpaceEvent[] = [];
  let rest = normalized;
  let boundary = rest.indexOf('\n\n');

  while (boundary >= 0) {
    const rawEvent = rest.slice(0, boundary);
    rest = rest.slice(boundary + 2);
    const event = parseSseEvent(rawEvent);
    if (event) {
      events.push(event);
    }
    boundary = rest.indexOf('\n\n');
  }

  return { events, rest };
}

function parseSseEvent(rawEvent: string): ParsedSpaceEvent | null {
  let id = '';
  let event = 'message';
  let retryMs: number | undefined;
  const dataLines: string[] = [];

  rawEvent.split('\n').forEach((line) => {
    if (!line || line.startsWith(':')) {
      return;
    }
    const separator = line.indexOf(':');
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const rawValue = separator >= 0 ? line.slice(separator + 1) : '';
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

    if (field === 'id') {
      id = value;
    } else if (field === 'event') {
      event = value;
    } else if (field === 'data') {
      dataLines.push(value);
    } else if (field === 'retry') {
      const parsedRetry = Number(value);
      retryMs = Number.isFinite(parsedRetry) ? parsedRetry : undefined;
    }
  });

  if (!event && dataLines.length === 0) {
    return null;
  }

  const rawData = dataLines.join('\n') || '{}';
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawData) as Record<string, unknown>;
  } catch {
    data = { value: rawData };
  }

  return { id, event, data, retryMs };
}
