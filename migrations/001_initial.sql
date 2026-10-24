CREATE TABLE "user" (
  id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false, image text,
  "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL
);
CREATE TABLE session (
  id text PRIMARY KEY, "expiresAt" timestamptz NOT NULL, token text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL,
  "ipAddress" text, "userAgent" text,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX session_user_id ON session("userId");
CREATE TABLE account (
  id text PRIMARY KEY, "accountId" text NOT NULL, "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" text, "refreshToken" text, "idToken" text,
  "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz,
  scope text, password text, "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL
);
CREATE INDEX account_user_id ON account("userId");
CREATE UNIQUE INDEX account_provider_id ON account("providerId", "accountId");
CREATE TABLE verification (
  id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL,
  "expiresAt" timestamptz NOT NULL, "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL
);
CREATE INDEX verification_identifier ON verification(identifier);
CREATE TABLE "rateLimit" (
  id text PRIMARY KEY, key text NOT NULL UNIQUE, count integer NOT NULL, "lastRequest" bigint NOT NULL
);
CREATE TABLE meals (
  id text PRIMARY KEY, owner text NOT NULL REFERENCES "user"(id), title text NOT NULL,
  note text NOT NULL DEFAULT '', kind text NOT NULL, emoji text NOT NULL DEFAULT '🍚',
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  eaten_at text NOT NULL, created_at bigint NOT NULL,
  withdrawn integer NOT NULL DEFAULT 0 CHECK (withdrawn IN (0,1))
);
CREATE INDEX meals_owner_time ON meals(owner,created_at);
CREATE INDEX meals_feed ON meals(visibility,withdrawn,created_at);
CREATE TABLE votes (
  meal_id text NOT NULL REFERENCES meals(id), user_id text NOT NULL REFERENCES "user"(id),
  value integer NOT NULL CHECK (value IN (-1,1)), reason text NOT NULL DEFAULT '',
  created_at bigint NOT NULL, PRIMARY KEY(meal_id,user_id)
);
CREATE INDEX votes_user_id ON votes(user_id);
CREATE TABLE likes (
  meal_id text NOT NULL REFERENCES meals(id), user_id text NOT NULL REFERENCES "user"(id),
  PRIMARY KEY(meal_id,user_id)
);
CREATE TABLE settings (
  user_id text PRIMARY KEY REFERENCES "user"(id), breakfast text NOT NULL DEFAULT '08:30',
  lunch text NOT NULL DEFAULT '12:30', dinner text NOT NULL DEFAULT '18:30',
  enabled integer NOT NULL DEFAULT 0 CHECK (enabled IN (0,1))
);
