const fs = require('fs');
const assert = require('assert');
const path = require('path');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const _ = require('lodash');

const to = require('./helper/Tools.js');
const terminal = require('./term.js');
const { color } = require('./global.js');
const { predicate, writeLog } = require('./utilities.js');
const config = require('./config.js');

const { ncc } = to;

to._modules.fs = fs;

/**
 * JSDoc imports - don't remove
 * @import {
      ParsedGameSettingObj,
      Keys, Axis,
      GameSettingPatch,
      SettingSrcMetadata,
      DeviceTypes, DeviceTypesWithModifiers,
      BindingGroups,
      ParsedGameSettings,
      AllRawSettings
 * } from './editor.js'
 */

/**
 * @typedef {{
 * [group: string]: {
 *    [key: string]: {
 *       type: 'ActionMappings'|'AxisMappings',
 *       values: {[key: string]: string}[]
 *    }
 * }}} SrcKBTupleMap
*/

/**
 * @typedef {object} KeyBind
 * @property {(Keys)|(Keys)[]} value key value
 * @property {'keyboard'|'mouse'|'controller'} type device type (e.g. keyboard, mouse, controller)
 * @property {{Cmd: boolean, Alt: boolean, Shift: boolean, Ctrl: boolean}} modifier
 * @property {(key: 'Cmd'|'Alt'|'Shift'|'Ctrl', value: boolean) => void} setModifier
 * @property {(newValue: Keys|(Keys)[], typeRef: 'keyboard'|'mouse'|'controller'|GameSettingPatch) => void} set
 * @property {() => string} toString
 * @property {(key: Keys|(Keys)[], typeRef: 'keyboard'|'mouse'|'controller'|GameSettingPatch) => void} append
 * @property {() => Keys|null} pop
 * @property {() => KeyBind} clone
 */
class KeyBind {
   /**
    * key value
    * @type {(Keys)|(Keys)[]}
    */
   value = null;
   /**
    * device type (e.g. keyboard, mouse, controller)
    * @type {DeviceTypes}
    */
   type = null;
   modifier = {
      Cmd: false,
      Alt: false,
      Shift: false,
      Ctrl: false,
   };

   setModifier(key, value = !this.modifier[key]){
      if(this.type !== 'keyboard'){
         this.type = 'keyboard';
         this.value = null;
      }

      this.modifier[key] = value;
   }

   /**
    * set key(s) as KeyBind value
    * @param {Keys|(Keys)[]} newValue
    * @param {DeviceTypes|GameSettingPatch} typeRef
    */
   set(newValue, typeRef){
      this.value = newValue;

      this.type = [this.#resolveType(typeRef)];
   }


   /**
    * append a new key to the keybind
    * @param {Keys|(Keys)[]} key
    * @param {DeviceTypes|GameSettingPatch} typeRef
    */
   append(key, typeRef){
      const currType = this.#resolveType(typeRef);

      if(currType !== this.type){
         this.type = currType;
         this.value = null;
      }

      if(!this.value) this.value = [];

      if(key instanceof Array) this.value.push(...key);
      else {
         if(this.value instanceof Array) this.value.push(key);
         else this.value = [this.value, key];
      }
   }

   /**
    * return the last key from the keybind and remove it
    * @returns {Keys|null}
    */
   pop(){
      let removedValue = null;

      if(this.value instanceof Array){
         removedValue = this.value.pop();
         if(this.value.length <= 0) this.value = null;
         return removedValue;
      }

      removedValue = this.value;
      this.value = null;
      return removedValue;
   }

   /**
    * clone the KeyBind object
    * @returns {KeyBind}
    */
   clone(){
      const clone = new KeyBind();
      clone.value = _.cloneDeep(this.value);
      clone.type = this.type;
      clone.modifier = {...this.modifier};
      return clone;
   }

   toString(){
      const _type =
         this.type === 'keyboard' ? '⌨️ Keyb.' : (
            this.type === 'mouse' ? '🖱️ Mouse' : (
               this.type === 'controller' ? '🎮 Cont.': ''));

      if(this.value instanceof Array){
         return ncc(color.gold)+`${_type} ${ncc(color.gray5)}${ncc(color.aquaPink)}${this.modifier.Ctrl?'Ctrl+':''}${this.modifier.Shift?'Shift+':''}${this.modifier.Alt?'Alt+':''}${this.modifier.Cmd?'⌘+':''}` +
            this.value.map(v => `${(v?ncc(color.gray9)+v:ncc(color.gray6)+'[empty]')+ncc(color.gray7)}`).join(' + ');
      }
      return ncc(color.gold)+`${_type} ${ncc(color.gray5)}${ncc(color.aquaPink)}${this.modifier.Ctrl?'Ctrl+':''}${this.modifier.Shift?'Shift+':''}${this.modifier.Alt?'Alt+':''}${this.modifier.Cmd?'⌘+':''}${(this.value?ncc(color.gray9)+this.value:ncc(color.gray6)+'[empty]')+ncc(color.gray7)}`;
   }

   /**
    * resolve type of this keybind
    * @param {DeviceTypes|GameSettingPatch} typeRef
    */
   #resolveType(typeRef){
      let _type = null;

      if(typeof typeRef !== 'string'){
         for(const device in typeRef.bindingsDeclaration){
            if(device === 'keyboard'||device === 'modifiers') continue;

            if(typeRef.bindingsDeclaration[device][newValue] !== undefined){
               _type = device;
               break;
            }

            if(_type) break;
         }
         if(!_type) return 'keyboard';
      }else{
         switch (typeRef) {
            case 'keyboard':
            case 'mouse':
            case 'controller':
               _type = typeRef;
               break;
            default:
               return 'keyboard';
         }
      }

      if(_type !== 'keyboard'){
         this.modifier = {
            Cmd: false,
            Alt: false,
            Shift: false,
            Ctrl: false,
         };
      }

      return _type;
   }

