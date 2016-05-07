/**
 * Builds the program list and handles loading and playing them.
 */
import {Component} from '@angular/core';
import {ProgramService} from '../services/program-controller.service';

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