const fs = require('fs');
const path = require('path');
// @ts-expect-error can't find module
const _ = require('lodash');
let isElevated = null; // require('is-elevated')

const to = require('./helper/Tools');
const config = require('./config.js');
const {
   getProcessPath,
   isProcessRunning,
   createJSONReviver,
   openLogFile,
   closeLogFile,
   writeLog,
   resolveGameInstallPath,
} = require('./utilities.js');
const terminal = require('./term.js');
const handler = require('./handler.js');
const _global = require('./global.js');
const {
   createBackup,
   getBackupList,
   resolveBackupTimestamp,
   restoreBackup,
} = require('./backup.js');


const { color } = _global;


/**
 * @import {KeyBind, AxisBind} from './handler.js'
 */

/**
 * @typedef {'LCtrl'|'RCtrl'|'LShift'|'RShift'|'Space'|'LAlt'|'RAlt'|'Tab'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'0'|'Left'|'Right'|'Up'|'Down'|'Enter'|'Backspace'|'Esc'|'Del'|'Middle'|'Forward'|'Backward'|'RSB'|'LSB'|'LT'|'RT'|'LB'|'RB'|'B'|'X'|'Y'|'A'|'DPad_Down'|'DPad_Right'|'DPad_Left'|'DPad_Up'|'Start'|'Back'|'LS_Up'|'LS_Right'|'LS_Left'|'LS_Down'|'RS_Up'|'RS_Right'|'RS_Left'|'RS_Down'} Keys
*/

/**
 * @typedef {Keys|'MouseX'|'MouseY'|'MouseWheel'|'MousePos'|'LT_Axis'|'RT_Axis'|'LS_H'|'LS_V'|'LS_B'|'RS_H'|'RS_V'|'RS_B'} Axis
*/

/**
 * @typedef {'keyboard'|'mouse'|'controller'} DeviceTypes
 */

/**
 * @typedef {'keyboard'|'mouse'|'controller'|'modifiers'} DeviceTypesWithModifiers
 */

/**
 * @typedef {'plainText'|'sqlite'} SettingSrcFileType type of the file (e.g. encoding, format), defined how to read the file
 */

/**
 * @typedef {'JSON'|'ini'|'KBTupleMap'} SettingSrcDataType type of the actual content inside the file, defined how to parse the content
 */

/**
 * @typedef {'enum'|'bool'|'number'|'bindings'|'axis'|'string'} OptionPatchOptionTypes type of the setting value after parsing
 */

/**
 * @typedef {{[key: string]: OptionPatch}} OptionGroupsPatch
 */

/**
 * @typedef {{[key: string]: string|string[]}} BindingGroups
 */

/**
 * parsed settings with declaration Map keys should match patch.json
 *
 * the **key** is the setting name (not to be contused with keyName) in the patch.json
 *
 * @typedef {Map<string, ParsedGameSettingObj>} ParsedGameSettings
*/

/**
 * @typedef {Map<string, {
 *    dataType: SettingSrcDataType,
 *    value: {[group: string]: any},
 *    src: string
 * }>} AllRawSettings categorized by source file
 */


/**
 * @typedef {Object} ParsedGameSettingObj
 * @property {string} src key name of the config source file (reference in patch.json->`configSrcMap`) the setting is from
 * @property {string|number|boolean|(KeyBind|AxisBind)[]} value setting value
 * @property {string?} description setting description
 * @property {string} key key name of the setting in the config source file
 * @property {OptionPatchOptionTypes|undefined} type setting value type (what type this setting should be parsed as)
 * @property {'graphics'|'bindings'|'[Uncategorized]'|string} catergory setting group name
 * @property {string[]?} eValues enum values use only for setting with type 'enum' **(in patch.json this property is named `values`)**
 * @property {[number|undefined|null, number|undefined]?} range range of the ideal setting value **(in patch.json this property is named `range`)**
 * @property {string?} editNote note shown when editing the setting
 * @property {{[key: string]: string}?} valueDesc description of each value in the enum `key` for this object is the available enum values
 * @property {any?} default default value for the setting
 * @property {boolean} modified setting value has been modified
 * @property {string} group setting group name in the src file (this name identifies what group the setting should be written back to)
 * @property {boolean} editable whether user can edit this setting
*/

/**
 * @typedef {Object} SettingSrcMetadataSettingGroups
 */

// LINK: @jdn34 Replacer/Reviver syntax
/**
 * @typedef {Object} SettingSrcMetadataManifest
 * @property {{[groupName: string]: string[]}} settingGroups setting groups in the source file, group name as key and predicate to match setting keys as value
 *
 * Order of the group is important, as the program will match from the first group to the last group
 * the matched key will never match twice (similar to if-else statement)
 *
 * predicate can be a key name for literal match (===) or predicate function as follow:
 * - `$if:<statement>`: match if the JavaScript statement is true (available variable(s) is `key`)
 * - `$regex:<pattern>`: match if the key match the regular expression pattern
 * @property {string|undefined} selectedTable database table name to use when reading the source file
 * @property {string|undefined} rootProperty name of property that will be treated as root object for the setting (points to the setting object)
 * @property {string[]|undefined} acceptedGroups whitelist of setting groups to parse, if empty all groups will be parsed
 * @property {string[]|undefined} includeSrc list of setting source file to include while parsing
 * @property {string|'default'|'none'|((key: string, value: any, context: {source: any}) => any)|undefined} Reviver function to use when parsing settings (would be used instead of JSONReviver when parsing JSON type settings)
 *  this reviver works the same as the reviver parameter in JSON.parse()
 *
 * available values:
 * - 'default': use default reviver
 * - 'none': don't use any reviver (default)
 * - `<$func>`: use custom reviver function defined with syntax `$func:<functionBody>` with two parameters `key`, `value` and `context` object (see [MDN Doc](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#the_reviver_parameter))
 * @property {string|'default'|'none'|((key: string, value: any) => any)|undefined} Replacer function to use when writing settings (would be used instead of JSONReplacer when stringify JSON type settings)
 *
 * available values:
 * - 'default': use default replacer
 * - 'none': don't use any replacer (default)
 * - `<$func>`: use custom replacer function defined with syntax `$func:<functionBody>` with two parameters `key` and `value` (see [MDN Doc](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#the_reviver_parameter))
 */

/**
 * @typedef {Object} SettingSrcMetadata
 * @property {SettingSrcFileType} type type of this file (e.g. encoding, format) (before parsing the file), defined how to read it
 * - plainText: plain text file (UTF-8)
 * - sqlite: SQLite3 database file
 * @property {SettingSrcDataType} dataType type of this content inside the file (after the read process), defined how to parse it's content
 * - JSON: JSON object (stored as string)
 * - ini: INI file format (typically key-value pair)
 * - KBTupleMap: Key-Binding Tuple Map
 * @property {string} displayName a friendly name for the source
 * @property {string} description a brief description of the source
 * @property {string} path relative path from game root folder to the source file
 * @property {SettingSrcMetadataManifest?} manifest define how setting is parsed and grouped etc. in the source file
 * @property {boolean|undefined} configurable whether the settings in this source file can be configure and modified DIRECTLY by the user (user can see and edit the setting in the editor)
 * @property {boolean|undefined} usedAsRaw whether the settings in this source file is used as raw data (we shouldn't parse this setting)
 */

/**
 * @typedef {Object} OptionPatch
 * @property {string} description setting description
 * @property {string} key key name of the setting in the config source file
 * @property {|undefined} type setting value type
 * @property {string} src key name of the config source file (reference in patch.json->`configSrcMap`) the setting is from
 * @property {string[]?} values enum values use only for setting with type 'enum'
 * @property {[number, number|undefined]?} range range of the ideal setting value
 * @property {string?} editNote note shown when editing the setting
 * @property {{[key: string]: string}?} valueDesc description of each value in the enum `key` for this object is the available enum values
 * @property {any?} default default value for this setting (if the setting is not found in the source file, this value will be used)
 * @property {boolean?} allowMultiple allow multiple values for this setting (default: false)
 * @property {boolean?} editable whether user can edit this setting (default: true)
 */


/**
 * @typedef {Object} GameSettingPatch
 * @property {string} gameVersion game version the patch is for
 * @property {number} patchVersion patch file version
 * @property {number} handlerVersion handler version compatible with this patch
 * @property {OptionGroupsPatch} options settings grouped by category
 * @property {BindingGroups} bindingsDeclaration declaration of binary type input (e.g. key press, mouse click)
 * @property {BindingGroups} axisDeclaration declaration of analog type input (e.g. mouse movement, joystick)
 * @property {{[key: string]: string}} bindingsDescription description of each binding key/axis
 * @property {{[key: string]: string}} controlTypeDescription description of each control type (keyboard, mouse, controller)
 * @property {{[key: string]: string}} terminalKeysTranslation translation of terminal.km keys to patch.json keys
 * @property {{[key: string]: SettingSrcMetadata}} configSrcMap list of setting source files metadata
 *
 */





class GameSettings {
   /**
    * raw settings without declaration
    * @type {Map<string, {src: string, value: any, group: string}>}
    */
   raw = null;
   /**
    * parsed settings with declaration Map keys should match patch.json
    *
    * `eValues` is for enum values
    * @type {ParsedGameSettings}
    */
   parsed = null;
   /**
    * all raw settings for each source file
    * @type {AllRawSettings}
    */
   allRawSettings = null;
}


// tracer.liveLog = true;
// tracer.attachTracer(to, 'Tools.');
// tracer.enableLogging = true;

const { ncc } = to;
/**
 * @type {GameSettingPatch}
 */
let patch = null;
let settings = new GameSettings();
/**
 * backup of the settings before any changes
 *
 * only backup the settings that has been modified
 * @type {ParsedGameSettings}
 */
let changesBackup = new Map();
let shuttingDown = false;
let hasErrorOrWarning = false;



terminal.on('code', async (code) => {
   if(code == terminal.codes.CLOSE) {
      exitProgram();
   }
});

process.on('beforeExit', doShutdownTask);

(async () => {
   await doStartupTask();

   if(!_global.isThisProcessElevated){
      terminal.log(
         `${ncc('Red')}[error]${ncc()} This program must be run as administrator`
      );
      return doShutdownTask(1);
   }

   checkInstalledPath:
   if(!config.gameInstalledPath){
      writeLog('No game folder set. Looking for it in process list...', 3, true);
      const isRunning = await isProcessRunning(config.gameClientName);

      if(!isRunning){
         writeLog('Game not found in process list.');
         terminal.log(`${ncc(color.mikuCyan)}[info]${ncc()} Game not found in process list.

You can set the game installation folder manually or run the game (for auto detection).
${ncc(color.mikuCyan)}Auto${ncc()} - Auto detect game folder (recommended)
${ncc(color.mikuCyan)}Manual${ncc()} - Manually enter game folder

(Use ${ncc(color.mikuCyan)}← → (Arrow keys)${ncc('Reset')} or ${ncc(color.mikuCyan)}wasd${ncc('Reset')} to navigate, Enter to select)\n`);
         const choice = await terminal.promptChoice(['Auto', 'Manual']);

         if (choice == 1) {
            await promptForGamePath();
            break checkInstalledPath;
         }
         else {
            terminal.log(
               `Waiting for you to run the game... ;) (${ncc(color.mikuCyan)}Ctrl+C${ncc('Reset')} to exit)`
            );

            let dotCount = 0;
            while (true) {
               if(dotCount == 0){
                  const isRunning = await isProcessRunning(config.gameClientName);
                  if (isRunning) {
                     terminal.clearLine();
                     writeLog('Game process found! resolving path...', 3, true);
                     break;
                  }
               }

               terminal.write(ncc(color.mikuCyan) + ''.padEnd(dotCount, '.') + ncc(), true);
               if (dotCount < 3) dotCount++;
               else dotCount = 0;
               await to.asyncSleep(500);
            }
         }
      }

      const imagePath = await getProcessPath(config.gameClientName);
      if(!imagePath){
         writeLog('Failed to resolve game path.', 2, true);
         terminal.log(`please enter the game folder manually.`);

         await promptForGamePath();
         break checkInstalledPath;
      }

      config.gameInstalledPath = resolveGameInstallPath(imagePath);
      terminal.log(`found: ${ncc(color.mikuCyan) + config.gameInstalledPath + ncc()}`);
      writeLog(`Game path found: ${config.gameInstalledPath}`, 3);
   }

   if (!verifyGamePath(config.gameInstalledPath))
      return doShutdownTask(1);

   const [ loadSettingsRes ] = await Promise.all([
      loadSettings(),
      backupGameConfigSrc()
   ]);

   const { settingSearchFields, settingTFIDF } = loadSettingsRes;

   if(hasErrorOrWarning){
      await terminal.prompt(
         `${ncc('Red')}[warn]${ncc()} There are errors or warnings when loading, do you wish to continue? \nPress ${ncc(color.mikuCyan)}Enter${ncc()} to continue...`
      );
   }
   else await to.asyncSleep(500);

   hasErrorOrWarning = false;
   writeLog('Loading UI...', 3, true);


   terminal.log('\n'.padEnd(terminal.height - 1, '\n'));
   await showMainMenu(settings.parsed, patch, settingTFIDF, settingSearchFields);
   doShutdownTask();
})();













