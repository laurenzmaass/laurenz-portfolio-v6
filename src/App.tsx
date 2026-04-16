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

const CAPABILITIES = [
  { num: '01', title: 'React',               sub: 'Frontend'   },
  { num: '02', title: 'TypeScript',          sub: 'Frontend'   },
  { num: '03', title: 'Tailwind CSS',        sub: 'Frontend'   },
  { num: '04', title: 'Figma',               sub: 'Design'     },
  { num: '05', title: 'n8n',                 sub: 'Automation' },
  { num: '06', title: 'Make',                sub: 'Automation' },
  { num: '07', title: 'UI Design',           sub: 'Design'     },
  { num: '08', title: 'Vibe Coding',         sub: 'Frontend'   },
  { num: '09', title: 'API Integration',     sub: 'Automation' },
  { num: '10', title: 'Component Libraries', sub: 'Frontend'   },
  { num: '11', title: 'Workflow Automation', sub: 'Automation' },
  { num: '12', title: 'Design Systems',      sub: 'Design'     },
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
      const ang = 18 + Math.random() * 28
      const rad = ang * Math.PI / 180
      const len = 130 + Math.random() * 180
      const dist    = vw * (0.8 + Math.random() * 0.6)
      const travelX = dist * Math.cos(rad)
      const travelY = dist * Math.sin(rad)
      const dur     = 1.1 + Math.random() * 0.8

      const fromTop = Math.random() > 0.2
      const startX  = fromTop ? Math.random() * (vw * 1.3) - vw * 0.15 : -len - 20
      const startY  = fromTop ? -(len * Math.sin(rad)) - 15 : Math.random() * vh * 0.55

      const star: Star = { id, startX, startY, travelX, travelY, angle: ang, length: len, duration: dur }
      setStars(prev => [...prev, star])
      setTimeout(() => setStars(prev => prev.filter(s => s.id !== id)), (dur + 0.4) * 1000)
      setTimeout(spawn, 3500 + Math.random() * 7000)
    }
    const t = setTimeout(spawn, 2200 + Math.random() * 2000)
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
            background: 'linear-gradient(90deg,transparent 0%,rgba(167,139,250,0.75) 45%,rgba(255,255,255,0.95) 100%)',
            borderRadius: 2,
          }}
          initial={{ scaleX: 0, opacity: 0, x: 0, y: 0 }}
          animate={{ scaleX: [0, 1, 1], opacity: [0, 0.95, 0], x: star.travelX, y: star.travelY }}
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
              background: `hsl(${255 + i * 2},70%,${50 + i * 2}%)`,
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


