/**
 * Controls loading and playing all the visualization programs
 * from the programs folder.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Inject, Injectable } from '@angular/core';
import { IProgram } from '../../../shared/program';
import { FloorBuilderService } from './floor-builder.service';

const PROGRAM_DIR = 'build/programs';

// timeout for program startup and shutdown
const PROGRAM_TIMEOUT = 5000;

// The number of milliseconds between run loop cycles
const RUN_LOOP_SPEED = 10;

@Injectable()
export class ProgramControllerService {

  programs:IProgram[] = [];
  runningProgram: IProgram;
  isStopping: boolean = false;
  isStarting: boolean = false;

  private _runningLoop:boolean = false;

  constructor(@Inject(FloorBuilderService) private _floorBuilder:FloorBuilderService) {
    this.startRunLoop();
  }
  
  /**
   * Create a promise that times out
   */
  private _promiseTimeout(milliseconds:number, promise:Promise<any>): Promise<any>{
    return new Promise<void>((resolve, reject) => {
      
      // Setup timeout
      var timeout = setTimeout(() => {
        reject({ error: 'timeout' });
      }, milliseconds);
      function cancelTimeout() {
        clearTimeout(timeout);
      }
      
      // Run promise
      promise
      .then( () => {console.log('Done!') })
      .then(cancelTimeout)
      .then(resolve, reject);
      
    });
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
  getProgramByName(name: String) {
    name = name.toLocaleLowerCase();
    return this.programs.find( p => {
      return (p.info.name.toLowerCase() === name);
    });

  }

  /**
   * Start playing a program (stop the existing program, if one was running)
   *
   * @param {String} name The name of the program to run.
   *
   * @return {Promise} resolves when the program is started and running.
   */
  runProgram(program: IProgram): Promise<void> {
    let cellList = this._floorBuilder.cellList;
    if (program) {
      return new Promise<void>( (resolve, reject) => {

        // Stop running program before starting the new one 
        try {
          this.stopProgram()
          .then(start.bind(this), start.bind(this));
        } catch(e) {
          reject(e);
        }
        
        // Start program
        function start() {
          this.isStarting = true;
          try {
            
            this._promiseTimeout(PROGRAM_TIMEOUT, program.start(cellList))
            .then(() => {
              finishStartup.bind(this)();
              this.runningProgram = program;
              this.startRunLoop();
              resolve();
            })
            .catch((err) => {
              finishStartup.bind(this)();
              reject(err);
            });
            
          } catch(e) {
            reject({ error: e.toString() })
            finishStartup.bind(this)();
          }
        }
        
        // Finish the program startup tasks
        function finishStartup() {
          this.isStarting = false;
          cellList.clearFadePromises();
          cellList.updateColor();
        }
      });
    }
    return Promise.reject({ error: "Could not find program" });
  }

  /**
   * Stop the running program
   *
   * @return {Promise} resolves when the program has been shutdown
   */
  stopProgram(): Promise<void> {
    let cellList = this._floorBuilder.cellList;
    
    return new Promise<void>((resolve, reject) => {
      if (!this.runningProgram) {
        resolve();
        return;
      }

      // Shutdown
      this.isStopping = true;
      try {
        let shutdown = this._promiseTimeout(PROGRAM_TIMEOUT, this.runningProgram.shutdown());
        shutdown.then(finish.bind(this), finish.bind(this));
        shutdown.then(resolve, reject);
      } catch(e) {
        finish();
        reject({ error: e.toString() })
      }
      
      function finish() {
        this.isStopping = false;
        this.runningProgram = null;
        cellList.clearFadePromises();
      }
    })
  }

  /**
   * Start the program run loop which calls the `loop` method
   * of the running program and updates the colors on fading cells.
   */
  startRunLoop() {
    let lastLoopTime = (new Date()).getTime();

    let runLoop = (function() {
      if (!this._runningLoop) {
        return;
      }
      try {
        let now = (new Date()).getTime(),
            timeDiff = now - lastLoopTime;
            
        // Call running program's loop method
        if (this.runningProgram) {
          this.runningProgram.loop(timeDiff);
        }
        
        // Update cell fading
        this._floorBuilder.cellList.updateColor();
        
        if (timeDiff > 0) {
          lastLoopTime = now;
        }
        
      } catch(e) {
        console.error(e);
      }
      
      window.requestAnimationFrame(runLoop);
    }).bind(this);
    
    this._runningLoop = true;
    runLoop();
  }

  /**
   * Stop the program run loop
   */
  stopRunLoop() {
    this._runningLoop = false;
  }
}