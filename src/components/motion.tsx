import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { ArtImage } from './style-atoms'

/* ============================================================
   动态视差薄膜背景（原逻辑：鼠标位移驱动 translate）
   ============================================================ */
export function ParallaxBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!ref.current) return
      const x = (e.clientX / window.innerWidth - 0.5) * 20
      const y = (e.clientY / window.innerHeight - 0.5) * 20
      ref.current.style.transform = `translate(${x}px, ${y}px)`
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  return <div className="bg-layer" ref={ref} />
}

/* ============================================================
   切页幕布（原逻辑：两片 curtain 合拢 → 换页 → 展开）
   ============================================================ */
export function CurtainOverlay({
  active,
  label,
  durationMs = 600,
}: {
  active: boolean
  label: string
  durationMs?: number
}) {
  const dur = { transitionDuration: `${durationMs}ms` }
  return (
    <div className={`transition-overlay${active ? ' is-active' : ''}`} id="transitionOverlay">
      <div className="curtain" style={dur} />
      <div className="curtain" style={dur} />
      <div className="transition-text" id="transitionText">{label}</div>
    </div>
  )
}

/* ============================================================
   动态心理波形 Canvas（原绘制公式原样保留）
   ============================================================ */
export function WaveCanvas({
  title,
  status,
  className = '',
}: {
  title: string
  status: string
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let offset = 0
    let raf = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, width * dpr)
      canvas.height = Math.max(1, height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      if (width && height) {
        ctx.clearRect(0, 0, width, height)

        ctx.beginPath()
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'
        ctx.lineWidth = 1
        for (let i = 0; i < height; i += 10) {
          ctx.moveTo(0, i)
          ctx.lineTo(width, i)
        }
        ctx.stroke()

        ctx.beginPath()
        ctx.strokeStyle = '#E4FF00'
        ctx.lineWidth = 1.5
        for (let x = 0; x < width; x++) {
          const y =
            height / 2 +
            Math.sin(x * 0.05 + offset) * 10 +
            Math.cos(x * 0.02 + offset * 1.5) * 15 +
            Math.sin(x * 0.1 + offset * 2) * 5
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        offset += 0.05
      }
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div className={`card wave-card ${className}`}>
      <div className="wave-header">
        <div className="wave-title">{title}</div>
        <div className="wave-status">{status}</div>
      </div>
      <canvas id="waveCanvas" ref={ref} />
    </div>
  )
}

/* ============================================================
   打字机特效（保留 cursor / Instrument Serif 强调片段）
   ============================================================ */
export function Typewriter({
  text,
  highlight,
  runId,
  speed = 50,
  onDone,
}: {
  text: string
  /** 需要以衬线斜体强调的字符区间 [start, end) */
  highlight?: [number, number]
  /** 变化即重新播放 */
  runId: number
  speed?: number
  onDone?: () => void
}) {
  const [progress, setProgress] = useState(0)
  const [cursorVisible, setCursorVisible] = useState(true)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!text) {
      setProgress(0)
      return
    }
    setProgress(0)
    setCursorVisible(true)
    let i = 0
    let hideTimer = 0
    const timer = window.setInterval(() => {
      i += 1
      setProgress(i)
      if (i >= text.length) {
        window.clearInterval(timer)
        onDoneRef.current?.()
        hideTimer = window.setTimeout(() => setCursorVisible(false), 2000)
      }
    }, speed)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(hideTimer)
    }
  }, [text, runId, speed])

  const [hs, he] = highlight ?? [0, 0]
  const aEnd = Math.min(progress, hs)
  const bEnd = Math.min(progress, he)

  return (
    <div className="script-quote">
      {text.slice(0, aEnd)}
      {bEnd > aEnd ? <em>{text.slice(aEnd, bEnd)}</em> : null}
      {text.slice(Math.max(aEnd, bEnd), progress)}
      {cursorVisible ? <span className="cursor" /> : null}
    </div>
  )
}

/* ============================================================
   Exhibition 画廊 + 3D Tilt（原鼠标倾斜逻辑原样保留）
   ============================================================ */
export interface GalleryItemData {
  id: string
  image: string
  alt: string
  tag?: string
  title: string
  titleEm?: string
  meta: string
  tags?: string[]
  selected?: boolean
}

export function Gallery3D({
  items,
  onSelect,
}: {
  items: GalleryItemData[]
  onSelect?: (id: string) => void
}) {
  const handleMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const item = e.currentTarget
    const inner = item.querySelector('.gallery-inner') as HTMLElement | null
    if (!inner) return
    const rect = item.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -10
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 10
    inner.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
    inner.style.transition = 'transform 0.1s ease'
  }

  const handleLeave = (e: ReactMouseEvent<HTMLDivElement>) => {
    const inner = e.currentTarget.querySelector('.gallery-inner') as HTMLElement | null
    if (!inner) return
    inner.style.transform = 'rotateX(0) rotateY(0)'
    inner.style.transition = 'transform 0.5s ease'
  }

  return (
    <div className="gallery-grid">
      {items.map((item) => (
        <div
          key={item.id}
          className={`gallery-item${item.selected ? ' is-selected' : ''}`}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
          onClick={() => onSelect?.(item.id)}
        >
          <div className="gallery-inner">
            <div className="gallery-img-wrap">
              {item.tag ? <div className="tag-ongoing">{item.tag}</div> : null}
              <ArtImage src={item.image} alt={item.alt} />
            </div>
          </div>
          <div className="gallery-info">
            <div className="gallery-title">
              {item.title}{item.titleEm ? <em>· {item.titleEm}</em> : null}
            </div>
            <div className="gallery-meta">{item.meta}</div>
            {item.tags?.length ? (
              <div className="gallery-tags">
                {item.tags.map((t) => (
                  <span className="badge badge-outline" key={t}>{t}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   顶部状态条（合规 Guard 常驻状态）
   ============================================================ */
export function Topbar({ left, guard }: { left: ReactNode; guard: ReactNode }) {
  return (
    <div className="topbar">
      <div>{left}</div>
      <div className="topbar-right">
        {guard}
      </div>
    </div>
  )
}