   constructor(value = null, type = null){
      this.value = value;
      this.type = type;
   }
}

/**
 * @typedef {object} AxisBind
 * @property {(Axis)} value key value
 * @property {DeviceTypes} type device type (e.g. keyboard, mouse, controller)
 * @property {number} scale
 * @property {(newValue: Axis, typeRef: DeviceTypes|GameSettingPatch) => void} set
 * @property {() => string} toString
 * @property {(value: Axis, typeRef: DeviceTypes|GameSettingPatch) => void} append
 * @property {() => Axis|null} pop
 * @property {() => AxisBind} clone
 */
class AxisBind {
   /**
    * key value
    * @type {(Axis)}
    */
   value = null;
   /**
    * device type (e.g. keyboard, mouse, controller)
    * @type {DeviceTypes}
    */
   type = null;
   scale = 1;

   /**
    * @param {Axis} newValue
    * @param {DeviceTypes|GameSettingPatch} typeRef
    */
   set(newValue, typeRef){
      this.value = newValue;

      this.type = this.#resolveType(typeRef);
   }

   /**
    * @param {Axis} value
    * @param {DeviceTypes|GameSettingPatch} typeRef
    */
   append(value, typeRef){
      // keep the same name for both Class to avoid writing checks wether it's AxisBind or KeyBind
      this.set(value, typeRef);
   }

   /**
    * return current Axis value then clear it
    *
    * (this function should be named `clear()` but I'm not doing it)
    * @returns {Axis|null}
    */
   pop(){
      let removedValue = this.value;
      this.value = null;
      return removedValue;
   }

   /**
    * clone the AxisBind object
    * @returns {AxisBind}
    */
   clone(){
      const clone = new AxisBind();
      clone.value = _.cloneDeep(this.value);
      clone.type = this.type;
      clone.scale = this.scale;
      return clone;
   }

   toString(){
      const _type =
         this.type === 'keyboard' ? '⌨️ Keyb.' : (
            this.type === 'mouse' ? '🖱️ Mouse' : (
               this.type === 'controller' ? '🎮 Cont.': ''));

      if(this.value instanceof Array){
         throw new Error('AxisBind cannot have multiple values!');
      }
      return ncc(color.gold)+`${_type} ${ncc(color.gray5)}${ncc(color.aquaPink)}${this.scale * 100}% ${(this.value?ncc(color.gray9)+this.value:ncc(color.gray6)+'[empty]')+ncc(color.gray7)}`;
   }

