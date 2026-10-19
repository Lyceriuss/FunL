import { useEffect, useState } from 'react';
import { getLogger, logs } from './core/log/logger';
import { getModule } from './core/modules/registry';
import type { GameResult, Settings } from './core/modules/types';
import { TelemetrySession } from './core/telemetry/TelemetrySession';
import { idbSink, listProfiles } from './core/telemetry/storage';
import type { Profile } from './core/telemetry/types';
import { DataScreen } from './screens/DataScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ModuleScreen } from './screens/ModuleScreen';
import { ProfilesScreen } from './screens/ProfilesScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { ErrorBoundary } from './core/ui/ErrorBoundary';

type Route =
  | { name: 'loading' }
  | { name: 'profiles' }
  | { name: 'data'; from: Route }
  | { name: 'home' }
  | { name: 'module'; moduleId: string }
  | { name: 'game'; moduleId: string; options: unknown; settings: Settings; session: TelemetrySession }
  | { name: 'results'; moduleId: string; options: unknown; settings: Settings; result: GameResult };

const LAST_PROFILE_KEY = 'funl.lastProfile';
const log = getLogger('app');

export default function App() {
  const [resetKey, setResetKey] = useState(0);
  return (
    <ErrorBoundary key={resetKey} onReset={() => setResetKey((k) => k + 1)}>
      <Shell />
    </ErrorBoundary>
  );
}

/** Top-level navigation: a small state machine over `Route`. */
function Shell() {
  const [route, setRoute] = useState<Route>({ name: 'loading' });
  const [profile, setProfile] = useState<Profile | null>(null);

  // Every log entry carries the current screen / session for context.
  useEffect(() => {
    const sessionId = route.name === 'game' ? route.session.id : undefined;
    const moduleId = 'moduleId' in route ? route.moduleId : undefined;
    logs.setContext({ route: route.name, moduleId, sessionId });
    log.debug('navigate', { to: route.name, moduleId });
  }, [route]);

  useEffect(() => {
    logs.setContext({ profileId: profile?.id });
  }, [profile]);

  useEffect(() => {
    listProfiles()
      .catch((err: unknown) => {
        log.error('could not load profiles', err);
        return [] as Profile[];
      })
      .then((all) => {
        const last = all.find((p) => p.id === readLast());
        if (last) {
          setProfile(last);
          setRoute({ name: 'home' });
        } else {
          setRoute({ name: 'profiles' });
        }
      });
  }, []);

  const pickProfile = (p: Profile) => {
    setProfile(p);
    try {
      localStorage.setItem(LAST_PROFILE_KEY, p.id);
    } catch {
      /* storage unavailable: just don't remember */
    }
    setRoute({ name: 'home' });
  };

  const startGame = (moduleId: string, options: unknown, settings: Settings) => {
    if (!profile) return;
    log.info('start game', { moduleId, settings });
    const session = new TelemetrySession({
      profileId: profile.id,
      moduleId,
      config: { options, settings },
      sink: idbSink,
    });
    setRoute({ name: 'game', moduleId, options, settings, session });
  };

  switch (route.name) {
    case 'loading':
      return null;
    case 'profiles':
      return <ProfilesScreen onPick={pickProfile} onData={() => setRoute({ name: 'data', from: route })} />;
    case 'data':
      return <DataScreen onBack={() => setRoute(route.from)} />;
    case 'home':
      return profile ? (
        <HomeScreen
          profile={profile}
          onModule={(moduleId) => setRoute({ name: 'module', moduleId })}
          onSwitchProfile={() => setRoute({ name: 'profiles' })}
        />
      ) : null;
    case 'module': {
      const mod = getModule(route.moduleId);
      if (!mod) return null;
      return (
        <ModuleScreen
          module={mod}
          profileId={profile?.id ?? ''}
          onStart={(options, settings) => startGame(mod.id, options, settings)}
          onBack={() => setRoute({ name: 'home' })}
        />
      );
    }
    case 'game': {
      const mod = getModule(route.moduleId);
      if (!mod || !profile) return null;
      const { session, options, settings, moduleId } = route;
      return (
        <mod.Component
          key={session.id}
          profile={profile}
          telemetry={session}
          options={options}
          settings={settings}
          onFinish={(result: GameResult) => {
            log.info('game finished', { moduleId, reason: result.reason, summary: result.summary });
            void session.end(result.summary, result.reason);
            setRoute({ name: 'results', moduleId, options, settings, result });
          }}
        />
      );
    }
    case 'results':
      return (
        <ResultsScreen
          result={route.result}
          onAgain={() => startGame(route.moduleId, route.options, route.settings)}
          onDone={() => setRoute({ name: 'module', moduleId: route.moduleId })}
        />
      );
  }
}

function readLast(): string | null {
  try {
    return localStorage.getItem(LAST_PROFILE_KEY);
  } catch {
    return null;
  }
}
