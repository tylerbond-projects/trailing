// Pages Functions forward API, photo and realtime requests to the "trailing"
// Worker over a service binding (no public Worker URL needed). Only these
// paths invoke functions; everything else is served as static assets.
export const proxy = ({ request, env }) => env.API.fetch(request);
