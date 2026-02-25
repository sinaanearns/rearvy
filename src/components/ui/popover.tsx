"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type PopoverContextType = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const PopoverContext = React.createContext<PopoverContextType | undefined>(undefined)

const Popover = ({ children, open: controlledOpen, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange || (() => {}) : setInternalOpen

  // Close popover when clicking outside
  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open, setOpen])

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      {children}
    </PopoverContext.Provider>
  )
}

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ onClick, asChild, children, ...props }, ref) => {
  const context = React.useContext(PopoverContext)
  if (!context) throw new Error("PopoverTrigger must be used within Popover")

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    context.setOpen(!context.open)
    onClick?.(e)
  }

  const setRef = (node: HTMLButtonElement | null) => {
    ;(context.triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
    if (typeof ref === "function") ref(node)
    else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      ref: setRef,
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        handleClick(e)
        ;(children as React.ReactElement<{ onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void }>).props.onClick?.(e)
      },
    })
  }

  return (
    <button ref={setRef} onClick={handleClick} {...props}>
      {children}
    </button>
  )
})
PopoverTrigger.displayName = "PopoverTrigger"

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const context = React.useContext(PopoverContext)
  if (!context) throw new Error("PopoverContent must be used within Popover")

  if (!context.open) return null

  const triggerRect = context.triggerRef.current?.getBoundingClientRect()
  const top = triggerRect ? triggerRect.bottom + 8 : 0
  const right = triggerRect ? window.innerWidth - triggerRect.right : 0

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => context.setOpen(false)}
      />
      <div
        ref={ref}
        style={{
          position: "fixed",
          top: `${top}px`,
          right: `${right}px`,
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
