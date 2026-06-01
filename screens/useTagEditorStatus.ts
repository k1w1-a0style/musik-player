import { useCallback, useState } from 'react';

export const useTagEditorStatus = () => {
  const [status, setStatus] = useState<string | null>(null);
  const clearStatus = useCallback((): void => setStatus(null), []);

  return { status, setStatus, clearStatus };
};
