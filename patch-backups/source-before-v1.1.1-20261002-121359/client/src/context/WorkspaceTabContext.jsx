import { createContext, useContext } from "react";

const WorkspaceTabContext = createContext({
  tabId: null,
  active: true,
});

export function WorkspaceTabProvider({ tabId, active, children }) {
  return (
    <WorkspaceTabContext.Provider value={{ tabId, active }}>
      {children}
    </WorkspaceTabContext.Provider>
  );
}

export function useWorkspaceTab() {
  return useContext(WorkspaceTabContext);
}
