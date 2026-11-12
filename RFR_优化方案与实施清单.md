# RFR 前端 MVP · 优化方案与实施清单

| 项 | 内容 |
|---|---|
| 文档版本 | **v1.1（实施完成 · 验收记录）** |
| 日期 | 2026-11-12 |
| 适用代码 | `rfr-mvp` 0.1.0 / Vite + React 18 + TypeScript，`src/` 26 个文件（新增 3 个领域/服务模块） |
| 依据 | `毕设prd.md` v1.1、`RFR_心理学文献支撑与学术指导.md`、`元现代风格.md`、`README.md`、用户视角实测 |
| 评测方式 | 本机 Chrome 无头浏览器完整走通 6 页流程；桌面 1440×900、移动 390×844；13 张截图 + 3 轮交互探针 → 固化为 `tests/ux-regression.mjs` |
| 实施状态 | **A / B / C 三批 15 项全部落地；`npm run build` 通过；回归 42/42 通过** |
| 文档性质 | §0-A 为实施与验收结果；§1–§10 为 v1.0 原始需求依据，保留不改，便于追溯「为什么这么改」 |

---

## 0-A. 实施状态总览（v1.1 追加）

### 结论

优化已全部完成。原先最伤用户信任的四件事——**首屏点了没反应、画像结论和证据打架、填了的东西没用上、删了刷新又回来**——都已修复并有自动化断言守着。当前版本可以稳定地从头走完「填表 → 出题 → 作答 → 画像 → 陪练 → 档案」，且每一步都能对上用户的输入。

### 15 项逐项状态

| 编号 | 级别 | 落地做法（摘要） | 状态 | 验收断言 |
|---|---|---|---|---|
| O-01 | P0 | Hero 就地错误提示 + 自动滚动到 `#ageGate`；移动端门禁移入左栏首屏、折叠波形卡、补底部留白 | ✅ | #3 #4 |
| O-02 | P0 | `buildProfile()` 改由**选择众数**定结论；最大类 < 60% 或并列时输出「这几次不太一样」+ 四格分布；「把握 %」改为「一致性」 | ✅ | #10 #11 #12 |
| O-03 | P0 | 移除选项上的分类标签；按场景 id + 会话种子做确定性洗牌；`data-evln` 只留在内部 | ✅ | #9 |
| O-04 | P0 | 新增 `context.ts`：`contextFromIntake()` 生成动态线索、`scoreSeed()` 让 7 个字段都参与打分、`selectionBasis()` 在预演页展示出题依据 | ✅ | #6 #7 #8 |
| O-05 | P0 | 新增 `storage.ts` 的 `usePersistentState`；13 个 key 落本机、原始自由文本剥离不落盘；`deleteAll()` 连账户与存储一起清空 | ✅ | #15 |
| O-06 | P0 | `buildScript(intake, profile, focus)` 加入 `adaptScript()` 画像适配层；低期望分支优先级最高；脚本标注「基于刚才 N 次选择」 | ✅ | #13 |
| O-07 | P1 | 反馈区受 `scriptUnlocked` 控制；解锁前显示价格确认 + 演示登录；`plan` 与解锁状态统一由 `account` 派生 | ✅ | #14 |
| O-08 | P1 | 新增 `scenario-gold.ts`，12 个期望模式按四类分布（voice 4 / exit 2 / loyalty 4 / neglect 2）；`constructTarget` 在预演页可见 | ✅ | #8 |
| O-09 | P1 | 群体页显著标注「演示样例 · 非真实统计」；样例历史需 `VITE_SEED_DEMO_DATA=true` 才注入；跨周趋势由真实档案计算，不足 2 条显示空态 | ✅ | #16 |
| O-10 | P1 | 未接线配置（7 天删除 / 24h SLA / 纠错上限 / 匿名化开关）在设置页置灰并标注「后端阶段」；开发期输出 `envWarnings` 告警 | ✅ | #19 |
| O-11 | P1 | 高危提示就地渲染在 textarea 下方（`#inlineGuard`）+ Hero 置顶热线；`guardUserInput` 明确不拦截低期望表达 | ✅ | #5 |
| O-12 | P2 | 切页时序降到 240/40/240ms；用 `pendingTarget` 保留最后一次点击，不丢导航 | ✅ | #17 |
| O-13 | P2 | 底部胶囊留白、左栏 sticky、移动顶栏精简；两种视口六页主按钮零遮挡 | ✅ | #2 #18 |
| O-14 | P2 | `selectScenarios()` 单事件时补一题「换一种情况」并打 `transfer` 标记 | ✅ | #8 |
| O-15 | P2 | 命名统一；清理 `highlightOf()` 恒等冗余、`quadrantOf` 与 `goldDistribution` 死代码；修 `dropStaleVersions()` 遍历删除漏项 | ✅ | #12 |

### 验证结果

- `npm run build`（含 `tsc --noEmit`）：通过，53 modules，CSS 25.57 kB / JS 228.78 kB。
- `npm run test:ux`：**42/42 通过**（§9 的 20 项断言细分后共 42 条，含脚本内部自动执行的 #20 构建检查）。
- 六页流程零 console/pageerror、零请求失败、零横向溢出、零按钮遮挡。

### 仍属范围外（不是「没做完」，是本阶段不做）

1. **后端系统**：LangGraph / Qdrant / MySQL / CRAG / LangSmith / 真实支付与登录 / F-S1~S3 回归集 / PRD §8 六项指标。
2. **合规时限的真实实现**：7 天删除、24h SLA、服务端三处清理（MySQL + checkpointer + Qdrant）——当前仅做前端诚实标注，界面不再暗示「已开启」。
3. **心理学效度实验**：2–3 名评分者独立标注 + Cohen's κ、ECR-R / ROCI-II / RSQ / ERQ 效标关联效度。代码侧已把金标准独立到 `scenario-gold.ts` 并写明边界，实验本身属论文工作。
4. **法规原文核验**：论文中不引用条款号，对外统一为「非临床的教育与自我觉察工具」。

---

## 0. 结论摘要（v1.0 原始诊断，保留作为依据）

当前版本的**工程稳定性与视觉完成度已经达标**：零 console/pageerror、零请求失败、零横向溢出、图片全部加载、六页空态兜底齐全、黑底白卡 + 酸绿 + 衬线斜体的风格高度统一。

问题集中在一条主链上：**「输入 → 场景 → 画像 → 脚本」这条路，用户填的东西大半没有被消费，中间产物又互相矛盾**。用户因此无法相信结果是「为自己算出来的」，而这恰恰是本产品全部价值主张的落点。

优化按三条主线推进，判定优先级时以「对用户信任的伤害」为唯一标尺：

1. **信任修复（P0）**：让每次点击有可见反馈、让结论对得上证据、让输入真的影响出题、让删除真的生效。
2. **真实性对齐（P1）**：假数据标注、付费流程顺序、场景库标注落地、配置空壳要么实现要么明确标注未启用。
3. **体验与合规诚实（P2）**：切页时长、遮挡、命名、界面与 README 的范围声明保持一致。

> 一句话原则：**宁可少一个功能，不可多一句假话。**

### 优先级分布

| 级别 | 数量 | 判定标准 | 目标批次 |
|---|---|---|---|
| P0 | 6 | 直接让用户怀疑「结果不是为我算的」；答辩现场会被追问 | A |
| P1 | 5 | 可信度 / 合规表述问题，不修会在演示中露出破绽 | B |
| P2 | 4 | 体感与细节，可后置 | C |
| 范围外 | 4 | README 已声明的有意简化，**不计入缺陷** | 论文与答辩口径 |

---

## 1. 现状基线

### 1.1 已具备且应保持不变

- `src/config/env.ts` 全部配置外置、安全默认值、违反 PRD 硬性条款时强制纠正并告警（`VITE_FEEDBACK_CONSENT_DEFAULT=true` 被回退为 `false`）。
- `src/domain/compliance.ts` 输入侧 `guardUserInput` + 输出侧 `guardOutputText` 双通道；`RfrContext.finishRehearsal()` 对陪练文本逐段做输出 Guard。
- `src/domain/evln.ts` 已按学术 §4.1 更名为「应对模式画像」，输出 `agency` / `constructiveness` 两个连续维度，`boundary_clarity` 作为输入参数而非输出标签。
- `src/domain/script.ts` 的 `lowExpectation()` 已实现「低承诺 + 没戏了 → 先给中性决策辅助而非直接推 if-then 计划」，符合学术 §4.4；if-then / 非良性反应分支 / 备用计划 / 停止条件结构完整。
- 12 个场景已显式标注欲测构念、不确定性来源、强度、期望应对模式、干扰项理由，且每个场景都带障碍分支。
- 六页均有空态兜底；B 端只读聚合；单独授权默认关闭；年龄门禁存在。

### 1.2 明确**不计入缺陷**的范围（README 已声明）

| 简化项 | 声明位置 | 处理 |
|---|---|---|
| 纯前端、状态只存内存、刷新重置 | `README.md:25` | 保留，但界面文案不得与之矛盾（见 O-05、O-09） |
| 无后端 / 无 LLM / 无 LangGraph / Qdrant / MySQL / CRAG | `README.md:25,51` | 保留；答辩时明确「UI 演示 ≠ PRD 描述的系统」 |
| 登录与付费为模拟 | `README.md:51` | 保留；但流程顺序仍需自洽（见 O-07） |
| F-S1~S3 回归集、§8 六项验收指标 | PRD §8/§10 M5 | 尚未进入本阶段，不列为当前缺陷 |

**关键定性**：O-05 / O-07 / O-09 的问题不是「没做后端」，而是**界面文案宣称了持久化、真实统计与已完成的动作，与纯前端演示的实现不一致**。改造应优先保证表述诚实，而不是仓促补后端。

---

## 2. 优化目标与判定原则

| # | 原则 | 具体含义 |
|---|---|---|
| 1 | 反馈就地 | 任何被拒绝的点击，反馈必须出现在被点击处或视口内，不允许只在长表单底部出现 |
| 2 | 输入必达 | 表单上标注「会影响题目」的字段必须进入 `selectScenarios()`；否则删掉该表述 |
| 3 | 结论可回溯 | 画像结论必须由证据链中的多数选择直接推出；混合选择时不能给出单一确定标签 |
| 4 | 演示不撒谎 | 所有预置/静态数据带「样例」标识；所有未实现的开关不得显示「已开启」 |
| 5 | 可验证 | 每条优化项都必须配一条可自动化的断言，写入回归清单 |

### 总体验收口径

- **功能**：`npm run build`（含 `tsc --noEmit`）通过；六页流程可完整走通。
- **稳定**：零 console/pageerror、零请求失败、零横向溢出。
- **一致性**：§9 的 15 条断言全绿。
- **诚实性**：界面中不出现任何「无来源的数字」或「未实现的已开启状态」。

---

## 3. 优先级总表

| 编号 | 问题 | 级别 | 主要文件 | 批次 |
|---|---|---|---|---|
| O-01 | 首屏 CTA 校验反馈不可见；移动端年龄勾选项被压在折叠线下 | P0 | `IntakeView.tsx`、`App.tsx`、`metamodern.css` | A |
| O-02 | 画像结论与自身证据链相反；「把握 %」并非可信度 | P0 | `evln.ts`、`ProfileView.tsx` | A |
| O-03 | 选项直接印出 EVLN 分类标签，A→D 固定由好到差 | P0 | `RehearsalView.tsx`、`scenarios.ts` | A |
| O-04 | 7 个表单字段未进入出题，场景 context 与填写内容矛盾 | P0 | `scenarios.ts` | A |
| O-05 | 「删除全部」刷新即复活；预置记录冒充真实历史 | P0 | `RfrContext.tsx`、`mock.ts`、`ArchiveView.tsx` | A |
| O-06 | 陪练脚本与画像无关，`_profile` 参数未使用 | P0 | `script.ts`、`RfrContext.tsx` | A |
| O-07 | 付费墙下反馈区可写；未登录可一键解锁；无价格确认 | P1 | `ScriptView.tsx`、`RfrContext.tsx`、`QuickPanel.tsx` | B |
| O-08 | 场景标注字段零消费；12 个 `expectedPattern` 全为 voice | P1 | `scenarios.ts`、`evln.ts` | B |
| O-09 | 跨周趋势 / 群体看板为静态值且无「样例」标识 | P1 | `mock.ts`、`ArchiveView.tsx`、`GroupView.tsx` | B |
| O-10 | 配置与字段空壳：匿名化开关、7 天删除、24h SLA、纠错上限、dataConfidence | P1 | `env.ts`、`QuickPanel.tsx`、`RfrContext.tsx` | B |
| O-11 | 合规拦截提示同样位于长表单底部，静默拒绝 | P1 | `IntakeView.tsx` | B |
| O-12 | 切页 600+100+600 = 1.3s 锁死导航 | P2 | `App.tsx` | C |
| O-13 | 底部胶囊遮挡操作区；桌面左栏空白；移动顶栏挤压 | P2 | `metamodern.css`、`Pagination.tsx` | C |
| O-14 | 默认单事件导致 3 题同源，重复感强 | P2 | `scenarios.ts` | C |
| O-15 | 命名一致性：「把握」→「一致性」；版本号与页面口径 | P2 | `ProfileView.tsx`、`.env` | C |