   /**
    * resolve the type of the keybind
    * @param {DeviceTypes|GameSettingPatch} typeRef
    */
   #resolveType(typeRef){
      let _type = null;

      if(typeof typeRef !== 'string'){
         for(const device in typeRef.bindingsDeclaration){
            if(device === 'keyboard'||device === 'modifiers') continue;

            for(const key in typeRef.bindingsDeclaration[device]){
               if(typeRef.bindingsDeclaration[device][newValue] !== undefined){
                  _type = device;
                  break;
               }
            }

            if(_type) break;
         }
         if(!_type) return 'keyboard';
      }else{
         switch (typeRef) {
            case 'keyboard':
            case 'mouse':
            case 'controller':
               _type = typeRef;
               break;
            default:
               return 'keyboard';
         }
      }

      return _type;
   }

   constructor(value = null, type = null){
      this.value = value;
      this.type = type;
   }
}






/**
 * @param {string} configPath full path to the config file
 */
function readPlainText(configPath){
   try {
      return fs.readFileSync(configPath, { encoding: 'utf-8' });
   }
   catch (e) {
      writeLog(`Error reading config from "${configPath}": ${e.message}`, 1, true);
      writeLog(to.yuString(e), 2);
      return null;
   }
}

/**
 * @param {string} filePath full path to the database file
 * @param {SettingSrcMetadata} settingSrc
 * @returns {Promise<string[]|null>}
 */
async function readSQLite(filePath, settingSrc){
   if(settingSrc.manifest?.selectedTable === undefined){
      writeLog(`unable to read from SQLite database: missing "selectedTable" property in source metadata`, 2, true);
      writeLog(`Manifest: ${to.yuString(settingSrc.manifest)}`, 2);
      return null;
   }

   if(!(settingSrc.manifest?.acceptedGroups?.length)){
      writeLog(`unable to read from SQLite database: missing "acceptedGroups" property in source metadata`, 2, true);
      writeLog(`Manifest: ${to.yuString(settingSrc.manifest)}`, 2);
      return null;
   }

   if(filePath.startsWith('.'))
      filePath = path.resolve(config.gameInstalledPath, filePath);

   /**
    * @type {sqlite3.Database}
    */
   let db = null;
   let rawSettings = [];
   try {
      writeLog(`Opening SQLite database from "${filePath}"`);
      db = await open({
         filename: filePath, // absolute path only!
         driver: sqlite3.Database
      });

      for(const group of settingSrc.manifest.acceptedGroups){
         writeLog(`executing SQL: \`SELECT value FROM ${settingSrc.manifest.selectedTable} WHERE key == \'${group}\'\``, 4);

         const result = await db.all(
            `SELECT value FROM ${settingSrc.manifest.selectedTable} WHERE key == \'${group}\'`
         );

         if(!result.length){
            writeLog(
               `SQLite failed to resolve setting from "${filePath}"`,
               2, true
            );
            writeLog('failed reason: "no result"', 2);
            return null;
         }

         // TODO: unable to parse some custom object like `sqlite3.Database`
         writeLog(`query result: ${to.yuString([...result])}`);
         rawSettings.push(result[0]);
      }

      return rawSettings.map(res => res.value);

   } catch (e) {
      writeLog(
         `Error loading SQLite from "${filePath}": ${e.message}`,
         2, true
      );
      writeLog(to.yuString(e), 2);
      return null;

   } finally {
      writeLog('Closing SQLite database');
      db.close();
   }
}



/**
 * load `ini` dataType config file
 * @param {string} configPath full path to the config file
 * @param {SettingSrcMetadata} settingSrc
 * @returns {Promise<{[group: string]: any}|null>} a rough parsed object of the config file, where keys in the first level are group names
 */
async function loadIniKeyVal(configPath, settingSrc){
   let strSettings = null;
   switch(settingSrc.type){
      case 'plainText':
         strSettings = readPlainText(configPath);
         break;
      case 'sqlite':
         strSettings = await readSQLite(configPath, settingSrc);
         if(!strSettings) return null;

         strSettings = strSettings.join('\n');
         break;
   }

   return to.parseConfig(strSettings, null, { ignoreGroups: false });
}


