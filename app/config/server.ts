import md5 from "spark-md5";
import { DEFAULT_MODELS } from "../constant";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PROXY_URL?: string; // docker only

      OPENAI_API_KEY?: string;
      CODE?: string;
      ACCESS_CODE?: string; // alias of CODE, e.g. for Netlify where CODE is reserved by the build

      BASE_URL?: string;
      OPENAI_ORG_ID?: string; // openai only

      VERCEL?: string;
      BUILD_MODE?: "standalone" | "export";
      BUILD_APP?: string; // is building desktop app

      HIDE_USER_API_KEY?: string; // disable user's api key input
      DISABLE_GPT4?: string; // allow user to use gpt-4 or not
      ENABLE_BALANCE_QUERY?: string; // allow user to query balance or not
      DISABLE_FAST_LINK?: string; // disallow parse settings from url or not
      CUSTOM_MODELS?: string; // to control custom models

      // azure only
      AZURE_URL?: string; // https://{azure-url}/openai/deployments/{deploy-name}
      AZURE_API_KEY?: string;
      AZURE_API_VERSION?: string;

      // google only
      GOOGLE_API_KEY?: string;
      GOOGLE_URL?: string;

      // google tag manager
      GTM_ID?: string;
    }
  }
}

// Netlify's build script uses a shell variable named CODE for its exit code,
// so a user-defined CODE breaks the build there. ACCESS_CODE takes precedence.
const ACCESS_CODE_ENV = process.env.ACCESS_CODE || process.env.CODE;

const ACCESS_CODES = (function getAccessCodes(): Set<string> {
  const code = ACCESS_CODE_ENV;

  try {
    const codes = (code?.split(",") ?? [])
      .filter((v) => !!v)
      .map((v) => md5.hash(v.trim()));
    return new Set(codes);
  } catch (e) {
    return new Set();
  }
})();

// Clean up URLs pasted from chats/docs: strip invisible characters and
// whitespace, and unwrap markdown links like "[https://a.com](https://a.com)".
function sanitizeUrl(url?: string) {
  if (!url) return url;
  let cleaned = url.replace(/[\u200B-\u200D\u2060\uFEFF\s]/g, "");
  const markdownLink = cleaned.match(/\[([^\]]*)\]\(([^)]*)\)?/);
  if (markdownLink) {
    cleaned = markdownLink[1] || markdownLink[2];
  }
  return cleaned || undefined;
}

export const getServerSideConfig = () => {
  if (typeof process === "undefined") {
    throw Error(
      "[Server Config] you are importing a nodejs-only module outside of nodejs",
    );
  }

  const disableGPT4 = !!process.env.DISABLE_GPT4;
  let customModels = process.env.CUSTOM_MODELS ?? "";

  if (disableGPT4) {
    if (customModels) customModels += ",";
    customModels += DEFAULT_MODELS.filter((m) => m.name.startsWith("gpt-4"))
      .map((m) => "-" + m.name)
      .join(",");
  }

  const isAzure = !!process.env.AZURE_URL;
  const isGoogle = !!process.env.GOOGLE_API_KEY;

  const apiKeyEnvVar = process.env.OPENAI_API_KEY ?? "";
  const apiKeys = apiKeyEnvVar.split(",").map((v) => v.trim());
  const randomIndex = Math.floor(Math.random() * apiKeys.length);
  const apiKey = apiKeys[randomIndex];
  console.log(
    `[Server Config] using ${randomIndex + 1} of ${apiKeys.length} api key`,
  );

  return {
    baseUrl: sanitizeUrl(process.env.BASE_URL),
    apiKey,
    openaiOrgId: process.env.OPENAI_ORG_ID,

    isAzure,
    azureUrl: sanitizeUrl(process.env.AZURE_URL),
    azureApiKey: process.env.AZURE_API_KEY,
    azureApiVersion: process.env.AZURE_API_VERSION,

    isGoogle,
    googleApiKey: process.env.GOOGLE_API_KEY,
    googleUrl: sanitizeUrl(process.env.GOOGLE_URL),

    gtmId: process.env.GTM_ID,

    needCode: ACCESS_CODES.size > 0,
    code: ACCESS_CODE_ENV,
    codes: ACCESS_CODES,

    proxyUrl: process.env.PROXY_URL,
    isVercel: !!process.env.VERCEL,

    hideUserApiKey: !!process.env.HIDE_USER_API_KEY,
    disableGPT4,
    hideBalanceQuery: !process.env.ENABLE_BALANCE_QUERY,
    disableFastLink: !!process.env.DISABLE_FAST_LINK,
    customModels,
  };
};
