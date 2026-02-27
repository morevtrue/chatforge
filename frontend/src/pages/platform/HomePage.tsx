// Лендинг платформы ChatForge — современный дизайн с анимациями
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreatorAuthStore } from '@/features/auth/creatorAuthStore'

// ── Иконки ──────────────────────────────────────────────────────────────────

function IconBot() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <circle cx="12" cy="5" r="2"/>
      <path d="M12 7v4"/>
      <line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
  )
}

function IconZap() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

function IconPalette() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>
  )
}

function IconMoney() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )
}

function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

// ── CSS-орбы фона (без canvas, без мерцания) ────────────────────────────────

function MeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="orb orb-4" />
    </div>
  )
}

// ── Хук для fade-in при появлении в viewport ─────────────────────────────────

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return { ref, visible }
}

// ── Данные ───────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: <IconZap />, title: 'Запуск за 5 минут', desc: 'Пошаговый визард — от регистрации до готового AI-чата без единой строки кода.' },
  { icon: <IconPalette />, title: 'Полная кастомизация', desc: 'Цвета, аватар, приветствие, примеры вопросов и system prompt — всё под ваш бренд.' },
  { icon: <IconMoney />, title: 'Монетизация из коробки', desc: 'Создавайте тарифные планы и продавайте доступ к своему AI-ассистенту.' },
  { icon: <IconChart />, title: 'Аналитика и метрики', desc: 'Пользователи, сообщения, подписки, доход — всё в одном дашборде.' },
]

const PLANS = [
  {
    name: 'Бесплатно', price: '0 ₽', period: 'навсегда',
    features: ['1 AI-чат', 'До 100 пользователей', 'Базовая аналитика', 'Поддержка по email'],
    cta: 'Начать бесплатно', highlight: false,
  },
  {
    name: 'Pro', price: '990 ₽', period: 'в месяц',
    features: ['До 5 AI-чатов', 'Неограниченно пользователей', 'Расширенная аналитика', 'Кастомный домен', 'Приоритетная поддержка'],
    cta: 'Попробовать Pro', highlight: true,
  },
  {
    name: 'Enterprise', price: 'По запросу', period: '',
    features: ['Неограниченно чатов', 'White-label решение', 'SLA 99.9%', 'Выделенный менеджер', 'API-доступ'],
    cta: 'Связаться с нами', highlight: false,
  },
]

// ── Компоненты секций ────────────────────────────────────────────────────────

function FeatureCard({ icon, title, desc, delay }: { icon: React.ReactNode; title: string; desc: string; delay: number }) {
  const { ref, visible } = useFadeIn()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`group relative bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/80 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
    >
      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform duration-200">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
  )
}

function PlanCard({ plan, onCTA, delay }: { plan: typeof PLANS[0]; onCTA: () => void; delay: number }) {
  const { ref, visible } = useFadeIn()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`relative flex flex-col gap-6 rounded-2xl p-7 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${
        plan.highlight
          ? 'bg-gradient-to-b from-indigo-600 to-purple-700 text-white shadow-2xl shadow-indigo-300/40 scale-105'
          : 'bg-white/70 backdrop-blur-sm border border-slate-200/80 text-slate-900 hover:shadow-lg hover:-translate-y-1'
      }`}
    >
      {plan.highlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full text-xs font-bold text-white shadow-md whitespace-nowrap">
          Популярный выбор
        </div>
      )}
      <div>
        <p className={`text-sm font-medium ${plan.highlight ? 'text-indigo-200' : 'text-slate-500'}`}>{plan.name}</p>
        <div className="flex items-baseline gap-1 mt-1.5">
          <span className="text-4xl font-extrabold">{plan.price}</span>
          {plan.period && <span className={`text-sm ${plan.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{plan.period}</span>}
        </div>
      </div>
      <ul className="space-y-2.5 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-sm">
            <span className={`flex-shrink-0 ${plan.highlight ? 'text-indigo-200' : 'text-indigo-500'}`}><IconCheck /></span>
            <span className={plan.highlight ? 'text-indigo-100' : 'text-slate-600'}>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onCTA}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
          plan.highlight ? 'bg-white text-indigo-700 hover:bg-indigo-50 shadow-md' : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        {plan.cta}
      </button>
    </div>
  )
}

