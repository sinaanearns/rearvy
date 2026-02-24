"use client";

import * as React from "react";

interface SidebarContextType {
    isOpen: boolean;
    toggle: () => void;
    setOpen: (open: boolean) => void;
}

const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = React.useState(true);

    const toggle = React.useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    const setOpen = React.useCallback((open: boolean) => {
        setIsOpen(open);
    }, []);

    return (
        <SidebarContext.Provider value={{ isOpen, toggle, setOpen }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = React.useContext(SidebarContext);
    if (context === undefined) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
}
