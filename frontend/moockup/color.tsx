import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'

// Color system for the Arciva app (CI: Stone Trail)
// 1) Brand families: Clay (brand), Basalt (ink), Sand (accent)
// 2) Semantic tokens mapped to families
// 3) Live usage examples (buttons, tags, surfaces)

const PALETTE = {
  clay: {
    50: '#F7EDE8',
    100: '#F0E0D7',
    200: '#E4C6B6',
    300: '#D7AD98',
    400: '#C78772',
    500: '#A56A4A', // core brand
    600: '#8F593E',
    700: '#724633',
    800: '#57372A',
    900: '#3E271E',
  },
  basalt: {
    50: '#F3F2F0',
    100: '#E5E2DD',
    200: '#CDC7BE',
    300: '#B2A89B',
    400: '#8C8478',
    500: '#4A463F', // ink
    600: '#3E3934',
    700: '#332F2B',
    800: '#262320',
    900: '#181613',
  },
  sand: {
    50: '#FBF7EF',
    100: '#F6EEDD',
    200: '#EDE1C6',
    300: '#E3D4B1',
    400: '#D7C5A6',
    500: '#CBB58F',
    600: '#B49C76',
    700: '#9A815C',
    800: '#7C6649',
    900: '#5C4B35',
  },
  green: {
    50: '#ECF8F2',
    100: '#D6F1E3',
    200: '#B2E6CD',
    300: '#84D7B0',
    400: '#57C894',
    500: '#34B37A', // success
    600: '#279565',
    700: '#1E7652',
    800: '#175D43',
    900: '#114537',
  },
  yellow: {
    50: '#FFF9E8',
    100: '#FFF2CC',
    200: '#FFE79E',
    300: '#FFD863',
    400: '#FFCA2C',
    500: '#E4AD07', // warning
    600: '#C18F05',
    700: '#9D7204',
    800: '#7A5703',
    900: '#5B4102',
  },
  red: {
    50: '#FDEBEA',
    100: '#FAD3D0',
    200: '#F4AFAA',
    300: '#EC807A',
    400: '#E15552',
    500: '#C73A37', // danger
    600: '#A92F2C',
    700: '#8D2624',
    800: '#6E1E1C',
    900: '#531614',
  },
  neutral: {
    0: '#FFFFFF',
    25: '#FBF7EF', // surface-subtle
    50: '#F7F3EC',
    100: '#EEE9E0',
    200: '#E3DBCF',
    300: '#D6CDC0',
    400: '#C8BFAF',
    500: '#B5AB9A',
    600: '#9B9488',
    700: '#6B645B',
    800: '#1F1E1B', // body text
    900: '#0F0E0C',
  },
}

// Semantic design tokens (light + dark). Attach to :root via CSS variables so the rest
// of the app can consume them using var(--token).
const makeCSSVars = (mode: 'light' | 'dark') => ({
  // text
  '--text': mode === 'light' ? PALETTE.neutral[800] : PALETTE.neutral[0],
  '--text-muted': mode === 'light' ? PALETTE.neutral[700] : PALETTE.neutral[500],
  // surfaces
  '--surface': mode === 'light' ? PALETTE.neutral[0] : PALETTE.neutral[900],
  '--surface-subtle': mode === 'light' ? PALETTE.neutral[25] : PALETTE.basalt[800],
  // borders
  '--border': mode === 'light' ? PALETTE.sand[200] : PALETTE.basalt[600],
  // brand primary
  '--primary': mode === 'light' ? PALETTE.clay[500] : PALETTE.clay[400],
  '--primary-contrast': mode === 'light' ? PALETTE.neutral[0] : PALETTE.neutral[900],
  // accent
  '--accent': mode === 'light' ? PALETTE.sand[400] : PALETTE.sand[300],
  // feedback
  '--success': PALETTE.green[500],
  '--warning': PALETTE.yellow[500],
  '--danger': PALETTE.red[500],
  // ink
  '--ink': PALETTE.basalt[500],
})

const Swatch: React.FC<{ name: string; value: string; note?: string }> = ({
  name,
  value,
  note,
}) => (
  <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
    <div className="h-16" style={{ background: value }} />
    <div
      className="px-3 py-2 text-xs flex justify-between items-center"
      style={{ color: 'var(--text)' }}
    >
      <span className="font-medium">{name}</span>
      <span className="tabular-nums opacity-70">{value}</span>
    </div>
    {note && (
      <div className="px-3 pb-3 text-[11px] opacity-80" style={{ color: 'var(--text-muted)' }}>
        {note}
      </div>
    )}
  </div>
)

