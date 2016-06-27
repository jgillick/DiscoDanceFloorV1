/**
 * Builds the program list and handles loading and playing them.
 */
import { Component, OnInit } from '@angular/core';
import { ProgramControllerService } from '../services/program-controller.service';
import { IProgram } from '../../../shared/program';

@Component ({
  selector: 'program-controller',
  templateUrl: './html/program_controller.html'
})
export class ProgramControllerComponent implements OnInit {
  programList:any[];
  
  private _selectedProgram: IProgram;

  constructor(private _programService:ProgramControllerService) {
  }

  ngOnInit() {
    this.programList = this._programService.loadPrograms();
  }
  
  /**
   * Returns the program which is either running or selected
   */
  selectedProgram(): IProgram {
    let running:IProgram = this._programService.runningProgram;
    
    if (running) {
      this._selectedProgram = running;
    }
    
    return this._selectedProgram;
  }
  
  /**
   * Check if this is the selected program
   */
  isSelected(program:IProgram): boolean {
    let selected = this.selectedProgram();
    return (selected && selected.info.name == program.info.name);
  }
  
  /**
   * Returnes true if a program is currently running
   */
  isProgramRunning(): boolean {
    return !!(this._programService.runningProgram);
  }
  
  /**
   * Is a program in the process of stopping or starting?
   */
  isStoppingOrStarting(): boolean {
    return (this._programService.isStarting || this._programService.isStopping);
  }
  
  /**
   * Run a program
   */
  playProgram(program: IProgram): void {
    this._selectedProgram = program;
    
    if (!program) {
      return;
    }
    
    this._programService.runProgram(program)
    .catch((err) => {
      let msg = err.error || err;
      console.error(`Could not start the program: ${msg}`);
    });
  }
  
  /**
   * Run the selected program
   */
  playSelected(): void {
    this.playProgram(this.selectedProgram());
  }
  
  /**
   * Stop the current program
   */
  stopProgram(): void {
    this._programService.stopProgram();
  }
}
