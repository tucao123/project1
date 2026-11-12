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
import { archiveHistory, emptyRoleCard, initialRoleCard, roleCardForSession } from '../domain/mock'
import { buildScript } from '../domain/script'
import { selectScenarios } from '../domain/scenarios'
import { selectionBasis } from '../domain/context'
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
import { clearRfrStorage, usePersistentState } from '../services/storage'

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
  basis: string
  responses: ResponseRecord[]
  chooseOption: (optionId: string, freeText: string) => void
  goToNextScenario: () => void
  allAnswered: boolean

  profile: CopingProfile
  finishRehearsal: () => void

  script: ActionScript | null
  /** 单一数据源：付费方案决定是否解锁，不再单独维护布尔值 */
  scriptUnlocked: boolean
  scriptRunId: number
  scriptFocus: string
  refocusScript: (focus: string) => void
  regenerateScript: () => void
  purchase: (plan: Exclude<Plan, 'free'>, name?: string) => boolean

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

  panelOpen: boolean
  panelTab: number
  setPanelOpen: (v: boolean) => void
  openPanel: (tab?: number) => void
  account: AccountState
  signIn: (name: string) => void
  signOut: () => void
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

const emptyAccount = (): AccountState => ({ signedIn: false, name: '', plan: 'free' })

/* 落盘前脱敏：原始自由文本绝不写入 localStorage */
const stripIntake = (v: IntakeData) => ({ ...v, freeText: '' })
const stripResponses = (v: ResponseRecord[]) => v.map((r) => ({ ...r, freeText: '' }))
const stripFeedback = (v: FeedbackState): FeedbackState => ({ executed: v.executed, note: '' })

/** 输出侧安全过滤覆盖脚本的每一段文本，新增适配文案也不能绕过 */
function guardScript(raw: ActionScript): ActionScript {
  const safeAction = guardOutputText(raw.actionText)
  return {
    ...raw,
    actionText: safeAction,
    highlight: safeAction === raw.actionText ? raw.highlight : [0, 0],
    branches: raw.branches.map((b) => ({ ...b, key: guardOutputText(b.key), text: guardOutputText(b.text) })),
    fallback: guardOutputText(raw.fallback),
    stopCondition: guardOutputText(raw.stopCondition),
    note: guardOutputText(raw.note),
    focus: guardOutputText(raw.focus),
    basedOn: guardOutputText(raw.basedOn),
  }
}

