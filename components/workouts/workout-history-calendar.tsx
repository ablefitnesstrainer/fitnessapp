type WorkoutHistoryEntry = {
  id: string;
  completed_at: string | null;
  total_volume: number | null;
  duration_minutes: number | null;
  week_number: number | null;
  day_number: number | null;
};

type UpcomingWorkoutEntry = {
  week_number: number;
  day_number: number;
  is_current: boolean;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leading = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const days: Array<{ key: string; date: Date | null }> = [];

  for (let i = 0; i < leading; i += 1) {
    days.push({ key: `lead-${i}`, date: null });
  }
  for (let day = 1; day <= totalDays; day += 1) {
    days.push({ key: `day-${day}`, date: new Date(year, month, day) });
  }
  while (days.length % 7 !== 0) {
    days.push({ key: `trail-${days.length}`, date: null });
  }

  return days;
}

export function WorkoutHistoryCalendar({
  history,
  upcoming
}: {
  history: WorkoutHistoryEntry[];
  upcoming: UpcomingWorkoutEntry[];
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const days = buildCalendarDays(year, month);

  const completedDateKeys = new Set(
    history
      .filter((entry) => entry.completed_at)
      .map((entry) => new Date(entry.completed_at as string))
      .map((date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`)
  );

  return (
    <section className="grid gap-4 lg:grid-cols-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Workout Calendar</h2>
          <p className="text-sm font-medium text-slate-600">{monthLabel}</p>
        </header>
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          {weekdayLabels.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((entry) => {
            if (!entry.date) return <div key={entry.key} className="h-10 rounded-lg bg-slate-50/60" />;
            const dateKey = `${entry.date.getFullYear()}-${entry.date.getMonth() + 1}-${entry.date.getDate()}`;
            const completed = completedDateKeys.has(dateKey);
            return (
              <div
                key={entry.key}
                className={`flex h-10 items-center justify-center rounded-lg border text-sm font-medium ${
                  completed ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
                title={completed ? "Workout completed" : "No completed workout"}
              >
                {entry.date.getDate()}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Green dates indicate completed workouts.</p>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
        <h2 className="text-lg font-semibold text-slate-900">Upcoming Workouts</h2>
        <ul className="mt-3 space-y-2">
          {upcoming.length ? (
            upcoming.map((entry) => (
              <li key={`${entry.week_number}-${entry.day_number}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <p className="text-sm font-medium text-slate-800">
                  Week {entry.week_number} • Day {entry.day_number}
                </p>
                {entry.is_current ? (
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">Current</span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Upcoming</span>
                )}
              </li>
            ))
          ) : (
            <li className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">No upcoming days in the current program.</li>
          )}
        </ul>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-5">
        <h2 className="text-lg font-semibold text-slate-900">Recent Sessions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2 pr-3 font-semibold">Date</th>
                <th className="pb-2 pr-3 font-semibold">Program Day</th>
                <th className="pb-2 pr-3 font-semibold">Duration</th>
                <th className="pb-2 pr-3 font-semibold">Total Volume</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? (
                history.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-700">
                      {entry.completed_at ? new Date(entry.completed_at).toLocaleString() : "-"}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {entry.week_number && entry.day_number ? `Week ${entry.week_number} • Day ${entry.day_number}` : "-"}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{entry.duration_minutes ? `${entry.duration_minutes} min` : "-"}</td>
                    <td className="py-2 pr-3 text-slate-700">{entry.total_volume ? Math.round(entry.total_volume).toLocaleString() : "0"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={4}>
                    No completed sessions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
