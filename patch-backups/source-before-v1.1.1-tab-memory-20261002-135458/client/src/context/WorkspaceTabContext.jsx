import { createContext, useContext } from "react";

const noop = () => {};

const WorkspaceTabContext = createContext({
  tabId: null,
  active: true,
  sleeping: false,
  dirty: false,
  markDirty: noop,
  markClean: noop,
  reload: noop,
});

export function WorkspaceTabProvider({
  tabId,
  active,
  sleeping = false,
  dirty = false,
  markDirty = noop,
  markClean = noop,
  reload = noop,
  children,
}) {
  return (
    <WorkspaceTabContext.Provider
      value={{
        tabId,
        active,
        sleeping,
        dirty,
        markDirty,
        markClean,
        reload,
      }}
    >
      {children}
    </WorkspaceTabContext.Provider>
  );
}

export function useWorkspaceTab() {
  return useContext(WorkspaceTabContext);
}
