-- SECTION : Create custom types
DO $$ BEGIN IF NOT EXISTS (
	SELECT
	FROM pg_type
	WHERE typname = 'user_activity'
) THEN CREATE TYPE user_activity AS ENUM ('offline', 'online', 'in game');
END IF;
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
	profile_image varchar(256) NOT NULL,
	activity user_activity NOT NULL DEFAULT 'offline',
	auth_email varchar(320),
	ladder int NOT NULL DEFAULT 0,
	win_cnt int NOT NULL DEFAULT 0,
	loss_cnt int NOT NULL DEFAULT 0
);
-- SECTION : Blocked users
CREATE TABLE IF NOT EXISTS blocked_users (
	blocker_id int REFERENCES users(user_id),
	blocked_user_id int REFERENCES users(user_id),
	PRIMARY KEY(blocker_id, blocked_user_id)
);
-- SECTION: Friends
CREATE TABLE IF NOT EXISTS friends (
	user_one_id int REFERENCES users(user_id),
	user_two_id int REFERENCES users(user_id),
	PRIMARY KEY(user_one_id, user_two_id)
);
-- SECTION: Match history
CREATE TABLE IF NOT EXISTS match_history (
	match_id SERIAL PRIMARY KEY,
	user_one int REFERENCES users(user_id),
	user_two int REFERENCES users(user_id),
	user_one_score int NOT NULL DEFAULT 0,
	user_two_score int NOT NULL DEFAULT 0,
	is_rank boolean NOT NULL DEFAULT false,
	end_at timestamp NOT NULL DEFAULT current_timestamp
);
-- SECTION : Channels
CREATE TABLE IF NOT EXISTS channels (
	channel_id SERIAL PRIMARY KEY,
	owner_id int REFERENCES users(user_id),
	channel_name varchar(128) NOT NULL,
	is_dm boolean NOT NULL,
	member_cnt int NOT NULL,
	access_mode channel_access_mode NOT NULL,
	passwd varchar(16)
);
-- SECTION : Channel members
CREATE TABLE IF NOT EXISTS channel_members (
	channel_id int REFERENCES channels(channel_id),
	member_id int REFERENCES users(user_id),
	is_admin bool NOT NULL DEFAULT false,
	mute_end_time timestamp NOT NULL DEFAULT '1970-01-01 00:00:00',
	PRIMARY KEY(channel_id, member_id)
);
-- SECTION : Banned members
CREATE TABLE IF NOT EXISTS banned_members (
	channel_id int REFERENCES channels(channel_id),
	member_id int REFERENCES users(user_id),
	ban_end_time timestamp NOT NULL DEFAULT '1970-01-01 00:00:00',
	PRIMARY KEY(channel_id, member_id)
);
-- SECTION : Messages
CREATE TABLE IF NOT EXISTS messages (
	message_id SERIAL PRIMARY KEY,
	channel_id int REFERENCES channels(channel_id),
	sender_id int REFERENCES users(user_id),
	contents varchar(4096) NOT NULL,
	created_at timestamp NOT NULL
);
-- SECTION : Achievements
CREATE TABLE IF NOT EXISTS achievements (
	achievement_id SERIAL PRIMARY KEY,
	title varchar(32) NOT NULL UNIQUE,
	about varchar(256) NOT NULL,
	image_path varchar(256) NOT NULL
);
-- SECTION : Achievers
CREATE TABLE IF NOT EXISTS achievers (
	user_id int REFERENCES users(user_id),
	achievement_id int REFERENCES achievements(achievement_id),
	PRIMARY KEY(user_id, achievement_id)
);