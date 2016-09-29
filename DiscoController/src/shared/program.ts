
import { FloorCellList } from './floor-cell-list';

/**
 * The interface that all programs must follow.
 *
 * Program lifecycle:
 *
 * 1. Init the program instance (happens every time the program starts playing)
 * 2. Start: Setup your program. (reset floor colors, set variables, etc)
 * 3. Loop: Will be called repeatedly to receive updates to the floor.
 * 4. Shutdown: Cleanup and shutdown the program.
 *
 * Be sure to `null` out your references in the shutdown function, so the instance can
 * effectively be garbage colleged.
 */
export interface IProgram {
  
  /**
   * Meta data about a program
   */
  info?: IProgramInfo;

  /**
   * Called to setup your program and prepare it for the run loop.
   *
   * @param {FloorCellList} cellList The list of floor cells.
   *
   * @return {Promise} A promise that resloves when your program is ready for the run loop.
   */
  start(cellList: FloorCellList): Promise<void>;

  /**
   * This manages updating the floor colors and will be called for each draw
   * cycle of the floor.
   *
   * @param {number} time The number of milliseconds since the last loop.
   */
  loop(time:number): void;

  /**
   * Called to stop and shutdown your program.
   * @return {Promise} A promise that resloves when your program has finished shutting down.
   */
  shutdown(): Promise<void>;

  /**
   * Internal use only, do not set this
   */
  file?: string;
}

/**
 * The object that describes a program
 */
export interface IProgramInfo {

  /**
   * The name of your progrm.
   */
  name: String;

  /**
   * A short description
   */
  description: String;

  /**
   * True if the program responds to the touch sensors.
   */
  interactive?: boolean;

  /**
   * True if the program responds to audio.
   */
  audio?: boolean;

  /** 
   * The minimum recommended minutes this program
   * should play when the player is on play-all mode.
   */
  miniumumTime?: number;

  /**
   * This program is currently disabled
   */
  disabled?: boolean;
}

/**
 * Class decorator to apply program information to the class
 */
export function Program(info: IProgramInfo) {
  return function (constructor: Function) {
    constructor.prototype.info = info;
  }
}
