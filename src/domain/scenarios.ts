import { env } from '../config/env'
import {
  contextFromIntake,
  hashString,
  scoreSeed,
  sessionSeedOf,
  shuffleWithSeed,
} from './context'
import { goldOf } from './scenario-gold'
import type {
  ConstructTarget,
  EvlnCode,
  IntakeData,
  Intensity,
  Scenario,
  ScenarioOption,
} from './types'

/**
 * 构念驱动的场景库
 * ------------------------------------------------------------------
 * · 每个场景显式标注：欲测构念、不确定性来源、强度、干扰项理由
 * · 选项措辞固定为「你最可能会怎么做？」；分类标签不进入可见 DOM
 * · 选项顺序按场景 id + 本次填写做确定性洗牌，避免 A→D 由好到差
 * · 每个场景必须携带「对方未按预期回应」的障碍分支
 * · 强度由易到难分级；承诺水平低时不出最难的题
 * · 上下文的「平时回复 / 急不急 / 关系 / 边界」由用户填写生成，不写死
 * · 期望模式标注独立在 scenario-gold.ts，与界面数据分离
 */

export const EVLN_META: Record<
  EvlnCode,
  { label: string; zh: string; plain: string; agency: number; constructiveness: number }
> = {
  voice: { label: 'Voice', zh: '主动 · 建设', plain: '好好说出来', agency: 1, constructiveness: 1 },
  exit: { label: 'Exit', zh: '主动 · 破坏', plain: '带刺地说出来', agency: 1, constructiveness: -1 },
  loyalty: { label: 'Loyalty', zh: '被动 · 建设', plain: '先忍一忍', agency: -1, constructiveness: 1 },
  neglect: { label: 'Neglect', zh: '被动 · 破坏', plain: '干脆不回应', agency: -1, constructiveness: -1 },
}

interface ScenarioSeed {
  id: string
  stressorType: string
  intensity: Intensity
  uncertaintySource: string
  constructTarget: ConstructTarget
  narrative: string
  context: string[]
  obstacle: string
  choices: Record<EvlnCode, string>
  distractor: string
}

const CANCEL = () => env.domain.frictionEvents[0] ?? '临时取消'
const COOLING = () => env.domain.frictionEvents[1] ?? '热度下降'
const CROSS = () => env.domain.frictionEvents[2] ?? '越界分享'
const REPLY = () => env.domain.frictionEvents[3] ?? '延迟回复'