/**
 * @typedef {Object} WriteUI_splitScreenOptions
 * @property {boolean} [rightPanelActive=true] whether the right panel is active
 * @property {number[]} [redundancyLvList=[2, 0, 1]] redundancy level for each part of the UI (header, footer, status bar)
 */
/**
 * write the "splitScreen" UI element to the terminal
 * @param {string} header header row message (need to be exactly terminal.width - 2 Recxel long)
 * @param {string[]} leftPanel left panel content
 * @param {string[]} rightPanel right panel content
 * @param {string} [footer=''] footer row message
 * @param {string[]} [statusBar=['', '']] status bar message (left and right side)
 * @param {WriteUI_splitScreenOptions} [options={}]
 */
function writeUI_splitScreen(
   header,
   leftPanel,
   rightPanel,
   footer = '',
   statusBar = ['', ''],
   options = {}
){
   const terminalHalf = terminal.width >> 1;
   const { rightPanelActive = true, redundancyLvList = [2, 0, 1] } = options;
   const lPanelBlank = ncc(color.gray1, 'bg')+ncc(color.gray7) + '░'.padEnd(terminalHalf);

   leftPanel.unshift(lPanelBlank);

   while(leftPanel.length < terminal.height - 3)
      leftPanel.push(lPanelBlank);

   terminal.clearScreen();
   terminal.display(
      ncc(color.gray3, 'bg')+ncc(color.gray9)+ncc('Bright') + `░${header}░` + ncc(),
      'left', 0
   );
   terminal.cursorTo(0, 1);

   for(let j = 0; j < leftPanel.length; j++){
      let rightPanelLine = null;
      if(j == 0){
         rightPanelLine = (rightPanelActive? ncc('Reset')+ncc(color.gray1, 'bg')+ncc(color.gray7):'') + `  ${''.padEnd(terminalHalf - 2)}░` + ncc();

      }else{
         if(j == leftPanel.length - 1){
            if(rightPanel.length > leftPanel.length){
               rightPanelLine = (rightPanelActive? ncc('Reset')+ncc(color.gray1, 'bg')+ncc(color.gray7):'') +
                  `│ ${'...'.padEnd(terminalHalf - 2)}░` + ncc();
               continue;
            }

            rightPanelLine = (rightPanelActive? ncc('Reset')+ncc(color.gray1, 'bg')+ncc(color.gray7):'') +
               `  ${to.padEnd(rightPanel[j - 1] ?? '', terminalHalf - 2, ' ', redundancyLvList[0])}░` + ncc();
         }else{
            rightPanelLine = (rightPanelActive? ncc('Reset')+ncc(color.gray1, 'bg')+ncc(color.gray7):'') +
               `│ ${to.padEnd(rightPanel[j - 1] ?? '', terminalHalf - 2, ' ', redundancyLvList[0])}░` + ncc();
         }
      }

      terminal.write(leftPanel[j] + rightPanelLine + '\n');
   }

   terminal.write(
      ncc(color.gray3, 'bg')+ncc(color.gray9) + `░ ${to.strJustify(footer, terminal.width - 4, {align: 'left', overflow: 'collapse', collapseLocation: 'end', redundancyLv: redundancyLvList[1]})+ncc(color.gray9)} ░\n` +
      ncc(color.gray3, 'bg')+ncc(color.gray9) + `░ ${to.strJustify(statusBar, terminal.width - 4, {align: 'spacebetween', overflow: 'collapse', collapseLocation: 'mid', redundancyLv: redundancyLvList[2]})+ncc(color.gray9)} ░` + ncc()
   );
}






/*
// Setting page draft
------------------------------------------------------

░                      graphics                      ░
░ FPS                      |                         ░
░ Resolution -----------   | The resolution of       ░
░ VSync                    | the game window         ░
░ Fullscreen               |                         ░
░                          | default: 1920x1080      ░
░                          |                         ░
░                          |                         ░
░                          |                         ░
╭────────────────────────────────────────────────────╮
│ Ctrl+K to search, Enter to edit, Esc to go back    │
*/
/**
 * @param {string} category settings declared in patch.json (not to be confused with group setting)
 * @param {ParsedGameSettings} settingsMap settingsMap map of parsed settings
 * @param {number} selectedIndex index of selected setting in settingsMap
 * @param {string} footerMsg message to display at the 2nd row from the bottom
 * @param {string[]} statusMsg messages to display at the bottom row (each for left and right side)
 */
function drawSettings(category, settingsMap, selectedIndex = 0, footerMsg = '', statusMsg = ['', '']) {
   let maxRow = terminal.height - 5;
   let halfMaxRow = maxRow >> 1;
   let disp = [];
   const terminalHalfW = terminal.width >> 1;
   const isCategoryModified = [...changesBackup.values()]
      .findIndex(v => v.catergory == category) !== -1;

   let i = -1;
   let selDesc = null;
   for(const [key, setting] of settingsMap){
      i++;

      if(selectedIndex > settingsMap.size - halfMaxRow){
         if(i < settingsMap.size - maxRow) continue;

      }else if(selectedIndex >= halfMaxRow){
         if(i < selectedIndex - halfMaxRow||i > selectedIndex + halfMaxRow) continue;
      }

      if(disp.length >= maxRow) break;

      const isSettingModified = changesBackup.has(key);

      if(i == selectedIndex){
         let sValue = '';

         if(setting.value instanceof Array)
            sValue = setting.value?.length
               ? '\n  ' + setting.value.map(v => v.toString()).join('\n  ')
               : ncc(color.gray6)+'[empty]';
         else{
            switch(typeof setting.value){
               case 'boolean':
                  sValue = ncc(setting.value?'Green':'Red') + setting.value;
                  break;
               case 'number':
                  if(setting.type == 'enum')
                     sValue = ncc(color.gold) + setting.eValues[setting.value];
                  else sValue = ncc(color.aquaPink) + setting.value;
                  break;
               default:
               case 'string':
                  sValue = ncc(color.grayB) + setting.value;
            }
         }

         selDesc = ncc(color.grayB)+ncc('Bright')+ key + ncc('Reset')+ncc(color.gray1, 'bg')+ncc(color.gray7) + '\n\n' + (setting.description ?? '[No Description provided]') +
            `\n\nType: ${(setting.type? ncc(color.mikuCyan)+setting.type:ncc('Red')+'Unknown')+ncc(color.gray7)}`+
            `\nValue: ` + sValue + ncc(color.gray7) +
            '\nKey: ' + ncc(color.gray5) + setting.key + ncc(color.gray7) +
            (patch.configSrcMap[setting.src]?.path? '\nSrc: ' + ncc(color.gray5) + to.strLimit(patch.configSrcMap[setting.src].path, terminalHalfW - 9, 'start') + ncc(color.gray7): '');


         disp.push(
            ncc(color.gray1, 'bg')+ncc(color.gray7)+'░ '+ncc(color.gray3, 'bg')+ncc(color.grayB)+ncc('Bright')+to.padEnd(` •${key + (isSettingModified? ncc()+ncc(color.gray3, 'bg')+ncc('Yellow')+ ' [M]'+ncc(color.gray7):'')}`, terminalHalfW - 3, ' ', 1)+ncc('Reset')+ncc(color.gray1, 'bg')+ncc(color.gray7)+' '
         );
      }
      else{
         disp.push(
            ncc(color.gray1, 'bg')+ncc(color.gray7)+to.padEnd(`░  ${key + (isSettingModified? ncc('Yellow')+ ' [M]'+ncc(color.gray7):'')}`, terminalHalfW, ' ', 1)
         );
      }
   }

   let descLines = to.strWrap(selDesc, (terminalHalfW) - 2, {mode: 'softboundery', redundancyLv: 2})
      .split('\n');

   writeUI_splitScreen(
      to.strSurround(
         category + (isCategoryModified? ncc()+ncc(color.gray3, 'bg')+ncc('Yellow')+ ' ['+ncc('Italic')+'modified'+ncc()+ncc(color.gray3, 'bg')+ncc('Yellow')+']'+ncc(color.gray9):''),
         ' ', terminal.width - 2
      ),
      disp,
      descLines,
      footerMsg,
      statusMsg, {
         redundancyLvList: [2, 0, 1]
      }
   );
}

/**
 * Track navigation and selection status in the edit menu
 * @typedef {Object} drawSettingEditorTrackers
 * @property {number} lastSelIndex selected setting/choice index in the last action
 * @property {number} [step=1] current editing step, most value type only have 1 step except for bindings and axis which have 3, 4 steps respectively
 *
 * **binding**
 * 1. select, add, remove binding or reset all binding to current setting
 * 2. (none)
 * 3. select device type (keyboard, mouse, controller, modifier) (skip step 2)
 * 4. select binding key/axis
 * 5. (none)
 * 6. key input mode (enter key binding with key press) (only accessible in step 4 with keyboard device type)
 *
 * **axis**
 * 1. select, add, remove binding or reset all binding to current setting
 * 2. select input type "binding", "axis" or option "set scaling"
 * 3. select device type (keyboard, mouse, controller)
 * 4. select binding key/axis
 * 5. set axis scaling (this step can only be reached if select "set scaling" in step 2)
 * 6. key input mode (enter key binding with key press) (only accessible in step 4 with keyboard device type)
 * @property {'bindingsDeclaration'|'axisDeclaration'} [bindingInputTypePatchName] a key name in patch.json->`bindingsDeclaration` or `axisDeclaration`
 * @property {number} [selBindingIndex=0] current selected binding index, for **Bindings** and **Axis** type setting
 * @property {'mouse'|'controller'|'keyboard'|'modifiers'} [bindingDeviceTypePatchName] a key name in patch.json for the current selected input type
 *
 */
/**
 * @param {ParsedGameSettings} settingsMap map of parsed settings
 * @param {number} settingIndex index of selected setting in settingsMap
 * @param {string[]} statusMsg messages to display at the bottom row (each for left and right side)
 * @param {number} [choiceIndex=0] current selected setting value choice index, for example
 * for **Boolean** choiceIndex can be 0 or 1, for **Enum** it can be 0, 1, 2, etc
 * this index would select binding or axis to edit
 * @param {drawSettingEditorTrackers} [trackers={}]
 *
 * @returns {drawSettingEditorTrackers}
 */
