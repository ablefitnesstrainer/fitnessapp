# Able Fitness Coaching App

## Product Requirements Document (PRD)

Version: 1.0\
Author: Dwayne Riner\
Target Platform: Web App (PWA-ready)\
Stack: Next.js + Supabase + Vercel

------------------------------------------------------------------------

# 1. Product Overview

The Able Fitness Coaching App is a lightweight coaching platform
designed to allow a coach to deliver structured workout programs, track
client progress, manage nutrition targets, and communicate with clients.

The primary design goal is simplicity and automation to reduce manual
coaching work while maintaining effective training principles.

The system must support:

-   up to \~30 clients
-   automated workout program generation
-   exercise demo videos
-   workout tracking
-   macro tracking
-   messaging
-   weekly check-ins
-   reusable program templates

The app must be deployable as a web application first, with the ability
to convert into a PWA or native mobile app later.

------------------------------------------------------------------------

# 2. Product Goals

Primary Goals

1.  Reduce manual programming work for the coach
2.  Provide clients with clear daily workout instructions
3.  Track workout performance
4.  Track calories and macros
5.  Allow weekly progress review
6.  Enable coach-client communication

Success Criteria

-   Coach can manage up to 30 clients easily
-   Programs can be generated in under 1 minute
-   Exercise library import takes under 5 minutes
-   App hosting cost stays under \$30/month

------------------------------------------------------------------------

# 3. Product Phases

## Phase 1 --- MVP

Client Dashboard\
Workout tracking\
Exercise video integration\
Program templates\
Program generator\
Messaging\
Macro tracking\
Weekly check-ins\
Exercise library import

## Phase 2 --- Automation

USDA food search\
Workout progression suggestions\
Adherence analytics\
Missed workout alerts\
Saved meals

## Phase 3 --- Expansion

Stripe payments\
AI coaching tools\
Mobile PWA install\
Push notifications

------------------------------------------------------------------------

# 4. User Roles

## Admin

Full system control

Permissions

-   manage coaches
-   manage clients
-   manage exercises
-   manage templates
-   manage programs

## Coach

Permissions

-   manage assigned clients
-   assign programs
-   edit macros
-   view check-ins
-   messaging

## Client

Permissions

-   view workouts
-   log workouts
-   log nutrition
-   check-ins
-   messaging

------------------------------------------------------------------------

# 5. Core Features

## Workout Tracking

Clients must be able to:

-   view full workout week
-   swap workout days
-   log sets/reps/weight
-   add sets
-   skip exercises
-   swap exercises
-   track warm-up sets
-   run rest timer

Workout completion screen should show:

-   workout duration
-   total volume
-   PR detection

------------------------------------------------------------------------

## Exercise Library

Each exercise contains:

-   id
-   name
-   primary_muscle
-   secondary_muscle
-   equipment
-   difficulty
-   video_url
-   instructions

Supported muscles:

-   chest
-   back
-   shoulders
-   biceps
-   triceps
-   quads
-   hamstrings
-   glutes
-   calves
-   abs

------------------------------------------------------------------------

## Exercise Swap Logic

When swapping an exercise:

Filter by:

-   primary muscle
-   equipment availability

Client can choose:

-   temporary swap
-   permanent swap

------------------------------------------------------------------------

# 6. Program Templates

Templates allow reusable programs.

Template fields:

-   name
-   goal_type
-   days_per_week
-   experience_level
-   equipment_type

Example templates:

-   Fat Loss Beginner 3 Day
-   Hypertrophy Upper Lower 4 Day
-   Dumbbell Only Program
-   Barbell Strength Program

Template structure:

Week\
Day\
Exercises

------------------------------------------------------------------------

# 7. Workout Program Generator

Program generation inputs:

-   weeks
-   sets
-   reps
-   rep_progression
-   set_progression
-   deload_week

Example progression:

Week 1 -- 3x10\
Week 2 -- 3x11\
Week 3 -- 3x12\
Week 4 -- 4x10\
Week 5 -- 4x11\
Week 6 -- 4x12\
Week 7 -- Deload\
Week 8 -- Increase weight

Progression priority:

1.  reps\
2.  sets\
3.  load

------------------------------------------------------------------------

# 8. Deload Logic

Default:

-   reduce sets by 40%
-   reduce weight by 10--15%

Example:

Normal: 4x12\
Deload: 2x8

------------------------------------------------------------------------

# 9. Warm-up Sets

Warm-up sets belong to the template and copy automatically into later
weeks.

