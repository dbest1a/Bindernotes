import { useEffect, useState } from "react";
import {
  loadWorkspacePresentationPreference,
  subscribeWorkspacePresentationPreference,
} from "@/lib/workspace-presentation-storage";

export function useWorkspacePresentationPreference() {
  const [presentationMode, setPresentationMode] = useState(loadWorkspacePresentationPreference);

  useEffect(() => {
    return subscribeWorkspacePresentationPreference(() => {
      setPresentationMode(loadWorkspacePresentationPreference());
    });
  }, []);

  return presentationMode;
}
