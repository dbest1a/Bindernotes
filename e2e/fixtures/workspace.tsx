import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FaceliftSimpleShell } from "@/components/workspace/facelift-simple-shell";
import { WhiteboardModule } from "@/components/whiteboard/whiteboard-module";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { createDefaultWorkspacePreferences } from "@/lib/workspace-preferences";
import { mathWhiteboardTemplates } from "@/lib/whiteboards/whiteboard-templates";
import { workspaceModuleRegistry } from "./modules";
import "@/styles.css";
import "@/workspace-fit.css";

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const noop = () => {};
const renderBoardModule = (id: string, context: any) => id === "private-notes"
  ? <RichTextEditor value={context.noteContent} onChange={context.onNoteContentChange} />
  : (workspaceModuleRegistry as any)[id]?.render(context) ?? null;
const params = new URLSearchParams(location.search);
const now = new Date(0).toISOString();
const binder = { id:"browser-binder", title:"Chemistry foundations", subject:"Chemistry", description:"", owner_id:"fixture", status:"published" };
const lesson = { id:"browser-lesson", binder_id:binder.id, title: "Matter and measurement: a long lesson title that must wrap without hiding editing controls", content:doc("Matter has mass and occupies space. A measurement combines a number with a unit."), math_blocks:[], created_at:now, updated_at:now, order_index:1 };
const defaults = createDefaultWorkspacePreferences("fixture", binder.id);
const baseContext: any = {
  ownerId:"fixture", binder, selectedLesson:lesson, lessons:[lesson], filteredLessons:[lesson],
  library:{binders:[binder],folders:[],folderBinders:[],lessons:[lesson],loading:false,error:null},
  history:{enabled:false}, comments:[],highlights:[], math:{savedGraphs:[]},
  noteMath:[], mathSuggestions:[], noteInsertRequest:null, currentNotebookSection:null,
  canRetryNoteSave:false, noteSaveDetail:"Fixture on this device", noteSaveError:null,
  onAcceptMathSuggestion:noop,onDismissMathSuggestion:noop,onEnterNotebookFocus:noop,onGraphMathSuggestion:noop,
  onInsertCallout:noop,onInsertChecklist:noop,onInsertDefinition:noop,onInsertFormulaReference:noop,onInsertGraphBlock:noop,
  onInsertGraphNote:noop,onInsertMathBlock:noop,onInsertProof:noop,onInsertTheorem:noop,onInsertWorkedExample:noop,
  onNoteInsertApplied:noop,onNoteMathChange:noop,onRetryNoteSave:noop,onSelectLesson:noop,onSelectBinder:noop,
};
function WorkspaceFixture() {
  const [preferences,setPreferences]=useState({...defaults,preset:params.get("preset")??"notes-focus",enabledModules:["lesson","private-notes","highlights"],facelift:{...defaults.facelift,density:params.get("density")??"comfortable",moduleChrome:params.get("chrome")??"full",surfaceMode:"simple"}} as any);
  const [title,setTitle]=useState(localStorage.getItem("fixture-note-title")??"My chemistry notes");
  const [content,setContent]=useState(JSON.parse(localStorage.getItem("fixture-note")??JSON.stringify(doc("An atom is a unit of an element."))));
  const [dirty,setDirty]=useState(false);
  // Isolated recovery UI only: these handlers never access an account/backend.
  const [conflict,setConflict]=useState(params.has("recovery"));
  const [recoveryBusy,setRecoveryBusy]=useState(false);
  const [recoveryMessage,setRecoveryMessage]=useState<string|null>(null);
  const [copyUrl,setCopyUrl]=useState<string|null>(null);
  const recover = async (keepBoth:boolean) => {
    setRecoveryBusy(true);
    await new Promise(resolve=>setTimeout(resolve,150));
    if(params.has("recovery-error")) setRecoveryMessage("Connection interrupted. Your draft is still here.");
    else {
      if(keepBoth) setCopyUrl("#isolated-saved-copy");
      setConflict(false);setDirty(false);setContent(doc("Latest account version — isolated fixture."));
      setRecoveryMessage(keepBoth?"Both versions are kept. You're viewing the latest account version.":"Latest account version loaded.");
    }
    setRecoveryBusy(false);
  };
  const context={...baseContext,noteContent:content,noteTitle:title,hasUnsavedNoteChanges:dirty,autosaveStatus:dirty?"unsaved":"saved",noteSaveLabel:dirty?"Unsaved":"Saved",onNoteTitleChange:(v:string)=>{setTitle(v);setDirty(true)},onNoteContentChange:(v:any)=>{setContent(v);setDirty(true)},onSaveNoteNow:()=>{localStorage.setItem("fixture-note",JSON.stringify(content));localStorage.setItem("fixture-note-title",title);setDirty(false)},onApplyPreset:(preset:string)=>setPreferences((p:any)=>({...p,preset}))};
  if(params.has("recovery")) Object.assign(context,{
    autosaveStatus:conflict?"error":"saved",noteSaveLabel:conflict?"Choose a version":"Saved",noteSaveDetail:conflict?"A newer saved version is available.":"Isolated recovery complete.",
    noteRecovery:{conflict,busy:recoveryBusy,message:recoveryMessage,copyUrl,onKeepBoth:()=>void recover(true),onUseLatest:()=>void recover(false),onDownload:()=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify({format:"bindernotes-note-draft",version:1,title,content,mathBlocks:[]})],{type:"application/json"}));
      const link=document.createElement("a");link.href=url;link.download="isolated-note-draft.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }}
  });
  if(params.has("board")) {
    if(params.has("notebook")) {
      const notebookContext={...context,binder:{...binder,id:"canvas-notebook",title:"Personal canvas"},selectedLesson:{...lesson,id:"canvas-page",binder_id:"canvas-notebook"},compactWhiteboardTools:true};
      return <WhiteboardModule context={notebookContext} initialTemplate={mathWhiteboardTemplates.find(template=>template.id==="equation-solving")} scopeOnly variant="lab" renderModule={renderBoardModule} />;
    }
    const key="bindernotes:whiteboards:fixture:browser-binder:browser-lesson";
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify([{id:"fixture-board",ownerId:"fixture",binderId:binder.id,lessonId:lesson.id,title:"Browser board",subject:"Math",moduleContext:"lesson",scene:{elements:[],appState:{viewBackgroundColor:"#ffffff"},files:{}},modules:[],objectCount:0,sceneSizeBytes:0,assetSizeBytes:0,storageMode:"local-draft",createdAt:now,updatedAt:now,archivedAt:null}]));
    return <WhiteboardModule context={context} variant="lab" renderModule={renderBoardModule} />;
  }
  return <><header style={{height:64,padding:16}}>BinderNotes · isolated component check</header><div className="app-route-transition-shell"><main className="workspace-page" data-workspace-presentation="facelift" data-facelift-surface="simple"><div className="workspace-sticky-layer"><section className="facelift-presentation-stage"><FaceliftSimpleShell context={context} preferences={preferences} onChange={setPreferences} onOpenSettings={noop} isCompact={innerWidth<=820} /></section></div></main></div></>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ThemeProvider><WorkspaceFixture/></ThemeProvider></MemoryRouter></QueryClientProvider>);
