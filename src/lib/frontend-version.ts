const FALLBACK_FRONTEND_VERSION = "dev";

export const getFrontendVersion = (): string => {
  return (
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_APP_VERSION ??
    FALLBACK_FRONTEND_VERSION
  );
};
