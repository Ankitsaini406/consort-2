'use client'

import { Badge } from '@/components/ui/badge'
import {
    Command,
    CommandItem,
    CommandEmpty,
    CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { Command as CommandPrimitive } from 'cmdk'
import { X as RemoveIcon, Check } from 'lucide-react'
import React, {
    KeyboardEvent,
    createContext,
    forwardRef,
    useCallback,
    useContext,
    useState,
} from 'react'

interface MultiSelectorProps
    extends React.ComponentPropsWithoutRef<typeof CommandPrimitive> {
    values: string[]
    onValuesChange: (value: string[]) => void
    loop?: boolean
    maxItems?: number
}

interface MultiSelectContextProps {
    value: string[]
    onValueChange: (value: string) => void
    open: boolean
    setOpen: (value: boolean) => void
    inputValue: string
    setInputValue: React.Dispatch<React.SetStateAction<string>>
    activeIndex: number
    setActiveIndex: React.Dispatch<React.SetStateAction<number>>
    ref: React.RefObject<HTMLInputElement>
    handleSelect: (e: React.SyntheticEvent<HTMLInputElement>) => void
    maxItems?: number
}

const MultiSelectContext = createContext<MultiSelectContextProps | null>(null)

const useMultiSelect = () => {
    const context = useContext(MultiSelectContext)
    if (!context) {
        throw new Error('useMultiSelect must be used within MultiSelectProvider')
    }
    return context
}

/**
 * MultiSelect Docs: {@link: https://shadcn-extension.vercel.app/docs/multi-select}
 */

// TODO : expose the visibility of the popup

const MultiSelector = forwardRef<
    HTMLDivElement,
    MultiSelectorProps
>(({
    values: value,
    onValuesChange: onValueChange,
    loop = false,
    maxItems,
    className,
    children,
    dir,
    ...props
}, ref) => {
    const [inputValue, setInputValue] = useState('')
    const [open, setOpen] = useState<boolean>(false)
    const [activeIndex, setActiveIndex] = useState<number>(-1)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [isValueSelected, setIsValueSelected] = React.useState(false)
    const [selectedValue, setSelectedValue] = React.useState('')

    const onValueChangeHandler = useCallback(
        (val: string) => {
            if (value.includes(val)) {
                onValueChange(value.filter((item) => item !== val))
            } else {
                // Check maxItems constraint before adding
                if (maxItems && value.length >= maxItems) {
                    return // Don't add if max limit reached
                }
                onValueChange([...value, val])
            }
        },
        [value, onValueChange, maxItems]
    )

    const handleSelect = React.useCallback(
        (e: React.SyntheticEvent<HTMLInputElement>) => {
            e.preventDefault()
            const target = e.currentTarget
            const selection = target.value.substring(
                target.selectionStart ?? 0,
                target.selectionEnd ?? 0,
            )

            setSelectedValue(selection)
            setIsValueSelected(selection === inputValue)
        },
        [inputValue],
    )

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLDivElement>) => {
            e.stopPropagation()
            const target = inputRef.current

            if (!target) return

            const moveNext = () => {
                const nextIndex = activeIndex + 1
                setActiveIndex(
                    nextIndex > value.length - 1 ? (loop ? 0 : -1) : nextIndex,
                )
            }

            const movePrev = () => {
                const prevIndex = activeIndex - 1
                setActiveIndex(prevIndex < 0 ? value.length - 1 : prevIndex)
            }

            const moveCurrent = () => {
                const newIndex =
                    activeIndex - 1 <= 0
                        ? value.length - 1 === 0
                            ? -1
                            : 0
                        : activeIndex - 1
                setActiveIndex(newIndex)
            }

            switch (e.key) {
                case 'ArrowLeft':
                    if (dir === 'rtl') {
                        if (value.length > 0 && (activeIndex !== -1 || loop)) {
                            moveNext()
                        }
                    } else {
                        if (value.length > 0 && target.selectionStart === 0) {
                            movePrev()
                        }
                    }
                    break

                case 'ArrowRight':
                    if (dir === 'rtl') {
                        if (value.length > 0 && target.selectionStart === 0) {
                            movePrev()
                        }
                    } else {
                        if (value.length > 0 && (activeIndex !== -1 || loop)) {
                            moveNext()
                        }
                    }
                    break

                case 'Backspace':
                case 'Delete':
                    if (value.length > 0) {
                        if (activeIndex !== -1 && activeIndex < value.length) {
                            onValueChangeHandler(value[activeIndex])
                            moveCurrent()
                        } else {
                            if (target.selectionStart === 0) {
                                if (selectedValue === inputValue || isValueSelected) {
                                    onValueChangeHandler(value[value.length - 1])
                                }
                            }
                        }
                    }
                    break

                case 'Enter':
                    setOpen(true)
                    break

                case 'Escape':
                    if (activeIndex !== -1) {
                        setActiveIndex(-1)
                    } else if (open) {
                        setOpen(false)
                    }
                    break
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [value, inputValue, activeIndex, loop],
    )

    return (
        <MultiSelectContext.Provider
            value={{
                value,
                onValueChange: onValueChangeHandler,
                open,
                setOpen,
                inputValue,
                setInputValue,
                activeIndex,
                setActiveIndex,
                ref: inputRef,
                handleSelect,
                maxItems,
            }}
        >
            <Command
                ref={ref}
                onKeyDown={handleKeyDown}
                className={cn(
                    'overflow-visible bg-transparent flex flex-col space-y-2',
                    className,
                )}
                dir={dir}
                {...props}
            >
                {children}
            </Command>
        </MultiSelectContext.Provider>
    )
})

MultiSelector.displayName = 'MultiSelector'

const MultiSelectorTrigger = forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
    const { value, onValueChange, activeIndex, maxItems } = useMultiSelect()

    const mousePreventDefault = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    return (
        <div
            ref={ref}
            className={cn(
                'flex flex-wrap gap-2 min-h-10 h-auto w-full rounded-sm border border-input bg-transparent px-2 py-1 text-base shadow-sm transition-colors',
                'focus-within:outline-none focus-within:ring-1 focus-within:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                {
                    'focus-within:ring-ring': activeIndex === -1,
                },
                className,
            )}
            {...props}
        >
            {value.map((item, index) => (
                <Badge
                    key={item}
                    className={cn(
                        'px-3 rounded-sm flex items-center gap-1 bg-muted',
                        activeIndex === index && 'ring-2 ring-muted-foreground',
                    )}
                    variant={'secondary'}
                >
                    <span className="text-caption">{item}</span>
                    <button
                        aria-label={`Remove ${item} option`}
                        aria-roledescription="button to remove option"
                        type="button"
                        onMouseDown={mousePreventDefault}
                        onClick={() => onValueChange(item)}
                    >
                        <span className="sr-only">Remove {item} option</span>
                        <RemoveIcon className="h-3 w-3 hover:stroke-destructive" />
                    </button>
                </Badge>
            ))}
            {children}
            {maxItems && (
                <div className="ml-auto flex items-center">
                    <span className={cn(
                        "text-xs text-muted-foreground px-2 py-1 rounded",
                        value.length >= maxItems && "text-orange-600 bg-orange-50"
                    )}>
                        {value.length}/{maxItems}
                    </span>
                </div>
            )}
        </div>
    )
})