---

## 4. P0 详解 · 信任修复（批次 A）

### O-01 首屏 CTA 校验反馈不可见

**现象（实测）**：Hero 的「开始预演」与表单底部按钮共用 `handleStart`（`IntakeView.tsx:18-22`）。未勾选年龄确认时点击首屏 CTA，页面完全静止。错误提示渲染在 `IntakeView.tsx:181-183`，实测 `top≈1234px`，而视口高 900px；`.viewport`（`App.tsx:67`）是内部滚动容器（scrollHeight 1868 / clientHeight 900），body 不滚动，用户看不到「请先完成年龄确认」。移动端 390×844 下 Hero + 波形卡占满首屏，年龄勾选框在 620px 以下且被底部导航胶囊压住——**主按钮在最上面，前置条件在最下面**。

**根因**：校验失败只置 `attempted=true`，无就地提示、无滚动定位；年龄门禁放在右栏长表单顶部，与左栏 CTA 物理分离；移动端未做布局降级。

**改造方案**
1. 在 `IntakeView` 内为年龄门禁与 CTA 各建 `ref`；`handleStart` 失败时按 `blockers` 优先级定位第一个未满足项，调用 `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`，目标容器是 `.viewport` 而非 window。
2. Hero 卡片内就地渲染一条 `Notice variant="danger"`（与 `attempted` 联动），显示 `blockers.join('；')`；表单底部保留原提示，形成双通道。
3. **推荐做法**：把年龄确认升级为「首屏门禁」——未确认时 Hero CTA 文案改为「先确认年龄」，点击即滚动到门禁；右栏门禁卡在移动端 `@media (max-width: 640px)` 提到 `.col-left` 之后、表单之前。
4. 移动端折叠 `WaveCanvas`（或降为 120px 高），给 `.viewport` 增加 `padding-bottom`，避开固定胶囊。
5. 按钮加 `aria-live="polite"` 的错误容器，保证读屏可感知。

**验收断言**
- 桌面 1440×900 未勾选年龄，点击 Hero「开始预演」，**视口内 300ms 出现**「请先完成年龄确认」。
- 点击后 `.viewport.scrollTop > 0` 且门禁 checkbox 进入视口。
- 移动 390×844 首屏可见年龄勾选框，点击无需滚动。

**对应**：PRD F-C1 年龄确认；§7.1 首次使用年龄确认。

---

### O-02 画像结论与证据链矛盾

**现象（实测）**：三题分别选「好好说出来 / 带刺地说出来 / 先忍一忍」，结论为「**说出来，好好说 · 把握 60%**」，而右侧证据链三条中只有 1 条支持该结论。

**根因**：`evln.ts:70-73` 把每次选择的 ±1 取均值再映射到 0..100，`quadrantOf()`（`evln.ts:16-21`）以 `>=50` 硬判象限。voice(+1,+1) + exit(+1,-1) + loyalty(-1,+1) → 两轴均为 `(1/3 + 1)/2 ≈ 67` → 判为 voice，与 1/3 的证据多数完全不符。`confidence`（`evln.ts:75-77`）实际是 `0.6 × 众数占比 + 0.4 × 覆盖率` 的**工程一致性分数**，界面却写成「把握 %」（`ProfileView.tsx:105`），语义误导。此外 `Quadrant` 高亮整个象限（`ProfileView.tsx:18-22`），混合选择时进一步放大确定性错觉。

**改造方案**
1. **结论改由众数驱动**，不再由均值判象限：
   - 统计 `counts`（已有 `evln.ts:50`）；取最大类为 `dominant`。
   - 若 `maxCount / n < 0.6`（3 题时即 <2 票），**不输出单一标签**，改输出「这几次不太一样」+ 两轴倾向描述 + 四格分布条。
   - 并列时退化为 `agency` / `constructiveness` 两轴描述，不给象限名。
2. `agency` / `constructiveness` 仍保留为连续分数（学术方案 B 要求），但**只用于象限图定位与文字描述**，不参与标签判定。
3. 把「把握 60%」改为「**3 次里 1 次属于这一类**」或「选择一致性 33%」；若保留百分比，标签必须改为「一致性」并附一行解释「这只表示几次选择是否相似，不代表测得准不准」。
4. 证据链头部加分布摘要：`主动建设 1 · 主动带刺 1 · 被动忍让 1 · 0 · 0`（实际只有 4 类）。
5. `dataConfidence` 目前只在 `evln.ts:36,85` 赋值、界面零消费：要么在结果卡显示「数据充分度」，要么从类型中移除，避免又一个空字段。

**验收断言**
- 选择 voice / exit / loyalty 各 1 次 → 结论**不得**出现「说出来，好好说」作为唯一标签；必须显示混合提示与三格分布。
- 3 次全选 voice → 结论为「说出来，好好说」，一致性 100%。
- 证据链中支持结论的条目数 ≥ 结论所声称的次数。

**对应**：PRD F-C3、§8「画像证据一致性 ≥90%」；学术 §4.1 / §4.2。此项不修，§8 该指标等于「自己定规则自己判」。

---