function drawSettingEditor(
      settingsMap,
      settingIndex = 0,
      statusMsg = ['', ''],
      choiceIndex = 0,
      trackers = {
         step: 1,
         lastSelIndex: 0,
         selBindingIndex: 0
      }
   ){

   let maxRow = terminal.height - 5;
   let halfMaxRow = maxRow >> 1;
   let disp = [];
   let rightPanelContent = null;
   let selectedSettingName = null;
   let footerMsg = null;
   /**@type {string[]} */
   let leftPanelItems = null,
      leftPIndex = settingIndex;
   let rightPanelActive = true;
   let rightPanelItems = null;
   let defaultStr = null;
   const terminalHalf = terminal.width >> 1;

   let j = 0;
   for(const [key, setting] of settingsMap){
      if(j++ != settingIndex) continue;

      selectedSettingName = key;

      let sValue = '', hearderMsg = null;
      switch(setting.type){
         case 'bool':
            sValue = ncc(color.gray3, 'bg') + ncc(choiceIndex?'Green':'Red') + (choiceIndex? 'true': 'false') + ncc('Reset') + ncc(color.gray1, 'bg');
            leftPanelItems = [...settingsMap.keys()];
            hearderMsg = ncc(color.mikuCyan)+'SPACE'+ncc(color.grayB)+' to toggle this setting';
            footerMsg = ncc(color.mikuCyan)+'Enter'+ncc(color.gray9)+' to apply, '+ncc(color.mikuCyan)+'Esc'+ncc(color.gray9)+' to go back, '+ncc(color.mikuCyan)+'SPACE'+ncc(color.gray9)+' toggle value';
            if(setting.default !== undefined)
               defaultStr = ncc(setting.default?'Green':'Red') + setting.default;
            break;

         case 'enum':
            if(typeof setting.value == 'number'){
               sValue = ncc(color.gold) + setting.eValues[setting.value];
               leftPanelItems = setting.eValues.map((v, i) => {
                  if(i === setting.default)
                     return v + ncc(color.gold) + ncc('Italic') + ' (default)' + ncc(color.gray7);

                  return v + ncc(color.gray7);
               });
               hearderMsg = 'Chose a value from the left panel';
               footerMsg = ncc(color.mikuCyan)+'Enter'+ncc(color.gray9)+' to apply, '+ncc(color.mikuCyan)+'Esc'+ncc(color.gray9)+' to go back, '+ncc(color.mikuCyan)+'↑ ↓'+ncc(color.gray9)+' or '+ncc(color.mikuCyan)+'W S'+ncc(color.gray9)+' to move';
               leftPIndex = choiceIndex;
               rightPanelActive = false;

               if(setting.default !== undefined)
                  defaultStr = ncc(color.gold) + setting.eValues[setting.default];
            }
            else {
               writeLog(`Invalid setting value type for enum setting\nsetting: ${to.yuString(setting)}`, 2);
               hearderMsg = 'error while parsing setting value';
            }
            break;

         case 'number':
            sValue = ncc(color.aquaPink) + setting.value;
            leftPanelItems = [...settingsMap.keys()];
            if(setting.range&&setting.range.length > 0){
               if(setting.range.length > 1&&setting.range[0] != null&&setting.range[1] != null)
                  hearderMsg = `Enter number between ${ncc(color.mikuCyan)+setting.range[0]+ncc(color.grayB)} and ${ncc(color.mikuCyan)+setting.range[1]+ncc(color.grayB)}`;
               else{
                  if(setting.range[0] == null)
                     hearderMsg = `Enter number ${ncc(color.mikuCyan)}less than${ncc(color.grayB)} ≤${setting.range[1]}`;
                  else hearderMsg = `Enter number ${ncc(color.mikuCyan)}greater than${ncc(color.grayB)} ≥${setting.range[0]}`;
               }
            }
            else hearderMsg = 'Enter a number for this setting';

            footerMsg = ncc(color.mikuCyan)+'Enter'+ncc(color.gray9)+' to apply, '+ncc(color.mikuCyan)+'Esc'+ncc(color.gray9)+' to go back';

            if(setting.default !== undefined)
               defaultStr = ncc(color.aquaPink) + setting.default;
            break;

         case 'bindings':
         case 'axis': {
            switch(trackers.step){
               case 1: // 1. select, add, remove binding or apply all binding to current setting
                  leftPanelItems = [...settingsMap.keys()];
                  hearderMsg = 'Modify, add or remove bindings';
                  rightPanelActive = true;
                  trackers.selBindingIndex = choiceIndex;
                  footerMsg = ncc(color.mikuCyan)+'Enter'+ncc(color.gray9)+' to select, '+ncc(color.mikuCyan)+'Esc'+ncc(color.gray9)+' back, '+(choiceIndex < setting.value.length? ncc(color.mikuCyan)+'Ctrl+Backspace'+ncc(color.gray9)+' delete binding, ': '')+ncc(color.mikuCyan)+'↑ ↓'+ncc(color.gray9)+' or '+ncc(color.mikuCyan)+'W S'+ncc(color.gray9)+' to move';
                  break;
               case 2: // 2. select "binding", "axis" or "Set Scaling" (for axis type only)
                  leftPanelItems = ['Binding', 'Axis', 'Set Scaling'];
                  hearderMsg = 'Choose control type';
                  rightPanelActive = false;
                  footerMsg = ncc(color.mikuCyan)+'Enter'+ncc(color.gray9)+' to select, '+ncc(color.mikuCyan)+'Ctrl+Enter'+ncc(color.gray9)+' to apply, '+ncc(color.mikuCyan)+'Backspace'+ncc(color.gray9)+' delete key, '+ncc(color.mikuCyan)+'Esc'+ncc(color.gray9)+' back, '+ncc(color.mikuCyan)+'↑ ↓'+ncc(color.gray9)+' move';
                  break;
               case 3: // 3. select control type (keyboard, mouse, controller, modifier)
                  leftPanelItems = Object.keys(patch[trackers.bindingInputTypePatchName])
                     .filter(v => !(v == 'modifiers'&&setting.type == 'axis'));

                  hearderMsg = 'Choose input device type' + (setting.type == 'axis'? ' or modifier key': '');
                  rightPanelActive = false;
                  footerMsg = ncc(color.mikuCyan)+'Enter'+ncc(color.gray9)+' to apply, '+ncc(color.mikuCyan)+'Ctrl+Enter'+ncc(color.gray9)+' to apply, '+ncc(color.mikuCyan)+'Backspace'+ncc(color.gray9)+' delete key, '+ncc(color.mikuCyan)+'Esc'+ncc(color.gray9)+' back, '+ncc(color.mikuCyan)+'↑ ↓'+ncc(color.gray9)+' move';
                  break;
               case 4:  // 4. select control key/axis
                  leftPanelItems = Object.keys(patch[trackers.bindingInputTypePatchName][trackers.bindingDeviceTypePatchName]);
                  rightPanelActive = false;
                  footerMsg = ncc(color.mikuCyan)+'Enter'+ncc(color.gray9)+' to select, '+ncc(color.mikuCyan)+'Ctrl+Enter'+ncc(color.gray9)+' to apply, '+ncc(color.mikuCyan)+'Backspace'+ncc(color.gray9)+' delete key, '+(trackers.bindingDeviceTypePatchName == 'keyboard'? ncc(color.mikuCyan)+'Ctrl+G'+ncc(color.gray9)+' record key, ': '')+ncc(color.mikuCyan)+'Esc'+ncc(color.gray9)+' back, '+ncc(color.mikuCyan)+'↑ ↓'+ncc(color.gray9)+' move';
                  break;

               case 5:
                  leftPanelItems = [...settingsMap.keys()];
                  hearderMsg = 'Modify, add or remove bindings';
                  rightPanelActive = true;
                  footerMsg = ncc(color.mikuCyan)+'Enter'+ncc(color.gray9)+' to confirm,  '+ncc(color.mikuCyan)+'Esc'+ncc(color.gray9)+' to go back, value default to ' + ncc(color.mikuCyan) + '100%' + ncc(color.gray9);
                  break;
               case 6:  // 6. key input mode (enter key binding with key press) (only accessible in step 4 with keyboard device type)
                  leftPanelItems = Object.keys(patch[trackers.bindingInputTypePatchName][trackers.bindingDeviceTypePatchName]);
                  rightPanelActive = true;
                  footerMsg = ncc(color.mikuCyan)+'Press'+ncc(color.gray9)+' any key on your keyboard...,  '+ncc(color.mikuCyan)+'Ctrl+G'+ncc(color.gray9)+' to cancel';
                  break;
            }


            leftPIndex = rightPanelActive? settingIndex: choiceIndex;

            if(setting.value instanceof Array){
               rightPanelItems = [
                  ...setting.value.map(v => v.toString()),
                  '➕ [add new binding]',
                  `♻️ [${ncc('Red')}reset all bindings${ncc(color.gray7)}]`
               ].map((v, i) =>
                  i == trackers.selBindingIndex
                     ? ncc(color.gray3, 'bg')+ncc(color.grayB)+ncc('Bright')+to.padEnd(` •${v} `, terminalHalf - 4, ' ', 2)+ncc()+ncc(color.gray1, 'bg')+ncc(color.gray7)
                     : ` ${v} `
               );
            }


            if(setting.value[trackers.selBindingIndex]){
               let bindingDesc = null;

               switch(trackers.step){
                  case 4:
                     bindingDesc = patch.bindingsDescription[
                        // bindingInputTypePatchName can be either 'bindingsDeclaration' or 'axisDeclaration'
                        // to get just 'bindings' or 'axis' we slice off the 'Declaration' part
                        trackers.bindingInputTypePatchName.slice(0, trackers.bindingInputTypePatchName.indexOf('D')) + '.' +
                        trackers.bindingDeviceTypePatchName + '.' +
                        leftPanelItems[choiceIndex]
                     ];
                     break;
                  case 3:
                     bindingDesc = patch.controlTypeDescription[
                        trackers.bindingInputTypePatchName.slice(0, trackers.bindingInputTypePatchName.indexOf('D')) + '.' +
                        leftPanelItems[choiceIndex]
                     ];
                     break;
                  case 2:
                     bindingDesc = to.objValueAt(patch.controlTypeDescription, choiceIndex);
                     break;
               }
               if(bindingDesc)
                  hearderMsg = bindingDesc;
            }

            break;
         }

         default:
         case 'string':
            sValue = ncc(color.grayB) + setting.value;
            leftPanelItems = [...settingsMap.keys()];
            hearderMsg = 'Enter a new value';
            footerMsg = ncc(color.mikuCyan)+'Enter'+ncc(color.gray9)+' to apply, '+ncc(color.mikuCyan)+'Esc'+ncc(color.gray9)+' to go back';
            if(setting.default !== undefined)
               defaultStr = ncc(color.grayB) + setting.default;
            // for string type currently editing value will be set outside this function as `statusMsg[0]`
      }


      rightPanelContent = ncc(color.gray7) + setting.description + '\n\n' +
         (hearderMsg? ncc(color.grayB)+ncc('Bright')+ hearderMsg + ncc('Reset')+ncc(color.gray1, 'bg')+ncc(color.gray7): '')  +
         (setting.editNote? '\n\n'+setting.editNote:'') +
         (setting.valueDesc&&setting.valueDesc[setting.eValues[choiceIndex]]? '\n\n'+setting.valueDesc[setting.eValues[choiceIndex]]:'') +
         (defaultStr? '\n\nDefault: ' + defaultStr + ncc(color.gray7): '\n') +
         `\nValue: ` + (rightPanelItems?'': sValue) + ncc(color.gray7);
   }



   let i = -1;
   for(const item of leftPanelItems){
      i++;

      if(leftPIndex > leftPanelItems.length - halfMaxRow){
         if(i < leftPanelItems.length - maxRow) continue;

      }else if(leftPIndex >= halfMaxRow){
         if(i < leftPIndex - halfMaxRow||i > leftPIndex + halfMaxRow) continue;
      }

      if(disp.length >= maxRow) break;

      if(!rightPanelActive&&i == leftPIndex){
         disp.push(
            ncc(color.gray1, 'bg')+ncc(color.gray7)+'░ '+ncc(color.gray3, 'bg')+ncc(color.grayB)+ncc('Bright')+to.padEnd(` •${item}`, terminalHalf - 3, ' ', 2)+ncc()+ncc(color.gray1, 'bg')+ncc(color.gray7)+' '
         );
      }else disp.push(ncc(color.gray1, 'bg')+ncc(color.gray7)+'░ '+(rightPanelActive?ncc('Dim'):'')+to.padEnd(` ${item}`, terminalHalf - 2, ' ', 1));
   }

   while(disp.length < maxRow)
      disp.push(ncc(color.gray1, 'bg')+ncc(color.gray7) + '░'.padEnd(terminalHalf));


   let RPanelContentLines = to.strWrap(rightPanelContent, (terminalHalf) - 2, {mode: 'softboundery', redundancyLv: 2})
      .split('\n');

   if(rightPanelItems) RPanelContentLines.push(...rightPanelItems);

   writeUI_splitScreen(
      to.strSurround(ncc('Red') + `Editing - ${selectedSettingName}` + ncc(color.gray9), ' ', terminal.width - 2, 1),
      disp,
      RPanelContentLines,
      footerMsg,
      statusMsg, {
         rightPanelActive: rightPanelActive,
         redundancyLvList: [2, 0, 1]
      }
   );

   return trackers;
}



