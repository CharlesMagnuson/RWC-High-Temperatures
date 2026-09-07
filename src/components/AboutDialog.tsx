import { useEffect, useRef, type MouseEvent } from 'react';
import { X } from '@phosphor-icons/react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PARAGRAPHS = [
  '“Why is it so hot?!?? The forecast last night said high 60s, but it feels like low 80s!” This thought crossed my mind so many times that I decided to start documenting the numbers. The result is RedwoodCityIs.Hot.',
  'Every day at about midnight, the forecasted high temperature for the coming day is recorded. Later in the evening that same day, the actual high temperature is recorded. Those two numbers are then compared on this website to see how they differ over time.',
  'The data is not scientific. Forecast numbers come from Weather Underground. Actual data comes from the Netatmo temperature sensor under a tree in my patio area. It might not be good enough for a scientific journal, but for demonstrating what I feel outside it’s more than enough.',
  'RedwoodCityIs.Hot is a product of Magnuson Heavy Industries. Fascism is for losers.',
];

// A native <dialog> driven by React state. showModal() (not the `open`
// attribute) is what puts it in the top layer with a backdrop, Escape-to-close,
// and a focus trap — so the element owns those behaviours and React only
// mirrors its open/closed state via the `close` event.
export function AboutDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // The dialog box itself is the click target only when the click lands on
  // the ::backdrop (the panel inside swallows everything else).
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) e.currentTarget.close();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={onClick}
      aria-labelledby="about-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] border border-border bg-card p-0 text-card-foreground backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <h2 id="about-title" className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
          ABOUT
        </h2>
        <button
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="flex h-6 w-6 items-center justify-center border border-border text-muted-foreground"
        >
          <X size={12} />
        </button>
      </div>
      <div className="space-y-3 px-6 py-5 text-[12px] leading-relaxed">
        {PARAGRAPHS.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
    </dialog>
  );
}
