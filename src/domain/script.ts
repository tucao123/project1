import { env } from '../config/env'
import type { ActionScript, CopingProfile, IntakeData, ScriptBranch } from './types'

/**
 * 行动前陪练脚本（学术指导 §4.6 / §4.4）
 * ------------------------------------------------------------------
 * · 三段结构显式化为「if-then 执行意图 + if 分支 + 备用 if-then」
 * · anticipated_reactions 必须含至少一个非良性反应（MCII：先呈现现实障碍）
 * · 脚本先肯定对方的能动性（给选择权、不逼承诺），避免「你应该…」「我们谈谈关系」
 * · 必须给一个具体可执行动作，不能只给情绪安抚（承诺启动注册重复报告）
 * · 低期望条件下先处理可行性信念，不直接推 if-then 计划
 */

const STOP_CONDITION = '开始翻旧账，或连着发了两条解释，就先结束这轮。'

const NOTE = '这是练习，不是标准答案。先想好对方没接住时怎么办。'

interface ScriptTemplate {
  action: string
  branches: ScriptBranch[]
  fallback: string
}

const COMMON_ADVERSE: ScriptBranch = {
  key: '如果对方说「你太较真了」',
  text: '不辩解，也不撤回刚说的那句话；只重复一次边界，然后把话题放下。这不是关系判决，只是一次边界测试。',
  adverse: true,
}

const templates = (): ScriptTemplate[] => [
  {
    action:
      '如果对方在约定前临时取消、且没有提新的时间，我就说「好，那你先忙；下次定时间之前方便的话跟我说一声，我就先不空出整段时间了」',
    branches: [
      { key: '如果对方补了新时间 / 道了歉', text: '按新约定走，不追加解释，也不把这次当成「关系变好了」的结论。', adverse: false },
      { key: '如果对方只回「嗯嗯」', text: '不再追加第二条消息。把这次记为一次边界表达，而不是一次关系测试。', adverse: false },
      COMMON_ADVERSE,
    ],
    fallback:
      '如果对方否认、冷回应或把话题带走，我就只重复一次边界，不再解释；如果第二次仍被含糊带过，就结束这一轮，把决定留到下一次真实互动',
  },
  {
    action:
      '如果对方连续几天回复变短、我又开始反复翻聊天记录，我就先把「事实：回复变短」和「解读：可能不想聊了」分开写下来，再发一句不施压的话：「最近聊得少了，是忙吗？你方便的时候回我就行」',
    branches: [
      { key: '如果对方说「最近确实忙」', text: '接住这句话就停，不追问忙什么，也不要求对方补偿一次长聊。', adverse: false },
      { key: '如果对方隔半天回「哈哈 挺好」', text: '不追加第二条解释。把注意力拉回自己今天本来要做的事。', adverse: false },
      { key: '如果对方反问「你想多了吧」', text: '说「可能是我想多了」，然后不再解释；不把「我是不是太敏感」拿出来让对方裁决。', adverse: true },
    ],
    fallback:
      '如果对方没有接这个话题，我就不再补发第三条，把「等回复」这件事关掉；若一周内仍是我单方面发起，就先按自己的节奏安排周末',
  },
  {
    action:
      '如果我私下说的事被转述给共同朋友，我就说「那件事我当时还没打算让别人知道；之后我的事你先问我就好，别的照常」',
    branches: [
      { key: '如果对方说「啊 我没注意」', text: '说一句「好，那以后就这样」就停，不要求道歉或解释。', adverse: false },
      { key: '如果对方回「不能说吗」', text: '只把规则说清楚一次，不展开讨论这件事到底重不重要。', adverse: false },
      { key: '如果对方说「我们不是朋友吗，你也太见外」', text: '说「不是见外，就是这条我想说清楚」，不把整段关系拉进来评理。', adverse: true },
    ],
    fallback:
      '如果对方继续把边界请求解释成关系问题，我就不接这个框架，重复一次规则后结束对话；以后按新的边界决定分享多少，但不做宣告式降级',
  },
  {
    action:
      '如果已读未回超过我平时能接受的时间、且我已经想发第二条消息，我就先不发第二条，隔一天说「时间我先不定死啦，你方便的时候说一声」',
    branches: [
      { key: '如果对方给了明确时间', text: '按新时间走，不补一句「昨天等久了」，也不把这次当成对方的补偿。', adverse: false },
      { key: '如果对方回「刚看到」但没接时间', text: '不再追问，把待确认的状态关掉，按自己的安排过周末。', adverse: false },
      { key: '如果对方回「再说吧」', text: '说「那先不定了」，之后不反复查看手机；不用沉默去回应沉默。', adverse: true },
    ],
    fallback:
      '如果几天过去仍没有下文，我就不再发起第三次确认，也不在心里给这段关系记一笔；把「要不要继续约」留到下一次对方主动提出时再判断',
  },
]