/**
 * @param {any} rawSetting raw settings of this source file
 * @param {string} settingKey
 * @param {string} srcFile file path this setting originated from
 * @return {ParsedGameSettingObj|null} parsed setting object
 */
function parseIniKeyVal(rawSetting, settingKey, srcFile){
   let setting = undefined;
   let group = null;
   for(group in rawSetting){
      if(rawSetting[group][settingKey] !== undefined){
         setting = rawSetting[group];
         break;
      }
   }

   if(setting?.[settingKey] == undefined){
      writeLog(
         `Key "${settingKey}" not found in source config "${srcFile}"`,
         2, true
      );
      return null;
   }

   return parseValue(setting[settingKey]);


   function parseValue(value){
      switch (typeof value) {
         case 'boolean':
            return { value, type: 'bool', group };
         case 'string':
            if(!value||value == 'null'||value == 'undefined')
               return {value: null, type: 'string', group };
            return {value, type: 'string'};
         case 'number':
            return { value, type: 'number', group };
         default:
            return { value: value.toString(), type: 'string', group };
      }
   }
}


/**
 * @param {SettingSrcMetadata} settingSrc
 * @param {Map<string, ParsedGameSettingObj>} settings
 * @param {string} settingScrPath FULL PATH to the setting source file
 */
async function writeIniKeyVal(settingScrPath, settingSrc, settings){
   let noGroup = to.remap(Object.fromEntries(settings),
      (key, value) =>  {
         switch (value.type) {
            case 'bool':
               assert(typeof value.value === 'boolean', 'value of type "bool" must be a boolean');
               value.value = value.value ? 'True' : 'False';
               break;
            case 'string': assert(typeof value.value === 'string', 'value of type "string" must be a string');
               break;
            case 'number':
            case 'enum': assert(typeof value.value === 'number', 'value of type "number" must be a number');
               break;
            default:
               throw new Error(`[Error] while writing: Type "${value.type}" is not supported for type "ini-keyValue"`);
         }

         return {
            key: value.key,
            value: {
               value: value.value,
               group: value.group
            }
         }
      }
   );


   let withGroup = {};

   // some src files may not have manifest, it's okay
   if(settingSrc.manifest?.settingGroups){
      let groupedKeys = [];
      for(const groupName in settingSrc.manifest.settingGroups){
         for(const key in noGroup){
            if(groupedKeys.includes(key)) continue;

            for(const predicateStr of settingSrc.manifest.settingGroups[groupName]){
               if(!predicate(predicateStr, key)) continue;

               if(withGroup[groupName] === undefined)
                  withGroup[groupName] = {};

               withGroup[groupName][key] = noGroup[key].value;
               groupedKeys.push(key);
               break;
            }
         }
      }
   }
   else {
      for(let key in noGroup){
         const group = noGroup[key].group;

         if(!group){
            withGroup[key] = noGroup[key].value;
            continue;
         }

         if(!withGroup[group]) withGroup[group] = {};
         withGroup[group][key] = noGroup[key].value;
      }
   }

   if(to.propertiesCount(withGroup) < 1){
      writeLog(
         `settings write preparation failed: no settings to write to "${settingScrPath}`, 2
      );
      return;
   }

   switch(settingSrc.type){
      case 'plainText':
         to.writeConfig(withGroup, settingScrPath, {
            useIniGroup: true,
            minify: true
         });
         break;
      case 'sqlite':
         await writeSQLite(settingScrPath, settingSrc, withGroup);
         break;
   }
}



/**
 * load `JSON` dataType config file
 * @param {string} configPath full path to the config file
 * @param {SettingSrcMetadata} settingSrc
 * @returns {Promise<{[group: string]: any}|null>} a rough parsed object of the config file, where keys in the first level are group names
 */
