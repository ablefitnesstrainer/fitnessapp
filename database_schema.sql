-- USERS
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text,
  role text CHECK (role IN ('admin','coach','client')),
  created_at timestamp DEFAULT now()
);

-- CLIENT PROFILE
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  coach_id uuid REFERENCES users(id),
  age integer,
  height integer,
  goal text,
  equipment text,
  created_at timestamp DEFAULT now()
);

-- EXERCISES
CREATE TABLE exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  primary_muscle text,
  secondary_muscle text,
  equipment text,
  difficulty text,
  video_url text,
  instructions text
);

-- PROGRAM TEMPLATES
CREATE TABLE program_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  goal_type text,
  days_per_week integer,
  experience_level text
);

-- PROGRAM WEEKS
CREATE TABLE program_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES program_templates(id),
  week_number integer
);

-- PROGRAM DAYS
CREATE TABLE program_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid REFERENCES program_weeks(id),
  day_number integer
);

-- PROGRAM EXERCISES
CREATE TABLE program_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid REFERENCES program_days(id),
  exercise_id uuid REFERENCES exercises(id),
  sets integer,
  reps integer,
  warmup_sets jsonb
);

-- ASSIGNMENTS
CREATE TABLE program_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  template_id uuid REFERENCES program_templates(id),
  start_week integer
);

-- WORKOUT LOGS
CREATE TABLE workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  day_id uuid,
  completed_at timestamp DEFAULT now()
);

-- WORKOUT SETS
CREATE TABLE workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid REFERENCES workout_logs(id),
  exercise_id uuid,
  set_number integer,
  reps integer,
  weight numeric
);

-- NUTRITION TARGETS
CREATE TABLE nutrition_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  calories integer,
  protein integer,
  carbs integer,
  fat integer
);

-- MEAL LOGS
CREATE TABLE meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  food_name text,
  calories integer,
  protein integer,
  carbs integer,
  fat integer,
  created_at timestamp DEFAULT now()
);

-- BODYWEIGHT
CREATE TABLE bodyweight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  weight numeric,
  created_at timestamp DEFAULT now()
);

-- CHECKINS
CREATE TABLE checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  workouts_completed integer,
  energy integer,
  hunger integer,
  sleep integer,
  stress integer,
  adherence integer,
  notes text,
  created_at timestamp DEFAULT now()
);

-- MESSAGES
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES users(id),
  receiver_id uuid REFERENCES users(id),
  message text,
  created_at timestamp DEFAULT now()
);