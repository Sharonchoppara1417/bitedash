export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Forward OData requests to the public OData V3 service.
        // This replaces the development-only fiori-tools-proxy on Cloudflare.
        if (url.pathname === "/V3" || url.pathname.startsWith("/V3/")) {
            const upstreamUrl = new URL(
                url.pathname + url.search,
                "https://services.odata.org"
            );

            try {
                const upstreamRequest = new Request(upstreamUrl.toString(), request);
                const upstreamResponse = await fetch(upstreamRequest);

                const responseHeaders = new Headers(upstreamResponse.headers);
                responseHeaders.set("Cache-Control", "no-store");

                return new Response(upstreamResponse.body, {
                    status: upstreamResponse.status,
                    statusText: upstreamResponse.statusText,
                    headers: responseHeaders
                });
            } catch (error) {
                return new Response(
                    JSON.stringify({
                        error: "BiteDash could not reach the OData service.",
                        message: String(error)
                    }),
                    {
                        status: 502,
                        headers: {
                            "Content-Type": "application/json; charset=utf-8",
                            "Cache-Control": "no-store"
                        }
                    }
                );
            }
        }

        // Serve the built SAPUI5 application for all other requests.
        return env.ASSETS.fetch(request);
    }
};
