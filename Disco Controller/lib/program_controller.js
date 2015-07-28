
var fs = require('fs'),
    events = require('events'),
    disco  = require('./disco_controller.js'),
    Promise = require("bluebird");

var currentProgram = null,
    discoController = disco.controller,
    programs = [],
    playerTimout,
    program;

/**
  Manages getting the program list and starting/stopping all programs
  @class ProgramController
*/
module.exports = {

  /**
    Events emitted from the program controller:

    * started: A program just started
    * error: An error occurred while trying to start a program
    * before-shutdown: A program is going to be shutdown
    * shutdown: The program has been shut down

    @property events
    @type EventEmitter
  */
  events: new events.EventEmitter(),

  /**
    Set to true to play all the programs, one at a time
  */
  playAll: false,

  /**
    Filter the programs that will be payed when selecting Play All
    Possible values are:
      * `interactive: true`,
      * `audio: true`
  */
  playAllFilters: {},

  /**
    Get the current running program

    @method getCurrentProgram
    @return {Object} Information about the program or null
  */
  getCurrentProgram: function(){
    if (currentProgram) {
      return currentProgram.info;
    }
    return null;
  },

  /**
    Get a list of available disco programs.

    @method getProgramList
    @param {Object} filter Use an object to filter programs out
    @return {Promise} which will resolve with the program list
  */
  getProgramList: function(filter){
    filter = filter || {};

    function filterPrograms(program) {
      return (filter.interactive === undefined || program.info.interactive === filter.interactive) &&
              (filter.audio === undefined || program.info.audio === filter.audio);
    }

    // Read files from the programs directory
    if (!programs || programs.length === 0) {
      return new Promise(function(resolve) {
        programs = [];

        // Get program list
        fs.readdirSync('./programs/').forEach(function(file){
          try {
            var prog = require('../programs/'+ file);
            prog.file = file;
            programs.push(prog);
          } catch(e) {
            process.stderr.write(e.message);
            process.stderr.write(e.stack);
          }
        });

        // Sort by name
        programs = programs.sort(function(a, b){
          a = a.info.name.toLowerCase();
          b = b.info.name.toLowerCase();

          if (a < b) {
            return -1;
          } else if (a > b) {
            return 1;
          }
          return 0;
        });

        resolve(programs.filter(filterPrograms));
      });
    }

    // Return cached list
    return Promise.resolve(programs.filter(filterPrograms));
  },

  /**
    Run all programs. You can filter out programs by passing in
    and object with either `audio: true` and/or `interactive: true`.

    @method runAll
    @param {Object} filters (optional) An object used to filter out programs
  */
  runAllPrograms: function(filter) {
    this.playAllFilters = filter;
    this.playAll = true;
    this.runProgram('');
  },

  /**
    Run a disco program from the 'programs' directory

    @method runProgram
    @param {String} name The name of the program file to run
    @return Promise
  */
  runProgram: function(name){
    var shutdownTimout,
        started = false,
        self = this,
        promiseResolver = Promise.pending();

    // Play all programs
    if (name === '' && this.playAll) {
      this.getProgramList(this.playAllFilters)
      .then(function(programs){
        var autoRunIndex = 0;

        function autoRun() {
          var prog = programs[autoRunIndex],
              time = prog.info.miniumumTime || 0.5;

          self.runProgram(prog.file);

          autoRunIndex++;
          if (autoRunIndex > programs.length - 1) {
            autoRunIndex = 0;
          }

          // Play for `minimumTime` minutes
          time *= 60000;
          playerTimout = setTimeout(autoRun, time);
        }
        autoRun();
      });
      return;
    }
    else if (!this.playAll) {
      clearTimeout(playerTimout);
    }

    if (!name.match(/\.js$/)) {
      name = name +'.js';
    }

    function start() {
      try{
        var program = require('../programs/'+ name);
        program.file = name;
        program.init(discoController).then(function(){
          started = true;
          currentProgram = program;
          promiseResolver.resolve();
          program.run();
          self.events.emit('started', name, currentProgram.info);
        });
      } catch(e) {
        console.log(e.message);
        promiseResolver.reject(e.message);
        self.events.emit('error', e);
      }
    }

    // Stop the last program and then start the new one
    if (currentProgram) {
      shutdownTimout = setTimeout(start, 4000); // Failsafe timeout, in case shutdown function does not complete in 4 seconds
      this.stopProgram().then(function(){
        clearTimeout(shutdownTimout);
        if (!started) start();
      });
    } else {
      start();
    }

    return promiseResolver.promise;
  },

  /**
    Stopping the current running program

    @method stopProgram
    @returns Promise
  */
  stopProgram: function() {
    var promise,
        self = this;

    if (!currentProgram) {
      return Promise.resolve();
    }

    this.events.emit('before-shutdown', currentProgram.file, currentProgram.info);

    promise = currentProgram.shutdown();
    promise.then(function(){
      self.events.emit('shutdown', currentProgram.file, currentProgram.info);
      currentProgram = null;
    });

    return promise;
  }

};