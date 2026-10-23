import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { familyApi } from './api';

const FamilyContext = createContext(null);

/** Module config (limits, public links) and the list of trees the person sees. */
export function FamilyProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [trees, setTrees] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const { data } = await familyApi.home();
      setConfig(data.config);
      setTrees(data.trees);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(() => ({ config, trees, error, reload }), [config, trees, error, reload]);
  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  return useContext(FamilyContext);
}