### O-03 选项泄露分类标签且顺序固定

**现象**：`RehearsalView.tsx:143-147` 把 `EVLN_META[o.evln].plain` 作为 `.choice-tag` 直接印在选项上（「好好说出来」「带刺地说出来」「先忍一忍」「干脆不回应」）。选项由 `scenarios.ts:290` 按 `Object.keys(EVLN_META)` 生成，顺序恒为 voice → exit → loyalty → neglect，即 **A→D 固定由「好」到「差」**。用户一眼可看出「正确答案」，测的不再是真实倾向，而是社会赞许性。

**改造方案**
1. 移除 `.choice-tag` 的渲染；`evln` 只保留在 state / 事件负载中，不进入 DOM 可见文本。若需保留辅助信息，改为中性标签（如「做法 A」）或干脆只留字母键。
2. 选项顺序按 `scenario.id + sessionSeed` 做**确定性洗牌**（同一会话内重进结果一致，可复现），并把 `evln → optionId` 的映射留在 `chooseOption()`（`RfrContext.tsx:155-169`）内部。
3. 提示语 `VITE_CHOICE_PROMPT`（已是「你最可能会怎么做？」）保持不变，并在题板上补一句「没有标准答案，按第一反应选」——现有 `RehearsalView.tsx:105` 已有类似 Notice，可提到选项区上方。
4. 画像证据链仍可显示 `e.evlnLabel`，因为那是**事后解释**，不影响作答；但措辞需避免评价性（「更靠近」优于「属于」）。

**验收断言**
- 预演页 DOM 中搜索「好好说出来 / 带刺地说出来」返回 0 条。
- 连续 3 次进入同一场景，选项顺序一致；不同场景顺序不全相同。
- 选择后 `r.responses[0].evln` 仍正确映射，画像结果不受洗牌影响。

**对应**：学术 §4.3「选项措辞固定为『你最可能会怎么做？』」、§4.5 效度；PRD §8 场景相关性。

---

### O-04 表单字段未进入出题，场景文本与填写自相矛盾

**现象（实测）**：`selectScenarios()`（`scenarios.ts:325-355`）只消费 `intake.frictionEvents`。`relationshipType`、`commitmentLevel`、`boundaryClarity`、`hesitationType`、`priorResponsiveness`、`messageUrgency`、`freeText` 共 **7 项均不影响出题**。表单却写着「选一选你遇到的情况，我们据此出题」（`IntakeView.tsx:61`）与「这两点会影响题目，所以先问一下」（`IntakeView.tsx:148`）。实测把「对方平时回消息」改为「经常很慢」、「急不急」改为「较急」，第 1 题仍写死 `context: ['平时回复：通常很快', '这条消息：不急']`（`scenarios.ts:61`）。

**根因**：`ScenarioSeed.context` 是静态字符串数组，`buildScenario()`（`scenarios.ts:289-316`）原样透传，与 `intake` 无连接。

**改造方案**
1. **把 context 改为生成式**：将 `ScenarioSeed.context` 中依赖用户输入的项抽成 `contextFromIntake(intake, seed)`，在 `buildScenario(seed, index, intake)` 内合成；保留 seed 中的构念性描述（如「CPM：私有信息已成共同所有」）作为静态部分。
   - `平时回复：{intake.priorResponsiveness}`、`这条消息：{intake.messageUrgency}`、`关系：{intake.relationshipType} / 承诺 {intake.commitmentLevel}`、`边界：{intake.boundaryClarity}`、`拿不准的是：{intake.uncertaintySource}`。
   - `SCENARIO_BANK` 改为工厂函数 `buildScenarioBank(intake)`，或在 `selectScenarios()` 里做一次 `map` 覆盖 `context`，避免全局缓存串味。
2. **让字段真正参与选择逻辑**（`selectScenarios()` 增加打分）：
   - `uncertaintySource`：与 `intake.hesitationType` 映射后优先选同类；
   - `constructTarget`：`boundaryClarity === '模糊'` 优先 boundary 类场景；
   - `commitmentLevel`：低承诺时压低强度上限（只取 `low`/`mid`，跳过 `mid-high`），呼应学术 §4.4；
   - `messageUrgency === '较急'` 时优先 `reply-*` / `cross-midhigh` 等带紧急线索的场景；
   - `freeText`：仅做关键词提示（不作为硬过滤），且必须经 `guardUserInput` 后再使用。
3. 出题后把「本次出题依据」以 1 行展示在预演页（例如「按：临时取消 / 承诺低 / 对方回复经常很慢 选了 3 题」），让「据此出题」可被用户验证。
4. 若某字段最终决定不参与，**必须删掉界面上对应的承诺文案**（原则 2）。

**验收断言**
- 只改 `priorResponsiveness` 从「通常很快」→「经常很慢」，第 1 题 context 文本同步变化。
- 只改 `messageUrgency` 从「一般」→「较急」，出题集合或 context 至少一处变化。
- `commitmentLevel = 低` 时 3 题内不出现 `mid-high` 标签。
- 同一 `intake` 两次调用 `selectScenarios()` 结果一致（可复现）。

**对应**：PRD F-C1 / F-C2 Supervisor 动态选场景；学术 §4.3 场景库须构念驱动、补齐 `prior_responsiveness` / `message_urgency`。

---

### O-05 删除不持久，预置记录冒充真实历史

**现象（实测）**：「删除全部」→ 档案 0 条 → **刷新回到 3 条**；确认文案却写着「确认删除全部本地记录？」（`VITE_PANEL_MANAGE_DELETE_CONFIRM`），界面给用户的预期是「不可撤销」。`deleteAll()`（`RfrContext.tsx:269-281`）只 reset 内存 state，不重置 `account`，也没有持久化层。新用户首次打开就有 3 条 2026-10-28 起的历史（`mock.ts:29-60`）与 v2 角色卡，每条硬编码「已匿名」徽标（`ArchiveView.tsx:34`）。

