// Neutral footer shipped as the CiBoard default. No FixPortal branding or
// personal attribution -- reusers pass their own node via CiBoard's footerSlot.
export function DefaultFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__band" aria-hidden="true">
        <span className="site-footer__tagline">Continuous-integration overview</span>
      </div>
    </footer>
  )
}
