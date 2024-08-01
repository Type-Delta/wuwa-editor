
const fs = require('fs');
const { path7za } = require('7zip-bin');
const _7zip = require('node-7z');
const path = require('path');

const to = require('./helper/Tools.js');
const config = require('./config.js');
const _global = require('./global.js');
const { writeLog } = require('./utilities.js');

/**
 * @param {string[]} filePaths
 * @returns {Promise<string|null>} backup file path
 */
async function createBackup(filePaths){
   if(!config.doBackup){
      writeLog('backup disabled, backup skipped');
      return null;
   }

   return new Promise((resolve, reject) => {
      if(!fs.existsSync(config.backupFolder)){
         fs.mkdirSync(config.backupFolder, { recursive: true });
      }

      const backedUpFiles = getBackupList();

      if(backedUpFiles.length > 0){
         writeLog(`last backup: ${backedUpFiles[0]}`, 4);
         const lastBackup = resolveBackupTimestamp(backedUpFiles[0]);
         if(lastBackup && (new Date() - lastBackup) < 1000*60*15){
            resolve(null); // if the last backup is less than 15 minutes ago
         }
      }

      if(backedUpFiles.length >= config.maxBackup){
         const oldestBackup = backedUpFiles.at(-1);
         fs.rmSync(path.join(config.backupFolder, oldestBackup));
      }


      let backupFilePaths = filePaths.map(file => {
         if(file.startsWith('.')){
            file = path.resolve(config.gameInstalledPath, file);
         }
         return file;
      });



      const currentDateTime = (new Date()).toISOString().replace(/:/g, '+');
      const backupPath = path.join(config.backupFolder, `BACKUP_${currentDateTime}@${_global.version}.zip`);

      backupFilePaths = createBackupTemp(
         [...(new Set(backupFilePaths))] // remove duplicates
      );

      const _7stream = _7zip.add(backupPath, backupFilePaths, {
         $bin: path7za
      });

      _7stream.on('end', () => {
         resolve(backupPath);
      });
   });
}

/**
 * get list of backup files names sorted by date from newest to oldest
 * @returns {string[]}
 */
function getBackupList(){
   if(!fs.existsSync(config.backupFolder)) return [];

   return fs.readdirSync(config.backupFolder, { withFileTypes: true })
      .filter(file => file.isFile()&&file.name.startsWith('BACKUP_'))
      .map(file => file.name)
      .sort((a, b) => a - b) // file name is designed to be alphabetically sorted by date
      .reverse(); // ^ changing this to b - a won't do anything apparently
}


/**
 * restore backup file
 * @param {string} filename
 * @returns {Promise<boolean>} whether the restore was successful
 */
async function restoreBackup(filename){
   const backupPath = path.join(config.backupFolder, filename);
   const tempFolder = path.join(_global.deviceTempFolder, 'wuwa_editor/backup/');

   if(!fs.existsSync(backupPath)) return false;
   try{
      if(!fs.existsSync(tempFolder)){
         fs.mkdirSync(tempFolder, { recursive: true });
      }
      else {
         const oldFiles = fs.readdirSync(tempFolder);
         for(const file of oldFiles){
            fs.rmSync(path.join(tempFolder, file));
         }
      }

      const _7stream = _7zip.extract(backupPath, tempFolder, {
         $bin: path7za
      });

      return new Promise((resolve, reject) => {
         _7stream.on('end', () => {
            const manifestPath = path.join(tempFolder, 'manifest.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, { encoding: 'utf-8' }));

            try {
               for(const file in manifest){
                  const destFullPath = manifest[file];
                  const srcFullPath = path.join(tempFolder, file);

                  writeLog(`restoring: "${srcFullPath}" -> "${destFullPath}"`, 4);

                  const srcContent = fs.readFileSync(srcFullPath);
                  fs.writeFileSync(destFullPath, srcContent);
               }

               resolve(true);
            }
            catch(err){
               writeLog(`restore failed: failed to write file: ${err.stack}`, 1);
               resolve(false);
            }
         });
      });
   }
   catch(err){
      writeLog(`restore failed: preperation failed ${err.stack}`, 1);
      return false;
   }
}

/**
 * create temporary folder to create zip from
 * @param {string[]} filePaths
 */
function createBackupTemp(filePaths){
   const tempFolder = path.join(_global.deviceTempFolder, 'wuwa_editor/backup/');
   const manifestPath = path.join(tempFolder, 'manifest.json');
   let manifest = {};
   let allID = [];

   try{
      if(!fs.existsSync(tempFolder)){
         fs.mkdirSync(tempFolder, { recursive: true });
      }
      else {
         const oldFiles = fs.readdirSync(tempFolder);
         for(const file of oldFiles){
            fs.rmSync(path.join(tempFolder, file));
         }
      }

      for(let i = 0; i < filePaths.length; i++){
         const file = filePaths[i];
         const id = to.IDGenerator(allID, 'NNNNNN');
         allID.push(id);

         const fileName = id + '_' + path.basename(file);
         manifest[fileName] = file; // save original file path along with the copied filename
         filePaths[i] = path.join(tempFolder, fileName); // copied file path in temp folder

         fs.copyFileSync(file, filePaths[i]);
      }

      filePaths.push(manifestPath);

      fs.writeFileSync(
         manifestPath,
         JSON.stringify(manifest, null, 3),
         { encoding: 'utf-8' }
      );
   }catch(err){
      writeLog(err, 1);
   }

   return filePaths;
}

/**
 * get the timestamp of the backup file as Date object
 * @param {string} backupFileName
 * @returns {Date|null}
 */
function resolveBackupTimestamp(backupFileName){ // BACKUP_2024-07-21T03+14+36.709Z@1.0.0.zip
   const dateStr = backupFileName.slice( // 2024-07-21T03+14+36.709Z
      backupFileName.indexOf('_') + 1, backupFileName.indexOf('@')
   ).replace(/\+/g, ':'); // 2024-07-21T03:14:36

   const utcDate = new Date(dateStr);
   if(isNaN(utcDate)) return null;

   return to.changeDateTimezone(utcDate, _global.deviceTimezone);
}


module.exports = {
   createBackup,
   getBackupList,
   restoreBackup,
   resolveBackupTimestamp
}