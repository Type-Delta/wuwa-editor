//////////// Tools Test ////////////
/**# Test script for Tools.js
 *
 * for framework: mocha + chai
 * @version 2.12.11
 */
// @ts-check
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { default as to } from '../src/helper/Tools.js';

describe('Tools.js', () => {
   if(to.arrToString){
      describe('#arrToString()', () => {
         {
            const result = to.arrToString(['a', 'b', 'c']);

            it('should return a string', () => {
               expect(result).to.be.a('string');
            });

            it('should parse simple array to string w/o header or NewLine', () => {
               expect(result).to.equal('["a", "b", "c"]');
            });
         }

         {
            const af = async () => {};
            const b = Int32Array.from([1, 2, 3, 4, 5]);
            function myFunction() {
               return 'Hello';
            }
            let result = '';
            /**
             * @typedef {Object} ArrToStringOptions
             * @property {number} [maxDepth=4] maximum depth to parse, "depth" represent layers of the array (e.g. depth of 3 is a 3D array)
             * @property {number|string} [indent=3] indentation, `number` represent number of spaces, `string` represent the string to use for indentation
             * @property {number} [maxRow=10] maximum number of displayable "rows" of each layer
             * @property {number} [maxCol=20] maximum number of displayable "columns" of each layer
             * @property {boolean} [color=false] enable syntax highlighting
             * @property {number|string} [defColor] default color: color used for reseting foreground color,
             * without this option will reset all color and formatting
             * @property {boolean} [noHeader] disable type heading that shows the type and dimensions of the given array.
             *
             * this does not affect values inside the array
             */
            /**@type {ArrToStringOptions} */
            let options = {
               maxDepth: 4,
               indent: 3,
               maxRow: 10,
               maxCol: 20,
               color: false,
               defColor: undefined,
               noHeader: false
            };

            const testArr = [
               [
                  [1,2,true],
                  "mika",
                  [1,null,af],
                  [b,2,()=>{}]
               ],
               [
                  "",
                  [myFunction,2,3,to.arrToString,5]
               ],
               ""
            ];

            it('should parse complex array w/o errors', () => {
               expect(() => {
                  result = to.arrToString(testArr, options);
               }).to.not.throw();
            });

            it('should have a Header for complex array (options.noHeader = false)', () => {
               expect(result.startsWith('Array(')).to.be.true;
            });

            it('should not have Header if options.noHeader = true', () => {
               options.noHeader = true;
               result = to.arrToString(testArr, options);
               expect(
                  to.arrToString(testArr, options).startsWith('Array(')
               ).to.be.false;
               options.noHeader = false;
            });

            it('the header should contains correct dimensions of the array', () => {
               result = to.arrToString(testArr, options);
               expect(result.split(': ')[0]).to.equal('Array(3,4,5,5)');
            });

            it('should resolve ArrayLike type and parse it correctly', () => {
               expect(result).to.includes('Int32Array');
            });

            it('should resolve Function type and parse it correctly', () => {
               expect(result).to.includes('async af () => {...}');
               expect(result).to.includes('[anonymous] () => {...}');
            });

            it('should NOT apply syntax highlighting if `options.color = false`', () => {
               expect(
                  to.REGEXP.ANSICode.test(result)
               ).to.be.false;
            });

            it('should apply syntax highlighting if `options.color = true`', () => {
               options.color = true;
               result = to.arrToString(testArr, options);
               expect(
                  to.REGEXP.ANSICode.test(result)
               ).to.be.true;
               options.color = false;
            });

            it('should return `Tools.yuString()` of the given object if it is not an array', () => {
               expect(to.arrToString(af, options), 'input is function')
                  .to.equal(to.yuString(af));

               expect(to.arrToString(null, options), 'input is null')
                  .to.equal(to.yuString(null));

               expect(to.arrToString(options, options), 'input is object')
                  .to.equal(to.yuString(options));
            });

            it('should use the given string as indent if given `options.indent` as a string', () => {
               options.indent = '***';
               result = to.arrToString(testArr, options);
               expect(result).to.includes('[\n***[');
               options.indent = 3;
            });

            it('should use the given number as indent if given `options.indent` as a number', () => {
               options.indent = 5;
               result = to.arrToString(testArr, options);
               expect(result, 'indent 5').to.includes('[\n     [');

               options.indent = 0;
               result = to.arrToString(testArr, options);
               expect(result, 'indent 0').to.includes('[\n[');

               options.indent = 3;
            });

            it('should return string representation of 1D array if `options.maxDepth` is 1 or lower', () => {
               options.maxDepth = 1;
               result = to.arrToString(testArr, options);
               expect(
                  result, 'maxDepth 1'
               ).to.includes('[... [Array], ... [Array], ""]');

               options.maxDepth = -100;
               result = to.arrToString(testArr, options);
               expect(
                  result, 'maxDepth -100'
               ).to.includes('[... [Array], ... [Array], ""]');
               options.maxDepth = 4;
            });

            it('should collapse nested array if the array is too long', () => {
               const hasCollapsed_r = /\.\.\. \(\d+ more\)/;

               options.maxCol = 2;
               result = to.arrToString(testArr, options);
               expect(
                  hasCollapsed_r.test(result), 'maxCol 2'
               ).to.be.true;
               options.maxCol = 20;

               options.maxRow = 2;
               result = to.arrToString(testArr, options);
               expect(
                  hasCollapsed_r.test(result), 'maxRow 2'
               ).to.be.true;
               options.maxRow = 10;

               result = to.arrToString(testArr, options);
               expect(
                  hasCollapsed_r.test(result), 'negative case (should not collapse)'
               ).to.be.false;
            });
         }
      });


      if(to.argvHasFlag){
         describe('#argvHasFlag()', () => {
            let argv = ['C:\\PROGRA~1\\nodejs\\node.exe', 'test.js', '-f', '--unicorn', '--foo=bar', '--', '--rainbow', '-h', '--hi=true'];

            it('should return true if the given flag is in the process.argv', () => {
               const testInput = ['f', '-f', '--unicorn', 'foo=bar'];
               for(const t of testInput){
                  expect(to.argvHasFlag(t, argv), `failed value: '${t}'`).to.be.true;
               }
            });

            it('should return false if the given flag is not in the process.argv', () => {
               const testInput = ['--', 'test', 'foo'];
               for(const t of testInput){
                  expect(to.argvHasFlag(t, argv), `failed value: '${t}'`).to.be.false;
               }
            });

            it('should return false for any arguments after the terminater', () => {
               const testInput = ['--rainbow', 'rainbow', 'h', '-h', '--hi=true', 'hi=true'];
               for(const t of testInput){
                  expect(to.argvHasFlag(t, argv), `failed value: '${t}'`).to.be.false;
               }
            });

            it('should return false if the given flag or argv is invalid', () => {
               const testInput = [null, undefined, [], {}, 0, 1];
               for(const t of testInput){
                  // @ts-expect-error
                  expect(to.argvHasFlag(t, argv), `failed value: '${t}'`).to.be.false;
               }

               // @ts-expect-error
               expect(to.argvHasFlag('foo', false), `failed value: argv == false`).to.be.false;
            });
         });
      }


      if(to.asyncSleep){
         describe('async #asyncSleep()', () => {
            it('should return a Promise', () => {
               expect(to.asyncSleep(100)).to.be.a('Promise');
            });

            it('should resolve after the given time', async () => {
               const start = Date.now();
               await to.asyncSleep(100);
               const end = Date.now();
               expect(end - start).to.be.greaterThanOrEqual(100);
            });

            it('should resolve immediately if the given time is 0', async () => {
               const start = Date.now();
               await to.asyncSleep(0);
               const end = Date.now();
               expect(end - start).to.be.lessThan(10);
            });

            it('should resolve immediately if the given time is negative', async () => {
               const start = Date.now();
               await to.asyncSleep(-100);
               const end = Date.now();
               expect(end - start).to.be.lessThan(10);
            });

            it('should resolve immediately if the given time is invalid', async () => {
               const start = Date.now();
               // @ts-expect-error
               await to.asyncSleep('100');
               const end = Date.now();
               expect(end - start).to.be.lessThan(10);
            });
         });
      }

      // @ts-expect-error
      if(to.beautifyJson){
         describe('#beautifyJSON()', () => {
            it('this function is incomplete, skip test for now', () => {
               expect(true).to.be.true;
            });
         });
      }


      if(to.changeDateTimezone){
         describe('#changeDateTimezone()', () => {
            const machineDate = new Date('2024-07-21T03:14:36.709Z');

            it('should return a Date object', () => {
               expect(to.changeDateTimezone(new Date(), 'UTC')).to.be.instanceOf(Date);
            });

            it('should return a Date object even if the given date is invalid', () => {
               const invalidDate = new Date('invalid');
               expect(to.changeDateTimezone(invalidDate, 'UTC')).to.be.instanceOf(Date);
            });

            it('should throw an error if the given timezone is invalid', () => {
               expect(() =>
                  to.changeDateTimezone(machineDate, 'invalid')
               ).to.throw('Invalid time zone specified: invalid');
            });

            it('should return the correct date object with the given timezone', () => {
               const utc = to.changeDateTimezone(machineDate, 'UTC');
               const correctUTCDate = machineDate.toLocaleString('en-US', {
                  timeZone: 'UTC'
               });
               expect(utc.toLocaleString()).to.equal(correctUTCDate);
            });
         });
      }


      if(to.charTypeAt){
         describe('#charTypeAt()', () => {
            it('should return any of the Types defined in `CONSTS.UNICODES_RANGE_TABLE`', () => {
               const validTypes = to.CONSTS.UNICODES_RANGE_TABLE.map(v => v.type);
               expect(validTypes).to.includes(to.charTypeAt(0, 'a'));
               expect(validTypes).to.includes(to.charTypeAt(2, 'Bwd'));
               expect(validTypes).to.includes(to.charTypeAt(0, '笑'));
            });

            it('should return `null` if the given char does not exist in `CONSTS.UNICODES_RANGE_TABLE`', () => {
               const testChar = '💡';
               const result = to.charTypeAt(0, testChar);
               expect(result).to.be.null;
            });

            it('should return `null` if the given index is out of range', () => {
               expect(to.charTypeAt(100, 'a')).to.be.null;
               expect(to.charTypeAt(-20, 'a')).to.be.null;
            });

            it('should return the correct type for the given char', () => {
               expect(to.charTypeAt(-2, 'Hello World of Aあい')).to.equal('generic.jp.full');
               expect(to.charTypeAt(6, 'Hello World of A愛')).to.equal('generic.en.upper');
               expect(to.charTypeAt(1, 'Hello World of A愛')).to.equal('generic.en.lower');
               expect(to.charTypeAt(-4, 'this is a random cn char 鿿 <-')).to.equal('generic.cn.full');
               expect(to.charTypeAt(2, 'ｶﾅﾀﾝ')).to.equal('generic.jp.half');
               expect(to.charTypeAt(-1, 'not a valid char 😂')).to.equal(null);
            });
         });
      }


      if(to.cleanArr){
         describe('#cleanArr()', () => {
            it('should return an array', () => {
               expect(to.cleanArr([1, 2, 3])).to.be.an('array');
            });

            it('should return remove all empty string, array, object if omit `itemToClean`', () => {
               const testArr = [1, 2, 3, null, undefined, {}, '', []];
               let result = to.cleanArr(testArr);
               expect(result).to.not.includes('');
               expect(result.reduce((p, c) => p || to.isEmptyArray(c), false)).to.be.false;
               expect(result.reduce((p, c) => p || to.isEmptyObject(c), false)).to.be.false;
            });

            it('should return an array that does not contain any items specified in `itemToClean`', () => {
               const testArr = [1, 2, null, 3, undefined, 4, 5, {}, '', []];
               let result = to.cleanArr(testArr, [null, undefined, 5]);
               expect(result).to.not.includes(5);
               expect(result).to.not.includes(null);
               expect(result).to.not.includes(undefined);
               expect(result).to.includes(2);
               expect(result).to.includes(1);
               expect(result).to.includes(3);
               expect(result).to.includes(4);

               result = to.cleanArr(testArr, 5);
               expect(result).to.not.includes(5);
               expect(result).to.includes(2);
               expect(result).to.includes(1);
               expect(result).to.includes(3);
               expect(result).to.includes(4);
               expect(result).to.includes(null);
               expect(result).to.includes(undefined);

               result = to.cleanArr(testArr, '');
               expect(result).to.not.includes('');
               expect(result.reduce((p, c) => p || to.isEmptyArray(c), false)).to.be.true;
               expect(result.reduce((p, c) => p || to.isEmptyObject(c), false)).to.be.true;
            });
         });
      }


      if(to.cleanString){
         describe('#cleanString()', () => {
            it('should return a string', () => {
               expect(to.cleanString('Hello World')).to.be.a('string');
            });

            it('should remove all simple ANSI codes', () => {
               const testStr = '\u001b[31mHello World\u001b[0m';
               expect(to.cleanString(testStr)).to.equal('Hello World');
            });

            it('should remove all complex ANSI codes', () => {
               const testStr = '\u001b[38;5;196mHello World\u001b[0m';
               expect(to.cleanString(testStr)).to.equal('Hello World');
            });

            it('should revert all hyperlinks to plain-text', () => {
               to.CheckCache.supportsHyperlink = true;
               const testStr = `oh look, that's elysia ${to.hyperLink('homepage', 'https://elysiajs.com/')} and docs ${to.hyperLink('page', 'https://elysiajs.com/quick-start.html')}.`;

               expect(to.cleanString(testStr)).to.equal(
                  'oh look, that\'s elysia https://elysiajs.com/ and docs https://elysiajs.com/quick-start.html.'
               );
               to.CheckCache.supportsHyperlink = null;
            });
         });
      }


      if(to.CONSTS){
         describe('#CONSTS', () => {
            if(to.CONSTS.UNICODES_RANGE_TABLE){
               describe('#UNICODES_RANGE_TABLE', () => {
                  it('should be an array', () => {
                     expect(to.CONSTS.UNICODES_RANGE_TABLE).to.be.an('array');
                  });

                  it('should contain objects with `type`, `regex`, `from` and `to` properties', () => {
                     for(const item of to.CONSTS.UNICODES_RANGE_TABLE){
                        expect(item).to.have.keys('type', 'regex', 'from', 'to');
                     }
                  });

                  it('each properties is a correct types', () => {
                     for(const item of to.CONSTS.UNICODES_RANGE_TABLE){
                        expect(item.type).to.be.a('string');
                        expect(item.regex).to.be.a('regexp');
                        expect(typeof item.from === 'number' || to.isArrayLike(item.from)).to.be.true;
                        expect(typeof item.to === 'number' || to.isArrayLike(item.to)).to.be.true;
                     }
                  });

                  it('if `from` or `to` is an ArrayLike, it should be an array of numbers or number otherwise', () => {
                     for(const item of to.CONSTS.UNICODES_RANGE_TABLE){
                        if(to.isArrayLike(item.from)){
                           // @ts-expect-error
                           expect(item.from.every(v => typeof v === 'number')).to.be.true;
                        }
                        else expect(typeof item.from === 'number').to.be.true;

                        if(to.isArrayLike(item.to)){
                           // @ts-expect-error
                           expect(item.to.every(v => typeof v === 'number')).to.be.true;
                        }
                        else expect(typeof item.to === 'number').to.be.true;
                     }
                  });

                  it('should be an array of read-only objects', () => {
                     const test = to.CONSTS.UNICODES_RANGE_TABLE;

                     try {
                        // @ts-expect-error
                        to.CONSTS.UNICODES_RANGE_TABLE[0].type = 'test';
                     } catch (e) {
                        expect(e).to.be.instanceOf(TypeError);
                     }

                     expect(to.CONSTS.UNICODES_RANGE_TABLE[0].type).to.not.equal('test');
                  });
               });
            }
         });
      }



      if(to.Convert){
         describe('#Convert', () => {
            if(to.Convert.decimalColorToRGB){
               describe('#decimalColorToRGB()', () => {
                  let result = to.Convert.decimalColorToRGB(0x000000);

                  it('should return an object with `r`, `g`, `b` properties', () => {
                     expect(result).to.have.keys('r', 'g', 'b');
                  });

                  it('should return an object with all properties as integers', () => {
                     expect(result.r).to.be.a('number');
                     expect(result.g).to.be.a('number');
                     expect(result.b).to.be.a('number');
                  });

                  it('should return an object with correct RGB values', () => {
                     expect(result).to.deep.equal({ r: 0, g: 0, b: 0 });

                     result = to.Convert.decimalColorToRGB(0xFFFFFF);
                     expect(result).to.deep.equal({ r: 255, g: 255, b: 255 });

                     result = to.Convert.decimalColorToRGB(0xc28cb7);
                     expect(result).to.deep.equal({ r: 194, g: 140, b: 183 });
                  });
               });
            }
         });
      }



      if(to.DataScienceKit){
         describe('#DataScienceKit', () => {
            if(to.DataScienceKit.frequencyOf){
               describe('#frequencyOf()', () => {
                  it('should return a map', () => {
                     expect(to.DataScienceKit.frequencyOf([1, 2, 3])).to.be.instanceOf(Map);
                  });

                  it('should return a map with correct frequency of each item', () => {
                     const testArr = [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3];
                     const result = to.DataScienceKit.frequencyOf(testArr);
                     expect(result.get(1)).to.equal(5);
                     expect(result.get(2)).to.equal(5);
                     expect(result.get(3)).to.equal(5);
                  });

                  it('if the given a string, it should return a map with correct frequency of each character', () => {
                     const testStr = 'Hello World';
                     const result = to.DataScienceKit.frequencyOf(testStr);
                     expect(result.get('H')).to.equal(1);
                     expect(result.get('e')).to.equal(1);
                     expect(result.get('l')).to.equal(3);
                     expect(result.get('o')).to.equal(2);
                     expect(result.get(' ')).to.equal(1);
                     expect(result.get('W')).to.equal(1);
                     expect(result.get('r')).to.equal(1);
                     expect(result.get('d')).to.equal(1);
                  });

                  it('should return an empty map if the given input is empty or invalid', () => {
                     const testInput = [null, undefined, 0, 1, {}, []];
                     for(const t of testInput){
                        // @ts-expect-error
                        expect(to.DataScienceKit.frequencyOf(t).size).to.equal(0);
                     }
                  });
               });
            }
         })
      }
   }
});