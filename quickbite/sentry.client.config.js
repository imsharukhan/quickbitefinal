import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://26cc31110107a2520f435f17cef475ef@o4511285444870144.ingest.us.sentry.io/4511285502803968",
  tracesSampleRate: 0.1,
});