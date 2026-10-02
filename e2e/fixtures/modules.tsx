import { PrivateNotesModule, SourceLessonModule } from "@/components/workspace/study-core-modules";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import { DesmosGraphModule } from "@/components/math/math-workspace-modules";
const noop = () => {};
export const workspaceModuleRegistry = {
  "desmos-graph": { title: "Desmos graph", render: (c: any) => <DesmosGraphModule bindings={c.mathModules} surface="whiteboard" /> },
  lesson: { title: "Source lesson", render: (c: any) => <SourceLessonModule binder={c.binder} lesson={c.selectedLesson} lessons={c.lessons} highlights={[]} highlightStatus={{state:"saved", detail:"",lastSavedAt:null,error:null}} defaultHighlightColor="yellow" onHighlight={noop} onJumpToMathSource={noop} onRemoveHighlight={noop} onSaveSelectionAsEvidence={noop} onQuoteToNotes={noop} onSendToNotes={noop} /> },
  "private-notes": { title: "Private notes", render: (c: any) => <PrivateNotesModule {...c} selectedLessonTitle={c.selectedLesson.title} onCreateSticky={noop} /> },
  highlights: { title: "Highlights", render: () => <WorkspacePanel title="Highlights"><p>Source highlights</p></WorkspacePanel> },
  annotations: { title: "Annotations", render: () => <WorkspacePanel title="Annotations"><p>Saved annotations</p></WorkspacePanel> },
};
