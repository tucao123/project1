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

  /** 幕布切页：合拢 → 换页 → 展开（时序来自 .env） */
  const goTo = (target: ViewId) => {
    if (animating || target === active || !views.includes(target)) return
    setPanelOpen(false)
    setAnimating(true)
    setLabel(String(views.indexOf(target) + 1).padStart(2, '0'))
    setOverlay(true)

    window.setTimeout(() => {
      setActive(target)
      if (viewport.current) viewport.current.scrollTop = 0
      window.setTimeout(() => {
        setOverlay(false)
        window.setTimeout(() => setAnimating(false), env.views.releaseMs)
      }, env.views.holdMs)
    }, env.views.transitionMs)
  }

  return (
    <>
      <ParallaxBackground />
      <CurtainOverlay active={overlay} label={label} durationMs={env.views.transitionMs} />
      <Topbar
        left={
          <span>
            <b>{env.app.name}</b>
            <span className="hide-sm"> &nbsp; {env.app.version} &nbsp; {env.app.tagline}</span>
          </span>
        }
        guard={
          <>
            <span className="hide-sm">{env.api.useMock ? '演示数据' : env.api.sse ? '实时接口' : '接口'}</span>
            {env.features.complianceBadge ? (
              <span>
                <span className="guard-dot" />
                {env.compliance.guardEnabled ? '保护已开启' : '保护已关闭'}
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

      <Pagination views={views} active={active} onNavigate={goTo} />
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
