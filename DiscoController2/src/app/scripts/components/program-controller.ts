/**
 * Builds the program list and handles loading and playing them.
 */
import {Component} from '@angular/core';
import {ProgramControllerService} from '../services/program-controller.service';
import { IProgram } from '../../../shared/program';

@Component ({
  selector: 'program-controller',
  templateUrl: './html/program_controller.html'
})
export class ProgramControllerComponent {
  programList:any[];

  constructor(private _programService:ProgramControllerService) {
  }

  ngOnInit() {
    this.programList = this._programService.loadPrograms();
    this._programService.runProgram('primaries')
    .catch(err => {
      let msg = err.error || '';
      console.log(`Could not start the program: ${msg}`);
    });
  }
  
  /**
   * Run a program
   */
  playProgram(program: IProgram): void {
    this._programService.runProgram(program);
  }
}
