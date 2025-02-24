const fs = require('fs');
const assert = require('assert');
const path = require('path');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const _ = require('lodash');

const to = require('./helper/Tools.js');
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
      AllRawSettings,
      Modifiers,
      OptionPatchOptionTypes
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
    * @type {(Keys)[]}
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
      if(typeof newValue === 'string') this.value = [newValue];
      else this.value = newValue;

      this.type = this.#resolveType(typeRef, newValue instanceof Array? newValue[0]: newValue);
   }


   /**
    * append a new key to the keybind
    * @param {Keys|(Keys)[]} newValue
    * @param {DeviceTypes|GameSettingPatch} typeRef
    */
   append(newValue, typeRef){
      const currType = this.#resolveType(typeRef, newValue instanceof Array? newValue[0]: newValue);

      if(currType !== this.type){
         this.type = currType;
         this.value = null;
      }

      if(!this.value) this.value = [];

      if(newValue instanceof Array) this.value.push(...newValue);
      else {
         if(this.value instanceof Array) this.value.push(newValue);
         else this.value = [this.value, newValue];
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
            this.value.map(v => `${(v?ncc(color.gray9)+v:ncc(color.gray6)+'[empty]')+ncc(color.gray7)}`).join('+');
      }
      return ncc(color.gold)+`${_type} ${ncc(color.gray5)}${ncc(color.aquaPink)}${this.modifier.Ctrl?'Ctrl+':''}${this.modifier.Shift?'Shift+':''}${this.modifier.Alt?'Alt+':''}${this.modifier.Cmd?'⌘+':''}${(this.value?ncc(color.gray9)+this.value:ncc(color.gray6)+'[empty]')+ncc(color.gray7)}`;
   }

   /**
    * resolve type of this keybind
    * @param {DeviceTypes|GameSettingPatch} typeRef
    * @param {Keys} key
    * @returns {DeviceTypes}
    */
   #resolveType(typeRef, key){
      let _type = null;

      if(typeof typeRef !== 'string'){
         for(const device in typeRef.bindingsDeclaration){
            if(device === 'keyboard'||device === 'modifiers') continue;

            if(typeRef.bindingsDeclaration[device][key] !== undefined){
               _type = device;
               break;
            }
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

      // @ts-expect-error
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

      this.type = this.#resolveType(typeRef, newValue);
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

      if(typeof this.value !== 'string'){
         throw new Error('AxisBind cannot have multiple values!');
      }
      return ncc(color.gold)+`${_type} ${ncc(color.gray5)}${ncc(color.aquaPink)}${this.scale * 100}% ${(this.value?ncc(color.gray9)+this.value:ncc(color.gray6)+'[empty]')+ncc(color.gray7)}`;
   }

   /**
    * resolve the type of the keybind
    * @param {DeviceTypes|GameSettingPatch} typeRef
    * @param {Axis} key
    * @returns {DeviceTypes}
    */
   #resolveType(typeRef, key){
      let _type = null;

      if(typeof typeRef !== 'string'){
         for(const device in typeRef.bindingsDeclaration){
            if(device === 'keyboard'||device === 'modifiers') continue;

            if(typeRef.bindingsDeclaration[device][key] !== undefined){
               _type = device;
               break;
            }
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

      // @ts-expect-error
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
 */
async function readSQLite(filePath, settingSrc){
   if(settingSrc.manifest?.selectedTable === undefined){
      writeLog(`unable to read from SQLite database: missing "selectedTable" property in source metadata`, 2, true);
      writeLog(`Manifest: ${to.yuString(settingSrc.manifest)}`, 2);
      return null;
   }

   if(filePath.startsWith('.'))
      filePath = path.resolve(config.gameInstalledPath, filePath);

   /**
    * @type {any}
    */
   let db = null;
   let rawSettings = new Map;
   try {
      writeLog(`Opening SQLite database from "${filePath}"`);
      db = await open({
         filename: filePath, // absolute path only!
         driver: sqlite3.Database
      });

      if(settingSrc.manifest?.acceptedGroups?.length){
         for(const group of settingSrc.manifest.acceptedGroups){
            let query = `SELECT key, value FROM ${settingSrc.manifest.selectedTable} WHERE key == \'${group}\'`;
            if(settingSrc.manifest?.filter && settingSrc.manifest.filter.startsWith('$sql:'))
               query += ' AND ' + settingSrc.manifest.filter.slice(5);

            writeLog(`executing SQL: \`${query}\``);
            const result = await db.all(query);

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
            rawSettings.set(group, result[0].value);
         }
      }
      else {
         let query = `SELECT key, value FROM ${settingSrc.manifest.selectedTable}`;
         if(settingSrc.manifest?.filter && settingSrc.manifest.filter.startsWith('$sql:'))
            query += ' WHERE ' + settingSrc.manifest.filter.slice(5);

         writeLog(`executing SQL: \`${query}\``);
         const result = await db.all(query);

         if(!result.length){
            writeLog(
               `SQLite failed to resolve setting from "${filePath}"`,
               2, true
            );
            writeLog('failed reason: "no result"', 2);
            return null;
         }

         writeLog(`query result: ${to.yuString([...result])}`);
         for(const row of result){
            rawSettings.set(row.key, row.value);
         }
      }

      return rawSettings;

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

         strSettings = [...strSettings.values()].join('\n');
         break;
   }

   return to.parseConfig(strSettings, null, {
      ignoreGroups: false, multiValues: true
   });
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
         if(typeof settingSrc.manifest.Reviver == 'string'){
            writeLog('program not properly initialized: Reviver is not a function', 2);
            return null;
         }

         strSettings = await readSQLite(configPath, settingSrc);
         if(!strSettings) return null;

         strSettings = [...strSettings.values()];

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

         strSettings = [...strSettings.values()].join('\n');
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

      if(settingSrc.manifest?.filter && !predicate(settingSrc.manifest.filter, { type, value: tuple }))
         continue;

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

      if(!settings[currGroupName])
         settings[currGroupName] = {};

      if(!settings[currGroupName][thisKey]) {
         settings[currGroupName][thisKey] = {
            type: null,
            values: []
         };
      }

      if(!settings[currGroupName][thisKey].values)
         settings[currGroupName][thisKey].values = [];

      // @ts-expect-error
      settings[currGroupName][thisKey].type = type;
      // @ts-expect-error
      settings[currGroupName][thisKey].values.push(thisSetting);
   }

   return settings;
}

/**
 * load `Literal` dataType config file
 * @param {string} configPath full path to the config file
 * @param {SettingSrcMetadata} settingSrc
 * @returns {Promise<{[group: string]: any}|null>} a rough parsed object of the config file, where keys in the first level are group names
 *
 */
async function loadLiteral(configPath, settingSrc){
   let rawSettings = null;
   let settings = {};
   switch(settingSrc.type){
      case 'sqlite':
         rawSettings = await readSQLite(configPath, settingSrc);
         if(!rawSettings) return null;
         break;
   }

   if(typeof settingSrc.manifest.readMapper == 'function'){
      rawSettings = to.remap(rawSettings, settingSrc.manifest.readMapper);
   }

   settings['$null'] = Object.fromEntries(rawSettings);
   return settings;
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

   let value = setting?.[settingKey];

   if(value == undefined){
      writeLog(
         `Key "${settingKey}" not found in source config "${srcFile}"`,
         2, true
      );
      return null;
   }

   switch (typeof value) {
      case 'boolean':
         return { value, type: 'bool', group };
      case 'string':
         if(!value||value == 'null'||value == 'undefined')
            return {value: null, type: 'string', group };
         return { value, type: 'string', group };
      case 'number':
         return { value, type: 'number', group };
      default:
         return { value: value.toString(), type: 'string', group };
   }
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
      writeLog(`Key "${settingKey}" not found in source config`, 2, true);
      return null;
   }

   let values = [];
   /**@type {OptionPatchOptionTypes} */
   let type = null;
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

               // @ts-expect-error we already filtered out the 'modifiers'
               binding.value = key;
               // @ts-expect-error we already filtered out the 'modifiers'
               binding.type = deviceType;
               continue;
            }
         }

         if(isAlternative) continue;
         values.push(binding);
      }
   }
   else {
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

         // Raw data in src v
         // ActionMappings=(ActionName="QTE交互",bShift=False,bCtrl=False,bAlt=False,bCmd=False,Key=Gamepad_FaceButton_Right)

         // Parsed data in eachKeybind v
         // feature: bShift, fValue: False
         // feature: bAlt, fValue: False
         // ...       (^ need key translation v)
         // feature: Key, fValue: Gamepad_FaceButton_Right
         for(let [feature, fValue] of Object.entries(eachKeybind)){
            // @ts-expect-error
            let valueList = fValue instanceof Array ? fValue : [fValue];

            for(let eachFValue of valueList){
               const { key = null, deviceType = null } = getKeyFromBindingDeclaration(
                  patch.bindingsDeclaration,
                  feature !== 'Key'? feature: eachFValue
               );

               if(feature === 'Key'&&deviceType !== 'modifiers'){
                  if(eachFValue.startsWith('GenericUSB')){
                     isAlternative = true;
                     break;
                  }

                  // @ts-expect-error we already filtered out the Axis and modifiers type
                  if(binding.value instanceof Array) binding.value.push(key); // @ts-expect-error
                  else binding.value = [key];
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

   // @ts-expect-error incomplete return types is intentional
   return {
      value: values,
      type,
      group
   }
}


/**
 * @param {any} rawSetting raw settings of this source file
 * @param {string} settingKey
 * @param {string} srcFile file path this setting originated from
 * @param {boolean} typeParsing whether to parse the value to JavaScript type
 * @return {ParsedGameSettingObj|null} parsed setting object
 */
function parseLiteral(rawSetting, settingKey, srcFile, typeParsing){
   let setting = undefined;
   let group = null;

   for(group in rawSetting){
      if(rawSetting[group][settingKey] !== undefined){
         setting = rawSetting[group];
         break;
      }
   }

   let value = setting?.[settingKey];

   if(setting?.[settingKey] == undefined){
      writeLog(
         `Key "${settingKey}" not found in source config "${srcFile}"`,
         2, true
      );
      return null;
   }

   if(typeParsing)
      value = to.parseValue(value);

   switch (typeof value) {
      case 'boolean':
         return { value, type: 'bool', group };
      case 'string':
         if(!value||value == 'null'||value == 'undefined')
            return {value: null, type: 'string', group };
         return { value, type: 'string', group };
      case 'number':
         return { value, type: 'number', group };
      default:
         return { value: value?.toString(), type: 'string', group };
   }
}


/**
 * @param {string} settingScrPath FULL PATH to the setting source file
 * @param {SettingSrcMetadata} settingSrc
 * @param {Map<string, ParsedGameSettingObj>} settings
 */
async function writeIniKeyVal(settingScrPath, settingSrc, settings){
   let noGroup = to.remap(Object.fromEntries(settings),
      (key, value) =>  {
         switch (value.type) {
            case 'bool':
               assert(typeof value.value === 'boolean', `value \`${value.key}:${value.value}\` of type "bool" must be a boolean, instead got ${typeof value.value}`);
               break;
            case 'string': assert(typeof value.value === 'string', `value \`${value.key}:${value.value}\` of type "string" must be a string, instead got ${typeof value.value}`);
               break;
            case 'number':
            case 'enum': assert(typeof value.value === 'number', `value \`${value.key}:${value.value}\` of type "number" or "enum" must be a number, instead got ${typeof value.value}`);
               break;
            default:
               throw new Error(`[Error] while writing: Type "${value.type}" is not supported for type "Ini-KeVal". Found in key "${value.key}"`);
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

   writeLog(`Writing Ini-KeyVal to "${settingScrPath}" with type "${settingSrc.type}"`);

   return writeIniKeyVal_raw(settingScrPath, settingSrc, withGroup);
}

async function writeIniKeyVal_raw(settingScrPath, settingSrc, rawSettings) {
   if(settingSrc.usedAsRaw)
      writeLog(to.yuString(rawSettings), 4);

   let errorMsg;
   switch(settingSrc.type){
      case 'plainText':
         to.writeConfig(rawSettings, settingScrPath, {
            useIniGroup: true,
            mode: settingSrc.usedAsRaw ? 'replace' : 'merge',
            minify: true
         });
         break;
      case 'sqlite':
         errorMsg = await writeSQLite(settingScrPath, settingSrc, rawSettings);
         break;
   }

   if(errorMsg)
      throw new Error(errorMsg);
}

// Parse SQLite uses the same function as IniKeyVal,
// the alias is defined at the bottom of the file

/**
 * @param {SettingSrcMetadata} settingSrc
 * @param {{[key: string]: any}} settings object with group names as keys, each value will be stringified
 * @param {string} filePath database path
 * @returns {Promise<string|undefined>} error message if any
 */
async function writeSQLite(filePath, settingSrc, settings){
   if(settingSrc.manifest?.selectedTable === undefined){
      writeLog(`Manifest: ${to.yuString(settingSrc.manifest)}`, 2);
      return writeLog(
         `unable to write to SQLite database: missing "selectedTable" property in source metadata`, 2
      );
   }

   if(typeof settingSrc.manifest.Replacer == 'string'){
      return writeLog('program not properly initialized: Replacer is not a function', 2);
   }

   if(filePath.startsWith('.'))
      filePath = path.resolve(config.gameInstalledPath, filePath);

   writeLog(`Writing to SQLite database "${filePath}"`);

   /**
    * Query:
    * `UPDATE LocalStorage SET value = $settingStr WHERE key == \'GameQualitySetting\'`
    */
   /**
    * @type {any}
    */
   let db = null;
   try {
      writeLog(`Opening SQLite database from "${filePath}"`);
      db = await open({
         filename: filePath, // absolute path only!
         driver: sqlite3.Database
      });


      for(const key in settings){
         if(
            settingSrc.manifest.acceptedGroups.length &&
            settingSrc.manifest.acceptedGroups.includes(key)
         ){
            writeLog(
               `Error writting to SQLite database "${filePath}": the key "${key}" does not exist in settings`, 2
            );
            continue;
         }

         // check if the key exists
         const res = await db.all(
            `SELECT key FROM ${settingSrc.manifest.selectedTable} WHERE key == \'${key}\'`
         );

         if(!res.length){
            return writeLog(
               `Error writting to SQLite database "${filePath}": the key "${key}" does not exist in 'key' column in database`, 1
            );
         }

         let settingStr = typeof settings[key] == 'string' // the Database only accepts string
            ? settings[key]
            : JSON.stringify(settings[key], settingSrc.manifest.Replacer);

         writeLog(`executing SQL: \`UPDATE ${settingSrc.manifest.selectedTable} SET value = '${settingStr}' WHERE key == '${key}'\``);
         await db.all(
            `UPDATE ${settingSrc.manifest.selectedTable} SET value = '${settingStr}' WHERE key == '${key}'`
         );
      }
   }
   catch (e) {
      writeLog(to.yuString(e), 2);
      return writeLog(
         `Error writting to SQLite database "${filePath}": ${e.message}`, 2
      );
   }
   finally {
      writeLog('Closing SQLite database');
      db?.close();
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
      if(!(setting.type === 'bindings' || setting.type === 'axis')||!(setting.value instanceof Array)){
         writeLog(`invalid type "${setting.type}" for KBTupleMap`, 2);
         return;
      }

      let serialized = '';

      if(setting.type === 'bindings'){
         /**@type {KeyBind} */
         let binding;
         // @ts-expect-error this should already be a type of KeyBind
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
         // @ts-expect-error this should already be a type of AxisBind
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

      // @ts-expect-error currMap is a Map (same as input type)
      if(currMap.has(setting.group)){
         // @ts-expect-error currMap is a Map (same as input type)
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
      const error = await writeSQLite(
         CASrcMeta.path,
         CASrcMeta,
         {  // for KBTupleMap 'CombinedAction' is the only accepted group however,
            // this may change in the future
            [CASrcMeta.manifest.acceptedGroups[0]]: combineActionMap
         }
      );

      if(error){
         writeLog(`failed to write combined actions to "${CASrcMeta.path}"`, 2);
         // even if it fails, we can still write the rest of the settings
      }
   }

   let content = '';
   // @ts-expect-error mappedSettings is a Map
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
 * @param {string} settingScrPath FULL PATH to the setting source file
 * @param {SettingSrcMetadata} settingSrc
 * @param {Map<string, ParsedGameSettingObj>} settings
 * @param {boolean} typeParsing whether to parse the value from JavaScript type back to string
 */
async function writeLiteral(settingScrPath, settingSrc, settings, typeParsing){
   let objSettings = to.remap(Object.fromEntries(settings),
      (key, value) =>  {
         let settingValue = value.value;

         switch (value.type) {
            case 'bool':
               assert(typeof value.value === 'boolean', `value \`${value.key}:${value.value}\` of type "bool" must be a boolean, instead got ${typeof value.value}`);
               break;
            case 'string': assert(typeof value.value === 'string', `value \`${value.key}:${value.value}\` of type "string" must be a string, instead got ${typeof value.value}`);
               break;
            case 'number':
            case 'enum': assert(typeof value.value === 'number', `value \`${value.key}:${value.value}\` of type "number" or "enum" must be a number, instead got ${typeof value.value}`);
               break;
            default:
               throw new Error(`[Error] while writing: Type "${value.type}" is not supported for type "literal". Found in key "${value.key}"`);
         }

         if(typeof settingSrc.manifest.writeMapper == 'function'){
            const mapped = settingSrc.manifest.writeMapper(key, value.value);
            key = mapped.key;
            settingValue = mapped.value;
         }

         return {
            key: value.key,
            value: {
               value: typeParsing?  settingValue.toString(): settingValue,
               group: value.group
            }
         }
      }
   );


   let serializedSettings = {};
   for(let key in objSettings){
      serializedSettings[key] = objSettings[key].value;
   }

   if(to.propertiesCount(serializedSettings) < 1){
      writeLog(
         `settings write preparation failed: no settings to write to "${settingScrPath}`, 2
      );
      return;
   }

   writeLog(`Writing Literal to "${settingScrPath}" with type "${settingSrc.type}"`);

   let errorMsg;
   switch(settingSrc.type){
      case 'sqlite':
         errorMsg = await writeSQLite(settingScrPath, settingSrc, serializedSettings);
         break;
   }

   if(errorMsg)
      throw new Error(errorMsg);
}


/**
 * lookup key name used in this program from the key name in the config file (convert what game calls the key to what this program calls it)
 * @param {BindingGroups|BindingGroups[]} declarations either a(n) axisDeclaration or bindingsDeclaration
 * @param {string} value
 * @param {string[]} blacklist group name blacklist
 * @returns {{key: Keys|Axis|Modifiers, deviceType: DeviceTypesWithModifiers}}
 */
function getKeyFromBindingDeclaration(declarations, value, blacklist = []){
   if(!(declarations instanceof Array)) declarations = [declarations];

   for(const declGroup of declarations){
      for(const deviceType in declGroup){
         if(blacklist.includes(deviceType)) continue;

         for(let [key, dValue] of Object.entries(declGroup[deviceType])){
            // @ts-expect-error
            if(dValue instanceof Array){
               if(dValue.includes(value)){
                  // @ts-expect-error
                  return {key, deviceType};
               }
               continue;
            }

            if(dValue === value){
               // @ts-expect-error
               return {key, deviceType};
            }
         }
      }
   }

   // @ts-expect-error
   return {key: value, deviceType: 'keyboard'};
}


module.exports = {
   loadIniKeyVal,
   loadKBTupleMap,
   loadJSON,
   loadLiteral,
   parseIniKeyVal,
   parseKBTupleMap,
   parseSQLite: parseIniKeyVal, // alias
   parseLiteral,
   writeIniKeyVal,
   writeIniKeyVal_raw,
   writeKBTupleMap,
   writeSQLite,
   writeLiteral,
   KeyBind,
   AxisBind
};