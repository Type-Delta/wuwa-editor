const exec = require('child_process').exec;
const execProms = require('util').promisify(exec);
const fs = require('fs');
const commandExists = require('command-exists');

const { ncc } = require('../src/helper/Tools.js');

(async () => {
   if(process.platform !== 'win32'){
      console.log(
         `nothing to build on platform ${process.platform}`
      );
      return;
   }

   console.log(
      ncc('Green') + `Starting build process...${ncc()} (this process only needs to be done once)\nDon\'t worry, if the build process fails, the program would still work (w/o auto path detection)`
   );

   try {
      const success = await buildGetIPath('src/module/getIPath.win.cpp', 'getIPath.exe');
      if(!success) return;
   }
   catch(e){
      console.log(
         ncc('Red') + `Error while building!${ncc()}\nError: ${e.stack}`
      );
      return;
   }

   console.log(
      ncc('Green') + `Build completed!${ncc()}`
   );
})();



async function buildGetIPath(srcPath, executableName){
   console.log(
      ncc('Dim') + `Building ${executableName}...` + ncc()
   );

   if(!fs.existsSync(srcPath)){
      console.log(
         ncc('Red') + `"${srcPath}" not found!${ncc()}\ncan not find the cpp source file, make sure to run this script in the correct directory`
      );
      return false;
   }

   if(!fs.existsSync('build')){
      fs.mkdirSync('build');
   }

   if(!(await commandExists('g++'))){
      console.log(
         ncc('Red') + `g++ not found!${ncc()}\nplease install g++ before running this script`
      );
      return false;
   }

   const { stderr, stdout } = await execProms(`g++ "${srcPath}" -o "build/${executableName}"`);
   if(stderr){
      console.log(
         ncc('Red') + `Build failed!${ncc()}\n${stderr}`
      );
      return false;
   }
   return true;
}