const { readFileSync, existsSync, writeFileSync } = require('fs');
const { stringifyConfig, parseConfig, writeConfig } = require('./helper/Tools.js');


const CONFIG_PATH = './config.ini';
const writeConfigOptions = {
   ignoreList: ['loadConfig', 'writeConfig', 'logFilePath', 'backupFolder']
};
const DEFAULT_CONFIG = `
###################   wuwa-editor Configuration   ###################
# each setting is defined by pair (key) = (value)

# Game instalation path
# this folder should contain GameFolder (e.g. "Wuthering Waves Game") and launcher.exe
`;


class Config {
   /**
    * @type {string}
    */
   gameInstalledPath = null;
   gameClientName = 'Client-Win64-Shipping.exe';
   getInstalledFolderName = 'Wuthering Waves';
   patchJSONLocation = './patch.json';
   backupFolder = './backup';
   maxBackup = 10;
   doBackup = true;

   logFilePath = './wuwa-editor.log';
   logFileMaxSizeMB =  5;


   constructor(){
      this.loadConfig();
   }

   loadConfig(){
      let CONFIG;
      if(!existsSync(CONFIG_PATH)){
         try{
            const strConfig = DEFAULT_CONFIG + stringifyConfig(this, writeConfigOptions);

            writeFileSync(CONFIG_PATH, strConfig, { encoding: 'utf-8' });
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
      if(CONFIG.maxBackup != null) this.maxBackup = parseInt(CONFIG.maxBackup);
      this.doBackup = CONFIG.doBackup;
   }

   writeConfig(){
      writeConfig(this, CONFIG_PATH, writeConfigOptions);
   }
}



if(!(module.exports instanceof Config)) module.exports = new Config;