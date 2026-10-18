import { index, route, type RouteConfig } from "@react-router/dev/routes"

export default [
  index("routes/home/route.tsx"),
  route("app", "routes/app/layout.tsx", [
    index("routes/app/route.tsx"),
    route("item/:itemId", "routes/app/item/route.tsx"),
    route("compare", "routes/app/compare/route.tsx"),
  ]),
  route("preview", "routes/preview/route.tsx"),

  route("resource/analyze", "routes/api/analyze/route.ts"),
  route("privacy", "routes/privacy/route.tsx"),
  route("terms", "routes/terms/route.tsx"),
  route("cookies", "routes/cookies/route.tsx"),
  route("usage", "routes/usage/route.tsx"),
  route("licenses", "routes/licenses/route.tsx"),
  route("healthz", "routes/healthz.ts"),
  route("robots.txt", "routes/robots.txt.ts"),
  route(
    ".well-known/appspecific/com.chrome.devtools.json",
    "routes/well-known-devtools.ts"
  ),
  route("action/set-theme", "routes/action.set-theme.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig
