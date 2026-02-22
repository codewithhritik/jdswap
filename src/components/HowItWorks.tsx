export type LandingStep = {
  title: string;
  detail: string;
};

interface HowItWorksProps {
  steps: LandingStep[];
}

export function HowItWorks({ steps }: HowItWorksProps) {
  return (
    <section
      className="mt-6 rounded-2xl border border-surface-border/80 bg-surface/70 p-4 sm:p-5"
      aria-labelledby="how-it-works"
    >
      <h2 id="how-it-works" className="text-base font-medium text-warm">
        How it works
      </h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-xl border border-surface-border/70 bg-base/30 p-3">
            <p className="text-xs font-mono text-warm-muted">Step {index + 1}</p>
            <p className="mt-1 text-sm font-medium text-warm">{step.title}</p>
            <p className="mt-1 text-sm text-warm-muted">{step.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