// menu page draft
/*
------------------------------------------------------
 Wuwa Editor                            version 1.2.3
░                                                    ░
░                    |--------------|                ░
░        Video       |   Graphics   |    Controll    ░
░                    |--------------|                ░
░                                                    ░
░    Save Settings    Editor Setting                 ░
░                                                    ░
░                                                    ░
░ ← → ^ v to Move, Enter to select, Ctrl+C to Exit   ░
░                                    Settings saved. ░
*/
/**
 * @param {string[]} choices
 * @param {number} selectedIndex
 * @param {string[]} statusMsg
 * @param {{itemWidth?: number,itemHeight?: number, colCount?: number, rowCount?: number}} [menuProps={}]
 */
function drawMainMenu(choices, selectedIndex, statusMsg = ['', ''], menuProps = {}){
   const bg7 = ncc(color.gray7, 'bg'),
      g7 = ncc(color.gray7),
      g3 = ncc(color.gray3),
      bg3 = ncc(color.gray3, 'bg'),
      g9 = ncc(color.gray9),
      reset = ncc(),
      g0 = ncc('Black');
   const footerMsg = `${ncc(color.mikuCyan)}← → ↑ ↓${g9} to Move, ${ncc(color.mikuCyan)}Enter${g9} to select, ${ncc(color.mikuCyan)}Ctrl+C${g9} to Exit`;
   let menuElem = [];
   const choiceLayers = choices.map(v => {
      let layers = [];
      if(v.includes('\n')) layers = [null, ...v.split('\n'), null];
      else layers = [null, null, v, null, null];

      while(layers.length < menuProps.itemHeight)
         layers.push(null);
      return layers;
   });
   const header = [' - Wuwa Editor', 'version ' + _global.version];

   const {itemWidth, itemHeight, colCount, rowCount} = menuProps;

   const rowStartOffset = Math.floor(selectedIndex / (colCount * rowCount));
   let choiceIndex = 0;
   let currLine = 0; // similar to layer but doesn't reset for each row
   let colIndex = 0;
   MenuPrep: {
      for(
         let row = rowStartOffset;
         currLine < rowCount * itemHeight;
         row++
      ){ // each choice row
         for(let layer = 0; layer < itemHeight; layer++){ // each layer in a row of choices: layer.size = itemHeight

            for(
               choiceIndex = colCount * row, colIndex = 0;
               colIndex++ < Math.min(choices.length, colCount);
               choiceIndex++
            ){
               if(!menuElem[currLine]) menuElem[currLine] = '';

               if(layer == 0||layer == itemHeight - 1){
                  if(choiceIndex == selectedIndex){
                     menuElem[currLine] += bg7 + g7 + '░'+''.padEnd(itemWidth - 2) + '░' + reset;
                  }
                  else menuElem[currLine] +=  bg3 + g3 + '░' + (' '.padEnd(itemWidth - 2))+ '░' + reset;
                  continue;
               }

               let choice = choiceLayers[choiceIndex];
               if(choiceIndex == selectedIndex){
                  menuElem[currLine] += bg7 + g7 + '░' + g0 + to.strSurround(choice?.[layer] ?? '', ' ', itemWidth - 2, 2) + g7 + '░' + reset;
               }
               else menuElem[currLine] += bg3 + g3 + '░' + g9 + to.strSurround(choice?.[layer] ?? '', ' ', itemWidth - 2, 2) + g3 + '░' + reset;
            }

            currLine++;
         }
      }
   }

   // add trimmed content indicators
   menuElem = [
      rowStartOffset != 0
         ? g7 + to.strSurround('▲', ' ', colCount * itemWidth, -1): '',
      ...menuElem,
      // here choiceIndex is the index of the last choice printed in the screen
      // but because of how for loop works, it will be 1 more than the actual index
      choiceIndex < choices.length
         ? g7 + to.strSurround('▼', ' ', colCount * itemWidth, -1): '',
   ];

   terminal.clearScreen();
   terminal.display(
      bg3 + g9 + ncc('Bright') + `░ ${to.strJustify(header, terminal.width - 4, { align: 'spacebetween', collapseLocation: 'mid', overflow: 'collapse', redundancyLv: 0 })} ░` + reset,
      'left', 0
   );

   terminal.display(
      menuElem,
      'center', 'center', {
         length: itemWidth * colCount,
      }
   );

   terminal.cursorTo(0, terminal.height - 2);
   terminal.write(bg3 + g9 + `░ ${to.strJustify(footerMsg, terminal.width - 4, {align: 'left', overflow: 'collapse', collapseLocation: 'end', redundancyLv: 0}) + g9} ░\n` +
   bg3 + g9 + `░ ${to.strJustify(statusMsg, terminal.width - 4, {align: 'spacebetween', overflow: 'collapse', collapseLocation: 'mid', redundancyLv: 0}) + g9} ░` + reset);

   // TODO: change to terminal.display() for readability: idk why this failed to print ncc('Reset') at the end
   // terminal.display(
   //    ncc(color.gray3, 'bg')+ncc(color.gray9) + `░ ${to.strJustify(footerMsg, terminal.width - 4, {align: 'left', overflow: 'collapse', collapseLocation: 'end', redundancyLv: 0})+ncc(color.gray9)} ░\n` +
   //    ncc(color.gray3, 'bg')+ncc(color.gray9) + `░ ${to.strJustify(statusMsg, terminal.width - 4, {align: 'spacebetween', overflow: 'collapse', collapseLocation: 'mid', redundancyLv: 0})+ncc(color.gray9)} ░` + ncc(),
   //    'left', 'bottom'
   // );
}



/**
 * @param {string[]} backupList
 * @param {string} footerMsg
 * @param {number} selectedIndex
 * @param {string[]} [statusMsg=['', '']]
 */
function drawRestoreBackupMenu(backupList, selectedIndex, footerMsg, statusMsg = ['', '']){
   let maxRow = terminal.height - 5;
   let halfMaxRow = maxRow >> 1;
   let disp = [];
   const terminalHalf = terminal.width >> 1;
   const backupDateS = backupList.map(v => {
      return resolveBackupTimestamp(v)
         ?.toLocaleString() ?? 'unknown';
   });
   const title = `${ncc('Bright')}Restore Backup${ncc()+ncc(color.gray3, 'bg')+ncc(color.gray9)} - choose backup to restore`;

   statusMsg[1] = `available backups: ${ncc(color.mikuCyan)+backupList.length+ncc(color.gray9)}`;

   let i = -1;
   let selDesc = null;
   for(let backupFileNames of backupList){
      i++;

      backupFileNames = to.strLimit(backupFileNames.slice(0, -4), terminalHalf - 4, 'end');

      if(selectedIndex > backupList.length - halfMaxRow){
         if(i < backupList.length - maxRow) continue;

      }else if(selectedIndex >= halfMaxRow){
         if(i < selectedIndex - halfMaxRow||i > selectedIndex + halfMaxRow) continue;
      }

      if(disp.length >= maxRow) break;

      if(i == selectedIndex){
         selDesc = ncc(color.grayB)+ncc('Bright')+ 'Backup ' + (i + 1) + ncc('Reset')+ncc(color.gray1, 'bg')+ncc(color.gray7) + '\n\n' +
            '\nTimestamp: ' + ncc(color.gray5) + backupDateS[i] + ncc(color.gray7);

         disp.push(
            ncc(color.gray1, 'bg')+ncc(color.gray7)+'░ '+ncc(color.gray3, 'bg')+ncc(color.grayB)+ncc('Bright')+to.padEnd(` •${backupFileNames}`, terminalHalf - 3, ' ', 2)+ncc('Reset')+ncc(color.gray1, 'bg')+ncc(color.gray7)+' '
         );
      }else disp.push(ncc(color.gray1, 'bg')+ncc(color.gray7)+to.padEnd(`░  ${backupFileNames}`, terminalHalf, ' ', 2));
   }

   let descLines = to.strWrap(selDesc, (terminalHalf) - 2, {mode: 'softboundery', redundancyLv: 1})
      .split('\n');

   writeUI_splitScreen(
      to.strSurround(title, ' ', terminal.width - 2),
      disp,
      descLines,
      footerMsg,
      statusMsg, {
         redundancyLvList: [1, 0, 0]
      }
   );
}




/**
 * @param {string} group
 * @param {ParsedGameSettings} settingsMap
 */
