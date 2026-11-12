/// <reference types="vite/client" />
/**
 * 全局配置层 — 所有可调参数都来自 .env，业务代码不得硬编码。
 * 缺失项自动回退到安全默认值；违反 PRD 硬性条款的配置会被强制纠正并告警。
 */

export type ViewId = 'intake' | 'rehearsal' | 'profile' | 'script' | 'archive' | 'group'

const ALL_VIEWS: ViewId[] = ['intake', 'rehearsal', 'profile', 'script', 'archive', 'group']
const raw = import.meta.env as Record<string, string | undefined>

const str = (key: string, fallback: string): string =>
  raw[key] === undefined ? fallback : String(raw[key]).trim()

const bool = (key: string, fallback: boolean): boolean => {
  const v = raw[key]
  if (v === undefined) return fallback
  return String(v).trim().toLowerCase() === 'true'
}

const num = (key: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
  const v = Number(raw[key])
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

const list = (key: string, fallback: string[]): string[] => {
  const v = raw[key]
  if (v === undefined) return fallback
  const parsed = String(v).split(',').map((s) => s.trim()).filter(Boolean)
  return parsed.length ? parsed : fallback
}

const patterns = (key: string, fallback: string[]): RegExp[] =>
  list(key, fallback).flatMap((p) => {
    try {
      return [new RegExp(p, 'i')]
    } catch {
      return []
    }
  })

export const envWarnings: string[] = []

/* ---------------- 视图配置 ---------------- */
const defaultLabels = ['观察', '预演', '画像', '陪练', '档案', '群体']
const enabledRaw = list('VITE_ENABLED_VIEWS', ALL_VIEWS).filter((v): v is ViewId =>
  ALL_VIEWS.includes(v as ViewId),
)
const enabledViews = enabledRaw.length ? enabledRaw : ALL_VIEWS
const labelsRaw = list('VITE_VIEW_LABELS', defaultLabels)
const navLabels: Record<ViewId, string> = {} as Record<ViewId, string>
ALL_VIEWS.forEach((v, i) => {
  navLabels[v] = labelsRaw[i] ?? defaultLabels[i]
})
if (labelsRaw.length !== ALL_VIEWS.length) {
  envWarnings.push('VITE_VIEW_LABELS 数量与视图数不一致，缺失项已回退默认标签。')
}
const initialViewRaw = str('VITE_INITIAL_VIEW', 'intake') as ViewId
const initialView: ViewId = enabledViews.includes(initialViewRaw) ? initialViewRaw : enabledViews[0]

/* ---------------- 合规硬约束 ---------------- */
const consentConfigured = bool('VITE_FEEDBACK_CONSENT_DEFAULT', false)
if (consentConfigured) {
  envWarnings.push(
    '单独授权不得默认勾选。VITE_FEEDBACK_CONSENT_DEFAULT=true 已被强制回退为 false。',
  )
}
const feedbackConsentDefault = false

const scenarioCount = num('VITE_SCENARIO_COUNT', 3, 2, 3)
const minScenarioCount = num('VITE_MIN_SCENARIO_COUNT', 2, 2, 3)
if (scenarioCount < minScenarioCount) {
  envWarnings.push('VITE_SCENARIO_COUNT 小于 VITE_MIN_SCENARIO_COUNT，已按最小值处理。')
}

export const env = {
  app: {
    name: str('VITE_APP_NAME', 'RFR · 关系摩擦预演器'),
    version: str('VITE_APP_VERSION', '0.1.0'),
    tagline: str('VITE_APP_TAGLINE', '先预演，再开口'),
    heroCtaGate: str('VITE_HERO_CTA_GATE', '先确认年龄'),
    heroLine1: str('VITE_HERO_LINE_1', 'Where'),
    heroEm1: str('VITE_HERO_EM_1', 'friction'),
    heroLine2: str('VITE_HERO_LINE_2', 'meets'),
    heroEm2: str('VITE_HERO_EM_2', 'clarity'),
    heroDesc: str('VITE_HERO_DESC', ''),
    heroCta: str('VITE_HERO_CTA', 'Start Rehearsal'),
    waveTitle: str('VITE_WAVE_TITLE', '情绪波动'),
    waveStatus: str('VITE_WAVE_STATUS', '实时'),
    brandImage: str('VITE_BRAND_IMAGE_URL', ''),
    sceneImages: [
      str('VITE_SCENE_IMAGE_1_URL', ''),
      str('VITE_SCENE_IMAGE_2_URL', ''),
      str('VITE_SCENE_IMAGE_3_URL', ''),
    ],
  },

  views: {
    enabled: enabledViews,
    labels: navLabels,
    initial: initialView,
    transitionMs: num('VITE_TRANSITION_DURATION_MS', 240, 80, 3000),
    holdMs: num('VITE_TRANSITION_HOLD_MS', 40, 0, 2000),
    releaseMs: num('VITE_TRANSITION_RELEASE_MS', 240, 80, 3000),
  },

  api: {
    baseUrl: str('VITE_API_BASE_URL', 'http://localhost:8000'),
    useMock: bool('VITE_USE_MOCK', true),
    sse: bool('VITE_SSE_ENABLED', false),
    timeoutMs: num('VITE_REQUEST_TIMEOUT_MS', 15000, 1000, 120000),
    intake: str('VITE_API_INTAKE_PATH', '/api/v1/intake'),
    rehearsal: str('VITE_API_REHEARSAL_PATH', '/api/v1/rehearsal'),
    profile: str('VITE_API_PROFILE_PATH', '/api/v1/profile'),
    script: str('VITE_API_SCRIPT_PATH', '/api/v1/script'),
    feedback: str('VITE_API_FEEDBACK_PATH', '/api/v1/feedback'),
  },

  features: {
    bEnd: bool('VITE_ENABLE_B_END', true),
    paidScript: bool('VITE_ENABLE_PAID_SCRIPT', true),
    roleCard: bool('VITE_ENABLE_ROLE_CARD', true),
    exportArchive: bool('VITE_ENABLE_EXPORT', true),
    deleteArchive: bool('VITE_ENABLE_DELETE', true),
    feedback: bool('VITE_ENABLE_FEEDBACK', true),
    weeklyTrend: bool('VITE_ENABLE_WEEKLY_TREND', true),
    complianceBadge: bool('VITE_ENABLE_COMPLIANCE_BADGE', true),
    ageGate: bool('VITE_ENABLE_AGE_GATE', true),
    quickPanel: bool('VITE_ENABLE_QUICK_PANEL', true),
    seedDemoData: bool('VITE_SEED_DEMO_DATA', false),
  },

  /** 本机演示持久化：仅浏览器本地，不上传；版本号变更会清空旧键 */
  storage: {
    version: num('VITE_STORAGE_VERSION', 2, 1, 99),
  },

  flow: {
    scenarioCount: Math.max(scenarioCount, minScenarioCount),
    intensities: list('VITE_SCENARIO_INTENSITIES', ['low', 'mid', 'mid-high']),
    allowHighIntensity: bool('VITE_ALLOW_HIGH_INTENSITY', false),
    maxRewrite: num('VITE_MAX_REWRITE', 2, 0, 5),
    maxFreeTextLength: num('VITE_MAX_FREE_TEXT_LENGTH', 300, 50, 2000),
    choicePrompt: str('VITE_CHOICE_PROMPT', '你最可能会怎么做？'),
    profileTitle: str('VITE_PROFILE_TITLE', '你的应对方式'),
    profileSubtitle: str('VITE_PROFILE_SUBTITLE', '只说刚才这几轮你怎么选的'),
    evlnLabels: list('VITE_EVLN_LABELS', [
      '说出来，好好说', '说出来，带点刺', '先忍着，等一等', '不回应，冷处理',
    ]),
    axisActive: str('VITE_AXIS_ACTIVE', '主动说'),
    axisPassive: str('VITE_AXIS_PASSIVE', '先等等'),
    axisConstructive: str('VITE_AXIS_CONSTRUCTIVE', '好好说'),
    axisDestructive: str('VITE_AXIS_DESTRUCTIVE', '带情绪'),
    scriptTitle: str('VITE_SCRIPT_TITLE', '开口前练一遍'),
    scriptHint: str('VITE_SCRIPT_SECTION_HINT', '一句话怎么说，对方不接怎么办'),
  },

  pricing: {
    currency: str('VITE_CURRENCY_SYMBOL', '¥'),
    scriptPrice: num('VITE_SCRIPT_PRICE_CNY', 19.9, 0, 9999),
    subscriptionPrice: num('VITE_SUBSCRIPTION_PRICE_CNY', 39, 0, 9999),
  },

  compliance: {
    ageGateText: str('VITE_AGE_GATE_TEXT', '本工具面向 18 岁以上用户，请确认年龄。'),
    feedbackConsentDefault,
    feedbackConsentText: str('VITE_FEEDBACK_CONSENT_TEXT', '反馈用于角色卡更新'),
    feedbackConsentHint: str('VITE_FEEDBACK_CONSENT_HINT', '单独授权 · 默认关闭 · 可随时撤回'),
    retentionDays: num('VITE_RAW_TEXT_RETENTION_DAYS', 7, 1, 90),
    deleteSlaHours: num('VITE_DELETE_SLA_HOURS', 24, 1, 168),
    anonymizeText: str('VITE_ANONYMIZE_TEXT', '原始文字会匿名处理'),
    anonymizeHint: str('VITE_ANONYMIZE_HINT', '出结果后就开始倒计时'),
    hotlineName: str('VITE_CRISIS_HOTLINE_NAME', '希望24热线'),
    hotlineNumber: str('VITE_CRISIS_HOTLINE_NUMBER', '400-161-9995'),
    crisisResource: str('VITE_CRISIS_RESOURCE_TEXT', '如果很难受，请找专业的人聊聊。'),
    guardEnabled: bool('VITE_COMPLIANCE_GUARD_ENABLED', true),
    blockManipulation: bool('VITE_GUARD_BLOCK_MANIPULATION', true),
    blockFatalism: bool('VITE_GUARD_BLOCK_FATALISM', true),
    blockHighRisk: bool('VITE_GUARD_BLOCK_HIGH_RISK', true),
    manipulationPatterns: patterns('VITE_GUARD_MANIPULATION_PATTERNS', ['拿捏', '操控']),
    fatalismPatterns: patterns('VITE_GUARD_FATALISM_PATTERNS', ['没戏了', '注定']),
    highRiskPatterns: patterns('VITE_GUARD_HIGH_RISK_PATTERNS', ['自杀', '不想活']),
    manipulationNotice: str('VITE_GUARD_MANIPULATION_NOTICE', '这类请求我们不接。'),
    fatalismNotice: str('VITE_GUARD_FATALISM_NOTICE', '这里不对关系下结论。'),
    highRiskNotice: str('VITE_GUARD_HIGH_RISK_NOTICE', '先照顾好自己。'),
    disclaimerShort: str('VITE_DISCLAIMER_SHORT', '不是心理咨询，也不替你判断关系'),
    disclaimerFull: str('VITE_DISCLAIMER_FULL', '这里只帮你练怎么开口。'),
  },

  domain: {
    relationshipTypes: list('VITE_RELATIONSHIP_TYPES', ['搭子', '初识', '轻社交']),
    frictionEvents: list('VITE_FRICTION_EVENT_TYPES', ['临时取消', '热度下降', '越界分享', '延迟回复']),
    hesitationTypes: list('VITE_HESITATION_TYPES', ['说还是不说', '是不是太敏感']),
    commitmentLevels: list('VITE_COMMITMENT_LEVELS', ['低', '中低', '中']),
    boundaryLevels: list('VITE_BOUNDARY_LEVELS', ['模糊', '一般', '清晰']),
    priorResponsiveness: list('VITE_PRIOR_RESPONSIVENESS_LEVELS', ['通常很快', '时快时慢', '经常很慢']),
    messageUrgency: list('VITE_MESSAGE_URGENCY_LEVELS', ['不急', '一般', '较急']),
    uncertaintySources: list('VITE_UNCERTAINTY_SOURCES', ['自我', '对方', '关系']),
  },

  group: {
    sampleSize: num('VITE_GROUP_SAMPLE_SIZE', 48, 1, 100000),
    batchLabels: list('VITE_GROUP_BATCH_LABELS', ['第 1 批', '第 2 批', '第 3 批']),
    notice: str('VITE_GROUP_REPORT_NOTICE', '只看整体比例。'),
    discussionGuide: str('VITE_GROUP_DISCUSSION_GUIDE', '把选择当成当时还能怎么做。'),
    sampleBadge: str('VITE_GROUP_SAMPLE_BADGE', '演示样例 · 非真实统计'),
    sampleLabel: str('VITE_GROUP_SAMPLE_LABEL', '样例规模'),
    demoNotice: str('VITE_GROUP_DEMO_NOTICE', '这是演示视图，数字不是真实统计。'),
  },

  /** 快捷面板：账户 / 付费 / 设置 / 管理的全部文案与开关 */
  panel: {
    defaultTab: num('VITE_PANEL_DEFAULT_TAB', 0, 0, 3),
    trigger: str('VITE_PANEL_TRIGGER', '账户'),
    title: str('VITE_PANEL_TITLE', 'Account'),
    tabs: list('VITE_PANEL_TABS', ['账户', '付费', '设置', '管理']),
    subtitle: str('VITE_PANEL_SUBTITLE', '演示环境 · 数据仅存本地'),
    disclaimer: str('VITE_PANEL_DISCLAIMER', '不是咨询，也不上传你的数据'),
    close: str('VITE_PANEL_CLOSE', '关闭'),
    guest: str('VITE_PANEL_GUEST', '未登录'),
    nameLabel: str('VITE_PANEL_NAME_LABEL', '昵称或邮箱'),
    namePlaceholder: str('VITE_PANEL_NAME_PLACEHOLDER', '给自己起个名字'),
    signIn: str('VITE_PANEL_SIGN_IN', '登录 / 注册'),
    signOut: str('VITE_PANEL_SIGN_OUT', '退出登录'),
    signInNote: str('VITE_PANEL_SIGN_IN_NOTE', '演示登录 · 不验证身份 · 不上传信息'),
    planFree: str('VITE_PANEL_PLAN_FREE', '免费体验'),
    planSingle: str('VITE_PANEL_PLAN_SINGLE', '单次解锁'),
    planSub: str('VITE_PANEL_PLAN_SUB', '订阅中'),
    accountArchive: str('VITE_PANEL_ACCOUNT_ARCHIVE', '档案'),
    accountPlan: str('VITE_PANEL_ACCOUNT_PLAN', '当前方案'),
    singleTitle: str('VITE_PANEL_SINGLE_TITLE', '单次解锁'),
    singleDesc: str('VITE_PANEL_SINGLE_DESC', '一次完整的行动前陪练'),
    subTitle: str('VITE_PANEL_SUB_TITLE', '月度订阅'),
    subDesc: str('VITE_PANEL_SUB_DESC', '更多练习与记录'),
    payBuy: str('VITE_PANEL_PAY_BUY', '解锁'),
    paySubscribe: str('VITE_PANEL_PAY_SUBSCRIBE', '订阅'),
    payUnlocked: str('VITE_PANEL_PAY_UNLOCKED', '已解锁'),
    payPeriod: str('VITE_PANEL_PAY_PERIOD', '/月'),
    payNote: str('VITE_PANEL_PAY_NOTE', '演示付费 · 不产生真实订单'),
    setFeedback: str('VITE_PANEL_SET_FEEDBACK', '反馈用于角色卡更新'),
    setFeedbackHint: str('VITE_PANEL_SET_FEEDBACK_HINT', '单独授权 · 默认关闭 · 可撤回'),
    setAnonymize: str('VITE_PANEL_SET_ANONYMIZE', '原始文本匿名化'),
    setAnonymizeHint: str('VITE_PANEL_SET_ANONYMIZE_HINT', '画像合成后进入删除倒计时'),
    setMode: str('VITE_PANEL_SET_MODE', '当前模式'),
    setGuard: str('VITE_PANEL_SET_GUARD', '安全过滤'),
    manageArchive: str('VITE_PANEL_MANAGE_ARCHIVE', '档案数'),
    manageVersion: str('VITE_PANEL_MANAGE_VERSION', '角色卡版本'),
    manageExport: str('VITE_PANEL_MANAGE_EXPORT', '导出 JSON'),
    manageDelete: str('VITE_PANEL_MANAGE_DELETE', '删除全部'),
    manageDeleteConfirm: str('VITE_PANEL_MANAGE_DELETE_CONFIRM', '确认删除全部本地记录？'),
    manageDeleteYes: str('VITE_PANEL_MANAGE_DELETE_YES', '确认'),
    manageCancel: str('VITE_PANEL_MANAGE_CANCEL', '取消'),
    manageNote: str('VITE_PANEL_MANAGE_NOTE', '导出在浏览器本地生成'),
    lockTitle: str('VITE_PANEL_LOCK_TITLE', '本次陪练尚未解锁'),
    lockDesc: str('VITE_PANEL_LOCK_DESC', '解锁后就能看到怎么说。'),
    lockButton: str('VITE_PANEL_LOCK_BUTTON', '去解锁'),
    /* O-07：解锁前必须有价格确认，且未登录不能凭空拿到付费方案 */
    payConfirmTitle: str('VITE_PANEL_PAY_CONFIRM_TITLE', '确认一下'),
    payConfirmDesc: str('VITE_PANEL_PAY_CONFIRM_DESC', '演示付费 · 不产生真实订单'),
    payConfirmYes: str('VITE_PANEL_PAY_CONFIRM_YES', '确认解锁'),
    payConfirmCancel: str('VITE_PANEL_PAY_CONFIRM_CANCEL', '再想想'),
    payNeedSignIn: str('VITE_PANEL_PAY_NEED_SIGNIN', '先填个昵称（演示登录）'),
    /* O-10：未接线开关必须如实标注 */
    setActive: str('VITE_PANEL_SET_ACTIVE', '当前演示已生效'),
    setNotWired: str('VITE_PANEL_SET_NOT_WIRED', '后端阶段启用，当前演示未生效'),
    setRetention: str('VITE_PANEL_SET_RETENTION', '原文保留'),
    setDeleteSla: str('VITE_PANEL_SET_SLA', '删除时限'),
    setRewrite: str('VITE_PANEL_SET_REWRITE', '纠错上限'),
  },

  /** 界面短文案：结论、出题依据、脚本适配、样例标识（一律白话，不带术语） */
  ui: {
    blockAge: str('VITE_BLOCK_AGE', '请先完成年龄确认'),
    blockEvent: str('VITE_BLOCK_EVENT', '请至少选一类情况'),
    guardInline: str('VITE_GUARD_INLINE', '这条内容我们没法用于出题。'),
    intakeBasis: str('VITE_INTAKE_BASIS', '选一选你遇到的情况，我们据此出题。'),
    intakeTwoHint: str('VITE_INTAKE_TWO_HINT', '这两点会影响题目。'),
    noAnswerHint: str('VITE_REHEARSAL_NO_ANSWER', '没有标准答案，按第一反应选。'),
    basis: str('VITE_REHEARSAL_BASIS', '按：{basis} 选了 {n} 题'),
    transfer: str('VITE_REHEARSAL_TRANSFER', '换一种情况'),
    construct: str('VITE_REHEARSAL_CONSTRUCT', '这一题想看的是：{construct}'),
    profileMixed: str('VITE_PROFILE_MIXED', '这几次不太一样'),
    profileMixedHint: str('VITE_PROFILE_MIXED_HINT', '没有哪一类占多数，先不下单一结论。'),
    consistency: str('VITE_PROFILE_CONSISTENCY', '一致性'),
    consistencyHint: str('VITE_PROFILE_CONSISTENCY_HINT', '只表示几次选择像不像，不代表测得准不准。'),
    distribution: str('VITE_PROFILE_DISTRIBUTION', '几次选择分别靠近'),
    scriptBased: str('VITE_SCRIPT_BASED', '基于刚才 {n} 次选择'),
    scriptFocus: str('VITE_SCRIPT_FOCUS', '本次只针对：{primary}'),
    scriptSwitch: str('VITE_SCRIPT_SWITCH', '换一件事'),
    scriptLowAgency: str('VITE_SCRIPT_LOW_AGENCY', '不用一次说完，先发一句就够。'),
    scriptLowConstructive: str('VITE_SCRIPT_LOW_CONSTRUCTIVE', '先缓一下，等语气平了再说这句。'),
    scriptMixed: str('VITE_SCRIPT_MIXED', '这几次选择不太一样，先挑最容易做到的那句。'),
    scriptStopEarly: str('VITE_SCRIPT_STOP_EARLY', '一有想争辩的冲动，就先停，别急着发第二条。'),
    archiveSample: str('VITE_ARCHIVE_SAMPLE', '样例 · 已脱敏'),
    archiveLocal: str('VITE_ARCHIVE_LOCAL', '本机记录'),
    trendEmpty: str('VITE_ARCHIVE_TREND_EMPTY', '还没有足够记录，先做几次练习。'),
    trendTitle: str('VITE_ARCHIVE_TREND_TITLE', '每次练习的主动程度'),
  },
} as const

/* O-10：定义但未接线到业务逻辑的配置，在开发期如实告警，避免界面暗示「已生效」 */
envWarnings.push(
  'VITE_RAW_TEXT_RETENTION_DAYS / VITE_DELETE_SLA_HOURS / VITE_MAX_REWRITE / VITE_SSE_ENABLED 属于后端阶段配置，当前演示未接线，界面须标注。',
)

export type AppConfig = typeof env

/** 视图是否启用（B 端未开启时群体看板不进入导航） */
export const isViewEnabled = (id: ViewId): boolean => env.views.enabled.includes(id)