export function RfrProvider({ children }: { children: ReactNode }) {
  const [intake, setIntake] = usePersistentState<IntakeData>('intake', initialIntake, stripIntake)
  const [scenarios, setScenarios] = usePersistentState<Scenario[]>('scenarios', [])
  const [activeScenarioId, setActiveScenarioId] = usePersistentState<string | null>('active', null)
  const [basis, setBasis] = usePersistentState<string>('basis', '')
  const [responses, setResponses] = usePersistentState<ResponseRecord[]>('responses', [], stripResponses)
  const [profile, setProfile] = usePersistentState<CopingProfile>('profile', emptyProfile)
  const [script, setScript] = usePersistentState<ActionScript | null>('script', null)
  const [scriptRunId, setScriptRunId] = usePersistentState<number>('scriptRun', 0)
  const [scriptFocus, setScriptFocus] = usePersistentState<string>('scriptFocus', '')
  const [feedbackConsent, setFeedbackConsent] = usePersistentState<boolean>(
    'consent',
    env.compliance.feedbackConsentDefault,
  )
  // 后端阶段开关：当前演示未接线，默认关闭且界面置灰
  const [anonymizeEnabled, setAnonymizeEnabled] = usePersistentState<boolean>('anonymize', false)
  const [feedback, setFeedback] = usePersistentState<FeedbackState>(
    'feedback',
    { executed: null, note: '' },
    stripFeedback,
  )
  const [roleCard, setRoleCard] = usePersistentState<RoleCard>(
    'roleCard',
    env.features.seedDemoData ? initialRoleCard : emptyRoleCard,
  )
  const [archive, setArchive] = usePersistentState<ArchiveEntry[]>('archive', archiveHistory)
  const [account, setAccount] = usePersistentState<AccountState>('account', emptyAccount)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState(env.panel.defaultTab)

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
  const scriptUnlocked = !env.features.paidScript || account.plan !== 'free'

  const patchIntake = (patch: Partial<IntakeData>) =>
    setIntake((prev) => ({ ...prev, ...patch }))

  const confirmAge = () => patchIntake({ ageConfirmed: true })

  const startRehearsal = (): boolean => {
    if (guard.blocked || !intake.ageConfirmed || !intake.frictionEvents.length) return false
    const picked = selectScenarios(intake)
    setScenarios(picked)
    setBasis(selectionBasis(intake))
    setResponses([])
    setProfile(emptyProfile())
    setScript(null)
    setScriptFocus(intake.frictionEvents[0] ?? '')
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
    setProfile(p)
    setScript(guardScript(buildScript(intake, p, scriptFocus || undefined)))
    setScriptRunId((v) => v + 1)
    const realCount = archive.filter((a) => !a.isSample).length + 1
    setRoleCard((prev) => roleCardForSession(intake, prev, realCount))
    setArchive((prev) => [
      {
        id: `arc-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        relationshipType: intake.relationshipType,
        frictionEvents: intake.frictionEvents,
        profileLabel: p.label,
        scenarioCount: responses.length,
        version: roleCard.version,
        agency: p.agency,
      },
      ...prev,
    ])
    void emitSessionEvent(env.api.profile, { profile: p, response_count: responses.length })
  }

  /** 多选事件时切换脚本针对的那一件事 */
  const refocusScript = (focus: string) => {
    if (!intake.frictionEvents.includes(focus)) return
    setScriptFocus(focus)
    if (profile.total > 0) {
      setScript(guardScript(buildScript(intake, profile, focus)))
      setScriptRunId((v) => v + 1)
    }
  }

  /** O-07：解锁必须先登录 + 价格确认，方案是解锁状态的唯一来源 */
  const purchase = (plan: Exclude<Plan, 'free'>, name?: string): boolean => {
    const clean = (name ?? '').trim().slice(0, 32)
    if (!account.signedIn && !clean) return false
    setAccount((prev) => ({
      signedIn: true,
      name: prev.signedIn ? prev.name : clean,
      plan,
    }))
    setScriptRunId((v) => v + 1)
    void emitSessionEvent(env.api.script, { plan, unlocked: true })
    return true
  }

  const regenerateScript = () => setScriptRunId((v) => v + 1)

  const submitFeedback = (executed: boolean, note: string) => {
    setFeedback({ executed, note })
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

  /** 全量清空（含账户与本机存储），重置为干净空态，不重新注入样例 */
  const deleteAll = () => {
    clearRfrStorage()
    setIntake(initialIntake())
    setScenarios([])
    setActiveScenarioId(null)
    setBasis('')
    setResponses([])
    setProfile(emptyProfile())
    setScript(null)
    setScriptRunId(0)
    setScriptFocus('')
    setFeedback({ executed: null, note: '' })
    setFeedbackConsent(env.compliance.feedbackConsentDefault)
    setAnonymizeEnabled(false)
    setRoleCard(emptyRoleCard())
    setArchive([])
    setAccount(emptyAccount())
    setPanelOpen(false)
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
    basis,
    responses,
    chooseOption,
    goToNextScenario,
    allAnswered,
    profile,
    finishRehearsal,
    script,
    scriptUnlocked,
    scriptRunId,
    scriptFocus,
    refocusScript,
    regenerateScript,
    purchase,
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
  }

  return <RfrContext.Provider value={value}>{children}</RfrContext.Provider>
}

export function useRfr(): RfrStore {
  const ctx = useContext(RfrContext)
  if (!ctx) throw new Error('useRfr 必须在 RfrProvider 内使用')
  return ctx
}
