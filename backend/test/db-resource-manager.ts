import { DataSource } from 'typeorm';

export const TYPEORM_SHARED_CONFIG = {
  host: 'localhost',
  port: 5432,
  username: 'test_user',
  password: 'test_password',
  synchronize: true,
};

export const createDataSources = async (TEST_DB: string, ENTITIES: any[]) => {
  const initDataSource = await new DataSource({
    type: 'postgres',
    ...TYPEORM_SHARED_CONFIG,
    database: 'test_db',
  }).initialize();

  await initDataSource.createQueryRunner().createDatabase(TEST_DB, true);
  const dataSource = await new DataSource({
    type: 'postgres',
    ...TYPEORM_SHARED_CONFIG,
    database: TEST_DB,
    entities: ENTITIES,
  }).initialize();
  return { initDataSource, dataSource };
};

export const destroyDataSources = async (
  TEST_DB: string,
  dataSource: DataSource,
  initDataSource: DataSource,
) => {
  dataSource.destroy();
  initDataSource.createQueryRunner().dropDatabase(TEST_DB);
  initDataSource.destroy();
};
