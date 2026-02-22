export type LandingTrustItem = {
  title: string;
  description?: string;
};

interface LandingTrustStripProps {
  items: LandingTrustItem[];
}

export function LandingTrustStrip({ items }: LandingTrustStripProps) {
  return (
    <ul className="mt-7 grid gap-3 sm:grid-cols-3 sm:gap-3.5" aria-label="Trust signals">
      {items.map((item) => (
        <li
          key={item.title}
          className="rounded-xl border border-surface-border/90 bg-surface/80 px-4 py-3.5"
        >
          <p className="text-sm font-medium leading-6 text-warm">{item.title}</p>
          {item.description && (
            <p className="mt-1 text-sm text-warm-muted">{item.description}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
