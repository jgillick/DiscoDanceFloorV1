
/**
 * The interface that all programs must follow.
 *
 * Program lifecycle:
 *
 * 1. Start: Setup your program. (reset floor colors, set variables, etc)
 * 2. Loop: Will be called repeatedly to receive updates to the floor.
 * 3. Shutdown: Cleanup and shutdown the program.
 */
export interface IProgram {

  /**
   * Meta data about a program
   */
  info: IProgramInfo;

  /**
   * Called to start your program.
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