const SEEDS: ScenarioSeed[] = [
  /* ---------------------------- 临时取消 ---------------------------- */
  {
    id: 'cancel-low',
    stressorType: CANCEL(),
    intensity: 'low',
    uncertaintySource: '自我',
    constructTarget: 'boundary',
    narrative:
      '你们约好周六下午去看展。出发前两小时，对方发来一句「今天有点事，下次吧」——没有解释，也没有提新的时间。你已经换好衣服，甚至走到了地铁站。',
    context: ['关系：定义尚未确立', '平时回复：通常很快', '这条消息：不急', '拿不准的是：自我'],
    obstacle: '你发出回应后，对方只回了一个「嗯嗯」，没有再提重新约时间。',
    choices: {
      voice: '回一句「好，那你先忙；下次定时间之前方便的话跟我说一声，我就先不空出整段时间了」。',
      exit: '直接问「你是不是根本不想来」，或者回一个「行吧」之后就不再主动联系。',
      loyalty: '说「没事，那下次吧」，把已经出门这件事咽回去，等对方主动再约。',
      neglect: '不回，或者隔很久回一个「哦」，让这件事自己过去。',
    },
    distractor: '「没事，那下次吧」是维持表面和谐的强干扰项，用来区分建设性表达与被动迁就。',
  },
  {
    id: 'cancel-mid',
    stressorType: CANCEL(),
    intensity: 'mid',
    uncertaintySource: '对方',
    constructTarget: 'rejection_appraisal',
    narrative:
      '这已经是这个月第二次了。上次对方临时取消后说「我补你」，但之后再没提。你发现自己开始反复斟酌措辞，怕显得太计较。',
    context: ['关系：可进可退', '平时回复：时快时慢', '这条消息：一般', '拿不准的是：对方'],
    obstacle: '你提了一句「上次好像也是」，对方回「最近真的忙，别多想」，话题就此打住。',
    choices: {
      voice: '说「两次都没成，我有点拿不准要不要再约；你方便的时候给个准话就行」。',
      exit: '把两次取消一起翻出来，问「你到底有没有把这事当回事」。',
      loyalty: '说「没事没事，你忙你的」，然后在心里把「我补你」那句话划掉。',
      neglect: '不再提，也不再约，等对方想起来；同时默默把周末安排改成别的。',
    },
    distractor: '「别多想」是典型的模糊线索，用于观察用户是否把负性解读当成事实。',
  },
  {
    id: 'cancel-midhigh',
    stressorType: CANCEL(),
    intensity: 'mid-high',
    uncertaintySource: '关系',
    constructTarget: 'agency',
    narrative:
      '原本说好由你们一起定的周末计划，对方在共同群里直接宣布「这周我不去了」，像是在对所有人说，但你其实是最早约上的那个。你不确定自己有没有立场说什么。',
    context: ['关系：定义混乱', '平时回复：时快时慢', '这条消息：不急', '拿不准的是：关系'],
    obstacle: '你私下发了一句「我其实有点没反应过来」，对方隔了很久回「啊？就这点事啊」。',
    choices: {
      voice: '私下说「群里那句我看到啦，下次如果不去了，先跟我说一声就好，我好安排」。',
      exit: '在群里回一句带刺的话，让大家都知道是你先被放了鸽子。',
      loyalty: '什么也不说，照旧在群里配合气氛，之后也不再提这个约定。',
      neglect: '退出群聊讨论，接下来几天对所有共同安排都不表态。',
    },
    distractor: '公开场合的轻度失礼会放大「我有没有资格开口」的自我不确定性。',
  },

  /* ---------------------------- 热度下降 ---------------------------- */
  {
    id: 'cool-low',
    stressorType: COOLING(),
    intensity: 'low',
    uncertaintySource: '对方',
    constructTarget: 'rejection_appraisal',
    narrative:
      '前几周你们几乎每天都聊。这两天对方回复变短，表情包少了，也不再主动抛新话题。你说不清是忙，还是气氛变了。',
    context: ['线索类型：模糊的情绪线索', '平时回复：时快时慢', '这条消息：不急', '拿不准的是：对方'],
    obstacle: '你试着聊了个新话题，对方隔了半天回「哈哈 挺好」，没有接下去。',
    choices: {
      voice: '先不追问，按自己的节奏聊一次；如果还是这样，就轻轻说一句「感觉最近聊得少了，是忙吗」。',
      exit: '直接发「你最近怎么这么冷淡」，把这两天的回复截图式的细节列出来。',
      loyalty: '把话题挑得更有趣一点，替对方找「可能只是忙」的解释，不提自己的感受。',
      neglect: '也不主动发了，等对方先来找你；期间反复看对方有没有更新动态。',
    },
    distractor: '热度下降属模糊线索，考察用户是否先拆分「事实」与「解读」（认知重评，§2.2）。',
  },
  {
    id: 'cool-mid',
    stressorType: COOLING(),
    intensity: 'mid',
    uncertaintySource: '自我',
    constructTarget: 'boundary',
    narrative:
      '你开始反复翻聊天记录，想找出是哪一句话让语气变了。还没问出口，已经想了好几种问法，又都删掉了。',
    context: ['线索类型：效价偏差 / 反刍', '平时回复：通常很快', '这条消息：一般', '拿不准的是：自我'],
    obstacle: '你最后发了一句「是不是我上次说的那句有点怪」，对方回「？没有啊」，对话停在这里。',
    choices: {
      voice: '说「可能我想多了，不过我这两天确实有点拿不准；你方便的时候随便回我一句就行」。',
      exit: '连着发好几条解释自己那天不是那个意思，一定要对方给个明确说法。',
      loyalty: '赶紧说「哈哈 没事没事」，把刚才那句也算成自己的多想，继续不提。',
      neglect: '撤回消息，之后几天只用最简短的词回复。',
    },
    distractor: '「我是不是太敏感」的自我怀疑是核心犹豫，检验能否在不上纲上线的前提下表达。',
  },
  {
    id: 'cool-midhigh',
    stressorType: COOLING(),
    intensity: 'mid-high',
    uncertaintySource: '关系',
    constructTarget: 'constructiveness',
    narrative:
      '共同朋友问你「你们最近是不是不怎么联系了」。你意识到这段关系的状态连旁人都看出来了，但你们从没定义过它。',
    context: ['关系：situationship / 定义混乱', '平时回复：经常很慢', '这条消息：不急', '拿不准的是：关系'],
    obstacle: '你把这件事当玩笑提了一句，对方笑着把话题带过去，没有接。',
    choices: {
      voice: '不借旁人的话施压，只说「我这边其实还挺想照常约的，你如果最近想少聊一点也直接说，我好调整」。',
      exit: '把朋友的话转过去，问「别人都看出来了，我们到底算什么」。',
      loyalty: '对朋友说「没有啦，都挺正常的」，然后继续照原来的频率发消息。',
      neglect: '不再主动，也不回应朋友的追问，让关系自然淡下去。',
    },
    distractor: '「我们谈谈关系」在低承诺关系中属施压措辞，是必须被排除的干扰项（§4.6）。',
  },

  /* ---------------------------- 越界分享 ---------------------------- */
  {
    id: 'cross-low',
    stressorType: CROSS(),
    intensity: 'low',
    uncertaintySource: '关系',
    constructTarget: 'boundary',
    narrative:
      '你只跟对方说过一件还没公开的私事。今天在共同群里，有人顺口提了一句那件事，并说「是 TA 跟我说的」。你不确定对方是有意，还是没意识到。',
    context: ['CPM：私有信息已成「共同所有」', '边界规则：未明示', '这条消息：不急', '拿不准的是：关系'],
    obstacle: '你私下发了个略带试探的「哈哈 这个你也说啦」，对方回「啊 不能说吗」，没有道歉。',
    choices: {
      voice: '说「那件事我当时还没打算让别人知道，之后我的事就先别往外说啦，其他的照常」。',
      exit: '质问「你凭什么把我的事说出去」，并要求对方在群里解释清楚。',
      loyalty: '说「没事啦，也不是什么大事」，但之后把想说的话都收回去。',
      neglect: '不解释也不提，从此只聊无关紧要的话题。',
    },
    distractor: '「不是什么大事」是社会性否定痛苦的典型说法，用于检验边界表达是否被自我取消（§2.6）。',
  },
  {
    id: 'cross-mid',
    stressorType: CROSS(),
    intensity: 'mid',
    uncertaintySource: '自我',
    constructTarget: 'agency',
    narrative:
      '那件事你当时说过「先别跟别人讲」。现在被转述的内容还多了一点你没说过的细节。你有点不舒服，但也在想是不是自己太敏感。',
    context: ['CPM：边界湍流 / 规则误读', '边界规则：曾口头说明', '这条消息：一般', '拿不准的是：自我'],
    obstacle: '你说明「我当初提过先别讲」，对方回「这不也没造成什么影响嘛」。',
    choices: {
      voice: '说「影响确实不大，不过我当时说过先别讲；以后这类事你先问我就好」，然后不再追这句。',
      exit: '把「你加的细节」逐条列出来对质，要求对方承认是故意的。',
      loyalty: '点头说「也是，那算了」，回去之后反复想自己是不是反应过度。',
      neglect: '不再纠正，也不再分享任何私事，但表面照旧。',
    },
    distractor: '「后果不严重」不等于边界没被越过，检验用户能否区分功利后果与情绪性后果。',
  },
  {
    id: 'cross-midhigh',
    stressorType: CROSS(),
    intensity: 'mid-high',
    uncertaintySource: '关系',
    constructTarget: 'constructiveness',
    narrative:
      '类似的转述已经发生第二次了。你开始考虑以后哪些话不再说，但也意识到自己正在悄悄把这段关系降级，而没有告诉对方。',
    context: ['CPM：边界湍流反复发生', '相对权力：不对称', '这条消息：较急', '拿不准的是：关系'],
    obstacle: '你终于说了一句「以后我的事别往外说」，对方回「你也太见外了吧，我们不是朋友吗」。',
    choices: {
      voice: '说「不是见外，就是这条我想说清楚；别的照旧」，不解释第二遍，也不把整段关系拉进来评理。',
      exit: '回「朋友会这么做吗」，顺带把之前几次都翻出来。',
      loyalty: '赶紧说「开玩笑的啦」，并把「别往外说」这句话收回。',
      neglect: '不回应这句话，此后只用最表面的方式相处，慢慢不再出现。',
    },
    distractor: '「我们不是朋友吗」把边界请求上升为关系审判，是低承诺情境里最强的迁就诱因。',
  },

  /* ---------------------------- 延迟回复 ---------------------------- */
  {
    id: 'reply-low',
    stressorType: REPLY(),
    intensity: 'low',
    uncertaintySource: '对方',
    constructTarget: 'rejection_appraisal',
    narrative:
      '你发了条约时间的消息，对方已读，三小时没回。平时 TA 通常很快回。你知道这可能什么也不是，但还是看了两次手机。',
    context: ['平时回复：通常很快', '这条消息：一般', '延迟容忍阈值：偏短', '拿不准的是：对方'],
    obstacle: '你补了一个表情包缓和气氛，对方到晚上才回「刚看到」，没有接时间。',
    choices: {
      voice: '不再追加，等一天；如果还没定，就说「时间我先不定死啦，你方便的时候说一声」。',
      exit: '连发两条追问「看到了吗」「是不是不方便」，把已读这件事点出来。',
      loyalty: '说「不急不急，你忙」，然后一直把那条约时间的消息留着不撤。',
      neglect: '把消息撤回，也不再提时间，假装这个约定本来就不存在。',
    },
    distractor: '既往响应基线显著改变延迟容忍阈值，考察用户是否把「比平时慢」直接读成拒绝。',
  },
  {
    id: 'reply-mid',
    stressorType: REPLY(),
    intensity: 'mid',
    uncertaintySource: '自我',
    constructTarget: 'agency',
    narrative:
      '你认真写了一段关于自己近况的话，隔了一天，对方只回了一个「嗯」。你盯着那个字，删掉了已经打好的追问。',
    context: ['平时回复：时快时慢', '这条消息：较急', '线索类型：模糊的情绪线索', '拿不准的是：自我'],
    obstacle: '第二天对方像没事一样发来别的话题，没有提昨天那段话。',
    choices: {
      voice: '照常接新话题，过一会儿轻轻补一句「昨天那段其实想跟你聊聊，你要是有空再说」。',
      exit: '回「就一个嗯？」，或者把昨天的消息重发一遍让对方看清楚。',
      loyalty: '接住新话题，把昨天那段当作自己说多了，之后再不写长消息。',
      neglect: '已读不回一两天，用同样的沉默回应。',
    },
    distractor: '「删掉追问」是执行失败而非技能缺陷（SIT 第一阶段），场景用于识别触发线索。',
  },
  {
    id: 'reply-midhigh',
    stressorType: REPLY(),
    intensity: 'mid-high',
    uncertaintySource: '关系',
    constructTarget: 'boundary',
    narrative:
      '上次约好由 TA 确认时间，两天过去没有消息。你不确定该再问一次，还是就此把这件事放下——两种做法都让你有点累。',
    context: ['平时回复：经常很慢', '这条消息：较急', '留 / 走矛盾：被两个选项夹住', '拿不准的是：关系'],
    obstacle: '你问了「时间还作数吗」，对方回「再说吧」，然后连续几天没有下文。',
    choices: {
      voice: '说「那这次先不定了，之后你想约直接说一声就行」，把待确认的状态关掉，而不是继续等。',
      exit: '回「再说吧是几个意思」，把这两天的等待一并说出来。',
      loyalty: '继续把周末空着，怕自己一问就显得太需要这段关系。',
      neglect: '不再问，也不再安排，但在心里给这段关系记上一笔。',
    },
    distractor: '留 / 走矛盾（stay-leave ambivalence）不是冷漠，选项避免把「放下」写成居高临下的退出。',
  },
]

