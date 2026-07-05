# Branch Stabilization Design

## Goal

Make the `implementations` branch safe to merge by fixing every confirmed review finding without redesigning the application or adding dependencies.

## Approach

Use a security-first sequence of small, independently testable changes. Each fix starts with one focused regression test, changes the existing shared function where possible, and is committed separately so security, persistence, time calculations, weather behavior, and test maintenance can be reviewed or reverted independently.

## Design

### Launcher security

The repository must contain only an empty launcher-token template. The installer will continue generating the local secret, but it must write the browser-readable token to an ignored generated file rather than modifying a tracked source file. Installation and uninstallation documentation will name the generated file and explain token rotation. The already-exposed token must be considered compromised and regenerated locally; removing it from the branch tip does not erase it from existing commit history.

### Storage failures

`Aura.storage.set` remains the single write boundary and returns a boolean without opening dialogs. Callers that show success state must check that boolean before displaying “Saved” or mutating a success message. Background callers may continue rendering in-memory state, but they must not claim persistence. One storage test will cover successful writes, quota/security failures, and the absence of repeated blocking alerts.

### Focus history and calendar boundaries

When restoring an expired running timer, completion uses the persisted `endsAt`, capped at the current time, instead of the reopen time. Calendar statistics will use local calendar transitions produced by `Date#setDate` rather than adding or subtracting a fixed 24-hour duration. Tests will cover reopening after midnight and both daylight-saving transitions.

### Weather validation and request ordering

Coordinate input must satisfy latitude `-90..90` and longitude `-180..180` before it is stored. `setLocation` will distinguish a saved location from a successful live refresh so the UI cannot report a failed lookup as fully updated. A monotonically increasing request identifier will ensure only the newest weather response can update cache and rendered state; no new cancellation abstraction is needed.

### Existing test repair and missing coverage

The stale productivity source-text assertion will be replaced with a behavior-oriented navigation assertion. Focused Node tests will be added for storage, weather, and time calculations. Time-tools and notes receive only tests needed to cover the persistence failure contract; broader feature suites are outside this stabilization scope.

## Error Handling

User-triggered failures use existing inline status elements. Low-level storage and weather functions return structured success/failure results and never create blocking alert loops. Security-sensitive launcher validation remains fail-closed.

## Verification

Run the complete Node and Python suites, then repeat the browser smoke path at desktop and `390x844`: initial load, all four views, settings, scratchpad save state, weather-location failure and success, focus-timer restore, and time-tools dialog. Success requires zero failed tests, no relevant browser console errors, no exposed launcher token, and no horizontal mobile overflow.

## Out of Scope

- New dependencies or frameworks.
- UI redesigns.
- New launcher capabilities or broader executable allowlists.
- Rewriting unrelated branch history beyond handling the exposed token.