async function showSettings(group, settingsMap, settingTFIDF, settingSearchFields) {
   let selectedIndex = 0, footerMsg = '', statusMsg = ['', ''], searchQuery = '';
   let mode = 0; // 0: normal, 1: search, 2: edit
   let filteredTFIDF = [], filteredSearchFields = [];
   let filteredSettings = null, matchedSettings = null;
   let totalSSize = settingsMap.size;
   let menuInactive = false;
   /**
    * cursor position for search function; position count from the right most
    */
   let cursorPos = 0;

   matchedSettings = filteredSettings = new Map([...settingsMap].filter(([key, value], index) => {
      if(value.catergory !== group) return false;

      filteredSearchFields.push(settingSearchFields[index]);
      filteredTFIDF.push(settingTFIDF[index]);
      return true;
   }));

   updateSearchFilter();
   updateFooterStatusMsg();
   drawSettings(group, matchedSettings, selectedIndex, footerMsg, statusMsg);


   return new Promise((resolve, reject) => {
      let onKeyListener = null, resizeListener = null;
      terminal.on('key', onKeyListener = async (key, preventDefault) => {
         if(menuInactive) return;
         if(key == terminal.Keys.CTRL_C) return;

         if(mode == 1){ // search mode (after pressing Ctrl+F)
            preventDefault?.();

            if(key == terminal.Keys.ESC||key == terminal.Keys.ENTER){ // exit search mode but keep the filter
               mode = 0;
               updateFooterStatusMsg();
               drawSettings(group, matchedSettings, selectedIndex, footerMsg, statusMsg);
               terminal.allowedInputs = false;
               return;
            }

            if(key == terminal.Keys.CTRL_F){ // exit search mode and clear the filter
               mode = 0;
               searchQuery = '';
               updateSearchFilter();
               updateFooterStatusMsg();
               drawSettings(group, matchedSettings, selectedIndex, footerMsg, statusMsg);
               terminal.allowedInputs = false;
               return;
            }

            if(key == terminal.Keys.BACKSPACE){
               if(Math.abs(cursorPos) >= searchQuery.length) return;
               if(cursorPos >= 0) searchQuery = searchQuery.slice(0, -1);
               else searchQuery = to.strSplice(searchQuery, cursorPos - 1, 1);
               updateSearchFilter();

            }else if(key == terminal.Keys.DELETE){
               if(cursorPos >= 0) return;
               searchQuery = to.strSplice(searchQuery, cursorPos++, 1);
               updateSearchFilter();

            }else if(terminal.Keys.isArrow(key)){
               if(key == terminal.Keys.ARROW_LEFT&&Math.abs(cursorPos) < searchQuery.length) cursorPos--;
               else if(key == terminal.Keys.ARROW_RIGHT&&cursorPos < 0) cursorPos++;
               else return;

            }else if(key.charCodeAt(0) >= 32 && key.charCodeAt(0) <= 126){
               const splitePos = searchQuery.length + cursorPos;
               searchQuery = to.strSplice(searchQuery, splitePos, 0, key);
               updateSearchFilter();
            }

            updateFooterStatusMsg();
            drawSettings(group, matchedSettings, selectedIndex, footerMsg, statusMsg);
            return;
         }


         preventDefault?.();

         if(key == 's'||key == terminal.Keys.ARROW_DOWN){
            if(selectedIndex < matchedSettings.size - 1) selectedIndex++;
            else selectedIndex = 0;
            updateFooterStatusMsg();
            drawSettings(group, matchedSettings, selectedIndex, footerMsg, statusMsg);

         }else if(key == 'w'||key == terminal.Keys.ARROW_UP){
            if(selectedIndex > 0) selectedIndex--;
            else selectedIndex = matchedSettings.size - 1;
            updateFooterStatusMsg();
            drawSettings(group, matchedSettings, selectedIndex, footerMsg, statusMsg);

         }else if(key == terminal.Keys.ESC){
            terminal.removeListener('key', onKeyListener);
            terminal.removeListener('resize', resizeListener);
            return resolve();

         }else if(key == terminal.Keys.CTRL_F){
            mode = 1;
            cursorPos = 0;
            updateFooterStatusMsg();
            drawSettings(group, matchedSettings, selectedIndex, footerMsg, statusMsg);
            terminal.allowedInputs = true;

         }else if(key == terminal.Keys.ENTER){
            updateFooterStatusMsg(); // clear old message from showSettingEditMenu() below
            menuInactive = true;
            const msg = await showSettingEditMenu(matchedSettings, selectedIndex);
            if(msg) statusMsg[1] = msg; // <- this one
            menuInactive = false;
            drawSettings(group, matchedSettings, selectedIndex, footerMsg, statusMsg);
         }
      });

      terminal.on('resize', resizeListener = () => {
         if(menuInactive) return;
         drawSettings(group, matchedSettings, selectedIndex, footerMsg, statusMsg);
      });
   });

   function updateSearchFilter(){
      if(!searchQuery){
         matchedSettings =  filteredSettings;
         return;
      }

      const res = to.search(filteredSearchFields, searchQuery, {TF_IDFMaps: filteredTFIDF});
      if(!res) return;

      const baseLine = res[0].score * .45;
      matchedSettings = new Map();

      for(const result of res){
         if(result.score < baseLine) break;

         const match = [...filteredSettings][result.matchIndex];
         matchedSettings.set(match[0], match[1]);
      }
      selectedIndex = 0;
   }

   function updateFooterStatusMsg(){
      let query = searchQuery;

      switch(mode){
         case 0:
            footerMsg = ncc(color.mikuCyan)+' Ctrl+F'+ncc(color.gray9)+' search, '+ncc(color.mikuCyan)+'Enter'+ncc(color.gray9)+' to edit, '+ncc(color.mikuCyan)+'Esc'+ncc(color.gray9)+' to go back, '+ncc(color.mikuCyan)+'↑ ↓'+ncc(color.gray9)+' or '+ncc(color.mikuCyan)+'W S'+ncc(color.gray9)+' to move';
            break;
         case 1:
            if(query){
               if(cursorPos == 0){
                  query += ncc(color.gray6, 'bg') + ' ' + ncc(color.gray3, 'bg');

               }else{
                  query = query.slice(0, cursorPos) + ncc(color.gray6, 'bg') + query.at(cursorPos) + ncc(color.gray3, 'bg') + (cursorPos + 1?query.slice(cursorPos + 1):'');
               }
            }
            footerMsg = ncc(color.aquaPink) + 'Type' + ncc(color.gray9)+' to search, ' + ncc(color.mikuCyan)+'Esc'+ncc(color.gray9)+' or '+ncc(color.mikuCyan)+'Enter'+ncc(color.gray9)+' to exit search, '+ncc(color.mikuCyan)+'Ctrl+F'+ncc(color.gray9)+' to clear';
            break;
      }

      statusMsg = [
         ' Search: '+(searchQuery?ncc(color.mikuCyan)+query:ncc(color.gray6)+`[none]`)+ncc(color.gray9),
         ncc(color.mikuCyan)+`${matchedSettings.size+ncc(color.gray9)} of ${ncc(color.mikuCyan)+totalSSize+ncc(color.gray9)} settings `
      ];
   }
}

// I hate how long this function is
/**
 * @param {ParsedGameSettings} settingsMap
 * @returns {Promise<void|string>} message to show on statusBar below if any
 */
