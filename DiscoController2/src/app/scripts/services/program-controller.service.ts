/**
 * Controls loading and playing all the visualization programs
 * from the /programs folder.
 */

import * as fs from 'fs';
import * as path from 'path';

import {Injectable} from '@angular/core';
import { IProgram } from '../../../shared/program';

const PROGRAM_DIR = 'build/programs';

@Injectable()
export class ProgramService {

  programs:IProgram[] = [];
  runningProgram: IProgram;

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

  /**
   * Get a program by name
   *
   * @param {String} name The name of the program to fetch
   *
   * @return {IProgram}
   */
  getProgram(name: String) {
    name = name.toLocaleLowerCase();
    return this.programs.find( p => {
      return (p.info.name.toLowerCase() === name);
    });

  }

  /**
   * Play a program
   *
   * @param {String} name The name of the program to run.
   *
   * @return {Promise} resolves when the program is started and running.
   */
  runProgram(name: String): Promise<void> {
    let program = this.getProgram(name);
    if (program) {
      return new Promise<void>( (resolve, reject) => {

        // Stop program and then try to start it.
        this.stopProgram()
        .then(start, start);
        function start() {
          program.start().then(resolve, reject);
        }

      });
    }
    return Promise.reject(null);
  }

  /**
   * Stop the running program
   *
   * @return {Promise} resolves when the program has been shutdown
   */
  stopProgram(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.runningProgram) {
        this.runningProgram.shutdown().then(resolve, reject);
      }
    })
  }

}