**改造方案（推荐方案 A）**
1. 引入 `src/services/storage.ts`，提供 `usePersistentState<T>(key, initial)`，对以下 state 做 `localStorage` 持久化：`intake`、`responses`、`scenarios`、`profile`、`script`、`scriptUnlocked`、`feedbackConsent`、`feedback`、`roleCard`、`archive`、`account`。
   - 明确**不持久化** `freeText` 原文（与隐私承诺一致），或按 O-10 的演示级倒计时清理。
   - 增加 `STORAGE_VERSION`，版本变更时清空旧键，避免结构升级后崩溃。
2. `archive` 初始值改为 `[]`；`mock.ts` 的 `archiveHistory()` / `initialRoleCard()` 只在 `VITE_USE_MOCK=true` 且显式开启 `VITE_SEED_DEMO_DATA=true` 时注入，注入的每条带 `isSample: true`。
3. `deleteAll()` 全量清空（含 `account` 与 localStorage 键），然后重置为「干净的空态」，而不是重新注入样例。
4. `ArchiveView` 对 `isSample` 记录显示「**样例**」徽标，把「已匿名」改为「样例 · 已脱敏」；真实记录才显示「已匿名」。
5. 同步更新 `README.md:25`：从「状态只存内存，刷新会重置」改为「状态存浏览器 localStorage，仅本机可见，不上传；清除浏览器数据即清空」。

**备选方案 B（若坚持纯内存演示）**：把所有相关文案改为「演示记录 · 刷新后重置」，删除确认改为「清空本次演示记录（刷新后恢复样例）」，所有预置数据加「样例」标识。**关键是表述与实现一致，二选一即可，但不能维持现状。**

**验收断言**
- 「删除全部」→ 刷新 → 档案仍为 0 条，账户仍为「未登录」，角色卡版本重置。
- 完成一次预演 → 刷新 → 档案新增 1 条且为真实记录（无「样例」徽标）。
- 首次进入时，若显示 3 条历史，则每条均带「样例」标识。
- `localStorage` 中不出现 `freeText` 原文（若采用不持久化策略）。

**对应**：PRD §7.1 一键导出/删除、F-C7；§7.2 隐私承诺。

---

### O-06 陪练脚本与画像无关

**现象**：`buildScript(intake: IntakeData, _profile: CopingProfile)`（`script.ts:96`）第二个参数带下划线且完全未使用；`RfrContext.tsx:183` 传入 `p` 但被忽略。脚本只按 `intake.frictionEvents[0]` 从 4 个固定模板中取一个（`script.ts:97-99`），多选事件也只认第一个。无论画像怎么变，脚本都一样。

**改造方案**
1. 保留模板主干（结构已符合学术 §4.6），在其上增加**画像适配层** `adaptScript(tpl, profile, intake)`：
   - `agency < 50`（偏被动）：把动作降为最小可执行版本，前置一句「不用一次说完，先发一句就够」；
   - `constructiveness < 50`（偏带情绪）：在 `actionText` 前加一句情绪降温提示，并把 `stopCondition` 提前；
   - 混合 / 低一致性画像：不追加个性化话术，只给通用脚本 + 一行「这次几次选择不太一样，先挑最容易做到的那句」；
   - 多事件时按 `frictionEvents` 全部生成分支，或明确标注「本次只针对：{primary}」并允许切换。
2. 在脚本卡上注明「基于刚才 {n} 次选择」，让用户看到链路闭合。
3. `lowExpectation()` 分支（`script.ts:101-119`）必须保留且**优先级高于画像适配**，符合学术 §4.4「极低承诺 + 没戏了先给中性决策辅助」。
4. 输出 Guard（`RfrContext.tsx:184-193`）覆盖新增文本，不能让适配文案绕过规则拦截。

**验收断言**
- 全选 voice 与全选 neglect 两次运行，`script.actionText` 或 `note` 至少一处不同。
- `lowExpectation` 触发时，`feasibilityFirst === true` 且不含「我就说」话术。
- 多选压力事件时，脚本中出现对应事件或明确的「本次针对」标注。

**对应**：PRD F-C4 行动前即时陪练、F-C5 角色卡更新；学术 §4.6 if-then 显式化。

---

## 5. P1 详解 · 真实性与合规诚实（批次 B）

### O-07 付费流程顺序错位

**现象**：付费墙状态下（`ScriptView.tsx:65-74`），下方「事后记一笔」区域仍完整渲染且可点击写入反馈（该区域只受 `env.features.feedback` 控制，`ScriptView.tsx:131`）。用户**还没看到一句话就被问「说了吗」**。另：`unlockScript()`（`RfrContext.tsx:212-217`）不校验登录、无价格确认、不产生订单，直接把 `plan` 置为 `single`；未登录状态下一键即可解锁，账户面板仍显示「未登录」却显示订阅方案，逻辑矛盾。

**改造方案**
1. 反馈区条件改为 `env.features.feedback && r.scriptUnlocked`。
2. 解锁前增加确认步骤：显示 `VITE_SCRIPT_PRICE_CNY` / `VITE_SUBSCRIPTION_PRICE_CNY` 与「演示付费 · 不产生真实订单」，由用户确认后再调 `choosePlan()`；`unlockScript()` 保留为内部方法，不再由未登录路径直接调用。
3. 统一 `account.plan` 与 `scriptUnlocked` 的单一数据源，避免两处分别 set 导致状态漂移。
4. 「再放一遍」按钮在锁定态已 `disabled`，保持不变。

**验收断言**：锁定态 DOM 中不存在「说了 / 没说」按钮；点击「去解锁」后先出现价格确认，确认后账户方案与解锁状态同步。

---

### O-08 场景标注字段零消费，期望模式分布无区分度

**现象**：`constructTarget`、`uncertaintySource`、`expectedPattern` 在 `types.ts` 与 12 个 seed 中完整标注，但全项目**没有任何计算消费**（只在赋值处出现）。且 12 个 `expectedPattern` **全部为 voice**（`scenarios.ts:69,88,107,128,147,166,187,206,225,246,265,284`），`dataConfidence` 也从未在界面呈现。

**影响**：这是学术风险而非纯前端 bug——如果场景由人写、期望模式由人标、评估又用同一套标准自评，PRD §8 的「场景相关性 ≥85%」「画像证据一致性 ≥90%」会变成循环论证。

