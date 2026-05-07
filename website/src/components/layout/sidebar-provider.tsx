"use client";

import * as React from "react";

type RightTab = "news" | "notifications" | "memory";

interface SidebarContextType {
    isOpen: boolean;
    toggle: () => void;
    setOpen: (open: boolean) => void;
    isPanelsOpen: boolean;
    togglePanels: () => void;
    setPanelsOpen: (open: boolean) => void;
    isRightOpen: boolean;
    toggleRight: () => void;
    setRightOpen: (open: boolean) => void;
    rightTab: RightTab;
    setRightTab: (tab: RightTab) => void;
    openRightTo: (tab: RightTab) => void;
}

const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = React.useState(true);
    const [isPanelsOpen, setIsPanelsOpen] = React.useState(false);
    const [isRightOpen, setIsRightOpen] = React.useState(true);
    const [rightTab, setRightTabState] = React.useState<RightTab>("news");

    const toggle = React.useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    const setOpen = React.useCallback((open: boolean) => {
        setIsOpen(open);
    }, []);

    const togglePanels = React.useCallback(() => {
        setIsPanelsOpen((prev) => !prev);
    }, []);

    const setPanelsOpen = React.useCallback((open: boolean) => {
        setIsPanelsOpen(open);
    }, []);

    const toggleRight = React.useCallback(() => {
        setIsRightOpen((prev) => !prev);
    }, []);

    const setRightOpen = React.useCallback((open: boolean) => {
        setIsRightOpen(open);
    }, []);

    const setRightTab = React.useCallback((tab: RightTab) => {
        setRightTabState(tab);
    }, []);

    const openRightTo = React.useCallback((tab: RightTab) => {
        setRightTabState(tab);
        setIsRightOpen(true);
    }, []);

    return (
        <SidebarContext.Provider value={{ isOpen, toggle, setOpen, isPanelsOpen, togglePanels, setPanelsOpen, isRightOpen, toggleRight, setRightOpen, rightTab, setRightTab, openRightTo }}>
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