async function loadJSON(configPath, settingSrc) {
   let strSettings = null;
   let settings = {};
   switch(settingSrc.type){
      case 'plainText':
         strSettings = readPlainText(configPath);
         settings['$null'] = JSON.parse(strSettings); // no group
         break;
      case 'sqlite':
         strSettings = await readSQLite(configPath, settingSrc);
         if(!strSettings) return null;

         let groupIndex = 0;
         for(let group of settingSrc.manifest.acceptedGroups ?? ['$null']){
            settings[group] = JSON.parse(strSettings[groupIndex++], settingSrc.manifest.Reviver);
         }

         if(settingSrc.manifest.rootProperty){
            for(const group in settings){
               if(settings[group][settingSrc.manifest.rootProperty] == undefined) continue;
               settings[group] = settings[group][settingSrc.manifest.rootProperty];
            }
         }
         break;
   }

   return settings;
}

// Parse SQLite uses the same function as IniKeyVal,
// the alias is defined at the bottom of the file

/**
 * @param {SettingSrcMetadata} settingSrc
 * @param {{[group: string]: any}} settings object with group names as keys, each value will be stringified
 * @param {string} filePath database path
 */
async function writeSQLite(filePath, settingSrc, settings){
   if(settingSrc.manifest?.selectedTable === undefined){
      writeLog(
         `unable to write to SQLite database: missing "selectedTable" property in source metadata`, 2
      );
      writeLog(`Manifest: ${to.yuString(settingSrc.manifest)}`, 2);
      return false;
   }

   if(!(settingSrc.manifest?.acceptedGroups?.length)){
      terminal.warn(
         `unable to write to SQLite database: missing "acceptedGroups" property in source metadata`, 2
      );
      writeLog(`Manifest: ${to.yuString(settingSrc.manifest)}`, 2);
      return false;
   }

   if(filePath.startsWith('.'))
      filePath = path.resolve(config.gameInstalledPath, filePath);

   /**
    * Query:
    * `UPDATE LocalStorage SET value = $settingStr WHERE key == \'GameQualitySetting\'`
    */
   /**
    * @type {sqlite3.Database}
    */
   let db = null;
   try {
      writeLog(`Opening SQLite database from "${filePath}"`);
      db = await open({
         filename: filePath, // absolute path only!
         driver: sqlite3.Database
      });


      for(const group of settingSrc.manifest.acceptedGroups){
         if(settings[group] == undefined){
            writeLog(
               `Error writting to SQLite database "${filePath}": the group "${group}" does not exist in settings`, 2
            );
            continue;
         }

         // check if the group exists
         const res = await db.all(
            `SELECT key FROM ${settingSrc.manifest.selectedTable} WHERE key == \'${group}\'`
         );

         if(!res.length){
            writeLog(
               `Error writting to SQLite database "${filePath}": the group "${group}" does not exist in 'key' column in database`, 2
            );
            return false;
         }


         let settingStr = typeof settings[group] == 'string'
            ? settings[group]
            : JSON.stringify(settings[group], settingSrc.manifest.Replacer);

         writeLog(`executing SQL: \`UPDATE ${settingSrc.manifest.selectedTable} SET value = '${settingStr}' WHERE key == '${group}'\``);
         await db.all(
            `UPDATE ${settingSrc.manifest.selectedTable} SET value = '${settingStr}' WHERE key == '${group}'`
         );
      }
   }
   catch (e) {
      writeLog(
         `Error writting to SQLite database "${filePath}": ${e.message}`, 2
      );
      writeLog(to.yuString(e), 2);
      return false;
   }
   finally {
      writeLog('Closing SQLite database');
      db?.close();
   }

   return true;
}


/**
 * load `KBTupleMap` dataType config file
 * @param {string} configPath full path to the config file
 * @param {SettingSrcMetadata} settingSrc
 * @returns {Promise<{[group: string]: any}|null>} a rough parsed object of the config file, where keys in the first level are group names
 *
 */
