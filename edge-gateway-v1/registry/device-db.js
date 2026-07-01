const Database = require("better-sqlite3");

const db = new Database("devices.db");

// initialize schema
db.exec(`
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  type TEXT,
  name TEXT,
  status TEXT,
  last_seen TEXT
);
`);

// REGISTER / UPDATE DEVICE
function registerDevice(device) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO devices (id, type, name, status, last_seen)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    device.id,
    device.type || "unknown",
    device.name || "unnamed",
    device.status || "active",
    device.last_seen || new Date().toISOString()
  );
}

// GET ONE DEVICE
function getDevice(id) {
  return db.prepare(`SELECT * FROM devices WHERE id = ?`).get(id);
}

// LIST ALL DEVICES
function listDevices() {
  return db.prepare(`SELECT * FROM devices`).all();
}

// DELETE DEVICE
function deleteDevice(id) {
  return db.prepare(`DELETE FROM devices WHERE id = ?`).run(id);
}

module.exports = {
  registerDevice,
  getDevice,
  listDevices,
  deleteDevice
};
