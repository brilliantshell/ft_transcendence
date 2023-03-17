-- SECTION : Create custom types
DO $$ BEGIN 
IF NOT EXISTS (
	SELECT
	FROM pg_type
	WHERE typname = 'channel_access_mode'
) THEN CREATE TYPE channel_access_mode AS ENUM ('public', 'protected', 'private');
END IF;
END $$;

-- SECTION : Users
CREATE TABLE IF NOT EXISTS users (
	user_id int PRIMARY KEY,
	nickname varchar(16) NOT NULL UNIQUE,
	is_default_image boolean NOT NULL DEFAULT true,
	auth_email varchar(320) UNIQUE,
	ladder int NOT NULL DEFAULT 0,
	win_count int NOT NULL DEFAULT 0,
	loss_count int NOT NULL DEFAULT 0,
	CONSTRAINT check_ladder_error CHECK (ladder >= 0),
	CONSTRAINT check_win_count CHECK (win_count >= 0),
	CONSTRAINT check_loss_count CHECK (loss_count >= 0)
);
-- SECTION : Channels
CREATE TABLE IF NOT EXISTS channels (
	channel_id SERIAL PRIMARY KEY,
	owner_id int REFERENCES users(user_id),
	dm_peer_id int REFERENCES users(user_id),
	name varchar(128) NOT NULL,
	member_count int NOT NULL DEFAULT 1,
	access_mode channel_access_mode NOT NULL,
	password bytea,
	modified_at timestamp with time zone NOT NULL,
	CONSTRAINT check_member_count CHECK (member_count > 0)
);
-- SECTION : Achievements
CREATE TABLE IF NOT EXISTS achievements (
	achievement_id SERIAL PRIMARY KEY,
	title varchar(32) NOT NULL UNIQUE,
	about varchar(256) NOT NULL
);

CREATE INDEX IF NOT EXISTS achievements_idx ON achievements(achievement_id, title, about);

-- SECTION : Achievers
CREATE TABLE IF NOT EXISTS achievers (
	user_id int REFERENCES users(user_id),
	achievement_id int REFERENCES achievements(achievement_id),
	PRIMARY KEY(user_id, achievement_id)
);
-- SECTION : Banned members
CREATE TABLE IF NOT EXISTS banned_members (
	channel_id int REFERENCES channels(channel_id),
	member_id int REFERENCES users(user_id),
	end_at timestamp with time zone NOT NULL DEFAULT '-infinity',
	PRIMARY KEY(channel_id, member_id)
);
-- SECTION : Blocked users
CREATE TABLE IF NOT EXISTS blocked_users (
	blocker_id int REFERENCES users(user_id),
	blocked_id int REFERENCES users(user_id),
	PRIMARY KEY(blocker_id, blocked_id)
);
-- SECTION : Channel members
CREATE TABLE IF NOT EXISTS channel_members (
	channel_id int REFERENCES channels(channel_id),
	member_id int REFERENCES users(user_id),
	is_admin bool NOT NULL DEFAULT false,
	mute_end_at timestamp with time zone NOT NULL,
	viewed_at timestamp with time zone NOT NULL,
	PRIMARY KEY(channel_id, member_id)
);
-- SECTION: Friends
CREATE TABLE IF NOT EXISTS friends (
	sender_id int REFERENCES users(user_id),
	receiver_id int REFERENCES users(user_id),
	is_accepted bool NOT NULL DEFAULT false,
	PRIMARY KEY(sender_id, receiver_id)
);
-- SECTION: Match history
CREATE TABLE IF NOT EXISTS match_history (
	match_id SERIAL PRIMARY KEY,
	user_one_id int REFERENCES users(user_id),
	user_two_id int REFERENCES users(user_id),
	user_one_score int NOT NULL DEFAULT 0,
	user_two_score int NOT NULL DEFAULT 0,
	is_rank boolean NOT NULL DEFAULT false,
	end_at timestamp with time zone NOT NULL ,
	CONSTRAINT check_user_one_score CHECK (user_one_score >= 0),
	CONSTRAINT check_user_two_score CHECK (user_two_score >= 0)
);
-- SECTION : Messages
CREATE TABLE IF NOT EXISTS messages (
	message_id SERIAL PRIMARY KEY,
	channel_id int REFERENCES channels(channel_id),
	sender_id int REFERENCES users(user_id),
	contents varchar(4096) NOT NULL,
	created_at timestamp with time zone NOT NULL
);

COPY public.achievements (achievement_id, title, about) FROM stdin;
1	one giant leap for mankind.	누군가에겐 미약해 보일 수 있지만, 분명히 그것은 위대한 첫 걸음 입니다. 당신은 처음으로 승리하였습니다.
2	World Best Ping-Pong Player	초월적인 온라인 탁구 게임에서 1등을 거머쥐었습니다!
3	Social Animal	무려 10명의 친구! 아리스토텔레스가 당신을 부러워합니다.
4	 Born To Be FT	삶, 우주, 그리고 모든 것에 대한 궁극적인 질문에 대한 해답은 바로 당신!
5	So noisy~ 	Join 5 channels
\.
