import type { ActivityLevel, JobType, NutritionGoal, Sex, UserProfile } from "@healthy-eating-ai/shared";
import { pool } from "../db/pool.js";
import type { ProfileInput } from "../schemas/profileSchema.js";

interface ProfileRow {
  id: string;
  user_id: string;
  age: number;
  sex: string;
  height_cm: string;
  weight_kg: string;
  activity_level: string;
  job_type: string;
  workouts_per_week: number;
  goal: string;
  created_at: Date;
  updated_at: Date;
}

function mapRowToProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    userId: row.user_id,
    age: row.age,
    sex: row.sex as Sex,
    heightCm: Number(row.height_cm),
    weightKg: Number(row.weight_kg),
    activityLevel: row.activity_level as ActivityLevel,
    jobType: row.job_type as JobType,
    workoutsPerWeek: row.workouts_per_week,
    goal: row.goal as NutritionGoal,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findProfileByUserId(userId: string): Promise<UserProfile | null> {
  const result = await pool.query<ProfileRow>("SELECT * FROM user_profiles WHERE user_id = $1", [userId]);
  const row = result.rows[0];
  return row ? mapRowToProfile(row) : null;
}

export async function insertProfile(userId: string, input: ProfileInput): Promise<UserProfile> {
  const result = await pool.query<ProfileRow>(
    `INSERT INTO user_profiles
       (user_id, age, sex, height_cm, weight_kg, activity_level, job_type, workouts_per_week, goal)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      input.age,
      input.sex,
      input.heightCm,
      input.weightKg,
      input.activityLevel,
      input.jobType,
      input.workoutsPerWeek,
      input.goal,
    ],
  );
  return mapRowToProfile(result.rows[0]);
}

export async function updateProfile(userId: string, input: ProfileInput): Promise<UserProfile> {
  const result = await pool.query<ProfileRow>(
    `UPDATE user_profiles
     SET age = $2,
         sex = $3,
         height_cm = $4,
         weight_kg = $5,
         activity_level = $6,
         job_type = $7,
         workouts_per_week = $8,
         goal = $9,
         updated_at = now()
     WHERE user_id = $1
     RETURNING *`,
    [
      userId,
      input.age,
      input.sex,
      input.heightCm,
      input.weightKg,
      input.activityLevel,
      input.jobType,
      input.workoutsPerWeek,
      input.goal,
    ],
  );
  return mapRowToProfile(result.rows[0]);
}
