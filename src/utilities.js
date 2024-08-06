const exec = require('child_process').exec;
const execProms = require('util').promisify(exec);
const fs = require('fs');

const commandExists = require('command-exists');
const path = require('path');
const crypto = require('crypto');

const to = require('./helper/Tools.js');
const _global = require('./global.js');
const terminal = require('./term.js');
const config = require('./config.js');

const { color } = _global;
const { ncc } = to;

/**
 * Check if a process is running
 */
async function isProcessRunning(targetProcess) {
   let cmd = '';
   switch (process.platform) {
      case 'win32':
         cmd = `tasklist`;
         break;
      case 'darwin':
      case 'linux':
         cmd = `ps -ax`;
         break;
      default: break;
   }
   const { stdout } = await execProms(cmd);
   return stdout.toLowerCase().indexOf(targetProcess.toLowerCase()) > -1;
}


/**
 * Get the path of a process
 * @param {string} targetProcess
 * @returns {Promise<string|null>} path of the process
 */
async function getProcessPath(targetProcess) {
   let processPath = null;
   switch (process.platform) {
      case 'win32':
         {  // this command will fail the "tricky process" test if not elevated
            const cmd = `wmic process where "name='${targetProcess}'" get ExecutablePath`;
            const { stdout } = await execProms(cmd);

            processPath = [
               ...(stdout.trim().split('\n').slice(1))
            ][0]?.trim() || null;


            // if(!isModuleGetIPathExist()) return null;
            // const cmd = `build\\getIPath.exe`;
            // const { stdout } = await execProms(cmd);

            // const lineWithTarget = stdout.split('\n').find(line => line.includes(targetProcess));
            // if(!lineWithTarget) return null;

            // // each line look like this: `PID: 22880, Path: C:\Windows\System32\Taskmgr.exe`
            // processPath = lineWithTarget.split(',').at(-1)
            //    .split(':').at(-1)
            //    .trim() || null;
            break;
         }
      default:
         // I don't know how to get the path of a process on other platforms T.T
         throw new Error('This function is only available on Windows');
   }

   return processPath;
}





/**
 * @param {string} predicateStr
 * @param {string} value value to be tested
 * @returns {boolean} predicate result
 */
function predicate(predicateStr, value) {
   if (predicateStr.startsWith('$regex:')) {
      try {
         const regex = new RegExp(predicateStr.slice(7));
         return regex.test(value);
      } catch (e) {
         throw new Error('Invalid regex');
      }
   } else if (predicateStr.startsWith('$if:')) {
      const eval_s = new Function('key', `return (${predicateStr.slice(4)})`);
      return eval_s(value);
   } else {
      return value === predicateStr;
   }
}

/**
 * Create a JSON reviver/replacer function from a string
 * @param {string} functionBody
 * @returns {((key: string, value: any) => any)}
 */
function createJSONReviver(functionBody = '') {
   if(functionBody.startsWith('$func:'))
      functionBody = functionBody.slice(6);

   // @ts-expect-error type mismatch
   return new Function(
      'key, value',
      `${functionBody};
return value;`
   );
}

/**
 * open log file for writing
 */
function openLogFile() {
   const logFileTooLong = fs.existsSync(config.logFilePath)
      && fs.statSync(config.logFilePath).size > config.logFileMaxSizeMB * 1024 * 1024;

   _global.logFileWS = fs.createWriteStream(config.logFilePath, {
      flags: logFileTooLong? 'w' : 'a'
   });
}

function closeLogFile() {
   if(_global.logFileWS){
      _global.logFileWS.end();
   }
}

/**
 * stream write log message waiting to be written
 * @param {any} message
 * @param {4|3|2|1|0} level message level, debug: 4, normal: 3, warn: 2, error: 1, critical: 0
 * @param {boolean} [print=false] whether to print the message to terminal
 */
function writeLog(message, level = 3, print = false) {
   if(typeof message !== 'string'){
      message = to.yuString(message);
   }

   switch (level) {
      case 4: message = ncc('Dim') + '[debug] ' + ncc() + message; break;
      case 3: message = ncc(color.mikuCyan) + '[info] ' + ncc() + message; break;
      case 2: message = ncc('Yellow')+ '[warn] ' + ncc() + message; break;
      case 1: message = ncc('Red')+'[error] ' + ncc() + message; break;
      case 0: message = ncc('Red')+ncc('Bright')+'[critical] ' + ncc() + message; break;
   }

   if(print&&!_global.disableTerminalLoggin){
      terminal.log(message);
   }

   message = to.cleanString(message);

   if(_global.logFileWS === null) return false;

   const D = new Date();
   let time = [
      D.getMonth().toString(),
      D.getDate().toString(),
      D.getFullYear().toString(),
      D.getHours().toString(),
      D.getMinutes().toString(),
      D.getSeconds().toString()
   ].map(t => t.padStart(2, '0'));

   const content = to.strWrap(message, 130, {
      firstIndent: `${time[0]+time[1]+time[2]}T${time[3]}:${time[4]}:${time[5]}| `,
      indent: '                 | ',
      redundancyLv: -1
   });

   _global.logFileWS.write(content);
}

/**
 * get game installation folder from game executable (not the launcher) path
 * @param {string} imagePath
 */
function resolveGameInstallPath(imagePath){
   imagePath = path.normalize(imagePath);
   const folders = imagePath.split(path.sep);

   for(let i = folders.length - 1; i > 0; i--){
      if(folders[i] === config.getInstalledFolderName){
         return folders.slice(0, i + 1).join(path.sep);
      }
   }

   return null;
}


function isModuleGetIPathExist() {
   if(_global.moduleGetIPathExist === null){
      const modulePath = 'build/getIPath.exe';
      _global.moduleGetIPathExist = fs.existsSync(modulePath);
   }
   return _global.moduleGetIPathExist;
}



function canBuildGetIPath() {
   if(process.platform !== 'win32') return false;
   // if(!commandExists('g++')) return false;
   if(!commandExists('npm')) return false;

   return true;
}


async function getFileHash(path, algorithm = config.fileDiffHash){
   return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const rs = fs.createReadStream(path);
      rs.on('error', reject);
      rs.on('data', chunk => hash.update(chunk));
      rs.on('end', () => resolve(hash.digest('hex')));
  });
}

module.exports = {
   isProcessRunning,
   getProcessPath,
   predicate,
   createJSONReviver,
   writeLog,
   openLogFile,
   closeLogFile,
   isModuleGetIPathExist,
   canBuildGetIPath,
   resolveGameInstallPath,
   getFileHash
}