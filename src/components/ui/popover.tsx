"use client"

import * as React from "react"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

type PopoverContextType = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
  contentRef: React.MutableRefObject<HTMLDivElement | null>
  setTriggerNode: (node: HTMLElement | null) => void
  setContentNode: (node: HTMLDivElement | null) => void
}

const PopoverContext = React.createContext<PopoverContextType | undefined>(undefined)

function usePopoverContext() {
  const context = React.useContext(PopoverContext)
  if (!context) throw new Error("Popover components must be used within Popover")
  return context
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (typeof ref === "function") {
    ref(value)
    return
  }

  if (ref) {
    ;(ref as React.MutableRefObject<T>).current = value
  }
}

const Popover = ({ children, open: controlledOpen, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = React.useCallback((nextOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(nextOpen)
      return
    }

    setInternalOpen(nextOpen)
  }, [isControlled, onOpenChange])
  const setTriggerNode = React.useCallback((node: HTMLElement | null) => {
    triggerRef.current = node
  }, [])
  const setContentNode = React.useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node
  }, [])

  // Close popover when clicking outside
  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return

      if (
        triggerRef.current?.contains(target) ||
        contentRef.current?.contains(target)
      ) {
        return
      }

      setOpen(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open, setOpen])

  const contextValue = React.useMemo(() => ({
    open,
    setOpen,
    triggerRef,
    contentRef,
    setTriggerNode,
    setContentNode,
  }), [open, setOpen, setTriggerNode, setContentNode])

  return (
    <PopoverContext.Provider value={contextValue}>
      {children}
    </PopoverContext.Provider>
  )
}

const PopoverTrigger = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"button"> & { asChild?: boolean }
>(({ onClick, asChild, children, ...props }, ref) => {
  const { open, setOpen, setTriggerNode } = usePopoverContext()
  const buttonTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const slotTriggerRef = React.useRef<HTMLElement | null>(null)

  React.useLayoutEffect(() => {
    const node = asChild ? slotTriggerRef.current : buttonTriggerRef.current
    setTriggerNode(node)
    assignRef(ref, node)

    return () => {
      setTriggerNode(null)
      assignRef(ref, null)
    }
  }, [asChild, ref, setTriggerNode])

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    setOpen(!open)
    onClick?.(e as React.MouseEvent<HTMLButtonElement>)
  }

  if (asChild) {
    return (
      <Slot.Root
        ref={slotTriggerRef}
        onClick={handleClick}
        {...(props as React.HTMLAttributes<HTMLElement>)}
      >
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      ref={buttonTriggerRef}
      onClick={handleClick as React.MouseEventHandler<HTMLButtonElement>}
      {...props}
    >
      {children}
    </button>
  )
})
PopoverTrigger.displayName = "PopoverTrigger"

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { side?: "top" | "bottom" }
>(({ className, side = "bottom", ...props }, ref) => {
  const context = usePopoverContext()

  if (!context.open) return null

  const triggerRect = context.triggerRef.current?.getBoundingClientRect()
  
  let top = 0
  if (triggerRect) {
    if (side === "top") {
      // We don't know the height yet, so we'll use transform for the exact offset
      top = triggerRect.top - 8
    } else {
      top = triggerRect.bottom + 8
    }
  }
  
  const right = triggerRect ? window.innerWidth - triggerRect.right : 0

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => context.setOpen(false)}
      />
      <div
        ref={(node) => {
          context.setContentNode(node)
          assignRef(ref, node)
        }}
        style={{
          position: "fixed",
          top: `${top}px`,
          right: `${right}px`,
          transform: side === "top" ? "translateY(-100%)" : "none",
        }}
        className={cn(
          "z-50 rounded-md border border-border bg-background shadow-lg",
          className
        )}
        {...props}
      />
    </>
  )
})
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent }
