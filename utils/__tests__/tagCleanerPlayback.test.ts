import TrackPlayer from 'react-native-track-player';
import { checkCleanerNativeQueue } from '../tagCleanerPlayback';
import { acquireNativeHydrationGate, publishNativeHydrationGate, resetNativeHydrationGateForTests } from '../nativeHydrationGate';
import { resetNativeQueueMutationLockForTests } from '../nativeQueueMutationLock';
const songs=[{id:'current',title:'Now',artist:'A',uri:'content://p/document/current'},{id:'next',title:'Next',artist:'A',uri:'content://p/document/next'}];
beforeEach(()=>{resetNativeHydrationGateForTests();resetNativeQueueMutationLockForTests();(TrackPlayer.getQueue as jest.Mock).mockReset();});
afterEach(()=>{jest.useRealTimers();resetNativeQueueMutationLockForTests();resetNativeHydrationGateForTests();});
const ready=()=>{const owner=acquireNativeHydrationGate();publishNativeHydrationGate(owner,'ready');return owner;};
test('queue query requires confirmed ready hydration; current React item is insufficient',async()=>{
 expect(await checkCleanerNativeQueue(songs[1],songs)).toMatch(/nicht bestätigt/);expect(TrackPlayer.getQueue).not.toHaveBeenCalled();
 ready();(TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{id:'current',url:songs[0].uri},{id:'next',url:'file:///converted-next'}]);
 expect(await checkCleanerNativeQueue(songs[1],songs)).toMatch(/automatische nächste/);expect(TrackPlayer.getQueue).toHaveBeenCalledTimes(1);
});
test('fresh empty queue permits; unreadable queue and changed hydration fail closed',async()=>{
 ready();(TrackPlayer.getQueue as jest.Mock).mockResolvedValue([]);expect(await checkCleanerNativeQueue(songs[1],songs)).toBeUndefined();
 (TrackPlayer.getQueue as jest.Mock).mockRejectedValue(new Error('Disconnected'));expect(await checkCleanerNativeQueue(songs[1],songs)).toMatch(/nicht bestätigt/);
 (TrackPlayer.getQueue as jest.Mock).mockImplementation(async()=>{acquireNativeHydrationGate();return [];});expect(await checkCleanerNativeQueue(songs[1],songs)).toMatch(/nicht bestätigt/);
});
test('timed-out read never grants a write and late read settlement remains irrelevant',async()=>{
 jest.useFakeTimers();ready();let resolve!:(queue:unknown[])=>void;
 (TrackPlayer.getQueue as jest.Mock).mockImplementation(()=>new Promise(done=>{resolve=done;}));
 const check=checkCleanerNativeQueue(songs[1],songs);await jest.advanceTimersByTimeAsync(5001);
 expect(await check).toMatch(/nicht bestätigt/);resolve([]);await Promise.resolve();
});

test('native cache URLs without resolvable source identity cannot authorize a file write',async()=>{
 ready();(TrackPlayer.getQueue as jest.Mock).mockResolvedValue([{id:'missing-library-track',url:'file:///unidentified-converted-track'}]);
 expect(await checkCleanerNativeQueue(songs[1],songs)).toMatch(/nicht aufgelöste Quellen/);
});