**改造方案**
1. **前端层**：让 `constructTarget` / `uncertaintySource` 参与 `selectScenarios()` 打分（见 O-04 第 2 点），并在预演页以中性措辞展示「这一题想看的是：{CONSTRUCT_LABELS}」（`CONSTRUCT_LABELS` 已定义于 `scenarios.ts:357`，目前未使用）。
2. **评估层**：期望模式不应全为 voice。按四类分布重标 12 个 seed，并由 2—3 名评分者独立标注、报告 Cohen's κ；把标注结果写入独立文件（如 `src/domain/scenario-gold.ts`），与 UI 数据分离。
3. **论文层**：明确当前 12 个场景是「构念驱动的自编种子」，不能宣称有效度证据；补效标关联效度实验（ECR-R 中文版 / ROCI-II / RSQ / ERQ）或至少在论文中写明局限。

**验收断言**：`constructTarget` / `uncertaintySource` 在 `src/` 中出现至少 1 处读取（非赋值）；`expectedPattern` 分布不全为 voice；预演页可见构念标签。

---

### O-09 静态统计冒充真实数据

**现象**：`weeklyAgencyTrend = [31,38,44,52]`（`mock.ts:25`）与「最近主动表达率 52%」为静态值，做多少次练习都不变；`env.group.sampleSize = 48`（`GroupView.tsx:26` 显示为「参与人数」）与 `groupDistribution()` 的 `[27,19,33,21]` 同为硬编码聚合值，页面无「样例」标识；任何 C 端用户点底部导航即可进入群体页。

**改造方案**
1. 群体页标题 / 卡片加显著「**演示样例 · 非真实统计**」标识；`sampleSize` 改为「样例规模 48」。
2. 跨周趋势改为由 `archive` 真实记录计算：有 ≥2 条真实记录时按周聚合 `profile.agency` 或 voice 占比；不足时显示「还没有足够记录，先做几次练习」而不是永远 52%。
3. 若 `VITE_ENABLE_B_END=false`，群体页不进入导航（`env.ts:254` 的 `isViewEnabled` 已支持，确认 `Pagination` 消费）；开启时也在页首说明「B 端看板为演示视图」。
4. `ArchiveView` 的「已匿名」按 O-05 第 4 点处理。

**验收断言**：无真实记录时档案页不出现任何百分比数字；完成 2 次练习后趋势数据随之变化；群体页含「样例」字样。

---

### O-10 配置与字段空壳清单

以下项**在 `env.ts` 定义或 state 中存在，但全项目零业务消费**。界面却给出「已开启」的暗示，属于合规表述风险。

| 项 | 定义位置 | 消费位置 | PRD 条款 |
|---|---|---|---|
| `anonymizeEnabled` / `setAnonymizeEnabled` | `RfrContext.tsx:113, 64-65` | 仅 `QuickPanel.tsx:197-199` 开关本身 | §7.1 原始文本匿名化 |
| `VITE_RAW_TEXT_RETENTION_DAYS = 7` | `env.ts:163` | 无 | §7.1 画像后 7 天删除/匿名化 |
| `VITE_DELETE_SLA_HOURS = 24` | `env.ts:164` | 无 | §7.1 删除 24h 内清干净 |
| `VITE_MAX_REWRITE = 2` | `env.ts:136` | 无 | §4.3 CRAG 有界纠错 |
| `dataConfidence` | `evln.ts:36,85`、`types.ts:75` | 无 | §4.3 降级标注 |
| `constructTarget` / `uncertaintySource` / `expectedPattern` | `scenarios.ts` 12 处 | 无（见 O-08） | 学术 §4.3 / F-S1 |

**改造方案（分两步）**
- **批次 B 立即做（诚实标注）**：设置页把这三项开关置灰 + 标注「后端阶段启用，当前演示未生效」；移除「保护已开启」类可能误读为全量合规实现的措辞（或补完整说明）；在 `env.ts` 的 `envWarnings` 中对未接线配置输出开发期告警；`README.md:42`「所有能改的都在 .env」改为「可调文案与开关在 .env；标注『后端阶段』的项当前未接线」。
- **后续阶段（真实实现）**：7 天删除 / 24h SLA 需要服务端任务与三处清理（MySQL + checkpointer + Qdrant），前端只能做演示级时间戳倒计时并明确标注，不能声称已完成；CRAG 纠错上限属于后端图逻辑，前端不实现。

**验收断言**：设置页每个开关都附带状态说明；搜索代码可确认每个 `env.compliance.*` 项要么有消费点、要么有 TODO 注释与界面标注。

---

### O-11 合规拦截提示不可见

**现象**：输入「不想活」触发 `guard.blocked` 时，提示 `Notice` 位于 `IntakeView.tsx:167-179`（长表单底部），与 O-01 同样是静默拒绝；高危提示与热线资源（`crisisResourceLine`）用户看不到。

**改造方案**：把 guard 提示**就地渲染在 textarea 下方**（紧跟 `char-count`），高危态额外置顶一条不可关闭的 Notice；`startRehearsal()` 被 guard 拒绝时，Hero CTA 同样就地提示（复用 O-01 通道）。保持 `guardOutputText` 的输出侧拦截不变。

**验收断言**：在 textarea 输入高危词后，无需滚动即可看到提示与热线信息；点击 CTA 后视口内可见拦截原因。

---

## 6. P2 详解 · 体验与布局（批次 C）

### O-12 切页动效锁死导航

`App.tsx:26-41` 的 `goTo()` 用 `animating` 锁，时序 `transitionMs(600) + holdMs(100) + releaseMs(600) = 1300ms`，期间所有导航点击被丢弃。

**方案**：`.env` 默认改为 `240 / 40 / 240`（约 520ms，移动端再折半）；或保留时长但允许中断——用 `pendingTarget` ref 记录最后一次点击，动画结束直接应用最后目标，不丢点击。按钮加 `aria-busy`。

**验收**：连续快速点击 3 个导航项后，最终停留页为最后一次点击的目标；单次切页耗时 < 600ms。

### O-13 布局遮挡

