# # Able Fitness Coaching App
System Architecture

## Stack

Frontend
- Next.js
- React
- Tailwind

Backend
- Supabase
- Postgres
- Row Level Security

Hosting
- Vercel

Charts
- Chart.js

Video
- YouTube embeds

---

## Folder Structure

/app
  /dashboard
  /workouts
  /nutrition
  /messages
  /checkins

/components
  WorkoutCard
  ExerciseCard
  MacroChart
  ProgressGraph

/lib
  supabaseClient.ts
  api.ts

/pages
  login
  register

/server
  workoutService.ts
  nutritionService.ts
  messagingService.ts

---

## Core Modules

Authentication

Client Dashboard

Workout Engine

Program Generator

Exercise Library

Nutrition Tracker

Messaging

Check-ins

---

## Key Services

Workout Service
- generate program
- log workout
- progression logic

Nutrition Service
- macro targets
- food logging

Messaging Service
- send message
- retrieve conversation

Checkin Service
- weekly questionnaire
- adherence scoring