"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockCalendarEvents } from "@/lib/mock-data";
import { getPlatformColor, getStatusColor } from "@/lib/helpers";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export default function CalendarPage() {
  const [currentDate] = useState(new Date(2026, 2, 1)); // March 2026
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const getEventsForDay = (day: number) => {
    const dateStr = `2026-03-${day.toString().padStart(2, "0")}`;
    return mockCalendarEvents.filter((e) => e.date === dateStr);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Content Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Schedule and track your publishing pipeline
          </p>
        </div>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />
          Schedule Post
        </Button>
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold text-foreground">{monthName}</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {DAYS.map((day) => (
              <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-border">
            {cells.map((day, i) => {
              const events = day ? getEventsForDay(day) : [];
              const isToday = day === 7;
              return (
                <div
                  key={i}
                  className={`min-h-[100px] p-2 border-b border-r border-border/50 ${
                    day ? "bg-card" : "bg-muted/30"
                  } ${isToday ? "bg-primary/5" : ""}`}
                >
                  {day && (
                    <>
                      <span className={`text-xs font-medium ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {events.map((event) => (
                          <div
                            key={event.id}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium truncate cursor-pointer hover:opacity-80 ${getPlatformColor(event.platform)}`}
                          >
                            {event.time} {event.clipTitle}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {["youtube", "tiktok", "instagram", "linkedin", "x", "facebook"].map((platform) => (
              <div key={platform} className="flex items-center gap-1.5">
                <div className={`h-2.5 w-2.5 rounded-full ${getPlatformColor(platform).split(" ")[0]}`} />
                <span className="text-xs text-muted-foreground capitalize">{platform}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
