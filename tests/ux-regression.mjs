/**
 * RFR 前端回归清单（对应优化方案 §9 的 20 条断言，细分后逐条记录）
 * 运行前：npm run dev（默认 5173），且本机已安装 Chrome。
 * 依赖：puppeteer-core（已写入 devDependencies，npm install 即可）
 * 命令：npm run test:ux
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const readSrc = (rel) => readFileSync(path.join(ROOT, rel), 'utf8')
const URL = process.env.RFR_URL || 'http://localhost:5173/'
const CHROME = process.env.RFR_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const SHOTS = 'C:/Users/tucado/AppData/Local/Temp/rfr-regression'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const errors = []
const warnings = []
const check = (id, name, ok, detail = '') => {
  results.push({ id, name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  #${String(id).padStart(2, '0')} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function clickText(page, selector, text) {
  return page.evaluate(
    ({ selector, text }) => {
      const el = [...document.querySelectorAll(selector)].find((e) =>
        e.textContent.trim().includes(text),
      )
      if (!el) return false
      el.click()
      return true
    },
    { selector, text },
  )
}

async function chip(page, label, value) {
  return page.evaluate(
    ({ label, value }) => {
      const field = [...document.querySelectorAll('.field')].find(
        (f) => f.querySelector('.field-label')?.textContent.trim() === label,
      )
      const target = field
        ? [...field.querySelectorAll('.chip')].find((c) => c.textContent.trim() === value)
        : null
      if (!target) return false
      target.click()
      return true
    },
    { label, value },
  )
}

async function reset(page) {
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(350)
}

async function startFlow(page) {
  await page.evaluate(() => document.querySelector('.checkbox-line input')?.click())
  await sleep(80)
  await clickText(page, '.hero-card .btn-primary', '开始预演')
  await sleep(650)
}

async function answerAll(page, codes) {
  for (let i = 0; i < codes.length; i += 1) {
    await page.evaluate((idx) => document.querySelectorAll('.gallery-item')[idx]?.click(), i)
    await sleep(120)
    await page.evaluate(
      (code) => document.querySelector(`.choice-btn[data-evln="${code}"]`)?.click(),
      codes[i],
    )
    await sleep(120)
  }
  await clickText(page, '#view-rehearsal .btn-primary', '看看结果')
  await sleep(650)
}

async function toScript(page) {
  await clickText(page, '#view-profile .btn-primary', '去练一遍')
  await sleep(650)
}

async function openPanelTab(page, index) {
  const isOpen = await page.evaluate(() => document.querySelector('.quick-panel')?.classList.contains('is-open'))
  if (!isOpen) await page.click('#quickFab')
  await sleep(180)
  await page.evaluate((i) => document.querySelectorAll('.qp-tab')[i]?.click(), index)
  await sleep(120)
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error') errors.push('console: ' + t)
    warnings.push(t) // puppeteer 各版本对 warn 的 type 命名不一致，按文本收集
  })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('requestfailed', (r) => errors.push('request: ' + r.url()))

  await page.goto(URL, { waitUntil: 'networkidle2' })
  await reset(page)

  /* ---------- #8 / #12 静态检查：金标准分布与高亮冗余（O-08 / O-15） ---------- */
  const goldSrc = readSrc('src/domain/scenario-gold.ts')
  const goldVals = [...goldSrc.matchAll(/^\s*'[^']+':\s*'(voice|exit|loyalty|neglect)',/gm)]
    .map((m) => m[1])
  const goldDist = Object.fromEntries(
    ['voice', 'exit', 'loyalty', 'neglect'].map((k) => [k, goldVals.filter((v) => v === k).length]),
  )
  check(8, '金标准 12 个期望模式四类均有分布（O-08）',
    goldVals.length === 12 && Object.values(goldDist).every((n) => n > 0),
    JSON.stringify(goldDist))
  check(12, '陪练高亮无恒等冗余分支（O-15）',
    !readSrc('src/domain/script.ts').includes("indexOf(''"))

  /* ---------- #3 首屏 CTA 就地反馈 ---------- */
  await page.evaluate(() => document.querySelector('.hero-card .btn-primary')?.click())
  await sleep(300)
  const heroNotice = await page.evaluate(() => {
    const n = document.querySelector('.hero-card .notice-danger')
    if (!n) return null
    const r = n.getBoundingClientRect()
    return { text: n.textContent, top: r.top, bottom: r.bottom, scrollTop: document.querySelector('.viewport').scrollTop }
  })
  check(3, '未勾年龄点 Hero CTA，视口内出现提示',
    heroNotice && heroNotice.text.includes('请先完成年龄确认') && heroNotice.top > 0 && heroNotice.top < 900,
    heroNotice ? `top=${Math.round(heroNotice.top)} scrollTop=${Math.round(heroNotice.scrollTop)}` : '未找到提示')
  await sleep(250)
  const scrolled = await page.evaluate(() => {
    const v = document.querySelector('.viewport')
    const box = document.querySelector('#ageGate')?.getBoundingClientRect()
    return { top: v.scrollTop, gateVisible: !!box && box.top > 0 && box.top < window.innerHeight }
  })
  check(3, '点击后滚动到门禁且 checkbox 进入视口',
    scrolled.top > 0 && scrolled.gateVisible,
    `scrollTop=${Math.round(scrolled.top)} visible=${scrolled.gateVisible}`)

  /* ---------- #5 高危词就地提示 + 热线 ---------- */
  await page.evaluate(() => { document.querySelector('.viewport').scrollTop = 0 })
  await page.type('#view-intake .text-area', '我最近不想活了')
  await sleep(200)
  const inline = await page.evaluate(() => {
    const box = document.querySelector('#inlineGuard')
    if (!box) return null
    const r = box.getBoundingClientRect()
    return { text: box.textContent, top: r.top, bottom: r.bottom }
  })
  const heroRisk = await page.evaluate(() => {
    const n = [...document.querySelectorAll('.hero-card .notice-danger')].find((e) => e.textContent.includes('热线'))
    return n ? { text: n.textContent, top: n.getBoundingClientRect().top } : null
  })
  check(5, '高危词提示就地出现在输入框下方并含热线',
    inline && inline.text.includes('希望24热线') && inline.text.includes('400-161-9995'),
    inline ? `top=${Math.round(inline.top)}` : '未找到 #inlineGuard')
  check(5, '无需滚动即可看到热线（Hero 置顶提示）',
    heroRisk && heroRisk.top > 0 && heroRisk.top < 900,
    heroRisk ? `top=${Math.round(heroRisk.top)}` : '未找到置顶提示')
  const leak = await page.evaluate(() => JSON.stringify(localStorage).includes('不想活'))
  check(5, '原始自由文本不写入 localStorage', !leak)
  await page.evaluate(() => {
    const t = document.querySelector('#view-intake .text-area')
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(t, '')
    t.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(150)

  /* ---------- #6/#7 表单字段真的影响出题 ---------- */
  await reset(page)
  await startFlow(page)

  /* ---------- #8 默认单事件时补足迁移题，避免三题同源（O-14） ---------- */
  const bank = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('rfr.v2.scenarios') || '[]'))
  check(8, '默认单事件时 3 题不全同源（O-14）',
    bank.length >= 2 && new Set(bank.map((s) => s.stressorType)).size > 1,
    bank.map((s) => s.stressorType).join(','))
  check(8, '补足的迁移题带「换一种情况」标记',
    bank.some((s) => s.transfer === true),
    `transfer=${bank.filter((s) => s.transfer).length}`)

  const ctx0 = await page.evaluate(() =>
    [...document.querySelectorAll('#view-rehearsal .choice-panel .badge')].map((e) => e.textContent).join('|'))
  const ids0 = await page.evaluate(() => [...document.querySelectorAll('.gallery-item')].length)
  check(6, '默认第 1 题 context 含「平时回复」', ctx0.includes('平时回复：'), ctx0.slice(0, 80))

  await page.evaluate(() => document.querySelector('.page-btn[data-target="intake"]')?.click())
  await sleep(650)
  await chip(page, '对方平时回消息', '经常很慢')
  await sleep(100)
  await clickText(page, '.hero-card .btn-primary', '开始预演')
  await sleep(650)
  const ctx1 = await page.evaluate(() =>
    [...document.querySelectorAll('#view-rehearsal .choice-panel .badge')].map((e) => e.textContent).join('|'))
  check(6, '改「对方平时回消息」后第 1 题 context 同步变化',
    ctx1.includes('平时回复：经常很慢') && ctx1 !== ctx0,
    ctx1.match(/平时回复：[^|]*/)?.[0] ?? '')

  await page.evaluate(() => document.querySelector('.page-btn[data-target="intake"]')?.click())
  await sleep(650)
  await chip(page, '这条消息急不急', '较急')
  await sleep(100)
  await clickText(page, '.hero-card .btn-primary', '开始预演')
  await sleep(650)
  const ctx2 = await page.evaluate(() =>
    [...document.querySelectorAll('#view-rehearsal .choice-panel .badge')].map((e) => e.textContent).join('|'))
  const ids2 = await page.evaluate(() => [...document.querySelectorAll('.gallery-item')].map((e) => e.textContent).join('|'))
  check(7, '改「急不急」后 context 或出题集合变化',
    ctx2.includes('这条消息：较急') && (ctx2 !== ctx1 || ids2.length !== ids0),
    ctx2.match(/这条消息：[^|]*/)?.[0] ?? '')

  /* ---------- #8 低承诺不出最难的题 ---------- */
  const hard = await page.evaluate(() => document.querySelector('#view-rehearsal')?.textContent.includes('更难点'))
  check(8, '低承诺时 3 题内不出现「更难点」', !hard)
  const constructVisible = await page.evaluate(() =>
    (document.querySelector('#view-rehearsal')?.textContent ?? '').includes('这一题想看的是'))
  check(8, '构念标签在预演页可见（场景标注被消费）', constructVisible)

  /* ---------- #9 选项不泄露分类标签 ---------- */
  const leaked = await page.evaluate(() => {
    const t = document.querySelector('#view-rehearsal')?.textContent ?? ''
    return ['好好说出来', '带刺地说出来', '先忍一忍', '干脆不回应'].filter((w) => t.includes(w))
  })
  check(9, '预演页 DOM 不含分类标签', leaked.length === 0, leaked.join(',') || '零残留')
  const tags = await page.evaluate(() =>
    [...document.querySelectorAll('.choice-btn')].map((b) => b.dataset.evln))
  check(9, '选项顺序经过洗牌，四类仍各出现一次',
    new Set(tags).size === 4 && tags.join(',') !== 'voice,exit,loyalty,neglect', tags.join(','))

  /* ---------- #10/#12 混合选择不给单一标签 ---------- */
  await answerAll(page, ['voice', 'exit', 'loyalty'])
  const mixedTitle = await page.evaluate(() => document.querySelector('#view-profile .profile-title')?.textContent)
  const profileText = await page.evaluate(() => document.querySelector('#view-profile')?.textContent ?? '')
  check(10, '3 次不同类选择 → 混合提示，不给单一标签',
    mixedTitle === '这几次不太一样', `标题=${mixedTitle}`)
  check(10, '证据链出现三格分布', /3 次里|1 \/ 3|1 · 1 · 1 · 0/.test(profileText))
  check(12, '「把握 %」已改名', !profileText.includes('把握') && profileText.includes('一致性'))

  /* ---------- #14 锁定态与价格确认 ---------- */
  await toScript(page)
  const locked = await page.evaluate(() =>
    [...document.querySelectorAll('#view-script button')].some((b) => ['说了', '没说'].includes(b.textContent.trim())))
  check(14, '锁定态不存在「说了 / 没说」按钮', !locked)
  await clickText(page, '.paywall .btn-primary', '去解锁')
  await openPanelTab(page, 1)
  await clickText(page, '.qp-plan .btn-primary', '解锁')
  await sleep(150)
  const hasConfirm = await page.evaluate(() => !!document.querySelector('#payConfirm'))
  const confirmText = await page.evaluate(() => document.querySelector('#payConfirm')?.textContent ?? '')
  check(14, '点击去解锁后先出现价格确认', hasConfirm && confirmText.includes('19.9') && confirmText.includes('不产生真实订单'),
    confirmText.slice(0, 60))
  await page.type('#payName', '回归测试')
  await clickText(page, '#payConfirm .btn-primary', '确认解锁')
  await sleep(300)
  const unlocked = await page.evaluate(() => {
    const t = document.querySelector('#view-script')?.textContent ?? ''
    return { feedback: t.includes('事后记一笔'), plan: JSON.parse(localStorage.getItem('rfr.v2.account') || '{}') }
  })
  check(14, '确认后反馈区出现且账户方案与解锁同步',
    unlocked.feedback && unlocked.plan.plan === 'single' && unlocked.plan.signedIn,
    `plan=${unlocked.plan.plan} signedIn=${unlocked.plan.signedIn}`)

  /* ---------- #13 画像改变会改变脚本 ---------- */
  const scriptMixed = await page.evaluate(() => JSON.parse(localStorage.getItem('rfr.v2.script') || 'null'))

  await reset(page)
  await startFlow(page)
  await answerAll(page, ['voice', 'voice', 'voice'])
  const voiceTitle = await page.evaluate(() => document.querySelector('#view-profile .profile-title')?.textContent)
  const voiceText = await page.evaluate(() => document.querySelector('#view-profile')?.textContent ?? '')
  check(11, '3 次同类选择 → 结论与证据一致、一致性 100%',
    voiceTitle === '说出来，好好说' && voiceText.includes('100%'), `标题=${voiceTitle}`)
  await toScript(page)
  const scriptVoice = await page.evaluate(() => JSON.parse(localStorage.getItem('rfr.v2.script') || 'null'))
  await page.screenshot({ path: `${SHOTS}/01-voice-script.png` })

  await reset(page)
  await startFlow(page)
  await answerAll(page, ['neglect', 'neglect', 'neglect'])
  await toScript(page)
  const scriptNeglect = await page.evaluate(() => JSON.parse(localStorage.getItem('rfr.v2.script') || 'null'))
  check(13, '全 voice 与全 neglect 脚本至少一处不同',
    scriptVoice && scriptNeglect &&
    (scriptVoice.actionText !== scriptNeglect.actionText || scriptVoice.note !== scriptNeglect.note || scriptVoice.stopCondition !== scriptNeglect.stopCondition),
    `voice=${scriptVoice?.actionText?.slice(0, 18)}… / neglect=${scriptNeglect?.actionText?.slice(0, 18)}…`)
  check(13, '脚本标注基于几次选择', !!scriptVoice?.basedOn && !!scriptVoice?.focus,
    scriptVoice?.basedOn)
  check(12, '陪练高亮区间有效（O-15）',
    Array.isArray(scriptVoice?.highlight) &&
    scriptVoice.highlight[1] > scriptVoice.highlight[0] &&
    scriptVoice.highlight[0] > 0,
    JSON.stringify(scriptVoice?.highlight))

  /* ---------- #16 趋势由真实记录计算 ---------- */
  const trend = await page.evaluate(() => JSON.parse(localStorage.getItem('rfr.v2.archive') || '[]'))
  check(16, '完成练习后档案写入真实记录（含主动程度）',
    trend.length >= 1 && !trend[0].isSample && typeof trend[0].agency === 'number',
    `records=${trend.length}`)
  await page.evaluate(() => document.querySelector('.page-btn[data-target="archive"]')?.click())
  await sleep(650)
  const emptyTrend = await page.evaluate(() => document.querySelector('#view-archive')?.textContent ?? '')
  check(16, '只有 1 条真实记录时不显示编造的趋势数字',
    emptyTrend.includes('还没有足够记录') && !emptyTrend.includes('52%'),
    emptyTrend.includes('还没有足够记录') ? '显示空态提示' : '仍显示了静态值')

  // 再做一次练习：趋势应改为由真实记录计算
  await page.evaluate(() => document.querySelector('.page-btn[data-target="intake"]')?.click())
  await sleep(650)
  await startFlow(page)
  await answerAll(page, ['voice', 'voice', 'voice'])
  await page.evaluate(() => document.querySelector('.page-btn[data-target="archive"]')?.click())
  await sleep(650)
  const twoRecords = await page.evaluate(() => ({
    hasTrend: !!document.querySelector('#view-archive .trend-svg'),
    empty: (document.querySelector('#view-archive')?.textContent ?? '').includes('还没有足够记录'),
  }))
  check(16, '完成 2 次练习后趋势由真实记录生成', twoRecords.hasTrend && !twoRecords.empty,
    `trend=${twoRecords.hasTrend} empty=${twoRecords.empty}`)

  /* ---------- #15 删除后刷新不复活 ---------- */
  await openPanelTab(page, 3)
  await clickText(page, '.qp-body button', '删除全部')
  await sleep(120)
  await clickText(page, '.qp-body button', '确认')
  await sleep(250)
  const rawStorage = await page.evaluate(() => JSON.stringify(localStorage))
  check(15, 'localStorage 不含原始自由文本',
    !rawStorage.includes('不想活') && !rawStorage.includes('测试原文'),
    `keys=${Object.keys(JSON.parse(rawStorage)).length}`)
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(350)
  await page.evaluate(() => document.querySelector('.page-btn[data-target="archive"]')?.click())
  await sleep(650)
  const afterDelete = await page.evaluate(() => ({
    items: document.querySelectorAll('#view-archive .archive-item').length,
    account: JSON.parse(localStorage.getItem('rfr.v2.account') || '{}'),
    version: JSON.parse(localStorage.getItem('rfr.v2.roleCard') || '{}').version,
  }))
  check(15, '删除全部 → 刷新 → 档案 0 条、账户未登录、角色卡重置',
    afterDelete.items === 0 && !afterDelete.account.signedIn && afterDelete.version === 1,
    `items=${afterDelete.items} signedIn=${afterDelete.account.signedIn} version=${afterDelete.version}`)

  /* ---------- #19 设置页开关状态说明 ---------- */
  await openPanelTab(page, 2)
  const settings = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.toggle-row')]
    return rows.map((r) => ({ text: r.textContent, disabled: !!r.querySelector('.toggle[disabled]') }))
  })
  check(19, '设置页每个开关都有生效状态说明',
    settings.length === 2 && settings.every((s) =>
      s.text.includes('当前演示已生效') || s.text.includes('后端阶段')),
    settings.map((s) => s.disabled ? '置灰' : '可用').join('/'))
  const notWired = await page.evaluate(() => document.querySelector('.qp-body')?.textContent ?? '')
  check(19, '未接线配置在界面如实标注',
    notWired.includes('后端阶段') && notWired.includes('7 天') && notWired.includes('24 小时'))
  check(19, '未接线配置在开发期输出告警',
    warnings.some((w) => w.includes('未接线')),
    warnings.find((w) => w.includes('未接线'))?.slice(0, 60) ?? '无告警')

  /* ---------- #17 连续切页不丢点击 ---------- */
  await page.evaluate(() => document.querySelector('.qp-close')?.click())
  await sleep(150)
  const t0 = Date.now()
  await page.evaluate(() => document.querySelector('.page-btn[data-target="profile"]')?.click())
  await page.waitForFunction(() => document.querySelector('.page-btn.active')?.dataset.target === 'profile', { timeout: 3000 })
  const singleMs = Date.now() - t0
  await page.evaluate(() => {
    document.querySelector('.page-btn[data-target="rehearsal"]')?.click()
    document.querySelector('.page-btn[data-target="archive"]')?.click()
    document.querySelector('.page-btn[data-target="group"]')?.click()
  })
  await sleep(1400)
  const finalView = await page.evaluate(() => document.querySelector('.page-btn.active')?.dataset.target)
  check(17, '连续点击 3 个导航项后停留在最后目标', finalView === 'group', `final=${finalView}`)
  check(17, '单次切页耗时 < 600ms', singleMs < 600, `${singleMs}ms`)

  /* ---------- #2 / #18 两种视口无横向溢出、按钮不被遮挡 ---------- */
  const viewIds = ['intake', 'rehearsal', 'profile', 'script', 'archive', 'group']
  const overflow = []
  const blocked = []
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewport(size)
    await sleep(150)
    for (const id of viewIds) {
      await page.evaluate((v) => document.querySelector(`.page-btn[data-target="${v}"]`)?.click(), id)
      await sleep(620)
      const r = await page.evaluate(() => {
        const v = document.querySelector('.viewport')
        v.scrollTop = v.scrollHeight
        const nav = document.querySelector('.pagination').getBoundingClientRect()
        const btns = [...document.querySelectorAll('.view.is-active button.btn-primary, .view.is-active button.btn-dark')]
        return {
          wide: document.documentElement.scrollWidth - window.innerWidth,
          overlap: btns.filter((b) => {
            const r = b.getBoundingClientRect()
            return r.bottom > nav.top && r.top < nav.bottom && r.left < nav.right && r.right > nav.left
          }).length,
        }
      })
      if (r.wide > 1) overflow.push(`${size.width}/${id}:${r.wide}`)
      if (r.overlap > 0) blocked.push(`${size.width}/${id}:${r.overlap}`)
    }
  }
  check(2, '桌面 1440×900 与移动 390×844 无横向溢出', overflow.length === 0, overflow.join(',') || 'zero')
  check(18, '六页主按钮滚动到底不被固定元素遮挡', blocked.length === 0, blocked.join(',') || 'zero')

  /* ---------- #4 移动首屏可见年龄勾选框 ---------- */
  await page.evaluate(() => document.querySelector('.page-btn[data-target="intake"]')?.click())
  await sleep(650)
  await reset(page)
  const mobileGate = await page.evaluate(() => {
    const box = document.querySelector('#ageGate')
    if (!box) return null
    const r = box.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, inLeft: !!box.closest('.col-left'), scrollTop: document.querySelector('.viewport').scrollTop }
  })
  check(4, '移动首屏可见年龄勾选框，点击无需滚动',
    mobileGate && mobileGate.top > 0 && mobileGate.bottom < 844 && mobileGate.inLeft && mobileGate.scrollTop === 0,
    mobileGate ? `top=${Math.round(mobileGate.top)} bottom=${Math.round(mobileGate.bottom)}` : '未找到门禁')

  /* ---------- #13 低期望分支优先于画像适配（O-06） ---------- */
  await page.setViewport({ width: 1440, height: 900 })
  await sleep(150)
  await reset(page)
  const lowSet = await chip(page, '你在纠结什么', '值不值得继续')
  await sleep(100)
  await startFlow(page)
  await answerAll(page, ['voice', 'voice', 'voice'])
  await toScript(page)
  const feasible = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('rfr.v2.script') || 'null'))
  check(13, '低期望时先给中性决策辅助、不推话术（O-06）',
    lowSet && feasible?.feasibilityFirst === true &&
    feasible.actionText.includes('先别急着开口') && !feasible.actionText.includes('我就'),
    `hesitation=${lowSet} feasibility=${feasible?.feasibilityFirst}`)

  /* ---------- #1 稳定性 ---------- */
  const realErrors = errors.filter((e) => !e.includes('favicon'))
  check(1, '六页流程走通，console / pageerror / 请求失败 = 0', realErrors.length === 0,
    realErrors.slice(0, 3).join(' | ') || 'zero')

  /* ---------- #20 构建与类型检查（收进脚本，20 条断言全闭环） ---------- */
  let buildOk = false
  let buildMsg = ''
  try {
    const out = execSync('npm run build', { cwd: ROOT, stdio: 'pipe', timeout: 180000 })
    buildOk = true
    buildMsg = String(out).match(/built in [^\r\n]+/)?.[0] ?? 'ok'
  } catch (e) {
    buildMsg = String(e.stdout || e.message).slice(0, 140)
  }
  check(20, 'npm run build 通过（含 tsc --noEmit）', buildOk, buildMsg)

  await browser.close()
  const failed = results.filter((r) => !r.ok)
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`)
  if (failed.length) {
    console.log('FAILED:', failed.map((f) => `#${f.id} ${f.name}`).join(' ; '))
    process.exit(1)
  }
}

run().catch((e) => {
  console.error('regression crashed:', e)
  process.exit(1)
})
