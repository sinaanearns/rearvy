"use client";

import * as React from "react";

type RightTab = "news" | "notifications";

interface SidebarContextType {
    isOpen: boolean;
    toggle: () => void;
    setOpen: (open: boolean) => void;
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
    const [isRightOpen, setIsRightOpen] = React.useState(false);
    const [rightTab, setRightTabState] = React.useState<RightTab>("news");

    const toggle = React.useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    const setOpen = React.useCallback((open: boolean) => {
        setIsOpen(open);
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
        <SidebarContext.Provider value={{ isOpen, toggle, setOpen, isRightOpen, toggleRight, setRightOpen, rightTab, setRightTab, openRightTo }}>
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
