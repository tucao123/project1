import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { env } from '../config/env'
import { guardOutputText, guardUserInput, type GuardVerdict } from '../domain/compliance'
import { emptyProfile, buildProfile } from '../domain/evln'
import { archiveHistory, initialRoleCard } from '../domain/mock'
import { buildScript } from '../domain/script'
import { selectScenarios } from '../domain/scenarios'
import type {
  ActionScript,
  ArchiveEntry,
  CopingProfile,
  IntakeData,
  ResponseRecord,
  RoleCard,
  Scenario,
} from '../domain/types'
import { emitSessionEvent } from '../services/session'

interface FeedbackState {
  executed: boolean | null
  note: string
}

export type Plan = 'free' | 'single' | 'subscription'

interface AccountState {
  signedIn: boolean
  name: string
  plan: Plan
}

interface RfrStore {
  intake: IntakeData
  patchIntake: (patch: Partial<IntakeData>) => void
  guard: GuardVerdict
  ageConfirmed: boolean
  confirmAge: () => void

  scenarios: Scenario[]
  activeScenarioId: string | null
  setActiveScenarioId: (id: string) => void
  responses: ResponseRecord[]
  chooseOption: (optionId: string, freeText: string) => void
  goToNextScenario: () => void
  allAnswered: boolean

  profile: CopingProfile
  finishRehearsal: () => void

  script: ActionScript | null
  scriptUnlocked: boolean
  scriptRunId: number
  unlockScript: () => void
  regenerateScript: () => void

  feedbackConsent: boolean
  setFeedbackConsent: (v: boolean) => void
  anonymizeEnabled: boolean
  setAnonymizeEnabled: (v: boolean) => void
  feedback: FeedbackState
  submitFeedback: (executed: boolean, note: string) => void
  roleCard: RoleCard

  archive: ArchiveEntry[]
  exportArchive: () => void
  deleteAll: () => void

  startRehearsal: () => boolean

  /* 快捷面板：登录 / 付费 / 设置 / 管理 */
  panelOpen: boolean
  panelTab: number
  setPanelOpen: (v: boolean) => void
  openPanel: (tab?: number) => void
  account: AccountState
  signIn: (name: string) => void
  signOut: () => void
  choosePlan: (plan: Exclude<Plan, 'free'>) => void
}

const RfrContext = createContext<RfrStore | null>(null)

const initialIntake = (): IntakeData => ({
  relationshipType: env.domain.relationshipTypes[0] ?? '搭子',
  commitmentLevel: env.domain.commitmentLevels[0] ?? '低',
  boundaryClarity: env.domain.boundaryLevels[0] ?? '模糊',
  frictionEvents: [env.domain.frictionEvents[0] ?? '临时取消'],
  hesitationType: env.domain.hesitationTypes[0] ?? '说还是不说',
  priorResponsiveness: env.domain.priorResponsiveness[0] ?? '通常很快',
  messageUrgency: env.domain.messageUrgency[1] ?? '一般',
  freeText: '',
  ageConfirmed: !env.features.ageGate,
})

