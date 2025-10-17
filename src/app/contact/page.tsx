'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function ContactPage() {
  return (
    <div className="container py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-1)] p-8 text-sm text-secondary shadow-[var(--shadow-soft)]"
      >
        <div>
          <h1 className="text-[30px] font-semibold text-primary">Let’s coordinate your next launch</h1>
          <p className="mt-3 text-secondary">
            EstatePro is currently onboarding partners in waves. Share a quick note about your portfolio and we’ll align on access, onboarding, and data migration.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Talk with us</h2>
            <p className="mt-1 text-secondary">
              Email <Link href="mailto:partners@estatepro.studio" className="text-brand-strong underline decoration-brand hover:text-brand">
                partners@estatepro.studio
              </Link>{' '}
              with:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
              <li>Property pipeline size and typical file formats (IFC, RVT, DXF, GLB, etc.).</li>
              <li>Preferred go-live timeline for interactive listings.</li>
              <li>Any existing material libraries or pricing rules you want imported.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Need support?</h2>
            <p className="mt-1 text-secondary">
              Existing teams can open a support ticket inside the agent dashboard or email{' '}
              <Link href="mailto:support@estatepro.studio" className="text-brand-strong underline decoration-brand hover:text-brand">
                support@estatepro.studio
              </Link>
              .
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Press & partnerships</h2>
            <p className="mt-1 text-secondary">
              For press inquiries or partnership opportunities, reach out to{' '}
              <Link href="mailto:hello@estatepro.studio" className="text-brand-strong underline decoration-brand hover:text-brand">
                hello@estatepro.studio
              </Link>
              .
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
