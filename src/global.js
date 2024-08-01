
module.exports = {
   color: Object.freeze({
      gray1: 0x111111,
      gray3: 0x333333,
      gray5: 0x555555,
      gray6: 0x666666,
      gray7: 0x777777,
      gray9: 0x999999,
      grayB: 0xbbbbbb,
      grayE: 0xeeeeee,
      mikuCyan: 0x23dbd2,
      aquaPink: 0xd149b1,
      gold: 0xc19c00
   }),
   version: '1.0.0',
   tracer: null,
   deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
   deviceTempFolder: process.env.TEMP || process.env.TMP || '/tmp' || './tmp',
   log: '',
   logFileWS: null,
   moduleGetIPathExist: null,
   isThisProcessElevated: null
}