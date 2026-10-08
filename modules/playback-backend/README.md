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
  milliseconds for the existing app callers.
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
