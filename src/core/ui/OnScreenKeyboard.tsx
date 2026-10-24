const ROWS = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ'];

/**
 * Letter grid for typing with a controller (or on a TV). Every key is
 * data-focusable, so the D-pad/stick moves between letters and A types.
 */
export function OnScreenKeyboard({
  value,
  onChange,
  onDone,
  max = 20,
}: {
  value: string;
  onChange: (v: string) => void;
  onDone?: () => void;
  max?: number;
}) {
  const type = (ch: string) => {
    if (value.length >= max) return;
    // Capitalise the first letter, lower-case the rest: "Emma".
    onChange(value + (value.length === 0 || value.endsWith(' ') ? ch : ch.toLowerCase()));
  };
  return (
    <div className="osk" role="group" aria-label="On-screen keyboard">
      {ROWS.map((row) => (
        <div key={row} className="osk__row">
          {row.split('').map((ch) => (
            <button key={ch} type="button" className="osk__key" data-focusable onClick={() => type(ch)}>
              {ch}
            </button>
          ))}
        </div>
      ))}
      <div className="osk__row">
        <button type="button" className="osk__key osk__key--wide" data-focusable onClick={() => type(' ')}>
          Space
        </button>
        <button type="button" className="osk__key osk__key--wide" data-focusable onClick={() => onChange(value.slice(0, -1))}>
          ⌫ Delete
        </button>
        {onDone && (
          <button type="button" className="osk__key osk__key--wide osk__key--done" data-focusable onClick={onDone} disabled={!value.trim()}>
            ✓ Done
          </button>
        )}
      </div>
    </div>
  );
}
