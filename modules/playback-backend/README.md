# Playback backend

This local package preserves the app's existing playback interface while running
`@rntp/player` 5.12.1 on React Native's New Architecture. It implements the calls
used by this app rather than all of the upstream V4 API.

- Native controller startup must complete before a getter or mutation runs. V5's
  empty startup getter defaults are never treated as confirmed playback state.
- Mutations run in order and await the native command fence supplied by
  `scripts/patches/patchRntpV5.cjs`. Returning from a V5 `void` method does not
  acknowledge a command. There is no adapter timeout which releases a writer.
- A native failure is returned to its caller. A disconnected controller can be
  destroyed and configured again; an operation which is still running retains
  its place in the mutation chain.
- Song IDs, album names, artwork and repeat modes are translated at this boundary.
  Position/duration values remain seconds; the `useProgress` interval remains
  milliseconds for the existing app callers. Periodic reads run only during
  foreground playback in a visible progress view. Pause uses event/seek snapshots;
  background and hidden views suspend their UI observer. Return, track change and
  confirmed seek refresh immediately. Native heartbeats publish progress without
  another native read. The remote service and native playback retain ownership.
- Navigation reads fresh native queue identities and titles through a compact
  snapshot after acknowledged writes. It avoids per-track compatibility metadata
  conversion; it does not cache native queue order or claim an atomic native read.
- Remote transports use V5's `registerRemoteHandlers`. The app's returned
  promises keep the V5 headless task active while it waits for the operation.
  `setRemoteCommandGuard` delegates playback ownership to the domain: cold native
  controls use `performDefault` when there is no app hydration owner, while owned
  startup commands remain buffered by the app.
- The playback session initializes synchronously without importing UI modules.
  Startup uses exclusive audio focus, native progress heartbeats every two
  seconds, and the existing stop-on-task-removal policy.

Import the compatibility package for app playback operations. Mixing raw V5
mutations with this package would bypass its acknowledgement ordering. The
upstream V5 hooks are intentionally not re-exported because they use different
interval units and expose unconfirmed startup values.

The integration tests execute both this package and the actual V5 JavaScript;
only React Native's native playback module is mocked.

## Fixed setup / bounded compatibility contract

This is the app's adapter, not a general V4 implementation. `setupPlayer` always
uses music content, exclusive audio focus, noisy-route handling, a two-second
native progress heartbeat, stop-on-task-removal and automatic JS startup. The
legacy `autoHandleInterruptions` boolean is accepted for call compatibility; it
does not dynamically change that policy (including when false).

`updateOptions` translates `capabilities` and forward/backward jump intervals into
one acknowledged native `setCommands` operation. `compactCapabilities` and
`notificationCapabilities` are compatibility hints; Android/Media3 owns the
actual notification layout and there are no separate V4 command lists. The only
accepted task-removal setting is `StopPlaybackAndRemoveNotification`. A supplied
progress interval must be exactly two seconds. Other policies/intervals reject
before native command mutation; they require an explicitly designed setup/API
change, tests and a new APK. There is no silent V4 fallback.

Do not infer Android failures from a browser/DOM render of this native module.
Changes to focus, startup, remote ownership, acknowledgement fences or observer
units require boundary/integration and native tests, followed by an exact-APK
Android test. Dependency upgrades must follow
[`dependency-patch-maintenance.md`](../../docs/dependency-patch-maintenance.md).
