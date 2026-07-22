const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { DB_PATH, DATA_DIR } = require('../db/connection');

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = 30;

function runBackup() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `erp-${stamp}.db`);
  fs.copyFileSync(DB_PATH, dest);

  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const old of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, old.f));
  }
  return dest;
}

function scheduleBackups() {
  // Respaldo automatico todos los dias a las 03:00
  cron.schedule('0 3 * * *', () => {
    try {
      const dest = runBackup();
      console.log(`[backup] Respaldo automático creado: ${dest}`);
    } catch (err) {
      console.error('[backup] Error al crear respaldo automático', err);
    }
  });
}

module.exports = { runBackup, scheduleBackups, BACKUP_DIR };
