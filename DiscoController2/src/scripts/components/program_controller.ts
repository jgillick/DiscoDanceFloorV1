/**
 * Builds the program list and handles loading and playing them.
 */
import {Component} from 'angular2/core';
import {ProgramService} from '../services/program';

@Component ({
  selector: 'program-controller',
  templateUrl: './html/program_controller.html'
})
export class ProgramControllerComponent {
  programList:any[];
  
  constructor(private _programService:ProgramService) {
  }
  
  ngOnInit() {
    this.programList = this._programService.loadPrograms();   
  }
}