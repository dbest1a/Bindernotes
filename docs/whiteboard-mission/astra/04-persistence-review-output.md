**I would hold deployment for findings 1–4.** Reviewed `fda96a7..5f2a1a1`. All findings below are verified by code inspection, not runtime reproduction. I made no changes and ran no tests.

1. **High — A freshly loaded board can be overwritten with its previously cached graph.**  
   Location: [use-math-workspace.ts:141](C:/Users/User/Documents/ChatGPT/Bindernotes/src/hooks/use-math-workspace.ts:141), [whiteboard-module.tsx:1254](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module.tsx:1254).

   **Scenario:** This tab previously saved board A with graph G0. Another device saves G1. Selecting A first mounts its cached G0; the subsequent remote load supplies G1 and the latest board revision. However, `useMathWorkspace` reloads only when `scopeId` or `userId` changes, so the mounted graph still shows G0. Editing it then saves G0 plus that edit over G1. Supabase’s revision check accepts this because the board now carries the freshly loaded revision.

   **Smallest fix:** Reconcile incoming `graphWorkspace` when the board revision changes. Adopt newer remote state when locally clean; preserve divergent unsynced edits as a conflict. Cancel stale pending graph syncs during reconciliation.

2. **High — “Undo card” silently rolls back saved graph content.**  
   Location: [whiteboard-module.tsx:1140](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module.tsx:1140), [whiteboard-pinned-object-layer.tsx:615](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-pinned-object-layer.tsx:615).

   **Scenario:** Move a graph card while it contains G0, creating a history snapshot. Edit the graph to G1 and let it save. Click “Undo card.” Graph sync deliberately skips history, but undo restores the **entire old modules array**, including G0, and immediately persists it. The mounted hook still contains G1 and does not rerun its sync effect merely because `moduleElement.graphWorkspace` changed. The screen therefore shows G1 while the account contains G0.

   **Smallest fix:** When applying card undo/redo, preserve the current `graphWorkspace` for surviving graph IDs, or exclude graph content from card history altogether.

3. **High — Graph edits do not participate in the board’s lifecycle flush.**  
   Location: [whiteboard-pinned-object-layer.tsx:617](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-pinned-object-layer.tsx:617), [desmos-embed.tsx:289](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/math/desmos-embed.tsx:289), [whiteboard-module.tsx:1249](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module.tsx:1249).

   **Scenario:** Edit a graph, wait 300 ms, then switch to an already cached board B before the additional 800 ms sync expires. The switch flushes A without the pending graph, then changes `boardRef` to B. The outgoing graph’s cleanup subsequently calls an updater against B; with distinct card IDs, it does nothing. A’s graph remains device-cache-only.

   Page exit is also unprotected: neither graph stage handles `pagehide`/hidden visibility. Closing within the existing 250 ms Desmos debounce can lose the edit entirely; closing during the new 800 ms stage leaves it outside the board save/recovery draft. React unmount cleanup cannot reliably substitute for these flushes, and the scoped cleanup runs before its descendant Desmos cleanup captures the final state.

   **Smallest fix:** Register synchronous, board-scoped graph flushers. Flush calculator → workspace → board before snapshotting, changing boards, unmounting, or handling page exit; persist the resulting recovery draft immediately.

4. **High — Device-clock timestamps allow an older graph to overwrite newer remote work merely by opening it.**  
   Location: [use-math-workspace.ts:99](C:/Users/User/Documents/ChatGPT/Bindernotes/src/hooks/use-math-workspace.ts:99), [use-math-workspace.ts:355](C:/Users/User/Documents/ChatGPT/Bindernotes/src/hooks/use-math-workspace.ts:355), [whiteboard-pinned-object-layer.tsx:614](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-pinned-object-layer.tsx:614).

   **Scenario:** Device A’s clock is five minutes fast. At actual 10:00 it caches G0 stamped 10:05. Device B subsequently saves G1 at 10:02. Opening the latest board on A selects G0 because its timestamp sorts later. After 800 ms, the sync writes G0 into the freshly loaded board without any user edit. The board revision guard cannot detect this stale payload.

   **Smallest fix:** Associate cached graph edits with their originating board revision. Automatically promote them only against that same revision; retain conflicting cache data separately instead of resolving conflicts through client wall-clock timestamps.

5. **Medium — Pending graph sync reverses collapse and pin changes.**  
   Location: [whiteboard-pinned-object-layer.tsx:615](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-pinned-object-layer.tsx:615).

   **Scenario:** Edit a graph, wait for the 250 ms calculator callback, then collapse it before board sync. Collapse saves `mode: "collapsed"` and unmounts the graph wrapper. Its cleanup spreads `latestModuleRef`, which still contains the outgoing live card, and replaces the whole module. The card immediately reopens. Moving between board and viewport layers similarly risks restoring the old anchor and coordinates.

   **Smallest fix:** Send a graph-only patch identified by board ID and card ID, merging it into the current module. Do not replace the complete card from an unmounting child.

No additional serious regression found by inspection in scene signatures, idle-draft cancellation, camera-store/card transforms, placement, or minimal-mode/phone changes. Visual behavior and performance remain unverified.

Board save serialization, revision checks, and recovery-token protection look sound **once an edit reaches the board**; they do not cover the graph gaps above.