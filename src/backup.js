
const fs = require('fs');
const { path7za } = require('7zip-bin');
const _7zip = require('node-7z');
const path = require('path');

const to = require('./helper/Tools.js');
const config = require('./config.js');
const _global = require('./global.js');
const { writeLog, getFileHash } = require('./utilities.js');

/**
 * @param {string[]} filePaths
 * @returns {Promise<string|null>} backup file path
 */
async function createBackup(filePaths){
   if(!config.doBackup){
      writeLog('backup disabled, backup skipped');
      return null;
   }

   return new Promise(async (resolve, reject) => {
      try {
         if(!fs.existsSync(config.backupFolder)){
            fs.mkdirSync(config.backupFolder, { recursive: true });
         }

         filePaths = filePaths.map(file => {
            if(file.startsWith('.')){
               file = path.resolve(config.gameInstalledPath, file);
            }
            return path.normalize(file);
         });

         const backedUpFiles = getBackupList();
         const changedFiles = await changedFilesSinceThisBackup(backedUpFiles[0], filePaths);

         if(changedFiles.length == 0){
            writeLog('no changes detected, backup skipped');
            return resolve(null);
         }

         writeLog(`file(s) with changes since last backup: ${to.yuString(changedFiles)}`, 4);

         if(backedUpFiles.length > 0){
            writeLog(`last backup: ${backedUpFiles[0]}`, 4);
            const lastBackup = resolveBackupTimestamp(backedUpFiles[0]);
            if(lastBackup && (Date.now() - lastBackup.valueOf()) < 1000*60*15){
               writeLog('last backup too new, backup skipped');
               return resolve(null); // if the last backup is less than 15 minutes ago
            }
         }

         if(backedUpFiles.length >= config.maxBackup){
            const oldestBackup = backedUpFiles.at(-1);
            fs.rmSync(path.join(config.backupFolder, oldestBackup));
         }


         let backupFilePaths = filePaths;
         const currentDateTime = (new Date()).toISOString().replace(/:/g, '+');
         const backupPath = path.join(config.backupFolder, `BACKUP_${currentDateTime}@${_global.version}.zip`);

         backupFilePaths = await createBackupTemp(
            [...(new Set(backupFilePaths))], // remove duplicates
            changedFiles
         );

         writeLog(
            `creating backup zip at: ${backupPath}\nzip contents: ${to.arrToString(backupFilePaths)}`,
            4
         );

         const _7stream = _7zip.add(backupPath, backupFilePaths, {
            $bin: path7za
         });

         _7stream.on('end', () => {
            return resolve(backupPath);
         });
      }
      catch(err){
         writeLog(`backup failed: ${to.yuString(err)}`, 1);
         return resolve(null);
      }
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
      .sort((a, b) => b.localeCompare(a)); // file name is designed to be alphabetically sorted by date
}


/**
 * clear temporary folder for backup
 * @param {string} tempFolder temporary folder path
 */
function clearTempFolder(tempFolder){
   if(fs.existsSync(tempFolder)){
      const files = fs.readdirSync(tempFolder);
      for(const file of files){
         fs.rmSync(path.join(tempFolder, file));
      }
   }
}

/**
 * prepare temporary folder for backup
 * @param {string} tempFolder temporary folder path
 */
function prepTempFolder(tempFolder){
   if(!fs.existsSync(tempFolder)){
      fs.mkdirSync(tempFolder, { recursive: true });
   }
   else clearTempFolder(tempFolder);
}

/**
 * @param {string} backupFileName path to the backup (zip) file
 * @param {string[]} filesToCompare list of files to compare with the backup
 * @returns {Promise<string[]>} list of files that have changed since the backup
 */
async function changedFilesSinceThisBackup(backupFileName, filesToCompare){
   writeLog(`checking changes since backup: ${backupFileName}`, 3);
   if(!backupFileName) return filesToCompare;

   const backupPath = path.join(config.backupFolder, backupFileName);
   const tempFolder = path.join(_global.deviceTempFolder, 'wuwa_editor/backup/');
   const filesWithChanges = [];

   if(!fs.existsSync(backupPath)) return filesToCompare;
   try{
      prepTempFolder(tempFolder);

      const _7stream = _7zip.extract(backupPath, tempFolder, {
         $bin: path7za
      });

      return new Promise((resolve, reject) => {
         _7stream.on('end', async () => {
            const manifestPath = path.join(tempFolder, 'manifest.json');

            if(!fs.existsSync(manifestPath)){
               writeLog('Backup invalid: manifest not found', 1);
               return resolve(filesToCompare);
            }
            const manifest = JSON.parse(fs.readFileSync(manifestPath, { encoding: 'utf-8' }));

            try {
               if(manifest._hashes){
                  const specifiedHashAlgorithm = manifest._algorithm || config.fileDiffHash;

                  for(const file in manifest._hashes){
                     if(file.startsWith('_')) continue; // skip other properties (that's not a file)
                     const srcFullPath = manifest[file];

                     const srcHash = await getFileHash(srcFullPath, specifiedHashAlgorithm);
                     if(srcHash !== manifest._hashes[file]) filesWithChanges.push(srcFullPath);
                  }

                  return resolve(filesWithChanges);
               }

               for(const file in manifest){
                  if(file.startsWith('_')) continue; // skip other properties (that's not a file)
                  const srcFullPath = manifest[file];
                  const backedPath = path.join(tempFolder, file);

                  const srcHash = await getFileHash(srcFullPath);
                  const backedHash = await getFileHash(backedPath);
                  if(srcHash !== backedHash) filesWithChanges.push(srcFullPath);
               }

               return resolve(filesWithChanges);
            }
            catch(err){
               writeLog(`file diff check failed: hash comparison failed: ${to.yuString(err)}`, 1);
               return resolve(filesToCompare);
            }
         });
      });
   }
   catch(err){
      writeLog(`file diff check failed: preperation failed ${to.yuString(err)}`, 1);
      return filesToCompare;
   }
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
      prepTempFolder(tempFolder);

      const _7stream = _7zip.extract(backupPath, tempFolder, {
         $bin: path7za
      });

      return new Promise((resolve, reject) => {
         _7stream.on('end', () => {
            const manifestPath = path.join(tempFolder, 'manifest.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, { encoding: 'utf-8' }));

            try {
               for(const file in manifest){
                  if(file.startsWith('_')) continue; // skip other properties (that's not a file)
                  const destFullPath = manifest[file];
                  const backedFullPath = path.join(tempFolder, file);

                  if(!fs.existsSync(backedFullPath)) continue;

                  writeLog(`restoring: "${backedFullPath}" -> "${destFullPath}"`, 4);

                  const srcContent = fs.readFileSync(backedFullPath);
                  fs.writeFileSync(destFullPath, srcContent);
               }

               resolve(true);
            }
            catch(err){
               writeLog(`restore failed: failed to write file: ${to.yuString(err)}`, 1);
               resolve(false);
            }
         });
      });
   }
   catch(err){
      writeLog(`restore failed: preperation failed ${to.yuString(err)}`, 1);
      return false;
   }
}

/**
 * create temporary folder to create zip from
 * @param {string[]} srcFilePaths
 * @param {string[]} changedFiles paths of files that have changed since the last backup
 * @returns {string[]} list of files in the temporary folder that need to be zipped as backup
 */
async function createBackupTemp(srcFilePaths, changedFiles){
   const tempFolder = path.join(_global.deviceTempFolder, 'wuwa_editor/backup/');
   const manifestPath = path.join(tempFolder, 'manifest.json');
   const filesInTemp = [];
   let manifest = {
      _hashes: {},
      _algorithm: config.fileDiffHash
   };
   let allID = [];

   try {
      prepTempFolder(tempFolder);

      for(let i = 0; i < srcFilePaths.length; i++){
         const srcFile = srcFilePaths[i];
         const id = to.IDGenerator(allID, 'NNNNNN');
         allID.push(id);

         const backedFileName = id + '_' + path.basename(srcFile);
         manifest[backedFileName] = srcFile; // save original file path along with the copied filename
         manifest._hashes[backedFileName] = await getFileHash(srcFile);

         if(changedFiles.includes(srcFile)){
            filesInTemp.push(path.join(tempFolder, backedFileName)); // copied file path in temp folder
            fs.copyFileSync(srcFile, filesInTemp.at(-1));
         }
      }

      filesInTemp.push(manifestPath);

      fs.writeFileSync(
         manifestPath,
         JSON.stringify(manifest, null, 3),
         { encoding: 'utf-8' }
      );
   }catch(err){
      writeLog(err, 1);
   }

   return filesInTemp;
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
   if(isNaN(utcDate.valueOf())) return null;

   return to.changeDateTimezone(utcDate, _global.deviceTimezone);
}


module.exports = {
   createBackup,
   getBackupList,
   restoreBackup,
   resolveBackupTimestamp
}