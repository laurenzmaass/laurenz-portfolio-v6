import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  motion,
  useScroll,
  useSpring,
  useInView,
  useMotionValue,
  AnimatePresence,
} from 'framer-motion'

// ─── Data ────────────────────────────────────────────────────────────────────

const ROLES = ['Frontend Developer', 'Vibecoder', 'Automation Builder', 'UI Designer']

const SKILL_TABS = ['All', 'Frontend', 'Design', 'Automation'] as const
type SkillTab = typeof SKILL_TABS[number]

const ALL_SKILLS: { name: string; cat: Exclude<SkillTab, 'All'> }[] = [
  { name: 'React',               cat: 'Frontend'   },
  { name: 'TypeScript',          cat: 'Frontend'   },
  { name: 'Tailwind CSS',        cat: 'Frontend'   },
  { name: 'HTML / CSS',          cat: 'Frontend'   },
  { name: 'Vibe Coding',         cat: 'Frontend'   },
  { name: 'Responsive Design',   cat: 'Frontend'   },
  { name: 'Component Libraries', cat: 'Frontend'   },
  { name: 'UI Design',           cat: 'Design'     },
  { name: 'Figma',               cat: 'Design'     },
  { name: 'Design Systems',      cat: 'Design'     },
  { name: 'Prototyping',         cat: 'Design'     },
  { name: 'n8n',                 cat: 'Automation' },
  { name: 'Make',                cat: 'Automation' },
  { name: 'Workflow Automation', cat: 'Automation' },
  { name: 'API Integration',     cat: 'Automation' },
]

const PROJECTS = [
  {
    id: '01', name: 'WanderFurther',          type: 'Travel Blog',
    desc: 'A travel blog capturing adventures, hidden spots, and stories from the road. Built to inspire fellow wanderers.',
    year: '2024', color: 'from-violet-900/30',
  },
  {
    id: '02', name: '1st-Level Support Agent', type: 'n8n Automation',
    desc: 'Fully automated tier-1 customer support pipeline. Handles incoming queries, routes intelligently, resolves without human touch.',
    year: '2024', color: 'from-blue-900/30',
  },
  {
    id: '03', name: 'Time Tracking Tool',      type: 'n8n Automation',
    desc: 'Automated work hour tracking and reporting. Logs entries, generates summaries, keeps everything accurate.',
    year: '2024', color: 'from-purple-900/30',
  },
]

const LINKS = [
  { label: 'Email',     value: 'laurenz.maass@gmail.com', href: 'mailto:laurenz.maass@gmail.com',              external: false },
  { label: 'LinkedIn',  value: '/in/laurenz-maass',       href: 'https://www.linkedin.com/in/laurenz-maass/', external: true  },
  { label: 'Instagram', value: '@laurenzma',              href: 'https://instagram.com/laurenzma',            external: true  },
]

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useMousePosition() {
  const [pos, setPos] = useState({ x: -500, y: -500 })
  useEffect(() => {
    const h = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', h)
    return () => window.removeEventListener('mousemove', h)
  }, [])
  return pos
}

function useBerlinTime() {
  const [t, setT] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return t.toLocaleTimeString('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function useFPS() {
  const [fps, setFps] = useState(60)
  useEffect(() => {
    let last = performance.now(), frames = 0, id: number
    const tick = (now: number) => {
      frames++
      if (now - last >= 1000) { setFps(frames); frames = 0; last = now }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])
  return fps
}

// ─── Particle / Globe types ───────────────────────────────────────────────────

interface Particle {
  // Unit-sphere coordinates (never change)
  sx: number; sy: number; sz: number
  // Current 2D rendered position + velocity
  x: number; y: number; vx: number; vy: number
  // Spring-target (projected from globe rotation each frame)
  ox: number; oy: number
  // Visual
  size: number; baseAlpha: number; hue: number
  pulseSpeed: number; pulseOffset: number
  // Current depth after rotation (−1 … +1)
  depth: number
}

interface GlobeState {
  rotX: number; rotY: number         // current visual rotation (radians)
  velX: number; velY: number         // angular velocity for inertia
  dragging: boolean
}

interface ParticleActions { burst: boolean; rainbow: boolean; shockwaveCenter: boolean }
interface Shockwave       { x: number; y: number; r: number; maxR: number; alpha: number }

const PARTICLE_COUNT  = 220
const CONNECTION_DIST = 95
const MOUSE_LINE_DIST = 160
const REPEL_RADIUS    = 130
const SPRING_K        = 0.022
const DAMPING         = 0.87
const REPEL_STRENGTH  = 4.5
const CLICK_STRENGTH  = 18

// ─── Sphere distribution + 3-D helpers ───────────────────────────────────────

function buildParticles(w: number, h: number): Particle[] {
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    // Fibonacci sphere surface distribution
    const yy    = 1 - (i / (PARTICLE_COUNT - 1)) * 2
    const r     = Math.sqrt(Math.max(0, 1 - yy * yy))
    const theta = golden * i
    const sx = r  * Math.cos(theta)
    const sy = yy
    const sz = r  * Math.sin(theta)
    // Initial projected position (sphere facing front, no rotation)
    const R    = Math.min(w, h) * 0.40
    const px   = w * 0.5 + sx * R
    const py   = h * 0.5 + sy * R
    return {
      sx, sy, sz,
      x: px, y: py, vx: 0, vy: 0,
      ox: px, oy: py,
      size: 1.1 + Math.random() * 2.6,
      baseAlpha: 0.55 + Math.random() * 0.45,
      hue: 248 + Math.random() * 45,
      pulseSpeed: 0.5 + Math.random() * 1.5,
      pulseOffset: Math.random() * Math.PI * 2,
      depth: sz,
    }
  })
}

// Rotate a unit-sphere point by rotX (pitch) then rotY (yaw)
function rotatePt(sx: number, sy: number, sz: number, rx: number, ry: number) {
  // Yaw around Y axis
  const cosY = Math.cos(ry), sinY = Math.sin(ry)
  const x1   = sx * cosY + sz * sinY
  const y1   = sy
  const z1   = -sx * sinY + sz * cosY
  // Pitch around X axis
  const cosX = Math.cos(rx), sinX = Math.sin(rx)
  const x2   = x1
  const y2   = y1 * cosX - z1 * sinX
  const z2   = y1 * sinX + z1 * cosX
  return { x: x2, y: y2, z: z2 }
}

// ─── Particle Field ───────────────────────────────────────────────────────────

function ParticleField({
  actionsRef,
  globeRef,
}: {
  actionsRef: React.RefObject<ParticleActions>
  globeRef:   React.RefObject<GlobeState>
}) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const mouseRef   = useRef({ x: -500, y: -500 })
  const clickRef   = useRef(false)
  const frameRef   = useRef<number>(0)
  const particles  = useRef<Particle[]>([])
  const shockwaves = useRef<Shockwave[]>([])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      particles.current = buildParticles(canvas.width, canvas.height)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      shockwaves.current.push({ x: e.clientX - r.left, y: e.clientY - r.top, r: 0, maxR: 150, alpha: 0.9 })
      clickRef.current = true
      setTimeout(() => { clickRef.current = false }, 80)
    }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('click', onClick)

    const tick = (time: number) => {
      const { width: W, height: H } = canvas
      const mx      = mouseRef.current.x
      const my      = mouseRef.current.y
      const ps      = particles.current
      const actions = actionsRef.current!
      const globe   = globeRef.current!
      const R       = Math.min(W, H) * 0.40

      // ── Globe rotation spring / inertia ──────────────────────────
      if (!globe.dragging) {
        // Damped spring back to (0,0)
        globe.velX += (0 - globe.rotX) * 0.012
        globe.velY += (0 - globe.rotY) * 0.012
        globe.velX *= 0.88
        globe.velY *= 0.88
        globe.rotX += globe.velX
        globe.rotY += globe.velY
      }

      // ── Update each particle's 2-D home from sphere projection ────
      for (const p of ps) {
        const { x: rx, y: ry, z: rz } = rotatePt(p.sx, p.sy, p.sz, globe.rotX, globe.rotY)
        p.depth = rz
        // Perspective projection (fov factor = 2.8)
        const fov   = 2.8
        const scale = fov / (fov + rz * 0.5)
        p.ox = W * 0.5 + rx * R * scale
        p.oy = H * 0.5 + ry * R * scale
      }

      // ── Easter egg: spiral burst ───────────────────────────────────
      if (actions.burst) {
        actions.burst = false
        for (const p of ps) {
          const dx = p.x - W / 2, dy = p.y - H / 2
          const d  = Math.sqrt(dx * dx + dy * dy) + 1
          const spd = 8 + Math.random() * 12
          p.vx += (dx / d) * spd
          p.vy += (dy / d) * spd
          const spin = 4 + Math.random() * 6
          p.vx += (-dy / d) * spin
          p.vy +=  (dx / d) * spin
        }
      }

      // ── Easter egg: center shockwave rings ────────────────────────
      if (actions.shockwaveCenter) {
        actions.shockwaveCenter = false
        const diag = Math.sqrt(W * W + H * H) / 2 + 80
        shockwaves.current.push({ x: W / 2, y: H / 2, r: 0,  maxR: diag,       alpha: 1.0 })
        shockwaves.current.push({ x: W / 2, y: H / 2, r: 35, maxR: diag * 0.8, alpha: 0.65 })
        shockwaves.current.push({ x: W / 2, y: H / 2, r: 70, maxR: diag * 0.6, alpha: 0.35 })
      }

      ctx.clearRect(0, 0, W, H)

      // ── Physics ────────────────────────────────────────────────────
      for (const p of ps) {
        const dx   = p.x - mx, dy = p.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < REPEL_RADIUS && dist > 0.01) {
          const strength = clickRef.current ? CLICK_STRENGTH : REPEL_STRENGTH
          const force    = Math.pow((REPEL_RADIUS - dist) / REPEL_RADIUS, 1.6) * strength
          p.vx += (dx / dist) * force
          p.vy += (dy / dist) * force
        }
        const bx = Math.sin(time * 0.0003 + p.ox * 0.01) * 1.5
        const by = Math.cos(time * 0.0004 + p.oy * 0.01) * 1.5
        p.vx += (p.ox + bx - p.x) * SPRING_K
        p.vy += (p.oy + by - p.y) * SPRING_K
        p.vx *= DAMPING; p.vy *= DAMPING
        p.x  += p.vx;    p.y  += p.vy
      }

      // ── Depth-based alpha (back hemisphere fades) ──────────────────
      // depth: −1 (far back) … +1 (front center)
      // alpha multiplier: 0.06 at back edge, 1.0 at front
      const depthAlpha = (p: Particle) => Math.max(0.06, (p.depth + 1.1) / 2.1)

      // ── Connection lines (front hemisphere only) ───────────────────
      ctx.lineWidth = 0.5
      for (let i = 0; i < ps.length; i++) {
        if (ps[i].depth < -0.15) continue
        for (let j = i + 1; j < ps.length; j++) {
          if (ps[j].depth < -0.15) continue
          const dx   = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DIST) {
            const minDepth = Math.min(depthAlpha(ps[i]), depthAlpha(ps[j]))
            const op = (1 - dist / CONNECTION_DIST) * 0.32 * minDepth
            ctx.strokeStyle = `rgba(139,92,246,${op})`
            ctx.beginPath()
            ctx.moveTo(ps[i].x, ps[i].y)
            ctx.lineTo(ps[j].x, ps[j].y)
            ctx.stroke()
          }
        }
      }

      // ── Cursor web lines ──────────────────────────────────────────
      if (mx > -400) {
        for (const p of ps) {
          if (p.depth < 0) continue
          const dx   = p.x - mx, dy = p.y - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < MOUSE_LINE_DIST) {
            const t  = 1 - dist / MOUSE_LINE_DIST
            const op = t * t * 0.95 * depthAlpha(p)
            ctx.lineWidth   = 0.6 + t * 1.6
            ctx.strokeStyle = `rgba(210,185,255,${op})`
            ctx.beginPath()
            ctx.moveTo(mx, my)
            ctx.lineTo(p.x, p.y)
            ctx.stroke()
          }
        }
      }

      // ── Draw particles ─────────────────────────────────────────────
      for (const p of ps) {
        const da    = depthAlpha(p)
        const a     = p.baseAlpha * da
        const pulse = 0.78 + 0.22 * Math.sin(time * 0.0009 * p.pulseSpeed + p.pulseOffset)
        const h     = actions.rainbow
          ? ((time * 0.22 + p.sx * 180 + p.sy * 120) % 360)
          : p.hue
        const glowMul = actions.rainbow ? 5 : 1

        // Outer pulsing ring
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 2.4 * pulse, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${h},65%,62%,${0.1 * a})`
        ctx.lineWidth = 0.6
        ctx.stroke()

        // Extra rainbow ring
        if (actions.rainbow) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 3.8 * pulse, 0, Math.PI * 2)
          ctx.strokeStyle = `hsla(${(h + 60) % 360},90%,70%,${0.18 * a})`
          ctx.lineWidth = 1.2
          ctx.stroke()
        }

        // Middle ring
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${h},68%,65%,${0.28 * a})`
        ctx.lineWidth = 0.75
        ctx.stroke()

        // Core with glow — extra bloom when cursor is near
        const mdx = p.x - mx, mdy = p.y - my
        const mouseDist = Math.sqrt(mdx * mdx + mdy * mdy)
        const mouseBloom = mouseDist < 140 ? Math.pow(1 - mouseDist / 140, 1.4) * 18 : 0
        ctx.shadowColor = `hsla(${h},85%,75%,0.95)`
        ctx.shadowBlur  = (p.size * 5 + mouseBloom) * glowMul
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${h},80%,88%,${a})`
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // ── Shockwave rings ───────────────────────────────────────────
      for (let i = shockwaves.current.length - 1; i >= 0; i--) {
        const sw = shockwaves.current[i]
        sw.r     += 4.2
        sw.alpha *= 0.935
        if (sw.alpha < 0.01 || sw.r > sw.maxR) {
          shockwaves.current.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(167,139,250,${sw.alpha})`
        ctx.lineWidth   = 1.8
        ctx.stroke()
        if (sw.r > 20) {
          ctx.beginPath()
          ctx.arc(sw.x, sw.y, sw.r * 0.68, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(139,92,246,${sw.alpha * 0.45})`
          ctx.lineWidth   = 0.8
          ctx.stroke()
        }
      }

      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('click', onClick)
    }
  }, [actionsRef, globeRef])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ cursor: 'none' }} />
}

// ─── Cursor Click Effect ──────────────────────────────────────────────────────

function CursorClickEffect() {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const nextId = useRef(0)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const id = nextId.current++
      setRipples(prev => [...prev, { id, x: e.clientX, y: e.clientY }])
      setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 650)
    }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [])
  return (
    <div className="fixed inset-0 pointer-events-none z-[48]">
      <AnimatePresence>
        {ripples.map(r => (
          <motion.div key={r.id}
            className="absolute rounded-full"
            style={{ left: r.x, top: r.y, x: '-50%', y: '-50%', border: '2px solid rgba(167,139,250,0.85)' }}
            initial={{ width: 8,  height: 8,  opacity: 0.9 }}
            animate={{ width: 54, height: 54, opacity: 0   }}
            exit={{}}
            transition={{ duration: 0.55, ease: [0.2, 0, 0.55, 1] }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── Scramble name ────────────────────────────────────────────────────────────

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#!$%&?'

function ScrambleLetter({ char, className = '' }: { char: string; className?: string }) {
  const [display, setDisplay] = useState(char)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const scramble = () => {
    if (char === ' ') return
    let n = 0
    clearInterval(timer.current!)
    timer.current = setInterval(() => {
      setDisplay(GLYPHS[Math.floor(Math.random() * GLYPHS.length)])
      n++
      if (n >= 8) { clearInterval(timer.current!); setDisplay(char) }
    }, 38)
  }

  return (
    <motion.span
      className={`inline-block cursor-default ${className}`}
      style={{ minWidth: char === ' ' ? '0.35em' : undefined }}
      onHoverStart={scramble}
      whileHover={char !== ' ' ? { y: -5, color: '#c4b5fd' } : {}}
      transition={{ type: 'spring', stiffness: 600, damping: 14 }}
    >
      {display}
    </motion.span>
  )
}

function ScrambleName({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split('').map((char, i) => (
        <ScrambleLetter key={i} char={char.toUpperCase()} />
      ))}
    </span>
  )
}

// ─── Shooting Stars ───────────────────────────────────────────────────────────

interface Star {
  id: number
  startX: number; startY: number
  travelX: number; travelY: number
  angle: number; length: number; duration: number
}

function ShootingStars() {
  const [stars, setStars] = useState<Star[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    const spawn = () => {
      const id  = nextId.current++
      const vw  = window.innerWidth
      const vh  = window.innerHeight
      const ang = 18 + Math.random() * 28          // 18–46° angle
      const rad = ang * Math.PI / 180
      const len = 130 + Math.random() * 180         // trail length
      // Travel distance = 80–140% of viewport width
      const dist   = vw * (0.8 + Math.random() * 0.6)
      const travelX = dist * Math.cos(rad)
      const travelY = dist * Math.sin(rad)
      const dur    = 1.1 + Math.random() * 0.8

      // Spawn point: from top edge or left edge, slightly off-screen
      const fromTop = Math.random() > 0.2
      const startX  = fromTop
        ? Math.random() * (vw * 1.3) - vw * 0.15   // across full width + bleed
        : -len - 20
      const startY  = fromTop
        ? -(len * Math.sin(rad)) - 15               // just above viewport
        : Math.random() * vh * 0.55

      const star: Star = { id, startX, startY, travelX, travelY, angle: ang, length: len, duration: dur }
      setStars(prev => [...prev, star])
      setTimeout(() => setStars(prev => prev.filter(s => s.id !== id)), (dur + 0.4) * 1000)
      setTimeout(spawn, 3500 + Math.random() * 7000)
    }
    const t = setTimeout(spawn, 1800 + Math.random() * 2500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-[1]" style={{ overflow: 'visible' }}>
      {stars.map(star => (
        <motion.div key={star.id}
          className="absolute"
          style={{
            left: star.startX, top: star.startY,
            width: star.length, height: 1.5,
            rotate: star.angle, transformOrigin: 'left center',
            background: 'linear-gradient(90deg, transparent 0%, rgba(167,139,250,0.75) 45%, rgba(255,255,255,0.95) 100%)',
            borderRadius: 2,
          }}
          initial={{ scaleX: 0, opacity: 0, x: 0, y: 0 }}
          animate={{
            scaleX: [0, 1, 1],
            opacity: [0, 0.95, 0],
            x: star.travelX,
            y: star.travelY,
          }}
          transition={{ duration: star.duration, ease: [0.15, 0, 0.7, 1] }}
        />
      ))}
    </div>
  )
}

// ─── Cursor Trail ─────────────────────────────────────────────────────────────

function CursorTrail({ mouse }: { mouse: { x: number; y: number } }) {
  const [dots, setDots] = useState<{ x: number; y: number; id: number }[]>([])
  const nextId  = useRef(0)
  const prevPos = useRef({ x: -500, y: -500 })
  useEffect(() => {
    const dx = mouse.x - prevPos.current.x, dy = mouse.y - prevPos.current.y
    if (Math.sqrt(dx * dx + dy * dy) < 5) return
    prevPos.current = { x: mouse.x, y: mouse.y }
    const id = nextId.current++
    setDots(prev => [...prev.slice(-20), { x: mouse.x, y: mouse.y, id }])
  }, [mouse.x, mouse.y])
  return (
    <>
      {dots.map((dot, i) => {
        const size = 3 + (i / dots.length) * 7
        return (
          <motion.div key={dot.id} className="fixed top-0 left-0 rounded-full pointer-events-none z-[45]"
            style={{
              x: dot.x - size / 2, y: dot.y - size / 2,
              width: size, height: size,
              background: `hsl(${255 + i * 2}, 70%, ${50 + i * 2}%)`,
            }}
            initial={{ opacity: 0.75, scale: 1 }}
            animate={{ opacity: 0, scale: 0.1 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          />
        )
      })}
    </>
  )
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

function AnimatedRole() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % ROLES.length), 2800)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="h-5 overflow-hidden relative inline-flex items-center min-w-[180px]">
      <AnimatePresence mode="wait">
        <motion.span key={index} className="absolute font-mono text-[10px] tracking-[0.2em] text-violet-400 uppercase"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
          {ROLES[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

function Marquee({ text }: { text: string }) {
  const repeated = (text + '  ·  ').repeat(6)
  return (
    <div className="overflow-hidden whitespace-nowrap border-y border-[#111] py-3 bg-[#000]">
      <motion.span className="inline-block font-mono text-[11px] text-[#252525] tracking-[0.2em] uppercase"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 65, repeat: Infinity, ease: 'linear' }}>
        {repeated}{repeated}
      </motion.span>
    </div>
  )
}

function WordReveal({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  return (
    <p ref={ref} className={className}>
      {text.split(' ').map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.28em]">
          <motion.span className="inline-block"
            initial={{ y: '105%' }} animate={inView ? { y: 0 } : {}}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: i * 0.042 }}>
            {word}
          </motion.span>
        </span>
      ))}
    </p>
  )
}

function MagneticBtn({ href, children, external = false, className = '' }: {
  href: string; children: React.ReactNode; external?: boolean; className?: string
}) {
  const x = useMotionValue(0), y = useMotionValue(0)
  return (
    <motion.a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}
      style={{ x, y }}
      onMouseMove={e => {
        const r = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - (r.left + r.width  / 2)) * 0.4)
        y.set((e.clientY - (r.top  + r.height / 2)) * 0.4)
      }}
      onMouseLeave={() => { x.set(0); y.set(0) }}
      transition={{ type: 'spring', stiffness: 350, damping: 20 }}
      className={`inline-block cursor-none ${className}`}>
      {children}
    </motion.a>
  )
}

// ─── Sections ────────────────────────────────────────────────────────────────

function AboutSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-8% 0px' })
  return (
    <section ref={ref} className="px-6 sm:px-10 py-32 overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }} className="mb-8">
        <span className="font-mono text-[11px] text-violet-500/60 tracking-[0.3em] uppercase">About</span>
      </motion.div>
      <WordReveal text="Interfaces that perform. Pipelines that scale."
        className="text-4xl sm:text-5xl lg:text-[4.5rem] font-black leading-[1.06] tracking-tight text-white max-w-4xl mb-10" />
      <motion.p className="text-lg text-[#444] leading-relaxed max-w-2xl"
        initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        React and TypeScript on the frontend. n8n and Make on the automation side.
        Finishing my studies in <span className="text-[#777]">Berlin</span> and actively
        looking for full-time roles in frontend engineering or workflow automation.
        I build things that ship correctly and stay out of the way.
      </motion.p>
      <motion.div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-8 border-t border-[#111] pt-12"
        initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.7 }}>
        {[{ num: '3+', label: 'Projects shipped' }, { num: '2', label: 'Automation stacks' }, { num: '15+', label: 'Tools in stack' }, { num: 'NOW', label: 'Available for work' }].map(s => (
          <div key={s.label}>
            <p className="text-4xl sm:text-5xl font-black text-white mb-2 tracking-tight">{s.num}</p>
            <p className="font-mono text-[10px] text-[#2a2a2a] tracking-widest uppercase">{s.label}</p>
          </div>
        ))}
      </motion.div>
    </section>
  )
}

function SkillsSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-5% 0px' })
  const [active, setActive] = useState<SkillTab>('All')
  return (
    <section ref={ref} className="px-6 sm:px-10 py-24 border-t border-[#0f0f0f]">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}
        className="flex flex-wrap items-center gap-6 mb-12">
        <span className="font-mono text-[11px] text-violet-500/60 tracking-[0.3em] uppercase">Skills</span>
        <div className="flex gap-1">
          {SKILL_TABS.map(tab => (
            <button key={tab} onClick={() => setActive(tab)}
              className="relative px-4 py-1.5 font-mono text-[11px] tracking-[0.15em] uppercase transition-colors duration-200 cursor-none rounded-full"
              style={{ color: active === tab ? '#fff' : '#333' }}>
              {active === tab && (
                <motion.div layoutId="skill-tab" className="absolute inset-0 rounded-full"
                  style={{ border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.08)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10">{tab}</span>
            </button>
          ))}
        </div>
      </motion.div>
      <div className="flex flex-wrap gap-3">
        {ALL_SKILLS.map((skill, i) => {
          const visible = active === 'All' || skill.cat === active
          return (
            <motion.div key={skill.name}
              className="px-5 py-2.5 rounded-full text-sm cursor-default"
              initial={{ opacity: 0, scale: 0.85, y: 16 }}
              animate={inView ? { opacity: visible ? 1 : 0.15, scale: visible ? 1 : 0.95, y: 0 } : { opacity: 0, scale: 0.85, y: 16 }}
              transition={{ opacity: { duration: 0.22 }, scale: { duration: 0.22 }, y: { delay: i * 0.04, duration: 0.45, ease: [0.16, 1, 0.3, 1] } }}
              whileHover={visible ? { scale: 1.08, y: -3 } : {}}
              style={{ border: `1px solid ${visible ? 'rgba(139,92,246,0.25)' : 'rgba(30,30,30,0.6)'}`, color: visible ? '#888' : '#2a2a2a' }}
              onMouseEnter={e => { if (!visible) return; const el = e.currentTarget as HTMLElement; el.style.color = '#fff'; el.style.borderColor = 'rgba(139,92,246,0.6)'; el.style.background = 'rgba(139,92,246,0.08)' }}
              onMouseLeave={e => { if (!visible) return; const el = e.currentTarget as HTMLElement; el.style.color = '#888'; el.style.borderColor = 'rgba(139,92,246,0.25)'; el.style.background = 'transparent' }}>
              {skill.name}
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

function ProjectsSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-5% 0px' })
  return (
    <section ref={ref} className="px-6 sm:px-10 py-24 border-t border-[#0f0f0f]">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }} className="mb-12">
        <span className="font-mono text-[11px] text-violet-500/60 tracking-[0.3em] uppercase">Work</span>
      </motion.div>
      <div>
        {PROJECTS.map((project, i) => (
          <motion.div key={project.id} className="relative group overflow-hidden border-b border-[#0f0f0f] last:border-b-0"
            initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.12, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}>
            <motion.div className={`absolute inset-0 bg-gradient-to-r ${project.color} to-transparent pointer-events-none`}
              initial={{ opacity: 0, x: -60 }} whileHover={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />
            <div className="relative py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 cursor-default">
              <div className="flex items-start gap-6">
                <span className="font-mono text-[11px] text-[#222] group-hover:text-violet-500/50 transition-colors pt-1 flex-shrink-0">{project.id}</span>
                <div>
                  <div className="flex flex-wrap items-baseline gap-4 mb-3">
                    <h3 className="text-2xl sm:text-3xl font-black text-[#aaa] group-hover:text-white transition-colors duration-300 tracking-tight">{project.name}</h3>
                    <span className="font-mono text-[10px] text-[#252525] border border-[#181818] px-2.5 py-1 rounded-full group-hover:border-violet-500/30 group-hover:text-violet-400/70 transition-all duration-300">{project.type}</span>
                  </div>
                  <p className="text-sm text-[#333] leading-relaxed group-hover:text-[#666] transition-colors duration-300 max-w-xl">{project.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 pl-10 sm:pl-0">
                <span className="font-mono text-[11px] text-[#222] group-hover:text-[#444] transition-colors">{project.year}</span>
                <motion.span className="text-lg text-[#1c1c1c] group-hover:text-violet-400 transition-colors duration-300" whileHover={{ x: 4, y: -4 }}>↗</motion.span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function ContactSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-5% 0px' })
  return (
    <section ref={ref} className="px-6 sm:px-10 py-32 border-t border-[#0f0f0f] overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }} className="mb-8">
        <span className="font-mono text-[11px] text-violet-500/60 tracking-[0.3em] uppercase">Contact</span>
      </motion.div>
      <div className="overflow-hidden mb-16">
        <motion.h2 className="text-[12vw] sm:text-[10vw] font-black leading-none tracking-[-0.04em]"
          initial={{ y: '110%' }} animate={inView ? { y: 0 } : {}}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}>
          <span className="text-white">Let's </span>
          <span style={{ background: 'linear-gradient(135deg,#8b5cf6 0%,#6366f1 50%,#a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Build.</span>
        </motion.h2>
      </div>
      <div className="space-y-5">
        {LINKS.map((link, i) => (
          <motion.div key={link.label} initial={{ opacity: 0, x: -24 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.4 + i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
            <MagneticBtn href={link.href} external={link.external}>
              <div className="flex items-center gap-6 group py-1">
                <span className="font-mono text-[11px] text-[#222] w-20 group-hover:text-violet-500/60 transition-colors duration-300 flex-shrink-0">{link.label}</span>
                <span className="text-xl sm:text-2xl font-light text-[#333] group-hover:text-white transition-colors duration-300 relative">
                  {link.value}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-violet-500/60 group-hover:w-full transition-all duration-300" />
                </span>
                <motion.span className="text-[#1c1c1c] group-hover:text-violet-400 text-lg transition-colors duration-300"
                  whileHover={{ x: 4, y: -4 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>↗</motion.span>
              </div>
            </MagneticBtn>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const mouse = useMousePosition()
  const time  = useBerlinTime()
  const fps   = useFPS()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })

  // Canvas action flags
  const actionsRef = useRef<ParticleActions>({ burst: false, rainbow: false, shockwaveCenter: false })

  // Globe rotation state (read directly by canvas each frame)
  const globeRef   = useRef<GlobeState>({ rotX: 0, rotY: 0, velX: 0, velY: 0, dragging: false })

  // Globe drag handlers — delta-accumulation for high sensitivity
  const lastDrag      = useRef({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const onHeroMouseDown = useCallback((e: React.MouseEvent) => {
    lastDrag.current = { x: e.clientX, y: e.clientY }
    globeRef.current.dragging = true
    globeRef.current.velX = 0
    globeRef.current.velY = 0
    setDragging(true)
  }, [])

  const onHeroMouseMove = useCallback((e: React.MouseEvent) => {
    if (!globeRef.current.dragging) return
    const dx = e.clientX - lastDrag.current.x
    const dy = e.clientY - lastDrag.current.y
    lastDrag.current = { x: e.clientX, y: e.clientY }
    // High sensitivity: ~180° rotation per 300px drag
    globeRef.current.rotY += dx * 0.012
    globeRef.current.rotX -= dy * 0.012
  }, [])

  const onHeroMouseUp = useCallback(() => {
    globeRef.current.dragging = false
    setDragging(false)
  }, [])

  // Easter egg state
  const logoClicksRef             = useRef(0)
  const [egg1Msg, setEgg1Msg]     = useState(false)
  const [rainbowOn, setRainbowOn] = useState(false)
  const [screenFlash, setScreenFlash] = useState(false)

  const handleLogoClick = () => {
    logoClicksRef.current++
    if (logoClicksRef.current >= 5) {
      logoClicksRef.current = 0
      actionsRef.current.burst           = true
      actionsRef.current.shockwaveCenter = true
      setScreenFlash(true)
      setTimeout(() => setScreenFlash(false), 700)
      setEgg1Msg(true)
      setTimeout(() => setEgg1Msg(false), 3200)
    }
  }

  const handleHiddenBtn = () => {
    if (rainbowOn) return
    actionsRef.current.rainbow = true
    setRainbowOn(true)
    setTimeout(() => {
      actionsRef.current.rainbow = false
      setRainbowOn(false)
    }, 12000)
  }

  return (
    <div className="bg-[#06040e] text-[#e8e8e8] min-h-screen font-sans antialiased cursor-none overflow-x-hidden">

      <motion.div style={{ scaleX }} className="fixed top-0 left-0 right-0 h-[2px] bg-violet-500 origin-left z-50" />

      <ShootingStars />
      <CursorTrail mouse={mouse} />
      <CursorClickEffect />

      {/* Screen flash — easter egg 1 */}
      <AnimatePresence>
        {screenFlash && (
          <motion.div
            className="fixed inset-0 z-[47] pointer-events-none"
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.7) 0%, rgba(109,40,217,0.3) 55%, transparent 100%)' }}
          />
        )}
      </AnimatePresence>

      {/* Rainbow overlay — rotating conic gradient */}
      <AnimatePresence>
        {rainbowOn && (
          <motion.div
            key="rainbow-overlay"
            className="fixed inset-0 z-[3] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Rotating conic sweep */}
            <motion.div
              className="absolute inset-[-50%]"
              animate={{ rotate: 360 }}
              transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
              style={{
                background: 'conic-gradient(from 0deg, rgba(255,0,100,0.22), rgba(255,140,0,0.20), rgba(255,255,0,0.18), rgba(0,255,120,0.20), rgba(0,180,255,0.22), rgba(160,0,255,0.22), rgba(255,0,100,0.22))',
              }}
            />
            {/* Pulsing edge glow */}
            <motion.div
              className="absolute inset-0"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ boxShadow: 'inset 0 0 120px rgba(139,92,246,0.5)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cursor dot */}
      <motion.div className="fixed top-0 left-0 w-3 h-3 rounded-full bg-violet-400 pointer-events-none z-50 mix-blend-screen"
        animate={{ x: mouse.x - 6, y: mouse.y - 6 }}
        transition={{ type: 'spring', stiffness: 700, damping: 30, mass: 0.12 }} />
      {/* Cursor ring — scales when dragging */}
      <motion.div className="fixed top-0 left-0 rounded-full pointer-events-none z-50"
        animate={{
          x: mouse.x - 20, y: mouse.y - 20,
          scale: dragging ? 2.0 : 1,
          borderColor: dragging ? 'rgba(139,92,246,0.55)' : 'rgba(139,92,246,0.25)',
        }}
        style={{ width: 40, height: 40, border: '1px solid rgba(139,92,246,0.25)' }}
        transition={{
          x: { type: 'spring', stiffness: 180, damping: 22, mass: 0.6 },
          y: { type: 'spring', stiffness: 180, damping: 22, mass: 0.6 },
          scale: { type: 'spring', stiffness: 300, damping: 20 },
          borderColor: { duration: 0.2 },
        }}
      />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex justify-between items-center px-6 sm:px-10 py-5">
        <button
          onClick={handleLogoClick}
          className="font-mono text-[11px] text-[#333] tracking-[0.2em] uppercase cursor-none hover:text-[#555] transition-colors duration-200 select-none"
        >
          LM
        </button>
        <div className="font-mono text-[11px] flex items-center gap-3 sm:gap-5 tabular-nums">
          <span className="text-violet-500/80">{time}</span>
          <span className="text-[#1e1e1e]">·</span>
          <span className="hidden sm:inline text-[#2a2a2a]">Berlin, DE</span>
          <span className="text-[#1e1e1e]">·</span>
          <span className="text-[#2a2a2a]">fps {fps}</span>
        </div>
      </nav>

      {/* Easter egg toasts */}
      <AnimatePresence>
        {egg1Msg && (
          <motion.div
            className="fixed top-1/2 left-1/2 z-50 pointer-events-none"
            style={{ x: '-50%', y: '-50%' }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          >
            <div className="font-mono text-[12px] text-violet-200 tracking-[0.35em] uppercase px-8 py-4 rounded-full border border-violet-500/50 bg-violet-500/15 backdrop-blur-md text-center whitespace-nowrap">
              <div className="text-base mb-1 text-violet-400">✦</div>
              you found it. nice.
            </div>
          </motion.div>
        )}
        {rainbowOn && (
          <motion.div
            className="fixed top-16 left-1/2 z-50 font-mono text-[11px] tracking-widest uppercase px-5 py-2 rounded-full border border-violet-500/30 bg-black/60 backdrop-blur-sm pointer-events-none"
            style={{ x: '-50%', color: '#c4b5fd' }}
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            rainbow mode — 12 seconds
          </motion.div>
        )}
      </AnimatePresence>

      {/* HERO */}
      <section
        className="relative h-screen overflow-hidden"
        onMouseDown={onHeroMouseDown}
        onMouseMove={onHeroMouseMove}
        onMouseUp={onHeroMouseUp}
        onMouseLeave={onHeroMouseUp}
      >
        <ParticleField actionsRef={actionsRef} globeRef={globeRef} />

        {/* Ambient glow — gives the void some depth */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 48%, rgba(88,28,220,0.07) 0%, rgba(60,10,160,0.04) 45%, transparent 100%)' }} />

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(6,4,14,0.85) 100%)' }} />

        {/* Name + CTA — bottom-left */}
        <div className="absolute bottom-12 left-6 sm:left-10 z-10">
          <motion.div
            className="flex items-baseline gap-2 mb-2 flex-wrap"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <ScrambleName
              text="Laurenz Maass"
              className="text-2xl sm:text-3xl font-black tracking-tight text-white"
            />
            <span className="text-[#2a2a2a] mx-1">·</span>
            <AnimatedRole />
          </motion.div>
          <motion.div className="flex flex-wrap items-center gap-5"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7 }}>
            <a href="mailto:laurenz.maass@gmail.com"
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all duration-300 hover:scale-105 cursor-none shadow-[0_0_24px_rgba(139,92,246,0.35)]">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Get in touch
            </a>
            <span className="font-mono text-[10px] text-[#2a2a2a] flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Open to work
            </span>
          </motion.div>
        </div>

        {/* Hint — bottom-right */}
        <motion.div className="absolute bottom-12 right-6 sm:right-10 z-10 text-right"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 1 }}>
          <p className="font-mono text-[10px] text-[#252525] tracking-widest uppercase">hover · click · drag</p>
        </motion.div>
      </section>

      <Marquee text="Frontend Developer · Vibecoder · Automation Builder · UI Designer · Berlin · n8n · React · Make · Open to Work" />
      <AboutSection />
      <Marquee text="UI Design · React · TypeScript · Tailwind · n8n · Make · Figma · Vibe Coding · Workflow Automation · API Integration" />
      <SkillsSection />
      <ProjectsSection />
      <ContactSection />

      <footer className="border-t border-[#0d0d0d] px-6 sm:px-10 py-6 flex justify-between items-center">
        <span className="font-mono text-[11px] text-[#1e1e1e]">© 2025 Laurenz Maass</span>
        <span className="font-mono text-[11px] text-[#1e1e1e]">
          Built with intention
          {/* Hidden easter egg — nearly invisible dot */}
          <button
            onClick={handleHiddenBtn}
            className="font-mono text-[11px] cursor-none select-none ml-px"
            style={{ color: '#0e0e0e' }}
            tabIndex={-1}
            title=""
          >.</button>
        </span>
      </footer>
    </div>
  )
}