const INTENSITY_LABEL: Record<Intensity, string> = {
  low: '轻松', mid: '有点难', 'mid-high': '更难点', high: '很难',
}

function buildScenario(seed: ScenarioSeed, index: number, intake: IntakeData): Scenario {
  const unshuffled: ScenarioOption[] = (Object.keys(EVLN_META) as EvlnCode[]).map((code) => {
    const meta = EVLN_META[code]
    return {
      id: `${seed.id}-${code}`,
      evln: code,
      label: meta.label,
      text: seed.choices[code],
      agency: meta.agency,
      constructiveness: meta.constructiveness,
    }
  })
  // 同一会话 / 同一场景顺序稳定；不同场景顺序不同，且不泄露分类
  const options = shuffleWithSeed(unshuffled, hashString(seed.id) ^ sessionSeedOf(intake))
  return {
    id: seed.id,
    stressorType: seed.stressorType,
    intensity: seed.intensity,
    intensityLabel: INTENSITY_LABEL[seed.intensity],
    uncertaintySource: seed.uncertaintySource,
    constructTarget: seed.constructTarget,
    narrative: seed.narrative,
    context: contextFromIntake(intake, seed),
    obstacle: seed.obstacle,
    options,
    expectedPattern: goldOf(seed.id),
    distractorRationale: seed.distractor,
    image: env.app.sceneImages[index % env.app.sceneImages.length] ?? '',
  }
}

