import { type Href, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { hasCompletedOnboarding, useSession } from '@/features/auth';

export default function Index() {
  const { status } = useSession();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (status !== 'anonymous') return;
    let active = true;
    void hasCompletedOnboarding().then((value) => {
      if (active) setOnboardingComplete(value);
    }).catch(() => {
      if (active) setOnboardingComplete(false);
    });
    return () => { active = false; };
  }, [status]);

  if (status === 'booting' || (status === 'anonymous' && onboardingComplete === null)) return null;
  if (status === 'anonymous') return <Redirect href={(onboardingComplete ? '/(auth)/login' : '/(auth)/onboarding') as Href} />;
  return <Redirect href="/(tabs)" />;
}