const Family: React.FC<{ title: string; shades: Record<string, string> }> = ({ title, shades }) => (
  <div>
    <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
      {title}
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {Object.entries(shades).map(([k, v]) => (
        <Swatch key={k} name={k} value={v} />
      ))}
    </div>
  </div>
)

const TokenRow: React.FC<{
  label: string
  varName: string
  purpose: string
  example?: React.ReactNode
}> = ({ label, varName, purpose, example }) => (
  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
    <div className="sm:col-span-1 text-xs font-medium" style={{ color: 'var(--text)' }}>
      {label}
    </div>
    <div className="sm:col-span-2 text-xs" style={{ color: 'var(--text-muted)' }}>
      {purpose}
    </div>
    <div className="sm:col-span-2">
      <div
        className="rounded-xl border p-2 flex items-center gap-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="h-6 w-6 rounded" style={{ background: `var(${varName})` }} />
        <code className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {varName}
        </code>
        <div className="ml-auto">{example}</div>
      </div>
    </div>
  </div>
)

const DemoButton: React.FC<{ kind: 'primary' | 'ghost' | 'danger' }> = ({ kind, children }) => {
  const styles =
    kind === 'primary'
      ? {
          background: 'var(--primary)',
          color: 'var(--primary-contrast)',
          border: '1px solid var(--primary)',
        }
      : kind === 'danger'
        ? { background: 'var(--danger)', color: '#fff', border: '1px solid var(--danger)' }
        : { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }
  return (
    <button className="h-8 px-3 rounded-full text-xs" style={styles}>
      {children}
    </button>
  )
}

const DemoTag: React.FC<{ tone?: 'accent' | 'success' | 'warning' | 'danger' }> = ({
  tone = 'accent',
  children,
}) => (
  <span
    className="px-2 py-1 rounded-full text-[11px] border"
    style={{
      background: `color-mix(in oklab, var(--${tone}) 20%, white)`,
      color: 'var(--ink)',
      borderColor: `color-mix(in oklab, var(--${tone}) 55%, var(--border))`,
    }}
  >
    {children}
  </span>
)