async function loadKBTupleMap(configPath, settingSrc) {
   let strSettings = null;
   /**
    * @type {SrcKBTupleMap}
    */
   let settings = {}, currGroupName = '$null';
   switch(settingSrc.type){
      case 'plainText':
         strSettings = readPlainText(configPath);
         break;
      case 'sqlite':
         strSettings = await readSQLite(configPath, settingSrc);
         if(!strSettings) return null;

         strSettings = strSettings.join('\n');
         break;
   }

   for (let line of strSettings.split('\n')) {
      line = line.trim();

      if (!line||line.startsWith(';')) continue;
      if(line.startsWith('[')){
         currGroupName = line.slice(1, -1);
         continue;
      }

      const typeTupleSplit = line.indexOf('=');
      let thisSetting = {}, thisKey = null;
      // +2 and -1 are to remove the () from the tuple
      let [type, tuple] = [line.slice(0, typeTupleSplit), line.slice(typeTupleSplit + 2, -1)];

      for (const pair of tuple.split(',')) {
         let [pKey, pVal] = pair.split('=');

         if(!pKey || !pVal) continue;
         if(pVal[0] === '"') pVal = pVal.slice(1, -1);

         if(pKey === 'ActionName'||pKey === 'AxisName'){
            thisKey = pVal;
            continue;
         }

         thisSetting[pKey] = pVal;
      }

      if(!settings[currGroupName]) settings[currGroupName] = {};

      if(!settings[currGroupName][thisKey]) settings[currGroupName][thisKey] = {};
      if(!settings[currGroupName][thisKey].values) settings[currGroupName][thisKey].values = [];

      settings[currGroupName][thisKey].type = type;
      settings[currGroupName][thisKey].values.push(thisSetting);
   }

   return settings;
}

/**
 * @param {SrcKBTupleMap} rawSetting
 * @param {string} settingKey
 * @param {GameSettingPatch} patch
 * @param {*} combineActionMap
 * @return {ParsedGameSettingObj|null} parsed setting object
 */
function parseKBTupleMap(rawSetting, settingKey, patch, combineActionMap){
   let setting = undefined;
   let group = null;
   for(group in rawSetting){
      if(rawSetting[group][settingKey] !== undefined){
         setting = rawSetting[group];
         break;
      }
   }

   if(setting?.[settingKey] == undefined){
      writeLog(`${ncc(color.gold)}[warn]${ncc()} Key "${settingKey}" not found in source config`, 3, true);
      return null;
   }

   let values = [], type = null;
   if(setting[settingKey].type === 'AxisMappings'){
      type = 'axis';

      for(let eachKeybind of setting[settingKey].values){
         /**
          * @type {AxisBind}
          */
         let binding = new AxisBind();
         let isAlternative = false; // for controller with alternative keybinds

         for(let [feature, fValue] of Object.entries(eachKeybind)){
            if(feature === 'Scale'){
               binding.scale = parseFloat(fValue);
               continue;
            }

            if(feature === 'Key'){
               const { key = null, deviceType = null } = getKeyFromBindingDeclaration(
                  [patch.axisDeclaration, patch.bindingsDeclaration], fValue, ['modifiers']
               );

               if(fValue.startsWith('GenericUSB')){
                  isAlternative = true;
                  break;
               }

               binding.value = key;
               binding.type = deviceType;
               continue;
            }
         }

         if(isAlternative) continue;
         values.push(binding);
      }
   }
   else{
      type = 'bindings';
      /**combineAction is stored separately in LocalStorage.db, here we combine them
       *  @type {string[][]|[]}
       */
      const thisCombineAction = (combineActionMap instanceof Map
         ? combineActionMap.get(settingKey)?.map(v => {
            return { Key: v }
         })
         : null) ?? [];

      for(let eachKeybind of [...setting[settingKey].values, ...thisCombineAction]){
         // terminal.log(eachKeybind);
         /**
          * @type {KeyBind}
          */
         let binding = new KeyBind();
         let isAlternative = false; // for controller with alternative keybinds

         for(let [feature, fValue] of Object.entries(eachKeybind)){
            if(fValue instanceof Array){
               binding.value = [];
            }else fValue = [fValue];

            for(let eachFValue of fValue){
               const { key = null, deviceType = null } = getKeyFromBindingDeclaration(
                  patch.bindingsDeclaration, eachFValue, ['modifiers']
               );

               if(feature === 'Key'){
                  if(eachFValue.startsWith('GenericUSB')){
                     isAlternative = true;
                     break;
                  }

                  if(binding.value instanceof Array) binding.value.push(key);
                  else binding.value = key;
                  binding.type = deviceType;
                  continue;
               }

               if(key === 'Shift'||key === 'Ctrl'||key === 'Alt'||key === 'Cmd'){
                  binding.modifier[key] = eachFValue === 'True';
               }
            }
         }

         if(isAlternative) continue;
         values.push(binding);
      }
   }


   return {
      value: values,
      type,
      group
   }
}



