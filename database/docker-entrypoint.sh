#!/usr/bin/env bash

PGDATA=${PGDATA:-/var/lib/postgresql/ft_transcendence}
PGLOG=/var/log/postgresql/postgresql.log
PGDATABASE=${PGDATABASE:-"prod"}
CONFIG_FILE=/tmp/postgresql.conf
PGHOST='localhost'

set -e

setup_db() {
	# Check if database is initialized
	if [ -s "$PGDATA/PG_VERSION" ]; then
		return 0
	fi

	gosu postgres pg_ctl init

	# Start PostgreSQL
	gosu postgres pg_ctl -l ${PGLOG} start -s -o "-c config_file=${CONFIG_FILE}"

	# Create role(User) who can create database
	gosu postgres psql -U postgres postgres -c "CREATE ROLE ${PGUSER} NOSUPERUSER NOCREATEROLE LOGIN CREATEDB PASSWORD '${PGPASSWORD}'"

	# Create Database named ${PGDATABASE} owned by ${PGUSER}
	createdb -O ${PGUSER} 
  
  # Create tables and insert data
  psql -f /tmp/init_db.sql

	gosu postgres pg_ctl stop
}

# Setup database
setup_db

if [ "$1" = 'postgres' ]; then
  set -- gosu postgres "$@" -c config_file=${CONFIG_FILE}
fi

exec "$@"
