import Link from 'next/link'

const navigation = {
  product: [
    { label: 'Listings', href: '/listings' },
    { label: 'Materials library', href: '/agent/materials-manager' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'Create account', href: '/register' },
  ],
  resources: [
    { label: 'Sign in', href: '/login' },
    { label: 'Agent sign in', href: '/agent/login' },
    { label: 'Support', href: 'mailto:support@estatepro.studio' },
  ],
}

export default function Footer() {
  return (
    <footer className="flex-shrink-0 border-t border-[color:var(--surface-border)] bg-[color:var(--surface-0)]">
      <div className="container py-12 text-muted">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="space-y-4">
            <div className="text-lg font-semibold tracking-tight text-primary">
              EstatePro
            </div>
            <p className="text-sm text-secondary">
              Modern real estate platform for agents and buyers. Upload property details and media to create premium listings.
            </p>
            <div className="text-xs text-disabled">
              © {new Date().getFullYear()} EstatePro. All rights reserved.
            </div>
          </div>
          {Object.entries(navigation).map(([title, links]) => (
            <div key={title} className="space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-secondary">
                {title}
              </h4>
              <ul className="space-y-2 text-sm text-secondary">
                {links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith('mailto:') ? (
                      <a className="transition-colors hover:text-primary" href={link.href}>
                        {link.label}
                      </a>
                    ) : (
                      <Link className="transition-colors hover:text-primary" href={link.href}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}
