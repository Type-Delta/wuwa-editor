
import { expect } from 'chai';
import { describe, it } from 'mocha';
import isElevated from 'is-elevated';

import to from '../src/helper/Tools.js';
import {
   isProcessRunning,
   getProcessPath,
   predicate,
   createJSONReviver,
   writeLog
} from '../src/utilities.js';
import _global from '../src/global.js';
import { resolveBackupTimestamp } from '../src/backup.js';
import terminal from '../src/term.js';
terminal.close();

const { changeDateTimezone } = to;


expect(isElevated(),
   'Process not elevated! some test will failed if ran on non-elevated process'
).to.be.true;



describe('utilities.js', () => {
   describe('#isProcessRunning()', () => {
      it('should return true if the process is running', async () => {
         switch(process.platform){
            case 'win32':
               expect(await isProcessRunning('explorer.exe')).to.be.true;
               break;
            case 'darwin':
               expect(await isProcessRunning('Finder')).to.be.true;
               break;
            case 'linux':
               expect(await isProcessRunning('bash')).to.be.true;
               break;
         }
      });
   });

   describe('#getProcessPath()', () => {
      it('should return the path of the process (normal process)', async () => {
         switch(process.platform){
            case 'win32':
               const path = await getProcessPath('explorer.exe');
               expect(path, 'failed to resolve path').to.not.be.null;
               expect(path.toLowerCase(), 'not a correct path').to.includes('explorer.exe');
               break;
            default:
               throw new Error('This function is only available on Windows');
         }
      });

      // This test REQUIRES this process to be elevated
      it('should return the path of the process (tricky process)', async function() {
         this.timeout(0);
         let testerNotified = false;

         switch(process.platform){
            case 'win32':
               while(!(await isProcessRunning('Taskmgr.exe'))){
                  if(!testerNotified){
                     console.log(
                        'Please run Task Manager (Taskmgr.exe) to continue this test.\nTask Manager is used as a tricky process to get an image path of\n(the Game is also a tricky process)\nTip: press Ctrl+Shift+Esc to quickly open Task Manager'
                     );
                     testerNotified = true;
                  }

                  await to.asyncSleep(1000);
               }

               console.log('Task Manager is running..., continue the test');
               this.timeout(2000);

               const path = await getProcessPath('Taskmgr.exe');
               expect(path, 'failed to resolve path').to.not.be.null;
               expect(path.toLowerCase(), 'not a correct path').to.includes('taskmgr.exe');
               break;
            default:
               throw new Error('This function is only available on Windows');
         }
      });
   });

   describe('#predicate()', () => {
      it('should do a strict string compare if predicate is not a $regex or $if', () => {
         expect(predicate('hello', 'hello')).to.be.true;
         expect(predicate('hello', 'world')).to.be.false;
         expect(predicate('100', 100)).to.be.false;
      });

      it('should do a regex test if predicate is $regex', () => {
         expect(predicate('$regex:hello', 'hello')).to.be.true;
         expect(predicate('$regex:l[o-]+ng', 'looooooo-o-oo-ooooooooong')).to.be.true;
         expect(predicate('$regex:l[o-]+ng', 'hello')).to.be.false;
      });

      it('should throw an error if the regex is invalid', () => {
         expect(() => predicate('$regex:(', 'hello')).to.throw('Invalid regex');
      });

      it('should correctly eval a condition if predicate is $if', () => {
         expect(predicate('$if:key === "hello"', 'hello')).to.be.true;
         expect(predicate('$if:key.startsWith("h")', 'hello')).to.be.true;
         expect(predicate('$if:key.split("").length > 15', 'hello')).to.be.false;
      });

      it(`$if should throw 'Unexpected token' if the given condition is not valid`, () => {
         expect(() => predicate('$if:if("hello")', 'anything')).to.throw('Unexpected token \'if\'');
      });
   });

   describe('#createJSONReviver()', () => {
      it('should return a function', () => {
         expect(createJSONReviver()).to.be.a('function');
      });

      it('the resulted function should return the same value if the function body is undefined or empty', () => {
         let reviver = createJSONReviver();
         expect(reviver('key', 'value')).to.equal('value');

         reviver = createJSONReviver('$func:');
         expect(reviver('key', 'value')).to.equal('value');
      });

      it('the resulted function should parse correctly', () => {
         expect(() =>
            createJSONReviver('$func:throw new Error("just error")')()
         ).to.throw('just error');
      });
   });

   describe('#writeLog()', () => {
      _global.logFileWS = null;
      let writtenMsg = '';

      it('should return immediately if `_global.logFileWS` is null', () => {
         expect(() => writeLog('anything', 3)).to.not.throw();
      });

      it('should write the message to the log file', () => {
         _global.logFileWS = {
            write: (msg) => writtenMsg = msg
         };
         expect(writeLog('anything', 3)).to.not.be.false;

         expect(writtenMsg).to.be.a('string');
         expect(writtenMsg).to.include('anything');
      });

      it('should write correct debug level to the log file', () => {
         writeLog('anything', 4);
         expect(writtenMsg).to.include('[DEBUG]');

         writeLog('anything', 3);
         expect(writtenMsg).to.include('[INFO]');

         writeLog('anything', 2);
         expect(writtenMsg).to.include('[ERROR]');

         writeLog('anything', 1);
         expect(writtenMsg).to.include('[CRITICAL]');
      });

      it('should default to debug level 3 if no level is given', () => {
         writeLog('anything');
         expect(writtenMsg).to.include('[INFO]');
      });

      _global.logFileWS = null;
   });
});



describe('backup.js', () => {
   const testFileName = 'BACKUP_2024-07-21T03+14+36.709Z@1.0.0.zip';
   const machineDate = new Date('2024-07-21T03:14:36.709Z');

   describe('#resolveBackupTimestamp()', () => {
      it('should return a Date object', () => {
         expect(resolveBackupTimestamp(testFileName)).to.be.instanceOf(Date);
      });

      it('should parse date on the file name to correct machine date', () => {
         const result = resolveBackupTimestamp(testFileName);
         expect(
            result.toLocaleString()
         ).to.equal(
            changeDateTimezone(machineDate, _global.deviceTimezone)
               .toLocaleString()
         );
      });

      it('should return null if the date is invalid', () => {
         expect(
            resolveBackupTimestamp('BACKUP_2024-y7-21T25+14+36.709Z@1.0.0')
         ).to.be.null;
      });
   })
});