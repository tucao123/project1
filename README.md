# RFR · 关系摩擦预演器 MVP

按 `毕设prd.md`、`RFR_心理学文献支撑与学术指导.md`、`元现代风格.md`，以及 `RFR_优化方案与实施清单.md` 实现的前端可交互原型，外加一套可选的服务端骨架。

## 启动

```bash
npm install
cp .env.example .env   # 本地配置，已被忽略；不复制也能用内置默认值
npm run dev            # http://localhost:5173/
```

`npm run build` 检查并构建；`npm run preview` 预览（4173）。改 `.env` 后要重启服务。

## 结构

| 路径 | 作用 |
|---|---|
| `.env` / `.env.example` | 所有配置，由 `src/config/env.ts` 读取 |
| `src/styles/metamodern.css` | 原风格样式 + 同风格扩展 |
| `src/components/` | 按钮、动效、图表、翻页、账户面板 |
| `src/domain/` | 12 个场景、结果计算、陪练内容、安全检查、出题依据 |
| `src/services/storage.ts` | 浏览器本机存储（原始自由文本不落盘） |
| `src/state/RfrContext.tsx` | 全局状态 |
| `src/views/` | 六个页面 |
| `tests/ux-regression.mjs` | 回归断言（优化清单 §9） |
| `.env.server.example` | 服务端配置模板（复制为 `.env.server`，已被忽略） |
| `docker-compose.yml` | MySQL 8 + Qdrant + FastAPI 一键编排 |
| `server/` | FastAPI 骨架：配置、建表、向量库、模型适配、合规、接口 |

技术：Vite + React + TypeScript。记录存本机浏览器，刷新不丢，不上传；清除浏览器数据即清空。

## 页面

| 页面 | 做什么 |
|---|---|
| 观察 | 说说情况、确认年龄；拦截提示就在按钮和输入框旁边 |
| 预演 | 题目随填写变化，选项不显示分类，凭第一反应选 |
| 画像 | 结论由多数选择推出；选择不一致时只给分布，不下结论 |
| 陪练 | 一句话怎么说、对方没接住怎么办、备用做法 |
| 档案 | 本机记录、由真实练习算出的变化 |
| 群体 | 演示样例看板，显著标注「非真实统计」 |

右上角「账户」按钮拉出抽屉：登录、付费、设置、管理（导出、删除）都在里面。付费要先确认价格；未登录时一并填昵称。

## 配置

可调文案与开关都在 `.env`，分 11 组。设计令牌（颜色、字体、圆角、动画曲线）固定在 CSS 里，不开放配置。

- 有一条不能改：反馈授权默认必须关闭（`VITE_FEEDBACK_CONSENT_DEFAULT` 设成 `true` 也会被改回 `false`）。
- 标注「后端阶段」的项（原文保留天数、删除时限、纠错上限、实时推送、匿名化开关）当前未接线，设置页如实置灰标注。
- `VITE_SEED_DEMO_DATA=true` 才注入 3 条带「样例」标识的演示历史；默认关闭，首次进入是空态。
- `VITE_USE_MOCK=false` 会把记录发到 5 个接口；`VITE_ENABLE_QUICK_PANEL=false` 可关掉账户按钮。
- `VITE_STORAGE_VERSION` 变更会清空旧键；原始自由文本不写入存储。
- `VITE_SHOW_VIEW_NUMBERS` 控制底部导航的 `01…06` 序号，默认开启。
- **密钥不要放 `.env`**：`VITE_` 变量会打进浏览器 JS 包，且 `.env` 曾被提交过（现已停止跟踪并忽略）。后端密钥按 `.env.server.example` 复制为 `.env.server`，由后端持有并转发大模型调用。
- 服务端配置分 8 组（运行 / 模型 / MySQL / Qdrant / LangGraph / 可观测 / 合规 / B 端），由 `server/config.py` 类型化读取；`FEEDBACK_CONSENT_DEFAULT=true` 同样会被强制回退。

## 接后端（可选）

前端默认 `VITE_USE_MOCK=true`，纯本地演示，不依赖后端。按 PRD §9 起全套：

```bash
cp .env.server.example .env.server        # 本地文件，已被忽略
docker compose --env-file .env.server up -d --build
curl http://localhost:8000/health
```

在 `.env.server` 填 `LLM_API_KEY` 才启用真实模型；改前端 `.env` 的 `VITE_USE_MOCK=false` 才会把 5 个节点事件发到服务端。密钥留空时服务照样启动，`/health` 会如实列出每一条降级原因。

`server/` 已配好：MySQL 8（`schema.sql` 含 JSON 列、生成列索引、`kg_edges` 边表 + 递归 CTE 证据回溯）、Qdrant（dense/sparse 命名向量、payload index、Hybrid Query + RRF）、Qwen-embedding3（显式 1024 维、≤20 分批次）、模型统一入口、规则级合规、脱敏聚合与一键删除。本机 3306 已被占用，compose 用宿主 **3307** 避让。

只验证骨架、不装 AI 依赖也能跑：

```bash
python -m unittest discover -s server -p "test_*.py"   # 纯标准库配置单测
pip install -r server/requirements.txt && uvicorn server.main:app --port 8000
```

`server/requirements-ai.txt`（LangGraph / checkpointer / FastEmbed）是完整流水线才需要的，缺包时自动降级。

## 回归验证

```bash
npm install          # puppeteer-core 已在 devDependencies，无需手动安装
npm run dev          # 另开一个终端，保持 http://localhost:5173/
npm run test:ux      # 需要本机 Chrome；脚本内部会顺带跑一次 npm run build
```

覆盖优化清单 §9 的 20 项断言（细分后 44 条）：桌面 1440×900 与移动 390×844 的六页流程、零报错 / 零横向溢出 / 零遮挡、输入影响出题、结论与证据一致、脚本随画像变化、低期望分支优先、场景去重与金标准分布、付费顺序、删除后刷新不复活、切页不丢点击与页码可见、构建通过。最近一次 **44/44 通过**。

> 回归期间不要编辑 `src/`，Vite 热更新会重载页面导致浏览器 frame 断开。

## 边界

- 结果只描述刚才的几次选择，不判断性格，也不预测关系。
- 登录和付费都是演示，不产生真实订单；导出是本机 JSON；默认删除只清本机。
- 服务端是**骨架**：MySQL / Qdrant / 模型已配置且可启动，但默认仍是纯前端演示；未填密钥不会调用真实模型。LangGraph 多 Agent、CRAG 纠错闭环、SSE 全链路、评分者信度与效标效度实验均未实现。
- 12 个场景是自编种子，期望模式标注在 `scenario-gold.ts`，未提供效度证据。
- 群体看板数字是静态样例；跨周趋势只在有 2 次以上真实练习后才出现。
- 热线和法规信息按源文档配置，请自行核实现行有效性。
