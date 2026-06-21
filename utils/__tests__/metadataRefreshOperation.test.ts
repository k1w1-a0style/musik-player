import {
  beginMetadataRefreshOperation,
  canResumeMetadataRefresh,
  completeMetadataRefreshOperation,
  getMetadataRefreshOperationState,
  markMetadataRefreshCancelling,
  resetMetadataRefreshOperationForTests,
  updateMetadataRefreshProgress,
} from '../metadataRefreshOperation';

beforeEach(() => {
  resetMetadataRefreshOperationForTests();
});

test('starts running with operationId, total and resumeIndex', () => {
  const id = beginMetadataRefreshOperation(50, 0);
  const state = getMetadataRefreshOperationState();
  expect(state.status).toBe('running');
  expect(state.total).toBe(50);
  expect(state.resumeIndex).toBe(0);
  expect(state.operationId).toBe(id);
  expect(state.processed).toBe(0);
});

test('updateMetadataRefreshProgress accumulates live counters', () => {
  beginMetadataRefreshOperation(20, 0);
  updateMetadataRefreshProgress({ processed: 7, updated: 5, skipped: 1, failed: 1, errorDetails: [{ uri: 'file:///x.mp3', reason: 'timeout' }] });
  const state = getMetadataRefreshOperationState();
  expect(state.processed).toBe(7);
  expect(state.updated).toBe(5);
  expect(state.failed).toBe(1);
  expect(state.errorDetails).toEqual([{ uri: 'file:///x.mp3', reason: 'timeout' }]);
});

test('markMetadataRefreshCancelling flips running -> cancelling but keeps counters', () => {
  beginMetadataRefreshOperation(20, 0);
  updateMetadataRefreshProgress({ processed: 5, updated: 3 });
  markMetadataRefreshCancelling();
  expect(getMetadataRefreshOperationState().status).toBe('cancelling');
  expect(getMetadataRefreshOperationState().processed).toBe(5);
});

test('completed reset clears state', () => {
  beginMetadataRefreshOperation(5, 0);
  updateMetadataRefreshProgress({ processed: 5 });
  completeMetadataRefreshOperation('completed');
  const state = getMetadataRefreshOperationState();
  expect(state.status).toBe('completed');
  expect(state.processed).toBe(0);
  expect(state.total).toBe(0);
});

test('canResumeMetadataRefresh is true when partial/resumable progress remains', () => {
  beginMetadataRefreshOperation(10, 0);
  updateMetadataRefreshProgress({ processed: 4, resumeIndex: 4 });
  completeMetadataRefreshOperation('resumable');
  expect(canResumeMetadataRefresh()).toBe(true);

  resetMetadataRefreshOperationForTests();
  beginMetadataRefreshOperation(10, 0);
  updateMetadataRefreshProgress({ processed: 10, resumeIndex: 10 });
  completeMetadataRefreshOperation('resumable');
  expect(canResumeMetadataRefresh()).toBe(false);
});

test('cancelled state with progress is resumable', () => {
  beginMetadataRefreshOperation(10, 0);
  updateMetadataRefreshProgress({ processed: 3, resumeIndex: 3 });
  completeMetadataRefreshOperation('cancelled');
  expect(canResumeMetadataRefresh()).toBe(true);
});
