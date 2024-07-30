const { readFileSync, existsSync, writeFileSync } = require('fs');
const { parseBool, parseConfig, writeConfig } = require('./helper/Tools.js');


const CONFIG_PATH = './config.conf';
const DEFAULT_CONFIG = `
###################   wuwa-editor Configuration   ###################
# each setting is defined by pair (key) = (value)

# Game instalation path
# this folder should contain GameFolder (e.g. "Wuthering Waves Game") and launcher.exe
gameInstalledPath = 'C:\\Program Files\\Wuthering Waves'
gameClientName = 'Client-Win64-Shipping.exe'

`;

class Config {
   /// Log
   /**control which message should be shown in the console
    * debug: 4, normal: 3, error: 2, critical: 1
    * @type {number}
    */
   // DEBUGLEVEL = 4;
   /**
    * @type {string}
    */
   gameInstalledPath = null;
   gameClientName = 'Client-Win64-Shipping.exe';
   patchJSONLocation = './patch.json';
   backupFolder = './backup';
   maxBackup = 5;
   doBackup = false;

   logFilePath = './wuwa-editor.log';
   logFileMaxSize = 1024 * 1024 * 5; // 5MB


   constructor(){
      this.loadConfig();
   }

   loadConfig(){
      let CONFIG;
      if(!existsSync(CONFIG_PATH)){
         try{
            writeFileSync(CONFIG_PATH, DEFAULT_CONFIG, { encoding: 'utf-8' });
         }catch{}
         return;
      }

      CONFIG = parseConfig(readFileSync(CONFIG_PATH, { encoding:'utf-8' }));

      if(!CONFIG){
         return;
      }


      if(CONFIG.gameInstalledPath) this.gameInstalledPath = CONFIG.gameInstalledPath;
      if(CONFIG.gameClientName) this.gameClientName = CONFIG.gameClientName;
      if(CONFIG.patchJSONLocation) this.patchJSONLocation = CONFIG.patchJSONLocation;
      if(CONFIG.backupFolder) this.backupFolder = CONFIG.backupFolder;
      if(CONFIG.maxBackup) this.maxBackup = parseInt(CONFIG.maxBackup);
      if(CONFIG.doBackup) this.doBackup = parseBool(CONFIG.doBackup);

      // System Settings
      // if(CONFIG.DEBUGLEVEL) this.DEBUGLEVEL = parseInt(CONFIG.DEBUGLEVEL);
   }

   writeConfig(){
      writeConfig(this, CONFIG_PATH, {
         ignoreList: ['loadConfig', 'writeConfig', 'DEBUGLEVEL', 'logFilePath']
      });
   }
}



if(!(module.exports instanceof Config)) module.exports = new Config;