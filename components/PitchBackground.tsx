export default function PitchBackground() {
    return (
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-jet">
        <div
          className="absolute inset-x-0 top-0 h-[60vh]"
          style={{ background: "radial-gradient(70% 100% at 50% 0%, rgba(59,10,107,.35), transparent 70%)" }}
        />
        <svg
          className="absolute left-1/2 top-1/2 h-[120vmax] w-[120vmax] -translate-x-1/2 -translate-y-1/2 text-white opacity-[.05]"
          viewBox="0 0 400 600" fill="none" stroke="currentColor" strokeWidth="1.2"
        >
          <rect x="20" y="20" width="360" height="560" />
          <line x1="20" y1="300" x2="380" y2="300" />
          <circle cx="200" cy="300" r="50" />
          <path d="M120 20 v50 a80 80 0 0 0 160 0 v-50" />
          <path d="M120 580 v-50 a80 80 0 0 1 160 0 v50" />
        </svg>
      </div>
    );
  }