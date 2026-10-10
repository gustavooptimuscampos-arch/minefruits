import { useState, useEffect, useRef, useCallback } from 'react';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

interface GameChatProps {
  playerName: string;
  onSendMessage?: (text: string) => void;
  messages: ChatMessage[];
}

export function GameChat({ playerName, onSendMessage, messages }: GameChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // T key to toggle chat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyT' && !isFocused) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.code === 'Escape' && isOpen) {
        setIsOpen(false);
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFocused, isOpen]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage?.(trimmed);
    setInput('');
  }, [input, onSendMessage]);

  // Show last 3 messages as floating notifications when chat is closed
  const recentMessages = messages.slice(-3);

  return (
    <>
      {/* Floating recent messages (when chat is closed) */}
      {!isOpen && recentMessages.length > 0 && (
        <div className="absolute bottom-28 left-4 flex flex-col gap-1 pointer-events-none chat-float" style={{ zIndex: 15 }}>
          {recentMessages.map(msg => (
            <div
              key={msg.id}
              className="bg-background/50 backdrop-blur-sm rounded px-2 py-1 max-w-xs animate-fade-in"
            >
              {msg.isSystem ? (
                <span className="text-xs font-game text-muted-foreground italic">{msg.text}</span>
              ) : (
                <span className="text-xs font-game">
                  <span className="text-primary">{msg.sender}</span>
                  <span className="text-muted-foreground">: </span>
                  <span className="text-foreground">{msg.text}</span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="absolute bottom-28 left-4 w-72 sm:w-80 pointer-events-auto chat-panel"
          style={{ zIndex: 20 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-background/80 backdrop-blur-md rounded-lg border border-border/50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/30">
              <span className="text-xs font-game text-muted-foreground">💬 Chat</span>
              <button
                onClick={() => { setIsOpen(false); setIsFocused(false); }}
                className="text-xs font-game text-muted-foreground hover:text-foreground"
              >
                ESC
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="h-40 overflow-y-auto p-2 space-y-1">
              {messages.length === 0 ? (
                <p className="text-xs font-game text-muted-foreground/50 text-center mt-8">
                  Nenhuma mensagem ainda
                </p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className="text-xs font-game break-words">
                    {msg.isSystem ? (
                      <span className="text-muted-foreground italic">{msg.text}</span>
                    ) : (
                      <>
                        <span className="text-primary font-bold">{msg.sender}</span>
                        <span className="text-muted-foreground">: </span>
                        <span className="text-foreground">{msg.text}</span>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="flex border-t border-border/30">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') handleSend();
                }}
                placeholder="Digite uma mensagem..."
                maxLength={200}
                className="flex-1 bg-transparent px-3 py-2 text-xs font-game text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
              <button
                onClick={handleSend}
                className="px-3 py-2 text-xs font-game text-primary hover:text-primary/80"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hint */}
      {!isOpen && (
        <div className="absolute bottom-[68px] left-4 pointer-events-none hide-on-touch" style={{ zIndex: 15 }}>
          <span className="text-[10px] font-game text-muted-foreground/50">T para chat</span>
        </div>
      )}
    </>
  );
}
