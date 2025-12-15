import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SendHorizontal, Loader2, Mic, Square } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const shouldSubmitRef = useRef(false);
  const textRef = useRef('');

  const SpeechRecognitionConstructor = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  }, []);

  useEffect(() => {
    if (SpeechRecognitionConstructor) {
      setIsSpeechSupported(true);
    }
  }, [SpeechRecognitionConstructor]);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Maintain focus when re-enabled
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (textRef.current.trim() && !disabled) {
      onSend(textRef.current.trim());
      setText('');
      // Reset height and keep focus
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    }
  };

  const clearSilenceTimer = () => {
    if (silenceTimeoutRef.current) {
      window.clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  };

  const handleAutoSubmit = () => {
    shouldSubmitRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    } else {
      handleSubmit();
    }
  };

  const startListening = () => {
    if (!SpeechRecognitionConstructor || disabled) return;

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ')
        .trim();
      setText(transcript);
      clearSilenceTimer();
      silenceTimeoutRef.current = window.setTimeout(handleAutoSubmit, 2000);
    };

    recognition.onerror = () => {
      setIsListening(false);
      clearSilenceTimer();
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      clearSilenceTimer();
      recognitionRef.current = null;
      if (shouldSubmitRef.current && textRef.current.trim()) {
        handleSubmit();
      }
      shouldSubmitRef.current = false;
    };

    recognitionRef.current = recognition;
    shouldSubmitRef.current = false;
    setIsListening(true);
    setText('');
    recognition.start();
    silenceTimeoutRef.current = window.setTimeout(handleAutoSubmit, 2000);
  };

  const stopListening = (submit: boolean) => {
    if (!recognitionRef.current) return;
    shouldSubmitRef.current = submit;
    clearSilenceTimer();
    recognitionRef.current.stop();
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      }
      clearSilenceTimer();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-4 sticky bottom-0 z-10 transition-colors duration-300">
      <div className="max-w-full mx-auto relative px-4">
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter symbolic input or natural language..."
            rows={1}
            disabled={disabled}
            className="w-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg py-3 pl-4 pr-28 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50 border border-transparent dark:border-gray-800 transition-all max-h-32 disabled:opacity-50 disabled:cursor-not-allowed font-sans text-base"
          />

          <div className="absolute right-2 bottom-2 flex items-center gap-2">
            <button
              type="button"
              disabled={!isSpeechSupported || disabled}
              onClick={() => (isListening ? stopListening(true) : startListening())}
              className={`p-2 rounded-md shadow-sm transition-all ${isListening ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'} disabled:opacity-40 disabled:cursor-not-allowed`}
              aria-label={isListening ? 'Stop voice capture' : 'Start voice capture'}
            >
              {isListening ? <Square size={16} /> : <Mic size={16} />}
            </button>

            <button
              type="submit"
              disabled={!text.trim() || disabled}
              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-all disabled:opacity-0 disabled:scale-75 shadow-sm"
              aria-label="Send message"
            >
              {disabled ? <Loader2 className="animate-spin" size={18} /> : <SendHorizontal size={18} />}
            </button>
          </div>
        </form>
        <div className="text-center mt-2 text-[10px] text-gray-400 dark:text-gray-600 font-mono">
            SignalZero Kernel • {isListening ? 'Listening for voice input…' : 'Symbolic Recursion Active'}
        </div>
      </div>
    </div>
  );
};
