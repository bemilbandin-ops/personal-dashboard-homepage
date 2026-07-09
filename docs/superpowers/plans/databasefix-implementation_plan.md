# Fix Multi-Device Sync Conflicts

Your sync system has a classic **last-write-wins race condition**. Here's what's happening and how to fix it.

## Root Cause Analysis

The current flow on every page load / sign-in is:

```
1. pull()  → fetches cloud data, overwrites localStorage
2. pushLocal() → uploads ALL local keys to cloud, overwriting whatever is there
```

The problem: **`pushLocal()` blindly uploads everything** — including keys that were *just* freshly pulled from the cloud. And critically, there's **no timestamp comparison** anywhere. So:

| Step | PC 1 | PC 2 |
|------|-------|-------|
| 1 | Adds a note (local + cloud `updated_at = 10:00`) | — |
| 2 | — | Opens page. `pull()` gets note from 10:00 ✅ |
| 3 | — | User doesn't touch notes, but opens page again later |
| 4 | — | `pull()` gets cloud (10:00), then `pushLocal()` re-uploads stale local copy with `updated_at = NOW` |
| 5 | PC 1 opens page → `pull()` gets PC 2's stale data ❌ | — |

The `updated_at` column exists in Supabase but is **never read or compared** — it's only set on write ([sync.js L248](file:///d:/Codexcode/homepage/src/sync.js#L248)).

Additionally, there's **no real-time sync** — changes only propagate when a page is opened/refreshed.

## Proposed Changes

### [MODIFY] [sync.js](file:///d:/Codexcode/homepage/src/sync.js)

Three changes in this file:

#### 1. Track cloud timestamps locally

After `pull()`, store each key's `updated_at` in a local map (e.g. `this.cloudTimestamps`). This tells us "when was the cloud version last written?"

#### 2. Add timestamp comparison to `saveNow()` and `pushLocal()`

Before uploading a key, compare:
- **Local last-modified time** (a new field we'll track per-key whenever `storage.set()` is called)
- **Cloud `updated_at`** (from the map above)

Only upload if `localModifiedAt > cloudUpdatedAt` — meaning the user actually changed something locally after the last pull.

```
if (localModifiedAt <= cloudUpdatedAt) → skip upload (cloud is newer or same)
if (localModifiedAt > cloudUpdatedAt)  → upload (local has real changes)
if (no cloud timestamp)                → upload (first sync for this key)
```

#### 3. Subscribe to Supabase Realtime for live sync

Add a Supabase Realtime subscription on the `user_settings` table filtered to the current user. When another device pushes a change, this device gets notified instantly and pulls just that key — no page refresh needed.

```js
this.client
  .channel('user-settings-sync')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'user_settings',
      filter: `user_id=eq.${this.user.id}` },
    (payload) => {
      // Apply the incoming change to localStorage
      // Re-render affected UI components
    })
  .subscribe();
```

> [!IMPORTANT]
> Supabase Realtime requires enabling replication on the `user_settings` table in your Supabase dashboard: **Database → Replication → Add table `user_settings`**. This is a one-time setup step.

---

### [MODIFY] [storage.js](file:///d:/Codexcode/homepage/src/storage.js)

Track a `modifiedAt` timestamp per key. Whenever `set()` is called (which means the user or app made a local change), record `Date.now()` in a separate localStorage entry (e.g. `aura:_meta:<key>`). This is what `sync.js` reads to decide "did this key change locally since the last pull?"

---

### [MODIFY] [user-settings.sql](file:///d:/Codexcode/homepage/supabase/user-settings.sql)

Enable Supabase Realtime replication on the table (if not already):

```sql
alter publication supabase_realtime add table public.user_settings;
```

---

### [MODIFY] [notes.js](file:///d:/Codexcode/homepage/src/notes.js) & [productivity.js](file:///d:/Codexcode/homepage/src/productivity.js)

Add a listener so that when Realtime delivers a change for `scratchpad`, `tasks`, `focus-history`, etc., the UI re-renders automatically instead of showing stale data until the next page load.

## Summary of What This Fixes

| Problem | Fix |
|---------|-----|
| `pushLocal()` overwrites cloud with stale data | Timestamp comparison — only push if locally modified after last pull |
| No way to know if local data is "dirty" | Per-key `modifiedAt` tracking in `storage.js` |
| Changes only sync on page load | Supabase Realtime subscription for instant cross-device sync |
| UI doesn't update when remote changes arrive | Realtime listener triggers re-render of notes/tasks/timer |

## Open Questions

> [!IMPORTANT]
> **Conflict resolution strategy**: If you edit the same note on both PCs while offline and both come online — what should happen?  
> Options:
> 1. **Last-write-wins** (simpler, current behavior but with proper timestamps so at least the *actually newer* edit wins)
> 2. **Prompt the user** to pick which version to keep when a conflict is detected
> 
> I'd recommend option 1 for now since your data is simple key-value JSON, but want your input.

> [!NOTE]
> **Realtime is optional but highly recommended**. Even without it, just fixing the timestamp comparison in `pushLocal()` will solve the core data-overwriting bug. Realtime just makes it feel instant across devices.

## Verification Plan

### Manual Verification
1. Open the dashboard on two browser windows (simulating two PCs)
2. Add a note on window 1 → confirm it appears on window 2 without refresh (with Realtime) or after refresh (without)
3. Add a task on window 2 → confirm it appears on window 1
4. Close window 2, make changes on window 1, reopen window 2 → confirm window 2 gets the latest data and does NOT overwrite window 1's changes
