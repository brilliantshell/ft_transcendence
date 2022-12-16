#!/usr/bin/env bash

PGDATA=${PGDATA:-/var/lib/postgresql/data}
PGLOG=/var/log/postgresql/postgresql.log
PGDATABASE=${PGDATABASE:dev}

setup_db() {
	# Check if database is initialized
	if [ -s "$PGDATA/PG_VERSION" ]; then
		return 0
	fi
	gosu postgres pg_ctl init
	
	# Copy configuration files
	cp /tmp/pg_hba.conf ${PGDATA}/pg_hba.conf
	cp /tmp/postgresql.conf ${PGDATA}/postgresql.conf

	# Start PostgreSQL
	gosu postgres pg_ctl start

	# Create role(User) who can create database
	gosu postgres psql -U postgres postgres -c "CREATE ROLE ${PGUSER} NOSUPERUSER NOCREATEROLE LOGIN CREATEDB PASSWORD '${PGPASSWORD}'"

	# Create Database named ${PGDATABASE} owned by ${PGUSER}
	createdb -O ${PGUSER} 

	gosu postgres pg_ctl stop
}

# Setup database
setup_db

# Start PostgreSQL
gosu postgres pg_ctl -l ${PGLOG} start

exec "$@"
