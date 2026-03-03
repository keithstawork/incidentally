import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, useNavigation, type CaptionProps } from "react-day-picker"
import { format, setMonth, setYear } from "date-fns"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function CustomCaption({ displayMonth }: CaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useNavigation()
  const [picking, setPicking] = React.useState<"month" | "year" | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!picking) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPicking(null)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [picking])

  const currentYear = displayMonth.getFullYear()
  const years: number[] = []
  for (let y = currentYear + 2; y >= 2015; y--) years.push(y)

  return (
    <div ref={ref} className="relative flex items-center justify-between pt-1 h-9 w-full">
      <button
        type="button"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 opacity-60 hover:opacity-100 z-10"
        )}
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1 text-sm font-medium">
        <button
          type="button"
          className="hover:bg-accent hover:text-accent-foreground rounded px-1.5 py-0.5 transition-colors"
          onClick={() => setPicking(picking === "month" ? null : "month")}
        >
          {format(displayMonth, "MMMM")}
        </button>
        <button
          type="button"
          className="hover:bg-accent hover:text-accent-foreground rounded px-1.5 py-0.5 transition-colors"
          onClick={() => setPicking(picking === "year" ? null : "year")}
        >
          {format(displayMonth, "yyyy")}
        </button>
      </div>

      <button
        type="button"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 opacity-60 hover:opacity-100 z-10"
        )}
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {picking === "month" && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 grid grid-cols-3 gap-1 rounded-md border border-border bg-white dark:bg-zinc-900 p-2 shadow-lg">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              type="button"
              className={cn(
                "rounded px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent",
                i === displayMonth.getMonth() && "bg-primary text-primary-foreground hover:bg-primary"
              )}
              onClick={() => {
                goToMonth(setMonth(displayMonth, i))
                setPicking(null)
              }}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      )}

      {picking === "year" && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-52 overflow-y-auto rounded-md border border-border bg-white dark:bg-zinc-900 p-2 shadow-lg">
          <div className="grid grid-cols-3 gap-1">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className={cn(
                  "rounded px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent",
                  y === currentYear && "bg-primary text-primary-foreground hover:bg-primary"
                )}
                onClick={() => {
                  goToMonth(setYear(displayMonth, y))
                  setPicking(null)
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: externalComponents,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4 overflow-visible",
        caption: "relative flex items-center justify-center pt-1 h-9 w-full overflow-visible",
        caption_label: "text-sm font-medium",
        nav: "hidden",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 opacity-60 hover:opacity-100"
        ),
        nav_button_previous: "",
        nav_button_next: "",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CustomCaption,
        ...externalComponents,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
