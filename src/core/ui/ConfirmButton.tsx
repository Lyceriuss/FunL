import { useState, type ReactNode } from 'react';

/**
 * A button that asks "Sure?" inline before acting. Replaces window.confirm(),
 * which a controller can't operate.
 */
export function ConfirmButton({
  children,
  question = 'Sure?',
  yes = 'Yes',
  onConfirm,
  className = 'chip',
}: {
  children: ReactNode;
  question?: string;
  yes?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} data-focusable onClick={() => setAsking(true)}>
        {children}
      </button>
    );
  }
  return (
    <span className="confirm-inline" role="group" aria-label={question}>
      <span className="confirm-inline__q">{question}</span>
      <button
        type="button"
        className="btn btn--danger"
        data-focusable
        autoFocus
        onClick={async () => {
          setAsking(false);
          await onConfirm();
        }}
      >
        {yes}
      </button>
      <button type="button" className="btn" data-focusable onClick={() => setAsking(false)}>
        No
      </button>
    </span>
  );
}