export default function ColorPaletteShowcase() {
  const [mode, setMode] = useState<'light' | 'dark'>('light')
  const cssVars = useMemo(() => makeCSSVars(mode), [mode])

  return (
    <div
      className="min-h-screen p-6 sm:p-10"
      style={{ background: 'var(--surface-subtle)', ...(cssVars as React.CSSProperties) }}
    >
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="flex items-center gap-3">
          <div
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <ellipse cx="7" cy="16" rx="2.6" ry="2" fill={PALETTE.clay[500]} />
              <ellipse cx="12" cy="12" rx="2.2" ry="1.7" fill={PALETTE.sand[400]} />
              <ellipse cx="16.5" cy="8.5" rx="1.9" ry="1.5" fill={PALETTE.basalt[500]} />
            </svg>
          </div>
          <div>
            <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Arciva — Color System (Stone Trail CI)
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Use semantic tokens. Brand families shown below.
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {mode === 'light' ? 'Light' : 'Dark'}
            </span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={mode === 'dark'}
                onChange={(e) => setMode(e.target.checked ? 'dark' : 'light')}
              />
              <span className="h-6 w-11 rounded-full bg-gray-300 peer-checked:bg-gray-700 after:content-[''] after:absolute after:h-5 after:w-5 after:bg-white after:rounded-full after:top-0.5 after:left-0.5 peer-checked:after:left-5 transition-all"></span>
            </label>
          </div>
        </div>

        <section className="space-y-6">
          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Brand families
          </div>
          <div className="space-y-6">
            <Family title="Clay (brand)" shades={PALETTE.clay} />
            <Family title="Basalt (ink)" shades={PALETTE.basalt} />
            <Family title="Sand (accent)" shades={PALETTE.sand} />
            <Family title="Green (success)" shades={PALETTE.green} />
            <Family title="Yellow (warning)" shades={PALETTE.yellow} />
            <Family title="Red (danger)" shades={PALETTE.red} />
          </div>
        </section>

        <section className="space-y-4">
          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Semantic tokens
          </div>
          <div className="space-y-3">
            <TokenRow
              label="--text"
              varName="--text"
              purpose="Primary text on surfaces"
              example={
                <span className="text-xs" style={{ color: 'var(--text)' }}>
                  Aa
                </span>
              }
            />
            <TokenRow
              label="--text-muted"
              varName="--text-muted"
              purpose="Secondary text, hints"
              example={
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Aa
                </span>
              }
            />
            <TokenRow
              label="--surface"
              varName="--surface"
              purpose="Cards, sheets"
              example={
                <div className="h-6 w-10 rounded" style={{ background: 'var(--surface)' }} />
              }
            />
            <TokenRow
              label="--surface-subtle"
              varName="--surface-subtle"
              purpose="App background"
              example={
                <div className="h-6 w-10 rounded" style={{ background: 'var(--surface-subtle)' }} />
              }
            />
            <TokenRow
              label="--border"
              varName="--border"
              purpose="Neutral borders"
              example={
                <div className="h-6 w-10 rounded border" style={{ borderColor: 'var(--border)' }} />
              }
            />
            <TokenRow
              label="--primary"
              varName="--primary"
              purpose="Primary actions"
              example={<DemoButton kind="primary">Primary</DemoButton>}
            />
            <TokenRow
              label="--primary-contrast"
              varName="--primary-contrast"
              purpose="Text on primary"
              example={
                <div
                  className="px-2 py-1 rounded"
                  style={{ background: 'var(--primary)', color: 'var(--primary-contrast)' }}
                >
                  Aa
                </div>
              }
            />
            <TokenRow
              label="--accent"
              varName="--accent"
              purpose="Highlights, selection"
              example={<DemoTag>Accent</DemoTag>}
            />
            <TokenRow
              label="--success"
              varName="--success"
              purpose="Positive status"
              example={<DemoTag tone="success">Success</DemoTag>}
            />
            <TokenRow
              label="--warning"
              varName="--warning"
              purpose="Caution status"
              example={<DemoTag tone="warning">Warning</DemoTag>}
            />
            <TokenRow
              label="--danger"
              varName="--danger"
              purpose="Destructive"
              example={<DemoButton kind="danger">Delete</DemoButton>}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Usage examples
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              className="rounded-2xl border p-4 space-y-3"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Primary CTA
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Use --primary for the main action on a screen.
              </div>
              <div className="flex gap-2">
                <DemoButton kind="primary">Upload</DemoButton>
                <DemoButton kind="ghost">Cancel</DemoButton>
              </div>
            </div>
            <div
              className="rounded-2xl border p-4 space-y-3"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Selection & Tags
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Use --accent for selection states or non-critical highlights.
              </div>
              <div className="flex gap-2 flex-wrap">
                <DemoTag>Client</DemoTag>
                <DemoTag>Outdoor</DemoTag>
                <DemoTag>Editorial</DemoTag>
              </div>
            </div>
            <div
              className="rounded-2xl border p-4 space-y-3"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Feedback
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Use --success / --warning / --danger for status messaging.
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div
                  className="rounded p-2"
                  style={{
                    background: `color-mix(in oklab, var(--success) 20%, white)`,
                    color: 'var(--ink)',
                    border: '1px solid',
                    borderColor: `color-mix(in oklab, var(--success) 55%, var(--border))`,
                  }}
                >
                  Saved
                </div>
                <div
                  className="rounded p-2"
                  style={{
                    background: `color-mix(in oklab, var(--warning) 20%, white)`,
                    color: 'var(--ink)',
                    border: '1px solid',
                    borderColor: `color-mix(in oklab, var(--warning) 55%, var(--border))`,
                  }}
                >
                  Missing EXIF
                </div>
                <div
                  className="rounded p-2"
                  style={{
                    background: `color-mix(in oklab, var(--danger) 20%, white)`,
                    color: 'var(--ink)',
                    border: '1px solid',
                    borderColor: `color-mix(in oklab, var(--danger) 55%, var(--border))`,
                  }}
                >
                  Failed
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Implementation: attach tokens to :root (or a theme class) and consume via CSS variables.
          </div>
          <pre
            className="rounded-xl p-3 overflow-auto text-xs"
            style={{
              background: 'var(--surface)',
              border: '1px solid',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          >
            {`:root {
  --text: ${PALETTE.neutral[800]};
  --text-muted: ${PALETTE.neutral[700]};
  --surface: ${PALETTE.neutral[0]};
  --surface-subtle: ${PALETTE.neutral[25]};
  --border: ${PALETTE.sand[200]};
  --primary: ${PALETTE.clay[500]};
  --primary-contrast: ${PALETTE.neutral[0]};
  --accent: ${PALETTE.sand[400]};
  --success: ${PALETTE.green[500]};
  --warning: ${PALETTE.yellow[500]};
  --danger: ${PALETTE.red[500]};
  --ink: ${PALETTE.basalt[500]};
}`}
          </pre>
        </section>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center text-[11px]"
          style={{ color: 'var(--text-muted)' }}
        >
          Toggle light/dark to see token remapping.
        </motion.div>
      </div>
    </div>
  )
}
