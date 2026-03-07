export type Role = "admin" | "coach" | "client";

export type Exercise = {
  id: string;
  name: string;
  primary_muscle: string | null;
  secondary_muscle: string | null;
  equipment: string | null;
  difficulty: string | null;
  video_url: string | null;
  instructions: string | null;
};
