#!/usr/bin/env bash

PGDATA=${PGDATA:-/var/lib/postgresql/data}
PGLOG=/var/log/postgresql/postgresql.log
PGDATABASE=${PGDATABASE:dev}
CONFIG_FILE=/workspaces/database/configs/postgresql.conf

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
  psql -f /workspaces/backend/test/integration/integration.sql > /dev/null 2>&1

	gosu postgres pg_ctl stop
}

# Setup database
setup_db

# Start PostgreSQL
gosu postgres pg_ctl -l ${PGLOG} start -s -o "-c config_file=${CONFIG_FILE}" 


exec "$@"
