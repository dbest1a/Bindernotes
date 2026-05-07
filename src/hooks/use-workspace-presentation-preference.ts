import { useEffect, useState } from "react";
import {
  loadWorkspacePresentationPreference,
  loadWorkspaceViewPreference,
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

export function useWorkspaceViewPreference() {
  const [viewMode, setViewMode] = useState(loadWorkspaceViewPreference);

  useEffect(() => {
    return subscribeWorkspacePresentationPreference(() => {
      setViewMode(loadWorkspaceViewPreference());
    });
  }, []);

  return viewMode;
}
