// Прогресс-бар визарда — отображает текущий шаг из 4

interface ProgressBarProps {
  currentStep: 1 | 2 | 3 | 4
}

const STEPS = [
  { num: 1, label: 'Цвета' },
  { num: 2, label: 'Название' },
  { num: 3, label: 'Приветствие' },
  { num: 4, label: 'Лимит' },
]

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, idx) => (
        <div key={step.num} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step.num < currentStep
                  ? 'bg-primary text-primary-foreground'
                  : step.num === currentStep
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {step.num < currentStep ? '✓' : step.num}
            </div>
            <span
              className={`mt-1 text-xs ${
                step.num === currentStep ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${
                step.num < currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