/** 把「我就…」之后的具体动作交给打字机的衬线斜体强调 */
function highlightOf(text: string): [number, number] {
  const marker = '我就'
  const start = text.indexOf(marker)
  if (start < 0) return [0, 0]
  // 强调区间固定为「我就」之后到句末；旧实现以空串为目标做二次查找，结果恒等于起点，属无效分支
  return [start + marker.length, text.length]
}

function lowExpectation(intake: IntakeData): boolean {
  return (
    intake.commitmentLevel === (env.domain.commitmentLevels[0] ?? '低') &&
    (intake.hesitationType.includes('值不值得') ||
      env.compliance.fatalismPatterns.some((p) => p.test(intake.freeText)) ||
      env.compliance.fatalismPatterns.some((p) => p.test(intake.hesitationType)))
  )
}

/**
 * 画像适配层（O-06）
 * 模板主干不变，只按刚才的选择调整开场、停止条件与提示：
 * 偏被动 → 降到最小可执行动作；偏带情绪 → 先降温、提前停；
 * 混合画像 → 不追加个性化话术，只给通用脚本。
 */
function adaptScript(base: ActionScript, profile: CopingProfile): ActionScript {
  const lead: string[] = []
  let stopCondition = base.stopCondition
  let note = base.note

  if (!profile.mixed && profile.agency < 50) lead.push(env.ui.scriptLowAgency)
  if (!profile.mixed && profile.constructiveness < 50) {
    lead.push(env.ui.scriptLowConstructive)
    stopCondition = env.ui.scriptStopEarly
  }
  if (profile.mixed) note = env.ui.scriptMixed

  if (!lead.length && !profile.mixed) return base
  const actionText = lead.length ? `${lead.join('')}${base.actionText}` : base.actionText
  return {
    ...base,
    actionText,
    highlight: highlightOf(actionText),
    stopCondition,
    note,
  }
}

export function buildScript(
  intake: IntakeData,
  profile: CopingProfile,
  focus?: string,
): ActionScript {
  const events = intake.frictionEvents.length
    ? intake.frictionEvents
    : [env.domain.frictionEvents[0] ?? '临时取消']
  const primary = focus && events.includes(focus) ? focus : events[0]
  const idx = Math.max(0, env.domain.frictionEvents.indexOf(primary))
  const tpl = templates()[Math.min(idx, templates().length - 1)]
  const basedOn = env.ui.scriptBased.replace('{n}', String(profile.total))
  const focusText = env.ui.scriptFocus.replace('{primary}', primary)

  // 低期望分支优先级最高：不推话术，也不做画像适配
  if (lowExpectation(intake)) {
    const action =
      '先别急着开口。写下两句就行：我还想要什么、我愿意花多少力气。想清楚了再决定要不要说。'
    return {
      actionText: action,
      highlight: [0, 0],
      branches: [
        { key: '如果写完发现「其实没那么想要」', text: '那就把这次互动先放下，不需要给对方任何解释，也不必给自己下结论。', adverse: false },
        { key: '如果写完发现「还是想说一句」', text: '再回到陪练脚本，只挑一句最短的边界表达，不追加关系讨论。', adverse: false },
        { key: '如果两种想法来回摇摆', text: '这属于留 / 走矛盾，不是冷漠；允许这一次不做决定，也不把它当成性格判断。', adverse: true },
      ],
      fallback:
        '如果一想到要开口就发紧，这次就先不说，留到下次；这里只记下你的感受。',
      stopCondition: STOP_CONDITION,
      feasibilityFirst: true,
      note: '现在先帮你理清楚，不急着给话术。',
      focus: focusText,
      basedOn,
    }
  }

  return adaptScript(
    {
      actionText: tpl.action,
      highlight: highlightOf(tpl.action),
      branches: tpl.branches,
      fallback: tpl.fallback,
      stopCondition: STOP_CONDITION,
      feasibilityFirst: false,
      note: NOTE,
      focus: focusText,
      basedOn,
    },
    profile,
  )
}
