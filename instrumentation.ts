import { captureException } from "@/lib/observability";

/**
 * Next.js calls `onRequestError` for every uncaught error thrown while
 * rendering a Server Component, running a Server Action, or handling a Route
 * Handler request.
 *
 * Without this, those failures only ever reached the platform's stdout: the
 * customer saw the error boundary, and unless somebody happened to be reading
 * the deploy logs at that moment, nobody found out. Now every one of them is
 * reported with the route and phase that produced it.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  captureException(error, {
    operation: `request.${context.routeType}`,
    tags: {
      method: request.method,
      routerKind: context.routerKind,
      routeType: context.routeType,
    },
    extra: {
      // The path can carry a query string with a search term, which is fine,
      // but never the request body.
      path: request.path,
      routePath: context.routePath,
    },
  });
}

export async function register() {
  // Reserved for future runtime setup. Declared because Next.js expects
  // instrumentation.ts to export it alongside onRequestError.
}