function Marquee({ text }: { text: string }) {
  const repeated = (text + '  ·  ').repeat(6)
  return (
    <div className="overflow-hidden whitespace-nowrap border-y border-[#111] py-3 bg-[#06040e]">
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

// ─── Capability Drag Strip ────────────────────────────────────────────────────

function CapabilityStrip({ reveal }: { reveal: boolean }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [dragLeft, setDragLeft] = useState(0)

  useEffect(() => {
    const calc = () => {
      const outer = outerRef.current
      const inner = innerRef.current
      if (!outer || !inner) return
      const overflow = inner.scrollWidth - outer.clientWidth
      setDragLeft(overflow > 0 ? -overflow : 0)
    }
    const t = setTimeout(calc, 80)
    window.addEventListener('resize', calc)
    return () => { clearTimeout(t); window.removeEventListener('resize', calc) }
  }, [])

  return (
    <div ref={outerRef} className="overflow-hidden w-full select-none py-0.5">
      <motion.div
        ref={innerRef}
        drag="x"
        dragConstraints={{ left: dragLeft, right: 0 }}
        dragElastic={0.07}
        dragTransition={{ bounceStiffness: 520, bounceDamping: 42 }}
        whileDrag={{ cursor: 'grabbing' }}
        style={{ cursor: 'grab' }}
        className="flex gap-3 w-max"
      >
        {CAPABILITIES.map((cap, i) => (
          <motion.div
            key={cap.num}
            className="flex-shrink-0 w-[158px] rounded-2xl p-5 border relative overflow-hidden group"
            style={{ borderColor: '#13102a', background: '#080614' }}
            initial={{ opacity: 0, y: 22 }}
            animate={reveal ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
            transition={{ delay: 1.25 + i * 0.05, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ borderColor: 'rgba(139,92,246,0.50)', background: '#0f0820' }}
          >
            <span className="font-mono text-[10px] text-[#1e183a] block mb-7 group-hover:text-[#2d2550] transition-colors duration-200">
              {cap.num}
            </span>
            <p className="text-[#666] font-semibold text-sm leading-tight group-hover:text-white transition-colors duration-200">
              {cap.title}
            </p>
            <p className="font-mono text-[10px] text-[#24203a] mt-1.5 group-hover:text-violet-500/60 transition-colors duration-200">
              {cap.sub}
            </p>
            {/* bottom glow on hover */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: 'radial-gradient(ellipse at 50% 130%,rgba(139,92,246,0.14) 0%,transparent 65%)' }}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HEADLINE_LINES = ['I DESIGN.', 'I BUILD.', 'I SHIP.']

function HeroSection() {
  const [reveal, setReveal] = useState(false)

  useEffect(() => {
    // Start revealing while curtain is mid-lift (~0.75s into 1.05s animation)
    const t = setTimeout(() => setReveal(true), 850)
    return () => clearTimeout(t)
  }, [])

  return (
    <section className="relative h-screen overflow-hidden flex flex-col px-6 sm:px-10">

      {/* Dot-grid background — pure CSS, zero JS cost */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(100,70,200,0.17) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />
      {/* Radial vignette — edges fade to bg colour */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 90% 80% at 50% 40%, transparent 20%, #06040e 100%)',
        }}
      />
      {/* Soft centre bloom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 55% 45% at 50% 38%, rgba(80,30,180,0.07) 0%, transparent 100%)',
        }}
      />

      {/* Eyebrow */}
      <div className="overflow-hidden pt-[7.5rem]">
        <motion.p
          className="font-mono text-[10px] text-[#2e2e3a] tracking-[0.28em] uppercase"
          initial={{ y: '120%' }}
          animate={reveal ? { y: 0 } : {}}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        >
          Frontend Developer&nbsp;&nbsp;·&nbsp;&nbsp;Automation Builder&nbsp;&nbsp;·&nbsp;&nbsp;Berlin
        </motion.p>
      </div>

      {/* ── Headline + right column ── */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] items-end gap-y-6 lg:gap-x-12">

          {/* Three-line headline — each line clips up */}
          <div>
            {HEADLINE_LINES.map((line, i) => (
              <div key={line} className="overflow-hidden">
                <motion.div
                  initial={{ y: '108%' }}
                  animate={reveal ? { y: 0 } : {}}
                  transition={{
                    duration: 1.08,
                    delay: 0.06 + i * 0.11,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <span
                    className="font-black tracking-tight block"
                    style={{
                      fontSize: 'clamp(50px, 10.5vw, 150px)',
                      lineHeight: 1.0,
                      ...(i < 2
                        ? { color: '#e8e8e8' }
                        : {
                            background: 'linear-gradient(130deg,#8b5cf6 0%,#6366f1 45%,#a78bfa 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                          }),
                    }}
                  >
                    {line}
                  </span>
                </motion.div>
              </div>
            ))}
          </div>

          {/* Right: description + CTA — desktop only */}
          <div className="hidden lg:flex flex-col justify-end gap-6 pb-1">
            <motion.p
              className="text-sm text-[#3d3d50] leading-relaxed"
              initial={{ opacity: 0, y: 18 }}
              animate={reveal ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.48, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            >
              React &amp; TypeScript on the frontend.<br />
              n8n &amp; Make for automation.<br />
              Finishing studies in Berlin —<br />
              actively looking for full-time roles.
            </motion.p>
            <motion.div
              className="flex items-center gap-4"
              initial={{ opacity: 0, y: 14 }}
              animate={reveal ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.60, duration: 0.75 }}
            >
              <a
                href="mailto:laurenz.maass@gmail.com"
                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all duration-300 hover:scale-105 cursor-none shadow-[0_0_22px_rgba(139,92,246,0.35)]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Get in touch
              </a>
              <span className="font-mono text-[10px] text-[#2a2a3a] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Open to work
              </span>
            </motion.div>
          </div>
        </div>

        {/* Mobile CTA */}
        <motion.div
          className="lg:hidden mt-5 flex flex-wrap items-center gap-4"
          initial={{ opacity: 0, y: 14 }}
          animate={reveal ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.42, duration: 0.72 }}
        >
          <a
            href="mailto:laurenz.maass@gmail.com"
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all duration-300 cursor-none shadow-[0_0_22px_rgba(139,92,246,0.35)]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Get in touch
          </a>
          <span className="font-mono text-[10px] text-[#2a2a3a] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            Open to work
          </span>
        </motion.div>
      </div>

      {/* ── Capability drag strip ── */}
      <motion.div
        className="pb-2"
        initial={{ opacity: 0 }}
        animate={reveal ? { opacity: 1 } : {}}
        transition={{ delay: 1.0, duration: 0.7 }}
      >
        <CapabilityStrip reveal={reveal} />
      </motion.div>

      {/* Bottom bar */}
      <div className="pb-10 flex items-center justify-between">
        <motion.span
          className="font-mono text-[10px] text-[#1e1e30] tracking-widest uppercase"
          initial={{ opacity: 0 }}
          animate={reveal ? { opacity: 1 } : {}}
          transition={{ delay: 1.55, duration: 0.8 }}
        >
          drag to explore →
        </motion.span>
        <motion.span
          className="font-mono text-[10px] text-[#252538]"
          initial={{ opacity: 0 }}
          animate={reveal ? { opacity: 1 } : {}}
          transition={{ delay: 1.65, duration: 0.8 }}
        >
          scroll ↓
        </motion.span>
      </div>
    </section>
  )
}

// ─── Sections ─────────────────────────────────────────────────────────────────

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
  const mouse  = useMousePosition()
  const time   = useBerlinTime()
  const fps    = useFPS()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })

  // ── Opening curtain ──────────────────────────────────────────────────────
  const [curtain, setCurtain] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setCurtain(false), 750)
    return () => clearTimeout(t)
  }, [])

  // ── Easter eggs ──────────────────────────────────────────────────────────
  const logoClicksRef             = useRef(0)
  const [egg1Msg, setEgg1Msg]     = useState(false)
  const [rainbowOn, setRainbowOn] = useState(false)
  const [screenFlash, setScreenFlash] = useState(false)

  const handleLogoClick = useCallback(() => {
    logoClicksRef.current++
    if (logoClicksRef.current >= 5) {
      logoClicksRef.current = 0
      setScreenFlash(true)
      setTimeout(() => setScreenFlash(false), 700)
      setEgg1Msg(true)
      setTimeout(() => setEgg1Msg(false), 3200)
    }
  }, [])

  const handleHiddenBtn = useCallback(() => {
    if (rainbowOn) return
    setRainbowOn(true)
    setTimeout(() => setRainbowOn(false), 12000)
  }, [rainbowOn])

  return (
    <div className="bg-[#06040e] text-[#e8e8e8] min-h-screen font-sans antialiased cursor-none overflow-x-hidden">

      {/* Scroll progress */}
      <motion.div style={{ scaleX }} className="fixed top-0 left-0 right-0 h-[2px] bg-violet-500 origin-left z-50" />

      {/* ── Opening curtain ── */}
      <AnimatePresence>
        {curtain && (
          <motion.div
            key="curtain"
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5"
            style={{ background: '#06040e' }}
            initial={{ y: '0%' }}
            exit={{ y: '-100%' }}
            transition={{ duration: 1.05, ease: [0.76, 0, 0.24, 1] }}
          >
            <motion.span
              className="font-mono text-[13px] text-[#2a2a2a] tracking-[0.55em] uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              LM
            </motion.span>
            {/* Loading bar */}
            <div className="w-28 h-px bg-[#111] overflow-hidden relative rounded-full">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: 'rgba(139,92,246,0.7)' }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.62, ease: [0.4, 0, 0.6, 1] }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ShootingStars />
      <CursorTrail mouse={mouse} />
      <CursorClickEffect />

      {/* Screen flash */}
      <AnimatePresence>
        {screenFlash && (
          <motion.div
            className="fixed inset-0 z-[47] pointer-events-none"
            initial={{ opacity: 0.8 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ background: 'radial-gradient(ellipse at center,rgba(139,92,246,0.7) 0%,rgba(109,40,217,0.3) 55%,transparent 100%)' }}
          />
        )}
      </AnimatePresence>

      {/* Rainbow overlay */}
      <AnimatePresence>
        {rainbowOn && (
          <motion.div
            key="rainbow"
            className="fixed inset-0 z-[3] pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="absolute inset-[-50%]"
              animate={{ rotate: 360 }}
              transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
              style={{ background: 'conic-gradient(from 0deg,rgba(255,0,100,0.22),rgba(255,140,0,0.20),rgba(255,255,0,0.18),rgba(0,255,120,0.20),rgba(0,180,255,0.22),rgba(160,0,255,0.22),rgba(255,0,100,0.22))' }}
            />
            <motion.div
              className="absolute inset-0"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ boxShadow: 'inset 0 0 120px rgba(139,92,246,0.5)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom cursor */}
      <motion.div
        className="fixed top-0 left-0 w-3 h-3 rounded-full bg-violet-400 pointer-events-none z-50 mix-blend-screen"
        animate={{ x: mouse.x - 6, y: mouse.y - 6 }}
        transition={{ type: 'spring', stiffness: 700, damping: 30, mass: 0.12 }}
      />
      <motion.div
        className="fixed top-0 left-0 rounded-full pointer-events-none z-50"
        animate={{ x: mouse.x - 20, y: mouse.y - 20 }}
        style={{ width: 40, height: 40, border: '1px solid rgba(139,92,246,0.25)' }}
        transition={{
          x: { type: 'spring', stiffness: 180, damping: 22, mass: 0.6 },
          y: { type: 'spring', stiffness: 180, damping: 22, mass: 0.6 },
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

      {/* Page sections */}
      <HeroSection />
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
