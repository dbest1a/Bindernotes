const DESMOS_SCRIPT_ID = "binder-notes-desmos-api";
const DESMOS_SCRIPT_TIMEOUT_MS = 15_000;

let desmosPromise: Promise<DesmosApi> | null = null;

export function getDesmosGraphingConstructor(api: DesmosApi) {
  if (typeof api.GraphingCalculator === "function") {
    return api.GraphingCalculator;
  }

  if (typeof api.Calculator === "function") {
    return api.Calculator;
  }

  return null;
}

export function getDesmosApiKey() {
  const runtimeKey =
    typeof window !== "undefined"
      ? (
          window as Window & {
            __BINDER_NOTES_DESMOS_API_KEY__?: string;
          }
        ).__BINDER_NOTES_DESMOS_API_KEY__
      : "";

  return (
    runtimeKey?.trim() ||
    import.meta.env?.VITE_DESMOS_API_KEY?.trim() ||
    import.meta.env?.NEXT_PUBLIC_DESMOS_API_KEY?.trim() ||
    ""
  );
}

export function hasDesmosApiKey() {
  return getDesmosApiKey().length > 0;
}

export function isDeployedClient() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.hostname.endsWith(".vercel.app") ||
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  );
}

export async function loadDesmosApi() {
  if (typeof window === "undefined") {
    throw new Error("Desmos requires a browser environment.");
  }

  const apiKey = getDesmosApiKey();
  if (!apiKey) {
    throw new Error("missing-key");
  }

  if (desmosPromise) {
    return desmosPromise;
  }

  if (isDesmosApiReady(window.Desmos)) {
    return window.Desmos;
  }

  desmosPromise = new Promise<DesmosApi>((resolve, reject) => {
    const existing = document.getElementById(DESMOS_SCRIPT_ID) as HTMLScriptElement | null;
    let timeoutId: number | null = null;

    const cleanup = (script: HTMLScriptElement) => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };

    const fail = (script: HTMLScriptElement, error: Error, removeScript = false) => {
      cleanup(script);
      script.dataset.status = "error";
      if (removeScript) {
        script.remove();
      }
      reject(error);
    };

    const handleLoad = (event: Event) => {
      const script = event.currentTarget as HTMLScriptElement;
      cleanup(script);
      script.dataset.status = "loaded";
      if (isDesmosApiReady(window.Desmos)) {
        resolve(window.Desmos);
        return;
      }
      fail(script, new Error("Desmos loaded without a global API."), true);
    };

    const handleError = (event: Event) => {
      const script = event.currentTarget as HTMLScriptElement;
      fail(script, new Error("Failed to load Desmos."), true);
    };

    if (existing) {
      if (isDesmosApiReady(window.Desmos)) {
        resolve(window.Desmos);
        return;
      }

      if (existing.dataset.status === "error") {
        existing.remove();
        reject(new Error("Failed to load Desmos."));
        return;
      }

      if (existing.dataset.status === "loaded") {
        existing.remove();
        reject(new Error("Desmos loaded without a global API."));
        return;
      }

      existing.addEventListener("load", handleLoad);
      existing.addEventListener("error", handleError);
      timeoutId = window.setTimeout(() => {
        fail(existing, new Error("Timed out while loading Desmos."));
      }, DESMOS_SCRIPT_TIMEOUT_MS);
      return;
    }

    const script = document.createElement("script");
    script.id = DESMOS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.dataset.status = "loading";
    script.src = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    timeoutId = window.setTimeout(() => {
      fail(script, new Error("Timed out while loading Desmos."), true);
    }, DESMOS_SCRIPT_TIMEOUT_MS);
    document.head.appendChild(script);
  });

  desmosPromise = desmosPromise.catch((error) => {
    desmosPromise = null;
    throw error;
  });

  return desmosPromise;
}

function isDesmosApiReady(api: DesmosApi | undefined): api is DesmosApi {
  if (!api) {
    return false;
  }

  return (
    Boolean(getDesmosGraphingConstructor(api)) ||
    typeof api.ScientificCalculator === "function"
  );
}

export function isDesmosFeatureEnabled(
  api: DesmosApi,
  feature: DesmosFeatureName,
) {
  const hasConstructor =
    feature === "ScientificCalculator"
      ? typeof api.ScientificCalculator === "function"
      : feature === "GraphingCalculator"
        ? Boolean(getDesmosGraphingConstructor(api))
        : feature === "Calculator3D"
          ? typeof api.Calculator3D === "function"
        : false;

  const features = api.enabledFeatures;
  if (!features) {
    return hasConstructor;
  }

  if (
    feature === "GraphingCalculator" ||
    feature === "ScientificCalculator" ||
    feature === "Calculator3D"
  ) {
    return Boolean(features[feature]) && hasConstructor;
  }

  return Boolean(features[feature]);
}