- 底部固定胶囊在部分滚动位置压住卡片底部操作区（画像页「去练一遍」实测被压）→ 给 `.viewport` 或 `.layout-grid` 增加 `padding-bottom: calc(胶囊高度 + 16px)`。
- 桌面右栏长表单滚动时左栏大片黑底空白 → `.col-left` 用 `position: sticky; top: ...`（注意内部滚动容器下 sticky 的包含块）。
- 移动 390px 顶栏「演示数据 / 保护已开启」与标题挤压 → 移动端只保留品牌名 + 保护圆点，文案收进折叠信息。

**验收**：1440×900 与 390×844 下，六页所有主按钮在滚动到底时均不被任何固定元素遮挡（可用 `elementFromPoint` 断言）。

### O-14 场景重复感

`selectScenarios()` 默认 `frictionEvents = ['临时取消']`，`pool` 只有 3 个 cancel 场景，3 题全部同源。`usedTypes` 去重逻辑在单类型池内完全失效。

**方案**：单事件时从其他压力事件类型补 1 题作为「迁移场景」，并在题板上标注「同类不同强度 / 换一种情况」；或在 `selectScenarios()` 中把 `wanted` 为空/单类时的候选池扩展为全库，按 `constructTarget` 相似度排序。

**验收**：默认配置下 3 题不全为同一 `stressorType`。

### O-15 命名一致性

「把握 X%」→「一致性 X%」或改为次数陈述（并入 O-02）；`.env` 中 `VITE_APP_VERSION=0.1.0-mvp` 与 `package.json` 的 `0.1.0` 对齐；「韧性」相关遗留文案全局搜索清零；`README.md` 的「页面」表与优化后实际行为同步。

---

## 7. 分批实施路线

| 批次 | 包含项 | 完成后可演示的验收点 | 依赖 | 状态 |
|---|---|---|---|---|
| **A · 信任修复** | O-01 ~ O-06 | 现场从零走一遍：填表 → 题目随填写变化 → 隐藏标签作答 → 结论与证据吻合 → 脚本随画像变化 → 删除后刷新不复活 | 无（纯前端） | ✅ 完成 |
| **B · 真实性与合规诚实** | O-07 ~ O-11 | 付费流程顺序自洽、所有假数据带样例标识、所有开关状态如实、拦截提示可见 | A（部分共用 `IntakeView` 与 state） | ✅ 完成 |
| **C · 体验与布局** | O-12 ~ O-15 | 切页 < 600ms、无遮挡、场景不重复、命名统一 | 无，可与 B 并行 | ✅ 完成 |

**实施顺序（实际执行）**：O-01 / O-02 先行 → O-03 / O-04 一并改 `scenarios.ts` → 集中重构 `RfrContext.tsx` 的 O-05 / O-06 / O-07 → B、C 批收尾。与原建议一致。

**已落地模块**

```
src/services/storage.ts        # usePersistentState / STORAGE_VERSION / 清理（已落地）
src/domain/context.ts          # contextFromIntake / scoreSeed / selectionBasis / 确定性洗牌（已落地）
src/domain/scenario-gold.ts    # 独立金标准标注，四类分布（已落地）
src/domain/evln.ts             # 众数驱动结论直接重构，未另建 profile-v2.ts
tests/ux-regression.mjs        # §9 断言自动化，20 项细分 42 条（已落地）
package.json                   # test:ux 脚本；puppeteer-core@25.17.0 进 devDependencies
```

---

## 8. 与 PRD / 学术文档的条款映射

| 优化项 | PRD | 学术指导 | 备注 |
|---|---|---|---|
| O-01 / O-11 | F-C1、§7.1 年龄确认、§4.4 Guard | §4.7 风险表述 | 用户体验层面，非新增功能 |
| O-02 | F-C3、§8 画像证据一致性 ≥90% | §4.1 术语、§4.2 双连续维度 | **决定核心贡献能否成立** |
| O-03 | F-C2、§8 场景相关性 ≥85% | §4.3 措辞固定、§4.5 效度 | 消除社会赞许性偏差 |
| O-04 | F-C1 / F-C2 Supervisor | §4.3 构念驱动、prior_responsiveness / message_urgency | 补齐场景库参数 |
| O-05 | F-C7、§7.1 一键删除 | §4.7 隐私风险 | 表述与实现一致 |
| O-06 | F-C4、F-C5 | §4.6 if-then 显式化、§4.4 可行性优先 | 保留 `lowExpectation` |
| O-07 | F-C4 单次付费、§6 三级付费 | — | 演示流程顺序 |
| O-08 | F-S1 回归集、§8 指标 | §4.3 / §4.5 评分者信度与效标效度 | 论文层面的关键补强 |
| O-09 | F-C6 跨周分析、F-B3/B4 | §4.2 过程是轨迹 | 静态值不能冒充轨迹 |
| O-10 | §4.3 CRAG、§7.1 删除 SLA | §4.7 法规原文未核验 | 合规表述风险 |

> **法规提醒**：PRD §4.4 / §7.2 引用的《人工智能拟人化互动服务管理暂行办法》与「AI 心理应用国标」，学术文档 §4.7 脚注已注明「未做法规原文核验，请勿在论文中直接引用条款号」。优化界面文案时不要新增条款号，对外统一表述为「非临床的教育与自我觉察工具」。

---

## 9. 回归验证清单（已固化为自动化测试）

已把无头浏览器探针固化为 `tests/ux-regression.mjs`，用 `npm run test:ux` 执行；`puppeteer-core@25.17.0` 已写入 `devDependencies`，干净 clone 后 `npm install` 即可运行。脚本内部会自动执行一次 `npm run build`（即 #20），因此 **20 项断言全部在脚本内闭环**，细分后共 42 条，最近一次 **42/42 通过**。下表为 20 项主断言：

