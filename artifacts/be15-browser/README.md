# Chemistry persistence browser acceptance

Verified on 2026-09-17 using Computer Use in a separate in-app browser tab, a disposable local learner-B account, Vite on localhost:5175, and the actual local GoTrue/PostgREST/PostgreSQL stack. No hosted data was changed.

## Run persistence

Opened Chemistry 101 + AP Chemistry → Titration Basics and Reaction Evidence → Acid-Base Titration Lab. Added 5.00 mL and entered distinct hypothesis and observation text. **Save chemistry work** displayed **Saved to your account**. After a hard reload, **Reopen saved chemistry work** and the explicit **Reopen snapshot** choice restored the 5.00 mL checkpoint, pH 1.18, measurement row, hypothesis, and observation.

## Layout regression found and fixed

The initial run also exposed a real workspace layout save error. Chemistry was rendered from bundled content but was omitted from the trusted system seed payload. Learner-side code attempted to materialize its published catalog, which creator authorization correctly refused. Commit `fe0a48c` includes Chemistry in the trusted seed transaction, removes learner catalog materialization, and rechecks a previously cached missing mirror.

The database agent applied that complete trusted payload to the disposable local database. A real learner JWT then read the operator-owned published Chemistry binder and all 77 lessons and saved/reopened its own workspace preference. The reproducible API check is `scripts/database/check-local-chemistry-catalog.mjs`.

The final browser recheck selected **Acid-Base Titration Lab**, hard reloaded, and retained the preset with **Ready** status and no layout error. The original saved run was reopened again and all checkpoint and notebook values were verified in the rendered controls. Twenty-seven focused seed, note, preference, and fail-closed tests passed; the changed files passed ESLint and Prettier. A full application typecheck at that moment was interrupted by a separate in-progress navigation-hook extraction, so this evidence does not claim that full check passed.

## Screenshots

- `titration-saved.png`: initial account save; also shows the layout failure discovered during acceptance.
- `titration-reopened.png`: initial run reopened after hard reload; layout failure still visible before the fix.
- `titration-layout-reloaded.png`: fixed study preset retained after reload.
- `titration-final-reopened.png`: original saved run reopened after the catalog fix.
- `titration-final-notebook.png`: restored hypothesis in its rendered text field.

The separate Smart lab notebook panel is a different tool with its own save state; its empty/unsaved state does not describe the saved titration notebook.
