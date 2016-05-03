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
  // Inject dependencies
  static get parameters() {
    return [[ProgramService]];
  }
  
  constructor(programService) {
    this._programService = programService;
    this.programList = [];
  }
  
  ngOnInit() {
    this.programList = this._programService.loadPrograms();   
  }
}