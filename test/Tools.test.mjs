//////////// Tools Test ////////////
/**# Test script for Tools.js
 *
 * for framework: mocha + chai
 * @version 2.12.11
 */

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
               expect(
                  to.arrToString(testArr, options).startsWith('Array(')
               ).to.be.false;
               options.noHeader = false;
            });

            it('the header should contain currect dimensions of the array', () => {
               expect(result.split(': ')[0]).to.equal('Array(3,4,5,5)');
            });

            it('should resolve ArrayLike type and parse it correctly', () => {
               expect(result.includes('Int32Array')).to.be.true;
            });

            it('should resolve Function type and parse it correctly', () => {
               expect(result).to.includes('async af () => {...}');
               expect(result).to.includes('[anonymous] () => {...}');
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
               options.color = false;
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

            it('should collapse the array if the array is too long', () => {
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
   }
});