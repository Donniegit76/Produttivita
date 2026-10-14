import { createApp } from './app';

const { app, config, close } = createApp();

const server = app.listen(config.port, () => {
  console.log('=======================================================');
  console.log(`  Fast_Prod 3.0 in ascolto sulla porta ${config.port}`);
  console.log(`  Database SQLite: ${config.dbPath}`);
  console.log(`  Backup automatici in: ${config.dataDir}/backups`);
  console.log('=======================================================');
});

function shutdown(signal: string): void {
  console.log(`\nRicevuto ${signal}, arresto in corso...`);
  server.close(() => {
    close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
