import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export interface UseWebSocketOptions {
  /** URL to connect to. Defaults to ws(s)://host:3001/ws */
  url?: string;
  /** Whether to automatically connect. Default true. */
  autoConnect?: boolean;
  /** Message to send on open (subscription). */
  onOpen?: WebSocketMessage;
  /** Reconnect delay in ms. 0 to disable. Default 3000. */
  reconnectDelay?: number;
  /** Maximum reconnect attempts. 0 for unlimited. Default 0. */
  maxReconnectAttempts?: number;
  /** Callback when connection opens. */
  onConnected?: () => void;
  /** Callback when connection closes. */
  onDisconnected?: () => void;
  /** Message handler. */
  onMessage?: (message: WebSocketMessage) => void;
  /** Error handler. */
  onError?: (error: Event) => void;
}

export interface UseWebSocketReturn {
  /** Whether currently connected. */
  isConnected: boolean;
  /** Send a message. */
  send: (message: WebSocketMessage) => void;
  /** Manually connect. */
  connect: () => void;
  /** Manually disconnect. */
  disconnect: () => void;
  /** Last received message. */
  lastMessage: WebSocketMessage | null;
}

function getDefaultWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const isDev = ['3000', '5173'].includes(window.location.port);
  return isDev
    ? `${protocol}//localhost:3001/ws`
    : `${protocol}//${window.location.host}/ws`;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url,
    autoConnect = true,
    onOpen,
    reconnectDelay = 3000,
    maxReconnectAttempts = 0,
    onConnected,
    onDisconnected,
    onMessage,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  // Store callbacks in refs to avoid reconnecting on callback changes
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onOpenRef = useRef(onOpen);

  useEffect(() => {
    onConnectedRef.current = onConnected;
    onDisconnectedRef.current = onDisconnected;
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
    onOpenRef.current = onOpen;
  }, [onConnected, onDisconnected, onMessage, onError, onOpen]);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    clearReconnectTimeout();

    const wsUrl = url || getDefaultWsUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      onConnectedRef.current?.();
      
      // Send subscription message if provided
      if (onOpenRef.current) {
        ws.send(JSON.stringify(onOpenRef.current));
      }
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        setLastMessage(message);
        onMessageRef.current?.(message);
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      wsRef.current = null;
      onDisconnectedRef.current?.();

      // Reconnect if enabled
      if (reconnectDelay > 0) {
        const canRetry = maxReconnectAttempts === 0 || 
          reconnectAttemptsRef.current < maxReconnectAttempts;
        
        if (canRetry) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
        }
      }
    };

    ws.onerror = (error) => {
      onErrorRef.current?.(error);
      ws.close();
    };
  }, [url, reconnectDelay, maxReconnectAttempts, clearReconnectTimeout]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
    wsRef.current?.close();
    wsRef.current = null;
  }, [clearReconnectTimeout, maxReconnectAttempts]);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Connect on mount if autoConnect
  useEffect(() => {
    mountedRef.current = true;
    
    if (autoConnect) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      clearReconnectTimeout();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [autoConnect, connect, clearReconnectTimeout]);

  return {
    isConnected,
    send,
    connect,
    disconnect,
    lastMessage,
  };
}
