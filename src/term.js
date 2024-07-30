
const fs = require('fs');

const to = require('./helper/Tools');
const { ncc, strSurround } = to;

const Terminal = require('./helper/terminal');


to._modules.fs = fs;


const terminal = new Terminal([], '', false);


terminal.inputDebugMode = false;
terminal.allowedInputs = true;
terminal.redundancyLv = 2;
terminal.initialize(`
${ncc(0x23dbd2)} │ ${strSurround('WuWa Editor', ' ', 40)}
 │ ${strSurround('────', ' ', 40)}
 │ Wuthering Waves advanced settings editor
 │ ${ncc('White')}Version: 1.0.0${ncc('Reset')}\n\n`
);




module.exports = terminal;