async function showSettingEditMenu(settingsMap, settingIndex){
   let lastSelIndex = 0, statusMsg = ['', ''];
   /**
    * cursor position for search function; position count from the right most
    */
   let cursorPos = 0;
   let selectedSetting = null;
   let selectedSettingName = null;
   let choiceIndex = 0, // which (index of) choice is currently selected
      selBindingIndex = 0; // which (index of) binding is currently selected (for bindings and axis type setting; at choiceIndexMax: reset all changes, at choiceIndexMax-1: add new binding)
   let choiceIndexMax = 0; // max index a choice can go
   let textInputMode = false;
   let textField = '';
   let textFieldPrefix = '';
   let forceApply = false;
   let currentSetStep = 1; // setting step, determine which step of setting up the value currently is
   /**@type {AxisBind|KeyBind} */
   let newBinding = null;
   let bindingInputTypePatchName = null;
   let bindingDeviceTypePatchName = null;
   let settingValueBackup = null;

   let j = 0;
   for(const [key, setting] of settingsMap){
      if(j++ != settingIndex) continue;

      selectedSettingName = key;
      selectedSetting = setting;

      switch(selectedSetting.type){
         case 'bool':
            choiceIndex = setting.value? 1: 0;
            break;
         case 'enum':
            choiceIndex = setting.value;
            break;
         case 'number':
            textField = setting.value + '';
            textFieldPrefix = 'Value' + (setting.range?.[0] != undefined?` (range ${ncc(color.mikuCyan)+setting.range[0]+ncc(color.gray6)}..${ncc(color.mikuCyan)+(setting.range[1]??'')+ncc(color.gray9)})`:'') + ': ';
            textInputMode = true;
            break;
         case 'string':
            textField = setting.value;
            textFieldPrefix = 'Value: ';
            break;
         case 'bindings':
         case 'axis':
            settingValueBackup = setting.value.map(v => v.clone());
            KBEdit_gotoStep(1);
            break;
         default:
            return 'Unsupported setting type';
      }
   }

   if(selectedSetting == null) return 'Setting not found';

   updateFooterStatusMsg0();
   drawSettingEditor(settingsMap, settingIndex, statusMsg, choiceIndex, {
      step: currentSetStep,
      selBindingIndex,
      lastSelIndex,
      bindingDeviceTypePatchName,
      bindingInputTypePatchName
   });

   return new Promise((resolve, reject) => {
      let onKeyListener = null, resizeListener = null;
      terminal.on('key', onKeyListener = async (key, preventDefault) => {
         if(key == terminal.Keys.CTRL_C) return;
         preventDefault?.();

         if(textInputMode){
            if(forceApply){
               statusMsg[1] = '';
               forceApply = false;
            }

            if(key == terminal.Keys.BACKSPACE){
               if(Math.abs(cursorPos) >= textField.length) return;
               if(cursorPos >= 0) textField = textField.slice(0, -1);
               else textField = to.strSplice(textField, cursorPos - 1, 1);

            }else if(key == terminal.Keys.DELETE){
               if(cursorPos >= 0) return;
               textField = to.strSplice(textField, cursorPos++, 1);

            }else if(terminal.Keys.isArrow(key)){
               if(key == terminal.Keys.ARROW_LEFT&&Math.abs(cursorPos) < textField.length) cursorPos--;
               else if(key == terminal.Keys.ARROW_RIGHT&&cursorPos < 0) cursorPos++;
               else return;

            }else if(key.charCodeAt(0) >= 32 && key.charCodeAt(0) <= 126){
               const splitePos = textField.length + cursorPos;
               textField = to.strSplice(textField, splitePos, 0, key);
            }
         }

         if(currentSetStep == 6){ // 6. key input mode (enter key binding with key press)
            if(key == terminal.Keys.CTRL_G){ // switch off key input mode
               KBEdit_gotoStep(4);

            }else{
               let foundKey = false;

               if(key.charCodeAt(0) >= 33 && key.charCodeAt(0) <= 126){
                  newBinding.append(key.toUpperCase(), 'keyboard');
                  foundKey = true;
               }else{
                  for(const keyMap in terminal.Keys){
                     if(terminal.Keys[keyMap] !== key) continue;

                     const translation = patch.terminalKeysTranslation[keyMap];
                     if(!translation) break;
                     newBinding.append(translation, 'keyboard');
                     foundKey = true;
                     break;
                  }
               }

               if(!foundKey)
                  statusMsg[1] = ncc('Red') + 'Invalid key' + ncc(color.gray9);
               else{
                  KBEdit_gotoStep(4);
               }
            }
         }


         switch(selectedSetting.type){
            case 'bool':
               if(key == terminal.Keys.SPACE||key == terminal.Keys.ARROW_DOWN||key == terminal.Keys.ARROW_UP)
                  choiceIndex = choiceIndex?0:1;

               else if(key == terminal.Keys.ENTER){
                  if(selectedSetting.value != choiceIndex){
                     changesBackup.set(selectedSettingName, _.cloneDeep(selectedSetting));
                     selectedSetting.value = !!choiceIndex;
                     clearListeners();
                     return resolve(
                        ncc(color.aquaPink)+selectedSettingName+ncc(color.gray9)+' updated to '+ncc(color.mikuCyan)+selectedSetting.value+ncc(color.gray9)
                     );
                  }
                  clearListeners();
                  return resolve();

               }else if(key == terminal.Keys.ESC){
                  clearListeners();
                  return resolve();
               }
               break;
            case 'enum':
               if(key == terminal.Keys.ARROW_DOWN||key == 's'){
                  if(choiceIndex < selectedSetting.eValues.length - 1) choiceIndex++;
                  else choiceIndex = 0;

               }else if(key == terminal.Keys.ARROW_UP||key == 'w'){
                  if(choiceIndex > 0) choiceIndex--;
                  else choiceIndex = selectedSetting.eValues.length - 1;

               }else if(key == terminal.Keys.ENTER){
                  if(selectedSetting.value != choiceIndex){
                     changesBackup.set(selectedSettingName, _.cloneDeep(selectedSetting));
                     selectedSetting.value = choiceIndex;
                     clearListeners();
                     return resolve(
                        ncc(color.aquaPink)+selectedSettingName+ncc(color.gray9)+' updated to '+ncc(color.mikuCyan)+selectedSetting.eValues[choiceIndex]+ncc(color.gray9)
                     );
                  }
                  clearListeners();
                  return resolve();

               }else if(key == terminal.Keys.ESC){
                  clearListeners();
                  return resolve();
               }
            case 'number':
               if(key == terminal.Keys.ENTER){
                  const num = parseFloat(textField);
                  if(isNaN(num)){
                     statusMsg[1] = ncc('Red') + 'Invalid number value' + ncc(color.gray9);
                     break;
                  }

                  if(selectedSetting.range?.[0] != undefined&&!forceApply){
                     if(num < selectedSetting.range[0]||(selectedSetting.range[1] != undefined? num > selectedSetting.range[1]: false)){
                        statusMsg[1] = ncc(color.gold) + `value out of range${ncc(color.gray9)}, press ${ncc(color.mikuCyan)}Enter${ncc(color.gray9)} to apply anyways` + ncc(color.gray9);
                        forceApply = true;
                        break;
                     }
                  }

                  if(selectedSetting.value != num){
                     changesBackup.set(selectedSettingName, _.cloneDeep(selectedSetting));
                     selectedSetting.value = num;
                     clearListeners();
                     return resolve(
                        ncc(color.aquaPink)+selectedSettingName+ncc(color.gray9)+' updated to '+ncc(color.mikuCyan)+selectedSetting.value+ncc(color.gray9)
                     );
                  }
                  clearListeners();
                  return resolve();

               }else if(key == terminal.Keys.ESC){
                  clearListeners();
                  return resolve();
               }
               break;

            case 'string':
               if(key == terminal.Keys.ENTER){
                  if(selectedSetting.value != textField){
                     changesBackup.set(selectedSettingName, _.cloneDeep(selectedSetting));
                     selectedSetting.value = textField;
                     return resolve(
                        ncc(color.aquaPink)+selectedSettingName+ncc(color.gray9)+' updated to '+ncc(color.mikuCyan)+selectedSetting.value+ncc(color.gray9)
                     );
                  }
                  clearListeners();
                  return resolve();

               }else if(key == terminal.Keys.ESC){
                  clearListeners();
                  return resolve();
               }
               break;

            case 'axis':
            case 'bindings':
               if((key == terminal.Keys.ARROW_DOWN||key == 's')&&!textInputMode){
                  if(choiceIndex < choiceIndexMax) choiceIndex++;
                  else choiceIndex = 0;

               }else if((key == terminal.Keys.ARROW_UP||key == 'w')&&!textInputMode){
                  if(choiceIndex > 0) choiceIndex--;
                  else choiceIndex = choiceIndexMax;

               }else if(key == terminal.Keys.ENTER){
                  switch(currentSetStep){
                     case 1: // 1. select, add, remove binding or reset all changes to current setting
                        if(choiceIndex == choiceIndexMax){ // reset setting
                           selectedSetting.value = settingValueBackup.map(v => v.clone());
                           statusMsg[1] = ncc('Yellow') + 'All changes discarded' + ncc(color.gray9);
                           break;
                        }

                        selBindingIndex = choiceIndex;
                        bindingInputTypePatchName = 'bindingsDeclaration';

                        if(selBindingIndex < selectedSetting.value.length){
                           newBinding = selectedSetting.value[selBindingIndex].clone();

                        }else{
                           newBinding = selectedSetting.type == 'axis'
                              ? new handler.AxisBind()
                              : new handler.KeyBind();
                        }

                        // skip to step 3 for binding type
                        KBEdit_gotoStep(selectedSetting.type == 'axis'? 2: 3);
                        break;
                     case 2: // select input type "binding", "axis" or "set scaling" (for axis binding type only)
                        if(choiceIndex == 2){ // choose set scaling
                           KBEdit_gotoStep(5);
                           break;
                        }

                        KBEdit_gotoStep(3);
                        lastSelIndex = choiceIndex;
                        break;
                     case 3: // select device type (keyboard, mouse, controller, modifier)
                        let i = 0;
                        for(const device in patch[bindingInputTypePatchName]){
                           // v skip modifier key for axis type
                           if(selectedSetting.type == 'axis'&&device == 'modifiers') continue;
                           if(i++ != choiceIndex) continue;

                           bindingDeviceTypePatchName = device;
                        }
                        lastSelIndex = choiceIndex;
                        KBEdit_gotoStep(4);
                        break;
                     case 4: { // select binding key/axis
                        let binding = null;
                        let i = 0;
                        for(const key in patch[bindingInputTypePatchName][bindingDeviceTypePatchName]){
                           if(i++ != choiceIndex) continue;
                           binding = key;
                        }

                        if(bindingDeviceTypePatchName == 'modifiers'){
                           newBinding.setModifier(binding); // w/o second arg is toggle
                        }else{
                           newBinding.append(binding, bindingDeviceTypePatchName);
                        }

                        KBEdit_gotoStep(selectedSetting.type == 'axis'? 2: 3);
                        break;
                     }
                     case 5: { // set axis scaling
                        const num = parseFloat(textField) / 100;
                        if(isNaN(num)){
                           statusMsg[1] = ncc('Red') + 'Invalid number value' + ncc(color.gray9);
                           break;
                        }

                        newBinding.scale = num;
                        KBEdit_gotoStep(2);
                        break;
                     }
                  }
               }else if(key == terminal.Keys.CTRL_ENTER){
                  if(newBinding.value == null){
                     statusMsg[1] = ncc('Red') + 'No binding selected' + ncc(color.gray9);
                     break;
                  }

                  if(selBindingIndex < selectedSetting.value.length){
                     selectedSetting.value[selBindingIndex] = newBinding;
                     statusMsg[1] = 'Binding modified';

                  }else{
                     selectedSetting.value.push(newBinding);
                     statusMsg[1] = 'Binding added';
                  }

                  newBinding = null;
                  KBEdit_gotoStep(1);


               }else if(key == terminal.Keys.BACKSPACE){ // delete a key in current binding
                  if(textInputMode) break; // text input will be handled above

                  if(newBinding.value != null){
                     newBinding.pop();
                  }
                  else if(newBinding.scale != 1){
                     newBinding.scale = 1; // we can't just delete the scale value
                  }
                  else{
                     for(const key in newBinding.modifier){
                        if(newBinding.modifier[key]){
                           newBinding.modifier[key] = false;
                           break;
                        }
                     }
                  }

                  textField = newBinding.toString();

               }else if(key == terminal.Keys.CTRL_BACKSPACE){ // delete current binding
                  if(currentSetStep != 1) break;
                  if(choiceIndex >= choiceIndexMax - 1) break; // not a binding, do nothing

                  selectedSetting.value.splice(choiceIndex, 1);
                  choiceIndexMax--;
                  statusMsg[1] = ncc(color.aquaPink) + 'Binding removed' + ncc(color.gray9);

               }else if(key == terminal.Keys.CTRL_G){ // toggle key input mode
                  if(currentSetStep != 4) break;
                  if(bindingDeviceTypePatchName !== 'keyboard') break;
                  KBEdit_gotoStep(6);

               }else if(key == terminal.Keys.ESC){
                  if(textInputMode&&currentSetStep == 5){
                     KBEdit_gotoStep(2); // exit step 5
                     break;
                  }

                  if(currentSetStep == 1){
                     clearListeners();

                     if(_.isEqual(selectedSetting.value, settingValueBackup)){
                        return resolve('');
                     }

                     const clone = _.cloneDeep(selectedSetting);
                     clone.value = settingValueBackup;

                     changesBackup.set(selectedSettingName, clone);
                     return resolve('Setting updated');
                  }

                  KBEdit_gotoStep( // skip step 2 for 'bindings' type
                     currentSetStep - ((selectedSetting.type == 'bindings'&&currentSetStep == 3)? 2: 1)
                  );
                  break;
               }
         }

         updateFooterStatusMsg0();

         lastSelIndex = drawSettingEditor(settingsMap, settingIndex, statusMsg, choiceIndex, {
            step: currentSetStep,
            lastSelIndex,
            selBindingIndex,
            bindingInputTypePatchName,
            bindingDeviceTypePatchName
         }).lastSelIndex;
      });

      terminal.on('resize', resizeListener = () => {
         drawSettingEditor(settingsMap, settingIndex, statusMsg, choiceIndex, {
            step: currentSetStep,
            lastSelIndex,
            selBindingIndex,
            bindingInputTypePatchName,
            bindingDeviceTypePatchName
         });
      });


      function clearListeners(){
         terminal.removeListener('key', onKeyListener);
         terminal.removeListener('resize', resizeListener);
      }
   });


   function KBEdit_gotoStep(step){
      currentSetStep = step;

      /**
       * to switch between steps, we need to:
       * - update currentSetStep
       * - update choiceIndexMax to match amount of items in the step
       * - update textField and textFieldPrefix if needed
       * - set textInputMode for steps that require text input
       */
      switch(step){
         case 1: // switching to 1: select, add, remove binding or apply all binding to current setting
            // addition 2 item for add new binding and apply all bindings
            choiceIndexMax = selectedSetting.value.length + 1;
            textInputMode = false;
            textField = textFieldPrefix = '';
            break;
         case 2: // switching to 2: select "binding", "axis" or "Set Scaling" (for axis type only)
            choiceIndexMax = 2; // 0 for binding, 1 for axis
            if(selBindingIndex < selectedSetting.value.length)
               textFieldPrefix = `Binding ${selBindingIndex + 1}: `;
            else
               textFieldPrefix = 'New binding: ';

            textField = newBinding.toString();

            textInputMode = false;
            break;
         case 3: // switching to 3: select device type (keyboard, mouse, controller, modifier)
            if(selBindingIndex < selectedSetting.value.length)
               textFieldPrefix = `Binding ${selBindingIndex + 1}: `;
            else
               textFieldPrefix = 'New binding: ';

            textField = newBinding.toString();

            if(selectedSetting.type == 'bindings'){
               choiceIndexMax = to.propertiesCount(patch.bindingsDeclaration) - 1;

            }else if(choiceIndex){ // 0 for binding, 1 for axis
               bindingInputTypePatchName = 'axisDeclaration';
               choiceIndexMax = to.propertiesCount(patch[bindingInputTypePatchName]) - 1;
            }else{
               bindingInputTypePatchName = 'bindingsDeclaration';
               // v minus 2 because we don't want to include 'modifiers' option
               choiceIndexMax = to.propertiesCount(patch[bindingInputTypePatchName]) - 2;
            }

            textInputMode = false;
            break;
         case 4: // switching to 4: select binding key/axis
            if(selBindingIndex < selectedSetting.value.length)
               textFieldPrefix = `Binding ${selBindingIndex + 1}: `;
            else
               textFieldPrefix = 'New binding: ';
            choiceIndexMax = to.propertiesCount(patch[bindingInputTypePatchName][bindingDeviceTypePatchName]) - 1;
            textField = newBinding.toString();
            textInputMode = false;
            break;
         case 5: // switching to 5: set axis scaling
            textField = (newBinding.scale * 100) + '';
            textFieldPrefix = 'Scale (-100..100): ';
            textInputMode = true;
            break;
         case 6: // switching to 6: key input mode
            textField = '';
            textFieldPrefix = 'Waiting for key press...';
            textInputMode = false;
            break
      }

      choiceIndex = 0;
   }


   function updateFooterStatusMsg0(){
      let input = textField;
      if(input&&textInputMode){
         if(cursorPos == 0){
            input += ncc(color.gray6, 'bg') + ' ' + ncc(color.gray3, 'bg');

         }else{
            input = input.slice(0, cursorPos) + ncc(color.gray6, 'bg') + input.at(cursorPos) + ncc(color.gray3, 'bg') + (cursorPos + 1?input.slice(cursorPos + 1):'');
         }
      }

      const blank = textInputMode?ncc(color.gray6, 'bg')+' '+ncc(color.gray3, 'bg'):'';
      statusMsg[0] = textFieldPrefix+(textField?ncc(color.mikuCyan)+input:blank)+ncc(color.gray9);
   }
}


