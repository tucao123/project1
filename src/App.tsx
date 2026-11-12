import { useRef, useState } from 'react'
import { env, type ViewId } from './config/env'
import { CurtainOverlay, ParallaxBackground, Topbar } from './components/motion'
import { Pagination } from './components/Pagination'
import { QuickPanel } from './components/QuickPanel'
import { RfrProvider, useRfr } from './state/RfrContext'
import { IntakeView } from './views/IntakeView'
import { RehearsalView } from './views/RehearsalView'
import { ProfileView } from './views/ProfileView'
import { ScriptView } from './views/ScriptView'
import { ArchiveView } from './views/ArchiveView'
import { GroupView } from './views/GroupView'

function Shell() {
  const { setPanelOpen } = useRfr()
  const views = env.views.enabled.filter((v) => v !== 'group' || env.features.bEnd)
  const initial = views.includes(env.views.initial) ? env.views.initial : views[0]

  const [active, setActive] = useState<ViewId>(initial)
  const [overlay, setOverlay] = useState(false)
  const [label, setLabel] = useState('01')
  const [animating, setAnimating] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const activeRef = useRef<ViewId>(initial)
  const animatingRef = useRef(false)
  const pending = useRef<ViewId | null>(null)

  /** 移动端动画时长折半；三次 setTimeout 总时长 < 600ms */
  const timing = () => {
    const k = window.matchMedia('(max-width: 640px)').matches ? 0.5 : 1
    return {
      inMs: Math.round(env.views.transitionMs * k),
      holdMs: Math.round(env.views.holdMs * k),
      outMs: Math.round(env.views.releaseMs * k),
    }
  }

  /** 幕布切页：合拢 → 换页 → 展开；动画期间的点击记在 pending，不丢弃 */
  function startTransition(target: ViewId) {
    const { inMs, holdMs, outMs } = timing()
    setPanelOpen(false)
    animatingRef.current = true
    setAnimating(true)
    setLabel(String(views.indexOf(target) + 1).padStart(2, '0'))
    setOverlay(true)

    window.setTimeout(() => {
      activeRef.current = target
      setActive(target)
      if (viewport.current) viewport.current.scrollTop = 0
      window.setTimeout(() => {
        setOverlay(false)
        window.setTimeout(() => {
          animatingRef.current = false
          setAnimating(false)
          const next = pending.current
          pending.current = null
          if (next && next !== activeRef.current) startTransition(next)
        }, outMs)
      }, holdMs)
    }, inMs)
  }

  const goTo = (target: ViewId) => {
    if (!views.includes(target)) return
    if (animatingRef.current) {
      pending.current = target
      return
    }
    if (target === activeRef.current) return
    startTransition(target)
  }

  return (
    <>
      <ParallaxBackground />
      <CurtainOverlay active={overlay} label={label} durationMs={timing().inMs} />
      <Topbar
        left={
          <span>
            <b className="brand-long">{env.app.name}</b>
            <b className="brand-short">RFR</b>
            <span className="hide-sm"> &nbsp; {env.app.version} &nbsp; {env.app.tagline}</span>
          </span>
        }
        guard={
          <>
            <span className="hide-sm">{env.api.useMock ? '本机演示' : env.api.sse ? '实时接口' : '接口'}</span>
            {env.features.complianceBadge ? (
              <span>
                <span className="guard-dot" />
                <span className="hide-sm">
                  {env.compliance.guardEnabled ? '前端规则过滤' : '过滤已关闭'}
                </span>
              </span>
            ) : null}
          </>
        }
      />

      <div className="viewport" ref={viewport}>
        {active === 'intake' ? <IntakeView onStart={() => goTo('rehearsal')} /> : null}
        {active === 'rehearsal' ? (
          <RehearsalView onBack={() => goTo('intake')} onFinish={() => goTo('profile')} />
        ) : null}
        {active === 'profile' ? (
          <ProfileView onBack={() => goTo('rehearsal')} onNext={() => goTo('script')} />
        ) : null}
        {active === 'script' ? (
          <ScriptView onBack={() => goTo('profile')} onNext={() => goTo('archive')} />
        ) : null}
        {active === 'archive' ? <ArchiveView onBack={() => goTo('script')} /> : null}
        {active === 'group' ? <GroupView /> : null}
      </div>

      <Pagination views={views} active={active} busy={animating} onNavigate={goTo} />
      <QuickPanel />
    </>
  )
}

export default function App() {
  return (
    <RfrProvider>
      <Shell />
    </RfrProvider>
  )
}