/*
sqlite> SELECT value FROM LocalStorage WHERE key == 'CombineAction';
{"___MetaType___":"___Map___","Content":[["幻象1",[["Gamepad_LeftShoulder","Gamepad_FaceButton_Top"],["GenericUSBController_Button5","GenericUSBController_Button4"]]],["切换角色4",[["Gamepad_LeftShoulder","Gamepad_DPad_Down"],["GenericUSBController_Button5","GenericUSBController_Button18"]]],["幻象2",[["Gamepad_LeftShoulder","Gamepad_FaceButton_Left"],["GenericUSBController_Button5","GenericUSBController_Button1"]]],["ZoomIn",[["Gamepad_LeftShoulder","Gamepad_LeftTrigger"],["GenericUSBController_Button5","GenericUSBController_Button7"]]],["ZoomOut",[["Gamepad_LeftShoulder","Gamepad_RightTrigger"],["GenericUSBController_Button5","GenericUSBController_Button8"]]],["任务追踪",[["Gamepad_LeftShoulder","Gamepad_RightThumbstick"],["GenericUSBController_Button5","GenericUSBController_Button12"]]],["玩法放 弃",[["Gamepad_LeftThumbstick","Gamepad_RightThumbstick"],["GenericUSBController_Button11","GenericUSBController_Button12"]]],["环境特性",[["Gamepad_LeftShoulder","Gamepad_Special_Right"],["GenericUSBController_Button5","GenericUSBController_Button10"]]]]}
*/
/**
 * @param {GameSettingPatch} patch
 * @param {string} settingScrPath FULL PATH to the setting source file
 * @param {ParsedGameSettings} parsed
 * @param {AllRawSettings} raw
 */
