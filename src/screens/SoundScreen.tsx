import { Screen } from '../core/ui/Screen';
import { SoundPanel } from '../core/ui/SoundPanel';

/** Sound settings + library, reachable from the main menu. */
export function SoundScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen title="🔊 Sound" onBack={onBack}>
      <SoundPanel />
    </Screen>
  );
}
