export function findRouteTarget(url, routes) {
  return routes.find((route) => (
    url === route.prefix
    || url.startsWith(`${route.prefix}/`)
    || url.startsWith(`${route.prefix}?`)
  )) || null;
}
