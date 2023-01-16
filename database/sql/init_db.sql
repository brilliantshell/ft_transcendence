-- SECTION : Create custom types
DO $$ BEGIN 
IF NOT EXISTS (
	SELECT
	FROM pg_type
	WHERE typname = 'channel_access_mode'
) THEN CREATE TYPE channel_access_mode AS ENUM ('public', 'protected', 'private');
END IF;
END $$;
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
-- SECTION : Banned members
CREATE TABLE IF NOT EXISTS banned_members (
	channel_id int REFERENCES channels(channel_id),
	member_id int REFERENCES users(user_id),
	end_time timestamp with time zone NOT NULL DEFAULT '-infinity',
	PRIMARY KEY(channel_id, member_id)
);
-- SECTION : Blocked users
CREATE TABLE IF NOT EXISTS blocked_users (
	blocker_id int REFERENCES users(user_id),
	blocked_id int REFERENCES users(user_id),
	PRIMARY KEY(blocker_id, blocked_user_id)
);
-- SECTION : Channel members
CREATE TABLE IF NOT EXISTS channel_members (
	channel_id int REFERENCES channels(channel_id),
	member_id int REFERENCES users(user_id),
	is_admin bool NOT NULL DEFAULT false,
	mute_end_time timestamp with time zone NOT NULL DEFAULT '-infinity',
	viewed_at timestamp with time zone NOT NULL DEFAULT current_timestamp,
	PRIMARY KEY(channel_id, member_id)
);
-- SECTION : Channels
CREATE TABLE IF NOT EXISTS channels (
	channel_id SERIAL PRIMARY KEY,
	owner_id int REFERENCES users(user_id),
	dm_peer_id int REFERENCES users(user_id),
	channel_name varchar(128) NOT NULL,
	member_cnt int NOT NULL,
	access_mode channel_access_mode NOT NULL,
	passwd bytea,
	modified_at timestamp with time zone NOT NULL DEFAULT current_timestamp,
	CONSTRAINT check_member_cnt CHECK (member_cnt > 0)
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
	end_at timestamp with time zone NOT NULL DEFAULT current_timestamp,
	CONSTRAINT check_user_one_score CHECK (user_one_score >= 0),
	CONSTRAINT check_user_two_score CHECK (user_two_score >= 0)
);
-- SECTION : Messages
CREATE TABLE IF NOT EXISTS messages (
	message_id SERIAL PRIMARY KEY,
	channel_id int REFERENCES channels(channel_id),
	sender_id int REFERENCES users(user_id),
	contents varchar(4096) NOT NULL,
	created_at timestamp with time zone NOT NULL DEFAULT current_timestamp
);
-- SECTION : Users
CREATE TABLE IF NOT EXISTS users (
	user_id int PRIMARY KEY,
	nickname varchar(16) NOT NULL UNIQUE,
	profile_image varchar(256) NOT NULL,
	auth_email varchar(320) UNIQUE,
	ladder int NOT NULL DEFAULT 0,
	win_cnt int NOT NULL DEFAULT 0,
	loss_cnt int NOT NULL DEFAULT 0,
	CONSTRAINT check_ladder_error CHECK (ladder >= 0),
	CONSTRAINT check_win_cnt CHECK (win_cnt >= 0),
	CONSTRAINT check_loss_cnt CHECK (loss_cnt >= 0)
);




