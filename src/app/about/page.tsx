'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

const highlights = [
  {
    title: 'Immersive showcase',
    body: 'Every listing is delivered with photorealistic walkthroughs, configurable finishes, and shareable buyer views—no downloads, no plug-ins.'
  },
  {
    title: 'Agent-first control',
    body: 'Upload drawings or BIM, curate material catalogs, tune pricing scenarios, and publish when each space feels presentation-ready.'
  },
  {
    title: 'Buyer confidence',
    body: 'Prospects explore freely, compare finish packages, and see pricing impact in real time so decisions land faster and with fewer revisions.'
  }
]

const values = [
  {
    heading: 'Precision + atmosphere',
    detail: 'We merge spatial accuracy with cinematic lighting so stakeholders trust what they are seeing and feel drawn into the home.'
  },
  {
    heading: 'Single source of truth',
    detail: 'Geometry, selections, and pricing stay synchronised from first upload through to final export—no more parallel spreadsheets.'
  },
  {
    heading: 'Guided collaboration',
    detail: 'Agents set guardrails, buyers explore within curated choices, and every change is recorded for downstream teams.'
  }
]

const timeline = [
  {
    label: 'Upload',
    description: 'Drop IFC, RVT, DXF/DWG, GLB/GLTF, or packaged ZIP files. EstatePro analyses geometry, enriches missing data, and prepares viewer-ready scenes.'
  },
  {
    label: 'Curate',
    description: 'Assign material libraries, review AI suggestions, tweak lighting, and add pricing rules before publishing to the marketplace.'
  },
  {
    label: 'Publish',
    description: 'Launch buyer-friendly links with built-in walkthroughs, measurement tools, and downloadable spec sheets.'
  },
  {
    label: 'Decide',
    description: 'Track selections, approve change requests, and export definitive IFC/GLB/USD bundles for fabrication and field teams.'
  }
]

export default function AboutPage() {
  return (
    <div className="space-y-16 pb-20">
      <section className="container grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-5"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-brand bg-brand-soft px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-brand-strong">
            EstatePro
          </span>
          <h1 className="text-[34px] font-semibold leading-snug text-primary md:text-[40px]">
            Real estate storytelling built on accurate space, curated finishes, and live pricing
          </h1>
          <p className="max-w-2xl text-sm text-secondary">
            EstatePro is the immersive heart of a modern sales journey. Agents bring architectural intent—drawings, BIM, or design bundles—and we return interactive experiences buyers can trust. Every upload becomes a navigable model, pricing canvas, and collaboration hub.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <span className="rounded-full border border-brand bg-brand-softer px-3 py-1 text-brand-strong">Marketplace-ready listings</span>
            <span className="rounded-full border border-brand bg-brand-softer px-3 py-1 text-brand-strong">Configurable finish libraries</span>
            <span className="rounded-full border border-brand bg-brand-softer px-3 py-1 text-brand-strong">Verified exports for delivery teams</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 shadow-[var(--shadow-soft)]"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">What drives us</h2>
          <ul className="mt-4 space-y-4 text-sm text-secondary">
            <li>
              We believe buyers fall in love with both the atmosphere <em>and</em> the details—lighting, finishes, and price transparency must live together.
            </li>
            <li>
              We keep authoritative data in sync, so when an agent publishes a listing, the same geometry and selections flow through pricing reviews, buyer approvals, and production handoffs.
            </li>
            <li>
              We design for teams: agents stay in control, developers get clean change logs, and buyers are empowered to decide with confidence.
            </li>
          </ul>
        </motion.div>
      </section>

      <section className="container grid gap-4 md:grid-cols-3">
        {highlights.map((item) => (
          <div key={item.title} className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 shadow-[var(--shadow-soft)]">
            <h3 className="text-base font-semibold text-primary">{item.title}</h3>
            <p className="mt-2 text-sm text-secondary">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="container space-y-6">
        <h2 className="text-xl font-semibold text-primary">From intake to decision</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {timeline.map((step) => (
            <div key={step.label} className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-5 text-sm text-secondary shadow-[var(--shadow-soft)]">
              <div className="text-xs uppercase tracking-wide text-muted">{step.label}</div>
              <p className="mt-2 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container grid gap-6 md:grid-cols-3">
        {values.map((value) => (
          <div key={value.heading} className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 text-sm text-secondary shadow-[var(--shadow-soft)]">
            <h3 className="text-base font-semibold text-primary">{value.heading}</h3>
            <p className="mt-2 leading-relaxed">{value.detail}</p>
          </div>
        ))}
      </section>

      <section className="container rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">Ready to publish your next experience?</h2>
            <p className="text-sm text-secondary">Agents can upload design intent today and launch listings with immersive walk-throughs tomorrow.</p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link href="/register" className="btn btn-primary px-5 py-2 text-xs">
              Create an agent account
            </Link>
            <Link href="/listings" className="btn btn-secondary px-5 py-2 text-xs">
              Explore active listings
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
