import { z } from 'zod';
import { prisma } from '@/lib/prisma';
export const NotificationPreferencesSchema=z.object({activity_reviews:z.boolean(),correction_updates:z.boolean(),achievements:z.boolean(),weekly_results:z.boolean(),goal_reminders:z.boolean()}).strict();
export type NotificationPreferences=z.infer<typeof NotificationPreferencesSchema>;
export const DEFAULT_NOTIFICATION_PREFERENCES:NotificationPreferences={activity_reviews:true,correction_updates:true,achievements:true,weekly_results:true,goal_reminders:true};
export async function getNotificationPreferences(userId:string):Promise<NotificationPreferences>{
  const rows=await prisma.$queryRaw<NotificationPreferences[]>`SELECT activity_reviews,correction_updates,achievements,weekly_results,goal_reminders FROM app_internal.notification_preference WHERE user_id=${userId}`;
  return rows[0] ?? {...DEFAULT_NOTIFICATION_PREFERENCES};
}
export async function saveNotificationPreferences(userId:string,data:NotificationPreferences){
  await prisma.$executeRaw`INSERT INTO app_internal.notification_preference(user_id,activity_reviews,correction_updates,achievements,weekly_results,goal_reminders)
    VALUES(${userId},${data.activity_reviews},${data.correction_updates},${data.achievements},${data.weekly_results},${data.goal_reminders})
    ON CONFLICT(user_id) DO UPDATE SET activity_reviews=excluded.activity_reviews,correction_updates=excluded.correction_updates,achievements=excluded.achievements,weekly_results=excluded.weekly_results,goal_reminders=excluded.goal_reminders,updated_at=now()`;
  return data;
}
