/**
 * Builds the program list and handles loading and playing them.
 */
import { Component, OnInit } from '@angular/core';
import { ProgramControllerService } from '../services/program-controller.service';
import { FloorBuilderService } from '../services/floor-builder.service';
import { StorageService } from '../services/storage.service';
import { IProgram } from '../../../shared/program';

@Component ({
  selector: 'program-controller',
  templateUrl: './html/program_controller.html',
  styleUrls: ['./styles/program_controller.css'],
})
export class ProgramControllerComponent implements OnInit {
  programList:any[];
  
  shuffleOn:boolean = false;
  playAllOn:boolean = false;

  private _selectedProgram:IProgram = null;

  constructor(
    private _programService:ProgramControllerService,
    private _floorBuilder:FloorBuilderService,
    private _storage:StorageService) {
  }

  ngOnInit() {
    this.programList = this._programService.loadPrograms();

    this.shuffleOn = this._storage.getItem("controller.shuffle") || false;
    this.playAllOn = this._storage.getItem("controller.playAll") || false;

    // Listen for changes to the running program
    this._programService.runningProgram$.subscribe(
      program => {
        this._selectedProgram = program;
      },
      err => {
        console.error('Could not start program: ', err);
      });
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
   * Run the selected program (or the first one in the listf)
   */
  play(): void {
    let program = this.selectedProgram();

    if (!program) {
      this.next();
    } 
    else {
      this.playProgram(program);
    }
  }
  
  /**
   * Stop the current program and fade floor to off.
   */
  stopProgram(): void {
    let done = () => {
      this._floorBuilder.cellList.fadeToColor([0, 0, 0], 1000);
    }

    this._programService.stopProgram()
    .then(done, done);
  }

  /**
   * Play the next program
   */
  next(): void {
    this._programService.playNext();
  }

  /**
   * Play the previous program
   */
  previous(): void {
    this._programService.playPrevious();
  }

  /**
   * Toggle shuffle setting
   */
  toggleShuffle(): void {
    this.shuffleOn = !this.shuffleOn;
    this._programService.setShuffle(this.shuffleOn);
    this._storage.setItem("controller.shuffle", this.shuffleOn);
  }

  /**
   * Toggle "Play All" setting
   */
  togglePlayAll(): void {
    this.playAllOn = !this.playAllOn 
    this._programService.setPlayMode( (this.playAllOn) ? 'all' : 'one' );
    this._storage.setItem("controller.playAll", this.playAllOn);
  }
}