| # | 断言 | 对应 |
|---|---|---|
| 1 | 六页流程可走通，console/pageerror = 0，请求失败 = 0 | 基线 |
| 2 | 1440×900 与 390×844 下无横向溢出 | 基线 |
| 3 | 未勾选年龄点击 Hero CTA，视口内 300ms 出现错误提示 | O-01 |
| 4 | 移动首屏可见年龄勾选框，点击无需滚动 | O-01 |
| 5 | 输入高危词，textarea 下方就地出现提示与热线 | O-11 / O-01 |
| 6 | 改 `priorResponsiveness`，第 1 题 context 同步变化 | O-04 |
| 7 | 改 `messageUrgency`，出题集合或 context 变化 | O-04 |
| 8 | 低承诺时不出 `mid-high` 场景 | O-04 |
| 9 | 预演页 DOM 不含 EVLN 分类标签 | O-03 |
| 10 | 3 次不同类选择 → 结论为混合提示，不出现单一确定标签 | O-02 |
| 11 | 3 次同类选择 → 结论与证据一致，一致性 100% | O-02 |
| 12 | 「把握 %」已改名或改为次数陈述 | O-02 / O-15 |
| 13 | 全 voice 与全 neglect 两次脚本至少一处不同 | O-06 |
| 14 | 锁定态不存在「说了 / 没说」按钮；解锁需价格确认 | O-07 |
| 15 | 删除全部 → 刷新 → 档案 0 条、账户未登录；样例记录带标识 | O-05 / O-09 |
| 16 | 无真实记录时档案页不出现百分比；完成后趋势变化 | O-09 |
| 17 | 连续点击 3 个导航项后停留在最后目标，切页 < 600ms | O-12 |
| 18 | 六页所有主按钮在滚动到底时不固定元素遮挡 | O-13 |
| 19 | 设置页每个开关都有生效状态说明 | O-10 |
| 20 | `npm run build` 通过（含 `tsc --noEmit`） | 基线（脚本内自动执行） |

### v1.1 补充的细分断言

收尾复核时发现原表有 4 处「代码已实现但没断言守着」，已补齐：

| 归入 | 补充断言 | 对应 |
|---|---|---|
| #8 | 金标准 12 个期望模式四类均有分布（静态读 `scenario-gold.ts`） | O-08 |
| #8 | 默认单事件时 3 题不全同源；补足题带「换一种情况」标记 | O-14 |
| #12 | 陪练高亮区间有效且源码无恒等冗余分支（静态 + 运行时双检） | O-15 |
| #13 | 低期望时先给中性决策辅助、不推 if-then 话术 | O-06 |

另有若干运行时细分（原始自由文本不落盘、构念标签可见、选项洗牌四类齐全、账户方案与解锁同步、开发期告警、无请求失败等），一并在脚本中以同一编号分组记录。

> 运行注意：回归期间不要编辑 `src/`，Vite 热更新会重载页面导致浏览器 frame 断开；`RFR_URL` / `RFR_CHROME` 环境变量可覆盖默认地址与 Chrome 路径。

---

## 10. 答辩口径与范围声明

优化完成后，建议在论文 / 演示中统一以下表述，避免被问到「这套系统是否真的实现了 PRD」时失分：

1. **当前交付物**：C 端 5 步主流程 + B 端只读群体看板的**前端可交互原型**，用于验证「构念驱动场景 → 应对模式画像 → if-then 陪练」这一设计是否可理解、可用、可回溯。
2. **尚未实现**：LangGraph `StateGraph` / `interrupt()` 恢复 / `PyMySQLSaver`、并行隔离 Worker、Qdrant Hybrid + CRAG、MySQL 递归 CTE 证据回溯、LangSmith trace、真实支付与登录、F-S1~S3 回归集与 §8 六项验收指标。
3. **已有但为演示级**：合规 Guard 是前端规则级拦截（PRD 要求常驻 `compliance_guard`，后端阶段需双通道）；导出为浏览器本地 JSON；删除为本地存储清理，不涉及服务端三处清理。
4. **学术主张的边界**：12 个场景为自编构念驱动种子，未提供效标关联效度证据；画像描述的是「这几次练习中的选择倾向」，不是人格类型、不是临床评估、不预测关系走向。
5. **本轮优化已解决**：原型内部的**一致性与诚实性**问题——即「用户填的、页面说的、系统算的、界面承诺的」四者对齐，这是后续接后端与做效度实验的前提。
6. **可复现性**：`npm install && npm run dev && npm run test:ux` 可在任意装有 Chrome 的机器上复现 42 条回归断言；这是把「体验评审」转化为「工程验收」的证据链，答辩时可直接演示。

---

## 附：实施与收尾记录

### v1.0（16:34）

产出改造清单，未改动任何项目源码。

### 主体实施（16:42–17:06）

改动 23 个既有文件（约 +1140 / −496 行），新增 3 个 `src/` 模块与 `tests/ux-regression.mjs`。涉及 `.env` / `.env.example`（新增 1 组配置）、`README.md`、`package.json`、全部 6 个视图、`RfrContext`、`env.ts`、`evln.ts`、`scenarios.ts`、`script.ts`、`mock.ts`、`compliance.ts`、`metamodern.css` 等。A/B/C 三批 15 项全部落地，当时回归 35/35 通过。

### v1.1 收尾（本轮）

复核发现「主体已完成，但收尾未闭环」，补齐以下 4 类缺口：

1. **回归覆盖**：新增 7 条断言，补上 O-14 场景去重、O-08 金标准分布、O-06 低期望分支、O-15 高亮校验，以及原本只写在纸面的 #20 构建检查 → 35 条增至 **42 条**，20 项断言全部脚本内闭环。
2. **残留代码**：修 `script.ts` 的 `highlightOf()` 恒等冗余分支（行为不变）、修 `storage.ts` 的 `dropStaleVersions()` 遍历删除漏项（真实缺陷，旧版本键可能残留）、移除 `quadrantOf` 与 `goldDistribution` 两处死代码。
3. **可复现性**：`puppeteer-core@25.17.0` 写入 `devDependencies` 并更新 `package-lock.json`；`README.md` 的回归命令去掉手动 `--no-save` 安装步骤，补上「回归期间不要改 `src/`」的提示。
4. **文档状态回填**：本文档升为 v1.1，新增 §0-A 实施状态总览、§7 状态列、§9 补充断言表；`README.md` 同步 42/42 结果。

### 最终验证

- `npm run build`：通过。
- `npm run test:ux`：**42/42 通过**，零 console/pageerror、零请求失败、零横向溢出、零按钮遮挡。
- 唯一一次中途失败是编辑 `src/` 触发 Vite HMR 导致浏览器 frame 断开的竞态，非代码缺陷；HMR 稳定后复跑全绿，并已写进 README 注意事项。
