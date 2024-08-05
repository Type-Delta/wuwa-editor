/**interactive terminal
 * @version: 1.2.5
 * @module Terminal
 * @requires module:Tools
 */

// handle interactive CMD terminal
// @ts-expect-error
if(typeof Bun !== 'undefined')
   process.emitWarning('Arrow keys are not supported when using Bun, use Node.js for better compatibility');

const {
   search,
   ex_length,
   ncc,
   redexOf,
   cleanString,
   strSlice,
   asyncSleep,
} = require('./Tools.js');




const km = {
   BACKSPACE: '\u0008',
   TAB: '\u0009',
   SHIFT: '\u0016',
   ARROW_LEFT: '\u001b[\u0044',
   ARROW_UP: '\u001b[\u0041',
   ARROW_RIGHT: '\u001b[\u0043',
   ARROW_DOWN: '\u001b[\u0042',
   ESC: '\u001b',
   OSC: '\u001b]',
   BEL: '\u0007',
   CTRL_BACKSPACE: '\u007f',
   CTRL_ENTER: '\u000a',
   CTRL_C: '\u0003',
   CTRL_G: '\u0007',
   CTRL_F: '\u0006',
   /**CARRIAGE RETURN or CR (aka. Enter key)
    */
   ENTER: '\u000d',
   SPACE: '\u0020',
   F1: '\x1b[[A',
   F2: '\x1b[[B',
   F3: '\x1b[[C',
   F4: '\x1b[[D',
   F5: '\x1b[[E',
   F6: '\x1b[17~',
   F7: '\x1b[18~',
   F8: '\x1b[19~',
   F9: '\x1b[20~',
   F10: '\x1b[21~',
   F11: '\x1b[23~',
   F12: '\x1b[24~',
   HOME: '\x1b[1~',
   END: '\x1b[4~',
   PAGE_UP: '\x1b[5~',
   PAGE_DOWN: '\x1b[6~',
   INSERT: '\x1b[2~',
   DELETE: '\x1b[3~',
   isAlt: (key) => key[0] == '\u001b' && key[1] > '\u001f',
   isArrow: (key) => key[0] == '\u001b' && key[1] == '[' && 'ABCD'.includes(key[2]),
};



