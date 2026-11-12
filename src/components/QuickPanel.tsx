import { useEffect, useState } from 'react'
import { env } from '../config/env'
import { useRfr } from '../state/RfrContext'
import { Badge, KV, Notice, Toggle } from './style-atoms'

/**
 * 快捷面板：一个悬浮胶囊按钮拉出抽屉，集中承载
 * 账户/登录、付费、设置、账户管理 —— 不再散落在各个视图里。
 * 视觉沿用元现代设计令牌：白卡 28px 圆角、酸绿强调、Instrument Serif 斜体。
 */
export function QuickPanel() {
  const r = useRfr()
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState(false)
  const p = env.panel

  useEffect(() => {
    if (!r.panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') r.setPanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [r.panelOpen, r.setPanelOpen])

  if (!env.features.quickPanel) return null

  const tabs = ['账户', '付费', '设置', '管理'].map((d, i) => p.tabs[i] ?? d)
  const planLabel =
    r.account.plan === 'subscription' ? p.planSub
      : r.account.plan === 'single' ? p.planSingle
        : p.planFree
  const price = (n: number) => `${env.pricing.currency}${n}`

  return (
    <>
      <button
        type="button"
        id="quickFab"
        className={`quick-fab${r.panelOpen ? ' is-open' : ''}`}
        aria-label={r.panelOpen ? p.close : p.trigger}
        aria-expanded={r.panelOpen}
        onClick={() => r.setPanelOpen(!r.panelOpen)}
      >
        <span className="quick-fab-dot" />
        {p.trigger}
      </button>

      <div
        className={`qp-backdrop${r.panelOpen ? ' is-open' : ''}`}
        onClick={() => r.setPanelOpen(false)}
      />

      <aside className={`quick-panel${r.panelOpen ? ' is-open' : ''}`} aria-hidden={!r.panelOpen}>
        <div className="qp-head">
          <div>
            <div className="qp-title">{p.title}</div>
            <div className="qp-sub">{p.subtitle}</div>
          </div>
          <button
            type="button"
            className="qp-close"
            aria-label={p.close}
            onClick={() => r.setPanelOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="qp-tabs">
          {tabs.map((t, i) => (
            <button
              type="button"
              key={t}
              className={`qp-tab${r.panelTab === i ? ' is-active' : ''}`}
              onClick={() => r.openPanel(i)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="qp-body">
          {/* 账户 / 登录 */}
          {r.panelTab === 0 ? (
            r.account.signedIn ? (
              <>
                <div className="qp-user">
                  <div className="qp-avatar">{r.account.name.slice(0, 1).toUpperCase()}</div>
                  <div className="qp-user-name">{r.account.name}</div>
                  <Badge variant="acid">{planLabel}</Badge>
                </div>
                <div className="divider" />
                <KV k={p.accountArchive} v={`${r.archive.length} 条`} />
                <KV k={p.accountPlan} v={planLabel} />
                <button type="button" className="btn-ghost mt-16" onClick={r.signOut}>
                  {p.signOut}
                </button>
              </>
            ) : (
              <>
                <div className="qp-guest">{p.guest}</div>
                <div className="field-label mb-8">{p.nameLabel}</div>
                <input
                  id="quickName"
                  className="text-input"
                  value={name}
                  maxLength={32}
                  placeholder={p.namePlaceholder}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) {
                      r.signIn(name)
                      setName('')
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-primary mt-16"
                  disabled={!name.trim()}
                  onClick={() => {
                    r.signIn(name)
                    setName('')
                  }}
                >
                  {p.signIn}
                </button>
                <div className="field-hint mt-8">{p.signInNote}</div>
              </>
            )
          ) : null}

          {/* 付费 */}
          {r.panelTab === 1 ? (
            <>
              <div className="qp-plan">
                <div className="row-between">
                  <div>
                    <b>{p.singleTitle}</b>
                    <div className="field-hint">{p.singleDesc}</div>
                  </div>
                  <span className="qp-price">{price(env.pricing.scriptPrice)}</span>
                </div>
                <button
                  type="button"
                  className="btn-primary btn-sm mt-16"
                  disabled={r.scriptUnlocked}
                  onClick={() => r.choosePlan('single')}
                >
                  {r.scriptUnlocked ? p.payUnlocked : p.payBuy}
                </button>
              </div>
              <div className="qp-plan">
                <div className="row-between">
                  <div>
                    <b>{p.subTitle}</b>
                    <div className="field-hint">{p.subDesc}</div>
                  </div>
                  <span className="qp-price">
                    {price(env.pricing.subscriptionPrice)}{p.payPeriod}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-dark btn-sm mt-16"
                  disabled={r.account.plan === 'subscription'}
                  onClick={() => r.choosePlan('subscription')}
                >
                  {r.account.plan === 'subscription' ? p.payUnlocked : p.paySubscribe}
                </button>
              </div>
              <div className="field-hint mt-8">{p.payNote}</div>
            </>
          ) : null}

          {/* 设置 */}
          {r.panelTab === 2 ? (
            <>
              <div className="toggle-row">
                <div className="toggle-text">
                  <h4>{p.setFeedback}</h4>
                  <p>{p.setFeedbackHint}</p>
                </div>
                <Toggle
                  checked={r.feedbackConsent}
                  onChange={r.setFeedbackConsent}
                  label={p.setFeedback}
                />
              </div>
              <div className="toggle-row">
                <div className="toggle-text">
                  <h4>{p.setAnonymize}</h4>
                  <p>{p.setAnonymizeHint}</p>
                </div>
                <Toggle
                  checked={r.anonymizeEnabled}
                  onChange={r.setAnonymizeEnabled}
                  label={p.setAnonymize}
                />
              </div>
              <div className="divider" />
              <KV k={p.setMode} v={env.api.useMock ? '演示' : '接口'} />
              <KV k={p.setGuard} v={env.compliance.guardEnabled ? '开启' : '关闭'} />
            </>
          ) : null}

          {/* 账户管理 */}
          {r.panelTab === 3 ? (
            <>
              <KV k={p.manageArchive} v={`${r.archive.length} 条`} />
              <KV k={p.manageVersion} v={`第 ${r.roleCard.version} 版`} />
              <div className="row-wrap mt-16">
                {env.features.exportArchive ? (
                  <button type="button" className="btn-dark btn-sm" onClick={r.exportArchive}>
                    {p.manageExport}
                  </button>
                ) : null}
                {env.features.deleteArchive ? (
                  <button
                    type="button"
                    className="btn-ghost btn-danger btn-sm"
                    onClick={() => setConfirm(true)}
                  >
                    {p.manageDelete}
                  </button>
                ) : null}
              </div>
              {confirm ? (
                <div className="mt-16">
                  <Notice variant="danger">
                    {p.manageDeleteConfirm}
                    <div className="row-wrap mt-16">
                      <button
                        type="button"
                        className="btn-ghost btn-danger btn-sm"
                        onClick={() => {
                          r.deleteAll()
                          setConfirm(false)
                        }}
                      >
                        {p.manageDeleteYes}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => setConfirm(false)}
                      >
                        {p.manageCancel}
                      </button>
                    </div>
                  </Notice>
                </div>
              ) : null}
              <div className="field-hint mt-16">{p.manageNote}</div>
            </>
          ) : null}
        </div>

        <div className="qp-foot">{p.disclaimer}</div>
      </aside>
    </>
  )
}
