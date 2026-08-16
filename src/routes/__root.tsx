import Footer from "#/components/base/Footer"
import Header from "#/components/base/Header"
import { TooltipProvider } from "#/components/ui/tooltip"
import NotFound from "#/pages/NotFound"
import { m } from "#/paraglide/messages"
import { getLocale } from "#/paraglide/runtime"
import appCss from "#/styles.css?url"
import PostHogProvider from "#/utils/integrations/posthog/provider"
import TanStackQueryDevtools from "#/utils/integrations/tanstack-query/devtools"
import { seo } from "#/utils/seo"
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
        if (typeof document !== "undefined") {
            document.documentElement.setAttribute("lang", getLocale())
        }
    },

    head: () => {
        const social = seo({
            title: m.app_name(),
            description: m.app_description()
        })

        return {
            meta: [
                { charSet: "utf-8" },
                {
                    name: "viewport",
                    content: "width=device-width, initial-scale=1"
                },
                ...social.meta
            ],
            links: [
                {
                    rel: "stylesheet",
                    href: appCss
                },
                {
                    rel: "icon",
                    href: "/favicon.svg",
                    type: "image/svg+xml"
                },
                {
                    rel: "apple-touch-icon",
                    href: "/favicon.svg"
                },
                ...social.links
            ]
        }
    },
    notFoundComponent: NotFound,
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
            <body className="flex h-dvh max-h-dvh flex-col overflow-hidden font-sans antialiased wrap-anywhere selection:bg-(--selection)">
                <PostHogProvider>
                    <TooltipProvider>
                        <Header />
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
                        <div className="hidden md:block">
                            <Footer />
                        </div>
                        <TanStackDevtools
                            config={{ position: "bottom-right" }}
                            plugins={[
                                { name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> },
                                TanStackQueryDevtools
                            ]}
                        />
                    </TooltipProvider>
                </PostHogProvider>
                <Scripts />
            </body>
        </html>
    )
}
