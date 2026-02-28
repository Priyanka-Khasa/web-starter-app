import { useState, useCallback, useRef } from "react";
import { ModelManager, ModelCategory, EventBus } from "@runanywhere/web";

export type LoaderState = "idle" | "downloading" | "loading" | "ready" | "error";

interface ModelLoaderOptions {
  coexist?: boolean;
  preferredModelId?: string; // ✅ force 350m etc
  pick?: "preferred" | "smallest"; // fallback strategy
}

interface ModelLoaderResult {
  state: LoaderState;
  progress: number;
  error: string | null;
  ensure: () => Promise<boolean>;
  modelId: string | null;
}

function pickModelId(category: ModelCategory, opts: ModelLoaderOptions): string | null {
  const models = ModelManager.getModels().filter((m) => m.modality === category);
  if (!models.length) return null;

  // ✅ Preferred first
  if (opts.preferredModelId) {
    const found = models.find((m) => m.id === opts.preferredModelId);
    if (found) return found.id;
  }

  // ✅ Smallest memory requirement = usually fastest
  if (opts.pick === "smallest") {
    const sorted = [...models].sort((a, b) => (a.memoryRequirement ?? 0) - (b.memoryRequirement ?? 0));
    return sorted[0].id;
  }

  // Default
  return models[0].id;
}

/**
 * Download + load model for a category.
 * Fixes: stable selection, no race, no listener leaks.
 */
export function useModelLoader(category: ModelCategory, options: ModelLoaderOptions = {}): ModelLoaderResult {
  const coexist = options.coexist ?? false;

  const loaded = ModelManager.getLoadedModel(category);
  const initialReady = Boolean(loaded);

  const [state, setState] = useState<LoaderState>(initialReady ? "ready" : "idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(loaded?.id ?? null);

  const inflightRef = useRef<Promise<boolean> | null>(null);

  const ensure = useCallback(async (): Promise<boolean> => {
    // Already loaded for this category
    const already = ModelManager.getLoadedModel(category);
    if (already) {
      setModelId(already.id);
      setState("ready");
      return true;
    }

    // If already loading/downloading, return same promise
    if (inflightRef.current) return inflightRef.current;

    inflightRef.current = (async () => {
      try {
        setError(null);

        const id = pickModelId(category, options);
        if (!id) {
          setError(`No ${String(category)} model registered`);
          setState("error");
          return false;
        }

        setModelId(id);

        const model = ModelManager.getModels().find((m) => m.id === id);
        if (!model) {
          setError(`Model not found: ${id}`);
          setState("error");
          return false;
        }

        // Download if needed
        let unsub: (() => void) | null = null;

        if (model.status !== "downloaded" && model.status !== "loaded") {
          setState("downloading");
          setProgress(0);

          unsub = EventBus.shared.on("model.downloadProgress", (evt) => {
            if (evt.modelId === id) setProgress(evt.progress ?? 0);
          });

          try {
            await ModelManager.downloadModel(id);
            setProgress(1);
          } finally {
            // ✅ always unsubscribe
            if (unsub) unsub();
          }
        }

        // Load
        setState("loading");
        const ok = await ModelManager.loadModel(id, { coexist });

        if (!ok) {
          setError("Failed to load model");
          setState("error");
          return false;
        }

        setState("ready");
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
        return false;
      } finally {
        inflightRef.current = null;
      }
    })();

    return inflightRef.current;
  }, [category, coexist, options]);

  return { state, progress, error, ensure, modelId };
}