/** 全库按当前填写生成（不在模块层缓存，避免两次填写串味） */
export function buildScenarioBank(intake: IntakeData): Scenario[] {
  return SEEDS.map((seed, index) => buildScenario(seed, index, intake))
}

interface Ranked {
  seed: ScenarioSeed
  index: number
  score: number
  wanted: boolean
}

const byRank = (a: Ranked, b: Ranked) =>
  b.score - a.score ||
  Number(b.wanted) - Number(a.wanted) ||
  a.seed.id.localeCompare(b.seed.id)

/**
 * 动态选场景（原 Supervisor 的前端等价实现）
 * · 打分消费 constructTarget / uncertaintySource / 7 个表单字段
 * · 承诺低时压低强度上限；较急时优先回复类场景
 * · 单事件补足一题「换一种情况」，避免三题同源
 */
export function selectScenarios(intake: IntakeData): Scenario[] {
  const count = env.flow.scenarioCount
  const wanted = intake.frictionEvents.length
    ? intake.frictionEvents
    : [env.domain.frictionEvents[0] ?? '临时取消']
  const lowCommitment = intake.commitmentLevel === (env.domain.commitmentLevels[0] ?? '低')
  const levels = env.flow.intensities.slice(0, count)
  const allowed = lowCommitment
    ? levels.filter((l) => l === 'low' || l === 'mid')
    : levels

  const ranked: Ranked[] = SEEDS
    .map((seed, index) => ({
      seed,
      index,
      score: scoreSeed(seed, intake),
      wanted: wanted.includes(seed.stressorType),
    }))
    .filter((x) => env.flow.allowHighIntensity || x.seed.intensity !== 'high')
    .filter((x) => allowed.includes(x.seed.intensity))

  const picked: Ranked[] = []
  const transfers = new Set<string>()

  for (const level of levels) {
    if (picked.length >= count) break
    const hit = ranked
      .filter((x) => x.seed.intensity === level && !picked.includes(x))
      .sort(byRank)[0]
    if (hit) picked.push(hit)
  }

  // 补足：仍只在允许的强度内挑，且优先换一类情况
  const fill = [...ranked]
    .filter((x) => !picked.includes(x))
    .sort((a, b) => byRank(a, b) || Number(a.wanted) - Number(b.wanted))
  for (const candidate of fill) {
    if (picked.length >= count) break
    if (new Set(picked.map((x) => x.seed.stressorType)).size === 1) {
      const other = fill.find((x) => !wanted.includes(x.seed.stressorType) && !picked.includes(x))
      if (other && !picked.includes(other)) {
        picked.push(other)
        transfers.add(other.seed.id)
        continue
      }
    }
    picked.push(candidate)
  }

  // 全是同一类时，把最后一题换成别的压力事件
  if (picked.length > 1 && new Set(picked.map((x) => x.seed.stressorType)).size === 1) {
    const other = [...ranked]
      .filter((x) => !wanted.includes(x.seed.stressorType) && !picked.includes(x))
      .sort(byRank)[0]
    if (other) {
      picked[picked.length - 1] = other
      transfers.add(other.seed.id)
    }
  }

  return picked.slice(0, count).map((x) => ({
    ...buildScenario(x.seed, x.index, intake),
    transfer: transfers.has(x.seed.id),
  }))
}

export const CONSTRUCT_LABELS: Record<ConstructTarget, string> = {
  agency: '要不要主动说',
  constructiveness: '好好说还是带情绪',
  rejection_appraisal: '是不是被嫌弃了',
  boundary: '怎么把边界说清楚',
}

export const constructLabel = (target: ConstructTarget): string => CONSTRUCT_LABELS[target] ?? ''