/**
 * @param {Map} settingsMap
 * @param {object} patch
 */
async function showMainMenu(settingsMap, patch, settingTFIDF, settingSearchFields){
   const settingGroups = [
      ...Object.keys(patch.options), '[Uncategorized]',
      '📥\nSave Settings', `♻️\n${ncc('Red')}Revert Changes`,
      '📚\nRestore Backup', /*'⚙️\nEditor Settings',*/ // TODO: add editor settings later
      '🌱\nExit'
   ];

   const itemWidth = settingGroups.reduce((prev, curr) => {
      if(curr.includes('\n')){
         for(const line of curr.split('\n')){
            if(to.ex_length(line, 2) > prev) prev = to.ex_length(line, 2);
         }
         return prev;
      }

      const currLen = to.ex_length(curr, 2);
      return prev > currLen? prev: currLen;
   }, 0) + 4;
   const itemHeight = 5;
   let colCount = 0;
   let rowCount = 0;
   let selectedIndex = 0;
   let inOtherMenu = false;
   let statusMsg = ['', ''];

   calMenuGridSize();

   // terminal.log(itemWidth, itemHeight, colCount, rowCount)

   drawMainMenu(settingGroups, selectedIndex, statusMsg, {
      itemWidth, itemHeight, colCount, rowCount
   });

   return new Promise((resolve, reject) => {
      let onKeyListener = null, resizeListener = null;
      terminal.on('key', onKeyListener = async (key, preventDefault) => {
         if(inOtherMenu) return;
         preventDefault?.();

         KeySwitch: switch(key){
            case terminal.Keys.ARROW_LEFT:
            case 'a':
               if(selectedIndex > 0) selectedIndex--;
               break;
            case terminal.Keys.ARROW_UP:
            case 'w':
               if(selectedIndex >= colCount) selectedIndex -= colCount;
               break;
            case terminal.Keys.ARROW_RIGHT:
            case 'd':
               if(selectedIndex < settingGroups.length - 1)
                  selectedIndex++;
               break;
            case terminal.Keys.ARROW_DOWN:
            case 's':
               if(
                  settingGroups.length - selectedIndex - 1 >= colCount ||
                  settingGroups.length % colCount > 0
               ) selectedIndex = Math.min(selectedIndex + colCount, settingGroups.length - 1);
               break;
            case terminal.Keys.ENTER:
               statusMsg = ['', ''];
               switch(selectedIndex - to.propertiesCount(patch.options)){
                  // negative and 0 index for each settings category and [Uncategorized]
                  case 1: // save settings
                     {
                        const code = await writeSettings();
                        if(!code){
                           statusMsg[0] = 'Settings saved. changes will take effect after restarting the game';
                        }
                        else if(code == 1){
                           statusMsg[0] = ncc('Red') + `The Game is running, please close it and try again.` + ncc(color.gray9);
                        }
                        else if(code == 2){
                           statusMsg[0] = ncc('Red') + `Error while writing, see log for more info.` + ncc(color.gray9);
                        }
                        break KeySwitch;
                     }

                  case 2: // revert changes
                     if(!changesBackup.size){
                        statusMsg[0] = 'No changes to revert';
                        break KeySwitch;
                     }

                     for(const [key, value] of changesBackup){
                        settings.parsed.set(key, value);
                     }
                     changesBackup.clear();
                     statusMsg[0] = 'Changes reverted';
                     break KeySwitch;
                  case 3: // restore backup
                     inOtherMenu = true;
                     statusMsg[0] = await showRestoreBackupMenu() ?? '';
                     inOtherMenu = false;
                     break KeySwitch;
                  case 4: // exit
                     const exitMsg = await exitProgram();
                     if(exitMsg) statusMsg[0] = exitMsg;
                     break KeySwitch;
               }

               inOtherMenu = true;
               await showSettings(
                  settingGroups[selectedIndex],
                  settingsMap, settingTFIDF, settingSearchFields
               );
               inOtherMenu = false;
               statusMsg[1] = changesBackup.size + ' unsaved changes'
         }

         drawMainMenu(settingGroups, selectedIndex, statusMsg, {
            itemWidth, itemHeight, colCount, rowCount
         });
      });

      terminal.on('resize', resizeListener = () => {
         if(inOtherMenu) return;

         calMenuGridSize();
         drawMainMenu(settingGroups, selectedIndex, statusMsg, {
            itemWidth, itemHeight, colCount, rowCount
         });
      });
   });

   function calMenuGridSize(){
      colCount = Math.min(Math.floor(terminal.width / itemWidth), 3);
      rowCount = Math.ceil(Math.min(
         (settingGroups.length / colCount),
         ((terminal.height * .4) / itemHeight)
      ));
   }
}




async function showRestoreBackupMenu(){
   const backupFileNames = getBackupList();

   const footerMsg = `${ncc(color.mikuCyan)}← → ↑ ↓${ncc(color.gray9)} to Move, ${ncc(color.mikuCyan)}Enter${ncc(color.gray9)} to ${ncc('Red')}restore selected${color.gray9},  `+ncc(color.mikuCyan)+'Esc'+ncc(color.gray9)+' to go back';
   let selectedIndex = 0, statusMsg = ['', ''];
   let restoring = false;
   let awitConfirm = false;


   drawRestoreBackupMenu(backupFileNames, selectedIndex, footerMsg, statusMsg);

   return new Promise((resolve, reject) => {
      let onKeyListener = null, resizeListener = null;
      terminal.on('key', onKeyListener = async (key, preventDefault) => {
         if(key == terminal.Keys.CTRL_C) return;

         preventDefault?.();

         if(restoring) return;

         if(key == 's'||key == terminal.Keys.ARROW_DOWN){
            if(selectedIndex < backupFileNames.length - 1) selectedIndex++;
            else selectedIndex = 0;
            drawRestoreBackupMenu(backupFileNames, selectedIndex, footerMsg, statusMsg);

         }else if(key == 'w'||key == terminal.Keys.ARROW_UP){
            if(selectedIndex > 0) selectedIndex--;
            else selectedIndex = backupFileNames.length - 1;
            drawRestoreBackupMenu(backupFileNames, selectedIndex, footerMsg, statusMsg);

         }else if(key == terminal.Keys.ESC){
            if(awitConfirm){
               awitConfirm = false;
               statusMsg[0] = '';
               drawRestoreBackupMenu(backupFileNames, selectedIndex, footerMsg, statusMsg);
               return;
            }

            terminal.removeListener('key', onKeyListener);
            terminal.removeListener('resize', resizeListener);
            return resolve();

         }else if(key == terminal.Keys.ENTER){
            doRestore: {
               if(await isProcessRunning(config.gameClientName)){
                  statusMsg[0] = ncc('Red') + 'The Game is running, please close it and try again.' + ncc(color.gray9);
                  break doRestore;
               }

               if(!awitConfirm){
                  awitConfirm = true;
                  statusMsg[0] = ncc('Red') + 'this action cannot be undone'+ncc(color.gray9)+', press Enter again to confirm';
                  break doRestore;
               }

               restoring = true;
               statusMsg[0] = 'Restoring...';
               restoreBackup(backupFileNames[selectedIndex]).then(success => {
                  restoring = false;

                  if(!success){
                     statusMsg[1] = ncc('Red') + 'restore failed' + ncc(color.gray9);
                     drawRestoreBackupMenu(backupFileNames, selectedIndex, footerMsg, statusMsg);
                     return;
                  }

                  terminal.removeListener('key', onKeyListener);
                  terminal.removeListener('resize', resizeListener);
                  return resolve('Restore successful');
               });
            }

            drawRestoreBackupMenu(backupFileNames, selectedIndex, footerMsg, statusMsg);
         }
      });

      terminal.on('resize', resizeListener = () => {
         drawRestoreBackupMenu(backupFileNames, selectedIndex, footerMsg, statusMsg);
      });
   });
}





function loadPatch() {
   writeLog(`Loading patch.json...`, 3, true);

   try {
      patch = JSON.parse(fs.readFileSync(config.patchJSONLocation, { encoding: 'utf-8' }));
   } catch (e) {
      writeLog(`Error loading patch file: ${e.message}`, 1, true);
      hasErrorOrWarning = true;
      return;
   }


   for(const src in patch.configSrcMap){
      const manifest = patch.configSrcMap[src].manifest;
      if(!manifest) continue;
      if(typeof manifest.Replacer != 'string' || typeof manifest.Reviver != 'string') continue;

      // LINK: @jdn34 Replacer/Reviver syntax
      if(manifest.Replacer){
         if(manifest.Replacer === 'none'){
            manifest.Replacer = null;
            continue;
         }

         if(manifest.Replacer === 'default')
            manifest.Replacer = to.JSONReplacer;
         else if(manifest.Replacer.startsWith('$func:')){
            manifest.Replacer = createJSONReviver(manifest.Replacer);
         }
         else{
            writeLog(`Invalid Replacer for "${src}"`, 1, true);
            writeLog(`Manifest: ${to.yuString(manifest)}`, 1);
            manifest.Replacer = null;
            hasErrorOrWarning = true;
            continue;
         }
      }
      if(manifest.Reviver){
         if(manifest.Reviver === 'none'){
            manifest.Reviver = null;
            continue;
         }

         if(manifest.Reviver === 'default')
            manifest.Reviver = to.JSONReviver;

         else if(manifest.Reviver.startsWith('$func:')){
            manifest.Reviver = createJSONReviver(manifest.Reviver);
         }
         else{
            writeLog(`Invalid Reviver for "${src}"`, 1, true);
            writeLog(`Manifest: ${to.yuString(manifest)}`, 1);
            manifest.Reviver = null;
            hasErrorOrWarning = true;
            continue;
         }
      }
   }
}


function verifyGamePath(gamePath) {
   writeLog(`Verifying game paths...`, 3, true);

   if (!gamePath) {
      writeLog(`Game folder is not set. Please set it in the config file or run the game first.`, 1, true);
      return false;
   }

   if (!fs.existsSync(gamePath)) {
      writeLog(`Game folder not found. Please check the path and try again.`, 1, true);
      return false;
   }

   if (!patch?.configSrcMap || typeof patch.configSrcMap !== 'object') {
      writeLog(`'patch.configSrcMap' is invalid or missing in patch.json`, 1, true);
      return false;
   }

   let passCount = 0;
   for (const src in patch.configSrcMap) {
      const relPath = patch.configSrcMap[src].path;

      if (!relPath) {
         writeLog(`can't find path for "${src}"`, 2, true);
         continue;
      }

      const fullPath = path.resolve(gamePath, relPath);
      if (!fs.existsSync(fullPath)) {
         writeLog(`can't find file "${fullPath}"`, 2, true);
         continue;
      }

      try{
         fs.accessSync(fullPath, fs.constants.W_OK);
      }catch(e){
         writeLog(`can't write to file "${fullPath}", premission denied.`, 1, true);
         continue;
      }
      passCount++;
   }

   if (!passCount) {
      writeLog(
         `Can't find any files in the game folder. Please check the path and try again.`, 1, true
      );
      return false;
   }
   else if (passCount < to.propertiesCount(patch.configSrcMap)) {
      writeLog(`Some file(s) are missing but we can work with the rest.`, 2, true);
      hasErrorOrWarning = true;
   }

   return true;
}


