import WebSocket from 'ws';
import { RunEvent } from '../types';

/**
 * Converts an http(s) URL to a ws(s) URL.
 * "http://" → "ws://", "https://" → "wss://"
 */
function toWsUrl(studioUrl: string): string {
  return studioUrl
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://');
}

/**
 * Opens a WebSocket connection to the Studio run-events endpoint and streams
 * events to the caller.
 *
 * - Converts `studioUrl` from http(s) to ws(s) and connects to `<wsUrl>/ws`.
 * - Authenticates via the `Authorization: Bearer <token>` header.
 * - Parses each incoming message as a `RunEvent` and calls `onEvent`.
 * - Calls `onClose` on socket close or error so the caller can fall back to
 *   polling. The token is never included in any error message or log.
 * - Resolves when the socket closes (after `onClose` has been called).
 *
 * @param studioUrl - Base URL of the Studio server (http or https)
 * @param token     - Personal Access Token — never logged or exposed in errors
 * @param runId     - The run ID to subscribe to (passed as a query parameter)
 * @param onEvent   - Called for each parsed `RunEvent` received from the server
 * @param onClose   - Called once when the socket closes or encounters an error
 */
export async function streamRunEvents(
  studioUrl: string,
  token: string,
  runId: string,
  onEvent: (event: RunEvent) => void,
  onClose: () => void
): Promise<void> {
  const wsBase = toWsUrl(studioUrl.replace(/\/$/, ''));
  const url = `${wsBase}/ws?runId=${encodeURIComponent(runId)}`;

  return new Promise<void>((resolve) => {
    let closeCalled = false;

    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    function handleClose(): void {
      if (!closeCalled) {
        closeCalled = true;
        onClose();
      }
      resolve();
    }

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const text = data.toString('utf8');
        const event = JSON.parse(text) as RunEvent;
        onEvent(event);
      } catch {
        // Ignore malformed messages — do not log raw data or token
      }
    });

    ws.on('close', () => {
      handleClose();
    });

    ws.on('error', () => {
      // Do not log the error object — it may contain the URL which includes
      // the token as a query parameter in some configurations. Call onClose
      // so the caller can fall back to polling, then let the 'close' event
      // (which fires after 'error') resolve the promise.
      if (!closeCalled) {
        closeCalled = true;
        onClose();
      }
      // 'close' will fire after 'error'; resolve there to avoid double-resolve.
    });
  });
}
