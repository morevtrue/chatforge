// Типы для визарда создания чата (Builder)

export type Currency = 'RUB' | 'USD' | 'EUR'

export interface BuilderColors {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
}

export interface WizardState {
  id: string
  current_step: number
  draft_settings: Record<string, unknown>
}

export interface InstanceSettings {
  id: string
  primary_color: string | null
  secondary_color: string | null
  background_color: string | null
  avatar_url: string | null
  greeting_text: string | null
  example_questions: string[]
  system_prompt: string | null
}

export interface ChatInstance {
  id: string
  name: string
  subdomain: string
  currency: Currency
  status: 'draft' | 'active' | 'suspended'
  free_messages_limit: number | null
  public_url: string
  settings: InstanceSettings | null
}

export interface SubdomainValidation {
  available: boolean
  reason?: 'taken' | 'invalid_format'
}