export function RfrProvider({ children }: { children: ReactNode }) {
  const [intake, setIntake] = useState<IntakeData>(initialIntake)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [responses, setResponses] = useState<ResponseRecord[]>([])
  const [profile, setProfile] = useState<CopingProfile>(emptyProfile)
  const [script, setScript] = useState<ActionScript | null>(null)
  const [scriptUnlocked, setScriptUnlocked] = useState(!env.features.paidScript)
  const [scriptRunId, setScriptRunId] = useState(0)
  const [feedbackConsent, setFeedbackConsent] = useState<boolean>(
    env.compliance.feedbackConsentDefault,
  )
  const [anonymizeEnabled, setAnonymizeEnabled] = useState(true)
  const [feedback, setFeedback] = useState<FeedbackState>({ executed: null, note: '' })
  const [roleCard, setRoleCard] = useState<RoleCard>(initialRoleCard)
  const [archive, setArchive] = useState<ArchiveEntry[]>(archiveHistory)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState(env.panel.defaultTab)
  const [account, setAccount] = useState<AccountState>({ signedIn: false, name: '', plan: 'free' })

  const openPanel = (tab?: number) => {
    if (tab !== undefined) setPanelTab(tab)
    setPanelOpen(true)
  }

  const signIn = (name: string) => {
    const clean = name.trim().slice(0, 32)
    if (!clean) return
    setAccount((prev) => ({ ...prev, signedIn: true, name: clean }))
  }

  const signOut = () =>
    setAccount((prev) => ({ ...prev, signedIn: false, name: '' }))

  const guard = useMemo(() => guardUserInput(intake.freeText), [intake.freeText])

  const patchIntake = (patch: Partial<IntakeData>) =>
    setIntake((prev) => ({ ...prev, ...patch }))

  const confirmAge = () => patchIntake({ ageConfirmed: true })

  const startRehearsal = (): boolean => {
    if (guard.blocked || !intake.ageConfirmed || !intake.frictionEvents.length) return false
    const picked = selectScenarios(intake)
    setScenarios(picked)
    setResponses([])
    setProfile(emptyProfile())
    setScript(null)
    setScriptUnlocked(!env.features.paidScript)
    setActiveScenarioId(picked[0]?.id ?? null)
    void emitSessionEvent(env.api.intake, { ...intake, scenario_count: picked.length })
    return true
  }

  const chooseOption = (optionId: string, freeText: string) => {
    const scenario = scenarios.find((s) => s.id === activeScenarioId)
    const option = scenario?.options.find((o) => o.id === optionId)
    if (!scenario || !option) return
    const record: ResponseRecord = {
      scenarioId: scenario.id,
      optionId,
      evln: option.evln,
      optionText: option.text,
      freeText,
      createdAt: new Date().toISOString(),
    }
    setResponses((prev) => [...prev.filter((r) => r.scenarioId !== scenario.id), record])
    void emitSessionEvent(env.api.rehearsal, record)
  }

  const unanswered = (list: ResponseRecord[]) =>
    scenarios.filter((s) => !list.some((r) => r.scenarioId === s.id))

  const goToNextScenario = () => {
    const next = unanswered(responses)[0]
    setActiveScenarioId(next?.id ?? null)
  }

  const allAnswered = scenarios.length > 0 && unanswered(responses).length === 0

  const finishRehearsal = () => {
    const p = buildProfile(responses, scenarios)
    const raw = buildScript(intake, p)
    // 输出侧合规 Guard：命中即替换为固定话术，不让生成内容绕过规则拦截
    const safeAction = guardOutputText(raw.actionText)
    const safe: ActionScript = {
      ...raw,
      actionText: safeAction,
      highlight: safeAction === raw.actionText ? raw.highlight : [0, 0],
      branches: raw.branches.map((b) => ({ ...b, text: guardOutputText(b.text) })),
      fallback: guardOutputText(raw.fallback),
      stopCondition: guardOutputText(raw.stopCondition),
    }
    setProfile(p)
    setScript(safe)
    setScriptRunId((v) => v + 1)
    setArchive((prev) => [
      {
        id: `arc-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        relationshipType: intake.relationshipType,
        frictionEvents: intake.frictionEvents,
        profileLabel: p.label,
        scenarioCount: responses.length,
        version: roleCard.version,
      },
      ...prev,
    ])
    void emitSessionEvent(env.api.profile, { profile: p, response_count: responses.length })
  }

  const unlockScript = () => {
    setScriptUnlocked(true)
    setScriptRunId((v) => v + 1)
    setAccount((prev) => (prev.plan === 'free' ? { ...prev, plan: 'single' } : prev))
    void emitSessionEvent(env.api.script, { unlocked: true })
  }

  const choosePlan = (plan: Exclude<Plan, 'free'>) => {
    setAccount((prev) => ({ ...prev, plan }))
    setScriptUnlocked(true)
    setScriptRunId((v) => v + 1)
    void emitSessionEvent(env.api.script, { plan, unlocked: true })
  }

  const regenerateScript = () => setScriptRunId((v) => v + 1)

  const submitFeedback = (executed: boolean, note: string) => {
    setFeedback({ executed, note })
    // 单独明示同意：只有开启授权时才微调角色卡参数（PRD §7.1）
    if (feedbackConsent && env.features.roleCard) {
      setRoleCard((prev) => ({
        ...prev,
        version: prev.version + 1,
        personaParams: prev.personaParams.map((p, i) => ({
          ...p,
          value: Math.max(0, Math.min(100, p.value + (executed ? 3 + i : -2 - i))),
        })),
      }))
    }
    void emitSessionEvent(env.api.feedback, {
      executed,
      note,
      feedback_consent: feedbackConsent,
    })
  }

  const exportArchive = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      app: env.app.name,
      version: env.app.version,
      intake,
      profile,
      responses,
      archive,
      role_card: roleCard,
      disclosure: env.compliance.disclaimerFull,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rfr-archive-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const deleteAll = () => {
    setIntake(initialIntake())
    setScenarios([])
    setActiveScenarioId(null)
    setResponses([])
    setProfile(emptyProfile())
    setScript(null)
    setScriptUnlocked(!env.features.paidScript)
    setFeedback({ executed: null, note: '' })
    setFeedbackConsent(env.compliance.feedbackConsentDefault)
    setRoleCard(initialRoleCard())
    setArchive([])
  }

  const value: RfrStore = {
    intake,
    patchIntake,
    guard,
    ageConfirmed: intake.ageConfirmed,
    confirmAge,
    scenarios,
    activeScenarioId,
    setActiveScenarioId,
    responses,
    chooseOption,
    goToNextScenario,
    allAnswered,
    profile,
    finishRehearsal,
    script,
    scriptUnlocked,
    scriptRunId,
    unlockScript,
    regenerateScript,
    feedbackConsent,
    setFeedbackConsent,
    anonymizeEnabled,
    setAnonymizeEnabled,
    feedback,
    submitFeedback,
    roleCard,
    archive,
    exportArchive,
    deleteAll,
    startRehearsal,
    panelOpen,
    panelTab,
    setPanelOpen,
    openPanel,
    account,
    signIn,
    signOut,
    choosePlan,
  }

  return <RfrContext.Provider value={value}>{children}</RfrContext.Provider>
}

export function useRfr(): RfrStore {
  const ctx = useContext(RfrContext)
  if (!ctx) throw new Error('useRfr 必须在 RfrProvider 内使用')
  return ctx
}
