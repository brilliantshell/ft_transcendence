# NOTE : A Dockerfile is for DATABASE PRODUCTION environment
FROM postgres:15.1-bullseye

# Set locales, timezone & Install oh-my-bash
RUN echo "en_US.UTF-8 UTF-8\nko_KR.UTF-8 UTF-8" >> /etc/locale.gen \
	&& locale-gen \
	&& ln -sf /usr/share/zoneinfo/Asia/Seoul /etc/localtime

COPY  --chown=postgres:postgres ./docker-entrypoint.sh /tmp/entrypoint.sh

RUN chmod +x /tmp/entrypoint.sh

COPY --chown=postgres:postgres ./configs/postgresql.conf /tmp/postgresql.conf
COPY --chown=postgres:postgres ./configs/pg_hba.conf /tmp/pg_hba.conf
COPY --chown=postgres:postgres ./sql/init_db.sql /tmp/init_db.sql

ENTRYPOINT [ "/tmp/entrypoint.sh" ]

CMD [ "postgres" ]

HEALTHCHECK --interval=5s --start-period=10s --retries=5 CMD pg_isready -d prod || exit 1
