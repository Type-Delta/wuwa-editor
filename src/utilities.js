const exec = require('child_process').exec;
const execProms = require('util').promisify(exec);
const fs = require('fs');
const commandExists = require('command-exists');

const to = require('./helper/Tools.js');
const _global = require('./global.js');
const terminal = require('./term.js');
const config = require('./config.js');

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
         {  // at the moment this function failed the "tricky process" test
            // const cmd = `wmic process where "name='${targetProcess}'" get ExecutablePath`;
            // const { stdout } = await execProms(cmd);

            // processPath = [
            //    ...(stdout.trim().split('\n').slice(1))
            // ][0]?.trim() || null;
            if(!isModuleGetIPathExist()) return null;

            const cmd = `build\\getIPath.exe`;
            const { stdout } = await execProms(cmd);

            const lineWithTarget = stdout.split('\n').find(line => line.includes(targetProcess));
            if(!lineWithTarget) return null;

            // each line look like this: `PID: 22880, Path: C:\Windows\System32\Taskmgr.exe`
            processPath = lineWithTarget.split(',').at(-1)
               .split(':').at(-1)
               .trim() || null;
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
 */
function createJSONReviver(functionBody = '') {
   if(functionBody.startsWith('$func:'))
      functionBody = functionBody.slice(6);

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
      && fs.statSync(config.logFilePath).size > config.logFileMaxSize;

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
 * @param {4|3|2|1} level message level, debug: 4, normal: 3, error: 2, critical: 1
 * @param {boolean} [print=false] whether to print the message to terminal
 */
function writeLog(message, level = 3, print = false) {
   if(print){
      terminal.log(message);
   }

   if(_global.logFileWS === null) return false;

   if(typeof message !== 'string'){
      message = to.cleanString(to.yuString(message));
   }
   else message = to.cleanString(message);

   const D = new Date();
   let time = [
      D.getMonth().toString(),
      D.getDate().toString(),
      D.getFullYear().toString(),
      D.getHours().toString(),
      D.getMinutes().toString(),
      D.getSeconds().toString()
   ].map(t => t.padStart(2, '0'));

   switch (level) {
      case 4: message = '[DEBUG] ' + message; break;
      case 3: message = '[INFO] ' + message; break;
      case 2: message = '[ERROR] ' + message; break;
      case 1: message = '[CRITICAL] ' + message; break;
   }

   const content = to.strWrap(message, 70, {
      firstIndent: `${time[0]+time[1]+time[2]}T${time[3]}:${time[4]}:${time[5]}| `,
      indent: '                 | ',
      redundancyLv: -1
   });

   _global.logFileWS.write(content);
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



module.exports = {
   isProcessRunning,
   getProcessPath,
   predicate,
   createJSONReviver,
   writeLog,
   openLogFile,
   closeLogFile,
   isModuleGetIPathExist,
   canBuildGetIPath
}