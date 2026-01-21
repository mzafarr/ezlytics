import { auth } from "@my-better-t-app/auth";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsSamples } from "../../analytics-samples";

type PageProps = {
  params: { visitorId: string };
};

export default async function VisitorPage({ params }: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const { visitorId } = params;
  const visitorEvents = analyticsSamples.filter((event) => event.visitorId === visitorId);
  const sortedEvents = [...visitorEvents].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );
  const firstEvent = sortedEvents[0];
  const lastEvent = sortedEvents[sortedEvents.length - 1];
  const pageviews = visitorEvents.filter((event) => event.eventType === "pageview");
  const goals = visitorEvents.filter((event) => event.eventType === "goal");
  const visitedPages = pageviews.reduce<Record<string, number>>((accumulator, event) => {
    accumulator[event.path] = (accumulator[event.path] ?? 0) + 1;
    return accumulator;
  }, {});
  const goalCounts = goals.reduce<Record<string, number>>((accumulator, event) => {
    if (!event.goal) {
      return accumulator;
    }
    accumulator[event.goal] = (accumulator[event.goal] ?? 0) + 1;
    return accumulator;
  }, {});
  const paymentEvents = visitorEvents.filter((event) => event.revenue > 0);
  const totalRevenue = paymentEvents.reduce((sum, event) => sum + event.revenue, 0);
  const lastUrl = lastEvent ? `https://${lastEvent.hostname}${lastEvent.path}` : "—";
  const formatMoney = (value: number) => `$${value.toFixed(2)}`;

  const formatEventLabel = (event: typeof sortedEvents[number]) =>
    event.eventType === "goal" ? `Goal: ${event.goal || "unknown"}` : "Pageview";

  const formatEventRoute = (event: typeof sortedEvents[number]) =>
    event.path ? `${event.hostname}${event.path}` : event.hostname;

  const timelineByDay = sortedEvents.reduce<Record<string, typeof sortedEvents>>(
    (accumulator, event) => {
      const key = event.timestamp.slice(0, 10);
      if (!accumulator[key]) {
        accumulator[key] = [];
      }
      accumulator[key].push(event);
      return accumulator;
    },
    {},
  );
  const orderedDays = Object.keys(timelineByDay).sort(
    (left, right) => new Date(left).getTime() - new Date(right).getTime(),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Visitor {visitorId}</h1>
          <p className="text-xs text-muted-foreground">Identity, acquisition, and activity history.</p>
        </div>
        <Link className="text-xs text-primary underline-offset-4 hover:underline" href="/dashboard">
          Back to dashboard
        </Link>
      </div>

      {visitorEvents.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No activity</CardTitle>
            <CardDescription>We have not ingested events for this visitor yet.</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Try another visitor from the list.</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Identity</CardTitle>
                <CardDescription>Anonymous visitor profile snapshot.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Visitor ID</span>
                  <span className="font-medium">{visitorId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">First seen</span>
                  <span>{firstEvent?.date ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last seen</span>
                  <span>{lastEvent?.date ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Visits</span>
                  <span>{pageviews.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Goals</span>
                  <span>{goals.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Revenue</span>
                  <span>{formatMoney(totalRevenue)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Location & device</CardTitle>
                <CardDescription>Most recent session context.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Country</span>
                  <span>{lastEvent?.country ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Device</span>
                  <span>{lastEvent?.device ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Browser</span>
                  <span>{lastEvent?.browser ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">OS</span>
                  <span>{lastEvent?.os ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Hostname</span>
                  <span>{lastEvent?.hostname ?? "—"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Acquisition</CardTitle>
                <CardDescription>First-touch source details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Referrer</span>
                  <span>{firstEvent?.referrer ?? "direct"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span>{firstEvent?.source ?? "unknown"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Campaign</span>
                  <span>{firstEvent?.campaign ?? "none"}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Activity summary</CardTitle>
                <CardDescription>Last URL and completion stats.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last URL</span>
                  <span className="max-w-[220px] truncate text-right">{lastUrl}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Unique pages</span>
                  <span>{Object.keys(visitedPages).length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Completed goals</span>
                  <span>{Object.keys(goalCounts).length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visited pages</CardTitle>
                <CardDescription>Top pages for this visitor.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {Object.keys(visitedPages).length === 0 ? (
                  <p className="text-muted-foreground">No pageviews recorded.</p>
                ) : (
                  Object.entries(visitedPages)
                    .sort((left, right) => right[1] - left[1])
                    .map(([path, count]) => (
                      <div key={path} className="flex items-center justify-between">
                        <span>{path}</span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Goals</CardTitle>
                <CardDescription>Completed goals for this visitor.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {Object.keys(goalCounts).length === 0 ? (
                  <p className="text-muted-foreground">No goal completions yet.</p>
                ) : (
                  Object.entries(goalCounts).map(([goal, count]) => (
                    <div key={goal} className="flex items-center justify-between">
                      <span>{goal}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
                <CardDescription>Attributed payments for this visitor.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {paymentEvents.length === 0 ? (
                  <p className="text-muted-foreground">No payments attributed.</p>
                ) : (
                  paymentEvents.map((event, index) => (
                    <div key={`${event.date}-${index}`} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{formatMoney(event.revenue)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {event.date} · {event.source || "unknown"}
                        </div>
                      </div>
                      <span className="text-muted-foreground">{event.goal || "payment"}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Recent events for this visitor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {orderedDays.map((day) => (
                <div key={day} className="space-y-2">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {new Date(day).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <div className="space-y-2">
                    {timelineByDay[day].map((event, index) => (
                      <div
                        key={`${event.date}-${index}`}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
                      >
                        <div className="space-y-2">
                          <div className="font-medium">{formatEventLabel(event)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatEventRoute(event)}
                          </div>
                          {event.metadata && Object.keys(event.metadata).length > 0 ? (
                            <details className="text-[11px] text-muted-foreground">
                              <summary className="cursor-pointer text-foreground">
                                View metadata
                              </summary>
                              <div className="mt-2 space-y-1">
                                {Object.entries(event.metadata)
                                  .sort(([left], [right]) => left.localeCompare(right))
                                  .map(([key, value]) => (
                                    <div key={key} className="flex items-start justify-between gap-4">
                                      <span className="font-medium text-muted-foreground">{key}</span>
                                      <span className="text-right text-foreground">
                                        {value === null ? "—" : String(value)}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </details>
                          ) : null}
                        </div>
                        <div className="text-right text-[11px] text-muted-foreground">
                          <div>
                            {new Date(event.timestamp).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                          {event.revenue > 0 ? <div>{formatMoney(event.revenue)}</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