// ── Главный компонент ────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate()
  const isAuthenticated = useCreatorAuthStore((s) => s.isAuthenticated)
  const heroRef = useRef<HTMLDivElement>(null)
  const [heroVisible, setHeroVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setHeroVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleCTA = () => navigate(isAuthenticated ? '/dashboard' : '/register')

  return (
    <div className="min-h-screen bg-[#f8f7ff] text-slate-900 overflow-x-hidden">

      {/* ── Глобальные CSS-анимации ── */}
      <style>{`
        @keyframes orb-move-1 {
          0%,100% { transform: translate(0px, 0px) scale(1); }
          33%      { transform: translate(60px, -40px) scale(1.08); }
          66%      { transform: translate(-30px, 50px) scale(0.95); }
        }
        @keyframes orb-move-2 {
          0%,100% { transform: translate(0px, 0px) scale(1); }
          40%      { transform: translate(-70px, 30px) scale(1.05); }
          70%      { transform: translate(40px, -60px) scale(0.97); }
        }
        @keyframes orb-move-3 {
          0%,100% { transform: translate(0px, 0px) scale(1); }
          50%      { transform: translate(50px, 40px) scale(1.1); }
        }
        @keyframes orb-move-4 {
          0%,100% { transform: translate(0px, 0px) scale(1); }
          45%      { transform: translate(-40px, -50px) scale(1.06); }
          80%      { transform: translate(30px, 20px) scale(0.94); }
        }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.6 } 100% { transform: scale(1.5); opacity: 0 } }
        .animate-pulse-ring { animation: pulse-ring 2s ease-out infinite; }
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(72px);
          will-change: transform;
        }
        .orb-1 {
          width: 520px; height: 520px;
          top: -120px; left: -80px;
          background: radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%);
          animation: orb-move-1 18s ease-in-out infinite;
        }
        .orb-2 {
          width: 440px; height: 440px;
          top: 0; right: -60px;
          background: radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%);
          animation: orb-move-2 22s ease-in-out infinite;
        }
        .orb-3 {
          width: 380px; height: 380px;
          bottom: -80px; left: 30%;
          background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%);
          animation: orb-move-3 16s ease-in-out infinite;
        }
        .orb-4 {
          width: 300px; height: 300px;
          bottom: 40px; right: 10%;
          background: radial-gradient(circle, rgba(139,92,246,0.13) 0%, transparent 70%);
          animation: orb-move-4 20s ease-in-out infinite;
        }
      `}</style>

      {/* ── Навбар ── */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <IconBot />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">ChatForge</span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                Дашборд
              </button>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                  Войти
                </button>
                <button onClick={() => navigate('/register')} className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-indigo-200">
                  Создать чат
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-28 pb-24 px-6">
        <MeshBackground />

        {/* Декоративные орбы — внутри MeshBackground */}

        <div
          ref={heroRef}
          className={`relative max-w-4xl mx-auto text-center space-y-8 transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Бейдж */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/80 backdrop-blur-sm border border-indigo-100 rounded-full text-sm text-indigo-700 font-medium shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            Создайте свой AI-чат за 5 минут
          </div>

          {/* Заголовок */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight">
            <span className="text-slate-900">Ваш собственный</span>
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                AI-ассистент
              </span>
              {/* Подчёркивание */}
              <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 300 8" preserveAspectRatio="none">
                <path d="M0 6 Q75 0 150 4 Q225 8 300 2" stroke="url(#uline)" strokeWidth="3" fill="none" strokeLinecap="round"/>
                <defs>
                  <linearGradient id="uline" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1"/>
                    <stop offset="100%" stopColor="#ec4899"/>
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h1>

          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            ChatForge — платформа для создания и монетизации брендированных AI-чатботов.
            Без кода, без сложных настроек.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={handleCTA}
              className="group relative px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-2xl text-lg shadow-xl shadow-indigo-300/50 hover:shadow-indigo-400/60 hover:scale-[1.02] transition-all duration-200"
            >
              <span className="relative z-10">{isAuthenticated ? 'Перейти в дашборд' : 'Создать чат бесплатно'}</span>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </button>
            <button
              onClick={() => navigate('/builder')}
              className="px-8 py-4 bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 font-semibold rounded-2xl text-lg hover:border-indigo-300 hover:text-indigo-700 hover:bg-white transition-all duration-200 shadow-sm"
            >
              Попробовать визард →
            </button>
          </div>

          {/* Социальное доказательство */}
          <div className="flex items-center justify-center gap-6 pt-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="text-amber-400">★★★★★</span> 4.9 / 5
            </span>
            <span className="w-px h-4 bg-slate-200" />
            <span>1 200+ создателей</span>
            <span className="w-px h-4 bg-slate-200" />
            <span>Бесплатно навсегда</span>
          </div>
        </div>
      </section>

      {/* ── Преимущества ── */}
      <section className="py-24 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Всё что нужно — уже внутри</h2>
            <p className="text-slate-500 mt-3 text-lg">Никаких интеграций, никаких плагинов</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 80} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Тарифы ── */}
      <section className="py-24 px-6 relative overflow-hidden">
        {/* Фоновый акцент */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-50/50 to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Простые и прозрачные тарифы</h2>
            <p className="text-slate-500 mt-3 text-lg">Начните бесплатно, масштабируйтесь по мере роста</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {PLANS.map((plan, i) => (
              <PlanCard key={plan.name} plan={plan} onCTA={handleCTA} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA-баннер ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-12 text-center shadow-2xl shadow-indigo-300/40">
            {/* Декор внутри баннера */}
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative space-y-6">
              <h2 className="text-3xl sm:text-4xl font-bold text-white">Готовы запустить свой AI-чат?</h2>
              <p className="text-indigo-200 text-lg">Регистрация занимает меньше минуты. Первый чат — бесплатно.</p>
              <button
                onClick={handleCTA}
                className="inline-block px-10 py-4 bg-white text-indigo-700 font-bold rounded-2xl text-lg hover:bg-indigo-50 transition-colors shadow-xl"
              >
                {isAuthenticated ? 'Перейти в дашборд' : 'Создать чат бесплатно'} →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Футер ── */}
      <footer className="py-8 px-6 border-t border-slate-100/80">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <span className="font-medium text-slate-600">ChatForge</span>
          </div>
          <p>© 2026 ChatForge. Все права защищены.</p>
        </div>
      </footer>

    </div>
  )
}
