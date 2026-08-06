import Footer from "#/components/base/Footer"
import Header from "#/components/base/Header"
import StoreDevtools from "#/lib/demo-store-devtools"
import { getLocale } from "#/paraglide/runtime"
import appCss from "#/styles.css?url"
import PostHogProvider from "#/utils/integrations/posthog/provider"
import TanStackQueryDevtools from "#/utils/integrations/tanstack-query/devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import type { QueryClient } from "@tanstack/react-query"
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"

interface IRouterContext {
    queryClient: QueryClient
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRouteWithContext<IRouterContext>()({
    beforeLoad: async () => {
        // Other redirect strategies are possible; see
        // https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide#offline-redirect
        if (typeof document !== "undefined") {
            document.documentElement.setAttribute("lang", getLocale())
        }
    },

    head: () => ({
        meta: [
            {
                charSet: "utf-8"
            },
            {
                name: "viewport",
                content: "width=device-width, initial-scale=1"
            },
            {
                title: "TanStack Start Starter"
            }
        ],
        links: [
            {
                rel: "stylesheet",
                href: appCss
            }
        ]
    }),
    shellComponent: RootDocument
})

type IRootDocumentProps = React.PropsWithChildren

function RootDocument({ children }: Readonly<IRootDocumentProps>) {
    return (
        <html lang={getLocale()} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
                <HeadContent />
            </head>
            <body className="font-sans antialiased wrap-anywhere selection:bg-[rgba(79,184,178,0.24)]">
                <PostHogProvider>
                    <Header />
                    {children}
                    <Footer />
                    <TanStackDevtools
                        config={{ position: "bottom-right" }}
                        plugins={[
                            { name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> },
                            TanStackQueryDevtools,
                            StoreDevtools
                        ]}
                    />
                </PostHogProvider>
                <Scripts />
            </body>
        </html>
    )
}
