const path = require('path');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const { writeLog } = require('./utilities.js');
const config = require('./config.js');

class SQLiteDBWrapper {
   /**
    * @type {sqlite3.Database}
    */
   session = null;
   constructor(session) {
      this.session = session;
   }

   all(...args) {
      writeLog(`Executing SQL: \`${args[0]}\``, args[0].startsWith('SELECT') ? 4 : 3);
      return this.session.all(...args);
   }

   close(cb = null) {
      writeLog('Closing SQLite database', 4);
      return cb? this.session.close(cb) : this.session.close();
   }
}


const sqlite = {
   /**
    * Open a SQLite database
    * @param {string} dbPath - The path to the database file
    * @returns {Promise<SQLiteDBWrapper>} - A promise that resolves to the opened database
    */
   async open(dbPath) {
      if(dbPath.startsWith('.'))
         dbPath = path.resolve(config.gameInstalledPath, dbPath);

      return new SQLiteDBWrapper(await open({
         filename: dbPath,
         driver: sqlite3.Database
      }));
   }
}


module.exports = {
   sqlite
}