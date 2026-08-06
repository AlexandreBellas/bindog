import { PostHogProvider as BasePostHogProvider } from '@posthog/react'
import posthog from 'posthog-js'

if (typeof window !== 'undefined' && import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,
    defaults: '2025-11-30',
  })
}

interface IPostHogProviderProps extends React.PropsWithChildren {
  //
}

export default function PostHogProvider({ children }: Readonly<IPostHogProviderProps>) {
  return <BasePostHogProvider client={posthog}>{children}</BasePostHogProvider>
}