async function writeKBTupleMap(settingScrPath, parsed, patch, raw){
   let combineActionMap = new Map();

   const mappedSettings = to.remap(parsed, (key, setting, currMap) => {
      if(!(setting.type === 'bindings' || setting.type === 'axis')){
         writeLog(`invalid type "${setting.type}" for KBTupleMap`, 2);
         return;
      }

      let serialized = '';

      if(setting.type === 'bindings'){
         /**@type {KeyBind} */
         let binding;
         for(binding of setting.value){
            /**
             * @example
             * //           v for some binding that requires multiple keys (w/o modifiers) to be pressed at the same time (length == 1 for single keybinds)
             * gameDefKeys[KeyPerAction][KeyNames]
             * //                         ^ for some key that have multiple names for different devices
             */
            let gameDefKeys = (binding.value instanceof Array ? binding.value : [binding.value])
               .map(appDefKey => {
                  /**
                   * @type {string|string[]}
                   *                maybe undefined for keyboard bindings  v  (not all keys are defined in patch.json)
                   */
                  let gameDefKey = patch.bindingsDeclaration[binding.type][appDefKey] ?? appDefKey.toUpperCase();
                  if(!(gameDefKey instanceof Array)) gameDefKey = [gameDefKey];
                  return gameDefKey;
               });

            // combineAction: we neet to define this in combineAction from LocalStorage.db
            if(gameDefKeys.length > 1){
               if(!combineActionMap.has(setting.key))
                  combineActionMap.set(setting.key, []);

               for(let actIndex = 0; actIndex < gameDefKeys.length - 1; actIndex++){
                  for(let keyIndex = 0; ; keyIndex++){
                     if(!gameDefKeys[actIndex][keyIndex]) break;

                     combineActionMap.get(setting.key).push([
                        ...gameDefKeys.map(row => row[keyIndex])
                     ]);
                  }
               }
               continue;
            }

            for(const eachKeyName of gameDefKeys[0]){
               serialized += `ActionMappings=(ActionName="${setting.key}",bShift=${binding.modifier.Shift?'True':'False'},bCtrl=${binding.modifier.Ctrl?'True':'False'},bAlt=${binding.modifier.Alt?'True':'False'},bCmd=${binding.modifier.Cmd?'True':'False'},Key=${eachKeyName})\n`
            }
         }
      }else{
         /**@type {AxisBind} */
         let binding;
         for(binding of setting.value){
            const appDefKey = binding.value;
            /**
             * @type {string|string[]}
             *                maybe undefined for keyboard bindings  v  (not all keys are defined in patch.json)
             */

            let gameDefKey = patch.axisDeclaration[binding.type]?.[appDefKey]
                  ?? patch.bindingsDeclaration[binding.type]?.[appDefKey]
                  ?? appDefKey.toUpperCase();

            if(!(gameDefKey instanceof Array)) gameDefKey = [gameDefKey];

            for(const eachGDK of gameDefKey){
               serialized += `AxisMappings=(AxisName="${setting.key}",Scale=${binding.scale.toFixed(6)},Key=${eachGDK})\n`
            }
         }
      }

      if(currMap.has(setting.group)){
         currMap.get(setting.group).push({
            str: serialized,
            group: setting.group,
            type: setting.type
         });

      }else{
         return {
            key: setting.group,
            value: [{
               str: serialized,
               group: setting.group,
               type: setting.type
            }]
         }
      }

      return undefined;
   });

   // merge combined actions that have been parsed and the original ones
   /**@type {Map} */
   const originalCA = raw.get('combinedAction')?.value?.['CombineAction'];
   if(originalCA){
      originalCA.forEach((value, key) => {
         if(!combineActionMap.has(key)&&!parsed.has(key)){
            combineActionMap.set(key, value);
         }
      });
   }

   // write combined actions
   {
      const CASrcMeta = patch.configSrcMap.combinedAction;
      const success = await writeSQLite(
         CASrcMeta.path,
         CASrcMeta,
         {  // for KBTupleMap 'CombinedAction' is the only accepted group however,
            // this may change in the future
            [CASrcMeta.manifest.acceptedGroups[0]]: combineActionMap
         }
      );

      if(!success){
         writeLog(`failed to write combined actions to "${CASrcMeta.path}"`, 2);
         // even if it fails, we can still write the rest of the settings
      }
   }

   let content = '';
   for(const [group, settings] of mappedSettings){
      content += `[${group}]\n`;
      content += settings.reduce((acc, curr) => acc + curr.str, '');
   }

   try {
      writeLog(`Writing KBTupleMap to "${settingScrPath}"`);
      fs.writeFileSync(settingScrPath, content, { encoding: 'utf-8' });
   }
   catch(e){
      writeLog(`Error writing to "${settingScrPath}": ${e.message}`, 1);
      throw e; // let the caller handle the error
   }

   return true;
}


/**
 * lookup key name used in this program from the key name in the config file (convert what game calls the key to what this program calls it)
 * @param {BindingGroups|BindingGroups[]} declarations either a(n) axisDeclaration or bindingsDeclaration
 * @param {string} value
 * @param {string[]} blacklist group name blacklist
 * @returns {{key: Keys|Axis, deviceType: DeviceTypesWithModifiers}}
 */
function getKeyFromBindingDeclaration(declarations, value, blacklist = []){
   if(!(declarations instanceof Array)) declarations = [declarations];

   for(const declGroup of declarations){
      for(const deviceType in declGroup){
         if(blacklist.includes(deviceType)) continue;

         for(let [key, dValue] of Object.entries(declGroup[deviceType])){
            if(dValue instanceof Array){
               if(dValue.includes(value)){
                  return {key, deviceType};
               }
               continue;
            }

            if(dValue === value){
               return {key, deviceType};
            }
         }
      }
   }

   return {key: value, deviceType: 'keyboard'};
}


module.exports = {
   loadIniKeyVal,
   parseIniKeyVal,
   writeIniKeyVal,
   loadKBTupleMap,
   parseKBTupleMap,
   writeKBTupleMap,
   loadJSON,
   parseSQLite: parseIniKeyVal, // alias
   writeSQLite,
   KeyBind,
   AxisBind
};