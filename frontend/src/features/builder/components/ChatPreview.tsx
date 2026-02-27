// Живое превью чата — обновляется в реальном времени из builderStore

import { useBuilderStore } from '../store'

export function ChatPreview() {
  const { colors, name, greetingText, exampleQuestions, avatarUrl } = useBuilderStore()

  const displayName = name || 'Мой чат'
  const displayGreeting = greetingText || 'Привет! Чем могу помочь?'
  const displayQuestions = exampleQuestions.length > 0
    ? exampleQuestions.filter(q => q.trim())
    : ['Как вы работаете?', 'Сколько стоит?']

  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200/60" style={{ backgroundColor: colors.backgroundColor }}>
      {/* Chat header */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ background: `linear-gradient(135deg, ${colors.primaryColor}, ${colors.secondaryColor})` }}
      >
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0">
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            : <span className="text-white text-sm font-bold">AI</span>
          }
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">{displayName}</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-300" />
            <span className="text-white/70 text-xs">Онлайн</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-3 min-h-[220px]">
        {/* AI greeting bubble */}
        <div className="flex items-start gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: colors.primaryColor }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-white text-xs font-bold">AI</span>
            }
          </div>
          <div
            className="rounded-2xl rounded-tl-sm px-3 py-2 max-w-[75%] shadow-sm"
            style={{ backgroundColor: colors.primaryColor }}
          >
            <p className="text-white text-sm leading-relaxed">{displayGreeting}</p>
          </div>
        </div>

        {/* Example questions */}
        {displayQuestions.slice(0, 3).map((q, i) => (
          <div key={i} className="flex justify-end">
            <button
              className="rounded-2xl rounded-tr-sm px-3 py-2 text-sm text-left shadow-sm border transition-opacity hover:opacity-80"
              style={{
                backgroundColor: `${colors.secondaryColor}15`,
                borderColor: `${colors.secondaryColor}40`,
                color: colors.secondaryColor,
              }}
            >
              {q}
            </button>
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 bg-white/80 border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <input
            readOnly
            placeholder="Напишите сообщение..."
            className="flex-1 text-sm text-slate-400 bg-transparent outline-none cursor-default"
          />
          <button
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: colors.primaryColor }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