MultiSelectorTrigger.displayName = 'MultiSelectorTrigger'

const MultiSelectorInput = forwardRef<
    React.ElementRef<typeof CommandPrimitive.Input>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, forwardedRef) => {
    const {
        setOpen,
        inputValue,
        setInputValue,
        activeIndex,
        setActiveIndex,
        handleSelect,
        ref: contextRef,
    } = useMultiSelect()

    return (
        <CommandPrimitive.Input
            {...props}
            tabIndex={0}
            ref={forwardedRef || contextRef}
            value={inputValue}
            onValueChange={activeIndex === -1 ? setInputValue : undefined}
            onSelect={handleSelect}
            onBlur={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onClick={() => setActiveIndex(-1)}
            className={cn(
                'ml-0.5 bg-transparent outline-none text-sm placeholder:text-muted-foreground flex-1',
                'file:border-0 file:bg-transparent file:text-sm file:font-medium',
                activeIndex !== -1 && 'caret-transparent',
                className,
            )}
        />
    )
})

MultiSelectorInput.displayName = 'MultiSelectorInput'

const MultiSelectorContent = forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ children }, ref) => {
    const { open } = useMultiSelect()
    return (
        <div ref={ref} className="relative">
            {open && children}
        </div>
    )
})

MultiSelectorContent.displayName = 'MultiSelectorContent'

const MultiSelectorList = forwardRef<
    React.ElementRef<typeof CommandPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, children }, ref) => {
    return (
        <CommandList
            ref={ref}
            className={cn(
                'p-2 flex flex-col gap-2 rounded-sm scrollbar-thin scrollbar-track-transparent transition-colors',
                'scrollbar-thumb-muted-foreground dark:scrollbar-thumb-muted scrollbar-thumb-rounded-lg',
                'w-full absolute bg-background shadow-md z-10 border border-input top-0',
                className,
            )}
        >
            {children}
            <CommandEmpty>
                <span className="text-muted-foreground text-sm">No results found</span>
            </CommandEmpty>
        </CommandList>
    )
})

MultiSelectorList.displayName = 'MultiSelectorList'

const MultiSelectorItem = forwardRef<
    React.ElementRef<typeof CommandPrimitive.Item>,
    { value: string } & React.ComponentPropsWithoutRef<
        typeof CommandPrimitive.Item
    >
>(({ className, value: itemValue, children, ...props }, ref) => {
    const { value: selectedValues, onValueChange, setInputValue, maxItems } = useMultiSelect()

    const mousePreventDefault = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    const isIncluded = selectedValues.includes(itemValue)
    const isMaxReached = maxItems && selectedValues.length >= maxItems && !isIncluded
    
    return (
        <CommandItem
            ref={ref}
            {...props}
            onSelect={() => {
                onValueChange(itemValue)
                setInputValue('')
            }}
            className={cn(
                'rounded-sm cursor-pointer px-2 py-1 transition-colors flex justify-between ',
                className,
                isIncluded && 'opacity-50 cursor-default',
                isMaxReached && 'opacity-30 cursor-not-allowed',
                props.disabled && 'opacity-50 cursor-not-allowed',
            )}
            onMouseDown={mousePreventDefault}
            disabled={isMaxReached || props.disabled}
        >
            {children}
            {isIncluded && <Check className="h-4 w-4" />}
        </CommandItem>
    )
})

MultiSelectorItem.displayName = 'MultiSelectorItem'

export {
    MultiSelector,
    MultiSelectorTrigger,
    MultiSelectorInput,
    MultiSelectorContent,
    MultiSelectorList,
    MultiSelectorItem,
}