class Events {
   #listners = new Map();
   on(eventName, callback){
      if(!this.#listners.has(eventName))
         this.#listners.set(eventName, []);
      this.#listners.get(eventName).push(callback);
   }
   emit(eventName, ...args){
      if(!this.#listners.has(eventName)) return;
      this.#listners.get(eventName).forEach(callback => callback(...args));
   }
   removeListener(eventName, callback){
      if(!this.#listners.has(eventName)) return;
      const list = this.#listners.get(eventName);
      list.splice(list.indexOf(callback), 1);
   }
}


module.exports = class Terminal {
   //// PRIVATE VAR
   #lineLength;
   #lineMsg = '';
   #lastSuggested;
   #lHeadLength;
   #linePromptLength = 0;
   #suspendSugg = false;
   /**Text object take up a whole line and will not be effected
    * by any Terminal's Log message (like its floating on top of everything)
    * @type {Floating[]}
    */
   #floats = [];
   #timerLables = new Set();
   #isInit = false;
   /**@type {string[]} */
   #content = [];
   /**@type {number[]} */
   #cursorPos = [0, 0];
   #events = new Events();

   get Keys(){
      return km;
   }


   //// PUBLIC VAR
   /**input marker, default to blue `>`
    * @type {string}
    */
   lineHead = '\x1b[36m> \x1b[0m';
   /**if false **using ctrl+C WILL NOT kill the process!!**
    * usefull for application that needs to do something before shutdown.
    * use function below to stop the proess
    * @example
    * process.exit(0);
    */
   ctrl_C_Kill = true;
   /**word suggestion and auto complete,
    * this is a list that will be suggested to the users
    * @var String Array: suggestions
    * @type {string[]|null}
    */
   suggestions = null;
   /**the Code Numbers that would be returned by `Terminal.on('code')`
    */
   codes = {
      /**when user inputs `ctrl+C`,
       * **Note:** CLOSE will be return only if `ctrl_C_Kill` is `false`
       */
      CLOSE: 0
   }
   /**allowed user to type even when not being prompted to
    * @type {boolean}
    */
   allowedInputs;
   /**whether Terminal is prompting user
    */
   prompting = false;
   /**whether to show every char codes of the user's input
    *
    * (single key press can result in multiple char codes)
    */
   inputDebugMode = false;
   /**## redundancy level of how string width is calculated
    *
    * the higher, the more accurate but slower
    *
    * - **0**: supports ANSI code
    * - **1**: supports full-width charactors
    * - **2**: supports all emojis
    */
   redundancyLv = 0;
   /**width of the screen in columns
    */
   get width(){
      /**
       * in some terminal there are cases where printing message
       * with exact width of the viewport will cause the terminal to wrap the last charactor
       * while some time it won't, so to avoid this we subtract 1 from the width.
       * it won't look good but it's better than having only the last charactor wrapped
       */
      return process.stdout.columns - 1;
   }
   /**height of the screen in rows
    */
   get height(){
      return process.stdout.rows;
   }

   getContent(){
      return this.#content
   }


   /**Interactive console mainly focus on being
    * an input terminal that can receive keystroke
    * @package **require:** *nodeext.js, keyMap.js, Tools.js*
    * @param {string[]|null}suggestion word suggestion and auto complete,
    * this is a list that will be suggested to the users
    * @param {string|null}lineHead custom input marker
    * @param {boolean}ctrl_C_Kill if false **using ctrl+C WILL NOT kill the process!!**
    * usefull for application that needs to do something before shutdown.
    * @example
    * const Terminal = require('./terminal.js').Terminal;

    * let suggs = ['cat', 'dogs', 'rabbit holes', 'dog ears', 'donut; and cheese...', 'lightblue tint gray sky'];
    * const terminal = new Terminal(suggs, null, false);
    * terminal.initialize('Terminal test:');
    *
    * terminal.on('code', (code, userInput) => {
    *    switch(code){
    *    case 0:
    *       if(userInput)
    *          console.log(`you typed: ${userInput}`);
    *       console.log(`exiting...`);
    *       process.exit(0);
    *       break;
    *       console.log('unknown code :p');
    *    }
    * });
    * // log inputs
    * terminal.on('inputs', console.log);
    */
   constructor(suggestion = null, lineHead = null, ctrl_C_Kill = true){
      this.lineHead = lineHead||lineHead === ''? lineHead:this.lineHead;
      this.allowedInputs = this.lineHead.length > 0;
      this.#lHeadLength = this.lineHead.length;
      this.#lineLength = this.#lHeadLength;
      this.suggestions = !suggestion?.length? null:suggestion;
      this.ctrl_C_Kill = ctrl_C_Kill;
   }


   /**start the Terminal and allowing inputs
    * @param {string|null}headMsg text display on the top after initialized
    */
   initialize(headMsg = null){
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', this.#handlesInput.bind(this));

      //initialize #lineMsg
      this.#lineMsg = '' + (this.lineHead ?? '');
      if(headMsg) this.log(headMsg);
      else this.log('');
   }

   /**
    * close the Terminal and stop receiving inputs
    * only use this when you are done with the Terminal and never going to use it again
    */
   close(){
      process.stdin.setRawMode(false);
      process.stdin.removeListener('data', this.#handlesInput.bind(this));
      process.stdin.pause();
   }

   /**write message to the terminal and wait for user inputs
    * @param {string|null}msg
    * @returns {Promise<string>}
    */
   prompt(msg = null, enableSuggestion = false){
      return new Promise((resolve, reject) => {
         if(this.prompting){
            process.emitWarning('more than one prompt() is being used at the same time');
            return;
         }
         if(!enableSuggestion) this.#suspendSugg = true;
         if(msg){
            this.write(msg);
            this.#linePromptLength = this.#lineLength; // #lineLength is the length of the last line
         }
         this.prompting = true;

         const waitForInput = (input) => {
            this.#events.removeListener('inputs', waitForInput);
            if(!enableSuggestion) this.#suspendSugg = false;
            this.prompting = false;
            resolve(input);
         };

         this.on('inputs', waitForInput);
      });
   }


   /**
    * @typedef {Object} PromptChoiceOptions
    * @property {number|null} [defaultChoice] default choice index
    * @property {string|null} [msg] message to be display before the choices
    * @property {'inline'|'full'|null} [display] choices display style;
    * inline: tries to fit all choices in one line (this style can not be used with `msg`),
    * block: each choice in a new line,
    * full: wipe the screen and display choices in the center
    */
   /**
    * @param {string[]} choices
    * @param {PromptChoiceOptions} [options={}]
    * @returns {Promise<number>}
    */
   promptChoice(choices, options = {}){
      const { defaultChoice, msg, display = 'inline' } = options;
      let selected = defaultChoice ?? 0;
      const self = this;

      return new Promise((resolve, reject) => {
         if(this.prompting){
            process.emitWarning('more than one prompt() is being used at the same time');
            return;
         }
         this.prompting = true;

         printChoices(true);

         const waitForInput = (key, preventDefault) => {
            if(key == km.ENTER){
               this.#events.removeListener('key', waitForInput);
               this.prompting = false;
               this.write('\n');
               resolve(selected);
               return;
            }

            preventDefault?.();

            if(key == km.ARROW_LEFT||key == 'a'){
               if(selected > 0) selected--;
            }
            else if(key == km.ARROW_RIGHT||key == 'd'){
               if(selected < choices.length - 1) selected++;
            }

            printChoices();
         };

         this.on('key', waitForInput);
      });


      function createChoices(selected){
         let choice = '|';
         for(let i = 0; i < choices.length; i++){
            if(i == selected) choice += `${ncc('BgWhite')+ncc('Black')} ${choices[i]} ${ncc('Reset')}`;
            else choice += `${ncc('Reset')} ${choices[i]} `;

            choice += '|';
         }
         return choice;
      }

      function printChoices(firstPrint = false){
         if(display == 'full'){
            self.clearScreen();
            if(msg){
               self.display(msg, 'center', 'center', {
                  offset: [0, -1]
               });
            }
            self.display(createChoices(selected), 'center', 'center', {
               offset: msg? [0, 1]: null
            });
         }
         else {
            self.write(createChoices(selected), !firstPrint);
         }
      }
   }


   /**log outputs to the Terminal without interfering the user inputs
    * @param {any}msg same as first `console.log()`'s parameter
    * @param {any}optionalParam same as second `console.log()`'s parameter
    */
   log(msg, ...optionalParam){
      this.#clearScreenElements();
      console.log(msg, ...optionalParam);

      this.#content[this.height - 1] = msg?.toString() + ' ' + optionalParam?.join(' ') + '\n';
      this.#updateScreenElements(false);
      this.reposCursor();
      this.#suggest();
   }


   /**log outputs to the Terminal without interfering the user inputs.
    * **similar to** `Terminal.log()` **but use** `console.warn` **insted of** `console.log`
    * @param {any}msg same as first `console.log()`'s parameter
    * @param {any}optionalParam same as second `console.log()`'s parameter
    */
   warn(msg, ...optionalParam){
      this.#clearScreenElements();
      console.warn(msg, ...optionalParam);

      this.#content[this.height - 1] = msg?.toString() + ' ' + optionalParam?.join(' ') + '\n';
      this.#updateScreenElements(false);
      this.reposCursor();
      this.#suggest();
   }


   /**log errors to the Terminal without interfering the user inputs.
    * **similar to** `Terminal.log()` **but use** `console.error` **insted of** `console.log`
    * @param {any}msg same as first `console.log()`'s parameter
    * @param {any}optionalParam same as second `console.log()`'s parameter
    */
   error(msg, ...optionalParam){
      this.#clearScreenElements();
      console.error(msg, ...optionalParam);

      this.#content[this.height - 1] = msg?.toString() + ' ' + optionalParam?.join(' ') + '\n';
      this.#updateScreenElements(false);
      this.reposCursor();
      this.#suggest();
   }


   /**log Object to the Terminal without interfering the user inputs.
    * **similar to** `Terminal.log()` **but use** `console.table` **insted of** `console.log`
    * @param {any}tableData same as first `console.table()`'s parameter
    */
   table(tableData){
      if(!tableData) return;

      this.#clearScreenElements();
      console.table(tableData);

      this.#updateScreenElements(false);
      this.reposCursor();
      this.#suggest();
   }


   /**Starts a timer that can be used to compute the duration of an operation.
    *  Timers are identified by a unique label.
    *  Use the same label when calling timeEnd to stop the timer
    *  and output the elapsed time in suitable time units to stdout.
    *  For example, if the elapsed time is 3869ms, `terminal.timeEnd()` displays "3.869s".
    *  **No different from `console.time()`**
    * @param {string}label
    */
   time(label){
      if(!label) label = 'default';

      if(this.#timerLables.has(label)) return;
      this.#timerLables.add(label);
      console.time(label);
   };

   /**Stops a timer that was previously started by calling time
    * and prints the result to stdout without interfering the user inputs.
    * @example
    * terminal.time('100-elements');
    * for (let i = 0; i < 100; i++) {}
    * terminal.timeEnd('100-elements');
    * // prints 100-elements: 25.438ms
    * @param {string}label
    */
   timeEnd(label){
      this.#clearScreenElements();
      console.timeEnd(label);
      this.#timerLables.delete(label);

      this.#content[this.height - 1] = `${label}: <Terminal.timeEnd::Time>\n`;
      this.#updateScreenElements(false);
      this.reposCursor();
      this.#suggest();
   }



   /**write message on the user input
    * @param {string}msg output text
    * @param {Boolean}replace whether to replace the current line with `msg` or
    * append, default to `false`
    * @returns {string} the last line  of the written message
    */
   write(msg, replace = false){
      if(!msg) msg = '';
      if(typeof msg !== 'string') msg = msg + '';

      if(replace){
         this.#lineMsg = this.lineHead + msg;
         this.refreshLine();
         this.#lineLength = ex_length(this.#lineMsg, this.redundancyLv);
         return this.#lineMsg;
      }
      else if(msg.includes('\n')){
         const lastNLIndex = cleanString(msg).lastIndexOf('\n');
         const t_line = strSlice(msg, 0, lastNLIndex + 1, this.redundancyLv);
         const b_line = strSlice(msg, lastNLIndex + 1, null, this.redundancyLv);
         this.#lineMsg = b_line;
         if(this.#content[this.#cursorPos[1]]){
            this.#content[this.#cursorPos[1]] = strSlice(this.#content[this.#cursorPos[1]], 0, this.#cursorPos[0]) + t_line;

         }else this.#content[this.#cursorPos[1]] = t_line;

         this.#cursorPos[1]++;
         if(this.#content[this.#cursorPos[1]]){
            this.#content[this.#cursorPos[1]] =
               b_line + strSlice(
                  this.#content[this.#cursorPos[1]], ex_length(b_line, this.redundancyLv)
               );
         }
         else this.#content[this.#cursorPos[1]] = b_line;

         this.#cursorPos[0] = ex_length(b_line, this.redundancyLv);

      }
      else {
         this.#lineMsg += msg;
         if(this.#content[this.#cursorPos[1]]){
            this.#content[this.#cursorPos[1]] =
               strSlice(this.#content[this.#cursorPos[1]], 0, this.#cursorPos[0]) +
               msg +
               strSlice(
                  this.#content[this.#cursorPos[1]], this.#cursorPos[0] + ex_length(msg, this.redundancyLv)
               );

         }else this.#content[this.#cursorPos[1]] = msg;
         this.#cursorPos[0] += ex_length(msg, this.redundancyLv);
      }

      if(msg) process.stdout.write(msg);
      this.#lineLength = ex_length(this.#lineMsg, this.redundancyLv);
      return this.#lineMsg;
   }

   /**change or create new Ribbon
    * @param {string|((ribbonText: string)=>string)}modifier string or Callback with old ribbon text
    * passed in as argument, expected to return string which will be use as new ribbon text
    * @param {string|number?}bgColor `Tools.ncc()`'s color tag
    */
   modifyRibbon(modifier, bgColor = null){
      if(typeof modifier == 'function'){
         modifier = modifier(this.#floats[0]?.text);
      }

      if(!this.#floats.length||!this.#floats[0]){
         this.#clearScreenElements();
         this.#floats[0] = new Floating(modifier, bgColor);

         this.#updateScreenElements(false);
         return;
      }

      this.#floats[0].text = modifier;
      if(bgColor) this.#floats[0].bgColor = bgColor;
      this.#updateScreenElements();
   }




   /**rewrite the current line and clear suggestion text
    * in the process
    */
   refreshLine(){
      this.clearLine()
      process.stdout.write(this.#lineMsg);
   }


   /**clear the current line and move cursor (caret) to the correct position
    */
   clearLine(){
      process.stdout.clearLine(0);
      this.cursorTo(0);
      delete this.#content[this.#cursorPos[1]];
      this.#cursorPos[0] = 0;
   }


   /**clear the whole screen after which the cursor get place at the (0, 0) position
    */
   clearScreen(){
      this.cursorTo(0, 0);
      process.stdout.clearScreenDown();
      this.#content = [];
      this.#cursorPos = [0, 0];
   }



   /**## Event handler
    *
    * ### Event List:
    * - `code`: when user inputs `ctrl+C`
    * - `inputs`: when user press `Enter`, return the user's input (string before `Enter`)
    * - `key`: when user press any key
    * - `resize`: when terminal window is resized
    * @param {'code'|'inputs'|'key'|'resize'}eventName eventName
    * @param {() => void} callback function to be called when event emits
    */
   on(eventName, callback){
      const eventNameIsValid = (
         eventName == 'code'||
         eventName == 'inputs'||
         eventName == 'key'||
         eventName == 'resize'
      );
      if(!eventNameIsValid) throw new Error(`No such Event, given "${eventName}"`);

      if(eventName == 'resize'){
         process.stdout.on('resize', callback);
      }

      this.#events.on(eventName, callback);
      return callback;
   }

   /**
    * force emit event
    *
    * ### Event List:
    * - `code`: when user inputs `ctrl+C`
    * - `inputs`: when user press `Enter`, return the user's input (string before `Enter`)
    * - `key`: when user press any key
    * - `resize`: when terminal window is resized
    * @param {'code'|'inputs'|'key'|'resize'} eventName
    * @param {...*} args
    */
   emit(eventName, ...args){
      const eventNameIsValid = (
         eventName == 'code'||
         eventName == 'inputs'||
         eventName == 'key'||
         eventName == 'resize'
      );
      if(!eventNameIsValid) throw new Error(`No such Event, given "${eventName}"`);

      this.#events.emit(eventName, ...args);
   }


   /**set cursor to the given position
    *
    * position number can be **negative**
    * @param {number|'center'|'left'|'right'} x
    * @param {number|'center'|'top'|'bottom'?} [y]
    * @param {boolean} [usePadding=false] whether to set the x position by padding with SPACE,
    * this is usefull for writing message in the middle of the screen
    *
    * **Note that: this will overwrite anything before the setted x-position.**
    */
   cursorTo(x, y = null, usePadding = false){
      if(typeof x == 'string'){
         switch(x){
            case 'center':
               x = this.width >> 1; break;
            case 'left':
               x = 0; break;
            case 'right':
               x = this.width - 1; break;
            default:
               x = 0;
         }
      }

      if(typeof y == 'string'){
         switch(y){
            case 'center':
               y = this.height >> 1; break;
            case 'top':
               y = 0; break;
            case 'bottom':
               y = this.height - 1; break;
            default:
               y = 0;
         }
      }

      if(x < 0) x = this.width + x;
      if(y != null&&y < 0) y = this.height + y; // for negative position of y
      if(y == null) y = this.#cursorPos[1];

      if(usePadding){
         // process.stdout.cursorTo(0, y);
         // this.write(''.padEnd(x));
         if(!this.#content[y]) this.#content[y] = '';

         if(this.#content[y].length < x){
            this.#content[y] = this.#content[y].padEnd(x);
            process.stdout.cursorTo(0, y);
            this.write(this.#content[y]);
         }
      }

      process.stdout.cursorTo(x, y ?? undefined);
      if(x) this.#cursorPos[0] = x;
      if(y) this.#cursorPos[1] = y;
   }


   /**function that gets call in place of the original write function
    * @callback CustomWriteCallback
    * @param {string}msg
    * @param {number|'center'|'left'|'right'} [x=undefined]
    * @param {number|'center'|'top'|'bottom'} [y=undefined]
    * @param {TerminalDisplayOptions} [option=undefined]
    * @returns {string|undefined} message that was written
    */
   /**
    * @typedef {object} TerminalDisplayOptions
    * @property {'typed'|undefined} [effect]
    * @property {number|undefined} [delay]
    * @property {number|undefined} [length]
    * @property {boolean|undefined} [keepLine]
    * @property {number[]|undefined|null} [offset]
    * @property {CustomWriteCallback|undefined} [writeFunction]
    */
   /**write message at any given position on the screen
    *
    * this function treat terminal as if it where a literal display
    * @param {string|string[]} msg
    * @param {number|'center'|'left'|'right'} [x=undefined]
    * @param {number|'center'|'top'|'bottom'} [y=undefined]
    * @param {TerminalDisplayOptions} [options=undefined]
    * @returns {Promise<void>}
    */
   async display(msg, x, y, options = {}){
      let eachLine = typeof msg == 'string'? msg.split('\n'): msg;
      const lineCount = eachLine.length;
      const msgContentWidth = options?.length
         ? options.length
         : eachLine.reduce((prev, curr) => { // get length of the longest line
            const thisLen = ex_length(curr, this.redundancyLv);
            return thisLen > prev? thisLen: prev;
         }, 0);

      if(x == undefined){
         this.reposCursor();
         if(!options?.keepLine) this.clearLine();

         if(msgContentWidth > this.width){
            msg = eachLine.map(line =>
               strSlice(line, this.width, null, this.redundancyLv)
            ).join('\n');
         }
         this.log(msg);
         return;
      }


      if(typeof x == 'string'){
         switch(x){
            case 'center':
               x = (this.width >> 1) - (msgContentWidth >> 1);
               break;
            case 'left':
               x = 0;
               break;
            case 'right':
               x = this.width - 1 - msgContentWidth;
               break;
            default:
               x = 0;
         }
      }

      if(typeof y == 'string'){
         switch(y){
            case 'center':
               y = Math.ceil(this.height / 2);
               if(lineCount > 1) y -= Math.ceil(lineCount / 2);
               break;
            case 'top':
               y = 0;
               break;
            case 'bottom':
               y = this.height - 1;
               if(lineCount > 1) y -= lineCount - 1;
               break;
            default:
               y = this.#cursorPos[1];
         }
      }

      if(y == null) y = this.#cursorPos[1];

      if(options?.offset?.length){
         if(options.offset[0]) x += options.offset[0];
         if(options.offset[1]) y += options.offset[1];
      }


      let LIndex = 0;
      for(; LIndex < lineCount; LIndex++){
         let line = eachLine[LIndex];

         if(options?.keepLine){
            this.cursorTo(x, y + LIndex, true);
         }else{
            this.cursorTo(0, y + LIndex);
            this.clearLine();
            this.cursorTo(x, undefined, true);
         }

         if(options?.effect == 'typed'){
            if(options.delay == undefined) options.delay = 100;
            // let curPos = 0;
            for(const c of line){
               await asyncSleep(options.delay);
               // this.cursorTo(x + curPos++, y);
               this.write(c);
            }
         }else if(options?.writeFunction){
            const written = options.writeFunction(line, x, y + LIndex, options);
            if(written&&typeof written == 'string') line = written;

         }else this.write(line);

         if(y + LIndex + 1 >= this.height) break;
      }

      this.#lineMsg = eachLine[LIndex] ?? '';
   }


   /**get current cursor position absolute to the screen.
    *
    * from: https://stackoverflow.com/a/71367096
    * @returns {Promise<{x: number, y: number}>}
    */
   async getCursorPos(){
      return new Promise((resolve) => {
         const termcodes = { cursorGetPosition: '\u001b[6n' };

         const readFx = function () {
            const buf = process.stdin.read();
            const str = JSON.stringify(buf); // "\u001b[9;1R"
            const groups = (/\[(.*)/g).exec(str);
            const xy = groups? groups[0].replace(/\[|R"/g, '').split(';'): [];
            resolve({ x: parseInt(xy[0]), y: parseInt(xy[1]) });
         }

         process.stdin.once('readable', readFx);
         process.stdout.write(termcodes.cursorGetPosition);
      });
   }


   /**reposition cursor to the right most of the user's writing input
    * (ignore suggestions)
    */
   reposCursor = () => {
      this.cursorTo(ex_length(this.#lineMsg, this.redundancyLv), this.height - 1);
   }


   /**## remove Event handler
    *
    * ### Event List:
    * - `code`: when user inputs `ctrl+C`
    * - `inputs`: when user press `Enter`, return the user's input (string before `Enter`)
    * - `key`: when user press any key
    * - `resize`: when terminal window is resized
    * @param {'code'|'inputs'|'key'|'resize'}eventName
    * @param {() => void}callback callback function that was passed in to `Terminal.on()`
    */
   removeListener(eventName, callback){
      const eventNameIsValid = (
         eventName == 'code'||
         eventName == 'inputs'||
         eventName == 'key'||
         eventName == 'resize'
      );
      if(!eventNameIsValid) throw new Error(`No such Event, given "${eventName}"`);

      if(eventName == 'resize'){
         process.stdout.removeListener('resize', callback);
      }

      this.#events.removeListener(eventName, callback);
   }




   //// PRIVATE:
   /**clear and rewrite Screen Elements (cursor, Floats)
    * @param {boolean}clearFloatsOnUpdate whether to clear before rewrite
    */
   #updateScreenElements(clearFloatsOnUpdate = true){
      if(clearFloatsOnUpdate) this.#clearScreenElements();
      for(let i = this.#floats.length; i > 0; i--){
         const f = this.#floats[i - 1];
         process.stdout.cursorTo(0);
         const bgStyle = f.bgColor? typeof f.bgColor == 'number'? ncc(f.bgColor, 'bg'):ncc(f.bgColor):'';

         let ribbon = `${bgStyle + ncc(f.foreColor)}  ${f.text}  `;
         ribbon = ribbon.padEnd(process.stdout.columns, ' ') + ncc('Reset');
         console.log(ribbon);
      }

      process.stdout.write(this.#lineMsg);
   }

   /**clear Screen Elements (cursor, Floats)
    */
   #clearScreenElements(){
      for(let i = 0; i < this.#floats.length + 1; i++){
         process.stdout.cursorTo(0, (process.stdout.rows - i) - 1);
         process.stdout.clearLine(0);
      }
   }


   /**function made to be called by `process.stdin.on('data')` eventHandler,
    * this also the core function of this module
    */
   #handlesInput(key){
      if(!key) return;
      let _preventDefault = false;

      if(this.inputDebugMode){
         let codes = key.split('').map(char => char.charCodeAt(0));
         this.log(codes);
      }

      if(key == km.CTRL_C) this.#handleCTRL_C();

      this.#events.emit('key', key, preventDefault);

      if(_preventDefault) return;

      if(!this.allowedInputs){
         if(km.isArrow(key))
            this.#handleARROW_KEYS(key);
         return;
      }


      switch(key){
         case km.ENTER:
            this.#clearScreenElements();
            const msg = this.#lineMsg.slice(this.#lHeadLength + this.#linePromptLength).trim();
            process.stdout.write(this.#lineMsg + '\n');
            // this.#linePromptLength = 0;
            this.#events.emit('inputs', msg);
            this.#lineMsg = '' + this.lineHead;
            this.#updateScreenElements();
         return;
         case km.BACKSPACE:
            if(this.#lineLength <= this.#lHeadLength + this.#linePromptLength) return;

            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);

            const lineDelBy1 = this.#lineMsg.slice(0, this.#lineLength-1);
            process.stdout.write(lineDelBy1);
            this.#lineMsg = lineDelBy1;
            this.#lineLength--;
            this.reposCursor();
            if(!this.suggestions||this.#suspendSugg) return;
            this.#suggest();
         return;
         case km.TAB:
            if(!this.#lastSuggested){
               this.write(' ');
               return;
            }
            this.refreshLine();
            this.write(this.#lastSuggested);
         return;
         case km.CTRL_BACKSPACE:

         return;
         default:
            // this.log(this.#cursorPos, this.#lineLength, this.#linePromptLength, this.#lHeadLength);
            if(km.isArrow(key)){
               this.#handleARROW_KEYS(key);
               return;
            }

            this.#lineMsg += key.toString();
            this.#lineLength = this.#lineMsg.length;
            this.#cursorPos[0] = this.#lineLength;

            this.refreshLine();
            if(!this.suggestions||this.#suspendSugg) return;
            this.#suggest();
         return;
      }


      function preventDefault(){
         _preventDefault = true;
      }
   }



   /**return `#lineMsg` without `#lineHead`
    */
   #getContent = () => cleanString(this.#lineMsg).slice(
      ex_length(this.lineHead + this.#linePromptLength, this.redundancyLv)
   );


   /**made suggestion base on the current user writtings,
    * suggestion text would be display in gray, cannot be modified by the user
    * and does not count towards `#lineMsg`
    */
   #suggest(){
      if(!this.suggestions||this.#suspendSugg) return;

      const writingMsg = this.#getContent();
      //console.log(writingMsg.length);
      const suggestions = search(this.suggestions, writingMsg, { maxResult: 3 });
      if(!suggestions) return;

      for(let i = 0; i < suggestions.length; i++){
         if(!suggestions[i].string.startsWith(writingMsg)){
            if(i == suggestions.length - 1) //if no suitable suggestion found set #lastSuggested = null
               this.#lastSuggested = null;
            continue;
         }

         process.stdout.write(
            `\x1b[2m${suggestions[i].string.slice(writingMsg.length)}\x1b[0m`
         );
         this.#lastSuggested = suggestions[i].string.slice(writingMsg.length);
         if(this.#lastSuggested.length < 1)
            this.#lastSuggested = null;
         break;
      }

      this.reposCursor();
   }


   #handleCTRL_C(){
      process.stdout.write('\n');

      if(this.ctrl_C_Kill) process.exit(0);
      this.#events.emit('code', this.codes.CLOSE, this.#getContent());
   }

   #handleARROW_KEYS(key){
      // this.log(this.#cursorPos, this.#lineLength, this.#linePromptLength, this.#lHeadLength);
      if(key == km.ARROW_LEFT){
         // if(this.#cursorPos[0] <= this.#linePromptLength&&this.#cursorPos[0] > 0) return;
         this.#cursorPos[0]--; // TODO: something change x to 0 when using arrow left
         // this.cursorTo(this.#cursorPos[0]);
         process.stdout.cursorTo(this.#cursorPos[0]);
         // this.log(this.#cursorPos, this.#lineLength, this.#linePromptLength, this.#lHeadLength);

         return;
      }

      if(key == km.ARROW_RIGHT){
         // this.log(this.#cursorPos);
         if(this.#cursorPos[0] >= this.#lineLength) return;
         this.#cursorPos[0]++;
         process.stdout.cursorTo(this.#cursorPos[0]);
         return;
      }

      if(key == km.ARROW_UP || key == km.ARROW_DOWN){
         this.reposCursor();
         return;
      }

      // this.write(key);
   }
}





/**Text object take up a whole line and will not be effected
 * by any Terminal's Log message (like its floating on top of everything)
 */
class Floating {
   /**
    * @type {string|number}
    */
   bgColor = 'bgwhite';
   foreColor = 'black';
   text = '';
   /**
    * @param {string|number?} [bgColor=null] `Tools.ncc()`'s color tag
    */
   constructor(text = '', bgColor = null){
      this.text = text;
      if(bgColor) this.bgColor = bgColor;
   }
}
