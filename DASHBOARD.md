# Dashboard modules

- `js/i18n.js` is the shared locale service. Dictionaries are registered by `dictionary.js` and `ui-dictionary.js`. Use `I18n.t(key, parameters)` for new UI. The DOM adapter translates legacy text and accessible attributes, including open dialogs. Mark user content with `data-user-content`; never use translated labels as data IDs.
- `css/tokens.css` defines shared dark/light surfaces, text, borders, orange accent, typography and radius. Dashboard-specific layout lives in `checklist-wheel.css`.
- `checklist-model.js` owns shared task operations. Checklist, Calendar and Eisenhower use the same planner IDs and completion dates; `matrixStatus` changes presentation only. `checklist.js` owns task editing and period views.
- `wheel.js` owns one Wheel of Life in `visualmind-radar.wheel`. Goal IDs link task records through `wheelGoalId`. The chart and modal use the shared task state. `dashboard-ui.js` provides form/dialog helpers.

## Scoring

All stored weights are percentages. An axis score on the 0–10 scale is:

`10 × sum(goalWeight / 100 × sum(taskWeight / 100 × min(doneCount / doneCap, 1)))`.

The target is 10 only when goal weights total 100% (tolerance 0.000001); otherwise it is 0. Each task's point contribution per completion is displayed in its goal detail. Goal/task forms reject totals above 100%. SMART fields are optional; name, weight and completion cap are required.

Detached Calendar occurrences count toward their original task's cap and weight. The excluded original date is not counted again. No additional progress bars or monthly wheel controls are rendered.

## Periods and migration

Weeks run Monday–Sunday. Previous means the immediately preceding day, calendar week, calendar month or calendar year; custom periods use the preceding range of the same number of days. Incomplete recurring occurrences are shown with their occurrence dates. Unscheduled tasks stay visible in every period.

Legacy Eisenhower records migrate once per ID into planner storage; the original records are backed up under `visualmind-tasks-backup-v1`. Old monthly radar data is retained, and the latest saved monthly goals seed the single wheel. Legacy Week Plan goals migrate into the wheel; their original records are retained under `legacyPlannerGoals`. Migrated goals start at 0% weight because the old model had no equivalent weight. Users must allocate their weights before the target line reaches 10.

The existing dashboard cloud document includes the wheel inside `radar`, so no backend schema change is required. Local changes use existing dashboard save/restore events. Cloud behavior is covered by mock account-isolation and persistence tests; a live authenticated Supabase session is not part of automated validation.

## Validation

Run `node --test tests/*.test.cjs` for model/persistence tests. Start `node tests/browser-server.cjs`, then use `node tests/run-browser.cjs http://127.0.0.1:8765/tests/checklist-wheel-browser.html` and `tests/i18n-browser.html` for browser checks. Existing Calendar and Mindmap regression pages use the same runner. Browser profiles are isolated in the system temporary directory.
