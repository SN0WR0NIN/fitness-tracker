alter table "User"
  add column if not exists "clerkUserId" text;

create unique index if not exists "User_clerkUserId_key"
  on "User"("clerkUserId")
  where "clerkUserId" is not null;
