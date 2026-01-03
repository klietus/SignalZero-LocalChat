
import React from 'react';
import { Plus, Archive, MessageSquare, Cpu, Hash } from 'lucide-react';
import { ContextSession } from '../../types';

interface ContextListPanelProps {
  contexts: ContextSession[];
  activeContextId: string | null;
  onSelectContext: (id: string) => void;
  onCreateContext: () => void;
  onArchiveContext: (id: string) => void;
}

export const ContextListPanel: React.FC<ContextListPanelProps> = ({
  contexts,
  activeContextId,
  onSelectContext,
  onCreateContext,
  onArchiveContext
}) => {
  const activeContexts = contexts.filter(c => c.status === 'open');
  const conversations = activeContexts.filter(c => c.type === 'conversation');
  const loopContexts = activeContexts.filter(c => c.type === 'loop');

  const renderContextItem = (ctx: ContextSession) => (
    <div 
      key={ctx.id}
      className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
        activeContextId === ctx.id 
          ? 'bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 font-medium' 
          : 'hover:bg-gray-200 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
      }`}
      onClick={() => onSelectContext(ctx.id)}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <MessageSquare size={14} className={`flex-shrink-0 ${activeContextId === ctx.id ? 'text-indigo-500' : 'text-gray-400'}`} />
        <div className="flex flex-col min-w-0">
          <span className="truncate font-mono">{ctx.id}</span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
              {new Date(ctx.createdAt).toLocaleTimeString()}
          </span>
        </div>
      </div>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          onArchiveContext(ctx.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 rounded transition-all"
        title="Archive"
      >
        <Archive size={12} />
      </button>
    </div>
  );

  return (
    <div className="w-64 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h2 className="font-bold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-wide">Kernel Contexts</h2>
        <button 
          onClick={onCreateContext}
          className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
          title="New Conversation"
        >
          <Plus size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-6">
        {/* User Conversations Section */}
        <section className="space-y-1">
            <div className="px-2 mb-2 flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <Hash size={10} />
                <span>Conversations</span>
            </div>
            {conversations.length === 0 && (
                <div className="px-2 py-4 text-gray-400 dark:text-gray-600 text-[10px] italic border border-dashed border-gray-300 dark:border-gray-800 rounded-lg text-center">
                    No active conversations.
                </div>
            )}
            {conversations.map(renderContextItem)}
        </section>

        {/* Loop / Async Section */}
        {loopContexts.length > 0 && (
            <section className="space-y-1">
                <div className="px-2 mb-2 flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-t border-gray-200 dark:border-gray-800 pt-4">
                    <Cpu size={10} />
                    <span>Autonomous Threads</span>
                </div>
                {loopContexts.map(ctx => {
                    const loopName = ctx.metadata?.loopId || "Background Task";
                    return (
                        <div key={ctx.id} className="space-y-1">
                            <div className="px-2 py-0.5 text-[9px] font-mono text-indigo-500/70 dark:text-indigo-400/50 uppercase truncate">
                                [{loopName}]
                            </div>
                            {renderContextItem(ctx)}
                        </div>
                    );
                })}
            </section>
        )}
      </div>
    </div>
  );
};
