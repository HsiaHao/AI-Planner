import React, { createContext, ReactNode, useContext, useState } from 'react';

interface SubViewContextType {
  isSubViewVisible: boolean;
  setSubViewVisible: (visible: boolean) => void;
}

const SubViewContext = createContext<SubViewContextType | undefined>(undefined);

export function SubViewProvider({ children }: { children: ReactNode }) {
  const [isSubViewVisible, setSubViewVisible] = useState(false);

  return (
    <SubViewContext.Provider value={{ isSubViewVisible, setSubViewVisible }}>
      {children}
    </SubViewContext.Provider>
  );
}

export function useSubView() {
  const context = useContext(SubViewContext);
  if (context === undefined) {
    throw new Error('useSubView must be used within a SubViewProvider');
  }
  return context;
}


