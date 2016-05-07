
import { DiscoController } from './disco-controller';

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
  info: IProgramInfo;

  /**
   * Init the program instance
   */
  constructor(disco: DiscoController);

  /**
   * Called to setup your program and prepare it for the run loop.
   *
   * @return {Promise} A promise that resloves when your program is ready for the run loop.
   */
  start(): Promise<void>;

  /**
   * This manages updating the floor colors and will be called for each draw
   * cycle of the floor.
   */
  loop();

  /**
   * Called to stop and shutdown your program.
   * @return {Promise} A promise that resloves when your program has finished shutting down.
   */
  shutdown(): Promise<void>;
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
   * When the player is on auto-play mode, this is the
   * minimum recommended number of seconds this program
   * should play before moving to the next program.
   */
  miniumumTime?: number;
}