/**
 * Controls loading and playing all the visualization programs
 * from the /programs folder.
 */

import {Injectable} from 'angular2/core';

import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_DIR = 'programs'

@Injectable() 
export class ProgramService {
  constructor() {
  }
  
  /**
   * Load the list of programs from the programs folder.
   */
  loadPrograms() {
    this.programs = [];
    
    let dirPath = path.join(process.env.INIT_CWD, PROGRAM_DIR);
    fs.readdirSync(dirPath).forEach(file => {
      
       // Not a javascript file
      if (!file.match(/^[^\.].*?\.js$/)) return;
      
      try {
        let prog = require(path.join(dirPath, file));
        prog.file = file;
        this.programs.push(prog);
      } catch(e) {
        process.stderr.write(e.message);
        process.stderr.write(e.stack);
      } 
    });
    
    return this.programs;
  }
  
}