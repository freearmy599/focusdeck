# FocusDeck

A free, privacy-first daily productivity workspace built with plain HTML, CSS and JavaScript.

## Features

- Daily dashboard with task completion, focus time and goal progress
- Create, edit, complete, search, sort and delete tasks
- Recurring tasks (daily, weekdays, weekly and monthly) with automatic next-occurrence scheduling
- Due-date filters for today, overdue, the next seven days and undated tasks
- Priority, category and due date per task
- Focus timer with 25-minute focus, 5-minute short break and 15-minute long break presets
- Timer state resumes after a page refresh or accidental navigation
- Daily goals and auto-saved quick notes
- Seven-day activity overview and basic lifetime insights
- Local browser storage, JSON export and import backup
- Dark and light themes
- Responsive mobile layout and installable PWA shell
- Basic offline app-shell caching

## Run locally

Open `index.html` in a modern browser. For PWA installation and service-worker testing, serve the folder over localhost or HTTPS. For example, with Python installed:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Privacy

FocusDeck stores tasks, notes, goals and activity in the browser's local storage. No account or app backend is required. Anyone using the same browser profile may be able to access local data. Clearing site data may erase it; export a backup before clearing data or changing devices.

## Deploy

This is a static site. Publish the repository root using GitHub Pages or another static host. No build command or paid API is required.

## Monetization roadmap

The initial version contains no ads or payments. Once the product is tested with real users, consider useful SEO landing pages and apply to an advertising network only after meeting its current policies and eligibility requirements.

## Version

1.1 — recurring tasks, due-date filters, improved offline freshness and sharing metadata.