Example:

Bench Press

Warmup\
45 x 10\
95 x 5

Working Sets\
3 x 10

------------------------------------------------------------------------

# 10. Nutrition System

Daily targets:

-   calories
-   protein
-   carbs
-   fat

Food logging fields:

-   food_name
-   calories
-   protein
-   carbs
-   fat

Client dashboard shows:

-   calories remaining
-   macro progress bars
-   macro pie chart

Phase 2 will integrate the USDA FoodData API.

------------------------------------------------------------------------

# 11. Bodyweight Tracking

Users can log bodyweight:

-   daily
-   weekly

Graph displays bodyweight trend.

------------------------------------------------------------------------

# 12. Weekly Check-in System

Clients submit a weekly check-in.

Questions:

-   Bodyweight
-   Workouts completed
-   Energy level (1--5)
-   Hunger level (1--5)
-   Sleep quality (1--5)
-   Stress level (1--5)
-   Nutrition adherence (1--5)
-   What went well?
-   Challenges this week?
-   Anything else?

------------------------------------------------------------------------

# 13. Messaging System

Coach-client messaging supports:

-   text
-   file upload
-   voice notes

Messages are stored per client.

------------------------------------------------------------------------

# 14. Client Onboarding

New clients complete intake questionnaire.

Fields:

-   age
-   height
-   bodyweight
-   goal
-   training experience
-   available training days
-   equipment access
-   diet restrictions
-   activity level
-   sleep hours
-   injuries

------------------------------------------------------------------------

# 15. Client Dashboard

Sections:

-   Today's workout
-   Weekly workout view
-   Calories remaining
-   Macro progress bars
-   Next check-in reminder

------------------------------------------------------------------------

# 16. Coach Dashboard

Sidebar navigation:

-   Clients
-   Programs
-   Exercises
-   Nutrition
-   Check-ins
-   Messages

------------------------------------------------------------------------

# 17. CSV Exercise Import

CSV columns:

-   exercise_name
-   primary_muscle
-   secondary_muscle
-   equipment
-   difficulty
-   video_url
-   instructions

Importer should validate columns and skip duplicates.

------------------------------------------------------------------------

# 18. Database Schema (Core Tables)

-   users
-   roles
-   clients
-   coaches
-   exercises
-   program_templates
-   program_weeks
-   program_days
-   program_exercises
-   program_assignments
-   workout_logs
-   workout_sets
-   nutrition_targets
-   meal_logs
-   bodyweight_logs
-   checkin_forms
-   checkin_responses
-   messages

------------------------------------------------------------------------

# 19. API Endpoints

Authentication

-   POST /auth/login
-   POST /auth/register
-   POST /auth/logout

Exercises

-   GET /exercises
-   POST /exercises
-   POST /exercises/import

Programs

-   GET /programs
-   POST /programs/generate
-   POST /programs/assign

Workouts

-   GET /workouts/today
-   POST /workouts/log
-   POST /workouts/swap

Nutrition

-   GET /nutrition/targets
-   POST /nutrition/log

Check-ins

-   GET /checkins
-   POST /checkins/submit

Messages

-   GET /messages
-   POST /messages/send

------------------------------------------------------------------------

# 20. Tech Stack

Frontend

-   Next.js
-   React
-   TailwindCSS

Backend

-   Supabase
-   PostgreSQL
-   Row Level Security

Hosting

-   Vercel

Charts

-   Chart.js

Video

-   YouTube embeds (unlisted)

------------------------------------------------------------------------

# 21. Security

Supabase Row Level Security will ensure:

Clients can only access their own data.\
Coaches can access assigned clients.

------------------------------------------------------------------------

# 22. Performance Expectations

User base:

≤30 clients

Expected workload:

\~150 workouts logged weekly

System load is minimal.

------------------------------------------------------------------------

# 23. Backup

Database backup:

-   daily automated backup

Data export:

-   CSV export capability

------------------------------------------------------------------------

# 24. Build Order (For Codex)

1.  Authentication
2.  Database schema
3.  Exercise library + CSV importer
4.  Workout templates
5.  Program generator
6.  Client workout logging
7.  Nutrition tracking
8.  Messaging
9.  Check-ins
10. Dashboard analytics

------------------------------------------------------------------------

# 25. Future Opportunities

Potential future expansion:

-   Stripe payments
-   AI workout generator
-   AI check-in summaries
-   wearable integrations
-   habit tracking
-   group challenges
