import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SendHorizontal, Loader2, Mic, Square, Plus, FileUp, X } from 'lucide-react';
import { uploadFile } from '../services/api';

interface ChatInputProps {
  onSend: (message: string, options?: { viaVoice?: boolean }) => void;
  onStop?: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, onStop, disabled, isProcessing }) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<{ id: string, filename: string, type: string }[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const shouldSubmitRef = useRef(false);
  const submitFromVoiceRef = useRef(false);
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

  const processFile = async (file: File) => {
      setIsUploading(true);
      try {
          const result = await uploadFile(file);
          if (result && result.attachmentId) {
             setAttachments(prev => [...prev, { 
                 id: result.attachmentId, 
                 filename: result.filename, 
                 type: result.document.type 
             }]);
             
             // Focus back on textarea
              if (textareaRef.current) {
                  textareaRef.current.focus();
              }
          }
      } catch (error) {
          console.error("Upload failed", error);
          alert(`Upload failed: ${String(error)}`);
      } finally {
          setIsUploading(false);
          setIsDragging(false);
          if (fileInputRef.current) {
              fileInputRef.current.value = ''; // Reset input
          }
      }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && !isUploading) {
          setIsDragging(true);
      }
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled || isUploading) return;
      
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
      else setIsDragging(false);
  };

  const removeAttachment = (id: string) => {
      setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = (fromVoice: boolean = false, e?: React.FormEvent) => {
    e?.preventDefault();
    if ((textRef.current.trim() || attachments.length > 0) && !disabled) {
      let finalMessage = textRef.current.trim();
      
      if (attachments.length > 0) {
          const attachmentBlock = `<attachments>${JSON.stringify(attachments)}</attachments>`;
          finalMessage = finalMessage ? `${finalMessage}\n\n${attachmentBlock}` : attachmentBlock;
      }

      onSend(finalMessage, { viaVoice: fromVoice });
      setText('');
      setAttachments([]);
      submitFromVoiceRef.current = false;
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
    submitFromVoiceRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    } else {
      handleSubmit(true);
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
        .map((result: any) => result[0].transcript)
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
        handleSubmit(submitFromVoiceRef.current);
      }
      shouldSubmitRef.current = false;
      submitFromVoiceRef.current = false;
    };

    recognitionRef.current = recognition;
    shouldSubmitRef.current = false;
    submitFromVoiceRef.current = false;
    setIsListening(true);
    setText('');
    recognition.start();
    silenceTimeoutRef.current = window.setTimeout(handleAutoSubmit, 2000);
  };

  const stopListening = (submit: boolean) => {
    if (!recognitionRef.current) return;
    shouldSubmitRef.current = submit;
    submitFromVoiceRef.current = submit;
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
      <div className="max-w-full mx-auto relative px-2">
        {/* Attachments Area */}
        {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 px-1">
                {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 bg-gray-200 dark:bg-gray-800 rounded-md px-3 py-1.5 text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 animate-in zoom-in-95">
                        <FileUp size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="max-w-[150px] truncate" title={att.filename}>{att.filename}</span>
                        <button 
                            onClick={() => removeAttachment(att.id)}
                            className="ml-1 p-0.5 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-500 hover:text-red-500 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
        )}

        <form onSubmit={(e) => handleSubmit(false, e)} className="relative flex items-end gap-2">
            
          <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileSelect}
              accept=".txt,.md,.pdf,.json,.xml,.html,.rss,.js,.ts,.py,.csv,.png,.jpg,.jpeg,.gif,.webp"
          />

          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`p-2 mb-1 rounded-full transition-all duration-200 ${
                isDragging 
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 scale-110 ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-gray-900' 
                : 'text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
            title="Attach file (Click or Drag & Drop)"
          >
             {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isUploading ? "Uploading and parsing..." : "Enter symbolic input or natural language..."}
            rows={1}
            disabled={disabled || isUploading}
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
              type={isProcessing ? "button" : "submit"}
              disabled={((!text.trim() && attachments.length === 0) && !isProcessing) || (disabled && !isProcessing)}
              onClick={isProcessing && onStop ? onStop : undefined}
              className={`p-2 rounded-md transition-all shadow-sm ${
                  isProcessing 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-0 disabled:scale-75'
              }`}
              aria-label={isProcessing ? "Stop generating" : "Send message"}
            >
              {isProcessing ? <Square size={18} fill="currentColor" /> : <SendHorizontal size={18} />}
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
