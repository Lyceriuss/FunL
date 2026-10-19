import { MODULES } from '../core/modules/registry';
import type { Profile } from '../core/telemetry/types';
import { Screen } from '../core/ui/Screen';

export function HomeScreen({
  profile,
  onModule,
  onSwitchProfile,
}: {
  profile: Profile;
  onModule: (id: string) => void;
  onSwitchProfile: () => void;
}) {
  return (
    <Screen
      title={`Hi ${profile.name}! ${profile.avatar}`}
      onBack={onSwitchProfile}
    >
      <div className="card-grid">
        {MODULES.map((m) => (
          <button key={m.id} type="button" className="card" data-focusable onClick={() => onModule(m.id)}>
            <span className="card__icon">{m.icon}</span>
            <span className="card__title">{m.title}</span>
            <span className="card__desc">{m.description}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
}