async function loadSettings() {
   writeLog(`Loading settings...`, 3, true);
   settings.raw = new Map();
   settings.parsed = new Map();
   settings.allRawSettings = new Map();

   for (const src in patch.configSrcMap) {
      const relPath = patch.configSrcMap[src].path;
      const fullPath = path.resolve(config.gameInstalledPath, relPath);

      let rawSettings = null;
      switch (patch.configSrcMap[src].dataType) {
         case 'ini':
            rawSettings = await handler.loadIniKeyVal(fullPath, patch.configSrcMap[src]);
            break;
         case 'KBTupleMap':
            rawSettings = await handler.loadKBTupleMap(fullPath, patch.configSrcMap[src]);
            break;
         case 'JSON':
            rawSettings = await handler.loadJSON(fullPath, patch.configSrcMap[src]);
            break;
         default:
            writeLog(`Invalid dataType "${patch.configSrcMap[src].type}" for "${src}"`, 2, true);
            hasErrorOrWarning = true;
            continue;
      }

      if (!rawSettings) {
         writeLog(`Failed to load "${src}" continue...`, 2, true);
         writeLog('failed reason: `rawSetting` is null', 2);
         hasErrorOrWarning = true;
         continue;
      }

      settings.allRawSettings.set(src, {
         dataType: patch.configSrcMap[src].dataType,
         value: rawSettings,
         src
      });

      for(const group in rawSettings){
         for (const key in rawSettings[group]) {
            const value = rawSettings[group][key];
            settings.raw.set(key, { src, value, group });
         }
      }
   }
   parseSettings();

   const settingSearchFields = [];
   const settingTFIDF = to.DataScienceKit.TFIDF_of(
      [...settings.parsed].map(([key, value]) => {
         settingSearchFields.push(key + ' ' + (value.description??'') + ' ' + (value.key??''));
         return to.cleanArr([
            ...key.split(/\s/g),
            ...(value.description? value.description.split(/\s/g): ''),
            (value.key ?? '')
         ]);
      }),
   );

   writeLog(`Loaded ${settings.parsed.size} settings from ${settings.allRawSettings.size} sources.`, 3, true);

   return {
      settingTFIDF,
      settingSearchFields
   };
}



async function parseSettings() {
   const combineActionMap = settings.allRawSettings.get('combinedAction')?.value?.CombineAction;

   for(const catergory in patch.options){
      for(const optName in patch.options[catergory]){
         const optDecl = patch.options[catergory][optName];

         if(!optDecl.src || !optDecl.key || patch.configSrcMap[optDecl.src].usedAsRaw) continue;

         /**
          * @type {ParsedGameSettingObj}
          */
         let parsedValue = null;
         const rawSettings = settings.allRawSettings.get(optDecl.src);

         if(!rawSettings) continue;

         /**
          * config file content type (e.g. ini-keyValue, KBTupleMap, sqlite)
          */
         const optionDataType = patch.configSrcMap[optDecl.src].dataType;

         switch (optionDataType) {
            case 'JSON': // same as 'ini'
            case 'ini':
               parsedValue = handler.parseIniKeyVal(
                  rawSettings.value,
                  optDecl.key,
                  rawSettings.src
               );
               break;
            case 'KBTupleMap':
               parsedValue = handler.parseKBTupleMap(
                  rawSettings.value,
                  optDecl.key,
                  patch,
                  combineActionMap
               );
               break;
            default:
               writeLog(`Invalid type "${patch.configSrcMap[optDecl.src].type}" for "${optDecl.src}"`, 2, true);
               continue;
         }

         if(!parsedValue){
            writeLog(`Failed to parse "${optName}" with type "${optionDataType}"`, 2, true);
            writeLog('failed reason: `parsedValue` is null', 2);
            hasErrorOrWarning = true;
            continue;
         }

         parsedValue.src = optDecl.src;
         parsedValue.key = optDecl.key;
         parsedValue.description = optDecl.description;
         parsedValue.catergory = catergory;
         if(optDecl.type) parsedValue.type = optDecl.type;
         if(optDecl.values) parsedValue.eValues = optDecl.values;
         if(optDecl.range) parsedValue.range = optDecl.range;
         if(optDecl.editNote) parsedValue.editNote = optDecl.editNote;
         if(optDecl.valueDesc) parsedValue.valueDesc = optDecl.valueDesc;
         if(optDecl.default !== undefined) parsedValue.default = optDecl.default;
         if(optDecl.editable != null) parsedValue.editable = optDecl.editable;

         settings.parsed.set(optName, parsedValue);
      }
   }

   for(const [key, rSetting] of settings.raw){
      let alreadyParsed = false;
      for(const [/*optName*/, parsed] of settings.parsed){
         if(parsed.key == key&&parsed.src == rSetting.src){
            alreadyParsed = true;
            if(parsed.editable == false)
               settings.parsed.delete(key);
            break;
         }
      }
      if(alreadyParsed||patch.configSrcMap[rSetting.src].usedAsRaw) continue;

      /**
       * @type {ParsedGameSettingObj}
       */
      let parsedValue = null;
      let srcConfig = settings.allRawSettings.get(rSetting.src);

      switch (srcConfig.dataType) {
         case 'JSON': // same as 'ini'
         case 'ini':
            parsedValue = handler.parseIniKeyVal(
               srcConfig.value,
               key,
               srcConfig.src
            );
            break;
         case 'KBTupleMap':
            parsedValue = handler.parseKBTupleMap(
               srcConfig.value,
               key,
               patch,
               combineActionMap
            );
            break;
         default:
            writeLog(`Invalid type "${srcConfig.dataType}" in \`allRawSettings\``, 2, true);
            writeLog(`\`srcConfig\`: ${to.yuString(srcConfig)}`, 2);
            continue;
      }

      if(!parsedValue){
         writeLog(`Failed to parse "${key}" with type "${srcConfig.dataType}"`, 2, true);
         writeLog('failed reason: `parsedValue` is null', 2);
         hasErrorOrWarning = true;
         continue
      }

      parsedValue.src = rSetting.src;
      parsedValue.key = key;
      parsedValue.group = rSetting.group;
      parsedValue.catergory = '[Uncategorized]';

      settings.parsed.set(key, parsedValue);
   }
}


/**
 * write settings to the game config files
 * return success status
 */
async function writeSettings(){
   if(!settings.parsed||changesBackup.size == 0) return -1; // no changes to write
   if(await isProcessRunning(config.gameClientName)) return 1; // game is running

   writeLog(`Writing settings to Game src config...`, 3);
   writeLog(`Changes ${to.yuString(changesBackup)}`, 4);

   /**
    * @type {Map<string, Map<string, ParsedGameSettingObj>>}
    */
   let settingsBySrc = new Map();
   for(const [key, parsed] of settings.parsed){
      if(!settingsBySrc.has(parsed.src)) settingsBySrc.set(parsed.src, new Map);
      settingsBySrc.get(parsed.src).set(key, parsed);
   }

   for(const [src, _settings] of settingsBySrc){
      const relPath = patch.configSrcMap[src].path;
      const fullPath = path.resolve(config.gameInstalledPath, relPath);

      const srcConfig = settings.allRawSettings.get(src);
      if(!srcConfig) continue;

      try {
         switch(srcConfig.dataType){
            case 'JSON':
            case 'ini':
               await handler.writeIniKeyVal(fullPath, patch.configSrcMap[src], _settings);
               break;
            case 'KBTupleMap':
               await handler.writeKBTupleMap(fullPath, _settings, patch, settings.allRawSettings);
               break;
            default:
               writeLog(`Invalid dataType "${patch.configSrcMap[src].dataType}" for "${src}"`, 2);
               continue;
         }
      }
      catch(e){
         writeLog(`Error writing to "${fullPath}"`, 1);
         writeLog(to.yuString(e), 1);
         return 2;
      }
   }

   changesBackup.clear();
   return 0;
}


/**
 * a wrapper for doShutdownTask() to handle unsaved changes
 */
async function exitProgram(){
   if(changesBackup.size){
      const choice = await terminal.promptChoice(['Yes!', 'Discard & exit', 'I\'m not done yet'], {
         display: 'full',
         msg: `${ncc('Red')}There are unsaved changes, do you want to save before exit?${ncc('Reset')}`
      });

      if(choice == 2){
         terminal.emit('resize'); // restore previous page by faking a resize event
         return;
      }

      if(choice == 0){
         const code = await writeSettings();

         switch(code){
            case 0:
               return 'Settings saved. changes will take effect after restarting the game';
            case 1:
               terminal.emit('resize');
               return ncc('Red') + `The Game is running, please close it and try again.` + ncc(color.gray9);
            case 2:
               terminal.emit('resize');
               return ncc('Red') + `Error while writing, see log for more info.` + ncc(color.gray9);
         }
      }
   }

   doShutdownTask();
}


/**
 * backup the game config files
 */
async function backupGameConfigSrc(){
   let filesNeedBackup = [];

   for(let src in patch.configSrcMap){
      const relPath = patch.configSrcMap[src].path;
      filesNeedBackup.push(relPath);
   }

   let backupPath = null;
   try{
      backupPath = await createBackup(filesNeedBackup);
   }
   catch(e){
      writeLog(`error while creating backup: ${to.yuString(e)}`, 1, true);
      hasErrorOrWarning = true;
      return;
   }

   if(backupPath){
      writeLog(`Created Backup to "${backupPath}"`, 3, true);
   }
}


/**
 * prompt user for game install path
 */
async function promptForGamePath() {
   terminal.log(
      `Please enter game installation folder. (e.g. C:\\Wuthering Waves)
the given folder should contains:
- folder: ${ncc(color.mikuCyan)}Wuthering Waves Game${ncc('Reset')}
- folder: ${ncc(color.mikuCyan)}translations${ncc('Reset')}
- executable: ${ncc(color.gold)}launcher.exe
${ncc(color.mikuCyan)}...${ncc('Reset')}`
   );

   let gPath;
   while(true){
      gPath = await terminal.prompt('Enter game folder: ');
      if(!gPath?.trim()?.length){
         terminal.log(
            `${ncc('Red')}[error]${ncc()} Folder path can't be empty.`
         );
         continue;
      };

      if(gPath.startsWith('"')&&gPath.endsWith('"'))
         gPath = gPath.slice(1, -1);

      gPath = path.normalize(gPath);
      if(!fs.existsSync(gPath)){
         terminal.log(
            `${ncc('Red')}[error]${ncc()} Folder not found or path is invalid, please try again.`
         );
         continue;
      }

      if(!fs.existsSync(path.join(gPath, 'Wuthering Waves Game'))){
         terminal.log(
            `${ncc('Red')}[error]${ncc()} Game folder not found, please check the path and try again.`
         );
         continue;
      }

      break;
   }

   config.gameInstalledPath = gPath;
}



async function doStartupTask(){
   // @ts-expect-error could not find module
   isElevated = (await import('is-elevated')).default;

   if(_global.isThisProcessElevated === null){
      _global.isThisProcessElevated = await isElevated();
   }

   openLogFile();

   writeLog(`WuWa Editor Starting...\nCurrent machine date is: ${new Date()}`);
   loadPatch();
}

/**
 * cleanup and exit the program
 * @returns {never|void}
 */
function doShutdownTask(exitCode = 0){
   if(shuttingDown) return;
   writeLog(`Shutting down...\n\n\n\n`);

   shuttingDown = true;
   closeLogFile();

   if(exitCode == 0){
      terminal.clearScreen();
      config.writeConfig();
   }
   terminal.close();

   process.exit(exitCode);
}
