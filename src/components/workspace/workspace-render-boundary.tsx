import { Component, type ErrorInfo, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";

type WorkspaceRenderBoundaryProps = {
  children: ReactNode;
  resetKey?: string;
  title?: string;
};

type WorkspaceRenderBoundaryState = {
  error: Error | null;
};

export class WorkspaceRenderBoundary extends Component<
  WorkspaceRenderBoundaryProps,
  WorkspaceRenderBoundaryState
> {
  state: WorkspaceRenderBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): WorkspaceRenderBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Workspace render failed", error, info);
  }

  componentDidUpdate(prevProps: WorkspaceRenderBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[420px] items-center justify-center p-6">
          <EmptyState
            description={
              this.state.error.message ||
              "A study module failed to render. Try reopening the document or switching workspace mode."
            }
            title={this.props.title ?? "This workspace surface could not render"}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
